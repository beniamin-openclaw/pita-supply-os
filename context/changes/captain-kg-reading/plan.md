# Captain kg reading Implementation Plan

## Overview

Kraków (report of 11.10) asked to count halloumi in kg. Ben decided on 17.10 (porzadek-2026-10
item 4.14): only cut halloumi is counted in kg (P192 "Halloumi cięte", already live, count-only);
ordered halloumi stays in pieces (P015, 200 g each). After the Captain types the count, the screen
shows a read-only kg reading in brackets: "12 szt (2,4 kg)". D8/W49 stays: one inventory unit per
product. This plan adds that reading, frontend only.

## Current State Analysis

- `frontend/src/lib/gramsHint.ts` already reads the per-piece weight from a product name
  (`parseGramsPerPiece`: "200gr" → 200, "4,2kg" → 4200, first weight wins) and keeps the list of
  piece units (`PIECE_UNITS = szt, słoik, opak`, private). It is used only by `GramsHint.tsx`
  (the "did you mean 0,5 szt?" prompt).
- The Captain enters stock in two places:
  - `InventoryCountGrid.tsx` (count page + count edit page): ×1 rows use a single `DecimalInput`
    (`stock-<id>`); pack rows (bulk case or upp > 1) use `PackStockInput`. Names available: only
    `product_name_pl` (`InventoryProduct` has no supplier name).
  - `ProductCard.tsx` (order card): ×1 rows use a `DecimalInput` with a unit caption under it
    (`currentUnitId`, also the input's `aria-describedby`); pack rows use `PackStockInput`.
    Names available: `product_name_pl` and `supplier_product_name`.
- `PackStockInput.tsx` shows a live reading `= {split} ({total})` / `= {total}`
  (`stock.reading` / `stock.readingBase`), and is also the bulk-pack ORDER input (`copy="order"`).
- Prod data (lane C note, 17.10): halloumi is case-based (karton = 12) at the locations that order
  it, so the halloumi row is a `PackStockInput` row in prod. Prod P015 has been named
  "Halloumi Reha 200gr" since 02.10 (`context/archive/2026-10-01-feedback-1001-names-units/prod-sql-1.sql:139`);
  the seed still says plain "Halloumi".
- Plan-review name scan (seed + feedback-1001 prod renames): the reading will also show for about
  15 other piece products — Frytki Aviko 2,5kg (pack row), Masło 500g, Ketchup 1,1 kg,
  Musztarda 3 kg, Majonez 4kg, Kasza 900g, 4 Prymat spices, Kawa 200gr, Rucola 125 gr,
  Sałata 150gr, Tytan 500g. All correct per piece; Tytan (cleaning) is harmless noise. Skipped by
  the multipack guard: P017 Helcom "4,2kg/2,5kg", P046 Cieciorka "400g/240g".
- Names show multipack spellings where the first weight is NOT the weight of one
  inventory unit: `AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30` (opak = 30 × 25 g) and
  `KAWA JACOBS … 200g/6`; and a gross/net pair `Papryka grillowana Helcom 4,2kg/2,5kg`.

## Desired End State

- Piece-counted product (unit szt / słoik / opak) whose name carries one readable weight: after a
  count > 0 is typed, a read-only reading shows next to the stock:
  - ×1 grid row: "(2,4 kg)" under the stock field.
  - ×1 order card: the unit caption under the field reads "szt (2,4 kg)".
  - Pack rows (grid and order card): the existing reading grows the kg part:
    "= 1 karton (12 szt · 2,4 kg)" / "= 5 szt (1 kg)".
- Nothing shows for: an empty or 0 count, a unit that is not a piece unit (kg, l, box …), a name
  with no weight, a name with a multipack / two-weight spelling (`25g/30`, `12x200g`,
  `4,2kg/2,5kg`), and the bulk-pack ORDER input.
- The stored/sent value is unchanged (inventory units). No API, backend, DB or prod change.

### Key Discoveries:

- `parseGramsPerPiece` regex: `frontend/src/lib/gramsHint.ts:14`; piece units: `gramsHint.ts:7`.
- Grid ×1 field: `InventoryCountGrid.tsx` ~L241-254; grid pack field ~L229-239.
- Order card pack field: `ProductCard.tsx:312-321`; ×1 caption: `ProductCard.tsx:360-367`.
- Pack reading: `PackStockInput.tsx` (`reading` built from `keys.reading` / `keys.readingBase`).
- Number formatting: `formatBaseQty` in `frontend/src/lib/packStock.ts` (pl "2,4", max 3 dp).

## What We're NOT Doing

- No change to the stored unit, the payload, the suggestion math, or any backend/prod data.
- No kg reading on Manager screens, the submitted-count card, the supplier e-mail, or the
  bulk-pack order input (`copy="order"`).
- No change to `GramsHint` behaviour or to `parseGramsPerPiece` semantics (the multipack guard is
  a separate check used only by the kg reading).
- No master-data change — prod P015 already reads "Halloumi Reha 200gr" (renamed 02.10).
- Pack rows on the order card read the weight from `product_name_pl` only — the supplier name of a
  case-packed product is more likely to describe the purchase pack than one inventory unit.

## Implementation Approach

One pure helper module change plus three small UI touch points, sharing one decision function so
all screens agree on when the reading shows.

## Phase 1: Pure kg-reading helpers

### Overview

Add the "can we read a per-piece weight, and what is N pieces in kg" logic to `gramsHint.ts`.

### Changes Required:

#### 1. Helpers

**File**: `frontend/src/lib/gramsHint.ts`

**Intent**: Export the piece-unit test, a multipack-aware per-piece weight reader over several
names, and the kg formatter used by all three screens. `suggestPiecesFromGrams` switches to the
shared piece-unit test (same behaviour).

**Contract**:
- `isPieceUnit(unit: string | null | undefined): boolean` — trimmed, lower-cased member of
  `PIECE_UNITS`.
- `pieceGramsFromNames(names: Array<string | null | undefined>): number | null` — the FIRST name
  that carries a weight (`parseGramsPerPiece` not null) decides: its weight, or null when that
  name has a multipack marker (no fall-through to a later name — plan-review N5, more cautious). Multipack marker: a weight directly
  followed by `/` or `x`/`×` and a digit (`25g/30`, `4,2kg/2,5kg`, `200g x 6`), or a digit and
  `x`/`×` directly before a weight (`12x200g`, `4 x 2,5kg`).
- `formatPiecesAsKg(qty: number | "" | null | undefined, gramsPerPiece: number | null, unit: string, lang: Lang): string | null`
  — null unless `qty` is a finite number > 0, `gramsPerPiece` > 0 and `isPieceUnit(unit)`;
  otherwise the locale-formatted kg number (`formatBaseQty(qty × g / 1000)`, max 3 dp, e.g. "2,4").
  The " kg" text and brackets live in i18n, not here.

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Copy for the reading.

**Contract**: `stock.kgReading` = `({kg} kg)` (pl/en, via `t`); `stock.readingKg` =
`= {split} ({total} · {kg} kg)` and `stock.readingBaseKg` = `= {total} ({kg} kg)` (via `tParts`,
split/total are nodes). "kg" stays plain text on purpose: it is a secondary reading, not the unit
of the typed number (bold `UnitLabel` stays reserved for that).

### Success Criteria:

#### Automated Verification:

- Unit tests for `isPieceUnit`, `pieceGramsFromNames`, `formatPiecesAsKg` pass (`npm run test`)
- Existing `gramsHint.test.ts` / `GramsHint.test.tsx` stay green

---

## Phase 2: Show the reading on the Captain screens

### Overview

Wire the formatter into the count grid, the order card and `PackStockInput`.

### Changes Required:

#### 1. PackStockInput

**File**: `frontend/src/pages/captain-mp/components/PackStockInput.tsx`

**Intent**: Optional prop carrying grams per base unit; when set (and `copy="stock"`), the live
reading uses the `*Kg` keys with the kg number from `formatPiecesAsKg(combined, …, baseUnit)`.

**Contract**: new prop `gramsPerUnit?: number | null`; ignored for `copy="order"`; the unit check
reads `baseUnit` (never `packUnit`). The kg keys are chosen outside the `as const` `keys` object.
When the row is kg-capable (stock copy, grams > 0, piece base unit) the reading takes its own line
(`basis-full`, reserved min height) so it does not jump between lines at 375 px while typing;
other rows render exactly as today.

#### 2. Count grid

**File**: `frontend/src/pages/captain-mp/components/InventoryCountGrid.tsx`

**Intent**: Per row compute `pieceGramsFromNames([p.product_name_pl])`. ×1 row: under the stock
field a right-aligned muted `stock.kgReading` line (`id="stock-<id>-kg"`, `aria-live="polite"`,
linked through the field's `aria-describedby`); the line's box is reserved for every qualifying row so the field does
not jump when the first digit is typed. Pack row: pass `gramsPerUnit` to `PackStockInput`.

#### 3. Order card

**File**: `frontend/src/pages/captain-mp/components/ProductCard.tsx`

**Intent**: ×1 row: under the unit caption a second caption line "(2,4 kg)" (same
`stock.kgReading` key) inside the caption element, which is already the field's
`aria-describedby`; its line is reserved on qualifying rows so the 94 px column never re-wraps. Names:
`[product_name_pl, supplier_product_name]` (as `GramsHint`). Pack row: `gramsPerUnit` from
`[product_name_pl]` only.

### Success Criteria:

#### Automated Verification:

- Component tests: grid ×1 "Halloumi Reha 200gr" (szt) typed 12 shows "(2,4 kg)"; empty / kg
  product / Helcom multipack show nothing; grid pack row (karton 12) shows
  "= 1 karton (12 szt · 2,4 kg)"; PackStockInput: kg base unit ("Gyros 15 KG", packUnit szt) and
  `copy="order"` show no kg, count 0 shows "= 0 szt" with no kg; order card ×1 caption shows
  "(2,4 kg)"; order card pack row reads `product_name_pl` only (name "Halloumi", supplier name
  "…200g/12" → nothing)
- `npm run lint`, `npm run test`, `npm run build` pass (Homebrew node)

#### Manual Verification:

- On prod after deploy: Captain count + order card for halloumi show the kg reading; a kg product
  and a product without a weight show nothing; the submitted count still stores pieces; at 375 px
  the reading does not jump lines while typing

---

## Testing Strategy

### Unit Tests:

- `isPieceUnit`: szt/słoik/opak (case, spaces) true; kg, l, box, "" false.
- `pieceGramsFromNames`: "Halloumi Reha 200gr" → 200; "Ketchup Fanex VII 1,1 kg" → 1100 (the
  "x" in a word is not a marker); multipack names → null ("25g/30", "12x200g", "4 x 2,5kg",
  "4,2kg/2,5kg", "400g/240g"); first name without weight falls through to the second; first
  weight-bearing name with a marker does NOT fall through; no weight → null.
- `formatPiecesAsKg`: 12 × 200 g → "2,4"; 0,5 × 820 → "0,41"; en locale "2.4"; 0, "", negative,
  NaN, kg unit, null grams → null.

### Manual Testing Steps:

1. Captain → Inwentaryzacja: type 12 at halloumi → "(2,4 kg)" / "= 1 karton (12 szt · 2,4 kg)".
2. Captain → order card for Intermlecz: same reading next to "Stan obecny".
3. Clear the field → reading disappears; type in a kg product → no reading.

## Plan review

Opus plan-review 17.10: no blockers; S1 (trap tests), S2 (375 px wrap), S3 (prod names), N1–N5
folded into the sections above.

## Impl review

Opus impl-review 17.10: no blockers. Fixed: S1 multipack guard widened (`*`, `200 g. x 6`, a
piece count "szt" in the name, fractions "1/2 kg") + tests; S2 layout-class tests in
`PackStockInput.test.tsx`; N2 pack reading uses "·" ("12 szt · 2,4 kg") so it does not clash with
the Polish decimal comma; N3 card kg work gated on ×1; N5 aria-describedby + card multipack tests.
Accepted as is: N1 (kg-capable rows are ~1 line taller by design, no jump while typing).

## References

- Coordination: `context/changes/porzadek-2026-10/plan.md` (item 4.14, D8/W49)
- Lane C note on halloumi karton = 12 (shared notes, `lane-c-n1-finding.md`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure kg-reading helpers

#### Automated

- [x] 1.1 Unit tests for `isPieceUnit`, `pieceGramsFromNames`, `formatPiecesAsKg` pass (`npm run test`)
- [x] 1.2 Existing `gramsHint.test.ts` / `GramsHint.test.tsx` stay green

### Phase 2: Show the reading on the Captain screens

#### Automated

- [x] 2.1 Component tests for grid ×1, grid pack row, PackStockInput guards and order card pass
- [x] 2.2 `npm run lint`, `npm run test`, `npm run build` pass (Homebrew node)

#### Manual

- [ ] 2.3 On prod after deploy: halloumi shows the kg reading on count and order card; kg / no-weight products show nothing; stored count stays in pieces; no line jump at 375 px
