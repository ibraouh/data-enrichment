import re
import pandas as pd
from io import BytesIO, StringIO
from pydantic import ValidationError

from models import RawLead

COLUMN_ALIASES: dict[str, str] = {
    "address": "property_address",
    "property address": "property_address",
    "street": "property_address",
    "street_address": "property_address",
    "full_name": "name",
    "contact": "name",
    "contact_name": "name",
    "first_name": None,  # handled specially with last_name below
    "org": "company",
    "organization": "company",
    "employer": "company",
    "province": "state",
    "region": "state",
    "st": "state",
}


def _normalize_col(col: str) -> str:
    col = col.strip().lower()
    col = re.sub(r"[\s\-]+", "_", col)
    col = re.sub(r"[^\w]", "", col)
    return col


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [_normalize_col(c) for c in df.columns]

    # Merge first_name + last_name → name if present and name is absent
    if "name" not in df.columns and "first_name" in df.columns:
        last = df.get("last_name", pd.Series([""] * len(df)))
        df["name"] = (df["first_name"].fillna("") + " " + last.fillna("")).str.strip()
        df.drop(columns=["first_name", "last_name"], errors="ignore", inplace=True)

    # Apply simple aliases
    rename_map = {k: v for k, v in COLUMN_ALIASES.items() if v and k in df.columns and v not in df.columns}
    df.rename(columns=rename_map, inplace=True)

    return df


def parse_dataframe(df: pd.DataFrame) -> tuple[list[RawLead], list[str]]:
    df = normalize_columns(df)
    # Replace NaN with None so Pydantic gets None instead of float('nan')
    df = df.where(pd.notna(df), None)

    leads: list[RawLead] = []
    errors: list[str] = []

    for i, row in enumerate(df.to_dict(orient="records"), start=2):  # row 1 = header
        # Only pass keys that RawLead knows about
        known_fields = RawLead.model_fields.keys()
        filtered = {k: v for k, v in row.items() if k in known_fields}
        try:
            leads.append(RawLead(**filtered))
        except ValidationError as exc:
            missing = [e["loc"][0] for e in exc.errors()]
            errors.append(f"Row {i}: missing or invalid fields — {', '.join(str(m) for m in missing)}")

    return leads, errors


def parse_csv_bytes(content: bytes) -> tuple[list[RawLead], list[str]]:
    df = pd.read_csv(BytesIO(content))
    return parse_dataframe(df)


def parse_excel_bytes(content: bytes) -> tuple[list[RawLead], list[str]]:
    df = pd.read_excel(BytesIO(content))
    return parse_dataframe(df)


def parse_csv_text(text: str) -> tuple[list[RawLead], list[str]]:
    df = pd.read_csv(StringIO(text))
    return parse_dataframe(df)
