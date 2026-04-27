import os
import httpx
import urllib.parse
from models import RawLead


async def enrich_walkscore(lead: RawLead, client: httpx.AsyncClient) -> dict:
    return {}
