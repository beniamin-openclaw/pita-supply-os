# Research — supplier-per-location

Date: 2026-08-20. Run inline (single pass, no sub-agent fan-out) because this
session is configured not to spawn agents unprompted. Prod reads are read-only
`SELECT`s against the live project; nothing was written.

---

## 1. The blocking finding: the headline scenario is not reachable with today's data

`P127` (Zszywki), `P132` (Markery), `P133` (Długopisy) exist in `supplier_products`
**only under `SUP_PAGO`**. Blue Service has no catalog entry for any of them.

| product | catalog entries | thresholds (target) |
|---|---|---|
| P127 Zszywki | `SP_PAGO_P127` only | BRACKA 10 · KEN 5 · NORBLIN 10 · WOLA 5 |
| P132 Markery | `SP_PAGO_P132` only | BRACKA 3 · KEN 0 · NORBLIN 3 · WOLA 0 |
| P133 Długopisy | `SP_PAGO_P133` only | BRACKA 3 · KEN 0 · NORBLIN 3 · WOLA 0 |

Consequence: **pinning WOLA's P133 to `SUP_BLUESERV` today would make the product
vanish from WOLA entirely** — no supplier carries it under that pin. This is
exactly the silent-disappearance risk the FR-026 Socratic round flagged, and it
is reachable through ordinary master-data entry because there is no admin UI and
no referential guard between a pin and the catalog.

Two direct implications, both carried into the plan:

- **The code change alone is a no-op.** With 154 products against 154 catalog
  entries, every product has exactly one supplier: pinning to that supplier changes
  nothing, and pinning to any other makes the product disappear. Value only lands
  once master data adds a second catalog entry. Code and master data must therefore
  be two phases, not one.
- **An orphaned pin needs a guard.** The plan adds a backend warning on every
  orderable build where a location pins a product to a supplier that has no catalog
  entry for it, plus an audit query in the batch runbook.

Note also: WOLA's markers and pens sit at `target = 0`, so they currently suggest
nothing at WOLA anyway — worth confirming with the operator before the batch.

## 2. Production state (read-only, 2026-08-20)

| table | rows | inactive |
|---|---|---|
| products | 154 | **0** |
| suppliers | 10 | **0** |
| supplier_products | 154 | **0** |
| locations | 7 | 3 |
| location_product_settings | 578 | — |

Per location: WOLA 151 · NORBLIN 145 · BRACKA 144 · KEN 138.

**Zero inactive rows anywhere** in `products` / `suppliers` / `supplier_products`.
That makes the FR-029 `active` enforcement a *provable* no-op against current data
— it can ship with the code phase at zero behavioral risk.

Blue Service is already a real supplier at every location: 49 catalog entries, of
which P082–P126 carry thresholds at all four locations. The 9 rows track A added
(P146–P154) are WOLA-only. `SP_BLUESERV_P150` is "Marker podświetlacz" — a
highlighter, **not** the same product as P132 "Markery".

## 3. Seed ↔ prod divergence (pre-existing, not caused by this lane)

Seed has 154 products / 154 catalog entries — matching prod — but **440**
threshold rows against prod's 578. The difference is exactly KEN's 138: seed
carries no KEN rows at all. Pre-existing and out of scope here; recorded so the
"seed mirrors prod" assumption is not over-trusted during verification.

Seed WOLA × SUP_PAGO resolves to exactly 18 products — P019, P024–P028, P089–P092,
P098, P127–P133 — which is what `test_captain_orderable_wola_pago_returns_18_items`
(`tests/test_main.py:119`) asserts. That count only moves if the **seed** changes,
so the existing test is untouched by the code phase.

## 4. Backend seam — how a new optional field propagates

The field rides the existing `load_location_product_settings` seam in all three
backends. No new loader, no new entity.

- **Supabase** (`app/supabase_backend.py:290`) — reads via `_fetch_all`, which is
  `SELECT *` mapped onto the model by column name (`app/supabase_backend.py:230`).
  A new column flows into the model automatically once the model declares it.
  `_LOCATION_PRODUCT_SETTING_COLUMNS` (`:99`) is **write-only** — the app never
  writes master data; its sole consumer is `tests/test_supabase_integration.py:128`.
  It still gets the new column so the round-trip test covers it.
- **Sheets** (`app/sheets.py:273`) — `_read_with_ttl` → `_validate_headers`, which
  requires only Pydantic fields **without** a default. An optional field with
  default `None` is not required, so a sheet lacking the column keeps loading.
- **Seed** (`app/seed_loader.py:92`) — `_read` normalizes blanks to `None` then
  drops `None` keys before constructing the model, so a CSV lacking the column
  falls back to the model default.

All three are therefore backwards compatible with no coordinated data change.

## 5. Where orderability is decided

`_build_orderable_items` (`app/main.py:171-193`) is the single chokepoint. Both
`/api/captain/orderable` (`:195`) and `/api/manager/orderable` (`:216`) call it,
and `manager_add_line` (`:~1290`) re-checks membership through it server-side. One
edit covers every path.

Current filter: `sp.supplier_id == supplier_id and sp.product_id in settings_by_pid`.

`.active` is read **exactly once in the whole of `app/`** — `product.active` at
`app/main.py:1980`, on the inventory-count screen. `supplier_products.active`,
`suppliers.active` and `products.active` are all unfiltered on the orderable path,
confirming the defect recorded in `change.md`.

## 6. Frontend surface for FR-028

- `OrderableItem` — `frontend/src/types.ts:60`. `order_note` (`:77`) is the
  precedent for an optional, backend-supplied annotation.
- `ProductCard.tsx:148` already has an optional-annotation block (`order_note` +
  below-minimum warning) — the natural home for the "also carried by" badge, no new
  layout needed.
- Copy goes in `frontend/src/i18n/strings.ts` under the `card.*` group (pl + en
  both required).
- The supplier list itself (`CaptainMP.tsx:98`) fetches every active supplier
  company-wide with no location filter. Out of scope per the PRD, restated here
  because it is the reason a Captain can already land on an empty supplier screen.

## 7. Blast radius beyond the app

Scripts that enumerate master-data tables and will need the new column considered:

- `scripts/backfill_supabase.py:37` — sheets → Supabase backfill.
- `scripts/verify_parity.py:30` — sheets ↔ Supabase parity check.
- `scripts/sync_master_data.py:28` — seed → sheets sync.
- `scripts/diag_orderable.py:32` — orderable diagnostics.

Tests touching `LocationProductSetting` construction (all keyword-only, so an
optional field with a default leaves them compiling unchanged):
`test_orderable_order_note.py`, `test_captain_orders.py`, `test_manager_add_line.py`,
`test_supabase_backend.py`, `test_supabase_integration.py`, `test_main.py`,
`test_sheets_read.py`.

## 8. Open items handed to the plan

1. Blue Service catalog entries for P127/P132/P133 must exist **before** the WOLA
   pin — otherwise the products disappear. Gated prod master data.
2. WOLA's P132/P133 targets are `0`; confirm intent with the operator before pinning.
3. The substitutes half (fries) additionally needs a supplier that is not in
   `suppliers` yet, plus an operator pass on which locations should pin — both
   already recorded as PRD Open Questions 5 and 6.
