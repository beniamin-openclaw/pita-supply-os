# Order-Screen UX Fixes Implementation Plan

## Overview

Three frontend-only UX bugs on the order screens (sibling to `manager-queue-ux`), each in its own phase so it can be verified and reverted independently. No backend or API-contract change; all fixes are display / line-assembly / status-gating behavior. Grounded 2026-06-16 to exact lines.

1. **Captain can't submit without entering current stock** — the line-builder requires both stock AND order qty, so ordering without counting stock yields 0 lines → backend 422 "List should have at least 1 item".
2. **No over-order alert when current stock is blank** — `computeRowState` short-circuits to a no-alert grey state whenever stock is blank, so an order far above target/max shows no warning and no reason gate.
3. **"Bez zmian vs kapitan" shown before the manager claims** — the manager-vs-captain summary strip renders for `captain_submitted` orders, where the comparison is meaningless (the manager hasn't engaged).

## Current State Analysis

- **Bug B (line assembly).** `CaptainMP.tsx:347-358` builds `payloadLines` with the filter `l.current_stock_qty_base !== "" && l.captain_final_qty_purchase !== ""` (`:349`). A row where only ZAMAWIASZ was typed fails the first predicate and is dropped → empty `lines` → 422. **The edit path has the same bug**: `OrderEditPage.tsx:151-168` builds `payloadLines` with the same stock-requiring filter (`:154`). `InventoryCountPage.tsx:232,310` also filters by `current_stock !== ""` but that is **correct** for an inventory count (blank = not counted) — out of scope.
- **Bug A (alert gating).** `compute.ts:66-73` `computeRowState` returns `{ state: "grey", requiresReason: false }` whenever `current_stock_qty_base === "" || captain_final_qty_purchase === ""`. The blank-stock half of that OR suppresses ALL downstream logic (the >20% deviation gate at `:82` and the critical-under-order gate at `:108`). There is **no `max_stock_qty_base` check anywhere** in `computeRowState` — the "alert" is purely deviation-from-suggestion (`computeSuggestion = max(0, target − stock)`, `:36`) plus critical-under-order. `ProductCard.tsx:213` renders SUGESTIA as "—" when stock is blank (display only).
- **Bug C (manager summary).** `OrderDetailPane.tsx:163-168` renders `summary.changeCount > 0 ? managerSummary : managerSummaryNone`, gated only on `changeCount`. For `captain_submitted`, `managerSummary(detail.lines, undefined, dispatched=false)` (`:96`) always yields `changeCount === 0` because `effectiveManagerQtyPurchase` falls back to the captain qty on every unset line, so the "Bez zmian vs kapitan" branch (`manager.managerSummaryNone`, `strings.ts:363`) fires pre-claim. The call already has `editable` (`status === manager_claimed`) and `dispatched` (`manager_sent || closed`) in scope at `:89-90`.

## Desired End State

- A Captain can submit (and edit) an order with ZAMAWIASZ filled and OBECNY STAN blank — the order persists with a line per ordered product; the 0-lines 422 no longer occurs in the normal flow.
- A row with a blank stock and an order > 20% off the target-based level shows a reason-required alert (blocks submit until a reason is given), with a stock-agnostic message (no orphan "%" next to a "—" suggestion). SUGESTIA still shows "—". An order within 20% of target needs no reason. The frontend reason gate matches what the backend computes (stock coerced to 0), so there is no 422/400 surprise on submit.
- The manager-vs-captain summary strip is hidden on `captain_submitted` orders and appears only once the manager has engaged (`manager_claimed` / `manager_sent` / `closed`).

### Key Discoveries:

- `compute.ts:66` — the blank-stock half of the short-circuit is Bug A's root cause; removing it (and coercing blank stock → 0) re-enables the existing deviation/critical gates. No new "max" logic is needed — the system has none.
- `CaptainMP.tsx:349` + `OrderEditPage.tsx:154` — Bug B lives in **two** payload builders with an identical filter; both must route through one extracted helper.
- `InventoryCountPage.tsx:232,310` — stock-gated filter is **correct** there; do not touch (inventory ≠ order).
- `OrderDetailPane.tsx:89-96` — `editable` + `dispatched` already in scope; `isManagerEngaged = editable || dispatched`, so Bug C's guard needs no new plumbing.
- Backend parity (`supply-os-v1/app/main.py` `captain_submit`): the deviation gate is `abs(captain_final − suggested)/max(suggested, step) > 0.20 → reason required`, symmetric (over AND under). With stock coerced to 0, `suggested = target`, so any order >20% off target needs a reason — the frontend must mirror this to avoid a 400.

## What We're NOT Doing

- No backend or API-contract change. `current_stock_qty_base` stays a required `number` in the request; the frontend coerces blank → 0 (it is not made nullable/optional server-side).
- No new "max" gate. The guard remains deviation-from-target — we are not adding a `max_stock_qty_base` ceiling check.
- No change to `InventoryCountPage` — its stock-gated line filter is correct for inventory counts.
- No change to the SUGESTIA "—" display for blank stock (kept per owner decision).
- No change to the manager summary on `manager_claimed`/`manager_sent` (only the `captain_submitted` pre-claim case is hidden); no change to the editable line visual or the `dispatched` cancelled logic from `manager-queue-ux`.
- No localization of backend validation `msg` text — that stays the separate Parked `API error-message localization` item (though fixing Bug B removes the most common trigger of the empty-lines 422).

## Critical Implementation Details

- **Bug A frontend↔backend parity.** When stock is blank, `computeRowState` must compute the reason gate with `current = 0` (matching what the backend sees once Bug B coerces blank → 0). If the frontend skipped the gate for blank stock, the Captain could submit an over-order with no reason and hit a backend 400. So: coerce blank → 0 for gating, but emit a stock-agnostic message (no "%") and keep SUGESTIA "—".
- **Bug B inclusion predicate.** A row becomes a line only when `captain_final_qty_purchase` is entered AND `Number(...) > 0`. An explicit 0 (or blank) order qty = "not ordering this product" and is excluded. Blank stock on an included row coerces to `0`.

## Implementation Approach

Three self-contained, independently revertible phases, ordered B → A → C. Phase 1 (Bug B) and Phase 2 (Bug A) both touch the Captain order/edit screens and are sequenced first because they are the submit-blocking + safety bugs; Phase 3 (Bug C) is an isolated Manager-screen display guard. Each phase extracts the bug's logic into a pure function where it isn't already, and unit-tests it (Vitest, following the `manager-queue-ux` / `compute.test.ts` pattern).

## Phase 1: Bug B — current stock optional (submit + edit)

### Overview

Let the Captain order without entering current stock, on both the new-order and edit screens, by building order lines from rows that have an order quantity (coercing blank stock to 0) rather than requiring stock.

### Changes Required:

#### 1. Extract a pure line-builder

**File**: `frontend/src/pages/captain-mp/lib/buildPayloadLines.ts` (new), consumed by `CaptainMP.tsx` and `OrderEditPage.tsx`.

**Intent**: Move the `payloadLines` filter+map out of the components into one shared, testable pure function so both order paths build lines identically and the rule has a single home.

**Contract**: `buildPayloadLines(lines: Record<string, OrderLine> | OrderLine[]): OrderLineSubmit[]`. A row is included iff `captain_final_qty_purchase !== "" && Number(captain_final_qty_purchase) > 0`. For included rows, `current_stock_qty_base` is `Number(value)` or `0` when blank; `reason_code` / `captain_comment` map as today (`reason_code || null`, comment `|| undefined`). Mirrors the existing map shape in `CaptainMP.tsx:347-358` exactly minus the stock predicate.

#### 2. Use the builder in both order paths

**File**: `frontend/src/pages/captain-mp/CaptainMP.tsx` (`:347-358`), `frontend/src/pages/captain-mp/OrderEditPage.tsx` (`:151-168`)

**Intent**: Replace each inline `payloadLines` build with a call to `buildPayloadLines(lines)` so neither path requires current stock. Leave the `isEmpty` / `anyTouched` submit-enable logic (`CaptainMP.tsx:419`, `OrderEditPage.tsx:134`) untouched — those use a separate "any field touched" OR-check that is already correct.

**Contract**: Both call sites POST/PATCH `lines: buildPayloadLines(lines)`. No other behavior change. `InventoryCountPage.tsx` is not touched.

#### 3. Unit test the builder

**File**: `frontend/src/pages/captain-mp/lib/buildPayloadLines.test.ts` (new)

**Intent**: Lock the rule so the 0-lines regression can't return. Pattern: `compute.test.ts` (direct import, no mocks).

**Contract**: Cases — (a) row with order qty > 0 + blank stock → one line with `current_stock_qty_base: 0`; (b) row with order qty 0 or blank → excluded; (c) row with order qty > 0 + stock entered → line with that stock; (d) mixed set → only qty>0 rows, count correct.

### Success Criteria:

#### Automated Verification:

- Build passes: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`
- Unit tests pass: `cd frontend && npm run test`

#### Manual Verification:

- On `/captain-v2`: fill ZAMAWIASZ on one product, leave OBECNY STAN blank, submit → order is created (no "List should have at least 1 item" error).
- Editing an existing order the same way (OrderEditPage) also submits without requiring stock.
- A row with a blank/0 order qty is not sent as a line.

---

## Phase 2: Bug A — over-order alert when stock is blank

### Overview

Make the reason/over-order alert fire when the Captain types an order without entering current stock, by treating blank stock as 0 for the gate while keeping SUGESTIA "—" and showing a stock-agnostic (no-%) message.

### Changes Required:

#### 1. Stop short-circuiting on blank stock in `computeRowState`

**File**: `frontend/src/pages/captain-mp/lib/compute.ts` (`:65-148`)

**Intent**: Only return the empty/grey state when ZAMAWIASZ is blank (nothing to evaluate). When ZAMAWIASZ is entered but stock is blank, coerce stock to 0, run the existing deviation + critical gates, but emit message keys that carry no "%" (since the suggestion is shown as "—").

**Contract**: Replace the `:66` guard so it short-circuits to grey only on `captain_final_qty_purchase === ""`. Add a `stockBlank = line.current_stock_qty_base === ""` flag; when blank, `current = 0`. The red/orange/critical/`requiresReason` thresholds are unchanged (`abs(deviation) > 20`, critical-under-order). When `stockBlank`, the returned `messageKey` is a new no-% variant and `messageVars` omits `pct`. A blank-stock order within 20% of target → no reason, a neutral message. SUGESTIA "—" is unchanged (`ProductCard.tsx:213` not touched).

#### 2. New i18n message keys

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Stock-agnostic copy for the blank-stock alert so no orphan "%" appears next to a "—" suggestion.

**Contract**: Add the key(s) referenced by the new branch — a reason-required variant (pl e.g. "Zamówienie bez stanu — podaj powód" / en "Order without current stock — add a reason") and, if used, a neutral blank-stock variant. PL + EN, following the existing `state.*` entries.

#### 3. Unit test the blank-stock gating

**File**: `frontend/src/pages/captain-mp/lib/compute.test.ts` (extend)

**Intent**: Lock the exact bug: blank stock + high order qty must require a reason; blank stock + near-target must not.

**Contract**: Cases on `computeRowState` — (a) `current_stock=""`, order ≫ target, no reason → `requiresReason: true`, red, message has no `pct`; (b) same with a reason → orange; (c) `current_stock=""`, order ≈ target (≤20%) → `requiresReason: false`; (d) `captain_final=""` → grey (unchanged).

### Success Criteria:

#### Automated Verification:

- Build passes: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`
- Unit tests pass: `cd frontend && npm run test`

#### Manual Verification:

- On `/captain-v2`: blank OBECNY STAN, type ZAMAWIASZ well above target (e.g. 21 when target 2) → red reason-required pill, submit blocked until a reason is chosen; message shows no "%" and SUGESTIA stays "—".
- Blank stock + order roughly at target → no reason required, submittable.
- A row with stock entered behaves exactly as before (deviation %, colors).

---

## Phase 3: Bug C — hide manager-vs-captain summary pre-claim

### Overview

Stop showing the "Bez zmian vs kapitan" summary strip on orders the manager hasn't claimed; show it only once the manager is engaged.

### Changes Required:

#### 1. Status-gate the summary strip

**File**: `frontend/src/pages/manager/OrderDetailPane.tsx` (`:163-168`), helper in `frontend/src/pages/manager/lib/managerLine.ts`

**Intent**: Render the manager-vs-captain summary block only when the manager has engaged the order; hide it entirely for `captain_submitted`.

**Contract**: Add `isManagerEngaged(status: OrderStatus): boolean` to `managerLine.ts` returning `status === "manager_claimed" || status === "manager_sent" || status === "closed"`. In `OrderDetailPane`, wrap the `summary.changeCount > 0 ? … : managerSummaryNone` block so it renders only when `isManagerEngaged(detail.status)` (equivalently `editable || dispatched`); otherwise render nothing. No change to `managerSummary`/`lineVisualState` internals or the `dispatched` cancelled logic.

#### 2. Unit test the predicate

**File**: `frontend/src/pages/manager/lib/managerLine.test.ts` (extend)

**Intent**: Lock that the summary is gated by status.

**Contract**: `isManagerEngaged` — `captain_submitted` → false; `manager_claimed` / `manager_sent` / `closed` → true.

### Success Criteria:

#### Automated Verification:

- Build passes: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`
- Unit tests pass: `cd frontend && npm run test`

#### Manual Verification:

- Manager screen, open a `captain_submitted` (unclaimed) order → no "Bez zmian vs kapitan" strip.
- After "Przejmij" (manager_claimed) → the summary strip appears; with edits it shows the changed count, otherwise the neutral copy.
- A `manager_sent` order still shows the summary as before.

---

## Testing Strategy

### Unit Tests:

- `buildPayloadLines.test.ts` (new) — inclusion rule + blank-stock coercion (Bug B).
- `compute.test.ts` (extend) — blank-stock reason gating + no-% message + grey-only-on-blank-order (Bug A).
- `managerLine.test.ts` (extend) — `isManagerEngaged` status predicate (Bug C).

### Manual Testing Steps:

1. Captain new order: ZAMAWIASZ filled, stock blank → submits (Bug B); large order with blank stock → reason-required, no "%" (Bug A).
2. Captain edit order: same blank-stock submit works (Bug B, edit path).
3. Manager: unclaimed order shows no summary strip; claimed/sent does (Bug C).

## Performance Considerations

None — pure client-side display/assembly changes; no added network or compute of note.

## Migration Notes

None — no schema, data, or API-contract change. Each phase is revertible by reverting its commit.

## References

- Change notes: `context/changes/order-screen-ux-fixes/change.md`
- Sibling precedent: `context/archive/2026-06-16-manager-queue-ux/` (status-aware visual + Vitest pattern)
- Bug B: `frontend/src/pages/captain-mp/CaptainMP.tsx:347-358`, `OrderEditPage.tsx:151-168`
- Bug A: `frontend/src/pages/captain-mp/lib/compute.ts:65-148`, `components/ProductCard.tsx:213`
- Bug C: `frontend/src/pages/manager/OrderDetailPane.tsx:163-168`, `lib/managerLine.ts`, `i18n/strings.ts:363`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Bug B — current stock optional (submit + edit)

#### Automated

- [ ] 1.1 Build passes: `cd frontend && npm run build`
- [ ] 1.2 Lint passes: `cd frontend && npm run lint`
- [ ] 1.3 Unit tests pass: `cd frontend && npm run test`

#### Manual

- [ ] 1.4 New order: ZAMAWIASZ filled, OBECNY STAN blank → submits (no 0-lines 422)
- [ ] 1.5 Edit order (OrderEditPage): same blank-stock submit works
- [ ] 1.6 Row with blank/0 order qty is not sent as a line

### Phase 2: Bug A — over-order alert when stock is blank

#### Automated

- [ ] 2.1 Build passes: `cd frontend && npm run build`
- [ ] 2.2 Lint passes: `cd frontend && npm run lint`
- [ ] 2.3 Unit tests pass: `cd frontend && npm run test`

#### Manual

- [ ] 2.4 Blank stock + order ≫ target → red reason-required, submit blocked until reason; no "%", SUGESTIA "—"
- [ ] 2.5 Blank stock + order ≈ target → no reason required, submittable
- [ ] 2.6 Row with stock entered behaves exactly as before

### Phase 3: Bug C — hide manager-vs-captain summary pre-claim

#### Automated

- [ ] 3.1 Build passes: `cd frontend && npm run build`
- [ ] 3.2 Lint passes: `cd frontend && npm run lint`
- [ ] 3.3 Unit tests pass: `cd frontend && npm run test`

#### Manual

- [ ] 3.4 Unclaimed (captain_submitted) order → no "Bez zmian vs kapitan" strip
- [ ] 3.5 After Przejmij (manager_claimed) → summary strip appears (changed count or neutral)
- [ ] 3.6 manager_sent order still shows the summary as before
