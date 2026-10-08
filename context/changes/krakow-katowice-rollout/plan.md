# Kraków FORUM + Katowice SUPERSAM rollout — Implementation Plan

## Overview

Make Kraków Forum (`FORUM`) and Katowice Supersam (`SUPERSAM`) live in Supply OS: captains train on Friday 2026-10-09, count stock on Sunday 2026-10-11 and order/receive from Monday 2026-10-12. Both cities buy from their own suppliers (Dis-Pack, Kuchnie Świata, Selgros, Bukat Kraków), so the global one-catalog model gets a per-location catalog, captains see only suppliers that have goods for their location, backup suppliers carry no suggestion, and a product orderable from two suppliers shows "already ordered from X".

## Current State Analysis

See `research.md`. In short:
- One global catalog: `_build_orderable_items` (`supply-os-v1/app/main.py:255-317`) shows a product under a supplier if an active `supplier_products` row exists + a settings row + active product. Prod has exactly one active row per product; `supplier_products` has no unique constraint besides the PK.
- Captain tabs = every active non-internal supplier (`frontend/src/pages/captain-mp/CaptainMP.tsx:183-203`, default `SUP_BUKAT` :69, :258-267).
- Thresholds are per (location, product), so two catalog rows for one product at one location would show the same suggestion in two tabs. Suggestion math ignores open orders (`suggestion.py:184-188`, `compute.ts:91-100`) and must stay as is.
- Inventory list = settings rows only (`main.py:3006-3071`); pack hint from location-blind `_primary_supplier_product` (`main.py:2957-2985`); stock value from location-blind `inventory_unit_price` (`app/inventory_value.py:67-93`).
- Prod: FORUM/SUPERSAM inactive, no address/company/phone; FORUM 114 template settings rows (24 non-zero), SUPERSAM 116 (all 0/0/0); no city suppliers; no orders.

## Desired End State

- A location with `locations.own_catalog = true` uses **only** catalog rows scoped to it (`supplier_products.location_id = <location>`); every other location uses **only** shared rows (`location_id IS NULL`) — Warsaw behaviour unchanged.
- Scoped rows may be marked `is_backup`: the product shows in that supplier's tab with no suggestion and no reason checks, with a note pointing at the primary supplier.
- For a product orderable from 2+ suppliers at a location, captain cards and manager order lines list open orders (captain_submitted / manager_claimed / manager_sent, last 7 days, qty > 0) of the same location+product at the *other* suppliers.
- Captains get only suppliers with at least one orderable item at their location (Warsaw too); default tab = Bukat if present, else the first.
- FORUM and SUPERSAM: complete location data, own catalog (Dis-Pack, Kuchnie Świata, Selgros per city, Bukat Kraków), thresholds from Marek's sheet, count-only 0/0/0 rows for Pago/Mory/drinks/own production (+ dairy in Katowice), Warsaw template leftovers removed, active=true.
- Verify: captain token FORUM sees tabs Bukat Kraków / Dis-Pack Kraków / Kuchnie Świata Kraków / Selgros Kraków only; SUPERSAM sees Dis-Pack / Kuchnie Świata / Selgros Katowice only; any Warsaw token sees exactly the tabs it had minus empty ones; Katowice fries show in both Kuchnie Świata (with suggestion) and Selgros (backup, no suggestion).

### Key Discoveries:

- Helper must run over all suppliers' rows before filtering by supplier (else the shared row reappears) — research §Catalog consumers.
- `suggestion_alerts_enabled` already disables every check per item (frontend `compute.ts:156-173`; backend `_evaluate_submit_line(alerts_enabled=…)` `main.py:603`, called :887 submit, :1777 edit) — backup reuses it.
- `_insert` binds every model column (`models.py:188,200`), so new non-null fields need model defaults.
- Seed backend has no `load_orders`; gate the hint with `_is_persistent()` (`main.py:517`) and fail soft like `_load_delivery_rules_safe` (`main.py:354`).
- `scripts/sync_master_data.py` / `scripts/backfill_supabase.py` drop columns missing from the Sheet header — a scoped row would turn global.

## What We're NOT Doing

- No change to suggestion math, stored suggestion fields or the suggestion-review report (backup lines mixing into averages is accepted for now).
- No Pago/Transport for Kraków/Katowice (`PAGO_ENTITY` hardcode stays; Pago products are count-only at both locations).
- No per-location delivery rules for the city suppliers until Marek gives days (calendar falls back to `suppliers.delivery_days`).
- No new products (Ręcznik 100 mb, Papryka Red Sweet), no JAX-GRILL/DIX mapping, no Kuchnie Świata mayonnaise 2,8 kg mapping — wait for Marek.
- No per-product fallback to shared rows at an own-catalog location (a product with no scoped row there is count-only).
- No location name in the inventory header, no location-scoped drafts, no eBiuro/finance setup for the new locations.
- No changes to the legacy Sheets backend beyond what reading extra columns already handles; `sync_master_data`/`backfill_supabase` are documented as unsafe for scoped rows, not rewritten.

## Implementation Approach

Additive migration with safe defaults (`own_catalog=false`, `location_id=NULL`, `is_backup=false`) so the new code is a no-op for Warsaw until data says otherwise. One pure catalog module owns the scoping rule; every location-blind consumer calls it. Hint data rides on existing payloads (no new round trips). Prod data goes in three operator-run SQL steps around the deploy because the old code ignores `location_id`.

## Critical Implementation Details

- **State sequencing (prod):** migration 0029 → SQL step A (locations + settings, no DELETE) → SQL step C (DELETE template leftovers, operator at the screen) → merge + deploy the code → verify the bundle/health → SQL step B (city suppliers + scoped rows). Scoped rows or new active suppliers inserted while the old code runs would appear in every Warsaw location.
- **Backup without a primary is invalid data:** every (location, product) with an `is_backup` row must also have a non-backup active row at that location (audit query). Grey sheet items with no other supplier at that location get a *primary* row with 0/0/0 thresholds instead.
- **Primary pick tie-break:** at an own-catalog location, `_primary_supplier_product` sees only scoped rows, prefers non-backup, then keeps the existing rule (active supplier, SUP_INTERNAL last, lowest `supplier_product_id`).

## Phase 1: Backend — scoped catalog, backup rows, captain suppliers, open-order hint

### Overview

Schema + model + one catalog module + all location-blind consumers + two payload extensions + tests.

### Changes Required:

#### 1. Migration

**File**: `supply-os-v1/migrations/0029_location_supplier_catalog.sql`

**Intent**: Add the three columns with safe defaults; idempotent like earlier migrations.

**Contract**: `locations.own_catalog boolean NOT NULL DEFAULT false`; `supplier_products.location_id text NULL REFERENCES locations(location_id)`; `supplier_products.is_backup boolean NOT NULL DEFAULT false`; `CHECK (NOT is_backup OR location_id IS NOT NULL)` named `supplier_products_backup_scoped_check`. All `IF NOT EXISTS` / guarded so a rerun is a no-op.

#### 2. Models + backends + seed

**Files**: `supply-os-v1/app/models.py`, `supply-os-v1/app/supabase_backend.py`, `docs/pita-supply-os-v1/seed/supplier_products.csv`, `docs/pita-supply-os-v1/seed/locations.csv`

**Intent**: Carry the new fields through every backend.

**Contract**: `SupplierProduct.location_id: Optional[str] = None`, `SupplierProduct.is_backup: bool = False`; `Location.own_catalog: bool = False`; add to the Supabase column lists (`_SUPPLIER_PRODUCT_COLUMNS` :110-116 and the locations column list if one exists); seed CSVs gain trailing columns (blank / `false`). Sheets backend needs no code.

#### 3. Catalog module

**File**: `supply-os-v1/app/supplier_catalog.py` (new)

**Intent**: Single owner of the scoping rule and duplicate detection.

**Contract**:
- `effective_supplier_products(sps, location: Location | None) -> list[SupplierProduct]` — active rows only; if `location.own_catalog`: rows with `location_id == location.location_id`; else rows with `location_id is None`. `location=None` → shared rows (manager/global callers).
- `multi_supplier_products(effective_sps, suppliers_by_id, products_by_id, settings_pids) -> dict[product_id, list[SupplierProduct]]` — products with ≥ 2 distinct active non-internal suppliers among rows whose product is active and has a settings row.
- Pure functions, no backend imports.

#### 4. Consumers

**File**: `supply-os-v1/app/main.py`, `supply-os-v1/app/inventory_value.py`

**Intent**: Every catalog decision goes through `effective_supplier_products`.

**Contract**:
- `_build_orderable_items` (:255-317): scope first, then supplier filter; R-35 `include_unconfigured` may drop only the settings filter. Item dict gains `is_backup: bool`, and `suggestion_alerts_enabled = supplier flag AND NOT is_backup`.
- `_resolve_master_data` (:547-566): resolve against the effective catalog of the order's location (adds the missing `active` filter). Submit (:887) and edit (:1777) pass `alerts_enabled = supplier flag AND NOT sp.is_backup` per line.
- `_primary_supplier_product` (:2957-2985) and `inventory_unit_price`: receive effective rows; prefer non-backup.
- Captain inventory products (:3037-3046), manager count detail (:3757-3767): pass the count's location.
- `_aggregate_transport_lines` (:4477-4604): include `supplier_product_id` in the aggregation key.
- Manager queue deviation count (:1165-1172): skip lines whose row `is_backup`.
- `ManagerOrderLineDetail` gains `is_backup: bool = False` (both enrichers :1341, :1457).

#### 5. Captain supplier list

**File**: `supply-os-v1/app/main.py`

**Intent**: Hide empty tabs.

**Contract**: `GET /api/captain/suppliers` (`require_captain`) → `list[Supplier]`, same order and shape as `GET /api/suppliers`, filtered to active suppliers with ≥ 1 item from `_build_orderable_items` at the token location. `GET /api/suppliers` unchanged (manager, Transport).

#### 6. Duplicate / open-order hint

**Files**: `supply-os-v1/app/models.py`, `supply-os-v1/app/main.py`

**Intent**: Tell captain and manager that a multi-supplier product is already on order elsewhere.

**Contract**:
- New model `OpenOrderRef`: `order_id, supplier_id, supplier_name, status, qty_purchase: float, purchase_unit: str | None, qty_base: float, inventory_unit: str | None, order_date, requested_delivery_date: date | None = None, captain_submitted_at: datetime | None = None`.
- Helper `_open_orders_elsewhere(backend, location_id, product_ids, *, exclude_supplier_id=None, exclude_order_id=None) -> dict[product_id, list[OpenOrderRef]]`: statuses `captain_submitted|manager_claimed|manager_sent`, same location, `captain_submitted_at` (fallback `order_date`) within the last 7 days (Europe/Warsaw), quantity from `order_qty.effective_ordered_qty` > 0, supplier ≠ excluded, order ≠ excluded. Returns `{}` when not persistent, on empty input or on any exception (logged).
- Only products in `multi_supplier_products` for that location are looked up.
- `captain_orderable` items gain `other_suppliers: [{supplier_id, supplier_name}]` (other suppliers of this product at this location, primary first), `primary_supplier_names: list[str]` (non-backup suppliers of this product, for backup items) and `open_orders_elsewhere: list[OpenOrderRef]`.
- `ManagerOrderLineDetail` gains `open_orders_elsewhere: list[OpenOrderRef] = []` for orders that are not closed/cancelled (exclude the order itself and its supplier).

#### 7. Tests + scripts note

**Files**: `supply-os-v1/tests/` (new `test_supplier_catalog.py`, `test_captain_suppliers.py`, `test_open_orders_hint.py`, `test_backup_rows.py`; extend `test_supabase_backend.py` bind test; wire 0029 into `test_supabase_integration.py` fixture + a rerun test), `supply-os-v1/scripts/sync_master_data.py`, `supply-os-v1/scripts/backfill_supabase.py` (docstring warning only)

**Intent**: Prove Warsaw is unchanged and the new rules hold.

**Contract** — named cases: shared-only location ignores scoped rows; own-catalog location ignores shared rows; inactive scoped row is ignored; two scoped suppliers → product in both tabs; backup item has `suggestion_alerts_enabled=false` and submit accepts it without a reason; captain suppliers hide a supplier with zero items; primary pick prefers non-backup and stays location-local; hint excludes closed/cancelled/older-than-7-days/zeroed lines/same supplier/other location; hint returns `{}` when the backend raises; transport aggregation keeps two rows of one supplier+product separate.

### Success Criteria:

#### Automated Verification:

- Backend suite passes: `cd supply-os-v1 && python -m pytest`
- Lint passes: `cd supply-os-v1 && ruff check .`
- Integration suite applies 0029 and passes where Postgres is available: `cd supply-os-v1 && python -m pytest -m integration`

#### Manual Verification:

- Migration 0029 applied on prod by the operator and recorded; Warsaw captain screens unchanged after deploy

---

## Phase 2: Frontend — tabs, backup cards, hint

### Overview

Consume the new endpoint and fields; keep parity with server gates.

### Changes Required:

#### 1. API + types

**Files**: `frontend/src/apiClient.ts`, `frontend/src/types.ts`

**Intent**: Captain-scoped supplier list and the new optional fields.

**Contract**: `api.captainSuppliers()` → `GET /api/captain/suppliers` with the captain token. `OrderableItem` + `ManagerOrderLineDetail` gain optional `is_backup?`, `other_suppliers?`, `primary_supplier_names?`, `open_orders_elsewhere?: OpenOrderRef[]`; new `OpenOrderRef` interface (optional where Pydantic is optional — lessons rule).

#### 2. Captain tabs

**File**: `frontend/src/pages/captain-mp/CaptainMP.tsx` (+ `lib/orderingSuppliers.ts` if needed)

**Intent**: Show only suppliers with goods; default to Bukat when present, else the first tab.

**Contract**: replaces the global supplier fetch on the captain screen only; drafts, sent-supplier tracking and next-supplier jump keep working on the filtered list.

#### 3. Product card

**Files**: `frontend/src/pages/captain-mp/components/ProductCard.tsx`, `frontend/src/pages/captain-mp/lib/compute.ts`

**Intent**: Backup items show no suggestion (tile hidden/disabled, "—", note "Sugestia u: {primary}") and always a neutral row state; any item with `open_orders_elsewhere` shows an amber line per order ("Już zamówione u {supplier}: {qty} {unit} · {status} · {date}").

**Contract**: suggestion number itself is still computed (parity) but not offered for backup items; `computeRowState` treats backup like alerts-disabled and never turns green/red.

#### 4. Manager

**Files**: `frontend/src/pages/manager/**/OrderLineTable.tsx`, `frontend/src/pages/manager/**/OrderEditPage.tsx`

**Intent**: Show the same open-order line under the product name; edit page mirrors the server gate.

**Contract**: `OrderEditPage` per-line alerts = supplier alerts AND NOT `line.is_backup`.

#### 5. Copy

**File**: `frontend/src/i18n/` (pl + en)

**Intent**: All new copy via i18n.

**Contract**: keys for the open-order line (with/without delivery date), "also available at", "suggestion at primary", backup badge; status labels reuse existing `orders.status.*`.

### Success Criteria:

#### Automated Verification:

- Frontend tests pass: `cd frontend && npm run test`
- Lint passes: `cd frontend && npm run lint`
- Build passes: `cd frontend && npm run build`

#### Manual Verification:

- On prod after deploy: a Warsaw captain sees the same tabs minus empty ones; FORUM/SUPERSAM captains see only their city suppliers

---

## Phase 3: Prod master data (operator-run SQL)

### Overview

Draft, diff, rollback and audit for both locations in the Elektrownia/Westfield pattern (`context/archive/2026-09-29-elektrownia-westfield-rollout/`), split into three steps by deploy order and DELETE handling.

### Changes Required:

#### 1. Rollout notes + diff

**File**: `context/changes/krakow-katowice-rollout/rollout-notes.md`

**Intent**: Read-only diff before (current rows → new rows) and the decision table per product: location, supplier, primary/backup, sheet value, conversion, final min/target/max.

**Contract**: sources = Marek's sheet (`sheet-mapping.md`), FORUM August values, operator data (company/addresses/phones). Rules: sheet wins; otherwise keep existing non-zero FORUM values; otherwise 0/0/0. target = max. Kraków Bukat = FORUM August values (operator decision 2026-10-08). Katowice fries: Kuchnie Świata primary (10/36, 2/4), Selgros backup.

#### 2. SQL

**Files**: `context/changes/krakow-katowice-rollout/prod-sql-A-locations-settings.sql`, `prod-sql-B-suppliers-catalog.sql`, `prod-sql-C-delete-template.sql`, `rollback.sql`

**Intent**: One transaction per step with guards (`RAISE EXCEPTION` on unexpected state, `GET DIAGNOSTICS` row counts), notes stamp `[2026-10-08 arkusz KRK/KAT, przed a/b/c]`, audit queries at the end of each file.

**Contract**:
- A: `locations` FORUM/SUPERSAM (address, city with postcode, company name/address/NIP, phone, `own_catalog=true`, `active=true`, notes with sources); settings upsert for sheet rows + count-only 0/0/0 rows (Pago, Mory, Coca-Cola, own production, Katowice dairy).
- C: backup of the template rows to be removed (literal VALUES in the file) + DELETE of settings rows not in the final set.
- B: 7 suppliers (`SUP_DISPACK_KRK`, `SUP_DISPACK_KAT`, `SUP_KUCHNIE_KRK`, `SUP_KUCHNIE_KAT`, `SUP_SELGROS_KRK`, `SUP_SELGROS_KAT`, `SUP_BUKAT_KRK`) with contacts from public sources marked "do potwierdzenia — Marek"; scoped `supplier_products` (ids `SP_<SUPPLIER>_<PID>`, units copied from the Warsaw row of the same product unless the sheet says otherwise, `is_backup` per decision table).
- Audit: min ≤ target ≤ max; no stamped row on an inactive product; every backup has a primary at its location; no shared row was touched; FORUM/SUPERSAM have no shared-catalog dependency on an order tab; Warsaw active-row count per product unchanged.

### Success Criteria:

#### Automated Verification:

- SQL files parse (dry run inside `BEGIN … ROLLBACK` on the local integration Postgres with 0029 applied): operator or agent runs them against a disposable DB

#### Manual Verification:

- Operator runs A, C (at the screen), then B after deploy; audit queries return the expected counts

---

## Phase 4: Deploy, access, go-live

### Overview

Ship in the safe order, hand tokens and a read-only smoke, update docs.

### Changes Required:

#### 1. Release

**Intent**: PR → CI green → operator applies 0029 → merge → confirm Railway health + new Vercel bundle → SQL B.

**Contract**: never claim live before checking the running artifact (lessons).

#### 2. Access + smoke

**Intent**: Operator adds `FORUM:<code>` and `SUPPLY_OS_CAPTAIN_TOKENS` pairs on Railway (codes never in the repo); agent smoke with GET only: `/api/captain/suppliers`, `/api/captain/orderable?supplier_id=…`, `/api/captain/inventory/products` for both tokens and one Warsaw token.

#### 3. Docs

**Files**: `docs/pita-supply-os-v1/COMPANY_ENTITIES.md`, `docs/pita-supply-os-v1/NEW_LOCATION_CHECKLIST.md`, `context/foundation/roadmap.md`, `context/changes/supplier-per-location/change.md`

**Intent**: Record the new locations, the own-catalog switch in the playbook, a roadmap row, and mark the old pin lane superseded.

### Success Criteria:

#### Automated Verification:

- CI green on the PR (backend ruff + pytest + integration, frontend build + lint + vitest)

#### Manual Verification:

- GET smoke passes for FORUM, SUPERSAM and one Warsaw token on prod
- Friday training: captains log in and see only their suppliers; no test order dispatched to a supplier

---

## Testing Strategy

### Unit Tests:

- Catalog scoping, duplicate detection, backup gating, primary pick, hint filters, transport key (Phase 1 list).
- ProductCard backup/hint rendering, `computeRowState` for backup, OrderEditPage gate, captain tab filtering/default.

### Integration Tests:

- 0029 applies and reruns on Postgres 16; supplier_products insert/load round-trips `location_id`/`is_backup`; locations round-trip `own_catalog`.

### Manual Testing Steps:

1. FORUM token: tabs = Bukat Kraków, Dis-Pack Kraków, Kuchnie Świata Kraków, Selgros Kraków; inventory lists sheet + count-only products.
2. SUPERSAM token: fries in Kuchnie Świata (suggestion) and Selgros (no suggestion, "Sugestia u: Kuchnie Świata Katowice").
3. Warsaw token: tabs identical to before minus empty ones; suggestions unchanged.

## Performance Considerations

The hint reads `load_orders()` (full scan) once per orderable request only when the location has multi-supplier products — Warsaw pays nothing; city volumes are tiny.

## Migration Notes

0029 is additive with defaults; rollback = drop the three columns after deleting scoped rows (in `rollback.sql`). Do not run `scripts/sync_master_data.py` or `scripts/backfill_supabase.py` after scoped rows exist.

## References

- Research: `context/changes/krakow-katowice-rollout/research.md`
- Sheet mapping: `context/changes/krakow-katowice-rollout/sheet-mapping.md`
- SQL pattern: `context/archive/2026-09-29-elektrownia-westfield-rollout/prod-sql.sql`
- Alerts-off precedent: `supply-os-v1/tests/test_suggestion_alerts_disabled.py`

## Implementation Notes (deviations from the plan above)

- Catalog module signatures take `(location_id, locations)` instead of a `Location` object (`location_scope`, `rows_in_scope`, `effective_supplier_products`); `suppliers_by_product` returns one row per supplier per product (primary first) and `multi_supplier_products` filters it to 2+ suppliers.
- `_aggregate_transport_lines` key unchanged: the city suppliers are distinct `supplier_id`s and Pago/Transport is out of scope for both cities (Pago products are count-only there), so one supplier never has two rows of one product in a Transport batch.
- Seed CSVs unchanged: the seed loader leaves the missing columns at their model defaults (`location_id=None`, `is_backup=False`, `own_catalog=False`), which is exactly the Warsaw catalog.
- Tests consolidated in `supply-os-v1/tests/test_location_catalog.py` (19 cases) instead of four files; existing stubs gained `load_locations` / `load_suppliers`.
- `tests/test_finance_routes.py` fixture dates made relative to today: the hardcoded 2026-09 dates had aged out of the 30-day window and failed on unmodified `main`.
- Frontend: the captain supplier list falls back to the global list (old client filter) on any non-401 error of `GET /api/captain/suppliers`; the edit-page gate moved to `pages/captain-mp/lib/lineToItem.ts`.
- `context/changes/supplier-per-location` is not marked superseded: own_catalog is a whole-catalog switch, so the Warsaw per-product choice that lane wanted is still open; its change.md got a cross-reference note instead.
- `scripts/backfill_supabase.py` and `scripts/sync_master_data.py` got docstring warnings only (no code change).
- `_resolve_master_data` keeps inactive rows of the location's catalog on purpose (not the planned "add the active filter"): a Captain edit must still resolve a line whose row was retired after the order was placed; orderability of NEW lines is still decided by the active-only orderable list.
- Open-order window: `captain_submitted_at` (else `order_date`) on or after today − 7 days in Warsaw dates, so the same weekday last week still counts (8 calendar days inclusive). Docstrings say so.
- The captain supplier fallback stays on any non-401 error, not only 404: if the new endpoint fails, Warsaw keeps its old tabs; at FORUM/SUPERSAM the fallback only adds empty Warsaw tabs (orderable and submit stay scoped on the server). The legacy `/captain` page uses the same loader.
- Impl review (2026-10-08, Opus): no blocker. Added tests for the captain edit of a backup line, manager add-line and `include_unconfigured` scoping, the queue backup exclusion, manager count-detail scoping/price and seed tab parity (25 cases in `test_location_catalog.py`). Rollback kill switch, a pre-deploy "no shared multi-supplier product" check and a duplicate-row audit went into the prod SQL / rollout notes.
- Known limit for training: at an own-catalog location a count-only product (Pago, Mory, drinks, own production) has no supplier row, so the inventory screen shows no pack input/hint for it — counted in base units.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — scoped catalog, backup rows, captain suppliers, open-order hint

#### Automated

- [x] 1.1 Backend suite passes
- [x] 1.2 Lint passes
- [x] 1.3 Integration suite applies 0029 and passes where Postgres is available

#### Manual

- [ ] 1.4 Migration 0029 applied on prod by the operator and recorded; Warsaw captain screens unchanged after deploy

### Phase 2: Frontend — tabs, backup cards, hint

#### Automated

- [x] 2.1 Frontend tests pass
- [x] 2.2 Lint passes
- [x] 2.3 Build passes

#### Manual

- [ ] 2.4 On prod after deploy: Warsaw captain sees the same tabs minus empty ones; FORUM/SUPERSAM captains see only their city suppliers

### Phase 3: Prod master data (operator-run SQL)

#### Automated

- [x] 3.1 SQL files parse in a BEGIN/ROLLBACK dry run on a disposable DB

#### Manual

- [ ] 3.2 Operator runs A, C, then B after deploy; audit queries return the expected counts

### Phase 4: Deploy, access, go-live

#### Automated

- [ ] 4.1 CI green on the PR

#### Manual

- [ ] 4.2 GET smoke passes for FORUM, SUPERSAM and one Warsaw token on prod
- [ ] 4.3 Friday training: captains see only their suppliers; no test order dispatched
