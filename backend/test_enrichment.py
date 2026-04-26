"""
Quick smoke test — runs each enrichment module individually against one mock lead.
Usage: python test_enrichment.py
"""

import asyncio
import json
from dotenv import load_dotenv

load_dotenv()

from models import RawLead
from enrichment.census import enrich_census
from enrichment.datausa import enrich_datausa
from enrichment.walkscore import enrich_walkscore
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
            print(f"  Median household income : ${result.get('median_household_income', 'N/A'):,}")
            print(f"  Renter %                : {result.get('renter_percentage', 'N/A')}%")
            print(f"  Total population        : {result.get('total_population', 'N/A'):,}")
            print(f"  Poverty rate            : {result.get('poverty_rate', 'N/A')}%")
        else:
            print("  [no data returned]")

        # --- DataUSA ---
        print(f"\n{SEP}")
        print("2. DATAUSA")
        print(SEP)
        result = await enrich_datausa(LEAD, client)
        if result:
            print(f"  Average wage : ${result.get('avg_wage', 'N/A'):,}")
        else:
            print("  [no data returned]")

        # --- WalkScore ---
        print(f"\n{SEP}")
        print("3. WALKSCORE")
        print(SEP)
        result = await enrich_walkscore(LEAD, client)
        if result:
            print(f"  Walk score    : {result.get('walk_score')} — {result.get('walk_description')}")
            print(f"  Transit score : {result.get('transit_score')}")
            print(f"  Bike score    : {result.get('bike_score')}")
        else:
            print("  [skipped — no WALKSCORE_API_KEY set]")

        # --- FRED ---
        print(f"\n{SEP}")
        print("4. FRED")
        print(SEP)
        result = await enrich_fred(LEAD, client)
        if result:
            print(f"  State unemployment rate : {result.get('state_unemployment_rate')}%")
        else:
            print("  [no data returned]")

        # --- NewsAPI ---
        print(f"\n{SEP}")
        print("5. NEWSAPI")
        print(SEP)
        result = await enrich_news(LEAD, client)
        if result:
            print(f"  Sentiment : {result.get('news_sentiment')}")
            for a in result.get("news_articles", []):
                print(f"    • {a['title'][:80]}")
        else:
            print("  [no data returned]")

    # --- Scoring (uses merged mock data to simulate full pipeline) ---
    print(f"\n{SEP}")
    print("6. SCORING (merged mock enrichment data)")
    print(SEP)
    mock_enrichment = {
        "median_household_income": 62000,
        "renter_percentage": 55,
        "total_population": 2700000,
        "poverty_rate": 18,
        "state_unemployment_rate": 4.5,
        "walk_score": 78,
        "news_sentiment": "neutral",
        "city": LEAD.city,
        "state": LEAD.state,
    }
    breakdown = score(mock_enrichment)
    print(f"  Total score : {breakdown.total} / 100  →  {breakdown.tier}")
    print(f"  Demographics   : {breakdown.demographics_score}/30")
    print(f"  Market health  : {breakdown.market_health_score}/25")
    print(f"  Walkability    : {breakdown.walkability_score}/20")
    print(f"  News           : {breakdown.news_score}/15")
    print(f"  Geographic     : {breakdown.geographic_score}/10")

    print(f"\n{SEP}\n")


asyncio.run(run())
