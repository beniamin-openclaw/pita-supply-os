# Manager/Captain Queue UX Fixes — Implementation Plan

## Overview

Fix three independent, owner-reported UX bugs on the Manager/Captain screens,
each in its own phase so it can be verified and reverted on its own:

1. **"[object Object]" error messages** — FastAPI 422 validation errors carry
   `detail` as an array of objects; the frontend stringifies it naively.
2. **Strikethrough "Anulowane przez managera" on a freshly-opened order** — the
   read-only line table treats `manager_final_qty = 0` as "cancelled" regardless
   of order status, so every line of a not-yet-dispatched order looks dropped.
3. **New orders not at the top of the Manager queue** — the queue sorts by
   delivery cutoff (ascending), so orders without a cutoff sink to the bottom;
   compounded by a 60 s refresh + 60 s backend cache.

All three are grounded to specific lines (see Key Discoveries). No data-model or
API-contract changes; this is purely display/sort/caching behavior.

## Current State Analysis

- **Bug 1** — `frontend/src/apiClient.ts:119-124` (`request`) and the parallel
  block in `apiPostFormData` (~`:205-216`) build `ApiError.detail` via
  `String(payload.detail)`. For a 422, `payload.detail` is
  `[{loc, msg, type}, …]`, so `String(...)` yields `"[object Object]"`. Every
  render site interpolates that string verbatim: `CaptainMP.tsx` (`toast.*Error`),
  `OrderEditPage.tsx` (`orders.editToast.error`), `ManagerPage.tsx`
  (`manager.actionError`). The i18n layer (`i18n/index.ts` interpolate) is not at
  fault — the damage is done upstream in `apiClient`.
- **Bug 2** — `frontend/src/pages/manager/lib/managerLine.ts:66-77`
  `lineVisualState(line)` returns `"cancelled"` whenever
  `manager_final_qty_purchase === 0 && captain_final > 0`. That raw-0 rule is
  correct only AFTER dispatch (manager genuinely dropped a line); for
  `captain_submitted` / `manager_claimed` a 0 means "manager hasn't set it yet".
  The read-only branch of `OrderLineTable.tsx:96` and the non-editable
  `managerSummary(detail.lines)` in `OrderDetailPane.tsx:93` both hit this path,
  so opening an unclaimed order shows amber + `line-through` + the
  `manager.cancelledLine` label ("Anulowane przez managera") on every line. The
  EDITABLE branch (`lineVisualStateWithQty`, `OrderLineTable.tsx:95`) is correct
  and stays untouched — a manager who actively types 0 SHOULD see the line as
  cancelled live.
- **Bug 3** — `supply-os-v1/app/main.py:635-646`: for `CAPTAIN_SUBMITTED` the
  sort key is `(cutoff_iso or _FAR_FUTURE, -captain_submitted_at)`. Orders whose
  supplier has no parseable `delivery_days`/`cutoff_time` get `_FAR_FUTURE` and
  sink below every cutoff-bearing order. Freshness is also bounded by the
  frontend poll (`ManagerPage.tsx:93`, `setInterval(loadQueue, 60_000)`) and the
  backend `orders` TTL cache (`sheets.py` `DEFAULT_TTL_SECONDS = 60`).

## Desired End State

- A 422 (or any non-string `detail`) renders a readable, field-aware message in
  every toast/banner — never "[object Object]".
- Opening a `captain_submitted` or `manager_claimed` order shows untouched lines
  as neutral (Manager zamawia = what the captain asked), no strike/amber. A
  `manager_sent`/`closed` order still shows a genuinely zeroed line as cancelled.
- A newly submitted order appears at the TOP of the Manager queue, and the queue
  reflects new orders within ~20 s (auto) without manual action.

### Key Discoveries:

- `apiClient.ts:122` — `String(detail)` on a 422 array is the single root cause
  for Bug 1; fixing it centrally fixes every call site at once.
- `managerLine.ts:70` — the raw-`0`-means-cancelled rule is status-blind; the fix
  is to make "cancelled-from-persisted" conditional on the order being dispatched.
- Bug 2 blast radius is exactly two files (`OrderLineTable.tsx`,
  `OrderDetailPane.tsx`) — no other caller of `lineVisualState`/`managerSummary`
  exists (grep-confirmed).
- `seedDrafts` already seeds the draft qty from `effectiveManagerQtyPurchase`
  (captain fallback), so the EDITABLE view is already correct — only the
  read-only/persisted path is wrong.
- `_read_with_ttl(worksheet, model, ttl_seconds=…)` already takes a per-call TTL,
  so orders/order_lines can refresh faster WITHOUT touching master-data caching.

## What We're NOT Doing

- No change to the EDITABLE line visual (live 0 = cancelled stays — it's correct).
- No new order status, no cancel/delete capability (that's the separate
  `order-cancel-with-trace` change).
- No localization of FastAPI validation `msg` text (English msgs are acceptable
  for the pilot; we only stop rendering "[object Object]").
- No master-data cache TTL change — only `orders` / `order_lines` refresh faster.
- No backend force-refresh/cache-bust endpoint (manual "Odśwież" stays as-is; the
  20 s TTL already makes it near-fresh).
- No change to the `manager_sent` queue sort (newest-dispatched-first stays).

## Implementation Approach

Three self-contained phases, ordered cheapest-first. Phase 1 and 2 are
frontend-only; Phase 3 touches backend sort + cache and the frontend poll. Each
phase is independently buildable, testable, and revertible.

## Phase 1: Readable API error messages (Bug 1)

### Overview

Stop rendering "[object Object]" by formatting a non-string `detail` (the 422
validation array) into a readable string at the single choke point in
`apiClient`, so all existing toast/banner call sites benefit unchanged.

### Changes Required:

#### 1. Central error-detail formatter

**File**: `frontend/src/apiClient.ts`

**Intent**: Extract a small helper that turns a response `payload.detail` into a
human-readable string, and use it in both `request` and `apiPostFormData` instead
of the bare `String(detail)`. A string `detail` passes through unchanged; an
array of FastAPI validation errors becomes a `"; "`-joined list of
`"<field>: <msg>"` (field = last segment of each item's `loc`, skipping the
leading `"body"`); any other shape falls back to `resp.statusText`.

**Contract**: New module-internal helper, e.g.
`function formatErrorDetail(payload: unknown, fallback: string): string`. Replace
the two `String((payload as { detail }).detail)` expressions
(`apiClient.ts:120-123` and the `apiPostFormData` block) with calls to it.
`ApiError.detail` stays typed `string`, so every consumer
(`CaptainMP.tsx`, `OrderEditPage.tsx`, `ManagerPage.tsx`) is untouched
(grep-confirmed: all consumers only display `.detail`, none parse/branch on it).

#### 2. Unit test for the formatter

**File**: `frontend/src/apiClient.test.ts` (new)

**Intent**: Lock the formatter's behavior so the "[object Object]" regression
can't return. Follow the existing pure-function test pattern
(`src/pages/captain-mp/lib/compute.test.ts`, `src/auth.test.ts`): explicit
`import { describe, it, expect } from "vitest"`, direct import, no mocking.

**Contract**: Export `formatErrorDetail` from `apiClient.ts` (or test via a thin
exported wrapper). Cases: (a) a 422 array `[{loc:["body","x"],msg:"field required"}]`
→ readable `"x: field required"`; (b) a string `detail` passes through unchanged;
(c) a missing/oddly-shaped `detail` returns the fallback.

### Success Criteria:

#### Automated Verification:

- Typecheck + build pass: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`
- Unit tests pass: `cd frontend && npm run test`

#### Manual Verification:

- Triggering a 422 (e.g. submit with an empty required field) shows a readable
  field message in the toast, not "[object Object]".
- A normal 4xx with a string `detail` (e.g. 409 claim conflict) still shows that
  string verbatim.

---

## Phase 2: Status-aware "cancelled" line visual (Bug 2)

### Overview

Make the persisted "cancelled" row visual (amber + strike + "Anulowane przez
managera") fire only when the order was actually dispatched
(`manager_sent`/`closed`). For `captain_submitted`/`manager_claimed`, an untouched
line (`manager_final = 0`) renders neutral — Manager zamawia shows the captain's
quantity.

### Changes Required:

#### 1. Status-aware visual helpers

**File**: `frontend/src/pages/manager/lib/managerLine.ts`

**Intent**: Teach `lineVisualState` (and the `managerSummary` non-draft path) that
a raw `manager_final = 0` only means "cancelled" when the order is dispatched.
When not dispatched, fall through to the effective-qty rule (which renders a
captain-equals line as neutral).

**Contract**: Add an explicit `dispatched: boolean` parameter to
`lineVisualState(line, dispatched)` and thread it through `managerSummary(lines,
effectiveQtyFor?, dispatched?)`. The raw-0 `"cancelled"` short-circuit
(`managerLine.ts:70-72`) runs only when `dispatched` is true. The EDITABLE
`lineVisualStateWithQty` path is unchanged.

#### 2. Pass order status into the table + summary

**File**: `frontend/src/pages/manager/OrderLineTable.tsx`,
`frontend/src/pages/manager/OrderDetailPane.tsx`

**Intent**: Derive `dispatched` from the order status in `OrderDetailPane`
(`detail.status === "manager_sent" || detail.status === "closed"`) and pass it to
both the `OrderLineTable` and the non-editable `managerSummary` call so the table
rows and the summary strip agree.

**Contract**: `OrderLineTable` gains a `dispatched?: boolean` prop used in its
read-only branch (`OrderLineTable.tsx:96`); `OrderDetailPane.tsx:93` passes the
same `dispatched` into `managerSummary`. No change to the editable branch or the
`drafts` flow. Blast radius is exactly these two files (grep-confirmed:
`lineVisualStateWithQty`, the editable path, is not touched).

#### 3. Unit test for the status-aware visual

**File**: `frontend/src/pages/manager/lib/managerLine.test.ts` (new)

**Intent**: Lock the exact bug: an undispatched line with `manager_final = 0` and
`captain_final > 0` must be `"neutral"`, while a dispatched one stays
`"cancelled"`. Pure-function test, same pattern as `compute.test.ts`.

**Contract**: Cases on `lineVisualState(line, dispatched)`: (a) `manager_final=0,
captain=1, dispatched=false` → `"neutral"`; (b) same line `dispatched=true` →
`"cancelled"`; (c) `manager_final` differing-and-nonzero → `"changed"` regardless
of `dispatched`. Optionally assert `managerSummary` change-count agrees.

### Success Criteria:

#### Automated Verification:

- Typecheck + build pass: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`
- Unit tests pass: `cd frontend && npm run test`

#### Manual Verification:

- Opening a `captain_submitted` order (before "Przejmij"): every line is neutral,
  Manager zamawia shows the captain quantity, no strike, no "Anulowane przez
  managera".
- After "Przejmij" (manager_claimed), editing a line to 0 still shows it as
  cancelled live (unchanged behavior).
- A `manager_sent` order with a line the manager genuinely zeroed still shows that
  line struck/amber as "Anulowane przez managera".

---

## Phase 3: Queue ordering + freshness (Bug 3)

### Overview

Sort the `captain_submitted` queue newest-first so a new order appears at the top,
and shorten the orders/order_lines refresh window to ~20 s (backend TTL + frontend
poll) so it shows up without manual action — without touching master-data caching.

### Changes Required:

#### 1. Newest-first queue sort

**File**: `supply-os-v1/app/main.py`

**Intent**: Change the `CAPTAIN_SUBMITTED` branch of `manager_queue` to sort by
most-recent `captain_submitted_at` first, instead of by `cutoff_iso`. `cutoff_iso`
stays on the response (the UI still shows it as a badge); it is just no longer the
primary sort key. The `MANAGER_SENT` sort is unchanged.

**Contract**: In `manager_queue` (`main.py:635-646`), the `captain_submitted`
sort key becomes `-captain_submitted_at.timestamp()` (newest first; `None`
submit-time sorts last). Remove the `cutoff_iso`-primary key for this branch.

#### 2. Faster orders/order_lines cache

**File**: `supply-os-v1/app/sheets.py`

**Intent**: Refresh the orders and order_lines worksheets on a shorter TTL than
master data so a freshly submitted order surfaces within ~20 s, while products /
suppliers / settings keep the 60 s TTL (they change rarely; no reason to add Sheet
reads).

**Contract**: Add an `ORDERS_TTL_SECONDS = 20` constant and pass it as the
`ttl_seconds` argument in `load_orders` and `load_order_lines`
(`_read_with_ttl("orders", Order, ORDERS_TTL_SECONDS)` etc.). Default
`DEFAULT_TTL_SECONDS` and all master-data reads are untouched.

#### 3. Faster frontend poll

**File**: `frontend/src/pages/ManagerPage.tsx`

**Intent**: Poll the queue every ~20 s so the new TTL is actually observed (a 60 s
poll would mask the 20 s cache).

**Contract**: Change `setInterval(loadQueue, 60_000)` (`ManagerPage.tsx:93`) to
`20_000`. Manual "Odśwież" (`loadQueue`) is unchanged.

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `cd supply-os-v1 && python -m pytest`
- Backend lint passes: `cd supply-os-v1 && ruff check .`
- Frontend build + lint pass: `cd frontend && npm run build && npm run lint`

#### Manual Verification:

- Submitting a new order makes it appear at the TOP of the Manager queue (after a
  refresh tick, ≤ ~20 s, or immediate on "Odśwież").
- Orders with and without a supplier cutoff both sort by recency; the cutoff badge
  still renders where present.
- No regression in the `manager_sent` (sent) queue ordering.

---

## Testing Strategy

### Unit Tests:

- Frontend **does** have Vitest wired (`package.json` `"test": "vitest run"`,
  `vite.config.ts` test block, existing `auth.test.ts` / `compute.test.ts` /
  `CaptainTabs.test.tsx`) — `frontend/AGENTS.md`'s "no test runner" line is stale.
  Bug 1 (`formatErrorDetail`) and Bug 2 (status-aware `lineVisualState`) are pure
  functions and get unit tests (`apiClient.test.ts`, `managerLine.test.ts`)
  following the `compute.test.ts` pattern.
- Backend: no existing test asserts the current cutoff-first `manager_queue` order
  (grep-confirmed — sort tests use single-order payloads), so the recency sort
  needs no test update; the full suite must stay green.

### Manual Testing Steps (via preview):

1. Manager screen → open a `captain_submitted` order → confirm neutral lines, no
   strike (Bug 2).
2. Captain submit with an empty required field → confirm readable error, not
   "[object Object]" (Bug 1).
3. Submit a fresh order → confirm it lands at the top of the queue within ~20 s
   (Bug 3).

## Performance Considerations

`ORDERS_TTL_SECONDS = 20` + 20 s frontend poll ≈ 3 queue reads/min for a single
manager — well under Google Sheets' ~60 reads/min/user quota at pilot scale. Master
data stays at 60 s so total read volume barely moves. Post-Supabase the quota
concern disappears entirely.

## Migration Notes

None — no schema, data, or API-contract change. Each phase is revertible by
reverting its commit.

## References

- Backlog memory: `manager-ux-feedback-backlog` (grounded 2026-06-16)
- Bug 1: `frontend/src/apiClient.ts:119-124`
- Bug 2: `frontend/src/pages/manager/lib/managerLine.ts:66-77`,
  `OrderLineTable.tsx:88-107`, `OrderDetailPane.tsx:89-93`
- Bug 3: `supply-os-v1/app/main.py:635-646`, `sheets.py` `DEFAULT_TTL_SECONDS`,
  `frontend/src/pages/ManagerPage.tsx:93`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Readable API error messages (Bug 1)

#### Automated

- [x] 1.1 Typecheck + build pass: `cd frontend && npm run build` — bce9d39
- [x] 1.2 Lint passes: `cd frontend && npm run lint` — bce9d39
- [x] 1.3 Unit tests pass: `cd frontend && npm run test` — bce9d39

#### Manual

- [x] 1.4 422 (empty required field) shows a readable field message, not "[object Object]" — verified: live seed backend returned `detail:[{loc:["body","lines"],msg:"Field required"}]`; `formatErrorDetail` unit test asserts → `"lines: Field required"`
- [x] 1.5 A string-detail 4xx (e.g. 409 claim conflict) still shows that string verbatim — verified: string-passthrough unit test

### Phase 2: Status-aware "cancelled" line visual (Bug 2)

#### Automated

- [x] 2.1 Typecheck + build pass: `cd frontend && npm run build` — e61ba59
- [x] 2.2 Lint passes: `cd frontend && npm run lint` — e61ba59
- [x] 2.3 Unit tests pass: `cd frontend && npm run test` — e61ba59

#### Manual

> Verification note (2026-06-16): Bug 2 logic is unit-tested at the exact bug
> condition (`managerLine.test.ts`: undispatched `manager_final=0` → neutral;
> dispatched → cancelled; differing-nonzero → changed). Full in-browser
> confirmation needs a real order on the Manager screen — local seed mode serves
> an empty queue and local dev can't reach Railway prod (CORS). These three are
> owner-confirmed on the deployed app post-push.

- [ ] 2.4 captain_submitted order: lines neutral, captain qty shown, no strike/"Anulowane" (owner, on deploy)
- [ ] 2.5 manager_claimed: typing 0 still shows the line cancelled live (unchanged) (owner, on deploy)
- [ ] 2.6 manager_sent: a genuinely zeroed line still shows struck/amber "Anulowane przez managera" (owner, on deploy)

### Phase 3: Queue ordering + freshness (Bug 3)

#### Automated

- [x] 3.1 Backend tests pass: `cd supply-os-v1 && python -m pytest` — c64d123
- [x] 3.2 Backend lint passes: `cd supply-os-v1 && ruff check .` — c64d123
- [x] 3.3 Frontend build + lint pass: `cd frontend && npm run build && npm run lint` — c64d123

#### Manual

> Verification note (2026-06-16): Bug 3 backend sort is exercised by the green
> 335-test suite (no test asserted the old cutoff-first order). Newest-first +
> ~20s freshness are owner-confirmed on the deployed app with real orders.

- [ ] 3.4 New order appears at the TOP of the Manager queue (≤ ~20 s or on Odśwież) (owner, on deploy)
- [ ] 3.5 Orders with and without a cutoff both sort by recency; cutoff badge still renders (owner, on deploy)
- [ ] 3.6 No regression in the manager_sent (sent) queue ordering (owner, on deploy)
