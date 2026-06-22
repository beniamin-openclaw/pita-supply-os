---
change_id: order-cancel-with-trace
title: Manager cancels an order (soft-delete) with a who/when/why trace
status: archived
created: 2026-06-17
updated: 2026-06-22
archived_at: 2026-06-22T16:51:31Z
---

## Notes

From the `manager-ux-feedback-backlog` memory (owner 2026-06-16). `OrderStatus.CANCELLED = "cancelled"` and the UI label `orders.status.cancelled` ("Anulowane") already exist, but no endpoint sets it and there is no order delete.

**Owner decisions (2026-06-17):**
- **Scope:** Manager only, **before dispatch** — cancellable from `captain_submitted` or `manager_claimed`. Mirrors the `claim` / `release` guards. (NOT from `manager_sent` — the supplier was already emailed.)
- **Trace:** **full, in dedicated columns** — `cancelled_at` + `cancelled_by` + `cancel_reason` (reason required). Soft-delete only; never hard-delete (owner wants the durable trace).

Also resolves the immediate ask: a Manager can now clear test Bukat orders from the queue (status→cancelled drops them, and is the first real "anulowany" trace) instead of editing the Sheet by hand.

Latent note (from memory): the cancel does NOT zero `manager_final`, so the `manager-queue-ux` struck-through "cancelled line" visual (driven by qty 0) is not triggered — `OrderDetailPane.tsx:92` `dispatched = manager_sent || closed` is left as-is.
