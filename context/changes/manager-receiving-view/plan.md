# Manager Receiving View Implementation Plan

## Overview

Give the Manager visibility into what was actually delivered. Goods-receipt data
(`Receipt` / `ReceiptLine`: `received_qty_purchase`, `variance_qty_purchase`,
`discrepancy_count`, `received_with_missing_wz`) already persists, but no
Manager-facing surface shows it — the learning loop `suggested → captain →
manager → RECEIVED` breaks at the Manager's screen. This change weaves that data
into the two existing Manager surfaces (order detail + queue), read-only and
additive, with no schema change.

## Current State Analysis

- **No Manager receipt surface today.** Only the Captain has receipt routes
  (`captain_receipts` [main.py:2362](supply-os-v1/app/main.py:2362),
  `captain_receipt_detail` [main.py:2406](supply-os-v1/app/main.py:2406)).
- **`ManagerOrderDetail` / `ManagerQueueItem` carry no receipt fields**
  ([models.py](supply-os-v1/app/models.py)). Data is persisted but invisible.
- **0..N receipts per order.** `captain_receipt_submit`
  ([main.py:2239](supply-os-v1/app/main.py:2239)) mints a fresh `receipt_id`
  every call, never gates on `order_id`, never changes order status — partial
  deliveries / corrections are real and must be representable.
- **Loaders.** Both persistent backends expose `load_receipts()`,
  `load_receipt_lines()`, `get_receipt(id)` (sheets.py / supabase_backend.py).
  There is **no** targeted "receipts-for-orders" loader — filter `load_receipts()`
  in Python (one cached read; mirrors the F-7 caveat in `manager_queue`). The
  `seed_loader` has **no** receipt functions.
- **`Receipt` summary row already holds `discrepancy_count` +
  `received_with_missing_wz`** → a queue badge needs only `load_receipts()`, no
  line join.
- **Degradation precedent.** `captain_receipts` wraps `load_receipts()` in
  `try/except sheets.WorksheetNotFound → []` ([main.py:2362](supply-os-v1/app/main.py:2362)).
  Manager surfaces must degrade identically: a missing `receipts` tab (or seed
  mode) yields empty receipts, never a 500.
- **FE detail pane** [OrderDetailPane.tsx:154-161](frontend/src/pages/manager/OrderDetailPane.tsx)
  renders `<OrderLineTable>` (already **11 columns**) then a summary strip at
  ~L163 — clean inject point between them.
- **FE queue card** [ManagerQueue.tsx:119-193](frontend/src/pages/manager/ManagerQueue.tsx)
  (`QueueCard`) shows deviation/reason pills at ~L153-180 — the chip slot.
- **Captain mirror to copy** [OrderDetailPage.tsx:204-329](frontend/src/pages/captain-mp/OrderDetailPage.tsx):
  variance pill `sky-700` (over) / `indigo-700` (under), `roundQty`
  ([number.ts:50](frontend/src/components/ui/number.ts)), and reusable i18n keys
  (`orders.detail.receivedLabel`, `orders.detail.orderedSecondary`,
  `delivery.variance`, `delivery.discrepancies`, `delivery.confirmedAt`,
  `delivery.missingWz`) already in [strings.ts](frontend/src/i18n/strings.ts).
- **Existing TS receipt types** (`ReceiptSummary`, `ReceiptDetailLine`) at
  [types.ts:430+](frontend/src/types.ts); Manager types have no receipt fields.

## Desired End State

A Manager opening a dispatched order sees a read-only **"Dostawa" / "Delivery"**
section below the line table: one block per receipt (newest first), each showing
per-line delivered vs ordered + a variance pill, plus a receipt header
(date / who confirmed / discrepancy count / missing-WZ flag). In the queue's
`manager_sent` lane, each card shows a **⚠ discrepancy** chip when any receipt has
a discrepancy, or a neutral **✓ Dostarczono** chip when delivered without
discrepancy; sent-but-unreceived cards stay unmarked. No schema change; seed mode
and a missing receipts tab degrade to "no receipts" rather than erroring.

### Key Discoveries

- 0..N receipts per order ([main.py:2239](supply-os-v1/app/main.py:2239)) — render **all**, newest-first.
- Badge needs only `Receipt.discrepancy_count` — no line join in the queue.
- `WorksheetNotFound → []` degradation is the established contract; both Manager surfaces must adopt it.
- `manager_order_detail` already builds `products_by_id` + `sps_by_id` — reuse them to enrich receipt lines (product name + purchase unit).

## What We're NOT Doing

- **No** cross-order "Receipts" list / tab (frame W1 — phase 2 if ever).
- **No** `manager_suggestion_review` received-enrichment (frame W5 — separate follow-up).
- **No** new standalone Manager receipt endpoint — data is woven into `manager_order_detail` + `manager_queue` (frame W4).
- **No** WZ photo viewing for the Manager (only a missing-WZ flag); photos stay Captain-side.
- **No** schema change, no write paths, no order-status changes — read-only/additive only.
- **No** "awaiting delivery" marker on unreceived sent orders (Q4 — silence).

## Implementation Approach

Vertical slice, backend first. Phase 1 extends the two Pydantic response models
and wires receipt loading into the two endpoints, with degradation guards and
pytest coverage. Phase 2 mirrors the models in TS, adds PL+EN copy (reusing
`delivery.*` keys), renders the read-only delivery section, and adds the two queue
chips. Each phase is independently verifiable.

## Critical Implementation Details

- **Degradation guard is load-bearing.** Wrap every `load_receipts()` /
  `load_receipt_lines()` call in `manager_order_detail` and `manager_queue` in
  `try/except sheets.WorksheetNotFound → []`. A pilot Sheet without the receipts
  tabs must still serve order detail and the queue — exactly as `captain_receipts`
  does. (`manager_order_detail` / `manager_queue` already gate on
  `_is_persistent`; seed mode never reaches the receipt load.)
- **Queue scan is gated to the sent lane.** Only compute receipt counts when
  `status == OrderStatus.MANAGER_SENT`; other lanes skip the `load_receipts()`
  scan entirely (keeps the hot `captain_submitted` lane untouched).
- **Newest-first ordering.** Sort an order's receipts by `received_submitted_at`
  (fallback `receipt_date`) descending — mirrors the recency keys in
  `captain_receipts` / `captain_inventory_counts`.

## Phase 1: Backend — receipt data on Manager detail + queue

### Overview

Extend the two Manager response models and wire receipt loading into
`manager_order_detail` and `manager_queue`, with seed / missing-tab degradation.

### Changes Required:

#### 1. Manager receipt response models

**File**: `supply-os-v1/app/models.py`

**Intent**: Add a compact, product-enriched receipt view embedded in the Manager
order detail, plus two queue counters for the badge — defaults keep every other
lane / legacy row at zero.

**Contract**:
- New `ManagerOrderReceiptLine`: `order_line_id: str`, `product_id: str`,
  `product_name_pl: str`, `purchase_unit: str`, `ordered_qty_purchase: float`,
  `received_qty_purchase: float`, `variance_qty_purchase: float`,
  `receipt_comment: str = ""`.
- New `ManagerOrderReceipt`: `receipt_id: str`, `receipt_date: date`,
  `received_by: Optional[str] = None`, `received_submitted_at: Optional[datetime] = None`,
  `line_count: int = 0`, `discrepancy_count: int = 0`,
  `received_with_missing_wz: bool = True`, `wz_photo_count: int = 0`,
  `lines: list[ManagerOrderReceiptLine] = Field(default_factory=list)`.
- Extend `ManagerOrderDetail`: add `receipts: list[ManagerOrderReceipt] = Field(default_factory=list)` (newest-first).
- Extend `ManagerQueueItem`: add `received_count: int = 0` and `received_discrepancy_count: int = 0`.

#### 2. `manager_order_detail` — attach receipts

**File**: `supply-os-v1/app/main.py` (`manager_order_detail`,
[main.py:759](supply-os-v1/app/main.py:759))

**Intent**: After loading the order, load this order's receipts (newest-first) and
attach them as enriched `ManagerOrderReceipt` blocks, reusing the existing
`products_by_id` / `sps_by_id` dicts for product name + purchase unit.

**Contract**: After `order = backend.get_order(order_id)`, only run the receipt
load when `order.status in (MANAGER_SENT, CLOSED)` — receipts can't exist on
earlier statuses (the Captain confirm gate requires `manager_sent`), so other
statuses skip the scan and return no receipts. When loading, fetch
`backend.load_receipts()` + `backend.load_receipt_lines()` (each guarded by
`try/except sheets.WorksheetNotFound → []`), filter to `r.order_id == order_id`,
group lines by `receipt_id`, sort receipts by `received_submitted_at`
(fallback `receipt_date`) descending, build the `ManagerOrderReceipt` list, and
pass it to `ManagerOrderDetail(..., receipts=...)`. Per line, `product_name_pl`
from `products_by_id`, `purchase_unit` from `sps_by_id` (id fallback when absent).

#### 3. `manager_queue` — receipt counters for the sent lane

**File**: `supply-os-v1/app/main.py` (`manager_queue`,
[main.py:667](supply-os-v1/app/main.py:667))

**Intent**: For the `manager_sent` lane only, count each displayed order's
receipts and how many carry a discrepancy, so the FE can render the two chips.

**Contract**: When `status == OrderStatus.MANAGER_SENT`, fetch
`backend.load_receipts()` (guarded `WorksheetNotFound → []`), restrict to the
displayed `order_ids`, and per order set `received_count` (number of receipts) and
`received_discrepancy_count` (receipts with `discrepancy_count > 0`) on the
`ManagerQueueItem`. Other statuses leave both at the `0` default (no receipt
scan).

### Success Criteria:

#### Automated Verification:

- [ ] Backend tests pass: `cd supply-os-v1 && python3 -m pytest`
- [ ] Lint passes: `cd supply-os-v1 && ruff check .`
- [ ] New tests cover: detail returns an order's **≥2 receipts ordered newest-first** with per-line variance; detail returns empty `receipts` when an order has none; detail does not error when the receipts tab is missing (`WorksheetNotFound → []`); queue sets `received_count` / `received_discrepancy_count` on the `manager_sent` lane (incl. an order with a discrepancy receipt → count ≥ 1) and leaves them `0` on `captain_submitted`.

#### Manual Verification:

- [ ] `GET /api/manager/order/{id}` for a dispatched order with a receipt returns the `receipts` block with correct delivered/ordered/variance per line.

**Implementation Note**: After Phase 1 automated verification passes, pause for
human confirmation before starting Phase 2.

---

## Phase 2: Frontend — delivery section + queue chips

### Overview

Mirror the new models in TS, add PL+EN copy, render the read-only delivery
section, and add the two queue chips.

### Changes Required:

#### 1. TS type mirror

**File**: `frontend/src/types.ts`

**Intent**: Mirror the Pydantic additions so `api.managerOrder` / `api.managerQueue`
stay correctly typed (no `apiClient.ts` change — endpoints unchanged).

**Contract**: Add `ManagerOrderReceiptLine` + `ManagerOrderReceipt` (fields per
Phase 1 model 1); add `receipts: ManagerOrderReceipt[]` to `ManagerOrderDetail`;
add `received_count: number` + `received_discrepancy_count: number` to
`ManagerQueueItem`.

#### 2. i18n copy (PL + EN)

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Add the few Manager-specific strings; reuse existing `delivery.*` /
`orders.detail.*` keys for delivered/ordered/variance/discrepancy/missing-WZ.

**Contract**: New keys (PL/EN): `manager.delivery.section` ("Dostawa"/"Delivery"),
`manager.delivery.receivedBy` ("Przyjął: {value}"/"Received by: {value}"),
`manager.queue.delivered` ("Dostarczono"/"Delivered"),
`manager.queue.discrepancy` ("Różnice"/"Discrepancies"). Reuse
`orders.detail.receivedLabel`, `orders.detail.orderedSecondary`,
`delivery.variance`, `delivery.discrepancies`, `delivery.confirmedAt`,
`delivery.missingWz`.

#### 3. Read-only delivery section component

**File**: `frontend/src/pages/manager/DeliverySection.tsx` (new)

**Intent**: Render an order's receipts newest-first as read-only blocks mirroring
the Captain overlay — per-line delivered (headline) + ordered (secondary) +
variance pill, with a per-receipt header.

**Contract**: `function DeliverySection({ receipts }: { receipts: ManagerOrderReceipt[] })`.
Per receipt: header line (`receipt_date` via `formatDateTime` /
`manager.delivery.receivedBy` / `delivery.confirmedAt` / `delivery.discrepancies`
when `discrepancy_count > 0` / `delivery.missingWz` when `received_with_missing_wz`);
per line: `orders.detail.receivedLabel` + `roundQty(received_qty_purchase)`,
`orders.detail.orderedSecondary` for ordered, and the variance pill
(`variance > 0 ? "text-sky-700" : "text-indigo-700"`, shown only when
`roundQty(variance) !== 0`, formatted via `delivery.variance`). Read-only — no
inputs. Use `useT` + `roundQty`.

#### 4. Mount the section in the detail pane

**File**: `frontend/src/pages/manager/OrderDetailPane.tsx`

**Intent**: Show the delivery section under the line table when receipts exist.

**Contract**: Render `{detail.receipts.length > 0 && <DeliverySection receipts={detail.receipts} />}` at the end of the detail content area — after the estimated-value block, before the action/dispatch buttons — so delivery reads as post-order info and doesn't push the save affordance down.

#### 5. Queue chips

**File**: `frontend/src/pages/manager/ManagerQueue.tsx` (`QueueCard`)

**Intent**: Surface the receipt signal on `manager_sent` cards, matching the
existing pill style.

**Contract**: In the pill row (~L153-180): when `item.received_discrepancy_count > 0`,
render a warning chip (amber/red, `manager.queue.discrepancy`, e.g. "⚠"); else when
`item.received_count > 0`, render a neutral/emerald chip (`manager.queue.delivered`,
e.g. "✓"). Nothing when `received_count === 0`.

### Success Criteria:

#### Automated Verification:

- [ ] Build passes: `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run build`
- [ ] Lint passes: `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run lint`
- [ ] Unit tests pass: `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run test`

#### Manual Verification:

- [ ] UI behavior recorded in `verification/preview-notes.md` (preview harness unavailable): delivery section renders per-receipt newest-first with correct variance hues; over/under delivery colored sky/indigo; queue shows ⚠ on discrepancy, ✓ on clean delivery, nothing on unreceived; PL+EN copy both resolve.

**Implementation Note**: After Phase 2 automated verification passes, pause for
human confirmation. Push / deploy / live verification / archive are done by the
user separately.

---

## Testing Strategy

### Unit Tests (backend, pytest):

- `manager_order_detail`: an order with ≥2 receipts is attached newest-first; per-line `variance_qty_purchase` mapped; empty list when no receipt; no error when receipts tab missing.
- `manager_queue`: `received_count` / `received_discrepancy_count` set on `manager_sent`; both `0` on `captain_submitted`; no error when tab missing.

### Frontend:

- Vitest covers only pure helpers; the new component has no harness (project convention — UI verified by hand). No new unit test unless a pure helper is extracted.

### Manual Testing Steps:

1. Open a dispatched order (`manager_sent`) that has a receipt → "Dostawa" section appears with per-line delivered/ordered/variance.
2. Order with a discrepancy → variance pill colored; queue card shows ⚠ chip.
3. Order delivered without discrepancy → queue card shows ✓ chip; no pill.
4. Sent order with no receipt → no chip, no section.
5. Toggle PL/EN → all new copy resolves.

## Performance Considerations

`load_receipts()` is a full-table read on both backends (no targeted loader), gated
to the `manager_sent` lane and to detail views — fine at pilot volume; a targeted
`load_receipts_for_orders` mirroring F-7 is the future optimization if the
receipts table grows.

## Migration Notes

None — read-only/additive over existing persisted columns. The `receipts` /
`receipt_lines` tabs already exist in prod (GR-01 is live). A Sheet missing them
degrades to "no receipts" via the `WorksheetNotFound` guard.

## References

- Frame brief: `context/changes/manager-receiving-view/frame.md`
- Captain receipt routes: [main.py:2362](supply-os-v1/app/main.py:2362), [:2406](supply-os-v1/app/main.py:2406)
- Captain receipt overlay (mirror): [OrderDetailPage.tsx:204](frontend/src/pages/captain-mp/OrderDetailPage.tsx)
- Manager detail pane: [OrderDetailPane.tsx](frontend/src/pages/manager/OrderDetailPane.tsx); queue: [ManagerQueue.tsx](frontend/src/pages/manager/ManagerQueue.tsx)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — receipt data on Manager detail + queue

#### Automated

- [x] 1.1 Backend tests pass: `cd supply-os-v1 && python3 -m pytest` (399 passed, 16 deselected)
- [x] 1.2 Lint passes: `cd supply-os-v1 && python3 -m ruff check .` (All checks passed)
- [x] 1.3 New tests cover detail receipts (≥2 newest-first, per-line variance, empty, missing-tab) + queue counters (sent vs submitted lane) — `tests/test_manager_receiving.py`, 7 tests

#### Manual

- [x] 1.4 `GET /api/manager/order/{id}` returns correct `receipts` block for a dispatched order with a receipt — covered by automated TestClient test `test_detail_attaches_receipts_newest_first`

### Phase 2: Frontend — delivery section + queue chips

#### Automated

- [x] 2.1 Build passes: `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run build` (tsc + vite, 1647 modules, no type errors)
- [x] 2.2 Lint passes: `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run lint` (clean)
- [x] 2.3 Unit tests pass: `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run test` (9 files, 77 tests)

#### Manual

- [x] 2.4 UI behavior recorded in `verification/preview-notes.md` (section render, variance hues, queue chips, PL+EN copy) — preview harness unavailable (node/rollup); verified via Homebrew-node build/lint/test + render-logic trace
