<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sub-kg (0.1 kg) Rounding Rule (S-09)

- **Plan**: context/changes/subkg-rounding-rule/plan.md
- **Scope**: Full plan — Phases 1–3 of 3
- **Date**: 2026-06-05
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (21/21 items MATCH) |
| Scope Discipline | PASS (no scope creep; only workflow docs) |
| Safety & Quality | PASS (math swept 5001 pts, parity exact, no div-by-zero) |
| Architecture | PASS (data-layer seam + suggest-only + visible-math held) |
| Pattern Consistency | PASS (1 observation) |
| Success Criteria | PASS (backend 226 + ruff + tsc green; FE build/lint env-limited, accepted) |

## Findings

### F1 — TS detail field required vs backend optional

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/types.ts:227
- **Detail**: `ManagerOrderLineDetail.rounding_rule` was required in TS while the backend Pydantic field is optional-with-default. No runtime mismatch (both enrich paths emit it), but the contract disagreed with the model.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Mirror Pydantic optionality in TypeScript response types"
  - Lesson appended to `context/foundation/lessons.md`.
  - Code fixed: `types.ts` → `rounding_rule?: RoundingRule`; the change surfaced a latent coupling at `OrderEditPage.tsx:37` (fed into the required `OrderableItem.rounding_rule`), fixed with `?? "full_only"` fallback. `tsc -b` green.

### F2 — Legacy per-file env preambles now redundant

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/tests/ (8 files)
- **Detail**: The new `tests/conftest.py` centralizes env setup, but 8 legacy files still carried per-file `os.environ.setdefault` preambles — redundant, and against the existing `lessons.md` order-independence rule.
- **Decision**: FIXED
  - Removed the preamble + unused `import os` + stale `# noqa: E402` from all 8 files (test_main, test_captain_submit, test_manager_queue, test_inventory_submit, test_manager_dispatch, test_manager_save, test_captain_orders, test_manager_claim_release). Kept the legit deferred-import `noqa` at test_manager_dispatch.py:381.
  - Verified order-independence: `pytest tests/test_main.py` alone → 27 passed (relies solely on conftest); full suite 226; ruff clean.

## Notes
- Frontend `vite build` could not run in this environment (rollup native-binary code-signing/Team-ID error on Node 24) and `eslint .` carries pre-existing react-hooks debt in untouched files — both spun out to a separate task. S-09 itself is type-clean and adds no new violations.
- Manual UI verification (plan 3.4–3.7) and the live-Sheet owner step (2.5) remain pending — require a working frontend build / owner access outside this worktree.
