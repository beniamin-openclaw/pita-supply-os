# Per-supplier product order and logistic-minimum exclusions — Plan Brief

> Full plan: `context/changes/supplier-product-order-minimum/plan.md`
> Research: `context/changes/supplier-product-order-minimum/research.md`

## What & Why

Marek (28.09): each supplier's products must appear in one order on every screen and
document, and Bukat's 500 PLN logistic minimum must not count Tzatzyki, Tirokafteri/Hot
Feta and Feta blok. Today order drifts per surface and the minimum chip compares the
whole order total.

## Starting Point

No position field exists. The Captain order screen shows `supplier_product_id` order
(not name, as the lane note assumed); the e-mail and copy lists inherit that via
`order_line_id`; Transport sorts by name. The minimum chip compares the stored total on
the Manager queue, Manager detail and Captain detail.

## Desired End State

Bukat reads Pomidor, Cebula czerwona, Awokado, Cytryna, Ogórek, Papryka, Sałata,
Rucola, Natka, Czosnek, Cebula biała, Tzatzyki, Tirokafteri, Feta on every Captain and
Manager screen, in the supplier e-mail and in the copy lists — old orders included.
Other suppliers keep their current Captain order and every other surface now matches
it. A Bukat order with the dairy shows "below minimum — X PLN counts toward it" when the
rest is under 500; nothing is ever blocked.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Storage | `supplier_products.display_order int NULL` + `counts_toward_minimum bool NOT NULL DEFAULT true`, migration 0023 | Per-supplier data, same shape as `warehouse_pickup` / 0022 flag | Research |
| Tie-break without a position | `supplier_product_id` (not name) — operator confirmed 28.09 | Keeps every supplier's current Captain order (Blue Service/Intermlecz are grouped by type in id order); ASCII key makes FE/BE e-mail twins byte-identical | Plan |
| Where order is applied | At read time: backend sorts sources, FE sorts documents with one shared comparator | Old orders render in the new order; line ids stay opaque | Plan |
| Manager-added lines | Land at their position everywhere (Manager table = e-mail); only the Transport matrix keeps them pinned at the bottom — operator confirmed 28.09 | Today's "added last" in the Manager table is an id-sort artefact; v5.1 "dodaje się od dołu" was a Transport-matrix rule | Plan review F1 |
| Minimum basis | Server-side: stored total − excluded lines (effective qty × price), `None` when nothing excluded | Consistent with the displayed total; zero change for other orders; errs toward warning | Plan |
| Chip copy | New "do progu liczy się {basis} PLN" variant when a basis applies | A 756 PLN total flagged "below 500" needs the counted amount | Plan |
| Inventory screens | Cut by the operator — follow-up after the new locations start on 1.10 | Don't change the count grid in the week of the rollout | Operator |
| SUP_INTERNAL | Hidden from Captain/Transport supplier pickers + 400 on Captain submit; stays active in data | On-site production is counted, never ordered; inventory needs the active supplier | Operator |
| Positions | 10, 20, … 140 in the operator order, by id | Room to insert later; names are changing in a parallel lane | Plan |

## Scope

**In scope:** migration + model + shared key; orderable list, order-line and receipt
enrichment, Transport aggregate/matrix/options, e-mail twins, copy lists; minimum basis
on queue + both details + chip; SUP_INTERNAL hidden from ordering;
`prod-sql.sql` for Bukat.

**Out of scope:** admin UI for positions, any gate on the minimum, money on the Captain
entry screen, live draft recomputation, rewriting stored line ids, any inventory-screen
reordering (follow-up), deactivating SUP_INTERNAL in data
order, positions for other suppliers.

## Architecture / Approach

One key `(display_order IS NULL, display_order, supplier_product_id)` in
`app/product_order.py` and its twin `src/lib/productOrder.ts`. Backend producers
(`_build_orderable_items`, both line enrichments, receipts, Transport aggregate,
`gmail_url`) sort with it; FE document builders sort explicitly. The basis is one pure
helper feeding three existing responses.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schema + key | 0023, model, fixture, seed, comparators, `prod-sql.sql` | Fixture conflict with PR #33/#30 |
| 2. Canonical order | Same order on all per-supplier screens and documents | FE/BE twin drift; Transport matrix pin regressions |
| 3. Minimum basis | Chip ignores excluded products, says what counts | Chip turns "below" on ~8 of 12 recent Bukat orders — expected, announce it |
| 4. SUP_INTERNAL | Not offered for ordering; submit refused | Must not touch inventory grouping |
| 5. Release | PR → migration → merge → live → data SQL (operator) | Order of operations |

**Prerequisites:** operator approval of this plan; migration and data SQL run only on
explicit go.
**Estimated effort:** one implementation session (~4 phases of code) + operator rollout.

## Open Risks & Assumptions

- A later Pago+Mory combined list (coordinator, future) spans two suppliers and will
  need its own cross-supplier key; the per-supplier mechanism here stays generic.
- PR #30 (0018) and the zero-quantity lane (0024) touch nearby code; this lane merges
  first on Tuesday.
- Stored `manager_final = 0` is ambiguous app-wide; a manager-zeroed excluded line makes
  the basis read slightly low (warns more), never high.

## Success Criteria (Summary)

- Captain, Manager and supplier e-mail show Bukat in the operator's order on prod.
- The Bukat chip reflects the minimum without dairy; nothing is gated.
- Suites green; CI integration applies 0023; rollout done in the agreed order.
