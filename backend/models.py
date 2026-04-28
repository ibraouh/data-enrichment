from typing import Optional
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Input models
# ---------------------------------------------------------------------------

class RawLead(BaseModel):
    name: str
    email: str
    company: str
    property_address: str
    city: str
    state: str
    country: str = "USA"


class StoredLead(RawLead):
    """RawLead after being written to the database — includes its DB id."""
    id: str
    project_id: str
    imported_at: Optional[str] = None


class ParseLeadsResponse(BaseModel):
    project_id: str
    leads: list[StoredLead]
    total: int
    errors: list[str]


# ---------------------------------------------------------------------------
# Enrichment models
# ---------------------------------------------------------------------------

class EnrichmentData(BaseModel):
    # Census ACS5
    median_household_income: Optional[int] = None
    total_population: Optional[int] = None
    renter_percentage: Optional[float] = None
    poverty_rate: Optional[float] = None
    avg_wage: Optional[int] = None
    # Nominatim
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    osm_suburb: Optional[str] = None      # borough/suburb e.g. "Manhattan"
    osm_quarter: Optional[str] = None     # neighborhood e.g. "Upper West Side"
    osm_postcode: Optional[str] = None    # ZIP code
    osm_county: Optional[str] = None      # county e.g. "New York County"
    # HUD Fair Market Rents
    fmr_studio: Optional[int] = None
    fmr_1br: Optional[int] = None
    fmr_2br: Optional[int] = None
    # Overpass — nearby multifamily building count
    nearby_multifamily_count: Optional[int] = None
    # FRED
    state_unemployment_rate: Optional[float] = None
    rental_vacancy_rate: Optional[float] = None
    housing_price_index: Optional[float] = None
    # NewsAPI
    news_sentiment: Optional[str] = None
    news_articles: list[dict] = []
    enrichment_errors: list[str] = []


# ---------------------------------------------------------------------------
# Output models
# ---------------------------------------------------------------------------

class ScoreBreakdown(BaseModel):
    demographics_score: int
    market_health_score: int
    walkability_score: int
    news_score: int
    geographic_score: int
    total: int
    tier: str  # HOT | WARM | NURTURE | NOT_QUALIFIED


class OutreachEmail(BaseModel):
    subject: str = ""
    body: str = ""


class AIInsights(BaseModel):
    email: OutreachEmail = OutreachEmail()
    score_rationale: str = ""
    sales_insights: list[str] = []


class EnrichedLead(StoredLead):
    enrichment: EnrichmentData
    score: ScoreBreakdown
    ai: AIInsights = AIInsights()


class EnrichLeadsResponse(BaseModel):
    project_id: str
    leads: list[EnrichedLead]
    total: int
    enrichment_errors: list[str]


class EnrichRequest(BaseModel):
    leads: Optional[list[StoredLead]] = None


class GenerateOutreachRequest(BaseModel):
    lead: StoredLead
    enrichment: EnrichmentData
    score: ScoreBreakdown


class LinkSheetRequest(BaseModel):
    sheet_url: str


class SheetSyncResponse(BaseModel):
    project_id: str
    new_leads: list[StoredLead]
    new_count: int
    total_rows: int
