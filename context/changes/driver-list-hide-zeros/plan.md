# Hide zero cells in the driver list PDF — Implementation Plan

## Overview

The driver PDF ("LISTA DLA KIEROWCY") prints a product × location matrix. Every
location in the run gets a column, so a product one location did not order shows
a `0` in that location's cell. Drivers read the zeros as items to carry, so they
are misleading. After this change a cell shows a number only when its quantity is
above zero; every other cell is empty.

## Current State Analysis

- `buildTransportDriverPrintDoc` (`frontend/src/pages/manager/lib/transport.ts:821`)
  shapes the data: `qtyByLocation` is a full row aligned to `locations`, `0` where
  a location had nothing (`transport.ts:775-780`, `:846`). Several tests assert
  those zeros (`transport.test.ts:868`, `:1439-1440`) — it is a data contract.
- Rows whose total is 0 are already dropped by `driverBlocks`
  (`transport.ts:126-142`), so the `Razem` column is always > 0.
- The zeros reach paper at exactly one place: `bodyRowsFor` in
  `buildDriverPdfDocDefinition` (`frontend/src/pages/manager/lib/transportPdf.ts:170`),
  `text: String(qty)`.
- That builder feeds both the PDF download and the Gmail draft attachment
  (`frontend/src/pages/manager/transport/TransportSendPanel.tsx:381`, `:537`).
- No other driver document renders per-location quantities (the driver Gmail body
  in `gmailDraft.ts` has no matrix).
- Example from prod (2.11.2026, TRN-20261102-PAGO-5723b0): "Gyros 15 KG — 4 0 0 0 1 = 5".

## Desired End State

On the driver PDF a location cell shows its quantity only when it is > 0; a cell
for 0 (or anything ≤ 0) is empty but keeps the row's zebra fill. Columns, row
order, numbering, the `Razem` column and the Pago/ZOW document are unchanged.

### Key Discoveries:

- Single render point: `transportPdf.ts:170`.
- `qtyByLocation` zeros are a tested data contract — fix stays at the render layer.

## What We're NOT Doing

- Not changing `buildTransportDriverPrintDoc` / `qtyByLocation` (data keeps its 0s).
- Not dropping location columns that are empty within one supplier section.
- Not replacing zeros with a dash or another placeholder — the request is "only
  values above zero".
- Not touching the on-screen Transport matrix (`TransportMatrix.tsx` / `TransportPage.tsx`) —
  that is the Manager's editing grid, not the driver list.
- Not touching the Pago/ZOW PDF (it has no per-location cells) or the e-mail bodies.

## Implementation Approach

Render-only change in `bodyRowsFor`: a location cell's text is `String(qty)` when
`qty > 0`, otherwise `""`. Zebra fill stays on every cell.

## Phase 1: Blank zero cells on the driver PDF

### Overview

One-line render change plus tests.

### Changes Required:

#### 1. Driver PDF location cells

**File**: `frontend/src/pages/manager/lib/transportPdf.ts`

**Intent**: Stop printing `0` in location cells of the driver matrix.

**Contract**: In `buildDriverPdfDocDefinition` → `bodyRowsFor`, each
`qtyByLocation` cell's `text` is `String(qty)` if `qty > 0`, else `""`; the cell
keeps `...zebra`. Update the "Driver document" comment so it says zero cells are
left blank.

#### 2. Tests

**File**: `frontend/src/pages/manager/lib/transportPdf.test.ts`

**Intent**: Pin the new behaviour.

**Contract**: New test(s) in `describe("buildDriverPdfDocDefinition")`: a batch
where one location has 0 for a product → that table row's location cell text is
`""`, the other location's cell shows its number, the `Razem` cell shows the
total, and a zebra (odd-index) row keeps `fillColor` on the blank cell. Existing
tests keep passing unchanged.

### Success Criteria:

#### Automated Verification:

- Frontend tests pass: `npm run test` (in `frontend/`)
- Frontend build passes: `npm run build`
- Frontend lint passes: `npm run lint`
- Backend unaffected: `ruff check .` + `python -m pytest` (via `/verify`)

#### Manual Verification:

- Live test on prod after deploy: download the driver PDF of a multi-location
  Transport batch; cells that used to show 0 are empty, the rest (and Razem) match.

## Testing Strategy

### Unit Tests:

- Zero cell → empty text; positive cell → number; Razem unchanged.
- Zebra fill preserved on an empty cell.

### Manual Testing Steps:

1. After deploy, open Manager → Transport, pick a multi-location batch.
2. Download "Lista dla kierowcy" (no send, no draft needed).
3. Confirm no `0` in location cells; totals unchanged versus the old PDF.

## References

- Prod sample: `Warszawa-lista-kierowcy.pdf` (2.11.2026)
- Data builder: `frontend/src/pages/manager/lib/transport.ts:821`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Blank zero cells on the driver PDF

#### Automated

- [x] 1.1 Frontend tests pass: `npm run test`
- [x] 1.2 Frontend build passes: `npm run build`
- [x] 1.3 Frontend lint passes: `npm run lint`
- [x] 1.4 Backend unaffected: `ruff check .` + `python -m pytest`

#### Manual

- [ ] 1.5 Live test on prod: driver PDF shows no zero cells, totals unchanged
