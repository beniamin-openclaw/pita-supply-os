# Receiving display — received qty as the post-delivery headline — Implementation Plan

## Overview

Make the Captain order-detail line show the **received** quantity as the prominent headline once a
delivery is confirmed (with a "Przyjęto" label), demoting ordered + variance to a labeled secondary
line sourced from the receipt's own snapshot. Pre-delivery, label the existing ordered headline so
the number is anchored. Display-only, frontend-only, no backend change. Resolves research
inconsistencies 1–4 and the owner's "shows 2, I received 3" complaint.

## Current State Analysis

`frontend/src/pages/captain-mp/OrderDetailPage.tsx` (post the order-qty-display change) renders, per
line:
- a right-column headline = `effectiveOrderedQtyPurchase(line)` (unconditional, **unlabeled**),
- a manager-changed hint + a `delta_vs_suggestion_pct` badge,
- and, when `receiptLine` exists, a separate full-width "Dostarczono: X · różnica Y" sub-line.

The map callback already computes `receiptLine` (`receiptDetail?.lines.find(...)`) and
`variance = roundQty(receiptLine.variance_qty_purchase)`. `receiptLine` carries
`received_qty_purchase` AND `ordered_qty_purchase` (the snapshot the variance was computed against).
`roundQty` + `effectiveOrderedQtyPurchase` are already imported.

### Key Discoveries:

- Headline source: `OrderDetailPage.tsx` line-map right column (`effectiveOrderedQtyPurchase(line)`).
- `receiptLine.ordered_qty_purchase` is fetched but unused — using it for the post-delivery "Zamówiono"
  secondary makes received/ordered/variance internally consistent (all from the receipt record).
- `delivery.variance` (`"Różnica: {value}"`) i18n already exists and is reused.

## Desired End State

Per line on the Captain order-detail card:
- **Pre-delivery** (no receipt): small "Zamówiono" label + the effective ordered qty (unchanged
  number) + the manager-changed hint + the deviation badge (all as today).
- **Post-delivery** (receipt exists): small "Przyjęto" label + the **received** qty as the big number,
  then a secondary "Zamówiono: {ordered} {unit}" (from the snapshot) and the colored "Różnica: ±Y".
  The manager-changed hint + deviation badge are dropped post-delivery (the order is done; the
  ordered/received story is what matters). The old full-width "Dostarczono" sub-line is removed
  (received is now the headline).

Verify: Awokado (captain 3 → manager 2 → received 3) shows a big "3 szt" labeled "Przyjęto", with
"Zamówiono: 2 szt · Różnica: +1 szt" beneath. A not-yet-delivered order shows "Zamówiono" + the
ordered qty as today.

## What We're NOT Doing

- No backend change; no change to how ordered/received/variance are computed or stored.
- Not changing the receive screen (`ReceiveDeliveryPage` / `ReceiptLineCard`) — it already labels
  "Zamówiono".
- Not adding receipt visibility to the Manager side, not adding a recount gate, not reworking the
  variance vs deviation-% colour overlap — deferred backlog (research §5).
- Not touching the comma-vs-dot number locale.

## Implementation Approach

Restructure only the per-line right column in `OrderDetailPage.tsx` to branch on `receiptLine`
(already in scope), and delete the now-redundant full-width received sub-line. Add three small i18n
labels. One phase.

## Phase 1: Received-as-headline on the post-delivery line

### Changes Required:

#### 1. Restructure the per-line right column

**File**: `frontend/src/pages/captain-mp/OrderDetailPage.tsx`

**Intent**: Branch the headline on whether a receipt exists. Post-delivery → received qty headline
(label "Przyjęto") + "Zamówiono: {snapshot ordered}" + variance secondary. Pre-delivery → unchanged
ordered headline, now with a "Zamówiono" label, keeping the manager-changed hint + deviation badge.

**Contract**: In the right-column block, when `receiptLine` is present render
`roundQty(receiptLine.received_qty_purchase)` as the big number under a `t("orders.detail.receivedLabel")`
caption, then `t("orders.detail.orderedSecondary", { value: roundQty(receiptLine.ordered_qty_purchase), unit: line.purchase_unit })`
and the existing variance render (`variance !== 0` → `t("delivery.variance", …)` with the orange/red
sign colour). When `receiptLine` is absent, render the current `effectiveOrderedQtyPurchase(line)`
headline under a `t("orders.detail.orderedLabel")` caption, keeping the manager-changed hint and the
`delta_vs_suggestion_pct` badge. Remove the separate full-width "Dostarczono: X · różnica Y" block
(its data now lives in the headline + secondary).

#### 2. i18n labels

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Captions for the headline + the post-delivery ordered secondary.

**Contract**: Add
`"orders.detail.orderedLabel": { pl: "Zamówiono", en: "Ordered" }`,
`"orders.detail.receivedLabel": { pl: "Przyjęto", en: "Received" }`,
`"orders.detail.orderedSecondary": { pl: "Zamówiono: {value} {unit}", en: "Ordered: {value} {unit}" }`.
(`orders.detail.received` from the prior change may become unused — remove it if so to keep lint/clean.)

### Success Criteria:

#### Automated Verification:

- Frontend build/type-check passes: `PATH=/opt/homebrew/bin:$PATH npm run build`
- Frontend lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint`
- Frontend unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test`

#### Manual Verification:

- A delivered order (e.g. Awokado captain 3 → manager 2 → received 3) shows a big "3 szt" labeled
  "Przyjęto", with "Zamówiono: 2 szt · Różnica: +1 szt" beneath.
- A not-yet-delivered order shows "Zamówiono" + the ordered (effective) qty + the manager hint as
  today; no "Przyjęto"/received line.
- Variance sign + colour correct (over = orange, under = red), 2 dp.

**Implementation Note**: After automated checks pass, pause for manual confirmation before the
phase-end commit.

## Testing Strategy

### Manual Testing Steps:
1. Open a delivered order → headline = received, labeled; ordered + variance beneath.
2. Open a manager_sent order with no receipt yet → "Zamówiono" + ordered qty, no received line.
3. Open a captain_submitted (editable) order → ordered headline + hint unchanged.

## Migration Notes

None — display-only.

## References

- Research: `context/changes/receiving-received-headline/research.md`
- Headline site: `frontend/src/pages/captain-mp/OrderDetailPage.tsx` (per-line right column)
- Receipt fields: `frontend/src/types.ts` `ReceiptDetailLine` (received/ordered/variance)
- Feedback: `docs/pita-supply-os-v1/DEMO_FEEDBACK.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Received-as-headline on the post-delivery line

#### Automated

- [x] 1.1 Frontend build/type-check passes: `PATH=/opt/homebrew/bin:$PATH npm run build` — df1980f
- [x] 1.2 Frontend lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint` — df1980f
- [x] 1.3 Frontend unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test` — df1980f

#### Manual

- [ ] 1.4 Delivered order: big received qty labeled "Przyjęto" + "Zamówiono: X · Różnica: Y" beneath
- [ ] 1.5 Not-yet-delivered order: "Zamówiono" + ordered qty + manager hint, no received line
- [ ] 1.6 Variance sign/colour correct, 2 dp; captain_submitted order unchanged
