# Manager cancels an order (soft-delete) with a who/when/why trace

## Overview

Add a Manager-only **cancel** verb: a `captain_submitted` or `manager_claimed` order moves to `cancelled` (soft-delete, never hard-delete), recording a full trace — `cancelled_at` + `cancelled_by` + `cancel_reason` — in dedicated columns. The status enum + UI label already exist; this wires the endpoint, the persistence columns, and the Manager UI. Mirrors `manager_release` (claimed→submitted with a required reason) in shape and guards.

Backend + frontend + a Supabase migration (3 nullable columns). Grounded 2026-06-17.

## Current State Analysis

- `OrderStatus.CANCELLED = "cancelled"` exists (`models.py`); the orders status CHECK constraint already allows `'cancelled'` (`migrations/0001_initial_schema.sql`) — no constraint change. UI label `orders.status.cancelled` ("Anulowane") exists. **No endpoint sets it; no delete.**
- `manager_release` (`main.py`) is the template: persistent-backend guard → `invalidate_cache("orders")` → `get_order` → status gate (409 otherwise) → `update_order(status=…, …)` → response model. Manager actions use `manager_sent_at`/`manager_user` proxies.
- Persistence: `Order` (`models.py`) has no cancel fields. Supabase `_ORDER_COLUMNS` (`supabase_backend.py:103`) lists the orders columns; `_TIMESTAMPTZ_COLS` (`:142`) lists timestamptz columns for ISO handling. Sheets `update_order` writes only columns present in the sheet header, and `_validate_headers` requires only no-default model fields — so new **optional** fields degrade gracefully on Sheets (status still flips; trace columns dropped if the tab lacks them). Prod is Supabase (S-10), so the migration is the real path.
- `manager_queue` filters by an explicit `status` param (default `captain_submitted`), so cancelled orders are already excluded from the active queue. `captain_orders` lists the Captain's own orders with their status — a cancelled order correctly shows as "Anulowane" there.
- Frontend: `api.managerRelease(order_id, reason)` + the manager release UI (reason prompt) are the pattern to mirror for `managerCancel`.

## Desired End State

- A Manager viewing a `captain_submitted` or `manager_claimed` order can cancel it with a required reason; the order leaves the active queue and is stamped `cancelled` + who/when/why.
- Cancelling from any other status → 409. Seed/non-persistent backend → 503 (mirrors release).
- The trace is durable in `orders.cancelled_at` / `cancelled_by` / `cancel_reason` (Supabase); CI exercises the new column round-trip.
- No hard delete; no change to the struck-through "cancelled line" visual (cancel does not zero `manager_final`).

## What We're NOT Doing

- No cancel from `manager_sent` (dispatched) or `closed` — out of scope (supplier already emailed).
- No Captain-side cancel button (Manager-only per owner decision).
- No hard delete / row removal — soft-delete only.
- No supplier notification on cancel (internal state only).
- No change to `OrderDetailPane.tsx:92` `dispatched` logic (cancel doesn't zero lines, so the qty-0 struck-through visual isn't reached).

## Phase 1: Backend — cancel endpoint + trace columns + migration

### Changes Required

#### 1. Order model — trace fields

**File**: `supply-os-v1/app/models.py` (`Order`)

**Contract**: Add `cancelled_at: Optional[datetime] = None`, `cancelled_by: Optional[str] = None`, `cancel_reason: str = ""`. All optional/defaulted → backward compatible (existing rows + Sheets without the columns still parse).

#### 2. Cancel request/response models

**File**: `supply-os-v1/app/models.py`

**Contract**: `ManagerCancelRequest(reason: str = Field(min_length=1, max_length=500))` and `ManagerCancelResponse(order_id: str, status: OrderStatus)` — mirrors `ManagerReleaseRequest/Response`.

#### 3. Cancel endpoint

**File**: `supply-os-v1/app/main.py`

**Contract**: `POST /api/manager/cancel/{order_id}` (`Depends(require_manager)`). Persistent-backend guard (503 else); `invalidate_cache("orders")`; `get_order` (404 else); status must be `captain_submitted` OR `manager_claimed` → else 409 (message names the current status). On success: `update_order(order_id, status=cancelled, cancelled_at=now_utc.isoformat(), cancelled_by="manager-default", cancel_reason=reason.strip())`. Return `ManagerCancelResponse`. Place next to `manager_release`.

#### 4. Supabase persistence

**Files**: `supply-os-v1/app/supabase_backend.py`, `supply-os-v1/migrations/0004_add_order_cancel_trace.sql` (new)

**Contract**: Add `cancelled_at`, `cancelled_by`, `cancel_reason` to `_ORDER_COLUMNS`; add `cancelled_at` to `_TIMESTAMPTZ_COLS`. Migration `0004`: `ALTER TABLE orders ADD COLUMN cancelled_at timestamptz, ADD COLUMN cancelled_by text, ADD COLUMN cancel_reason text NOT NULL DEFAULT ''` (additive, nullable/defaulted — no backfill, no constraint change). No bare `%` in SQL comments (psycopg2 paramstyle — the 0003 lesson).

#### 5. Backend tests

**File**: `supply-os-v1/tests/test_manager_dispatch.py` (or a new `test_manager_cancel.py`)

**Contract**: cancel from `captain_submitted` → 200, status cancelled, trace persisted (assert `update_order` called with `cancelled_at`/`cancelled_by`/`cancel_reason`); cancel from `manager_claimed` → 200; cancel from `manager_sent` → 409; missing order → 404; seed backend → 503; empty reason → 422. Mirror the existing release tests' mock style.

### Success Criteria

#### Automated
- [ ] 1.1 `cd supply-os-v1 && /opt/homebrew/bin/python3 -m ruff check .`
- [ ] 1.2 `cd supply-os-v1 && /opt/homebrew/bin/python3 -m pytest -q`

#### Manual
- [ ] 1.3 (end-to-end with Phase 2 on deploy; migration applied to prod Supabase first)

## Phase 2: Frontend — Manager cancel button + reason

### Changes Required

#### 1. API + types

**Files**: `frontend/src/types.ts`, `frontend/src/apiClient.ts`

**Contract**: `ManagerCancelRequest { reason: string }` + `ManagerCancelResponse { order_id; status }`; `api.managerCancel(order_id, reason)` → `POST /api/manager/cancel/{id}` (mirrors `managerRelease`).

#### 2. Cancel control in the Manager order view

**Files**: `frontend/src/pages/manager/OrderDetailPane.tsx` (+ `ManagerPage.tsx` action wiring, mirroring release)

**Intent**: Offer "Anuluj zamówienie" only when status is `captain_submitted` or `manager_claimed`; require a reason (reuse the release reason-prompt pattern); on success refresh the queue so the order drops out + toast.

**Contract**: Button visible only for the two cancellable statuses; confirm + required reason; calls `api.managerCancel`; on success re-loads the queue/clears selection. No change to dispatch/claim/release controls.

#### 3. i18n

**File**: `frontend/src/i18n/strings.ts`

**Contract**: PL+EN keys — button label ("Anuluj zamówienie"), reason prompt/placeholder, confirm, success toast, and (if needed) a short cancelled banner. Copy in `src/i18n/` only.

### Success Criteria

#### Automated
- [ ] 2.1 build · 2.2 lint · 2.3 test

#### Manual (owner, on deploy)
- [ ] 2.4 Cancel a `captain_submitted` test order → drops from queue, status "Anulowane", trace stored.
- [ ] 2.5 Cancel button absent on a `manager_sent` order.

## Migration Notes

- **Apply `0004` to prod Supabase BEFORE deploying the backend code** (the cancel write targets the new columns). Additive + nullable → safe, no backfill. CI applies migrations, so the test path is covered.
- Sheets (legacy/fallback): add `cancelled_at` / `cancelled_by` / `cancel_reason` columns to the `orders` tab if still used; absent → status still flips, trace silently dropped (graceful).

## References

- Memory: `manager-ux-feedback-backlog` (feature spec + latent `dispatched` note)
- Template: `manager_release` (`main.py`), `ManagerReleaseRequest/Response` (`models.py`), `api.managerRelease` (`apiClient.ts`)
- Persistence: `supabase_backend.py` `_ORDER_COLUMNS` / `_TIMESTAMPTZ_COLS`; `migrations/0001` orders DDL (status CHECK already allows `cancelled`)

## Progress

> `- [ ]` pending, `- [x]` done; append ` — <sha>`.

### Phase 1: Backend cancel endpoint + trace columns + migration

#### Automated
- [x] 1.1 ruff — 7a62356
- [x] 1.2 pytest (incl. cancel cases, 391) — 7a62356

#### Manual
- [ ] 1.3 e2e on deploy (migration applied first)

### Phase 2: Frontend cancel button + reason

#### Automated
- [x] 2.1 build — 3dfdaef
- [x] 2.2 lint — 3dfdaef
- [x] 2.3 test (57) — 3dfdaef

#### Manual
- [ ] 2.4 cancel drops order from queue + trace stored
- [ ] 2.5 button absent on manager_sent
