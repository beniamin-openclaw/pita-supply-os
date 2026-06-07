<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dispatch email content — subject + supplier-facing names

- **Plan**: context/changes/dispatch-email-content/plan.md
- **Scope**: Phase 1 of 1
- **Date**: 2026-06-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Grounding

Backend pytest 229 passed (was 227 + 2 new gmail tests); ruff clean. Frontend tsc clean; eslint 13 problems = exact pre-existing baseline (0 new); vite build OK. Commits ed29eeb (feat) + c40330f (epilogue).

## Findings

### F1 — `supplier` param now unused in `_build_subject` call chain

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/gmail_url.py:49 (`_build_body` still takes `supplier`, unused)
- **Detail**: `_build_subject` dropped its `supplier` param (correct — subject no longer uses the supplier name). `_build_body` still accepts `supplier` but never used it (pre-existing, not introduced here). ruff does not flag unused function args, so no lint impact.
- **Fix**: Leave as-is — removing it churns `build_draft_url`'s call site for no behavior gain; out of this change's scope.
- **Decision**: ACCEPTED

### F2 — Subject drops order_id + delivery date (intentional)

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supply-os-v1/app/gmail_url.py:38, frontend/src/pages/manager/lib/emailBody.ts:39
- **Detail**: The new subject `Zamówienie {location_name}` no longer carries order_id or delivery date. This is the owner's explicit request; both still appear in the body (order id in the footer, delivery date in "Data dostawy"). Locked by `test_build_url_subject_is_zamowienie_location` (asserts order_id/supplier absent) and the updated delivery test (date asserted body-only).
- **Fix**: None — matches the agreed contract.
- **Decision**: ACCEPTED

## Notes

Both parallel builders changed together per the S-02 NOTE contract; tests now assert the supplier-facing name is shown AND that an internal name containing "(wewn.)" does not leak. Manual gate 1.7 (owner eyeballs a real draft tomorrow, back-out on submit) remains pending by design — it is tomorrow's pilot test, and the hard rule (no real orders from tests) stands.
