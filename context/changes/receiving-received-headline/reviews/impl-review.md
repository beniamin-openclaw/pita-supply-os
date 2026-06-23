<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Received qty as the post-delivery line headline

- **Plan**: context/changes/receiving-received-headline/plan.md
- **Scope**: Phase 1 (only)
- **Date**: 2026-06-23
- **Verdict**: APPROVED (after F1 fix)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (zero drift; all 4 items match) |
| Scope Discipline | PASS (only the change folder + the 2 planned files) |
| Safety & Quality | PASS (after F1 fix) |
| Architecture | PASS (uses the receipt snapshot; receipt is self-consistent) |
| Pattern Consistency | PASS (after F1 fix) |
| Success Criteria | PASS (build/lint/test green; manual owner-on-deploy) |

Both agents confirmed: post-delivery headline = received (from `received_qty_purchase`); secondary
"Zamówiono: X" from the receipt's `ordered_qty_purchase` snapshot; variance coherent; manager hint +
deviation badge correctly scoped to the pre-delivery branch only; old full-width sub-line removed;
`orders.detail.received` fully removed (no dangling refs).

## Findings

### F1 — terminology divergence "Przyjęto" vs "Dostarczono"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/i18n/strings.ts (orders.detail.receivedLabel) vs delivery.delivered
- **Detail**: The receive screen labels the received qty "Dostarczono"; the new order-detail headline
  labeled the same fact "Przyjęto" — two Polish words for one concept across two screens.
- **Fix**: Changed `orders.detail.receivedLabel` → "Dostarczono" / "Delivered" to match the receive
  screen (lower-risk than re-labeling the established receive input). Now: "Zamówiono" = ordered,
  "Dostarczono" = received, consistent across both screens.
- **Decision**: FIXED

### F2 — legacy receipt rows with `ordered_qty_purchase = 0`

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Correctness
- **Location**: frontend/src/pages/captain-mp/OrderDetailPage.tsx (post-delivery secondary)
- **Detail**: A legacy receipt missing the snapshot would show "Zamówiono: 0" + a variance that reads
  as a surplus. Pre-existing model default (`ordered_qty_purchase` defaults to 0), not introduced
  here; all current receipts snapshot it at submit.
- **Decision**: ACCEPTED (pre-existing data-quality, out of scope)

### F3 — `variance` computed unconditionally in the map callback

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/captain-mp/OrderDetailPage.tsx (map callback head)
- **Detail**: `variance` is `roundQty(receiptLine.variance_qty_purchase)` or 0; it's never read in the
  pre-delivery branch, so harmless — just computed unconditionally.
- **Decision**: ACCEPTED (no bug)

## Triage summary

- **Fixed**: F1
- **Accepted**: F2, F3
- Re-gate after fix: frontend build + lint + tests green.
