<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Pago + Magazyn Mory on one Transport run

- **Plan**: context/changes/transport-pago-mory-combined/plan.md
- **Scope**: Phases 1–3 of 5 (commits f72a429, 19093e6, 07746f7)
- **Date**: 2026-09-29
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Verified correct: no path lets a companion (Mory) line or extra item reach a supplier-facing document (`leadSupplierView` inside every supplier-facing builder, Pago label from the lead view, backend opt-in flags); single-supplier batches are output-identical; the add-location duplicate guard; the finalize / remove / cancel rules; the new queue guards; React keys and hook dependencies; seam, apiClient, i18n and TS-optionality rules. Every plan-review fix (A1–A8, F1–F8) is implemented and tested.

## Findings

### O1 — Sent-view source-order list has no supplier tag

- **Severity**: OBSERVATION
- **Location**: frontend/src/pages/manager/TransportPage.tsx (orders list)
- **Detail**: WOLA with a Pago and a Mory order shows "Pita Bros Wola" twice.
- **Fix**: supplier chip when the member's supplier is not the batch's.
- **Decision**: FIXED

### O2 — Queue release/cancel of a stale TRN- member leaves no batch event

- **Severity**: OBSERVATION
- **Location**: supply-os-v1/app/main.py (`manager_release`, `manager_cancel`)
- **Fix**: best-effort `order_removed` event ("released from queue" / "cancelled from queue").
- **Decision**: FIXED (`_log_stale_transport_member_exit`, asserted in the release test)

### O3 — `locationsNotInSection` not memoised

- **Severity**: OBSERVATION
- **Detail**: harmless — `AddLocationPicker` has no effect keyed on `items`.
- **Decision**: SKIPPED

### O4 — AGENTS.md test counts stale

- **Severity**: OBSERVATION
- **Decision**: FIXED in Phase 4 (855 / 31 / 600; PR #44 edits the same lines — the PR merged second recomputes)

### O5 — Operator follow-ups

- **Severity**: OBSERVATION
- **Detail**: Mory weights (18 `SP_MORY_*` rows) until filled show as "brak wagi"; a TRN- member's queue dispatch now 409s with an English message, consistent with the existing draft-guard message.
- **Decision**: ACCEPTED (recorded in plan Notes / PR body)
