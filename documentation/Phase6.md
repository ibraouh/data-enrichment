# Phase 6 — Results & Export

**Status:** 🔲 Not Started  
**Depends on:** Phase 5 complete (fully enriched leads with AI output)

---

## Goal

Display the enriched leads in a polished, scannable results table. Let reps click into any lead for the full detail view: score breakdown, enrichment data, outreach email, and sales insights. Export the full results as CSV or JSON.

---

## Results Table (`LeadTable.tsx` — enhanced)

### Columns
| Column | Content |
|---|---|
| **Score** | `ScoreBadge` component — tier pill + number |
| **Contact** | Name + email (two-line cell) |
| **Company** | Company name |
| **Location** | City, State |
| **Median Income** | Formatted dollar value or "—" |
| **Renter %** | Percentage or "—" |
| **Walk Score** | Number + colored dot (green ≥ 70, yellow 40–69, gray < 40) |
| **News** | Sentiment icon: 📈 positive / ➖ neutral / 📉 negative |
| **Action** | "View →" button → opens detail modal |

### Table features
- **Sort** by Score (default: descending), Company, City
- **Filter** by tier: All / HOT / WARM / NURTURE / NOT_QUALIFIED
- **Search** by name, company, or city (client-side, instant)
- Row count badge: "12 leads · 3 HOT · 4 WARM · 3 NURTURE · 2 Not Qualified"
- Clicking any row opens the detail modal
- Sticky header

---

## Lead Detail Modal (`LeadDetailModal.tsx`)

A full-screen slide-over (right drawer) with 3 tabs.

### Tab 1: Overview
- Large score badge at top
- Score rationale text (from Claude)
- Score breakdown bar chart:
  ```
  Demographics   ████████░░  22/30
  Market Health  ███████░░░  18/25
  Walkability    █████████░  17/20
  News           ███████████ 12/15
  Geography      ██████████  10/10
  ─────────────────────────────────
  Total                      79/100  WARM
  ```
- Lead metadata: name, email, company, address, city, state

### Tab 2: Enrichment Data
Three sections in a 2-column grid:

**Demographics** (Census)
- Median household income
- Total population
- Renter percentage
- Data year

**Property & Location** (WalkScore)
- Walk Score + description
- Transit Score
- Bike Score

**Market Health** (FRED + DataUSA)
- State unemployment rate
- Rental vacancy rate
- Average wage

**Recent News** (NewsAPI)
- List of up to 5 articles: headline, source, date, sentiment icon
- "No recent news found" empty state

### Tab 3: Outreach Email
- Email subject line (editable `<input>`)
- Email body (editable `<textarea>`)
- "Copy Email" button → copies subject + body to clipboard with a checkmark confirmation
- "Copy Subject Only" link
- Note: "Review before sending — AI-generated, personalized for {name} at {company}"

**Below the email:** Sales Insights section
- Bullet list of 3–5 insights from Claude
- Each bullet has a small icon (📊 for data, 📰 for news, 📍 for location)

---

## Export

Two buttons in the results table header:

### Download CSV
Flat CSV with one row per lead. Columns:
`name, email, company, property_address, city, state, score, tier, median_income, renter_pct, walk_score, transit_score, unemployment_rate, rental_vacancy_rate, news_sentiment, email_subject, email_body`

### Download JSON
Full `EnrichedLead[]` JSON array — complete nested structure including all enrichment data, score breakdown, and AI outputs.

**Implementation**: Both downloads are generated client-side from the results array already in memory. No backend call needed.

```typescript
function downloadCSV(leads: EnrichedLead[]) {
  const rows = leads.map(lead => flattenLeadToCSVRow(lead))
  const csv = [CSV_HEADERS, ...rows].join('\n')
  triggerDownload('elise_leads.csv', 'text/csv', csv)
}

function downloadJSON(leads: EnrichedLead[]) {
  triggerDownload('elise_leads.json', 'application/json', JSON.stringify(leads, null, 2))
}
```

---

## New Components

| Component | Description |
|---|---|
| `LeadTable.tsx` (rewrite) | Full results table with sort, filter, search |
| `LeadDetailModal.tsx` | 3-tab slide-over drawer |
| `ScoreBreakdownBar.tsx` | Visual score component bars |
| `NewsArticleList.tsx` | Article list with sentiment icons |
| `OutreachEmailPanel.tsx` | Editable email + copy button |
| `ExportButtons.tsx` | CSV + JSON download buttons |

---

## State Management

All state lives in `page.tsx`. No external state library needed.

```typescript
type Step = "upload" | "preview" | "enriching" | "results"

// Results page state
const [leads, setLeads] = useState<EnrichedLead[]>([])
const [selectedLead, setSelectedLead] = useState<EnrichedLead | null>(null)
const [filterTier, setFilterTier] = useState<Tier | "ALL">("ALL")
const [sortBy, setSortBy] = useState<"score" | "company" | "city">("score")
const [search, setSearch] = useState("")
```

---

## Acceptance Criteria

- [ ] Results table displays all enriched leads sorted by score descending
- [ ] Filter buttons correctly filter by tier; counts update
- [ ] Search filters by name, company, city instantly (no debounce needed for < 100 leads)
- [ ] Clicking a row opens the detail modal for that lead
- [ ] Score breakdown bar shows correct values and proportions for all 5 components
- [ ] Enrichment tab shows "—" for any null/missing value (never crashes on missing data)
- [ ] News tab shows article list or "No recent news" empty state
- [ ] Outreach email is editable before copying
- [ ] "Copy Email" copies subject + body as formatted text and shows checkmark
- [ ] CSV export downloads with correct headers and all 12 leads
- [ ] JSON export downloads valid JSON with full nested structure
- [ ] "Process another batch" button resets to upload step
