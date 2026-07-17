<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: add-product-to-order

- **Plan**: context/changes/add-product-to-order/plan.md
- **Scope**: Phases 1–3 of 4 (code phases; Phase 4 = verify & deploy, out of scope for this review)
- **Date**: 2026-06-26
- **Verdict**: APPROVED
- **Findings**: 0 critical | 1 warning | 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Evidence

- Plan drift agent: 12/12 planned items MATCH; the critical seedDrafts-merge check (plan-review F1) PASSES — `handleAddLine` merges into the draft map and does NOT call `seedDrafts`.
- Safety/quality agent: security clean (both new routes manager-auth), data-safety clean (seam-compliant, `_is_persistent` 503 gate, status/total untouched, zero-qty line filtered from the dispatch email), Rules-of-Hooks clean (AddProductPicker hooks all unconditional before the early return), test isolation clean (per-test `mocker.patch`, no real dispatch).
- Success criteria re-run authoritatively: backend `python3 -m pytest` → **416 passed, 16 deselected**; `ruff check .` clean; frontend `npm run lint` clean, `npm run build` clean, `npm run test` → **83 passed**. (A sub-agent's "39 failures" was an artifact of an alternate test invocation; the correct interpreter run is green.)

## Findings

### F1 — ManagerAddLineRequest IDs lack Field(min_length=1)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/models.py — ManagerAddLineRequest
- **Detail**: `product_id` / `supplier_product_id` are bare `str`. A blank string passes Pydantic and reaches the business 400 instead of a clean 422, diverging from every other ID/required request field in the codebase (ManagerReleaseRequest.reason, CaptainSubmitRequest.ordered_by, ReceiptSubmitRequest.received_by, ManagerCancelRequest.reason all use `Field(min_length=1)`).
- **Fix**: Add `Field(min_length=1)` to both fields.
- **Decision**: FIXED — `Field(min_length=1)` added to both fields in models.py; new test `test_add_line_blank_ids_rejected_422` locks in the 422. Re-verify: 417 backend tests + ruff clean.

## Convergence

Phase 5 fix loop converged after one round: the sole WARNING (F1) is fixed; F2 is documented as a no-code-change (its reviewer-suggested fix would reintroduce the plan-review F1 draft-wipe regression); F3 and F4 are accepted as intentional design (Decision Notes / sibling-route parity). No CRITICAL or WARNING remains. Re-verification after the fix: backend `pytest` 417 passed / 16 deselected, `ruff` clean.

### F2 — handleAddLine does not refresh orderableForSelected

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: frontend/src/pages/ManagerPage.tsx — handleAddLine
- **Detail**: After a successful add, `orderableForSelected` is not re-fetched. The reviewer's suggested fix (re-call `loadDetail`/`refreshAll`) would REINTRODUCE the plan-review F1 regression — `loadDetail` runs `seedDrafts`, wiping the manager's unsaved edits. The merge-not-refresh design is intentional and correct: the `availableToAdd` memo re-filters on `detail`, so an added product leaves the picker immediately, and a stale entry (master data changed mid-claim) is re-validated server-side on add (400). Multi-add works correctly via the memo.
- **Decision**: DOCUMENTED — no code change (reviewer fix conflicts with the F1 draft-preservation constraint).

### F3 — Unconditional append_order_lines (TOCTOU)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/app/main.py — manager_add_line
- **Detail**: `append_order_lines` is an unconditional append (no `expected_status` guard). Accepted in the plan's Decision Notes: the captain is locked out while `manager_claimed` (captain edit requires `captain_submitted`), so the add-vs-captain-edit race is impossible by construction; manager-vs-manager is nil at single-token pilot scale.
- **Decision**: ACCEPTED — documented in plan Decision Notes.

### F4 — GET /api/manager/orderable accepts any location_id

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/app/main.py — manager_orderable
- **Detail**: The manager token carries no location, so `location_id` is a free query param. Any manager token can query any location's orderable list — intentional manager-spans-locations design, mirroring `GET /api/manager/queue?location_id=` and `GET /api/manager/inventory/counts?location_id=`. Not a regression.
- **Decision**: ACCEPTED — intentional design, consistent with sibling manager routes.
