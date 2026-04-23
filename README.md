# EliseAI Lead Enrichment Tool

An AI-powered inbound lead enrichment and scoring tool built for EliseAI's sales team. Takes raw lead data (name, email, company, property address) and returns enriched profiles, lead scores, personalized outreach drafts, and sales insights — all in one polished web UI.

---

## What It Does

1. **Ingests leads** via Excel upload, CSV paste, or manual single-lead entry
2. **Enriches each lead** by calling multiple public APIs in parallel
3. **Scores leads** (0–100) using a documented model tuned for EliseAI's ICP
4. **Drafts outreach emails** personalized with enriched data via Claude API
5. **Surfaces sales insights** — key signals a rep should know before reaching out
6. **Exports results** as CSV or JSON for downstream CRM use

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), React, TypeScript, shadcn/ui, Tailwind CSS |
| Backend | Python 3.11+, FastAPI, httpx, pandas, openpyxl |
| AI | Anthropic Claude API (outreach emails + scoring rationale) |
| Deployment | Local dev now; Vercel (frontend) + separate Python host later |

---

## Public APIs Used

| API | Purpose | Auth |
|---|---|---|
| [U.S. Census API](https://api.census.gov) | City-level demographics: median income, renter %, population | Free, no key |
| [DataUSA API](https://datausa.io/about/api) | Metro-level economic data: wages, growth trends | Free, no key |
| [WalkScore API](https://www.walkscore.com/professional/api.php) | Property walkability, transit, and bike scores | Free tier, key required |
| [FRED API](https://fred.stlouisfed.org/docs/api/fred/) | Regional unemployment, housing market indicators | Free, key required |
| [NewsAPI](https://newsapi.org) | Recent news about the lead's company | Free tier, key required |
| [Anthropic Claude API](https://www.anthropic.com/api) | Personalized email drafts + lead scoring rationale | Key required |

---

## Lead Scoring Model

EliseAI sells AI leasing assistants to multifamily property managers. A "good lead" is someone who manages multiple apartment units in a competitive, urban/suburban rental market where automation saves real time and money.

### Scoring Assumptions

| Signal | Max Points | Reasoning |
|---|---|---|
| **Demographics** | 30 | High median income + high renter % = active leasing market with high resident expectations |
| **Market Health** | 25 | Low unemployment + economic growth = companies have budget and confidence to invest |
| **Walkability** | 20 | WalkScore > 60 signals urban/suburban multifamily — EliseAI's core market |
| **Company News** | 15 | Recent growth news (acquisitions, expansions, funding) = company is in motion and receptive |
| **Geographic Market** | 10 | Major metros (NYC, LA, Chicago, etc.) = larger deal sizes and more sophisticated buyers |

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
│
├── backend/
│   ├── main.py                 # FastAPI app, CORS, routes
│   ├── models.py               # Pydantic request/response models
│   ├── scoring.py              # Lead scoring logic
│   ├── outreach.py             # Claude API — email drafts + insights
│   ├── requirements.txt
│   └── enrichment/
│       ├── __init__.py
│       ├── census.py           # U.S. Census API
│       ├── datausa.py          # DataUSA API
│       ├── walkscore.py        # WalkScore API
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
        │   ├── page.tsx        # Main app page (upload → results flow)
        │   └── globals.css     # EliseAI-inspired theme
        ├── components/
        │   ├── ui/             # shadcn/ui components
        │   ├── Header.tsx
        │   ├── LeadUploader.tsx
        │   ├── LeadTable.tsx
        │   ├── LeadDetailModal.tsx
        │   └── ScoreBadge.tsx
        └── lib/
            ├── types.ts        # Shared TypeScript types
            └── api.ts          # Frontend API client
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- API keys for: WalkScore, FRED, NewsAPI, Anthropic (see `.env.example`)

### 1. Clone and set up environment

```bash
git clone <repo>
cd EliseAI-interview
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend will be running at `http://localhost:8000`.
API docs at `http://localhost:8000/docs`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be running at `http://localhost:3000`.

### 4. Load sample data

A `sample_leads.csv` is included at the project root with 12 realistic test leads across a variety of markets and property types. Upload it via the UI to see the full enrichment flow.

---

## API Keys Setup

Sign up for free at each provider and add keys to your `.env`:

| Key | Where to get it |
|---|---|
| `WALKSCORE_API_KEY` | [walkscore.com/professional/api.php](https://www.walkscore.com/professional/api.php) |
| `FRED_API_KEY` | [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html) |
| `NEWS_API_KEY` | [newsapi.org/register](https://newsapi.org/register) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |

---

## Input Format

Leads can be uploaded as `.xlsx`, `.csv`, or pasted as raw CSV text. Required columns:

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

- **Google Sheets polling**: Connect to Google Sheets API, poll every 60 seconds, auto-process new rows
- **CRM push**: Write enriched leads directly to HubSpot or Salesforce
- **Vercel deployment**: Frontend on Vercel, Python backend on Railway or Fly.io
- **Rep dashboard**: Filter/sort by score tier, assign to reps, track outreach status
- **Webhook trigger**: POST endpoint to receive leads from any form tool (Typeform, HubSpot forms, etc.)
