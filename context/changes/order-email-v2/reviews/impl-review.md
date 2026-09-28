<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Supplier order e-mail v2

- **Plan**: context/changes/order-email-v2/plan.md
- **Scope**: Phases 1–3 (commits 22aa686, 3f92fd1, 1a68bc1) + docs 8467141
- **Date**: 2026-09-28
- **Reviewer**: subagent (review-fable-high)
- **Verdict**: APPROVE WITH FIXES
- **Findings**: 0 critical, 1 warning, 5 observations

Automated state at review time: backend 819 + 28 integration, frontend 541,
tsc / eslint / build clean.

## Findings

### W1 — The page is not locked while a Gmail draft is being created

- **Severity**: WARNING
- **Location**: `frontend/src/pages/ManagerPage.tsx` (`handleDispatch`, `handleSelect`), `DispatchPanel.tsx`
- **Detail**: during the OAuth popup the manager can select another order or
  run save / release / cancel. `handleDispatch(A)` then either returns
  silently (`busyId` set, or no detail) while a draft already sits in biuro@,
  or builds the payload from the wrong order's lines. The order stays
  unmarked and nothing tells the manager.
- **Fix suggested**: (a) make the dispatch refusal visible when a draft
  exists; (b) lift drafting state to the page and disable queue selection and
  save / release / cancel while it is set; (c) optionally capture the payload
  at click time; add a test.
- **Decision**: FIXED — `draftingId` in ManagerPage; every other action (queue
  selection, claim, save, release, cancel, add line) is refused with the
  `manager.draft.pageLocked` toast and the buttons are disabled; the panels
  report drafting via `onDraftingChange` (dispatch and dosyłka). A refused
  dispatch after a verified draft shows `manager.draft.dispatchFailed` with
  `manager.draft.orderChanged`. The draft path already calls the click-time
  handler, so the payload is the clicked order's (asserted in the test).
  Test: `frontend/src/pages/ManagerPage.draftLock.test.tsx`.

### O2 — Fallback link clickable while a dispatch is in flight

- **Severity**: OBSERVATION
- **Detail**: the link was inert only while drafting; while `busy` it still
  opened a stray compose window (the dispatch itself was guarded).
- **Decision**: FIXED — inert when `drafting || busy`; test in `DispatchPanel.draft.test.tsx`.

### O3 — `metadataHeaders` on drafts.get is not documented

- **Severity**: OBSERVATION
- **Detail**: the parameter is documented for `messages.get`; `drafts.get`
  documents only `format`.
- **Decision**: FIXED — `format=metadata` alone (returns every header); the
  From lookup is unchanged.

### O4 — Twin-builder parity diverges only at extreme quantities

- **Severity**: OBSERVATION
- **Detail**: TS `toPrecision(6)` vs Python `:g` differ only beyond six
  significant digits; no real order reaches that.
- **Decision**: ACCEPTED — left as is.

### O5 — Two sign-in errors surface in English

- **Severity**: OBSERVATION
- **Detail**: "No access token returned" and "Google sign-in timed out" fell
  through to the generic message with the raw English text.
- **Decision**: FIXED — mapped to `manager.draft.errNoToken` (also
  `access_denied`) and `manager.draft.errSignInTimeout`; the shared Transport
  messages are unchanged.

### O6 — Token cached before the account check

- **Severity**: OBSERVATION
- **Detail**: `requestGmailAccessToken` cached the token before
  `getProfile`; safe because every draft re-checks the profile, but a
  wrong-account token was briefly remembered.
- **Decision**: FIXED — the request never caches; `rememberGmailToken` is
  called by `createVerifiedOrderDraft` only after the profile matches.

## After fixes

Backend 819 + 28 integration, frontend 545, eslint and build clean.
