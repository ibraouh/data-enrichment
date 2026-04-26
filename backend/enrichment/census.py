import httpx
from models import RawLead

STATE_FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06",
    "CO": "08", "CT": "09", "DE": "10", "FL": "12", "GA": "13",
    "HI": "15", "ID": "16", "IL": "17", "IN": "18", "IA": "19",
    "KS": "20", "KY": "21", "LA": "22", "ME": "23", "MD": "24",
    "MA": "25", "MI": "26", "MN": "27", "MS": "28", "MO": "29",
    "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34",
    "NM": "35", "NY": "36", "NC": "37", "ND": "38", "OH": "39",
    "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45",
    "SD": "46", "TN": "47", "TX": "48", "UT": "49", "VT": "50",
    "VA": "51", "WA": "53", "WV": "54", "WI": "55", "WY": "56",
    "DC": "11",
}

# ACS5 profile variables
# DP03_0062E = Median household income
# DP03_0065E = Mean household income (used as avg_wage proxy)
# DP04_0047PE = Renter-occupied housing %
# DP05_0001E = Total population
# DP03_0119PE = % of all people below poverty level
_VARS = "DP03_0062E,DP03_0065E,DP04_0047PE,DP05_0001E,DP03_0119PE"


async def enrich_census(lead: RawLead, client: httpx.AsyncClient) -> dict:
    try:
        fips = STATE_FIPS.get(lead.state.upper())
        if not fips:
            return {}

        url = (
            f"https://api.census.gov/data/2021/acs/acs5/profile"
            f"?get=NAME,{_VARS}&for=place:*&in=state:{fips}"
        )
        resp = await client.get(url, timeout=20.0)
        resp.raise_for_status()
        data = resp.json()

        if len(data) < 2:
            return {}

        headers = data[0]
        name_idx = headers.index("NAME")
        income_idx = headers.index("DP03_0062E")
        mean_income_idx = headers.index("DP03_0065E")
        renter_idx = headers.index("DP04_0047PE")
        pop_idx = headers.index("DP05_0001E")
        poverty_idx = headers.index("DP03_0119PE")

        city_lower = lead.city.lower()
        for row in data[1:]:
            if city_lower in row[name_idx].lower():
                return {
                    "median_household_income": _int(row[income_idx]),
                    "avg_wage": _int(row[mean_income_idx]),
                    "renter_percentage": _float(row[renter_idx]),
                    "total_population": _int(row[pop_idx]),
                    "poverty_rate": _float(row[poverty_idx]),
                    "_raw": {
                        "source": "U.S. Census Bureau ACS5 2021",
                        "matched_place": dict(zip(headers, row)),
                        "query": {"state_fips": fips, "city": lead.city},
                    },
                }
        return {}
    except Exception:
        return {}


def _int(val) -> int | None:
    try:
        v = int(val)
        return v if v >= 0 else None
    except (TypeError, ValueError):
        return None


def _float(val) -> float | None:
    try:
        v = float(val)
        return v if v >= 0 else None
    except (TypeError, ValueError):
        return None
