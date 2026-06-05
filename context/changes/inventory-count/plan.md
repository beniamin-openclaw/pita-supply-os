# Inventory Count (S-06) Implementation Plan

## Overview

Add a location-wide **inventory count** for the Captain: open a screen listing all of a location's products, enter current stock in one pass, approve → persist a **dated, append-only snapshot** (`inventory_counts` + `inventory_count_lines`) mirroring the existing `orders` / `order_lines` stack behind the `_choose_backend()` seam. Pre-fill of stock into the order screen (S-07) and the Manager inventory view + history browsing (S-08, Phase 2) are explicitly out of scope.

Roadmap slice **S-06** (Stream C). PRD v2: **FR-015** (one-pass location-wide entry), **FR-016** (approve → dated snapshot, timestamp + actor, retained), **US-02**. Parallel early track — must not block or change the Bukat pilot / north star.

## Current State Analysis

- **Orders persistence is the reusable template.** `sheets.py` exposes the full write toolkit — `append_row`/`append_rows`, `_model_to_row`, `_get_column_order`, `_validate_headers`, `_find_row_index`, `invalidate_cache` (`supply-os-v1/app/sheets.py`). `main.py:_persist_order` (`supply-os-v1/app/main.py:250`) writes order + lines via `getattr`, returning `False` (and warning) on a read-only backend.
- **Seed is read-only.** `seed_loader.py` has no order writes; orders persist **only** in `sheet` mode. Inventory inherits this (decided): seed mode = not persisted + warning, exactly like orders.
- **Worksheets are NOT auto-provisioned.** `_open_worksheet` raises `WorksheetNotFound` if the tab is missing; `_validate_headers` (`sheets.py:217`) raises `ConfigDriftError` if a required (non-defaulted) model field has no header. The operator must pre-create the two tabs + header rows. Unit tests mock this away.
- **No inventory code exists today** (grep confirmed; only unrelated `inventory_unit` product field).
- **Frontend captain pattern is clear.** Screens live in `frontend/src/pages/captain-mp/`; they fetch via `api.*` (`apiClient.ts`), hold form state, persist a draft via `saveDraft`/`loadDraft` (`auth.ts`), confirm, submit, toast, `clearDraft`. Routes are declared in `App.tsx` behind `<AuthGate role="captain">`; copy comes from `i18n/strings.ts`; request/response types mirror backend models in `types.ts`.
- **Tests.** pytest, 196 tests; `sheets` is mocked at `_open_worksheet` (MagicMock + `mocker.patch.object`); endpoints use FastAPI `TestClient` with Bearer tokens set as env vars **before** app import. No frontend test runner.

## Desired End State

A Captain opens `/captain-v2/inventory-count`, sees every product configured for their location, enters current stock in one pass, confirms, and submits → a dated snapshot (`inventory_counts` + `inventory_count_lines`) is persisted in `sheet` mode (in-memory warning in `seed` mode). The existing ordering flow is unchanged; an in-progress count survives a page reload via the draft mechanism. Verify by: pytest green for the new backend tests; a `curl` submit (sheet mode) creating a snapshot; the screen loading all location products and submitting successfully.

### Key Discoveries

- Write toolkit reusable verbatim: `append_row`/`append_rows`, `_model_to_row`, `_get_column_order`, `_validate_headers`, `_find_row_index`, `invalidate_cache` (`sheets.py`).
- `main.py:250` `_persist_order` `getattr` pattern → `_persist_inventory_count` (sheet-only, degrades on seed).
- Worksheets pre-created by the operator (prerequisite); `_validate_headers` enforces headers (`sheets.py:217`).
- Frontend: `pages/captain-mp/` page + `App.tsx` route (AuthGate captain) + `apiClient` `api.*` + `i18n/strings.ts` + `auth.ts` drafts (`saveDraft`/`loadDraft`).
- Tests mirror `tests/test_sheets_write.py` (mock `_open_worksheet`) + `tests/test_captain_submit.py` (TestClient + env auth).

## What We're NOT Doing

- **Pre-fill** of `current_stock` into the order screen — that is slice **S-07** (FR-017).
- **Manager inventory view** + **history/trend browsing** — slice **S-08** (FR-018/019, Phase 2).
- Variance / target / min / max capture at count time (the engine computes against settings at order time).
- A `draft` / partial-count state machine, **editing** a submitted count, or **deleting** counts (append-only; no edit in Phase 1).
- Seed-mode write persistence (mirrors orders: seed = not persisted).
- Auto-provisioning the Google Sheet tabs (the operator creates them).

## Implementation Approach

Mirror the orders/order_lines stack top-to-bottom — models → sheets persistence → endpoints → frontend — with **append-only** snapshots and **blank = not counted** semantics (a line is created only for a product the Captain actually entered). Each backend phase is independently pytest-verifiable before the next; the frontend phase is manual-only (no test runner). Persistence is **sheet-only** via the `getattr` seam, exactly like orders.

## Critical Implementation Details

- **Worksheet provisioning (lifecycle).** `append_inventory_count*` calls `_open_worksheet`, which raises `WorksheetNotFound` if the tab is absent. Before sheet-mode use, the operator must create `inventory_counts` and `inventory_count_lines` tabs with header rows matching the model fields (see Migration Notes). Unit tests mock `_open_worksheet`, so they do not need real tabs. If the operator forgets, the submit endpoint catches `WorksheetNotFound` and returns a 503 with a configure-the-tabs message (Phase 2 §2) rather than a raw 500.
- **Seam discipline (`lessons.md`).** Routes resolve persistence only through `_choose_backend()`; never import `sheets` directly. New writes go through `_persist_inventory_count`, which uses `getattr(backend, "append_inventory_count", None)` and degrades to a warning on the read-only seed backend.
- **Blank = not counted.** The submit endpoint builds an `InventoryCountLine` only for products the Captain entered a value for; uncounted products produce **no line** (not a zero line) — `0 ≠ unknown`.

## Phase 1: Backend data layer — models + sheets persistence

### Overview

Define the inventory entities + captain submit request/response models, and the append-only sheet read/write functions, mirroring `Order`/`OrderLine` and `append_order*`.

### Changes Required:

#### 1. Models

**File**: `supply-os-v1/app/models.py`

**Intent**: Add the inventory entities and the captain submit request/response, following the `Order`/`OrderLine` + `CaptainSubmitRequest`/`CaptainSubmitResponse` conventions (Optional defaults, `Field(ge=0)`, `Field(min_length=1)`, `Field(default_factory=list)`).

**Contract**:
- `InventoryCount`: `count_id`, `location_id`, `count_date: date`, `count_user: Optional[str] = None`, `count_submitted_at: Optional[datetime] = None`, `line_count: int = 0`, `notes: str = ""`, `lines: list[InventoryCountLine] = Field(default_factory=list)`.
- `InventoryCountLine`: `count_line_id`, `count_id`, `product_id`, `current_stock_qty_base: float = 0`, `count_comment: str = ""`.
- `InventoryCountLineSubmit`: `product_id`, `current_stock_qty_base: float = Field(ge=0)`, `count_comment: str = ""`.
- `InventoryCountSubmitRequest`: `lines: list[InventoryCountLineSubmit] = Field(min_length=1)`, `notes: str = ""`.
- `InventoryCountSubmitResponse`: `count_id`, `count_date: date`, `line_count: int`, `warnings: list[str] = Field(default_factory=list)`.

#### 2. Sheets persistence (read + append-only write)

**File**: `supply-os-v1/app/sheets.py`

**Intent**: Add read + append-only write for the two worksheets, reusing the existing helpers. No `update`/`delete` (append-only; no edit in Phase 1).

**Contract**:
- `load_inventory_counts() -> list[InventoryCount]` via `_read_with_ttl("inventory_counts", InventoryCount)`.
- `load_inventory_count_lines() -> list[InventoryCountLine]` via `_read_with_ttl("inventory_count_lines", InventoryCountLine)`.
- `get_inventory_count(count_id) -> InventoryCount | None` — join lines (mirror `get_order`).
- `append_inventory_count(count) -> None` — `_get_column_order` → `_model_to_row` → `append_row` → `invalidate_cache("inventory_counts")`.
- `append_inventory_count_lines(lines) -> None` — shared-`count_id` guard (`ValueError` on mixed, like `append_order_lines`) → `append_rows` → `invalidate_cache("inventory_count_lines")`. No-op on empty list.

#### 3. Tests

**File**: `supply-os-v1/tests/test_inventory_sheets.py` (new)

**Intent**: Mirror `test_sheets_write.py` / `test_sheets_read.py` — mock `_open_worksheet`, assert appended rows match header order, round-trip read via `get_inventory_count`, and cache invalidation on write. Include the autouse module-state reset fixture.

**Contract**: `INVENTORY_COUNT_HEADERS` / `INVENTORY_COUNT_LINE_HEADERS` test constants matching the model field order (see Migration Notes for the column list).

### Success Criteria:

#### Automated Verification:

- New unit tests pass: `cd supply-os-v1 && python -m pytest tests/test_inventory_sheets.py`
- Full suite stays green: `cd supply-os-v1 && python -m pytest`
- Lint clean: `cd supply-os-v1 && ruff check .`

#### Manual Verification:

- Eyeball that `INVENTORY_COUNT_HEADERS` / `INVENTORY_COUNT_LINE_HEADERS` match the intended Google Sheet columns (Migration Notes) — they are the operator's contract for the tabs.

**Implementation Note**: After Phase 1 automated verification passes, pause for confirmation before Phase 2.

---

## Phase 2: Backend endpoints

### Overview

Expose the location-wide product list, the submit (snapshot create), and a minimal "latest count" read.

### Changes Required:

#### 1. List products to count

**File**: `supply-os-v1/app/main.py`

**Intent**: `GET /api/captain/inventory/products` — return every **active** product that has a `location_product_setting` at the Captain's (token-derived) location, enriched for display. Mirror `captain_orderable` but **location-wide** (not per-supplier).

**Contract**: Auth `Depends(require_captain)` (location from token). Filter to `Product.active is True` (skip discontinued SKUs — a location-wide list would otherwise surface products the per-supplier order screen never showed; F3). Response item: `{ product_id, product_name_pl, inventory_unit, is_critical }` (joined from `products` + `location_product_settings`).

#### 2. Submit (create snapshot)

**File**: `supply-os-v1/app/main.py`

**Intent**: `POST /api/captain/inventory/submit` — validate each line's product has a `location_product_setting` at this location; build `InventoryCount` + lines **only for entered products**; persist via `_persist_inventory_count`; return the response, appending an in-memory-only warning when the backend is read-only.

**Contract**:
- `_generate_count_id(location_id, today) -> "INV-YYYYMMDD-<LOC3>-<6hex>"` (mirror `_generate_order_id`).
- `_persist_inventory_count(backend, count, lines) -> bool` mirrors `_persist_order` (`getattr(backend, "append_inventory_count", None)` + `append_inventory_count_lines`; `False` + warning on read-only / `NotImplementedError`).
- Append-only: every submit is a new `count_id`; no upsert.
- `count_user = location_id` (proxy — no individual identity in v0, mirroring `captain_user`).
- **Error path (sheet mode, F2):** catch `sheets.WorksheetNotFound` from the append and return **503** with a clear "inventory worksheets not configured — create the `inventory_counts` / `inventory_count_lines` tabs" message. The new tabs are easy to forget; without this the submit returns a raw 500.

#### 3. Tests

**File**: `supply-os-v1/tests/test_inventory_submit.py` (new)

**Intent**: Mirror `test_captain_submit.py`: happy path on seed (200, **not persisted** → warning present), happy path on sheet (asserts `sheets.append_inventory_count` + `...lines` called via `mocker`), auth gate (401 without token), Pydantic gate (empty `lines` → 422), unknown product / no location setting → 400.

### Success Criteria:

#### Automated Verification:

- New endpoint tests pass: `cd supply-os-v1 && python -m pytest tests/test_inventory_submit.py`
- Full suite green: `cd supply-os-v1 && python -m pytest`
- Lint clean: `cd supply-os-v1 && ruff check .`

#### Manual Verification:

- With a Captain token (sheet mode): `GET /api/captain/inventory/products` returns the location's products; `POST .../submit` returns a `count_id`.
- No real supplier order is touched (this flow never dispatches).

**Implementation Note**: After Phase 2 automated verification passes, pause for confirmation before Phase 3.

---

## Phase 3: Frontend inventory screen

### Overview

A Captain-facing screen to count all location products in one pass, with draft persistence and a confirm-then-submit flow.

### Changes Required:

#### 1. Types

**File**: `frontend/src/types.ts`

**Intent**: Add the request/response types mirroring the new backend models.

**Contract**: `InventoryProduct`, `InventoryCountLineSubmit`, `InventoryCountSubmitRequest`, `InventoryCountSubmitResponse`. Explicit types (TS `strict` is off — annotate, don't infer).

#### 2. API client

**File**: `frontend/src/apiClient.ts`

**Intent**: Add the three captain endpoints to the `api` object.

**Contract**: `inventoryProducts()` → `apiGet<InventoryProduct[]>("/api/captain/inventory/products", "captain")`; `inventorySubmit(req)` → `apiPost<InventoryCountSubmitResponse>("/api/captain/inventory/submit", req, "captain")`.

#### 3. i18n strings

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Add `inventory.*` keys (pl + en) for every user-facing string — no hardcoded copy.

**Contract**: keys for title, subtitle, product/qty column labels, submit button, confirm dialog, draft-resume banner, success toast, error states.

#### 4. Inventory page

**File**: `frontend/src/pages/captain-mp/InventoryCountPage.tsx` (new)

**Intent**: Fetch `inventoryProducts()` → render a one-pass numeric input per product → persist a draft on change → confirm → `inventorySubmit()` → toast → `clearDraft`.

**Contract**: Reuse `saveDraft`/`loadDraft`/`clearDraft` (`auth.ts`) with a **fixed sentinel key** (e.g. `"__inventory__"`) since inventory is location-scoped, not supplier-scoped — no change to the draft helpers needed. Reuse existing `captain-mp/components` (Header, StickyActionBar, ConfirmSubmitDialog, Toast) where they fit. Only entered values are submitted (blank = omitted line).

#### 5. Route + entry point

**File**: `frontend/src/App.tsx` (+ a link from the Captain landing)

**Intent**: Register the route behind auth and give the Captain a way in.

**Contract**: `<Route path="/captain-v2/inventory-count" element={<AuthGate role="captain"><InventoryCountPage /></AuthGate>} />`; add a navigation link/button from `CaptainMP` (or its Header) to the new route.

### Success Criteria:

#### Automated Verification:

- Build + typecheck + lint pass: `cd frontend && npm run build && npm run lint`

#### Manual Verification:

- The screen lists every product configured for the location.
- Entering values + confirming + submitting creates a snapshot (verify via `GET .../latest` or the Sheet).
- Reloading mid-count restores the draft; discarding clears it.
- The existing ordering flow (`/captain-v2`) is unaffected.
- All copy renders via i18n (pl + en); no hardcoded strings.

**Implementation Note**: Frontend has no test runner — verification of behavior is manual.

---

## Testing Strategy

### Unit Tests:

- `test_inventory_sheets.py` — append rows match header order; round-trip read via `get_inventory_count`; shared-`count_id` guard; cache invalidation; enum/date/None serialization (mirror `test_sheets_write.py`).
- Model validation — `Field(ge=0)` on qty, `Field(min_length=1)` on `lines` (422).

### Integration Tests:

- `test_inventory_submit.py` — submit happy path (seed: not-persisted warning; sheet: append called); auth 401; empty lines 422; unknown product / missing setting 400.

### Manual Testing Steps:

1. Sheet mode: open `/captain-v2/inventory-count`, confirm all location products list.
2. Enter stock for a subset, leave some blank, confirm + submit → success toast; verify only entered products produced lines (via the Sheet).
3. Re-submit different values → a **new** snapshot (append-only) appears in the Sheet.
4. Reload mid-count → draft restored.
5. Confirm `/captain-v2` ordering still works unchanged.

## Performance Considerations

Negligible. One `append_row` + one `append_rows` per submit; reads use the existing 60s TTL cache. Location product counts are small (pilot scale). Same Sheets-quota profile as an order submit.

## Migration Notes

Before `sheet`-mode use, the operator must create two worksheets with header rows (no auto-provisioning; `_validate_headers` enforces required fields):

- **`inventory_counts`**: `count_id`, `location_id`, `count_date`, `count_user`, `count_submitted_at`, `line_count`, `notes`.
- **`inventory_count_lines`**: `count_line_id`, `count_id`, `product_id`, `current_stock_qty_base`, `count_comment`.

No backfill; no change to existing `orders` / `order_lines` tabs or the pilot data store.

## References

- Change identity: `context/changes/inventory-count/change.md`
- Roadmap slice: `context/foundation/roadmap.md` (S-06, Stream C)
- PRD: `context/foundation/prd.md` (FR-015/016, US-02)
- Pattern to mirror — persistence: `supply-os-v1/app/sheets.py` (`append_order`, `append_order_lines`, `get_order`), `supply-os-v1/app/main.py:250` (`_persist_order`)
- Pattern to mirror — endpoint: `supply-os-v1/app/main.py` (`captain_orderable`, `captain_submit`)
- Pattern to mirror — tests: `supply-os-v1/tests/test_sheets_write.py`, `tests/test_captain_submit.py`
- Pattern to mirror — frontend: `frontend/src/pages/captain-mp/` (page + draft), `frontend/src/apiClient.ts`, `frontend/src/i18n/strings.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend data layer — models + sheets persistence

#### Automated

- [x] 1.1 New unit tests pass: `python -m pytest tests/test_inventory_sheets.py` — ce34e51
- [x] 1.2 Full suite stays green: `python -m pytest` — ce34e51
- [x] 1.3 Lint clean: `ruff check .` — ce34e51

#### Manual

- [x] 1.4 Header constants match the intended Google Sheet columns (Migration Notes) — ce34e51

### Phase 2: Backend endpoints

#### Automated

- [x] 2.1 Endpoint tests pass: `python -m pytest tests/test_inventory_submit.py` — ac7144b
- [x] 2.2 Full suite green: `python -m pytest` — ac7144b
- [x] 2.3 Lint clean: `ruff check .` — ac7144b

#### Manual

- [x] 2.4 Captain token (sheet mode): products list, submit returns count_id
- [x] 2.5 No supplier order touched by the flow — ac7144b

### Phase 3: Frontend inventory screen

#### Automated

- [x] 3.1 Build + typecheck + lint pass: `npm run build && npm run lint` — 5cebc66

#### Manual

- [x] 3.2 Screen lists every product configured for the location
- [x] 3.3 Enter + confirm + submit creates a snapshot (only entered products → lines)
- [x] 3.4 Reload mid-count restores the draft; discard clears it
- [x] 3.5 Existing `/captain-v2` ordering flow unaffected
- [x] 3.6 All copy via i18n (pl + en); no hardcoded strings
