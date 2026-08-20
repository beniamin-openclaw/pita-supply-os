---
change_id: wolska-blueservice-master-data
title: WOLA — 9 new Blue Service products + thresholds for paper trays (track A)
status: implemented
created: 2026-08-20
updated: 2026-08-20
archived_at: null
---

## Notes

Tushar's request (2026-08-20) about the Wolska catalog. Source sheet "Wolska stock":
https://docs.google.com/spreadsheets/d/1-PWvSF_CxKwPo7ofd9ClY3IA8bkHf9i4IxkulkeCci8/edit?gid=0#gid=0

**Sheet verification: Tushar DID fill it in.** All 13 items are present in the
`Chemia` section, each with min/max. He did not remove the three items from the
`Biurowe` section — but that is correct: the product stays in the location's
inventory count, only the supplier changes.

### Track split (operator decision, 2026-08-20)

The request turned out to be two different things:

- **Track A (this lane)** — 10 of the 13 items, fully independent of the data model:
  9 new products plus a WOLA threshold row for the existing P143. Purely additive,
  no schema change, no risk to Bracka or Norblin.
- **Track B** — [[supplier-per-location]]. The remaining 3 office items (staples,
  markers, pen) are blocked because they *are* the architectural problem:
  `supplier_products` has no location dimension.

Rationale for the split: Tushar gets 10 of 13 immediately, and the architectural
decision is not made under time pressure.

### Research findings

- The 3 items "to remove from Pago" are the **same products** as 3 items on the Blue
  Service list (`Markery`→`Marker czarny Pentel`, `Zszywki do zszywacza`→`Zszywki
  24/6`, `Długopisy`→`Długopis`). That is a supplier re-point, not a delete+add. → track B
- `Tacki papierowe 14x25` is the existing **P143** (Blue Service, added during the
  Norblin rollout). WOLA simply had no threshold row for it.
- Prod carries **zero `order_lines` rows** for SP_PAGO_P127/P132/P133 and for P143 —
  neither operation puts history at risk.
- Blue Service has a real email in prod (`m.filipiuk@blueservice.com.pl`), so
  dispatch works.
- **Seed↔prod drift:** seed had 134 WOLA rows against prod's 141 — P135–P141
  (Bombilla, Corfu ×3, AGROS, KAWA, LIPTON) from the r6/r7 lanes. Pre-existing;
  closed in phase 2 of this plan because it lives in the same file.

### Execution log (2026-08-20)

Applied to prod Supabase: products 145→154, supplier_products 145→154,
location_product_settings 568→578 (WOLA 141→151), WOLA × Blue Service items 40→50.
Bracka 144 / Norblin 145 / KEN 138 unchanged. Post-audit assertions all zero.
Idempotence proven with deliberately-wrong probe INSERTs. See `prod-sql.sql` for the
BEFORE snapshot and the rollback path.

**No deploy involved** — track A changes no backend or frontend code; prod reads
Supabase, so the SQL alone made it live.

### Open follow-ups for Tushar

1. Confirm `Tacki papierowe 14x25 100 sztuk` on the Wolska sheet is the same product
   as P143 used by Bracka and Norblin. If it is a different size, splitting it into
   its own product costs nothing (no order history).
2. P143 carries unit `opak` and category `Opakowania`; the Wolska sheet says `szt`
   and `Chemia`. Global fields left untouched, so the captain finds it in a different
   group than on paper.
3. Prices for all 9 new items are unknown — order valuation skips them until the
   first invoice.
