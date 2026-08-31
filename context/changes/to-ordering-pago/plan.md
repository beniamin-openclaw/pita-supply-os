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

---

# ADDENDUM v2 (2026-08-22) — operator scope extension: full manager workstation

Operator feedback after the v1 prod deploy: the Transport screen must match the legacy sheet's manager-driven workflow — **preview/edit/add/remove products like in other orders, weight preview, driver + vehicle selection**, and the manager generates the orders himself ("Arkusz był dla managera, on sam generował te zamówienia"). These were v1's documented deferrals ("What We're NOT Doing" + the anticipated escalation clause); this addendum un-defers them.

## Design decisions (v2)

1. **Draft → sent lifecycle.** `create` no longer transitions to `manager_sent`. It CLAIMS each order (guarded `captain_submitted → manager_claimed`), stamps the `TRN-` marker, and creates a `transport_batches` row with `status='draft'`. While draft, member orders stay `manager_claimed`, so ALL editing rides the existing, tested machinery: `manager_order_save` (qty + comment, read-modify-write), `manager_add_line` (add product), qty=0 (remove — zero lines already drop from totals/driver list/email). A new `finalize` endpoint performs the guarded `manager_claimed → manager_sent` transitions (sent_method="transport", skipped[] reporting like create) and flips the batch to `status='sent'`. The frozen-lines invariant that makes read-time aggregation safe is preserved — it now begins at finalize. v1-created batches have no header row; the batches list/detail treats a marker group without a header as an implicit `sent` legacy batch (read-only, exactly as today).
2. **Header entity at last** — migration `0009_transport_batches.sql` (ADDITIVE ONLY; NOTE: 0008 belongs to the other lane and stays unapplied — 0009 is independent): table `transport_batches` (transport_id PK, supplier_id FK, status text draft|sent, driver text, vehicle text, pickup_date date, pickup_time text, limit_kg numeric default 700, notes text, created_at timestamptz, created_by text, sent_at timestamptz) + `ALTER TABLE supplier_products ADD COLUMN unit_weight_kg numeric` (nullable). Wire into `test_supabase_integration.py` fixture (lesson). Both backends implement `load_transport_batches / get_transport_batch / append_transport_batch / update_transport_batch` (sheets: worksheet `transport_batches`, degrade via WorksheetNotFound like receipts).
3. **Weight preview.** Aggregate line weight = total_qty_purchase × sp.unit_weight_kg (None ⇒ unknown). Batch detail returns `total_weight_kg` (sum of known), `unknown_weight_count`, and the batch's `limit_kg`; FE renders Łączna waga / Do limitu / Ponad limit like the legacy TRANSPORT header, with a "brak wagi dla N pozycji" warning. Weight VALUES are a separate gated prod master-data batch (operator supplies per-SKU kg); schema ships empty.
4. **Manager creates an order for a location** — POST `/api/manager/transport/add-location` {transport_id, location_id}: creates a skeleton Order (status manager_claimed, captain_user="manager-default", ordered_by="manager", marker stamped, no lines) so a location without a captain submission can join a draft; products are then added via the existing add-line flow. Guard: location must exist + not already in the batch.
5. **Remove order from draft** — POST `/api/manager/transport/remove-order` {transport_id, order_id}: clears the marker and releases `manager_claimed → captain_submitted` (guarded). A manager-created empty order is instead cancelled via the existing cancel trace.
6. **Batch logistics editing** — PATCH `/api/manager/transport/batch/{transport_id}`: driver, vehicle, pickup_date, pickup_time, limit_kg, notes. Allowed in draft AND sent (logistics can change after sending); quantities only while draft.
7. **Detail payload for editing** — `TransportBatchDetail.orders[*]` gains full enriched `lines: list[ManagerOrderLineDetail]` (reuse `_enrich_lines_for_detail`), so the FE can render the editable product × location matrix (each column = one order; cell edits post through managerSave's read-modify-write contract per order; blank cell + click = manager_add_line then save). Aggregate lines (zero-dropped) stay the source for totals, driver list, and the email.
8. **Driver/vehicle pickers** — datalist suggestions from previous batches' values (no new master-data surface); free text ultimately stored on the batch.

## Phase 4: Backend v2 (draft lifecycle, batch header, weight, add-location/remove/finalize/patch)

Success criteria (automated): migration file present + integration fixture wired; new/updated endpoint tests green (create=draft semantics, finalize skipped[] paths, add-location, remove-order, patch, weight math incl. unknown weights, legacy headerless batch read path); full backend suite green; ruff clean.

## Phase 5: Frontend v2 (editable draft workstation)

Success criteria (automated): vitest green (matrix edit helpers, weight panel math, draft/sent state gating); build (TS strict) + lint green. Manual: draft flow verified in preview WITH AUTH ENABLED (lesson): create draft → edit qty → add product → add location → weight panel → finalize → sent view unchanged v1 behavior; screenshot.

## Progress (v2)

### Phase 4: Backend v2

#### Automated

- [x] 4.1 Migration 0009 + integration fixture wired
- [x] 4.2 Backend endpoints + tests green (draft/finalize/add-location/remove/patch/weight)
- [x] 4.3 ruff clean; full backend suite green

### Phase 5: Frontend v2

#### Automated

- [x] 5.1 vitest green (incl. new helpers)
- [x] 5.2 build green (TS strict)
- [x] 5.3 lint green

#### Manual

- [ ] 5.4 Draft→edit→finalize flow verified in preview with auth ON + screenshot

---

# ADDENDUM v3 (2026-08-22) — operator feedback round 2 (demo testing)

Operator decisions: (1) post-send logistics editing STAYS, but EVERY change is recorded; (2) delivered goods MUST go through acceptance exactly like any other delivery. Plus the round-1 feedback items: broken "Wyślij transport" UX, cancel, manager-first grid creation, PDF outputs.

## Design decisions (v3)

1. **Transport event history** — migration `0010_transport_events.sql` (additive): table `transport_events` (event_id text PK, transport_id text NOT NULL, order_id text NULL, event_type text, actor text, at timestamptz, details text — human-readable "field: old → new" summary; append-only, never updated/deleted). Also extends `transport_batches.status` CHECK with `'cancelled'`. Events emitted server-side from: create (per combined order), add-location, remove-order (released|cancelled), finalize (per sent order + batch), logistics PATCH (**with per-field old → new diffs — the post-send audit the operator required**), cancel-draft. Matrix quantity saves ride `manager_order_save`: when the saved order carries a `TRN-` marker, the route logs one event per changed line ("Gyros 25: 5 → 7 karton") — computed from the pre-write read it already does. Both backends implement `append_transport_event` / `load_transport_events_for` (sheets worksheet `transport_events`, WorksheetNotFound degrade = no history shown). Batch detail returns `events` (newest first, capped 100); FE renders a "Historia" section in the batch detail (both draft and sent).
2. **Delivery acceptance parity (operator: "jak każda inna dostawa")** — transport member orders are `manager_sent` after finalize, so the EXISTING goods-receiving flow (captain confirms received vs ordered, discrepancies, WZ photos; first receipt closes the order) must work unchanged. This phase VERIFIES and closes gaps instead of building anew: (a) captain receiving list/submit works for transport members incl. manager-created skeleton orders (effective ordered qty = manager_final — confirm `_effective_ordered_qty` path and captain-facing display of `ordered_by="manager"` orders); (b) manager queue's receipt chips (✓/⚠) appear for transport orders in the sent lane; (c) **batch detail gains per-order delivery status** (received count / discrepancy count per member, joined from receipts) so the transport view shows which locations confirmed; (d) receiving a transport order emits a transport_event ("dostawa potwierdzona — Wola, 2 rozbieżności") — hooked in `captain_receipt_submit` when the order carries a marker. Tests for every gap found.
3. **Finalize UX fix** — the "Wyślij transport" click was silently blocked when matrix edits were unsaved (only a 4s toast; zero requests reached the backend — diagnosed from demo logs). Fix: the button is DISABLED while dirty with a permanent inline hint ("najpierw Zapisz zmiany"), plus a one-click "Zapisz i wyślij" path that saves all dirty orders then finalizes.
4. **Cancel draft** — endpoint `POST /api/manager/transport/cancel` {transport_id}: draft only (409 otherwise); releases every member (claim-release best-effort, marker cleared; manager-created empty orders cancelled) and sets header `status='cancelled'` (kept as audit, listed greyed-out or filtered — FE hides cancelled by default). Emits event. Cancelling a SENT transport stays OUT (open question — risky, order already reached Pago).
5. **Manager-first grid creation (the legacy sheet flow)** — "Utwórz transport" opens a location multi-select (defaults decided by me, revisable: NO city step in v1 — locations picked directly; city grouping only if the operator insists after seeing it). Creates a draft with one manager-created order per picked location, PRE-FILLED with ALL products of the supplier available at that location (supplier catalog ∩ location_product_settings — exactly the captain's orderable set) as zero-qty lines ("bez wartości"). Manager types quantities into the matrix and saves; the Pago list / driver list / email then derive as today (zero-qty lines drop out). Backend: extend create/add-location with `prefill_products: bool` (batch `append_order_lines` of skeleton zero-qty lines). The combine-captain-orders path STAYS alongside (captain-submitted orders join the same draft).
6. **PDF outputs, level A now** — print-friendly views for the PRIVATE driver list and the Pago order list (dedicated print stylesheet + window.print → system "Save as PDF"), buttons on the batch detail. Level C (app SENDS the email itself with a generated PDF attached — Gmail API/SMTP) is a separate follow-up BLOCKED on operator decisions: driver→email mapping and consent for the app to send mail from a mailbox (today the app only ever prepares drafts). Recorded in Open Questions.

## Open Questions (carried)

- City grouping in the location picker (v1 ships without it).
- Cancel of a SENT transport — wanted or forbidden?
- Level C email automation: driver e-mail addresses + which mailbox sends.
- Round-1 unanswered: none other — history (decided: event log), acceptance (decided: delivery-time, existing flow).

## Phase 6: Event history (backend + FE section)
## Phase 7: Finalize UX + cancel draft
## Phase 8: Delivery-acceptance parity (verify/fix + per-order delivery status on batch detail + receipt events)
## Phase 9: Manager-first grid creation (location picker + prefilled zero-qty draft)
## Phase 10: Print/PDF views (driver + Pago lists)

## Progress (v3)

### Phase 6: Event history
#### Automated
- [x] 6.1 Migration 0010 + both backends + event emission tests green
- [x] 6.2 Batch detail returns events; FE Historia section; suites green
### Phase 7: Finalize UX + cancel draft
#### Automated
- [x] 7.1 Cancel endpoint + tests; finalize disabled-state helper tests
### Phase 8: Delivery-acceptance parity
#### Automated
- [x] 8.1 Receiving path verified/fixed for transport members (tests); per-order delivery status on detail; receipt events
### Phase 9: Manager-first grid creation
#### Automated
- [x] 9.1 prefill_products backend + tests; FE location picker + prefilled draft flow
### Phase 10: Print/PDF views
#### Automated
- [x] 10.1 Print views render (helper tests); suites green
#### Manual
- [x] 10.2 Full v3 demo pass on the sandbox (history, cancel, receive, grid-create, print) + screenshots

---

## ADDENDUM v4+v5 (2026-08-25) — naming, grid polish, PDF downloads

Operator feedback rounds 4 and 5 (both implemented, committed as `4dbfd12` (v4) and `4425435` (v5); v4's migration 0011 applied to the demo DB, **NOT yet applied to prod**).

### v4 (commit 4dbfd12)
1. **Friendly batch naming (A+C)** — `transport_batches.name` (migration 0011, additive nullable text) through models/backends/PATCH; "Nazwa (opcjonalna)" field in LogisticsPanel; renames logged as `logistics_changed` events.
2. **Empty-column finalize guard** — an all-empty batch 400s with zero writes; a mixed batch auto-removes empty members at send (cancel/release split, `skipped[]` reason "empty — removed", `order_removed` event).
3. **All-locations modal default** — LocationMultiSelectModal opens with every location pre-checked + select/deselect-all toggle.
4. **Print views redesigned** to mirror the operator's legacy PDFs (navy bars, entity boxes, matrix + Razem) — superseded by v5 item 5.

### v5 (commit 4425435, frontend-only)
1. **Auto-label** `Transport {Dzień} · {Miasto/Miasta} · {dd.MM.rr}` (weekday+date from `pickup_date` else `created`; cities normalized — postal-code strip, Warsaw→Warszawa alias, dedupe, short-location-name fallback). Custom `name` wins; grey TRN- badge unchanged.
2. **NOWY badge** on batches never opened on this device (`supply_os_transport_seen` localStorage, capped 200) — per-device by design.
3. **Create → jump**: every create path (selection / empty / grid modal) selects the new draft, marks it seen, and smooth-scrolls the detail into view.
4. **Single matrix-wide "+ Dodaj produkt"** row under the last product replaces the per-location pickers; adds at qty 0 to every member order where orderable (allSettled, one refresh, failures toast location names); non-configured locations show "–".
5. **PDF downloads replace printing**: pdfmake (lazy chunk ~360 kB gzip + vfs fonts, built-in Roboto covers Polish diacritics); pure docDefinition builders in `lib/transportPdf.ts` reuse the existing print-doc structures (no-location-leak invariant re-tested); filenames like `Transport-Wtorek-Warszawa-25.08.26-lista-kierowcy.pdf`; window.print machinery deleted; buttons "PDF — lista kierowcy" / "PDF — zamówienie".
6. **"Wyślij transport" → "Zatwierdź transport"** (+ confirm/busy/error copy) — the button never sent anything to the supplier; approval semantics now honest. Actual supplier email automation stays the deferred Level C.

Verification: backend 568 tests + ruff clean (unchanged); FE 159 tests, build (pdfmake as separate lazy chunk), lint clean; live E2E on the demo sandbox (label, NOWY, jump, add-all with "–" fallback, both PDF downloads exercised).

---

## ADDENDUM v5.1–v5.6.2 (2026-08-25 → 2026-08-28) — feedback fixes + "Zrób draft w Gmailu"

All shipped to prod (`main` at `b9dd408`); prod data updated alongside.

### Feedback fixes (v5.1–v5.3, v5.5)
- **v5.1** (`decb7a6`): driver-doc columns use short location names ("Bracka"); manager-added matrix rows pin BELOW the alphabetized base, in add order.
- **v5.2** (`db8770c`, `2e91a13`): Transport offers ALL company locations (active flag ≠ "takes no deliveries"); Enter hops one matrix row down (same column, skips "–", selects target). Prod data: KULINARNA got 19 Pago settings cloned from KAMIENICA; true cities set (Kraków/Gdańsk/Poznań/Katowice/Warszawa — web-verified).
- **v5.3** (`8ab98b4`): `supplier_products.supplier_sku` (migration **0012**, additive) → "Nr katalogowy" on the Pago order PDF; 6 codes recovered from the legacy sheet (GYRSW15KG, GYRSW25KG, SUVKUR5kg, SUVSW5kg, PITTA018, BURG-200GR). Weights: 6 SKUs in `unit_weight_kg` (Gyros 15/25, Souvlaki ×2 from codes; Pita 13 kg + Bifteki 4 kg DERIVED from Import PB pallet records). `suppliers.email` for SUP_PAGO = the legacy Lineage Logistics distribution list (Pago = 3PL self-pickup; no Pago mailbox exists).
- **v5.5** (`dbb90bb`): driver/vehicle dropdowns from `_meta` dictionaries (`transport_drivers`, `transport_vehicles`; seeded 1:1 from the operator's screenshots) merged with historical suggestions + "Inny — wpisz ręcznie…" escape hatch; served by the extended draft-config endpoint.

### "Zrób draft w Gmailu" (v5.4 → v5.6.2) — per-user Gmail drafts with PDF attachments
Replicates the legacy Apps Script contract: WHOEVER clicks authorizes once with their own **@pitabros.pl** Google account (Internal OAuth app "Pita Supply OS", project `pita-supply-os`, Client ID in `VITE_GOOGLE_CLIENT_ID` on Vercel) and a ready DRAFT (legacy subject templates, plain-text body, order/driver PDF attached, recipients auto-filled) lands in THEIR Drafts. Draft-only — the app never sends.

Three silent failure layers were peeled by live E2E in the operator's browser (each fix exposed the next; see lessons.md "Browser-integration features fail SILENTLY in layers"):
1. `a40d78c`/`cf65daf` — GIS token-client popup self-closes with neither callback firing → replaced with a classic implicit-grant popup + our public `/oauth/gmail-callback` page.
2. `5dd5c5b` — accounts.google.com COOP severs `window.opener` → token relayed via **BroadcastChannel** (primary); `popup.closed` poll removed (misreports under severance).
3. `b9dd408` — pdfmake 0.3 `getBase64()` is promise-returning; the callback-style call hung forever after successful auth → both API shapes handled.

**Deploy proof (2026-08-28, live E2E on prod):** click → account choose (biuro@) → token arrives (verified on both relay channels with a real `ya29.…` token + matching state) → success UI → draft **"Zlecenie odbioru wlasnego - test - 2026-09-01"** with attachment **`test-zamowienie.pdf`** confirmed present in biuro@'s Gmail Drafts, alongside the legacy Apps Script drafts in the identical naming convention.

Verification totals at close: backend **577** tests + ruff clean; frontend **198** tests + build + lint clean.
