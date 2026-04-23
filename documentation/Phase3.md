# Phase 3 — Enrichment Engine

**Status:** 🔲 Not Started  
**Depends on:** Phase 2 complete (parsed leads available)

---

## Goal

Build the core enrichment pipeline. For each lead, call 5 public APIs in parallel and merge the results into a rich data object. The pipeline must be fault-tolerant — if one API is down or rate-limited, the others continue and partial data is returned.

---

## Enrichment Pipeline Architecture

```
POST /api/enrich-leads
    receives: list[RawLead]
    
    for each lead (concurrent, max 3 at a time):
        asyncio.gather(
            enrich_census(lead, client),
            enrich_datausa(lead, client),
            enrich_walkscore(lead, client),
            enrich_fred(lead, client),
            enrich_news(lead, client),
        )
        → merge results → EnrichedData
    
    returns: list[PartiallyEnrichedLead]
    (scoring + Claude AI happen in Phase 4 & 5)
```

Concurrency is bounded with `asyncio.Semaphore(3)` to avoid hammering free-tier APIs.

---

## API Modules

### `backend/enrichment/census.py`
**API**: U.S. Census Bureau ACS 5-Year Estimates  
**Auth**: Free, no key required (optional key for higher rate limits)  
**Base URL**: `https://api.census.gov/data/2022/acs/acs5`

**Steps:**
1. Use Census geocoding API to convert city+state → FIPS state + place codes
   `GET https://geocoding.geo.census.gov/geocoder/locations/address?city={city}&state={state}&benchmark=Public_AR_Current&format=json`
2. Query ACS5 for the place:
   `GET /data/2022/acs/acs5?get=B19013_001E,B01003_001E,B25003_001E,B25003_003E&for=place:{place_fips}&in=state:{state_fips}`

**Variables:**
- `B19013_001E` → Median household income
- `B01003_001E` → Total population
- `B25003_001E` → Total housing units
- `B25003_003E` → Renter-occupied units (renter % = B25003_003E / B25003_001E)

**Returns:**
```python
{
    "median_household_income": 74500,
    "total_population": 1584000,
    "renter_percentage": 68.2,
    "data_year": 2022
}
```

**Fallback**: If place lookup fails, fall back to state-level data. Return `{}` on complete failure.

---

### `backend/enrichment/datausa.py`
**API**: DataUSA  
**Auth**: Free, no key required  
**Base URL**: `https://datausa.io/api/data`

**Query**: Metro/MSA level economic data by city name
`GET https://datausa.io/api/data?drilldowns=Place&measures=Total%20Population,Median%20Household%20Income,Poverty%20Rate&Place={city_name}`

**Returns:**
```python
{
    "avg_wage": 68400,
    "poverty_rate": 12.3,
    "population_growth_pct": 4.2,   # YoY
    "data_year": 2022
}
```

**Fallback**: Return `{}` on failure. DataUSA data is supplementary.

---

### `backend/enrichment/walkscore.py`
**API**: WalkScore  
**Auth**: Free API key (`WALKSCORE_API_KEY`)  
**Docs**: walkscore.com/professional/api.php

**Query**: Requires full address + lat/lng (use Census geocoding lat/lng from above)
`GET https://api.walkscore.com/score?format=json&address={full_address}&lat={lat}&lon={lon}&wsapikey={key}`

**Returns:**
```python
{
    "walk_score": 87,
    "transit_score": 72,
    "bike_score": 65,
    "description": "Walker's Paradise"
}
```

**Fallback**: Return `{}` if key not set or request fails. Score treated as 0 in scoring.

---

### `backend/enrichment/fred.py`
**API**: Federal Reserve Economic Data (FRED)  
**Auth**: Free API key (`FRED_API_KEY`)  
**Base URL**: `https://api.stlouisfed.org/fred/series/observations`

**Two queries per lead:**

1. State unemployment rate — series ID pattern: `{STATE_ABBR}UR`
   e.g., `CAUR` for California, `NYUR` for New York
   `GET /fred/series/observations?series_id=CAUR&sort_order=desc&limit=1&api_key={key}&file_type=json`

2. National rental vacancy rate (same for all leads): `RRVRUSQ156N`

**Returns:**
```python
{
    "state_unemployment_rate": 4.2,
    "rental_vacancy_rate": 6.1,
    "data_date": "2024-01-01"
}
```

**Fallback**: Return `{}` if key not set or request fails.

---

### `backend/enrichment/news.py`
**API**: NewsAPI  
**Auth**: Free tier API key (`NEWS_API_KEY`) — 100 req/day on free plan  
**Base URL**: `https://newsapi.org/v2/everything`

**Query**: Search for recent company news
`GET /v2/everything?q="{company_name}"&language=en&sortBy=relevancy&pageSize=5&apiKey={key}`

**Simple sentiment**: Count positive vs negative keywords in headlines.
- Positive: "growth", "expansion", "acquisition", "award", "record", "launch", "partnership"
- Negative: "lawsuit", "layoff", "bankruptcy", "fraud", "investigation", "decline", "closure"

**Returns:**
```python
{
    "articles": [
        {
            "title": "Greystar Acquires 3,000 Units in Southeast Portfolio",
            "source": "Multifamily Executive",
            "published_at": "2024-11-15",
            "url": "https://...",
            "sentiment": "positive"
        }
    ],
    "sentiment_summary": "positive",   # "positive" | "neutral" | "negative"
    "article_count": 3
}
```

**Fallback**: Return `{"articles": [], "sentiment_summary": "neutral", "article_count": 0}` if key not set or no results.

---

## Data Models

**`backend/models.py`** — add:

```python
class Demographics(BaseModel):
    median_household_income: int | None = None
    total_population: int | None = None
    renter_percentage: float | None = None

class PropertyInsights(BaseModel):
    walk_score: int | None = None
    transit_score: int | None = None
    bike_score: int | None = None
    walk_description: str | None = None

class MarketData(BaseModel):
    avg_wage: int | None = None
    poverty_rate: float | None = None
    state_unemployment_rate: float | None = None
    rental_vacancy_rate: float | None = None

class NewsArticle(BaseModel):
    title: str
    source: str
    published_at: str
    url: str
    sentiment: Literal["positive", "neutral", "negative"]

class NewsData(BaseModel):
    articles: list[NewsArticle] = []
    sentiment_summary: Literal["positive", "neutral", "negative"] = "neutral"
    article_count: int = 0

class EnrichmentData(BaseModel):
    demographics: Demographics = Demographics()
    property_insights: PropertyInsights = PropertyInsights()
    market_data: MarketData = MarketData()
    news: NewsData = NewsData()
    enriched_at: str   # ISO timestamp

class PartiallyEnrichedLead(BaseModel):
    id: str            # uuid4
    raw: RawLead
    enrichment: EnrichmentData
    enrichment_errors: list[str] = []   # which APIs failed
```

**New endpoint**: `POST /api/enrich-leads`
```python
class EnrichRequest(BaseModel):
    leads: list[RawLead]

class EnrichResponse(BaseModel):
    leads: list[PartiallyEnrichedLead]
    total: int
    processing_time_ms: int
```

---

## Frontend Changes

### Processing state in `page.tsx`
When the user clicks "Enrich Leads →" (from Phase 2 preview table):
- Transition to `step = "enriching"`
- Show a progress UI: spinner + "Enriching {n} leads across 5 APIs…"
- On response, transition to `step = "results"` (Phase 6 handles display)

### `src/lib/types.ts` — add enrichment types mirroring `models.py`

### `src/lib/api.ts` — add:
```typescript
enrichLeads(leads: RawLead[]): Promise<EnrichResponse>
```

---

## Acceptance Criteria

- [ ] `POST /api/enrich-leads` with 1 lead returns enrichment data within 10s
- [ ] If `WALKSCORE_API_KEY` is missing, Census + DataUSA + FRED + News still run
- [ ] If NewsAPI returns no results, `articles: []` and `sentiment_summary: "neutral"` returned
- [ ] Processing 12 leads completes in under 30s (concurrent per-lead, bounded at 3)
- [ ] `enrichment_errors` list names which APIs failed per lead
- [ ] All enrichment values are `null` (not missing keys) when not available
- [ ] Frontend shows "Enriching…" state during the request
