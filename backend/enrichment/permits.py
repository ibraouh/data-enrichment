import httpx
from models import RawLead

# Census Building Permits Survey has no REST API (flat files only).
# Apartment density is now sourced from the Overpass API via overpass.py.


async def enrich_permits(lead: RawLead, client: httpx.AsyncClient) -> dict:
    return {}
