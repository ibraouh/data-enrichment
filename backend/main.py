import asyncio
import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import httpx
import pandas as pd
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()  # must run before any local module that reads env vars at import time

from database import (
    create_project, create_sheet_project, delete_project, get_enriched_leads,
    get_leads_for_project, get_project_by_id, get_projects, get_raw_enrichment,
    rename_project, save_ai_insights, save_enrichment_result, save_lead_score,
    save_leads, save_raw_enrichment, update_project_status, update_sheet_last_row,
)
from models import (
    AIInsights, EnrichedLead, EnrichLeadsResponse, EnrichmentData, EnrichRequest,
    GenerateOutreachRequest, LinkSheetRequest, OutreachEmail, ParseLeadsResponse,
    RawLead, ScoreBreakdown, SheetSyncResponse, StoredLead,
)
from utils import parse_csv_bytes, parse_csv_text, parse_excel_bytes, parse_dataframe
from sheets import (
    SERVICE_ACCOUNT_EMAIL, SHEETS_ENABLED, fetch_all_sheet_data, parse_sheet_url,
)
from enrichment.census import enrich_census
from enrichment.datausa import enrich_datausa
from enrichment.nominatim import enrich_nominatim
from enrichment.overpass import enrich_overpass
from enrichment.hud_fmr import enrich_hud_fmr
from enrichment.fred import enrich_fred
from enrichment.news import enrich_news
from scoring import score as score_lead
from outreach import generate_outreach

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


@app.post("/api/leads/{lead_id}/outreach", response_model=AIInsights)
async def generate_lead_outreach(lead_id: str, body: GenerateOutreachRequest):
    insights = await generate_outreach(body.lead, body.enrichment, body.score)
    if SUPABASE_ENABLED:
        await save_ai_insights(lead_id, insights.model_dump())
    return insights


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
            latitude=row.get("latitude"),
            longitude=row.get("longitude"),
            osm_suburb=row.get("osm_suburb"),
            osm_quarter=row.get("osm_quarter"),
            osm_postcode=row.get("osm_postcode"),
            osm_county=row.get("osm_county"),
            fmr_studio=row.get("fmr_studio"),
            fmr_1br=row.get("fmr_1br"),
            fmr_2br=row.get("fmr_2br"),
            nearby_multifamily_count=row.get("nearby_multifamily_count"),
            state_unemployment_rate=row.get("state_unemployment_rate"),
            rental_vacancy_rate=row.get("rental_vacancy_rate"),
            housing_price_index=row.get("housing_price_index"),
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
        ai=AIInsights(
            email=OutreachEmail(
                subject=row.get("email_subject") or "",
                body=row.get("email_body") or "",
            ),
            score_rationale=row.get("score_rationale") or "",
            sales_insights=row.get("sales_insights") or [],
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

            # Phase 1: geocode first — coordinates feed Overpass, county feeds HUD FMR
            nom = await enrich_nominatim(lead, http)
            lat = nom.get("latitude")
            lon = nom.get("longitude")
            county = nom.get("county")

            # Phase 2: all remaining modules in parallel
            results = await asyncio.gather(
                enrich_census(lead, http),
                enrich_datausa(lead, http),
                enrich_overpass(lat, lon, http),
                enrich_hud_fmr(lead, county, http),
                enrich_fred(lead, http),
                enrich_news(lead, http),
            )

        merged: dict = {**nom}
        raw_by_source: dict = {}
        merged.pop("county", None)  # county is routing metadata, not an enrichment field
        if (nom_raw := merged.pop("_raw", None)):
            raw_by_source["nominatim"] = nom_raw
        for r, source in zip(results, ["census", "datausa", "overpass", "hud_fmr", "fred", "news"]):
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

        if SUPABASE_ENABLED:
            lead_id = row.get("id", "")
            await asyncio.gather(
                save_enrichment_result(lead_id, enrichment.model_dump()),
                save_lead_score(lead_id, score_breakdown.model_dump()),
                save_raw_enrichment(lead_id, raw_by_source),
            )

        return EnrichedLead(**row, enrichment=enrichment, score=score_breakdown)

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
# Google Sheets endpoints
# ---------------------------------------------------------------------------

@app.get("/api/sheets/service-account-email")
async def get_service_account_email():
    if not SHEETS_ENABLED:
        raise HTTPException(status_code=503, detail="Google Sheets integration is not configured.")
    return {"email": SERVICE_ACCOUNT_EMAIL}


@app.post("/api/sheets/link", response_model=ParseLeadsResponse)
async def link_google_sheet(body: LinkSheetRequest):
    if not SHEETS_ENABLED:
        raise HTTPException(status_code=503, detail="Google Sheets integration is not configured.")
    try:
        spreadsheet_id = parse_sheet_url(body.sheet_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    try:
        all_rows, total_rows = fetch_all_sheet_data(spreadsheet_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read Google Sheet: {exc}")

    leads, errors = _validate_sheet_rows(all_rows)
    if not leads:
        raise HTTPException(
            status_code=422,
            detail="No valid leads found in the sheet. Check that your column names match the expected format.",
        )

    name = f"Sheet – {datetime.now().strftime('%b %d')}"
    imported_at = datetime.now(timezone.utc).isoformat()

    if SUPABASE_ENABLED:
        project = await create_sheet_project(name, body.sheet_url, len(leads), total_rows)
        project_id = project["id"]
        lead_dicts = [l.model_dump() for l in leads]
        stored = await save_leads(project_id, lead_dicts, imported_at=imported_at)
        stored_leads = [StoredLead(**row) for row in stored]
    else:
        import uuid
        project_id = str(uuid.uuid4())
        stored_leads = [
            StoredLead(**lead.model_dump(), id=str(uuid.uuid4()), project_id=project_id, imported_at=imported_at)
            for lead in leads
        ]

    return ParseLeadsResponse(
        project_id=project_id,
        leads=stored_leads,
        total=len(stored_leads),
        errors=errors,
    )


@app.post("/api/projects/{project_id}/sheet-sync", response_model=SheetSyncResponse)
async def sync_sheet_rows(project_id: str):
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=503, detail="Database not configured.")
    if not SHEETS_ENABLED:
        raise HTTPException(status_code=503, detail="Google Sheets integration is not configured.")

    project = await get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    if project.get("source") != "google_sheet":
        raise HTTPException(status_code=400, detail="This project is not linked to a Google Sheet.")

    sheet_url: str = project.get("sheet_url", "")
    sheet_last_row: int = project.get("sheet_last_row", 0)

    try:
        spreadsheet_id = parse_sheet_url(sheet_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    try:
        all_rows, total_rows = fetch_all_sheet_data(spreadsheet_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read Google Sheet: {exc}")

    new_rows = all_rows[sheet_last_row:]
    if not new_rows:
        return SheetSyncResponse(project_id=project_id, new_leads=[], new_count=0, total_rows=total_rows)

    leads, _ = _validate_sheet_rows(new_rows)
    imported_at = datetime.now(timezone.utc).isoformat()
    lead_dicts = [l.model_dump() for l in leads]
    stored = await save_leads(project_id, lead_dicts, imported_at=imported_at)
    await update_sheet_last_row(project_id, total_rows)
    stored_leads = [StoredLead(**row) for row in stored]

    return SheetSyncResponse(
        project_id=project_id,
        new_leads=stored_leads,
        new_count=len(stored_leads),
        total_rows=total_rows,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_sheet_rows(rows: list[dict]) -> tuple[list[RawLead], list[str]]:
    """Convert raw sheet row dicts → validated RawLeads using existing utils logic."""
    if not rows:
        return [], []
    df = pd.DataFrame(rows)
    return parse_dataframe(df)


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
