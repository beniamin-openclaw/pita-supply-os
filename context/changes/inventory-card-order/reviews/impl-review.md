<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Inventory screens in each location's printed card order; Pago and Mory list order

- **Plan**: context/changes/inventory-card-order/plan.md
- **Scope**: Phases 1–3 of 4. Phase 4 is the operator-gated release.
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

The review ran as two parallel passes over 3915bab..9befd16:

- **Plan drift.** Every planned file is a MATCH. `prod-sql.sql`, regenerated from the generator, is byte-identical to the committed file. The seed CSV changed only its new column.
- **Safety and patterns.** Findings cover the following:
  - SQL binding;
  - the 2d join, which cannot fan out and cannot hit a setting twice;
  - the new sort keys, which never raise on None or unknown input;
  - the Manager page, which has no stale-response window;
  - pattern parity with 0023/0025 and `supplier_product_sort_key`.

Success criteria:

- ruff: clean.
- pytest: 833 passed.
- Integration on local Postgres 16: 32 passed.
- Vitest: 597 passed.
- Frontend lint and build: clean.
- Local auth-ON preview: recorded in `verification/preview-notes.md` and `verification/verify-output.md`.

## Findings

### F1 — Step 2d "+ 1" relies on a section gap that only the audit guards

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: context/changes/inventory-card-order/prod-sql.sql (step 2d)
- **Detail**: Extras get `section_end + 1`. This is safe because positions step by 10 and audit 3d catches a contiguity break. A future override placed at `section_end + 1` would still collide, and nothing at 2d says so.
- **Fix**: Add a comment at 2d that names 3d as the tripwire. Do it in the generator, then regenerate.
- **Decision**: FIXED — the comment is in `data/gen_prod_sql.py.txt`, and the regenerated `prod-sql.sql` differs from the old one by that comment only.

### F2 — Step 2d also positions settings of inactive products

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/inventory-card-order/prod-sql.sql (step 2d)
- **Detail**: The plan speaks of "an active product that its card omits". 2d has no `p.active` filter, so it updates 82 rows against 75 active on the local prod copy. This is harmless: inactive products never render, and 1a remains the full rollback.
- **Fix**: Keep the behaviour, because a re-activated product then already sits at its section end, and document it at 2d.
- **Decision**: FIXED (documented) — same 2d comment as F1, plus a note in plan Notes.

### F3 — The inventory sort key has no TS twin, and the docs did not say so

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/product_order.py (module docstring)
- **Detail**: The supplier order has a TS twin with a "change both together" rule. The inventory key deliberately has none, because the frontend "card" sort is a stable sort that trusts the backend's `product_id` tie-break.
- **Fix**: State this in the module docstring.
- **Decision**: FIXED

### F4 — The EN label "Ordering order" reads oddly

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/i18n/strings.ts (`productList.sort.supplier`)
- **Detail**: The PL label "Kolejność zamawiania" is right; the EN label is awkward.
- **Fix**: Change the EN label to "Supplier order".
- **Decision**: FIXED

### F5 — The Manager CSV keeps card order whatever sort the screen shows

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: frontend/src/pages/manager/lib/inventoryCsv.ts
- **Detail**: The CSV iterates `detail.lines`, which are in card order. This matches the plan ("the Manager inventory detail and its CSV follow the card"). A Manager who switches to "Kolejność zamawiania" might still expect the export to match the screen.
- **Fix**: No code change. Record the decision in plan Notes and revisit only on request.
- **Decision**: FIXED (documented)

### F6 — The `captain_inventory_count_detail` docstring did not mention the new sort

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/main.py (`captain_inventory_count_detail`)
- **Detail**: The route now sorts lines by the location's card positions, but its docstring still described only the history and events.
- **Fix**: Add one paragraph to the docstring.
- **Decision**: FIXED

## Non-findings (checked, no action)

- **`test_inventory_edit.py` was edited although the plan did not list it.** This was required: the captain detail route now reads master data.
- **`captain_inventory_count_detail` makes two extra full-table reads per call.** It is the same pattern as the existing Manager twin and fine at pilot volume. A targeted `load_location_product_settings_for(location_id)` is the path if it ever matters.
- **Sheets and seed read `inventory_order` through `_normalize`.** An empty cell becomes None, and a missing header is optional. A non-integer cell would fail on read, the same failure class as `gostock_id`.
