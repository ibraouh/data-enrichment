# Phase 4 — Lead Scoring

**Status:** 🔲 Not Started  
**Depends on:** Phase 3 complete (enrichment data available)

---

## Goal

Turn raw enrichment data into a single actionable number (0–100) and tier (HOT / WARM / NURTURE / NOT_QUALIFIED). The scoring is purely deterministic Python — no AI involved. Every point is explainable and traceable back to a specific data signal.

---

## Why These Signals?

EliseAI sells AI leasing assistants to **multifamily property managers**. The product is most valuable when:
- There's high leasing volume (high renter %, competitive market)
- Residents have high expectations (higher-income markets demand better digital experiences)
- The property is in an urban/suburban setting where AI automation pays off per unit
- The company is growing and has budget (positive news, healthy market)
- The rep is targeting a large enough market to justify enterprise deal economics

Each scoring component maps directly to one of these business signals.

---

## Scoring Model

Total: **100 points** across 5 components.

### Component 1: Demographics (30 pts)
*Source: Census API*

**Median Household Income (15 pts)**
| Income | Points |
|---|---|
| ≥ $90k | 15 |
| $70k–$89k | 12 |
| $55k–$69k | 8 |
| $40k–$54k | 4 |
| < $40k or unknown | 0 |

**Renter Percentage (10 pts)**
| Renter % | Points |
|---|---|
| ≥ 60% | 10 |
| 45–59% | 7 |
| 30–44% | 4 |
| < 30% or unknown | 0 |

**Total Population (5 pts)** — proxy for market size
| Population | Points |
|---|---|
| ≥ 500k | 5 |
| 100k–499k | 3 |
| 50k–99k | 1 |
| < 50k or unknown | 0 |

---

### Component 2: Market Health (25 pts)
*Source: FRED + DataUSA*

**State Unemployment Rate (12 pts)** — low unemployment = companies have budget
| Unemployment | Points |
|---|---|
| < 3.5% | 12 |
| 3.5–4.9% | 9 |
| 5.0–6.4% | 5 |
| ≥ 6.5% or unknown | 0 |

**Rental Vacancy Rate (8 pts)** — low vacancy = busy market, need for automation
| Vacancy | Points |
|---|---|
| < 4% | 8 |
| 4–5.9% | 6 |
| 6–7.9% | 3 |
| ≥ 8% or unknown | 0 |

**Average Wage / DataUSA signal (5 pts)**
| Avg Wage | Points |
|---|---|
| ≥ $65k | 5 |
| $50k–$64k | 3 |
| < $50k or unknown | 0 |

---

### Component 3: Walkability (20 pts)
*Source: WalkScore API*

**Walk Score (12 pts)** — high walkability = urban/suburban multifamily, EliseAI's core market
| Walk Score | Points |
|---|---|
| ≥ 90 (Walker's Paradise) | 12 |
| 70–89 (Very Walkable) | 10 |
| 50–69 (Somewhat Walkable) | 6 |
| 25–49 (Car-Dependent) | 2 |
| < 25 or unknown | 0 |

**Transit Score (8 pts)**
| Transit Score | Points |
|---|---|
| ≥ 70 (Excellent Transit) | 8 |
| 50–69 (Excellent Transit) | 6 |
| 25–49 (Some Transit) | 3 |
| < 25 or unknown | 0 |

---

### Component 4: Company News (15 pts)
*Source: NewsAPI*

**Sentiment (10 pts)**
| Sentiment | Points |
|---|---|
| Positive | 10 |
| Neutral / No news | 5 |
| Negative | 0 |

**Article Count (5 pts)** — more coverage = larger, more visible company
| Articles found | Points |
|---|---|
| ≥ 5 | 5 |
| 2–4 | 3 |
| 1 | 1 |
| 0 | 0 |

---

### Component 5: Geographic Market (10 pts)
*Source: lead's city/state fields — no API needed*

Bonus for major metros where multifamily is most competitive and deal sizes are largest.

**Tier 1 metros (10 pts):** New York, Los Angeles, Chicago, San Francisco, Boston, Seattle, Washington DC, Miami, San Diego

**Tier 2 metros (7 pts):** Houston, Phoenix, Atlanta, Denver, Austin, Dallas, Portland, Minneapolis, San Jose, Philadelphia

**Tier 3 metros (4 pts):** Nashville, Charlotte, Raleigh, Las Vegas, Tampa, Salt Lake City, Sacramento, Baltimore

**Other / unknown (1 pt)**

---

## Score Tiers

| Score | Tier | Badge Color | Recommended Action |
|---|---|---|---|
| 80–100 | **HOT** | Red (`text-red-400`) | Priority outreach within 24h |
| 60–79 | **WARM** | Amber (`text-amber-400`) | Outreach within 48h |
| 40–59 | **NURTURE** | Blue (`text-blue-400`) | Add to drip sequence |
| 0–39 | **NOT QUALIFIED** | Gray (`text-muted-foreground`) | Deprioritize |

---

## Backend Implementation

**`backend/scoring.py`**

```python
def score_lead(enrichment: EnrichmentData, raw: RawLead) -> ScoreBreakdown:
    demographics_score = _score_demographics(enrichment.demographics)
    market_score = _score_market(enrichment.market_data)
    walkability_score = _score_walkability(enrichment.property_insights)
    news_score = _score_news(enrichment.news)
    geo_score = _score_geography(raw.city, raw.state)
    
    total = sum([demographics_score, market_score, walkability_score, news_score, geo_score])
    tier = _classify_tier(total)
    
    return ScoreBreakdown(
        demographics_score=demographics_score,
        market_health_score=market_score,
        walkability_score=walkability_score,
        news_score=news_score,
        geographic_score=geo_score,
        total=total,
        tier=tier,
    )
```

**`backend/models.py`** — add:
```python
class ScoreBreakdown(BaseModel):
    demographics_score: int       # 0–30
    market_health_score: int      # 0–25
    walkability_score: int        # 0–20
    news_score: int               # 0–15
    geographic_score: int         # 0–10
    total: int                    # 0–100
    tier: Literal["HOT", "WARM", "NURTURE", "NOT_QUALIFIED"]
    rationale: str = ""           # filled by Claude in Phase 5
```

---

## Frontend Changes

### `src/components/ScoreBadge.tsx`
A reusable badge component that takes a `tier` and `total` and renders the colored pill.

```tsx
<ScoreBadge tier="HOT" score={87} />
// renders: red pill "HOT · 87"
```

### Score breakdown display (in `LeadDetailModal`)
A visual breakdown bar for each component:
- 5 rows, one per component
- Each shows: label, points earned / max points, mini progress bar
- Color matches component weight

---

## Acceptance Criteria

- [ ] `score_lead()` is pure — same inputs always produce the same output
- [ ] All 5 components are independently testable functions
- [ ] A lead with all-null enrichment data scores ~6 (geographic floor only, no other signals)
- [ ] The 12 sample leads produce all 4 tiers
- [ ] `ScoreBadge` renders correctly for all 4 tiers
- [ ] Score breakdown shows in the lead detail view (Phase 6)
- [ ] Scoring adds < 5ms per lead (it's pure Python arithmetic)
