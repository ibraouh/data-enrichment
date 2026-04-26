import type { AIInsights, EnrichedLead } from "./types";

const PREFIX = "ai_insights_";

export function saveAIInsights(leads: EnrichedLead[]) {
  for (const lead of leads) {
    if (lead.ai?.score_rationale || lead.ai?.sales_insights?.length || lead.ai?.email?.subject) {
      sessionStorage.setItem(`${PREFIX}${lead.id}`, JSON.stringify(lead.ai));
    }
  }
}

export function loadAIInsights(leadId: string): AIInsights | null {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${leadId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function mergeAIInsights(leads: EnrichedLead[]): EnrichedLead[] {
  return leads.map((lead) => {
    const cached = loadAIInsights(lead.id);
    return cached ? { ...lead, ai: cached } : lead;
  });
}
