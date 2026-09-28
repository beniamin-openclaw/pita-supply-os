---
change_id: supplier-product-order-minimum
title: Per-supplier product display order and logistic-minimum exclusions
status: implementing
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

Lane 3 of the 2026-09-28 plan — operator feedback from Marek (28.09).

(a) Product order per supplier must be identical on every screen and document
("ujednolicić w każdym arkuszu tak samo"). Today there is no display-order
field: the dispatch e-mail sorts by order_line_id (frontend emailBody.ts, backend
gmail_url.py), master data loads ORDER BY supplier_product_id.
Correction (research.md): the Captain order screen does NOT sort by name — it
renders the API order (supplier_product_id); productListFilter.ts "name" is the
Manager inventory view only.

(b) Bukat's logistic minimum (suppliers.minimum_order_value_pln = 500) must NOT
count Tzatzyki, Hot Feta (Tirokafteri) and Feta. Today the minimum chip compares
the whole total_value_estimate_pln (frontend/src/lib/minimumOrder.ts, used by
ManagerQueue, OrderDetailPane, captain OrderDetailPage). It is informational
only, never a gate — keep it that way.

Proposed shape (to validate in plan): migration 0023 (reserved for this lane;
0021 = PR #33, 0022 applied) adding supplier_products.display_order (integer,
nullable) and supplier_products.counts_toward_minimum (boolean NOT NULL DEFAULT
true). All product lists sort by display_order then name; the minimum check uses
a basis total that excludes counts_toward_minimum=false lines (server-side for
the queue, which carries no lines).

Data (prod-sql.sql, SELECT-diff before + audit after, run only with explicit
operator approval, after the migration is applied): SUP_BUKAT display order
P006, P016, P004, P002, P005, P003, P008, P007, P009, P010, P018, P011, P012,
P014; counts_toward_minimum=false for SP_BUKAT_P011, SP_BUKAT_P012,
SP_BUKAT_P014. Refer to ids, not names (names/units of those three change in a
parallel session).

Order of operations after approval: migration 0023 on prod → merge → confirm
live → data SQL.

Coordinator update (2026-09-28): PR #33 merged (0021 applied, SUP_PAGO
ordering_method = 'transport') — rebase on main before implementing. Migration
numbers: 0023 this lane, 0024 zero-quantity, 0025 delivery calendar, 0026 order
e-mail v2. Tonight's coordinator data batch renames P011/P012/P014/P007 and moves
P011/P012/P014 to `pojemnik` with units_per_purchase_unit = 1 — prod-sql.sql here
touches only display_order / counts_toward_minimum. Later: Magazyn Mory products
join the Pago list, so the order mechanism must stay supplier-generic (it is).

Operator decisions (2026-09-28, via coordinator): (1) tie-break by
supplier_product_id; (2) manager-added products land at their position; (3) inventory
screen reordering CUT — follow-up after the new locations start on 1.10 (supplier
blocks per category in the Captain count grid + "Kolejność zamawiania" sort in the
Manager inventory view, see plan-review F7 / research); (4) NEW: hide SUP_INTERNAL
from ordering pickers + 400 on Captain submit, supplier stays active in data;
(5) chip turning "below" on most Bukat orders is expected. Migration 0023 written, not
applied from this lane; this lane merges first on Tuesday, then 0024.

## Follow-ups

- Inventory screens in supplier-block order (Captain count grid, Manager inventory
  default sort) — after 1.10.
- Pago list display order once Magazyn Mory products join the Pago run (needs a
  cross-supplier key for the combined document).
