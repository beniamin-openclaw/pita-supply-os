# Order `ordered_by` ("who orders") Implementation Plan

## Overview

Captain order submit gains a REQUIRED free-text "who orders" attribution (`ordered_by`). It is captured on the order at submit time, persisted, and surfaced to the Manager in both the queue and the order-detail view. The field mirrors the established `received_by` (Receipt) and `count_user` (InventoryCount) pattern: **required (`min_length=1`) on the input request, `Optional[str] = None` on the persisted model** (legacy rows carry no value).

## Current State Analysis

- `CaptainSubmitRequest` (`app/models.py`) has no attribution field; the captain submits anonymously (`Order.captain_user` is a location proxy, not a person).
- The two analogous flows already do exactly what we want:
  - Receipt: `ReceiptSubmitRequest.received_by: str = Field(min_length=1)` (input, required) → `Receipt.received_by: Optional[str] = None` (stored).
  - Inventory: `InventoryCountSubmitRequest.count_user: str = Field(min_length=1)` → `InventoryCount.count_user: Optional[str] = None`.
- Persistence reality (verified):
  - **Supabase** (`app/supabase_backend.py`): `orders` round-trips through an explicit `_ORDER_COLUMNS` list (`:103-109`). Reads are `SELECT *` + `model_cls(**dict(m))` (auto-pick any new DB column); **writes/updates are gated by `_ORDER_COLUMNS`** — a new Pydantic field NOT in that list is silently dropped on INSERT. So the one edit needed is adding `"ordered_by"` to `_ORDER_COLUMNS`.
  - **Sheets** (`app/sheets.py`): `append_order` serializes via `_model_to_row(order, column_order)` where `column_order` is the **live sheet header row**; reads via `_read_with_ttl` with a None-filter. `_validate_headers` only requires fields with no default, so an `Optional` `ordered_by` never trips `ConfigDriftError`. **No `sheets.py` source edit is needed** — but the value only persists once the live `orders` sheet tab actually has an `ordered_by` column (a manual operator step, like the migration).
  - **Seed** (`app/seed_loader.py`): does **not** load or persist orders at all — it only loads the 5 master-data CSVs, and the seed backend is `SUPPORTS_PERSISTENCE = False`. **There is no `orders.csv` seed file.**
- The Captain submit screen (`frontend/src/pages/captain-mp/CaptainMP.tsx`) assembles the `CaptainSubmitRequest` in `handleSubmit` (`:356-361`). The receiving (`ReceiveDeliveryPage.tsx`) and inventory (`InventoryCountPage.tsx`) screens already collect a required name with a plain `<input type="text">`, a required-asterisk label, a helper line, and a submit gate — the exact UI to copy.
- Manager render points: queue card `ManagerQueue.tsx` (`QueueCard`, bottom metadata row `:182-189`), detail header `OrderDetailPane.tsx` (`:122-140`). Both already conditionally render optional fields (`{item.captain_submitted_at && …}`).

### Key Discoveries

- **Deviation from the original spec (grounded in code reality):** the spec said "add `ordered_by` to seed `orders.csv`" and "round-trip in `seed_loader.py`/`sheets.py`". **There is no `orders.csv` and `seed_loader.py` has no orders path** — orders persist only through sheets/supabase. The round-trip goal is fully met by `models.py` + `supabase_backend._ORDER_COLUMNS` (+ sheets auto-serialization). The sheets WRITE test's mock header (`tests/test_sheets_write.py` `ORDER_HEADERS`) is updated so the column is exercised in the sheet-backed path. This is a defensible deviation: the objective (order carries `ordered_by`, round-tripped in the persistent backends) is unchanged and achieved.
- **Production-safety prerequisite (not applied in this run):** adding `"ordered_by"` to `_ORDER_COLUMNS` makes `append_order` emit the column on every INSERT. In prod Supabase the column must exist first, or captain submit breaks. We therefore **create** migration `migrations/0005_add_ordered_by.sql` (idempotent `ADD COLUMN IF NOT EXISTS`, mirroring `0004_add_order_cancel_trace.sql`) but **do NOT apply it** — the user runs it on prod before deploying. Local build/test runs against the seed/mock backends only.
- `update_order`'s allowlist is the same `_ORDER_COLUMNS`; the Captain edit (PATCH) does not send `ordered_by`, so the submit value persists untouched — matches the spec.
- Reads need no per-backend mapping: Supabase `SELECT *` and Sheets `**cleaned` both auto-pick a present column.

## Desired End State

- `POST /api/captain/submit` rejects a body missing/blank `ordered_by` with **422**; a valid submit stores `ordered_by` on the `Order`.
- `GET /api/manager/queue` and `GET /api/manager/order/{id}` return `ordered_by` on each item/detail.
- The Captain submit screen has a required "Kto zamawia / Who orders" field (PL+EN via i18n) that blocks submit until filled and sends `ordered_by` in the request.
- The Manager sees "Zamówił: {name}" on the queue card and in the order-detail header.
- `python -m pytest` green (incl. new 422 + passthrough tests); frontend `build` + `lint` green.
- A ready-but-unapplied `migrations/0005_add_ordered_by.sql` exists.

## What We're NOT Doing

- **No prod migration applied; no commit/push/deploy.** Local seed/mock testing only.
- No `orders.csv` / `seed_loader.py` change (no such path exists).
- No change to the Captain **edit** (PATCH) contract — `ordered_by` is not required there and is not overwritten.
- No per-person identity/auth — `ordered_by` is free-text attribution only (the v0 Non-Goal stands), exactly like `received_by` / `count_user`.
- No backfill of legacy orders (they keep `ordered_by = None` / blank).
- No new Manager-side filtering/sorting by `ordered_by`.

## Implementation Approach

Three phases: (1) backend round-trip + tests + migration file, gated by `pytest`/`ruff`; (2) frontend Captain submit (required field + send), gated by `build`/`lint`; (3) frontend Manager display, gated by `build`/`lint` + a manual `preview-notes.md` (the preview harness is unavailable here). Each phase copies an existing, proven pattern, so the blast radius is small and reversible.

## Critical Implementation Details

- **Supabase write gate:** the *only* `supabase_backend.py` edit is appending `"ordered_by"` to `_ORDER_COLUMNS` (`:103-109`). `ordered_by` is plain text — do **not** add it to `_TIMESTAMPTZ_COLS`.
- **Migration is created, never applied.** It is a deploy prerequisite the user owns. `migrations/0005_*.sql` must stay percent-sign-free (the integration fixture applies it via `exec_driver_sql`, where `%` is a param marker — see the note in `0004`).
- **Sheets value persistence in prod** also depends on the live `orders` tab gaining an `ordered_by` column (manual operator step). No code change makes this happen; flag it in closeout alongside the migration.

## Phase 1: Backend round-trip + tests + migration file

### Overview

Add the field to the models, carry it through `captain_submit` → persistence → manager responses, add the Supabase column to the write allowlist, write the migration file, and cover it with tests.

### Changes Required:

#### 1. Models

**File**: `supply-os-v1/app/models.py`

**Intent**: Add the required input field and the optional stored/response fields, mirroring `received_by`/`count_user`.

**Contract**:
- `CaptainSubmitRequest`: add `ordered_by: str = Field(min_length=1)` (required input).
- `Order`: add `ordered_by: Optional[str] = None` (stored; legacy-safe).
- `ManagerQueueItem`: add `ordered_by: Optional[str] = None`.
- `ManagerOrderDetail`: add `ordered_by: Optional[str] = None`.

#### 2. Captain submit writes the field

**File**: `supply-os-v1/app/main.py` (`captain_submit`)

**Intent**: Persist `ordered_by=req.ordered_by` on the constructed `Order`. No new validation gate — Pydantic's `min_length=1` already enforces presence.

**Contract**: The `Order(...)` built in `captain_submit` gains `ordered_by=req.ordered_by`. Captain edit (`captain_order_edit`) is left untouched (value persists).

#### 3. Manager responses carry the field

**File**: `supply-os-v1/app/main.py` (`manager_queue`, `manager_order_detail`)

**Intent**: Map `order.ordered_by` onto the `ManagerQueueItem` and `ManagerOrderDetail` built in each route.

**Contract**: Both response constructors gain `ordered_by=order.ordered_by`.

#### 4. Supabase write allowlist

**File**: `supply-os-v1/app/supabase_backend.py` (`_ORDER_COLUMNS`, `:103-109`)

**Intent**: Make `append_order`/`update_order` emit the column. Reads already auto-pick it via `SELECT *`.

**Contract**: Append `"ordered_by"` to `_ORDER_COLUMNS`. Do not touch `_TIMESTAMPTZ_COLS`.

#### 5. Migration file (created, NOT applied)

**File**: `supply-os-v1/migrations/0005_add_ordered_by.sql` (new)

**Intent**: Provide the idempotent DDL the user applies to prod before deploying. Mirror `0004_add_order_cancel_trace.sql` style + header note.

**Contract**:
```sql
-- order-ordered-by: Captain submit captures a required free-text "who orders"
-- (ordered_by). Add one additive, nullable column to orders. No backfill
-- (existing rows keep ordered_by NULL). Apply live to prod Supabase BEFORE
-- deploying the backend code (append_order now writes this column). IF NOT
-- EXISTS so a re-apply is idempotent. Keep this file percent-sign-free.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS ordered_by text;
```

#### 6. Backend tests

**Files**: `supply-os-v1/tests/test_captain_submit.py`, `tests/test_manager_queue.py`, `tests/test_sheets_write.py`, `tests/test_supabase_backend.py`

**Intent**: Lock in the 422 contract and the passthrough; keep existing tests green after the schema change.

**Contract**:
- `test_captain_submit.py`: add two tests mirroring `test_inventory_submit_missing_count_user_422` — (a) body omitting `ordered_by` → 422, (b) `"ordered_by": ""` → 422. Then add `"ordered_by": "Jan Kowalski"` to **every other** existing inline submit body in the file — both the 200 happy-path tests AND the 400 business-gate tests (over-MAX, deviation, critical-under, etc.). Rationale: `ordered_by` is now Pydantic-required, so a body omitting it returns 422 *before* the business-logic gate runs; any 400-expecting test that loses the field would flip 400→422. Only the two new missing/blank-`ordered_by` tests intentionally omit it.
- `test_manager_queue.py`: add an `ordered_by` kwarg to the `_order(...)` builder; assert `payload[...]["ordered_by"]` round-trips in the queue test (`test_queue_returns_only_matching_status`) and the detail test (`test_order_detail_happy_path`).
- `test_sheets_write.py`: add `"ordered_by"` to the `ORDER_HEADERS` mock list and to the `_mk_order(...)` base dict so the sheet write path exercises the column (keeps `len(written_row) == len(ORDER_HEADERS)`).
- `test_supabase_backend.py`: add `"ordered_by": None` to the `order_row` dict in `test_get_order_assembles_parent_and_lines`.

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `cd supply-os-v1 && python3 -m pytest`
- New 422 tests (missing + blank `ordered_by`) pass.
- Manager queue + detail passthrough assertions pass.
- Lint passes: `cd supply-os-v1 && ruff check .`

#### Manual Verification:

- `migrations/0005_add_ordered_by.sql` exists, is idempotent, percent-sign-free, and is NOT applied.

**Implementation Note**: After automated verification passes, proceed — no live backend is touched.

---

## Phase 2: Frontend — Captain submit required field

### Overview

Add the required "who orders" input to the Captain submit screen, gate submit on it, send `ordered_by`, and mirror the type.

### Changes Required:

#### 1. Type

**File**: `frontend/src/types.ts` (`CaptainSubmitRequest`)

**Intent**: Mirror the Pydantic required field.

**Contract**: Add `ordered_by: string;` (required) to `CaptainSubmitRequest`.

#### 2. i18n copy

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Add PL+EN copy for the label, placeholder, required-hint, and the API field-name (for localized 422 messages).

**Contract**: Add `captain.orderedByLabel` (`Kto zamawia` / `Who orders`), `captain.orderedByPlaceholder` (`Imię i nazwisko` / `Full name`), `captain.orderedByRequired` (`Wymagane przed wysłaniem` / `Required before sending`), and `apiError.field.ordered_by` (`Kto zamawia` / `Who orders`). Both `pl` and `en` required.

#### 3. Captain submit form + send

**File**: `frontend/src/pages/captain-mp/CaptainMP.tsx`

**Intent**: Add an `orderedBy` state + a required text input (copy the `InventoryCountPage` `inv-counted-by` block: label with red asterisk, plain `<input type="text">`, helper line), block submit until `orderedBy.trim()` is non-empty, and send `ordered_by: orderedBy.trim()` in the request.

**Contract**: New `useState("")` for `orderedBy`; input rendered in the `<main>` block near the product list; `handleSubmit` guard also returns when `!orderedBy.trim()` and the disabled/confirm gate reflects it; `api.captainSubmit({ … ordered_by: orderedBy.trim() })`. Copy only via `t(...)`; API only via `apiClient`.

### Success Criteria:

#### Automated Verification:

- Frontend builds: `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run build`
- Lint passes: `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run lint`
- Unit tests pass (if any touch helpers): `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run test`

#### Manual Verification:

- Captain submit screen shows the required field; submit is blocked while empty; PL+EN copy renders. Recorded in `verification/preview-notes.md` (preview harness unavailable).

**Implementation Note**: After automated verification, record the manual UI check in `preview-notes.md` and proceed.

---

## Phase 3: Frontend — Manager display

### Overview

Surface `ordered_by` as "Zamówił: X" on the Manager queue card and the order-detail header, with types + i18n.

### Changes Required:

#### 1. Types

**File**: `frontend/src/types.ts` (`ManagerQueueItem`, `ManagerOrderDetail`)

**Intent**: Mirror the optional response fields.

**Contract**: Add `ordered_by?: string | null;` to both interfaces.

#### 2. i18n copy

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Add the interpolated "Zamówił: {value}" labels for queue + detail.

**Contract**: Add `manager.orderedBy` and `manager.detail.orderedBy`, both `{ pl: "Zamówił: {value}", en: "Ordered by: {value}" }`.

#### 3. Queue card render

**File**: `frontend/src/pages/manager/ManagerQueue.tsx` (`QueueCard`, bottom metadata row `:182-189`)

**Intent**: Conditionally render the orderer in the existing flex-wrap metadata row, mirroring the `captain_submitted_at` span.

**Contract**: `{item.ordered_by && <span>{t("manager.orderedBy", { value: item.ordered_by })}</span>}`.

#### 4. Detail header render

**File**: `frontend/src/pages/manager/OrderDetailPane.tsx` (header metadata `:122-140`)

**Intent**: Conditionally render the orderer in the header metadata block, mirroring the existing optional spans.

**Contract**: `{detail.ordered_by && <span>{t("manager.detail.orderedBy", { value: detail.ordered_by })}</span>}`.

### Success Criteria:

#### Automated Verification:

- Frontend builds: `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run build`
- Lint passes: `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run lint`

#### Manual Verification:

- Manager queue card and order detail show "Zamówił: {name}" for an order that carries `ordered_by`, and omit it cleanly when absent (legacy). Recorded in `verification/preview-notes.md`.

**Implementation Note**: Record the manual UI check in `preview-notes.md`; this completes the change.

---

## Testing Strategy

### Unit / API Tests:

- `POST /api/captain/submit` without `ordered_by` → 422; with `""` → 422; valid → 200 and stores it.
- `manager_queue` + `manager_order_detail` carry `ordered_by`.
- Existing submit/sheets/supabase tests stay green after the schema addition.

### Manual Testing Steps (recorded in `preview-notes.md`, harness unavailable):

1. Captain screen: the required "Kto zamawia" field blocks submit when empty; fills and submits.
2. Manager queue: an order shows "Zamówił: {name}".
3. Manager detail: header shows "Zamówił: {name}".
4. Legacy order (no value) renders without an empty "Zamówił:" artifact.

## Performance Considerations

None — one nullable text column and a few passthroughs. No new queries.

## Migration Notes

- `migrations/0005_add_ordered_by.sql` is **created but not applied**. Before any deploy, the user runs it on prod Supabase (`ADD COLUMN IF NOT EXISTS ordered_by text`).
- If the Sheets backend is ever used in prod, add an `ordered_by` column to the `orders` tab so the value persists (non-breaking if absent — value is silently dropped, no error).
- No backfill: legacy orders keep `ordered_by` NULL/blank; the UI hides the label when absent.

## References

- Pattern — Receipt: `app/models.py` `ReceiptSubmitRequest.received_by` / `Receipt.received_by`.
- Pattern — Inventory: `app/models.py` `InventoryCountSubmitRequest.count_user` / `InventoryCount.count_user`.
- Migration mirror: `supply-os-v1/migrations/0004_add_order_cancel_trace.sql`.
- 422 test mirror: `tests/test_inventory_submit.py::test_inventory_submit_missing_count_user_422`.
- Frontend field mirror: `frontend/src/pages/captain-mp/InventoryCountPage.tsx` (`inv-counted-by` block) and `ReceiveDeliveryPage.tsx` (`received_by`).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backend round-trip + tests + migration file

#### Automated

- [x] 1.1 Backend tests pass: `cd supply-os-v1 && python3 -m pytest`
- [x] 1.2 New 422 tests (missing + blank `ordered_by`) pass
- [x] 1.3 Manager queue + detail passthrough assertions pass
- [x] 1.4 Lint passes: `cd supply-os-v1 && ruff check .`

#### Manual

- [x] 1.5 `migrations/0005_add_ordered_by.sql` exists, idempotent, percent-sign-free, NOT applied

### Phase 2: Frontend — Captain submit required field

#### Automated

- [x] 2.1 Frontend builds: `PATH=/opt/homebrew/bin:$PATH npm run build`
- [x] 2.2 Lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint`
- [x] 2.3 Unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test`

#### Manual

- [x] 2.4 Required field blocks submit when empty; PL+EN copy renders — recorded in `preview-notes.md`

### Phase 3: Frontend — Manager display

#### Automated

- [x] 3.1 Frontend builds: `PATH=/opt/homebrew/bin:$PATH npm run build`
- [x] 3.2 Lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint`

#### Manual

- [x] 3.3 Queue card + detail show "Zamówił: {name}"; legacy (absent) renders cleanly — recorded in `preview-notes.md`
