# Inventory card order + Pago/Mory list order — Implementation Plan

## Overview

Inventory screens list a location's products in the order of that location's printed inventory
card, the "… - DRUK" tabs of its "Inwentaryzacja" Google Sheet. The screens are:

- the Captain count grid and its correction screen;
- the Captain count history;
- the Manager inventory detail and its CSV.

The Manager view keeps its other sorts and gains an ordering-order sort. Separately, the Pago and
Magazyn Mory product lists get positions (`supplier_products.display_order`) in the order of the
"Ordering PB v5" sheet.

This is follow-up 1 of `supplier-product-order-minimum`. The operator decided on 2026-09-28 that
the default is the card order, not supplier blocks. The change is built now and merged only after
the new locations start on 1.10.

## Current State Analysis

- `captain_inventory_products` (`supply-os-v1/app/main.py:2796`) returns products in loader
  order. On Supabase that is `location_product_settings ORDER BY setting_id`, i.e. product-id
  order.
- The Captain grid keeps backend order and groups categories first-seen. See
  `InventoryCountPage.tsx:173, 345`, `InventoryCountEditPage.tsx:65, 128`,
  `InventoryCountGrid.tsx:102-120` and `lib/inventoryGrouping.ts:21-37`.
- Count detail lines come back in stored `count_line_id` order. See `_enrich_inventory_count_detail`
  (`main.py:3293`) and `captain_inventory_count_detail` (`main.py:3221`). After a
  correction the ids are `ICL-{count}-E-{hex}` (`main.py:3055`), so a corrected count reads back
  shuffled.
- The Captain history renders `detail.lines` as returned (`InventoryHistoryPage.tsx:118-132`).
- The Manager view sorts by name by default and always re-sorts groups alphabetically
  (`frontend/src/lib/productListFilter.ts:56-63, 143-188`). Its CSV uses `detail.lines` in backend
  order (`pages/manager/lib/inventoryCsv.ts:163`).
- Only Bukat has `display_order`. Pago (6 products) and Mory (18) have none.
- 12 location cards were parsed. Their rows resolve to product ids through a 33-entry alias map
  (`data/card_order.json`, `data/alias.json`); see `research.md`.
- The cards differ per location, but little. A global template of 165 products plus 26
  per-location overrides reproduces every card exactly (`data/positions.json`, proof in
  `data/gen_positions.py.txt`).
- With the template, few active location products stay unpositioned on prod (read-only query,
  2026-09-28): WOLA 14, BRACKA 5, NORBLIN 5, KEN 2, BROWARY 1, others 0. These are products that
  no card lists (P078, P139–P141, P146–P154, P188). The extras rule (below) places them at the
  end of their category section, which is where a Captain would expect an item the card lacks.
- On prod, `setting_id` is `LOC__Pnnn` everywhere, and no key or SQL here depends on it. Every
  write keys on `(location_id, product_id)`.
- The product categories line up with the card sections. For all 12 cards, grouping the card
  sequence first-seen by `product_category` changes no position. The 10 categories match the
  card sections one-to-one (Chłodnia, Mrożonki, Produkcja, Spożywcze, Wino, Napoje, Opakowania,
  Chemia, Biurowe, Gaz).

## Desired End State

- On every location with a card, the Captain count grid, the correction screen and the count
  history list products in the card's order: sections in card order and rows in card order. The
  card rows stay contiguous.
- A location product that its own card does not list goes at the end of its category section
  after the card rows, in product-id order. If its category is not on the card, it takes the
  template position. If no card lists it at all, it goes at the end of its section in product-id
  order.
- The Manager inventory detail opens in card order, with sort "Karta inwentaryzacji" and groups
  in card order.
- The Manager sort picker also offers "Kolejność zamawiania": supplier, then the supplier's
  position.
- Name, stock, delta and category sorts behave exactly as today. The CSV follows the card order.
- Pago and Mory lists follow the Ordering PB v5 order. These lists are the Captain order screen,
  the Manager detail and the Transport documents.
- Locations added later (for example the 1.10 openings) follow the template until their own card
  is applied.
- Verified by the backend and Vitest suites, the integration suite on Postgres (migration
  applied), and an operator live check after the gated rollout.

### Key Discoveries:

- `display_order` in 0023 needed no Sheets or seed loader change, because optional columns are
  tolerated (`sheets.py:147-164, 203-256`, `seed_loader.py:48-59`). Pydantic ignores unknown keys,
  so `SELECT *` rows with the new columns load fine into older code.
- `_PRODUCT_COLUMNS` (`supabase_backend.py:95`) and `_LOCATION_PRODUCT_SETTING_COLUMNS`
  (`supabase_backend.py:114`) drive writes only. Reads are `SELECT *`.
- The integration fixture lists migrations by name (`tests/test_supabase_integration.py`, 0025
  is the last entry at line 199) and inserts a seed setting through
  `_LOCATION_PRODUCT_SETTING_COLUMNS`, so the column-list edit and the fixture entry for 0027 must
  land in the same commit.
- `tests/test_inventory_submit.py:38-53` pins the exact `InventoryProduct` key set.
- Migration numbers: 0025 is delivery-calendar (PR #42, on main) and 0026 is
  `0026_location_sender_and_phone.sql` on the unmerged branch `claude/loving-feynman-2e6946`. This
  change uses **0027**.

## What We're NOT Doing

- No per-snapshot order. Lines are ordered by the current master data, not by the card at count
  time. When positions change, past counts and their CSV export read in the new order. Storing a
  position on `inventory_count_lines` at submit was weighed and rejected: no one reads old counts
  row-by-row against an old card, and it would add a column to a write path.
- No supplier blocks on the Captain grid and no sort control there. The card is the Captain's
  order.
- No UI to edit card positions. Positions are master data set by gated SQL; re-run the generator
  when a card changes.
- No new catalogue products for card names that have none ("Ręcznik papierowy rolka", "Corfu
  Radler", "Promo Beer").
- No combined Pago + Mory transport. That is `transport-pago-mory-combined`.
- No change to per-supplier order screens beyond the Pago/Mory positions (data only).
- No change to `captain_inventory_latest`. Its lines only feed the pre-fill, which is keyed by
  `product_id`.

## Implementation Approach

The approach mirrors 0023: additive nullable columns carry the position, one shared sort key
orders rows server-side, and the frontend only needs new sort options for the Manager view.

- Positions are **hybrid**. `products.inventory_order` is the common card template.
  `location_product_settings.inventory_order` is a per-location override on the same scale.
  Effective position = the override when set, else the template.
- A new location therefore gets a sensible order on day one, and a card change at one location
  touches only that location's rows.
- At a carded location, an active product that its card omits gets an override just after its
  section's last card row: `section_end + 1`, with ties broken by product id. This keeps the card
  sequence unbroken; without it, the template would weave these products into the card rows
  (NORBLIN 22, BRACKA 8, WOLA 4, KEN 4).
- All overrides are derived by the pipeline and owned by it. They are never hand-edited.
- The Captain grid already follows backend order, so it needs no code change.
- The data lives in two gated SQL files, each with a diff-before and an audit-after:
  - `prod-sql.sql`: the card template and overrides; needs 0027.
  - `prod-sql-pago-mory.sql`: Pago/Mory `display_order`; independent of the merge, because the
    column already exists on prod.

## Critical Implementation Details

- **One effective position.** The backend resolves `override if not None else template` once, in
  `product_order.effective_inventory_order`, and exposes the resolved value as `inventory_order`
  on the response models. The frontend never sees the two raw columns.
- **Tie-break.** The key is `(effective is None, effective or 0, product_id)`. The generator's
  proof uses the same key, so SQL and code agree on equal positions. `product_id` is never None
  on a line, so the key never compares None with a string. `setting_id` is not part of the key.
- **Lines without a setting.** A count line whose product has no setting at the location (a
  setting removed after the count) uses the product's template position. If the product is
  unknown too, the line is unpositioned and sorts by `product_id` among the other unpositioned
  lines. Tests pin both placements.
- **Backend order vs the "card" sort.** The backend returns lines already in card order. The
  frontend "card" sort orders by `inventory_order` with a stable sort and never tie-breaks on its
  own, so on backend output it is the identity. The two cannot disagree. The CSV keeps exporting
  `detail.lines` in backend order whatever the on-screen sort, which is today's behaviour.
- **Groups in the Manager view.** `groupProductRows` re-sorts groups alphabetically, and the
  label-less group always goes last. Exactly one combination changes: group by category + sort
  "card" keeps first-seen group order, so the card sections come out in card order.
  - Every other combination keeps alphabetical groups, supplier grouping under any sort
    included.
  - The label-less group stays last in all modes.
  - The existing group tests keep passing unchanged.
- **Captain grid default view.** `DEFAULT_PRODUCT_LIST_VIEW` is shared with the Captain grid,
  which only filters (`InventoryCountGrid.tsx:68, 102-120`). It stays unchanged. The Manager page
  gets its own default through a helper, so the Captain side gets no new sort call.
- **Manager default when nothing is positioned.** The Manager page chooses its default when the
  detail arrives:
  - "card" when any line has an `inventory_order`;
  - otherwise "name", today's behaviour, e.g. before the SQL runs.

## Phase 1: Backend order

### Overview

Add the columns, thread them through the models and Supabase writes, and return inventory
products and count lines in card order with the fields the Manager sorts need.

### Changes Required:

#### 1. Migration 0027

**File**: `supply-os-v1/migrations/0027_inventory_order.sql`

**Intent**: Add the card template position and the per-location override.

**Contract**:
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS inventory_order integer;`
- `ALTER TABLE location_product_settings ADD COLUMN IF NOT EXISTS inventory_order integer;`
- Header in the 0023 style:
  - additive only; NULL = no position;
  - numbering note (0025 and 0026 taken);
  - no percent sign;
  - apply on prod before the backend that binds the columns;
  - rollback: `DROP COLUMN IF EXISTS` on both.

#### 2. Models and Supabase columns

**File**: `supply-os-v1/app/models.py`, `supply-os-v1/app/supabase_backend.py`

**Intent**: Carry both positions and bind them on insert.

**Contract**:
- `Product.inventory_order: Optional[int] = None`, commented as the position on the common
  inventory-card template, NULL = none.
- `LocationProductSetting.inventory_order: Optional[int] = None`, commented as the per-location
  override on the same scale, NULL = use the template.
- `"inventory_order"` appended to `_PRODUCT_COLUMNS` and to `_LOCATION_PRODUCT_SETTING_COLUMNS`.

#### 3. Shared inventory order

**File**: `supply-os-v1/app/product_order.py`

**Intent**: One rule for location-wide inventory lists, next to the per-supplier rule.

**Contract**:
- `effective_inventory_order(setting_order: Optional[int], product_order: Optional[int]) ->
  Optional[int]` returns the setting value when not None, else the product value.
- `inventory_sort_key(effective: Optional[int], product_id: str) -> tuple[bool, int, str]` =
  `(effective is None, effective or 0, product_id or "")`.
- The module docstring gains the second rule and the hybrid source.

#### 4. Captain inventory products

**File**: `supply-os-v1/app/main.py` (`captain_inventory_products`), `supply-os-v1/app/models.py`
(`InventoryProduct`)

**Intent**: Return the location's products in card order and expose the resolved position.

**Contract**:
- Items are sorted by `inventory_sort_key(effective_inventory_order(setting.inventory_order,
  product.inventory_order), product.product_id)`.
- `InventoryProduct.inventory_order: Optional[int] = None` holds the resolved value.

#### 5. Count detail lines

**File**: `supply-os-v1/app/main.py` (`_enrich_inventory_count_detail`,
`manager_inventory_count_detail`, `captain_inventory_count_detail`), `supply-os-v1/app/models.py`
(`InventoryCountDetailLine`)

**Intent**: The Manager detail, the Captain history and the CSV read lines in card order. The
Manager view gets what it needs for the "card" and "supplier" sorts.

**Contract**:
- Lines are sorted by the key of the count location's setting and the product.
  - A line whose product has no setting uses the template.
  - An unknown product sorts as unpositioned.
  - Ties break by `product_id`.
- `InventoryCountDetailLine` gains three fields, the last two from the primary supplier product
  already resolved there:
  - `inventory_order: Optional[int] = None` (resolved);
  - `display_order: Optional[int] = None`;
  - `supplier_product_id: Optional[str] = None`.
- `captain_inventory_count_detail` loads the location's settings and the products once to sort.
  `InventoryLatestLine` keeps its shape.

#### 6. Tests

**File**:
- `supply-os-v1/tests/test_inventory_submit.py`: Captain products order and key set.
- `tests/test_inventory_manager.py`: Manager count detail. Its `_activate_sheet` already patches
  master data.
- `tests/test_inventory_counts.py`: Captain count detail. Its `_activate_sheet` (`:62-77`) must
  also patch `load_products` and `load_location_product_settings`, as
  `test_inventory_manager.py:121-126` does, or the five existing `test_count_detail_*` tests hit
  gspread and fail.
- `tests/test_product_order.py`: unit tests of the new helpers.
- `tests/test_supabase_backend.py`: bind tests. Template:
  `test_supplier_product_display_order_and_minimum_flag_bind` (`:224-238`).
- `tests/test_supabase_integration.py`: 0027 goes into the migration list after 0025, before the
  product and setting inserts.

**Intent**: Pin the hybrid order and the new columns.

**Contract**:
- `test_inventory_products_follow_card_order`:
  - an override beats the template;
  - template-only products interleave by value;
  - unpositioned products go last by product_id;
  - equal effective positions tie by product_id;
  - categories come out first-seen in position order.
- The `InventoryProduct` key-set test is updated with `inventory_order`.
- `test_manager_count_detail_lines_in_card_order`:
  - includes a corrected count (hex line ids) and a line whose product has no setting at the
    location;
  - the fields `inventory_order`, `display_order` and `supplier_product_id` are present and
    resolved.
- `test_captain_count_detail_lines_in_card_order`.
- Unit tests of `effective_inventory_order` and `inventory_sort_key`.
- Bind tests: `inventory_order` is bound on product and setting inserts.
- Integration: the fixture applies 0027; both columns round-trip; the NULL default is asserted in
  `test_master_data_roundtrip`.

### Success Criteria:

#### Automated Verification:

- Backend suite passes: `cd supply-os-v1 && python -m pytest -q`
- Lint passes: `cd supply-os-v1 && ruff check .`
- Integration suite passes on a local Postgres 16 with 0027 applied: `python -m pytest -m integration -q`

#### Manual Verification:

- None for this phase (covered by the release phase).

---

## Phase 2: Manager view sorts

### Overview

Give the Manager inventory view a card-order default and an ordering-order option.

### Changes Required:

#### 1. Types

**File**: `frontend/src/types.ts`

**Intent**: Mirror the new backend fields as optional, per lessons.md.

**Contract**:
- `InventoryProduct.inventory_order?: number | null`
- `InventoryCountDetailLine.inventory_order?: number | null`
- `InventoryCountDetailLine.display_order?: number | null`
- `InventoryCountDetailLine.supplier_product_id?: string | null`

#### 2. List view helper

**File**: `frontend/src/lib/productListFilter.ts`

**Intent**: New sorts, a group order that respects them, and the Manager default.

**Contract**:
- `ProductListSort` gains `"card" | "supplier"`.
- `ProductListRow` gains the three optional fields.
- `"card"`: `inventory_order` ascending, nulls last, ties keep input order (stable sort).
- `"supplier"`:
  - supplier name, Polish collation, rows with no supplier last;
  - then `compareProductOrder` (`lib/productOrder.ts`);
  - then name.
- `groupProductRows(rows, groupBy, sort?)`:
  - keeps first-seen group order only for `groupBy === "category" && sort === "card"`;
  - alphabetical otherwise;
  - the label-less group stays last in every mode.
- `defaultInventoryListView(rows)` returns `DEFAULT_PRODUCT_LIST_VIEW` with `sort: "card"` when
  any row has an `inventory_order`, and unchanged otherwise.
- `DEFAULT_PRODUCT_LIST_VIEW` itself is unchanged.

#### 3. Manager page

**File**: `frontend/src/pages/manager/ManagerInventoryPage.tsx`

**Intent**: Open each snapshot in card order when it has positions.

**Contract**: When the detail for the selected count arrives, the list view is set to
`defaultInventoryListView(d.lines)`. The reset on selection is unchanged.

#### 4. Toolbar and copy

**File**: `frontend/src/components/ui/ProductListToolbar.tsx`, `frontend/src/i18n/strings.ts`

**Intent**: Offer the two sorts, with "Karta inwentaryzacji" first.

**Contract**:
- `SORT_OPTIONS` = card, supplier, name, stock, delta, category.
- New keys:
  - `productList.sort.card`: pl "Karta inwentaryzacji", en "Inventory card";
  - `productList.sort.supplier`: pl "Kolejność zamawiania", en "Ordering order".
- The Captain grid does not render the sort picker. If the toolbar is shared there, the Captain
  side must not show new options; the implementer checks `InventoryCountGrid.tsx`.

#### 5. Tests

**File**: `frontend/src/lib/productListFilter.test.ts`

**Intent**: Pin the new sorts, the group rule and the default helper.

**Contract**:
- Card sort: nulls last, stable ties.
- Supplier sort: display_order, then supplier_product_id, with no supplier last.
- Groups are first-seen only under category + card. They stay alphabetical under
  supplier + card and category + supplier. The label-less group is last in each mode, and the
  existing test is kept.
- `defaultInventoryListView` returns "card" with positions and "name" without.

### Success Criteria:

#### Automated Verification:

- Frontend tests pass: `cd frontend && npm run test`
- Frontend build passes: `cd frontend && npm run build`
- Frontend lint passes: `cd frontend && npm run lint`

#### Manual Verification:

- None for this phase (covered by the release phase).

---

## Phase 3: Prod data SQL and docs

### Overview

Prepare the two gated data batches and the release notes. Nothing runs on prod in this phase.

### Changes Required:

#### 1. Generator and data

**File**: `context/changes/inventory-card-order/data/`: `card_order.json`, `alias.json`,
`positions.json`, `extract_card_order.py.txt`, `gen_positions.py.txt`, and a new
`gen_prod_sql.py.txt`.

**Intent**: Keep the parse auditable and regenerate the SQL from the data.

**Contract**:
- `gen_prod_sql.py.txt` reads `positions.json` and `card_order.json` and writes the VALUES lists
  into `prod-sql.sql`:
  - template `(product_id, inventory_order)`;
  - overrides `(location_id, product_id, inventory_order)`;
  - the card sequence `(location_id, seq, product_id)`, used by the audit.
- It fails if `gen_positions.py.txt`'s proof does not hold.
- It also emits the section-end list for the extras, and asserts that every section leaves room:
  `next section start - section_end >= 2`. This was checked locally; the minimum gap is 7.

#### 1b. Seed mirror

**File**: `docs/pita-supply-os-v1/seed/products.csv`

**Intent**: Seed-mode dev and the local Captain preview show the card order, as 0023 did for
`display_order` (commit 7aa1022).

**Contract**:
- New optional column `inventory_order`, filled from the template for the seed products that
  have a position.
- Any test that pinned the seed product-id order of `/api/captain/inventory/products` is
  adjusted.
- Seed settings get no overrides.

#### 2. prod-sql.sql (card order; needs 0027)

**File**: `context/changes/inventory-card-order/prod-sql.sql`

**Intent**: Diff-before → apply → audit-after → rollback, per lessons.md.

**Contract**:
- **Step 0 (diff).** Current vs new `products.inventory_order` for the template products, and
  current vs new `location_product_settings.inventory_order` for the override rows. Saved as
  `prod-sql-diff-before.md`. Also list, from a `VALUES` join on `(location_id, product_id)`:
  - card products with no active setting at their location, which are not on that grid;
  - override rows that match no setting, which must be zero;
  - the extras per location: active settings whose product is not on the location's card
    (75 on the 2026-09-28 prod copy, including the 27 settings whose product no card lists
    at all);
  - existing overrides that step 1 will clear.
- **Step 1 (one transaction).**
  - Set `products.inventory_order` from the template.
  - Clear any `location_product_settings.inventory_order`, then set the card overrides for rows
    that exist. The clear is a no-op on the first run and makes a re-run exact.
  - Extras: for each carded location, every setting whose product is not on that card and whose
    category has a section on the card gets `inventory_order = section_end + 1`. The generator
    emits `(location_id, product_category, section_end)`, and the SQL joins it to the prod
    settings and products at run time.
  - The file header says positions are generator-owned (see Migration Notes).
- **Step 2 (audit).** For every location with a card, the card products that have a setting,
  sorted by `(COALESCE(setting, template) NULLS LAST, product_id)`, must appear in card-sequence
  order: zero inversions per location.
  - Contiguity: no active non-card product sorts between two card products of the same section.
  - All template products are positioned.
  - Override count per location as expected.
  - All positions are > 0.
  - Category runs per location equal the number of categories on the card.
  - Override rows applied per location = rows expected.
  - Unpositioned active products per location: 0 rows. Every active product at a carded
    location is on its card or is an extra.
  - Bukat `display_order` is untouched.
- **Step R (rollback).** Restore from the diff; NULL for this first batch.

#### 3. prod-sql-pago-mory.sql (list order; independent of the merge)

**File**: `context/changes/inventory-card-order/prod-sql-pago-mory.sql`

**Intent**: Pago and Mory `display_order` from Ordering PB v5. The column exists on prod since
0023, so this can run whenever the operator says go.

**Contract**:
- **Step 0 (diff).** Current vs new `display_order` for SUP_PAGO and SUP_MORY, saved to the diff
  file.
- **Step 1 (one transaction).** Positions by supplier product of these products:
  - **Pago:** P024 10, P025 20, P027 30, P028 40, P026 50, P145 60.
  - **Mory, sheet rows:** P019 10, P089 20, P092 30, P090 40, P098 50, P091 60. P092 is the
    sheet's "Box beżowy bez logo"; this mapping is inferred.
  - **Mory, till rolls:** P128 70, P130 80, P184 90, P183 100, P129 110. The sheet says
    "typ 1/2/3" with no mapping, so the order here is by size.
  - **Mory, off-sheet:** P173 120, P122 130, P188 140, P127 150, P131 160, P132 170, P133 180.
- **Step 2 (audit).**
  - All active SP_PAGO and SP_MORY rows are positioned.
  - No duplicate position per supplier.
  - Bukat is untouched.
- **Step R (rollback).** Restore from the diff; NULL for this first batch.

#### 4. Local validation

**Intent**: Prove both files run and their audits pass before the operator sees them.

**Contract**:
- Run steps 0–2 of both files on a throwaway local Postgres loaded with the migrations.
- Load master data from a read-only export of prod's products, settings and supplier_products,
  or from the seed CSVs where prod data is unavailable. Record which one was used.
- If no local Postgres is available, record that only syntax was checked.

#### 5. Docs

**File**: `docs/pita-supply-os-v1/DATA_MODEL.md`, `change.md` (deploy order), root and area
`AGENTS.md` test counts.

**Intent**: Document the columns and the rollout, and keep the counts true.

**Contract**:
- DATA_MODEL gains `products.inventory_order` and `location_product_settings.inventory_order`,
  with the effective-position rule.
- `change.md` gains a "Deploy order":
  1. migration 0027 on prod;
  2. merge after 1.10;
  3. confirm live;
  4. `prod-sql.sql`;
  5. live check.

  It also says that `prod-sql-pago-mory.sql` is independent and runs on the operator's go.

### Success Criteria:

#### Automated Verification:

- prod-sql steps 0–2 of both files run clean on a local throwaway Postgres (or syntax-only, recorded)
- Backend and frontend suites still green

#### Manual Verification:

- None for this phase (covered by the release phase).

---

## Phase 4: Release (operator-gated)

### Overview

Nothing here runs without the operator's explicit go.

### Changes Required:

None in code. Order:

1. Apply 0027 on prod.
2. Merge after the new locations start on 1.10.
3. Confirm live: Railway `/health`, and a new Vercel bundle for the merge commit.
4. Re-download the 12 inventory workbooks and re-run the pipeline:
   `extract_card_order` → `gen_positions` → `gen_prod_sql`. Diff the new `card_order.json`
   against the committed one; the cards were still being edited before 1.10. Commit a changed
   data set before running.
5. Run `prod-sql.sql`: save the diff, apply, audit.
6. Do the live check.

`prod-sql-pago-mory.sql` runs on its own go, before or after the merge.

### Success Criteria:

#### Automated Verification:

- CI green on the PR (backend, backend-integration, frontend)

#### Manual Verification:

- Migration 0027 applied on prod (operator go)
- Merged after 1.10 and live (operator go)
- prod-sql.sql applied, diff saved, audit clean (operator go)
- prod-sql-pago-mory.sql applied, diff saved, audit clean (operator go)
- Live check: Captain count, Manager detail, Pago and Mory order screens follow the new order
  (steps in Manual Testing Steps; no order is submitted as part of the check)
- Pago Transport documents: open a sent Pago batch's PDF preview once and confirm the new order,
  without sending anything.
- NORBLIN grid: card rows are contiguous and the extras sit at each section's end.

## Testing Strategy

### Unit Tests:

- `effective_inventory_order` and `inventory_sort_key`, including equal positions and NULLs.
- Route order tests for the Captain products, the Manager detail (with a corrected count) and
  the Captain detail.
- Vitest for the card and supplier sorts, the group-order rule and the default helper.

### Integration Tests:

- 0027 applied in the fixture; both columns round-trip; NULL default.

### Manual Testing Steps:

1. Open the `/captain-v2` inventory at WOLA and compare it against the Wolska card.
2. Open a correction of an existing count; the rows follow the card.
3. Open the Manager inventory detail for the same count. It defaults to card order; switch to
   "Kolejność zamawiania".
4. Open the Captain order screen for Pago and for Mory; the rows follow the sheet.
5. Open a sent Pago transport batch and preview its documents; the rows follow the sheet. Do not
   send a draft.

## Performance Considerations

The Captain detail route reads the settings and products lists once per call. Both are small and
already read by the neighbouring routes.

## Migration Notes

0027 is additive and nullable. Code without the columns behaves as before, because reads are
`SELECT *` and Pydantic ignores unknown keys. Apply it before the backend that binds the columns
in `_PRODUCT_COLUMNS` and `_LOCATION_PRODUCT_SETTING_COLUMNS`.

Apply 0027 before running `scripts/backfill_supabase.py`, which inserts through both column
lists, against any database.

A location without overrides follows the template.

Positions are owned by the pipeline: `extract_card_order` → `gen_positions` → `gen_prod_sql`.
Never hand-edit `inventory_order` on prod. Step 1 clears all overrides before re-setting them, so
a hand-set value would be lost on the next run. After a card change, re-download the workbooks,
re-run the pipeline, and apply the regenerated `prod-sql.sql`; its diff shows every change,
cleared overrides included.

## References

- Research: `context/changes/inventory-card-order/research.md`
- Precedent: `context/archive/2026-09-28-supplier-product-order-minimum/` (0023, `product_order.py`)
- Data proof: `context/changes/inventory-card-order/data/gen_positions.py.txt`

## Notes

- **Design decision (adversary pair, 2026-09-28).** Card positions are hybrid: the
  `products.inventory_order` template plus the `location_product_settings.inventory_order`
  override.
  - The critic showed that the 12 cards differ in only 26 rows around one shared order, so a
    template gives new locations (1.10) a card-like order without data work. A per-location-only
    column would leave them in product-id order.
  - The devil's advocate verified the mechanism against prod (read-only). Its findings are
    folded in below.
  - Accepted risk: a product activated at a carded location after the batch takes its template
    position, inside the card rows, until the pipeline is re-run. It stays inside its category.
- **Adversary findings (devil's advocate, 2026-09-28), and how the plan answers them:**
  - C1: the branch base was stale. It was fast-forwarded to origin/main 3915bab (PR #40 and
    #42) and the backend line references were refreshed.
  - C2: the fixture must apply 0027 in the same commit as the column-list edit. This is in the
    Phase 1 contract, after 0025.
  - W1: unpositioned tails. The hybrid shrinks them to WOLA 14, BRACKA 5, NORBLIN 5, KEN 2,
    BROWARY 1 (no card lists these products). They sit at the end of their section, and the
    audit prints them.
  - W9 (addendum): template extras woven into the card. Each such product gets a section-end
    override derived at run time, so the card rows stay contiguous. This was plan-review F3.
  - W10 (addendum): re-run wipes hand edits. Positions are generator-owned, and the diff lists
    cleared overrides. This was F4.
  - W11 / O9 (addendum): the product column list and the seed. The fixture applies 0027 before
    the inserts (C2), and the seed mirror is Phase 3 §1b.
  - O7 (addendum): the template is global state. This is accepted at 12 near-identical cards;
    revisit if one diverges.
  - O8 (addendum): string tie-break on product ids. Cosmetic.
  - W2: card products without a setting. They are reported by the step-0 `VALUES` join and
    audited.
  - W3: `TypeError` on a line with no setting. The key uses `product_id`, never `setting_id`.
    Placement is specified and tested.
  - W4: two sorts could disagree. The frontend "card" sort is stable and does no tie-break of
    its own, so it is the identity on backend output. The CSV behaviour is unchanged.
  - W5: cross group orders. First-seen applies only to category + card, and the label-less group
    is always last.
  - W6: fallback. `defaultInventoryListView` uses "name" when nothing is positioned.
    `DEFAULT_PRODUCT_LIST_VIEW` is unchanged.
  - W7: cards keep changing. The pipeline is re-run right before the SQL (Phase 4 step 4).
    Accepted risk: after that, positions go stale silently until the next gated batch. There is
    no staleness indicator; a Captain report triggers a re-run.
  - W8: historical views reorder. Accepted and written down under "What We're NOT Doing".
  - O1: `captain_inventory_latest` is left out.
  - O4: all SQL keys on `(location_id, product_id)`.
  - O6: a Pago PDF check is added to the live check.

- **Implementation note (Phase 3, 2026-09-28).** The generator does not emit a
  `(location_id, product_category, section_end)` list. `prod-sql.sql` step 2d computes each
  section end at run time from the card VALUES and prod's own `product_category`, so a category
  renamed on prod cannot desync the file.
  - The gap check moved into the audit: 3c (no inversions) and 3d (no contiguity break). Both
    passed on the local prod copy.
  - The local gap check (minimum 7) still holds for the parsed data.
  - The same dry run showed that the extras rule positions every active product at a carded
    location, including those no card lists. Step 3e therefore expects 0 rows.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend order

#### Automated

- [x] 1.1 Backend suite passes: `cd supply-os-v1 && python -m pytest -q` — 217c68b
- [x] 1.2 Lint passes: `cd supply-os-v1 && ruff check .` — 217c68b
- [x] 1.3 Integration suite passes on a local Postgres 16 with 0027 applied: `python -m pytest -m integration -q` — 217c68b

### Phase 2: Manager view sorts

#### Automated

- [x] 2.1 Frontend tests pass: `cd frontend && npm run test` — 5304483
- [x] 2.2 Frontend build passes: `cd frontend && npm run build` — 5304483
- [x] 2.3 Frontend lint passes: `cd frontend && npm run lint` — 5304483

### Phase 3: Prod data SQL and docs

#### Automated

- [x] 3.1 prod-sql steps 0–2 of both files run clean on a local throwaway Postgres (or syntax-only, recorded)
- [x] 3.2 Backend and frontend suites still green

### Phase 4: Release (operator-gated)

#### Automated

- [ ] 4.1 CI green on the PR (backend, backend-integration, frontend)

#### Manual

- [ ] 4.2 Migration 0027 applied on prod (operator go)
- [ ] 4.3 Merged after 1.10 and live (operator go)
- [ ] 4.4 prod-sql.sql applied, diff saved, audit clean (operator go)
- [ ] 4.5 prod-sql-pago-mory.sql applied, diff saved, audit clean (operator go)
- [ ] 4.6 Live check: Captain count, Manager detail, Pago and Mory order screens follow the new order
- [ ] 4.7 Pago Transport documents: open a sent Pago batch's PDF preview once and confirm the new order, without sending anything
- [ ] 4.8 NORBLIN grid: card rows are contiguous and the extras sit at each section's end
