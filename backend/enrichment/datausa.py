import httpx
from models import RawLead

# DataUSA's public Tesseract API (datausa.io/api/data) is no longer responding.
# avg_wage is now sourced from Census ACS5 DP03_0065E (mean household income)
# in census.py. This module is a no-op stub kept for future replacement.

async def enrich_datausa(lead: RawLead, client: httpx.AsyncClient) -> dict:
    return {}
