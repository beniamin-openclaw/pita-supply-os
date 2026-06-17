"""Parity check: Sheets vs Supabase Postgres (S-10, Phase 5).

Proves the backfill is faithful BEFORE cutover. Two checks:
  1. Per-table row counts match Sheets-vs-PG (all 11 entities + _meta).
  2. The suggestion-review roll-up — the learning signal — is identical under
     both backends: ``_aggregate_suggestion_review(load_order_lines(), products)``
     run against each. This is the load-bearing one: it proves the 5 backfill-
     critical ``order_lines`` columns (suggested / captain_final / manager_final /
     delta / reason_code) survived verbatim.

Floats are compared at a small tolerance (the aggregate rounds to 3–4 dp; a
``numeric`` round-trip must not trip a false mismatch), never raw equality.

Exit 0 = parity holds; exit 1 = a real mismatch; exit 2 = not configured.

Usage (run from supply-os-v1/, both backends configured):
    python scripts/verify_parity.py
"""
import sys

from app import sheets, supabase_backend
from app.main import _aggregate_suggestion_review

# (table, sheet loader, supabase loader)
COUNT_TABLES = [
    ("products", sheets.load_products, supabase_backend.load_products),
    ("suppliers", sheets.load_suppliers, supabase_backend.load_suppliers),
    ("locations", sheets.load_locations, supabase_backend.load_locations),
    ("supplier_products", sheets.load_supplier_products, supabase_backend.load_supplier_products),
    ("location_product_settings", sheets.load_location_product_settings,
     supabase_backend.load_location_product_settings),
    ("orders", sheets.load_orders, supabase_backend.load_orders),
    ("order_lines", sheets.load_order_lines, supabase_backend.load_order_lines),
    ("inventory_counts", sheets.load_inventory_counts, supabase_backend.load_inventory_counts),
    ("inventory_count_lines", sheets.load_inventory_count_lines,
     supabase_backend.load_inventory_count_lines),
    ("receipts", sheets.load_receipts, supabase_backend.load_receipts),
    ("receipt_lines", sheets.load_receipt_lines, supabase_backend.load_receipt_lines),
]

_AVG_FIELDS = (
    "avg_suggested_qty_purchase",
    "avg_captain_final_qty_purchase",
    "avg_manager_final_qty_purchase",
    "avg_abs_deviation_pct",
)


def _close(a: float, b: float, tol: float = 1e-3) -> bool:
    return abs(a - b) <= tol


def _safe_sheet_len(loader) -> int:
    try:
        return len(loader())
    except sheets.WorksheetNotFound:
        return 0  # tab not created in Sheet yet → 0 rows expected on the PG side too


def _compare_counts() -> list[str]:
    problems: list[str] = []
    for table, sheet_loader, pg_loader in COUNT_TABLES:
        s = _safe_sheet_len(sheet_loader)
        p = len(pg_loader())
        flag = "" if s == p else "  <-- MISMATCH"
        print(f"[{table}] sheet={s} pg={p}{flag}")
        if s != p:
            problems.append(f"{table}: row count sheet={s} pg={p}")
    # _meta (key/value dict)
    try:
        s_meta = len(sheets.load_meta())
    except sheets.WorksheetNotFound:
        s_meta = 0
    p_meta = len(supabase_backend.load_meta())
    print(f"[_meta] sheet={s_meta} pg={p_meta}{'' if s_meta == p_meta else '  <-- MISMATCH'}")
    if s_meta != p_meta:
        problems.append(f"_meta: row count sheet={s_meta} pg={p_meta}")
    return problems


def _compare_suggestion_review() -> list[str]:
    """The learning-signal parity: same product-level roll-up under both backends."""
    products_by_id = {p.product_id: p for p in sheets.load_products()}
    try:
        sheet_lines = sheets.load_order_lines()
    except sheets.WorksheetNotFound:
        sheet_lines = []
    pg_lines = supabase_backend.load_order_lines()
    sheet_items = {it.product_id: it for it in _aggregate_suggestion_review(sheet_lines, products_by_id)}
    pg_items = {it.product_id: it for it in _aggregate_suggestion_review(pg_lines, products_by_id)}

    problems: list[str] = []
    for pid in sorted(set(sheet_items) | set(pg_items)):
        s = sheet_items.get(pid)
        p = pg_items.get(pid)
        if s is None or p is None:
            problems.append(f"suggestion-review {pid}: present in {'sheet' if s else 'pg'} only")
            continue
        if s.line_count != p.line_count:
            problems.append(f"suggestion-review {pid}: line_count {s.line_count} vs {p.line_count}")
        if s.order_count != p.order_count:
            problems.append(f"suggestion-review {pid}: order_count {s.order_count} vs {p.order_count}")
        for f in _AVG_FIELDS:
            if not _close(getattr(s, f), getattr(p, f)):
                problems.append(f"suggestion-review {pid}: {f} {getattr(s, f)} vs {getattr(p, f)}")
        if s.reason_code_counts != p.reason_code_counts:
            problems.append(
                f"suggestion-review {pid}: reason_code_counts "
                f"{s.reason_code_counts} vs {p.reason_code_counts}"
            )
    print(f"\nsuggestion-review products: sheet={len(sheet_items)} pg={len(pg_items)}")
    return problems


def main() -> int:
    if not sheets.is_configured():
        print("ERROR: Google Sheets not configured — set SUPPLY_OS_GOOGLE_SHEET_ID + creds.")
        return 2
    if not supabase_backend.is_configured():
        print("ERROR: Supabase not configured — set SUPPLY_OS_DATABASE_URL.")
        return 2

    print("=== Row-count parity (Sheets vs Postgres) ===")
    problems = _compare_counts()
    print("\n=== Suggestion-review parity (learning columns) ===")
    problems += _compare_suggestion_review()

    if problems:
        print(f"\n❌ PARITY FAILED — {len(problems)} mismatch(es):")
        for pr in problems:
            print(f"  - {pr}")
        return 1
    print("\n✅ PARITY OK — counts match and the suggestion-review roll-up is identical.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
