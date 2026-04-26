# EliseAI Lead Enrichment — Full Build Plan

## Overview

This tool automates the inbound lead process for EliseAI's sales team. A rep uploads a lead list (or eventually connects a live sheet), and within seconds gets back enriched profiles, lead scores, and ready-to-send outreach emails — powered by public APIs and Claude AI.

---

## Phases at a Glance

| Phase | Name | Status | Output |
|---|---|---|---|
| [Phase 1](./Phase1.md) | Foundation & Scaffolding | ✅ Done | Dev environment, design system, health check UI |
| [Phase 2](./Phase2.md) | Lead Ingestion | ✅ Done | File upload, CSV paste, single-lead form, parsed lead table |
| [Phase 3](./Phase3.md) | Enrichment Engine | 🔲 Planned | 5 API integrations running in parallel per lead |
| [Phase 4](./Phase4.md) | Lead Scoring | 🔲 Planned | 0–100 score, tier classification, score breakdown UI |
| [Phase 5](./Phase5.md) | Claude AI Layer | 🔲 Planned | Personalized outreach emails, sales insights, score rationale |
| [Phase 6](./Phase6.md) | Results & Export | 🔲 Planned | Sortable results table, lead detail modal, CSV/JSON export |
| [Phase 7](./Phase7.md) | Polish & Demo | 🔲 Planned | Sample data, error states, loading UX, demo-ready build |

---

## Architecture Snapshot

```
User uploads leads
        ↓
  Next.js frontend (port 3000)
        ↓  POST /api/process-leads
  FastAPI backend (port 8000)
        ↓  asyncio.gather(...)
  ┌─────┬──────┬──────────┬──────┬────────┐
Census DataUSA WalkScore  FRED  NewsAPI
  └─────┴──────┴──────────┴──────┴────────┘
        ↓  enriched data
  Scoring engine (pure Python, deterministic)
        ↓  score + tier
  Claude API (outreach email + rationale)
        ↓
  Enriched lead JSON → frontend → display + export
```

---

## Design Principles

- **Graceful degradation**: if one API is down, the rest still run. Partial enrichment is better than a failed request.
- **Parallelism**: all enrichment calls for a single lead run concurrently via `asyncio.gather`. Multiple leads are processed concurrently too (bounded to avoid rate limiting).
- **Deterministic scoring**: the 0–100 score is computed with plain Python logic, not AI. Claude is only used for prose — rationale text and email body.
- **Copy-paste outreach**: emails are generated for reps to review and send manually. No auto-send.
- **Dark only**: no light/dark toggle ever. The UI is always the EliseAI dark purple theme.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 15, React, TypeScript, shadcn/ui, Tailwind, Plus Jakarta Sans |
| Backend | Python 3.11, FastAPI, httpx, pandas, openpyxl |
| AI | Anthropic Claude API (`claude-sonnet-4-5` or latest) |
| APIs | Census, DataUSA, WalkScore, FRED, NewsAPI |
| Dev tooling | Makefile + concurrently (`make dev`) |
| Deployment (future) | Vercel (frontend) + Railway or Fly.io (backend) |

---

## Key Files

```
EliseAI-interview/
├── documentation/
│   ├── PLAN.md          ← this file
│   ├── Phase1.md
│   ├── Phase2.md
│   ├── Phase3.md
│   ├── Phase4.md
│   ├── Phase5.md
│   ├── Phase6.md
│   └── Phase7.md
├── backend/
│   ├── main.py          ← FastAPI app + routes
│   ├── models.py        ← Pydantic models (source of truth for shapes)
│   ├── scoring.py       ← Lead scoring logic (0–100)
│   ├── outreach.py      ← Claude API calls
│   └── enrichment/
│       ├── census.py
│       ├── datausa.py
│       ├── walkscore.py
│       ├── fred.py
│       └── news.py
└── frontend/src/
    ├── app/page.tsx     ← Main page (step state machine)
    ├── components/
    │   ├── LeadUploader.tsx
    │   ├── LeadTable.tsx
    │   ├── LeadDetailModal.tsx
    │   └── ScoreBadge.tsx
    └── lib/
        ├── types.ts     ← Keep in sync with models.py
        └── api.ts       ← All fetch calls
```
