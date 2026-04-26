import asyncio
import os
from typing import Optional
from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
from dotenv import load_dotenv

from database import (
    create_project, delete_project, get_enriched_leads, get_leads_for_project,
    get_project_by_id, get_projects, get_raw_enrichment, rename_project,
    save_enrichment_result, save_lead_score, save_leads, save_raw_enrichment,
    update_project_status,
)
from models import (
    AIInsights, EnrichedLead, EnrichLeadsResponse, EnrichmentData, EnrichRequest,
    ParseLeadsResponse, RawLead, ScoreBreakdown, StoredLead,
)
from utils import parse_csv_bytes, parse_csv_text, parse_excel_bytes
from enrichment.census import enrich_census
from enrichment.datausa import enrich_datausa
from enrichment.walkscore import enrich_walkscore
from enrichment.fred import enrich_fred
from enrichment.news import enrich_news
from scoring import score as score_lead
from outreach import generate_outreach

load_dotenv()

app = FastAPI(title="EliseAI Lead Enrichment API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_ENABLED = bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY"))


@app.get("/api/health")
async def health():
    return {"status": "ok", "db": "connected" if SUPABASE_ENABLED else "not configured"}


@app.get("/api/hello")
async def hello():
    return {"message": "EliseAI Lead Enrichment API is live."}


@app.get("/api/projects/{project_id}/detail")
async def get_project(project_id: str):
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=503, detail="Database not configured.")
    project = await get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


@app.get("/api/projects")
async def list_projects():
    if not SUPABASE_ENABLED:
        return {"projects": []}
    projects = await get_projects()
    return {"projects": projects}


class RenameBody(BaseModel):
    name: str


@app.get("/api/projects/{project_id}/leads")
async def list_project_leads(project_id: str):
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=503, detail="Database not configured.")
    leads = await get_leads_for_project(project_id)
    return {"leads": leads}


@app.delete("/api/projects/{project_id}", status_code=204)
async def remove_project(project_id: str):
    if not SUPABASE_ENABLED:
        return
    await delete_project(project_id)


@app.patch("/api/projects/{project_id}")
async def patch_project(project_id: str, body: RenameBody):
    if not SUPABASE_ENABLED:
        return {"ok": True}
    await rename_project(project_id, body.name)
    return {"ok": True}


@app.post("/api/parse-leads", response_model=ParseLeadsResponse)
async def parse_leads(
    file: Optional[UploadFile] = File(default=None),
    csv_text: Optional[str] = Form(default=None),
):
    if file is not None:
        content = await file.read()
        filename = file.filename or ""
        if filename.endswith((".xlsx", ".xls")):
            leads, errors = parse_excel_bytes(content)
        else:
            leads, errors = parse_csv_bytes(content)
        name = filename or "File Upload"
        source = "file"
    elif csv_text:
        leads, errors = parse_csv_text(csv_text)
        name = "CSV Paste"
        source = "csv"
    else:
        raise HTTPException(status_code=400, detail="Provide either a file upload or csv_text.")

    if not leads:
        raise HTTPException(
            status_code=422,
            detail="No valid leads found. Check that column names match the expected format."
        )

    return await _persist_and_respond(leads, errors, name, source)


@app.post("/api/parse-leads/single", response_model=ParseLeadsResponse)
async def parse_lead_single(lead: RawLead):
    return await _persist_and_respond([lead], [], "Single Lead", "single")


@app.get("/api/leads/{lead_id}/raw-enrichment")
async def get_lead_raw_enrichment(lead_id: str):
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=503, detail="Database not configured.")
    data = await get_raw_enrichment(lead_id)
    if not data:
        raise HTTPException(status_code=404, detail="No raw enrichment data found for this lead.")
    return data


@app.get("/api/projects/{project_id}/enriched-leads", response_model=EnrichLeadsResponse)
async def get_project_enriched_leads(project_id: str):
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=503, detail="Database not configured.")
    rows = await get_enriched_leads(project_id)
    if not rows:
        raise HTTPException(status_code=404, detail="No enriched leads found for this project.")
    leads = [_row_to_enriched_lead(row) for row in rows]
    return EnrichLeadsResponse(project_id=project_id, leads=leads, total=len(leads), enrichment_errors=[])


def _row_to_enriched_lead(row: dict) -> EnrichedLead:
    return EnrichedLead(
        id=row["id"],
        project_id=row["project_id"],
        name=row["name"],
        email=row["email"],
        company=row["company"],
        property_address=row["property_address"],
        city=row["city"],
        state=row["state"],
        country=row.get("country", "USA"),
        enrichment=EnrichmentData(
            median_household_income=row.get("median_household_income"),
            total_population=row.get("total_population"),
            renter_percentage=row.get("renter_percentage"),
            avg_wage=row.get("avg_wage"),
            poverty_rate=row.get("poverty_rate"),
            walk_score=row.get("walk_score"),
            transit_score=row.get("transit_score"),
            bike_score=row.get("bike_score"),
            walk_description=row.get("walk_description"),
            state_unemployment_rate=row.get("state_unemployment_rate"),
            rental_vacancy_rate=row.get("rental_vacancy_rate"),
            news_sentiment=row.get("news_sentiment"),
            news_articles=row.get("news_articles") or [],
            enrichment_errors=row.get("enrichment_errors") or [],
        ),
        score=ScoreBreakdown(
            demographics_score=row.get("demographics_score") or 0,
            market_health_score=row.get("market_health_score") or 0,
            walkability_score=row.get("walkability_score") or 0,
            news_score=row.get("news_score") or 0,
            geographic_score=row.get("geographic_score") or 0,
            total=row.get("score") or 0,
            tier=row.get("tier") or "NOT_QUALIFIED",
        ),
    )


@app.post("/api/projects/{project_id}/enrich", response_model=EnrichLeadsResponse)
async def enrich_project_leads(
    project_id: str,
    body: Optional[EnrichRequest] = Body(default=None),
):
    if body and body.leads:
        lead_rows = [l.model_dump() for l in body.leads]
    elif SUPABASE_ENABLED:
        lead_rows = await get_leads_for_project(project_id)
    else:
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Pass leads in the request body.",
        )

    if not lead_rows:
        raise HTTPException(status_code=404, detail="No leads found for this project.")

    if SUPABASE_ENABLED:
        await update_project_status(project_id, "enriching")

    sem = asyncio.Semaphore(5)

    async def process_lead(row: dict, http: httpx.AsyncClient) -> EnrichedLead:
        async with sem:
            lead = RawLead(**{k: v for k, v in row.items() if k in RawLead.model_fields})
            results = await asyncio.gather(
                enrich_census(lead, http),
                enrich_datausa(lead, http),
                enrich_walkscore(lead, http),
                enrich_fred(lead, http),
                enrich_news(lead, http),
            )

        merged: dict = {}
        raw_by_source: dict = {}
        for r, source in zip(results, ["census", "datausa", "walkscore", "fred", "news"]):
            raw = r.pop("_raw", None)
            merged.update(r)
            if raw:
                raw_by_source[source] = raw

        enrichment = EnrichmentData(
            **{k: v for k in EnrichmentData.model_fields
               if k != "enrichment_errors" and (v := merged.get(k)) is not None},
            enrichment_errors=[],
        )
        score_input = {**merged, "city": lead.city, "state": lead.state}
        score_breakdown = score_lead(score_input)

        stored = StoredLead(**{k: v for k, v in row.items() if k in StoredLead.model_fields})
        ai_insights = await generate_outreach(stored, enrichment, score_breakdown)

        if SUPABASE_ENABLED:
            lead_id = row.get("id", "")
            await asyncio.gather(
                save_enrichment_result(lead_id, enrichment.model_dump()),
                save_lead_score(lead_id, score_breakdown.model_dump()),
                save_raw_enrichment(lead_id, raw_by_source),
            )

        return EnrichedLead(**row, enrichment=enrichment, score=score_breakdown, ai=ai_insights)

    try:
        async with httpx.AsyncClient() as http:
            enriched = await asyncio.gather(*[process_lead(row, http) for row in lead_rows])

        if SUPABASE_ENABLED:
            await update_project_status(project_id, "complete")

        return EnrichLeadsResponse(
            project_id=project_id,
            leads=list(enriched),
            total=len(enriched),
            enrichment_errors=[],
        )
    except Exception as exc:
        if SUPABASE_ENABLED:
            await update_project_status(project_id, "failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _persist_and_respond(
    leads: list[RawLead],
    errors: list[str],
    name: str,
    source: str,
) -> ParseLeadsResponse:
    if SUPABASE_ENABLED:
        project = await create_project(name, len(leads), source)
        project_id = project["id"]
        lead_dicts = [l.model_dump() for l in leads]
        stored = await save_leads(project_id, lead_dicts)
        stored_leads = [StoredLead(**row) for row in stored]
    else:
        # No DB configured — return leads with placeholder IDs so the
        # frontend still works end-to-end during local dev without Supabase.
        import uuid
        project_id = str(uuid.uuid4())
        stored_leads = [
            StoredLead(**lead.model_dump(), id=str(uuid.uuid4()), project_id=project_id)
            for lead in leads
        ]

    return ParseLeadsResponse(
        project_id=project_id,
        leads=stored_leads,
        total=len(stored_leads),
        errors=errors,
    )
