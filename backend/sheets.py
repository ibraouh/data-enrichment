import json
import os
import re

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


def _load_sa_info() -> dict | None:
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not raw:
        return None
    try:
        if raw.strip().startswith("{"):
            return json.loads(raw)
        with open(raw) as f:
            return json.load(f)
    except Exception:
        return None


_SA_INFO: dict | None = _load_sa_info()
SERVICE_ACCOUNT_EMAIL: str = (_SA_INFO or {}).get("client_email", "")
SHEETS_ENABLED: bool = bool(SERVICE_ACCOUNT_EMAIL)


def _get_service():
    if not _SA_INFO:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is not configured.")
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    creds = service_account.Credentials.from_service_account_info(_SA_INFO, scopes=_SCOPES)
    return build("sheets", "v4", credentials=creds)


def parse_sheet_url(url: str) -> str:
    """Extract spreadsheet ID from a Google Sheets URL."""
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
    if not match:
        raise ValueError(f"Could not extract spreadsheet ID from: {url!r}")
    return match.group(1)


def _normalize_col(col: str) -> str:
    col = col.strip().lower()
    col = re.sub(r"[\s\-]+", "_", col)
    col = re.sub(r"[^\w]", "", col)
    return col


def fetch_all_sheet_data(spreadsheet_id: str) -> tuple[list[dict], int]:
    """Return (all_data_row_dicts, total_data_row_count).

    Row 0 of the sheet is treated as the header; data rows start at row 1.
    Columns are normalized the same way utils._normalize_col works.
    """
    service = _get_service()
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range="A1:Z10000")
        .execute()
    )
    values = result.get("values", [])
    if not values:
        return [], 0
    headers = [_normalize_col(h) for h in values[0]]
    data_rows = values[1:]
    row_dicts: list[dict] = []
    for row in data_rows:
        # Pad short rows so every row has all headers
        padded = list(row) + [""] * (len(headers) - len(row))
        row_dicts.append(dict(zip(headers, padded[: len(headers)])))
    return row_dicts, len(data_rows)
