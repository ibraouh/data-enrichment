import os
from typing import Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from database import create_project, delete_project, get_leads_for_project, get_projects, rename_project, save_leads
from models import ParseLeadsResponse, RawLead, StoredLead
from utils import parse_csv_bytes, parse_csv_text, parse_excel_bytes

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
