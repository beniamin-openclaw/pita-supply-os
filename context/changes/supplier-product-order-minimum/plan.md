# Per-supplier product order and logistic-minimum exclusions — Implementation Plan

## Overview

Two pieces of operator feedback (Marek, 28.09), one migration:

- **(a) One product order per supplier, everywhere.** A new
  `supplier_products.display_order` gives each supplier's products an explicit
  position. Every per-supplier list and document — Captain order/edit/detail/receiving,
  Manager order detail, dispatch e-mail (FE + BE twins), portal/phone/"dosyłka" copy
  lists, Transport — renders in the same canonical order. Inventory screens are out of
  scope (operator decision 3).
- **(b) Products that don't count toward a supplier's logistic minimum.** A new
  `supplier_products.counts_toward_minimum` (default true) lets Bukat's 500 PLN minimum
  ignore Tzatzyki (P011), Tirokafteri/Hot Feta (P012) and Feta blok (P014). The chip stays
  informational — nothing gates.
- **(c) SUP_INTERNAL is not an ordering supplier** (added by the operator at approval).
  "Pita Bros (internal production)" is on-site production counted in inventory only;
  it disappears from the Captain and Transport supplier pickers and the backend refuses
  a Captain submit for it. The supplier stays active in data (inventory needs it).

### Operator decisions (2026-09-28, relayed by the coordinator session)

1. Products without a position keep today's order (`supplier_product_id`), after the
   positioned ones.
2. A product the Manager adds lands at its own position, not at the end (Transport
   matrix keeps its v5.1 pin).
3. The inventory-screen layout (former Phase 4) is cut — follow-up after the new
   locations start on 1.10.
4. Hide SUP_INTERNAL from ordering (new Phase 4).
5. The chip turning "below" on most Bukat orders is expected; the operator informs the
   team.
6. Migration 0023 is written, not applied; this lane merges first on Tuesday, then the
   zero-quantity lane (0024).

## Current State Analysis

See `research.md`. In short:

- There is no position field. The Captain order screen renders the API order, which is
  `supplier_products ORDER BY supplier_product_id` (`supabase_backend.py:322`); the
  lane note claiming a name sort was wrong. That `sp_id` order is meaningful for most
  suppliers (Blue Service, Intermlecz and Coca-Cola are grouped by type).
- Submitted lines get `OL-{order}-{idx:03d}` in screen order, so everything sorting by
  `order_line_id` (e-mail FE `emailBody.ts:77-79`, BE `gmail_url.py:83-84`, copy lists
  `DispatchPanel.tsx:85`, `ResendPanel.tsx:64`) inherits the Captain screen order;
  manager-added `-M-hex` lines sort to the bottom. Transport sorts by name instead
  (`main.py:3935`, `transport.ts:322, 348-350`).
- The minimum chip (`MinimumOrderChip.tsx`) compares the server's stored
  `total_value_estimate_pln` on three screens; the queue item has no lines.
- Prod: Bukat has 14 active supplier_products (P002–P018) matching the operator list;
  of the last 15 Bukat orders, 8 that pass 500 PLN today will read "below" once the
  three products are excluded.

## Desired End State

- Bukat products appear in the order Pomidor, Cebula czerwona, Awokado, Cytryna, Ogórek,
  Papryka zielona, Sałata, Rucola, Natka, Czosnek, Cebula biała, Tzatzyki,
  Tirokafteri, Feta blok on the Captain order and edit screens, Captain order detail and
  receiving, Manager order detail, the dispatch e-mail, the portal/phone and "dosyłka"
  copy lists — for new AND already-submitted orders.
- Suppliers without positions keep today's Captain screen order (`supplier_product_id`),
  and every other surface now matches it (e-mail, Manager detail, Transport).
- The Captain order screen, the legacy `/captain` screen and the Manager Transport
  picker no longer offer "Pita Bros (internal production)"; a submit for it is a 400.
- On a Bukat order, the minimum chip compares 500 PLN against the total minus the
  excluded products and says so; orders without excluded products behave exactly as
  today. Nothing is gated.
- Verification: backend + frontend suites green, integration fixture applies 0023, a
  seed-mode preview of the Captain Bukat screen shows the new order, and after the
  operator runs `prod-sql.sql` the live Bukat screens/e-mail show it on prod.

### Key Discoveries

- `gmail_url._build_body` already receives `SupplierProduct` entries in
  `products_by_id` (dispatch merges them, `main.py:2049`) — no new plumbing for the twin.
- Two line-enrichment copies exist: inline in `manager_order_detail`
  (`main.py:1108-1145`) and `_enrich_lines_for_detail` (`main.py:1211-1262`, Captain
  detail + Transport members). Both need the sort.
- Reads are `SELECT *`; Sheets and seed drop missing columns to Pydantic defaults — old
  code tolerates the new columns and new code tolerates their absence.
- NOT NULL booleans on these models must be `bool = <default>`, never `Optional`
  (`models.py:134-145`; `_insert` binds every column).
- Migrations must not contain the percent sign (fixture runs them through psycopg2).
- Integration fixture lists migrations explicitly (`test_supabase_integration.py:90-191`).
- Transport v5.1 operator decision: manager-added matrix rows pin below the base rows
  ("powinien dodawać się od dołu", `transport.ts:286-296`). It applies to the matrix
  only; the Manager order table's "added last" is an artefact of `order_line_id` sorting.
- Every edit path is keyed by `order_line_id` / `order_id`, never by array index
  (`draftState.ts`, `OrderLineTable.tsx:97`, `ReceiveDeliveryPage.tsx:117`,
  `TransportMatrix.tsx:90-110`), so reordering lines cannot misattribute an edit.

## What We're NOT Doing

- No admin UI to edit `display_order` / `counts_toward_minimum` — master data is edited
  by SQL (diff-before / audit-after), as for every other supplier_products column.
- No gate on the minimum anywhere (submit, claim, save, dispatch, finalize) — the
  "no server-side reader that gates" property stays structural.
- No money on the Captain new-order screen (deliberate, training-feedback-0901).
- No live (draft-quantity) minimum recomputation on the Manager detail; the chip still
  updates after save/dispatch, as today.
- No rewrite of stored `order_line_id` / `receipt_line_id` / `count_line_id`; order is
  applied at read time, so historical orders render in the new order too.
- No inventory-screen reordering (Captain count grid, Manager inventory view, CSV,
  history) — cut by the operator, follow-up after 1.10.
- No deactivation of SUP_INTERNAL in data: `_primary_supplier_product` needs an active
  supplier, and inventory lists must keep grouping those products under Pita Bros.
- No change to supplier or location ordering, per-location column order in Transport,
  or finance/suggestion-review screens.
- No positions for suppliers other than Bukat in this change's data step.

## Implementation Approach

One canonical key, used on both sides of every twin:
`(display_order IS NULL, display_order, supplier_product_id)` — positions first
(ascending), then everything else by `supplier_product_id`, compared by code point.
Keying the tie-break on the ASCII id (not the name) keeps each supplier's current
Captain order and makes the Python and TypeScript comparisons byte-identical (Python
has no Polish collation). Every order line carries `supplier_product_id`, so only
`display_order` needs a master-data join, and every enrichment path already holds
`sps_by_id`.

The backend sorts at the source (orderable list, enriched order lines, receipt lines,
Transport aggregate, e-mail twin); the frontend sorts explicitly wherever it builds a
document (e-mail, copy lists) or unions rows (Transport matrix, add-all options) with a
shared comparator. The Manager order table renders the backend order as is, so a
manager-added product lands at its position (today it lands last only because its
`-M-` id sorts after digits — not a decision). Only the Transport matrix keeps
manager-added rows pinned at the bottom, per the explicit v5.1 operator rule.

The minimum basis is computed server-side on the three responses that carry the
minimum: `None` when no line on the order is excluded (the chip falls back to the
total, byte-identical behaviour for every other order); otherwise the stored total minus
the excluded lines' value (effective qty × current price), floored at 0. Anchoring to
the stored total keeps the basis consistent with the number the Manager sees and errs
toward warning if a manager zeroed an excluded line.

## Critical Implementation Details

- **Rollout order is operator-run and fixed:** apply migration 0023 on prod → merge the
  PR → confirm the new Railway backend and Vercel bundle are live → run
  `prod-sql.sql` (with explicit approval). The code is safe on a pre-0023 database
  (defaults apply), but the order follows the repo rule.
- **Code-point comparison in TypeScript:** compare `supplier_product_id` with `<` / `>`,
  not `localeCompare` — ICU collation orders `_` and digits differently from Python.
- **Manager queue gains one read** (`load_supplier_products`) to know which lines are
  excluded. It must sit after the `_is_persistent` early return (seed-mode queue tests
  expect `[]` before any master-data read); every queue test harness already patches
  `load_supplier_products` with real lists.
- **PR #33 (0021) and PR #30 (0018)** edit the same fixture block, `models.py`,
  `types.ts` and `main.py`; whichever merges second resolves small conflicts. PR #30
  also touches `_build_orderable_items`.

## Phase 1: Schema, model and the shared order key

### Overview

Add both columns end to end (migration, model, backend column list, fixture, docs,
seed) and the one comparator each side will use. No behaviour change yet.

### Changes Required

#### 1. Migration 0023

**File**: `supply-os-v1/migrations/0023_supplier_product_display_order_minimum.sql`

**Intent**: Add the two columns, additive only, in the 0022 banner style (purpose,
numbering note: 0018 = PR #30, 0021 = PR #33; no-percent rule; apply before backend;
rollback lines).

**Contract**: `ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS display_order
integer;` and `ADD COLUMN IF NOT EXISTS counts_toward_minimum boolean NOT NULL DEFAULT
true;`. No CHECK, no index (≈200 rows, sorting happens in Python).

#### 2. Model and backend column list

**Files**: `supply-os-v1/app/models.py`, `supply-os-v1/app/supabase_backend.py`

**Intent**: Expose both fields on `SupplierProduct`; bind them on insert.

**Contract**: `display_order: Optional[int] = None`; `counts_toward_minimum: bool = True`
(comment: NOT NULL, same reason as `warehouse_pickup`). Append both names to
`_SUPPLIER_PRODUCT_COLUMNS`.

#### 3. Shared order key (backend)

**File**: `supply-os-v1/app/product_order.py` (new, flat module)

**Intent**: One place defining the canonical key so `main.py` and `gmail_url.py` cannot
drift, with a docstring naming the TS twin.

**Contract**: `supplier_product_sort_key(display_order: Optional[int],
supplier_product_id: str) -> tuple` returning `(display_order is None, display_order or
0, supplier_product_id)`; plus `line_sort_key(sps_by_id)` returning a key function for
anything with `.supplier_product_id` (lines whose sp is unknown sort as position-less).
Comment the id-namespace assumption `gmail_url` already relies on: its merged
`products_by_id` holds `P…` product ids and `SP_…` supplier-product ids side by side.

#### 4. Shared comparator (frontend)

**File**: `frontend/src/lib/productOrder.ts` (new)

**Intent**: TS twin of the key; code-point comparison; header comment naming
`product_order.py`.

**Contract**: `export interface ProductOrderKey { display_order?: number | null;
supplier_product_id?: string | null }`; `export function compareProductOrder(a, b):
number`. (The `-M-` detector stays in `transport.ts`, its only user.)

#### 5. Types

**File**: `frontend/src/types.ts`

**Intent**: Mirror the new response fields as optional (lesson: mirror Pydantic
optionality).

**Contract**: `display_order?: number | null` on `OrderableItem`,
`ManagerOrderLineDetail`, `TransportAggregateLine`; `minimum_basis_value_pln?: number |
null` on `ManagerQueueItem`, `ManagerOrderDetail`, `CaptainOrderDetail`.

#### 6. Integration fixture, docs, seed

**Files**: `supply-os-v1/tests/test_supabase_integration.py`,
`docs/pita-supply-os-v1/DATA_MODEL.md`, `docs/pita-supply-os-v1/seed/supplier_products.csv`

**Intent**: Wire 0023 into `_schema` after 0022 with the standard comment; extend the
master-data round-trip to assert the two defaults and a non-null round-trip; document
both columns; add the two columns to the seed CSV with the Bukat positions (10…140 in
the operator order) and `FALSE` for P011/P012/P014, blanks elsewhere, so seed-mode dev
mirrors prod after the data step.

#### 7. Prod data script (written, not run)

**File**: `context/changes/supplier-product-order-minimum/prod-sql.sql`

**Intent**: The operator-run data step, following `pago-suggestion-no-alerts` /
lessons "diff before, audit after".

**Contract**: (1) diff-before SELECT of all SUP_BUKAT rows (`supplier_product_id,
product_id, active, display_order, counts_toward_minimum`) plus a global count of
non-null positions / excluded rows (expected 0/0); (2) `UPDATE … FROM (VALUES
('SP_BUKAT_P006',10), ('SP_BUKAT_P016',20), ('SP_BUKAT_P004',30), ('SP_BUKAT_P002',40),
('SP_BUKAT_P005',50), ('SP_BUKAT_P003',60), ('SP_BUKAT_P008',70), ('SP_BUKAT_P007',80),
('SP_BUKAT_P009',90), ('SP_BUKAT_P010',100), ('SP_BUKAT_P018',110), ('SP_BUKAT_P011',120),
('SP_BUKAT_P012',130), ('SP_BUKAT_P014',140))` scoped `AND supplier_id='SUP_BUKAT'`;
`UPDATE … SET counts_toward_minimum=false WHERE supplier_id='SUP_BUKAT' AND
supplier_product_id IN ('SP_BUKAT_P011','SP_BUKAT_P012','SP_BUKAT_P014')`; (3) audit:
exactly 14 positioned rows, all SUP_BUKAT, 14 distinct positions; exactly those 3
excluded rows; (4) commented rollback. Ids only — never names (a parallel session is
renaming P011/P012/P014). Gaps of 10 let a later product slot in without renumbering.

### Success Criteria

#### Automated Verification

- `cd supply-os-v1 && python -m pytest` passes (new model defaults + supabase binding test)
- `cd supply-os-v1 && ruff check .` clean
- Unit tests for `supplier_product_sort_key` / `compareProductOrder` (positions first,
  nulls last, tie by id, equal positions tie by id) pass
- `pytest -m integration` applies 0023 and the round-trip test passes (locally when a
  Postgres is available, otherwise in CI `backend-integration`)
- `cd frontend && npm run build && npm run lint && npm run test` green

#### Manual Verification

- Migration file has no percent sign and matches the 0022 banner conventions
- `prod-sql.sql` reviewed: ids match the operator list, scoped to SUP_BUKAT

**Implementation Note**: pause after this phase only if automated checks fail; the
manual checks are reviewed at impl-review.

---

## Phase 2: Canonical order on every per-supplier surface

### Overview

Apply the key at every producer and document builder for a single supplier's products.

### Changes Required

#### 1. Orderable list

**File**: `supply-os-v1/app/main.py` (`_build_orderable_item`, `_build_orderable_items`)

**Intent**: Emit orderable items in canonical order and carry `display_order`. This one
change reorders the Captain order and edit screens, the Manager add-line picker and the
Transport prefill line ids.

**Contract**: item dict gains `display_order`; list sorted by
`supplier_product_sort_key(sp.display_order, sp.supplier_product_id)`.

#### 2. Order-line enrichment

**File**: `supply-os-v1/app/main.py` (`manager_order_detail` inline enrichment,
`_enrich_lines_for_detail`)

**Intent**: Enriched lines carry `display_order` and come back in canonical order, so
the Captain detail, Captain receiving, Manager detail and Transport member orders all
read the same order, for historical orders too.

**Contract**: `ManagerOrderLineDetail.display_order: Optional[int] = None`
(`models.py`); both enrichment paths sort with `line_sort_key(sps_by_id)`.

#### 3. Receipt lines

**File**: `supply-os-v1/app/main.py` (`_load_order_receipts`, `captain_receipt_detail`)

**Intent**: Delivery sections list received lines in the same order.

**Contract**: sort each receipt's enriched lines by `line_sort_key(sps_by_id)`; response
models unchanged.

#### 4. Transport aggregate

**File**: `supply-os-v1/app/main.py` (`_aggregate_transport_lines`, weighted copy in
`manager_transport_batch_detail`)

**Intent**: Replace the code-point name sort with the canonical key; expose
`display_order` on `TransportAggregateLine`.

**Contract**: `TransportAggregateLine.display_order: Optional[int] = None`; sort by the
group's sp position then `supplier_product_id`; docstring updated. The weighted copy
keeps that order.

#### 5. Dispatch e-mail twins

**Files**: `supply-os-v1/app/gmail_url.py`, `frontend/src/pages/manager/lib/emailBody.ts`

**Intent**: Both builders number visible lines in canonical order; update both "keep in
sync" comments.

**Contract**: BE sorts `visible` by `supplier_product_sort_key(getattr(products_by_id.get(
ln.supplier_product_id), "display_order", None), ln.supplier_product_id)`; FE sorts by
`compareProductOrder`. Everything else in the body is unchanged.

#### 6. Copy lists

**Files**: `frontend/src/pages/manager/DispatchPanel.tsx`,
`frontend/src/pages/manager/ResendPanel.tsx`

**Intent**: Portal/phone and "dosyłka" copy lists use `compareProductOrder` instead of
`order_line_id`.

#### 7. Transport matrix and add-all options

**File**: `frontend/src/pages/manager/lib/transport.ts`

**Intent**: The matrix sorts base rows with `compareProductOrder` (rows carry
`display_order` and `supplier_product_id` from their first line) and keeps the v5.1
manager-added pin; `buildTransportAddAllOptions` sorts with `compareProductOrder`. The
Manager order table needs no change — it renders the (now canonical) backend order.

**Contract**: `TransportMatrixRow` gains `display_order?: number | null` and
`supplier_product_id: string`. Tests: fixtures in `transport.test.ts` get distinct
`supplier_product_id`s (the `orderLine` fixture defaults every line to `"SP1"`,
`:383-390`, which would tie every row); update `:450-481` and `:484-501`.

#### 8. Captain edit fallback

**File**: `frontend/src/pages/captain-mp/OrderEditPage.tsx`

**Intent**: `lineToItem` copies `display_order` so the fallback list keeps the field;
the list itself follows the (now canonical) API order.

### Success Criteria

#### Automated Verification

- Backend tests: orderable list sorted by position then id (Bukat seed rows come back in
  the operator order; a supplier without positions keeps `sp_id` order)
- Backend tests: `manager_order_detail` and `captain_order_detail` return lines in
  canonical order regardless of `order_line_id` order; receipt lines likewise
- Backend test: `_aggregate_transport_lines` canonical order (replaces
  `test_aggregate_sorted_by_product_name`; missing sp → position-less, by id)
- Backend test: `gmail_url` body numbers lines by position, not by `order_line_id`
- FE tests: `buildEmailBody` multi-line order (a manager-added line lands at its
  position); `buildTransportMatrix` base rows canonical + manager-added pinned (updated
  tests at `transport.test.ts:450-501`, distinct sp ids); `buildTransportAddAllOptions`
  canonical
- FE and BE e-mail bodies for the same fixture list the same order (twin test on the
  same data in both suites)
- Full suites, ruff, build, lint green

#### Manual Verification

- Seed-mode preview (`SUPPLY_OS_DATA_BACKEND=seed`, Homebrew node): Captain Bukat screen
  shows Pomidor, Cebula czerwona, Awokado, …, Feta blok, then `SP_BUKAT_P135` Bombilla
  position-less (it is active in the seed, inactive on prod); another supplier (Blue
  Service) shows its unchanged order

---

## Phase 3: Minimum basis without excluded products

### Overview

Compute the basis server-side on the three responses that already carry the minimum and
teach the chip to use it and say so.

### Changes Required

#### 1. Basis helper and responses

**Files**: `supply-os-v1/app/main.py`, `supply-os-v1/app/models.py`

**Intent**: One pure helper; three callers.

**Contract**: `_minimum_basis_value(total: Optional[float], lines: list[OrderLine],
sps_by_id: dict[str, SupplierProduct]) -> Optional[float]` — `None` when `total` is
`None` or no line's sp has `counts_toward_minimum` false; else
`round(max(0.0, total − Σ _effective_ordered_qty(line) × (sp.price_estimate_pln or
0)), 2)` over the excluded lines. New field `minimum_basis_value_pln: Optional[float] =
None` on `ManagerQueueItem`, `ManagerOrderDetail`, `CaptainOrderDetail`.
`manager_queue` loads `sps_by_id` once per request (after the `_is_persistent`
early return and the page slice); the detail routes reuse their existing `sps_by_id`.
No write path, no gate reads it. Docstring states the two known drifts: a line the
Manager zeroed (stored `manager_final = 0`) is valued at its `captain_final`, so an
excluded zeroed line lowers the basis (warns more, never less); a later master-data
price edit moves the basis but not the stored total.

#### 2. Chip

**Files**: `frontend/src/components/ui/MinimumOrderChip.tsx`,
`frontend/src/pages/manager/ManagerQueue.tsx`,
`frontend/src/pages/manager/OrderDetailPane.tsx`,
`frontend/src/pages/captain-mp/OrderDetailPage.tsx`, `frontend/src/i18n/strings.ts`

**Intent**: The chip takes an optional `basis`; it compares `basis ?? total` and, when a
basis is present, uses a copy that names the counted amount. Callers pass
`minimum_basis_value_pln`. Header comments restate "informational only".

**Contract**: new prop `basis?: number | null`; new key `minOrder.belowBasis` — pl
"Poniżej progu zamówienia (min. {minimum} PLN) — do progu liczy się {basis} PLN", en
"Below order minimum (min. {minimum} PLN) — {basis} PLN counts toward it".
`checkMinimumOrder` unchanged.

### Success Criteria

#### Automated Verification

- Backend tests for `_minimum_basis_value`: no excluded line → `None`; excluded lines →
  total − their value; manager_final > 0 used over captain_final; manager_final 0 with
  captain_final > 0 is valued at captain_final (documented drift); missing price → 0
  contribution; floor at 0; `total None` → `None`
- Route tests: queue item, Manager detail and Captain detail carry the basis for an
  order with an excluded line and `None` otherwise (extend `test_manager_queue.py:654-709`,
  `test_captain_orders.py:605-627`)
- Test proving no gate: a below-basis Bukat order still submits, claims and dispatches
  (seed/mock backends, no real send)
- FE test (new `MinimumOrderChip.test.tsx`): basis below minimum renders the basis copy;
  basis at/above minimum renders nothing even when total would be below; no basis falls
  back to total with the original copy
- Full suites, ruff, build, lint green

#### Manual Verification

- After deploy + data step: a Bukat order containing Tzatzyki/Feta shows the basis chip
  on the queue card and in the Manager and Captain detail; a Bukat order without them
  shows the old behaviour

---

## Phase 4: SUP_INTERNAL is not an ordering supplier

### Overview

On-site production ("Pita Bros (internal production)", `SUP_INTERNAL`) is counted in
inventory but never ordered (0 orders on prod), yet the Captain supplier picker offers
it. Hide it from ordering pickers and refuse it server-side, without touching data.

### Changes Required

#### 1. Shared constant (frontend)

**File**: `frontend/src/lib/orderingSuppliers.ts` (new)

**Intent**: One place mirroring `main.py` `_INTERNAL_SUPPLIER_ID`.

**Contract**: `export const INTERNAL_SUPPLIER_ID = "SUP_INTERNAL"`;
`export function isOrderingSupplier(s: Pick<Supplier, "supplier_id" | "active">):
boolean` — active and not internal.

#### 2. Supplier pickers

**Files**: `frontend/src/pages/captain-mp/CaptainMP.tsx` (supplier fetch ~`:127`),
`frontend/src/pages/CaptainPage.tsx` (`/captain`, `:22`),
`frontend/src/pages/manager/TransportPage.tsx` (~`:248`)

**Intent**: Filter suppliers with `isOrderingSupplier` where each screen builds its
picker list (CaptainMP and Transport already filter `active`; the legacy page filters
nothing today).

#### 3. Backend guard

**File**: `supply-os-v1/app/main.py` (`captain_submit`)

**Intent**: Defense in depth — a submit for `SUP_INTERNAL` is a 400 before any write,
with a detail naming it as internal production.

**Contract**: `400` when `req.supplier_id == _INTERNAL_SUPPLIER_ID` (constant moved above
its first use if needed). Inventory endpoints, `_primary_supplier_product` and the
supplier row are untouched.

### Success Criteria

#### Automated Verification

- Backend test: `POST /api/captain/submit` with `SUP_INTERNAL` → 400, nothing persisted
- FE test: `isOrderingSupplier` drops `SUP_INTERNAL` and inactive suppliers, keeps others
- Full suites, ruff, build, lint green

#### Manual Verification

- Seed-mode preview: the Captain supplier picker has no "Pita Bros (internal
  production)"; the Captain count grid still shows the Produkcja products

---

## Phase 5: Release (operator-run, after approval)

### Overview

PR, then the fixed rollout order. Nothing here runs without the operator's explicit go.

### Changes Required

- PR with the plan's verification evidence; STOP before merge; report the PR link to
  the coordinator session. Migration 0023 is NOT applied from this lane.
- `change.md` gets a "Deploy order" section (mirrors `pago-suggestion-no-alerts`).

### Success Criteria

#### Automated Verification

- CI green on the PR (backend, backend-integration, frontend)

#### Manual Verification

- Operator approves and migration 0023 is applied on prod (`list_migrations` shows it)
- PR merged; Railway `/health` and a new Vercel production bundle for the merge commit
  confirmed live
- Operator approves and `prod-sql.sql` runs: diff saved, audit returns 14 positions /
  3 exclusions
- Live check on prod: Captain Bukat screen and a Manager Bukat detail show the new
  order; an existing Bukat order with Tzatzyki shows the basis chip; no order was
  dispatched as part of the check

## Testing Strategy

### Unit Tests

- Key/comparator twins (BE + FE) on identical fixtures, including equal positions and
  unknown suppliers.
- Pure helpers: `_minimum_basis_value`, `_aggregate_transport_lines`, `buildEmailBody`,
  `buildTransportMatrix`, `buildTransportAddAllOptions`, `isOrderingSupplier`.

### Integration Tests

- Fixture applies 0023; round-trip of both columns (defaults and set values) through
  `load_supplier_products`.

### Manual Testing Steps

1. Seed-mode preview: Captain → Bukat → order matches the operator list; Blue Service
   unchanged.
2. Seed-mode preview: Captain supplier picker has no "Pita Bros (internal production)".
3. Prod after data step: Captain Bukat screen, Manager Bukat detail, e-mail preview in
   the dispatch panel (do not send), queue chip on a Bukat order with Tzatzyki.

## Performance Considerations

One extra `load_supplier_products` per queue poll (~200 rows, one SELECT on Supabase,
TTL-cached on Sheets). All sorting is in-process over tens of rows.

## Migration Notes

- 0023 is additive; old code ignores the columns, new code defaults when they are
  absent. Rollback: drop both columns (commented in the file) — only after reverting the
  code that binds them on insert (`_SUPPLIER_PRODUCT_COLUMNS`), which runtime never
  exercises (supplier_products are not inserted by the app).
- Data rollback is the diff-before output plus the commented UPDATE in `prod-sql.sql`.

## References

- Research: `context/changes/supplier-product-order-minimum/research.md`
- Precedent flag + data step: `context/changes/pago-suggestion-no-alerts/`
- Minimum chip origin: `context/archive/2026-09-01-training-feedback-0901/plan.md:144-154`
- Transport pin rule: `context/archive/2026-08-21-to-ordering-pago/plan.md:394`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, model and the shared order key

#### Automated

- [x] 1.1 Backend pytest passes (model defaults + supabase binding test) — f0fc1ed
- [x] 1.2 Ruff clean — f0fc1ed
- [x] 1.3 Order key/comparator unit tests pass — f0fc1ed
- [x] 1.4 Integration fixture applies 0023 and round-trip passes — f0fc1ed
- [x] 1.5 Frontend build, lint, test green — f0fc1ed

#### Manual

- [x] 1.6 Migration file free of the percent sign, 0022 conventions — f0fc1ed
- [x] 1.7 prod-sql.sql ids match the operator list, scoped to SUP_BUKAT — f0fc1ed

### Phase 2: Canonical order on every per-supplier surface

#### Automated

- [x] 2.1 Orderable list sorted by position then id — a46b2a0
- [x] 2.2 Manager and Captain detail lines canonical; receipt lines canonical — a46b2a0
- [x] 2.3 Transport aggregate canonical order — a46b2a0
- [x] 2.4 gmail_url body numbered by position — a46b2a0
- [x] 2.5 FE email, matrix and add-all options tests — a46b2a0
- [x] 2.6 FE/BE e-mail twin order test on shared fixture — a46b2a0
- [x] 2.7 Full suites, ruff, build, lint green — a46b2a0

#### Manual

- [x] 2.8 Seed preview: Captain Bukat order matches operator list (+ Bombilla last); Blue Service unchanged — a46b2a0

### Phase 3: Minimum basis without excluded products

#### Automated

- [x] 3.1 _minimum_basis_value unit tests — c00557f
- [x] 3.2 Queue, Manager detail, Captain detail carry the basis — c00557f
- [x] 3.3 No-gate test: below-basis order submits, claims, dispatches — c00557f
- [x] 3.4 MinimumOrderChip component tests — c00557f
- [x] 3.5 Full suites, ruff, build, lint green — c00557f

#### Manual

- [ ] 3.6 Prod: Bukat order with excluded products shows the basis chip; others unchanged

### Phase 4: SUP_INTERNAL is not an ordering supplier

#### Automated

- [x] 4.1 Captain submit for SUP_INTERNAL returns 400, nothing persisted — 10259f2
- [x] 4.2 isOrderingSupplier unit tests — 10259f2
- [x] 4.3 Full suites, ruff, build, lint green — 10259f2

#### Manual

- [x] 4.4 Seed preview: no Pita Bros in the Captain picker; Produkcja still in the count grid — 10259f2

### Phase 5: Release (operator-run, after approval)

#### Automated

- [ ] 5.1 CI green on the PR

#### Manual

- [ ] 5.2 Migration 0023 applied on prod after approval
- [ ] 5.3 PR merged; Railway and Vercel builds confirmed live
- [ ] 5.4 prod-sql.sql run after approval; audit 14 positions / 3 exclusions
- [ ] 5.5 Live check on prod, no order dispatched
