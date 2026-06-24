<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Manager Receiving View

- **Plan**: context/changes/manager-receiving-view/plan.md
- **Scope**: Full plan (Phase 1 + Phase 2)
- **Date**: 2026-06-24
- **Verdict**: APPROVED (6 observations, all addressed in the Phase-5 fix loop)
- **Findings**: 0 critical, 0 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Drift summary: 15 MATCH, 2 benign documentation drifts (F5/F6), 0 MISSING, 0 EXTRA.
Scope guardrails ("What We're NOT Doing") all respected. Auth unchanged
(`require_manager`); read-only/additive; no schema/write/status change. Backend
399 tests + ruff green; frontend build + lint + 77 tests green.

## Findings

### F1 — Receipt reads are full-table scans (no F-7 targeted loader)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/main.py (`_load_order_receipts`, `manager_queue` sent-lane block)
- **Detail**: `load_receipts()` + `load_receipt_lines()` are full-table reads filtered in Python, unlike the F-7 `load_order_lines_for_orders` targeted query. Acceptable at pilot volume; the plan's Performance Considerations already documents this.
- **Fix**: Add a short TODO comment pointing at a future `load_receipt_lines_for_orders` (mirror F-7) so the gap is visible in-code.
- **Decision**: FIXED

### F2 — Receipt worksheet TTL is 60s vs orders' 20s

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/sheets.py (`load_receipts`, `load_receipt_lines`)
- **Detail**: Receipt reads use `DEFAULT_TTL_SECONDS` (60s). The new queue ✓/⚠ chip is now live-queue data, so a confirmed delivery can lag up to 60s — inconsistent with the 20s `ORDERS_TTL_SECONDS` intent that keeps the queue fresh.
- **Fix**: Pass `ORDERS_TTL_SECONDS` to both receipt `_read_with_ttl` calls.
- **Decision**: FIXED

### F3 — No explicit CLOSED-status detail test

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supply-os-v1/tests/test_manager_receiving.py
- **Detail**: The detail receipt-load gate is `status in (MANAGER_SENT, CLOSED)`, but only the CAPTAIN_SUBMITTED skip case is tested; the CLOSED arm is untested.
- **Fix**: Add `test_detail_closed_order_includes_receipts`.
- **Decision**: FIXED

### F4 — Queue chip ✓/⚠ symbols not aria-hidden

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/manager/ManagerQueue.tsx (receipt chips)
- **Detail**: The decorative ✓/⚠ glyphs aren't wrapped in `aria-hidden="true"`; the same file wraps its other decorative symbols (the `·` separator) that way, so a screen reader will read "check mark Dostarczono".
- **Fix**: Wrap each glyph in `<span aria-hidden="true">…</span>`.
- **Decision**: FIXED

### F5 — DeliverySection mount position differs from plan wording

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/pages/manager/OrderDetailPane.tsx
- **Detail**: The plan's contract said "between `<OrderLineTable/>` and the summary strip"; it was mounted after the estimated-value block (before the action buttons). The implemented placement is intentional and arguably better (delivery reads as post-order info; doesn't push the save affordance down). No functional consequence.
- **Fix**: Reconcile the plan's Phase 2 change #4 contract wording to the implemented placement (don't move working UI to a worse spot).
- **Decision**: FIXED (plan wording reconciled)

### F6 — Detail receipt fetch gated on status vs plan "unconditionally"

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supply-os-v1/app/main.py (`manager_order_detail`)
- **Detail**: Plan said attach receipts "unconditionally"; implementation gates on `status in (MANAGER_SENT, CLOSED)`. Correct optimization — `captain_receipt_submit` requires `manager_sent`, so no other status can carry receipts. Functionally equivalent, avoids a needless scan, and keeps existing detail tests green.
- **Fix**: Reconcile the plan's Phase 1 change #2 contract wording to document the status gate + rationale.
- **Decision**: FIXED (plan wording reconciled)
