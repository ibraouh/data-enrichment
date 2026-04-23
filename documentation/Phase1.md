# Phase 1 — Foundation & Scaffolding

**Status:** ✅ Complete

---

## Goal

Set up the full project skeleton: dev environment, design system, and a minimal end-to-end connection between the frontend and backend. No real functionality yet — just a working "ping" that proves both servers start and talk to each other.

---

## What Was Built

### Infrastructure
- **Makefile** with `make install`, `make dev`, `make backend`, `make frontend` targets
- **Root `package.json`** using `concurrently` to run both servers with one command and color-coded output
- **Python `venv`** in `backend/venv/`, isolated from project files so uvicorn's `--reload` doesn't thrash
- **`.env.example`** with placeholder keys for all 6 APIs
- **`frontend/.env.local`** with `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`

### Backend
- FastAPI app in `backend/main.py` with CORS configured for `localhost:3000`
- `GET /api/health` → `{"status": "ok"}`
- `GET /api/hello` → `{"message": "EliseAI Lead Enrichment API is live."}`
- Empty stubs: `models.py`, `enrichment/__init__.py`
- `uvicorn --reload --reload-dir .` watches only `backend/` source, not `venv/`

### Frontend
- Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Design system** applied (see below)
- `src/lib/api.ts` — `fetchHello()` client function
- `src/lib/types.ts` — stub, ready for lead types
- `src/components/ui/button.tsx` and `card.tsx` — shadcn components (hand-written)
- `src/components/Header.tsx` — sticky nav with EliseAI logo treatment
- `src/app/page.tsx` — hero + feature cards + "Ping API" button with success/error state

### Design System (established in this phase)
- **Font**: Plus Jakarta Sans (400–800 weights via `next/font/google`)
- **Primary color**: `#7847EA` — EliseAI brand purple (`hsl(261 82% 59%)`)
- **Backgrounds**: dark purple-black tinted (`#0B0917`, `#131028`)
- **Gradient**: purple → deep blue (`bg-gradient-brand`)
- **Glow shadows**: `shadow-glow-sm/md/lg` for interactive elements
- **Glass surface**: `surface-glass` utility for header/modal overlays
- **Score tier colors**: HOT=red, WARM=amber, NURTURE=blue, NOT_QUALIFIED=gray-purple
- Full token table in `CLAUDE.md` → Design System section

---

## Key Decisions Made

- **Direct CORS, no Next.js proxy**: frontend calls `http://127.0.0.1:8000` directly. Simpler for local dev; update `NEXT_PUBLIC_API_URL` for production.
- **`127.0.0.1` not `localhost`**: macOS resolves `localhost` as `::1` (IPv6) first; uvicorn only binds IPv4. Using the IP directly avoids the connection error.
- **Dark only**: no light/dark toggle. Matches EliseAI's professional aesthetic.
- **Plus Jakarta Sans over Inter**: matches the weight naming convention (`Regular/Medium/Semi`) found in EliseAI's own published style guide.

---

## How to Verify

```bash
make install   # sets up venv + npm deps
make dev       # starts both servers

# Backend
curl http://127.0.0.1:8000/api/hello
# → {"message":"EliseAI Lead Enrichment API is live."}

# Frontend — open http://localhost:3000
# Click "Ping API" → green success message appears
```
