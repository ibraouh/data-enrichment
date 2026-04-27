import os
import httpx
from models import RawLead

_BASE = "https://www.huduser.gov/hudapi/public/fmr"


async def enrich_hud_fmr(lead: RawLead, county: str | None, client: httpx.AsyncClient) -> dict:
    """Fetch HUD Fair Market Rents for the lead's county.

    county — the full county name (e.g. "Cook County") from Nominatim address details.
    Requires HUD_API_KEY env var (free token at huduser.gov/hudapi/public/register).
    """
    try:
        api_key = os.getenv("HUD_API_KEY")
        if not api_key:
            return {}

        headers = {"Authorization": f"Bearer {api_key}"}
        state = lead.state.upper()

        # Step 1: list counties for the state — API returns a flat list
        r = await client.get(
            f"{_BASE}/listCounties/{state}",
            headers=headers,
            timeout=10.0,
        )
        if r.status_code != 200:
            return {}

        counties = r.json()  # flat list, not {"data": [...]}
        if not isinstance(counties, list):
            counties = counties.get("data", [])

        # Step 2: match using county from Nominatim (most precise) then city name fallback
        city_lower = lead.city.lower()
        county_lower = (county or "").lower()

        fips_code = None
        for entry in counties:
            name = (entry.get("county_name") or "").lower()
            if county_lower and name == county_lower:
                fips_code = entry.get("fips_code")
                break
            if not fips_code and city_lower in name:
                fips_code = entry.get("fips_code")

        if not fips_code:
            return {}

        # Step 3: fetch FMR data for the matched county
        r2 = await client.get(
            f"{_BASE}/data/{fips_code}",
            headers=headers,
            timeout=10.0,
        )
        if r2.status_code != 200:
            return {}

        payload = r2.json().get("data", {})
        basic_list = payload.get("basicdata", [])

        # basicdata is a list; first item with zip_code "MSA level" has metro-wide FMRs
        msa_row = next(
            (row for row in basic_list if str(row.get("zip_code", "")).strip().lower() == "msa level"),
            basic_list[0] if basic_list else {},
        )

        return {
            "fmr_studio": _int(msa_row.get("Efficiency")),
            "fmr_1br": _int(msa_row.get("One-Bedroom")),
            "fmr_2br": _int(msa_row.get("Two-Bedroom")),
            "_raw": {
                "source": "HUD Fair Market Rents",
                "fips_code": fips_code,
                "metro_name": payload.get("metro_name"),
                "area_name": payload.get("area_name"),
                "year": payload.get("year"),
                "msa_rents": msa_row,
            },
        }
    except Exception:
        return {}


def _int(val) -> int | None:
    try:
        return int(val) if val is not None else None
    except (TypeError, ValueError):
        return None
