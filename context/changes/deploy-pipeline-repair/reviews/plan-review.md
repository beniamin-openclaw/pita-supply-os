<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Railway Backend Host Migration

- **Plan**: context/changes/deploy-pipeline-repair/plan.md
- **Mode**: Deep
- **Date**: 2026-06-10
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 1 critical, 2 warnings, 0 observations (all fixed)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING → PASS (F1 fixed) |
| Lean Execution | PASS |
| Architectural Fitness | WARNING → PASS (F1 fixed — duplication removed) |
| Blind Spots | FAIL → PASS (F1, F3 fixed) |
| Plan Completeness | WARNING → PASS (F2 fixed) |

## Grounding

5/5 paths ✓, 4/4 credential consumers traced ✓ (sheets._client, sheets.is_configured,
drive._credentials, drive.is_configured), brief↔plan ✓, Progress↔Phase ✓ (4 phases,
counts match). Deep verification done by direct read of `drive.py` + `sheets.py` +
blast-radius grep (no sub-agent needed — the critical claim was confirmed directly).

## Findings

### F1 — base64 creds patched in 1 of 4 spots → breaks Sheets + GR-01 Drive

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 — base64 credential setting
- **Detail**: SA credentials are resolved in FOUR places: `sheets._client()`
  (sheets.py:118), `sheets.is_configured()` (sheets.py:87), `drive._credentials()`
  (drive.py:59), `drive.is_configured()` (drive.py:41) — drive.py copied sheets'
  loader. The original Phase 1 added the b64 branch ONLY to `sheets._client()`.
  With the runbook's b64-only creds on Railway: `sheets.is_configured()` → False →
  `_choose_backend()` (main.py:227) silently falls back to `seed_loader` (whole
  backend serves seed / errors with no seed dir), AND `drive.is_configured()` →
  False → GR-01 WZ photo upload 503s. Phase 1's automated tests would still pass —
  the break only shows in prod. (User-flagged GR-01 regression risk.)
- **Fix A ⭐ Recommended**: Centralize cred resolution in config.py
  - Strength: One resolver (file → b64 → inline) + one has-creds check used by all
    four spots; kills the duplication that caused this; b64 works for Sheets AND Drive.
  - Tradeoff: Touches config.py + sheets.py + drive.py (4 call sites refactored).
  - Confidence: HIGH — scopes stay per-caller (SCOPES vs DRIVE_SCOPES).
  - Blind spot: None significant — four spots are the full blast radius (grep-confirmed).
- **Fix B**: Add the b64 branch independently to all four spots
  - Strength: Localized; no new helper.
  - Tradeoff: Duplicates the resolution logic 4× — re-creates the drift that just bit us.
  - Confidence: HIGH — works, but fragile.
  - Blind spot: Next cred change must remember all four spots again.
- **Decision**: FIXED via Fix A — Phase 1 changes #1-#3 rewritten to add
  `config.resolve_service_account_info()` + `has_service_account_creds()` and route
  sheets (`_client`/`is_configured`) + drive (`_credentials`/`is_configured`) through
  them; test #6 + success criterion 1.4 now assert both is_configured() return True
  under b64-only creds.

### F2 — Smoke kit can't detect a silent seed fallback

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — smoke kit
- **Detail**: The smoke kit asserted `/api/products` >0 items as proof of "live
  Sheet, not seed" — but a silent seed fallback (F1) could also return items.
  `/health/internal` (manager auth) returns `data_backend`; asserting it equals
  "sheet" catches the F1 failure mode at deploy time as a runtime backstop.
- **Fix**: Add a `/health/internal` check to `smoke_railway.sh` asserting
  `data_backend == "sheet"`.
- **Decision**: FIXED — Phase 2 smoke-script contract + success criterion 2.4 now
  require the `/health/internal` data_backend==sheet assertion.

### F3 — Railway healthcheck path not configured

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — railway.toml
- **Detail**: `railway.toml` pinned the builder but set no `healthcheckPath`.
  Railway marks a deploy live as soon as uvicorn binds the port — even if the app
  can't reach Sheets. A healthcheck on `/health` gates the deploy on a real boot.
- **Fix**: Add `healthcheckPath = "/health"` (+ a sane timeout) to `railway.toml [deploy]`.
- **Decision**: FIXED — Phase 1 change #4 now specifies `[deploy] healthcheckPath`
  + timeout; success criterion 1.5 checks for it.
