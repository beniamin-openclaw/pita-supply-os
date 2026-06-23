# Order qty display fixes (Captain order detail) Implementation Plan

## Overview

Three display-only fixes on the Captain order-detail view, found in live demo round 2 (2026-06-23).
The underlying data is correct everywhere; only the Captain's order-detail card lies:

- **Bug A** — the card shows the captain's original qty (`captain_final`), never the manager's
  final qty after the manager edits + dispatches. The "effective ordered qty" rule already exists
  twice in the codebase; the card just never got it.
- **Item C (Bug A extension)** — after delivery the card never surfaces what was *received*; the
  owner sees a frozen old number with no "corrected value" anywhere on the main view.
- **Bug B** — the receive screen's variance prints a raw binary-float artifact
  (`+0.40000000000000013`).

No backend change. No data-model change.

## Current State Analysis

- The card's quantity is hardcoded: `OrderDetailPage.tsx:190` renders `line.captain_final_qty_purchase`.
- The "effective ordered qty" rule (`manager_final if > 0 else captain_final`, mirroring backend
  `gmail_url._effective_qty`) is duplicated:
  - `effectiveManagerQtyPurchase` — `frontend/src/pages/manager/lib/managerLine.ts:21`
  - `effectiveOrdered` — `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx:22`
  Both identical; the order-detail card is the one place missing it. This is exactly why the
  receive screen correctly shows 1.8 while the order detail shows 1.4.
- The receipt's per-line received/variance data already exists: `ReceiptDetail` /
  `ReceiptDetailLine` carry `received_qty_purchase` + `variance_qty_purchase` keyed by
  `order_line_id` (`types.ts:439-440`), fetched via `api.receipt(receipt_id)`. `OrderDetailPage`
  already loads receipt *summaries* (`api.captainReceipts`) + photos in its `manager_sent` branch —
  adding one `api.receipt(...)` call there is a small extension of an existing flow.
- Variance: `ReceiptLineCard.tsx:27` computes `Number(delivered) - ordered` and prints it raw.
- Decimal parsing/formatting helpers already live in `frontend/src/components/ui/number.ts`
  (`parseDecimal`, `formatDecimal`) — the natural home for a `roundQty` sibling.
- There is no top-level `frontend/src/lib/` yet; per-feature helpers live under `pages/*/lib/`.
  A neutral cross-feature home is needed so the Captain page doesn't import from `pages/manager/lib`.

### Key Discoveries:

- `frontend/src/pages/captain-mp/OrderDetailPage.tsx:190` — the hardcoded `captain_final` (Bug A).
- `frontend/src/pages/manager/lib/managerLine.ts:21` + `ReceiveDeliveryPage.tsx:22` — the two
  existing copies of the effective-qty rule to consolidate.
- `frontend/src/pages/captain-mp/components/ReceiptLineCard.tsx:27` — the raw-float variance (Bug B).
- `frontend/src/components/ui/number.ts` — `roundQty` home (next to `parseDecimal`).
- `ReceiptDetail` lines carry `received_qty_purchase` + `variance_qty_purchase` (Item C source).

## Desired End State

- Captain order-detail card shows the **effective ordered qty** (manager's final when set, else the
  captain's) — always, mirroring the receive screen and backend. After the manager changes Cytryna
  1.4 → 1.8 and dispatches, the card shows **1.8 kg**.
- When the manager's final differs from the captain's, a discreet hint reads
  "zmienione przez menedżera (było 1,4)".
- Once a receipt exists, each product line also shows "Dostarczono: 2,2 kg · różnica +0,4 kg".
- The variance (and other computed-qty displays) render to **2 dp** — "+0,4 kg", never
  "+0.40000000000000013".

Verify: open a dispatched order whose manager edited a qty → card shows the manager's number + hint;
confirm a delivery with a decimal → order detail shows received + clean variance.

## What We're NOT Doing

- No backend change, no data-model change, no new endpoint (all data already exists).
- Not changing the *receive* screen's qty behavior (it already shows the right ordered value); only
  rounding its variance display.
- Not touching the Manager dashboard's per-line table beyond the shared-helper consolidation
  (its display already uses `effectiveManagerQtyPurchase`).
- Not addressing the round-1 backlog items (deviation 25%, email leak/address, add-product, weekday
  targets, bucket units, history nav) — those are separate changes.
- Not changing the "comma vs dot" display locale (1.4 vs 1,4) — out of scope (prior F3 follow-up).

## Implementation Approach

Consolidate the duplicated effective-qty rule into one shared helper, add a `roundQty` number util,
then apply both on the order-detail card. Phase 1 fixes the frozen number + the manager hint + the
float (no new network call). Phase 2 adds the received-qty overlay (one `api.receipt` call in the
existing `manager_sent` branch). Splitting this way keeps Phase 1 independently shippable.

## Phase 1: Effective ordered qty, manager-changed hint, variance rounding

### Overview

Fix the frozen card number (Bug A) + the raw-float variance (Bug B), and consolidate the duplicated
rule. No new API call.

### Changes Required:

#### 1. Shared number util — `roundQty`

**File**: `frontend/src/components/ui/number.ts`

**Intent**: Add a `roundQty` helper so computed quantities render to 2 dp without binary-float tails.

**Contract**: `roundQty(n: number): number` returning `Math.round(n * 100) / 100` (a number, so
trailing zeros vanish naturally — `0.4`, not `"0.40"`). Pure; no formatting/locale concerns.

#### 2. Shared effective-qty rule — new neutral home

**File**: `frontend/src/lib/orderQty.ts` (new)

**Intent**: One canonical "effective ordered qty" helper, importable by both Captain and Manager
features, so the rule stops being copy-pasted.

**Contract**: `effectiveOrderedQtyPurchase(line: ManagerOrderLineDetail): number` =
`line.manager_final_qty_purchase > 0 ? line.manager_final_qty_purchase : line.captain_final_qty_purchase`.
Mirrors backend `gmail_url._effective_qty`.

#### 3. Consolidate the two existing copies

**File**: `frontend/src/pages/manager/lib/managerLine.ts`, `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx`

**Intent**: Replace the two local copies with the shared helper so behavior cannot drift. Keep
`managerLine.ts`'s public `effectiveManagerQtyPurchase` name (its internal callers `deltaVsCaptain`
etc. depend on it) — have it delegate to / re-export the shared function. Point
`ReceiveDeliveryPage`'s `effectiveOrdered` usage at the shared import.

**Contract**: No behavior change — same rule, single definition. `managerLine` re-exports or wraps
`effectiveOrderedQtyPurchase`; `ReceiveDeliveryPage` imports it directly.

#### 4. Order-detail card: effective qty + manager-changed hint

**File**: `frontend/src/pages/captain-mp/OrderDetailPage.tsx`

**Intent**: Render the effective ordered qty as the card's big number instead of the hardcoded
`captain_final` (Bug A). When `manager_final` differs from `captain_final`, show a discreet hint that
names the captain's original number.

**Contract**: Big number = `effectiveOrderedQtyPurchase(line)`. Below it (or beside the existing
delta), when `line.manager_final_qty_purchase > 0 && line.manager_final_qty_purchase !== line.captain_final_qty_purchase`,
render `t("orders.detail.managerChanged", { value: line.captain_final_qty_purchase })` in a muted
style. The existing `delta_vs_suggestion_pct` block stays.

#### 5. Variance rounding

**File**: `frontend/src/pages/captain-mp/components/ReceiptLineCard.tsx`

**Intent**: Round the displayed variance to 2 dp (Bug B).

**Contract**: `variance = roundQty(Number(delivered) - ordered)` (line 27). Import `roundQty` from
`../../../components/ui/number`. No other logic change.

#### 6. i18n

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Add the manager-changed hint copy (PL/EN).

**Contract**: `"orders.detail.managerChanged": { pl: "zmienione przez menedżera (było {value})", en: "changed by manager (was {value})" }`.

#### 7. Tests

**File**: `frontend/src/components/ui/number.test.ts`, `frontend/src/lib/orderQty.test.ts` (new)

**Intent**: Lock the two pure helpers.

**Contract**: `roundQty(2.2 - 1.8) === 0.4`; `roundQty(1.005)`, integer, and already-clean inputs
behave. `effectiveOrderedQtyPurchase` returns manager_final when > 0, captain_final when manager
is 0.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test`
- Build/type-check passes: `PATH=/opt/homebrew/bin:$PATH npm run build`
- Lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint`

#### Manual Verification:

- A dispatched order whose manager changed a qty shows the **manager's** number on the Captain
  order-detail card (e.g. 1.8, not 1.4).
- The "zmienione przez menedżera (było 1,4)" hint appears only when manager ≠ captain.
- A receipt with a decimal delivered qty shows a clean variance ("+0,4 kg", no float tail).
- No regression on the Manager dashboard per-line table (still shows the effective qty).
- Receive-screen edit flow: confirm the only "lock" on quantities is the intended post-save
  read-only (Phase 2 of the archived demo-blocker change) — no separate edit-loss before submit.

**Implementation Note**: After Phase 1 automated checks pass, pause for manual confirmation before
Phase 2.

---

## Phase 2: Surface received qty + variance per line on the order detail (Item C)

### Overview

Once a receipt exists, show each product's received qty + variance on the order-detail card, so the
Captain sees the corrected value (ordered 1.8 / received 2.2) in one place.

### Changes Required:

#### 1. Fetch receipt detail in the order-detail page

**File**: `frontend/src/pages/captain-mp/OrderDetailPage.tsx`

**Intent**: In the existing `manager_sent` branch (which already loads receipt summaries + photos),
also fetch the first receipt's full detail so per-line received/variance is available.

**Contract**: Add a `receiptDetail` state (`ReceiptDetail | null`). When `receipts[0]` exists, call
`api.receipt(receipts[0].receipt_id)` and store it; build a `Map<order_line_id, ReceiptDetailLine>`.
Degrade silently to no overlay on error (mirrors the existing photo-error handling). No change when
no receipt exists.

#### 2. Render the received sub-line

**File**: `frontend/src/pages/captain-mp/OrderDetailPage.tsx`

**Intent**: Under each product line, when a matching receipt line exists, show "Dostarczono: X unit"
and the rounded variance.

**Contract**: For each `line`, look up the receipt-line by `order_line_id`; when found render
`t("orders.detail.received", { value: rl.received_qty_purchase, unit: line.purchase_unit })` plus the
variance via `roundQty(rl.variance_qty_purchase)` reusing the `delivery.variance` copy (or a new
`orders.detail.receivedVariance`). Muted style; only shown when a receipt line exists.

#### 3. i18n

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Add the received-line copy (PL/EN).

**Contract**: `"orders.detail.received": { pl: "Dostarczono: {value} {unit}", en: "Delivered: {value} {unit}" }`
(+ `orders.detail.receivedVariance` if not reusing `delivery.variance`).

### Success Criteria:

#### Automated Verification:

- Build/type-check passes: `PATH=/opt/homebrew/bin:$PATH npm run build`
- Lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint`
- Unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test`

#### Manual Verification:

- After confirming a delivery (e.g. received 2,2 vs ordered 1,8), the Captain order-detail card shows
  "Dostarczono: 2,2 kg · różnica +0,4 kg" on that product.
- Orders with no receipt yet show no received sub-line (no empty/zero rows).
- Variance on the order detail is rounded to 2 dp (consistent with the receive screen).

---

## Testing Strategy

### Unit Tests:

- `roundQty`: `2.2 - 1.8 → 0.4`; integers unchanged; already-2dp unchanged; negative variance.
- `effectiveOrderedQtyPurchase`: manager_final > 0 wins; manager_final 0 → captain_final.

### Manual Testing Steps:

1. As Manager, change a line qty (1.4 → 1.8), save + dispatch.
2. As Captain, open that order → card shows 1.8 + "zmienione przez menedżera (było 1,4)".
3. Confirm delivery with 2,2 → order detail shows "Dostarczono: 2,2 kg · różnica +0,4 kg".
4. Check a never-edited order still shows the captain's qty and no manager hint.

## Migration Notes

None — display-only, no data or schema change.

## References

- Feedback log: `docs/pita-supply-os-v1/DEMO_FEEDBACK.md` (Round 2)
- Existing rule copies: `frontend/src/pages/manager/lib/managerLine.ts:21`,
  `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx:22`
- Bug A site: `frontend/src/pages/captain-mp/OrderDetailPage.tsx:190`
- Bug B site: `frontend/src/pages/captain-mp/components/ReceiptLineCard.tsx:27`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Effective ordered qty, manager-changed hint, variance rounding

#### Automated

- [x] 1.1 Unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test` — 3b3d8e0
- [x] 1.2 Build/type-check passes: `PATH=/opt/homebrew/bin:$PATH npm run build` — 3b3d8e0
- [x] 1.3 Lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint` — 3b3d8e0

#### Manual

- [ ] 1.4 Dispatched order shows the manager's final qty on the Captain card (1.8 not 1.4)
- [ ] 1.5 "zmienione przez menedżera (było X)" hint shows only when manager ≠ captain
- [ ] 1.6 Receipt variance renders clean 2 dp ("+0,4 kg", no float tail)
- [ ] 1.7 No regression on the Manager dashboard per-line table
- [ ] 1.8 Receive-screen edits: only the intended post-save lock, no separate edit-loss

### Phase 2: Surface received qty + variance per line on the order detail

#### Automated

- [x] 2.1 Build/type-check passes: `PATH=/opt/homebrew/bin:$PATH npm run build`
- [x] 2.2 Lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint`
- [x] 2.3 Unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test`

#### Manual

- [ ] 2.4 After delivery, order detail shows "Dostarczono: X · różnica Y" per line
- [ ] 2.5 Orders with no receipt show no received sub-line
- [ ] 2.6 Order-detail variance rounded to 2 dp
