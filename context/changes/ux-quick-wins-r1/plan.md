# UX Quick-Wins Round 1 — Implementation Plan

## Overview

Five owner-requested UX quick-wins for the Pita Supply OS Captain/Manager flows,
shipped as one change in five independent phases. Four are frontend-only; one
(Phase 1) touches backend + frontend in lockstep to keep the deviation-reason
gate at parity.

## Current State Analysis

- **Deviation reason gate = 20%.** Backend `_evaluate_submit_line` gates a reason
  at `delta_pct > 0.20` (`supply-os-v1/app/main.py:425,433`); the badge counter
  is `_DEVIATION_THRESHOLD = 0.20` (`main.py:571`, used at `:716` and `:958` via
  `>= threshold`). Frontend mirrors this at `absDeviation > 20`
  (`frontend/src/pages/captain-mp/lib/compute.ts:130`, where `absDeviation` is a
  whole-number percent). Owner: a −17% deviation should not require a reason;
  minimum should be 25%.
- **Deviation % renders raw when suggestion = 0.** Three sites render a per-line
  deviation %: captain `OrderDetailPage.tsx:293–303`, manager
  `OrderLineTable.tsx:174–182`, and the captain submit/edit pill via
  `compute.ts` (`formatPctSigned` returns `"+∞%"` when `suggestedPurchase === 0`,
  `compute.ts:48–53,66–68`). For bucket SKUs (suggestion 0) this shows a giant/∞
  percentage.
- **Variance reuses the deviation hue.** Variance (received − ordered) renders in
  `text-orange-700`/`text-red-700` at `ReceiptLineCard.tsx:66` and captain
  `OrderDetailPage.tsx:258` — the SAME amber/red palette deviation uses
  (`OrderDetailPage.tsx:295–299`, `OrderLineTable.tsx:176–179`), so the two axes
  collide visually on one screen.
- **Receiving silently pre-fills delivered = ordered.** `ReceiveDeliveryPage.tsx`
  seeds each line's delivered value with the ordered qty (`:63–64`) AND falls
  back to ordered when a line is left blank at submit (`:92`). A captain can
  confirm a delivery without counting anything. The submit button only checks
  `receivedBy` (`:128`).
- **Order history is hard to find.** It exists at `/captain-v2/orders`
  (`OrdersListPage`, `App.tsx:77–84`) and is reachable via the hamburger
  ("Moje zamówienia") and an inline button on the home content area
  (`CaptainMP.tsx:499–507`), but the always-visible `CaptainTabs` bar
  (`CaptainTabs.tsx`) has only "Zamówienia" (→ submit form) and "Remanent" — no
  one-tap path to history from every screen.

## Desired End State

1. A 24% deviation requires no reason and counts as no deviation badge; 26% still
   does. Backend and frontend agree at the new 25% boundary.
2. A line whose suggestion is 0 never shows a giant/∞ percentage anywhere — it
   shows a "brak bazy" / "—" copy instead.
3. Variance and deviation are never the same hue on a single screen.
4. Submitting a receipt requires the captain to have entered or one-tap-confirmed
   each delivered qty; nothing is pre-counted; the post-save lock + photo flow are
   unchanged.
5. A captain can reach order history in one obvious tap from any captain screen.

### Key Discoveries

- `strings.ts` deviation copy uses a runtime `{pct}` interpolation — **no literal
  "20%" exists in any string**, so Phase 1 needs no string edit
  (`strings.ts:122–160`).
- Backend deviation tests all use 100% deviations (order 2× suggestion), so they
  survive the threshold bump unchanged; `test_manager_queue.py:245` seeds
  `delta_pct=0.25` asserting it counts — still true under `>= 0.25`. The boundary
  is therefore **untested between 20% and 25%**; this plan adds regression tests.
- Frontend `formatPctSigned` already special-cases `Infinity → "+∞%"`
  (`compute.ts:66–68`) — that branch is exactly where the no-baseline copy slots
  in.
- `ReceiptLineCard` already receives `ordered` as a prop (`:12`) and renders it
  (`:41–45`), and its variance badge already treats `delivered === ""` as "0/not
  shown" (`:28–29`) — so a "= zamówione" shortcut and blank-until-entered need no
  new data plumbing.
- The variance/deviation render sites use a `> 0 ? amber : red` ternary; `blue-700`
  is already taken by the manager Δ column (`OrderLineTable.tsx`), so variance
  should use a family clear of amber/orange/red/blue — **sky (positive) / indigo
  (negative)**.

## What We're NOT Doing

- NOT changing backend deviation MATH or `delta_vs_suggestion_pct` storage
  (Phase 2 is display-only).
- NOT touching `ManagerSuggestionReviewPage.tsx` heat-band colours
  (`pct >= 0.2 / 0.1`, `:18–19`) — separate analytics scale, explicitly out of
  scope.
- NOT changing the receipt-save, post-save lock, or WZ photo-upload/retry flow
  (`ReceiveDeliveryPage.tsx:87–105,127,193,208`).
- NOT adding a new receipts-list route — receipts remain embedded in the order
  detail page; the history tab reaches them transitively.
- NOT removing the existing hamburger / inline history affordances (redundant
  discoverability is harmless; minimizes churn).

## Implementation Approach

Five sequential phases, each its own commit. Phase 1 changes backend + frontend
together and re-runs both test suites to prove parity. Phases 2–5 are
frontend-only. Each phase ends green on the project verify commands before the
next begins.

## Phase 1: Deviation threshold 20% → 25%

### Overview

Move the reason-required deviation gate and the deviation-badge counter from 0.20
to 0.25 in backend and frontend together, update the now-stale ">20%" prose, and
add boundary regression tests that pin the new threshold.

### Changes Required

#### 1. Backend gate + constant

**File**: `supply-os-v1/app/main.py`

**Intent**: Raise the deviation reason gate and badge threshold to 25% so a
sub-25% deviation needs no reason and isn't badged.

**Contract**: `_DEVIATION_THRESHOLD = 0.20` → `0.25` (`:571`); both
`if delta_pct > 0.20` → `> 0.25` (`:425`, `:433`). Update ">20%" prose in the
`_evaluate_submit_line` docstring (`:361`), `captain_submit` docstring (`:477`),
and `captain_order_edit` docstring (`:1052`) to ">25%". The badge call-sites
(`:716`, `:958`) use the constant via `>= threshold` and need no edit.

#### 2. Backend boundary regression test

**File**: `supply-os-v1/tests/test_manager_queue.py` (and/or `test_captain_submit.py`)

**Intent**: Lock the new boundary so a future silent revert is caught — the
existing tests only exercise 100% deviations.

**Contract**: Add a case asserting `delta_pct=0.22` is NOT counted in
`deviation_count` (was counted at the old 0.20). Update the ">20%" wording/test
names in `test_captain_submit.py:2–6,53,198,202,221` and
`test_captain_orders.py:383–384` to 25% for accuracy (behaviour unchanged — those
use 100% deviations).

#### 3. Frontend gate (lockstep)

**File**: `frontend/src/pages/captain-mp/lib/compute.ts`

**Intent**: Mirror the backend at 25% so the captain UI and server agree on when a
reason is required.

**Contract**: `if (absDeviation > 20)` → `> 25` (`:130`). Update the ">20%"/"≤20%"
comments at `:44,121,134,150` to 25%.

#### 4. Frontend boundary regression test

**File**: `frontend/src/pages/captain-mp/lib/compute.test.ts`

**Intent**: Pin the frontend boundary at the new threshold.

**Contract**: Add a case at `absDeviation = 22` asserting `state="yellow"` and
`requiresReason=false`. Update the `"≤20%"` describe strings (`:169,202`) to
`"≤25%"`. (The existing `-20%` boundary test at `:202–213` still passes — −20% is
still ≤ 25%.)

### Success Criteria

#### Automated Verification

- Backend tests pass: `cd supply-os-v1 && python3 -m pytest`
- Frontend tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test`
- Frontend build + lint pass: `PATH=/opt/homebrew/bin:$PATH npm run build && PATH=/opt/homebrew/bin:$PATH npm run lint`
- A grep for `0.20` / `> 20` in the deviation paths returns no stragglers.

#### Manual Verification

- In the captain submit flow, a line at 24% deviation shows no "reason required"
  pill; at 26% it does.
- The manager queue deviation badge does not count a 24% line and does count a 26%
  line.

---

## Phase 2: No-baseline deviation copy (suggestion = 0)

### Overview

Display-only guard: when a line's `suggested_qty_purchase === 0`, show a "brak
bazy" / "—" copy instead of a large or ∞ percentage, at every site that renders a
per-line deviation %.

### Changes Required

#### 1. No-baseline i18n keys (inline guards, not a shared formatter)

**File**: `frontend/src/i18n/strings.ts` (+ inline guards at the render sites below)

**Intent**: Render a "no baseline" copy when the suggestion is 0, consistently
across the three deviation-% sites.

**Contract**: New i18n keys — `deviation.noBaseline` `{ pl: "brak bazy", en: "no
baseline" }` for the two bare-% cells, plus `state.noBaselineReason` /
`state.noBaselineNoReason` for the captain submit pill (so it carries no `{pct}`).
Each render site applies an inline `suggested_qty_purchase === 0` guard rather than a
shared `formatDeviationPct` helper — the plan-review (F1) found the inline guard
simpler and lower-risk than abstracting a one-line `=== 0` check across sites that
format the percentage differently (captain inline `Math.round(*100)` vs manager
`formatPct`).

#### 2. Captain order-detail render site

**File**: `frontend/src/pages/captain-mp/OrderDetailPage.tsx`

**Intent**: Replace the inline `Math.round(delta*100)%` with the guarded label.

**Contract**: At `:293–303`, when `line.suggested_qty_purchase === 0` render the
`deviation.noBaseline` copy instead of the percentage.

#### 3. Manager line-table render site

**File**: `frontend/src/pages/manager/OrderLineTable.tsx`

**Intent**: Same guard in the manager Δ-vs-suggestion column.

**Contract**: At `:174–182`, route the `formatPct(line.delta_vs_suggestion_pct)`
render through the suggestion-zero guard.

#### 4. Captain submit/edit pill

**File**: `frontend/src/pages/captain-mp/lib/compute.ts` (+ a `strings.ts` message
variant)

**Intent**: Stop the pill showing "+∞%" when suggestion is 0; keep the
reason-required STATE (it matches the backend gate) but show no-baseline wording.

**Contract**: In the `formatPctSigned` Infinity branch (`:66–68`) / the
`computeRowState` message assembly, when `suggestedPurchase === 0` emit a
no-baseline message (e.g. `state.devNoBaselineReason` =
`{ pl: "brak bazy sugestii — wymagany powód", en: "no suggestion baseline — reason
required" }`) rather than interpolating "+∞%" into the "{pct} odchylenia" frame.
Do not change which state (yellow/red/requiresReason) is chosen.

### Success Criteria

#### Automated Verification

- Frontend tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test` (add a
  `compute.test.ts` case: `suggestedPurchase = 0` → message is the no-baseline
  copy, never contains "∞" or a large number).
- Build + lint pass.

#### Manual Verification

- A bucket SKU (suggestion 0) on the captain order/submit screen and the manager
  line table shows "brak bazy" / "no baseline", never "+∞%" or "+999%".

---

## Phase 3: Variance colour ≠ deviation colour

### Overview

Give variance (received − ordered) its own hue family (sky/indigo), clear of the
amber/red deviation palette and the blue manager-Δ column.

### Changes Required

#### 1. Receiving line card

**File**: `frontend/src/pages/captain-mp/components/ReceiptLineCard.tsx`

**Intent**: Recolour the variance badge so it no longer matches deviation.

**Contract**: At `:66`, `variance > 0 ? "text-orange-700" : "text-red-700"` →
`variance > 0 ? "text-sky-700" : "text-indigo-700"`.

#### 2. Order-detail receipt variance

**File**: `frontend/src/pages/captain-mp/OrderDetailPage.tsx`

**Intent**: Same recolour on the post-delivery variance line so deviation
(amber/red, `:295–299`) and variance never share a hue on this screen.

**Contract**: At `:258`, apply the same sky/indigo ternary as the card.

### Success Criteria

#### Automated Verification

- Build + lint pass (`PATH=/opt/homebrew/bin:$PATH npm run build && … lint`).

#### Manual Verification

- On the receiving screen and the order-detail screen, variance renders sky/indigo
  while deviation stays amber/red — the two are visually distinct.

---

## Phase 4: Recount gate at receiving (no silent pre-fill)

### Overview

Stop seeding delivered = ordered. Each line starts blank; the captain enters a
value or taps a "= zamówione" shortcut. Submit is blocked until every line has a
conscious value. Post-save lock + photo flow untouched.

### Changes Required

#### 1. Stop the pre-fill + remove the silent submit fallback

**File**: `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx`

**Intent**: Make delivered values blank until the captain acts, and never
substitute the ordered qty for a blank line.

**Contract**: At `:63–64`, seed each line as `""` instead of
`effectiveOrderedQtyPurchase(l)`. At `:92`, drop the
`v === "" ? effectiveOrderedQtyPurchase(l) : v` fallback so the payload sends only
what the captain entered. At `:128`, extend `submitDisabled` to also block while
any line is still `""`/undefined, with a hint via a new i18n key
`delivery.allLinesRequired`. Do NOT touch `:87–105,127,193,208` (save + photo +
lock).

#### 2. "= zamówione" shortcut + placeholder

**File**: `frontend/src/pages/captain-mp/components/ReceiptLineCard.tsx` and
`frontend/src/i18n/strings.ts`

**Intent**: One tap to confirm "delivered equals ordered" without re-typing, and a
clear empty-state placeholder.

**Contract**: Add a small button calling `onChange(line.order_line_id, ordered)`
(`ordered` already in props, `:12`); copy key `delivery.useOrderedQty`
`{ pl: "= zamówione", en: "= ordered" }`. Add `placeholder` to the `DecimalInput`
(`:51–60`) via `delivery.deliveredPlaceholder` `{ pl: "Wpisz ilość", en: "Enter
qty" }`. Hide the shortcut when `readOnly`.

### Success Criteria

#### Automated Verification

- Build + lint + test pass (`PATH=/opt/homebrew/bin:$PATH npm run build && … lint && … test`).

#### Manual Verification

- Opening a delivery shows all delivered fields blank.
- Submit is disabled until every line is entered or "= zamówione"-tapped.
- Tapping "= zamówione" fills that line with the ordered qty; the captain can still
  override it.
- After save, qty inputs lock and the photo flow still works.

---

## Phase 5: Order-history navigation visible

### Overview

Add a persistent "Historia" tab to the always-visible `CaptainTabs` bar pointing at
`/captain-v2/orders`, so history is one tap from any captain screen.

### Changes Required

#### 1. Add the history tab

**File**: `frontend/src/pages/captain-mp/components/CaptainTabs.tsx`

**Intent**: Promote order history into the permanent tab bar (today it routes only
"Zamówienia" → submit form and "Remanent").

**Contract**: Add a third `<Link to="/captain-v2/orders">` tab using the existing
tab styling (active/inactive classes, `:24–27`), labelled by a new i18n key
`tabs.history` `{ pl: "Historia", en: "History" }`, with `aria-current` driven by
the `/captain-v2/orders` path. Pick an icon consistent with the existing two tabs.

### Success Criteria

#### Automated Verification

- Build + lint + test pass.

#### Manual Verification

- From the captain submit screen and the inventory screen, the "Historia" tab is
  visible and one tap opens `/captain-v2/orders`; from there an order opens its
  detail (including the receipt section).

---

## Testing Strategy

### Unit Tests

- `compute.test.ts`: 22% deviation → yellow/no-reason (Phase 1); suggestion 0 →
  no-baseline copy, never "∞"/large (Phase 2).
- `test_manager_queue.py`: `delta_pct=0.22` → not counted (Phase 1).

### Manual Testing Steps

1. Captain submit: enter quantities yielding 24% and 26% deviations; confirm the
   reason pill appears only at 26%.
2. Bucket SKU (suggestion 0): confirm "brak bazy" everywhere, no ∞.
3. Receiving: confirm blank-until-entered, "= zamówione" shortcut, submit gate,
   and that variance is sky/indigo vs amber/red deviation.
4. Tap the new "Historia" tab from two different captain screens.

## Migration Notes

No data or schema changes. No backend persistence changes beyond literal constants.
Backend + frontend deviation gate must ship together (one change) to preserve
parity.

## References

- Change: `context/changes/ux-quick-wins-r1/change.md`
- Threshold map: backend `supply-os-v1/app/main.py:425,433,571`; frontend
  `frontend/src/pages/captain-mp/lib/compute.ts:130`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Deviation threshold 20% → 25%

#### Automated

- [x] 1.1 Backend tests pass (`cd supply-os-v1 && python3 -m pytest`) — 40fdf1f
- [x] 1.2 Frontend tests pass (`npm run test`) — 40fdf1f
- [x] 1.3 Frontend build + lint pass — 40fdf1f
- [x] 1.4 No `0.20` / `> 20` stragglers in deviation paths — 40fdf1f

#### Manual

- [x] 1.5 24% needs no reason, 26% does (captain submit) — 40fdf1f
- [x] 1.6 Queue badge skips 24%, counts 26% — 40fdf1f

### Phase 2: No-baseline deviation copy

#### Automated

- [x] 2.1 Frontend tests pass (incl. new suggestion-0 case)
- [x] 2.2 Build + lint pass

#### Manual

- [x] 2.3 Suggestion-0 line shows "brak bazy", never ∞/large %

### Phase 3: Variance colour ≠ deviation colour

#### Automated

- [x] 3.1 Build + lint pass

#### Manual

- [x] 3.2 Variance sky/indigo vs deviation amber/red on one screen

### Phase 4: Recount gate at receiving

#### Automated

- [x] 4.1 Build + lint + test pass

#### Manual

- [x] 4.2 Delivered fields blank on open
- [x] 4.3 Submit blocked until every line entered/confirmed
- [x] 4.4 "= zamówione" fills + overridable; post-save lock + photos intact

### Phase 5: Order-history navigation visible

#### Automated

- [x] 5.1 Build + lint + test pass

#### Manual

- [x] 5.2 "Historia" tab visible + one-tap to history from two captain screens
