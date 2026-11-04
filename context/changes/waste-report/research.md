---
date: 2026-11-04T21:42:33+01:00
researcher: Codex
git_commit: 02a0930e09e09648a0e75dfb22f1cb1d96006144
branch: codex/supply-v2-waste-report
repository: pita-supply-os
topic: Supply OS v2 digital waste report and one additional menu destination
tags: [research, codebase, waste-report, captain, supabase]
status: complete
last_updated: 2026-11-04
last_updated_by: Codex
---

# Research: Digital waste report

## Research question

Start Supply OS v2 with the waste report described in https://trello.com/c/3RCu00Ng, using the existing paper form and one additional menu destination. Follow the repository's 10x workflow in sequence.

## Summary

The current main branch has no waste-report application feature. The original paper form was fetched through the connected Drive tool on 2026-11-04 and confirms 17 products in three sections, kg/pieces, dated columns, totals, Other and a signature field. The source card has no attachments or comments. Its requested operational standard, including weighing and reasons, is work to establish rather than evidence of an agreed standard.

The smallest complete module needs a fourth Captain navigation button, one form accepting one or several loss entries, durable storage, reliable readback and a way for a Manager to read period/location data. Waste records must remain separate from stock snapshots and supplier ordering. No automatic GoStock matching or conversion is justified by the available evidence.

## Confirmed user decisions

- 2026-11-04: start with the 17 products in the paper form; boxes are deferred.
- 2026-11-04: allow both entry during the shift and batch entry; make it easy to append. User wording: "Moze zrobić tak i tak i łatow moze dopisać + coś tam zrób to sprytnie i latwo wygodnie, minimalistycznie, zasada pareto".
- One additional menu destination, following the existing application style.
- This is a new isolated change, not a continuation of the old feedback branch.

## Sources and evidence boundaries

- [Trello task](https://trello.com/c/3RCu00Ng), read 2026-11-04: digital entry, analysis-ready data, eventual GoStock comparison, operational validation on a real period. It does not specify an accepted export/import contract.
- [Arkusz Strat.pdf](https://drive.google.com/file/d/1uA_YcqC9cVmaOIcKLa66KG3EIQN_kGiw/view), text fetched 2026-11-04: authoritative paper product labels and units. The fetched metadata reports a 2024 template. This review inspected extracted text, not a rendered layout or a current filled-in report.
- `/Users/ben/Desktop/Jarvis/JARVIS V2/JARVIS-CODEX/docs/handoffs/2026-09-06-raport-strat-supply-os/CZYTAJ-TO.md` and its sanitized JSON artifacts: operational context and one historical Ken reader example. That example has six quantities but no certain business date or source-derived location; it is not a new live validation.
- Current code at `origin/main` commit `02a0930e09e09648a0e75dfb22f1cb1d96006144`. The original checkout was on `claude/feedback-1001-names-units`; it has not been switched or edited.
- `context/changes/porzadek-2026-10/plan.md:68` previously deferred WP19 and the adjacent GoStock export. The present request starts WP19; it does not activate all adjacent work.

## Paper catalog

Preserve the paper unit independently of purchase-pack sizes printed in a product label. The historical reader's stable IDs are useful identifiers, not proof of a GoStock mapping.

| Section | Stable paper SKU | Paper label | Unit |
| --- | --- | --- | --- |
| Fridge | avocado | Awokado | szt |
| Fridge | tomato | Pomidor | kg |
| Fridge | arugula | Rucola na KG | kg |
| Fridge | salad_mix | Mix sałat na KG | kg |
| Fridge | feta_block | Feta blok | kg |
| Fridge | halloumi_reha | Halloumi REHA 200g/12 | szt |
| Fridge | tirokafteri_8kg | Tirokafteri pojemnik 8 kg | kg |
| Fridge | tzatziki_5kg | Tzatzyki pojemnik 5 kg | kg |
| Freezer | falafel_1kg | Falafel 1 KG | kg |
| Freezer | fries_aviko_2_5kg | Frytki Aviko 2,5 KG | kg |
| Freezer | sweet_potato_fries_2_27kg | Frytki z batatów Avico 2,27 KG | kg |
| Freezer | gyros | Gyros | kg |
| Freezer | pita | Pita | szt |
| Freezer | souvlaki_chicken | Souvlaki Kurczak | szt |
| Freezer | souvlaki_pork | Souvlaki Wieprz | szt |
| Dry store | chickpea_mix | Gotowy Mix Cieciorka | kg |
| Dry store | barley_mix | Gotowy Mix Pęczak | kg |

The paper also has Other rows. Keeping an explicitly labelled Other entry does not expand the fixed catalog or establish a mapped SKU. Scope confirmation below makes this distinction explicit.

## Frontend findings

- `frontend/src/pages/captain-mp/components/CaptainTabs.tsx:11`: shared navigation currently has Zamówienia, Historia and Remanent. Add one destination here; there is no tile dashboard to rebuild.
- `CaptainTabs.tsx:30`: the fallback marks every other route as Orders. Exclude the waste subtree and keep exactly one active destination.
- `CaptainTabs.tsx:32`: four full labels in one flex row may overflow a narrow phone. Verify 320/375 px and preserve focus visibility and `aria-current`.
- `frontend/src/App.tsx:58`: Captain routes use `AuthGate role="captain"`. Manager readback needs the existing Manager gate, not a Captain token workaround.
- `frontend/src/pages/captain-mp/components/HamburgerMenu.tsx:13`: a separate callback-based menu exists. The requested additional permanent button does not require changes to every Header caller.
- `frontend/src/apiClient.ts:174`: reuse the typed request wrapper, role token selection and errors. Captain inventory methods at `:401` and Manager methods at `:530` show the conventions. All new calls belong here.
- `frontend/src/types.ts:200` and `frontend/src/i18n/strings.ts:1`: mirror Pydantic contracts and keep user copy in PL/EN keys.
- `frontend/src/components/ui/DecimalInput.tsx:66`: reuse Polish decimal handling, but validate the final displayed input. Invalid raw text currently leaves the last valid numeric value in parent state. An old number must not be submitted behind invalid visible text; `min` on a text input is not enforcement.
- `frontend/src/pages/captain-mp/InventoryCountPage.tsx:229`: existing draft persistence saves only after actual entry. If a draft is retained for this module, use a separate, Captain-scoped key, preserve it on errors and clear only after confirmed persistence. Do not copy stock/prefill logic.
- `frontend/src/pages/captain-mp/InventoryHistoryPage.tsx:41`: reuse loading/error/readback patterns. Waste history should retain the loss catalog identity and unit rather than reinterpret old entries through today's purchase catalog.

## Backend and data findings

- `supply-os-v1/app/main.py:835`: all persistence goes through `_choose_backend()`; the selected module is Supabase, Sheets or seed. The plan must explicitly define the new methods' behavior on each adapter and avoid a successful response for a non-durable production write.
- `supply-os-v1/app/auth.py:52`: derive Captain location from the verified token. Never trust a submitted location. Manager access uses `require_manager()` at `:88`.
- `supply-os-v1/app/main.py:3964`: inventory detail supplies the established 404 behavior for both missing and other-location records. Preserve the same non-disclosure behavior.
- `supply-os-v1/app/models.py:962`: typed header/line inventory models are a shape reference. Waste quantities must not become inventory counts or change suggestion/prefill behavior.
- `supply-os-v1/app/main.py:3623`: existing inventory validation uses Warsaw business dates and rejects future dates. Determine date once per submitted batch; keep business date separate from the creation timestamp.
- `supply-os-v1/app/supabase_backend.py:663`: reuse an explicit transaction for header/lines. Do not copy inventory's independently committed header and lines at `main.py:3349`; a failed line write must leave no partial report.
- `supply-os-v1/app/main.py:4170`: Manager list/detail conventions exist, but a newest-20 browsing limit is not complete period coverage. A period report/export must include all matching records or expose pagination honestly.
- `supply-os-v1/migrations/0002_rls_deny_all.sql` and `0014_inventory_count_edit.sql:47`: new transactional tables need database constraints and deny-all RLS for public access, matching the privileged server connection design.
- The latest migration in the researched main is `0031_delivery_window_and_pack_suffix.sql`. Recheck the next available number immediately before implementation. Migration must be applied before dependent code is deployed.

## GoStock mapping limitation

`Product.gostock_id` exists at `supply-os-v1/app/models.py:56`, but no accepted mapping from the paper IDs or loss units was found. Seed examples differ: Rucola and salad are packs (`docs/pita-supply-os-v1/seed/products.csv:8`), fries are pieces (`:22`), pita is packs (`:27`), and souvlaki is kg (`:28`). These examples are local seed evidence, not a production-data audit. Prepared chickpea/barley mixes must not be equated with purchased raw ingredients.

Store the original paper SKU, quantity and unit. Any later GoStock reconciliation requires reviewed SKU mapping and conversions. No prices, monetary loss estimates or cross-unit totals can be inferred here.

## Proposed product shape for confirmation

Recommendation: one module and one entry flow, with no separate daily/live modes.

1. A fourth Captain button, Raport strat, opens the module.
2. Date defaults to today in Warsaw. The Captain's location comes from auth.
3. Add one or several rows: product, quantity with a visible unit, and reason. Use the existing catalog, grouped as on the paper. An explicit Other row carries its own description and unit; it never silently becomes a catalog item. Boxes remain deferred.
4. Save any number of completed rows together. A later save appends more entries for the same day; it does not overwrite earlier entries. The form works equally for one event during a shift or a batch at the end of a day.
5. Readback shows saved entries and sums each product in its own unit over a day/week. Keep reasons visible; do not collapse them into an unexplained net quantity. Missing submissions are not zero-loss days.
6. A Manager can filter by location/date and read/export the original entries for analysis. This is data access, not a GoStock import or an automated consumption calculation.

Alternatives considered: a single replaceable daily sheet is familiar but makes later additions and concurrent changes fragile; two separate entry modes duplicate controls and validation. Appendable entries provide both requested workflows with one form.

Before implementation the plan must settle correction/audit behavior, retries after an uncertain response, permitted precision for pieces, a no-loss-day declaration if needed, and whether the minimal Other row is included. A single proposed set of defaults should be reviewed with the user; do not invent established operational rules for Natalia, Sławek or Sebastian.

## Verification required by the implementation plan

- Navigation destination and active-state tests (`CaptainTabs.test.tsx:18`), PL/EN copy and narrow-phone layout.
- Catalog/quantity/reason validation, decimal commas and invalid visible input; empty versus explicit zero; batch and later append behavior.
- Request role/token tests (`apiClient.test.ts:57`), Captain location isolation, Manager-only cross-location access, missing-token failures.
- Retained form data after failed saves; duplicate-safe retries; persisted readback and correction audit.
- Atomic Postgres writes, database constraints/RLS, and full period coverage. Extend the disposable-DB integration schema/cleanup lists in `supply-os-v1/tests/test_supabase_integration.py:53`. Never run its destructive fixtures against production.
- Product verification: backend Ruff + pytest, frontend build + lint + Vitest, and Postgres integration on an isolated database. `.github/workflows/ci.yml` actually runs these product checks.
- A real-period operational example remains a rollout acceptance gate; the historical Ken reader sample does not satisfy it.

## Current state and exact next step

Completed: isolated change initialization; Trello and paper-source verification; frontend/backend research; two user decisions recorded. No application code, production database, runtime, supplier order or staff communication changed. No application tests were run for this documentation-only step.

Update after the planning request: Ben selected option B with additive tiles on every tap and manual entry. He approved the four plan-review fixes and requested autonomous E2E implementation. `reviews/plan-review.md` records REVISE → SOUND; `api-contract.md` defines shared fields. The supplied private Pita MCP package has 30 matching file hashes/unique source identities and 632 extracted cells; the sanitized analysis and catalog are in this folder. Terra 6.1 medium recalculated coverage, excluded uncertain units and retained sparse products as provisional. No source images or message identities enter Git. Signed-in Telegram downloads remain prohibited; no new retrieval was needed.

Current execution: backend and frontend implementation underway on the isolated lane, with test-first focused coverage. Clean baseline: backend 1232 passed / 41 deselected; frontend 1289 passed. Disposable local Postgres16 is available for integration and auth-enabled browser E2E. Next: complete implementation/review/product checks, record actual evidence, then propose the concrete migration + backend + frontend deployment for separate approval. A real-period pilot and production acceptance remain pending; archive only after accepted completion evidence exists.
