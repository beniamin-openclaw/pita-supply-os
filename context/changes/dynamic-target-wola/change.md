---
change_id: dynamic-target-wola
title: Dynamic target (usage × days to next delivery) for Wola — Pago + Coca-Cola, seeded from GoStock
status: implemented
created: 2026-09-07
updated: 2026-09-07
archived_at: null
---

## Notes

Operator ask (2026-09-07, after the GoStock merge in
`docs/pita-supply-os-v1/analysis/gostock-2026-09-06/`): present the analysis as a
project description in a Google Doc, draft an email to Marek / Sławek / Georgios,
explain how a dynamic target could work, then plan → review/harden with independent
agents → implement → post-implementation review → hand over for a human click-through.
Operator explicitly left design decisions to "reasonable choices within our rules".

Rules in force: no prod master-data change and no prod migration without the
operator's explicit approval (this change ships the SQL as files only); no real
supplier order from tests; no emails/messages sent (drafts only); data-layer seam
via `_choose_backend()` only; no secrets in git; skill artifacts in English.

Scope: Wola only, Pago + Coca-Cola SKUs (the 18 rows that have a GoStock usage
estimate). The engine is generic — any location gets a dynamic target the moment
it has a `location_product_usage` row with confidence A/B and its supplier has a
parseable delivery calendar. Everything else stays on the static target.

Upstream: `docs/pita-supply-os-v1/analysis/gostock-2026-09-06/target_seed.csv`
(usage/day per SKU, confidence, current targets, cover days) and
`context/changes/week1-feedback-targets/` (KEN/Wola static targets, C-1 bifteki,
C-3 Coca-Cola KEN — both still pending).

Decisions taken for v1 (see `research.md` for the rationale and the rejected options):
1. Usage per day is master data (`location_product_usage`), seeded from GoStock,
   editable in SQL; not computed live from Supply OS counts yet (only 1 week of
   data outside Wola).
2. Horizon = days from today to the next delivery + days from that delivery to the
   following one, both derived from `suppliers.delivery_days` with the SAME rule the
   frontend already uses for `requested_delivery_date`.
3. Safety = max(`min_stock_qty_base`, usage × `safety_days`), `safety_days` = 1.
   `min` finally does something.
4. Confidence C rows are stored but ignored by the engine (static target).
5. No weekday weights in v1 (no daily POS data yet).
6. The effective target is computed server-side and returned as
   `target_stock_qty_base` on the orderable item, with a `target_source` object for
   the visible math. Frontend math stays byte-identical (it already uses that field).
7. Kill switch: `SUPPLY_OS_DYNAMIC_TARGET_ENABLED` (default true in prod, false in
   the test suite so the 644 existing tests stay date-independent).

## Implemented (2026-09-07, 03:00–05:30)

Plan revision 2 (after `reviews/plan-review.md` + `reviews/hardening.md`) implemented 1:1;
Progress in `plan.md` all ticked. Nothing committed, nothing applied to prod.

- **Backend:** `app/dynamic_target.py` (pure engine), `LocationProductUsage` / `TargetSource`
  models, `settings.dynamic_target_enabled` (tests: off via conftest), seam loader
  `load_location_product_usage` on seed / sheets / supabase, migration
  `0018_location_product_usage.sql` (0017 is taken by the concurrent finance lane), routes:
  orderable overlay (`_apply_effective_target`), submit gate on the effective target with the
  validated `requested_delivery_date`, edit on the line snapshot, `_load_usage_safe` catching
  any backend failure. Tests: `test_dynamic_target.py` (engine, 40 cases incl. the two worked
  examples), `test_dynamic_target_routes.py` (18 cases: orderable, submit, date validation,
  degraded backend, flag off, edit snapshot), loader tests, integration smoke test.
- **Frontend:** `TargetSource` type, i18n keys, `lib/dynamicTarget.ts` (window + edit overlay),
  ProductCard badge + math line + safety-floor signal, ContextStrip delivery window,
  OrderEditPage overlay. Display fix found on the way: the base deficit is now `roundQty`'d
  (76.6 − 20 rendered as 56.599999999999994).
- **Verification:** ruff OK; pytest 727 passed (3 failures are `tests/test_finance_routes.py`
  from the concurrent lane, unrelated); vitest 375 passed; `vite build` OK; eslint OK for every
  file of this change (2 errors live in `pages/manager/finance/`, other lane).
- **Manual click-through** on a local seed run with auth ON, flag ON and a scratch
  `suppliers.csv` (Coca-Cola `Thu`, Pago `Tue, Sat`): WOLA × Coca Cola Hub strip shows
  "dostawa czw., 10.09 · następna czw., 17.09"; Coca Cola card: badge "dynamiczny · A",
  "4.53 szt/dzień × 10 dni + zapas 14 szt = 60 szt", stock 10 → suggestion 50 → submit 200
  ("Zamówienie wysłane pomyślnie"); Kinley / Monster / Lech Free stay static (confidence C).
- **Prod package:** `prod-sql.sql` sections A (0018), C (calendars), B (18 usage rows),
  D (max ceilings for the 4 Pago rows), E (optional lower mins), AFTER audit. Not applied.

## Post-implementation reviews (2026-09-07, two independent agents)

- `reviews/impl-review.md`: SHIP, no CRITICAL/HIGH; F3 (stale comment) and F4 (`captain_submit`
  now skips the engine entirely when the flag is off) applied.
- `reviews/adversarial-impl.md`: 42,336-combination property sweep and 934 FE/BE parity submits
  clean; five findings fixed: (1) one malformed usage row no longer empties the whole table
  (per-row tolerant CSV/Sheets loaders), (2) a client `requested_delivery_date` equal to today
  is rejected (strictly after today, like the orderable screen), (3) the card shows usage at
  full precision so the math line reproduces the target, (4) order-detail lines report
  `max(static max, snapshot target)` so a re-edited dynamic line never reads max < target,
  (5) duplicate (location, product) rows in CSV/Sheets: first wins, logged. #6/#7 (ceil of
  values below 1e-7, datetime passed to the pure engine) are unreachable through typed inputs
  and left as-is.

## Known limitations (accepted for v1)

- `order_lines` does not persist the target mode/confidence (hardening H13/H14): the FR-012
  suggestion review mixes static and dynamic rows, and the Manager sees a bare target number.
  Follow-up change once a migration-before-code deploy can be scheduled.
- Only weekday-token calendars; a numeric `delivery_days` ("3") keeps the static target.
- No weekday weights / seasonality; safety is `max(usage × 1 day, min(min, usage × 3 days))`.
- A tab left open across midnight can show yesterday's target; the backend re-anchors on
  today's calendar, so the gate may ask for a reason — reload fixes it.

## Working-tree note

Another lane (`finance-invoice-reconciliation`) is editing the same working tree
concurrently (ebiuro/finance files, its own edits in main.py/models.py/types.ts/strings.ts).
This change's files are listed above; commit them separately from the finance files.

## Repo note (2026-09-13)

`docs/pita-supply-os-v1/analysis/gostock-2026-09-06/` (raw GoStock exports and derived panels
with purchase prices, stock values and cost of sales per location) is **not committed** — the
repository is public. The only artifact of that analysis that enters git is the 18-row seed
`docs/pita-supply-os-v1/seed/location_product_usage.csv` (usage per day per SKU). The full
analysis stays on the operator's machine (`.gitignore` entry added in this commit).
