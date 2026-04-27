from models import ScoreBreakdown

_MAJOR_METROS = {
    "new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia",
    "san antonio", "san diego", "dallas", "san jose", "austin", "jacksonville",
    "fort worth", "columbus", "charlotte", "san francisco", "indianapolis",
    "seattle", "denver", "washington", "nashville", "oklahoma city", "el paso",
    "boston", "portland", "las vegas", "memphis", "louisville", "baltimore",
    "milwaukee", "albuquerque", "tucson", "fresno", "mesa", "sacramento",
    "atlanta", "kansas city", "omaha", "colorado springs", "raleigh", "miami",
    "minneapolis", "tampa", "new orleans", "cleveland", "honolulu",
    "anaheim", "corpus christi", "riverside", "brooklyn", "queens",
}


def score(enrichment: dict) -> ScoreBreakdown:
    demo = _demographics(enrichment)
    market = _market_health(enrichment)
    walk = _walkability(enrichment)
    news = _news(enrichment)
    geo = _geographic(enrichment)

    total = max(0, min(100, demo + market + walk + news + geo))

    if total >= 80:
        tier = "HOT"
    elif total >= 60:
        tier = "WARM"
    elif total >= 40:
        tier = "NURTURE"
    else:
        tier = "NOT_QUALIFIED"

    return ScoreBreakdown(
        demographics_score=demo,
        market_health_score=market,
        walkability_score=walk,
        news_score=news,
        geographic_score=geo,
        total=total,
        tier=tier,
    )


def _demographics(e: dict) -> int:
    pts = 0

    income = e.get("median_household_income")
    if income is not None:
        if income >= 80_000:
            pts += 14
        elif income >= 60_000:
            pts += 11
        elif income >= 45_000:
            pts += 7
        else:
            pts += 2
    else:
        pts += 6  # neutral when no data

    renter = e.get("renter_percentage")
    if renter is not None:
        if renter >= 60:
            pts += 14
        elif renter >= 45:
            pts += 11
        elif renter >= 30:
            pts += 6
        else:
            pts += 1
    else:
        pts += 5

    pop = e.get("total_population")
    if pop is not None:
        if pop >= 500_000:
            pts += 7
        elif pop >= 100_000:
            pts += 5
        elif pop >= 50_000:
            pts += 3
        else:
            pts += 1
    else:
        pts += 2

    return min(pts, 35)


def _market_health(e: dict) -> int:
    pts = 0

    # Unemployment (0–10 pts): low = strong job market
    unemp = e.get("state_unemployment_rate")
    if unemp is not None:
        if unemp < 3.5:
            pts += 10
        elif unemp < 5.0:
            pts += 8
        elif unemp < 7.0:
            pts += 5
        else:
            pts += 2
    else:
        pts += 5

    # Rental vacancy rate (0–5 pts): low vacancy = high rental demand
    vacancy = e.get("rental_vacancy_rate")
    if vacancy is not None:
        if vacancy < 4.0:
            pts += 5
        elif vacancy < 6.0:
            pts += 4
        elif vacancy < 8.0:
            pts += 2
        else:
            pts += 0
    else:
        pts += 2

    # Poverty rate (0–5 pts)
    poverty = e.get("poverty_rate")
    if poverty is not None:
        if poverty < 10:
            pts += 5
        elif poverty < 15:
            pts += 3
        elif poverty < 20:
            pts += 2
        else:
            pts += 0
    else:
        pts += 2

    # HUD Fair Market Rent — 2BR (0–10 pts): high FMR = competitive rental market
    fmr_2br = e.get("fmr_2br")
    if fmr_2br is not None:
        if fmr_2br >= 2000:
            pts += 10
        elif fmr_2br >= 1500:
            pts += 7
        elif fmr_2br >= 1000:
            pts += 4
        else:
            pts += 0
    else:
        pts += 0

    # Nearby multifamily buildings via Overpass (0–5 pts): high count = dense rental market
    multifamily = e.get("nearby_multifamily_count")
    if multifamily is not None:
        if multifamily >= 300:
            pts += 5
        elif multifamily >= 150:
            pts += 4
        elif multifamily >= 50:
            pts += 3
        elif multifamily >= 10:
            pts += 1
        else:
            pts += 0
    else:
        pts += 0

    return min(pts, 35)


def _walkability(_e: dict) -> int:
    return 0  # disabled — WalkScore requires a paid API key


def _news(e: dict) -> int:
    sentiment = e.get("news_sentiment")
    if sentiment == "positive":
        return 20
    if sentiment == "negative":
        return 3
    return 10  # neutral or no data


def _geographic(e: dict) -> int:
    city = e.get("city", "").lower().strip()
    return 10 if city in _MAJOR_METROS else 0
