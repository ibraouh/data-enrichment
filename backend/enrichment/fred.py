import os
import httpx
from models import RawLead

_BASE = "https://api.stlouisfed.org/fred/series/observations"


async def enrich_fred(lead: RawLead, client: httpx.AsyncClient) -> dict:
    try:
        api_key = os.getenv("FRED_API_KEY")
        if not api_key:
            return {}

        state = lead.state.upper()
        result: dict = {}
        raw: dict = {"source": "Federal Reserve Bank of St. Louis (FRED)", "series": {}}

        series_to_fetch = [
            (f"{state}UR",    "Unemployment Rate"),
            (f"{state}RVAC",  "Rental Vacancy Rate"),
            (f"{state}STHPI", "All-Transactions House Price Index"),
        ]

        for series_id, title in series_to_fetch:
            try:
                r = await client.get(
                    f"{_BASE}?series_id={series_id}&api_key={api_key}"
                    f"&sort_order=desc&limit=1&file_type=json",
                    timeout=10.0,
                )
                if r.status_code != 200:
                    continue
                resp_json = r.json()
                obs = resp_json.get("observations", [])
                raw["series"][series_id] = {
                    "title": title,
                    "units": resp_json.get("units", ""),
                    "frequency": resp_json.get("frequency", ""),
                    "latest_observation": obs[0] if obs else None,
                }
                if obs and obs[0].get("value") not in (".", None):
                    value = float(obs[0]["value"])
                    if series_id.endswith("UR"):
                        result["state_unemployment_rate"] = value
                    elif series_id.endswith("RVAC"):
                        result["rental_vacancy_rate"] = value
                    elif series_id.endswith("STHPI"):
                        result["housing_price_index"] = value
            except Exception:
                continue

        if raw["series"]:
            result["_raw"] = raw
        return result
    except Exception:
        return {}
