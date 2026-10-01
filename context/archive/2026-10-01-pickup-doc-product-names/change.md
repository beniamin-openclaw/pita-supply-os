---
change_id: pickup-doc-product-names
title: Pickup document lists product names instead of placeholder catalog codes
status: archived
created: 2026-10-01
updated: 2026-10-01
archived_at: 2026-10-01T11:45:25Z
---

## Notes

Operator feedback 2026-10-01 (on the Transport PDF "PITA BROS — ZLECENIE ODBIORU WŁASNEGO",
batch TRN-20261001-PAGO-b80aa2): the product table showed "Nr katalogowy" (PAGO-001, PAGO-005)
instead of product names — meaningless to the driver and the warehouse. The driver list was
correct (names, positive quantities only).

Cause: `buildPagoPdfDocDefinition` (frontend/src/pages/manager/lib/transportPdf.ts) rendered only
`catalogNo` (= `supplier_sku`, falling back to the name). On prod every warehouse_pickup Pago row
carries a placeholder `supplier_sku` (PAGO-001…PAGO-006, read-only check 2026-10-01), not Pago's
real catalog codes.

Fix (frontend only, no backend/DB change): the product column is now "Produkt" with the
supplier-facing name (`supplier_product_name`, fallback `product_name_pl`); `catalogNo` and the
`pagoDoc.catalogCol` string are removed. Filters unchanged: positive quantities only, and for Pago
only `warehouse_pickup` rows. The same builder produces the generic supplier order PDF for other
suppliers, which therefore also switches from catalog code to name. `supplier_sku` stays in master
data and the API, unused by documents; reintroduce a code column only if real supplier codes land.

Verify: frontend vitest 585/585, lint, build. Manual (operator, prod after deploy): download the
pickup PDF of a draft Pago transport — the table reads Lp. | Produkt | Jm. | Ilość with names.

Operator confirmed on prod 2026-10-01: the pickup PDF shows product names. Shipped via PR #47 (f8f28b2). Light change: no plan.md, no impl-review.
