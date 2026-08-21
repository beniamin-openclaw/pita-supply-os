# Seed CSVs — test fixture, NOT a production mirror

These CSVs are a **curated fixture**. They back the `seed` data backend
(`SUPPLY_OS_DATA_BACKEND=seed`, `SUPPLY_OS_SEED_DIR`), which the backend test
suite and credential-free local dev run against.

**They do not mirror production and are not kept in sync with it.** Production
master data lives in Supabase Postgres (with the Sheets adapter behind the same
`_choose_backend()` seam). Nothing reconciles the two, and nothing is meant to.

## What this means when you read a green test suite

A green `python -m pytest` proves the code behaves correctly **against this
fixture**. It proves nothing about production wherever the fixture and prod
disagree — and they do disagree, in both directions. Any claim about production
behavior needs a query against production, not a passing test.

Corollary for test authors: assert on **behavior**, not on facts about the real
business. `"KEN has no thresholds"` is a property of this fixture; it is false in
production. Word docstrings and test names so they describe the fixture, never
the company.

## Known divergences (recorded 2026-08-20, not exhaustive)

Fixture is **behind** production:

| | fixture | production |
|---|---|---|
| `location_product_settings` rows | 440 | 578 |
| — per location | WOLA 151 · BRACKA 144 · NORBLIN 145 | WOLA 151 · BRACKA 144 · NORBLIN 145 · **KEN 138** |
| KEN | absent from `location_product_settings`; `active=FALSE` in `locations.csv`, noted "Phase 2+ rollout candidate" | live location with 138 threshold rows |

- `locations.csv` also carries `BROWARY`, `KAMIENICA`, `KULINARNA` — v0-era
  rollout placeholders, all `active=FALSE`, none of them live locations.
- Threshold **values** drift pervasively — this is the big one. A full
  row-by-row diff of WOLA against prod (2026-08-20) found **92 of 151 rows
  (60%) differ**, and **85 differ on `target_stock_qty_base`** — the field the
  suggestion engine actually consumes. The product-id sets match exactly, so
  this is pure value drift, not missing rows. Examples: `P127` is
  `min/max/target = 1/2/2` here vs `0.5/5/5` in prod; `P011` is `18/30/30` vs
  `6/36/36`; `P129` is `3/10/10` vs `6/60/60`. BRACKA and NORBLIN were not
  diffed row-by-row — assume comparable drift.

  Practical consequence: **any suggestion-engine number produced against this
  fixture is arbitrary with respect to production.** A test asserting a specific
  suggested quantity is testing the formula, never the real replenishment
  behavior of a real location.

Currently NOT diverging (but historically did):

- `supplier_products` sits at 154 rows, matching prod. The supplier-per-location
  lane briefly added three `SP_BLUESERV_*` office rows plus matching
  `source_supplier_id` pins on WOLA; commit `5b5af29` reverted both, so the
  fixture carries **zero** `source_supplier_id` pins today. The corresponding
  production master-data batch remains gated and unapplied.

## Changing these files

Edit them to serve a test. Do not edit them to "match production" — that is not
a goal, and a change made for that reason will silently break tests that depend
on fixture-specific values (e.g. the WOLA × `SUP_PAGO` 18-item count in
`supply-os-v1/tests/test_main.py`).

`supply-os-v1/scripts/verify_parity.py` is **not** a seed checker — it compares
Sheets against Supabase (both production stores) and never reads this directory.
