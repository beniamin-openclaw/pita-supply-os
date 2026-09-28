---
change_id: inventory-card-order
title: Inventory screens in each location's printed card order; Pago and Mory list order
status: impl_reviewed
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

Inventory screens (Captain count grid + edit, Manager inventory detail) list products by default in the order of each location's printed inventory cards ("… - DRUK" tabs in the per-location "Inwentaryzacja" Google Sheets); plus Pago and Magazyn Mory supplier_products.display_order from the Ordering PB v5 sheet. Gated prod SQL; merge after the new locations start on 1.10.

Operator decisions (2026-09-28, this session): follow-up 1 of supplier-product-order-minimum. The operator
first accepted "supplier blocks, alphabetical" and then replaced the default with "the order of the
inventory cards in Google Sheets". The Manager view may keep a supplier-order sort as an option. Pago/Mory
order comes from the Ordering PB v5 sheet (option 2A). The combined Pago + Mory transport (2B) is a
separate change: `transport-pago-mory-combined`. Build now; merge only after the new locations start on
1.10; stop before merge, the migration on prod and the prod SQL.

Grounding already gathered (orchestrator, 2026-09-28):
- 12 per-location "Inwentaryzacja" workbooks on Drive (owner biuro@), each with two print tabs
  "Spożywcze & napoje - DRUK" and "Opakowania, chemia - DRUK" in a two-column layout. Sections:
  Chłodnia, Mrożonki, Produkcja | Spożywcze, Wino, Napoje/Soft drinks | Opakowania, Chemia, Biurowe, Gaz.
  Rows: Dostawca | Produkt | Magazyn | Wydawka | Suma | Jedn. miary.
- Cards differ per location (sequence similarity to Wolska 0.84–0.90), but little: a common template
  (products.inventory_order) plus 26 per-location overrides reproduces all 12 (hybrid design, plan Notes).
- Prod: active WOLA, BRACKA, KEN, NORBLIN, BROWARY; inactive with settings ELEKTROWNIA, FORUM,
  KAMIENICA, KULINARNA, SLONY, STARY_BROWAR, SUPERSAM, WESTFIELD.
- SUP_MORY "Magazyn własny Mory" (manual, 18 active products); SUP_PAGO (transport, 6 products). No
  display_order outside Bukat.
- Migration numbers: 0025 = delivery-calendar (PR #42, on main), 0026 = location_sender_and_phone
  (branch claude/loving-feynman-2e6946). This change uses 0027; transport-pago-mory-combined takes
  0028 if it needs one.

## Deploy order (operator-gated; nothing below has run on prod)

1. Apply migration `supply-os-v1/migrations/0027_inventory_order.sql` on prod (additive, two nullable
   columns). Also required before `scripts/backfill_supabase.py` runs against any database.
2. Merge the PR after the new locations start on 1.10.
3. Confirm live: Railway `/health` and the new Vercel bundle for the merge commit.
4. Re-download the 12 inventory workbooks, re-run the pipeline in `data/`
   (extract_card_order → gen_positions → gen_prod_sql), diff `card_order.json`, commit any change.
5. Run `prod-sql.sql`: save step 1 as `prod-sql-diff-before.md`, apply step 2, check step 3.
6. Live check (plan Phase 4 Manual).

`prod-sql-pago-mory.sql` is independent of 1–5 (the column exists since 0023): run it on its own
go, before or after the merge. Both SQL files were dry-run on a local copy of prod master data
(verification/prod-sql-dry-run.md).
