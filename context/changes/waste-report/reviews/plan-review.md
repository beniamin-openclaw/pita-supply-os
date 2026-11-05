<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Digital waste report

- **Plan**: context/changes/waste-report/plan.md
- **Mode**: Deep
- **Date**: 2026-11-04
- **Initial verdict**: REVISE
- **Verdict after fixes**: SOUND
- **Findings**: 1 critical, 2 warnings, 1 observation; all four fixed in the plan
- **Authorization**: Ben explicitly approved all four targeted edits and saving this review, then requested autonomous end-to-end implementation. Production migration/merge/deploy remains separately approved.

## Verdicts after fixes

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

8/8 existing modification paths verified; `_choose_backend`, capability gates and decimal helper symbols confirmed; brief and plan agree; five phases and all 23 Success Criteria map exactly to the single canonical Progress section. Planned new files are additions, not missing existing paths. Actual product CI runs backend checks, disposable Postgres integration and frontend checks. No contract-surfaces reference exists.

One independent read-only reviewer verified risky storage, authorization, draft, quantity, navigation and localization claims. Existing authenticated `apiGetBlob` is reused for CSV. Source quantity calibration was intentionally pending at review time; the supplied 30-report API package is now being validated separately.

## Findings and decisions

### F1 — A switched Captain token can misattribute an old draft

- **Severity**: CRITICAL
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical implementation details / Phase 4
- **Detail**: `frontend/src/pages/captain-mp/InventoryCountPage.tsx:154` pins draft scope, while `frontend/src/apiClient.ts:184` reads the current token at request time. A stale-response guard alone cannot stop an old location's draft being sent under a new location token.
- **Fix**: Pin originating scope, check it before every mutation/readback/draft write and abort before sending on mismatch. Test another-tab token change immediately before Save, retry and void.
- **Decision**: FIXED — added explicit preflight contract and tests to existing criteria; Progress titles preserved.

### F2 — Frozen retry state does not distinguish rejection from uncertainty

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Draft and uncertain-save lifecycle / Phases 3–4
- **Detail**: The initial plan froze all failures without defining correction after a definitive pre-write rejection. A by-batch 404 can race an earlier in-flight commit and cannot safely unlock changed-payload submission.
- **Fix**: Proven pre-write validation/auth/capability rejection retains an editable draft; corrections get a new UUID. Network/timeout/unknown failure freezes the original body/key; only identical retry or committed readback resolves it, and a racing 404 never unlocks edits.
  - Strength: Prevents duplicate loss while allowing correction of rejected forms.
  - Tradeoff: Uncertain writes require explicit retry/readback rather than immediate editing.
  - Confidence: HIGH — current ApiError exposes status; feature error contract adds explicit outcome.
  - Blind spot: Production network behavior remains an implementation/E2E acceptance check.
- **Decision**: FIXED — lifecycle, API error contract and three targeted test cases added.

### F3 — Existing localization does not cover waste business errors

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phases 3–4
- **Detail**: `frontend/src/apiClient.ts:165` localizes validation arrays; business strings pass through. `frontend/src/i18n/apiErrors.ts:83` maps empty `lines` to order-empty wording. Promised waste503/error translation needs explicit feature mapping and tests.
- **Fix**: Stable waste error codes mapped to PL/EN copy, waste-specific empty-lines validation and regression coverage preserving order behavior; include relevant i18n files.
- **Decision**: FIXED — precise error handling and file/test follow-through added.

### F4 — Exact arithmetic needs a technical range bound

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Quantity, input and rounding / Phase 2
- **Detail**: Number parsing and integer scaling alone do not guarantee exactness for unrestricted digit lengths. The initial plan did not declare an upper bound.
- **Fix**: Canonical per-line max999999.999, NUMERIC(9,3); submitted NUMERIC(12,3) accommodates integer grams. Validate raw bounds before conversion and safe scaled addition; reject overflow. Totals stay Decimal/string without per-line truncation.
- **Decision**: FIXED — shared technical bounds added; display units and tile calibration remain a separate evidence decision.

## Verification and limits

Document mechanical checks pass; implementation tests are not implied by this review. No application code, production data or runtime changed during the review. Manual production acceptance remains pending. Autonomous implementation will run focused tests, the full product checks, real disposable Postgres integration and auth-enabled browser E2E before a concrete release proposal.
