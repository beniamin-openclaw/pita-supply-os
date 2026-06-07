<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Clear frontend eslint debt

- **Plan**: context/changes/frontend-lint-debt/plan.md
- **Scope**: Phase 1 of 1
- **Date**: 2026-06-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

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

`npm run lint` (Homebrew node) exit 0, 0 problems (was 13). `tsc --noEmit` clean. `vite build` OK. Commit 21cd7a7 (fix) + 30e9ade (epilogue). 8 source files changed; backend untouched.

## Findings

### F1 — Two CaptainMP lints suppressed rather than refactored

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: CaptainMP.tsx (default-select pilot; reset items/lines on supplier switch)
- **Detail**: Both are *intentional* synchronous setStates that `react-hooks/set-state-in-effect` over-flags. The behaviour-preserving alternative (key the orderable subtree by `activeSupplierId` so it remounts and resets) is a larger refactor of the production Captain screen — deliberately avoided the night before the owner's test. Each suppression carries a justification comment.
- **Fix**: Keep the justified suppressions now; revisit a key-based remount when the screen is next touched substantively. Candidate for a `/10x-lesson` ("fetch-on-mount: never setState synchronously in an effect body; for intentional resets, justify + suppress").
- **Decision**: ACCEPTED

### F2 — CaptainPage placeholder loses the supplier-switch spinner

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: CaptainPage.tsx (effect 2)
- **Detail**: Deleting the redundant `setLoading(true)` means `loading` is now initial-load only; switching supplier updates items without a spinner flash. CaptainPage is an explicit diagnostic placeholder ("replace with Magic Patterns-generated UI"), so this is immaterial. The real Captain screen is CaptainMP.
- **Fix**: None.
- **Decision**: ACCEPTED

### F3 — `t` added to two CaptainMP effect deps

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: CaptainMP.tsx (suppliers + orderable effects)
- **Detail**: `t` from `useT()` is `useCallback`-memoized on `[lang]`, so it is referentially stable — adding it to deps cannot loop. The only effect is a (harmless) re-fetch if the user toggles language mid-session. Correct per `exhaustive-deps`.
- **Fix**: None.
- **Decision**: ACCEPTED

## Notes

All fixes are behaviour-preserving: synchronous `setError`/`setLoadError` now clears on async success (benign — error clears when data loads), redundant `setLoading(true)` removed where state already inits `true`, dead `no-console` directives deleted (the rule isn't active). Manual gate 1.6 (owner smoke of the core screens) remains pending by design — the highest-value check given these touch CaptainMP/ManagerPage.
