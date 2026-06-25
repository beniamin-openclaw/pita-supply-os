# Manager Receiving View — UI Verification Notes

> The interactive preview harness is unavailable in this environment (the default
> `node` is Codex.app's hardened build that can't load native rollup; only Homebrew
> node runs vite). Per the run's guardrails, UI behavior is verified here by a
> green Homebrew-node build/lint/test plus a static render-logic trace. Live
> in-browser verification is part of the user's separate post-deploy step.

## Build / lint / test (Homebrew node)

- `npm run build` (`tsc -b && vite build`) → **PASS** (1647 modules, built in ~1s; no type errors — the new `ManagerOrderReceipt` / `ManagerOrderReceiptLine` types and the extended `ManagerOrderDetail` / `ManagerQueueItem` all type-check against the consuming components).
- `npm run lint` (`eslint .`) → **PASS** (no warnings/errors).
- `npm run test` (`vitest run`) → **PASS** (9 files, 77 tests). No component harness for the new UI (project convention); pure-helper suite unaffected.

## Routes / surfaces touched

`/manager` (Manager dashboard, two-pane shell):
- **Queue** — `pages/manager/ManagerQueue.tsx` `QueueCard`.
- **Detail pane** — `pages/manager/OrderDetailPane.tsx` → new `pages/manager/DeliverySection.tsx`.

## Render-logic trace (what a user will see)

**Detail — "Dostawa / Delivery" section** (`DeliverySection`, mounted under the
line table + estimated value, before the action buttons):
- Renders only when `detail.receipts.length > 0` (guarded in `OrderDetailPane`).
- Receipts shown **newest-first** (backend sorts by `received_submitted_at`,
  fallback `receipt_date`, descending — verified by `test_detail_attaches_receipts_newest_first`).
- Per receipt header: confirmed-at (`delivery.confirmedAt`, datetime via
  `formatDateTime`, falls back to `receipt_date`), `manager.delivery.receivedBy`
  when present, `delivery.discrepancies` (amber) when `discrepancy_count > 0`,
  `delivery.missingWz` when `received_with_missing_wz`.
- Per line: product name; **Dostarczono** headline (`orders.detail.receivedLabel`
  + `received_qty_purchase`), **ordered** secondary (`orders.detail.orderedSecondary`),
  and a variance pill shown only when `roundQty(variance) !== 0` — colored
  **sky-700 (over)** / **indigo-700 (under)**, mirroring the Captain overlay and
  deliberately distinct from the queue's amber/red deviation hue.

**Queue chips** (`QueueCard`, in the pill row beside deviation/reason pills):
- `received_discrepancy_count > 0` → red **⚠ Różnice / Discrepancies** chip.
- else `received_count > 0` → green **✓ Dostarczono / Delivered** chip.
- else → nothing (sent-but-unreceived stays unmarked; Q4 = silence).
- Counts are 0 on every non-sent lane (backend gates the scan to `manager_sent`),
  so chips only appear on dispatched orders — verified by
  `test_queue_sent_lane_sets_received_counts` + `test_queue_submitted_lane_skips_receipt_scan`.

## i18n (PL + EN)

New keys resolve in both languages: `manager.delivery.section`
(Dostawa/Delivery), `manager.delivery.receivedBy`, `manager.queue.delivered`,
`manager.queue.discrepancy`. Reused existing keys: `orders.detail.receivedLabel`,
`orders.detail.orderedSecondary`, `delivery.variance`, `delivery.discrepancies`,
`delivery.confirmedAt`, `delivery.missingWz`. `tsc` confirms every `t(...)` key is
a member of the `StringKey` union (build would fail otherwise).

## Console / network

Not exercised (no live preview). Build emits no errors; no new network calls were
added — the FE reads receipts off the existing `api.managerOrder` / `api.managerQueue`
responses (no new `apiClient` endpoint).
