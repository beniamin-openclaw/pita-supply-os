# Frame Brief: Manager receiving view

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

After a Manager dispatches an order (`manager_sent`), the Manager has no screen
that shows what was actually delivered. Captains confirm deliveries (goods
receipts with `received_qty_purchase` / `variance_qty_purchase` /
`discrepancy_count`), but that data never surfaces on any Manager-facing view.
The learning loop `suggested → captain → manager → RECEIVED` is fully recorded
yet visibly breaks at the Manager's screen.

## Initial Framing (preserved)

- **User's stated cause or approach**: The loop is recorded end-to-end in
  `Receipt` / `ReceiptLine`, but there is no Manager read surface for it. Fix is
  additive, read-only, no schema change — mirror the existing Captain receipt and
  Manager-inventory patterns.
- **User's proposed direction**: Add Manager receiving visibility (per-order
  delivered/variance + a queue discrepancy signal), reusing existing endpoints.
- **Pre-dispatch narrowing**: The five scope widths below were each answered with
  the recommended option (single round, one question at a time).

## Dimension Map

This is a confirmed-framing feature, not a defect hunt; the "dimensions" are the
scope axes the framing had to settle before planning:

1. **Placement** — per-order detail vs cross-order list vs both.
2. **Queue signal** — surface a discrepancy badge in the queue or only in detail.
3. **Location scope** — cross-location (Manager pattern) vs location-scoped.
4. **Endpoint shape** — extend existing Manager endpoints vs new dedicated axis.
5. **Learning-loop aggregate** — enrich `manager_suggestion_review` now vs defer.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Manager has no receipt endpoint today | `grep` over `supply-os-v1/app/` finds **no** `manager/receipt*` route; only Captain routes exist (`captain_receipts` [main.py:2362], `captain_receipt_detail` [main.py:2406]) | STRONG |
| Receipt data persists and is complete | `Receipt` / `ReceiptLine` models with `received_qty_purchase`, `variance_qty_purchase`, `discrepancy_count`, `received_with_missing_wz` ([models.py:565–600]); persisted via `_choose_backend()` (sheets + supabase) | STRONG |
| Manager-facing models omit receipt data | `ManagerOrderDetail` / `ManagerOrderLineDetail` / `ManagerQueueItem` carry no receipt/received/discrepancy fields ([models.py]) | STRONG |
| Reusable Manager cross-location precedent exists | `manager_inventory_counts` (optional `location_id`, no token scope) + `manager_inventory_count_detail` (no scope) are the template ([main.py]) | STRONG |
| Schema change required | None — feature is read-only/additive over existing persisted columns | NONE |

## Narrowing Signals

Decisive scope decisions from the width round (all = recommended option):

- **W1 Placement = (a) per-order first.** Closes the loop where the Manager
  already looks; cross-order "Receipts" list deferred to phase 2.
- **W2 Queue signal = light badge.** Badge on `manager_sent` rows whose receipt
  has `discrepancy_count > 0` — cheap attention signal.
- **W3 Scope = cross-location.** No location scope in detail (mirrors
  `manager_order_detail`); optional `location_id` filter on any list (mirrors
  `manager_queue`).
- **W4 Endpoint = weave into existing.** Extend `ManagerOrderDetail` with a
  receipt block (received/variance per line) and `ManagerQueueItem` with a
  discrepancy signal; a thin `manager_receipts` list endpoint is phase-2 only.
- **W5 `manager_suggestion_review` received-enrichment = OUT of scope.** Separate
  follow-up; keep this change focused on visibility.

## Cross-System Convention

Manager read views in this codebase are cross-location and join master data
server-side (`manager_queue`, `manager_inventory_counts`,
`manager_inventory_count_detail`). Detail routes are unscoped; list routes take an
optional `location_id`. The chosen direction matches this convention exactly —
extend the existing Manager surfaces rather than introduce a new axis. Backend
reads stay behind `_choose_backend()`; seed mode degrades to empty/None like the
sibling routes. Frontend follows the Captain receipt overlay
(`pages/captain-mp/OrderDetailPage.tsx`) and the `manager-mp` detail panel.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the goods-receipt learning loop is
> persisted in full but has zero Manager-facing read surface, so the Manager
> cannot see delivered-vs-ordered variance for orders they dispatched.

The initial framing was correct — proceed with the originally proposed direction.
Addressing it means the Manager closes the loop they own: per-order
delivered/variance in the detail panel plus a discrepancy badge in the queue,
delivered by extending existing Manager endpoints with no schema change.

## Confidence

- **HIGH** — strong evidence the data exists and the Manager surface is absent;
  the chosen direction matches an established cross-location Manager convention;
  every scope width resolved decisively in one round.

## What Changes for /10x-plan

Plan an additive, read-only change: (1) extend `ManagerOrderDetail` /
`ManagerOrderLineDetail` with receipt data (received/variance per line, fetched
via `_choose_backend().get_receipt`-style lookup by `order_id`) and
`ManagerQueueItem` with a discrepancy flag; (2) surface both in the `manager-mp`
detail panel and queue (copy via `i18n/` PL+EN, calls via `apiClient.ts`,
Pydantic→TS mirror). Cross-order "Receipts" list and
`manager_suggestion_review` received-enrichment are explicitly out of scope
(phase 2 / separate follow-up).

## References

- Source files: `supply-os-v1/app/main.py` (captain receipt routes
  [:2362](supply-os-v1/app/main.py:2362), [:2406](supply-os-v1/app/main.py:2406);
  Manager inventory routes), `supply-os-v1/app/models.py` (`Receipt`/`ReceiptLine`,
  `ManagerOrderDetail`/`ManagerQueueItem`), `supply-os-v1/app/sheets.py`
  (`get_receipt`, `load_receipts`), `frontend/src/pages/captain-mp/OrderDetailPage.tsx`
  (receipt overlay), `frontend/src/pages/manager-mp/` (detail panel).
- Related research: none (frame grounded directly from source).
- Investigation: grounding grep over `supply-os-v1/app/` (no TaskCreate agents —
  surface small and already in context).
