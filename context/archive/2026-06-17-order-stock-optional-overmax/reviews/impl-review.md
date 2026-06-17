<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Current stock optional — over-MAX-only gate when uncounted

- **Plan**: context/changes/order-stock-optional-overmax/plan.md
- **Scope**: Phases 1–2 of 2 (full)
- **Date**: 2026-06-17
- **Verdict**: APPROVED (1 warning + 2 observations, all FIXED during triage)
- **Findings**: 0 critical · 1 warning · 2 observations

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

- **Plan-drift sub-agent**: 17/17 planned items MATCH; no DRIFT/MISSING/EXTRA. The over-MAX threshold is byte-identical backend (`_evaluate_submit_line`) vs frontend (`computeRowState`): strict `>`, `max > 0` guard, `!allow_over_max_due_to_packaging`, `final * units_per_purchase_unit` base. "What We're NOT Doing" respected (no schema migration, no over-MAX on the counted path, no InventoryCountPage / SUGESTIA / manager-summary change).
- **Safety/quality sub-agent**: 0 CRITICAL. Verified clean: `None` never reaches the `order_lines.current_stock_qty_base NOT NULL` column (uncounted persists `0.0`); `None` never reaches `compute_suggestion` (`current_for_math` coerces first); `delta_vs_suggestion_pct=None` lands in the nullable column; exact-MAX boundary, `max=0`, and `allow_over_max` all consistent across the two sides; counted-zero still hits the critical/deviation gate; inventory-snapshot pre-fill only carries genuinely-counted zeros.
- **Automated success criteria (post-triage)**: backend ruff ✓, **384 pytest** ✓; frontend `npm run build` ✓, `npm run lint` ✓, `npm run test` 49 ✓.
- **Manual success criteria**: 1.3, 2.4–2.6 owner-confirmed on prod (2026-06-17 smoke-check).

## Findings

### F1 — Edit-screen over-MAX parity gap

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; cross-cuts backend + frontend
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/captain-mp/OrderEditPage.tsx `lineToItem` vs supply-os-v1/app/main.py `_evaluate_submit_line`
- **Detail**: `lineToItem` hardcoded `max_stock_qty_base: 0` / `allow_over_max_due_to_packaging: true`, so the uncounted over-MAX branch in `computeRowState` could never fire on the edit screen — yet `captain_order_edit` *does* enforce it. A captain who clears the pre-filled stock on edit and orders over MAX would see a neutral yellow pill, then hit an unexplained backend 400 on submit. The plan had scoped edit max-plumbing out on the assumption "a persisted line always has a numeric stock" — true on load, but the captain can still clear the field.
- **Fix**: Plumb the real ceiling into the order detail: added `max_stock_qty_base` + `allow_over_max_due_to_packaging` to `ManagerOrderLineDetail`, populated from `location_product_settings` in `manager_order_detail` + `_enrich_lines_for_detail` (so both manager and captain detail carry them); `lineToItem` now uses the real values. Frontend now shows the red over-MAX pill before submit, matching the backend. Added TS fields + adjusted the `_enable_sheet_backend` test mock.
- **Decision**: FIXED — full parity, no behavior on the counted path changed.

### F2 — `captain_submit` docstring omitted the over-MAX gate

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/main.py `captain_submit` docstring
- **Detail**: The endpoint's validation-gates list didn't mention the new uncounted-over-MAX 400.
- **Fix**: Added a gate bullet pointing to `_evaluate_submit_line`.
- **Decision**: FIXED (docstring).

### F3 — Missing edit-path "over-MAX with reason" test

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious
- **Dimension**: Success Criteria
- **Location**: supply-os-v1/tests/test_captain_orders.py
- **Detail**: The submit path had the full trio (normal / over-MAX no-reason 400 / over-MAX with-reason 200+warning); the edit path lacked the with-reason case.
- **Fix**: Added `test_edit_uncounted_over_max_with_reason_passes`.
- **Decision**: FIXED.

## Triage summary

Fixed: F1 (edit-screen parity — backend detail join + frontend wiring + test mock), F2 (docstring), F3 (test). No findings skipped. Re-verified: backend ruff + 384 pytest; frontend build + lint + 49 tests, all green.
Verdict: **APPROVED**.
