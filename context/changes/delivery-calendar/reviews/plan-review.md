<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Delivery Calendar Implementation Plan

- **Plan**: context/changes/delivery-calendar/plan.md
- **Mode**: Deep (claims checked by hand; the verification sub-agent could not run because the permission classifier returned no verdict)
- **Date**: 2026-09-28
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 1 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING (F2, F4, F5, F6; all fixed in plan) |
| Plan Completeness | WARNING (F1 fixed; F3 waits for the operator) |

## Grounding

11/11 paths ✓; symbols `_parse_weekdays`, `WEEKDAY_MAP`, `_load_order_events_safe` (main.py) and `_DATE_COLS` (supabase_backend.py) ✓; brief↔plan ✓. The worktree's migrations stop at 0022; 0023/0024 belong to other lanes on main, so 0025 relies on the rebase before implementation.

## Findings

### F1 — Phase 2 had a manual bullet with no Progress item

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Success Criteria / Progress
- **Detail**: Phase 2 listed a manual verification bullet that had no matching `2.N` line in `## Progress`, which breaks the Progress↔Phase contract `/10x-implement` parses.
- **Fix**: Replace the manual bullet with the prose line "No manual checks in this phase; the prod check lives in Phase 5."
- **Decision**: FIXED

### F2 — 17:00 boundary and refetch loop were undefined

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Rule model and algorithm; Critical Implementation Details
- **Detail**: The plan did not say whether 17:00:00 counts as on time. A frontend timer firing exactly at the deadline could get the same deadline back from the server and re-arm in a loop.
- **Fix**: Strict `>` in the engine (17:00:00 on time, 17:00:01 late); the timer fires at `order_deadline + 1 s` and never re-arms on a deadline that is not in the future; route tests for 17:00:00 and 17:00:01.
- **Decision**: FIXED

### F3 — Decisions taken from the coordinating lane need operator confirmation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Completeness
- **Location**: Key Decisions (plan-brief), seeded rules table, Phase 1 migration name
- **Detail**: Migration 0025 (the operator's brief said 0024), the Thursday scope of Bukat + Intermlecz only (the brief listed six suppliers), Coca-Cola seeded for WESTFIELD only, and the business-day supplier rules all came from another session relaying Marek and the operator. A peer session is not the operator.
- **Fix**: List these deviations at the plan STOP and wait for the operator's explicit confirmation before `/10x-implement`.
- **Decision**: ACCEPTED — carried to the plan STOP

### F4 — Proposal fetch could land on the wrong supplier

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Wiring
- **Detail**: A slow proposal response for the previous supplier could overwrite the current supplier's proposal after a quick switch.
- **Fix**: Reuse the `cancelled` guard pattern of the orderable effect in `CaptainMP.tsx`.
- **Decision**: FIXED

### F5 — An untouched date could change silently at the deadline

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details — Timing & lifecycle
- **Detail**: After the 17:00 refetch the field follows the new proposal when the Captain has not touched it; without a signal the Captain could submit a date they never saw.
- **Fix**: Show a toast naming the new date when an untouched date moves.
- **Decision**: FIXED

### F6 — Trust boundary for `suggested_delivery_date` was implicit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details
- **Detail**: The plan did not say whether the backend recomputes the proposal at submit or trusts the client value.
- **Fix**: State that the backend stores the client's value as sent (internal, informational; recomputing would disagree with what the Captain saw around 17:00); add a manager-token 401 route test.
- **Decision**: FIXED
