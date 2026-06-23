---
change_id: order-qty-display
title: Captain order detail reflects manager-final + received qty; round qty displays to 2 dp
status: archived
created: 2026-06-23
updated: 2026-06-23
archived_at: 2026-06-23T21:23:08Z
---

## Notes

Captain order-detail view must reflect the manager's final quantity and the received quantity after delivery instead of staying frozen on the captain's original qty, and all computed quantity displays must round to 2 dp so the variance no longer shows float artifacts like +0.40000000000000013

Source: live demo round 2 (2026-06-23) — see `docs/pita-supply-os-v1/DEMO_FEEDBACK.md`. Both are **display-only** (data is correct: receipt screen already shows 1.8; receipt persists the received qty + variance).

- **Bug A** — [OrderDetailPage.tsx:190](../../../frontend/src/pages/captain-mp/OrderDetailPage.tsx) hardcodes `captain_final_qty_purchase`. The "effective ordered qty" rule (`manager_final if >0 else captain_final`) already exists twice — `effectiveManagerQtyPurchase` ([managerLine.ts:21](../../../frontend/src/pages/manager/lib/managerLine.ts)) and `effectiveOrdered` ([ReceiveDeliveryPage.tsx:22](../../../frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx)). Consolidate into one shared helper and use it on the order-detail card.
- **Bug A extension (Item C)** — once a receipt exists, surface the per-line **received qty + variance** on the order-detail view (today it only shows a confirmed+photo banner). Pull `api.receipt(receipt_id)` (`ReceiptDetail` carries per-line received/variance) and overlay onto matching lines. No backend change.
- **Bug B** — [ReceiptLineCard.tsx:27](../../../frontend/src/pages/captain-mp/components/ReceiptLineCard.tsx) prints `Number(delivered) - ordered` raw. Add a shared `roundQty(n)` (2 dp, trim trailing zeros) to [components/ui/number.ts](../../../frontend/src/components/ui/number.ts) and apply to computed-qty displays.
- **Verify** — owner noted receive-screen edits "nie zapisują progresu" before final submit. Confirm no edit-loss in the receive flow distinct from the intended post-save lock (Phase 2 of the archived demo-blocker change). Likely display-only; repro before closing.
