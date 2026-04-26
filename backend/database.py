import os
from supabase import create_client, Client

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
        _client = create_client(url, key)
    return _client


async def create_project(name: str, total_leads: int, source: str = "file") -> dict:
    db = get_client()
    result = db.table("projects").insert({
        "name": name,
        "status": "pending",
        "total_leads": total_leads,
        "source": source,
    }).execute()
    return result.data[0]


async def rename_project(project_id: str, name: str) -> None:
    db = get_client()
    db.table("projects").update({"name": name}).eq("id", project_id).execute()


async def save_leads(project_id: str, leads: list[dict]) -> list[dict]:
    db = get_client()
    rows = [{**lead, "project_id": project_id} for lead in leads]
    result = db.table("leads").insert(rows).execute()
    return result.data


async def update_project_status(project_id: str, status: str) -> None:
    db = get_client()
    db.table("projects").update({
        "status": status,
        "updated_at": "now()",
    }).eq("id", project_id).execute()


async def get_projects() -> list[dict]:
    db = get_client()
    result = db.table("projects").select("*").order("created_at", desc=True).execute()
    return result.data


async def delete_project(project_id: str) -> None:
    db = get_client()
    db.table("leads").delete().eq("project_id", project_id).execute()
    db.table("projects").delete().eq("id", project_id).execute()


async def get_leads_for_project(project_id: str) -> list[dict]:
    db = get_client()
    result = db.table("leads").select("*").eq("project_id", project_id).execute()
    return result.data
