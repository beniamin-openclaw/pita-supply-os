---
change_id: product-order-note-and-min-flag
title: Product-card order annotation + below-minimum signal (bucket #7)
status: implementing
created: 2026-06-26
updated: 2026-06-26
archived_at: null
---

## Notes

Round-1 demo backlog #7 residual (DEMO_FEEDBACK.md). Two small additions on the
Captain product card:

- `supplier_products.order_note` — optional, ≤60-char per-line packaging/ordering
  annotation, e.g. Tzatziki "1 karton = 6 szt (18 kg)". Shown on the product card.
- A visual **"below minimum"** badge when current stock < `min_stock_qty_base`.
  Informational only — min is otherwise unused (not in the suggestion, no gate).
- Set Tzatziki **Wola min 9 → 18 kg** (6 szt = 1 karton) to exercise the badge.

**Why min needed a behavior:** `min_stock_qty_base` was DEAD — plumbed to the
card payload but never read (no warning, not in `compute_suggestion`). This gives
it an informational behavior so the owner's "test the min function" is meaningful.

**Cap placement:** the 60-char "few words max" cap is DB-enforced (`varchar(60)`,
migration 0006), NOT a model `max_length`. `supplier_products` is read-only in the
app and hand-edited in Supabase; a model `max_length` would turn a >60-char hand
edit into a read-time 500 on the orderable screen.

**Latent #314 gap fixed:** the integration `_schema` fixture applied 0001–0004 but
not 0005 (orders.ordered_by, which `_ORDER_COLUMNS` references) — wired both 0005
and 0006 in.

**Prod (owner-run — see `prod-sql.sql`):** ALTER add `order_note` + UPDATE the P011
note + UPDATE Wola P011 min. Apply BEFORE deploying the backend.
