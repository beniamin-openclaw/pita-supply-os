# Week 2 Feedback — Quantities, Units, Lists, Info-Only Signals: Implementation Plan

## Overview

Close the week-2 captain/manager feedback round (Connecteam chat 7–15.09, meeting with Sławek and Marek
2026-09-18) with one master-data package on prod and seven small code phases. The governing idea, in the
operator's words: **show information instead of adding rules**. The one rule we remove is the reason gate on
"suggestion 0" (stock ≥ target). Everything else is data correction, hints, list usability, and two process
asks that the manager needs by 2026-10-01 (location e-mail in DW, edit after send with a log, cleaner queue).

Inputs (all decisions taken, nothing re-opened here):
- `context/changes/week2-feedback-quantities/analysis.md` — triage + evidence + P0–P4 draft.
- `context/changes/week2-feedback-quantities/meeting-2026-09-18.md` — meeting decisions.
- Operator answers 2026-09-19: all proposed solutions accepted; **gas bottles have no limits ("free")**.

## Current State Analysis

**Suggestion-0 gate (the noise source).** Backend `_evaluate_submit_line` (`supply-os-v1/app/main.py:437-545`):
for a counted line `delta_pct = |final − suggested| / max(suggested, rounding_step(rule))`; with `suggested == 0`
every non-zero order yields `delta ≥ 1.0 > 0.25` → 400 without `reason_code`. Frontend mirror
`frontend/src/pages/captain-mp/lib/compute.ts:48-53` returns `Infinity` for `suggested === 0 && final > 0`, and
`compute.ts:125-138` turns that into `state: "red"`, `requiresReason: true`, copy
`state.noBaselineNoReason` ("Brak bazy sugestii — wymagany powód"). Submit is blocked through
`StickyActionBar.tsx:40` (`hasRedCards`). `overruleAll.ts:50` auto-fills a reason only where
`requiresReason` is true. Manager read-only view prints `deviation.noBaseline` (`OrderLineTable.tsx:184`,
`OrderDetailPage.tsx:307`). Evidence: 28 of 59 reasoned lines 7–17.09 are `SYSTEM_SUGGESTION_WRONG`, 11 at
suggestion 0; target=0 rows (Blue Service, Mory, Eurofood Norblin, gas bottles) always hit this gate.

**Engine with target 0** (`suggestion.py:93-130`): `needed_base = max(0, 0 − stock) = 0` → suggestion 0
regardless of `is_critical`; no test covers `target_stock_qty_base == 0` (`tests/test_suggestion.py`).

**Inventory grid** (`InventoryCountGrid.tsx:78-120`): name, KRYTYCZNY chip, `inventory_unit`, stock input,
comment. `InventoryProduct` (`models.py`, `types.ts:117-123`) carries no `purchase_unit`, `upp`, `order_note`,
thresholds. `packHint()` (`frontend/src/lib/packUnits.ts:46`) has zero production callers. The count page
already fetches `api.inventoryLatest()` for the banner (`InventoryCountPage.tsx:208-216`) — its `lines` are
not used per row.

**Manager inventory detail** (`ManagerInventoryPage.tsx:170-205`): flat two-column table Produkt/Stan in
backend order; `product_category` is on the wire but unused; no thresholds, no supplier, no sort/search.
Captain grid groups by category (`lib/inventoryGrouping.ts`) with collapsible headers, no search.

**Manager queue** (`ManagerQueue.tsx`): four lanes `submitted|claimed|sent|closed`, each `QueueGroupSection`
starts expanded (`:90`), no `cancelled` lane, no archive route, 20 s polling, backend default `limit=50`
(clamped 1..200). Chips pattern at `:159-226`; `formatDateTime` + `QUEUE_STAMP_OPTS`; no `daysSince` helper.
`ManagerQueueItem` has `received_count` but no receipt timestamp. Prod today: 11 `manager_claimed`,
50 `manager_sent` (many are June–August Wola orders never received).

**Order detail editing** is gated on `detail.status === "manager_claimed"` (`OrderDetailPane.tsx:101`, plus
`ManagerPage.tsx:130,164,186`); backend `manager_order_save` and `manager_add_line` 409 on any other status
(`main.py`, tests `test_manager_save.py:170-184`). No order-level event table exists; audit is column-based
(`cancelled_*`, `last_edited_at`). Event-table precedent: migration 0014 `inventory_count_events`.

**Dispatch e-mail CC.** Backend `gmail_url.build_draft_url(..., cc_email)` passes one opaque string; a
comma-joined list round-trips as one `cc` value (`tests/test_gmail_url.py:480`). Frontend authoritative
builder `emailBody.ts:144-157` does the same; `DispatchPanel.tsx:219-222` reads `detail.cc_email`.
`locations` has no `email` column (0007 added only `company_*`). `Location` is a plain Pydantic model
(extra ignored); sheets/seed loaders drop blank columns, so a new optional field is safe; only
`supabase_backend._LOCATION_COLUMNS:101-104` needs the new name.

**Receiving screen** (`ReceiveDeliveryPage.tsx:127-131`) sends `order_id`, `received_by`, `lines` only;
no notes textarea although `ReceiptSubmitRequest.notes` exists. `ManagerOrderReceipt` does not carry `notes`.

**Supplier info on the captain order screen** already exists: `ContextStrip.tsx` shows
`supplier_name · delivery days · cutoff` from `Supplier.delivery_days/cutoff_time`. Prod has `TBD` in both
fields for Blue Service, Coca-Cola, Eurofood, Filber, Intermlecz, Kamino, Kuchnie; Pago `Tue 14:00`, Bukat
`Mon–Sat 16:00`.

**Migrations.** `main` has 0001–0017 (0008 lives only on the parked supplier-per-location branch, 0018 on
`feat/dynamic-target-wola`, PR #30). The integration fixture `tests/test_supabase_integration.py::_schema`
applies 0001–0017 **except 0016** (a gap; 0016 only widens the reason-code CHECK). New migrations here take
**0019** and **0020** to avoid colliding with PR #30.

**Prod master data (read-only SELECTs 2026-09-19, project `lpzhphufjwrndfogkfub`)** — see Phase 0 tables.
Highest `product_id` is `P185`; new products start at `P186`. Pack-unit declension table
(`frontend/src/i18n/packUnits.ts`) has `zgrzewka, karton, blok, wiadro, opak, worek, skrzynka, butla, paleta,
szt, kg, box`; it lacks `pojemnik` and `paczka`.

## Desired End State

1. A captain whose stock is at or above target can order any quantity without picking a reason; the card is
   yellow and says "Stan ≥ cel — zamawiasz ponad cel". The >25 % and critical-under gates still fire whenever
   the suggestion is > 0. The uncounted-stock over-MAX gate is unchanged.
2. Prod master data reflects the meeting: bifteki carton 4,2 kg; Coca-Cola split into can 0,33 (Norblin,
   Browary) and glass 0,25 (Wola, Bracka, KEN) products; Korfu beers and Filber lemonades 12 per box; sponges,
   scrubbers, grill brushes, gas bottles, Bombilla, Florinis, tzatzyki container naming, halloumi/onion pack
   notes, Mory notes — all applied with diff-before/audit-after and an entry in `change.md`.
3. Every supplier e-mail from the dispatch panel carries the location's mailbox in DW next to `biuro@`.
4. The inventory grid tells the captain "1 box = 12 szt", "ostatnio: 36 · 13.09", and warns (never blocks)
   when the typed stock exceeds 3 × max. Manager inventory detail shows Stan · Cel · Δ with search, category
   or supplier grouping, sort A→Z / by stock / by Δ, and "only needs attention" toggle.
5. Manager queue opens with only "do przejęcia" and "w realizacji" expanded; a claimed order older than 3 days
   shows "w realizacji od N dni"; received orders older than 3 days leave the queue for `/manager/archive`.
6. A manager can add lines or change quantities on a `manager_sent` order until the first receipt exists; every
   such change lands in `order_events` and is visible on the order; a "dosyłka" Gmail link rebuilds the e-mail
   from the current quantities.
7. Captain receiving has "Uwagi do dostawy" (free text incl. items outside the order); the manager sees it.
   Coca-Cola orders prompt for crates to collect (note variant). A captain sees "menedżer zmienił ilości" on a
   dispatched order whose quantities differ from what they submitted.

Verification: `/verify` per phase (ruff + pytest ≥ 668 + build + lint + vitest ≥ 365), prod smoke with auth
ON after each deploy, test orders backed out before dispatch, master-data audit SELECTs green.

### Key Discoveries

- The FE deviation formula has no `max(suggested, step)` floor; parity with the backend is the `Infinity`
  short-circuit (`compute.ts:42-53`). Phase 1 changes the branch, not the formula.
- `overruleAll` keys on `requiresReason` (`overruleAll.ts:50`), so flipping the row state automatically stops
  it from auto-filling reasons on suggestion-0 lines.
- `api.inventoryLatest()` is already on the count page; "ostatnio" needs no backend change.
- `manager_queue` already scans receipts for the sent/closed lanes (`main.py`, `load_receipts_for_orders`);
  exposing the newest `received_submitted_at` per order is one extra field, no query.
- `ManagerOrderDetail.receipts` is already loaded for sent/closed orders, so "locked after receipt" is a
  client-side check with a matching server-side gate.
- `sheets._validate_headers` requires only fields without defaults; an optional `Location.email` degrades on
  every backend (`sheets.py:202-229`, `seed_loader.py:48-59`).
- The captain ContextStrip already renders supplier day/cutoff; Sławek's rules are per location × supplier and
  do not fit `suppliers.delivery_days` — only the uniform part is data this round (Phase 0 H), the per-location
  calendar is a follow-up change.

## What We're NOT Doing

- No dynamic target changes; PR #30 stays a separate decision after this round (lessons: don't stack).
- No structural Coca-Cola crate fields on `orders` (two numeric columns). Note variant only, until Marek has
  Bartek's rules; structural variant is a follow-up change.
- No per-location ordering calendar table, no reminders (Connecteam/Telegram) — follow-up after Sławek's matrix.
- No `sort_order` for Bukat products — follow-up after Sławek's list.
- No automatic top-up e-mail on post-send edit; the manager sends it from the rebuilt Gmail link.
- No location e-mail in Transport (Pago) drafts — a batch spans several locations.
- No `cancelled` lane in the live queue; cancelled orders appear only in the archive.
- No product renames that wait on external input: sponge catalogue name (Marek), majonez Browary target
  (Sławek), Blue Service Browary/Norblin thresholds (Sławek), feta 2 kg (Beniamin) — tracked in `change.md`.
- No tzatzyki threshold change (36 kg stays). Tomatoes Browary 6 vs 36: human error, no data change.
- No change to the uncounted-stock over-MAX gate, the >25 % gate for suggestion > 0, the critical-under gate,
  the supplier-minimum information, or `min` information.
- No new tests for the parked 0008 lane; no schema change on `order_lines`.

## Implementation Approach

Data first, then the smallest code change with the largest effect, then the manager's 1.10 asks, then the
information layer. Each phase merges to `main` on its own (solo repo, auto-deploy Railway + Vercel);
migrations are applied by the operator before the code that reads them (0019 before Phase 2, 0020 before
Phase 6). Every prod master-data statement follows the standing rule: SELECT-diff saved before, apply, audit
SELECT after, entry in `change.md`. Test orders are never dispatched.

Order and dependencies: Phase 0 → Phase 1 → team message → Phase 2 → Phase 5 → Phase 6 → Phase 3 → Phase 4 →
Phase 7. Phases 3, 4 and 7 are independent of each other; Phase 5 and 6 share the manager queue/detail files
and go in sequence.

## Critical Implementation Details

- **Twin implementations.** `suggestion.py` ↔ `compute.ts` and `gmail_url.py` ↔ `emailBody.ts` must change
  together (Phase 1, Phase 2). Backend tests and Vitest both assert the same examples.
- **Suggestion-0 branch precedes the deviation math.** In `_evaluate_submit_line` the new branch must be
  checked before computing `delta_pct`, and must store `delta_vs_suggestion_pct = None` so FR-012 averages
  and `deviation_count` in the queue do not count these lines.
- **Coca-Cola split keeps `P068`/`P069`** (history FK from `order_lines` and `inventory_count_lines`); only
  names change and location rows move. Deleting `location_product_settings` rows hides a product from the
  captain; the saved BEFORE SELECT is the rollback.
- **Migration numbering.** Use 0019 (`locations.email`) and 0020 (`order_events`), leave 0018 to PR #30;
  wire both plus the missing 0016 into `tests/test_supabase_integration.py::_schema` (`_ALL_TABLES` and
  `_TXN_TABLES` for the new table). Keep migration files free of the percent sign.
- **Post-send edit and dispatch safety (test-plan Risk #1).** Editing a `manager_sent` order must never call
  the dispatch transition; `update_order(..., expected_status="manager_sent")` guards the total write, and the
  receipt check runs after `invalidate_cache("orders")` and a fresh receipt read.

---

## Phase 0: Prod master-data package and process cleanup

### Overview

One SQL package `context/changes/week2-feedback-quantities/prod-sql.sql`, sections A–I, each with
BEFORE SELECT (saved to `prod-diff-before.md`), UPDATE/INSERT/DELETE, AFTER assertions. Applied by the
operator through the Supabase SQL editor or MCP `execute_sql`, one section at a time. Plus manual cleanup in
the app. No code.

### Changes Required:

#### 1. SQL package

**File**: `context/changes/week2-feedback-quantities/prod-sql.sql` (new)

**Intent**: Apply the 2026-09-18 decisions to prod master data with a rollback trace.

**Contract** — sections and target rows (values from the prod reads of 2026-09-19):

| § | Rows | Change |
|---|---|---|
| A Bifteki | `SP_PAGO_P145` | `units_per_purchase_unit 1.0 → 4.2`, `order_note = '1 karton = 4,2 kg'`, `rounding_rule` stays `full_only` |
| A | `location_product_settings` P145 | BRACKA `0.5/1.5/1.5 → 2/4.2/4.2`, NORBLIN same, BROWARY `0/1/1 → 2/8.4/8.4`, INSERT WOLA `2/4.2/4.2`; `allow_over_max_due_to_packaging = true` on all four |
| B Coca-Cola | `P068`, `P069` | `product_name_pl → 'Coca-Cola 0,33 l puszka'` / `'Coca-Cola Zero 0,33 l puszka'`; `supplier_product_name` same; `order_note` stays `1 zgrzewka = 24 szt` |
| B | new `P186`, `P187` | `'Coca-Cola 0,25 l szkło'`, `'Coca-Cola Zero 0,25 l szkło'`; category `Napoje`, `inventory_unit szt`, `is_critical` as P068/P069; `SP_COCACOLA_P186/P187` `purchase_unit 'skrzynka'`, `upp 24`, `rounding_rule up_for_critical`, `order_note '1 skrzynka = 24 szt'`, `price_estimate_pln NULL` (operator fills from the CC portal) |
| B | settings | INSERT P186/P187 at WOLA, BRACKA, KEN copying the current P068/P069 row of the same location (min/target/max/crit/over); DELETE P068/P069 rows at WOLA, BRACKA, KEN. NORBLIN and BROWARY keep P068/P069, get no glass rows |
| C Korfu + lemonades | `SP_FILBER_P136, P137, P138, P157, P075, P076, P077` | `purchase_unit 'zgrzewka' → 'box'`, `upp 6 → 12`, `order_note = '1 box = 12 szt'`; P157 `rounding_rule full_only → up_for_critical` for consistency |
| D Sponges, scrubbers, brush | `P121` | `inventory_unit 'opak' → 'szt'`; `SP_BLUESERV_P121` `purchase_unit → 'szt'`, `order_note 'opak. zbiorcze 10 szt'`; settings WOLA `1/3/3 → 5/12/12` (other locations already ≥ 10 pieces, unchanged) |
| D | `P122` | `SP_BLUESERV_P122.active → false`; INSERT `SP_MORY_P122` (`szt`, upp 1, `full_only`, `price NULL`); settings unchanged |
| D | new `P188` | `'Szczotka do grilla'`, category `Chemia`, `szt`; `SP_MORY_P188`; settings `0/0/0` at WOLA, BRACKA, NORBLIN, KEN, BROWARY (free item, appears on inventory and order, never suggests) |
| E Gas bottles (free) | `P181` settings | WOLA, BRACKA, KEN `→ 0/0/0`; DELETE NORBLIN rows for P181 and P182; `SP_KAMINO_P181.order_note = 'bez limitu — zamów tyle, ile pustych'` |
| F Bombilla | `P135` | `SP_BUKAT_P135.active → false`; DELETE its 5 settings rows (product stays inactive for history) |
| G Names and notes | `P017` | `product_name_pl` and `supplier_product_name → 'Papryka grillowana grecka Florina (Florinis)'` |
| G | `SP_BUKAT_P011` | `purchase_unit 'wiadro' → 'pojemnik'`, `order_note → '1 pojemnik = 3 kg (karton 6)'` |
| G | `SP_INTERMLECZ_P015` | `order_note 'opak. zbiorcze 12 szt'` |
| G | `SP_BUKAT_P016`, `SP_BUKAT_P018` | `order_note 'worek 5 kg'` |
| G | `SUP_MORY.notes` | append `'Kapitani zgłaszają w apce; realizuje Marek/Mateusz. Druciaki, szczotki do grilla — Allegro/Selgros.'` |
| H Supplier days (uniform part only) | `suppliers` | replace `'TBD'` with Sławek's uniform values where they exist at execution time (Coca-Cola, Blue Service, Intermlecz, Kuchnie, Filber, Eurofood, Kamino); a supplier without a confirmed value keeps `TBD` |
| I Location e-mail (after migration 0019, Phase 2) | `locations.email` | the five active locations' mailboxes supplied by the operator (Google Workspace aliases) |

AFTER assertions per section: `min ≤ target ≤ max`; no `P068/P069` row at WOLA/BRACKA/KEN; exactly one
active `supplier_products` row per (product, supplier) touched; `upp` of every FILBER row = 12; no
`order_note` longer than 60 characters; count of products = 188; Phase 0 evidence pasted into `change.md`.

#### 2. Manual cleanup in the app (operator)

**Intent**: Empty the manager lanes of orders that were fulfilled outside the app so the new queue view starts
clean.

**Contract**: Bracka Coca-Cola `ORD-20260902-BRA-COCA-c673c7` → "Oznacz jako zamówione" or cancel; the
Pago `manager_claimed` drafts → finalize or cancel via Transport; old Pago transport drafts cancelled; June–August
`manager_sent` Wola orders without receipts → receipts confirmed or left for the archive (Phase 5 hides them
after 3 days only once a receipt exists, so unreceived ones stay visible on purpose). KEN toilet paper order
(7 packs) checked with KEN.

#### 3. Team message (after Phase 1 deploy)

**File**: `context/changes/week2-feedback-quantities/team-message.md` (new, PL + EN)

**Intent**: Tell captains what changed: no reason when stock ≥ target, Coca-Cola glass vs can per location,
Korfu 12 per box, sponges in pieces, gas bottles free, no Coca-Cola freebies, Sunday inventory → order rule.

### Success Criteria:

#### Automated Verification:

- BEFORE diff saved: `context/changes/week2-feedback-quantities/prod-diff-before.md` exists with one block per section
- AFTER assertion SELECTs return zero violations (listed in `prod-sql.sql`)
- `change.md` has the Phase 0 entry (sections applied, timestamps, row counts)

#### Manual Verification:

- Captain at WOLA sees "Coca-Cola 0,25 l szkło" (skrzynka) and no "0,33 l puszka"; NORBLIN the reverse
- Korfu Pilsner at WOLA suggests in boxes of 12 (stock 6, target 36 → 3 boxes → after fix 2.5 → 3 with up_for_critical, shown as "1 box = 12 szt")
- Bifteki at BROWARY: stock 0 kg → suggestion 2 kartony (8,4 kg)
- No order in `manager_claimed` older than 7 days remains after cleanup

**Implementation Note**: pause after Phase 0 for the operator to confirm the audit before Phase 1 is deployed.

---

## Phase 1: Suggestion 0 becomes information

### Overview

Remove the reason requirement when the counted stock is at or above target (suggestion 0). Backend and
frontend twins change together; the manager's read-only views say "ponad cel" instead of "brak bazy".

### Changes Required:

#### 1. Backend gate

**File**: `supply-os-v1/app/main.py` (`_evaluate_submit_line`)

**Intent**: A counted line with `suggested_qty_purchase == 0` skips the deviation and critical-under gates,
stores `delta_vs_suggestion_pct = None`, and adds an informational warning when a quantity was ordered.

**Contract**: new branch between the uncounted branch and the counted branch: `stock is not None and
suggested_qty_purchase == 0` → `delta_pct = None`, `stored_stock = stock`, warning
`"Line {product_id}: stock {stock:g} ≥ target {target:g}, ordered {final:g} (info)"` when `final > 0`; a
`reason_code`, if given, is stored as before. The docstrings of `_evaluate_submit_line` and `captain_submit`
list the third branch. Both `captain_submit` and `captain_order_edit` inherit it.

#### 2. Engine test for target 0

**File**: `supply-os-v1/tests/test_suggestion.py`

**Intent**: Close the coverage gap: `target_stock_qty_base == 0` yields suggestion 0 for critical and
non-critical, every rounding rule.

#### 3. Backend tests

**File**: `supply-os-v1/tests/test_captain_submit.py`, `supply-os-v1/tests/test_captain_orders.py`

**Intent**: Prove the new branch and that the old gates still hold. Cases: counted stock ≥ target, order 2,
no reason → 200, `delta_vs_suggestion_pct is None`, warning present; same with `reason_code` → 200, reason
stored; counted stock below target (suggestion > 0), 200 % deviation, no reason → 400 (unchanged);
`test_submit_counted_zero_still_gates_as_before` unchanged; captain edit path gets one mirror case.
Queue test: such a line does not increase `deviation_count`.

#### 4. Frontend row state

**File**: `frontend/src/pages/captain-mp/lib/compute.ts`, `frontend/src/i18n/strings.ts`

**Intent**: `suggested === 0 && final > 0 && stock counted` → `state: "yellow"`, new key
`state.aboveTargetInfo` with vars `{ stock, target, unit }`, `requiresReason: false`, `deviationPct: null`.
`suggested === 0 && final === 0` → green as today. Remove `state.noBaselineNoReason` /
`state.noBaselineReason` from the reachable paths (keys may stay for the manager view). `hasReason` no longer
matters on this branch.

**Contract**: `RowState` shape unchanged. `computeDeviation` unchanged. `overruleAll` needs no change (it
reads `requiresReason`).

#### 5. Frontend tests

**File**: `frontend/src/pages/captain-mp/lib/compute.test.ts`, `frontend/src/pages/captain-mp/lib/overruleAll.test.ts`, `frontend/src/pages/captain-mp/components/ProductCard.test.tsx`

**Intent**: Replace the block at `compute.test.ts:242-266` with the yellow/no-reason expectations (pct never
rendered); `overruleAll` leaves a suggestion-0 line without a reason; a ProductCard test asserts no
`ReasonPicker` is mounted for a suggestion-0 line (first component test for the pill).

#### 6. Manager and captain read-only copy

**File**: `frontend/src/pages/manager/OrderLineTable.tsx`, `frontend/src/pages/captain-mp/OrderDetailPage.tsx`, `frontend/src/i18n/strings.ts`

**Intent**: Where `delta_vs_suggestion_pct` is null and stock ≥ target, print `deviation.aboveTarget`
("ponad cel") instead of "brak bazy"; keep "brak bazy" only for uncounted lines (`current_stock_qty_base`
0 with target > 0 is indistinguishable server-side, so the rule is: `suggested_qty_purchase === 0 &&
current_stock >= target` → "ponad cel", else "brak bazy").

### Success Criteria:

#### Automated Verification:

- Backend: `cd supply-os-v1 && python -m pytest -q` passes with the new cases (682 after Phase 1)
- Backend lint: `ruff check .`
- Frontend: `cd frontend && npm run test` passes (≥ 369 tests), `npm run build`, `npm run lint`
- `/verify` green

#### Manual Verification:

- Prod, WOLA × Pago, auth ON: stock 30 kg gyros vs target 10 → yellow card, no reason picker, submit enabled; order backed out before dispatch
- Prod, WOLA × Bukat: stock below target, quantity +50 % → still red until a reason is chosen
- Manager detail of the test order shows "ponad cel" on the yellow line, `deviation_count` 0

**Implementation Note**: deploy, verify on prod, then send the team message (Phase 0 §3) before continuing.

---

## Phase 2: Location mailbox in DW

### Overview

Migration 0019 adds `locations.email`; both e-mail builders CC it next to `biuro@`.

### Changes Required:

#### 1. Migration

**File**: `supply-os-v1/migrations/0019_location_email.sql` (new)

**Intent**: `ALTER TABLE locations ADD COLUMN IF NOT EXISTS email text;` additive, nullable, rollback block,
no percent sign. Wired into `tests/test_supabase_integration.py::_schema` together with the missing 0016.

#### 2. Model and backends

**File**: `supply-os-v1/app/models.py`, `supply-os-v1/app/supabase_backend.py`, `docs/pita-supply-os-v1/seed/locations.csv`

**Intent**: `Location.email: Optional[str] = None`; append `"email"` to `_LOCATION_COLUMNS`; seed CSV gains
the column (blank for KEN, a safe test value for WOLA).

#### 3. Dispatch route and Gmail builder

**File**: `supply-os-v1/app/main.py` (`manager_order_detail`, `manager_dispatch`), `supply-os-v1/app/gmail_url.py`

**Intent**: `ManagerOrderDetail.location_email` (Optional) joined from the location; `manager_dispatch` passes
`cc_email` = comma-join of `settings.order_cc_email` and `location.email`, each kept only when it contains
`@`. `gmail_url.build_draft_url` signature unchanged (the caller joins, per its docstring).

#### 4. Frontend

**File**: `frontend/src/types.ts`, `frontend/src/pages/manager/DispatchPanel.tsx`, `frontend/src/pages/manager/lib/emailBody.ts`

**Intent**: `location_email?: string | null` on `ManagerOrderDetail`; DispatchPanel builds `cc` from both
values through a small `joinCc(...)` helper (reuse `splitRecipients` from `lib/transport.ts` for validation)
and shows both in the DW row.

#### 5. Tests

**File**: `supply-os-v1/tests/test_manager_queue.py`, `supply-os-v1/tests/test_manager_dispatch.py`, `supply-os-v1/tests/test_gmail_url.py`, `frontend/src/pages/manager/lib/emailBody.test.ts`

**Intent**: detail exposes `location_email`; dispatch URL carries `cc=biuro@…,wola@…`; a location without
e-mail yields the office cc only; a placeholder `TBD` is dropped; FE `joinCc` unit cases.

#### 6. Data

**Contract**: Phase 0 section I runs after the migration: five active locations get their mailbox.

### Success Criteria:

#### Automated Verification:

- Migration file present and applied to the integration fixture; `python -m pytest -m integration` green in CI
- Backend and frontend suites green; `/verify` green

#### Manual Verification:

- Operator applied 0019 on prod before the deploy (Supabase SQL editor), confirmed with `SELECT email FROM locations`
- Prod dispatch panel for a WOLA test order shows DW `biuro@pitabros.pl, <wola mailbox>`; the Gmail draft opens with both; draft discarded, order cancelled

### Plan-review amendments (2026-09-20)

- 0019 is applied as `varchar(120)` (not `text`) — the model stays `Optional[str]`, no code impact.
- First step of §2: wire 0016, 0019 and 0020 into `tests/test_supabase_integration.py::_schema` (and
  `order_events` into `_ALL_TABLES` before `orders` + `_TXN_TABLES`) BEFORE `email` joins `_LOCATION_COLUMNS`,
  otherwise the fixture's `Location(...)` insert fails.

---

## Phase 3: Inventory information layer

### Overview

The inventory grid gets the pack hint, the previous count and the 3 × max warning. Backend enriches
`InventoryProduct`; the previous count comes from the already-fetched latest snapshot.

### Changes Required:

#### 1. Backend product enrichment

**File**: `supply-os-v1/app/main.py` (`captain_inventory_products`), `supply-os-v1/app/models.py`

**Intent**: `InventoryProduct` gains optional `purchase_unit`, `units_per_purchase_unit`, `order_note`,
`supplier_id`, `supplier_name`, `min_stock_qty_base`, `target_stock_qty_base`, `max_stock_qty_base`.

**Contract**: a shared pure helper `_primary_supplier_product(product_id, sps, suppliers_by_id) ->
Optional[SupplierProduct]` picks the active supplier_product whose supplier is active, lowest
`supplier_product_id` first, skipping `SUP_INTERNAL` when another exists; `None` → the four supplier fields
stay `None`. Thresholds come from the location setting the route already iterates. The same helper is reused
by Phase 4.

#### 2. Frontend types and grid

**File**: `frontend/src/types.ts`, `frontend/src/pages/captain-mp/components/InventoryCountGrid.tsx`, `frontend/src/pages/captain-mp/InventoryCountPage.tsx`, `frontend/src/i18n/strings.ts`, `frontend/src/i18n/packUnits.ts`

**Intent**: optional fields mirrored with `?` (lesson: mirror Pydantic optionality). Under each input:
`packHint()` line when `upp > 1` (e.g. "1 box = 12 szt"), `order_note` when present, "ostatnio {qty} · {date}"
from `inventoryLatest.lines` keyed by `product_id` (new grid prop `previousByProduct`), and a yellow
`inventory.checkUnitHint` ("sprawdź jednostkę — max to {max} {unit}") when typed stock > 3 × max and
max > 0. Nothing blocks submit. `PACK_UNIT_FORMS` gains `pojemnik` and `paczka`. The edit page reuses the
grid without `previousByProduct`.

#### 3. Tests

**File**: `supply-os-v1/tests/test_inventory_submit.py` (or the inventory products test file), `frontend/src/pages/captain-mp/components/InventoryCountGrid.test.tsx` (new), `frontend/src/lib/packUnits.test.ts`, `frontend/src/i18n/pluralKeys.test.ts`

**Intent**: backend: fields present, product without active supplier_product → nulls, SUP_INTERNAL skipped
when Bukat exists; FE: hint rendered for upp 12, absent for upp 1, "ostatnio" rendered from the map, 3 × max
warning appears and disappears, declension of `pojemnik` in one/few/many.

### Success Criteria:

#### Automated Verification:

- Backend + frontend suites green (new grid test file runs under Vitest); `/verify` green
- `pluralKeys.test.ts` still passes with the new forms

#### Manual Verification:

- Prod, WOLA inventory, auth ON: Korfu Pilsner row shows "1 box = 12 szt", tzatzyki shows "1 pojemnik = 3 kg (karton 6)" and "ostatnio … · 13.09"; typing 200 for tzatzyki (max 36) shows the unit warning; a phone (375 px) wraps, no horizontal scroll

### Plan-review amendments (2026-09-20)

- `pluralKeys.test.ts` only scans `tPlural(` call sites, so it cannot prove the new forms; the success
  criterion is `lib/packUnits.test.ts` covering `pojemnik`/`paczka` one/few/many (Progress 3.2 updated).

---

## Phase 4: Product lists — search, group, sort, attention flags

### Overview

Sławek's tool: the manager inventory detail becomes decision-ready; the captain grid gets search and
"only uncounted". One shared toolbar and one pure helper.

### Changes Required:

#### 1. Backend detail enrichment

**File**: `supply-os-v1/app/main.py` (`_enrich_inventory_count_detail`, `manager_inventory_count_detail`), `supply-os-v1/app/models.py`

**Intent**: `InventoryCountDetailLine` gains optional `min/target/max_stock_qty_base`, `purchase_unit`,
`units_per_purchase_unit`, `supplier_id`, `supplier_name` (via the Phase 3 helper and the location's settings).
`_enrich_inventory_count_detail` stays pure: the route passes `settings_by_pid` and the resolved supplier map.

#### 2. Pure list helper

**File**: `frontend/src/lib/productListFilter.ts` (new) + `productListFilter.test.ts`

**Intent**: `applyProductListView(rows, view)` where `view = { query, groupBy: "category" | "supplier",
sort: "name" | "stock" | "delta" | "category", onlyAttention, onlyCritical, onlyUncounted }`. Attention
flag per row: stock below min, stock > 3 × max (max > 0), or stock 0 with target > 0. Sort uses
`localeCompare(…, "pl")`. Works on a minimal row shape so both screens can feed it.

#### 3. Shared toolbar

**File**: `frontend/src/components/ui/ProductListToolbar.tsx` (new), `frontend/src/i18n/strings.ts`

**Intent**: search input (150 ms debounce), group-by segmented control, sort select, toggle chips. State is
ephemeral (S-05 precedent: no localStorage).

#### 4. Manager inventory detail

**File**: `frontend/src/pages/manager/ManagerInventoryPage.tsx`, `frontend/src/types.ts`, `frontend/src/pages/manager/lib/inventoryCsv.ts`

**Intent**: rows grouped with sticky headers (category label or supplier name), columns Produkt · Stan ·
Cel · Δ · flaga; toolbar above; CSV export gains the threshold columns. `groupProductsByCategory` from
`captain-mp/lib/inventoryGrouping.ts` generalised over a `{ product_category }` row type and moved to
`frontend/src/lib/` so both screens import it.

#### 5. Captain grid

**File**: `frontend/src/pages/captain-mp/components/InventoryCountGrid.tsx`, `frontend/src/pages/captain-mp/InventoryCountPage.tsx`

**Intent**: toolbar with search + "tylko nieliczone" + "tylko krytyczne"; a search hit expands its category.
No thresholds columns on the captain side beyond the Phase 3 hints.

#### 6. Tests

**File**: `supply-os-v1/tests/test_inventory_manager.py`, `frontend/src/lib/productListFilter.test.ts`, `frontend/src/pages/manager/lib/inventoryCsv.test.ts`

**Intent**: backend detail exposes thresholds and supplier; helper covers each sort, both groupings, every
flag rule, Polish collation ("Ł" after "L"); CSV includes new columns.

### Success Criteria:

#### Automated Verification:

- Backend + frontend suites green; `/verify` green

#### Manual Verification:

- Prod, manager inventory KEN 13.09: group by supplier puts every Blue Service row in one block, sort A→Z matches Sławek's ordering habit, "tylko z uwagą" leaves only rows below min / above 3 × max / zero with target
- Captain WOLA grid: typing "kor" shows the Korfu rows with their category expanded

### Plan-review amendments (2026-09-20)

- `groupProductsByCategory` has THREE importers: `InventoryCountGrid.tsx`, `InventoryCountPage.tsx` and
  `InventoryCountEditPage.tsx`. Either update all three in §5 or keep `pages/captain-mp/lib/inventoryGrouping.ts`
  as a re-export shim (preferred: shim, zero-risk).

---

## Phase 5: Manager queue — collapsed lanes, "w realizacji od N dni", archive

### Overview

Queue opens on the two working lanes; a claimed order older than 3 days is flagged; received orders older
than 3 days move to a new archive page that also lists cancelled orders.

### Changes Required:

#### 1. Backend: receipt timestamp on queue rows

**File**: `supply-os-v1/app/models.py` (`ManagerQueueItem`), `supply-os-v1/app/main.py` (`manager_queue`)

**Intent**: `last_received_at: Optional[datetime]` = newest `received_submitted_at` among the order's
receipts, taken from the receipt scan the route already runs for sent/closed lanes; `None` elsewhere.

#### 2. Frontend queue

**File**: `frontend/src/pages/manager/ManagerQueue.tsx`, `frontend/src/pages/ManagerPage.tsx`, `frontend/src/pages/manager/ManagerFilterBar.tsx`, `frontend/src/lib/dates.ts` (new `daysSince`), `frontend/src/i18n/strings.ts`

**Intent**: `QueueGroupSection` takes `defaultOpen`; `sent` and `closed` start collapsed. Claimed lane rows
with `captain_submitted_at` older than 3 days get an amber chip `manager.queue.inProgressDays` ("w realizacji
od {n} dni"). Closed lane shows only rows whose `last_received_at` is within 3 days (or null); the rest are
counted in a "w archiwum: N" link. `handleClearFilters` and `anyFilterActive` reconciled to the same four-lane
set.

#### 3. Archive page

**File**: `frontend/src/pages/manager/ManagerArchivePage.tsx` (new), `frontend/src/App.tsx`, `frontend/src/pages/ManagerPage.tsx` (nav link)

**Intent**: route `/manager/archive` behind `AuthGate role="manager"`; fetches `closed` and `cancelled` with
`limit=200`, a days selector (7/14/30/60, finance precedent), the same `QueueCard` rows, location/supplier
filters reused from the queue, read-only detail via the existing `OrderDetailPane`.

#### 4. Tests

**File**: `supply-os-v1/tests/test_manager_queue.py`, `frontend/src/lib/dates.test.ts`, `frontend/src/pages/manager/ManagerQueue.test.tsx` (new)

**Intent**: `last_received_at` = newest of two receipts, null on submitted lane; `daysSince` around Warsaw
midnight; lanes default state and chip threshold (3 days) in a component test.

### Success Criteria:

#### Automated Verification:

- Backend + frontend suites green; `/verify` green

#### Manual Verification:

- Prod manager queue opens with "do przejęcia" and "w realizacji" expanded, the two others collapsed with counts
- A claimed test order back-dated is not possible on prod; instead verify the chip on an existing >3-day claimed order before the Phase 0 cleanup, or in the local seed run
- `/manager/archive` lists received orders older than 3 days and cancelled ones; the queue's closed lane is short

### Plan-review amendments (2026-09-20)

- `Order` has no claim timestamp; the chip is keyed on `captain_submitted_at`, so the copy is
  "w kolejce od N dni" / "in the queue for N days" (not "w realizacji"). Do not add a claim column.
- `frontend/src/lib/dates.ts` is a NEW file; `formatDateTime` today lives in `useT()` (`i18n/index.ts`).

---

## Phase 6: Edit after send, with a log

### Overview

A `manager_sent` order without a receipt can get lines added and quantities changed; every change is an
`order_events` row shown on the order; a "dosyłka" Gmail link rebuilds the e-mail from current quantities.

### Changes Required:

#### 1. Migration

**File**: `supply-os-v1/migrations/0020_order_events.sql` (new)

**Intent**: `CREATE TABLE IF NOT EXISTS order_events (event_id text PRIMARY KEY, order_id text NOT NULL,
event_type text NOT NULL, actor text, at timestamptz, details text NOT NULL DEFAULT '')`, index on
`order_id`, RLS enabled, modelled on 0014. Wired into `_schema`, `_ALL_TABLES`, `_TXN_TABLES`.

#### 2. Data layer

**File**: `supply-os-v1/app/models.py`, `supply-os-v1/app/supabase_backend.py`, `supply-os-v1/app/sheets.py`, `supply-os-v1/app/seed_loader.py`

**Intent**: `OrderEvent` model; `append_order_event`, `load_order_events_for(order_id)` on every backend
(sheets: worksheet `order_events`, missing worksheet degrades like `transport_events`; seed: no-op /
empty). Best-effort emission helper `_log_order_event` in `main.py` mirroring `_log_inventory_event`.

#### 3. Route gates

**File**: `supply-os-v1/app/main.py` (`manager_order_save`, `manager_add_line`, `manager_order_detail`)

**Intent**: both write routes accept `manager_claimed` **or** `manager_sent`; for `manager_sent` they first
`invalidate_cache("orders")`, re-read, and 409 when `load_receipts_for_orders([order_id])` is non-empty
("odbiór już potwierdzony"). `expected_status` in the guarded `update_order` equals the order's current status.
On `manager_sent` the save emits `quantities_changed` with the "Name: old → new" diff (reuse the transport
diff code path) and add-line emits `line_added`; `last_edited_at` is stamped. `ManagerOrderDetail` gains
`events: list[OrderEvent]` (newest first, capped 100) and `editable_after_send: bool` (sent, no receipts).
`manager_dispatch` is untouched and still requires `manager_claimed`.

#### 4. Frontend

**File**: `frontend/src/pages/manager/OrderDetailPane.tsx`, `frontend/src/pages/ManagerPage.tsx`, `frontend/src/pages/manager/DispatchPanel.tsx`, `frontend/src/types.ts`, `frontend/src/i18n/strings.ts`

**Intent**: `editable = status === "manager_claimed" || detail.editable_after_send`; the three status checks
in `ManagerPage` use the same predicate. For sent orders the footer shows "Zapisz zmiany (dosyłka)" and a
Gmail link built with `buildGmailComposeUrl` from the current effective quantities with subject prefix
"Dosyłka —"; the existing dispatch button never appears. A "Historia zmian" list renders `events`
(reuse the transport history list styling). A locked sent order (receipt exists) shows "zablokowane po
odbiorze".

#### 5. Tests

**File**: `supply-os-v1/tests/test_manager_save.py`, `supply-os-v1/tests/test_manager_add_line.py` (or the existing add-line test file), `supply-os-v1/tests/test_supabase_integration.py`, `frontend/src/pages/manager/lib/emailBody.test.ts`

**Intent**: save on `manager_sent` without receipt → 200 + one `quantities_changed` event; with a receipt →
409; on `captain_submitted` still 409; dispatch on `manager_sent` still 409; integration: `append_order_event`
round-trip and the save guard on a real row; FE: "Dosyłka —" subject.

### Success Criteria:

#### Automated Verification:

- `python -m pytest -q` and `python -m pytest -m integration` green (CI Postgres job)
- Frontend suite green; `/verify` green

#### Manual Verification:

- Operator applied 0020 on prod before deploy
- Prod: a WOLA × Bukat test order dispatched (Gmail draft discarded), then +1 line added and one quantity changed from the manager screen; the order shows two history rows; the "dosyłka" link opens a draft with the new quantities (discarded); after a captain receipt the order is locked

### Plan-review amendments (2026-09-20)

- Transport batch members are NOT editable after send: `editable_after_send = status == manager_sent and
  no receipts and not (supplier_order_reference or "").startswith("TRN-")`. The write routes 409 on a
  `TRN-` member with detail "edit via Transport"; one test per route. A sent batch's aggregate/driver list
  is frozen at finalize (`manager_transport_finalize`).
- "Locked after receipt" is effectively `status == closed` (`captain_receipt_submit` flips
  manager_sent → closed on the first receipt). The "zablokowane po odbiorze" copy keys on `closed`;
  `editable_after_send` is false for `closed`; manual step 6.4 expects the test order to become `closed`.
- The "dosyłka" Gmail link is built only when `ordering_method === "email"` (DispatchPanel already branches on
  it); portal/phone/manual reuse the plain-text list.
- Manual test residue: a real `manager_sent` order cannot be cancelled (409); close it with a receipt
  afterwards, or run the manual test on a non-email supplier at a location without invoices.

---

## Phase 7: Small captain and manager items

### Overview

Receipt notes, Coca-Cola crates prompt, "manager changed quantities" banner.

### Changes Required:

#### 1. Receipt notes

**File**: `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx`, `supply-os-v1/app/models.py` (`ManagerOrderReceipt.notes`), `supply-os-v1/app/main.py` (`_load_order_receipts`), `frontend/src/pages/manager/DeliverySection.tsx` (or the receipt section component), `frontend/src/i18n/strings.ts`

**Intent**: textarea "Uwagi do dostawy (np. pozycje spoza zamówienia)" → `ReceiptSubmitRequest.notes`;
manager delivery section prints it. This is the "add product / comment at receipt" ask in its free-text form.

#### 2. Coca-Cola crates prompt (note variant)

**File**: `frontend/src/pages/captain-mp/components/OrderCommentField.tsx`, `frontend/src/pages/captain-mp/lib/supplierPrompts.ts` (new), `frontend/src/pages/manager/DispatchPanel.tsx`, `frontend/src/i18n/strings.ts`

**Intent**: `SUPPLIER_NOTE_PROMPTS = { SUP_COCACOLA: "crates" }`; for such a supplier the comment field is
preceded by two small numeric inputs "skrzynki puste" / "skrzynki z butelkami" whose values are serialised
into `captain_note` as a first line `Skrzynki do odbioru: puste N, z butelkami M`; the portal dispatch panel
shows `captain_note` above the copy list. Pure serialiser + parser with tests so the structural variant can
migrate the text later.

#### 3. "Menedżer zmienił ilości" banner

**File**: `frontend/src/pages/captain-mp/OrderDetailPage.tsx`, `frontend/src/i18n/strings.ts`

**Intent**: when status is `manager_sent`/`closed` and any line has `manager_final_qty_purchase > 0 &&
manager_final_qty_purchase !== captain_final_qty_purchase` (or 0 where captain ordered > 0 — the Pago 14.09
case), show a one-line info banner counting the changed lines.

#### 4. Tests

**File**: `supply-os-v1/tests/test_receipt_submit.py`, `supply-os-v1/tests/test_manager_receiving.py`, `frontend/src/pages/captain-mp/lib/supplierPrompts.test.ts`, `frontend/src/pages/captain-mp/OrderDetailPage.test.tsx` (new)

**Intent**: notes persisted and surfaced; crates serialiser round-trip; banner appears only when quantities differ.

### Success Criteria:

#### Automated Verification:

- Backend + frontend suites green; `/verify` green

#### Manual Verification:

- Prod: captain receipt with notes visible on the manager order; Coca-Cola test order at WOLA shows the crates inputs and the manager sees the first line of the note; a dispatched order with a changed line shows the banner on the captain detail

### Plan-review amendments (2026-09-20)

- §3: `OrderDetailPage.tsx` already prints `orders.detail.managerChanged` per line when
  `manager_final > 0 && manager_final !== captain_final`. Extend that condition to cover
  `manager_final === 0 && captain_final > 0` on sent/closed orders and add the order-level count banner —
  do not add a second per-line hint.
- §2: `captain_note` already renders in `OrderDetailPane.tsx` for every channel — do not duplicate it in
  DispatchPanel. The serialised prefix `Skrzynki do odbioru: …` in `supplierPrompts.ts` is a stable
  data-format constant (parser contract), explicitly exempt from the i18n rule; say so in a comment.

---

## Testing Strategy

### Unit Tests:

- Engine: target 0 → suggestion 0 for every rounding rule and both critical flags.
- Submit gate: the three branches (uncounted, counted-suggestion-0, counted-suggestion>0) with and without
  reason; `delta_vs_suggestion_pct` None on the new branch; queue `deviation_count` unaffected.
- `compute.ts`: yellow/no-reason state; `overruleAll` skip; ProductCard without ReasonPicker.
- `joinCc`, `daysSince`, `applyProductListView`, crates serialiser, `packUnits` new forms.
- `gmail_url` and `emailBody` cc with two addresses; "Dosyłka —" subject.

### Integration Tests:

- 0019/0020 applied by the fixture; `append_order_event` round-trip; save guard on `manager_sent` with
  `expected_status`; `Location.email` round-trip through `_LOCATION_COLUMNS`.

### Manual Testing Steps:

1. After each deploy: `curl /health`, Railway build for the merge commit, Vercel bundle hash changed (lesson:
   verify what prod runs).
2. Auth ON smoke with the real Captain token of the tested location and the Manager token only on manager
   screens (lesson: auth-off previews prove nothing about roles).
3. Every test order is cancelled or left `captain_submitted`; Gmail drafts are discarded; no supplier receives
   an e-mail (test-plan Risk #1).
4. Phase 0: AFTER SELECT audit pasted into `change.md`.

## Performance Considerations

`captain_inventory_products` and the manager inventory detail add one `load_supplier_products()` and
`load_suppliers()` per call (cached on sheets, one query on Supabase) — 150 rows per location, negligible.
The archive page requests `limit=200` on two lanes; the backend already clamps and scopes line/receipt loads to
the page. No new polling.

## Migration Notes

- 0019 `locations.email` and 0020 `order_events` are additive; rollback = `DROP COLUMN` / `DROP TABLE`
  blocks in the files. Apply on prod before the corresponding deploy; the code tolerates the column missing
  only for reads (a NULL), so never deploy Phase 2 before 0019.
- Master data: `prod-diff-before.md` is the rollback for Phase 0. The Coca-Cola glass rows copy the can
  thresholds; if Marek later confirms a crate is not 24 bottles, only `SP_COCACOLA_P186/P187.upp` and the
  `order_note` change.
- The Sheets backend gets a new optional `email` column on `locations` and a new `order_events` worksheet
  only if the legacy sheet is ever used again; both degrade when absent.

## References

- Analysis: `context/changes/week2-feedback-quantities/analysis.md`
- Meeting: `context/changes/week2-feedback-quantities/meeting-2026-09-18.md`
- Gate: `supply-os-v1/app/main.py:437-545`, `frontend/src/pages/captain-mp/lib/compute.ts:125-149`
- Event-table precedent: `supply-os-v1/migrations/0014_inventory_count_edit.sql`, `main.py::_log_inventory_event`
- CC precedent: `supply-os-v1/app/gmail_url.py:178-224`, `frontend/src/pages/manager/lib/emailBody.ts:144-157`
- Queue: `frontend/src/pages/manager/ManagerQueue.tsx:80-250`, `frontend/src/pages/ManagerPage.tsx:84-111`
- Lists: `frontend/src/pages/manager/ManagerInventoryPage.tsx:170-205`, `frontend/src/pages/captain-mp/lib/inventoryGrouping.ts`
- Test plan risks: `context/foundation/test-plan.md` §2 (#1, #2, #3, #4, #6)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Prod master-data package and process cleanup

#### Automated

- [x] 0.1 BEFORE diff saved to `prod-diff-before.md`, one block per section
- [x] 0.2 AFTER assertion SELECTs return zero violations
- [x] 0.3 `change.md` has the Phase 0 entry

#### Manual

- [ ] 0.4 Coca-Cola glass at WOLA, cans at NORBLIN, verified on the captain screen
- [ ] 0.5 Korfu Pilsner suggests in boxes of 12 at WOLA
- [ ] 0.6 Bifteki at BROWARY suggests 2 kartony from stock 0
- [ ] 0.7 No `manager_claimed` order older than 7 days after cleanup

### Phase 1: Suggestion 0 becomes information

#### Automated

- [x] 1.1 Backend pytest passes with the new cases
- [x] 1.2 ruff clean
- [x] 1.3 Frontend test, build, lint pass
- [x] 1.4 `/verify` green

#### Manual

- [ ] 1.5 Prod WOLA × Pago: stock ≥ target → yellow card, no reason, order backed out
- [ ] 1.6 Prod WOLA × Bukat: +50 % below-target line still red without reason
- [ ] 1.7 Manager detail shows "ponad cel", deviation_count 0

### Phase 2: Location mailbox in DW

#### Automated

- [ ] 2.1 Migration 0019 in the integration fixture, integration job green
- [x] 2.2 Backend and frontend suites green, `/verify` green

#### Manual

- [ ] 2.3 0019 applied on prod before deploy
- [ ] 2.4 Dispatch panel shows both DW addresses, Gmail draft carries both, discarded

### Phase 3: Inventory information layer

#### Automated

- [x] 3.1 Backend + frontend suites green, `/verify` green
- [x] 3.2 `lib/packUnits.test.ts` covers `pojemnik`/`paczka` one/few/many

#### Manual

- [ ] 3.3 Prod WOLA inventory shows pack hints, "ostatnio", 3 × max warning, wraps on a phone

### Phase 4: Product lists — search, group, sort, attention flags

#### Automated

- [ ] 4.1 Backend + frontend suites green, `/verify` green

#### Manual

- [ ] 4.2 Manager inventory KEN: supplier grouping, A→Z sort, attention filter verified
- [ ] 4.3 Captain grid search expands the matching category

### Phase 5: Manager queue — collapsed lanes, "w realizacji od N dni", archive

#### Automated

- [x] 5.1 Backend + frontend suites green, `/verify` green

#### Manual

- [ ] 5.2 Queue opens with two lanes expanded, two collapsed with counts
- [ ] 5.3 Chip "w realizacji od N dni" verified (local seed or existing prod order)
- [ ] 5.4 `/manager/archive` lists old received and cancelled orders

### Phase 6: Edit after send, with a log

#### Automated

- [ ] 6.1 pytest + integration green
- [x] 6.2 Frontend suite green, `/verify` green

#### Manual

- [ ] 6.3 0020 applied on prod before deploy
- [ ] 6.4 Post-send edit on a test order: two history rows, "dosyłka" draft discarded, locked after receipt

### Phase 7: Small captain and manager items

#### Automated

- [ ] 7.1 Backend + frontend suites green, `/verify` green

#### Manual

- [ ] 7.2 Receipt notes visible to the manager; crates inputs on a Coca-Cola order; banner on a changed dispatched order
