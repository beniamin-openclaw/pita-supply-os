# WOLA — 9 new Blue Service products + thresholds for paper trays (track A)

## Overview

Tushar reported 13 items to add for Wolska at Blue Service and 3 to remove from Pago.
Verification showed the two lists overlap: the 3 "removals" are the same products as
3 of the "additions" — a supplier re-point, not a delete+add. The re-point is blocked
by the data model (`supplier_products` has no location dimension) and moved to the
`supplier-per-location` lane.

This plan delivers the **remaining 10 items**, which are fully independent of that
decision: 9 new catalog products plus a WOLA threshold row for the existing P143. The
change is purely additive — it touches no existing row, changes no schema, and does
not affect Bracka, Norblin or KEN.

## Current State Analysis

**Data model.** Visibility on the order screen is the intersection of two layers:
`supplier_products` (global — who sells it, in what pack, at what price) and
`location_product_settings` (per location — min/max/target). The inventory screen is
`products` ∩ location thresholds, regardless of supplier.

**Prod state (Supabase, checked 2026-08-20):**

| Table | Rows |
|---|---|
| `products` | 145 (last id: P145) |
| `supplier_products` | 145 — 0 products with two suppliers, 0 without |
| `location_product_settings` | 568 — WOLA 141 · BRACKA 144 · NORBLIN 145 · KEN 138 |

**What is missing.** Nine items from the Wolska sheet are not in the catalog at all.
The tenth (`Tacki papierowe 14x25 100 sztuk`) exists as **P143** at Blue Service —
added during the Norblin rollout — but WOLA has no threshold row for it, so it appears
neither in the inventory count nor on the order screen.

**Pre-existing drift.** Seed carries 134 WOLA rows against prod's 141. Missing:
P135–P141 (Bombilla/Bukat, Corfu Lager/Weiss/Free/Filber, AGROS/KAWA/LIPTON/Intermlecz),
added to prod during the feedback-r6 and r7 lanes without a matching seed edit.

## Desired End State

The Wolska captain sees 10 new items on the inventory screen (9 new + paper trays) and
the same 10 on the Blue Service order screen, with thresholds from Tushar's sheet and a
computed suggestion. Bracka, Norblin and KEN see no change. Seed matches prod row for
row for WOLA (141 + 10 = 151).

### Key Discoveries:

- **Prod has zero `order_lines` rows for P143** — reusing the existing product rather
  than creating a new one is reversible at no cost.
- **Seed does not drive prod.** `_choose_backend()` (`supply-os-v1/app/main.py:399`)
  picks Supabase when configured; `seed_loader` is the fallback for tests and dev.
  Consequence: **only the SQL has a production effect**, not the merge to main.
- **Track A changes no code**, so **no deploy is needed** — unlike
  `product-order-note-and-min-flag`, where the SQL had to precede the deploy.
- The convention `target_stock_qty_base = max_stock_qty_base` holds for all 141 WOLA
  rows in prod, without exception.
- The empty-price convention for an unknown price list (Corfu beers, P143–P145, commit
  `23dbb78`): `price_estimate_pln` stays **empty**, never guessed. Order valuation
  simply skips those rows.
- Seed's `supplier_products.csv` has **no `order_note` column** — it exists only in
  Supabase (migration 0006). The model defaults it to `None`, so its absence is fine.
- Inventory tests assert `len(items) > 0`, not exact counts
  (`tests/test_inventory_submit.py:32`). The only hard product count is
  `tests/test_main.py:59,65`.
- The only exact orderable-count test covers **Pago × WOLA = 18**
  (`tests/test_main.py:119`). Track A does not touch Pago, so it stays green.

## What We're NOT Doing

- **Not re-pointing staples, markers or pens** from Pago to Blue Service — that is the
  `supplier-per-location` lane.
- **Not adding an `sp.active` filter** to `_build_orderable_items`. The bug is real
  (the column exists, no code reads it), but fixing it only makes sense together with
  the supplier dimension — documented in lane B.
- **Not adding thresholds for BRACKA, NORBLIN or KEN.** These items are not on their
  sheets. Precedent: P143–P145 got rows only where the sheet listed them.
- **Not changing P143's name, category or unit.** Those fields are global and the
  product is already used by two locations.
- **Not guessing prices.** All new items land with an empty `price_estimate_pln`.
- **Not touching the frontend.** The screens read the catalog from the API; new items
  appear on their own.

## Implementation Approach

Three phases, each independently reversible and droppable without blocking the others:

1. **Catalog** — rows in three seed files plus two test-assertion updates.
2. **Drift closure** — 7 missing WOLA rows in seed (kept separate because it is cleanup
   after another lane, not part of Tushar's request).
3. **Prod** — a prepared, idempotent SQL script plus a post-audit.

Phase order 1→2 is free; phase 3 must be last, because its verification counts rows
added by both earlier phases.

## Critical Implementation Details

**Seed and prod are two independent recordings of the same change.** Prod reads
Supabase; seed serves tests and dev. Merging to main **changes nothing** for the Wolska
captain — only the phase 3 SQL does. This inverts the intuition from most lanes in this
repo and is the easiest mistake to make with this plan.

**Sheet typos are corrected in the catalog.** The sheet has `Szczotlka` and `stolikow`.
The catalog takes the correct `Szczotka` and `stolików` — the name stays recognizable,
and the captain counts from paper rather than comparing character by character.

**Category `Chemia` for all nine, including `Marker podświetlacz`.** A highlighter
"belongs" in `Biurowe`, but Tushar's sheet files it under `Chemia`, and the category
drives grouping on the inventory screen. The screen should match the sheet the captain
counts from — consistency with the sheet beats taxonomic purity.

**Polish diacritics must survive into prod.** Prod stores proper Polish
(e.g. `Płyn Tytan 5L`). An ASCII-stripped INSERT would show the captain mangled names.

## Phase 1: Catalog — 9 new products + Blue Service + WOLA thresholds

### Overview

Adds nine products to the catalog, links them to Blue Service, and gives them Wolska's
thresholds from the sheet. Also adds the missing WOLA threshold row for the existing P143.

### Changes Required:

#### 1. Product catalog

**File**: `docs/pita-supply-os-v1/seed/products.csv`

**Intent**: Nine new items from the Wolska sheet that are absent from the catalog.
Numbering continues from the last free id.

**Contract**: Nine rows P146–P154, columns
`product_id,gostock_id,product_name_pl,product_category,inventory_unit,is_critical,active,notes`.
`gostock_id` empty (these are not GoStock items), `product_category` = `Chemia`,
`inventory_unit` = `szt`, `is_critical` = `FALSE`, `active` = `TRUE`.

| id | name |
|---|---|
| P146 | Aroma Patyczki zapachowe |
| P147 | Attis odświeżacz powietrza 300 ml |
| P148 | Szczotka do zamiatania na kiju Vileda |
| P149 | Szufelka ze zmiotką |
| P150 | Marker podświetlacz |
| P151 | Płyn do podłogi 5L |
| P152 | Cleaner w sprayu do stolików drewnianych lakierowanych |
| P153 | Zapas do mopa płaskiego Vileda Ultra Max |
| P154 | Tetra |

#### 2. Supplier link

**File**: `docs/pita-supply-os-v1/seed/supplier_products.csv`

**Intent**: All nine products are bought at Blue Service, by the piece, with no pack
conversion. Price unknown — left empty per convention.

**Contract**: Nine rows `SP_BLUESERV_P146` … `SP_BLUESERV_P154`,
`supplier_id` = `SUP_BLUESERV`, `supplier_product_name` = the name from `products.csv`,
`purchase_unit` = `szt`, `units_per_purchase_unit` = `1`, `rounding_rule` = `full_only`,
`price_estimate_pln` **empty**, `active` = `TRUE`,
`notes` = `cena do uzupelnienia po pierwszej fakturze`.

#### 3. Wolska thresholds

**File**: `docs/pita-supply-os-v1/seed/location_product_settings.csv`

**Intent**: Ten WOLA rows — nine new plus the missing P143 — with min/max transcribed
from the sheet. `target` = `max` per the repo convention.

**Contract**: `setting_id` formatted `WOLA__P1NN`, `location_id` = `WOLA`,
`is_critical_for_location` = `FALSE`, `allow_over_max_due_to_packaging` = `FALSE`,
`notes` = `wolska-blueservice-master-data 2026-08-20: arkusz min/max`.

| product_id | min | max | target | sheet row |
|---|---|---|---|---|
| P143 | 1 | 3 | 3 | Tacki papierowe 14x25 100 sztuk |
| P146 | 1 | 2 | 2 | Aroma Patyczki zapachowe |
| P147 | 1 | 3 | 3 | Attis odświeżacz powietrza 300 ml |
| P148 | 1 | 2 | 2 | Szczotlka do zamiatania na kiju Vileda |
| P149 | 1 | 2 | 2 | Szufelka ze zmiotką |
| P150 | 1 | 3 | 3 | Marker podświetlacz |
| P151 | 1 | 2 | 2 | Płyn do podłogi 5L |
| P152 | 1 | 2 | 2 | Cleaner w sprayu do stolikow drewnianych lakierowanych |
| P153 | 1 | 2 | 2 | Zapas do mop płaski vileda Ultra Max |
| P154 | 2 | 5 | 5 | Tetra |

#### 4. Product-count assertions

**File**: `supply-os-v1/tests/test_main.py`

**Intent**: Two tests pin the exact catalog size; nine new items change it. This is a
deliberate expectation update, not a workaround.

**Contract**: `test_products_with_captain_token` (line 59) and
`test_products_with_manager_token` (line 65): `145` → `154`.

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `cd supply-os-v1 && python -m pytest`
- Lint clean: `cd supply-os-v1 && ruff check .`
- All three seed files parse with consistent ids: a `python3 -c` check that every
  `product_id` in P146–P154 has exactly one row in `products.csv`, one in
  `supplier_products.csv` and one WOLA row in `location_product_settings.csv`
- `test_captain_orderable_wola_pago_returns_18_items` still green (proof Pago is untouched)

#### Manual Verification:

- Diff review: no existing row modified — appends only

---

## Phase 2: Close the seed↔prod drift for WOLA

### Overview

Seed is 7 rows lighter than prod for WOLA. This phase closes the gap so seed is again a
faithful mirror — otherwise the drift compounds with every subsequent lane.

### Changes Required:

#### 1. Missing WOLA thresholds

**File**: `docs/pita-supply-os-v1/seed/location_product_settings.csv`

**Intent**: Recreate in seed the seven rows added to prod during feedback-r6/r7.
Values transcribed from prod, not invented.

**Contract**: Seven rows `WOLA__P135` … `WOLA__P141` with min/max/target read from prod:
P135 Bombilla 2/10, P136 Corfu Lager 6/6, P137 Corfu Weiss 6/6, P138 Corfu Free 6/6,
P139 AGROS 0.5/1.5, P140 KAWA 0.5/1.5, P141 LIPTON 0.5/1.5.
`notes` = `domkniecie dryfu seed<->prod 2026-08-20 (feedback-r6/r7)`.

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `cd supply-os-v1 && python -m pytest`
- WOLA row count in seed = 151 (134 + 10 from phase 1 + 7 from phase 2)
- The WOLA `product_id` set in seed is identical to prod's (after the phase 3 SQL)

#### Manual Verification:

- None — this phase touches only a file used by tests and dev

---

## Phase 3: Apply to prod (Supabase)

### Overview

The only phase with a real effect for the captain. Follows the `lessons.md` master-data
rule: a saved BEFORE diff (the rollback path), apply, then a post-audit.

### Changes Required:

#### 1. SQL script

**File**: `context/changes/wolska-blueservice-master-data/prod-sql.sql`

**Intent**: Put into prod exactly the rows from phase 1. Idempotent, so a second run
neither duplicates data nor overwrites a manual operator correction.

**Contract**: A BEFORE snapshot block, then three `INSERT … ON CONFLICT DO NOTHING`
blocks — `products` (P146–P154), `supplier_products` (SP_BLUESERV_P146–P154) and
`location_product_settings` (WOLA__P143 + WOLA__P146–P154). No `ALTER`, no `UPDATE`,
no `DELETE` — appends only. Phase 2 has **no** SQL counterpart: those rows already
exist in prod. Names must carry full Polish diacritics.

#### 2. Post-audit and rollback

**File**: `context/changes/wolska-blueservice-master-data/prod-sql.sql` (trailing commented sections)

**Intent**: Confirm the result with numbers rather than "looks right", and leave a
ready rollback.

**Contract**: A `SELECT` returning `products` = 154, `supplier_products` = 154, WOLA
thresholds = 151, plus four assertions expected to return zero rows: thresholds
violating `min ≤ max = target`; placeholder or off-category names; products not
resolving to exactly one `supplier_product`; rows landing at a location other than
WOLA. Rollback: `DELETE` in FK order restoring the BEFORE snapshot.

### Success Criteria:

#### Automated Verification:

- Audit query returns: `products` = 154, `supplier_products` = 154,
  `location_product_settings` for WOLA = 151, and zero rows from all four assertions
- `GET /api/captain/orderable?supplier_id=SUP_BLUESERV` with a WOLA token returns
  10 more items than before
- Re-running the SQL changes none of the above numbers (idempotence proof)

#### Manual Verification:

- The Wolska captain sees 10 new items on the inventory screen, in the `Chemia` group
- On the Blue Service order screen the items show a computed suggestion and visible math
- Bracka and Norblin: Blue Service item count **unchanged**
- Order valuation shows neither 0 zł nor an error for the empty-price items

**Implementation Note**: After phase 3, pause and wait for operator confirmation that
the captain actually sees the items before closing the lane.

---

## Testing Strategy

### Unit Tests:

- No new tests. The change is data only; the existing suite (438 tests) covers the paths
  this data travels.
- Two product-count assertions need updating (phase 1, change 4).

### Integration Tests:

- `test_captain_orderable_wola_pago_returns_18_items` acts as the regression guard: if
  it goes green on a different number, track A touched Pago and strayed into track B.

### Manual Testing Steps:

1. Sign in with the Wolska captain token, open the inventory screen, find the `Chemia` group.
2. Check that all 10 items are present and the Polish characters render correctly.
3. Enter a stock level below minimum for `Tetra` (min 2) and confirm the suggestion computes.
4. Open the Blue Service order screen and confirm the items show visible suggestion math.
5. Switch to Bracka and Norblin — confirm the item count is unchanged.

## Migration Notes

The change is additive and needs no backfill. Rollback: delete rows P146–P154 from the
three prod tables (`location_product_settings`, then `supplier_products`, then
`products`, in that order because of foreign keys) plus revert the commit. `WOLA__P143`
must also be deleted on rollback. Data-loss risk is zero — prod holds no order history
for any of these items.

**No deploy required** — track A changes neither backend nor frontend code.

## References

- Track B (the 3 blocked office items): `context/changes/supplier-per-location/change.md`
- Precedent for adding off-catalog products: commit `23dbb78` (P143–P145, norblin-rollout)
- Precedent for operator-run prod SQL: `context/changes/product-order-note-and-min-flag/prod-sql.sql`
- Source sheet "Wolska stock" (gid=0), verified 2026-08-20
- `context/foundation/lessons.md` — "Master-data ops: diff before, audit after"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Catalog — 9 new products + Blue Service + WOLA thresholds

#### Automated

- [x] 1.1 Backend tests pass (`python -m pytest`) — 249dc7b
- [x] 1.2 Lint clean (`ruff check .`) — 249dc7b
- [x] 1.3 Id consistency for P146–P154 across the three seed files — 249dc7b
- [x] 1.4 `test_captain_orderable_wola_pago_returns_18_items` still green — 249dc7b

#### Manual

- [ ] 1.5 Diff review — no existing row modified

### Phase 2: Close the seed↔prod drift for WOLA

#### Automated

- [x] 2.1 Backend tests pass — f19b035
- [x] 2.2 WOLA row count in seed = 151 — f19b035
- [x] 2.3 WOLA product_id set matches prod — 3de90be

### Phase 3: Apply to prod (Supabase)

#### Automated

- [x] 3.1 Audit query: products=154, supplier_products=154, WOLA thresholds=151 — 3de90be
- [ ] 3.2 `/api/captain/orderable` for Blue Service returns 10 more items
- [x] 3.3 Re-running the SQL changes no counts (idempotence) — 3de90be

#### Manual

- [ ] 3.4 The Wolska captain sees 10 items in the `Chemia` group
- [ ] 3.5 Suggestion and math compute on the order screen
- [ ] 3.6 Bracka and Norblin unchanged
- [ ] 3.7 Valuation does not error on empty prices
