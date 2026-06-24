<!-- PLAN-REVIEW-REPORT -->
# Plan Review: UX Quick-Wins Round 1

- **Plan**: context/changes/ux-quick-wins-r1/plan.md
- **Mode**: Deep (grounding from 4 planning Explore agents reused; no new sub-agent)
- **Date**: 2026-06-24
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding
9/9 paths ✓ (main.py, compute.ts, OrderDetailPage.tsx, OrderLineTable.tsx, strings.ts,
ReceiptLineCard.tsx, ReceiveDeliveryPage.tsx, CaptainTabs.tsx, orderQty.ts),
symbols ✓ (`_DEVIATION_THRESHOLD`, `computeRowState`, `formatPct`,
`effectiveOrderedQtyPurchase`, `CaptainTabs`), brief↔plan ✓, Progress↔Phase ✓.

## Findings

### F1 — Phase 2 "shared formatter" is heavier than the guard needs

- **Severity**: 🟦 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 — change 1
- **Detail**: The plan proposes a `formatDeviationPct(delta, suggested)` helper, but the
  two bare-% sites format differently (captain inline `Math.round(*100)` vs manager
  `formatPct`), so a single formatter would have to absorb both styles. An inline
  `suggested_qty_purchase === 0 ? t("deviation.noBaseline") : <existing render>` guard
  at each site is simpler and lower-risk (no visual change to the non-zero path).
- **Fix**: Implement as inline guards + one i18n key, not a unifying formatter.
- **Decision**: FIXED (adopted in implementation — inline guard at each site; the pill
  routes to `state.noBaseline*` messages in compute.ts).

### F2 — Phase 2 `suggested === 0` also covers stock ≥ target, not only bucket SKUs

- **Severity**: 🟦 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — acceptance
- **Detail**: A suggestion of 0 arises for any line where current stock ≥ target, not
  just "bucket SKUs". The guard therefore shows "brak bazy" whenever suggestion is 0.
  This is correct — there is no baseline to compute a % against in any of those cases,
  and the owner's bar is "never a giant %", which this satisfies — but worth recording
  so the copy isn't mistaken for bucket-SKU-only.
- **Fix**: None needed; documented as intended behavior.
- **Decision**: ACCEPTED (intended).

## Notes
Plan is SOUND: five low-blast-radius, single-file edits with explicit file:line targets,
runnable success criteria, and added boundary regression tests. No CRITICAL/WARNING.
Both observations are LOW and already reconciled in implementation. Loop ends clean in
one pass.
