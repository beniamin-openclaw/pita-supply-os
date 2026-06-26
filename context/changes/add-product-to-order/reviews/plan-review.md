<!-- PLAN-REVIEW-REPORT -->
# Plan Review: add-product-to-order

- **Plan**: context/changes/add-product-to-order/plan.md
- **Mode**: Deep
- **Date**: 2026-06-26
- **Verdict**: REVISE → SOUND (after triage)
- **Findings**: 2 critical | 1 warning | 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

6/6 paths ✓ (ManagerPage.tsx, OrderDetailPane.tsx, OrderLineTable.tsx, OrderEditPage.tsx, draftState.ts, main.py), 3/3 symbols ✓ (seedDrafts confirmed fresh-map, _build_orderable_item exists, require_manager used in all manager write routes), brief↔plan ✓

## Findings

### F1 — seedDrafts wipes all unsaved manager edits on add-line

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 3 — ManagerPage.tsx change, point d (plan line 185–186)
- **Detail**: Plan claimed "`seedDrafts(newDetail)` preserves existing drafts and seeds the new line at qty=0." In reality, `seedDrafts` (draftState.ts:23–32) creates a completely fresh `DraftMap` from scratch — every existing key is replaced. `ManagerPage.tsx:112` calls `setDrafts(seedDrafts(d))` on every `loadDetail`. The add-line flow — managerAddLine → re-fetch detail → setDrafts(seedDrafts(newDetail)) — silently wipes any qty/comment edits the manager made to existing lines before clicking "Add product." The `ManagerAddLineResponse` already carries `order_line_id`, so the fix uses a targeted merge instead.
- **Fix ⭐ Applied**: Replace the `seedDrafts` call in `handleAddLine` with a targeted merge: `setDrafts(prev => ({ ...prev, [resp.order_line_id]: { qty: 0, comment: "" } }))` — preserves existing unsaved edits; injects only the new line at the same zero-baseline seedDrafts would produce.
- **Decision**: FIXED

### F2 — Progress section format prevents /10x-implement from parsing

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: ## Progress (plan lines 309–314)
- **Detail**: Progress section used flat `- [ ] Phase N:` checklist items. Required format: `### Phase N: Name` subsections with `- [ ] N.M title` items per Automated/Manual Verification point. Flat checklist causes `/10x-implement` to fail to parse phase state.
- **Fix ⭐ Applied**: Restructured Progress to 4 phase subsections (### Phase 1–4) with 8/4/6/4 numbered checklist items covering happy path, error gates, and live-test verification.
- **Decision**: FIXED

### F3 — Backend tests: seed backend returns 503; mock pattern unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Backend tests (step 5)
- **Detail**: The add-line endpoint gates on `_is_persistent(backend)`, returning 503 for the seed backend before any business logic runs. Plan didn't specify the required mock pattern. Template: `test_manager_claim_release.py` `_enable_sheet` helper (`mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)` + `sheets.is_configured=True` + mock `get_order` / `append_order_lines`).
- **Fix ⭐ Applied**: Added a `> Mock pattern required` block to Phase 1 step 5 specifying the exact pattern and template file.
- **Decision**: FIXED

### F4 — "Fetch orderable in parallel" is misleading for OrderEditPage

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Frontend Changes §2a (OrderEditPage, step a)
- **Detail**: "fire a second fetch in parallel: `api.orderable(data.supplier_id)`" — `supplier_id` is only available after `captainOrder` resolves, so the orderable fetch cannot start in parallel with it. The code shown in the plan (called from inside `.then()`) was already sequential; the wording was misleading.
- **Fix ⭐ Applied**: Changed "fire a second fetch in parallel" to "fire a second fetch sequentially" with a parenthetical explaining why.
- **Decision**: FIXED
