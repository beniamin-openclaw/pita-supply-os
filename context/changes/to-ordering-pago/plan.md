# Manager Transport (Pago) Implementation Plan

## Overview

Give the Manager a "Transport" workspace that collects submitted per-location orders for one supplier (Pago first; Bukat for outside-Warsaw pickups), combines a selected set of them into one aggregated pickup order (a Transport batch), and durably records the per-location quantities — the zużycie/usage record — replacing the aggregation + consumption-recording halves of the legacy "Ordering PB v5 prod" Google Sheet.

Operator clarification (2026-08-21, mid-plan): a Transport run has TWO distinct outputs — (a) the **private driver list** (per-product × per-location breakdown; internal only, never sent to the supplier) and (b) the **supplier order** (per-product totals only, like the legacy ODB doc), which MUST be emailable to the supplier's proper address. Outside Warsaw, Bukat does not deliver — Bukat goods are picked up the same way, so the combine flow must work for Bukat too (it does: the logic is supplier-generic; one physical run = one Transport batch per supplier).

## Current State Analysis

- The app is strictly one-order-per-(location, supplier); nothing combines orders. Closest precedents: `manager_queue` (multi-order enriched list, `supply-os-v1/app/main.py:801-935`) and the pure roll-up `_aggregate_suggestion_review` (`main.py:2508-2562`).
- Pago (`SUP_PAGO`) exists in master data with `ordering_method=email` but `email='TBD'` — the in-app email dispatch path has never worked for Pago; real Pago ordering lives in the legacy sheet (self-pickup `ODB-*` doc + driver `DRV-*` doc; only the transport draft decrements stock — the de-facto zużycie).
- `Order.supplier_order_reference` is an idle nullable field present end-to-end: `models.py:158`, Supabase `_ORDERS_COLUMNS` (`supabase_backend.py:107`), Postgres column (`migrations/0001_initial_schema.sql:99`).
- `sent_method` is a free string persisted at dispatch and never rendered by the frontend (verified: FE only sends it).
- Order lines are frozen once an order reaches `manager_sent` (captain edit gated to `captain_submitted`; manager save/add-line gated to `manager_claimed`) — so aggregation computed from `order_lines` of `manager_sent` orders reads immutable data.
- Full grounding: `research.md` + `research-spreadsheet.md` in this folder.

## Desired End State

- Manager opens `/manager/transport`, sees eligible Pago orders across locations (status `captain_submitted` or `manager_claimed`), selects some, sees a live aggregate preview, and creates a Transport batch.
- Each combined source order atomically transitions to `manager_sent` with `sent_method="transport"` and `supplier_order_reference=<transport_id>`; orders that fail their status guard are reported as skipped, never half-applied.
- Past Transport batches are listable; a Transport-batch detail shows per-product totals and the per-product × per-location breakdown (the usage record), with a copy-to-clipboard text block the Manager can paste to Pago (email/WhatsApp) until a real dispatch channel lands.
- Verify: backend pytest green (new endpoint + aggregation tests), FE build/lint/vitest green, preview screenshot of the new screen.

### Key Discoveries:

- `supplier_order_reference` is writable via the existing `update_order(**kwargs)` on both persistent backends — zero schema change needed (`sheets.py:489-546`, `supabase_backend.py:364-401`).
- `update_order(..., expected_status=...)` gives per-order atomic transitions (Supabase conditional UPDATE; Sheets preflight+guard) — the same guard every dispatch path uses.
- `load_order_lines_for_orders(order_ids)` exists in both backends (F-7) — the exact targeted read the aggregation needs.
- `tests/test_suggestion_review.py` is the template for aggregation tests; `_enable_sheet_backend` (`tests/test_manager_queue.py:140-179`) for endpoint tests.
- FE template: `ManagerInventoryPage.tsx` (route + AuthGate + header pattern), i18n keys appended to `src/i18n/strings.ts` (`{pl,en}` both required), API funcs in `apiClient.ts`, types in `types.ts`.

## What We're NOT Doing

- **No new tables, no migration** — the Transport batch is the set of orders sharing a `supplier_order_reference` marker (adversary-pair decision in `change.md`; escalate to a `transfer_orders` header table only when driver/vehicle/pickup-time/weight fields are actually requested).
- No PDF generation. The supplier email carries per-product TOTALS ONLY (the ODB-doc analog); the per-location breakdown is the private driver list and never enters the email.
- No driver route documents beyond the in-app per-location matrix (copy/print), no transport weight limit, no "The Greek Gourmet" letterhead, no dual recipient lists (one supplier email + the existing global CC).
- No single combined multi-supplier driver document: one physical pickup that includes Pago AND Bukat goods = two Transport batches (one per supplier), each with its own driver breakdown — accepted v1 simplification, revisit if the operator wants one merged driver doc.
- No prod master-data write of Pago's real email inside this lane — sending Pago Transport emails is BLOCKED until the operator supplies the address and it lands via a gated master-data batch (Bukat's email already works). The UI shows a disabled email button with a clear hint for a supplier whose email is missing/placeholder (mirrors the backend "@" gate).
- No stock ledger / Import PB integration — zużycie v1 = the per-location line quantities of each Transport batch.
- No new `OrderStatus` enum value; no changes to receipts (locations keep receiving against their own orders — desired behavior).
- No Manager-creates-order-on-behalf-of-location (open operator question; combine works on whatever orders exist).
- No replication of the legacy `PROD = 2×Razem` column (meaning unknown — operator question).
- No prod master-data writes of any kind in this lane (no Pago email fix, no MEZE/MORY suppliers, no catalog codes) — those are separate gated batches.

## Implementation Approach

Marker-column aggregation (variant A′ from the adversary pair): the "combine" action is N per-order guarded status transitions stamping a shared `transport_id` into `supplier_order_reference`; everything else is read-time aggregation over frozen `order_lines`, shaped like `_aggregate_suggestion_review`. Backend logic is supplier-generic (`supplier_id` is a parameter); the UI defaults to Pago. TDD: write the failing test first in every step (pure aggregation tests, endpoint tests via the sheet-mock pattern, FE pure-helper tests).

## Critical Implementation Details

- **Claim-first transition path (race defense).** Create must accept orders in `captain_submitted` or `manager_claimed`, and for a `captain_submitted` order perform TWO guarded writes: `update_order(status=manager_claimed, expected_status=captain_submitted)` then `update_order(status=manager_sent, sent_method="transport", supplier_order_reference=transport_id, manager_user="manager-default", manager_sent_at=now, expected_status=manager_claimed)`. The per-order loop catches **BOTH** `errors.OrderStatusConflictError` (Supabase 0-row conditional update) **AND** `errors.OrderAlreadyDispatchedError` (the Sheets dispatch guard) — mirroring `manager_dispatch`'s pair catch at `main.py:1774`; either ⇒ that order goes to `skipped[]` with a reason and is NOT retried silently. Note the Sheets asymmetry (verified): `sheets.update_order` never raises `OrderStatusConflictError` — the claim step's TOCTOU protection on Sheets is the route-level `invalidate_cache("orders")` + re-read + status check (the same pattern `manager_claim` uses), while the send step additionally trips the sheets dispatch guard on an already-`manager_sent` order. An order that claimed but failed the second write is released back (best-effort `status=captain_submitted, expected_status=manager_claimed`) and reported skipped. There is deliberately NO cross-order transaction — the design makes partial success safe (a Transport batch is just the marker set; a skipped order simply isn't in the batch) instead of pretending N-order atomicity Sheets can't give.
- **Route naming (collision-proof, follows the counts/count/{id} precedent).** FastAPI matches in registration order and does NOT prioritize literals over path params, and this codebase deliberately avoids same-segment literal-vs-param routes. Use distinct literals: `GET /api/manager/transport/eligible`, `GET /api/manager/transport/batches` (list), `GET /api/manager/transport/batch/{transport_id}` (detail), `POST /api/manager/transport/create` — no route shares a segment shape with `batch/{transport_id}`, so registration order cannot break anything.
- **Marker format & reverse link.** `transport_id = f"TRN-{YYYYMMDD}-{SUP4}-{6hex}"` (mirrors `_generate_order_id`, `main.py:471-477`). The marker on the order row IS the Order→Transport reverse link; expose it on `ManagerQueueItem` and `ManagerOrderDetail` (additive optional field) so the sent lane can show a "TRN" chip instead of a fake email dispatch.
- **Effective quantity rule.** Aggregation uses manager_final if > 0 else captain_final per line — the exact `gmail_url._effective_qty` / `orderQty.effectiveOrderedQtyPurchase` rule; do not invent a new one. Zero-qty lines are excluded from totals (mirrors the email builder skipping zero lines).
- **Sheets divergence note.** `sheets.update_order` silently skips columns absent from the worksheet header; if the prod-era `orders` tab lacks `supplier_order_reference`, the marker is dropped on the Sheets backend. Prod runs Supabase, so this is documented divergence (docstring), not a blocker — same class as the existing atomicity divergence note in `replace_order_lines_atomic`.
- **Seed-mode degradation.** All new GET routes return `[]`/404-style empties like `manager_queue`; POST create returns 503 like the other manager writes (`_is_persistent` gate).

## Phase 1: Backend read side — eligible list, aggregation, batches list/detail

### Overview

Pure/read-only foundation: the aggregation function and the three GET endpoints, test-first.

### Changes Required:

#### 1. Pure aggregation helper + models

**File**: `supply-os-v1/app/main.py` (helper + response models in `supply-os-v1/app/models.py`)

**Intent**: A pure function that turns a set of orders + their frozen lines into the Transport aggregate: per-product totals and the per-product × per-location breakdown, joined with product/supplier_product/location display data server-side (names, purchase units) so the FE needs no lookup tables. Sorted by product name for a stable copyable list.

**Contract**: `_aggregate_to_lines(orders, lines, products_by_id, sps_by_id, locations_by_id) -> list[TransportAggregateLine]` where `TransportAggregateLine` = `{product_id, product_name_pl, supplier_product_id, supplier_product_name, purchase_unit, total_qty_purchase, per_location: list[{location_id, location_name, order_id, qty_purchase}]}`. Effective qty = manager_final>0 else captain_final; zero-qty lines dropped; same product from the same location in two source orders yields two `per_location` entries (kept separate for auditability), summed in the total. New Pydantic models: `TransportAggregateLine`, `TransportLocationQty`, `TransportEligibleOrder` (compact order row + line_count + total), `TransportBatchSummary` (transport_id, supplier, created/sent timestamps, order_count, location_ids), `TransportBatchDetail` (summary + orders + aggregate lines).

#### 2. GET eligible orders

**File**: `supply-os-v1/app/main.py`

**Intent**: List orders a Transport batch can combine: `status in (captain_submitted, manager_claimed)` for a given `supplier_id`, across all locations, newest-first, enriched with location/supplier names and per-order line_count + total (reusing the `manager_queue` load/enrich pattern with `load_order_lines_for_orders`).

**Contract**: `GET /api/manager/transport/eligible?supplier_id=...` → `list[TransportEligibleOrder]`, manager auth, seed mode → `[]`.

#### 3. GET Transport-batch list + detail

**File**: `supply-os-v1/app/main.py`

**Intent**: List past Transport batches (group loaded orders by non-null `supplier_order_reference` starting with `TRN-`, filtered to `supplier_id` when given; newest `manager_sent_at` first, capped like manager_queue) and serve one batch's detail (member orders + `_aggregate_to_lines` output — the totals AND the per-location usage record).

**Contract**: `GET /api/manager/transport/batches?supplier_id=&limit=` → `list[TransportBatchSummary]`; `GET /api/manager/transport/batch/{transport_id}` → `TransportBatchDetail` (404 when no order carries the marker); manager auth; seed mode → `[]` / 503. (Distinct literals per the route-naming note in Critical Implementation Details.)

### Success Criteria:

#### Automated Verification:

- `python -m pytest supply-os-v1/tests/test_transport.py` green — aggregation unit tests (effective-qty rule, zero-line drop, multi-order same-location, sorting) written FIRST and failing before implementation
- Endpoint tests green: eligible filtering by supplier+status, enrichment fields, seed-mode `[]`, list grouping by marker, detail 404, detail aggregate math
- `ruff check supply-os-v1/` clean
- Full backend suite `python -m pytest` (from `supply-os-v1/`) still green

#### Manual Verification:

- None (read-only endpoints; exercised in Phase 3 preview)

---

## Phase 2: Backend create — combine selected orders into a Transport batch

### Overview

The one write path: POST create with claim-first guarded transitions, per-order outcome reporting, and append-to-existing-batch recovery.

### Changes Required:

#### 1. POST create/append

**File**: `supply-os-v1/app/main.py` (+ request/response models in `models.py`)

**Intent**: Validate the selected orders (all exist, all belong to `supplier_id`, status eligible), then per order run the claim-first two-step transition stamping `sent_method="transport"` + `supplier_order_reference=transport_id` (see Critical Implementation Details). Generate `transport_id` unless `append_to` names an existing batch (same supplier required) — append is the recovery path when a previous create skipped orders. Respond with combined/skipped so partial success is always explicit.

**Contract**: `POST /api/manager/transport/create` body `{supplier_id, order_ids: list[str] (min 1), append_to: Optional[str]}` → `{transport_id, combined: list[str], skipped: list[{order_id, reason}]}`; manager auth; seed → 503; unknown supplier / empty ids → 400; `append_to` batch not found or supplier mismatch → 400. Preflight per order: `invalidate_cache("orders")` once, re-read, then guarded writes; `OrderStatusConflictError` ⇒ skipped entry, loop continues.

#### 2. Expose the marker on queue + detail

**File**: `supply-os-v1/app/main.py`, `supply-os-v1/app/models.py`

**Intent**: Add optional `supplier_order_reference` to `ManagerQueueItem` and `ManagerOrderDetail` so the sent lane and the order detail can distinguish a Transport-consumed order from a real email dispatch (devil's-advocate finding #3/#4/#5).

**Contract**: `ManagerQueueItem.supplier_order_reference: Optional[str] = None`, same on `ManagerOrderDetail`; populated from the order row in `manager_queue` and `manager_order_detail`. Additive only — no existing field changes (order_lines columns and status workflow untouched).

### Success Criteria:

#### Automated Verification:

- Create tests green (written first): happy path (captain_submitted and manager_claimed sources), guard-conflict → skipped with released claim, wrong-supplier 400, append_to happy + mismatch 400, seed 503, marker + sent_method + manager_sent_at persisted via the mocked backend
- Queue/detail tests updated: `supplier_order_reference` surfaced
- `ruff check` clean; full backend suite green

#### Manual Verification:

- None (exercised in Phase 3 preview)

---

## Phase 3: Frontend — /manager/transport workspace

### Overview

One new Manager screen: eligible orders with checkboxes + live aggregate preview → create → batch list + batch detail with per-location matrix and copy-to-clipboard text.

### Changes Required:

#### 1. Types + apiClient

**File**: `frontend/src/types.ts`, `frontend/src/apiClient.ts`

**Intent**: Mirror the new backend models (optionality matched to Pydantic — lesson: optional-with-default ⇒ `field?: T`) and add `api.toEligible / toCreate / toList / toDetail` following the manager function pattern.

**Contract**: New interfaces `TransportEligibleOrder, TransportLocationQty, TransportAggregateLine, TransportBatchSummary, TransportBatchDetail, TransportCreateResponse`; `ManagerQueueItem`/`ManagerOrderDetail` gain `supplier_order_reference?: string`.

#### 2. Pure helpers + tests

**File**: `frontend/src/pages/manager/lib/transport.ts` (+ `transport.test.ts`)

**Intent**: Client-side aggregate preview over selected eligible orders' summary data; the copyable driver-list text builder (PL: per-product totals + per-location breakdown — the PRIVATE internal document); and the supplier-email builder (subject + body with per-product TOTALS ONLY, no location breakdown — the ODB-doc analog) producing a Gmail compose URL via the same `mailto`/gmail pattern as `emailBody.ts` (`buildGmailComposeUrl`), respecting the 8000-char guard. Test-first, minimal-factory style like `emailBody.test.ts`.

**Contract**: `buildTransportDriverText(aggregate, t)`, `buildTransportEmailSubject/Body(aggregate, supplier, t)` (totals only), plus a small selection-summary helper; pure functions, no fetch. Email is only offered when the supplier's email contains "@" (mirror of the backend dispatch gate, `main.py:1680-1687`); otherwise the button is disabled with an i18n hint ("uzupełnij email dostawcy w master data"). **Multi-recipient support (operator decision):** `supplier.email` may hold a comma/semicolon-separated distribution list (Pago will use the legacy sheet's PAGO list once the gated master-data batch lands) — the builder splits it and passes all addresses in the Gmail compose `to` param (comma-joined); test this split explicitly.

#### 3. Page + route + nav + i18n

**File**: `frontend/src/pages/manager/TransportPage.tsx`, `frontend/src/App.tsx`, `frontend/src/pages/ManagerPage.tsx`, `frontend/src/i18n/strings.ts`

**Intent**: New route `/manager/transport` wrapped in `<AuthGate role="manager">` (App.tsx pattern at :117-124), nav link in ManagerPage's AppHeader beside inventory/suggestion-review, page templated on `frontend/src/pages/manager/ManagerInventoryPage.tsx`: a supplier picker (from `api.suppliers()`, default Pago; Bukat selectable for outside-Warsaw pickup runs), then two sections — "Do połączenia" (eligible list with checkboxes, live totals preview, Create button with busy state and skipped[] toast) and "Utworzone TO" (batch list → detail with: per-product totals table, the PRIVATE driver matrix per location with its copy button, an "Otwórz email" button building the supplier-order Gmail draft from totals to the supplier's master-data email — disabled with a hint when the email lacks "@", e.g. Pago's current `TBD` — and the source orders). A "TRN" chip on the manager queue's sent lane when `supplier_order_reference` starts with `TRN-` (small addition in `ManagerQueue.tsx` card chips). All copy via new `manager.transport.*` keys (pl+en).

**Contract**: Route + page + nav + strings only through established seams (apiClient, i18n); no fetch in components; number formatting via `components/ui/number.ts`.

### Success Criteria:

#### Automated Verification:

- `npm run test` green including new `transport.test.ts` (written first)
- `npm run build` green (TS strict) — use Homebrew node PATH if native rollup fails
- `npm run lint` green

#### Manual Verification:

- Preview: `/manager/transport` renders eligible seed/sheet-mock data, selection updates the live preview, create flow surfaces skipped[] when a guard trips, batch detail matrix matches source orders, driver-list copy button fills clipboard; screenshot saved
- Email button: enabled with a totals-only Gmail draft for a supplier with a real email (Bukat fixture); disabled with hint for `TBD` (Pago fixture) — never opens a draft to a dead address
- Manager queue sent lane shows the TRN chip on a combined order

---

## Testing Strategy

### Unit Tests:

- `_aggregate_to_lines`: effective-qty rule, zero-qty exclusion, multi-order same-location entries kept separate but summed, name-sorted output, missing master-data fallbacks (id shown when product/location missing)
- Create: every guard branch (see Phase 2), including released-claim on second-write failure, and BOTH exception types (`OrderStatusConflictError`, `OrderAlreadyDispatchedError`) mapping to skipped[]
- Existing-test sweep: check `test_manager_queue.py` / manager-detail tests for exact-dict (`== {...}`) response assertions that gain a `supplier_order_reference: None` key; `test_sheets_write.py` already round-trips `supplier_order_reference` (existing coverage for the marker write)
- FE helpers: driver-list clipboard format (PL, totals + per-location), email subject/body (totals only — asserts NO location breakdown leaks into the email), "@" gate on the email button, selection summary

### Integration Tests:

- None new against real Postgres (no schema change; existing `update_order` integration coverage applies). Do NOT touch `test_supabase_integration.py`.

### Manual Testing Steps:

1. Seed/sheet-mock two locations' Pago orders → combine → verify batch detail totals + per-location matrix
2. Trip a guard (dispatch one order in another tab first) → verify skipped[] reporting and that the order is untouched
3. Verify a combined order in the sent lane shows the TRN chip and its detail shows the reference

## Performance Considerations

All reads ride existing TTL caches and the targeted `load_order_lines_for_orders`. The batches listing groups over `load_orders()` (already the manager_queue cost); cap list at 50 batches. No new hot paths.

## Migration Notes

- **No schema migration.** Rollback = stop using the endpoints; markers are inert data in an existing nullable column.
- **Precondition check before first real use (operator, not code):** count prod `orders where supplier_id='SUP_PAGO' and status in ('captain_submitted','manager_claimed')` — the screen is empty until locations actually submit Pago orders through the app (only WOLA ever has). This is expected for the rollout period, not a defect.
- **Pago email prerequisite (RESOLVED by operator + gated master-data batch):** Pago's Transport-order email goes to the legacy sheet's PAGO distribution list (finanse@/fakturymeze@/manager@/PBTransporterBro@/biuro@/gosia@ + Lineage addresses; exact membership confirmed at batch time). The batch writes it comma-separated into `suppliers.email` via the standard diff→apply→audit prod process (NOT part of this code lane). Bukat works immediately; until the batch lands the Pago email button is visibly disabled with a hint, and the copyable totals list is the fallback.
- **Driver notification (DEFERRED by operator):** a per-driver email (address depends on the chosen driver) is explicitly out — v1 keeps the driver list private in-app; follow-up lane.
- **Driver list stays private:** the per-location matrix is internal (in-app + clipboard); it is never included in the supplier email — the email carries totals only.
- Legacy sheet keeps running in parallel during the handoff; nothing here writes to it.

## References

- Related research: `context/changes/to-ordering-pago/research.md`, `research-spreadsheet.md`
- Adversary-pair decision: `context/changes/to-ordering-pago/change.md` (Notes)
- Aggregation template: `supply-os-v1/app/main.py:2508-2562` + `tests/test_suggestion_review.py`
- Guarded transition template: `supply-os-v1/app/main.py:1469-1518` (claim), `:1633-1781` (dispatch)
- FE screen template: `frontend/src/pages/manager/ManagerInventoryPage.tsx`
- Guard-exception pair catch: `supply-os-v1/app/main.py:1774` + `supply-os-v1/app/errors.py`
- Sheets marker round-trip coverage: `supply-os-v1/tests/test_sheets_write.py:37,77,296,411,552`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backend read side — eligible list, aggregation, batches list/detail

#### Automated

- [x] 1.1 Aggregation unit tests written first, then green (`tests/test_transport.py`)
- [x] 1.2 Eligible/list/detail endpoint tests green (incl. seed-mode degradation, 404)
- [x] 1.3 `ruff check` clean
- [x] 1.4 Full backend suite green

### Phase 2: Backend create — combine selected orders into a Transport batch

#### Automated

- [x] 2.1 Create/append tests written first, then green (guards, skipped[], 400/503 paths)
- [x] 2.2 Queue/detail expose `supplier_order_reference` (tests updated)
- [x] 2.3 `ruff check` clean; full backend suite green

### Phase 3: Frontend — /manager/transport workspace

#### Automated

- [x] 3.1 `npm run test` green incl. new `transport.test.ts`
- [x] 3.2 `npm run build` green (TS strict)
- [x] 3.3 `npm run lint` green

#### Manual

- [x] 3.4 Preview verified (selection → create → batch detail → driver-list copy) + screenshot saved
- [ ] 3.5 Email button: totals-only draft for valid email (Bukat), disabled+hint for TBD (Pago)
- [ ] 3.6 TRN chip visible on sent lane for a combined order
