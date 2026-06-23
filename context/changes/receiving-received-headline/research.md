---
date: 2026-06-23
researcher: Claude (Opus 4.8)
git_commit: 01a31cb
branch: claude/exciting-curie-e20933
repository: pita-supply-os
topic: "Receiving display — ordered vs received quantity on the Captain order-detail card"
tags: [research, goods-receiving, GR-01, order-detail, receipt]
status: complete
last_updated: 2026-06-23
last_updated_by: Claude (Opus 4.8)
---

# Research: Receiving display — ordered vs received on the Captain order-detail card

## Research Question

After a delivery is confirmed, the Captain order-detail card shows the **ordered** (effective) qty as
the big headline (e.g. Awokado 2) with "Dostarczono: 3" as a small sub-line, while the owner — who
confirmed receiving 3 — reads the big "2" as wrong. Is this a data bug or a display issue? Where do
the numbers come from, and what other inconsistencies exist?

## Summary

**Not a data bug.** Ordered (2), received (3), and variance (+1) are all computed and stored
correctly. The issue is display semantics: the headline is unconditionally the *effective ordered*
qty and never switches to *received* post-delivery, and it carries **no label**, so a big unlabeled
"2" next to "Dostarczono: 3" reads as wrong. The post-delivery order-detail card was never spec'd in
GR-01 — it was added 2026-06-23 (order-qty-display) — so "headline = ordered post-delivery" is an
undocumented default, free to change.

## Detailed Findings

### Backend computation/storage (correct, no change needed)

- `supply-os-v1/app/main.py` `captain_receipt_submit` + `_effective_ordered_qty`: at receipt time it
  snapshots `ordered_qty_purchase = effective-ordered` (manager_final if >0 else captain_final) and
  stores `variance_qty_purchase = received − ordered` per line.
- `supply-os-v1/app/models.py` `ReceiptLine` / `ReceiptDetailLine`: carry `ordered_qty_purchase`,
  `received_qty_purchase`, `variance_qty_purchase`. The receipt is self-contained: variance is
  measured against the snapshotted ordered value.

### "Which number shows where" (frontend)

| Screen | Headline (big) | Label? | Source |
|---|---|---|---|
| Receive screen (`ReceiptLineCard`) | effective ordered | "Zamówiono:" ✓ | order line |
| Order detail — pre-delivery | effective ordered | **none** ✗ | `effectiveOrderedQtyPurchase(line)` |
| Order detail — **post-delivery** | **still effective ordered** | **none** ✗ | same; "Dostarczono: N" only as a small sub-line |
| Manager pages | captain / manager (columns) | column headers | order line — **no receipt data** |

### Inconsistencies (the owner's "nieścisłości")

1. **Headline never switches to received post-delivery** — `OrderDetailPage.tsx` renders
   `effectiveOrderedQtyPurchase(line)` unconditionally; no `receiptLine`-present branch. Root cause of
   the reported bug.
2. **Headline is unlabeled** — the receive screen labels "Zamówiono:"; the order-detail big number
   has no caption, so post-delivery a bare "2" next to "Dostarczono: 3" reads as an error.
3. **The receipt's own `ordered_qty_purchase` snapshot is ignored** — `ReceiptDetailLine` carries it
   (`types.ts`), but the order detail re-derives ordered live via `effectiveOrderedQtyPurchase`. They
   agree in normal flow but can diverge if master data changes post-dispatch; the displayed variance
   is computed against the snapshot, so showing a live-derived ordered alongside it is a latent
   mismatch.
4. **Label collision** — the manager hint "było {captain}" and "Dostarczono: {received}" can show the
   same number meaning different things, with no headline label to anchor either.
5. *(secondary, deferred)* Manager is receipt-blind (no received/variance/discrepancy on the Manager
   side — a learning-loop gap); the receive screen pre-fills delivered with ordered (a blank submits
   ordered silently — no recount gate); variance colour reuses orange/red with the deviation-% badge.

## Architecture Insights

- The "effective ordered qty" rule is now centralized in `frontend/src/lib/orderQty.ts`
  (`effectiveOrderedQtyPurchase`) after the order-qty-display change.
- The receipt overlay was added to `OrderDetailPage` in order-qty-display (fetches `api.receipt`,
  shows per-line received + variance). This change builds directly on that overlay — it already has
  `receiptLine` (with `received_qty_purchase`, `ordered_qty_purchase`, `variance_qty_purchase`) in
  scope per line; the fix is presentational (which number is the headline + labels).

## Historical Context (from prior changes)

- `context/archive/2026-06-09-gr-01/plan.md` specified the RECEIVE screen headline as "Zamówiono"
  (ordered), received as the input sub-label. The post-delivery order-detail card was NOT specified
  there — only the "Dostawa potwierdzona" banner + discrepancy count.
- `context/archive/2026-06-23-demo-blocker-decimals-save/` + the order-qty-display change added the
  per-line "Dostarczono: X · różnica Y" overlay (DEMO_FEEDBACK round 2). "Headline = ordered
  post-delivery" was never a deliberate decision → safe to change.

## Open Questions

- None blocking. Deferred (separate future backlog): Manager receipt-visibility, recount gate,
  variance colour vs deviation-% colour. This change is scoped to the headline + labels (resolves
  inconsistencies 1-4).
