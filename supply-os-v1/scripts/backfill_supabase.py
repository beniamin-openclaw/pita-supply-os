"""Backfill: live Google Sheet → Supabase Postgres (S-10, Phase 5).

Reads every entity from the live Sheet via the ``sheets`` backend and inserts it
into Postgres via the ``supabase_backend`` engine with ``INSERT … ON CONFLICT
(<pk>) DO NOTHING`` — purely additive and idempotent, safe to re-run (an existing
row is never overwritten). Covers all 5 master + 6 transactional entities + _meta
in FK-safe order, preserving every ``order_lines`` audit/learning column verbatim.

Needs BOTH backends configured (this is an ops tool that talks to each directly —
it is NOT a route, so the L2 "never bypass _choose_backend()" rule doesn't apply):
  - Sheets: SUPPLY_OS_GOOGLE_SHEET_ID + service-account creds
  - Postgres: SUPPLY_OS_DATABASE_URL (Session Pooler DSN)
``SUPPLY_OS_DATA_BACKEND`` is irrelevant here.

Usage (run from supply-os-v1/):
    python scripts/backfill_supabase.py            # dry-run (no writes)
    python scripts/backfill_supabase.py --apply    # write missing rows

Run the final apply inside a brief Sheet read-only window so no write lands in
Sheets after the snapshot. Verify with scripts/verify_parity.py afterwards.
"""
import sys

from sqlalchemy import text

from app import sheets, supabase_backend
from app.config import settings

# (table, pk, sheet loader, supabase column map) in FK-safe insert order.
# _meta is handled separately below (it's a key/value dict, not a model list).
TABLES = [
    ("products", "product_id", sheets.load_products, supabase_backend._PRODUCT_COLUMNS),
    ("suppliers", "supplier_id", sheets.load_suppliers, supabase_backend._SUPPLIER_COLUMNS),
    ("locations", "location_id", sheets.load_locations, supabase_backend._LOCATION_COLUMNS),
    ("supplier_products", "supplier_product_id", sheets.load_supplier_products,
     supabase_backend._SUPPLIER_PRODUCT_COLUMNS),
    ("location_product_settings", "setting_id", sheets.load_location_product_settings,
     supabase_backend._LOCATION_PRODUCT_SETTING_COLUMNS),
    ("orders", "order_id", sheets.load_orders, supabase_backend._ORDER_COLUMNS),
    ("order_lines", "order_line_id", sheets.load_order_lines, supabase_backend._ORDER_LINE_COLUMNS),
    ("inventory_counts", "count_id", sheets.load_inventory_counts,
     supabase_backend._INVENTORY_COUNT_COLUMNS),
    ("inventory_count_lines", "count_line_id", sheets.load_inventory_count_lines,
     supabase_backend._INVENTORY_COUNT_LINE_COLUMNS),
    ("receipts", "receipt_id", sheets.load_receipts, supabase_backend._RECEIPT_COLUMNS),
    ("receipt_lines", "receipt_line_id", sheets.load_receipt_lines,
     supabase_backend._RECEIPT_LINE_COLUMNS),
]


def _load_sheet_rows(loader):
    """Read one Sheet tab; a not-yet-created tab (inventory/receipts) = 0 rows."""
    try:
        return loader()
    except sheets.WorksheetNotFound:
        return None  # tab absent — skip, not an error


def _existing_pks(engine, table, pk) -> set:
    with engine.connect() as conn:
        return {row[0] for row in conn.execute(text(f"SELECT {pk} FROM {table}")).all()}


def _backfill_table(engine, table, pk, columns, rows, apply: bool) -> int:
    """Insert rows missing from PG (by pk). ON CONFLICT DO NOTHING keeps re-runs +
    a stale dry-run/apply race idempotent. Returns the count inserted (apply) or
    that WOULD be inserted (dry-run)."""
    existing = _existing_pks(engine, table, pk)
    missing = [r for r in rows if getattr(r, pk) not in existing]
    print(f"[{table}] sheet={len(rows)} pg={len(existing)} to_insert={len(missing)}")
    if not (apply and missing):
        return len(missing)
    cols_sql = ", ".join(columns)
    vals_sql = ", ".join(supabase_backend._bind(c) for c in columns)
    sql = (
        f"INSERT INTO {table} ({cols_sql}) VALUES ({vals_sql}) "
        f"ON CONFLICT ({pk}) DO NOTHING"
    )
    payload = [
        {c: supabase_backend._to_db(m.model_dump().get(c)) for c in columns}
        for m in missing
    ]
    with engine.begin() as conn:
        result = conn.execute(text(sql), payload)
    inserted = result.rowcount if result.rowcount is not None and result.rowcount >= 0 else len(missing)
    print(f"    => inserted {inserted} into '{table}'")
    return inserted


def _backfill_meta(engine, apply: bool) -> int:
    """_meta is a key/value dict, not a model list — handled on its own."""
    try:
        meta = sheets.load_meta()
    except sheets.WorksheetNotFound:
        print("[_meta] tab absent — skipped")
        return 0
    with engine.connect() as conn:
        existing = {row[0] for row in conn.execute(text("SELECT key FROM _meta")).all()}
    missing = {k: v for k, v in meta.items() if k not in existing}
    print(f"[_meta] sheet={len(meta)} pg={len(existing)} to_insert={len(missing)}")
    if not (apply and missing):
        return len(missing)
    payload = [{"key": k, "value": v} for k, v in missing.items()]
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO _meta (key, value) VALUES (:key, :value) "
                 "ON CONFLICT (key) DO NOTHING"),
            payload,
        )
    print(f"    => inserted {len(payload)} into '_meta'")
    return len(payload)


def main(apply: bool) -> int:
    if not sheets.is_configured():
        print("ERROR: Google Sheets not configured — set SUPPLY_OS_GOOGLE_SHEET_ID "
              "and service-account creds.")
        return 2
    if not supabase_backend.is_configured():
        print("ERROR: Supabase not configured — set SUPPLY_OS_DATABASE_URL "
              "(Session Pooler DSN).")
        return 2

    print(f"Sheet:  {settings.google_sheet_id}")
    print(f"Target: Supabase Postgres ({'APPLY (writing)' if apply else 'DRY-RUN (no writes)'})\n")

    engine = supabase_backend._get_engine()
    total = 0
    for table, pk, loader, columns in TABLES:
        rows = _load_sheet_rows(loader)
        if rows is None:
            print(f"[{table}] tab absent in Sheet — skipped")
            continue
        total += _backfill_table(engine, table, pk, columns, rows, apply)
    total += _backfill_meta(engine, apply)

    print(f"\nTotal {'inserted' if apply else 'to insert'}: {total}")
    if total and not apply:
        print("Re-run with --apply to write these rows, then run scripts/verify_parity.py.")
    elif apply:
        print("Backfill applied. Now run scripts/verify_parity.py to confirm parity.")
    return 0


if __name__ == "__main__":
    sys.exit(main("--apply" in sys.argv))
