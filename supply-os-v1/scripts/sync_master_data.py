"""Append-only sync: seed CSVs → live Google Sheet (master data).

For each master-data tab, find rows present in the seed CSV but MISSING from the
live Sheet (matched by primary key) and append them. It NEVER updates or deletes
an existing row — purely additive, safe to re-run. Orders / order_lines /
inventory tabs are out of scope (this only touches master data).

Usage (run from supply-os-v1/):
    SUPPLY_OS_DATA_BACKEND=sheet python scripts/sync_master_data.py           # dry-run
    SUPPLY_OS_DATA_BACKEND=sheet python scripts/sync_master_data.py --apply   # write
"""
import sys

from app import seed_loader, sheets
from app.config import settings

# (tab name, seed loader, sheet loader, primary-key field)
TABLES = [
    ("suppliers", seed_loader.load_suppliers, sheets.load_suppliers, "supplier_id"),
    ("products", seed_loader.load_products, sheets.load_products, "product_id"),
    (
        "supplier_products",
        seed_loader.load_supplier_products,
        sheets.load_supplier_products,
        "supplier_product_id",
    ),
    (
        "location_product_settings",
        seed_loader.load_location_product_settings,
        sheets.load_location_product_settings,
        "setting_id",
    ),
]


def main(apply: bool) -> int:
    if not sheets.is_configured():
        print(
            "ERROR: Google Sheets not configured locally — no sheet_id or "
            "service-account creds in .env.\n"
            "       Set SUPPLY_OS_GOOGLE_SHEET_ID and "
            "SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON[_FILE]."
        )
        return 2

    print(f"Sheet: {settings.google_sheet_id}")
    print(f"Mode:  {'APPLY (writing)' if apply else 'DRY-RUN (no writes)'}\n")

    total_missing = 0
    for tab, load_seed, load_sheet, pk in TABLES:
        seed_rows = load_seed()
        sheets.invalidate_cache(tab)
        sheet_rows = load_sheet()
        sheet_keys = {getattr(r, pk) for r in sheet_rows}
        missing = [r for r in seed_rows if getattr(r, pk) not in sheet_keys]
        total_missing += len(missing)
        print(f"[{tab}] seed={len(seed_rows)} sheet={len(sheet_rows)} missing={len(missing)}")
        for r in missing:
            print(f"    + {getattr(r, pk)}")
        if missing and apply:
            ws = sheets._open_worksheet(tab)
            column_order = sheets._get_column_order(ws)
            rows = [sheets._model_to_row(r, column_order) for r in missing]
            ws.append_rows(rows, value_input_option="USER_ENTERED")
            sheets.invalidate_cache(tab)
            print(f"    => appended {len(rows)} rows to '{tab}'")

    print(f"\nTotal missing: {total_missing}")
    if total_missing and not apply:
        print("Re-run with --apply to write these rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main("--apply" in sys.argv))
