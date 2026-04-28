# Lead Enrichment Tool

An AI-powered inbound lead enrichment and scoring tool built for EliseAI's sales team. Takes raw lead data (name, email, company, property address) and returns enriched profiles, lead scores, personalized outreach drafts, and sales insights — all in one polished web UI.

---

## What It Does

1. **Ingests leads** via Excel upload, CSV paste, manual single-lead entry, or Google Sheets link
2. **Enriches each lead** by calling multiple public APIs in parallel
3. **Scores leads** (0–100) using a documented model tuned for EliseAI's ICP
4. **Drafts outreach emails** personalized with enriched data via Claude API
5. **Surfaces sales insights** — key signals a rep should know before reaching out
6. **Persists history** — every upload creates a named project; revisit any past batch instantly
7. **Syncs Google Sheets** — link a live sheet and pull in new rows on demand

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), React, TypeScript, shadcn/ui, Tailwind CSS |
| Backend | Python 3.11+, FastAPI, httpx, pandas, openpyxl |
| Database | Supabase (Postgres) — projects, leads, enrichment results, AI insights |
| AI | Anthropic Claude API (outreach emails + scoring rationale) |
| Deployment | Local dev now; Vercel (frontend) + separate Python host later |

---

## Public APIs Used

| API | Purpose | Auth |
|---|---|---|
| [OpenStreetMap Nominatim](https://nominatim.org) | Geocoding: lat/lon, suburb, neighborhood, ZIP, county | Free, no key |
| [U.S. Census API](https://api.census.gov) | City-level demographics: median income, renter %, population | Free, no key |
| [DataUSA API](https://datausa.io/about/api) | Metro-level economic data: wages, poverty rate | Free, no key |
| [HUD Fair Market Rents](https://www.huduser.gov/hudapi/public/register) | County-level FMR: studio, 1BR, 2BR rents | Free, key required |
| [Overpass API](https://overpass-api.de) | Nearby multifamily building count (OpenStreetMap) | Free, no key |
| [FRED API](https://fred.stlouisfed.org/docs/api/fred/) | State unemployment rate, rental vacancy, housing price index | Free, key required |
| [NewsAPI](https://newsapi.org) | Recent news about the lead's company + sentiment | Free tier, key required |
| [Anthropic Claude API](https://www.anthropic.com/api) | Personalized email drafts + lead scoring rationale | Key required |
| [Google Sheets API](https://developers.google.com/sheets/api) | Import leads directly from a linked spreadsheet | Service account JSON |

---

## Lead Scoring Model

EliseAI sells AI leasing assistants to multifamily property managers. A "good lead" manages multiple apartment units in a competitive, urban/suburban rental market where automation saves real time and money.

Enrichment runs in two phases per lead: **geocoding first** (Nominatim), then all remaining modules in parallel.

### Scoring Components

| Component | Max Points | Key Inputs |
|---|---|---|
| **Demographics** | 35 | Median income (Census), renter % (Census), total population |
| **Market Health** | 35 | State unemployment (FRED), rental vacancy rate (FRED), poverty rate (DataUSA), HUD 2BR FMR, nearby multifamily count (Overpass) |
| **News** | 20 | Company news sentiment (NewsAPI) |
| **Geographic** | 10 | Major metro bonus list (NYC, LA, Chicago, Houston, etc.) |
| **Walkability** | 0 | Disabled — WalkScore requires a paid API key |

### Score Tiers

| Score | Tier | Action |
|---|---|---|
| 80–100 | **HOT** | Priority outreach within 24h |
| 60–79 | **WARM** | Outreach within 48h |
| 40–59 | **NURTURE** | Add to drip sequence |
| 0–39 | **NOT QUALIFIED** | Deprioritize |

---

## Project Structure

```
EliseAI-interview/
├── README.md
├── CLAUDE.md
├── .env.example
├── sample_leads.csv
├── Makefile
├── documentation/
│   ├── supabase_schema.sql     # Run this to set up your Supabase tables
│   └── Phase*.md               # Build phase notes
│
├── backend/
│   ├── main.py                 # FastAPI app, CORS, all routes
│   ├── models.py               # Pydantic request/response models
│   ├── scoring.py              # Deterministic lead scoring logic
│   ├── outreach.py             # Claude API — email drafts + insights
│   ├── database.py             # Supabase client + all DB helpers
│   ├── sheets.py               # Google Sheets integration
│   ├── utils.py                # CSV/Excel parsing helpers
│   ├── requirements.txt
│   └── enrichment/
│       ├── __init__.py
│       ├── nominatim.py        # OpenStreetMap geocoding
│       ├── census.py           # U.S. Census API
│       ├── datausa.py          # DataUSA API
│       ├── hud_fmr.py          # HUD Fair Market Rents
│       ├── overpass.py         # Nearby multifamily count (OSM)
│       ├── fred.py             # FRED API
│       └── news.py             # NewsAPI
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── components.json         # shadcn/ui config
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx            # Home page — upload / new project flow
        │   ├── globals.css         # EliseAI-inspired theme
        │   └── projects/[id]/
        │       └── page.tsx        # Per-project view (enrich, results, sheet sync)
        ├── components/
        │   ├── ui/                 # shadcn/ui primitives
        │   ├── Header.tsx
        │   ├── ProjectSidebar.tsx  # Project history sidebar
        │   ├── LeadUploader.tsx
        │   ├── LeadTable.tsx
        │   └── LeadDetail.tsx      # Lead drill-down modal
        └── lib/
            ├── types.ts            # Shared TypeScript types (mirrors Pydantic models)
            ├── api.ts              # Frontend API client
            ├── supabase.ts         # Supabase browser client
            └── ai-cache.ts         # Local AI insights cache
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- A free [Supabase](https://supabase.com) project
- API keys for: HUD, FRED, NewsAPI, Anthropic (see `.env.example`)

### 1. Clone and set up environment

```bash
git clone <repo>
cd EliseAI-interview
cp .env.example backend/.env
# Fill in your API keys in backend/.env
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. In the Supabase dashboard → SQL Editor, run the contents of `documentation/supabase_schema.sql`
3. Copy your project URL and service role key into `backend/.env`
4. Copy your project URL and anon key into `frontend/.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

### 3. Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend will be running at `http://localhost:8000`.
API docs at `http://localhost:8000/docs`.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be running at `http://localhost:3000`.

### 5. Load sample data

A `sample_leads.csv` is included at the project root with 12 realistic test leads across a variety of markets and property types. Upload it via the UI to see the full enrichment flow.

---

## API Keys Setup

| Key | Where to get it | Required? |
|---|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase dashboard → Project Settings → API (service_role) | Yes |
| `HUD_API_KEY` | [huduser.gov/hudapi/public/register](https://www.huduser.gov/hudapi/public/register) | Recommended |
| `FRED_API_KEY` | [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html) | Recommended |
| `NEWS_API_KEY` | [newsapi.org/register](https://newsapi.org/register) | Recommended |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | Yes (for AI features) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | GCP Console → IAM → Service Accounts (path to JSON file or raw JSON string) | Google Sheets only |

The app runs without Supabase (in-memory mode with placeholder IDs), but projects won't persist across sessions. It runs without optional API keys — those enrichment modules simply return empty results gracefully.

---

## Google Sheets Integration

1. Share your Google Sheet with the service account email (shown in the UI after connecting)
2. Ensure the sheet has columns matching the [input format below](#input-format)
3. Paste the sheet URL in the "Link Google Sheet" dialog
4. Use "Sync New Rows" to pull in leads added since the last sync

---

## Input Format

Leads can be uploaded as `.xlsx`, `.csv`, pasted as raw CSV text, or linked via Google Sheets. Required columns:

| Column | Example |
|---|---|
| `name` | Sarah Chen |
| `email` | sarah@greystar.com |
| `company` | Greystar Real Estate |
| `property_address` | 2500 Market St |
| `city` | Philadelphia |
| `state` | PA |
| `country` | USA |

Column names are case-insensitive and can contain spaces or underscores.

---

## Future Roadmap

- **Auto-send outreach**: Currently copy-paste only. Future: SendGrid/Resend integration behind a "Send" button with rep confirmation
- **CRM push**: Write enriched leads directly to HubSpot or Salesforce
- **Vercel deployment**: Frontend on Vercel, Python backend on Railway or Fly.io
- **Rep dashboard**: Filter/sort by score tier, assign to reps, track outreach status
- **Webhook trigger**: POST endpoint to receive leads from any form tool (Typeform, HubSpot forms, etc.)
