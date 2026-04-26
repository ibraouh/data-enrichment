import os
import httpx
import urllib.parse
from models import RawLead


async def enrich_walkscore(lead: RawLead, client: httpx.AsyncClient) -> dict:
    try:
        api_key = os.getenv("WALKSCORE_API_KEY")
        if not api_key:
            return {}

        full_address = f"{lead.property_address}, {lead.city}, {lead.state}"

        # Geocode via Census Geocoder (free, no key required)
        geocode_url = (
            "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
            f"?address={urllib.parse.quote(full_address)}&benchmark=4&format=json"
        )
        geo_resp = await client.get(geocode_url, timeout=15.0)
        geo_resp.raise_for_status()
        matches = geo_resp.json().get("result", {}).get("addressMatches", [])
        if not matches:
            return {}

        coords = matches[0].get("coordinates", {})
        lat, lon = coords.get("y"), coords.get("x")
        if not lat or not lon:
            return {}

        ws_url = (
            f"https://api.walkscore.com/score?format=json"
            f"&address={urllib.parse.quote(full_address)}"
            f"&lat={lat}&lon={lon}&transit=1&bike=1&wsapikey={api_key}"
        )
        ws_resp = await client.get(ws_url, timeout=15.0)
        ws_resp.raise_for_status()
        ws = ws_resp.json()

        if ws.get("status") != 1:
            return {}

        result: dict = {
            "walk_score": ws["walkscore"],
            "walk_description": ws.get("description", ""),
            "_raw": {
                "source": "Walk Score Professional API",
                "address_queried": full_address,
                "geocoded_coordinates": {"lat": lat, "lon": lon},
                "response": ws,
            },
        }
        if "transit" in ws:
            result["transit_score"] = ws["transit"].get("score")
        if "bike" in ws:
            result["bike_score"] = ws["bike"].get("score")
        return result
    except Exception:
        return {}
