# Local preview — inventory-card-order

- **Date**: 2026-09-28
- **Backend**: branch `claude/inventory-card-order` on port 8931, `SUPPLY_OS_DATA_BACKEND=supabase`, DSN = local Postgres `supply_os_prodsql_0027`. That database is a read-only dump of prod master data with migration 0027, `prod-sql.sql` and `prod-sql-pago-mory.sql` applied. Nothing was written to prod.
- **Auth**: ON. Captain tokens for NORBLIN and WOLA and a Manager token (local test values, kept in the session scratchpad). Each screen was opened with only its own role's token (lessons.md, "Preview with auth DISABLED…").
- **Frontend**: Vite on port 5177, `VITE_API_URL=http://localhost:8931`.
- **Local supplier names**: the local dump has `supplier_name = supplier_id`, so supplier group labels read `SUP_…` here. Prod has real names.

## API checks (NORBLIN, captain token)

- `GET /api/captain/inventory/products`:
  - 143 rows;
  - the 116 card products appear in exactly the card's order (`card_order.json`);
  - 9 category runs for 9 categories, so every section is contiguous;
  - the 11 off-card "Napoje" products sit at position 1001, directly after the section's last card product (1000).
- A local test count was submitted (72 lines) and corrected once, against the local database only:
  - `POST /api/captain/inventory/submit`;
  - `PATCH /api/captain/inventory/count/{id}`.
- `GET /api/captain/inventory/count/{id}` returns the lines in card order: P001, P003, P005, …
- `GET /api/manager/inventory/count/{id}` (manager token):
  - lines sorted by `inventory_order`;
  - `display_order` and `supplier_product_id` are filled from the primary supplier_product (e.g. P003 → `SP_BUKAT_P003`, display_order 60).

## Screens

- **Captain `/captain-v2/inventory-count`**:
  - sections open in card order;
  - Chłodnia lists Masło MR 500g, Cytryna, Papryka zielona, Awokado, Ogórek, … as on the NORBLIN card, not A→Z;
  - there is no sort control (unchanged).
- **Manager `/manager/inventory` → NORBLIN count**:
  - the sort select defaults to "Karta inwentaryzacji";
  - rows are grouped by category in card order: Chłodnia (Masło, Papryka zielona, Ogórek, …).
- **Manager, "Dostawca" + "Kolejność zamawiania"**:
  - supplier blocks in supplier-name order, each block in display_order;
  - SUP_MORY shows Przyprawa → Boxy PB → Serwetki PB → Rolki 80/20 → Rolki 80/80 → Druciak → Szczotka → Markery, matching `prod-sql-pago-mory.sql`;
  - SUP_PAGO shows Gyros 25 KG → Souvlaki Wieprz → Pita, matching 20/40/50.
- No console errors on either screen.
