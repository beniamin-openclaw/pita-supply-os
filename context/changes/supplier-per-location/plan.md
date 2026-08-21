# Plan: supplier-per-location

Track B of the 2026-08-20 request. Adds a per-location "from whom" dimension to
order-screen visibility, and fixes the dead `supplier_products.active` flag
alongside it. Inputs: `change.md`, `research.md`,
`context/foundation/shape-notes.md` (`## Change: Supplier dimension per location`),
`context/foundation/prd.md` v3 (FR-025…FR-030, US-03).

## What

1. **`location_product_settings.source_supplier_id`** — one nullable column,
   FK to `suppliers`. `NULL` = every supplier carrying the product (today's
   behavior); a value = only that supplier. Narrowing only.
2. **Both chokepoints honor it — read *and* write.**
   - `_build_orderable_items` (`app/main.py:171`) serves `/api/captain/orderable`,
     `/api/manager/orderable`, and the `manager_add_line` membership re-check.
   - `_resolve_master_data` (`app/main.py:317`) is the **separate** gate behind
     `captain_submit` and `captain_order_edit`. Plan-review F1: filtering only the
     read path would let a client POST a pinned-away line and have it persist. That
     is reachable, not theoretical — Captain drafts persist in local storage with no
     expiry by design (`frontend/src/auth.ts`, `loadDraft`), so a draft built before
     a pin and submitted after it would walk through the gap.
   - Consequence for the Manager: a pin makes `manager_add_line` reject the product
     with the existing 400. That is intended — orderable membership is the one gate
     the Manager's override authority does not cover (PRD, FR-025/FR-026).
3. **`active` enforcement** (FR-029) — `supplier_products.active` gates
   orderability on both paths. Provably a no-op today: prod has zero inactive
   catalog entries.
3b. **`products.active` — a deliberate consistency fix beyond FR-029's letter**
   (plan-review F2). The inventory screen already filters it (`app/main.py:1980`);
   orderable is the inconsistent one. Also provably a no-op: prod has zero inactive
   products. Named separately so it is a decision, not scope creep.
4. **Orphan-pin warning** — a pin to a supplier with no catalog entry for the
   product makes it orderable nowhere. That is reachable through ordinary SQL
   master-data entry, so the backend logs it loudly on every orderable build.
5. **`also_supplied_by` on the orderable item** (FR-028) — supplier *names*,
   joined server-side, rendered as a card annotation.
6. **Gated master-data batch** — written as `prod-sql.sql`, not executed.

## What we're NOT doing

- No per-supplier thresholds. `UNIQUE (location_id, product_id)` stays; one
  target/min/max per product per location regardless of who delivers it.
- No arbitrary supplier subsets. v1 is one-or-all (FR-025 Socratic resolution
  records the migration path).
- No new entity, loader function, sheet tab or seed file.
- No `suppliers.active` filter on the orderable path — the Captain screen already
  filters the supplier list client-side, and the endpoint takes `supplier_id` as a
  parameter. Recorded as a follow-up, not fixed here.
- No hard block on ordering one product from two suppliers the same day (FR-028 is
  informational).
- No change to the supplier picker's company-wide listing (PRD non-goal).
- **No prod writes.** Phase 4 is authored and left for explicit operator consent.

## Decision notes

- **Column, not a membership table.** Rationale and reversal path: FR-025's
  Socratic resolution in `prd.md`. The short version — one optional field on a
  record that already exists per location and product, versus a new entity in
  three backends plus a ~580-row backfill to preserve today's behavior.
- **The column propagates for free.** Supabase reads are `SELECT *` mapped onto
  the model; Sheets' `_validate_headers` only requires fields without a default;
  the seed loader drops blank keys and falls back to model defaults. A backend
  whose store lacks the column keeps working unchanged (`research.md` §4).
- **Code and master data are separate phases.** With 154 products against 154
  catalog entries, the code change cannot alter any current screen: pinning to a
  product's only supplier is a no-op, and pinning elsewhere would make it vanish.
  Phase 4 is where behavior actually changes, and it is gated.
- **`test_captain_orderable_wola_pago_returns_18_items` is untouched by phases
  1–3.** It asserts against seed data, which the code phases do not change. It
  moves to 15 only in Phase 4, together with the seed rows it reads.
- **`also_supplied_by` carries names, not ids** — mirrors the existing precedent
  of joining display values server-side so a card needs no FE lookup table.

## Progress

### Phase 1: Model + migration + backend seam

#### Automated
- [x] `LocationProductSetting.source_supplier_id: Optional[str] = None` with
      semantics documented on the field
- [x] migration `0008_add_location_product_setting_source_supplier.sql`
      (nullable text, `REFERENCES suppliers(supplier_id)`, `IF NOT EXISTS`,
      `COMMENT ON COLUMN`) — header comment records the rollback statement
      (`ALTER TABLE location_product_settings DROP COLUMN source_supplier_id;`),
      per plan-review F4 and the repo's diff-before lesson
- [x] `_LOCATION_PRODUCT_SETTING_COLUMNS` += `source_supplier_id`
- [x] integration `_schema` fixture applies 0008
- [x] `_supplier_allowed(setting, supplier_id)` helper — `None` → any carrier,
      value → that supplier only
- [x] `_build_orderable_items`: apply `_supplier_allowed`, `sp.active`,
      `product.active`; build the carrier map once; emit `also_supplied_by`
- [x] **`_resolve_master_data`: same `_supplier_allowed` + `sp.active` filter on
      `sps_by_id`** (plan-review F1) — closes the submit/edit hole. Requires
      building `settings_by_pid` before `sps_by_id`. No edit to `captain_submit` or
      `captain_order_edit` themselves: their existing "not orderable at this
      location" 400 fires for free.
- [x] orphan-pin `log.warning` naming location, product and pinned supplier
- [x] `ruff check .` clean

### Phase 2: Frontend badge (FR-028)

#### Automated
- [x] `OrderableItem.also_supplied_by?: string[]` in `types.ts`
- [x] `ProductCard` renders it inside the existing optional-annotation block
      (alongside `order_note` / below-min), never as new layout
- [x] i18n `card.alsoSuppliedBy` (pl + en)
- [x] `npm run build`, `npm run lint`, `npm run test` green

### Phase 3: Tests

#### Automated
- [x] new `tests/test_orderable_supplier_pin.py`:
      unpinned stays visible · pinned shows at the pinned supplier only ·
      pinned hides at the other supplier · multi-carrier unpinned shows at both
      with `also_supplied_by` naming the other · pinned yields empty
      `also_supplied_by` · inactive catalog entry not orderable ·
      inactive product not orderable · orphan pin is orderable nowhere and warns
- [x] **write-path tests (plan-review F1)**: `captain_submit` rejects a line whose
      product is pinned to a different supplier (400); `captain_order_edit` rejects
      the same; a line for an inactive catalog entry is rejected. These are the
      regression tests for the stale-draft path — without them the hole can silently
      reopen.
- [x] existing suite green, `test_captain_orderable_wola_pago_returns_18_items`
      still asserting 18 (unchanged by phases 1–3, by design)
- [x] `/verify` (backend pytest + ruff, frontend build + lint)

### Phase 4: Master data — GATED, requires explicit operator consent

#### Manual
- [ ] author `prod-sql.sql`: diff-before (the rollback record) → apply →
      audit-after with per-location item counts
- [ ] **operator decision** — Blue Service catalog entries for P127/P132/P133 must
      be created *before* the WOLA pin, or those products disappear from WOLA
      (`research.md` §1)
- [ ] **operator decision** — WOLA's P132/P133 targets are `0` today; confirm the
      pin is still wanted
- [ ] seed CSVs updated in the same batch so the mirror does not drift
- [ ] `test_captain_orderable_wola_pago_returns_18_items` → 15, dropping exactly
      P127/P132/P133
- [ ] audit-after run and recorded

### Phase 5: Deferred — substitutes (fries)

Blocked on PRD Open Questions 5 and 6: the third source is not in `suppliers`,
and no operator pass has decided which locations should pin. Phases 1–3 make the
mechanism ready; this lane does not execute it.

---

## Verification record (2026-08-20, phases 1–3)

| Check | Result |
|---|---|
| `ruff check .` | All checks passed |
| `python -m pytest` | **453 passed**, 16 deselected (15 new in `test_orderable_supplier_pin.py`) |
| `npm run build` | green (`tsc -b && vite build`) |
| `npm run lint` | clean |
| `npm run test` (vitest) | **89 passed**, 10 files |

`test_captain_orderable_wola_pago_returns_18_items` still asserts 18, as
predicted: phases 1–3 change no visible behavior anywhere. Reviews:
`reviews/plan-review.md` (1 critical, fixed before implementation),
`reviews/impl-review.md` (APPROVED, 1 warning fixed into the Phase 4 runbook).

**Not archived.** Phase 4 is authored but unapplied and blocked on two operator
decisions (see `prod-sql.sql` §1); Phase 5 is deferred behind PRD Open Questions
5–6. The lane closes when Phase 4 is either applied or explicitly dropped.
