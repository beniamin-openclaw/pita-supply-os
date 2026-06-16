<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Order-Screen UX Fixes

- **Plan**: context/changes/order-screen-ux-fixes/plan.md
- **Scope**: Phases 1–3 of 3 (full)
- **Date**: 2026-06-16
- **Verdict**: APPROVED (3 observations, all addressed during triage)
- **Findings**: 0 critical · 0 warnings · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- **Plan-drift sub-agent**: all 12 planned items MATCH; no DRIFT/MISSING/EXTRA. "What We're NOT Doing" fully respected — no backend/API change, no new `max` gate, `InventoryCountPage` untouched, SUGESTIA "—" display unchanged, dispatched-cancelled logic + manager save button untouched.
- **Safety/quality/pattern sub-agent**: no CRITICAL, no WARNING. `buildPayloadLines` drop/include logic verified (no NaN, no `Number("")` surprise; blank→0 safe). Frontend↔backend deviation gate produces identical observable outcomes. Pattern compliance clean (exports, i18n keys, predicates, tests match siblings). Cross-phase (builder × compute, stats/hasRedCards/anyTouched) consistent.
- **Automated success criteria (re-run, incl. post-triage)**: FE `npm run build` ✓, `npm run lint` ✓, `npm run test` 47 passed.
- **Manual success criteria**: 1.4–1.6, 2.4–2.6, 3.4–3.6 are owner-confirmed on the deployed app (local seed serves no orders; dev can't reach prod via CORS) — documented in plan Progress.

## Findings

### F1 — "Enter stock" copy now misleading (whole class)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/i18n/strings.ts (`state.empty`, `sticky.fillStockFirst`)
- **Detail**: With stock now optional, the grey row state and the sticky-bar hint both told the captain to enter stock, but the only required field is the order qty. Triage widened the fix from the single flagged key (`state.empty`) to the whole class — `sticky.fillStockFirst` shared the stale assumption.
- **Fix**: `state.empty` → "Wpisz zamówienie" / "Enter order qty"; `sticky.fillStockFirst` → "Wpisz zamówienie, by aktywować przycisk Wyślij" / "Enter an order qty to enable the Submit button".
- **Decision**: FIXED — both copies updated; 47 FE tests + build + lint green.

### F2 — Edit screen pre-fills blank-submitted stock as 0

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/captain-mp/OrderEditPage.tsx (`lineToFormState`)
- **Detail**: An order submitted with a blank stock persists as 0 (buildPayloadLines coerces blank→0), so re-editing shows "0" rather than blank — technically correct (0 is the value of record), but could read as "counted zero". The real distinction (blank vs 0) would need a nullable backend field — out of scope per the "no backend change" decision.
- **Fix**: Added a clarifying comment at `lineToFormState` documenting that 0 is the persisted value of record.
- **Decision**: FIXED (comment) — behavior intentionally unchanged.

### F3 — FE/BE deviation denominator differ for suggested=0

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious
- **Dimension**: Architecture
- **Location**: frontend/src/pages/captain-mp/lib/compute.ts (`computeDeviation`)
- **Detail**: For `suggested=0` the frontend returns Infinity while the backend floors the denominator at `rounding_step(rule)`. Outcomes are identical under the current ruleset (any positive order vs a 0 suggestion requires a reason on both sides); mirroring the backend formula would change the displayed `%` with no behavior gain and risk regressions.
- **Fix**: Added a backend-parity comment at `computeDeviation` noting the intentional divergence and the keep-in-sync caveat (comment, not a formula change).
- **Decision**: FIXED (comment) — formula intentionally unchanged.

## Triage summary

Fixed: F1 (both copies), F2 (comment), F3 (comment). No findings skipped or deferred.
Verdict: **APPROVED**.
