# Frame Brief: Stock entered in packs vs base units for pack-based products

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Captains enter the stock of pack-based Pago products (gyros blocks, souvlaki /
bifteki cartons, pita cartons) in the base-unit field (kg / opak) with mixed
units: Gyros 15 KG counts at BRACKA were 8 (21.09) and 6 (27.09), at BROWARY 6
(27.09, after 90 on 20.09) — block counts typed into a kg field; WOLA and KEN
type kg. GoStock counts gyros/souvlaki/bifteki in kg and pita in pieces.

## Initial Framing (preserved)

- **User's stated cause or approach**: the single stock field is in the base
  unit while the goods are physically handled in packs and are often partial
  (half a carton, a cut block), so Captains type whichever unit they think in.
- **User's proposed direction**: keep the stored base unit; replace the stock
  input for every `isPackBased` product with a two-field input
  [packs] + [loose base units] that converts both ways and shows the combined
  reading; show thresholds in packs too; a soft, never-blocking "did you mean
  N packs?" prompt. Surfaces: order card, inventory count grid, inventory count
  edit, Captain order edit.
- **Pre-dispatch narrowing**: not asked interactively — the operator's brief
  (decision 2026-09-28, "bloki + kg") already fixes scope and direction, and
  the agreed STOPs are at plan approval and before merge. The one open
  question this frame surfaced (deploy order vs thresholds, below) is carried
  to the plan-approval STOP instead.

## Dimension Map

1. **Input affordance** — one base-unit field; the pack is the physical unit,
   so a pack count lands in the kg field. ← initial framing
2. **Discoverability of the existing pack mode** — a "wpisz w blokach" toggle
   already exists on the order card (default off, session-local, small pill
   at the end of the state row); if Captains knew it, mixing would not happen.
3. **Thresholds in the wrong unit** — if `location_product_settings` were set
   in packs, a Captain typing packs gets sensible suggestions and a Captain
   typing kg gets none, which reinforces pack typing.
4. **Non-typed sources** — prefill from an inventory snapshot, GoStock import
   or manager skeleton lines could write pack-looking numbers without anyone
   typing them.

## Hypothesis Investigation

Evidence: read-only SELECTs on prod Supabase (2026-09-28), Sept 2026 rows.

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. Affordance: packs typed into the base field | Gyros 15 (15 kg/blok): BRACKA inventory 9, 9, 5, 8, 6 and order stock 7, 4, 8 (always blocks); KEN inventory 30–45 kg but order stock 2, 2, 2, 2 (blocks, same week); BROWARY inventory 6, 7, 120, 90, 6 (mixed); WOLA 8, 7 early Sept, then 60, 45, 60 kg. Souvlaki Wieprz (5 kg/karton): BRACKA inventory 19 kg vs order stock 2, 3; KEN inventory 12–20 kg vs order 2. Pita (12 opak/karton): BRACKA inventory 44–96 opak vs order stock 2, 4. | STRONG |
| 2. Existing toggle not found | `ProductCard.tsx:106` `useState(false)` (default off, not persisted); pill at the end of the state row (`ProductCard.tsx:404-420`); the inventory grid has no toggle at all (`InventoryCountGrid.tsx:209-226`, pack hint only). Mixing persisted for three weeks after the toggle shipped (pack-units-display-mobile-wrap, 2026-09-06). | STRONG (as a reason the fix must be always-visible, not a mode) |
| 3. Thresholds in packs | `location_product_settings`: Gyros 15 target BRACKA 8, WOLA 10, KEN 10, BROWARY 10, FORUM 15; Pita target BRACKA 4, WOLA 5, NORBLIN 6 vs KEN 30, BROWARY 60; Souvlaki Kurczak target BRACKA 8, KEN 6, WOLA 12 vs BROWARY 45. Many rows are pack counts stored as kg/opak. With WOLA typing 60 kg against target 10, the suggestion is 0. | STRONG — co-cause and hard dependency, not an alternative |
| 4. Non-typed sources | Order stock differs from the same-week snapshot (KEN 30 vs 2), so not prefill. Zeros on 25.09 for ELEKTROWNIA / NORBLIN / WESTFIELD are Transport skeleton lines (stock 0 = uncounted). BROWARY decimals (47.368, 26.712) look imported/converted but are kg-plausible. | WEAK — explains some zeros/decimals, not the pack counts |

## Narrowing Signals

- The same location types kg in the inventory grid and packs on the order card
  in the same week (KEN gyros, BRACKA souvlaki/pita): the confusion is per
  field, not per person, so an explicit pack field on every surface is the
  right lever.
- Thresholds in packs mean the new input cannot be judged on its own: at a
  location whose target is "8" (blocks), a correctly entered 1 blok + 5 kg =
  20 kg reads as above target and the suggestion drops to 0.

## Cross-System Convention

GoStock (the company's stock system) counts these goods in kg and pita in
pieces; stock systems generally store one base unit and let the user enter
packs + remainder. The app already stores base units everywhere
(`lib/packUnits.ts` header: "State and the API contract stay in base units
everywhere"), so the proposed direction matches the convention.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the stock field does not let a
> Captain say "N packs and some loose kg", so each person picks a unit, and
> both stock values and thresholds for pack-based products have drifted into
> a mix of packs and base units.

The initial framing held — the two-field input is the right direction. What
the frame adds: (a) the order card is at least as affected as the inventory
grid, and (b) thresholds are part of the same drift, so the code change is
correct only once thresholds for these products are in base units. Converting
thresholds and old snapshots stays with the operator's data session (out of
scope here), but the plan must make the deploy order explicit and keep the
plausibility prompt safe while old snapshots still hold pack counts.

## Confidence

**HIGH** — direct prod evidence for mixing on both surfaces, the failed
toggle as a natural experiment, and a matching convention (GoStock).

## What Changes for /10x-plan

Plan the operator's direction as stated (frontend only, base-unit contract
unchanged), and add: a rollout gate tying the deploy to the thresholds
conversion for pack-based products, the order card as a first-class surface,
and a plausibility rule that stays silent when the reference data (previous
count, thresholds) is itself in packs.

## References

- `frontend/src/pages/captain-mp/components/ProductCard.tsx:102-124, 245-285, 404-420`
- `frontend/src/pages/captain-mp/components/InventoryCountGrid.tsx:196-251`
- `frontend/src/lib/packUnits.ts`, `frontend/src/i18n/packUnits.ts`
- `context/archive/2026-09-06-pack-units-display-mobile-wrap/plan.md` (toggle design, default off)
- Prod SELECTs: `inventory_count_lines`/`order_lines` for P024–P028, P145 since 2026-09-01; `location_product_settings` for the same products; active `supplier_products` with `units_per_purchase_unit > 1` (13 supplier/unit groups, incl. fractional 4.2, 2.5, 3.6).
