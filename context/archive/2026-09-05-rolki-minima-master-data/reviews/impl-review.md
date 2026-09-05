<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Rolki per lokal + minima dostawców — prod master data

- **Plan**: context/changes/rolki-minima-master-data/plan.md
- **Scope**: Phases 0–3 (all; data-only prod batch, no code)
- **Date**: 2026-09-05
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS — every id, name, unit, min/max/target, note, the 6 DELETEs, the 5 minima, BEFORE snapshot and ROLLBACK match plan.md value-for-value |
| Scope Discipline | PASS — nothing from "What We're NOT Doing" touched; no GoGastro row, no seed/test edits |
| Safety & Quality | WARNING — F1 (audit lacked an in-flight-order assertion; run afterwards, 0 rows) |
| Architecture | PASS — data-only; no code, no schema |
| Pattern Consistency | PASS — matches wolska-blueservice + 0901 phase3 precedents; improves on them (single transaction, literal-notes rollback, FK-guarded rollback) |
| Success Criteria | WARNING — F2 (orderable verified by SQL join simulation, not the literal API call); manual operator check still pending |

Automated checks run during review: `ruff check .` clean; `pytest` 643 passed; prod audit 177/245/1516/14, assertions a–c and f zero rows; idempotence proven with poisoned probes.

## Findings

### F1 — Audit had no assertion that no in-flight order references a deleted size

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: context/changes/rolki-minima-master-data/prod-sql.sql (audit section 3)
- **Detail**: `captain_order_edit` (supply-os-v1/app/main.py) re-validates every line against `location_product_settings`; a captain_submitted order at KEN/BRACKA/NORBLIN with a line on a deleted size would 400 on edit. The safety claim rested on prose ("prawie wyłącznie cancelled"), not a query. Dispatch/save/claim paths do not re-read settings, so they were never at risk.
- **Fix**: Add assertion (f) to the audit block and run it. Ran on prod after APPLY: 0 rows.
- **Decision**: FIXED

### F2 — Orderable check done as SQL join simulation, not the API call the plan names

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Success Criteria; change.md execution log
- **Detail**: No captain tokens were available locally; the same join `_build_orderable_items` uses was executed in SQL and matched Sławek's table per location. Equivalent logic, different method.
- **Fix**: State the method honestly in plan.md Success Criteria.
- **Decision**: FIXED

### F3 — Stale "Nie dotykamy taśm — brak źródła" in plan.md after change.md closed the item

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md "What We're NOT Doing"
- **Detail**: Operator confirmed „taśmy” = rolki; change.md was updated, plan.md was not.
- **Fix**: Strike the line and reference the operator decision.
- **Decision**: FIXED

## Open (not findings)

- Manual operator check on prod (Bracka inventory shows 3 rolls; Manager chip for Intermlecz at 650) — Progress 2.1 stays `[ ]`.
- Follow-ups for Marek: roll pack sizes (opak 10/6), GoGastro onboarding, minima outside Warsaw.
