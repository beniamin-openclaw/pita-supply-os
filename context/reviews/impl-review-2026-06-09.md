<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Full Roadmap (Overnight Autonomous Run)

- **Scope**: All implemented changes (S-03, S-04, S-05, S-06, S-07, S-08 + support phases)
- **Date**: 2026-06-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 8 warnings · 2 observations

## Verdicts

| Dimension            | Verdict |
|----------------------|---------|
| Plan Adherence       | PASS ✅ |
| Scope Discipline     | PASS ✅ |
| Safety & Quality     | WARNING ⚠️ (3 findings) |
| Architecture         | WARNING ⚠️ (1 finding) |
| Pattern Consistency  | WARNING ⚠️ (4 findings) |
| Success Criteria     | PASS ✅ |

## Findings

### B-F1 — `captain_inventory_products` bypasses `_choose_backend()`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: `supply-os-v1/app/main.py` — `captain_inventory_products` route
- **Detail**: Route called `seed_loader.load_products()` and `seed_loader.load_location_product_settings()` directly instead of routing through `_choose_backend()`. Hard rule violation: all reads must go through the `_choose_backend()` seam.
- **Fix**: Call `backend = _choose_backend()` at route entry; use `backend.load_*()` for all reads.
- **Decision**: FIXED

### B-F2 — `captain_inventory_latest` doesn't catch `WorksheetNotFound`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `supply-os-v1/app/main.py` — `captain_inventory_latest` route
- **Detail**: When the sheet backend is active but the `inventory_counts` tab hasn't been created yet, `backend.load_inventory_counts()` throws `WorksheetNotFound` and the route returns a raw 500 instead of `None` (which means "no snapshot"). The submit and counts routes already have this guard.
- **Fix**: Wrap `backend.load_inventory_counts()` in `try/except sheets.WorksheetNotFound: return None`.
- **Decision**: FIXED

### IR-F3 — Unsafe `StringKey` cast in `ManagerSuggestionReviewPage`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `frontend/src/pages/manager/ManagerSuggestionReviewPage.tsx`
- **Detail**: `t(key as StringKey)` without a guard — if `reason_code_counts` contains an unknown code, `key` doesn't exist in `STRINGS` and the cast silently passes a bad string to `t()`.
- **Fix**: Guard with `key in STRINGS` before the cast. Import `STRINGS` for the check.
- **Decision**: FIXED

### FE-F2 — Snapshot detail cache allows `InventoryLatestResponse | null` but typed as non-null

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `frontend/src/pages/captain-mp/CaptainMP.tsx`
- **Detail**: `snapshotDetails` was typed `Record<string, InventoryLatestResponse>` but error paths needed to store `null` to distinguish "fetch failed" from "not yet fetched". Type mismatch caused a loading indicator stuck on error + a sentinel object that violated the type. Cache presence check was also falsy (`!snapshotDetails[id]`) so `null` (error) wasn't distinguished from undefined (not loaded).
- **Fix**: Widen type to `Record<string, InventoryLatestResponse | null>`; use `in` operator for cache presence; store `null` on error.
- **Decision**: FIXED

### FE-F3 — Missing unmount cancellation guard in list-fetch effects

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `frontend/src/pages/captain-mp/InventoryHistoryPage.tsx` + `frontend/src/pages/manager/ManagerInventoryPage.tsx`
- **Detail**: Both pages used `useCallback(load)` + `useEffect(() => { load() }, [load])` pattern without a cancellation guard. A slow initial fetch that resolves after the component unmounts (e.g. user navigates away before data loads) would call `setState` on an unmounted component.
- **Fix**: Replace with inline `useEffect` with `let cancelled = false` guard and `return () => { cancelled = true }` cleanup.
- **Decision**: FIXED

### FE-F5 — Comment inputs in `InventoryCountPage` missing accessible label

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `frontend/src/pages/captain-mp/InventoryCountPage.tsx:560`
- **Detail**: Comment `<input>` for each product row had no `id` and no `<label>`. The stock input alongside it correctly had an `sr-only` label + matching `id`. Screen readers had no programmatic connection to the comment field. WCAG 1.3.1 violation.
- **Fix**: Add `id={\`comment-${p.product_id}\`}` to the input; add `<label htmlFor={\`comment-${p.product_id}\`} className="sr-only">` before it.
- **Decision**: FIXED

### IR-F2 — Vitest setup doesn't clear localStorage before each test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `frontend/src/test/setup.ts`
- **Detail**: `LangProvider` reads `supply_os_lang` from localStorage. Without a `localStorage.clear()` in `beforeEach`, a test that sets a non-default language contaminates all later tests in the same worker, causing non-deterministic locale-dependent failures.
- **Fix**: Add `beforeEach(() => { localStorage.clear() })` to `frontend/src/test/setup.ts`.
- **Decision**: FIXED

### IR-F8 — `lineCount` not plural-aware in Polish

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `frontend/src/i18n/strings.ts` + both list pages
- **Detail**: `t("manager.inventory.lineCount", { count: c.line_count })` and equivalent in InventoryHistoryPage always produce "N pozycji" regardless of N. Polish requires 1 pozycja / 2–4 pozycje / 5+ pozycji.
- **Fix**: Add `.one.items/.few.items/.many.items` variants to strings.ts; call `tPlural("...lineCount", "items", n)` in the two pages.
- **Decision**: FIXED

### IR-F7 — `InventoryHistoryPage` passes `locationName=""` to Header

- **Severity**: ⚠️ WARNING (finding was overstated — all captain pages do this)
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: `frontend/src/pages/captain-mp/InventoryHistoryPage.tsx:214`
- **Detail**: All three captain pages (CaptainMP, InventoryCountPage, InventoryHistoryPage) consistently pass `locationName=""`. Header handles it with `|| "—"`. No inconsistency to fix; pattern is intentional pending a future `/api/whoami` endpoint.
- **Decision**: SKIPPED — already consistent

### IR-F6 — CI backend job missing pip cache

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `.github/workflows/ci.yml` — `actions/setup-python` step
- **Detail**: Frontend CI uses `cache: npm` on setup-node. Backend CI omits `cache: pip` on setup-python, so every run re-downloads all Python deps from scratch.
- **Fix**: Add `cache: pip` to the `actions/setup-python` step.
- **Decision**: FIXED

## Triage Summary

```
Fixed:   B-F1, B-F2, IR-F3, FE-F2, FE-F3, FE-F5, IR-F2, IR-F8, IR-F6  (9)
Skipped: IR-F7 (finding was incorrect — all captain pages already consistent)  (1)

► Post-fix verdict: APPROVED
   All architecture violations resolved; pattern fixes applied;
   CI parity restored; zero lint/test failures.
```
