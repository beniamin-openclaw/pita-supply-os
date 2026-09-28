<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Zeroing an order line quantity does not drop the line or update the total

- **Plan**: context/changes/order-line-zero-qty/plan.md
- **Scope**: Phases 1-2 of 3 (Phase 3 is operator-gated)
- **Date**: 2026-09-28
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Automated: ruff clean; pytest 745 passed (26 integration deselected); eslint clean; tsc -b clean; vitest 478 passed.
Every old-rule reader goes through app/order_qty.py / lib/orderQty.ts; backend and frontend e-mail builders skip the same lines with the same quantities; Sheets backend tolerates the model field without a sheet column.

## Findings

### F1 — Release paths hand the order back with the Manager's zeros

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/app/main.py manager_release, transport finalize empty-column auto-remove, transport remove-order, transport cancel
- **Detail**: manager_claimed -> captain_submitted transitions leave order_lines untouched, so manager_final_set=true / manager_final=0 survives. A released order then shows 0 and "manager changed" to the Captain and reads as cancelled on the Manager queue; a fully zeroed captain-origin Transport member loops back into the eligible list at total 0. Before this change the zero was not durable, so this path did not exist.
- **Fix**: After each successful release write, clear the flag on lines whose manager_final is 0 (best-effort, logged), so a released order reads exactly as before the change ("as if it had never joined a batch"); positive Manager edits keep today's behaviour. Add route tests.
- **Decision**: FIXED

### F2 — Backfill UPDATE 2 is the only statement that can flip an existing row's quantity

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/migrations/0024_order_line_manager_final_set.sql, prod-sql.sql section B
- **Detail**: UPDATE 2 flags every line of a dispatched non-transport order. For captain_final = 0 it is a no-op; for captain_final > 0 and manager_final = 0 it flips the effective quantity from captain to 0, guarded only by a manual pre-check (A3). It is also unsafe to re-run after go-live (a partial-payload dispatch leaves unflagged lines).
- **Fix**: Drop UPDATE 2. UPDATE 1 covers every row where the flag changes behaviour; the migration becomes provably non-flipping and re-runnable. Keep A3 as an informational query.
- **Decision**: FIXED

### F3 — Deploy blast radius understated

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: plan.md Critical Implementation Details, PR body
- **Detail**: With the new backend live before 0024, every order_lines INSERT (captain submit, captain edit, add-line, add-location prefill) and every Manager save/dispatch UPDATE fails on the missing column, not only captain submit.
- **Fix**: State the full list and the migration-first order in change.md and the PR body.
- **Decision**: FIXED

### F4 — Stale comment restating the old rule

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/manager/transport/TransportMatrix.tsx:5
- **Fix**: Point the comment at lib/orderQty.ts.
- **Decision**: FIXED

### F5 — Dispatch non-payload branch change is broader than planned

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supply-os-v1/app/main.py manager_dispatch
- **Detail**: A line missing from a partial payload now keeps its effective quantity, so a legacy positive manager_final also wins over the captain value. Improvement; the UI always sends every line.
- **Fix**: Note it in change.md and the PR body.
- **Decision**: FIXED

### F6 — Integration backfill test resets the whole table

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/tests/test_supabase_integration.py backfill test
- **Fix**: Scope the reset to the ORD-BF-* orders.
- **Decision**: FIXED

### F7 — Test counts in agent docs drifted

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: AGENTS.md, supply-os-v1/AGENTS.md, frontend/AGENTS.md
- **Fix**: Refresh the counts in the same PR.
- **Decision**: FIXED

### F8 — Over-long comment line

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/manager/lib/managerLine.ts:17
- **Fix**: Wrap at ~80 columns like the rest of the file.
- **Decision**: FIXED

### F9 — Main module keeps a thin alias next to the direct import

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/main.py _effective_ordered_qty
- **Detail**: Two names for one rule in the same file.
- **Fix**: Replace the alias call sites with effective_ordered_qty and remove the alias.
- **Decision**: FIXED

## Post-triage

All nine findings fixed in c0700b5. Merging origin/main (0023 supplier-product-order-minimum, PR #37) brought a new `_minimum_basis_value` that called the old-rule `_effective_ordered_qty` alias; it now uses `order_qty.effective_ordered_qty`, its "zeroed line valued at captain_final" drift note is gone, and `tests/test_minimum_basis.py` covers untouched vs explicitly zeroed lines. /verify after the merge: ruff clean, pytest 782 passed, integration 27 passed (fresh local Postgres, 0023 + 0024), frontend build + lint clean, vitest 495 passed.
