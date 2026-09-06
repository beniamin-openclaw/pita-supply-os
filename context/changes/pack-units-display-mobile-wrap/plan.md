# Plan — pack-units-display-mobile-wrap

Status: ACCEPTED by the operator up front ("wykonaj end-to-end z post-implementation review i
poprawkami", 2026-09-06). Three tracks; A and B are frontend-only, C is one prod UPDATE.

## Grounding (verified, not assumed)

**Where the misleading numbers live.** `pages/captain-mp/components/ProductCard.tsx:137-144`
renders `card.targetLine` = `target {target} {inventoryUnit} · max {max} · 1 {purchaseUnit} =
{unitsPerPurchase} {inventoryUnit}` (`i18n/strings.ts:120`). The stock input (`:160-185`) has an
inventory-unit suffix and no conversion. The suggestion tile (`:188-230`) shows
`card.suggestionDetail` = `brakuje {base} {inventoryUnit} → {purchase} {purchaseUnit}` — no
plural, no "=". `ProductCard` is shared by `CaptainMP.tsx:806` and `OrderEditPage.tsx:285`
(`lineToItem` supplies `units_per_purchase_unit`), so both screens pick the change up.

**Manager.** `pages/manager/OrderLineTable.tsx:150-158` renders Stan `{stock} {inventoryUnit}`
and Cel `{target}` (bare number). `ManagerOrderLineDetail` carries `units_per_purchase_unit` +
`purchase_unit`. `pages/manager/transport/TransportMatrix.tsx` has **no target/stock column**
(cells are order quantities in purchase units already) — nothing to add there; documented.

**Plural machinery.** `i18n/index.ts:50-58` `pluralKey(n, lang)` (private) implements
one/few/many; `tPlural(prefix, noun, n)` composes `${prefix}.${form}.${noun}` from two string
literals. `i18n/pluralKeys.test.ts` scans every `tPlural(` call site and (a) fails on a
non-literal noun, (b) asserts all three forms exist. It is green on `main` (332 tests) — the
"inverted key" bug it was written for has no live instance today. A purchase unit is
master-data text (`zgrzewka`, `karton`, `opak`, `blok`, `wiadro`, `szt`, `kg`, `box` on prod;
only the first five ever have `units_per_purchase_unit > 1`), so it cannot be a `tPlural`
literal noun without defeating that guard. Precedent for data-driven labels inside `i18n/`:
`i18n/categoryLabels.ts`.

**Truncation on phones** (`grep truncate|line-clamp|whitespace-nowrap`): product names
(`OrderDetailPage.tsx:227,235`, `ReceiptLineCard.tsx:38`, `InventoryCountGrid.tsx:85`),
supplier/meta rows (`OrdersListPage.tsx:89,104`), the sticky-bar summaries
(`StickyActionBar.tsx:46`, `InventoryCountPage.tsx:539,542`,
`InventoryCountEditPage.tsx:275,278` — `inventory.blankVsZeroHint` is a full sentence),
`ContextStrip.tsx:41`, the `order_note` (`ProductCard.tsx:153`, `line-clamp-1`), page-header
titles (`OrderDetailPage.tsx:122`, `OrderEditPage.tsx:246,249`, `ReceiveDeliveryPage.tsx:192-203`,
`InventoryCountEditPage.tsx:190,194`), `ManagerQueue.tsx:160`. Intentional and kept:
`SupplierPicker` pills (horizontal scroller), `Header` pills (short), every `whitespace-nowrap`
inside an `overflow-x-auto` table (`OrderLineTable`, `TransportPage`, `InventoryHistoryPage`,
`ManagerInventoryPage`), `line-clamp-2` comment cells with `title=`.

**Rounding note.** Coca-Cola Zero at KEN, target 120 / stock 40 → need 80 szt = 3,3 zgrzewki.
The on-screen suggestion follows the SKU's `rounding_rule` (`full_only` → 4, `up_for_critical`
non-critical → 3). The engine is not touched; the display shows whatever it returns.

## Track A — pack-unit helpers + Captain card + Manager hint

### A1 `src/i18n/index.ts`
Export the plural rule: `export function pluralForm(n: number, lang: Lang): "one" | "few" |
"many"` (the existing `pluralKey` body; keep `tPlural` using it). No behaviour change.

### A2 `src/i18n/packUnits.ts` (new) — declension table for purchase units
```ts
export interface PackUnitForms {
  pl: { one: string; few: string; many: string; frac: string; loc: string };
  en: { one: string; many: string };
}
export const PACK_UNIT_FORMS: Record<string, PackUnitForms>  // keyed by lower-cased master-data unit
```
Entries (pl one/few/many/frac/loc · en one/many):
zgrzewka → zgrzewka/zgrzewki/zgrzewek/zgrzewki/zgrzewkach · case/cases;
karton → karton/kartony/kartonów/kartonu/kartonach · carton/cartons;
blok → blok/bloki/bloków/bloku/blokach · block/blocks;
wiadro → wiadro/wiadra/wiader/wiadra/wiadrach · bucket/buckets;
opak → opak/opak/opak/opak/opak · pack/packs;
worek → worek/worki/worków/worka/workach · bag/bags;
skrzynka → skrzynka/skrzynki/skrzynek/skrzynki/skrzynkach · crate/crates;
butla → butla/butle/butli/butli/butlach · cylinder/cylinders;
paleta → paleta/palety/palet/palety/paletach · pallet/pallets;
szt → szt (all) · pc/pcs; kg → kg (all) · kg/kg; box → box (all) · box/boxes.
`frac` = genitive singular (used for any non-integer count: "1,5 zgrzewki", "2,5 bloku");
`loc` = locative plural for the toggle label ("wpisz w zgrzewkach").
`export function packUnitLabel(n: number, unit: string, lang: Lang): string` — picks the form
(non-integer → `frac`; else `pluralForm`), EN uses one/many; unknown unit → the raw unit
unchanged. `export function packUnitLocative(unit, lang)` → `loc` (pl) / `many` (en) / raw.

### A3 `src/lib/packUnits.ts` (new) — conversion + formatting (pure, unit-tested)
```ts
export function baseToPacks(base: number, unitsPerPurchase: number): number  // 1 dp: Math.round(base / upp * 10) / 10
export function packsToBase(packs: number, unitsPerPurchase: number): number // roundQty(packs * upp)
export function formatPackQty(n: number, lang: Lang): string                 // Intl pl-PL / en-GB, maximumFractionDigits 1 → "1,7" / "1.7"
export function formatPacks(n: number, unit: string, lang: Lang): string     // `${formatPackQty(n)} ${packUnitLabel(n, unit, lang)}` → "5 zgrzewek", "1,7 zgrzewki"
export function packHint(base: number, unitsPerPurchase: number, unit: string, lang: Lang): string | null
  // null when unitsPerPurchase <= 1 or !isFinite; else formatPacks(baseToPacks(base, upp), unit, lang)
export function isPackBased(unitsPerPurchase: number): boolean               // > 1 and finite
```
`src/lib/packUnits.test.ts`: 120/24 → 5; 40/24 → 1.7; 36/24 → 1.5; 2×24 → 48; 1.7×24 → 40.8;
labels 1/2/5/12/22/25 zgrzewka (zgrzewka/zgrzewki/zgrzewek/zgrzewek/zgrzewki/zgrzewek);
1.7 → "1,7 zgrzewki"; 2.5 blok → "2,5 bloku"; en 5 → "5 cases", 1 → "1 case"; unknown unit
"paczka" 3 → "3 paczka"; `packHint(120, 1, …)` → null; table-integrity: every
`PACK_UNIT_FORMS` entry has all five pl forms and both en forms non-empty.

### A4 `src/i18n/strings.ts` — new keys (PL + EN)
- `card.targetLinePacks`: pl `Cel: {target} {inventoryUnit} ({targetPacks}) · Max: {max}
  {inventoryUnit} ({maxPacks}) · 1 {purchaseUnit} = {unitsPerPurchase} {inventoryUnit}`,
  en `Target: … ({targetPacks}) · Max: … ({maxPacks}) · 1 {purchaseUnit} = …`.
  `card.targetLine` stays byte-identical (used when `units_per_purchase_unit === 1`).
- `card.stockPacks`: `{base} {inventoryUnit} = {packs}` (pl = en).
- `card.packsToStock`: `{packs} = {base} {inventoryUnit}` (shown while the toggle is on).
- `card.packInputToggle`: pl `wpisz w {unitLoc}`, en `enter in {unitLoc}`.
- `card.suggestionDetailPacks`: pl `brakuje {base} {inventoryUnit} = {packsExact} → {suggested}`,
  en `need {base} {inventoryUnit} = {packsExact} → {suggested}`.
- `card.suggestionDetailPacksExact`: pl `brakuje {base} {inventoryUnit} = {suggested}`, en
  `need {base} {inventoryUnit} = {suggested}` (when the rounded suggestion equals the exact
  quotient, e.g. 72 szt = 3 zgrzewki).
`card.suggestionDetail` stays for `units_per_purchase_unit === 1`.

### A5 `ProductCard.tsx`
Only when `isPackBased(item.units_per_purchase_unit)` (so a ×1 SKU renders exactly as today):
1. Target line → `card.targetLinePacks` with `targetPacks = formatPacks(baseToPacks(target,
   upp), unit, lang)`, same for max.
2. Under the stock `DecimalInput` (inside the stock column, `mt-1 text-[11px] leading-tight
   text-slate-600`, `aria-live="polite"`): when stock !== "" and toggle off →
   `card.stockPacks` ("40 szt = 1,7 zgrzewki"); toggle on → `card.packsToStock`
   ("2 zgrzewki = 48 szt"). Blank stock → nothing.
3. Toggle: local `useState(false)` `inPacks` (not persisted in the draft). A pill
   `<button type="button" aria-pressed={inPacks}>` under the 3-column grid (`-mt-1 mb-3`,
   `text-[11px]`, `rounded-full border px-2 py-0.5`, pressed = `bg-slate-900 text-white
   border-slate-900`, else `bg-white text-slate-600 border-slate-300`), label
   `card.packInputToggle` with `unitLoc = packUnitLocative(item.purchase_unit, lang)`.
   While on: the `DecimalInput` `value` is `stock === "" ? "" : roundQty(stock / upp)`,
   `inputMode="decimal"`, unit suffix shows `item.purchase_unit`, and `onChange(v)` stores
   `v === "" ? "" : packsToBase(v, upp)` — state and API stay in inventory units.
   Toggling off shows the stored inventory value again (base is the source of truth).
4. Suggestion tile detail → `card.suggestionDetailPacks` / `…Exact` with
   `packsExact = formatPacks(baseToPacks(suggestedBase, upp), unit, lang)` and
   `suggested = formatPacks(suggestedPurchase, unit, lang)`; the big number stays the bare
   `suggestedPurchase`. The `card.acceptSuggestion` aria-label is unchanged.
5. `order_note`: drop `line-clamp-1`, wrap (`break-words`) — Track B owns the rest of the
   wrapping work; this one line lives in the file Track A edits.

`ProductCard.test.tsx` (new, RTL + `LangProvider`): (a) ×24 item, target 120 / max 120,
stock 40 → texts "Cel: 120 szt (5 zgrzewek)", "Max: 120 szt (5 zgrzewek)",
"40 szt = 1,7 zgrzewki", suggestion detail contains "brakuje 80 szt = 3,3 zgrzewki →";
(b) toggle on, type "2" → `onChange` receives `current_stock_qty_base: 48` and the hint reads
"2 zgrzewki = 48 szt"; (c) ×1 item → no toggle button, target line equals the old
`target … · max … · 1 szt = 1 szt` text, no "=" hint.

### A6 `pages/manager/OrderLineTable.tsx`
Stan and Cel cells: when `isPackBased(line.units_per_purchase_unit)` append
`<span className="ml-1 text-xs text-slate-500">({formatPacks(baseToPacks(x, upp),
line.purchase_unit, lang)})</span>`. Read-only; `whitespace-nowrap` kept (table scrolls).
`OrderLineTable.test.tsx` (new, minimal): one ×24 line → both hints present; one ×1 line → none.

## Track B — wrap instead of clip on phones (class-only)

Replace clipping with wrapping on content the Captain must read; keep clipping where it is a
deliberate scroller or a wide table:
- `OrderDetailPage.tsx:227,235` product name: `truncate` → `break-words` (both spans),
  flex `items-center` → `items-start`. `:122` h1 → `break-words leading-tight`.
- `ReceiptLineCard.tsx:38`, `InventoryCountGrid.tsx:85` (add `min-w-0 flex-1` on the text
  column so the input keeps its width): `truncate` → `break-words`.
- `OrdersListPage.tsx:89` supplier name → `break-words`; `:104` meta line → `break-words`.
- `StickyActionBar.tsx:46`, `InventoryCountPage.tsx:539,542`, `InventoryCountEditPage.tsx:275,278`:
  `truncate` → `leading-snug break-words` (the bar grows by a line on narrow phones — intended).
- `ContextStrip.tsx:41` → `break-words min-w-0`; parent gets `gap-3`.
- Header titles (`OrderEditPage.tsx:246,249`, `ReceiveDeliveryPage.tsx:192,197,202`,
  `InventoryCountEditPage.tsx:190,194`): `truncate` → `break-words leading-tight` (order ids
  `break-all`).
- `ManagerQueue.tsx:160`: `truncate` → `break-words`.
No copy, logic or backend change. Verified on a 375 px viewport against the local seed backend
(Track D) with screenshots before/after.

## Track C — prod: rename P179
`prod-sql.sql` (BEFORE snapshot in its header; rollback statement included). Apply via Supabase
MCP in one transaction, audit = 1 row new name.

## Track D — verification
1. `npm run test` / `npm run build` / `npm run lint` (Homebrew node); `python3 -m pytest` +
   `ruff check .` untouched-backend sanity.
2. Local seed backend (`SUPPLY_OS_DATA_BACKEND=seed`, scratchpad copy of the seed CSVs with
   Coca-Cola rows set to `zgrzewka × 24`, Zero target/max 120 at WOLA; captain auth ENABLED with
   a throw-away token) + Vite dev server in the Browser pane at 375 px: ProductCard (×24 and ×1),
   toggle round-trip, sticky bars, order list/detail, inventory grid. Screenshots kept in the
   review.
3. Post-implementation review → fixes → commit → push → Vercel READY + bundle hash on prod.

## Out of scope (named, not forgotten)
- `OrderDetailPage` "stan: … · sugestia: …" line (Captain history) and `ManagerInventoryPage`
  stock column: no pack hint (no supplier context on inventory; history line not requested).
- Unifying the ×1 target line wording ("target/max" vs "Cel/Max") — kept identical on purpose
  per acceptance "nothing changes visually"; one-line follow-up if wanted.
- Persisting the per-line toggle in the draft (deliberately session-local, default off).

## Progress
- [x] A1–A4 helpers, declension table, i18n keys, unit tests (24 tests)
- [x] A5 ProductCard + test (3 tests)
- [x] A6 OrderLineTable + test (2 tests)
- [x] B mobile wrapping (+ inventory sticky bars restacked on phones)
- [x] C prod SQL applied + audited (2026-09-06, 1 row)
- [x] D1 verification suites green (front 25 files / 362 tests, build, lint; backend 643, ruff)
- [x] D2 visual check at 375 px (seed backend, Coca-Cola ×24 + Bukat ×1, toggle round-trip, both sticky bars)
- [x] D3 post-implementation review + fixes (R1–R5), commit 9ff1518 on main, Vercel serves assets/index-tA833QAT.js = local build
