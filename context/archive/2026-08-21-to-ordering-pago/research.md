---
date: 2026-08-21T22:30:00+02:00
researcher: Claude (Fable 5 orchestrator + 4 research subagents)
git_commit: 525e6c59e4c429b10ff530887914b5f636579af9
branch: claude/multi-location-master-data
repository: 10xDEVS (Pita Supply OS)
topic: "Manager TO Ordering for Pago — aggregate location orders into one Pago order + usage (zużycie)"
tags: [research, codebase, pago, to-ordering, aggregation, warehouse, dispatch, manager]
status: complete
last_updated: 2026-08-21
last_updated_by: Claude (Fable 5)
---

# Research: Manager "TO Ordering" for Pago

**Companion artifact:** `research-spreadsheet.md` (full analysis of the legacy Google Sheet "Ordering PB v5 prod", read 100%). This file synthesizes that + three codebase/history probes.

## Research Question

Add Manager-side "TO Ordering" for Pago: collect submitted location orders, combine them into ONE aggregated PAGO order, and record the per-location quantities as usage (zużycie). Replace (incrementally) the legacy "Ordering PB v5 prod" spreadsheet flow.

## Summary

1. **The legacy process is a warehouse pickup-and-distribution run, not an email order.** One operator picks a city (or ad-hoc city group), enters per-product-per-location quantities in a grid, then generates TWO documents: a Pago **self-pickup order** (`ODB-*`, Pago catalog codes, issued under the "The Greek Gourmet" legal entity) and a **driver transport/picklist** (`DRV-*`, per-location breakdown). Only the transport draft decrements stock — `ISSUE_AUTO` rows in `STOCK_MOVEMENTS`. **"Zużycie" in practice = what was issued to locations** (the per-location quantities of the run), not POS consumption. The words "zużycie/rozchód" never appear in the sheet; the stock formula (`Expected Stock = Opening + Receipts + Adjustments − Issues`) is documented but not actually populated (always 0.0).
2. **The app has NO equivalent for any of the aggregation half**: no multi-order combine, no per-city/multi-location order, no driver plan, no self-pickup channel, no stock ledger. `Order.location_id` is a single required field; dispatch (`gmail_url.py` + FE `emailBody.ts`) assumes one location. This is the PRD's parked non-goal "Pago internal warehouse pipeline" — this change un-parks it.
3. **Pago's in-app dispatch has never worked** (`suppliers.email = 'TBD'` since v0; the "@" gate blocks Gmail dispatch). Real Pago ordering lives entirely in the legacy sheet. `SUP_PAGO` exists with 20 `supplier_products` rows in the seed fixture and is the default test-fixture supplier.
4. **City vs location:** legacy aggregates by CITY (WAW/POZ/GDN/KRK/KTW → 13 locations, up to 8/city); the app models LOCATIONS only, `locations.city` data is dirty, and the operator already ruled city-level modeling out once (supplier-per-location decision). The legacy sheet's own city grouping is inconsistent operator judgment (`KRK + KTW`, `WAW + GDN`, solo runs). ⇒ Aggregation should be **over a Manager-selected set of orders**, not over a hard city dimension.
5. **The sheet conflates suppliers:** the same grid/driver run carries BUKAT/MEZE/MORY products alongside PAGO; only PAGO lines reach the `ODB-*` Pago document. MEZE and MORY are not modeled in the app at all. A faithful v1 replacement scopes to the PAGO order + per-location breakdown and leaves multi-supplier driver-run consolidation explicit future work.
6. **Only WOLA has ever ordered through the app** (86 orders; BRACKA/NORBLIN/KEN: 0). The legacy sheet's locations (Forum, Supersam, Stary Browar, Kamienica Kulinarna, Słony Spichlerz…) are exactly the ones being onboarded inactive by the in-flight `multi-location-master-data` lane. TO Ordering's "collect submitted location orders" premise depends on those locations actually submitting via the app — or on the Manager being able to enter/represent a location's quantities himself.

## Detailed Findings

### Legacy flow (source of truth for the feature)

See `research-spreadsheet.md` §1–§4 for the full tab inventory, flow, and data model. Load-bearing facts:

- Flow: check cities → "Odśwież widok roboczy" (Apps Script) → fill ORDER_INPUT grid (product × up-to-8 locations, purchase units, whole numbers) → set driver/vehicle/pickup date+time → `createPagoDraft` (ODB doc, no stock effect) → `createTransportDraft` (DRV doc + stock issues posted).
- `Razem` = plain sum across location columns; no unit conversion, no rounding, no prices anywhere in the workbook.
- Unexplained `PROD` column = exactly `2 × Razem` (open question for operator).
- Transport weight guardrail: `Limit kg` (700) vs `Łączna waga kg` — no per-product weights visible; likely Apps Script/manual. No app equivalent.
- Pago order doc uses **Pago catalog codes** (`GYRSW15KG`, `SUVKUR5kg`, `PITTA018`…), present for only 8/24 products; issued as "Zlecenie odbioru własnego" under "The Greek Gourmet Małgorzata Kubiak-Vafidis" (NIP 5222467646) — a different legal entity than the location companies used in the app's email footer.
- Distribution: two parallel recipient lists per city (PAGO list incl. Lineage logistics addresses; TRANSPORT/driver list) — the app has one `supplier.email` + one global CC.
- Audit trail today is denormalized free text (ORDER_LOG `Snapshot`, STOCK_MOVEMENTS `Signature`); per-location quantities are never persisted in a normalized table — the app's structured `order_lines` history is strictly better and is the natural replacement.

### Backend seams (supply-os-v1/)

- `_choose_backend()` at `app/main.py:357-369`; `_is_persistent()` at `app/main.py:372-381`. Seam contract = module-level function set; NO Protocol class — convention + tests enforce it.
- **New-entity recipe (precedent: inventory_counts S-06, receipts GR-01):** model in `app/models.py` → numbered migration in `supply-os-v1/migrations/` (`0009_…` next) → `_COLUMNS` list in `supabase_backend.py` (`supabase_backend.py:82-135` pattern; date/timestamptz cols registered at `:141-149`) → identical `load_*/append_*/get_*/update_*` functions in BOTH `sheets.py` and `supabase_backend.py` → wire migration into `tests/test_supabase_integration.py` fixture (lesson at `test_supabase_integration.py:90`).
- **Cross-order read precedents:** `manager_queue` (`main.py:801-935`) — multi-order list + targeted `load_order_lines_for_orders(order_ids)`; `_aggregate_suggestion_review` (`main.py:2508-2562`) — pure roll-up of order_lines grouped by product_id, with its own test file `tests/test_suggestion_review.py` (the template for testing a new aggregation). Neither groups by location_id; neither persists an aggregate.
- **Order lifecycle:** `draft → captain_submitted → manager_claimed → manager_sent → closed` (+ `cancelled`); atomic transitions via `update_order(..., expected_status=...)` (Supabase conditional UPDATE; Sheets preflight+guard). Any "consume these orders into a TO" transition must use the same guard pattern.
- **Dispatch constraints:** `manager_dispatch` (`main.py:1633-1781`) is strictly single-order/single-location; `gmail_url.py` subject/body/address assume one `Location`; 8000-char URL cap (`gmail_url.py:23`); FE mirror `frontend/src/pages/manager/lib/emailBody.ts` must stay byte-identical; email gate requires "@" in supplier email (`main.py:1680-1687`) — Pago is `TBD`.
- **Usage/zużycie:** nothing exists. Closest vocabulary precedent: `scripts/reconcile_inventory.py` parses "Magazyn | Wydawka" from the Inwentaryzacja sheets (offline CLI, not wired to the API).
- **Tests:** `tests/conftest.py` forces seed backend + blank creds; endpoint tests patch the `sheets` module (`_enable_sheet_backend` helper pattern, `tests/test_manager_queue.py:140-179`); `SUP_PAGO` is the default fixture supplier; integration tests marked `integration`, excluded by default, run in CI against real Postgres.

### Frontend seams (frontend/)

- Manager area = one route per sub-view in `App.tsx` (`/manager`, `/manager/inventory`, `/manager/suggestion-review`), each wrapped `<AuthGate role="manager">`; nav links in `ManagerPage`'s AppHeader. **Template for a new screen: `ManagerInventoryPage.tsx`** (master-detail, 256 lines).
- API calls only via `apiClient.ts` `api` object (manager funcs `apiClient.ts:357-422`); types in `types.ts`; i18n = flat `STRINGS` map in `src/i18n/strings.ts` with `{pl,en}` per key, `t()`/`tPlural()`; new keys under `manager.toOrdering.*`.
- Reusable pieces: `statusVisual()` (status pills), `components/ui/number.ts` (decimal parse/format), `lib/orderQty.ts` `effectiveOrderedQtyPurchase()` (manager_final>0 else captain_final — the same rule the receiving flow and email builder use), `DispatchPanel.tsx` channel branching (email/portal/phone/manual UI language to imitate).
- Vitest: co-located `*.test.ts`, pure-helper tests with minimal factories; no component/E2E harness.

### Product/history constraints

- PRD Non-Goals names this exact module as parked: "Pago internal warehouse pipeline — master-ordering Excel aggregation, warehouse email, driver delivery plan" (`context/foundation/prd.md:287`; `roadmap.md:291` Parked).
- DATA_MODEL.md: `orders` = one row per (location, supplier, order_date); no aggregate/usage entity even as a placeholder; "Phase 2 … Manager Dashboard consolidates across [locations]" is the only forward hint (`DATA_MODEL.md:82-84`).
- Supplier-per-location lane decision (2026-08-20): dimension hangs on LOCATION, not city — city modeling explicitly rejected once already.
- Prod reality: 4 active locations (WOLA/BRACKA/NORBLIN/KEN, Warsaw); 7 more being onboarded inactive via `multi-location-master-data` (incl. all legacy-sheet cities); only WOLA has order history. Seed fixture ≠ prod (documented divergence).
- Master-data ops lesson: any prod master data (e.g. real Pago email, Pago catalog codes, MEZE/MORY suppliers) is a gated diff→apply→audit batch, never implicit in a feature deploy.

## Architecture Insights

- The app-native reframing of the legacy flow: **Captains submit per-location Pago orders (existing flow) → Manager's TO Ordering screen lists them → Manager selects + combines into one persisted aggregate ("TO") → the TO carries per-product totals WITH per-location breakdown → the breakdown IS the usage record (normalized replacement of STOCK_MOVEMENTS/ISSUE_AUTO) → source orders transition out of the queue atomically.**
- The per-location breakdown must be first-class in the TO's data model (not recomputed), because it serves three consumers: the driver breakdown, the usage/zużycie record, and the receiving/audit trail.
- A TO is NOT an `Order` — forcing it into `orders` would break the single-`location_id` contract, the queue lanes, receipts, and dispatch. New entities behind the seam (the S-06/GR-01 recipe) are the established path.
- Aggregation should be selection-based (Manager picks the orders to combine), mirroring the operator's real behavior (ad-hoc city grouping), rather than encoding a city dimension the operator already rejected.
- Dispatch of the TO in v1 cannot rely on the email channel (Pago email TBD; multi-location body format undefined; URL cap). A copy/print-friendly aggregated view (like DispatchPanel's portal/manual channels) is the low-risk v1 output; a real ODB-style document/email is a follow-up + master-data batch.

## Code References

- `supply-os-v1/app/main.py:357-381` — `_choose_backend()` + `_is_persistent()`
- `supply-os-v1/app/main.py:801-935` — manager_queue (multi-order enriched list)
- `supply-os-v1/app/main.py:2508-2589` — suggestion-review aggregation precedent
- `supply-os-v1/app/main.py:1633-1781` — manager_dispatch (single-order assumption)
- `supply-os-v1/app/gmail_url.py:23,33-57,115-141,204-208` — single-location email format + 8000-char cap
- `supply-os-v1/app/models.py:18-24,148,527-549,678-720` — OrderStatus, Order.location_id, InventoryCount/Receipt entity templates
- `supply-os-v1/app/supabase_backend.py:82-149,230-259` — column-map pattern for new entities
- `supply-os-v1/migrations/0001_initial_schema.sql` (+ `0003`–`0008`) — migration conventions; next free number 0009
- `supply-os-v1/tests/test_manager_queue.py:140-179` — `_enable_sheet_backend` endpoint-test pattern
- `supply-os-v1/tests/test_suggestion_review.py` — aggregation endpoint test template
- `supply-os-v1/tests/test_supabase_integration.py:90` — wire every new migration into the integration fixture
- `frontend/src/App.tsx:109-132` — manager route pattern
- `frontend/src/pages/ManagerInventoryPage.tsx` — new-screen template
- `frontend/src/apiClient.ts:357-422`, `frontend/src/types.ts:309-453`, `frontend/src/i18n/strings.ts:752-820` — FE extension points
- `frontend/src/pages/manager/DispatchPanel.tsx`, `frontend/src/pages/manager/lib/emailBody.ts` — channel UI + email mirror
- `docs/pita-supply-os-v1/seed/suppliers.csv:10` — `SUP_PAGO,…,TBD,email,Tue,14:00`

## Historical Context (from prior changes)

- `context/foundation/prd.md:287` + `context/foundation/roadmap.md:291` — the parked non-goal this change un-parks.
- `context/changes/supplier-per-location/change.md` — location-not-city decision; `source_supplier_id` pin.
- `context/archive/2026-07-15-feedback-r4-suppliers-master-data/change.md` — Pago email still TBD; 'TBD' emails silently killed dispatch (origin of the "@" gate).
- `context/changes/multi-location-master-data/` — prod location roster, 7 new locations onboarding, per-location sheet reconciliation; overlaps this lane's location premise.
- `docs/pita-supply-os-v1/MANAGER_DASHBOARD_SPEC.md:154-161`, `BRIEF.md:94-100` — multi-location/multi-supplier consolidation explicitly postponed in v0.

## Related Research

- `context/changes/to-ordering-pago/research-spreadsheet.md` — full legacy-sheet analysis (tabs, flow, data model, 17 quirks, mapping table).
- `context/changes/multi-location-master-data/research.md` — prod vs sheets reconciliation.

## Open Questions

1. **`PROD` column = 2× Razem** in the legacy grid — meaning unknown (buffer? broken formula?). Operator input needed; v1 should NOT replicate it blindly.
2. **Order sourcing for non-app locations**: legacy lets ONE operator enter all locations' quantities; the app needs Captains to submit per location (only WOLA ever has). Does v1 need a Manager-entered "order on behalf of a location", or is "combine whatever orders exist" enough to start?
3. **TO output channel**: what does Pago actually need to receive in v1 — a printable/copyable list (catalog codes?), an email (address needed — gated master-data batch), or is the legacy sheet's PDF+mail kept for the handoff period?
4. **Scope of products**: PAGO-only lines in the TO, or also the BUKAT/MEZE/MORY lines the legacy driver run carries (MEZE/MORY are not in the app's supplier catalog at all)?
5. **Pago catalog codes** (`PAGO NrKat`) — are they required on the v1 output? If yes: is `supplier_product_name` sufficient or is a dedicated external-SKU field needed (master-data batch either way)?
6. **Weight limit / driver plan / The Greek Gourmet letterhead / dual recipient lists** — legacy capabilities with no app equivalent; assume out of v1 unless the operator says otherwise.
7. **"Import PB v5 prod" workbook** (true stock source) is outside this dump — irrelevant if usage = per-location issued quantities, but relevant if the operator expects a stock ledger.
