<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Move estimated total out of the email into the Manager panel

- **Plan**: context/changes/email-total-to-manager-panel/plan.md
- **Scope**: Phase 1 (only)
- **Date**: 2026-06-23
- **Verdict**: APPROVED (after F1 fix)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (no drift; all 6 items match) |
| Scope Discipline | PASS (only the change folder + planned code) |
| Safety & Quality | PASS (after F1 fix) |
| Architecture | PASS (email twins kept in sync) |
| Pattern Consistency | PASS |
| Success Criteria | PASS (backend 391 + frontend build/lint/test green; manual owner-on-deploy) |

Both agents confirmed: total removed from BOTH builders with identical body structure preserved
(no doubled blank line), all `totalValuePln` plumbing gone, test inverted to an absence guard.

## Findings

### F1 — `draftTotalValuePln` left dead + semantically stale

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/manager/lib/draftState.ts:103
- **Detail**: After the `DispatchPanel` edit, `draftTotalValuePln` had zero callers; `noUnusedLocals`
  doesn't catch unused *exports*, so it survived. It computed a draft-qty total — now a footgun
  since the panel shows the server-persisted total.
- **Fix**: Removed the function (not referenced in code or tests).
- **Decision**: FIXED

### F2 — `toFixed(2)` renders a US-decimal dot in a Polish string

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/manager/OrderDetailPane.tsx
- **Detail**: "Wartość szacunkowa: 668.00 PLN" uses a dot. Consistent with the rest of the Manager UI
  (ManagerQueue uses the same `toFixed(2)` pattern). The dot→comma locale sweep is a separate
  scoped-out follow-up.
- **Decision**: ACCEPTED (consistent with existing UI; not introduced by this change)

### F3 — inverted test uses `location=None`

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Success Criteria
- **Location**: supply-os-v1/tests/test_gmail_url.py:214
- **Detail**: Mildly limits coverage (skips the address line) but the absence guard holds regardless;
  no other test asserts the total's presence.
- **Decision**: ACCEPTED (sufficient)

## Triage summary

- **Fixed**: F1
- **Accepted**: F2, F3
- Re-gate after fix: frontend build + lint + 73 tests green (backend unchanged).
