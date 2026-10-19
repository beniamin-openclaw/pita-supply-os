# Manager Queue Control Implementation Plan

## Overview

Three small Manager-side changes that Ben decided on 17.10 (Lane M items 1–3):

1. The queue's supplier filter lists every active ordering supplier, not only those with orders.
2. The queue marks orders that have stalled: claimed and still unsent more than 24 h after the
   captain sent them, and sent more than 3 days ago with no receipt.
3. A manager zero looks the same everywhere (amber, struck through), the Transport city filter
   stops using a strikethrough for "off", and a backup line says "u głównego" in the suggestion
   column.

No migration. One additive response field (`manager_sent_at` on the queue item).

## Current State Analysis

- `frontend/src/pages/ManagerPage.tsx` `supplierOptions` (around :452) is built from the
  submitted/claimed/sent lanes only, so a supplier with no orders (SUP_SPEC, Spec Food) is
  missing from the filter. `api.suppliers(role)` exists and takes the `"manager"` role
  (`apiClient.ts:359`). `lib/orderingSuppliers.ts` `isOrderingSupplier` = active and not
  SUP_INTERNAL.
- The queue item (`models.ManagerQueueItem`, `main.py` `manager_queue`) has
  `captain_submitted_at`, `received_count`, `last_received_at` but no `manager_sent_at`. `Order`
  carries `manager_sent_at`. There is no claim timestamp anywhere: `manager_claim` writes only
  the status, and `order_events` were empty for the stalled orders on prod (plan.md D16).
- `pages/manager/lib/queueAge.ts` already has `inQueueDays` (amber "w kolejce od N dni" on the
  claimed lane at ≥ 3 calendar days since submit) and `splitClosedLane`.
- Manager-zero convention in `OrderLineTable.tsx:126` (`line-through text-amber-700`, row
  `bg-amber-50`, via `lineVisualState*` in `lib/managerLine.ts`). The Transport matrix
  (`transport/TransportMatrix.tsx`) renders a zeroed cell as a plain `0` (read-only span or input).
  The captain's order detail (`captain-mp/OrderDetailPage.tsx`) shows the effective qty `0` in
  the same slate bold as any other number, with only a small "zmienione przez managera" hint.
- `TransportPage.tsx` city tiles: the "off" state is `text-slate-400 line-through`.
- `OrderLineTable.tsx` backup line: suggestion cell renders `—`.

## Desired End State

- The supplier `<select>` in the Manager queue lists all active ordering suppliers (sorted by
  name) plus any supplier that has orders in the queue (an inactive supplier with an open order
  stays filterable). If the suppliers call fails, the filter falls back to the queue-derived list.
- Claimed lane: an order whose `captain_submitted_at` is more than 24 h ago gets a red chip
  "przejęte > 24 h" (tooltip explains it is measured from the captain's send, because the app
  stores no claim time). The lane header shows a red count of such orders.
- Sent lane: an order with `manager_sent_at` more than 72 h ago and `received_count == 0` gets a
  red chip "wysłane > 3 dni bez przyjęcia"; the lane header shows a red count (the lane starts
  collapsed, so the count is what Ben sees). The first receipt closes an order, so the receipt
  guard mostly covers a failed status write; it stays as a safety net.
- The claimed and sent lanes load the newest 200 orders (backend clamp) instead of 50: the
  stalled orders are the oldest in their lane (plan review F1). Older ones are still cut off.
- The amber "w kolejce od N dni" chip stays next to the red one: red is the D16 marker, amber
  says how many days (plan review F4, kept on purpose).
- A manager-zeroed line on the captain's order detail is amber only before a receipt exists;
  after receipt the receipt numbers lead and render as before.
- Transport matrix: a cell whose (draft) qty is 0 while the captain asked for more is amber and
  struck through, read-only and editable. Captain order detail: a line the manager zeroed shows
  the ordered `0` amber and struck through, on an amber card.
- Transport city tile "off": muted with a dashed border, no strikethrough.
- Backup line suggestion cell: "u głównego".

## What We're NOT Doing

- No claim timestamp or claim event (would need either a migration or a per-order event read in
  the queue). The 24 h marker is measured from `captain_submitted_at`, which is the honest
  available signal: a claimed order that the captain sent more than 24 h ago and that is still
  unsent is late regardless of when it was claimed. Follow-up candidate.
- No change to the captain screens beyond the zero display (D16: nothing for the captain).
- No backend filtering or new endpoints. No change to `DispatchPanel.tsx` (Lane E).

## Implementation Approach

Phase 1 is the backend field (additive, optional). Phase 2 is the frontend logic in pure helpers
with unit tests, then the components. Phase 3 verifies and ships.

## Phase 1: Backend queue field

### Changes Required

- `supply-os-v1/app/models.py` `ManagerQueueItem`: `manager_sent_at: Optional[datetime] = None`.
- `supply-os-v1/app/main.py` `manager_queue`: pass `manager_sent_at=order.manager_sent_at`.
- Test in `supply-os-v1/tests/` (the queue tests use a persistent fake backend; find the existing
  `manager_queue` test module and extend it): the sent lane item carries `manager_sent_at`.

### Success Criteria

- `python -m pytest` and `ruff check .` pass.

## Phase 2: Frontend

### Changes Required

1. `frontend/src/types.ts` `ManagerQueueItem.manager_sent_at?: string | null`.
2. `frontend/src/pages/manager/lib/queueAge.ts`: `CLAIMED_OVERDUE_HOURS = 24`,
   `SENT_UNRECEIVED_HOURS = 72`, `isClaimedOverdue(item, now)`, `isSentUnreceived(item, now)`
   (hours since an ISO timestamp, null-safe, status-checked).
3. `frontend/src/pages/manager/lib/supplierOptions.ts` (new): `buildSupplierOptions(suppliers,
   queueLanes)` → active ordering suppliers ∪ queue suppliers (all four lanes, plan review F5),
   by name. Pure, unit-tested.
4. `ManagerPage.tsx`: load `api.suppliers("manager")` once on mount (errors ignored →
   `null` → queue-only fallback); `supplierOptions` uses the helper. Update the comment.
5. `ManagerQueue.tsx`: chips on `QueueCard` (claimed lane → overdue chip, sent lane → unreceived
   chip) and a red count badge in `QueueGroupSection` header. i18n keys
   `manager.queue.claimedOverdue`, `.claimedOverdueTooltip`, `.claimedOverdueCount`,
   `.sentUnreceived`, `.sentUnreceivedTooltip`, `.sentUnreceivedCount`.
6. `TransportMatrix.tsx`: cancelled styling via `lineVisualStateWithQty(captainQty, qty)`.
7. `captain-mp/OrderDetailPage.tsx`: cancelled styling for a manager-zeroed line (pre-delivery
   branch). Minimal edit (Lane C owns the rest of this folder).
8. `TransportPage.tsx` city tile "off" style.
9. `OrderLineTable.tsx` backup suggestion → `t("manager.backupAtPrimary")` = "u głównego".
10. Tests: queueAge helpers in `ManagerQueue.test.tsx` (where the existing helper tests live),
    `supplierOptions.test.ts` (new), `ManagerQueue.test.tsx`
    (chips + header count), `OrderLineTable.test.tsx` (backup text), a TransportMatrix test
    (zeroed cell classes) and an OrderDetailPage test or helper test for the zero styling.

### Success Criteria

- `npm run build`, `npm run lint`, `npm run test` pass (Homebrew node).

## Phase 3: Verify, review, ship

- `/verify`; independent impl review; PR to `main` with green CI.
- Live check after deploy (Ben, prod): the Spec Food entry in the supplier filter; the chips on
  stalled claimed / sent orders; a zeroed Transport cell; the city tiles.

## Testing Strategy

Pure helpers carry the time and option logic (fixed `now`). Component tests assert the rendered
chips/classes. No E2E harness exists; role wiring is unchanged (`api.suppliers("manager")` is
already regression-tested in `apiClient.test.ts`).

## Impl review (a9c64ac)

No blockers or majors. Addressed: screen-reader text for the lane counts (sr-only phrase, short
badge `aria-hidden`); one manager-zero class pair in `lib/managerLine.ts` used by the order table
and the Transport matrix (the order-table input now also strikes and turns amber); a "200+" lane
count with a tooltip when a claimed/sent lane hits `QUEUE_LANE_LIMIT`; tests for the manager-role
suppliers call, the 200 limit and an untouched 0 in the matrix; nits (captain detail strikes only
the number, hours comment, i18n key placement). Left as is: the poll cost of the 200-order lanes
(grows with the real lane size, acceptable today; skip-while-hidden is a follow-up if the sent
lane grows), and the 24 h marker flagging orders held for a later delivery day (Ben's D16 rule).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backend queue field

- [x] 1.1 manager_sent_at on the queue item + test — a9c64ac

### Phase 2: Frontend

- [x] 2.1 Helpers (queueAge, supplierOptions) + tests — a9c64ac
- [x] 2.2 ManagerPage supplier filter — a9c64ac
- [x] 2.3 Queue chips and header counts + tests — a9c64ac
- [x] 2.4 Manager-zero styling, city tiles, backup text + tests — a9c64ac

### Phase 3: Verify, review, ship

- [x] 3.1 Verify + impl review addressed
- [ ] 3.2 PR open, CI green
