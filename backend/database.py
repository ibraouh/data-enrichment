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


async def create_sheet_project(
    name: str,
    sheet_url: str,
    total_leads: int,
    initial_row_count: int,
) -> dict:
    db = get_client()
    result = db.table("projects").insert({
        "name": name,
        "status": "pending",
        "total_leads": total_leads,
        "source": "google_sheet",
        "sheet_url": sheet_url,
        "sheet_last_row": initial_row_count,
    }).execute()
    return result.data[0]


async def update_sheet_last_row(project_id: str, row_count: int) -> None:
    db = get_client()
    db.table("projects").update({
        "sheet_last_row": row_count,
        "updated_at": "now()",
    }).eq("id", project_id).execute()


async def rename_project(project_id: str, name: str) -> None:
    db = get_client()
    db.table("projects").update({"name": name}).eq("id", project_id).execute()


async def save_leads(
    project_id: str,
    leads: list[dict],
    imported_at: str | None = None,
) -> list[dict]:
    db = get_client()
    rows = [{**lead, "project_id": project_id} for lead in leads]
    if imported_at:
        rows = [{**row, "imported_at": imported_at} for row in rows]
    result = db.table("leads").insert(rows).execute()
    return result.data


async def update_project_status(project_id: str, status: str) -> None:
    db = get_client()
    db.table("projects").update({
        "status": status,
        "updated_at": "now()",
    }).eq("id", project_id).execute()


async def get_project_by_id(project_id: str) -> dict | None:
    db = get_client()
    result = db.table("projects").select("*").eq("id", project_id).limit(1).execute()
    return result.data[0] if result.data else None


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


async def get_enriched_leads(project_id: str) -> list[dict]:
    db = get_client()
    result = db.table("enriched_leads").select("*").eq("project_id", project_id).execute()
    return result.data


async def save_raw_enrichment(lead_id: str, raw: dict) -> None:
    db = get_client()
    row = {
        "lead_id": lead_id,
        "census": raw.get("census"),
        "nominatim": raw.get("nominatim"),
        "overpass": raw.get("overpass"),
        "hud_fmr": raw.get("hud_fmr"),
        "fred": raw.get("fred"),
        "news": raw.get("news"),
    }
    db.table("enrichment_raw").upsert(row, on_conflict="lead_id").execute()


async def get_raw_enrichment(lead_id: str) -> dict | None:
    db = get_client()
    result = db.table("enrichment_raw").select("*").eq("lead_id", lead_id).limit(1).execute()
    return result.data[0] if result.data else None


async def save_enrichment_result(lead_id: str, data: dict) -> None:
    db = get_client()
    row = {
        "lead_id": lead_id,
        "median_household_income": data.get("median_household_income"),
        "total_population": data.get("total_population"),
        "renter_percentage": data.get("renter_percentage"),
        "avg_wage": data.get("avg_wage"),
        "poverty_rate": data.get("poverty_rate"),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "osm_suburb": data.get("osm_suburb"),
        "osm_quarter": data.get("osm_quarter"),
        "osm_postcode": data.get("osm_postcode"),
        "osm_county": data.get("osm_county"),
        "fmr_studio": data.get("fmr_studio"),
        "fmr_1br": data.get("fmr_1br"),
        "fmr_2br": data.get("fmr_2br"),
        "nearby_multifamily_count": data.get("nearby_multifamily_count"),
        "state_unemployment_rate": data.get("state_unemployment_rate"),
        "rental_vacancy_rate": data.get("rental_vacancy_rate"),
        "housing_price_index": data.get("housing_price_index"),
        "news_sentiment": data.get("news_sentiment"),
        "news_articles": data.get("news_articles", []),
        "enrichment_errors": data.get("enrichment_errors", []),
    }
    db.table("enrichment_results").upsert(row, on_conflict="lead_id").execute()


async def save_ai_insights(lead_id: str, ai: dict) -> None:
    db = get_client()
    db.table("outreach").upsert(
        {
            "lead_id": lead_id,
            "email_subject": ai.get("email", {}).get("subject", ""),
            "email_body": ai.get("email", {}).get("body", ""),
            "sales_insights": ai.get("sales_insights", []),
        },
        on_conflict="lead_id",
    ).execute()
    rationale = ai.get("score_rationale", "")
    if rationale:
        db.table("lead_scores").update({"rationale": rationale}).eq("lead_id", lead_id).execute()


async def save_lead_score(lead_id: str, score: dict) -> None:
    db = get_client()
    row = {
        "lead_id": lead_id,
        "demographics_score": score.get("demographics_score", 0),
        "market_health_score": score.get("market_health_score", 0),
        "walkability_score": score.get("walkability_score", 0),
        "news_score": score.get("news_score", 0),
        "geographic_score": score.get("geographic_score", 0),
        "total": score.get("total", 0),
        "tier": score.get("tier", "NOT_QUALIFIED"),
    }
    db.table("lead_scores").upsert(row, on_conflict="lead_id").execute()
