# WOLA — 9 new Blue Service products + paper trays (track A) — Plan Brief

> Full plan: `context/changes/wolska-blueservice-master-data/plan.md`
> Track B (blocked office items): `context/changes/supplier-per-location/change.md`

## What & Why

Tushar reported 13 items to add for Wolska at Blue Service and 3 to remove from Pago.
Verification showed the lists overlap: the 3 "removals" are the same products as 3 of
the "additions" — a supplier re-point, blocked by the data model. This plan delivers
the **10 items independent of that decision**, so Tushar gets 10 of 13 immediately and
the architectural decision is not made under time pressure.

## Starting Point

Prod (Supabase): 145 products, 145 `supplier_products` rows (the "one product = one
supplier" rule holds in practice), 141 WOLA thresholds. Nine items from the Wolska
sheet are absent from the catalog entirely; a tenth (`Tacki papierowe`) exists as P143
but has no WOLA thresholds, so it is invisible. Tushar's sheet was verified — filled
in, all 13 items with min/max under `Chemia`.

## Desired End State

The Wolska captain sees 10 new items in the inventory count (`Chemia` group) and on the
Blue Service order screen, with a computed suggestion. Bracka, Norblin and KEN unchanged.
Seed matches prod row for row for WOLA.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Scope | Split into track A / track B | 10 items unblocked now; architecture without time pressure | Operator |
| Supplier dimension | On the location, not the city | Two locations in one city can have different suppliers | Operator |
| Paper trays | Reuse the existing P143 | No order history → splitting later costs nothing | Plan |
| P143 name/category/unit | Unchanged | Global fields; product already used by Bracka and Norblin | Plan |
| Category of the 9 new | `Chemia` (highlighter included) | The screen should match the sheet the captain counts from | Plan |
| Prices | Left empty, never guessed | Convention from the Corfu beers and P143–P145 (`23dbb78`) | Plan |
| Thresholds for other locations | Not added | Items are not on their sheets; P143–P145 precedent | Plan |
| Seed↔prod drift | Closed in its own phase | Same file; left open it grows with every lane | Plan |
| `sp.active` bug | Deferred to track B | The fix only makes sense with the supplier dimension | Plan |

## Scope

**In scope:** 9 new products (P146–P154) · 9 Blue Service links · 10 WOLA threshold rows
(9 new + P143) · 2 test-assertion updates · seed↔prod drift closure (7 rows) ·
idempotent prod SQL.

**Out of scope:** re-pointing staples/markers/pens from Pago (track B) · the `sp.active`
filter (track B) · thresholds for BRACKA/NORBLIN/KEN · guessing prices · changing P143's
name/category/unit · frontend · backend deploy.

## Architecture / Approach

A data-only change, recorded twice and independently: **seed CSV** (tests + dev) and
**SQL against Supabase** (prod). The key non-obvious point: prod reads Supabase, so
**merging to main changes nothing** for the captain — only the phase 3 SQL does. No
backend or frontend code is touched, so **no deploy is required**.

## Phases at a Glance

| Phase | Delivers | Key risk |
|---|---|---|
| 1. Catalog | 9 products + Blue Service links + 10 WOLA thresholds in seed | An id typo desyncs three files — caught by the consistency check |
| 2. Seed↔prod drift | 7 missing WOLA rows (P135–P141) | None — file used only by tests and dev |
| 3. Prod | Idempotent SQL + post-audit | The only phase with a real effect; needs explicit operator go-ahead |

**Prerequisites:** access to prod Supabase (have it) · Tushar's sheet confirmed (done).
**Estimated effort:** one session; phases 1–2 mechanical, phase 3 one SQL run plus audit.

## Open Risks & Assumptions

- **Assumes `Tacki papierowe 14x25 100 sztuk` on the Wolska sheet is the same product as
  P143 at Bracka and Norblin.** The Wolska sheet states a size; theirs do not. To confirm
  with Tushar after rollout — if it is a different size, splitting it out costs nothing
  (no order history).
- P143 carries unit `opak` and category `Opakowania`, while the Wolska sheet says `szt`
  and `Chemia`. Global values left alone, so the captain finds it in a different group
  than on paper.
- Prices for all 9 items are unknown — order valuation will skip them until the first invoice.

## Success Criteria (Summary)

- The Wolska captain can see and order all 10 items from Blue Service.
- Bracka and Norblin notice no change.
- Tushar gets an answer that 10 of 13 are done and 3 await the supplier-dimension
  decision — with a concrete reason, not "in progress".
