<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Inventory Count (S-06)

- **Plan**: context/changes/inventory-count/plan.md
- **Scope**: all 3 phases (p1–p3; commits ce34e51, ac7144b, 5cebc66)
- **Date**: 2026-06-05
- **Verdict**: APPROVED
- **Findings**: 0 critical · 1 warning · 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Grounding

Full suite `python -m pytest` = 217 passed; `ruff check .` = clean; `tsc` typecheck clean (vite bundle blocked only by a Node-v24/Rollup native-binary issue locally, builds with Homebrew node). Two parallel sub-agents (plan-drift + safety/quality/pattern) plus orchestrator verification of the automated criteria.

## Findings

### F1 — Inventory test files are order-dependent (auth env)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; fix touches the shared test harness
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/tests/test_inventory_submit.py ⇄ supply-os-v1/tests/test_inventory_sheets.py
- **Detail**: Running ONLY the two inventory test files together fails 4 auth tests (e.g. `test_inventory_submit_unauthorized_no_token`, `..._no_setting_for_location` return 200 instead of 401/400). The full suite is 217/217 green. Root cause is pre-existing: settings (incl. auth tokens) load once at first `app/config` import; `test_inventory_sheets.py` imports `app.config` (via `app.sheets`) without setting auth tokens, so a later file's `os.environ.setdefault` arrives too late. The full alphabetical run imports `app.main` with tokens (via `test_captain_submit.py`) first, so it is green. inventory-count did not introduce the pattern but adds two files that exhibit it as a pair.
- **Fix**: Centralize auth-env setup in a session-scoped `tests/conftest.py` (set `SUPPLY_OS_CAPTAIN_TOKENS` / `SUPPLY_OS_MANAGER_TOKEN` before any app import) so the suite is order-independent. Repo-wide and pre-existing — best as its own small change, not bundled into inventory-count.
  - Strength: removes order-dependence for the whole suite, not just inventory.
  - Tradeoff: touches the shared harness (out of this slice's scope).
  - Confidence: HIGH — mechanism understood (settings-load-once + per-file setdefault).
  - Blind spot: other test files may rely on their own per-file token values.
- **Decision**: ACCEPTED-AS-RULE — recorded in `context/foundation/lessons.md` ("Tests must be order-independent…"); code left unchanged (full suite is green; fix belongs in its own harness change).

### F2 — Two inventory endpoints disagree on the master-data path

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/main.py — `captain_inventory_products` (seed_loader) vs `captain_inventory_submit` (_choose_backend)
- **Detail**: The products endpoint reads master data via `seed_loader` directly; submit reads via `backend.load_*()`. Each mirrors its true sibling (`captain_orderable` uses seed_loader; `captain_submit` uses backend), so it is consistent with the established convention — but in sheet mode the LIST is served from seed CSVs while submit VALIDATES against the Sheet, so a CSV-vs-Sheet drift could make them disagree. Pre-existing repo-wide quirk, not introduced here.
- **Fix**: Optional — read the products list via `_choose_backend()` too, so list + submit agree in sheet mode. Matching `captain_orderable` is the defensible status-quo call.
- **Decision**: SKIPPED — accept as-is (mirrors existing pattern / cosmetic / accepted v0 edge); no implication blocks the slice.

### F3 — Master-data read sits outside the 503 guard

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/app/main.py — `captain_inventory_submit`
- **Detail**: The `WorksheetNotFound → 503` catch wraps only `_persist_inventory_count`. The master-data reads run before it; in sheet mode a missing/misconfigured MASTER tab raises an uncaught `WorksheetNotFound` → raw 500. Mirrors the orders submit exposure (master tabs are a prod precondition).
- **Fix**: Acceptable for v0. If symmetric 503s are wanted, widen the try or pre-validate the master tabs.
- **Decision**: SKIPPED — accept as-is (mirrors existing pattern / cosmetic / accepted v0 edge); no implication blocks the slice.

### F4 — "not persisted" warning is a brittle substring match

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/captain-mp/InventoryCountPage.tsx ⇄ supply-os-v1/app/main.py (warning string)
- **Detail**: The seed-mode warning toast keys off `w.includes("not persisted")` coupled to the exact backend string. Mirrors CaptainMP's existing pattern, so consistent — but a copy tweak on either side silently breaks the toast.
- **Fix**: Acceptable (mirrors existing). If ever refactored, prefer a structured flag (e.g. `persisted: bool`) over substring matching.
- **Decision**: SKIPPED — accept as-is (mirrors existing pattern / cosmetic / accepted v0 edge); no implication blocks the slice.

### F5 — Count row written before its lines (torn-write edge)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality (data)
- **Location**: supply-os-v1/app/main.py `_persist_inventory_count` / app/sheets.py append
- **Detail**: `append_inventory_count` (count row) runs before `append_inventory_count_lines`. If `inventory_counts` exists but `inventory_count_lines` is missing, a header row persists then the lines append raises → 503, leaving a header with no lines. Mirrors the orders stack's non-transactional writes; accepted v0.
- **Fix**: Acceptable. Optionally pre-open both worksheets before writing either.
- **Decision**: SKIPPED — accept as-is (mirrors existing pattern / cosmetic / accepted v0 edge); no implication blocks the slice.

### F6 — Inventory Header shows "—" for location

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/captain-mp/InventoryCountPage.tsx (`locationName=""`)
- **Detail**: Passes empty `locationName` to `Header` → the location pill shows "—". CaptainMP passes the fetched name. Cosmetic; the page never fetches the location.
- **Fix**: Cosmetic — fine if intended.
- **Decision**: SKIPPED — accept as-is (mirrors existing pattern / cosmetic / accepted v0 edge); no implication blocks the slice.
