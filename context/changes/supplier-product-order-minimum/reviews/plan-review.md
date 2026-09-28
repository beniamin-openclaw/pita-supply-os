<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Per-supplier product order and logistic-minimum exclusions

- **Plan**: context/changes/supplier-product-order-minimum/plan.md
- **Mode**: Deep
- **Date**: 2026-09-28
- **Verdict**: REVISE → SOUND after the fixes below were applied to the plan
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

12/12 paths ✓, 11/11 symbols ✓, brief↔plan ✓, Progress↔Phase ✓ (5 phases, 30 items).
Verification sub-agent confirmed: seed loader coerces "10"→int and "FALSE"→bool;
no seed-mode test depends on Bukat orderable order; every `/api/manager/queue` test
patches `load_supplier_products` with real lists; all edits are keyed by
`order_line_id` / `order_id` (never by index), so reordering cannot misattribute an
edit; `product_id` (`P###`) and `supplier_product_id` (`SP_…`) keys cannot collide in
the merged dict `gmail_url` receives; the Captain count grid never sorts (only filters),
so a new default sort touches only the Manager inventory view; `DispatchPanel` sends
every line, so the stored total after dispatch matches the effective-qty rule.

## Findings

### F1 — Editor pin makes the Manager table disagree with the e-mail

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 §7 (Editor tables), `sortEditorLines`
- **Detail**: Today every surface sorts by `order_line_id`, so manager-added `-M-` lines
  are last everywhere — the table and the e-mail agree. The plan pins `-M-` lines last in
  the Manager table but interleaves them canonically in the e-mail and copy lists, so an
  order with a manager-added product reads differently in the table and in the e-mail —
  the opposite of "one order everywhere". The bottom position in the Manager table is an
  artefact of id sorting, not an operator decision; the only explicit operator rule
  ("dodaje się od dołu", v5.1) is about the Transport matrix.
- **Fix A ⭐ Recommended**: Manager order table renders the backend's canonical order
  (no FE re-sort, no `sortEditorLines`); keep the v5.1 pin only in the Transport matrix.
  - Strength: Table = e-mail = Captain screen for every order; less code.
  - Tradeoff: A just-added product lands at its position, not at the bottom.
  - Confidence: HIGH — pin in the Manager table is incidental (`emailBody.ts:79`,
    `OrderLineTable.tsx:97` render id order).
  - Blind spot: Operator preference for the add-line landing spot not asked.
- **Fix B**: Pin `-M-` lines last in the e-mail and copy lists too.
  - Strength: Keeps today's "added at the bottom" everywhere.
  - Tradeoff: Supplier sees an added Bukat item out of the agreed order.
  - Confidence: MEDIUM.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A) — flagged for operator confirmation at plan approval

### F2 — Exact-key test on InventoryProduct not named

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §1 / 4.1
- **Detail**: `tests/test_inventory_submit.py:38-53`
  (`test_inventory_products_lists_location_products`) asserts the exact key set of
  `InventoryProduct`; adding `supplier_product_id` / `display_order` breaks it.
- **Fix**: Name the test in Phase 4 and update its expected key set.
- **Decision**: FIXED

### F3 — Transport test fixtures tie on one supplier_product_id

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §7 / 2.5
- **Detail**: `transport.test.ts` `orderLine` fixture defaults every line to
  `supplier_product_id: "SP1"` (`:383-390`); with the canonical key rows tie, so
  `:450-481` and also `:484-501` ("keeps a manager-filled cell … alphabetized") break.
- **Fix**: Give fixtures distinct `supplier_product_id`s and list `:484-501` among the
  tests to update.
- **Decision**: FIXED

### F4 — Zeroed excluded line not covered by the basis tests

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §1 / 3.1
- **Detail**: A line zeroed by the Manager contributes 0 to the stored total but
  `_effective_ordered_qty` reads its `captain_final`, so an excluded zeroed line is
  subtracted anyway → basis too low → false "below". The plan accepts the direction but
  neither documents nor tests it; a later price edit likewise shifts the basis, not the
  stored total.
- **Fix**: State both cases in the helper docstring; add the zeroed case to 3.1.
- **Decision**: FIXED

### F5 — Seed has a 15th active Bukat row

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 manual 2.8
- **Detail**: `SP_BUKAT_P135` Bombilla is active in the seed (inactive on prod), so the
  seed preview shows it position-less after Feta blok.
- **Fix**: Say so in 2.8.
- **Decision**: FIXED

### F6 — Small precision gaps in critical details

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details; Phase 1 §3
- **Detail**: The queue read must follow the `_is_persistent` early return (seed test
  `test_main.py:248-272`); "MagicMock already does" is moot (no queue test uses a mock
  backend); the `P…`/`SP_…` key-namespace assumption `gmail_url` relies on is undocumented.
- **Fix**: Reword the queue bullet; add the namespace note to `line_sort_key`.
- **Decision**: FIXED

### F7 — Phase 4 goes beyond the literal ask

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Phase 4
- **Detail**: Marek asked for one order per supplier; inventory lists span suppliers. The
  supplier-block count grid and the new default Manager sort change what captains and
  Sławek see weekly. Grounded in meeting 2026-09-18 §2.6, independent of phases 1–3,
  and already marked separable in the brief.
- **Fix**: Keep as a separable phase; the operator confirms or drops it at plan approval.
- **Decision**: ACCEPTED — operator decision at approval
