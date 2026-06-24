# Manager Receiving View — Plan Brief

> Full plan: `context/changes/manager-receiving-view/plan.md`
> Frame brief: `context/changes/manager-receiving-view/frame.md`

## What & Why

Give the Manager visibility into what was actually delivered. The goods-receipt
loop is persisted in full but has zero Manager-facing read surface, so the Manager
cannot see delivered-vs-ordered variance for orders they dispatched. This change
closes the loop `suggested → captain → manager → RECEIVED` on the Manager's screen
— read-only, additive, no schema change.

## Starting Point

`Receipt` / `ReceiptLine` data (received qty, variance, discrepancy count,
missing-WZ flag) persists via `_choose_backend()`. Only the Captain has receipt
views; `ManagerOrderDetail` / `ManagerQueueItem` carry no receipt fields. An order
can have 0..N receipts (append-only — partial deliveries are real).

## Desired End State

Opening a dispatched order, the Manager sees a read-only **"Dostawa" / "Delivery"**
section below the line table: one block per receipt (newest first) with per-line
delivered vs ordered + a variance pill and a receipt header. The queue's
`manager_sent` lane shows a **⚠ discrepancy** chip when a receipt has a
discrepancy, or a neutral **✓ Dostarczono** chip when delivered clean; unreceived
sent orders stay unmarked.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Placement | Per-order detail first | Close the loop where the Manager already looks; list is phase 2 | Frame |
| Queue signal | Light discrepancy badge | Cheap attention signal on `manager_sent` rows | Frame |
| Location scope | Cross-location | Matches `manager_queue` / `manager_inventory_counts` | Frame |
| Endpoint | Weave into existing | Extend `ManagerOrderDetail` + `ManagerQueueItem`; no new axis | Frame |
| `suggestion_review` enrich | Out of scope | Separate follow-up; keep focus on visibility | Frame |
| Detail rendering | Separate read-only "Dostawa" section | Handles 0..N receipts cleanly; doesn't bloat the 11-col table | Plan |
| Multiple receipts | Show all, newest-first | Append-only partial deliveries stay visible | Plan |
| Queue chip semantics | ⚠ discrepancy + ✓ delivered | Manager sees what arrived, not only problems | Plan |
| Unreceived sent orders | No marker (silence) | Absence = not received; avoid queue noise | Plan |

## Scope

**In scope:** receipt block on `manager_order_detail` (all receipts, newest-first,
per-line delivered/ordered/variance); `received_count` / `received_discrepancy_count`
on `manager_queue` (sent lane); FE delivery section + two queue chips; PL+EN copy;
TS mirror; pytest.

**Out of scope:** cross-order Receipts list/tab; `manager_suggestion_review`
received-enrichment; new standalone Manager receipt endpoint; Manager WZ photo
viewing; any schema/write/status change; "awaiting delivery" marker.

## Architecture / Approach

Vertical slice, backend first. Phase 1: extend two Pydantic models, load + filter
receipts in `manager_order_detail` (enriched, newest-first) and `manager_queue`
(counters, sent lane only), guarded by `try/except sheets.WorksheetNotFound → []`
so seed mode / a missing receipts tab degrade to "no receipts". Phase 2: mirror
the models in `types.ts`, add copy (reusing `delivery.*` keys), render a read-only
`DeliverySection` under the line table, and add the two chips in `QueueCard`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend | Receipts on detail + counters on queue, degradation-safe | Missing-tab / seed degradation must not 500 |
| 2. Frontend | "Dostawa" section + queue chips + i18n + TS mirror | No component test harness — UI verified by hand |

**Prerequisites:** GR-01 receipts already live in prod; Homebrew node for FE build/lint/test.
**Estimated effort:** ~1–2 sessions across 2 phases.

## Open Risks & Assumptions

- Assumes the `WorksheetNotFound → []` guard covers every receipt-tab-missing path on the Manager surfaces (the one way this could 500).
- `load_receipts()` full scan is acceptable at pilot volume; a targeted loader is the future optimization.
- New FE component has no automated test — manual verification via `verification/preview-notes.md` (preview harness unavailable).

## Success Criteria (Summary)

- Manager opens a delivered order and sees per-line delivered/ordered/variance, newest receipt first.
- Queue `manager_sent` cards distinguish discrepancy (⚠), clean delivery (✓), and not-yet-delivered (no chip).
- Backend + FE verification green; no regression in existing Manager flows; no real dispatch from tests.
