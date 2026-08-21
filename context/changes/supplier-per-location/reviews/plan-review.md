<!-- PLAN-REVIEW-REPORT -->
# Plan Review: supplier-per-location

- **Plan**: `context/changes/supplier-per-location/plan.md`
- **Mode**: Deep (verification run inline — this session does not spawn sub-agents unprompted)
- **Date**: 2026-08-20
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | FAIL → PASS after F1 |
| Plan Completeness | WARNING |

## Grounding

7/7 paths ✓ · 5/5 symbols ✓ · plan ↔ research ↔ PRD consistent ✓
Checked: `app/models.py`, `app/main.py`, `app/supabase_backend.py`, `migrations/`,
`tests/test_supabase_integration.py`, `frontend/src/types.ts`,
`frontend/src/pages/captain-mp/components/ProductCard.tsx`.
Lessons applied as priors: "Mirror Pydantic optionality in TypeScript response
types", "Master-data ops: diff before, audit after", "wire every new migration
into the integration fixture".

## Findings

### F1 — The write path bypasses the pin entirely

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 — "the single chokepoint"
- **Detail**: The plan calls `_build_orderable_items` "the single chokepoint", but
  that is only true of the **read** path. `captain_submit` and `captain_order_edit`
  validate through `_resolve_master_data` (`app/main.py:317-338`), a *separate*
  function that builds `sps_by_id` filtered by `supplier_id` alone — no pin, no
  `active`. As planned, a client could POST a line for a pinned-away supplier
  product and the server would accept it, persisting an order the screen would
  never have offered. This is the same class of defect as the dead `active` flag
  the lane exists to fix, so shipping it would be self-defeating.

  It is reachable, not theoretical: Captain drafts persist in local storage with
  **no expiry** by explicit design (`frontend/src/auth.ts`, `loadDraft`: "a draft
  lives until the captain submits the order or clears it explicitly"). A draft
  built before a pin and submitted after it walks straight through the gap.
- **Fix ⭐**: Apply the same allowance test inside `_resolve_master_data` when
  building `sps_by_id` — filter by `_supplier_allowed(...)` and `sp.active`. The
  existing "not orderable at this location" 400 then fires for free with the right
  message, and `captain_submit` / `captain_order_edit` need no edit of their own.
  - Strength: One helper, two call sites, no new error path; read and write paths
    provably share one rule.
  - Tradeoff: `_resolve_master_data` must build `settings_by_pid` before
    `sps_by_id` (currently the reverse order).
  - Confidence: HIGH — both submit and edit already surface a 400 on a missing
    `sps_by_id` entry.
  - Blind spot: None significant; prod has zero pins and zero inactive rows today,
    so the filter is a no-op until Phase 4.
- **Decision**: FIXED (applied to plan)

### F2 — `products.active` exceeds what FR-029 asks for

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1, item 3
- **Detail**: FR-029 covers the *catalog entry* (`supplier_products.active`). The
  plan also filters `products.active`, which no FR requires. It is defensible —
  the inventory screen already filters it (`app/main.py:1980`), so orderable is
  the inconsistent one — and provably a no-op (prod: 0 inactive products). But an
  unlabelled extra is how scope creeps.
- **Fix**: Keep it, and label it in the plan as a deliberate consistency fix with
  its no-op evidence, rather than letting it ride inside the FR-029 bullet.
- **Decision**: FIXED (applied to plan)

### F3 — Manager add-line behavior under a pin is unstated

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, item 2
- **Detail**: `manager_add_line` re-checks membership through `_build_orderable_items`,
  so a pin will start rejecting Manager-added lines with a 400 too. That is almost
  certainly right — the PRD makes orderable membership the one gate a Manager cannot
  override — but the plan never says so, leaving the implementer to infer it and a
  reviewer to wonder whether it was noticed.
- **Fix**: State it explicitly in Phase 1.
- **Decision**: FIXED (applied to plan)

### F4 — No rollback note for migration 0008

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, migration bullet
- **Detail**: The migration is additive and nullable, so rollback is a one-line
  `DROP COLUMN` — but the plan does not say it, and the repo's own lesson
  ("Master-data ops: diff before, audit after") sets the expectation that the
  reverse step is written down before the forward one runs.
- **Fix**: Record the rollback statement in the migration file's header comment.
- **Decision**: FIXED (applied to plan)

### F5 — Orphan-pin warning fires per request

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, orphan-pin bullet
- **Detail**: The warning runs on every orderable build, so one bad pin logs on
  every Captain page load and every supplier switch. At four locations and one
  pilot that is acceptable and arguably desirable — an orphan pin makes a product
  unorderable and should be loud. Recorded so the noise is a choice, not a surprise.
- **Fix**: None. Accepted deliberately; revisit if log volume becomes a cost.
- **Decision**: ACCEPTED
