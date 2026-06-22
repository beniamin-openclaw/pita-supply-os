<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Manager cancel (soft-delete) with a who/when/why trace

- **Plan**: context/changes/order-cancel-with-trace/plan.md
- **Scope**: Phases 1–2 of 2 (full)
- **Date**: 2026-06-20
- **Verdict**: APPROVED (2 critical + 1 warning — ALL fixed during triage)
- **Findings**: 2 critical · 1 warning · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (after triage) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (after triage) |

## Evidence

- **Plan-drift sub-agent**: all backend + frontend items MATCH; "What We're NOT Doing" respected (no cancel from manager_sent/closed — 409-gated + tested; no Captain-side button; no hard delete; `OrderDetailPane` `dispatched` logic unchanged). Only variance: cancel tests landed in `test_manager_claim_release.py` (a named-candidate file), not missing.
- **Safety sub-agent**: found a real CI-breaking gap (F1/F2 below) that local pytest hid (integration tests are deselected without a live Postgres). Confirmed safe otherwise: atomic guard correct (`expected_status = order.status.value` → `OrderStatusConflictError` → 409); status gate is exactly captain_submitted+manager_claimed; `cancelled_at` passed as ISO string (matches `_TIMESTAMPTZ_COLS`); Sheets fallback silently drops the trace columns (graceful, status still flips); soft-delete only (no DELETE); frontend button visibility + busy-state handling correct.
- **Automated (post-triage)**: ruff ✓, `pytest` 391 passed / 16 deselected (the new cancel integration test collects).

## Findings

### F1 — Integration `_schema` fixture did not apply migration 0004

- **Severity**: ❌ CRITICAL · **Impact**: 🔎 MEDIUM
- **Dimension**: Success Criteria
- **Location**: supply-os-v1/tests/test_supabase_integration.py (`_schema`)
- **Detail**: The fixture applies migrations 0001/0002/0003 by name but not 0004. Since `_ORDER_COLUMNS` now lists `cancelled_at`/`cancelled_by`/`cancel_reason`, every `append_order`/`update_order` in the integration suite would error ("column does not exist") against the pre-0004 schema — breaking the WHOLE Supabase integration suite in CI. Local pytest passed because those tests are deselected without a live DB.
- **Fix**: The fixture now reads + `exec_driver_sql` 0004 after 0003.
- **Decision**: FIXED.

### F2 — Migration 0004 not idempotent (`ADD COLUMN` without `IF NOT EXISTS`)

- **Severity**: ❌ CRITICAL (downgraded → safety hardening) · **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/migrations/0004_add_order_cancel_trace.sql
- **Detail**: A re-apply (re-provision, or a repeated MCP apply during deploy) would fail with "column already exists".
- **Fix**: All three `ADD COLUMN` → `ADD COLUMN IF NOT EXISTS`.
- **Decision**: FIXED.

### F3 — No cancel round-trip integration test

- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW
- **Dimension**: Success Criteria
- **Location**: supply-os-v1/tests/test_supabase_integration.py
- **Detail**: Unit tests mock `update_order`; the real conditional-UPDATE guard + the new column round-trip were unproven at the DB level.
- **Fix**: Added `test_cancel_contract_conditional` — cancels via `update_order`, asserts status + trace columns persisted, and a second cancel raises `OrderStatusConflictError`.
- **Decision**: FIXED.

### F4 — 503 message wording

- **Severity**: 🔭 OBSERVATION · **Impact**: 🏃 LOW
- **Detail**: The reviewer flagged the 503 string; it actually MATCHES the recently-updated `manager_release`/`manager_dispatch` wording ("requires a persistent backend (…sheet or supabase)"). Consistent with its siblings.
- **Decision**: ACCEPTED (no change — consistent).

### F5 — Detail pane stays open on the now-cancelled order

- **Severity**: 🔭 OBSERVATION · **Impact**: 🏃 LOW
- **Detail**: After cancel, `refreshAll` reloads the detail (shows status "Anulowane") until the user clicks away — identical to the existing `release` behavior. Kept for consistency with `release`.
- **Decision**: ACCEPTED.

## Triage summary

Fixed F1 (fixture applies 0004), F2 (IF NOT EXISTS), F3 (cancel integration test); accepted F4 + F5. Re-verified: ruff + 391 pytest (cancel integration test collects). The deploy ordering (apply 0004 to prod Supabase BEFORE the code) remains a Migration-Notes hard requirement.
Verdict: **APPROVED**.
