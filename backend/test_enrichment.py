"""
Quick smoke test — runs each enrichment module individually against one mock lead.
Usage: cd backend && python test_enrichment.py
"""

import asyncio
import json
from dotenv import load_dotenv

load_dotenv()

from models import RawLead
from enrichment.census import enrich_census
from enrichment.nominatim import enrich_nominatim
from enrichment.overpass import enrich_overpass
from enrichment.hud_fmr import enrich_hud_fmr
from enrichment.fred import enrich_fred
from enrichment.news import enrich_news
from scoring import score

LEAD = RawLead(
    name="Marcus Williams",
    email="m.williams@equityresidential.com",
    company="Equity Residential",
    property_address="400 N Michigan Ave",
    city="Chicago",
    state="IL",
    country="USA",
)

SEP = "-" * 60


async def run():
    import httpx
    async with httpx.AsyncClient() as client:

        print(f"\n{SEP}")
        print("TEST LEAD")
        print(SEP)
        print(f"  {LEAD.name} | {LEAD.company}")
        print(f"  {LEAD.property_address}, {LEAD.city}, {LEAD.state}")

        # --- Census ---
        print(f"\n{SEP}")
        print("1. CENSUS ACS5")
        print(SEP)
        result = await enrich_census(LEAD, client)
        if result:
            print(f"  Median household income : ${result.get('median_household_income') or 'N/A'}")
            print(f"  Mean household income   : ${result.get('avg_wage') or 'N/A'}")
            print(f"  Renter %                : {result.get('renter_percentage') or 'N/A'}%")
            print(f"  Total population        : {result.get('total_population') or 'N/A'}")
            print(f"  Poverty rate            : {result.get('poverty_rate') or 'N/A'}%")
        else:
            print("  [no data returned]")

        # --- Nominatim ---
        print(f"\n{SEP}")
        print("2. NOMINATIM (OpenStreetMap)")
        print(SEP)
        result = await enrich_nominatim(LEAD, client)
        if result:
            print(f"  Latitude  : {result.get('latitude')}")
            print(f"  Longitude : {result.get('longitude')}")
            raw = result.get("_raw", {}).get("result", {})
            print(f"  Display   : {raw.get('display_name', '')[:80]}")
        else:
            print("  [no data returned]")
            print("  RAW response:")
            # Run directly to see error
            try:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": f"{LEAD.property_address}, {LEAD.city}, {LEAD.state}", "format": "json", "limit": 1},
                    headers={"User-Agent": "EliseAI-LeadEnrichment/1.0"},
                    timeout=10.0,
                )
                print(f"  HTTP {resp.status_code}: {resp.text[:200]}")
            except Exception as ex:
                print(f"  Exception: {ex}")

        # --- HUD FMR ---
        print(f"\n{SEP}")
        print("3. HUD FAIR MARKET RENTS")
        print(SEP)
        result = await enrich_hud_fmr(LEAD, "Cook County", client)
        if result:
            raw = result.get("_raw", {})
            print(f"  Studio : ${result.get('fmr_studio')}/mo")
            print(f"  1BR    : ${result.get('fmr_1br')}/mo")
            print(f"  2BR    : ${result.get('fmr_2br')}/mo")
            print(f"  Metro  : {raw.get('metro_name')}  (FY{raw.get('year')})")
        else:
            import os
            if not os.getenv("HUD_API_KEY"):
                print("  [skipped — HUD_API_KEY not set in .env]")
            else:
                print("  [no data returned]")

        # --- Overpass ---
        print(f"\n{SEP}")
        print("4. OVERPASS (Multifamily Density)")
        print(SEP)
        nom_lat = 41.8895686  # from prior Nominatim call above
        nom_lon = -87.6247284
        result = await enrich_overpass(nom_lat, nom_lon, client)
        if result:
            count = result.get("nearby_multifamily_count")
            counts = result.get("_raw", {}).get("counts", {})
            print(f"  Nearby multifamily buildings : {count}")
            print(f"    Ways: {counts.get('ways')}  Relations: {counts.get('relations')}")
        else:
            print("  [no data returned]")

        # --- FRED ---
        print(f"\n{SEP}")
        print("5. FRED")
        print(SEP)
        result = await enrich_fred(LEAD, client)
        if result:
            print(f"  State unemployment rate : {result.get('state_unemployment_rate')}%")
            print(f"  Rental vacancy rate     : {result.get('rental_vacancy_rate')}%")
            print(f"  House price index       : {result.get('housing_price_index')}")
        else:
            import os
            if not os.getenv("FRED_API_KEY"):
                print("  [skipped — FRED_API_KEY not set in .env]")
            else:
                print("  [no data returned]")

        # --- NewsAPI ---
        print(f"\n{SEP}")
        print("6. NEWSAPI")
        print(SEP)
        result = await enrich_news(LEAD, client)
        if result:
            print(f"  Sentiment : {result.get('news_sentiment')}")
            for a in result.get("news_articles", []):
                print(f"    • {a['title'][:80]}")
        else:
            import os
            if not os.getenv("NEWS_API_KEY"):
                print("  [skipped — NEWS_API_KEY not set in .env]")
            else:
                print("  [no data returned]")

    # --- Scoring ---
    print(f"\n{SEP}")
    print("7. SCORING (merged mock enrichment data)")
    print(SEP)
    mock_enrichment = {
        "median_household_income": 62000,
        "renter_percentage": 55,
        "total_population": 2700000,
        "poverty_rate": 18,
        "state_unemployment_rate": 4.5,
        "fmr_2br": 1800,
        "nearby_multifamily_count": 330,
        "news_sentiment": "neutral",
        "city": LEAD.city,
        "state": LEAD.state,
    }
    breakdown = score(mock_enrichment)
    print(f"  Total score    : {breakdown.total} / 100  →  {breakdown.tier}")
    print(f"  Demographics   : {breakdown.demographics_score}/35")
    print(f"  Market health  : {breakdown.market_health_score}/35")
    print(f"  Walkability    : {breakdown.walkability_score}/0  (disabled)")
    print(f"  News           : {breakdown.news_score}/20")
    print(f"  Geographic     : {breakdown.geographic_score}/10")

    print(f"\n{SEP}\n")


asyncio.run(run())
