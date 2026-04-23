# CLAUDE.md — EliseAI Lead Enrichment Tool

This file gives Claude Code context about the project so it can assist effectively across sessions.

---

## What This Project Is

A full-stack lead enrichment tool built as an EliseAI interview take-home. It ingests raw inbound leads (name, email, company, property address), enriches them via multiple public APIs, scores them for fit with EliseAI's ICP, and generates personalized outreach emails via the Anthropic Claude API.

---

## Architecture

**Frontend:** Next.js 15 App Router, React, TypeScript, shadcn/ui, Tailwind CSS, Plus Jakarta Sans.
**Backend:** Python 3.11, FastAPI, httpx (async HTTP), pandas + openpyxl (file parsing).
**AI:** Anthropic Claude API — used for personalized outreach email drafts and lead scoring rationale.
**Local dev only for now.** No deployment yet; Vercel (frontend) + separate Python host is the plan.

The frontend calls the Python backend directly (CORS enabled on `localhost:8000`). No Next.js API route proxy — keep it simple for local dev.

---

## Running Locally

```bash
# Backend (port 8000)
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000

# Frontend (port 3000)
cd frontend && npm run dev
```

---

## Key Conventions

### Python Backend
- Use `async def` + `httpx.AsyncClient` for all external API calls — enrich leads in parallel with `asyncio.gather`.
- All enrichment modules live in `backend/enrichment/`. Each exports a single async function: `async def enrich_*(lead: RawLead, client: httpx.AsyncClient) -> dict`.
- Enrichment failures are caught and return empty dicts — never crash the whole request because one API is down.
- Scoring logic is purely deterministic Python in `scoring.py` — no AI needed for the score number itself.
- Claude API is only called in `outreach.py` for email generation and scoring rationale text.
- Use `python-dotenv` to load `.env`. Never hardcode API keys.
- Pydantic models in `models.py` are the source of truth for request/response shapes.

### TypeScript Frontend
- Types in `src/lib/types.ts` must stay in sync with Pydantic models in `backend/models.py`.
- API calls go through `src/lib/api.ts` — no raw `fetch` in components.
- Use shadcn/ui components from `src/components/ui/`. Add new ones via `npx shadcn@latest add <component>`.
- Three-step UI flow: **Upload → Processing → Results**. Manage with a `step` state enum in `page.tsx`.
- Keep components focused: `LeadUploader` handles input only, `LeadTable` handles display only, `LeadDetailModal` handles the drill-down.

### Design System

**Research findings on EliseAI's brand:**
- Primary brand color is **purple** (not indigo) — used in logo, buttons, CTAs, and arrow icons
- Logo treatment: wordmark "Elise" + "AI" with the icon living in a solid purple rounded square
- Marketing site is light-themed; this app is a dark adaptation of the same brand palette
- Typography: **Plus Jakarta Sans** (400/500/600/700/800 weights) — matches the numbered weight naming in EliseAI's own style guide (`Body1-Regular`, `Body1-Semi`, etc.)
- Gradient: purple → deep blue, used for hero sections and CTA highlights
- Aesthetic: clean, minimal, generous whitespace, rounded corners, professional B2B SaaS

**Color palette** (CSS custom properties in `globals.css`, Tailwind tokens in `tailwind.config.ts`):

| Token | HSL | Approx Hex | Usage |
|---|---|---|---|
| `--background` | `252 47% 6%` | `#0B0917` | Page background — dark purple-black |
| `--card` | `254 42% 11%` | `#131028` | Card / surface backgrounds |
| `--muted` | `254 35% 15%` | `#1B1835` | Subtle lifted surfaces |
| `--border` | `254 30% 22%` | `#28234A` | Borders, dividers |
| `--foreground` | `252 60% 96%` | `#EDE9FF` | Primary text — purple-tinted white |
| `--muted-foreground` | `252 18% 58%` | `#847EA8` | Secondary/placeholder text |
| `--primary` | `261 82% 59%` | `#7847EA` | **EliseAI brand purple** — buttons, links, accents |
| `--accent` | `261 100% 72%` | `#9D6FFF` | Hover states, highlights |

**Elise color scale** (in `tailwind.config.ts` as `elise-*`):
- `elise-500` = `#7847EA` — primary brand purple
- `elise-400` = `#9D6FFF` — accent / hover
- `elise-200` = `#C9BAFF` — subtle tints
- Use `elise-*` when you need explicit brand purple outside shadcn's `primary` token.

**Typography:**
- Font: `Plus Jakarta Sans` — loaded via `next/font/google`, applied via `--font-jakarta` CSS variable
- Headings: `font-extrabold` or `font-bold`, `tracking-tight`
- Body: `font-normal` or `font-medium`, relaxed line-height
- Captions / labels: `text-xs font-semibold text-muted-foreground`
- Never use system-ui or Inter — the font is set globally via `font-sans` in Tailwind config

**Gradients:**
- Brand gradient (purple → blue): `bg-gradient-brand` utility class or `background: linear-gradient(135deg, hsl(261 82% 59%) 0%, hsl(220 90% 60%) 100%)`
- Subtle gradient background: `bg-gradient-brand-subtle` (same but at 15% opacity)
- Apply to hero headlines with `bg-clip-text text-transparent`

**Glow effects:**
- `shadow-glow-sm` — subtle purple glow for logo icons and small accents
- `shadow-glow-md` — medium glow for primary buttons on hover
- `shadow-glow-lg` — large glow for hero elements

**Score tier badge colors** (CSS vars available for future use):
- HOT (80–100): `text-red-400 bg-red-950/40 border-red-800/60`
- WARM (60–79): `text-amber-400 bg-amber-950/40 border-amber-800/60`
- NURTURE (40–59): `text-blue-400 bg-blue-950/40 border-blue-800/60`
- NOT_QUALIFIED (0–39): `text-muted-foreground bg-muted border-border`

**Rules:**
- Dark only — no light/dark toggle, ever.
- Never switch back to indigo or slate as the primary — EliseAI's brand color is purple.
- Never use `Inter` — font is Plus Jakarta Sans.
- Use `surface-glass` utility class for sticky/overlay elements (header, modals).
- Purple glow (`glow-primary`) on primary interactive elements where appropriate.

---

## APIs & What They Return

| Module | API | Key Env Var | What We Extract |
|---|---|---|---|
| `census.py` | U.S. Census ACS5 | none (free) | median income, renter %, total population by city |
| `datausa.py` | DataUSA | none (free) | metro-level wages, poverty rate, employment |
| `walkscore.py` | WalkScore | `WALKSCORE_API_KEY` | walk_score, transit_score, bike_score |
| `fred.py` | FRED | `FRED_API_KEY` | state unemployment rate, housing price index |
| `news.py` | NewsAPI | `NEWS_API_KEY` | recent company news headlines + sentiment |
| `outreach.py` | Anthropic Claude | `ANTHROPIC_API_KEY` | email subject + body, scoring rationale, key insights |

All enrichment runs in parallel per lead. Each module handles its own errors silently.

---

## Lead Scoring Logic

Documented in `backend/scoring.py`. Score is 0–100, computed from:

| Component | Weight | Key inputs |
|---|---|---|
| Demographics | 30 pts | Median income (>$60k scores higher), renter % (>50% scores higher), population |
| Market health | 25 pts | Low unemployment (<5%), economic growth signals from DataUSA |
| Walkability | 20 pts | WalkScore >70 = full points; <30 = near zero |
| Company news | 15 pts | Positive sentiment in recent headlines; no news = neutral |
| Geographic market | 10 pts | Major metro bonus list (NYC, LA, Chicago, Houston, Phoenix, etc.) |

**Why these signals?** EliseAI's product is most valuable to property managers in competitive, urban/suburban rental markets with high unit turnover. High-income, high-renter-percentage metros have the most leasing traffic and the strongest ROI case for AI automation.

---

## File Parsing

`backend/main.py` accepts three input modes:
1. **Excel upload** (`.xlsx`) — parsed with `pandas.read_excel`
2. **CSV upload** (`.csv`) — parsed with `pandas.read_csv`
3. **Raw CSV text** — parsed with `pandas.read_csv(StringIO(text))`
4. **Single lead JSON** — direct Pydantic model instantiation

Column names are normalized (lowercased, spaces→underscores) before validation.

---

## Sample Data

`sample_leads.csv` at the project root contains 12 realistic leads across varied markets:
- Mix of major metros (NYC, Chicago, SF) and secondary/rural markets
- Mix of large property management companies and smaller operators
- Intentionally varied so all four score tiers (HOT/WARM/NURTURE/NOT_QUALIFIED) appear

Use this for demos and development testing.

---

## Future Work (Not Implemented Yet)

- **Google Sheets polling**: Poll a linked sheet every 60s, diff against last-seen row count, enrich new rows automatically. Will use `google-api-python-client`.
- **Vercel deployment**: Frontend to Vercel. Python backend to Railway or Fly.io. Update `NEXT_PUBLIC_API_URL` env var.
- **Auto-send outreach**: Currently copy-paste only. Future: SendGrid/Resend integration behind a "Send" button with rep confirmation.
- **CRM sync**: HubSpot or Salesforce API write-back after enrichment.
