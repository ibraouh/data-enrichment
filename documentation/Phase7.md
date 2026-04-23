# Phase 7 — Polish & Demo

**Status:** 🔲 Not Started  
**Depends on:** Phases 1–6 complete (fully functional app)

---

## Goal

Make the app demo-ready. This phase is about the experience — sample data that tells a compelling story, loading states that feel intentional, error handling that never shows a raw error to a user, and a flow smooth enough for a 10-minute live demo.

---

## Sample Data

**`sample_leads.csv`** (12 leads, intentionally spread across all 4 tiers)

| # | Name | Company | City | State | Expected Tier |
|---|---|---|---|---|---|
| 1 | Sarah Chen | Greystar Real Estate | San Francisco | CA | HOT |
| 2 | Marcus Williams | Equity Residential | Chicago | IL | HOT |
| 3 | Jennifer Lopez | AvalonBay Communities | New York | NY | HOT |
| 4 | David Kim | UDR Inc | Seattle | WA | WARM |
| 5 | Amanda Foster | Camden Property Trust | Denver | CO | WARM |
| 6 | Lisa Nguyen | Cortland Partners | Atlanta | GA | WARM |
| 7 | James Baker | Veris Residential | Nashville | TN | WARM |
| 8 | Patricia Kim | Pacific Urban Residential | Sacramento | CA | NURTURE |
| 9 | Michael Torres | Alliance Residential | Albuquerque | NM | NURTURE |
| 10 | Rachel Green | Midwest Property Group | Omaha | NE | NOT_QUALIFIED |
| 11 | Tom Harrison | Heartland Realty LLC | Wichita | KS | NOT_QUALIFIED |
| 12 | Angela Davis | Heritage Property Mgmt | Rural Topeka | KS | NOT_QUALIFIED |

The spread ensures the demo shows the full scoring range, not just a pile of HOT leads.

---

## Loading & Processing UX

### Enrichment progress animation
Replace the generic spinner with a step-by-step progress display:

```
Enriching 12 leads...

[████████░░░░░░░░] 5 / 12 complete

✓ Census demographics
✓ DataUSA economic data
⟳ WalkScore (5 remaining)
⟳ FRED market data (5 remaining)
⟳ Company news
⟳ Claude AI generation
```

Implementation: use SSE (Server-Sent Events) from the backend to stream progress, or just simulate it client-side with a timed step animation (simpler, fine for demo).

### Skeleton loading
While the results table loads, show skeleton rows (gray animated placeholders) instead of a blank screen.

### Transition animations
- Upload → Preview: fade in lead count + table
- Preview → Enriching: smooth slide to progress screen
- Enriching → Results: fade in table with a staggered row reveal (50ms delay per row)
- Modal open/close: slide-in from right, backdrop fade

---

## Error Handling

### API key missing
If any API key is absent, show a dismissible banner at the top of the results page:
> ⚠ WalkScore data unavailable — add `WALKSCORE_API_KEY` to `.env` to enable walkability scores.

Never show "null", "undefined", or raw Python tracebacks to the user.

### Network error (backend unreachable)
Friendly message with a retry button:
> "Could not reach the enrichment server. Make sure the backend is running (`make dev`) and try again."

### Parse errors (bad CSV columns)
Show a collapsible error panel above the preview table:
> "3 rows were skipped: rows 4, 7, 12 are missing required fields (email, city)."

### Claude failure
If Claude fails for a specific lead, show in the detail modal:
> "Outreach email unavailable for this lead. Claude API error — check your `ANTHROPIC_API_KEY`."
The rest of the enrichment data and score still display normally.

### Zero results
If a valid file is uploaded but no leads pass validation, show an empty state with the expected CSV format.

---

## Performance Targets

| Operation | Target | Notes |
|---|---|---|
| File parse | < 500ms | For ≤ 100 leads |
| Enrichment (12 leads) | < 30s | Parallel, bounded at 3 |
| Claude generation (12 leads) | < 60s total | 1 API call per lead |
| Table render | < 100ms | Client-side, no pagination needed at this scale |
| Export (CSV/JSON) | < 50ms | Client-side generation |

---

## Demo Script (10 min)

**1. Intro (1 min)**
> "EliseAI's SDRs spend hours manually researching inbound leads. This tool does it in seconds."
- Show the landing page, explain the 3 input methods

**2. Upload sample data (1 min)**
- Upload `sample_leads.csv`
- Show preview table: 12 leads, clean columns, validation working

**3. Trigger enrichment (2 min)**
- Click "Enrich Leads"
- Walk through what's happening during the loading state (Census, WalkScore, FRED, NewsAPI, Claude)
- Results appear

**4. Results table (2 min)**
- Show score sorting: HOT leads at top
- Filter to HOT only — 3 leads
- Point out walkability, income, news sentiment columns at a glance

**5. Lead detail — HOT lead (2 min)**
- Open Sarah Chen (Greystar, SF)
- Show score breakdown: why 87? Demographics 28/30, walkability 19/20
- Enrichment tab: $98k median income, 72% renters, Walk Score 91
- Tab 3: outreach email — show it references SF rental market and a specific Greystar news headline

**6. Export & close (1 min)**
- Download CSV
- Show the rep gets everything they need in their CRM
- Close with: "This replaces 2–3 hours of manual SDR research per batch"

**7. Roadmap (1 min)**
- Google Sheets polling (real-time, no upload needed)
- CRM push (direct to HubSpot/Salesforce)
- Scheduling (run daily at 9am, email results to reps)

---

## Pre-Demo Checklist

- [ ] All 4 API keys set in `.env`
- [ ] `make dev` starts cleanly with no errors
- [ ] Sample CSV loads and parses all 12 leads
- [ ] At least one HOT, WARM, NURTURE, NOT_QUALIFIED lead in results
- [ ] Outreach email for top lead references specific data (not a generic template)
- [ ] CSV export downloads with correct data
- [ ] No raw error messages visible in any state
- [ ] Chrome DevTools closed (no distractions during demo)

---

## Acceptance Criteria

- [ ] All error states have friendly, specific messages — no raw exceptions ever visible
- [ ] Loading animation shows meaningful progress, not just a spinner
- [ ] Sample CSV produces at least one lead per tier
- [ ] Modal opens and closes without layout shift
- [ ] Export files open cleanly in Excel and a text editor
- [ ] App is stable across 3 back-to-back demo runs (no state leakage between runs)
- [ ] "Process another batch" resets all state cleanly to the upload screen
