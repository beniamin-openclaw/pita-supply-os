# Digital waste report implementation plan

## Overview

Add one Captain menu destination for a digital Raport strat, based on the existing 17-product paper form. A single appendable form supports one loss during a shift or several rows at the end of a day. Ben selected manual input with additive quick-amount tiles; calibrate the amounts against 30 actual reports rather than purchase-pack assumptions.

Planning was explicitly requested on 2026-11-04. This document is a plan, not application implementation, deployment approval or evidence that 30 reports have already been analyzed. Read `report-sample-analysis.md` for the actual evidence count. UI option B is selected; amount calibration remains a prerequisite for the UI phase. Backend contracts can be reviewed independently.

## Current state analysis

- Base: `origin/main@02a0930e09e09648a0e75dfb22f1cb1d96006144`; isolated branch `codex/supply-v2-waste-report`.
- The paper template, fetched from Drive, contains 17 SKU rows, three storage sections, dated columns, Other and a signature. Weight labels such as 2.5 kg/200g are packaging descriptions, not entered losses.
- `frontend/src/pages/captain-mp/components/CaptainTabs.tsx:11` supplies three permanent buttons. There is no dashboard to rebuild. Its Orders fallback at `:30` needs to exclude the new route.
- No waste models, storage or routes exist. Stock-count snapshots feed order suggestions; losses must not be stored there.
- `supply-os-v1/app/main.py:835` selects the persistence backend. Production storage uses Supabase; seed is deliberately read-only (`app/seed_loader.py:29`). Finance already demonstrates a Supabase-only capability flag (`app/supabase_backend.py:78`).
- `frontend/src/components/ui/DecimalInput.tsx:66` retains invalid raw text while the parent retains a previous valid number. Reusing it without exposing validity could save the wrong quantity. The new feature must validate the visible raw value.
- Initial accessible evidence: one unique historical KEN extraction, not 30 reports. Three JSON representations of it count once. Current Telegram location-chat search and Terra image extraction are tracked in the sample analysis.

## Desired end state

A Captain taps Raport strat, selects one or several products and records quantity/reason with little typing. Saving appends dated records; later additions do not replace earlier submissions. The Captain can read their location's saved entries, while a Manager can filter locations and dates and export original quantities for analysis. A mistaken entry can be voided with a reason, retaining its original value, and entered correctly again.

The quantity control always exposes manual input. Display grams for products whose recorded unit is kg when the sample supports gram entry; save the canonical paper unit and quantity. Never infer piece weights, packs or costs. A missing day remains unreported rather than zero loss.

### Selected quantity interaction

| Option | Control | Exact interaction | Advantage / cost |
| --- | --- | --- | --- |
| B — input and additive quick amounts, selected by Ben | Editable amount + at most three labelled additions, e.g. `+50 g`, `+100 g`, `+250 g` | Every tap adds the labelled amount to the visible field, including repeated taps on the same tile. Different tiles can be combined. Blank starts at zero; invalid nonblank input disables additions until corrected. Manual input remains editable. These are action buttons, without a selected/toggle state. Nothing is persisted until Save. | Common amounts and repeated additions take few taps; needs one extra row. |

All example gram values above are provisional illustrations from the small available observation, not a 30-report recommendation. For piece products the visible unit stays szt; `+1` never means an undisclosed pack or weight. Build the selected option only: no runtime A/B mode, user preference screen or adaptive learning service.

Decision recorded on 2026-11-04: Ben prefers the second preview and requires repeated clicks to add; the tiles themselves are plus buttons. Two taps on `+100 g` produce `200 g`, then `+50 g` produces `250 g`. Calibrate only the labelled additions and display units; the interaction is already selected. Present per-product coverage and evidence gaps without changing that decision.

## What we are not doing

- Boxes, recipe-based transformations, purchase-pack conversions, monetary loss valuation or automatic consumption estimates.
- GoStock import/export integration or guessed mapping from paper SKUs to purchasing products. A generic analysis CSV is not a GoStock file.
- Telegram bots, a new poller, historical report import into operational records, staff messages, reminders or runtime changes.
- A replacement navigation system, settings platform, shared component rewrite or new package dependency.
- Mandatory zero-loss declarations, attendance/person identification, daily closing locks or completeness claims. These are not established by the source standard.

## Implementation approach

Reuse the current role gates, API client, i18n, navigation appearance, database transaction pattern and test runners. Add a small fixed catalog module, typed waste models and seam-backed Supabase methods. Use separate waste header and line tables; each save is one transaction. Keep history within the new module and give Manager a simple table/filter/export page.

The proposed business defaults are explicit design choices for this plan, not claims that Natalia, Sławek or Sebastian already approved a standard: date defaults to today in Warsaw; each entered quantity is positive; every saved row needs a reason; OTHER needs a short explanation; an explicit Other product needs a description and kg/szt unit; quantities may include fractional pieces without guessing piece weights. Readable report evidence can refine these defaults before implementation.

## Critical implementation details

### Quantity, input and rounding

Maintain the raw input string as the source of truth in a waste-only control. Accept ordinary decimal comma/dot syntax, then reuse `parseDecimal` and apply range/precision validation; reject hexadecimal, exponent notation, mixed separators, non-finite values, negatives and invalid trailing text. Re-parse the visible raw string at submission. Do not change `DecimalInput` globally or use `roundQty`, whose two decimals would lose gram precision. Each quick-add action parses the current visible raw string and writes the exact sum back to it; never add to a stale cached valid value. Disable quick additions while nonblank raw input is invalid, until manual correction.

For g display, accept integer grams and convert exactly to canonical kg with three decimal places. For kg/szt manual fields accept at most three decimal places. Use decimal arithmetic or integer scaling for normalization/validation and database NUMERIC storage. Reject unsupported precision; never silently round an entered loss. The client may show a kg equivalent, but the unit must be visible next to every editable value and amount button.

Technical quantity bound (F4): canonical kg/szt quantity is at most `999999.999`, backed by `NUMERIC(9,3)`; submitted quantities use `NUMERIC(12,3)` to accommodate up to `999999999` integer grams. Reject values outside these limits before Number conversion; validate scaled integers with `Number.isSafeInteger` after arithmetic. Addition overflow is an error, never clamped or rounded. Totals remain server-side Decimal/string values without the per-line ceiling. This technical limit does not calibrate tile amounts or imply a realistic loss size.

Implementation clarification: use unconstrained PostgreSQL NUMERIC with explicit range and `quantity = trunc(quantity, 3)` checks for the same accepted bounds. Fixed-scale NUMERIC silently rounds before a CHECK can reject excess precision; explicit checks preserve the no-rounding requirement. Display grams additionally require an integer and exact canonical conversion. No reviewed Progress title changes.

### Draft and uncertain-save lifecycle

Keep form rows, date and an opaque batch UUID in a Captain-scoped draft using the existing token-scope pattern. Pin the originating token/scope and check it immediately before every mutation, readback and draft write; abort on mismatch before making a network request, preserving the original scoped draft. Reuse the existing API client's snapshot-token protection and ignore stale responses. Test a token change in another tab immediately before Save and retry/void (F1).

Distinguish definitive rejection from an uncertain result (F2). Structured validation/auth/capability failures guaranteed to happen before a transaction begins leave an editable retained draft; a corrected payload gets a fresh UUID. Network failures, timeouts, unclassified 5xx and response-decoding failures freeze the submitted payload and original UUID. Resolve through by-batch readback or retry the identical payload/key; a 404 alone cannot prove an earlier in-flight transaction will never commit and never unlocks changed-payload submission. On confirmed persistence clear only that submitted draft; later additions get a new UUID. Prevent concurrent submits. Tests cover editable 422 rejection, lost-success-response identical retry, and by-batch 404 racing an in-flight save.

Implementation clarification: the feature keeps its TypeScript DTOs beside waste helpers rather than enlarging the global types file. Integer scaling is used directly instead of the generic decimal parser, so syntax, length, precision and overflow are validated before conversion. Storage snapshot checks also reject stale same-token tabs. A rejected retry cannot release a batch that was already uncertain; only a definitive first-attempt rejection permits editing with a new UUID. These are bounded implementations of the reviewed contracts, without extra modes or dependencies.

## Phase 1: Evidence calibration and selected interaction

### Changes required

**Files:** `context/changes/waste-report/report-sample-analysis.md`, `research.md`, this plan's selected-option decision and brief.

Collect 30 unique filled waste reports from the Telegram location chats Ben identified, using the existing JARVIS-CODEX Pita MCP Telegram archive/API and GPT-6.1 Terra at medium reasoning for visual extraction. Ben explicitly requested delegation to a JARVIS-CODEX agent for this source retrieval. He subsequently prohibited downloading through the signed-in Telegram app/browser: this route has been stopped and is not an allowed fallback. Download only through the approved authenticated API to the private evidence directory, not Git. Once available, split non-overlapping image batches across Terra workers. Retain a private manifest with file hash, source chat/message, observed date, report period and classification; omit names/signatures/captions from committed evidence.

Deduplicate by document identity and image content, including the same sheet reposted or cropped. A multi-day sheet is one report, not one report per cell. Preserve daily cells separately from SUMA to avoid double counting. Missing/unreadable values remain unknown. Do not guess a year or source location from handwriting. Exclude blank forms, inventory counts, ordering sheets, fiscal receipts and checklists. Describe actual source/time coverage; do not call a convenient sample representative of every location.

For each of the 17 products report: number of unique source reports with readable observations, observed units, quantity range, common exact amounts, frequency of fractional pieces, and any ambiguous cells. Separate full-day quantities from incident-level entries: a daily total does not prove the usual size of a single loss.

Compare up to three candidate simple additions against observed amounts: single-tap coverage, exact reachability using repeated/mixed additions, median/worst tap count and the number still requiring manual input. Resolve equal frequencies by smaller value for a stable, understandable order. If a product has fewer than five independent readable reports, label its additions uncalibrated rather than infer an optimum. Do not introduce an optimizer/service; a small one-off table or disposable analysis is enough.

If fewer than 30 source reports are accessible, finish the plan with the actual count and a concrete access blocker. Manual-entry behavior and storage design remain defined; mark the 30-report gate pending rather than claim completion.

### Success criteria

#### Automated verification

- The private manifest and sanitized analysis reconcile 30 unique actual report identities and correctly exclude duplicates/lookalikes.
- A reproducible summary reconciles readable observations, observed units, candidate increments and quick-value coverage without treating missing cells as zero.

#### Manual verification

- Terra visual extractions and source coverage have been checked; ambiguous handwritten values are retained as unknown.
- Ben's selected option B uses additive tiles on every tap; final catalog additions are calibrated and recorded without claiming unsupported product coverage.

## Phase 2: Typed contracts and atomic persistence

### Changes required

**Files:** `supply-os-v1/app/models.py`, new `app/waste_catalog.py`, `app/errors.py`, `app/supabase_backend.py`, `app/seed_loader.py`, `app/sheets.py`, next available migration `migrations/0032_waste_reports.sql` (recheck numbering before writing), and focused model/catalog/database tests.

**Catalog:** one typed server-owned list of the existing 17 SKU IDs, PL/EN labels, storage section and canonical unit. Include the selected display unit and labelled quick additions from phase 1 in this list, returned by the catalog endpoint. Do not duplicate catalog constants in React. The explicit Other product is separate and never creates a new catalog SKU.

**Request models:** a nonempty batch of at most 100 lines with batch UUID and explicit Warsaw business date. A line carries a known SKU or an Other description, submitted display quantity/unit, reason code and optional short reason detail. Limit Other text to 120 and reason detail to 500 characters. Disallow extra fields so a forged location/actor cannot be silently accepted. Map catalog products to server-owned units; allow only exact g↔kg conversion for weight entries. OTHER reason requires nonblank detail. Reason codes start with burned/dropped/expired/spoiled/other, described as proposed defaults; no inferred cause.

**Response models:** canonical quantities/units, submitted quantities/units, stable batch/line IDs, business date, UTC creation time, effective/void state and void reason/time/role. Catalog display labels/units are snapshotted on the stored line to preserve history when labels later change. Waste quantity request/response fields use Pydantic Decimal with ordinary decimal strings in JSON and matching TypeScript string fields; totals follow the same contract. This feature-specific representation preserves exact gram normalization; existing order/inventory numeric APIs are unchanged. Validate decimal syntax before conversion rather than accepting every numeric form Python/JavaScript permits.

Integration contract: `api-contract.md` in this change folder specifies exact JSON field names shared by frontend and backend. F4 bounds apply equally in request validators, database constraints and the quantity control. Keep tests for maximum, one increment beyond maximum and exact fractional additions under the existing quantity/model criteria; criterion titles in Progress remain unchanged after review.

**Database:** `waste_reports` holds report ID, location FK, business date, batch idempotency UUID, canonical request digest and creation timestamp. Uniqueness is `(location_id, batch_uuid)`; digest binds the normalized payload including line order. `waste_report_lines` holds original line snapshots, positive NUMERIC quantity, original submitted unit/quantity, reason and optional void metadata. Enforce unit/reason/positive finite quantity, complete void metadata and catalog-or-Other constraints. Add `(location_id, business_date, report_id)` lookup index; deny-all public RLS on both tables, following existing migrations. No supplier/order/stock table is changed.

**Seam methods:** expose `SUPPORTS_WASTE_REPORTS`, `append_waste_report`, `get_waste_report_by_batch`, `load_waste_reports`, `get_waste_report` and `void_waste_report_line` through the chosen backend. Pydantic models cross every boundary. Supabase supports the feature; Sheets and seed explicitly do not. Match the existing finance capability pattern: feature endpoints return a localized 503 on unsupported adapters. Do not add a second writable seed store or pretend a seed response is durable. Unit tests use a typed in-memory test double; local browser verification uses disposable Postgres.

**Transactions:** insert header+lines in one transaction. Same idempotency key+same digest returns the committed original; same key+different digest is 409. Concurrency must resolve through DB uniqueness/locking, not a pre-insert check alone. Voiding changes an effective line only once; repeat returns the original void result. A different later reason does not overwrite it. Original quantities remain immutable; correction is void-and-add, with no delete endpoint.

### Success criteria

#### Automated verification

- Catalog and model tests cover all 17 identities, unit trust boundaries, Other/reason limits, decimal precision and invalid/empty requests.
- Disposable Postgres tests prove atomic header/line rollback, concurrent idempotent retry, changed-payload 409, immutable void metadata, constraints and deny-all public RLS.
- Unsupported adapters return 503 without writes or successful persistence claims; backend Ruff and focused pytest checks pass.

#### Manual verification

- Review the additive migration, table isolation and preserved original quantities against the paper contract; no order or inventory semantics change.

## Phase 3: Role-scoped API and analysis readback

### Changes required

**Files:** `supply-os-v1/app/main.py`, `app/models.py`, `app/supabase_backend.py`, `tests/test_waste_reports.py`, `tests/test_supabase_integration.py`.

Add these typed routes; all persistence resolves through `_choose_backend()`:

- `GET /api/captain/waste/catalog`: Captain catalog and feature capability result.
- `POST /api/captain/waste/reports`: create one batch for the token-derived location; server generates report/line IDs and timestamps.
- `GET /api/captain/waste/reports`: scoped list, inclusive date range and cursor, including per-product period totals.
- `GET /api/captain/waste/reports/by-batch/{batch_uuid}`: scoped uncertain-save readback.
- `GET /api/captain/waste/reports/{report_id}`: scoped persisted detail; use the same 404 for missing and foreign location.
- `POST /api/captain/waste/reports/{report_id}/lines/{line_id}/void`: location-scoped void with required reason.
- `GET /api/manager/waste/reports` and `GET /api/manager/waste/reports/{report_id}`: Manager list/detail, optional verified location filter.
- `POST /api/manager/waste/reports/{report_id}/lines/{line_id}/void`: the same audited correction behavior with manager role.
- `GET /api/manager/waste/export`: generic CSV for the selected period/location, containing original and void metadata, clearly distinct from a GoStock import file.

Use inclusive business-date filters, default today and a maximum 366-day interval. Reject reversed/future business-date requests appropriately; paginate lists by immutable `(created_at, report_id)` with a matching cursor and include all selected-period records in totals/export. No implicit newest-20 truncation. Page size is at most 100; reject an invalid cursor. Manager summaries are grouped by location/product/unit; no cross-unit grand total. Keep Other rows separate by original description/unit; do not automatically map similar labels together. CSV uses stable IDs and escaped cells to prevent spreadsheet-formula interpretation of free text; create it with stdlib `csv`.

Translate server validation/error codes through existing i18n mechanisms. Return usable failure messages, never successful empty data for a missing migration or storage outage. Do not expose SQL/credentials in errors. The shared location token identifies a location, not the individual who entered a loss.

F3: waste business failures carry stable feature-specific error codes. Map them to PL/EN strings in the API client/i18n layer, preserving existing order behavior. Empty waste `lines` must use waste wording rather than the existing `apiError.orderEmpty` special case. Add localized 503, conflict, not-found and invalid-date tests; do not infer a definitive nonwrite from an arbitrary proxy 503.

### Success criteria

#### Automated verification

- Auth-on tests prove missing-token rejection, cross-location 404, Manager role access, forged location rejection and correct role on voids.
- Route tests prove create/readback/append/retry/void behavior, valid dates, cursor handling, complete period totals/export beyond 100 records, and safe CSV text.
- Integration schema applies the new migration and includes both tables in destructive-test cleanup lists; tests run only against a disposable database.

#### Manual verification

- Auth-on Captain and Manager requests read the same persisted sample with their respective location boundaries; a later addition does not replace earlier entries.

## Phase 4: Minimal Captain form and Manager view

### Changes required

**Files:** `frontend/src/App.tsx`, `src/apiClient.ts` and tests, `src/types.ts`, `src/i18n/strings.ts`, `src/pages/captain-mp/components/CaptainTabs.tsx` and tests; new `src/pages/captain-mp/WasteReportPage.tsx`, `components/WasteQuantityInput.tsx` and tests, `lib/wasteReport.ts` and tests, new `src/pages/manager/ManagerWastePage.tsx`, and existing `src/pages/ManagerPage.tsx` for its navigation link. Add a feature-specific draft helper/test only if the existing scoped draft functions cannot be used directly.

Add `/captain-v2/waste-report` with the existing Captain gate and fourth permanent button. Use the current visual style; permit a two-by-two layout on narrow phones so four labels remain legible. Do not touch all Header/Hamburger callers. Add `/manager/waste` with Manager gate and a normal Manager header link.

F1–F3 file/test follow-through: include `src/i18n/apiErrors.ts`, `src/i18n/apiErrors.test.ts` if the feature error mapping requires changes there; test waste empty-lines copy separately from orders. Extend the existing draft/history and role-token criteria with the pre-mutation scope check and definitive/uncertain save cases above. Reuse `apiGetBlob` for authenticated CSV export. These are targeted additions to the existing criteria, without renaming reviewed Progress titles.

Captain form: date defaults to Warsaw today; product chooser groups the existing 17 products by paper section, with Other last. Start with one editable row; `+ Dodaj pozycję` adds another. Product labels and units are visible. Show the selected quantity option only, a compact reason picker and conditional Other detail. Save all completed rows as one batch; focus the first invalid field and retain all entered values on failure. An untouched extra row can be removed locally; partially filled rows require completion or explicit removal. A plus/quick choice edits the draft; it is never a network save or a guessed weighed quantity.

Below the form show persisted entries for the selected day with a history/date-range control and per-product totals. The append workflow and end-of-day workflow share the same screen. Include a clear void action with reason and confirmation; retain voided rows in detail while excluding them from effective totals. For a correction, void the wrong entry and add the correct one. No daily lock/status flow.

Manager view: compact date/location filters, effective totals grouped correctly and a paginated list/detail, with CSV export for the full selected period and audited void. Do not copy the order queue or add charts. Every new user-visible label/error/empty state has PL/EN i18n keys. All network calls use `apiClient.ts` and explicitly select the correct role; authenticated export must use the client rather than an unauthed URL.

### Success criteria

#### Automated verification

- Captain menu tests prove the fourth destination and exactly one active button on every relevant route; API tests attach only the intended role token.
- Quantity/form tests prove the chosen option, repeated/mixed additive tiles, manual override, decimal comma, invalid-after-valid protection, exact gram conversion, no floating-point drift, blank/zero distinction, reason validation and disabled double submit.
- Draft/history tests prove failed-save retention, stable retry UUID, location isolation, later additions, readback, void visibility and correct nonmixed totals.
- Frontend build, lint and Vitest pass with the selected control and PL/EN copy.

#### Manual verification

- At 320/375 px and desktop widths the selected form works with keyboard/touch, readable labels, visible focus and no horizontal overflow.
- Auth-on disposable-Postgres browser verification covers one incident, a daily batch, later additions, network-error retry and void/add correction with both roles.

## Phase 5: Review, product verification and deployment proposal

### Changes required

**Files:** this plan's Progress, `change.md`, `research.md`, `report-sample-analysis.md`, `docs/pita-supply-os-v1/RAILWAY_DEPLOY_RUNBOOK.md` for the specific migration/verification note if needed; state documentation at handoff. Update the roadmap and affected AGENTS claims only when the change reaches the relevant review/archive step.

Run `/10x-plan-review waste-report` before application implementation, then `/10x-impl-review waste-report` after it. Resolve material findings and run the product's actual checks. Do not add dependencies or refactor stock input to implement the selected variant.

Prepare a concrete release proposal: additive migration first, then the reviewed commit to main (Railway backend + Vercel frontend), verify the new authenticated API and both running artifacts, then a controlled real-period pilot. Get Ben's approval before any production migration/merge/deploy. Preserve the pre-release commit, apply no destructive backfill, and define rollback as reverting the application commit while retaining the additive tables/data. Verify the current DB schema/deploy state rather than assume merged means live.

After deployment approval, verify a real reporting period with actual operators and the original records. A local test or historical OCR sample does not close real-period acceptance. Archive only after the agreed acceptance checks; leave any unmet manual gate unchecked.

### Success criteria

#### Automated verification

- Plan/implementation reviews have no unresolved critical issues and the final diff touches only the agreed scope.
- Product checks pass: backend Ruff and pytest; frontend build, lint and Vitest; disposable Postgres integration.
- Deployment proposal identifies exact commit, additive migration, backend/frontend verification, rollback and pending real-period acceptance without claiming production was changed.

#### Manual verification

- Ben has approved the concrete production release; the migration and both deployed artifacts are verified after execution.
- A real-period pilot confirms usable entry, correct saved quantities/reasons, later additions, period readback and reduced manual transcription; operational state and next step are recorded.

## Testing strategy

Use focused tests at each phase, then run the repository checks once at the implementation boundary. Models and API need trust-boundary tests; database transactions/idempotency require real disposable Postgres. Screen authorization requires auth enabled with only the relevant role's token. Include manual controls outside the suggested quick amounts, partial products, fractional pieces, weight precision, missing days and voided history.

Commands from their respective directories:

- Backend: `ruff check .` and `python -m pytest`.
- Frontend: `npm run build`, `npm run lint`, `npm run test`.
- Disposable Postgres only: `python -m pytest -m integration`, with the test-owned local database selected through the existing environment contract. A skipped integration run is not a passing database check.

Planning verification only checks document contracts and source references; it does not execute the application acceptance checks or send supplier orders.

## Performance considerations

Seventeen catalog products need no search service/cache/worker. Query storage by location/date, paginate records and aggregate complete selected-period totals in SQL rather than loading all historical records into the browser. Export streams the selected bounded period and never pretends one list page is complete. Keep existing connection-pool limits.

## Migration notes

The proposed next number 0032 is provisional until concurrent work is checked. New tables are additive, with no changes to orders, inventory, receipt history or stock suggestions. Enable deny-all RLS before exposing the feature. No OCR-derived record is automatically imported. Unsupported/misconfigured backend selection fails visibly rather than dropping loss submissions. Preserve new data if the application is rolled back.

## Open risks and assumptions

- Required 30-report access and visual calibration may still be incomplete. The sample analysis is authoritative for the count; illustrative quick amounts must not be promoted to an optimum.
- Existing Pita Office OAuth login was attempted and failed at client registration with HTTP 400 `invalid_client_metadata`. Source retrieval needs a working approved API session; no signed-in Telegram download fallback is authorized.
- Ben has selected B with additive tiles; only that control is implemented. Product-level calibration evidence may be sparse even across 30 reports.
- The report standard's weighing/reasons still needs operational agreement. Quick controls record an observation and must not encourage rounding an unweighed loss.
- Existing shared location tokens do not provide individual staff attribution. Adding a name/signature/authentication system is outside this change.
- GoStock matching remains blocked on accepted mappings/conversions and is not part of the generic CSV.

## References

- `context/changes/waste-report/research.md` — codebase, paper source and prior decisions.
- `context/changes/waste-report/report-sample-analysis.md` — real source count and quantity calibration.
- `context/foundation/lessons.md` — seam, auth-on checks, deployment evidence and archive integrity.
- `frontend/src/components/ui/number.ts:21` — existing decimal helper and its limitations.
- `supply-os-v1/app/supabase_backend.py:663` — transaction pattern; `tests/test_supabase_integration.py:53` — schema/cleanup lists.
- [Source card](https://trello.com/c/3RCu00Ng) and [paper form](https://drive.google.com/file/d/1uA_YcqC9cVmaOIcKLa66KG3EIQN_kGiw/view).

## Progress

### Phase 1: Evidence calibration and selected interaction

#### Automated

- [x] 1.1 The private manifest and sanitized analysis reconcile 30 unique actual report identities and correctly exclude duplicates/lookalikes. — b448d00
- [x] 1.2 A reproducible summary reconciles readable observations, observed units, candidate increments and quick-value coverage without treating missing cells as zero. — b448d00

#### Manual

- [ ] 1.3 Terra visual extractions and source coverage have been checked; ambiguous handwritten values are retained as unknown.
- [ ] 1.4 Ben's selected option B uses additive tiles on every tap; final catalog additions are calibrated and recorded without claiming unsupported product coverage.

### Phase 2: Typed contracts and atomic persistence

#### Automated

- [x] 2.1 Catalog and model tests cover all 17 identities, unit trust boundaries, Other/reason limits, decimal precision and invalid/empty requests. — 320abfb
- [x] 2.2 Disposable Postgres tests prove atomic header/line rollback, concurrent idempotent retry, changed-payload 409, immutable void metadata, constraints and deny-all public RLS. — 320abfb
- [x] 2.3 Unsupported adapters return 503 without writes or successful persistence claims; backend Ruff and focused pytest checks pass. — 320abfb

#### Manual

- [ ] 2.4 Review the additive migration, table isolation and preserved original quantities against the paper contract; no order or inventory semantics change.

### Phase 3: Role-scoped API and analysis readback

#### Automated

- [x] 3.1 Auth-on tests prove missing-token rejection, cross-location 404, Manager role access, forged location rejection and correct role on voids. — 320abfb
- [x] 3.2 Route tests prove create/readback/append/retry/void behavior, valid dates, cursor handling, complete period totals/export beyond 100 records, and safe CSV text. — 320abfb
- [x] 3.3 Integration schema applies the new migration and includes both tables in destructive-test cleanup lists; tests run only against a disposable database. — 320abfb

#### Manual

- [ ] 3.4 Auth-on Captain and Manager requests read the same persisted sample with their respective location boundaries; a later addition does not replace earlier entries.

### Phase 4: Minimal Captain form and Manager view

#### Automated

- [x] 4.1 Captain menu tests prove the fourth destination and exactly one active button on every relevant route; API tests attach only the intended role token. — 3cddf37
- [x] 4.2 Quantity/form tests prove the chosen option, repeated/mixed additive tiles, manual override, decimal comma, invalid-after-valid protection, exact gram conversion, no floating-point drift, blank/zero distinction, reason validation and disabled double submit. — 3cddf37
- [x] 4.3 Draft/history tests prove failed-save retention, stable retry UUID, location isolation, later additions, readback, void visibility and correct nonmixed totals. — 3cddf37
- [x] 4.4 Frontend build, lint and Vitest pass with the selected control and PL/EN copy. — 3cddf37

#### Manual

- [ ] 4.5 At 320/375 px and desktop widths the selected form works with keyboard/touch, readable labels, visible focus and no horizontal overflow.
- [ ] 4.6 Auth-on disposable-Postgres browser verification covers one incident, a daily batch, later additions, network-error retry and void/add correction with both roles.

### Phase 5: Review, product verification and deployment proposal

#### Automated

- [x] 5.1 Plan/implementation reviews have no unresolved critical issues and the final diff touches only the agreed scope. — 35fea08
- [x] 5.2 Product checks pass: backend Ruff and pytest; frontend build, lint and Vitest; disposable Postgres integration. — 35fea08
- [x] 5.3 Deployment proposal identifies exact commit, additive migration, backend/frontend verification, rollback and pending real-period acceptance without claiming production was changed. — 35fea08

#### Manual

- [ ] 5.4 Ben has approved the concrete production release; the migration and both deployed artifacts are verified after execution.
- [ ] 5.5 A real-period pilot confirms usable entry, correct saved quantities/reasons, later additions, period readback and reduced manual transcription; operational state and next step are recorded.
