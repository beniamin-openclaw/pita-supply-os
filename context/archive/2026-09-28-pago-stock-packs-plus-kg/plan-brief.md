# Stock input as packs + loose base units — Plan Brief

> Full plan: `context/changes/pago-stock-packs-plus-kg/plan.md`
> Frame brief: `context/changes/pago-stock-packs-plus-kg/frame.md`
> Research: `context/changes/pago-stock-packs-plus-kg/research.md`

## What & Why

The stock field does not let a Captain say "N packs and some loose kg", so each person picks a
unit, and both stock values and thresholds for pack-based products have drifted into a mix of packs
and base units (frame.md). We replace the single field with [packs] + [loose base units] on the
four Captain stock surfaces, storing the same base-unit number as today.

## Starting Point

One base-unit `DecimalInput` per product; the order card has a "wpisz w …" toggle (default off,
session-local) that did not stop the mixing. Prod: BRACKA types blocks everywhere, KEN types kg in
the count and blocks on the order card, and several targets are pack counts (Gyros 15: BRACKA 8,
WOLA 10, KEN 10).

## Desired End State

Every pack-based product (`units_per_purchase_unit > 1`) shows two fields with declined unit
captions and a reading "= 1 blok + 5 kg (20 kg)". A soft prompt "Czy chodziło o 6 bloków (90 kg)?"
fixes a pack count typed as kg with one tap. Order-card thresholds read "Cel: 10 bloków (150 kg)".
×1 products look exactly as before. Nothing blocks submit; no backend change.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Stored unit | Base units unchanged (kg / opak / szt) | No backend, payload, draft or data change; matches GoStock | Frame |
| Scope of products | Every `isPackBased` product, all suppliers | Replaces a generic toggle; pack size from `units_per_purchase_unit` | Operator brief |
| Surfaces | Order card (new + edit), inventory grid (count + edit) | Two shared components cover all four | Research |
| Order card layout | Pack-based: full-width stock row above a 2-col Suggestion/Order grid | Two fields do not fit a ~95 px column at 375 px | Plan (approved at STOP) |
| Inventory row layout | Pack-based: fields on their own line under the name | Name + two fields do not fit one row on a phone | Plan |
| Reading format | "= {split} ({total})", "= {total}" below one pack | Packs-first, same shape as thresholds and the prompt | Plan (approved at STOP) |
| Prompt rule | packs empty/0, 0 < loose < 1 pack, whole/half, max(previous, target) ≥ 2 packs, shown after the field loses focus, all base units incl. szt | Silent while references are themselves pack counts; no flash mid-typing | Plan + review + operator (szt included) |
| Prompt for Pago (alerts off) | Shown | It is about unit entry, not deviation alerts | Plan |
| Thresholds wording | Packs-first on the order card; inventory shows no min/max (3×max warning reads only "sprawdź jednostkę") | "min i max to dla zamówień" | Operator (STOP) |
| Old toggle | Removed with its keys and `packUnitLocative` | Replaced by the always-visible fields | Operator brief |
| Deploy order | Merge only after the operator's data session converts pack-based thresholds | Otherwise BRACKA/KEN suggestions drop to 0 | Frame + operator (STOP) |

## Scope

**In scope:** `lib/packStock.ts` + tests; `PackStockInput` component + tests; `ProductCard`,
`CaptainMP` (previous-count reference), `InventoryCountGrid`; i18n keys (PL/EN); declension tests;
read-only `threshold-audit.sql`; roadmap row.

**Out of scope:** backend/API/DB; converting thresholds or old snapshots; order quantity and
engine; Manager screens; read-only stock displays (order detail, history, "ostatnio"); an inverse
"did you mean kg?" prompt; persisting prompt dismissal.

## Architecture / Approach

Pure helpers (split, combine, format, `suggestPackCount`) → one presentational `PackStockInput`
(two `DecimalInput`s, local field state, emits base units, re-seeds from the base value when it
changes from outside, never on its own echo) → used by `ProductCard` and `InventoryCountGrid` for
pack-based products; callers pass references (newest snapshot count on the new-order and count
pages, target everywhere).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Helpers and copy | Tested arithmetic, reading, prompt rule; i18n keys | Float tails (3 × 4.2) |
| 2. Order card | Two-field input on new order + edit, packs-first thresholds | Re-seed vs echo while typing; conflict with PR #30 |
| 3. Inventory grid | Two-field input on count + count edit | Row layout on 375 px |
| 4. Verify, PR, gate | `/verify`, audit SQL, PR, prod check (Captain token only) | Deploying before thresholds are converted |

**Prerequisites:** operator's data session converts pack-based thresholds (merge gate only; build
can proceed).
**Estimated effort:** ~1 session for phases 1–3, plus the gated merge/deploy.

## Open Risks & Assumptions

- Thresholds still in packs at merge time would make suggestions wrong at those locations (gate).
- PR #30 (dynamic target, open) rewrites the same area of `ProductCard.tsx`; whichever merges
  second resolves conflicts.
- Local `main` carries an unpushed archive commit (7dced7e) that collides with `origin/main` on
  roadmap row R-20; resolved by renumbering at rebase time.
- The prompt can fire on a genuine small stock (e.g. 6 kg of gyros) — accepted, one tap "Nie".

## Success Criteria (Summary)

- A Captain can enter "1 blok + 5 kg" or "20 kg" and the order/count stores 20 kg either way.
- Typing a block count into kg on any Captain stock screen is caught by a one-tap prompt once
  references are in base units.
- ×1 products and all downstream data (suggestions, payloads, Manager views) are unchanged.
