# Prod snapshot — 2026-08-21 (Phase A0)

Read-only dump of prod Supabase master data, captured before the overnight run so
reconciliation and SQL generation do not depend on live DB access (the permission
classifier blocks intermittently).

Files (JSON arrays, column order documented per file):

- `products.json` — `[product_id, product_name_pl, product_category, inventory_unit, is_critical, active]` (154 rows)
- `suppliers.json` — `[supplier_id, supplier_name, ordering_method, active, email_is_null]` (11 rows)
- `locations.json` — `[location_id, location_name, city, active, settings_count, orders_count]` (7 rows)
- `supplier_products.json` — `[supplier_product_id, supplier_id, product_id, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active]` (154 rows)
- `location_product_settings.json` — `[location_id, product_id, min, max, target, is_critical_for_location, allow_over_max]` (578 rows: WOLA 151 · BRACKA 144 · NORBLIN 145 · KEN 138)

Notes:
- `location_product_settings.source_supplier_id` does NOT exist in prod yet
  (migration 0008 lives in unmerged PR #26); all rows are implicitly unpinned.
- SUP_ALLEGRO exists (inactive, portal, no email) — added 2026-08-20.
- Values transcribed verbatim from `execute_sql` results in this session.
