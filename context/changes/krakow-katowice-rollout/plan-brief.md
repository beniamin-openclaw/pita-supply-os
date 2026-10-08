# Kraków FORUM + Katowice SUPERSAM rollout — Plan Brief

> Full plan: `context/changes/krakow-katowice-rollout/plan.md`
> Research: `context/changes/krakow-katowice-rollout/research.md`

## What & Why

Kraków Forum and Katowice Supersam start counting stock on Sunday 2026-10-11 and ordering on Monday 2026-10-12; captains train on Friday 2026-10-09. They buy from their own city suppliers (Dis-Pack, Kuchnie Świata, Selgros, Bukat Kraków), which the one-global-catalog model cannot express, and some products (Katowice fries) come from two suppliers.

## Starting Point

Every location sees every active supplier tab and one global `supplier_products` catalog (one active row per product in prod). FORUM and SUPERSAM exist as inactive template locations with Warsaw-shaped settings rows and no data of their own.

## Desired End State

A captain at FORUM or SUPERSAM sees only their city suppliers with thresholds from Marek's sheet; a backup supplier's product shows without a suggestion and points to the primary one; a product already on order at another supplier says so on the card and in the manager's order view. Warsaw screens are unchanged except that empty supplier tabs disappear.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Catalog model | `supplier_products.location_id` + `locations.own_catalog` switch | City locations must not inherit Warsaw suppliers; Warsaw keeps the shared rows untouched. | Research + Plan |
| City suppliers | Separate supplier records per city, complete ("full") | Each city orders separately; nothing in Marek's mail or the mailbox says otherwise. | Plan (operator) |
| Duplicates | Primary row carries thresholds/suggestion; backup row (`is_backup`) has none | One threshold per (location, product) can only drive one suggestion. | Plan (operator) |
| "Already ordered" hint | Open orders (submitted/claimed/sent), last 7 days, at other suppliers | Captain and manager need to see fries already ordered at Kuchnie Świata before ordering at Selgros. | Plan (operator) |
| Empty tabs | Hidden for captains (all locations) | City captains would otherwise see ~20 irrelevant Warsaw tabs. | Plan (operator) |
| Inventory list | Sheet products + count-only 0/0/0 (Pago, Mory, drinks, own production); template leftovers deleted | Count everything they hold; no suggestion where no data. | Plan (operator) |
| Kraków Bukat without Marek's answer | FORUM August thresholds | Only existing Kraków data. | Plan (operator) |
| Timing | Code + data tonight (2026-10-08); tokens ready for Friday training | Operator decision. | Plan (operator) |

## Scope

**In scope:** migration 0029, catalog module wired into every location-blind consumer, captain supplier list endpoint, backup rows, open-order hint (captain + manager), prod SQL A/B/C + rollback + audit, docs.

**Out of scope:** suggestion math, Pago/Transport for the new cities, new products awaiting Marek, per-location delivery rules, finance/eBiuro, rewriting the legacy sync scripts.

## Architecture / Approach

One pure module (`app/supplier_catalog.py`) decides which catalog rows a location sees; `_build_orderable_items`, submit/edit master-data resolution, inventory pack hints and stock value all call it. Backup rows reuse the existing per-item `suggestion_alerts_enabled` gate on both sides. The hint is computed server-side and rides on existing payloads. Prod data is split around the deploy because old code ignores `location_id`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend | Schema, catalog module, consumers, captain suppliers, hint, tests | A missed consumer leaks scoped rows into Warsaw |
| 2. Frontend | Filtered tabs, backup cards, hint lines, edit-page parity | Parity drift between card and submit gates |
| 3. Prod SQL | Locations, settings, city suppliers, scoped rows, DELETE leftovers | Running step B before the code deploy |
| 4. Go-live | PR, 0029 on prod, deploy, tokens, GET smoke, docs | Claiming live before the running artifact is checked |

**Prerequisites:** operator applies 0029 and runs the SQL; captain tokens added on Railway by the operator.
**Estimated effort:** one long session tonight across 4 phases.

## Open Risks & Assumptions

- Marek's answers (Bukat Kraków, Kraków Selgros, supplier contacts) may change thresholds after go-live — settings are editable in the manager UI.
- Supplier contacts are unconfirmed; orders to city suppliers may need manual sending until confirmed.
- `sync_master_data.py` / `backfill_supabase.py` would strip scoped rows — must not be run.

## Success Criteria (Summary)

- FORUM and SUPERSAM captains see only their city suppliers and can count and order on Monday.
- Katowice fries show in Kuchnie Świata with a suggestion and in Selgros without one, with the "already ordered" line when relevant.
- Warsaw captains and managers see no change other than hidden empty tabs.
