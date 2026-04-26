# Phase 5 — Claude AI Layer

**Status:** ✅ Complete  
**Depends on:** Phase 3 (enrichment data) + Phase 4 (score + tier)

---

## Goal

Use the Anthropic Claude API to generate three pieces of prose per lead: a personalized outreach email, a scoring rationale, and a bullet-point list of sales insights. All three use the enriched data as context so the output is specific and actionable — not generic templates.

---

## What Claude Generates

### 1. Outreach Email
A ready-to-copy cold outreach email from an EliseAI SDR to the lead contact.

**Inputs fed to Claude:**
- Lead name, title (if known), company
- City, state, property address
- Demographics: median income, renter %, population
- WalkScore + transit score
- Recent company news (top 2 headlines + sentiment)
- Lead score + tier

**Output:**
```json
{
  "subject": "Helping [Company] automate leasing at [Property Address]",
  "body": "Hi [Name],\n\nI came across [Company] and noticed..."
}
```

**Guidelines baked into the prompt:**
- 3–4 short paragraphs, under 200 words total
- Reference at least one specific data point (city stat, recent news, or WalkScore)
- End with a soft CTA: 15-minute call, not "buy now"
- Tone: professional, peer-to-peer, not salesy
- Signed as "the EliseAI team" generically (rep fills in their name)

---

### 2. Score Rationale
1–2 sentences explaining WHY this lead scored HOT/WARM/etc. in plain English. Shown in the lead detail card next to the score badge.

**Example output:**
> "Philadelphia scores well due to a 62% renter rate and $74k median income, signaling a competitive multifamily market where leasing automation delivers strong ROI. Recent news of a portfolio acquisition suggests [Company] is in growth mode and actively investing."

---

### 3. Sales Insights
3–5 bullet points a rep should know before making the call. Mix of data signals and strategic framing.

**Example output:**
- "Market has 68% renter occupancy — well above the national average, indicating high leasing velocity"
- "Walk Score of 87 suggests urban multifamily in a high-demand neighborhood"
- "Recent headline: 'Greystar Acquires 3,000 Units' — company is actively growing portfolio"
- "State unemployment at 3.8% — healthy job market supports resident income stability"
- "Tier 1 metro: large deal potential, likely running legacy property management software"

---

## Backend Implementation

**`backend/outreach.py`**

```python
import anthropic
from .models import PartiallyEnrichedLead, ScoreBreakdown, OutreachEmail

client = anthropic.Anthropic()

async def generate_outreach(lead: PartiallyEnrichedLead, score: ScoreBreakdown) -> dict:
    context = _build_context(lead, score)
    
    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": _build_prompt(context)}]
    )
    
    return _parse_response(message.content[0].text)
```

**Prompt structure:**
```
You are helping an EliseAI SDR prepare for outreach to a property management lead.

EliseAI sells AI-powered leasing assistants (chat + voice) to multifamily apartment managers.

Lead context:
- Contact: {name} at {company}
- Property: {address}, {city}, {state}
- Lead score: {total}/100 ({tier})
- Demographics: {median_income} median income, {renter_pct}% renter rate, pop {population}
- Walkability: Walk Score {walk_score} ({description})
- Market: {unemployment}% unemployment, {vacancy}% rental vacancy
- Recent news: {news_summary}

Generate a JSON response with exactly these keys:
{
  "email_subject": "...",
  "email_body": "...",
  "score_rationale": "...",
  "sales_insights": ["...", "...", "..."]
}

Email guidelines: 3–4 paragraphs, under 200 words, reference specific data, end with soft CTA for a 15-min call, professional peer-to-peer tone.
```

**`backend/models.py`** — add:
```python
class OutreachEmail(BaseModel):
    subject: str
    body: str

class AIInsights(BaseModel):
    email: OutreachEmail
    score_rationale: str
    sales_insights: list[str]

class EnrichedLead(BaseModel):
    id: str
    raw: RawLead
    enrichment: EnrichmentData
    score: ScoreBreakdown
    ai: AIInsights
    processed_at: str
```

**Final endpoint**: `POST /api/process-leads`

This combines Phase 3 (enrich) + Phase 4 (score) + Phase 5 (Claude) into a single endpoint for the frontend to call. Internally it runs them in sequence per lead (enrich → score → Claude), with leads processed concurrently.

```python
class ProcessResponse(BaseModel):
    leads: list[EnrichedLead]
    total: int
    processing_time_ms: int
```

---

## Rate Limiting & Cost

- Claude is called once per lead (one API call = email + rationale + insights in a single response)
- `claude-sonnet-4-5` at ~$3/MTok input + $15/MTok output
- Estimated ~400 input tokens + ~300 output tokens per lead = ~$0.006/lead
- 12 leads ≈ $0.07 per full run — negligible for a demo

**`ANTHROPIC_API_KEY`** must be set in `.env`. If missing, `ai` fields return empty strings / empty list and enrichment still works.

---

## Frontend Changes

No new components needed in this phase — the AI output fields are displayed in the `LeadDetailModal` built in Phase 6.

`src/lib/types.ts` — add `EnrichedLead`, `AIInsights`, `OutreachEmail` interfaces.
`src/lib/api.ts` — replace `enrichLeads` with `processLeads(leads: RawLead[]): Promise<ProcessResponse>`.

---

## Acceptance Criteria

- [ ] Single Claude API call per lead returns all three outputs (email, rationale, insights)
- [ ] Email is personalized — references the lead's specific city, company, or news
- [ ] If `ANTHROPIC_API_KEY` is not set, endpoint still returns enrichment + score with empty AI fields
- [ ] Response is valid JSON (Claude instructed to return structured JSON, parse with fallback)
- [ ] Processing 12 leads completes in under 60s end-to-end
- [ ] Claude errors per-lead are caught — one failed generation doesn't fail the whole batch
