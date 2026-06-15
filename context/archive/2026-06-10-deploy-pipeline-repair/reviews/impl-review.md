<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Railway Backend Host Migration

- **Plan**: context/changes/deploy-pipeline-repair/plan.md
- **Scope**: Phases 1-2 of 4 (the agent-implemented phases; Phases 3-4 are
  owner-executed prod cutover, still pending)
- **Date**: 2026-06-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 0 observations (both fixed)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING → PASS (F1 fixed) |
| Architecture | PASS |
| Pattern Consistency | WARNING → PASS (F2 fixed) |
| Success Criteria | PASS |

## Grounding

Two parallel sub-agents (drift + safety/quality). Drift: 8/8 planned changes
MATCH — no drift, no missing, no extra; full `drive` scope preserved
(drive.py:33); no real secrets in any committed file. Success criteria re-run:
335 tests pass, ruff clean, smoke `bash -n` clean + no submit/dispatch, runbook
18 SUPPLY_OS_ refs.

## Findings

### F1 — base64 decode tolerates malformed input silently

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/app/config.py:98
- **Detail**: `base64.b64decode(sa_b64)` used the default `validate=False`,
  silently dropping non-base64 chars. A blob pasted with a stray newline/space
  (the exact failure base64 exists to avoid) could decode to truncated bytes and
  surface as a cryptic google.auth error at Credentials construction — the
  single riskiest spot for the Railway cutover.
- **Fix**: `b64decode(sa_b64, validate=True)` in try/except → `RuntimeError`
  naming the env var + the `tr -d '\n'` hint. Added a regression test
  (`test_resolve_invalid_base64_raises_clear_error`).
- **Decision**: FIXED

### F2 — Credential source no longer logged (ops blind spot)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/config.py:78-106
- **Detail**: The old `sheets._client()` logged which credential source was used
  ("loaded from file/inline"). The refactor centralized resolution but dropped
  that log, so a Railway misconfig that silently loads the wrong source gives no
  ops signal. The source name is not a secret.
- **Fix**: Added `log = logging.getLogger(__name__)` to config.py and a
  `log.info("service-account credentials loaded from %s", ...)` in each branch
  of `resolve_service_account_info()` (source name only, never the value).
- **Decision**: FIXED
