import httpx
from models import RawLead


async def enrich_nominatim(lead: RawLead, client: httpx.AsyncClient) -> dict:
    try:
        query = f"{lead.property_address}, {lead.city}, {lead.state}"
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1, "addressdetails": 1},
            headers={"User-Agent": "EliseAI-LeadEnrichment/1.0 (interview project)"},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return {}
        r = data[0]
        address = r.get("address", {})
        return {
            "latitude": float(r["lat"]),
            "longitude": float(r["lon"]),
            "county": address.get("county"),  # routing metadata for HUD FMR lookup
            "osm_suburb": address.get("suburb"),
            "osm_quarter": address.get("quarter"),
            "osm_postcode": address.get("postcode"),
            "osm_county": address.get("county"),
            "_raw": {
                "source": "OpenStreetMap Nominatim",
                "query": query,
                "result": r,
            },
        }
    except Exception:
        return {}
