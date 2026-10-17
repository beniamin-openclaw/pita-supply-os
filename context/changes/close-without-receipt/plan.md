# Close Without Receipt Implementation Plan

## Overview

A Manager action "Zamknij bez przyjęcia" for a `manager_sent` order that has no receipt. The
Manager types a required reason; the order goes to `closed` and an `order_events` row
`closed_without_receipt` keeps who, when and why. The screens that read `closed` as "received"
learn to tell the two cases apart.

No migration: the status CHECK already allows `closed` (0001) and `order_events` (0020) has no
CHECK on `event_type`. No prod SQL.

## Current State Analysis

- `closed` is reached today only by the first captain receipt (`captain_receipt_submit`,
  best-effort `manager_sent → closed`) and by the Transport reopen revert. Every reader assumes a
  closed order was received.
- `manager_cancel` (`main.py`) is the template for a reasoned Manager write: `require_manager`,
  503 on a non-persistent backend, `invalidate_cache` + `get_order`, a status gate, a conditional
  `update_order(expected_status=…)` mapping `OrderStatusConflictError` to 409. It is only valid
  before dispatch; a sent order cannot be cancelled.
- `_log_order_event` is best-effort and swallows errors; `backend.append_order_event` raises.
  `manager_order_detail` loads events for sent and closed orders, so `OrderHistorySection` shows
  a new event without wiring.
- Readers of `closed`:
  - `pages/manager/lib/queueAge.ts` `splitClosedLane` keys on `last_received_at`; with no receipt
    it is null, so the order would stay on the board forever.
  - Queue/archive cards (`ManagerQueue.tsx` `QueueCard`) and the detail (`OrderDetailPane.tsx`
    "Zablokowane po przyjęciu") say or imply "received".
  - `TransportPage.tsx` batch detail chip shows "czeka na dostawę" when `received_count` is 0.
  - The Transport reopen gate (`main.py`) already blocks a batch with a closed member (right), and
    the frontend message `manager.transport.send.reopen.errDelivered` says "dostawa jest już
    przyjęta" (wrong for this case).
  - Captain screens show `closed` as "Zrealizowane"; the receive CTA appears only on
    `manager_sent`. The backend still accepts a late receipt on a closed order.

## Desired End State

- `POST /api/manager/close/{order_id}` with `{reason}` (manager only):
  1. 503 when the backend is not persistent (seed).
  2. Invalidate `orders` and `receipts`; 404 when the order is missing.
  3. 400 when the reason is blank after strip (Pydantic `min_length=1` accepts spaces).
  4. 409 unless the status is `manager_sent`.
  5. 409 when a receipt exists (a receipt closes the order itself).
  6. Transport members are allowed (a sent member is never in a draft batch). The TRN marker
     stays, for history.
  7. Status first: `update_order(status="closed", expected_status="manager_sent")`;
     `OrderStatusConflictError` → 409, `OrderNotFoundError` → 404.
  8. Then the trace, strictly: `append_order_event(OrderEvent(event_type=
     "closed_without_receipt", actor="manager-default", details=reason))`. If it raises,
     revert the status (`update_order(status="manager_sent", expected_status="closed")`, logged if
     that fails too) and return 503 — no close without a trace.
  9. Response `{order_id, status: "closed"}`.
- Works on every backend through `_choose_backend()`: supabase (atomic conditional write + event
  insert), sheets (route pre-check + worksheet append; without the `order_events` tab the close
  returns 503), seed (503).
- Frontend:
  - `api.managerClose(orderId, reason)` and the TS request/response types.
  - `OrderDetailPane`: a "Zamknij bez przyjęcia" button when `status === "manager_sent"` and
    there are no receipts — in the post-send branch and in the read-only branch (Transport
    member). The handler in `ManagerPage` mirrors `handleCancel`: draft lock, discard-dirty
    confirm, `window.confirm`, `window.prompt` for the reason, API call, toast, refresh.
  - A closed order with `received_count === 0` (queue/archive card) or no receipts (detail)
    shows a chip "Zamknięte bez przyjęcia"; the detail shows the reason from the event instead
    of "Zablokowane po przyjęciu".
  - `splitClosedLane` falls back to `manager_sent_at` when there is no `last_received_at`.
  - `orderEvents.ts` labels `closed_without_receipt` "Zamknięto bez przyjęcia".
  - Transport batch detail: a closed member with no receipt shows "zamknięte bez przyjęcia"
    instead of "czeka na dostawę"; the reopen message says "przyjęta lub zamknięta".

## What We're NOT Doing

- No migration and no `closed_at` / `close_reason` columns (the event is the trace). The 0004
  cancel columns are not reused: `cancelled_at IS NOT NULL` means "cancelled".
- No reopen of a closed order (a late receipt still lands through the backend; the chip then
  clears itself because `received_count > 0`).
- No captain-side change (`captain-mp/**` is Lane C's). The captain keeps seeing "Zrealizowane";
  a distinct captain label is a follow-up for the coordinator.
- No bulk close. One order at a time, each with its own reason.

## Implementation Approach

### Phase 1: Backend

- `app/models.py`: `ManagerCloseRequest {reason: Field(min_length=1, max_length=500)}`,
  `ManagerCloseResponse {order_id, status}`.
- `app/main.py`: the route next to `manager_cancel`, as above.
- Tests (`tests/test_manager_close.py`, the `_enable_sheet` mocker pattern): happy path (status
  write then event, details = stripped reason, event type), 409 for submitted/claimed/closed, 409
  with a receipt, 400 blank reason, 422 empty reason, 404 missing, 401 captain token, 503 on event
  failure with the revert asserted, 409 on `OrderStatusConflictError`, 503 on seed, Transport
  member allowed with the marker kept. `tests/test_supabase_integration.py`: a contract test
  (conditional close, event round-trip, second close conflicts). `tests/test_manager_queue.py`: a
  closed order with no receipt has `received_count == 0` and `last_received_at` None.

### Phase 2: Frontend

- `types.ts`, `apiClient.ts`, `ManagerPage.tsx` handler + prop, `OrderDetailPane.tsx` button and
  closed-without-receipt display, `ManagerQueue.tsx` chip, `queueAge.ts` fallback,
  `orderEvents.ts` label, `TransportPage.tsx` chip, i18n keys.
- Tests: `queueAge` fallback, `orderEvents` label, `ManagerQueue` chip, `OrderDetailPane` button
  visibility and the reason display, a `ManagerPage` wiring test (confirm → prompt → API with the
  trimmed reason; cancel at the prompt sends nothing), the Transport chip.

### Phase 3: Verify, review, ship

- `/verify`, independent impl review, PR stacked on #72.
- Live check (Ben, prod): close one stale sent order with a reason; it leaves the sent lane, shows
  "Zamknięte bez przyjęcia" with the reason in the history, and the D16 count drops by one.

## Plan review

Two majors and several minors. Each is fixed, accepted or deferred as noted:

- **A closed stale order vanished from every list.** `splitClosedLane` hides a closed order after a
  few days, and the archive aged it by `last_received_at ?? captain_submitted_at`, so an order
  from June that was closed today showed nowhere. `archiveAgeDays` (moved to `queueAge.ts`) returns
  null for a closed order with no receipt, so the archive always shows it. One caveat remains: the
  backend caps the closed lane at 200 orders by `captain_submitted_at`, so a very old order closed
  this way can sit beyond the cap. The live check therefore looks at the detail right after the
  close rather than hunting for the card.
- **Sheets has no atomic guard.** Sheets `update_order` ignores `expected_status`. The revert
  (`_revert_close_without_receipt`) re-reads the order first and writes `manager_sent` back only
  when it is still `closed` and still has no receipt, so a receipt that lands in between is kept.
- The 503 text depends on the revert: "…the order was not closed" when the revert succeeded or
  had nothing to do, and "…could not be reopened, check its status" when it failed.
- A blank reason is rejected with a route 400, not a Pydantic validator, so `models.py` imports
  (which Lane C also edits) stay untouched.
- A Transport member closed this way blocks reopening that batch for good (the existing reopen
  gate refuses a closed member). This is intended: the batch was sent and one of its orders is now
  finished. The reopen message says "przyjęta albo zamknięta bez przyjęcia".
- Race on Supabase: a captain receipt that arrives right after the close still lands, because the
  receipt route accepts a closed order. The order then has a receipt and the chip clears itself.
  Accepted.
- The captain still sees "Zrealizowane" for such an order. Lane C owns `captain-mp/**`, so this is
  a follow-up (see `change.md`).
- Copy: the Manager tab and the archive lane are now both "Zakończone", because "odebrane" is no
  longer always true.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backend

- [x] 1.1 Models + route
- [x] 1.2 Backend tests (route, integration contract, queue)

### Phase 2: Frontend

- [x] 2.1 API client + types + ManagerPage handler
- [x] 2.2 Detail button and closed-without-receipt display
- [x] 2.3 Queue chip, closed-lane fallback, event label, Transport chip + reopen copy
- [x] 2.4 Frontend tests

### Phase 3: Verify, review, ship

- [ ] 3.1 Verify + impl review addressed
- [ ] 3.2 PR open, CI green
