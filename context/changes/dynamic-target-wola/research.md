# Research — dynamic target for Wola

Date: 2026-09-07. Sources: repo (`supply-os-v1/app/main.py`, `suggestion.py`,
`frontend/src/pages/captain-mp/`), prod Supabase `lpzhphufjwrndfogkfub` (SELECT only),
`docs/pita-supply-os-v1/analysis/gostock-2026-09-06/` (README, target_seed.csv,
usage_estimates.csv, quality_output.txt).

## What exists today

- Suggestion = `max(0, target − current)` → purchase units (`app/suggestion.py`).
  `target` comes from `location_product_settings.target_stock_qty_base`, static.
  `min_stock_qty_base` is display-only (ProductCard "poniżej minimum").
- The Captain screen computes the suggestion client-side from
  `OrderableItem.target_stock_qty_base` (`captain-mp/lib/compute.ts`, a mirror of
  `_round_per_rule`). The backend recomputes it on submit in `_evaluate_submit_line`
  and gates >25 % deviation / critical under-order on that value. Both sides must
  agree or the Captain gets a 400 after the fact.
- `requested_delivery_date` is set by the frontend from `Supplier.delivery_days`
  (`captain-mp/lib/dates.ts::getRequestedDeliveryDate`: next matching weekday,
  offsets 1..14, no cutoff logic, browser-local date) and sent on submit. The backend
  stores it and uses `delivery_days` + `cutoff_time` only for the queue badge
  (`_compute_next_cutoff`).
- Order lines snapshot `target_stock_qty_base` per line (audit); the Captain edit
  screen rebuilds items from those snapshots (`OrderEditPage.lineToItem`).
- Master data reads go through `_choose_backend()` — seed CSV / Sheets / Supabase.
  `test_seam_parity_supabase_is_superset_of_sheets` enforces that every public
  function on `sheets` exists on `supabase_backend`.

## Prod facts (2026-09-07)

| Item | Value |
|---|---|
| Wola inventory counts in Supply OS | 10 (2026-06-08 → 2026-09-01) |
| Wola orders last 60 d | Bukat 12, Intermlecz 12, Blue Service 4, Kamino 3, Coca-Cola 2, Pago 1, Kuchnie 1 |
| Pago calendar in master data | `delivery_days = 'Tue'`, cutoff 14:00 (GoStock PZ: Tue + Sat) |
| Coca-Cola calendar in master data | `TBD` / `TBD` (GoStock PZ: Thu) |
| Wola Pago targets | gyros 10 kg, pita 5 opak, souvlaki kurczak 12 kg, souvlaki wieprz 4 kg (0.5–1.8 days of usage) |
| Wola Coca-Cola targets | Cola 96, Zero 120, Kropla 48/48, Cappy 36/36 (15–180 days of usage) |

Pago at Wola is mostly ordered via the Manager Transport grid (add-location with
`prefill_products`), which uses the same `_build_orderable_items` and therefore
the same target. Coca-Cola is a portal supplier ordered from the Captain screen.

## GoStock usage seed for Wola (target_seed.csv, 8 weeks to 2026-08-30)

| product_id | product | usage/day (OS unit) | conf | basis |
|---|---|---|---|---|
| P024 | Gyros 15 KG | 12.75 kg | A | purch+teoret+real |
| P026 | Pita (opak ×10) | 9.4 opak | A | purch+teoret+real |
| P027 | Souvlaki Kurczak | 12.5 kg | A | purch+teoret+real |
| P028 | Souvlaki Wieprz | 2.25 kg | A | purch+teoret+real |
| P068 | Coca Cola | 4.53 szt | A | purch+teoret+real |
| P069 | Coca Cola Zero | 7.77 szt | A | purch+teoret+real |
| P074 | Corona | 0.77 szt | A | purch+teoret+real |
| P067 | Sprite | 0.82 szt | A | purch+teoret+real |
| P065 | Cappy Pomarańcza | 0.33 szt | B | purch+teoret+real |
| P066 | Fanta | 0.88 szt | B | purch+teoret+real |
| P070 | Kropla Niegazowana | 1.2 szt | B | purch+teoret+real |
| P071 | Kropla Gazowana | 0.32 szt | B | purch+teoret+real |
| P064 | Cappy Jabłko | 0.2 szt | C | purch+teoret+real |
| P080 | Corona 0% | 0.37 szt | C | purch+teoret+real |
| P081 | Fuzetea | 0.12 szt | C | purch+teoret+real |
| P079 | Kinley | 0.34 szt | C | purch+teoret+real |
| P078 | Lech Free | 0 | C | POS_only |
| P063 | Monster | 0.02 szt | C | POS_only |

Pita: GoStock counts pieces, Supply OS counts packs of 10 — the seed is already
converted (factor 0.1).

## Options considered

1. **Scale the static target by horizon** (`target ÷ cycle × days`). Rejected: the
   static targets at Wola are 0.5–1 day for Pago and 15–180 days for Coca-Cola, so
   scaling them reproduces the miscalibration.
2. **Compute usage live from Supply OS counts + receipts.** Rejected for v1: only
   Wola has >2 counts, and the unit-error risk (halloumi 5.5 "kartony") has no
   filter yet. Planned as a later change once 4+ weekly counts exist per location.
3. **Usage as master data seeded from GoStock (chosen).** One table, one SQL
   insert, editable, transparent; the engine reads it through the seam like any
   other master data.

## Risks identified

- Frontend/backend target mismatch across midnight or a changed
  `requested_delivery_date` → spurious 400 on the >25 % gate. Mitigation: the
  backend derives the target from `req.requested_delivery_date` (which the
  frontend computes with the same weekday rule), and the Captain edit path reuses
  the line's snapshot target instead of recomputing.
- `max_stock_qty_base = target` everywhere at Wola; a dynamic target above max
  makes the "Max" label look inconsistent. The counted-path gates ignore max, the
  uncounted-path over-MAX gate is unchanged (already trips today for 1 blok > 10 kg).
  Proposed (not applied) SQL raises max for the 18 rows to a 7-day cover.
- Migration not yet applied when the code deploys → `load_location_product_usage`
  raises on Supabase. Mitigation: routes load usage through a best-effort helper
  that logs and returns `[]` (dynamic silently off until the table exists).
- Seed CSV in `docs/pita-supply-os-v1/seed/` would make the 644 tests
  date-dependent. Mitigation: `SUPPLY_OS_DYNAMIC_TARGET_ENABLED=false` in
  `tests/conftest.py`; dynamic tests flip the setting and pin `today`.
