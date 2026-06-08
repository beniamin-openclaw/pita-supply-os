# Manager Inventory View + Captain Inventory History (S-08, FR-018/FR-019) — Implementation Plan

## Overview

Two read/consumption surfaces for the inventory snapshots that S-06 already persists: a **Manager** view of submitted inventory counts across locations (FR-018) and a **Captain/Owner** inventory-history browse (FR-019). Phase-2 / should-have per the roadmap — no new write path, no schema change, sheet-only reads that degrade gracefully off-sheet. Three phases: backend (Manager read endpoints) → frontend Manager view → frontend Captain history.

## Current State Analysis

Grounded in a codebase map (Explore) + the just-archived `inventory-count-followups`:

- **Snapshots persist** via `inventory_counts` / `inventory_count_lines` behind `_choose_backend()`. Read helpers exist in `sheets.py`: `load_inventory_counts()` (header rows, no lines), `load_inventory_count_lines()`, `get_inventory_count(count_id)` (populates `.lines`).
- **Captain read endpoints already exist** (built in `inventory-count-followups` Phase 3): `GET /api/captain/inventory/counts` → `list[InventoryCountSummary]` (location-scoped, seed→`[]`, `WorksheetNotFound`→`[]`, ≤10 newest) and `GET /api/captain/inventory/count/{id}` → `InventoryLatestResponse` (location-scoped, seed→503, 404 cross-location). The latter is consumed by the order pre-fill picker (`CaptainMP` `api.inventoryCount`) — **its response shape is a contract we must NOT change**.
- **No Manager inventory endpoints exist.** `manager_queue` (`main.py`) is the pattern to mirror for Manager auth: `_: None = Depends(require_manager)`, optional `location_id` query param (NOT token-scoped — Manager sees all locations), seed→`[]`. `manager_order_detail` is the pattern for server-side enrichment: joins `location_name` (`load_locations()`) and product fields (`load_products()`) into the response, seed→503.
- **Frontend**: routes are flat `<Route>` + `<AuthGate role>` in `App.tsx` (no nested trees). `ManagerPage` is a complex two-pane order workspace (`LOCATION_ID="WOLA"` hardcoded) — a new Manager inventory surface belongs on its OWN route `/manager/inventory`, not inside it. `OrdersListPage` is the list-view template (header + back button + `CaptainTabs` + fetch→rows→navigate). `CaptainTabs` active-state keys on `pathname.startsWith("/captain-v2/inventory-count")`.
- **i18n**: `STRINGS` keyed `as const satisfies Record<string, StringEntry>`; grouped by prefix (`manager.*`, `inventory.*`, `tabs.*`). All user-facing copy via `useT()`; all fetches via `apiClient.ts`.

### Key Discoveries
- The Captain-history backend is already done — FR-019 is a frontend-only consumption of existing endpoints (+ a client-side product-name join via the existing `inventoryProducts()`).
- Server-side enrichment (location_name + product names) is the established Manager pattern (`manager_order_detail`); the Manager inventory detail mirrors it.
- `CaptainTabs` active-match must broaden to `/captain-v2/inventory` so the new `/captain-v2/inventory-history` sub-page keeps the Remanent tab active.

## Desired End State

- A **Manager** opens `/manager/inventory` (linked from the Manager workspace), sees submitted inventory counts across locations (location, date, who counted, line count), newest first, optionally filtered by location; clicking one shows the counted products with names + stock + comments. Seed/off-sheet degrades to an empty state, never an error page.
- A **Captain** opens `/captain-v2/inventory-history` (linked from the Remanent screen), sees their location's past snapshots, and drills into a read-only detail with product names. The Remanent tab stays active.
- Verify: backend `pytest` + `ruff` green; frontend `build` + `lint` green; e2e seed-degrade (pages render empty gracefully, nav works, tab active-state correct). Positive sheet-mode paths deferred to the deploy gate (no real Google creds locally).

## What We're NOT Doing

- **No per-product trend charts / time-series visualization** — the chronological snapshot list + detail IS the history browse (FR-019 "browse history"); trend charts are a stretch past should-have. Deferred.
- **No change to the existing Captain `/inventory/count/{id}` contract** — the prefill picker depends on `InventoryLatestResponse`. The Manager detail uses a NEW enriched model; the Captain history view joins names client-side from the existing endpoints.
- **No write/edit/delete of inventory counts** — append-only holds; these are read surfaces only.
- **No new auth model / per-manager identity** — shared Manager token, generic actor (v0 Non-Goal).
- **No mockup-approval gate** — this run is autonomous; the two views closely mirror existing screens (`OrdersListPage` list pattern, `manager_order_detail` enrichment), built to the established brand tokens.
- **No deploy / push** — sheet-mode manual checks deferred to the single deploy gate.

## Implementation Approach

Backend first (Manager read endpoints, unit-tested with synthetic data), then the two frontend surfaces. All reads through `_choose_backend()`; every endpoint takes/returns Pydantic models; seed mode degrades (`[]` for lists, 503 for detail) — never 500. Frontend: API only via `apiClient.ts`, copy only via `i18n/`, explicit prop/return types (TS strict is off).

## Phase 1: Backend — Manager inventory read endpoints

### Overview
Expose submitted inventory counts to the Manager across locations, with server-side enrichment, mirroring `manager_queue` (auth + optional location filter + seed→[]) and `manager_order_detail` (location_name + product joins, seed→503). *(FR-018 backend)*

### Changes Required

#### 1. Models
**File**: `supply-os-v1/app/models.py`
**Contract**: add three models:
- `InventoryCountManagerItem` = `count_id, location_id, location_name: str, count_date, count_submitted_at: Optional[datetime], count_user: Optional[str], line_count: int` (list row; mirrors `ManagerQueueItem`'s `location_name` join).
- `InventoryCountDetailLine` = `product_id, product_name_pl: str, product_category: str, inventory_unit: str, is_critical: bool, current_stock_qty_base: float, count_comment: str` (enriched line).
- `InventoryCountDetail` = `count_id, location_id, location_name: str, count_date, count_submitted_at: Optional[datetime], count_user: Optional[str], line_count: int, notes: str, lines: list[InventoryCountDetailLine]`.

#### 2. List endpoint
**File**: `supply-os-v1/app/main.py`
**Contract**: `GET /api/manager/inventory/counts` → `list[InventoryCountManagerItem]`. `_: None = Depends(require_manager)`; optional `location_id: Optional[str] = None` query param (NOT token-scoped). `backend = _choose_backend()`; `if backend is not sheets: return []`; `try: all = backend.load_inventory_counts() except sheets.WorksheetNotFound: return []`; filter by `location_id` when provided; join `location_name` via `load_locations()`; sort by `(count_date, count_submitted_at)` desc; cap 20 (Manager sees more than the Captain's 10 — multiple locations).

#### 3. Detail endpoint
**File**: `supply-os-v1/app/main.py`
**Contract**: `GET /api/manager/inventory/count/{count_id}` → `InventoryCountDetail`. `Depends(require_manager)`, NO location scope (Manager reads any). `if backend is not sheets: raise 503`; `try: count = backend.get_inventory_count(count_id) except sheets.WorksheetNotFound: raise 503`; `if count is None: raise 404`; enrich lines via `load_products()` join (`product_name_pl`, `product_category`, `inventory_unit`, `is_critical`); join `location_name` via `load_locations()`. Extract a small helper `_enrich_inventory_count_detail(count, products_by_id, location)` for testability/reuse.

#### 4. Tests
**File**: `supply-os-v1/tests/test_inventory_manager.py` (new)
**Contract**: list returns cross-location rows sorted desc, location-filter narrows, `location_name` joined, seed→`[]`, `WorksheetNotFound`→`[]`, cap 20, 401 without manager token, 403/401 with a captain token; detail returns enriched lines (product names) + location_name, seed→503, missing→404, `WorksheetNotFound`→503, 401 unauth. Synthetic data via mocker (mirror `test_inventory_counts.py`'s `_activate_sheet`). Env via `conftest.py`.

### Success Criteria

#### Automated Verification:
- Backend tests pass: `cd supply-os-v1 && python -m pytest`
- Lint passes: `cd supply-os-v1 && ruff check .`

#### Manual Verification:
- `curl` `/api/manager/inventory/counts` (manager token) returns cross-location rows newest-first; `?location_id=WOLA` narrows; captain token rejected.
- `curl` `/api/manager/inventory/count/{id}` returns enriched lines with product names + location_name; missing id → 404; seed mode → 503.

---

## Phase 2: Frontend — Manager inventory view

### Overview
A Manager page at `/manager/inventory` listing submitted counts (location · date · who · line count) with a detail view of the counted products, reachable from the Manager workspace. *(FR-018 frontend)*

### Changes Required

#### 1. Types + apiClient
**File**: `frontend/src/types.ts`, `frontend/src/apiClient.ts`
**Contract**: add `InventoryCountManagerItem`, `InventoryCountDetail`, `InventoryCountDetailLine` interfaces (mirror Pydantic optionality: `count_submitted_at?: string | null`, `count_user?: string | null`). Add `api.managerInventoryCounts(location_id?)` → `InventoryCountManagerItem[]` and `api.managerInventoryCount(count_id)` → `InventoryCountDetail` (role `"manager"`, `encodeURIComponent` the id).

#### 2. Manager inventory page
**File**: `frontend/src/pages/manager/ManagerInventoryPage.tsx` (new)
**Contract**: master-detail (mobile: list → detail). Header (brand bar) with a back link to `/manager` + title. Left: list of counts (fetch `api.managerInventoryCounts()`; rows show location_name, count_date, count_user, line_count); optional location filter derived from the result union (client-side, mirrors `ManagerFilterBar`'s derive-from-data approach). Right/detail: on select, fetch `api.managerInventoryCount(id)` → table of `{product_name_pl, inventory_unit, current_stock_qty_base, count_comment}`. Loading / empty / error states like `OrdersListPage`. No write actions.

#### 3. Route + nav link
**File**: `frontend/src/App.tsx`, `frontend/src/pages/ManagerPage.tsx`
**Contract**: add `<Route path="/manager/inventory" element={<AuthGate role="manager"><ManagerInventoryPage/></AuthGate>}/>`. Add a nav link/button in the `ManagerPage` header ("Remanenty") → `navigate("/manager/inventory")`. The dispatch/queue workspace is otherwise untouched.

#### 4. Copy
**File**: `frontend/src/i18n/strings.ts`
**Contract**: add `manager.inventory.*` keys (title, back, columns: location/date/countedBy/lineCount, empty, fetchError, detailTitle, productCol/stockCol/commentCol, navLink) in pl + en.

### Success Criteria

#### Automated Verification:
- Build passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run build`
- Lint passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run lint`

#### Manual Verification:
- `/manager/inventory` lists submitted counts (location · date · who · lines), newest first; clicking shows product names + stock.
- Reachable via the "Remanenty" link from the Manager workspace; seed mode shows a graceful empty state (no error).

---

## Phase 3: Frontend — Captain inventory history

### Overview
A Captain page at `/captain-v2/inventory-history` listing the location's past snapshots with a read-only detail, reachable from the Remanent screen; reuses existing Captain endpoints + a client-side product-name join. *(FR-019 frontend)*

### Changes Required

#### 1. Captain history page
**File**: `frontend/src/pages/captain-mp/InventoryHistoryPage.tsx` (new)
**Contract**: header (brand bar, back link to `/captain-v2/inventory-count`) + `<CaptainTabs/>`. List via existing `api.inventoryCounts()` (rows: count_date, count_user, line_count). On select, fetch `api.inventoryCount(id)` (existing, `InventoryLatestResponse`) + `api.inventoryProducts()` for a `product_id → {name, unit}` map; render a read-only table joining names (fallback to `product_id` for a since-deactivated product). Loading / empty / error like `OrdersListPage`.

#### 2. Route + nav + tab active-state
**File**: `frontend/src/App.tsx`, `frontend/src/pages/captain-mp/InventoryCountPage.tsx`, `frontend/src/pages/captain-mp/components/CaptainTabs.tsx`
**Contract**: add `<Route path="/captain-v2/inventory-history" element={<AuthGate role="captain"><InventoryHistoryPage/></AuthGate>}/>`. Add a "Historia remanentów →" link on `InventoryCountPage` (navigates to the history route). **Broaden `CaptainTabs`** active-match: `inventoryActive = pathname.startsWith("/captain-v2/inventory")` (covers both `-count` and `-history`) so the Remanent tab stays active on the history page.

#### 3. Copy
**File**: `frontend/src/i18n/strings.ts`
**Contract**: add `inventory.history.*` keys (title, back, navLink, columns, empty, fetchError, detailTitle, productCol/stockCol/commentCol) in pl + en.

### Success Criteria

#### Automated Verification:
- Build passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run build`
- Lint passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run lint`

#### Manual Verification:
- `/captain-v2/inventory-history` lists the location's snapshots; detail shows product names + stock.
- Reachable from the Remanent screen; the Remanent tab stays active on the history page (e2e).

---

## Testing Strategy

- **Backend (pytest)**: Manager list (cross-location, sort, location filter, location_name join, seed→[], WorksheetNotFound→[], cap 20, auth) + Manager detail (enriched names, location_name, seed→503, 404, WorksheetNotFound→503, auth). Synthetic data only — never touches a live sheet or places an order.
- **Frontend**: build + lint; e2e seed-degrade (pages render empty gracefully, nav links work, Captain tab active-state correct on the history route). Positive sheet-mode paths deploy-gated.

## Migration Notes
No schema change, no worksheet migration — reads the existing `inventory_counts` / `inventory_count_lines`. Deploy with the rest; sheet-mode curl/UI checks run at the deploy gate.

## References
- Roadmap S-08; PRD FR-018, FR-019, US-02.
- Manager patterns: `supply-os-v1/app/main.py` `manager_queue` (auth + optional location), `manager_order_detail` (enrichment).
- Captain inventory read side (reused): `context/archive/2026-06-08-inventory-count-followups/` Phase 3.
- List-view template: `frontend/src/pages/captain-mp/OrdersListPage.tsx`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <sha>` when a step lands. See `references/progress-format.md`.

### Phase 1: Backend — Manager inventory read endpoints

#### Automated
- [x] 1.1 Backend tests pass: `python -m pytest`
- [x] 1.2 Lint passes: `ruff check .`

#### Manual
- [ ] 1.3 curl /manager/inventory/counts cross-location, newest-first, ?location_id narrows, captain token rejected
- [ ] 1.4 curl /manager/inventory/count/{id} enriched (names + location_name); missing → 404; seed → 503

### Phase 2: Frontend — Manager inventory view

#### Automated
- [ ] 2.1 Build passes: `npm run build`
- [ ] 2.2 Lint passes: `npm run lint`

#### Manual
- [ ] 2.3 /manager/inventory lists counts (location · date · who · lines) newest-first; detail shows product names + stock
- [ ] 2.4 Reachable via "Remanenty" link; seed mode shows graceful empty state

### Phase 3: Frontend — Captain inventory history

#### Automated
- [ ] 3.1 Build passes: `npm run build`
- [ ] 3.2 Lint passes: `npm run lint`

#### Manual
- [ ] 3.3 /captain-v2/inventory-history lists snapshots; detail shows product names + stock
- [ ] 3.4 Reachable from Remanent; Remanent tab stays active on the history page (e2e)
