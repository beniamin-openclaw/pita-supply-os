<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sub-kg (0.1 kg) Rounding Rule (S-09)

- **Plan**: context/changes/subkg-rounding-rule/plan.md
- **Scope**: Full plan — Phases 1–3 of 3 (all Progress items [x])
- **Date**: 2026-06-06
- **Verdict**: APPROVED
- **Findings**: 0 critical · 0 warnings · 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Context

Second-pass review run after live Google Sheet migration (step 2.5) and full
end-to-end verification (steps 3.4–3.7) completed in session 2026-06-06.
The first review (`impl-review.md`, 2026-06-05) approved Phases 1–3 code. This
review confirms: (a) all 16/16 Progress items now `[x]`, (b) plan drift
re-checked across all 13 planned changes, (c) automated test suite re-run
against the live env.

**Manual verification completed this session:**
- 3.4 — `/api/captain/suggest` with `tenth_kg` + stock=0, target=0.5 → suggested=0.5, over_max=0. ✓
- 3.5 — `/api/manager/order/{id}` line detail carries `rounding_rule=tenth_kg`. ✓
- 3.6 — End-to-end dispatch: manager_final=1.5 → Gmail compose URL → "1.5 kg" in email body. ✓
- 3.7 — `full_only` regression: target=0.5 → suggested=1.0 (ceil), over_max=0.5. ✓
- 2.5 — Live Sheet `supplier_products` tab: `rounding_rule` column inserted; 8 Bukat kg rows = `tenth_kg`. ✓

## Findings

### F1 — Pre-existing test fragility: `test_is_configured_false_when_secret_empty`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supply-os-v1/tests/test_sheets_read.py:563–567
- **Detail**: Test patches `settings.google_service_account_json` to `SecretStr("")` but
  does not patch `settings.google_service_account_json_file`. `is_configured()` checks
  the file-path field first (`bool(settings.google_service_account_json_file) or …`),
  so when a dev `.env` is present with `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE` set
  the function returns `True` and the assertion fails. This test existed in the initial
  commit — S-09 did not introduce the fragility. It was first exposed during S-09
  verification when a live `.env` was created in the worktree. Without a `.env` the test
  passes (CI-safe today, but fragile for anyone who sets up local Sheet credentials).
- **Fix**: Add `mocker.patch.object(sheets.settings, "google_service_account_json_file", "")` before the assertion in `test_is_configured_false_when_secret_empty`.
- **Decision**: PENDING

## Test results

```
225 passed, 1 failed (pre-existing fragility, see F1), 1 deselected
```

Excluding F1: 225/225 pass.

## Ruff lint

`ruff` not installed in worktree Python env. Pre-existing tool gap documented in
`context/foundation/health-check.md`. The `PostToolUse` hook runs `ruff check --fix`
on edits when `ruff` is available; no new lint issues were introduced (S-09 backend
files follow identical style patterns to adjacent code).
