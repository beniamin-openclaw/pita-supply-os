# Stock input as packs + loose base units — Implementation Plan

## Overview

Replace the Captain's single base-unit stock field for pack-based products with a two-field input
**[packs] + [loose base units]** on the order card (new order + order edit) and the inventory grid
(new count + count edit). The stored value stays one base-unit number (`current_stock_qty_base`,
kg / opak / szt) — no backend, payload, draft or schema change. The input shows a combined reading
("= 1 blok + 5 kg (20 kg)"), thresholds on the card read packs-first ("Cel: 10 bloków (150 kg)"),
and a soft, never-blocking prompt asks "Czy chodziło o 6 bloków (90 kg)?" when a loose value looks
like a pack count.

Operator decision 2026-09-28 ("bloki + kg"); framing confirmed in `frame.md`, codebase map in
`research.md`.

## Current State Analysis

- Stock is `number | ""` in base units end to end; `""` = not counted (order payload sends `null`,
  `lib/buildPayloadLines.ts:30-31`; inventory payload drops the line,
  `InventoryCountPage.tsx:327-337`, `InventoryCountEditPage.tsx:133-143`).
- Order card: stock sits in a 3-column grid with Suggestion and Order
  (`ProductCard.tsx:236-391`); pack-based cards have a "wpisz w …" toggle, default off and
  session-local (`ProductCard.tsx:105-117, 404-420`), plus a "40 szt = 1,7 zgrzewki" hint.
  Threshold line is base-first: "Cel: 120 szt (5 zgrzewek)" (`ProductCard.tsx:169-202`,
  `i18n/strings.ts:149-160`); below-min is base only (`strings.ts:141-144`).
- Inventory grid: one `w-24` field per row, pack ratio + "≈ packs" hint, "ostatnio {qty}", 3×max
  warning in base units (`InventoryCountGrid.tsx:180-275`).
- `ProductCard` is rendered by `CaptainMP.tsx:807-821` and `OrderEditPage.tsx:289-303`;
  `InventoryCountGrid` by `InventoryCountPage.tsx:537-545` and `InventoryCountEditPage.tsx:260-267`.
- Card components unmount on supplier switch, category collapse and reload; local UI state is lost
  and must be derivable from the base value (research §Order card).
- Prod evidence (frame.md): the same location types packs on the order card and kg in the grid in
  the same week (KEN gyros 2 vs 30–45; BRACKA souvlaki/pita); several thresholds are themselves pack
  counts (Gyros 15 target BRACKA 8, WOLA 10, KEN 10; Pita BRACKA 4, WOLA 5).

## Desired End State

On every Captain stock input for a product whose `units_per_purchase_unit > 1`:

- Two fields side by side, captioned with the declined pack unit and the base unit
  ("bloki" / "kg", "kartony" / "opak", "zgrzewki" / "szt"). Typing either or both stores
  `packs × upp + loose` in base units; both blank = not counted; `0` in either = counted zero.
- Under the fields: "= 1 blok + 5 kg (20 kg)" (normalized split + total), or "= 6 kg" when there is
  less than one full pack. Typing 20 kg alone shows "= 1 blok + 5 kg (20 kg)"; typing 1 blok + 5 kg
  stores 20.
- When the packs field is empty/0, focus has left the input, and the loose value is a whole or half number below one pack while the larger of the previous count and
  the target is ≥ 2 packs, an amber prompt asks
  "Czy chodziło o 6 bloków (90 kg)?" with "Tak, popraw" (sets 6 bloków + 0 kg = 90) and "Nie"
  (hides it for that value). Nothing blocks submit.
- Order card thresholds read packs-first: "Cel: 10 bloków (150 kg) · Max: 10 bloków (150 kg) ·
  1 blok = 15 kg", below-min "Poniżej minimum: 4 bloki (60 kg)". The inventory grid shows no
  min/max at all (operator 2026-09-28: "min i max to dla zamówień"): its 3×max warning keeps firing
  on the same rule but reads only "sprawdź jednostkę" (no max value).
- Products with `upp ≤ 1` render exactly as today (single field, old wording).
- On a 375 px phone nothing clips or scrolls sideways.

Verification: Vitest + build + lint green; local preview at 375 px against a backend with auth ON
and only a Captain token; after deploy, the same checks on prod with the Captain token only.

### Key Discoveries:

- `DecimalInput` keeps a raw string buffer and re-seeds during render when `value` changes from
  outside (`components/ui/DecimalInput.tsx:48-64`) — the composite input reuses this pattern one
  level up.
- `packUnitLabel` declines both pack units and base units (`kg`, `opak`, `szt` are in the table,
  `i18n/packUnits.ts:21-78`); a dynamic `tPlural` would fail `pluralKeys.test.ts` check 2.
- Newest snapshot lines are already fetched and cached on the order screen
  (`CaptainMP.tsx:149-191`, `snapshotDetails[availableSnapshots[0].count_id]`); the count page
  already builds `previousByProduct` (`InventoryCountPage.tsx:313-324`). The two edit pages have
  thresholds only.
- JS float tails: `3 * 4.2 = 12.600000000000001`, `0.3 * 3 = 0.8999999999999999`;
  `12.6 / 4.2` happens to be exactly 3 but other ratios are not — split/combine need an epsilon on
  the floor and 3-dp rounding (prod has values like 2.916 kg).
- Pago has `suggestion_alerts_enabled = false`; that flag governs deviation alerts, not unit entry —
  the plausibility prompt shows regardless.

## What We're NOT Doing

- No backend, API, payload, model, draft-format or DB change; the stored unit stays kg / opak / szt.
- No conversion of prod thresholds or old snapshots (operator's data session). This plan only adds a
  read-only audit query and a deploy gate.
- No change to the order quantity field (stays purchase units) or the suggestion engine.
- No threshold line on the inventory grid, and the 3×max warning there stops printing the max
  value (operator: min/max belong to orders; unit hints are fine on the count); no
  pack reading on "ostatnio {qty}", `OrderDetailPage` "stan:", `InventoryHistoryPage`, or any
  Manager screen (`OrderLineTable`, `ManagerInventoryPage`, CSV).
- No inverse prompt ("did you mean kg?") for a pack field value that looks like kilograms; the
  existing 3×max warning stays the guard for that direction on the inventory grid.
- No persistence of the per-card prompt dismissal (session-local, resets on remount).
- No per-product override of which fields show; generic for every `isPackBased` product
  (Coca-Cola zgrzewki, Filber box, Intermlecz opak, Bukat wiadro/pojemnik included).

## Implementation Approach

1. A pure helper module `frontend/src/lib/packStock.ts` owns all arithmetic (split, combine,
   formatting, the plausibility rule) and is unit-tested exhaustively.
2. One presentational component `PackStockInput` (captain-mp/components) wraps two `DecimalInput`s,
   holds the two field values locally, emits base units upward, re-seeds from the base value when
   it changes from outside, and renders the reading and the prompt.
3. `ProductCard` and `InventoryCountGrid` render `PackStockInput` for pack-based products and keep
   their single field for the rest. Callers pass a reference list (previous count, target) — the
   only new prop is `previousStock` on `ProductCard`, fed by CaptainMP from the already-cached newest
   snapshot.
4. Copy lives in `i18n/strings.ts`; unit words come from `packUnitLabel`.
5. Ship as one frontend PR, merged only after the operator confirms thresholds for pack-based
   products are in base units (Phase 4 gate).

## Critical Implementation Details

- **Re-seed rule (state sequencing).** The component keeps `{packs, loose}` (each `number | ""`) and
  the last `value` it reconciled against. During render, when the incoming `value` differs from the
  last reconciled value AND differs from `combinePackStock(packs, loose, upp)`, it replaces the pair
  with `splitPackStock(value)` (or `{"", ""}` for `""`). The parent echoing back the value just
  emitted must not re-seed (otherwise typing "20" into kg would jump to "1" + "5" mid-edit). Both
  split and combine round to 3 dp so the echo compares equal.
- **Seeding shows explicit zeros.** A counted value re-seeds as numbers, including 0 in either field
  (20 → 1 / 5; 30 → 2 / 0; 6 → 0 / 6; 0 → 0 / 0). Blank stays blank / blank. While typing, an empty
  field is treated as 0 only if the other field has a value.
- **Order card layout.** At 375 px each column of the 3-column grid is ~95 px, too narrow for two
  inputs. For pack-based cards the stock block moves to a full-width row above a 2-column grid
  (Suggestion | Order); ×1 cards keep the 3-column grid unchanged.

## Phase 1: Pure helpers and copy

### Overview

All pack arithmetic, formatting and the plausibility rule as pure functions with tests; the new and
changed i18n keys.

### Changes Required:

#### 1. Pack stock helpers

**File**: `frontend/src/lib/packStock.ts` (new)

**Intent**: Single home for converting a base quantity to/from "full packs + loose base units",
formatting the combined reading, and deciding when a loose value looks like a pack count.

**Contract**:
- `splitPackStock(base: number, upp: number): { packs: number; loose: number }` — `packs` is a
  non-negative integer, `loose` is rounded to 3 dp and normalized to `0 ≤ loose < upp` (a remainder
  that rounds up to `upp` rolls into one more pack). Floor uses a small epsilon.
  `base ≤ 0` → `{ packs: 0, loose: base }`.
- `combinePackStock(packs: number | "", loose: number | "", upp: number): number | ""` — both `""`
  → `""`; otherwise `(packs || 0) × upp + (loose || 0)` rounded to 3 dp.
- `formatBaseQty(n: number, lang: Lang): string` — `Intl.NumberFormat`, up to 3 fraction digits,
  comma in PL.
- `formatPackStock(base: number, upp: number, packUnit: string, baseUnit: string, lang: Lang): string`
  — "1 blok + 5 kg", "2 bloki", "6 kg", "4 kartony + 4,5 opak"; unit words via `packUnitLabel`
  (count-driven declension for the pack part, the base unit label for the loose part). The " + "
  separator is a symbol, not copy.
- `suggestPackCount(args: { packs: number | ""; loose: number | ""; upp: number; references: Array<number | null | undefined> }): number | null`
  — returns `loose` (the suggested pack count) when ALL hold, else `null`:
  `isPackBased(upp)`; `packs` is `""` or `0`; `loose` is a number with `0 < loose < upp`;
  `loose × 2` is an integer; `R = max(finite, positive references) ≥ 2 × upp` (inclusive; no
  reference → `null`). Applies to every base unit including "szt" (operator decision 2026-09-28:
  ask everywhere, one tap "Nie" dismisses).
- Imports `isPackBased` from `./packUnits` and `packUnitLabel` from `../i18n/packUnits`; no React.

#### 2. Copy

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Add the input/reading/prompt copy; flip pack-based thresholds to packs-first; drop the
toggle keys that lose their only caller.

**Contract**:
- Add `stock.fieldAria` (pl/en `"{label}, {unit}"`), `stock.reading` (`"= {split} ({total})"`),
  `stock.readingBase` (`"= {total}"`), `stock.didYouMean` (pl `"Czy chodziło o {packs} ({total})?"`,
  en `"Did you mean {packs} ({total})?"`), `stock.didYouMeanYes` (pl `"Tak, popraw"`, en
  `"Yes, fix it"`), `stock.didYouMeanNo` (pl `"Nie"`, en `"No"`), `card.belowMinPacks`
  (pl `"Poniżej minimum: {packs} ({min} {unit})"`, en `"Below minimum: {packs} ({min} {unit})"`),
  and change `inventory.checkUnitHint` to pl `"sprawdź jednostkę"`, en `"check the unit"` (no
  `{max}` / `{unit}` vars — the grid shows no thresholds).
- Change `card.targetPart` to `"Cel: {packs} ({target} {inventoryUnit})"` /
  `"Target: {packs} ({target} {inventoryUnit})"` and `card.maxPart` to
  `"Max: {packs} ({max} {inventoryUnit})"` (both languages).
- Remove `card.stockPacks`, `card.packsToStock`, `card.packInputToggle`, `inventory.packEquivalent`
  once Phases 2–3 remove their last callers (tsc flags any leftover).

(The toggle cleanup — `packUnitLocative` and the `loc` forms — happens in Phase 2, after
ProductCard stops importing it; doing it here would break `tsc` and the table-integrity test.)

### Success Criteria:

#### Automated Verification:

- `lib/packStock.test.ts` covers: split (20,15)→1/5; (8.4,4.2)→2/0; (12.6,4.2)→3/0; (52.5,12)→4/4.5;
  (47.368,5)→9/2.368; (7.5,15)→0/7.5; (0,15)→0/0; (14.9996,15)→1/0; combine ("","")→"",
  (1,5,15)→20, ("",20,15)→20, (3,0,4.2)→12.6, (0.5,"",15)→7.5, ("",0,15)→0; formatPackStock PL
  "1 blok + 5 kg", "2 bloki", "5 bloków", "6 kg", "4 kartony + 4,5 opak", "1 karton + 0,2 kg" and EN
  "1 block + 5 kg"; suggestPackCount fires for loose 6 / upp 15 / refs [90], [null, 150], [30]
  and for 4.5 / 12 / [52.5] and 5 / 24 / [72] (szt included); silent for refs [8, 6], [29.9], [],
  loose 6.3, 15, 0, packs 1, upp 1
- Declension tests for blok/karton/opak one/few/many/fraction added to `lib/packUnits.test.ts`
- `npm run test` passes (Homebrew node)
- `npm run build` passes (tsc checks key parity and removed keys)
- `npm run lint` passes

#### Manual Verification:

- none (no UI yet)

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Two-field input on the order card

### Overview

The `PackStockInput` component and its use on the order card (new order and order edit), with the
latest snapshot as the plausibility reference on the new-order screen.

### Changes Required:

#### 1. Composite input

**File**: `frontend/src/pages/captain-mp/components/PackStockInput.tsx` (new)

**Intent**: Two `DecimalInput`s (packs, loose) with captions, a live reading and the soft prompt;
emits base units.

**Contract**:
- Props: `idPrefix: string`, `value: number | ""`, `onChange: (v: number | "") => void`,
  `unitsPerPack: number`, `packUnit: string`, `baseUnit: string`, `label: string` (visible field
  label text supplied by the caller, used in `stock.fieldAria`), `references?: Array<number | null | undefined>`.
- Inputs: ids `${idPrefix}-packs` / `${idPrefix}-loose`, `inputMode="decimal"` on both, 44 px touch
  height, `aria-label = t("stock.fieldAria", { label, unit })` with the raw unit, `aria-describedby`
  pointing at the reading. Captions under each field: `packUnitLabel(packsValue || 0, packUnit)` and
  `packUnitLabel(looseValue || 0, baseUnit)`. A "+" between the fields.
- Layout: `flex flex-wrap items-start gap-x-2 gap-y-1`; each field `w-20`; the reading may wrap to
  its own line; no horizontal overflow at 375 px.
- Reading (`aria-live="polite"`) only when the combined value is a number: `stock.reading` with
  `split = formatPackStock(...)` and `total = "{formatBaseQty} {baseUnit}"` when the split has ≥ 1
  full pack, else `stock.readingBase`.
- Prompt: when `suggestPackCount` returns `n`, focus is NOT inside the component, and the user has
  not dismissed it for the current loose value, render a `role="status"` amber block with `stock.didYouMean`
  (`packs = formatPacks(n, packUnit, lang)`, `total = "{formatBaseQty(n × upp)} {baseUnit}"`) and
  two buttons: yes → fields become `n` / `0` and `onChange(combine(n, 0))`; no → remember the
  dismissed loose value locally. Never disables anything.
- Focus tracking: `onFocus` / `onBlur` on the wrapper element (React focus events bubble; no
  `DecimalInput` change) keep a `focused` flag, so typing "60" never flashes the prompt at "6".
  Tests use `fireEvent.blur`.
- Re-seed rule: see Critical Implementation Details.

#### 2. Order card

**File**: `frontend/src/pages/captain-mp/components/ProductCard.tsx`

**Intent**: Use the composite input for pack-based items, move it to a full-width row, flip the
threshold wording, remove the toggle.

**Contract**:
- New optional prop `previousStock?: number | null` (base units).
- Pack-based: render a labelled full-width stock block (`card.currentStock` as the visible label)
  with `PackStockInput` (`idPrefix = current-${product_id}`, `references = [previousStock,
  item.target_stock_qty_base]`) above a `grid-cols-2` grid holding Suggestion and Order. ×1 items:
  the existing 3-column grid and single field, unchanged.
- Remove `inPacks`, `handlePacksChange`, `currentPacksLabel`, the toggle pill, and the
  `packUnitLocative` / `packsToBase` imports; then remove the keys `card.stockPacks`,
  `card.packsToStock`, `card.packInputToggle`, the function `packUnitLocative` and the `loc` form
  from `PackUnitForms` / every `PACK_UNIT_FORMS` entry, updating the table-integrity test
  (`lib/packUnits.test.ts:137-148`). `packsToBase` stays (general, tested).
- Note: Pago has `suggestion_alerts_enabled = false`, so below-min never renders on Pago cards;
  `card.belowMinPacks` matters for pack-based suppliers with alerts on (e.g. Coca-Cola).
- Threshold segments use the new packs-first `card.targetPart` / `card.maxPart`. `belowMin` for
  pack-based items uses `card.belowMinPacks` with `packs = formatPacks(baseToPacks(min, upp), ...)`;
  ×1 items keep `card.belowMin`. The below-min visibility rule is unchanged.
- Suggestion tile, order field, reason picker, state pill: unchanged.

#### 3. New-order screen reference

**File**: `frontend/src/pages/captain-mp/CaptainMP.tsx`

**Intent**: Give each card the newest snapshot's count as the plausibility reference.

**Contract**: a memoized `Record<product_id, number>` from
`snapshotDetails[availableSnapshots[0]?.count_id]?.lines` (empty when not loaded / errored); pass
`previousStock={map[item.product_id] ?? null}` to `ProductCard`. No new fetch; the newest snapshot
is the one fetched on mount by default. If the Captain switches the picker before that fetch
resolves, the newest detail is never loaded and the map stays empty — the cards then fall back to
the target reference (accepted). `OrderEditPage` is untouched (targets only).

#### 4. Tests

**Files**: `frontend/src/pages/captain-mp/components/PackStockInput.test.tsx` (new),
`frontend/src/pages/captain-mp/components/ProductCard.test.tsx`

**Intent**: Lock the input contract and the card wiring.

**Contract**:
- PackStockInput: typing 20 in the loose field emits 20 and reads "= 1 blok + 5 kg (20 kg)";
  typing 1 then 5 emits 20; clearing both emits `""`; `0` alone emits 0; an external value change
  (rerender 30) re-seeds to 2 / 0 while an echo of the emitted value does not re-seed a half-typed
  "2," ; prompt appears for loose 6 with references [90], "Tak, popraw" emits 90 and shows 6 / 0,
  "Nie" hides it; no prompt with references [8, 6]; no prompt while focus is inside (appears after
  `fireEvent.blur`); EN labels via `localStorage` lang "en".
- ProductCard: all three ×24 tests (`ProductCard.test.tsx:73-103`) are rewritten, not patched;
  pack-based card shows "Cel: 5 zgrzewek (120 szt)", two inputs labelled
  "Obecny stan, zgrzewka" / "Obecny stan, szt", typing 2 packs stores 48, no "wpisz w" button;
  ×1 card still has one "Obecny stan" field and the old target line; below-min pack wording;
  prompt appears when `previousStock` is large and the loose value is small.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes, including the new PackStockInput tests and the updated ProductCard tests
- `npm run build` passes
- `npm run lint` passes

#### Manual Verification:

- Local preview (backend with auth ON, only a Captain token, seed copy with Gyros 15 thresholds in
  kg): Pago card for Gyros 15 shows two fields; 20 kg → "= 1 blok + 5 kg (20 kg)"; 1 blok + 5 kg
  → suggestion recomputed from 20 kg; typing 6 in kg with target 150 prompts "Czy chodziło o 6 bloków
  (90 kg)?" and "Tak, popraw" fixes it
- Coca-Cola zgrzewka card and a ×1 Bukat card render correctly; supplier switch and draft restore
  re-seed the fields from the stored base
- 375 px: no clipping, no horizontal scroll, touch targets ≥ 44 px
- Order edit page shows the same input and threshold wording

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Two-field input on the inventory grid

### Overview

Same component on the location-wide count and count edit; the 3×max warning loses its max value.

### Changes Required:

#### 1. Grid rows

**File**: `frontend/src/pages/captain-mp/components/InventoryCountGrid.tsx`

**Intent**: Pack-based rows get the two-field input on their own line under the product name;
×1 rows stay as they are.

**Contract**:
- Pack-based rows (`showPack`): name block full width, then `PackStockInput`
  (`idPrefix = stock-${product_id}`, `label = t("inventory.qtyLabel")`,
  `references = [previous?.qty, p.target_stock_qty_base]`) wired to `onStockChange`. The single
  `DecimalInput` remains for ×1 rows only.
- Info layer: keep the "1 {packUnit} = {upp} {unit}" ratio line; drop the "≈ packs" equivalent
  (the component's reading replaces it); keep `order_note` and "ostatnio"; the 3×max warning keeps
  its trigger for every row but renders `inventory.checkUnitHint` without vars ("sprawdź jednostkę").
- "Tylko nieliczone", filters and category counts keep reading `current_stock_qty_base` — unchanged.
- `InventoryCountPage` / `InventoryCountEditPage`: no change (the edit page passes no
  `previousByProduct`, so targets are its only reference).

#### 2. Tests

**File**: `frontend/src/pages/captain-mp/components/InventoryCountGrid.test.tsx`

**Intent**: Cover the pack row wiring and wording.

**Contract**: pack row (P170, box × 12) renders two inputs and the ratio hint; typing 2 in packs
calls `onStockChange("P170", 24)`; a 30-unit stock reads "= 2 box + 6 szt (30 szt)" (box is
invariant); ×1 rows keep one input; the 3×max warning reads "sprawdź jednostkę" with no max value
(existing tests at `InventoryCountGrid.test.tsx:98-121` updated); the prompt appears from `previousByProduct` and from target when no previous is given.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes, including the updated InventoryCountGrid tests
- `npm run build` passes
- `npm run lint` passes

#### Manual Verification:

- Local preview, count page: Gyros 15, Pita and Souvlaki rows show two fields; "tylko nieliczone"
  and the category counter still treat blank as uncounted and 0 as counted; draft save/resume
  restores the fields from base values
- Count edit page: an existing 20 kg line opens as 1 blok / 5 kg; saving without edits keeps 20
- 375 px: rows wrap, no clipping or horizontal scroll

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Verification, PR and deploy gate

### Overview

Full verification, the threshold readiness check, PR, and the post-deploy prod check with the
Captain token only.

### Changes Required:

#### 1. Threshold readiness audit

**File**: `context/changes/pago-stock-packs-plus-kg/threshold-audit.sql` (new, read-only)

**Intent**: Let the operator see which pack-based thresholds at active locations still look like
pack counts before merging.

**Contract**: one SELECT joining `location_product_settings`, `supplier_products` (active,
`units_per_purchase_unit > 1`) and `products`, listing rows where `0 < target_stock_qty_base <
2 × units_per_purchase_unit` or `0 < max_stock_qty_base < units_per_purchase_unit`, with location,
product, pack unit, upp, min/target/max. No writes.

#### 2. Docs

**Files**: `context/foundation/roadmap.md`, `context/changes/pago-stock-packs-plus-kg/change.md`

**Intent**: Add a Horizon 3 row for this change (resolving the duplicate R-20 numbering from the
unpushed archive commit when rebasing) and keep the change status current.

**Contract**: one roadmap row, `Status` per lifecycle; no AGENTS.md claim changes (frontend test
count updated if AGENTS.md quotes it).

### Success Criteria:

#### Automated Verification:

- `/verify` passes (backend ruff + pytest untouched but green; frontend build + lint + test)
- Branch rebased on current `origin/main`; CI green on the PR

#### Manual Verification:

- Operator runs `threshold-audit.sql` (or confirms the data session is done) and approves merge
- After merge: Vercel production bundle for the merge commit is live
- Prod with auth ON and only a Captain token: order card (Pago, Gyros 15) and inventory grid show
  the two fields, reading and prompt; no order is submitted to a supplier (draft or back-out only)

---

## Testing Strategy

### Unit Tests:

- `lib/packStock.ts`: split/combine float cleaning, normalization edge (remainder rounding up to a
  full pack), blank vs zero, fractional pack sizes (4.2), half steps (0.5), declension, EN, every
  branch of `suggestPackCount` including the inclusive 2-pack boundary.

### Component Tests:

- `PackStockInput`: emit contract, re-seed vs echo, prompt yes/no, EN labels.
- `ProductCard`: pack vs ×1 rendering, packs-first thresholds, `previousStock` reference, toggle gone.
- `InventoryCountGrid`: pack vs ×1 rows, `onStockChange` in base units, max-free wording in the 3×max
  warning, prompt from previous count and from target.

### Manual Testing Steps:

1. Seed-copy backend with auth ON and only `SUPPLY_OS_CAPTAIN_TOKENS` set; frontend dev server.
2. Order screen, Pago: type 20 in kg, then 1 + 5, then clear both — reading and suggestion follow;
   type 6 in kg — prompt, "Tak, popraw" → 90 kg.
3. Switch supplier and back; reload with a draft — fields re-seed from the stored base.
4. Inventory: same on Gyros 15 / Pita / Souvlaki rows; 0 vs blank; save draft, resume.
5. Count edit and order edit pages open existing values as packs + loose.
6. 375 px viewport for all four screens.

## Performance Considerations

None beyond one memoized map on the order screen; the helpers are O(1) per render.

## Migration Notes

No data migration. Deploy gate: thresholds for pack-based products at active locations are in base
units (operator's data session), checked with `threshold-audit.sql`. Until then, at locations whose
target is a pack count, a correctly entered 1 blok + 5 kg = 20 kg reads above target and the
suggestion drops to 0, and the threshold line reads e.g. "Cel: 0,5 bloku (8 kg)". Rollback = revert
the frontend PR; stored data is unaffected either way.

## References

- Frame: `context/changes/pago-stock-packs-plus-kg/frame.md`
- Research: `context/changes/pago-stock-packs-plus-kg/research.md`
- Prior lane: `context/archive/2026-09-06-pack-units-display-mobile-wrap/` (toggle, captions under
  fields, no-wrap segments)
- Re-seed pattern: `frontend/src/components/ui/DecimalInput.tsx:48-64`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure helpers and copy

#### Automated

- [x] 1.1 `lib/packStock.test.ts` covers split, combine, format, suggestPackCount cases — 35e7e2c
- [x] 1.2 Declension tests for blok/karton/opak added to `lib/packUnits.test.ts` — 35e7e2c
- [x] 1.3 `npm run test` passes — 35e7e2c
- [x] 1.4 `npm run build` passes — 35e7e2c
- [x] 1.5 `npm run lint` passes — 35e7e2c

### Phase 2: Two-field input on the order card

#### Automated

- [x] 2.1 `npm run test` passes, including PackStockInput and updated ProductCard tests — c2290a9
- [x] 2.2 `npm run build` passes — c2290a9
- [x] 2.3 `npm run lint` passes — c2290a9

#### Manual

- [x] 2.4 Local preview: Gyros 15 card two fields, reading, suggestion, prompt + fix
- [ ] 2.5 Coca-Cola and ×1 cards correct; supplier switch and draft restore re-seed
- [x] 2.6 375 px: no clipping, no horizontal scroll, touch targets ≥ 44 px
- [ ] 2.7 Order edit page shows the same input and threshold wording

### Phase 3: Two-field input on the inventory grid

#### Automated

- [x] 3.1 `npm run test` passes, including updated InventoryCountGrid tests — 86c864b
- [x] 3.2 `npm run build` passes — 86c864b
- [x] 3.3 `npm run lint` passes — 86c864b

#### Manual

- [ ] 3.4 Count page: pack rows two fields; blank vs 0 semantics; draft save/resume
- [ ] 3.5 Count edit page: 20 kg opens as 1 blok / 5 kg; unchanged save keeps 20
- [x] 3.6 375 px: rows wrap, no clipping or horizontal scroll

### Phase 4: Verification, PR and deploy gate

#### Automated

- [x] 4.1 `/verify` passes
- [x] 4.2 Branch rebased on current `origin/main`; CI green on the PR

#### Manual

- [x] 4.3 Operator confirms thresholds (audit / data session) and approves merge
- [x] 4.4 Vercel production bundle for the merge commit is live — 3915bab (main includes #40 / 17a4bb6; Vercel production + Railway success, checked 2026-10-01)
- [ ] 4.5 Prod, Captain token only: order card and inventory grid show two fields, reading, prompt; no supplier order placed
