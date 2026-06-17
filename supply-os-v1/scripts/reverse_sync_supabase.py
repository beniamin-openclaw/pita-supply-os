"""Reverse-sync: Supabase Postgres → live Google Sheet (S-10, Phase 5 rollback).

The post-write rollback escape hatch. A flip back to ``SUPPLY_OS_DATA_BACKEND=sheet``
is clean ONLY before Postgres has accepted writes; after that, orders / counts /
receipts created post-cutover live only in PG. This script copies those PG-only
TRANSACTIONAL rows back into the Sheet so a flip loses nothing.

Reads via ``supabase_backend`` and appends via the ``sheets`` append path, skipping
rows already present in the Sheet (matched by primary key) — additive + idempotent,
preserving every audit/learning column. Master data is intentionally out of scope
(it doesn't accumulate post-cutover; the Sheet remains its source).

Run only when rolling back AFTER writes exist. Needs BOTH backends configured
(SUPPLY_OS_DATABASE_URL + SUPPLY_OS_GOOGLE_SHEET_ID/creds).

Usage (run from supply-os-v1/):
    python scripts/reverse_sync_supabase.py            # dry-run (no writes)
    python scripts/reverse_sync_supabase.py --apply    # append missing rows to Sheets
"""
import sys

from app import sheets, supabase_backend


def _reverse_parent(name, pg_loader, sheet_loader, pk, appender, apply: bool) -> int:
    """One PG-only parent row (order / inventory_count / receipt) → appended singly."""
    pg_rows = pg_loader()
    try:
        sheet_keys = {getattr(r, pk) for r in sheet_loader()}
    except sheets.WorksheetNotFound:
        print(f"[{name}] Sheet tab absent — skipped (create the tab before reverse-sync)")
        return 0
    missing = [r for r in pg_rows if getattr(r, pk) not in sheet_keys]
    print(f"[{name}] pg={len(pg_rows)} sheet={len(sheet_keys)} to_append={len(missing)}")
    if apply and missing:
        for r in missing:
            appender(r)
        print(f"    => appended {len(missing)} to '{name}'")
    return len(missing)


def _reverse_lines(name, pg_loader, sheet_loader, line_pk, group_key, appender, apply: bool) -> int:
    """PG-only child rows → appended grouped by parent id (the batch appenders
    require all rows in one call to share a single parent id)."""
    pg_rows = pg_loader()
    try:
        sheet_keys = {getattr(r, line_pk) for r in sheet_loader()}
    except sheets.WorksheetNotFound:
        print(f"[{name}] Sheet tab absent — skipped")
        return 0
    missing = [r for r in pg_rows if getattr(r, line_pk) not in sheet_keys]
    print(f"[{name}] pg={len(pg_rows)} sheet={len(sheet_keys)} to_append={len(missing)}")
    if apply and missing:
        groups: dict[str, list] = {}
        for r in missing:
            groups.setdefault(getattr(r, group_key), []).append(r)
        for rows in groups.values():
            appender(rows)
        print(f"    => appended {len(missing)} to '{name}' ({len(groups)} group(s))")
    return len(missing)


def main(apply: bool) -> int:
    if not supabase_backend.is_configured():
        print("ERROR: Supabase not configured — set SUPPLY_OS_DATABASE_URL.")
        return 2
    if not sheets.is_configured():
        print("ERROR: Google Sheets not configured — set SUPPLY_OS_GOOGLE_SHEET_ID + creds.")
        return 2

    print(f"Source: Supabase Postgres  →  Target: Sheet "
          f"({'APPLY (writing)' if apply else 'DRY-RUN (no writes)'})\n")

    total = 0
    total += _reverse_parent(
        "orders", supabase_backend.load_orders, sheets.load_orders,
        "order_id", sheets.append_order, apply,
    )
    total += _reverse_lines(
        "order_lines", supabase_backend.load_order_lines, sheets.load_order_lines,
        "order_line_id", "order_id", sheets.append_order_lines, apply,
    )
    total += _reverse_parent(
        "inventory_counts", supabase_backend.load_inventory_counts, sheets.load_inventory_counts,
        "count_id", sheets.append_inventory_count, apply,
    )
    total += _reverse_lines(
        "inventory_count_lines", supabase_backend.load_inventory_count_lines,
        sheets.load_inventory_count_lines, "count_line_id", "count_id",
        sheets.append_inventory_count_lines, apply,
    )
    total += _reverse_parent(
        "receipts", supabase_backend.load_receipts, sheets.load_receipts,
        "receipt_id", sheets.append_receipt, apply,
    )
    total += _reverse_lines(
        "receipt_lines", supabase_backend.load_receipt_lines, sheets.load_receipt_lines,
        "receipt_line_id", "receipt_id", sheets.append_receipt_lines, apply,
    )

    print(f"\nTotal {'appended' if apply else 'to append'}: {total}")
    if total and not apply:
        print("Re-run with --apply to copy these PG-only rows back into the Sheet.")
    return 0


if __name__ == "__main__":
    sys.exit(main("--apply" in sys.argv))
