# Plan: product-order-note-and-min-flag

Light data + render slice (mirrors F-02 / email-delivery style — no `/10x-plan`
ceremony needed). Round-1 demo backlog #7 residual.

## What

1. `supplier_products.order_note` — optional ≤60-char annotation, shown on the
   Captain product card. DB-enforced cap (`varchar(60)`), NOT model `max_length`
   (read-only master data; an over-long hand edit must not 500 the read).
2. Below-minimum badge on the card when `current_stock < min_stock_qty_base`
   (informational only — min stays out of the suggestion and gates nothing).
3. Tzatziki Wola `min 9 → 18` kg (6 szt = 1 karton) to exercise the badge.
4. Wire migrations 0005 + 0006 into the integration `_schema` fixture (0005 was a
   latent #314 gap).

## What we're NOT doing

- No engine/rounding change ("co 6" is annotation-only; buckets stay whole units).
- Min does NOT gate submit or feed `compute_suggestion`.
- No edit-screen wiring of `order_note` (only the fresh orderable carries it).

## Progress

### Phase 1: Backend field + schema

#### Automated
- [x] `SupplierProduct.order_note` model field (no max_length — DB-enforced)
- [x] `_build_orderable_item` emits `order_note`
- [x] `_SUPPLIER_PRODUCT_COLUMNS` += `order_note`
- [x] migration `0006_add_supplier_product_order_note.sql` (varchar(60), IF NOT EXISTS)
- [x] integration `_schema` fixture applies 0005 + 0006
- [x] `test_orderable_order_note.py` (2 pure tests) — pytest 406 passed
- [x] ruff clean

### Phase 2: Frontend render + seed

#### Automated
- [x] `OrderableItem.order_note?` type
- [x] ProductCard: `belowMin` signal + annotation/badge render
- [x] i18n `card.belowMin` (PL/EN)
- [x] seed `location_product_settings.csv` P011 Wola min 9→18
- [x] frontend build + lint + vitest (83) green

#### Manual
- [ ] owner: run `prod-sql.sql` in Supabase BEFORE deploy (ALTER add column first)
- [ ] owner live-verify: Tzatziki card shows "1 karton = 6 szt (18 kg)"; stock <18 → "Poniżej minimum: 18 kg"
