<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Per-supplier product display order and logistic-minimum exclusions

- **Plan**: context/changes/supplier-product-order-minimum/plan.md
- **Scope**: Phases 1–4 of 5 (Phase 5 is operator-run release)
- **Date**: 2026-09-28
- **Verdict**: APPROVED
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

Plan-drift agent: every planned change in Phases 1–4 is MATCH. Safety agent: no
CRITICAL or WARNING findings. Automated checks: backend 760 passed, integration 25
passed (local Postgres), ruff clean, frontend build + lint + 481 Vitest tests green.

## Findings

### F1 — SUP_INTERNAL guard covered Captain submit only

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/app/main.py (`manager_transport_create`)
- **Detail**: The operator decision was "SUP_INTERNAL is not an ordering supplier".
  Captain submit returned 400, but a Manager could still start a Transport batch for
  SUP_INTERNAL (add-location takes its supplier from the batch header, so create is
  the only entry point).
- **Fix**: 400 in `manager_transport_create` before any read or write, plus a test.
- **Decision**: FIXED — `test_create_internal_production_400_before_any_write`.

### F2 — Transport matrix pin differs from document order

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/pages/manager/lib/transport.ts (`buildTransportMatrix`)
- **Detail**: Manager-added rows stay pinned to the bottom of the editing matrix
  (v5.1, operator decision), while documents follow the canonical order.
- **Fix**: Documented in change.md "Behaviour notes"; to be told to the operator.
- **Decision**: FIXED (documented)

### F3 — Legacy /captain page also hides inactive suppliers

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: frontend/src/pages/CaptainPage.tsx
- **Detail**: `isOrderingSupplier` filters `active` as well as SUP_INTERNAL, so the
  legacy page gained the inactive filter. Harmless — inactive suppliers had no
  orderable rows.
- **Fix**: Documented in change.md "Behaviour notes".
- **Decision**: FIXED (documented)

### F4 — Queue reads supplier_products on every poll

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/app/main.py (`manager_queue`)
- **Detail**: One extra master-data read per ~20 s poll for the minimum basis. Same
  pattern as the detail routes; TTL-cached on Sheets, one query on Supabase.
- **Fix**: None needed; documented.
- **Decision**: ACCEPTED

### F5 — Basis drifts (zeroed line, later price edit)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supply-os-v1/app/main.py (`_minimum_basis_value`)
- **Detail**: Both drifts are documented in the docstring and tested; the chip can
  only warn more, never less, and it never gates.
- **Fix**: None needed.
- **Decision**: ACCEPTED

### F6 — Seed CSV side fix and missing deploy-order section

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: docs/pita-supply-os-v1/seed/supplier_products.csv; change.md
- **Detail**: The quoted `notes` for SP_PAGO_P024 was not mentioned in the change;
  Phase 5 asked for a "Deploy order" section in change.md, which was missing.
- **Fix**: Both added to change.md.
- **Decision**: FIXED
