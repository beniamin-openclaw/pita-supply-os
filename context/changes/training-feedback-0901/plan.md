# Training-feedback 0901 — Implementation Plan

## Overview

One project, five phases, landing the 2026-09-01 training feedback. Phases are ordered by
the operator's own sequencing: app changes first, then the master-data batch, then the
transport documents. Each phase is independently shippable and independently revertible;
none depends on a later one.

## Current State Analysis

Five locations live (WOLA, BRACKA, KEN, NORBLIN, BROWARY). Captain does inventory counts,
per-supplier orders and goods receiving; Manager runs the queue and the Transport
workstation. Backend is Supabase-backed FastAPI on Railway, frontend Vite/React on Vercel,
both auto-deploying from `main`. See `research.md` for the grounded state of every area
this plan touches.

## Desired End State

- A Captain can apply one deviation reason to the whole order in a single click, add a
  product that is not in the catalogue, and leave an order-level comment.
- A submitted inventory count can be corrected without redoing it, leaving an audit trail.
- Master data matches physical reality for units, packaging and the SKU splits the operator
  named.
- The Pago self-pickup document lists only goods actually collected from the warehouse, over
  the correct legal entity.

### Key Discoveries

- The Pago document bug is a **classification** gap, not a supplier-mixing bug — verified on
  prod (`research.md`, Summary #1). No `TRN-` batch has ever contained two suppliers.
- `orders.notes` is already overloaded as the manager send-back reason, so ad-hoc items need
  their own column.
- `inventory_counts` is the only persisted entity with no update path in either backend.
- The Captain order screen cannot show money at all — `price_estimate_pln` never reaches it.
- `Corfu Pilsner` (P157) exists; only its thresholds and packaging are wrong.
- Nine prod backup tables have RLS disabled.

## What We're NOT Doing

- **Not** changing the 25% deviation threshold (operator decision: stays as-is).
- **Not** adding a package/crate rounding rule — the override stays the Captain's tool.
- **Not** adding per-employee logins; name attribution stays free text.
- **Not** building Telegram notifications, delivery-schedule templates, cross-supplier order
  combining, or the Goorder availability agent — those are a separate later change.
- **Not** exposing prices on the Captain entry screen (would require new backend plumbing;
  the minimum indicator lands Manager-side instead).
- **Not** touching `claude/multi-location-master-data` or migration 0008.

## Implementation Approach

Frontend-only work first (fastest to verify, zero migration risk), then the three migrations
in dependency order, then the prod data batch, then the documents. Every migration is applied
by the operator in the Supabase SQL Editor **before** the code that reads it is pushed.

## Critical Implementation Details

- All persistence goes through `_choose_backend()`; every new data-layer function is
  implemented in **both** `app/sheets.py` and `app/supabase_backend.py` with the same
  signature. `test_supabase_backend.py:317`'s parity check is one-directional — it will
  not catch a Sheets-side omission, so check by hand.
- **A new column's Pydantic default matches its DDL default** — `NOT NULL DEFAULT ''`
  becomes `field: str = ""`, never `Optional[str] = None`. `supabase_backend._insert`
  binds every column in the list, so an `Optional = None` against a `NOT NULL` column
  raises `IntegrityError` on the primary write path. `sheets._validate_headers` keys off
  `field.is_required()`, so any default already makes the worksheet column optional.
  Precedent: `0004` / `cancel_reason` (`models.py:173`). See `hardening.md` B2.
- **Every migration is wired into `tests/test_supabase_integration.py`** — a `read_text()`
  binding, an `exec_driver_sql` call in numeric order, and for a new table also
  `_ALL_TABLES` (children-first) and `_TXN_TABLES`. The fixture's own comments repeat this
  six times. Default `pytest` excludes the integration mark, so a miss only shows in CI.
- The inventory audit log follows `_log_transport_event`'s best-effort contract
  (`main.py:1476-1514`): a logging failure must never fail the correction that succeeded.
- Auth-scoped screens are verified with auth ENABLED and only the token that role holds.
- Anything touching the PDF pipeline gets a live browser check, not just green unit tests.

---

## Phase 0: Prod hygiene — RLS on backup tables

Nine snapshot tables (`_lps_backup_20260831`, `_training_bak_*`, `_draft_bak_*`) have RLS
disabled and are reachable with the anon key; every real table carries deny-all from
`0002_rls_deny_all.sql`.

**Changes**: `prod-sql-phase0.sql` — `ENABLE ROW LEVEL SECURITY` on all nine, with `DROP`
offered as a commented alternative per table.

**Success**: `relrowsecurity = false` returns zero rows in `public`. Prod-only; handed to
the operator, not executed here.

---

## Phase 1a: Captain UX — zero backend

No migration, no backend, no new data source. Ships and verifies on its own.

### Changes Required
1. **Overrule-all reason** — new `components/OverruleAllControl.tsx`, rendered as a sibling
   of `PrefillControl` (`CaptainMP.tsx` ~619). One batched `setLines` patching every line
   where `computeRowState(...).requiresReason` is true **and no reason is set yet**.
   Fill-empties only — no destructive overwrite variant (`hardening.md` O2). Choosing
   `OTHER` requires the shared comment, matching `ReasonPicker.tsx:32-33`.
   The selection logic goes in `lib/` as a pure function so it is unit-testable.
2. **Name suggestions** — shared `<datalist>` fed from `localStorage` per role+location,
   appended on each successful submit; applied to `ordered_by`, `count_user`,
   `received_by`. Adds the missing `autoComplete="name"` on `ReceiveDeliveryPage.tsx:228-237`.

### Success Criteria
- One click sets a reason on every deviating line; a hand-picked reason is never replaced.
- Three letters in "kto zamawia" suggest a previously used name.
- `npm run test | build | lint` green.

---

## Phase 1b: Ad-hoc items + order comment (migration 0013)

### Changes Required
1. **Migration `0013_order_extra_items_and_note.sql`** — two columns:
   `orders.extra_items text NOT NULL DEFAULT ''` and
   `orders.captain_note text NOT NULL DEFAULT ''`. The comment gets its **own** column:
   `orders.notes` is overwritten by `manager_release` (`main.py:1554`) and blanked by
   `captain_order_edit` (`main.py:1366`), so reusing it silently destroys the Captain's
   text (`hardening.md` D2). Wire into the integration fixture.
2. **Models** — `Order.extra_items: str = ""`, `Order.captain_note: str = ""`;
   same on `CaptainSubmitRequest`, `CaptainEditRequest`, `ManagerOrderDetail`,
   `CaptainOrderDetail`; `supabase_backend._ORDER_COLUMNS:107-113`;
   `frontend/src/types.ts` mirrors (optional on the TS side per `lessons.md`).
3. **Frontend** — a "+ dodaj produkt" control collecting `nazwa / ilość / jednostka` rows
   serialised one per line into `extra_items`, and a comment textarea writing
   `captain_note`; replaces the hardcoded `notes: ""` at `CaptainMP.tsx:418`.
4. **Both email builders** — `frontend/src/pages/manager/lib/emailBody.ts` (authoritative,
   per its own comment at `:23-28`) **and** backend `gmail_url.build_draft_url`. Patching
   only one produces a green suite and a supplier email missing the items
   (`hardening.md` B3). Update `emailBody.test.ts`.
5. **Manager detail** — render both fields read-only in `OrderDetailPane`.

### Success Criteria
- An ad-hoc item and a comment survive submit → manager detail → **the real Gmail draft**.
- A manager send-back no longer destroys the Captain's comment.
- Integration suite green against the demo DB (proves the `NOT NULL` binding).

---

## Phase 1c: Minimum-order indicator

`minimum_order_value_pln` is joined onto `ManagerQueueItem`, `ManagerOrderDetail` and
`CaptainOrderDetail` server-side — cheaper than a per-screen supplier fetch, and it avoids
`apiClient.ts:306`'s `"captain"` role default that `lessons.md` records silently 401-ing a
Manager screen (`hardening.md` G4). Rendered next to the existing total in
`OrderDetailPane.tsx:223-226`, `ManagerQueue.tsx:167`, `OrderDetailPage.tsx:170-172`,
value `?? 400`. Neutral chip at or above, warning chip below. **No server-side reader** —
the no-gate property is structural, not a convention.

**Success**: a below-minimum order still submits and still dispatches.

---

## Phase 2: Inventory count — safe edit with audit log (migration 0014)

### Changes Required
1. **Migration `0014_inventory_count_edit.sql`** — new `inventory_count_events` table
   (modelled on `0010_transport_events.sql`: PK, `count_id`, `event_type`, `actor`, `at`,
   `details text NOT NULL DEFAULT ''`, index, deny-all RLS) **plus**
   `inventory_counts.last_edited_at timestamptz`. Wire into the fixture: bindings,
   `exec_driver_sql`, `_ALL_TABLES` (before `inventory_counts`), `_TXN_TABLES`.
2. **Replace semantics** — the edit deletes the count's lines and appends the new set,
   mirroring the tested `replace_order_lines_atomic` path. This resolves the
   `count_line_id` collision, the absent `(count_id, product_id)` uniqueness, and the
   "Captain blanks a product" case (blank = not counted = no line) in one move
   (`hardening.md` G1/G2).
3. **Seam, both backends** — `delete_inventory_count_lines`, `update_inventory_count`
   (**required**: `line_count` is a denormalisation both list endpoints read —
   `main.py:2336`, `:2489`, pinned by `test_inventory_counts.py:163-176`),
   `append_inventory_count_event`, `load_inventory_count_events_for`.
4. **Route** — `PATCH /api/captain/inventory/count/{count_id}`, Captain auth, strict
   location scope (404 on foreign), `edited_by` required. Computes the old-vs-new diff
   **before** the write, then emits one event via a best-effort `_log_inventory_event`.
   `count_submitted_at` is preserved as the original submit moment; `last_edited_at` is
   stamped (`hardening.md` G3).
5. **Frontend** — "Popraw" from the counts list, reusing the count grid pre-filled from
   the snapshot; name required before save; edit history shown read-only.
6. **Category labels** — `categoryLabel(key)` in `i18n/` mapping the 10 live categories to
   EN, falling back to the raw value. Category labels translate; **product names never do**.
7. **Docstrings** — three places assert immutability and must be corrected:
   `models.py` `InventoryCount`, `sheets.append_inventory_count`,
   `main.py` `captain_inventory_submit` (`hardening.md` D6).

### Success Criteria
- A partial count is completed later without a new `count_id`; `line_count` updates.
- Every edit yields an event row with actor, timestamp and a per-product diff.
- An event-write failure does not fail the edit.
- A foreign location's count returns 404.

---

## Phase 3: Master-data batch

Written and validated against the demo DB; **applied to prod by the operator**.
`prod-sql-phase3.sql` in the `wolska-blueservice-master-data` shape: BEFORE snapshot →
idempotent apply → audit + rollback.

### Unblocked now
- `P135 Bombilla` → `active = false`.
- `P012 Tirokafteri` → `units_per_purchase_unit` 3 → 2 (both supplier rows); the
  `SUP_PAGO` row's `purchase_unit` `kg` → `wiadro`.
- `P157 Corfu Pilsner` → `zgrzewka` / 6, plus `location_product_settings` for WOLA,
  BRACKA, KEN.
- `Allegro`, `Selgros` → `active = true`.
- **Gyros split**: `P037` deactivated (order history references it), replaced by four
  `Produkcja` SKUs — wieprzowy ścięty / wieprzowy nieścięty / kurczak ścięty / kurczak
  nieścięty. Thresholds: all four at KEN, the two pork ones at WOLA, BRACKA, NORBLIN,
  BROWARY.
- Gas cylinder full vs empty (split from `P134`); cooked chickpeas in `Produkcja`
  alongside `P036`, and `P036` renamed to name the cooked state.

### Still blocked
Roll pack sizes, tapes, crates, bottle-crate rules, supplier minimums (Marek —
https://trello.com/c/UIpn3qyg and https://trello.com/c/PG9I61nu, both due 2026-09-04);
the Pago chicken-gyros **block** SKU (operator confirmation).

### Success Criteria
Audit returns zero rows for `min > max`, `target <> max`, orphan FKs, duplicate
`(location_id, product_id)`, placeholder names, and any new product without a
`supplier_products` row. A SELECT-diff of every touched row is saved before the apply.

---

## Phase 4: Transport and driver documents (migration 0015)

### Changes Required
1. **Entity swap** — `PAGO_ENTITY` (`transport.ts:675-680`) → Pita Bros sp. z o.o.,
   NIP 9522100633, ul. W. Laskonogiego 9, 02-496 Warszawa. Also the title bar
   (`transport.ts:719`), the i18n pickup bar (`strings.ts:1267-1270`), and the two tests
   asserting the old values (`transport.test.ts:689-700`, `transportPdf.test.ts:192-197`).
   The constant stays hardcoded — a batch spans locations belonging to different spółki,
   so there is no single `Location.company_*` to source from (`hardening.md` G6).
   The pickup bar names the *warehouse* rather than the buyer; changed per the operator's
   blanket instruction and flagged in the handover (`hardening.md` D5).
2. **Migration `0015_supplier_product_warehouse_pickup.sql`** —
   `supplier_products.warehouse_pickup boolean NOT NULL DEFAULT false`. Model as
   `bool = False`. Wire into the fixture; add to `_SUPPLIER_PRODUCT_COLUMNS:96-101` and
   `TransportAggregateLine`.
3. **Ordered rollout** — migration → **data pass** (`UPDATE ... SET warehouse_pickup =
   true` for the Pago cold/frozen SKUs, SELECT-diff saved first) → **only then** the
   filtering code. Shipping the filter first blanks the pickup PDF, since the column
   defaults false on every row (`hardening.md` B4).
4. **Scope of the filter** — only `buildTransportPagoPrintDoc` filters. The Pago **order**
   email (`buildTransportEmailBody`) and the order draft still cover the whole batch: Pago
   is the purchasing channel, the warehouse run is a subset (`hardening.md` G7).
5. **Batch supplier from the header** — `main.py:3438-3441` currently derives
   `batch_supplier_id` from `group[0].supplier_id`; prefer `header.supplier_id` when a
   header exists. The broader aggregate supplier filter is **cut** — the research proved
   the state unreachable and it carried a 12-test blast radius (`hardening.md` D3/O1).
6. **Driver list** — drop the `LOC • ` prefix at `transportPdf.ts:153`; the header becomes
   the bare location name. The per-location **columns stay**.

### Success Criteria
- The pickup PDF lists only `warehouse_pickup` goods, under the Pita Bros entity, and is
  **non-empty** after the data pass.
- The Pago order email is unchanged in scope.
- A real PDF is generated in a browser and checked visually.

---

## Testing Strategy

### Automated
- Backend `python3 -m pytest` (577 baseline) + `python3 -m ruff check .`
- Backend integration against the demo DB: `SUPPLY_OS_DATA_BACKEND=supabase
  SUPPLY_OS_DATABASE_URL=postgresql://ben@127.0.0.1:5432/supply_os_demo
  python3 -m pytest -m integration` (16 baseline). This is the only layer that binds real
  `NOT NULL` columns — it is what catches a B2-class defect.
- Frontend `npm run test` (198 baseline) + `build` + `lint`, node from Homebrew.

### E2E on demo (auth ENABLED, correct role token)
Local backend against the demo DB + local frontend, Captain and Manager tokens set
explicitly. Captain: overrule-all, ad-hoc product, comment, name suggestion,
below-minimum submit, partial count then correct it. Manager: detail shows ad-hoc items,
comment and the minimum chip; both Transport PDFs generated and inspected.

## Migration Notes

| # | File | Adds | Fixture wiring |
|---|---|---|---|
| 0013 | `0013_order_extra_items_and_note.sql` | `orders.extra_items`, `orders.captain_note` (both `text NOT NULL DEFAULT ''`) | binding + exec |
| 0014 | `0014_inventory_count_edit.sql` | `inventory_count_events` table; `inventory_counts.last_edited_at` | binding + exec + `_ALL_TABLES` + `_TXN_TABLES` |
| 0015 | `0015_supplier_product_warehouse_pickup.sql` | `supplier_products.warehouse_pickup boolean NOT NULL DEFAULT false` | binding + exec |

All additive, all `IF NOT EXISTS`, each with a `-- Rollback:` comment. Applied to prod by
the operator **before** the code that reads them is pushed. `0008` stays skipped.

## References

- `context/changes/training-feedback-0901/research.md` — grounded findings, prod queries
- `context/changes/wolska-blueservice-master-data/prod-sql.sql` — prod-batch template
- `context/changes/ken-browary-master-data/rollout-notes.md:57-59` — the gyros TODO
- `context/foundation/lessons.md` — auth-enabled verification, browser E2E, master-data ops
- Trello: https://trello.com/c/PG9I61nu — Marek's minimums, due 2026-09-04

## Progress

Implemented and verified against the **local demo Postgres** (`supply_os_demo`), never
prod. Nothing in this change has been applied to production.

### Phase 0: Prod hygiene
- [x] `prod-sql-phase0.sql` written (RLS on nine backup tables, DROP offered as alternative)
- [ ] applied to prod — **operator**

### Phase 1a: Captain UX, zero backend
- [x] `OverruleAllControl` + pure `overruleAll()` helper, fill-empties only
- [x] Name suggestions (`nameSuggestions.ts`) on `ordered_by` / `received_by`; added the
      missing `autoComplete="name"` on the receipt input
- [x] 28 new frontend tests

### Phase 1b: Ad-hoc items + order comment
- [x] Migration `0013` written + wired into the integration fixture
- [x] `Order.extra_items` / `Order.captain_note` as `str = ""` (the B2 guard), `_ORDER_COLUMNS`,
      submit + edit + both detail routes
- [x] Both email builders — backend `gmail_url.py` and the authoritative frontend
      `emailBody.ts` (the B3 fix)
- [x] Frontend controls on create + edit screens; Manager detail renders both
- [ ] `0013` applied to prod — **operator, before the code is pushed**

### Phase 1c: Minimum-order indicator
- [x] `minimum_order_value_pln` joined onto queue + both detail models, no server-side reader
- [x] Chip on three screens, `?? 400` fallback frontend-only, gates nothing

### Phase 2: Inventory count edit
- [x] Migration `0014` written + wired into the fixture (incl. `_ALL_TABLES` / `_TXN_TABLES`)
- [x] Seam in both backends: `delete_inventory_count_lines`, `update_inventory_count`
      (the D1 fix), `append_inventory_count_event`, `load_inventory_count_events_for`
- [x] `PATCH /api/captain/inventory/count/{id}` with replace semantics, location scope,
      pre-write diff, best-effort audit event
- [x] `count_submitted_at` preserved, `last_edited_at` stamped
- [x] Frontend edit screen + read-only correction history
- [x] Category labels translate under EN; product names never do
- [x] Three immutability docstrings corrected
- [ ] `0014` applied to prod — **operator**

### Phase 3: Master-data batch
- [x] `prod-sql-phase3.sql` written for every unblocked item, dry-run clean on demo
- [ ] applied to prod — **operator** (after reviewing the flagged threshold split)
- [ ] Marek-blocked rows: rolls, tapes, crates, minimums

### Phase 4: Transport documents
- [x] Entity swapped to Pita Bros sp. z o.o. across all five sites
- [x] Migration `0015` written + wired into the fixture
- [x] `warehouse_pickup` surfaced through the aggregate; pickup document filters on it
- [x] Batch supplier derived from the header rather than `group[0]`
- [x] `LOC • ` prefix dropped from driver-list column headers
- [x] `prod-sql-phase4-datapass.sql` written, dry-run clean on demo
- [ ] `0015` + data pass applied to prod, **in that order, before the code is pushed**
- [ ] Live browser PDF check on prod — **operator**

## Verification record (demo, 2026-09-02)

| Layer | Baseline | After |
|---|---|---|
| Backend unit (`pytest`) | 577 | **637** |
| Backend integration (real Postgres) | 16 | **18** |
| Backend lint (`ruff`) | clean | clean |
| Frontend tests | 198 | **274** |
| Frontend `build` / `lint` | clean | clean |

E2E driven through the real UI with **auth ENABLED** and role-correct tokens:
Captain submit with a bulk reason, an ad-hoc item and a comment; a partial inventory count
then corrected with its audit trail; Manager detail rendering all of it; the minimum chip in
both states; a Transport batch where the order document lists three products and the pickup
document lists only the two collected from the warehouse.
