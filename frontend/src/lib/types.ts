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
// Phase 3+ — Enrichment, Scoring, AI (stubs)
// ---------------------------------------------------------------------------
// TODO: Demographics, PropertyInsights, MarketData, NewsItem,
//       ScoreBreakdown, AIInsights, EnrichedLead
