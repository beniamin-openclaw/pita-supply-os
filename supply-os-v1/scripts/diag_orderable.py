"""Diagnostic: replicate the /api/captain/orderable join against the LIVE sheet.

For each supplier, compute how many products are orderable at a given location
(default WOLA) using the EXACT logic of captain_orderable:

    orderable = [sp for sp in supplier_products
                 if sp.supplier_id == <supplier>
                 and sp.product_id in {settings at <location>}]

Prints, per supplier: raw supplier_product count, how many survive the
location-setting join, and (when they differ) the product_ids dropped because
they have no location_product_setting at <location>. Read-only.

Usage (from supply-os-v1/):
    SUPPLY_OS_DATA_BACKEND=sheet PYTHONPATH=. python3 scripts/diag_orderable.py [LOCATION]
"""
import sys

from app import sheets

LOCATION = sys.argv[1] if len(sys.argv) > 1 else "WOLA"


def main() -> int:
    if not sheets.is_configured():
        print("ERROR: sheet backend not configured locally.")
        return 2

    sheets.invalidate_cache()
    suppliers = sheets.load_suppliers()
    sps = sheets.load_supplier_products()
    settings_rows = sheets.load_location_product_settings()

    # Distinct location_ids present in settings (catches a location-code mismatch).
    loc_ids = sorted({s.location_id for s in settings_rows})
    print(f"location_product_settings location_ids: {loc_ids}")
    settings_pids = {s.product_id for s in settings_rows if s.location_id == LOCATION}
    print(f"settings at '{LOCATION}': {len(settings_pids)} products\n")

    # Distinct supplier_ids actually present in supplier_products.
    sp_supplier_ids = sorted({sp.supplier_id for sp in sps})
    supplier_ids = {s.supplier_id for s in suppliers}
    print(f"supplier_products references supplier_ids: {sp_supplier_ids}")
    print(f"suppliers tab supplier_ids:                {sorted(supplier_ids)}\n")

    print(f"{'supplier_id':<18} {'raw_sps':>7} {'orderable':>9}  dropped(no setting)")
    for sup in suppliers:
        mine = [sp for sp in sps if sp.supplier_id == sup.supplier_id]
        orderable = [sp for sp in mine if sp.product_id in settings_pids]
        dropped = sorted({sp.product_id for sp in mine if sp.product_id not in settings_pids})
        flag = "  <-- EMPTY" if mine and not orderable else ""
        drop_str = "" if not dropped else f"  {dropped[:12]}{'…' if len(dropped) > 12 else ''}"
        print(
            f"{sup.supplier_id:<18} {len(mine):>7} {len(orderable):>9}"
            f"{drop_str}{flag}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
