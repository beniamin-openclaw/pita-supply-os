<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Manager TO Ordering (Pago)

- **Plan**: context/changes/to-ordering-pago/plan.md
- **Mode**: Deep (1 verification subagent, 8 claims checked against code)
- **Date**: 2026-08-21
- **Verdict**: SOUND (after fixes — all findings applied to the plan in this session)
- **Findings**: 0 critical, 2 warnings, 2 observations — ALL FIXED

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING → fixed |
| Plan Completeness | WARNING → fixed |

## Grounding

6/7 paths ✓ (1 wrong FE path, fixed), symbols ✓ (`_aggregate_suggestion_review`, `load_order_lines_for_orders`, `OrderStatusConflictError`, `update_order` on both backends, `_TIMESTAMPTZ_COLS` incl. `manager_sent_at`, `supplier_order_reference` in `_ORDERS_COLUMNS`), brief↔plan ✓. Deep verification: claims 1–7 CONFIRMED with evidence (update_order kwarg serialization incl. isoformat precedent at `main.py:1765`; sheets silent-skip of absent columns; dispatch guard semantics; additive model fields — zero FE readers of `supplier_order_reference`; `load_orders()` returns the marker on both backends; order_lines immutability after `manager_sent` verified across all 4 mutating call sites; blast radius nil — `gmail_url.py`/`emailBody.ts` never render `sent_method`/`supplier_order_reference`). Claim 8 CONTRADICTED (route collision) → F2.

## Findings

### F1 — Create loop must catch BOTH guard exception types

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details / Phase 2
- **Detail**: The plan named only `OrderStatusConflictError`, but `sheets.update_order` never raises it — its dispatch guard raises `OrderAlreadyDispatchedError` (see `errors.py` docstring); an uncaught race on Sheets would 500 instead of producing skipped[]. The claim step on Sheets is protected by the route-level preflight, not an in-backend guard.
- **Fix**: Catch `(OrderStatusConflictError, OrderAlreadyDispatchedError)` mirroring `main.py:1774`; document the Sheets asymmetry.
- **Decision**: FIXED (plan updated)

### F2 — GET route collision: literal segments vs `{to_id}`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — endpoints
- **Detail**: `GET /to-ordering/list` and `GET /to-ordering/{to_id}` share a segment shape; FastAPI matches in registration order and this codebase deliberately avoids the pattern (uses `counts` vs `count/{id}` twice).
- **Fix**: Rename to `GET .../batches` (list) + `GET .../batch/{to_id}` (detail) — collision-proof, matches the existing convention.
- **Decision**: FIXED (plan updated)

### F3 — Additive field may break exact-dict test assertions

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 2 — expose marker on queue/detail
- **Detail**: `supplier_order_reference: null` will appear on every queue/detail response; tests asserting `resp.json() == {...}` exactly would fail.
- **Fix**: Added an existing-test sweep item to the Testing Strategy; noted `test_sheets_write.py`'s existing marker round-trip coverage as a reference.
- **Decision**: FIXED (plan updated)

### F4 — Wrong FE template path

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 3 + References
- **Detail**: Plan cited `frontend/src/pages/ManagerInventoryPage.tsx`; actual location is `frontend/src/pages/manager/ManagerInventoryPage.tsx`.
- **Fix**: Path corrected in Phase 3 Intent and References.
- **Decision**: FIXED (plan updated)

## Notes

Mid-review the operator clarified scope (driver list = private; supplier order must EMAIL to the proper address; Bukat pickup outside Warsaw). The plan was updated before this report was finalized: supplier picker, totals-only email builder with "@" gate, private driver matrix, Pago-email master-data prerequisite. The verification subagent's confirmed claims are unaffected by these additions (they touch FE-only surfaces plus the already-verified suppliers read).
