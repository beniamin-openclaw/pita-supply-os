---
change_id: ken-intermlecz-yogurt-gouda
title: KEN — Intermlecz yogurt and gouda match the invoices
status: implemented
created: 2026-10-01
type: master-data (prod SQL only, no code)
---

# KEN — Intermlecz yogurt and gouda match the invoices

Operator request (2026-10-01): set the gouda to "SER GOUDA - POLMLEK" and update the
yogurt to what KEN actually buys from Intermlecz, for KEN only.

Source: eBiuro mirror (`finance_documents` / `finance_document_lines`), contractor
`"INTER-MLECZ" Sp.z o.o.`:

- `BAKOMA JOGURT TYP GRECKI 370g/12` — szt., 4,53–4,64 zł netto (FS 88654/01/08/2026,
  FS 94420/01/08/2026).
- `SER GOUDA - POLMLEK ok 3kg (4)` — kg, 18,77 zł netto (FS 94420/01/08/2026). The
  earlier invoice had `SER GOUDA - MOŃKI ok. 3kg` at 20,84 zł/kg.

Scope check: `location_product_settings` for P162 and P172 exist only at KEN, and
neither supplier_product has any `order_lines`, so the supplier-level rows below
affect KEN only.

## Before (diff = rollback source)

| supplier_product_id | supplier_product_name | purchase_unit | units_per_purchase_unit | price_estimate_pln | active | notes | order_note |
|---|---|---|---|---|---|---|---|
| SP_INTERMLECZ_P162 | Jogurt naturalny | kg | 1.0000 | 14.70 | false | packaging TBC | null |
| SP_INTERMLECZ_P172 | Ser Gouda | kg | 1.0000 | 25.40 | false | packaging TBC | null |

KEN thresholds before: P162 min 1 / target 2 / max 2 kg; P172 min 0.4 / target 3 / max 3 kg.

## After

- SP_INTERMLECZ_P162: name `BAKOMA JOGURT TYP GRECKI 370g/12`, purchase unit `szt`,
  1 szt = 0.37 kg (inventory unit stays kg, so KEN thresholds stay valid), price 4.53,
  active, order_note `1 szt = słoik 370 g`.
- SP_INTERMLECZ_P172: name `SER GOUDA - POLMLEK`, unit kg (unchanged), price 18.77,
  active, order_note `bryła ok. 3 kg`.

Product names (operator follow-up, same day): `products.product_name_pl` P162
"Jogurt naturalny" → `BAKOMA JOGURT TYP GRECKI 370g` (no "/12", so a Captain counting
stock does not read it as a carton), P172 "Ser Gouda" → `SER GOUDA - POLMLEK`. Both
products have settings and inventory counts at KEN only, and no finance aliases.

KEN yogurt threshold (follow-up, same day): the operator decision recorded in
`context/changes/master-data-followups/change.md` (2026-09-28: "KEN: Bakoma jogurt typ
grecki 370 g (max 2 szt) and Ser Gouda block ~3 kg (max 1)") was applied to P162:
min 1 → 0.37, target 2 → 0.74, max 2 → 0.74 kg (= 1 / 2 / 2 jars). Min had to move
because 1 kg would sit above the new max; 1 jar is a choice made here, not in the
recorded decision. Gouda already matches (max 3 kg = 1 block), unchanged.

## Audit (after)

- Both supplier_products active, orderable at KEN only; order_note 19 / 14 chars (≤ 60).
- min ≤ target ≤ max holds for both KEN rows.
- Suggestion check (engine, full_only): yogurt at stock 0 / 0.37 / 0.74 kg → 2 / 1 / 0
  jars, no over-MAX; gouda at 0 / 0.4 / 1.5 kg → 3 / 3 / 2 kg.

## Rollback

```sql
UPDATE supplier_products SET supplier_product_name = 'Jogurt naturalny', purchase_unit = 'kg',
  units_per_purchase_unit = 1.0, price_estimate_pln = 14.70, active = false,
  notes = 'packaging TBC', order_note = NULL
WHERE supplier_product_id = 'SP_INTERMLECZ_P162';
UPDATE supplier_products SET supplier_product_name = 'Ser Gouda', price_estimate_pln = 25.40,
  active = false, notes = 'packaging TBC', order_note = NULL
WHERE supplier_product_id = 'SP_INTERMLECZ_P172';
UPDATE location_product_settings SET min_stock_qty_base = 1, target_stock_qty_base = 2,
  max_stock_qty_base = 2 WHERE location_id = 'KEN' AND product_id = 'P162';
UPDATE products SET product_name_pl = 'Jogurt naturalny' WHERE product_id = 'P162';
UPDATE products SET product_name_pl = 'Ser Gouda' WHERE product_id = 'P172';
```
