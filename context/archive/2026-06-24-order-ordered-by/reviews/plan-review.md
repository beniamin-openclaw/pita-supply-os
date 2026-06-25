<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Order `ordered_by` ("who orders")

- **Plan**: context/changes/order-ordered-by/plan.md
- **Mode**: Deep
- **Date**: 2026-06-24
- **Verdict**: SOUND (after folding F1 on this pass)
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING (F1 — folded in) |

## Grounding

12/12 paths ✓, symbols ✓ (`_ORDER_COLUMNS`:103, `CaptainSubmitRequest`:163, `received_by`/`count_user` Field mirrors, 422 test mirrors present), brief↔plan ✓. Blast radius confirmed contained: only `tests/test_captain_submit.py` POSTs submit bodies; only `CaptainMP.tsx:356` calls `captainSubmit`; one `Order(...)` constructor (`main.py:541`); no other `CaptainSubmitRequest(...)` construction; no frontend tests touch it.

## Findings

### F1 — Required field flips existing 400 business-gate tests to 422

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §6 (backend tests)
- **Detail**: Making `ordered_by` Pydantic-required means a submit body omitting it returns 422 *before* the business-logic gate runs. `test_captain_submit.py` has 24 submit POSTs, including 400-expecting business-gate tests (over-MAX, deviation, critical-under). If those lose the field they flip 400→422. The plan's "200/business-gate path" wording was correct but under-specified.
- **Fix**: Make the test instruction explicit — add `ordered_by` to **every** existing submit body (both 200 happy-path and 400 business-gate), excluding only the two new missing/blank-`ordered_by` 422 tests.
- **Decision**: FIXED (folded into plan Phase 1 §6 on this pass)

## Notes

- No adversary pair summoned: although the change touches the persistence seam (`_ORDER_COLUMNS`), the decision is fully settled — one additive nullable column mirroring migration `0004_add_order_cancel_trace.sql`, with no architectural fork, no HIGH-impact or contested finding.
- Production-safety prerequisite (INSERT now writes the column → prod needs the DB column first) is explicitly handled: migration `0005_add_ordered_by.sql` is created-but-not-applied and flagged for the user's deploy. This is the right call for a local-only run.
- Deviation from the original spec (`orders.csv` / `seed_loader.py`) is grounded and documented in the plan — those paths don't exist; the round-trip goal is fully met via `models.py` + `supabase_backend._ORDER_COLUMNS` (+ sheets auto-serialization).
