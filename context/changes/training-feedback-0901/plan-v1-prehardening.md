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
  implemented in **both** `app/sheets.py` and `app/supabase_backend.py`.
- New Pydantic fields are `Optional[...] = None` so `sheets._validate_headers` does not turn
  them into mandatory worksheet columns.
- The inventory audit log follows `_log_transport_event`'s best-effort contract: a logging
  failure must never fail the correction that already succeeded.
- Auth-scoped screens are verified with auth ENABLED and only the token that role holds
  (`lessons.md`, "Preview with auth DISABLED").
- Anything touching the PDF pipeline gets a live browser E2E, not just green unit tests
  (`lessons.md`, "Browser-integration features fail SILENTLY in layers").

---

## Phase 0: Prod hygiene — RLS on backup tables

### Overview
Nine snapshot tables are readable and writable with the anon key. Unrelated to the feedback,
but found while grounding it and cheap to close.

### Changes Required
- `context/changes/training-feedback-0901/prod-sql-phase0.sql`: `ALTER TABLE ... ENABLE ROW
  LEVEL SECURITY` on all nine, matching `0002_rls_deny_all.sql`. Operator decides per table
  whether to keep or `DROP` — the file offers both, drop commented out.

### Success Criteria
- `select relname from pg_class ... where relrowsecurity = false` in `public` returns zero rows.

---

## Phase 1: Captain ordering UX

### Overview
Four frontend features plus one small migration. Points 1, 8, 24, 27 of the feedback.

### Changes Required

1. **Overrule-all reason control** — new `components/OverruleAllControl.tsx`, rendered as a
   sibling of `PrefillControl` (`CaptainMP.tsx` ~line 619). Selects a `REASON_CODE`, then one
   batched `setLines` patching every line where `computeRowState(...).requiresReason` is true
   and no reason is set yet. Mirrors `fillEmpties`/`overwriteAll` (`CaptainMP.tsx:331-374`).
   Selecting `OTHER` forces the shared comment field (`ReasonPicker.tsx:32-33` parity).
   Secondary "overwrite all" variant behind a confirm, matching the prefill control's two-mode
   shape.
2. **Order-level comment** — a `notes` textarea below the product list; replaces the hardcoded
   `notes: ""` at `CaptainMP.tsx:418`. Not wired on `OrderEditPage.tsx:196` (that field carries
   the manager's send-back reason — leave cleared, with the existing comment kept).
3. **Ad-hoc product line** — migration `0013` adds `orders.extra_items text NOT NULL DEFAULT ''`.
   A "+ dodaj produkt" control collects `nazwa / ilość / jednostka` rows, serialised one per
   line. Surfaced on `ManagerOrderDetail`, and appended to the dispatch email body
   (`gmail_url.build_draft_url`) so it actually reaches the supplier. Deliberately NOT an
   `order_lines` row: that table is a Tier-1 production contract with FK-resolved
   `product_id`/`supplier_product_id`, and an ad-hoc item has neither.
4. **Name suggestions** — a shared `<datalist>` fed from `localStorage` (per role + location),
   appended on each successful submit. Applied to all three inputs; also adds the missing
   `autoComplete="name"` on `ReceiveDeliveryPage.tsx:228-237`. Zero backend.
5. **Minimum-order indicator** — Manager-side, next to the existing total in
   `OrderDetailPane.tsx:223-226` and `ManagerQueue.tsx:167`, plus the Captain's post-submit
   `OrderDetailPage.tsx:170-172`. Value `supplier.minimum_order_value_pln ?? 400`. Purely
   informational: a neutral chip when at or above, a warning chip when below. **No gate
   anywhere** — no submit/dispatch path may read it.

### Success Criteria
- One click sets a reason on every deviating line; a line that already had one is untouched.
- An order-level comment and ad-hoc items both appear on the Manager detail and in the email.
- Typing three letters in "kto zamawia" suggests previously used names.
- A below-minimum order still submits and still dispatches.
- `npm run test`, `npm run build`, `npm run lint` green; backend `pytest` + `ruff` green.

---

## Phase 2: Inventory count — safe edit with audit log

### Overview
Point 6. The submitted-count immutability is the actual blocker; the draft/resume path
already works.

### Changes Required

1. **Migration `0014_inventory_count_events.sql`** — new table modelled on
   `0010_transport_events.sql`: `event_id` PK, `count_id`, `event_type`, `actor`, `at`,
   `details text NOT NULL DEFAULT ''`, index on `count_id`, deny-all RLS.
2. **Models** — `InventoryCountEvent` in `models.py`; `InventoryCountEditRequest`
   (`lines`, `edited_by: str = Field(min_length=1)`, optional `edit_reason`).
3. **Data layer, both backends** — `update_inventory_count_lines(count_id, line_updates)`
   mirroring `update_order_lines`, `append_inventory_count_lines` reuse for newly counted
   products, and `append_inventory_count_event`. Sheets gets the same signatures.
4. **Route** — `PATCH /api/captain/inventory/count/{count_id}`, Captain-auth, strict location
   scope (404 on foreign, not 403 — mirrors `captain_order_detail`). Adds missing products and
   corrects existing ones. Emits one event per edit with a server-computed
   `"Product: old → new"` diff, best-effort via a `_log_inventory_event` helper modelled on
   `_log_transport_event` (`main.py:1476-1514`).
5. **Frontend** — "Popraw" on the counts list / detail; reuses `InventoryCountPage`'s grid in
   edit mode, pre-filled from the snapshot, requiring a name before save. Edit history shown
   read-only on the detail view.
6. **Category labels** — a `categoryLabel(key)` helper in `i18n/` mapping the 10 live
   categories (`Biurowe`, `Chemia`, `Chłodnia`, `Gaz`, `Mrożonki`, `Napoje`, `Opakowania`,
   `Produkcja`, `Spożywcze`, `Wino`) to EN, falling back to the raw value so an unmapped
   category still renders. Applies to the inventory screen (`InventoryCountPage.tsx:520`) and
   `ManagerSuggestionReviewPage.tsx:96`. **Category labels translate; product names never do**
   — `product_name_pl` is the operator's own catalogue naming and stays byte-identical in both
   languages (operator decision 2026-09-01).

### Success Criteria
- A count interrupted halfway can be completed later without a new `count_id`.
- Every edit produces an event row with actor, timestamp and a per-product diff.
- A failure writing the event does not fail the edit.
- Editing another location's count returns 404.
- Seed mode degrades exactly like the other inventory routes (no 500).

---

## Phase 3: Master-data batch (prod Supabase)

### Overview
Points 3, 4, 5, 7, 11, 16–21. Runs as one `prod-sql-phase3.sql` in the
`wolska-blueservice-master-data` shape: BEFORE snapshot → apply → audit + rollback.

### Changes Required

**Corrections to existing rows**
- `P135 Bombilla` → `active = false` (the "bąbila").
- `P012 Tirokafteri` → `units_per_purchase_unit` 3 → 2 on both supplier rows; the `SUP_PAGO`
  row's `purchase_unit` `kg` → `wiadro`.
- `P128/P129/P130/P142 Rolki do kasy` → `purchase_unit` `szt` → `opak`,
  `units_per_purchase_unit` 10 or 6 per SKU. **Blocked on Marek** (which roll is which pack
  size) — Trello https://trello.com/c/UIpn3qyg, due 2026-09-04.
- `P157 Corfu Pilsner` → `purchase_unit` `szt` → `zgrzewka`, `units_per_purchase_unit`
  1 → 6, aligning it with P136/P137/P138 (operator-confirmed 2026-09-01); add
  `location_product_settings` for WOLA, BRACKA, KEN.
- `Allegro`, `Selgros` → `active = true` (Selgros already has `supplier_products` rows).
- `suppliers.minimum_order_value_pln` → real values. **Blocked on Marek, due 2026-09-04
  (https://trello.com/c/PG9I61nu).** Until then Phase 1's 400 PLN fallback carries it.

**New SKUs** (each: one `products` row, one `supplier_products` row per supplier, one
`location_product_settings` row per stocking location — five locations, ids per the
`P###` / `SP_<SUP>_<PID>` / `<LOC>__<PID>` conventions)
- **Gyros split (operator-decided 2026-09-01)** — resolves the TODO logged at
  `ken-browary-master-data/rollout-notes.md:57-59`. Two axes: cut state (ścięty / nieścięty)
  everywhere, meat type (wieprzowy / kurczak) only where chicken is stocked.
  `P037 Gyros (ścięty + nieścięty)` is replaced by four `Produkcja` SKUs:
  gyros wieprzowy ścięty, gyros wieprzowy nieścięty, gyros kurczak ścięty,
  gyros kurczak nieścięty. Thresholds: **all four at KEN, the two pork ones at WOLA, BRACKA,
  NORBLIN, BROWARY** — chicken gyros exists only at KEN.
  `P037` is deactivated rather than deleted (order history references it).
  Open sub-item: the *purchased* Pago blocks (`P024 Gyros 15 KG`, `P025 Gyros 25 KG`) are
  likewise undifferentiated by meat type, and KEN's own sheet lists pork and chicken as two
  lines. A chicken block SKU under `SUP_PAGO`, orderable at KEN only, is almost certainly
  needed too — confirm before applying.
- Gas cylinder: full vs empty (split from `P134`).
- Crates: empty vs holding empty bottles (absent from prod entirely).
- Cooked chickpeas in `Produkcja` alongside `P036`; rename `P036` to name the cooked state.
- Tapes: unified list. **Blocked on Marek.**

### Success Criteria
- Audit block returns zero rows for: `min > max`, `target <> max`, orphan FKs, duplicate
  `(location_id, product_id)`, placeholder names, and any new product with no
  `supplier_products` row.
- Each new SKU is visible on the Captain order screen at exactly the intended locations.
- A `SELECT`-diff of every touched row is saved in the change folder before the apply runs.

---

## Phase 4: Transport and driver documents

### Overview
Points 12–15 plus the entity swap. Highest live-verification burden.

### Changes Required

1. **Entity swap** — `PAGO_ENTITY` (`transport.ts:675-680`) → `Pita Bros sp. z o.o.`,
   NIP `9522100633`, `ul. W. Laskonogiego 9`, `02-496 Warszawa` (operator-confirmed
   2026-09-01). Also the title bar literal (`transport.ts:719`), the i18n pickup bar
   (`strings.ts:1267-1270`), and the two tests asserting the old values
   (`transport.test.ts:689-700`, `transportPdf.test.ts:192-197`). Follow the constant's own
   TODO where cheap: source from `Location.company_*` with the literal as fallback.
2. **Warehouse-pickup scoping** — migration `0015` adds
   `supplier_products.warehouse_pickup boolean NOT NULL DEFAULT false`; backend surfaces it on
   `TransportAggregateLine`; `buildTransportPagoPrintDoc` filters on it. Data pass marks the
   cold/frozen Pago SKUs true and leaves office/packaging false. Chosen over a hardcoded
   category list so the rule stays master data, and over a supplier filter because the batch is
   already single-supplier.
3. **Defensive supplier filter** — `_aggregate_transport_lines` / `manager_transport_batch_detail`
   skip (and log) any member order whose `supplier_id` differs from the batch header's, and
   derive `isPago` from the header rather than `group[0]` (`main.py:3438-3441`). Plus the
   missing test: a batch detail with a mixed-supplier group.
4. **Driver list column headers** — the per-location columns are rendered as
   `` `LOC • ${loc}` `` (`transportPdf.ts:153`). Drop the `LOC • ` prefix so the header is the
   bare location name ("Wola", "Bracka"), matching the transcript's "powinna być tylko nazwa".
   The per-location **columns stay** — they are the entire point of the driver document.
   The Pago-first section ask is expected to be moot once (2) lands (the pickup document will
   already contain only warehouse goods); re-check with the operator on the live PDF before
   building any sectioning.
5. **Units** — delivered entirely by Phase 3; no code change.

### Success Criteria
- The Pago pickup PDF lists only `warehouse_pickup` goods, under the Pita Bros entity.
- A hand-constructed mixed-supplier batch is filtered and logged, not silently aggregated.
- **A real PDF is generated in the operator's browser on prod and visually checked** — unit
  tests alone do not close this phase.

---

## Testing Strategy

### Unit tests
- Backend: inventory edit route (happy path, foreign location 404, missing count 404, seed
  degrade, event emission, event-failure tolerance); `_aggregate_transport_lines` supplier
  filter; `warehouse_pickup` surfacing.
- Frontend: `OverruleAllControl` reason-application logic as a pure helper in `lib/`;
  `buildTransportPagoPrintDoc` warehouse filtering; updated entity assertions.

### Integration tests
- Supabase inventory update round-trip (currently the Supabase backend's inventory functions
  have **no** coverage at all — this phase adds the first).

### Manual testing (auth ENABLED, correct role token per `lessons.md`)
1. Captain: overrule-all, ad-hoc product, order comment, name suggestion, below-minimum submit.
2. Captain: submit a partial count, then correct it; confirm the audit trail.
3. Manager: order detail shows ad-hoc items, comment and the minimum chip.
4. Manager: generate both Transport PDFs **in a real browser** and check contents.

## Migration Notes

Three additive migrations, each applied to prod **before** the code that reads it is pushed:

| # | File | Adds |
|---|---|---|
| 0013 | `0013_order_extra_items.sql` | `orders.extra_items text NOT NULL DEFAULT ''` |
| 0014 | `0014_inventory_count_events.sql` | `inventory_count_events` table + index + deny-all RLS |
| 0015 | `0015_supplier_product_warehouse_pickup.sql` | `supplier_products.warehouse_pickup boolean NOT NULL DEFAULT false` |

All `IF NOT EXISTS`, all with a `-- Rollback:` comment, none renaming or dropping anything.
`0008` stays skipped — it belongs to the unmerged multi-location lane.

## Blocked / open questions

Resolved by the operator on 2026-09-01:

1. **"LOCS"** → the `LOC • ` prefix on the driver list's per-location column headers. Drop the
   prefix, keep the columns.
2. **Category language** → category labels translate under the EN toggle; product names never
   translate.
3. **Gyros split** → four SKUs at KEN, two (pork only) elsewhere; chicken gyros is KEN-only.
4. **Corfu Pilsner** → align P157 to `zgrzewka` / 6 like its siblings.

Still blocked:

- **Roll pack sizes** (which of P128/P129/P130/P142 is 10 and which is 6) — Marek,
  Trello https://trello.com/c/UIpn3qyg, due 2026-09-04.
- **Unified tape list** — Marek, same card.
- **Bottle-crate pairing rules** (cola/Sprite/Fanta/Cappy) — Marek, pending Bartek, same card.
- **Supplier minimum order values** — Marek, Trello https://trello.com/c/PG9I61nu, due
  2026-09-04. Phase 1's 400 PLN fallback carries the feature until then.
- **Pago chicken-gyros block SKU** — confirm with the operator whether KEN must be able to
  order a chicken gyros block from Pago (see Phase 3).

Phases 0, 1, 2 and 4 are fully unblocked. Phase 3 runs on the unblocked rows; the four items
above wait on Marek.

## References

- `context/changes/training-feedback-0901/research.md` — grounded findings, prod queries
- `context/changes/wolska-blueservice-master-data/prod-sql.sql` — prod-batch template
- `context/changes/ken-browary-master-data/rollout-notes.md:57-59` — the gyros TODO
- `context/foundation/lessons.md` — auth-enabled verification, browser E2E, master-data ops
- Trello: https://trello.com/c/PG9I61nu — Marek's minimums, due 2026-09-04

## Progress

### Phase 0: Prod hygiene
- [ ] RLS SQL written and applied

### Phase 1: Captain ordering UX
- [ ] Overrule-all control
- [ ] Order-level comment
- [ ] Migration 0013 applied to prod
- [ ] Ad-hoc product line (UI + email + manager detail)
- [ ] Name suggestions
- [ ] Minimum-order indicator

### Phase 2: Inventory count edit
- [ ] Migration 0014 applied to prod
- [ ] Data layer (both backends)
- [ ] PATCH route + audit events
- [ ] Frontend edit mode + history
- [ ] Category labels (EN map; product names untouched)

### Phase 3: Master-data batch
- [ ] BEFORE diff saved
- [ ] Unblocked corrections applied
- [ ] New SKUs — gyros ×4, gas cylinder, crates, cooked chickpeas
- [ ] Marek-blocked rows (rolls, tapes, minimums)
- [ ] Audit assertions clean

### Phase 4: Transport documents
- [ ] Entity swap
- [ ] Migration 0015 applied to prod
- [ ] Warehouse-pickup scoping
- [ ] Defensive supplier filter + test
- [ ] Driver list — drop `LOC • ` prefix
- [ ] Live browser PDF check
