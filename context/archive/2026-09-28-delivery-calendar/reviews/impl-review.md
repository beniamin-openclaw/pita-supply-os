<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Delivery calendar

- **Plan**: context/changes/delivery-calendar/plan.md
- **Scope**: Phases 1–5 of 5 (diff c5812a1...HEAD)
- **Date**: 2026-09-28
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Backend `python3 -m pytest -q`: 805 passed. `-m integration` on a throwaway Postgres 16.14 DB: 29 passed, including the four migration-0025 tests.
- Frontend `tsc -b`, `eslint --max-warnings=0`: clean. `vitest run`: 509 passed.
- `ruff check .`: clean.
- Plan drift: the eight focus checks all MATCH. There are no MISSING items and no harmful EXTRA items.
- Security: `GET /api/captain/delivery-proposal` is captain-only and takes the location from the token. A Manager token or a missing token gets 401. `supplier_id` is used only in Python filtering, never in SQL.
- Migration 0025:
  - Re-runnable, and it has a rollback block.
  - RLS is enabled with deny-all, same as 0010/0014/0020.
  - `UNIQUE NULLS NOT DISTINCT` needs PG 15+. CI runs PG 16 and prod runs PG 17.
- Sheets `append_order` writes only header columns, so a tab without the new columns keeps working. Transport, the Pago flow and the e-mail builders do not read the new fields.

## Findings

### F1 — Toast fired inside a state updater

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/captain-mp/CaptainMP.tsx (proposal effect)
- **Detail**: The effect called `showToast` inside the `setProposalFor(prev => …)` updater. Updaters must be pure. Under `<StrictMode>` in dev the toast fired twice.
- **Fix**: Read the previous proposal from a `proposalForRef`, fire the toast in the `.then`, and pass a plain value to `setProposalFor`.
- **Decision**: FIXED

### F2 — Deadline refetch stops when the browser clock runs ahead of the server

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/captain-mp/CaptainMP.tsx (deadline timer effect)
- **Detail**: If the phone clock runs more than about 1 s ahead, the refetch returns the same deadline. The timer then computes `ms <= 0` and never re-arms, so the strip keeps showing a deadline that has already passed.
- **Fix**: When the deadline has already passed on the browser clock, re-arm after a 30 s backoff (`DEADLINE_RETRY_MS`).
- **Decision**: FIXED

### F3 — prod-sql seed ignored corrections on re-run

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Safety & Quality
- **Location**: context/changes/delivery-calendar/prod-sql.sql (step 3)
- **Detail**: `ON CONFLICT DO NOTHING` meant that re-running the seed after correcting Marek's rules had no effect.
- **Fix**: Changed to `ON CONFLICT (rule_id) DO UPDATE SET …`. Ran it twice on the local demo DB: still 12 rows, no error.
- **Decision**: FIXED

### F4 — Stored suggested date is the proposal at submit time

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Plan Adherence
- **Location**: frontend/src/pages/captain-mp/CaptainMP.tsx (handleSubmit)
- **Detail**: The Captain may pick a date at 16:55 and submit after 17:00. In that case the stored `suggested_delivery_date` is the new proposal. The Manager marker then shows that the chosen date is no longer reachable, which is the useful signal.
- **Fix**: None. The behaviour is kept intentionally.
- **Decision**: SKIPPED

### F5 — Date field hidden while the proposal request is pending

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/captain-mp/CaptainMP.tsx (`isProposalLoading`)
- **Detail**: A hanging request keeps the date field hidden. Submit still sends the legacy fallback date, so no data is lost. A failed request shows the field with the fallback.
- **Fix**: None for now. Revisit if Captains report a missing date field.
- **Decision**: SKIPPED

### F6 — Plan text drift (fallbackDate prop, roadmap row id)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Plan Adherence
- **Location**: plan.md Phase 3 / Phase 5
- **Detail**:
  - The plan names a `fallbackDate` prop on DeliveryDateField. The parent passes an already-resolved `value` instead.
  - The plan names roadmap row R-21. The row is R-26 after the merges with main (R-21..R-25 taken by other changes).
- **Fix**: None. Recorded here; behaviour matches the plan's intent.
- **Decision**: SKIPPED

### F7 — Fallback `delivery_days` parsing differs for non-integer values

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW (quick decision; the fix is obvious and narrowly scoped)
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/main.py `_fallback_delivery_params` vs frontend `getRequestedDeliveryDate`
- **Detail**: Only a value like "2.5" is parsed differently by the two sides. No such value exists in seed or prod data.
- **Fix**: None.
- **Decision**: SKIPPED
