# Phase 2 — Lead Ingestion

**Status:** ✅ Complete

---

## Goal

Let users get lead data into the system three ways: upload a file (Excel or CSV), paste raw CSV text, or enter a single lead manually. Parse and validate the data on the backend, then display a clean preview table in the UI before enrichment begins.

---

## User Flow

```
Landing page
    ↓  user picks an input method
┌───────────────────────────────────────┐
│  Tab 1: Upload File (.xlsx or .csv)   │
│  Tab 2: Paste CSV text                │
│  Tab 3: Add single lead (form)        │
└───────────────────────────────────────┘
    ↓  submit
Backend parses + validates
    ↓
Lead preview table (raw data, no enrichment yet)
    ↓  user clicks "Enrich Leads →"
→ Phase 3 begins
```

---

## Backend Changes

### New endpoint: `POST /api/parse-leads`

Accepts a `multipart/form-data` request with one of:
- `file` field — `.xlsx` or `.csv` file upload
- `csv_text` field — raw CSV string

Returns a validated list of `RawLead` objects (or errors).

**`backend/models.py`** — add:
```python
class RawLead(BaseModel):
    name: str
    email: str
    company: str
    property_address: str
    city: str
    state: str
    country: str = "USA"

class ParseLeadsResponse(BaseModel):
    leads: list[RawLead]
    total: int
    errors: list[str]   # row-level parse errors, non-fatal
```

**`backend/main.py`** — add:
```python
POST /api/parse-leads   → ParseLeadsResponse
```

**Parsing logic** (in `main.py` or extracted to `utils.py`):
1. Detect file type by extension (`.xlsx` → `pd.read_excel`, `.csv` → `pd.read_csv`, no file → `pd.read_csv(StringIO(csv_text))`)
2. Normalize column names: lowercase, strip whitespace, replace spaces with underscores
3. Map common aliases: `"address"` → `property_address`, `"first name" + "last name"` → `name`, etc.
4. Validate each row against `RawLead` — collect errors, skip bad rows, continue
5. Return validated leads + error list

### Single lead endpoint: `POST /api/parse-leads/single`
Accepts a JSON body matching `RawLead` directly (no file parsing needed).

---

## Frontend Changes

### New components

**`src/components/LeadUploader.tsx`**
- Tabbed interface: "Upload File" | "Paste CSV" | "Add Single Lead"
- **Upload tab**: drag-and-drop zone (use native drag events, no extra library) + "Browse files" button. Shows file name + row count after selection.
- **Paste tab**: `<textarea>` with monospace font, placeholder showing the expected CSV header row
- **Single lead tab**: form with 7 fields matching `RawLead`. All required except `country` (defaults to USA).
- On submit: POST to `/api/parse-leads`, transition to preview table on success

**`src/components/LeadTable.tsx`** (initial version — raw leads only)
- Displays parsed leads in a clean table
- Columns: Name, Email, Company, Property Address, City, State
- Row count badge
- "Enrich Leads →" primary button at bottom
- Error banner if any rows failed to parse (collapsible)

### Page state machine (`src/app/page.tsx`)
```typescript
type Step = "upload" | "preview" | "enriching" | "results"
```
Phase 2 covers `upload → preview`. `preview → enriching → results` is Phase 3+.

### `src/lib/types.ts` — add:
```typescript
export interface RawLead {
  name: string
  email: string
  company: string
  property_address: string
  city: string
  state: string
  country: string
}

export interface ParseLeadsResponse {
  leads: RawLead[]
  total: number
  errors: string[]
}
```

### `src/lib/api.ts` — add:
```typescript
parseLeadsFromFile(file: File): Promise<ParseLeadsResponse>
parseLeadsFromCSV(csvText: string): Promise<ParseLeadsResponse>
parseLeadsSingle(lead: RawLead): Promise<ParseLeadsResponse>
```

---

## Sample Data

Create `sample_leads.csv` at project root with 12 leads:
- 4 HOT candidates: major metro, urban multifamily, large PM companies (NYC, Chicago, SF, LA)
- 4 WARM candidates: mid-size markets, regional PM companies (Atlanta, Denver, Austin, Seattle)
- 2 NURTURE candidates: smaller markets, less ideal fit (Omaha, Boise)
- 2 NOT_QUALIFIED candidates: rural, single-family or small operators (rural Kansas, small-town Ohio)

---

## Acceptance Criteria

- [ ] Upload a `.xlsx` file → leads appear in preview table
- [ ] Upload a `.csv` file → leads appear in preview table
- [ ] Paste CSV text → leads appear in preview table
- [ ] Fill single-lead form → lead appears in preview table
- [ ] Rows with missing required fields show in error banner, rest still load
- [ ] Column name aliases work (`"Address"` maps to `property_address`, etc.)
- [ ] "Enrich Leads →" button is visible (disabled/placeholder until Phase 3)
- [ ] Sample CSV loads cleanly with all 12 leads
