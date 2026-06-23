# Decimal-comma inputs + receipt-edit save loss (P0 demo blockers) Implementation Plan

## Overview

Two frontend-only P0 bugs surfaced by the live M-01 in-store demo, fixed independently:

1. **Decimal commas don't work.** Polish-locale phones type `0,6` (comma). The Captain inputs are `<input type="number">`, which in a `pl-PL` locale does not hand a comma string to JS — the field reads back as empty, so the line goes blank ("zamawiasz bez stanu"), no suggestion renders, and the row is silently dropped from the submit payload (so the order never reaches the Manager). Weight goods (lemon, tzatziki, onion) are unorderable.
2. **Receipt edits silently lost on confirm.** Goods-receipts are append-only/immutable and persist-first (the receipt JSON saves before the WZ photos upload). After the first save the `if (!receiptId)` guard correctly avoids creating a duplicate receipt — but the quantity inputs stay editable with no save path, so any quantity the Captain re-types after a photo failure is silently dropped while photos upload fine.

The same `type="number"` + `Number()` pattern is also in the **Manager's** editable qty input (`OrderLineTable.tsx`), so it shares bug #1 — and the owner acts as Manager during the live demo. It is in scope (plan-review F2).

No backend, schema, or API changes. Pure `frontend/` work.

## Current State Analysis

**Bug #1 — decimal inputs.** Five numeric inputs across the Captain and Manager screens parse with bare `Number(e.target.value)` and store `number | ""`:

- `ProductCard.tsx:89-101` — `handleCurrentChange` / `handleFinalChange` (current stock + final order qty). Shared by both `CaptainMP` (new order) and `OrderEditPage` (edit) — one fix covers both order paths.
- `InventoryCountPage.tsx:246-254` — `handleStockChange`.
- `ReceiptLineCard.tsx:46-48` — delivered-qty `onChange`.
- `OrderLineTable.tsx:198-214` (Manager edit) — `type="number"` + `const raw = Number(e.target.value)`; a manager typing `0,6` hits `NaN` → the `Number.isFinite(raw)&&raw>0 ? raw : 0` clamp → silently `0` (plan-review F2).

All four are `type="number"`. The downstream logic — `computeSuggestion` / `computeRowState` (`compute.ts`), `buildPayloadLines` (`buildPayloadLines.ts:20-24`, filters rows where `Number(captain_final_qty_purchase) > 0`) — already coerces with `Number()` and treats `""` as the blank sentinel. So if a comma string ever reached state it would be `NaN`; in practice `type="number"` yields `""` first, which is why the row blanks out.

**Bug #2 — receipt edit lock.** `ReceiveDeliveryPage.tsx:87-128` (`handleSubmit`): on first call it builds `lines` from `delivered` state and POSTs `api.receiptSubmit`, then sets `createdReceiptId`. On a subsequent call (photo retry) `if (!receiptId)` is false, so the line block is skipped entirely — re-edited quantities never re-submit. Receipts are append-only (`models.py` `Receipt`, no update path for lines; `captain_receipt_submit` always mints a new `receipt_id`), and persist-first is a deliberate GR-01 guarantee (receipt survives a photo failure). `ReceiptLineCard.tsx` has no read-only mode.

### Key Discoveries:

- **`type="number"` is the real culprit, not `Number()`** — a `pl-PL` browser won't deliver a comma to JS through a number input; the element must become `type="text" inputMode="decimal"` for the raw string to reach a parser. ([ProductCard.tsx:159-168](frontend/src/pages/captain-mp/components/ProductCard.tsx))
- **Vitest is wired** (`package.json` `"test": "vitest run"`, vitest@4.1.8) with existing `compute.test.ts` + `buildPayloadLines.test.ts` — automated coverage for the comma fix, not just build/lint. ([frontend/src/pages/captain-mp/lib/](frontend/src/pages/captain-mp/lib/))
- **`ProductCard` + `buildPayloadLines` are shared** by `CaptainMP` and `OrderEditPage` ([OrderEditPage.tsx:21,247](frontend/src/pages/captain-mp/OrderEditPage.tsx)) — fixing the component fixes new-order and edit at once.
- **The Manager edit-qty input shares the bug** ([OrderLineTable.tsx:198-214](frontend/src/pages/manager/OrderLineTable.tsx)) — same `DecimalInput` swap closes it; the component is generic (lives in `captain-mp/components/` but a cross-folder import from the manager page is fine; relocating to a shared dir is optional).
- **Controlled-number-input reset trap**: a `number`-typed state can't hold the intermediate `"0,"` string (it coerces to `0` and the comma vanishes mid-type). The fix must buffer the raw string locally — hence a dedicated `DecimalInput` component, keeping the logic layer on `number | ""`.
- **Receipts are append-only + persist-first** — locking quantities after save is the fix that honors both contracts (chosen over an atomic-submit rewrite or a new update endpoint).
- **Lesson — keep skill artifacts English**: this plan, Progress, and commit subjects stay English though the working language is Polish. ([context/foundation/lessons.md](context/foundation/lessons.md))

## Desired End State

- A Captain on a Polish-locale phone types `0,6` for lemon stock → the suggestion now computes (`2 − 0,6 = 1.4`, rendered) instead of blanking, the line is NOT flagged "bez stanu", and a decimal order quantity submits and appears on the Manager queue. (Display still shows a dot, e.g. `1.4`; comma-formatting the OUTPUT is a scoped-out cosmetic follow-up — see What We're NOT Doing.)
- The same decimal entry works on the inventory-count, goods-receipt, and Manager edit-qty inputs.
- On the receipt screen, once the receipt is saved the quantity fields become read-only and the UI states the receipt is saved (retry affects photos only) — no edit is ever silently lost.
- `npm run test`, `npm run build`, `npm run lint` all pass.

## What We're NOT Doing

- **No backend / API / schema changes.** The backend already receives JSON numbers; nothing changes server-side.
- **Not** addressing the other feedback items (deviation 20→25%, supplier-email total leak + address, ∞ deviation copy, name field, add-product, day-of-week targets, order-history nav) — those are separate changes.
- **Display-side number formatting** (rendering suggestion / variance / detail numbers as `1,4` instead of `1.4`) — cosmetic; the input fix is what unblocks ordering. Tracked as a fast follow-up (plan-review F3).
- **Not** adding a receipt line-edit/update endpoint or making receipts mutable (rejected: breaks append-only).
- **Not** reverting persist-first (rejected: loses the GR-01 receipt-survives-photo-failure guarantee).
- **Not** migrating other non-decimal numeric inputs (dates, integer-only counters) or introducing a full locale/i18n number-formatting library.

## Implementation Approach

Phase 1 introduces one reusable `DecimalInput` component plus a pure `parseDecimal` helper, and swaps it into the four decimal inputs. The component owns a local raw-string buffer (so `"0,"` survives mid-type), normalizes comma→dot, and emits `number | ""` upward — so `compute.ts`, `buildPayloadLines.ts`, and the in-memory `OrderLine` / inventory / receipt state types are untouched. Phase 2 makes the receipt quantity inputs read-only once a receipt exists and clarifies the two-step (save → photos) affordance.

## Phase 1: Decimal-comma input

### Overview

Make every Captain and Manager decimal input accept a comma, render the suggestion, and submit correctly — without disturbing the `number | ""` logic layer.

### Changes Required:

#### 1. `parseDecimal` helper

**File**: `frontend/src/pages/captain-mp/lib/number.ts` (new) + `number.test.ts` (new)

**Intent**: One pure place to turn a user-typed decimal string (comma or dot) into a number, so all inputs and any future call sites agree.

**Contract**: `parseDecimal(raw: string): number | null` — trims; treats `""`/whitespace as blank → `null`; replaces comma with dot; parses with `Number()` (strict — rejects `"1.5abc"`, `"1 234"` as `null`, unlike lenient `parseFloat`). Returns `null` only for non-finite/invalid (`"abc"`, `","`). Note `"0,"` → `"0."` → `Number("0.")` is `0` (finite), so it returns `0` — which is exactly the wanted mid-type behavior (the field shows `0,` and the suggestion uses `0` while the user keeps typing toward `0,6`). A companion `formatDecimal(value: number | ""): string` renders a number back to a dot-form display string for buffer seeding. Negative: `min=0` stays a UI concern; `parseDecimal("-1")` returns `-1`.

#### 2. `DecimalInput` component

**File**: `frontend/src/pages/captain-mp/components/DecimalInput.tsx` (new)

**Intent**: A drop-in replacement for the `<input type="number">` decimal fields that buffers the raw string locally (fixing the mid-type reset) and emits `number | ""` so callers keep their current state shape.

**Contract**: Props `{ value: number | ""; onChange: (v: number | "") => void }` plus passthrough (`id`, `inputMode`, `className`, `aria-*`, `placeholder`, `min`, `step`, `disabled`, `readOnly`). Renders `<input type="text" inputMode="decimal">`. Internal `raw` string state seeded from `value` via `formatDecimal`. On input: store `raw`; compute `parseDecimal(raw)` — emit `""` when blank, else emit the parsed number when non-null (mid-type partials like `"0,"` keep `raw` for display and emit the last valid number, so the suggestion updates live without the comma vanishing). A `useEffect` re-seeds `raw` from `value` when the prop changes externally (e.g. tap-to-autofill the suggestion at `ProductCard.tsx:185`, or draft restore) and differs from the current parsed buffer. Default `inputMode="decimal"`.

#### 3. Swap the five inputs

**File**: `frontend/src/pages/captain-mp/components/ProductCard.tsx`

**Intent**: Replace the current-stock and final-order `<input type="number">` with `<DecimalInput>`; drop the now-dead `handleCurrentChange`/`handleFinalChange` `Number()` coercion in favor of the component's `number | ""` callback.

**Contract**: Two `<DecimalInput>` instances; `onChange` sets `current_stock_qty_base` / `captain_final_qty_purchase` exactly as today (`number | ""`). Preserve `id`, `aria-describedby`, `aria-invalid`, and the rule-driven `inputMode` (numeric vs decimal) for the mobile keyboard. Drop `step` — it is a no-op on `type="text"` (plan-review F4). No change to `computeSuggestion`/`computeRowState` calls.

**File**: `frontend/src/pages/captain-mp/InventoryCountPage.tsx`

**Intent**: Swap the stock `<input type="number">` (line ~556-565) for `<DecimalInput>`.

**Contract**: `value={line.current_stock_qty_base}`, `onChange` feeds `handleStockChange` adapted to take `number | ""` (or keep the `(productId, raw)` shape by having the wrapper stringify — prefer changing `handleStockChange` to accept `number | ""` and store directly). Comment input untouched.

**File**: `frontend/src/pages/captain-mp/components/ReceiptLineCard.tsx`

**Intent**: Swap the delivered-qty `<input type="number">` for `<DecimalInput>` so receipt quantities accept commas too.

**Contract**: `value={delivered}`, `onChange={(v) => onChange(line.order_line_id, v)}`. Variance math (`Number(delivered) - ordered`) keeps working since `delivered` stays `number | ""`.

**File**: `frontend/src/pages/manager/OrderLineTable.tsx`

**Intent**: Swap the Manager's editable qty `<input type="number">` (lines 198-214) for `<DecimalInput>` so a manager can type a comma without the value silently coercing to `0` (plan-review F2). Same bug class as the Captain inputs; the owner hits it as Manager during the demo.

**Contract**: `value={managerQty}`; feed the existing `onQtyChange?.(line.order_line_id, next)` callback from the component's `number | ""` — preserve today's clamp semantics (`"" `/non-finite/`≤0` → `0`). `min={0}`; drop `step` (no-op on text). Import `DecimalInput` from `captain-mp/components/` (cross-folder import is acceptable in this small SPA; relocating to a shared dir is optional).

#### 4. Update tests

**File**: `frontend/src/pages/captain-mp/lib/compute.test.ts`, `buildPayloadLines.test.ts` (+ new `number.test.ts`)

**Intent**: Lock the comma behavior and guard the logic layer is unaffected.

**Contract**: `number.test.ts` covers `parseDecimal` ("0,6"→0.6, "1.4"→1.4, ""→null, "0,"→null, "abc"→null, "-1"→-1). Existing compute/payload tests still pass unchanged (logic layer untouched); add a payload case proving a decimal `captain_final_qty_purchase` (e.g. `0.6`) survives the `> 0` filter and serializes.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test`
- Type-check + build passes: `PATH=/opt/homebrew/bin:$PATH npm run build`
- Lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint`

#### Manual Verification:

- In preview (narrow viewport), typing `0,6` into lemon current-stock renders a suggestion (not "—"/"bez stanu")
- A decimal order qty (e.g. `0,6`) submits without the row being dropped and reaches the Manager queue
- Inventory-count and receipt delivered-qty inputs accept a comma and show the value
- Manager edit-qty input accepts `0,6` (no silent coercion to `0`)
- Tap-to-autofill suggestion still populates the order qty correctly (buffer re-seeds)

**Implementation Note**: After Phase 1 automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Receipt confirmation edit-save lock

### Overview

Stop the silent loss of re-edited receipt quantities by making the quantity inputs read-only once the receipt is saved, and make the two-step (save → photos) state explicit.

### Changes Required:

#### 1. Read-only receipt lines after save

**File**: `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx`

**Intent**: Once `createdReceiptId` is set, the receipt is immutable — present the quantity fields as read-only and make the remaining action unambiguously "attach/retry photos", so the Captain is never misled into thinking a post-save quantity edit will persist.

**Contract**: Derive `const receiptSaved = createdReceiptId !== null;`. Pass `readOnly={receiptSaved}` to each `ReceiptLineCard`. When `receiptSaved`, render a short saved-state banner (i18n) above the lines stating the receipt is saved and only photos remain. The submit button already switches to `delivery.retryPhotos` when `createdReceiptId` — keep that; the `handleSubmit` line-block guard is unchanged (it correctly skips re-creation). `received_by` may also lock once saved (it's captured on the receipt).

#### 2. Read-only mode on the line card

**File**: `frontend/src/pages/captain-mp/components/ReceiptLineCard.tsx`

**Intent**: Honor a `readOnly` prop by disabling the delivered-qty input.

**Contract**: Add `readOnly?: boolean`; when true, the `DecimalInput` (from Phase 1) renders `readOnly`/disabled with a non-editable visual. Variance badge still shows.

#### 3. Copy

**File**: `frontend/src/i18n/strings.ts`

**Intent**: PL + EN strings for the saved-state banner.

**Contract**: One new key (e.g. `delivery.savedLockNote`) in both languages, English value kept parseable per the i18n contract. Reuse existing `delivery.retryPhotos`.

### Success Criteria:

#### Automated Verification:

- Type-check + build passes: `PATH=/opt/homebrew/bin:$PATH npm run build`
- Lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint`
- Unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test`

#### Manual Verification:

- After a successful receipt save, the quantity inputs are read-only and a "receipt saved — photos only" note shows
- Simulating a photo failure then retrying uploads photos without resurfacing editable quantities (no silent loss)
- First-time submit (qty + photos together) still saves quantities and photos correctly

**Implementation Note**: After Phase 2 automated checks pass, pause for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- `parseDecimal`: comma/dot/blank/partial/invalid/negative.
- `buildPayloadLines`: a decimal final qty survives the `>0` filter and serializes; blank stock still → `null`.
- `computeRowState`/`computeSuggestion`: unchanged behavior with `number | ""` inputs (regression guard).

### Manual Testing Steps:

1. `npm run dev` (or preview), narrow viewport, captain token; enter `0,6` lemon stock → suggestion `1,4` shows, no "bez stanu".
2. Submit a decimal order → appears on Manager queue.
3. Inventory + receipt screens accept commas.
4. Receipt: save, force a photo error, retry → quantities locked, photos upload, nothing lost.

## Migration Notes

None — no data or schema change. Existing persisted orders/receipts are unaffected (numbers were always stored as numbers; this only fixes input capture).

## References

- Change: `context/changes/demo-blocker-decimals-save/change.md`
- Bug #1 sites: `frontend/src/pages/captain-mp/components/ProductCard.tsx:89-101`, `lib/buildPayloadLines.ts:20-24`, `InventoryCountPage.tsx:246-254`, `components/ReceiptLineCard.tsx:46-48`, `frontend/src/pages/manager/OrderLineTable.tsx:198-214`
- Bug #2 site: `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx:87-128`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Decimal-comma input

#### Automated

- [x] 1.1 Unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test` — 9f9728c
- [x] 1.2 Type-check + build passes: `PATH=/opt/homebrew/bin:$PATH npm run build` — 9f9728c
- [x] 1.3 Lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint` — 9f9728c

#### Manual

- [ ] 1.4 `0,6` lemon stock renders a suggestion (not "bez stanu")
- [ ] 1.5 Decimal order qty submits and reaches the Manager queue
- [ ] 1.6 Inventory + receipt delivered-qty inputs accept a comma
- [ ] 1.7 Manager edit-qty input accepts `0,6` (no silent coercion to `0`)
- [ ] 1.8 Tap-to-autofill suggestion still populates correctly

### Phase 2: Receipt confirmation edit-save lock

#### Automated

- [x] 2.1 Type-check + build passes: `PATH=/opt/homebrew/bin:$PATH npm run build` — a0b8a70
- [x] 2.2 Lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint` — a0b8a70
- [x] 2.3 Unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test` — a0b8a70

#### Manual

- [ ] 2.4 Quantity inputs read-only + saved-note after receipt save
- [ ] 2.5 Photo retry uploads without resurfacing editable quantities (no silent loss)
- [ ] 2.6 First-time qty+photos submit still saves correctly
