<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Supply OS v2 waste report

- **Plan**: `context/changes/waste-report/plan.md`
- **Scope**: all five phases; local implementation and release preparation. Human/production acceptance remains pending.
- **Date**: 2026-11-04
- **Verdict**: APPROVED for the local release candidate
- **Findings**: 0 unresolved critical, 0 unresolved warnings, 0 unresolved observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS for automated checks; human/production gates pending |

## Method and scope

Read the full plan and lessons. Independent backend and frontend task reviews were followed by two separate full-plan reviewers: plan drift, and safety/quality/pattern compliance. Both final reviewers approved after targeted corrections, independently checking the final retry regression. The primary agent ran product checks and authenticated browser/local-API verification; actual commands/counts and limitations are in `../verification.md`.

Reviewed range: base `02a0930` through backend `320abfb` and frontend `3cddf37`, plus task-owned calibration/review/release documentation. Only the agreed waste module, required menu/auth/API/i18n integration and tests changed. No supplier orders, inventory semantics, production data, dependencies, staff communication, signed-in Telegram access or runtime configuration were introduced.

## Findings and decisions

### F1 — Malformed cursor members could produce 500

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: backend waste cursor parser in `app/main.py`
- **Detail**: decoded JSON members could be non-string values passed to UUID parsing.
- **Fix**: validate member types and syntax before conversion; malformed members return the localized stable 422 code.
- **Decision**: FIXED in `320abfb`; parameterized regressions pass.

### F2 — CSV generation accumulated the entire export and repeated unused totals

- **Severity**: WARNING
- **Impact**: MEDIUM — non-trivial edit with a bounded resource tradeoff
- **Dimension**: Safety & Quality
- **Location**: waste export route and data-layer pagination
- **Detail**: complete export required all rows while initial generation held them in memory and requested unused period aggregates per page.
- **Fix**: generate into a temporary file page by page before headers, skip unused export aggregates, stream bounded chunks and close on error/disconnect. Disk use remains proportional to export size.
- **Decision**: FIXED in `320abfb`; complete multi-page export and failure/disconnect cleanup tests pass.

### F3 — Planned backend trust-boundary evidence was incomplete

- **Severity**: WARNING
- **Impact**: LOW — narrowly scoped verification
- **Dimension**: Success Criteria
- **Location**: backend waste route/model/integration tests
- **Detail**: initial focused coverage omitted several declared length, cursor, by-batch HTTP and export-failure cases.
- **Fix**: add those boundary regressions without changing the application contract.
- **Decision**: FIXED in `320abfb`; full 1249 unit and 45 disposable-Postgres integration tests pass.

### F4 — Stale same-token tabs could overwrite a frozen or newer draft

- **Severity**: WARNING
- **Impact**: MEDIUM — protect storage ownership across tabs
- **Dimension**: Safety & Quality
- **Location**: `frontend/src/pages/captain-mp/WasteReportPage.tsx`
- **Detail**: token scoping alone did not identify changes by a second tab or protect late successful responses from erasing newer input.
- **Fix**: compare the loaded storage snapshot before writes, react to storage events, block stale tabs and clear only a matching frozen payload.
- **Decision**: FIXED in `3cddf37`; conflicting edit, storage event and late-response regressions pass.

### F5 — Changed filters left a hidden void target active

- **Severity**: WARNING
- **Impact**: LOW — narrow state correction
- **Dimension**: Safety & Quality
- **Location**: `frontend/src/pages/captain-mp/components/WasteHistory.tsx`
- **Detail**: a confirmation could survive a changed filter without its original row being visible.
- **Fix**: clear target/reason on filter changes and identify date/location/product/quantity in confirmation.
- **Decision**: FIXED in `3cddf37`; regression and authenticated Manager browser check pass.

### F6 — Custom invalid values did not reliably focus the exact field

- **Severity**: OBSERVATION
- **Impact**: LOW — narrow accessibility correction
- **Dimension**: Safety & Quality
- **Location**: Captain waste form validation and quantity input
- **Detail**: native invalid selectors missed custom range checks and whitespace-only text.
- **Fix**: locate the field from the same custom validation result and attach error/invalid ARIA metadata.
- **Decision**: FIXED in `3cddf37`; overflow and blank-text focus/ARIA regressions pass.

### F7 — Rejected retry incorrectly resolved earlier uncertainty

- **Severity**: WARNING
- **Impact**: LOW — preserve the existing frozen boundary
- **Dimension**: Plan Adherence / Safety & Quality
- **Location**: Captain `save` and `lib/wasteReport.ts` failure transition
- **Detail**: a rejected retry only proves that retry did not write. The original unknown request may still commit; unlocking with a new UUID risks a duplicate.
- **Fix**: preserve frozen payload/UUID when the pre-attempt draft was already uncertain. Only a definitive first-attempt rejection unlocks edits with a fresh UUID.
- **Decision**: FIXED in `3cddf37`; independent 14-test component/helper review covers unknown first response, rejected retry, reload and subsequent identical retry.

### F8 — Source analysis omitted a few planned aggregates

- **Severity**: OBSERVATION
- **Impact**: LOW — small evidence presentation change
- **Dimension**: Plan Adherence
- **Location**: `calibrate-sample.py`, `report-sample-analysis.md`
- **Detail**: initial report lacked planned ranges, common exact amounts, fractional-piece frequency and median taps.
- **Fix**: add those aggregates and manual-only count to the existing script/report, with explicit eligible/reachable denominators.
- **Decision**: FIXED; independent recomputation confirms all 17 products and unchanged 30/617/527/90/15 counts.

## Bounded implementation differences

Feature-local TypeScript DTOs avoid growing the global types file. Direct integer scaling replaces the generic decimal parser to enforce waste-specific syntax/precision/bounds. PostgreSQL unconstrained NUMERIC plus explicit precision/range checks replaces fixed-scale types, which round before CHECK. These preserve reviewed intent and are documented in the plan. No alternative entry mode or generic state framework was added.

## Acceptance boundary and next step

All 15 Automated Progress criteria have local evidence. The eight Manual rows remain unchecked as the human post-run checklist; their pending state is explicit and does not imply a failed automated check. Source extraction is preliminary, six products remain provisional, and the real operational period is unverified. No production approval, migration, merge/deploy or operator acceptance is inferred from APPROVED. Execute the concrete `../release-proposal.md` only after Ben approves the production action, then verify actual artifacts and pilot before archival.
