<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Localize FastAPI 422 validation errors to Polish

- **Plan**: context/changes/api-error-localization-pl/plan.md
- **Scope**: Phases 1–2 of 2 (full)
- **Date**: 2026-06-20
- **Verdict**: APPROVED (0 critical · 0 warnings · 4 observations; 2 fixed, 2 accepted)
- **Findings**: 0 critical · 0 warnings · 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- **Plan-drift sub-agent**: all 5 deliverables MATCH; no drift. Only deviations are cosmetic (a helper extracted in apiClient instead of inline — same contract). "What We're NOT Doing" respected (no backend change; string-detail business-rule 400s keep the English fallback; the ~15 `e.detail` display sites untouched; unknown fields never leak raw snake_case).
- **Safety sub-agent**: 0 CRITICAL. Verified safe: no raw English Pydantic `msg`/field name can reach the user on any path; `leafField` loc parsing robust; `isSubmitting` not stuck on the empty-order early return (both screens return before `setIsSubmitting(true)`, plus a `finally`); importing `i18n/index.ts` into the non-React apiClient is load-safe (`createContext` is not a hook); no double-localization; existing `apiClient.test.ts` unaffected.
- **Automated (post-triage)**: build ✓, lint ✓, `npm run test` 57 ✓.

## Findings

### F1 — `list_type` mapped to a misleading "min. 1" message

- **Severity**: 🔭 OBSERVATION · **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: frontend/src/i18n/apiErrors.ts (`typeMessage`)
- **Detail**: `list_type` (value isn't a list at all) carries no `min_length`, so the `?? 1` fallback produced "wymagane min. 1" — wrong for a type error. Never triggered by the UI (it always sends a list), but semantically wrong.
- **Fix**: Removed `list_type` from the `too_short` case → it now falls through to the generic `apiError.invalid`.
- **Decision**: FIXED.

### F2 — `too_long` fallback could read "maksymalnie 0"

- **Severity**: 🔭 OBSERVATION · **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: frontend/src/i18n/apiErrors.ts (`typeMessage`)
- **Detail**: `num(ctx, "max_length") ?? 0` would render a false "max 0" if `ctx` were absent (theoretical in Pydantic v2).
- **Fix**: When `max_length` is undefined → return the generic `apiError.invalid` instead of a wrong number.
- **Decision**: FIXED.

### F3 — `as StringKey` cast on the field label key

- **Severity**: 🔭 OBSERVATION · **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/i18n/apiErrors.ts (`localizeEntry`)
- **Detail**: `` `apiError.field.${field}` as StringKey `` asserts a runtime string is a valid key; the runtime `if (STRINGS[labelKey])` guard makes it crash-safe (test-covered "no leak"), but it bypasses TS key-safety.
- **Decision**: ACCEPTED — runtime-guarded and tested; a typed lookup map would be heavier for no user-facing gain.

### F4 — `lines` + `missing` arm is defensive dead code

- **Severity**: 🔭 OBSERVATION · **Impact**: 🏃 LOW
- **Dimension**: Architecture
- **Location**: frontend/src/i18n/apiErrors.ts (`localizeEntry`)
- **Detail**: `buildPayloadLines` always sends a `lines` array, so the backend emits `too_short` not `missing`; the `missing` arm is harmless defensive code.
- **Decision**: ACCEPTED (kept as defensive).

## Triage summary

Fixed F1 + F2 (apiErrors.ts), accepted F3 + F4. Re-verified: build + lint + 57 vitest green.
Verdict: **APPROVED**.
