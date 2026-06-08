<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Inventory-Count Follow-ups (FR-020…024)

- **Plan**: context/changes/inventory-count-followups/plan.md
- **Mode**: Deep
- **Date**: 2026-06-08
- **Verdict**: REVISE → SOUND (all findings fixed)
- **Findings**: 0 critical · 3 warnings · 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING (F5) |
| Blind Spots | WARNING (F3, F6, F7) |
| Plan Completeness | WARNING (F1, F2, F4) |

## Grounding
10/10 paths ✓, symbols ✓ (`_WARSAW_TZ` main.py:459, UTC `today` main.py:1514 confirmed), components ✓ (ContextStrip, ConfirmSubmitDialog, ConfirmApproveDialog), brief↔plan ✓. Verified via one general-purpose sub-agent (6 riskiest claims).

## Findings

### F1 — Phase 4 pre-fill refactor under-specified → FR-017 banner regression risk

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 4
- **Detail**: Phase 4 said "replace single latestSnapshot with availableSnapshots + selectedSnapshotId" but didn't enumerate the coupled readers (prefillTime 366-367, showPrefillBanner `.some` 377, acceptPrefill 234, fetch 88-101) that must repoint to the SELECTED snapshot. Regression risk to the lesson-grade FR-017 opt-in banner.
- **Fix**: Expanded the Phase 4 change #2 contract with an explicit refactor map + the FR-017 invariant (banner+fill act on the selected snapshot; keep per-supplier dismiss + empties-only).
- **Decision**: FIXED

### F2 — Required count_user breaks 6 existing submit tests (not listed in plan)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 (change #5)
- **Detail**: Making count_user required → 6 existing tests in test_inventory_submit.py (happy_path_seed_backend, unknown_product, no_setting_for_location, count_id_format, persists_to_sheet, worksheets_not_configured_returns_503) post {lines, notes} with no count_user → 422.
- **Fix**: Added an explicit Phase 1 test step naming the 6 tests to update.
- **Decision**: FIXED

### F3 — Future-date validation uses UTC, not Warsaw

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 (change #3)
- **Detail**: Validating count_date against datetime.now(timezone.utc).date() rejects a legitimate Warsaw "today" picked just after local midnight. `_WARSAW_TZ` already exists (main.py:459).
- **Fix**: Phase 1 change #3 now compares against `datetime.now(_WARSAW_TZ).date()`; tests add a near-midnight case.
- **Decision**: FIXED

### F4 — "Reuse existing confirm dialog" points at the wrong dialog

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 (change #3)
- **Detail**: ConfirmSubmitDialog is hardwired to order-submit semantics; the lighter ConfirmApproveDialog (InventoryCountPage.tsx:42-123) is the right template.
- **Fix**: Phase 4 change #3 now points at the ConfirmApproveDialog pattern, not ConfirmSubmitDialog.
- **Decision**: FIXED

### F5 — ContextStrip is supplier-context, not a generic toolbar

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 (change #2)
- **Detail**: ContextStrip props are {supplier}; stuffing pre-fill controls inside overloads a single-purpose component.
- **Fix**: Phase 4 change #2 now puts the controls in a dedicated sibling row above the lines, not inside ContextStrip.
- **Decision**: FIXED

### F6 — count_date not preserved across draft-resume

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2
- **Detail**: InventoryDraftState stores only the line map + timestamp; a back-dated count_date is lost on resume.
- **Fix**: Phase 2 extends the draft schema to persist + restore count_date (decided to fix, not just accept); added Progress 2.8.
- **Decision**: FIXED

### F7 — "Last count" banner goes stale right after a submit

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2
- **Detail**: The banner fetches inventoryLatest on mount; after a successful submit (form resets, same page) it shows the prior count until reload.
- **Fix**: Phase 2 re-fetches inventoryLatest on submit success; added Progress 2.7.
- **Decision**: FIXED
