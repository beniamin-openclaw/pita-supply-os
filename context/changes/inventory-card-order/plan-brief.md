# Inventory card order + Pago/Mory list order — Plan Brief

> Full plan: `context/changes/inventory-card-order/plan.md`
> Research: `context/changes/inventory-card-order/research.md`

## What & Why

Captains count stock with a printed card per location (the "… - DRUK" tabs of the location's
Google Sheet). The app lists the same products in product-id order, so counting on the phone does
not follow the walk through the store. The inventory screens should read like the location's card.
The Pago and Magazyn Mory lists should follow the Ordering PB v5 sheet the Manager copies from.

## Starting Point

No inventory screen sorts on purpose:

- the Captain grid shows loader order (product id);
- the Manager view sorts by name and groups A→Z;
- corrected counts read back shuffled.

Only Bukat has per-supplier positions (0023). The 12 cards share one order and differ in only 26
rows.

## Desired End State

- Captain count, correction and history screens follow the location's card.
- The Manager detail opens in card order and can switch to "Kolejność zamawiania".
- New locations follow the common card order until their own card is applied.
- Pago and Mory lists follow the sheet.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Default order | Each location's printed card | Operator replaced "supplier blocks" with the card order | Operator |
| Storage | Hybrid: `products.inventory_order` template + `location_product_settings.inventory_order` override (0027) | 165-product template + 26 overrides reproduces all 12 cards exactly; new locations get an order for free | Adversary pair |
| Where sorting happens | Backend, one resolved position, one key | Captain grid already follows backend order | Research |
| Snapshot order | Current master data, not count-time | No per-snapshot data exists; simpler | Plan |
| Manager options | "Karta inwentaryzacji" (default when positioned) + "Kolejność zamawiania" | Operator accepted supplier order as an option | Operator |
| Group order | First-seen for card/supplier sorts, A→Z otherwise | Keeps card sections; existing sorts unchanged | Plan |
| Pago/Mory order | Ordering PB v5 rows, separate SQL file independent of the merge | Column exists since 0023; operator times it | Plan |
| Release | 0027 → merge after 1.10 → live → gated SQL | Operator timing; lessons.md order | Operator |

## Scope

**In scope:**
- migration 0027 (two columns);
- backend order and fields;
- Manager sorts and default;
- two gated SQL files with diff and audit;
- docs.

**Out of scope:**
- a Captain sort control;
- per-snapshot order;
- a position-editing UI;
- new catalogue products for unmatched card names;
- the combined Pago + Mory transport (separate change).

## Architecture / Approach

- `product_order.py` gains `effective_inventory_order`: the override, else the template.
- It also gains `inventory_sort_key`: `(eff is None, eff, product_id)`.
- `captain_inventory_products` and the count-detail routes sort by that key. Their responses
  expose the resolved `inventory_order`, and the detail lines also carry `display_order` and
  `supplier_product_id`.
- `productListFilter.ts` adds the "card" and "supplier" sorts and a Manager default helper.
- A generator over the parsed cards writes the gated SQL.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend order | 0027, models, sorted routes, tests | Pinned key-set tests |
| 2. Manager view sorts | card/supplier sorts, group rule, default helper, copy | Captain grid shares the default view |
| 3. Prod data SQL and docs | generator, two SQL files validated locally | Card parse vs live settings |
| 4. Release | operator-gated rollout | Timing around 1.10 |

**Prerequisites:** none in code; operator go for 0027, merge, and each SQL file.
**Estimated effort:** one implementation session + operator rollout.

## Open Risks & Assumptions

- The Mory "typ 1/2/3" till-roll mapping and the "Box beżowy" mapping are inferred. One UPDATE
  fixes either.
- A card change needs a re-run of the pipeline. Positions are generator-owned and never
  hand-edited; the re-run clears and re-derives every override.
- At a carded location, products its card omits go to the end of their section through derived
  overrides (NORBLIN 22, BRACKA 8, WOLA 4, KEN 4). A product activated later takes the template
  position until the next re-run.
- Four card names have no catalogue product and stay unpositioned.

## Success Criteria (Summary)

- A Captain at WOLA counts in the same order as the Wolska card.
- The Manager detail opens in card order, and "Kolejność zamawiania" works.
- The Pago and Mory screens follow the Ordering PB v5 order.
