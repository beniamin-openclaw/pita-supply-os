<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Inventory count — collapsible category sections

- **Plan**: context/changes/inventory-category-sections/plan.md
- **Scope**: Phase 1–2 of 2
- **Date**: 2026-06-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Grounding

Backend pytest 229 passed; ruff clean. Frontend tsc clean; eslint 13 = baseline (0 new); vite build OK. Commits a6a161e (p1 backend), 30c81e4 (p2 frontend), 45d83f5 (epilogue).

## Findings

### F1 — Per-category counter recomputes each render

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/captain-mp/InventoryCountPage.tsx (`countedInGroup` filter inside the group map)
- **Detail**: `countedInGroup` is an O(n) filter computed per group on every keystroke (each stock-input change re-renders). At pilot scale (a few dozen SKUs across a handful of categories) this is negligible. Memoizing per-category counts would only matter at hundreds of products.
- **Fix**: Leave as-is; revisit only if the product list grows large.
- **Decision**: ACCEPTED

### F2 — Category-count chip is bare `{counted}/{total}`

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: strings.ts `inventory.categoryCount`
- **Detail**: The chip shows e.g. "3/8" with no word. It mirrors the compact count chip in `ManagerQueue`, sits next to the category name, and the page already has a labelled "counted/total" line in the sticky footer, so the meaning is clear in context. Routed through `STRINGS` so it can gain a label later without touching components.
- **Fix**: None now — consistent with the existing compact-chip pattern.
- **Decision**: ACCEPTED

## Notes

Collapse state is ephemeral `Set<string>` keyed by category name (categories are unique), default all-expanded — matches the plan's "no persistence / no expand-all" scope guardrails. The product-row markup is byte-for-byte unchanged inside the new sections, so counting + draft + submit behaviour is untouched. Manual gate 2.5 (owner eyeballs grouped UI tomorrow) remains pending by design.
