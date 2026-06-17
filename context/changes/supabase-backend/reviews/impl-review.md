<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-10 Sheets → Supabase (Phases 1–4)

- **Plan**: context/changes/supabase-backend/plan.md
- **Scope**: Phases 1–4 of 5 (commits b163d76, cc75084, 70d2a74, d8b0d4b)
- **Date**: 2026-06-17
- **Verdict**: NEEDS ATTENTION → APPROVED after triage (all warnings fixed; only tracked tech-debt remains)
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING → addressed (F1 doc+tracked, F3 fixed, F6 fixed) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (local: ruff clean, 376 passed, integration deselect/skip wiring correct; live-PG 4.2/4.3 + manual 3.5/3.6/4.4 pending by design) |

## Grounding

Plan drift: all planned items MATCH (28/28 seam-parity superset; 108 column names exact vs models.py; 0 `is not sheets` guards remain; all 5 routes pass the correct `expected_status` + map conflict → 409). SQL-injection clean (allow-listed columns + bound params), no DSN/secret logging, temporal CAST handles datetime/ISO/None. The "extra" frontend vitest CI step the safety agent flagged is **pre-existing** (present at b163d76^), not introduced here.

## Findings

### F1 — captain_order_edit replaces lines before the status guard fires

- **Severity**: ⚠️ WARNING (safety agent flagged CRITICAL; re-rated — see Detail)
- **Impact**: 🔬 HIGH — architectural stakes
- **Dimension**: Safety & Quality
- **Location**: app/main.py captain_order_edit; app/supabase_backend.py update_order
- **Detail**: `delete_order_lines` + `append_order_lines` commit BEFORE the conditional `update_order(expected_status='captain_submitted')`. A manager-claim in that window → lines already replaced, then 409. Re-rated to WARNING: it's a planned v0 trade-off ("no combined transactional method — seam stays uniform"), no worse than Sheets (which has no captain-edit guard at all; Supabase at least 409s), writes are idempotent, and at single-location pilot scale the race is near-impossible. Real for multi-location. Same write-then-guard shape exists (less severely) in dispatch/save (dispatch email is built before persistence, so the artifact is unaffected).
- **Fix A ⭐**: Correct the misleading docstring now; track "wrap the edit's 3 writes in one transaction" as a pre-multi-location follow-up.
- **Decision**: FIXED via Fix A — docstring corrected at app/main.py; transactional fix tracked in follow-ups/review-fixes.md.

### F3 — Integration DROP TABLE guarded by backend-selection, not DSN host

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality (data safety)
- **Location**: tests/test_supabase_integration.py (_schema fixture)
- **Detail**: The fixture DROPs+recreates the 12 tables guarded only by `data_backend==supabase` + `is_configured`. `pytest -m integration` with a prod DSN in SUPPLY_OS_DATABASE_URL would silently drop prod tables.
- **Fix**: Require the DSN host to be local (`@localhost`/`@127.0.0.1`) OR `SUPPLY_OS_INTEGRATION_DB_CONFIRMED=1`; otherwise skip.
- **Decision**: FIXED — host/opt-in guard added before the DROP. CI's `@localhost` DSN satisfies it; a prod DSN now skips.

### F2 — No conflict→409 tests for release / save / edit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Success Criteria
- **Location**: tests/test_supabase_backend.py
- **Detail**: All 5 routes had "passes expected_status" happy-path tests, but only claim + dispatch asserted OrderStatusConflictError → 409.
- **Fix**: Add 3 mocked conflict→409 tests (release, save, edit).
- **Decision**: FIXED — 3 tests added (suite 373 → 376).

### F6 — _engine lazy singleton has an unguarded double-init race

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Reliability
- **Location**: app/supabase_backend.py _get_engine
- **Detail**: Sync routes run in Starlette's threadpool, so two first-requests can both create an engine; the loser's pool leaks. Benign at single-worker pilot; matches supabase_storage's pattern.
- **Fix**: Module-level `threading.Lock` + double-checked init.
- **Decision**: FIXED — `_engine_lock` added; `_get_engine` re-checks inside the lock.

### F4 — Silent supabase→seed fallback emits no log (cutover footgun)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Reliability
- **Location**: app/main.py _choose_backend
- **Detail**: If SUPPLY_OS_DATA_BACKEND=supabase but the DSN is blank, requests silently fall back to seed (nothing persisted) with no warning. `warn_if_unconfigured()` existed but was never called.
- **Fix**: Call `sheets.warn_if_unconfigured()` + `supabase_backend.warn_if_unconfigured()` at startup.
- **Decision**: FIXED — wired via a FastAPI `lifespan` handler (modern API; no deprecation warning). Directly de-risks the Phase-5 cutover.

### F5 — 13 stale 503 messages said only "SUPPLY_OS_DATA_BACKEND=sheet"

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: app/main.py (×13)
- **Detail**: Misleading now that supabase is a valid persistent backend.
- **Fix**: Reword to "a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)".
- **Decision**: FIXED — all 13 reworded.

### F7 — manager_queue / suggestion-review do unbounded SELECT * on order_lines

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Performance
- **Location**: app/main.py manager_queue / manager_suggestion_review; supabase_backend.load_order_lines
- **Detail**: `SELECT * FROM order_lines` with Python-side filtering — one cached call on Sheets, a growing full-table scan on Postgres. Fine at pilot.
- **Decision**: ACCEPTED (tracked) — recorded in follow-ups/review-fixes.md as scale tech-debt; no code change at pilot.

## Verified clean (no finding)

- SQL injection: every f-string-composed statement interpolates only hardcoded `_*_COLUMNS` / table names; all values are bound params.
- Secrets: DSN is a SecretStr; never logged.
- Temporal `CAST(:col AS timestamptz/date)`: correct for native datetime, ISO string, and None.
- Column maps exact-match models.py; seam-parity test enforces the superset.
