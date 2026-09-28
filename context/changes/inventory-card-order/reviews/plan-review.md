<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Inventory card order + Pago/Mory list order

- **Plan**: context/changes/inventory-card-order/plan.md
- **Mode**: Deep
- **Date**: 2026-09-28
- **Verdict**: REVISE
- **Findings**: 1 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

- Paths: 8 of 8 exist.
- Symbols: 4 of 4 route line numbers are exact (2796, 3221, 3293, 3418).
- Brief and plan agree.
- The deep-verification sub-agent confirmed:
  - the Captain grid does no sort and shows no sort picker;
  - widening `ProductListSort` breaks no caller;
  - new i18n keys need both pl and en;
  - Sheets and seed tolerate the optional field.

## Findings

### F1 — Phase 4 manual criterion without a Progress row

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 Manual Verification vs `## Progress`
- **Detail**: Phase 4 lists six manual bullets, but Progress has only five rows (4.2–4.6). The
  "Pago Transport documents" bullet has no Progress row, so `/10x-implement` would misparse the
  phase.
- **Fix**: Add `- [ ] 4.7 Pago Transport documents …` to Progress.
- **Decision**: FIXED

### F2 — Captain detail tests break once the route reads master data; test files misnamed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §5–§6
- **Detail**: `tests/test_inventory_counts.py::_activate_sheet` (`:62-77`) patches only the count
  loaders. Once `captain_inventory_count_detail` calls `load_products()` and
  `load_location_product_settings()`, the five existing `test_count_detail_*` tests would hit
  unpatched gspread and fail with 500. The plan's test-file list is also vague:
  - Captain detail tests live in `test_inventory_counts.py`;
  - `product_order` unit tests live in `test_product_order.py`;
  - route-level order tests live in `test_supplier_product_order.py`.
- **Fix**: Name the files exactly, and extend `_activate_sheet` to patch products and settings
  (as `test_inventory_manager.py:121-126` does).
- **Decision**: FIXED

### F3 — Template interleaves off-card products inside the card sequence

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Implementation Approach; Phase 3 §2
- **Detail**: Some active products at a location are not on that location's card but do have a
  template position. They sort inside the card sequence, not after it. Counts from the devil's
  advocate, read-only on prod:
  - NORBLIN 22 (10 drinks, 7 chemia, 5 wine);
  - BRACKA 8;
  - WOLA 4 and KEN 4;
  - BROWARY 3 and ELEKTROWNIA 3;
  - FORUM 1 and SUPERSAM 1.

  A Norblin Captain would meet up to ten drinks between two card rows, which contradicts "the
  grid follows the card". An override can move a row but cannot hide it, so the plan's
  accepted-risk note does not cover this.
- **Fix**: The data batch gives every active setting at a carded location whose product is not
  on that card an override at the end of its category section. The value is the section's last
  card position + 1; ties among extras break by product id.
  - This is data only, with no code change.
  - A local check confirms that every section on all 12 cards has room: the minimum gap to the
    next section is 7.
  - The audit asserts the card sequence is unbroken and that the extras come after it. Products
    whose category is not on the card keep the template.
  - Strength: the card rows stay contiguous, which is literally "the card order". Norblin's
    extra drinks come after the card's drinks.
  - Tradeoff: about 46 more override rows, derived at run time from prod settings.
  - Confidence: HIGH, since the gaps were verified locally from the same data.
  - Blind spot: a product activated at a location later takes the template until the next
    re-run.
- **Decision**: FIXED

### F4 — Re-run semantics make positions generator-owned

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §2 Step 1
- **Detail**: Step 1 clears all overrides before setting them. A hand-set override would
  therefore be wiped by the next run. The plan should say positions are generator-owned, and the
  diff should show the cleared overrides as deletions.
- **Fix**: State the rule in Migration Notes and in the SQL header: never hand-edit
  `inventory_order`; re-parse and re-run. Step 0 also lists overrides that will be cleared.
- **Decision**: FIXED

### F5 — backfill script consumes both column lists

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Migration Notes
- **Detail**: `scripts/backfill_supabase.py:32,38` inserts through `_PRODUCT_COLUMNS` and
  `_LOCATION_PRODUCT_SETTING_COLUMNS`. Run against a pre-0027 database, it fails once the
  columns are listed.
- **Fix**: Name the script in Migration Notes under "apply 0027 first".
- **Decision**: FIXED

### F6 — Seed data never exercises the card order

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §1
- **Detail**: The seed `products.csv` has no `inventory_order`, so seed-mode dev and the local
  Captain preview show product-id order. 0023 mirrored `display_order` into the seed (commit
  7aa1022).
- **Fix**: The generator also writes the template into `docs/pita-supply-os-v1/seed/products.csv`
  (new optional column). Adjust any test that pinned seed product-id order.
- **Decision**: FIXED

## Round 2 (2026-09-28)

- Re-scanned after the fixes:
  - Progress↔Phase: every Success Criteria bullet has a row (Phase 4: 4.1–4.8).
  - No checkboxes outside Progress.
  - The end state now matches the section-end extras rule.
  - The migration numbering was corrected: 0026 = `location_sender_and_phone` on branch
    `claude/loving-feynman-2e6946`.
- No new substantive findings.
- **Verdict after fixes: SOUND.**
