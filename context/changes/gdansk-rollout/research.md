---
date: 2026-10-16T10:49:07+02:00
researcher: Claude (Opus 5.5)
git_commit: 7b03cf9049243293c95f7297761eff143b6c5828
branch: worktree-bridge-cse_019No8f7ehaWxUUrGe4iM4SM
repository: pita-supply-os
topic: "What does it take to roll out Gdańsk Słony Spichlerz (SLONY) from Marek's Gdańsk min/max tab, Katowice-style?"
tags: [research, rollout, own-catalog, supplier-catalog, prod-sql, slony, gdansk]
status: complete
last_updated: 2026-10-16
last_updated_by: Claude (Opus 5.5)
---

# Research: Gdańsk Słony Spichlerz (SLONY) rollout

**Date**: 2026-10-16T10:49:07+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 7b03cf9
**Branch**: worktree-bridge-cse_019No8f7ehaWxUUrGe4iM4SM
**Repository**: pita-supply-os

## Research Question

Roll out Gdańsk Słony Spichlerz in Supply OS from the "Gdańsk" tab of Marek's sheet "Miasta poza
Warszawą" (Drive `1i-sXUd5zQUyA4YASKkb9SBl61r3sV5M5fazagnsJnpg`), the way Katowice SUPERSAM was
rolled out (`context/changes/krakow-katowice-rollout/`), and give the captain access with the code
`<kod demo SLONY>`. What exists in prod, does code need to change, how does the sheet map to the catalog,
and which SQL pattern applies?

Inputs saved in this folder: `inputs/gdansk-sheet-dump.txt` (full tab, 160 lines, row numbers kept),
`inputs/gdansk-min-max.csv` (153 product rows, per supplier).

## Summary

- **No code change is needed.** Own-catalog locations, city suppliers, backup rows and the
  "already ordered" hint shipped with migration 0029 (live in prod since 2026-10-09). The rollout is
  data only plus one captain token.
- **SLONY already exists in prod** (`locations.location_id = 'SLONY'`, "Pita Bros Słony Spichlerz"),
  inactive, `own_catalog=false`, no address/company/phone, `sender_email = slony@pitabros.pl`, with
  115 untouched template settings rows (all 0/0/0, copy of KAMIENICA from 2026-08-22). There is no
  SLONY activity anywhere (orders, counts, receipts, transport, delivery rules: 0).
- **Katowice SUPERSAM is the precedent** and is live in prod: 5 city suppliers (`SUP_*_KAT`,
  `SUP_WARSZAWA_KAT`, `SUP_COCACOLA_KAT`), 109 scoped catalog rows, 107 settings rows. Its SQL
  (A/B/B2/C + rollback) is the template, with guards rescoped to SLONY.
- **Every product the sheet needs exists and is active** in prod (verified 2026-10-16, incl. glass
  Coca-Cola P186/P187, glass Cappy P190/P191, Cif P169). About 20 sheet items have no catalog product
  and are held, as Katowice did (no new products).
- **Template leftovers must be deleted** (they appear on the captain's inventory list). DELETE needs
  the operator at the screen (lessons.md, last entry), so it is a separate step.
- **Captain access** = `SLONY:<kod demo SLONY>` appended to Railway `SUPPLY_OS_CAPTAIN_TOKENS`. This host
  has no Railway CLI or credentials, so the operator sets it. `<kod demo SLONY>` is technically valid but
  guessable (checklist §4 asks for random hex).

## Detailed Findings

### Prod state (read-only SELECTs, 2026-10-16)

- `locations` SLONY: `city='Gdańsk'`, everything else NULL, `notes='added 2026-08-22
  (multi-location-master-data); address/city/company gap for the operator'`.
- SLONY settings: 115 rows, `setting_id = 'SLONY__<pid>'`, all min=max=target=0, flags false,
  `inventory_order` NULL. Same 115 products and notes as KAMIENICA. Includes inactive P037 and the
  P176/P177 gyros placeholders.
- SUPERSAM ended at 107 settings (62 with thresholds, target = max on every row; 45 at 0/0/0; 12 of
  them count-only own production / dairy), after step C deleted 12 template leftovers (P017, P037,
  P039, P056, P099, P103, P109, P111, P112, P113, P114, P130). For SLONY the leftover set differs
  because Gdańsk uses P099/P103/P111/P112 and drops the cans/PET (see plan D11).
- Constraints: `location_product_settings` UNIQUE (location_id, product_id); `supplier_products`
  CHECK `backup_scoped`, `case_pair`, `units_per_case > 1`, `rounding_rule IN (...)`; FKs to
  suppliers/products/locations. **Nothing enforces one primary per (location, product)** — audit by
  SELECT. `suppliers.ordering_method IN ('email','portal','phone','manual','transport')`. No triggers.
- Migration `0029_location_supplier_catalog` applied 2026-10-09.
- No delivery rules exist for any city supplier or for FORUM/SUPERSAM (calendar falls back to
  `suppliers.delivery_days`).
- Pending, unapplied `context/changes/inventory-card-order/prod-sql.sql` has SLONY card-order VALUES
  (incl. P170 which SLONY lacks). Out of scope; it will be stale after this rollout.

### Code paths (no change needed)

- Captain auth: `supply-os-v1/app/auth.py:39-49` parses `LOC:token` pairs split on `,`, first `:`;
  no charset/length rule, but `secrets.compare_digest` needs ASCII (`auth.py:78`). LOCATION is
  case-sensitive and not checked against `locations`. Same token for two locations → first wins.
  Frontend sends only the bare token (`frontend/src/auth.ts:55-77`, `AuthGate.tsx:41`).
- `locations.active` gates nothing except the Finance page; `own_catalog` is read only in
  `supply-os-v1/app/supplier_catalog.py:40`. If SLONY had settings and `own_catalog=false` when the
  token goes live, the captain would see the whole Warsaw catalog.
- Own-catalog scope: `supplier_catalog.py:44-62` keeps only rows with `location_id='SLONY'`; a city
  supplier must have no shared rows. Backups: `main.py:264` (alerts = supplier flag AND NOT backup),
  card grey without reasons (`frontend/src/pages/captain-mp/lib/compute.ts:155-162`).
- Hard data constraint: at most one active row per (location, supplier, product) —
  `_build_orderable_items` does not dedupe and the card state is keyed by product_id
  (`main.py:336-341`, `CaptainMP.tsx:308-309`).
- Inventory list = every settings row of the location with an active product
  (`main.py:3232-3299`); no supplier row needed (count-only). Order tab needs a scoped active row +
  settings + active product (`main.py:336-345`); suppliers without items get no tab
  (`main.py:515-541`). 0/0/0 → suggestion 0, no forced reason (over-MAX check needs max > 0,
  `main.py:882-915`).
- Dispatch for `manual`/`portal` suppliers never sends email (`main.py:2576-2689`,
  `frontend/src/pages/manager/DispatchPanel.tsx:223-235`). Reusing a shared Warsaw supplier record
  for SLONY rows would route to the Warsaw contact — city copies avoid that.
- No hardcoded location IDs/cities in app code (only comments). Coca-Cola crates prompt is keyed to
  `SUP_COCACOLA` only (`frontend/src/pages/captain-mp/lib/supplierPrompts.ts:18-20`).
- Seed CSVs have no FORUM/SUPERSAM; Katowice did not export to seed. Adding SLONY seed rows would
  break count tests (`supply-os-v1/tests/test_main.py:59,65,81,92`,
  `tests/test_delivery_rules_seed.py:43-44`).

### Sheet → catalog mapping (summary; full table to be fixed in the plan)

Sections and outcome (based on the mapping sub-agent, prod-verified for products and source rows):

| Section | Rows | Proposed |
|---|---|---|
| Kuchnie Świata | 8 | 7 primary, 1 held (Papryka Red Sweet — no product) |
| Selgros (horeca.gdansk@selgros.pl) | 69 | 34 with thresholds → primary; 35 without: backups where another Gdańsk supplier is primary, held where no product / pack differs, 1 duplicate (fries "op") |
| Coca-Cola (cchbcshop) | 8 | 8 primary: glass 0,25 Coca-Cola/Zero (P186/P187), Cappy glass (P190/P191), Sprite/Fanta (P067/P066, no glass product), Kropla (P070/P071) |
| Pago + Magazyn + Lemoniady | 18 | 18 primary; new vs Katowice: tzatziki/tirokafteri/feta (P011/P012/P014, Warsaw source Bukat) |
| BlueService | 50 | 38 with thresholds; 12 at 0/0 (10 map to a product, 2 have none) |

Duplicates inside the sheet: fries & sweet-potato fries (Kuchnie vs Selgros), halloumi (Kuchnie row 5
vs Selgros row 81), Domestos/Ludwik (Selgros vs BlueService, both 1/3), gloves/foils/bags/towels/
scourers/cloths/staples/marker/fries bag (Selgros grey vs BlueService). Katowice rule: primary carries
thresholds; grey Selgros rows become backups when another supplier is primary, else primary 0/0/0;
ambiguous → held (`krakow-katowice-rollout/rollout-notes.md` decisions 3, 6, 7).

Unit conversions (sheet unit → inventory unit), Katowice precedent where it exists: falafel karton ×5,
oliwki bidon ×2, fasolka ×2,5, gyros szt ×15, souvlaki karton ×5, pita karton ×12, drinks crate ×24,
lemonades karton ×12, rolls opak ×6/×10, gąbki opak ×10, przyprawa pojemnik 2 kg ×2.

### Katowice SQL pattern (to clone)

- Each step: STEP 0 read-only diff (output saved as "diff przed"), STEP 1 one `DO $$` block (single
  transaction, `RAISE EXCEPTION` rolls back), STEP 2 read-only audits with expected results.
- IDs: supplier `SUP_<BRAND>_<CITY3>`; catalog `SP_<supplier without SUP_>_<pid>`; settings
  `<LOC>__<pid>`. City suppliers: `manual`, email NULL, minimum NULL, alerts on, coverage off;
  Coca-Cola `portal`; "Pago + Magazyn + Lemoniady" `manual`, minimum 0.
- Settings: sheet value converted to inventory unit, target = max; updates append
  `[<date> arkusz …, przed a/b/c; …]` to notes (the rollback record); new rows note `(nowy wiersz)`.
- Catalog rows copy pack fields from the nearest active Warsaw (or Katowice) row
  (`prod-sql-B2-katowice-warsaw-cola.sql:146-164` does it as `INSERT … SELECT` from a mapping table).
- Invariants checked in-transaction and audited (`prod-sql-B-suppliers-catalog.sql:321-358`): every
  backup has an active primary; every scoped row has settings; no scoped row on an inactive product;
  scoped rows only at own-catalog locations; no two primaries per (location, product); no duplicate
  active (location, supplier, product); shared catalog unchanged (count + md5).
- Rollback: R-0 kill switch (deactivate city suppliers and scoped rows), then data rollback from the
  notes stamps and a literal backup of deleted rows.
- Constraint that no longer applies: "B only after the code deploy" (code and 0029 are live).
  Guards that must be rescoped: anything `WHERE location_id IS NOT NULL` → `= 'SLONY'`.

### Company / location data

- Company: Pita Bros Gdańsk sp. z o.o., NIP 5223329662, registered office ul. Władysława
  Laskonogiego 9, 02-496 Warszawa (Erste bank framework agreement on Drive, `13_Pita_Bros_Gdansk_
  Umowa_ramowa.pdf`; same address as the other group companies in prod).
- Location: Słony Spichlerz, Chmielna 10, 80-748 Gdańsk; phone 692 105 365
  (`docs/pita-supply-os-v1/COMPANY_ENTITIES.md:33`). Location e-mail unknown.

## Code References

- `supply-os-v1/app/auth.py:39-49,77-79` — captain token parsing and matching
- `supply-os-v1/app/supplier_catalog.py:36-114` — own-catalog scope, suppliers per product
- `supply-os-v1/app/main.py:264,336-345,515-541,882-915,3232-3299` — alerts/backup, orderable items,
  captain tabs, threshold checks, inventory list
- `supply-os-v1/app/main.py:2525-2702` — dispatch (no email for manual/portal)
- `supply-os-v1/migrations/0029_location_supplier_catalog.sql` — own_catalog, location_id, is_backup
- `context/changes/krakow-katowice-rollout/prod-sql-*.sql`, `rollback.sql` — SQL template

## Architecture Insights

A new city location is pure master data: one `locations` row, settings rows, city supplier records,
and scoped `supplier_products` rows. Everything that prevents a city leaking into Warsaw is the
`location_id` scope plus `own_catalog`; everything that keeps the captain screen sane is the set of
invariants audited by SQL (no DB constraint enforces them).

## Historical Context (from prior changes)

- `context/changes/krakow-katowice-rollout/` — Katowice/Kraków own-catalog rollout (model, SQL,
  decisions 1–9, held items). The repo never recorded the apply, but prod shows it applied.
- `context/archive/2026-09-29-elektrownia-westfield-rollout/` — glass Coca-Cola pattern, unit
  conversions (gyros ×15, pita ×12).
- `context/archive/2026-10-01-feedback-1001-names-units/` — invoice names, Cif P169, roll sizes.
- `docs/pita-supply-os-v1/NEW_LOCATION_CHECKLIST.md` — rollout checklist.

## Related Research

- `context/changes/krakow-katowice-rollout/research.md`

## Open Questions

For Marek / operator (do not block go-live; thresholds and contacts are editable later):
1. Contacts, minimums, order days and cutoffs for every Gdańsk supplier.
2. Is "BlueService" in Gdańsk the Warsaw Blue Service or a local wholesaler?
3. Pack sizes: rolls 80/20 "10 szt" vs Mory pack of 6; przyprawa "pojemnik 2 kg"; zmywak "DUŻE
   opakowanie"; oregano/papryka/pieprz "duże" weight; saszetki 2 g vs 5 g.
4. Held items needing a new product (coffee, milk, lighter, Feta 200 g, Papryka Red Sweet, etc.).
5. Location e-mail for DW, and whether slony@pitabros.pl is a verified send-as alias (only matters
   once a supplier switches to e-mail).
