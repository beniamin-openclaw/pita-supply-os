<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Supplier Order E-mail v2

- **Plan**: context/changes/order-email-v2/plan.md
- **Mode**: Deep
- **Date**: 2026-09-28
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING → PASS |
| Plan Completeness | WARNING → PASS |

## Grounding
9/9 paths ✓, 5/5 symbols ✓ (`transportWeekdayLabel` exists but is not exported — cited as a pattern only), brief↔plan ✓. Deep verification: one review-fable-high agent (8 claims + blast-radius sweep).

## Findings

### F1 — Fallback link can double-dispatch during the async draft flow

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Dispatch panel UI
- **Detail**: `busy` is only set inside `handleDispatch` (`ManagerPage.tsx:310`); the `<a>` skips the callback via `if (!busy)` but still navigates (`DispatchPanel.tsx:325-337`). During popup + Gmail calls a click on "Otwórz w Gmail" dispatches, then the draft path dispatches again → 409.
- **Fix**: panel-level `drafting` state makes the fallback link inert and disables the draft button; re-entry guard in `handleDispatch`; test "while drafting the fallback link is inert".
- **Decision**: FIXED

### F2 — Signer read must degrade on any exception

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Signer parsing + detail join
- **Detail**: sheets `load_meta` raises `RuntimeError` without a sheet id (`sheets.py:139`); ~20 detail tests patch the sheets module function-by-function without `load_meta`. Catching only `WorksheetNotFound` would turn them into 500s.
- **Fix**: plan now states `except Exception` explicitly with the reason.
- **Decision**: FIXED

### F3 — Missed caller and a wrong ownership statement

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §4, Phase 4 §1
- **Detail**: `ManagerArchivePage.tsx:325` passes `onDispatch={noop}` to `OrderDetailPane`; `OrderDetailPane` threads `onDispatch` and was not listed. `lib/orderQty.ts` already exists on this branch, so "if 0024 landed, swap the TS filter" was half-wrong.
- **Fix**: callers listed; new params optional; Phase 4 rebase note corrected (TS keeps injected `effectiveQtyFor`).
- **Decision**: FIXED

### F4 — Exception order in manager_dispatch

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §3
- **Detail**: `manager_dispatch` turns any `ValueError` into 400 (`main.py:2086-2087`); `GmailUrlTooLongError(ValueError)` must be caught before it.
- **Fix**: stated in the plan.
- **Decision**: FIXED

### F5 — Progress missing Phase 3 manual item

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress
- **Detail**: Phase 3 "Manual Verification" bullet had no `3.5` entry.
- **Fix**: added.
- **Decision**: FIXED

### F6 — Drifted line cites; test files not type-checked by build

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries, Phase 2 success criteria
- **Detail**: `gmailDraft.ts` line numbers off by ~15–20; `tsconfig.app.json` excludes tests, so `npm run build` does not type-check the golden test.
- **Fix**: cites made approximate; note added that eslint + vitest cover test files.
- **Decision**: FIXED
