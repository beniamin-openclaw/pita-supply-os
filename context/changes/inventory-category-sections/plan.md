# Plan — Inventory count: collapsible category sections

- **Change**: `context/changes/inventory-category-sections/`
- **Status**: planned (self-reviewed — autonomous run)
- **Chip**: task_d7530159

## Desired End State

On the Captain location-wide inventory-count screen, products are grouped by `product_category` into collapsible sections. Each section header shows the category name + a `counted/total` counter and toggles open/closed (default open). Counting, drafts, and submit are unchanged — only the layout of the product list changes.

## Current State Analysis

- Backend `captain_inventory_products` (`supply-os-v1/app/main.py:1466`) returns `InventoryProduct` rows with `product_id / product_name_pl / inventory_unit / is_critical`. `Product.product_category` (models.py:50, required) is already loaded but not surfaced.
- `InventoryProduct` (`models.py`) has no `product_category`. It is a response-only model (never read from a sheet → no header-validation impact).
- Frontend `InventoryCountPage.tsx` renders `products.map(...)` as one flat `<ul>` (lines 327–375). `lines` is keyed by `product_id`; handlers + `countedLines` are product-id based and stay valid under grouping.
- Test `test_inventory_submit.py::test_inventory_products_lists_location_products` asserts the EXACT key set `{product_id, product_name_pl, inventory_unit, is_critical}` (line 32) → must add `product_category`. Seed P027 category = `Mrożonki`.
- `lucide-react` (ChevronDown/ChevronRight) is already a dependency used across captain-mp.

## Phase 1: Backend — surface product_category

### Changes Required
1. `supply-os-v1/app/models.py` — add `product_category: str` to `InventoryProduct` (after `product_name_pl`).
2. `supply-os-v1/app/main.py` — `captain_inventory_products`: pass `product_category=product.product_category` into the `InventoryProduct(...)`.
3. `supply-os-v1/tests/test_inventory_submit.py` — add `product_category` to the asserted key set + assert `p027["product_category"] == "Mrożonki"`.

### Success Criteria
#### Automated Verification:
- [ ] `cd supply-os-v1 && python -m pytest tests/test_inventory_submit.py` passes.
- [ ] `cd supply-os-v1 && python -m pytest` full suite green.
- [ ] `cd supply-os-v1 && ruff check .` clean.

#### Manual Verification:
- [ ] (none — covered by the endpoint test)

## Phase 2: Frontend — group + collapse

### Changes Required
1. `frontend/src/types.ts` — add `product_category: string` to `InventoryProduct`.
2. `frontend/src/i18n/strings.ts` — add `inventory.categoryCount` (`{counted}/{total}`) and `inventory.uncategorized`.
3. `frontend/src/pages/captain-mp/InventoryCountPage.tsx`:
   - `useMemo` → group `products` by `product_category` (preserve first-seen order; empty category → `inventory.uncategorized`).
   - `collapsedCategories: Set<string>` state + `toggleCategory` (default = all expanded).
   - Replace the flat `<ul>` with one collapsible `<section>` per category (Chevron header + counted/total chip), product `<li>` markup unchanged inside.

### Success Criteria
#### Automated Verification:
- [ ] Frontend `tsc --noEmit` clean.
- [ ] `eslint` — no new findings beyond the 13-problem baseline.
- [ ] `vite build` succeeds (Homebrew node).

#### Manual Verification:
- [ ] Owner opens the inventory screen tomorrow: products grouped by category, sections collapse/expand, counting + submit still work.

## What We're NOT Doing

- No change to the snapshot data model, submit payload, or which products are listed.
- No "expand/collapse all" control (per-section toggle only — keep scope tight).
- No persistence of collapse state across reloads (ephemeral UI state).
- No backend filtering/sorting by category — grouping is client-side only.

## Progress

### Phase 1: Backend — surface product_category

#### Automated
- [x] 1.1 InventoryProduct.product_category added (models.py) — a6a161e
- [x] 1.2 captain_inventory_products populates product_category (main.py) — a6a161e
- [x] 1.3 test_inventory_submit.py key-set + value assertion updated — a6a161e
- [x] 1.4 full backend pytest + ruff green — a6a161e

### Phase 2: Frontend — group + collapse

#### Automated
- [x] 2.1 types.ts InventoryProduct.product_category — 30c81e4
- [x] 2.2 strings.ts inventory.categoryCount + inventory.uncategorized — 30c81e4
- [x] 2.3 InventoryCountPage grouping + collapse render — 30c81e4
- [x] 2.4 frontend tsc + eslint (baseline) + build green — 30c81e4

#### Manual
- [ ] 2.5 Owner verifies grouped/collapsible UI tomorrow (count + submit still work)
