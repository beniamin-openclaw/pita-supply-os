# Plan: Scrollable waste catalog and integrated histories

## Desired end state

The Captain scrolls an order-style 17-product list, taps additions or types amounts and returns to a retained draft with today's default date. A confirmed save creates only entered positive rows. Waste history belongs to Captain History, and Manager can switch Inventory/Waste reports, select dates and export CSV. Prepare and show a reviewed merge-ready candidate, without executing production actions.

## Current state and decisions

Parent implementation provides transactional separate waste tables, scoped create/list/void/Manager CSV endpoints, exact string quantities, idempotent UUID retry, stable prewrite/unknown errors, and token-scoped drafts with stale-tab protection. Current form requires choosing a product for each row and embeds history below entry. Captain HistorySegment covers orders/inventory only. Manager waste page has a return link but no sibling segment. CSV exists only for Manager.

Keep the persistence contract and quantity catalog. Preserve old drafts including repeated product rows; do not collapse their different reasons or frozen payload. Fresh empty drafts may use sparse selected rows while rendering all catalog products. Render legacy duplicate rows explicitly. Only entirely untouched blank rows are ignored; invalid nonblank input must never disappear from submission silently. Zero is not a no-loss declaration. Other retains kg/szt, description/reason validation. No default loss reason is invented.

Save every input edit to the existing scoped local draft, with an explicit final batch Save. Show this distinction in product copy. Keep current immutable retry key/body after uncertainty and current snapshot/token ownership guards on every mutation. New drafts default to Warsaw today; restored explicit dates are preserved.

History presets are inclusive: today; today minus6days through today; first day of current Warsaw month through today. Manual date inputs remain. Filters identify the data actually displayed/exported, cancel old request generations and void targets; loading/failure cannot present old results as the new selection. Totals remain decimal strings grouped by product/unit/location. CSV capability for Captain must reuse the same bounded export generator and force location_scope; routes never import a backend directly. No browser-side partial CSV from paginated results.

## What we are not doing

No boxes, new business units, guessed conversions, OCR import, costing, supplier orders, stock mutation, background server autosave per tap, generic state/navigation framework, dependency upgrade, signed-in Telegram access or production action. Physical-device/operator acceptance remains separately identified.

## Phase 1: Catalog list entry

### Changes required

Modify `frontend/src/pages/captain-mp/WasteReportPage.tsx`, its test, `components/WasteQuantityInput.tsx`/test as needed and `src/i18n/strings.ts`. Reuse existing product-list/order card styles, clear focus and >=44px controls. Keep lifecycle logic bounded; extract a view only if it reduces complexity. Allow Other entries and preserve legacy drafts. Replace embedded history with a link to the dedicated history destination and a compact sticky save/selected count.

### Success criteria

#### Automated verification
- The complete catalog is scrollable with exact additive/manual entry, only selected rows submitted, today default, retained drafts and preserved uncertain retry/scope guards.
- Entry regressions cover multi-product selection, omitted blanks, clear, existing drafts/duplicates, validation focus, reload retention and late/stale responses.

#### Manual verification

- Inspect entry at 320/375 px and desktop with reachable save and readable product/unit labels.

## Phase 2: Integrated histories and scoped export

### Changes required

Modify `frontend/src/App.tsx`, `pages/captain-mp/components/HistorySegment.tsx`/test, `CaptainTabs.tsx`/test, `components/WasteHistory.tsx`, `pages/manager/ManagerWastePage.tsx`/test, `ManagerInventoryPage.tsx`, `pages/ManagerPage.tsx`. Add `pages/captain-mp/WasteHistoryPage.tsx` and a small Manager sibling segment if appropriate. Root owns shared i18n integration. Add tests for histories/navigation/presets. Modify `supply-os-v1/app/main.py` to reuse bounded export for scoped Captain CSV and `tests/test_waste_reports.py`/integration tests for access and all-pages completeness; no new schema.

### Success criteria

#### Automated verification
- Captain history routes/segments and Manager Inventory/Waste reports navigation expose the new histories with exactly one active destination.
- Both histories support presets/custom dates, scoped complete totals, audit corrections and authenticated complete CSV; foreign Captain records never appear.
- History/export regressions cover role tokens, date/filter races, inclusive preset boundaries and failed reads/downloads without stale misleading data.

#### Manual verification

- Inspect both history surfaces, date controls, CSV and corrections against actual disposable Postgres with auth enabled.

## Phase 3: Independent review and merge handoff

### Changes required

Run actual product gates plus authenticated browser E2E against separate disposable Postgres. Save actual screenshots outside Git and verification/review/release artifacts here. Recheck remote main. Preserve original plan titles and flip only automated Progress rows. Record shared WORKLOG append-only and clean up task-owned local processes. Prepare merge handoff without merging or production writes; confirm schema prerequisites through authorized read-only access if available.

### Success criteria

#### Automated verification
- Backend Ruff/pytest/integration and frontend build/lint/Vitest pass for the final candidate.
- Two independent implementation reviewers approve after findings are resolved; scope and the final requirement audit are recorded.
- A committed merge proposal identifies the exact candidate, database prerequisite, rollback and evidence without performing merge or production actions.

#### Manual verification

- Ben reviews the rendered result and decides on the concrete merge/release; production and real-period acceptance are not inferred.

## References

- Parent: `context/changes/waste-report/` and `context/foundation/lessons.md`.
- Existing role gates/API client/i18n and storage seam remain authoritative.

## Progress

### Phase 1: Catalog list entry

#### Automated

- [x] 1.1 The complete catalog is scrollable with exact additive/manual entry, only selected rows submitted, today default, retained drafts and preserved uncertain retry/scope guards. — d955721
- [x] 1.2 Entry regressions cover multi-product selection, omitted blanks, clear, existing drafts/duplicates, validation focus, reload retention and late/stale responses. — d955721

#### Manual

- [ ] 1.3 Inspect entry at 320/375 px and desktop with reachable save and readable product/unit labels.

### Phase 2: Integrated histories and scoped export

#### Automated

- [x] 2.1 Captain history routes/segments and Manager Inventory/Waste reports navigation expose the new histories with exactly one active destination. — d955721
- [x] 2.2 Both histories support presets/custom dates, scoped complete totals, audit corrections and authenticated complete CSV; foreign Captain records never appear. — d955721
- [x] 2.3 History/export regressions cover role tokens, date/filter races, inclusive preset boundaries and failed reads/downloads without stale misleading data. — d955721

#### Manual

- [ ] 2.4 Inspect both history surfaces, date controls, CSV and corrections against actual disposable Postgres with auth enabled.

### Phase 3: Independent review and merge handoff

#### Automated

- [x] 3.1 Backend Ruff/pytest/integration and frontend build/lint/Vitest pass for the final candidate. — d955721
- [x] 3.2 Two independent implementation reviewers approve after findings are resolved; scope and the final requirement audit are recorded.
- [x] 3.3 A committed merge proposal identifies the exact candidate, database prerequisite, rollback and evidence without performing merge or production actions.

#### Manual

- [ ] 3.4 Ben reviews the rendered result and decides on the concrete merge/release; production and real-period acceptance are not inferred.
