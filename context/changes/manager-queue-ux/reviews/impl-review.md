<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Manager/Captain Queue UX Fixes

- **Plan**: context/changes/manager-queue-ux/plan.md
- **Scope**: Phases 1–3 of 3 (full)
- **Date**: 2026-06-16
- **Verdict**: APPROVED (3 warnings fixed during triage)
- **Findings**: 0 critical · 3 warnings (fixed) · 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (W1 fixed) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- **Plan-drift sub-agent**: all 17 planned items MATCH; no DRIFT/MISSING/EXTRA; no "What We're NOT Doing" violations (editable visual unchanged, no new status/cancel, master-data TTL unchanged, no API-contract change).
- **Safety/quality/pattern sub-agent**: no CRITICAL; JSON.stringify guarded; test files + `ORDERS_TTL_SECONDS` + `dispatched` threading all consistent with existing patterns.
- **Automated success criteria (re-run after fixes)**: FE `npm run test` 36 passed, `npm run build` ✓, `npm run lint` ✓; BE `ruff check .` ✓, `pytest` 335 passed.
- **Manual success criteria**: 1.4/1.5 verified (live 422 shape + unit tests); 2.4–2.6 and 3.4–3.6 are owner-confirmed on the deployed app (local seed mode serves no orders; dev can't reach Railway prod via CORS) — documented in plan Progress.

## Findings

### F1 — formatErrorDetail returned "[]" for an empty detail array

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/apiClient.ts (array branch)
- **Detail**: An empty `detail: []` fell through to `JSON.stringify([])` → `"[]"` shown to the user instead of the fallback.
- **Fix**: Array branch now `return parts.length ? parts.join("; ") : fallback;` (never falls through). Added a unit test for the empty-array case.
- **Decision**: FIXED — 36 FE tests green.

### F2 — sheets.py read-rate comment undercounted (~3 vs ~6/min)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/sheets.py (ORDERS_TTL_SECONDS comment)
- **Detail**: Each 20s poll misses orders + order_lines = 2 reads → ~6/min, not ~3. Still well under the 60/min quota; comment only.
- **Fix**: Comment corrected to "~6 reads/min (orders + order_lines, one cache-miss each per 20s TTL period)".
- **Decision**: FIXED.

### F3 — Stale "60s auto-refresh" file banner in ManagerPage

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/ManagerPage.tsx:2
- **Detail**: File banner still said "60s auto-refresh" after the interval changed to 20s.
- **Fix**: Banner updated to "20s auto-refresh".
- **Decision**: FIXED.

### F4 — manager_claimed queue intentionally unsorted (undocumented)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architecture
- **Location**: supply-os-v1/app/main.py (manager_queue sort)
- **Detail**: Restructuring `if/elif` to `if status in (...)` left manager_claimed in append order (pre-existing behavior). Fine at pilot scale.
- **Fix**: Added a clarifying comment noting it's intentional; revisit if the claimed lane grows.
- **Decision**: FIXED (comment only).

### F5 — dispatched flag does not include "cancelled" status

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architecture
- **Location**: frontend/src/pages/manager/OrderDetailPane.tsx:92
- **Detail**: `dispatched = manager_sent || closed`. The `cancelled` status exists in the enum but no route sets it today (latent). When the separate `order-cancel-with-trace` change adds cancelled transitions, this spot may need to include it so a zeroed line on a cancelled order still reads as cancelled.
- **Decision**: ACCEPTED — noted in the `manager-ux-feedback-backlog` / for the order-cancel-with-trace change.

### F6 — validateToken doesn't use formatErrorDetail

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/apiClient.ts (validateToken)
- **Detail**: Pre-existing — validateToken returns `{ok,status,detail}` (doesn't throw) and keeps its own string guard. Not a regression; a 422 on the probe would show statusText.
- **Decision**: ACCEPTED — out of scope; pre-existing.

### F7 — test fixture uses null for an optional-number field

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/manager/lib/managerLine.test.ts
- **Detail**: Fixture sets `delta_vs_suggestion_pct: null` (type is `?: number`) under an `as` cast; the math never reads it. Compiles with strict off; tests green.
- **Decision**: ACCEPTED — trivial; no correctness impact.

## Triage summary

Fixed: F1, F2, F3, F4. Accepted: F5 (noted for order-cancel-with-trace), F6, F7.
Verdict: **APPROVED**.
