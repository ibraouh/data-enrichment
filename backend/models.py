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


class ParseLeadsResponse(BaseModel):
    project_id: str
    leads: list[StoredLead]
    total: int
    errors: list[str]


# ---------------------------------------------------------------------------
# Enrichment models
# ---------------------------------------------------------------------------
# TODO: Demographics, PropertyInsights, MarketData, NewsItem


# ---------------------------------------------------------------------------
# Output models
# ---------------------------------------------------------------------------
# TODO: ScoreBreakdown, OutreachEmail, EnrichedLead
