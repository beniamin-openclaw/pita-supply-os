<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Suggestion Learning-Loop Review (S-03 / FR-012)

- **Plan**: context/changes/bukat-suggestion-learning-loop/plan.md
- **Scope**: Full plan (Phases 1–2)
- **Date**: 2026-06-09
- **Verdict**: APPROVED (after F1 fix)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (after F1 fix) |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated (re-run at review): backend `pytest` 281 passed · `ruff` clean · frontend `npm run build` green · `npm run lint` clean. Aggregate correctness, sort, none-skip, name-fallback, seed/worksheet degrade, manager-only auth all covered by `test_suggestion_review.py` (11 tests). Seed empty-state + nav e2e-verified (2.4). Sheet-mode positive paths (1.3, 2.3) deploy-gated.

## Findings

### F1 — Flow line labeled purchase-unit averages with inventory_unit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious
- **Dimension**: Plan Adherence / Correctness
- **Location**: frontend ManagerSuggestionReviewPage flow line + manager.review.flow i18n
- **Detail**: The three averages are purchase-unit quantities (`*_qty_purchase`) but the flow line suffixed them with `inventory_unit` (e.g. "kg") — wrong, and `purchase_unit` lives on `SupplierProduct` and can differ by supplier across an all-lines aggregate.
- **Fix**: Dropped the unit token from `manager.review.flow` (the numbers read as average order quantities, honest for a cross-supplier aggregate). Adding a `purchase_unit` field (join `SupplierProduct`) is a possible future enhancement if per-unit display is wanted at single-supplier scale.
- **Decision**: FIXED (this review)

### F2 — Rounding precision (3 dp qty / 4 dp deviation)

- **Severity**: 🟢 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Detail**: `_aggregate_suggestion_review` rounds quantities to 3 dp and deviation to 4 dp; the UI shows deviation as integer %, so the extra precision is harmless. Reasonable choice, no action.
- **Decision**: ACCEPTED

### F3 — Dynamic i18n key `reason.codes.${code}` bypasses StringKey check

- **Severity**: 🟢 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety
- **Detail**: Runtime-safe today — all 7 `ReasonCode` values have matching `reason.codes.*` entries (verified). A future enum value added without a string would fall back to the raw key. Mirrors an existing codebase pattern.
- **Decision**: ACCEPTED (low risk; t() falls back gracefully)
