// Keep in sync with backend/models.py

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  name: string;
  source: "file" | "csv" | "single";
  status: "pending" | "enriching" | "complete" | "failed";
  total_leads: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Phase 2 — Lead Ingestion
// ---------------------------------------------------------------------------

export interface RawLead {
  name: string;
  email: string;
  company: string;
  property_address: string;
  city: string;
  state: string;
  country: string;
}

export interface StoredLead extends RawLead {
  id: string;
  project_id: string;
}

export interface ParseLeadsResponse {
  project_id: string;
  leads: StoredLead[];
  total: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Phase 3 — Enrichment & Scoring
// ---------------------------------------------------------------------------

export interface EnrichmentData {
  median_household_income: number | null;
  total_population: number | null;
  renter_percentage: number | null;
  poverty_rate: number | null;
  avg_wage: number | null;
  walk_score: number | null;
  transit_score: number | null;
  bike_score: number | null;
  walk_description: string | null;
  state_unemployment_rate: number | null;
  rental_vacancy_rate: number | null;
  housing_price_index: number | null;
  news_sentiment: "positive" | "neutral" | "negative" | null;
  news_articles: { title: string; url: string; publishedAt: string }[];
  enrichment_errors: string[];
}

export interface ScoreBreakdown {
  demographics_score: number;
  market_health_score: number;
  walkability_score: number;
  news_score: number;
  geographic_score: number;
  total: number;
  tier: "HOT" | "WARM" | "NURTURE" | "NOT_QUALIFIED";
}

// ---------------------------------------------------------------------------
// Phase 5 — AI Layer
// ---------------------------------------------------------------------------

export interface OutreachEmail {
  subject: string;
  body: string;
}

export interface AIInsights {
  email: OutreachEmail;
  score_rationale: string;
  sales_insights: string[];
}

export interface EnrichedLead extends StoredLead {
  enrichment: EnrichmentData;
  score: ScoreBreakdown;
  ai: AIInsights;
}

export interface EnrichLeadsResponse {
  project_id: string;
  leads: EnrichedLead[];
  total: number;
  enrichment_errors: string[];
}

export interface RawEnrichmentData {
  id: string;
  lead_id: string;
  census: Record<string, unknown> | null;
  fred: Record<string, unknown> | null;
  walkscore: Record<string, unknown> | null;
  news: Record<string, unknown> | null;
  enriched_at: string;
}
