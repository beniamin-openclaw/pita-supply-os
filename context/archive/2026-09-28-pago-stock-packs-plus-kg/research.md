---
date: 2026-09-28T15:01:53+02:00
researcher: Claude (Opus 5.5)
git_commit: 7dced7eaf6bc25bf600b7fe89423705280051cc5
branch: claude/charming-robinson-8e6f6b
repository: beniamin-openclaw/pita-supply-os
topic: "Two-field stock input (packs + loose base units) for pack-based products on the Captain screens"
tags: [research, codebase, frontend, captain-mp, ProductCard, InventoryCountGrid, packUnits, i18n]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude (Opus 5.5)
---

# Research: Two-field stock input (packs + loose base units)

**Date**: 2026-09-28T15:01:53+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 7dced7e (local `main`; `origin/main` is 07443c7, see Open Questions)
**Branch**: claude/charming-robinson-8e6f6b
**Repository**: beniamin-openclaw/pita-supply-os

## Research Question

Where does the Captain enter stock for pack-based products (`isPackBased(units_per_purchase_unit)`),
what data flows through those inputs, and what does a two-field input [packs] + [loose base units]
need to touch so the stored value stays in base units (kg / opak / szt) with no backend or payload
change? Also: what data is already on the client for a soft "did you mean N packs?" prompt, and
what i18n / test conventions apply. Framing: `frame.md` (initial framing confirmed; thresholds in
packs are a co-cause and a deploy dependency).

## Summary

- **Frontend only.** Every stock value is `number | ""` in base units end to end:
  `OrderLine.current_stock_qty_base` (`pages/captain-mp/types.ts:16-23`),
  `InventoryLineInput.current_stock_qty_base` (`pages/captain-mp/lib/inventoryLines.ts:7-14`).
  `""` = not counted: the order payload sends `null` (`lib/buildPayloadLines.ts:30-31`), the
  inventory payload drops the line (`InventoryCountPage.tsx:327-337`,
  `InventoryCountEditPage.tsx:133-143`). A two-field input that emits the same `number | ""`
  changes nothing downstream (compute, payload, drafts, API).
- **Two shared components cover all four surfaces.** `ProductCard` is rendered by `CaptainMP.tsx:807-821`
  (new order) and `OrderEditPage.tsx:289-303` (edit). `InventoryCountGrid` is rendered by
  `InventoryCountPage.tsx:537-545` (new count) and `InventoryCountEditPage.tsx:260-267` (edit).
- **Per-card UI state is lost on unmount** (supplier switch → skeletons, category collapse, reload).
  The two fields must therefore be derivable from the base value on mount, and must re-seed when
  the base changes from outside (prefill fill/overwrite/clear, draft restore/discard). The
  `DecimalInput` "adjust state during render" pattern (`components/ui/DecimalInput.tsx:48-64`)
  is the model.
- **The existing pack toggle is the thing being replaced.** `ProductCard.tsx:105-117, 245-285,
  404-420` (`inPacks`, default off, session-local). Its keys `card.stockPacks`,
  `card.packsToStock`, `card.packInputToggle` (`i18n/strings.ts:161-172`) and
  `packUnitLocative` (`i18n/packUnits.ts:103-112`) are used only there.
- **Reference data for the plausibility prompt**: new order → newest snapshot lines already
  fetched into `snapshotDetails` (`CaptainMP.tsx:110-191`) plus `item.target_stock_qty_base`;
  order edit → thresholds only (no snapshot fetch); new count → `previousByProduct`
  (`InventoryCountPage.tsx:313-324`) plus thresholds on `InventoryProduct`
  (`types.ts:121-139`); count edit → thresholds only (the snapshot being edited is a bad
  reference: it may itself hold a pack count).
- **Thresholds are shown today** only on the order card (target/max parts + below-min,
  `ProductCard.tsx:168-233`) and inside the inventory 3×max warning
  (`InventoryCountGrid.tsx:259-273`). The grid shows no min/target.
- **i18n**: one flat `STRINGS` object of `{pl, en}` entries (`i18n/strings.ts:6-9, 1851-1853`);
  parity is enforced only by `tsc` (`satisfies`), no test. Pack-unit nouns must go through
  `packUnitLabel` (a dynamic `tPlural` fails `pluralKeys.test.ts` check 2).
- **Prod data** (frame.md): 13 supplier/unit groups are pack-based, including fractional pack
  sizes (Pago bifteki 4.2 kg, Intermlecz 2.5 / 3.6 kg). Gyros/pita/souvlaki thresholds at several
  locations are pack counts stored as base units (Gyros 15 target BRACKA 8, WOLA 10, KEN 10).

## Detailed Findings

### Order card (`ProductCard`)

- Props are only `{ item, line, onChange }` (`ProductCard.tsx:26-30, 83`); key = `product_id`.
- Stock sits in a `grid grid-cols-3 gap-3` with Suggestion and Order (`ProductCard.tsx:236`).
  At 375 px each column is ~95 px, too narrow for two inputs side by side.
- Unit captions sit under the field, not inside it — an explicit 375 px fix
  (`ProductCard.tsx:262-270`; pack-units-display-mobile-wrap R3).
- `currentVal = Number(line.current_stock_qty_base) || 0` feeds `computeSuggestion`
  (`ProductCard.tsx:88, 97-100`; `lib/compute.ts:32-40`: `max(0, target − current) / upp`).
  Blank stock → tile shows "—" and is disabled (`ProductCard.tsx:292, 303, 319`).
- `belowMin` (`ProductCard.tsx:92-96`) needs stock !== "" and `min > 0`, hidden when the
  supplier has alerts off (Pago, `suggestion_alerts_enabled=false`).
- Threshold line for pack-based items: `card.targetPart` / `card.maxPart` / `card.ratioPart`
  as no-wrap segments joined by " · " (`ProductCard.tsx:169-202`), base first, packs in
  parentheses: "Cel: 120 szt (5 zgrzewek)". `card.belowMin` is base only: "Poniżej minimum: {min} {unit}".
- `OrderEditPage` builds items first from `ManagerOrderLineDetail` via `lineToItem`
  (`OrderEditPage.tsx:37-61`, `min_stock_qty_base: 0` hardcoded, no `order_note`), then swaps
  in real `api.orderable()` items (`:133-147`). Uncounted lines come back as `0` (the backend
  stores `null` as 0, `supply-os-v1/app/models.py:251-255`).
- Programmatic writes to stock, all in CaptainMP: draft restore (`:239-257`), `discardDraft`
  (`:384-395`), `fillEmpties` / `overwriteAll` / `clearAll` (`:415-471`), post-submit
  `setLines({})` (`:536`). `OverruleAllControl` writes only reason/comment (`lib/overruleAll.ts:33-61`).

### Inventory grid (`InventoryCountGrid`)

- Row = `flex items-center justify-between gap-3`: name block `min-w-0 flex-1` on the left,
  `w-24` `DecimalInput` on the right (`InventoryCountGrid.tsx:196-226`).
- Info layer (`:229-275`): pack ratio "1 blok = 15 kg" + `≈ {packs}` equivalent
  (`inventory.packHint` / `inventory.packEquivalent`), `order_note`, "ostatnio {qty} · {date}"
  (raw base number, no unit), and the 3×max `inventory.checkUnitHint` ("sprawdź jednostkę — max
  to {max} {unit}", base only).
- Grid derives `upp = p.units_per_purchase_unit ?? 1`, `packUnit = p.purchase_unit ?? ""`,
  `showPack = packUnit !== "" && isPackBased(upp)` (`:180-194`).
- The grid itself reads `current_stock_qty_base` for "tylko nieliczone" (`:84-94`), filters
  (`:104-109`) and category counts (`:143-146`) — unchanged by a new input.
- Inventory draft: key `supply_os_captain_draft___inventory__`, restores `lines` with no shape
  check (`InventoryCountPage.tsx:32, 41-45, 230-271`). Keeping `InventoryLineInput` unchanged
  means no draft migration.
- `InventoryCountEditPage` merges the snapshot into `lines` and does not keep the originals
  (`:62-97`); it passes no `previousByProduct` (`:260-267`).
- Pack size source: the grid gets the product's *primary* supplier_product
  (`supply-os-v1/app/main.py:2582-2667`, lowest `supplier_product_id`, `SUP_INTERNAL` skipped);
  the order card gets the order's supplier's row (`main.py:191-220, 261-268`). The same product
  can therefore show different pack sizes on the two screens when suppliers differ (no current
  prod case for gyros found).

### Conversion helpers (`lib/packUnits.ts`)

- `baseToPacks` rounds to 1 dp; `packsToBase` uses `roundQty` (2 dp); `formatPackQty` uses
  `Intl.NumberFormat` with `maximumFractionDigits: 1`; `isPackBased(upp)` = finite and > 1.
- Float behaviour checked with node: `12.6/4.2 = 3`, `3*4.2 = 12.600000000000001`,
  `47.368/5 = 9.473600000000001`, `0.3*3 = 0.8999999999999999`. A split helper needs an epsilon
  on the floor and rounding of the remainder (3 dp covers prod values like 2.916 kg).
- There is no base-quantity formatter with more than 1 decimal; loose kg (3.46, 2.916) needs one.

### i18n and declension

- `t(key, vars)` interpolates `{name}` (`i18n/index.ts:61-66, 105-117`); a missing key returns
  the key string. `useT()` requires `<LangProvider>` (`:165-171`).
- `packUnitLabel(n, unit, lang)` (`i18n/packUnits.ts:92-100`): PL non-integer → `frac`
  ("2,5 bloku"), integer → one/few/many ("1 blok", "2 bloki", "5 bloków"); EN one/many. `kg`,
  `opak`, `szt` are in the table (invariant forms), so the same function can label the loose part.
- Tests cover `blok` only for the fraction; `karton` and `opak` declensions are untested
  (`lib/packUnits.test.ts:51-148`).
- Symbol-only literals in JSX have precedent (`` `= ${…}` ``, `` `→ ${…}` ``,
  `ProductCard.tsx:332, 338`); no lint rule or test scans for hardcoded copy.

### Tests that the change touches

- `ProductCard.test.tsx:74` (asserts `"40 szt = 1,7 zgrzewki"` and `Cel: 120 szt (5 zgrzewek)`),
  `:89` (toggle "wpisz w zgrzewkach", typing 2 → 48), `:106` (×1 SKU: no toggle, no "=" hint).
- `InventoryCountGrid.test.tsx:76-85` (pack hint "1 box = 12 szt", "≈ 2,5 box"), `:98-121`
  (check-unit warning on ×1 products).
- Re-run: `lib/compute.test.ts:51-110` (blank = uncounted), `lib/buildPayloadLines.test.ts:17`,
  `lib/overruleAll.test.ts`.
- Test setup: jsdom, `localStorage.clear()` before each test → PL (`src/test/setup.ts`);
  component tests wrap `<LangProvider>` themselves; `ProductCard.test.tsx:38-61` uses a controlled
  `Wrapper` with `useState`.

### Read-only stock displays (not inputs)

- Captain: `OrderDetailPage.tsx:280` ("stan: {qty} {unit}"), `InventoryHistoryPage.tsx:118-132, 226-228`
  (`{stock} {unit}`, product master data already loaded there).
- Manager: `pages/manager/OrderLineTable.tsx:153-166` (already appends a decimal pack hint),
  `ManagerInventoryPage.tsx:289-317`, `lib/inventoryCsv.ts:168`. All stay base units.

## Code References

- `frontend/src/pages/captain-mp/components/ProductCard.tsx:102-124` — pack toggle state and handlers
- `frontend/src/pages/captain-mp/components/ProductCard.tsx:168-233` — threshold line + below-min
- `frontend/src/pages/captain-mp/components/ProductCard.tsx:236-286` — stock column in the 3-col grid
- `frontend/src/pages/captain-mp/components/ProductCard.tsx:404-420` — "wpisz w …" toggle pill
- `frontend/src/pages/captain-mp/components/InventoryCountGrid.tsx:180-275` — row derivations, input, info layer
- `frontend/src/pages/captain-mp/CaptainMP.tsx:110-191` — snapshot list + lazy detail cache
- `frontend/src/pages/captain-mp/CaptainMP.tsx:807-821` — ProductCard render
- `frontend/src/pages/captain-mp/OrderEditPage.tsx:37-75, 133-147, 289-303` — item/line build, orderable swap, render
- `frontend/src/pages/captain-mp/InventoryCountPage.tsx:209-222, 313-324` — latest snapshot + `previousByProduct`
- `frontend/src/pages/captain-mp/InventoryCountEditPage.tsx:62-97, 260-267` — load + grid render
- `frontend/src/components/ui/DecimalInput.tsx:48-92` — raw buffer, external re-seed, invalid ring
- `frontend/src/lib/packUnits.ts` — conversions, `isPackBased`
- `frontend/src/i18n/packUnits.ts:21-112` — declension table, `packUnitLabel`, `packUnitLocative`
- `frontend/src/i18n/strings.ts:120-172, 717, 782-798` — card/inventory unit keys
- `frontend/src/lib/buildPayloadLines.ts:30-31` — blank stock → `null`

## Architecture Insights

- Base units are the single source of truth on every layer (the `lib/packUnits.ts` header states
  it). Pack arithmetic is a presentation concern and lives in pure helpers in `src/lib/`.
- Controlled numeric inputs keep a local raw buffer and re-seed during render when the parent
  value changes externally; the same pattern scales to a two-field composite.
- Master-data unit words never go through `tPlural`; `i18n/packUnits.ts` is the sanctioned
  data-driven declension table.
- Mobile-first rules from the previous lane: captions under fields, no-wrap segments joined by
  " · " so phones break between parts, never inside "(5 zgrzewek)".

## Historical Context (from prior changes)

- `context/archive/2026-09-06-pack-units-display-mobile-wrap/change.md` — introduced the pack
  hints and the "wpisz w …" toggle (default off, session-local by design; R6 accepted 2-dp
  pack-mode precision). Evidence in frame.md: pack/base mixing continued for three weeks after.
- `context/archive/2026-09-17-week2-feedback-quantities/plan.md:411-457` — inventory info layer
  (pack hint, "ostatnio", 3×max warning), "information only, never blocks".
- `context/archive/2026-09-06-week1-feedback-targets/` and the `rolki-minima` lane — prior
  threshold corrections done as operator SQL batches (diff before, audit after — lessons.md).

## Related Research

- `context/changes/pago-stock-packs-plus-kg/frame.md` — observation vs framing, prod evidence.

## Open Questions

1. **Deploy order vs thresholds.** Several prod thresholds for pack-based products are pack
   counts (frame.md). Deploying the new input before the operator's data session converts them
   gives wrong suggestions at BRACKA/KEN (e.g. 1 blok + 5 kg = 20 kg vs target 8 → suggestion 0)
   and odd threshold readings ("Cel: 0,5 bloku (8 kg)"). Needs the operator's call at the plan STOP.
2. **Parallel lanes touching the same files.** `origin/feat/dynamic-target-wola` (PR #30, open)
   rewrites `ProductCard.tsx` around `belowMin` / header and edits `ProductCard.test.tsx`,
   `CaptainMP.tsx`, `OrderEditPage.tsx`; the display-order lane (worktree xenodochial-cerf,
   uncommitted `lib/productOrder.ts`, `types.ts`) touches CaptainMP lists. Rebase before the PR.
3. **Local `main` is ahead of `origin/main` by the unpushed archive commit 7dced7e** and behind by
   two docs commits; both add a roadmap row numbered R-20. Resolve (renumber) when opening the PR.
4. **Threshold display on the inventory grid** — none today besides the 3×max warning; adding a
   min/target line is not in the brief (confirm at the STOP whether "min 4 bloki (60 kg)" is
   wanted there too).
