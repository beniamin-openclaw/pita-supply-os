<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Order qty display fixes

- **Plan**: context/changes/order-qty-display/plan.md
- **Scope**: Phases 1-2 (both)
- **Date**: 2026-06-23
- **Verdict**: NEEDS ATTENTION → resolved (F1 + F4/F5/F7 fixed; rest accepted)
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (F1) → fixed |
| Architecture | PASS |
| Pattern Consistency | WARNING (F1, F7) → fixed |
| Success Criteria | PASS (automated green; manual owner-on-deploy) |

Plan-drift agent: NO DRIFT — all 9 changed files match plan intent; the only divergence (`.find()` vs the plan's `Map`) is within intent and behavior-identical. No scope creep.

## Findings

### F1 — OrderDetailPage fetch has no cancellation guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: frontend/src/pages/captain-mp/OrderDetailPage.tsx (load)
- **Detail**: `load` was a `useCallback` with no `cancelled` flag (unlike sibling `ReceiveDeliveryPage`). On fast mobile back/forward an in-flight `api.receipt`/`captainReceipts`/`receiptPhotoUrls` chain could setState after unmount or overwrite a newer order's receipt with stale data.
- **Fix**: Inline the fetch into `useEffect` with a `let cancelled` flag guarding every setState; drop the now-unused `useCallback` import. Mirrors the project's own pattern.
- **Decision**: FIXED

### F7 — first use of `src/lib/`, convention undocumented

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/lib/orderQty.ts
- **Detail**: Top-level `src/lib/` is new (peers live in `pages/*/lib/`). Valid for cross-feature sharing but unrecorded, risking a third location next time.
- **Fix**: Add a helper-placement rule to `frontend/AGENTS.md` (cross-feature → `src/lib/`, per-feature → `pages/*/lib/`, UI/number utils → `components/ui/`). Also corrected the stale "no test runner exists yet" tripwire (Vitest is configured).
- **Decision**: FIXED

### F4 — manager-changed hint condition is subtle

- **Severity**: ⚠️ WARNING (per agent; verdict was "correct, add a comment")
- **Impact**: 🏃 LOW
- **Dimension**: Correctness
- **Location**: frontend/src/pages/captain-mp/OrderDetailPage.tsx (hint block)
- **Detail**: Hint shows when `manager_final > 0 && manager_final !== captain_final`; the big number shows the effective qty whenever `manager_final > 0`. Logic is correct (equal/unset → no hint) but non-obvious.
- **Fix**: Inline JSX comment explaining the condition.
- **Decision**: FIXED

### F5 — `roundQty(1.005) === 1` not noted in docstring

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Correctness
- **Location**: frontend/src/components/ui/number.ts
- **Detail**: Binary half-way cases truncate down — fine for killing arithmetic tails, misleading if reused to snap user-entered values.
- **Fix**: Added a NOTE to the docstring.
- **Decision**: FIXED

### F2 — multi-receipt orders show only `rs[0]`

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Reliability
- **Location**: frontend/src/pages/captain-mp/OrderDetailPage.tsx
- **Detail**: Only the first (newest — `captain_receipts` sorts `received_submitted_at` desc) receipt is overlaid. Multiple receipts per order are not expected at pilot scale.
- **Decision**: ACCEPTED (pilot scale; newest-first ordering is the intended one)

### F3 — backend None-vs-0 distinction

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Correctness
- **Location**: frontend/src/lib/orderQty.ts
- **Detail**: Backend guards `manager_final and manager_final > 0`; the TS field is non-optional `number` (0 on the wire), so `> 0` alone is equivalent. Matches for all valid wire values.
- **Decision**: ACCEPTED (equivalent on the wire; docstring already states the rule)

### F6 — test `as ManagerOrderLineDetail` cast

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Type-safety
- **Location**: frontend/src/lib/orderQty.test.ts
- **Detail**: Factory casts a 2-field object; with `strict` off the other fields aren't checked. Fine for a pure-function test reading only those two fields; matches existing test conventions.
- **Decision**: ACCEPTED

### F8 — i18n two-slot template

- **Severity**: 📝 OBSERVATION (no issue)
- **Location**: frontend/src/i18n/strings.ts + OrderDetailPage.tsx
- **Detail**: `orders.detail.received` uses `{value} {unit}`; `t()` interpolation supports multi-variable templates (confirmed). Correct.
- **Decision**: ACCEPTED (no change)

## Triage summary

- **Fixed**: F1, F4, F5, F7
- **Accepted (no change)**: F2, F3, F6, F8
- Re-gate after fixes: build + lint + 73 tests all green.
