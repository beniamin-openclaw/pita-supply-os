<!-- IMPL-REVIEW-REPORT -->
# Final implementation review: plan adherence

- Date: 2026-11-05
- Candidate: `85f6e49cc19e5f10b593143ba9e3929a9136df93`
- Baseline: `ae643989`
- Plan: `context/changes/waste-reporter-products/plan.md`, read in full including Progress
- Verdict: **MATCH / APPROVED for the reviewed application candidate**
- Actionable findings: **0 P1, 0 P2**
- DRIFT: none found. MISSING application requirements: none found. EXTRA unrelated functionality: none found.

This is an independent plan-adherence review, not production acceptance. Phase 3 evidence consolidation, final parallel safety review, PR/CI and the approval-gated release remain the main agent's responsibility. Manual criteria correctly remain unchecked.

## Plan-to-code matrix

All source references below are relative to the reviewed repository root, `/Users/ben/.codex/worktrees/supply-v2-waste-report/10xDEVS`.

| Requirement | Assessment | Exact source evidence |
| --- | --- | --- |
| Mandatory trimmed name on genuinely new reports, maximum120 | MATCH | `frontend/src/pages/captain-mp/WasteReportPage.tsx:132` validates and focuses the name at146, sends trimmed attribution at149; required input/datalist at188. `supply-os-v1/app/models.py:85-94` trims/bounds; `app/supabase_backend.py:127-135` rejects new unnamed requests before INSERT. |
| Attribution immutable per batch; historical names remain unknown | MATCH | `app/supabase_backend.py:110-142` includes new nonnull attribution in the digest and resolves exact existing batches first. `app/models.py:141` permits historical null. No backfill is present. |
| Both histories and CSV show attribution | MATCH | Shared `frontend/src/pages/captain-mp/components/WasteHistory.tsx:121`; connected Captain `WasteHistoryPage.tsx:15` and Manager `ManagerWastePage.tsx:12`. Backend CSV appends fields at `app/main.py:7373-7395`, preserving existing column positions and cell escaping. |
| Existing suggestion convention; remember only confirmed names | MATCH | `WasteReportPage.tsx:96-100,113-121,156-160,188` updates the distinct `reported_by` MRU only after response identity matches and completed-draft persistence succeeds. No uncertain/rejected result writes suggestions. |
| Complete searchable master database, including inactive products | MATCH | `components/WasteProductPicker.tsx:17-24` uses token-pinned `/api/products`;36 searches name/ID without active, supplier or location filtering. Backend endpoint `app/main.py:218` uses authenticated backend `load_products`, whose query has no active restriction. |
| Missing-unit items visible but unselectable | MATCH | `WasteProductPicker.tsx:43` retains all matching records, disables blank/whitespace units and displays localized explanation. The page also rejects missing-unit selection at `WasteReportPage.tsx:103`. |
| Keep actual master unit/name/identity; repeated +1, manual entry, removal/reload | MATCH | `WasteReportPage.tsx:102-104` persists a separate source snapshot and stable row UUID;129-130 sends source ID/exact unit;165-179 renders source rows, base-unit arithmetic, +1 and removal. Source snapshots render even if metadata fails at196. |
| Original17cards and Other preserved | MATCH | Unchanged paper catalog; original section/card loop retained at `WasteReportPage.tsx:192-195`. Manual Other remains at174-175,198. No inferred name-based mapping to master IDs is introduced. |
| Master g remains a fractional base unit; curated display grams still convert | MATCH | `lib/wasteQuantity.ts:4-25` scopes whole-gram logic to non-base mode; page137,176 supplies base mode for sources. `app/models.py:33-60` and `app/supabase_backend.py:151-158` preserve corresponding server semantics. |
| Atomic authoritative snapshots and separate totals | MATCH | `app/supabase_backend.py:119-174` resolves master metadata in the winning transaction, rejects unknown/wrong-unit rows and rolls back. Aggregate grouping at223-228 includes source ID separately from curated/manual identities and unit. |
| Exact legacy hash/replay and unchanged frozen payload/UUID | MATCH | Backend removes only introduced null fields at110-117 and resolves stored batches at120-142 before live master validation. Frontend sends `draft.frozen` directly at201;73-83 verifies its storage snapshot before clearing. No reporter/source fields are appended during retry. |
| Readback404 never unlocks uncertainty; name/source mismatch cannot clear draft | MATCH | `WasteReportPage.tsx:151-160` catches readback failure without editing the frozen body; `lib/wasteReport.ts:13-24` preserves previously uncertain requests and compares reporter, source identity and submitted values. Legacy optional fields normalize only in comparison. |
| Scope, stale tab and late-response guards retained | MATCH | `WasteReportPage.tsx:41-85,106-122,151-162`; `WasteProductPicker.tsx:19-23,43`; existing token-pinned API wrapper and history/download paths remain connected. |
| Additive migration before code; preserve old data/constraints and safe rollback boundary | MATCH | `migrations/0033_waste_reporter_products.sql:1-43` adds nullable fields and replaces exactly six checks transactionally. All other0032guards/keys/RLS remain. Current release proposal explicitly retains data and forbids reverting to narrow readers after widened-unit records exist. |

Backend source is unchanged between previously reviewed Phase1 commit `769a2f7` and this candidate. The earlier private `backend-review.md` provides the detailed transaction/concurrency/schema assessment; I rechecked the connected frontend use and the absence of a later backend delta.

## Independent verification

I ran, on candidate85f6e49:

```text
npm test -- --run --maxWorkers=2 \
  src/pages/captain-mp/WasteReportPage.test.tsx \
  src/pages/captain-mp/WasteReportPage.extensions.test.tsx \
  src/pages/captain-mp/components/WasteHistory.test.tsx \
  src/pages/captain-mp/lib/wasteQuantity.test.ts \
  src/pages/captain-mp/lib/wasteReport.test.ts
```

Result: **5 files,39 tests PASS**, exit0, duration8.33s. The tests cover name focus/trim/retention/confirmed MRU, inactive and missing-unit products, exact master units, metadata retry/failure, late token responses, legacy frozen reload/404/exact retry, reporter/source mismatch and both legacy/current history attribution. `git diff ae643989..85f6e49 --check` is clean.

I read private `frontend-implementation.md`, `browser-save-sql.json`, `csv-totals-verification.json`, `local-migration.json`, the actual downloaded `manager-ui.csv` header/record evidence through the verification package, and the current release-proposal draft. I visually inspected the supplied mobile form/picker screenshots. The SQL evidence records7mixed lines, exact0.5masterg, distinct equal-name sources and7retained legacy reports; CSV evidence records the appended fields and named rows. These are parent-produced artifacts, not an independently repeated DB/browser run.

The parent reports final1265unit+54Postgres integration tests, frontend1343tests/90files, build/lint, authenticated both-role browser/history/CSV checks, lost-response readback with onePOST/onebatch and real legacy exact-body replay. I did not rerun those full suites or access the shared integration database. Additional browser404/retry checks were still being finalized when this review was requested; their final consolidation belongs to Phase3.1.

## Release and completion boundary

The current `release-proposal.md` is explicitly a draft: final source/PR/CI and completed E2E/review evidence must replace its pending verification paragraph before asking for production approval. This is an outstanding release artifact, not missing application behavior. Its migration-before-code order, lock/statement deadlines, uncertain-commit readback, data-preserving rollback and separate human acceptance match the plan.

No production query, migration, deployment, integration test against the shared database, source change, shared-document edit or commit was performed by this reviewer. No application/live-state claim follows from this approval.

Exact next step: close the remaining automated evidence/review records for this frozen candidate, finish the concrete PR/CI release proposal, and obtain Ben's explicit approval for migration0033 and application promotion. Keep manual criteria and archive pending until their stated human acceptance.
