<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Scrollable waste catalog and integrated histories

- **Plan**: `context/changes/waste-report-list-history/plan.md`
- **Mode**: Deep, focused codebase verification
- **Date**: 2026-11-04
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 0 observations requiring plan changes

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

Grounding: existing modification paths verified across the entry page, quantity input, history component, HistorySegment, CaptainTabs, ManagerWastePage, ManagerInventoryPage, ManagerPage, App router and backend main/test modules. New history page/segment files are planned additions, not missing existing paths. Brief and plan agree. Exactly one bottom Progress section mirrors three phases, eight automated and three manual criteria. No placeholder or out-of-scope migration automation is required.

## Riskiest claims checked

| Claim | Code evidence | Assessment |
| --- | --- | --- |
| Old drafts can remain compatible while the view becomes a fixed catalog | `frontend/src/pages/captain-mp/WasteReportPage.tsx:14–17` stores row arrays independently of catalog; `:45–47` restores the existing draft; `:70–80` compares the raw storage snapshot before write; `:93–109` preserves matching batch/payload handling. `lib/wasteReport.ts:13–24` retains prior uncertainty and checks exact submitted readback. | Confirmed. Keep the persisted row list and frozen body intact; rendering a 17-item catalog need not coalesce repeated product rows or reset reasons. A sparse new draft can be a bounded view change. Tests must retain old duplicate and frozen fixtures rather than replacing every fixture with the new happy path. |
| Captain History can own waste history without another top-level tile | `components/HistorySegment.tsx:11–26` derives the current two segments from route prefixes; `components/CaptainTabs.tsx:33–39` derives top-level active state. OrdersListPage and InventoryHistoryPage already render HistorySegment. `frontend/src/App.tsx` already wraps each feature route with AuthGate. | Confirmed. Add a distinct `/captain-v2/waste-history` route, include it in the History top-level predicate, retain entry ownership under `/captain-v2/waste-report`, and let the existing segment appear on all three history pages. No navigation framework is needed. |
| Manager can expose a sibling report segment beside Inventory | `frontend/src/pages/ManagerPage.tsx:636–642` already places a waste link next to Inventory; `pages/manager/ManagerWastePage.tsx` currently uses a role-pinned history with a return link; ManagerInventoryPage has a separate list/detail return structure. | Confirmed. A small two-link segment shared by the Inventory list and waste view fits current route navigation. Preserve existing inventory detail behavior; no inventory persistence change is justified. |
| Captain CSV can reuse bounded all-pages export safely | `supply-os-v1/app/main.py:7338–7348` owns bounded streaming and final file cleanup; `:7351–7382` builds CSV page by page with totals disabled and formula escaping. `_waste_list` at `:7243–7252` already accepts an explicit location; Captain list at `:7281–7289` gets location from `require_captain`. `app/auth.py` documents and implements token-derived Captain location. | Confirmed. Extract generation behind a shared helper and pass token-derived Captain location, never optional request location/None; Manager retains its optional validated location. Test a forged query location and multiple pages. Existing all-page/cleanup integration tests remain relevant; no new adapter or schema is needed. |
| Date presets and race handling have a bounded implementation path | `components/WasteHistory.tsx:11–28` currently holds date/location filters and a request generation; its filter handlers clear data, target and reason. `:48–55` currently downloads through apiGetBlob using current parameters. Backend `_waste_dates` at `app/main.py:7212–7223` validates strict inclusive dates, current Warsaw day and a maximum one-year interval. | Confirmed with the plan's explicit improvements. Compute date-only presets from Warsaw today using UTC calendar arithmetic, not elapsed local milliseconds. Capture the intended filter parameters per read/download and reject stale completions after filter/token changes. The current failed-load path can retain old data, so new tests must verify failure cannot relabel old results as a new selection. |
| A reviewed candidate may be prepared without claiming merge alone establishes the schema | Parent `context/changes/waste-report/release-proposal.md` identifies additive migration0032 and exact hash; repository AGENTS states operator migration before the code/main auto-deploy. The follow-up plan explicitly carries this prerequisite and prohibits production mutation. | Confirmed as a handoff boundary, not a proven production state. Do not claim “only merge remains” unless the existing production schema is independently shown compatible. A conditional merge proposal must name the unresolved prerequisite if read-only access cannot verify it. |

## Implementation guardrails

These restate the reviewed plan rather than introduce extra work:

- The fixed list must give each quantity/reason a clear product association for keyboard and assistive use; repeated generic quantity labels alone are insufficient once 17 products render together.
- Blank neutral catalog rows may be omitted, but nonblank malformed input and partially edited Other/legacy rows cannot silently disappear. A zero quantity is not a no-loss declaration.
- A restored explicit draft date stays explicit. An empty new draft uses today's Warsaw date. Never change a frozen report's date/payload during the view conversion.
- CSV needs full permitted-period rows, not just the visible first page. Download busy/error state must recover on failure; use a finite deadline if the new view disables the export button during the request.
- Root owns shared i18n/backend/form changes; the history implementer must avoid concurrently editing those files without coordination. No repeated global-state edits or generic component rewrite is needed.

## Acceptance boundary

This review checked source feasibility and the plan contract; it did not execute implementation tests, browser E2E, production reads, a migration or a merge. The plan correctly leaves physical-device/operator and production acceptance separate. Final review must inspect the implemented filters, draft mapping and scoped CSV instead of treating this SOUND verdict as code validation.

Exact next step: implement the reviewed three phases, run declared product checks plus authenticated disposable-Postgres E2E, then save the independent implementation reviews and exact merge proposal.
