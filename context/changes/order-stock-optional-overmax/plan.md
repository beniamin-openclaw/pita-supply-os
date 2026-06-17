# Current stock optional — over-MAX is the only reason gate when stock is uncounted

## Overview

Corrects [[order-screen-ux-fixes]] Bug A. That fix coerced a blank current-stock to `0`, which makes `suggested = target`, so the symmetric ±20% deviation gate fired on essentially **every** blank-stock order — wrongly demanding a `reason_code` that only makes sense for explaining over/under vs a real suggestion. Owner decision (2026-06-17): **option B** — when stock is not counted, skip the deviation/critical reason gate and force a reason **only when the order exceeds MAX** (the storage ceiling, the one genuinely stock-independent concern).

Two-sided change (frontend + backend) because both run the reason gate and must agree, but **deliberately scoped to avoid a DB migration**: the "uncounted" signal lives only in the request payload (`current_stock_qty_base: null`); the gate branches on it, and storage coerces `null → 0` (the Postgres column stays `NOT NULL DEFAULT 0`). Grounded 2026-06-17 to exact lines.

## Current State Analysis

- **Request model.** `OrderLineSubmit.current_stock_qty_base` (`supply-os-v1/app/main.py:196` SuggestRequest is separate; the submit line model is `app/models.py` `OrderLineSubmit.current_stock_qty_base: float = Field(ge=0)`). Required, non-nullable → a Captain who doesn't count cannot signal "uncounted"; the frontend sends `0`.
- **Backend gate (submit).** `app/main.py` `captain_submit` computes `suggestion` from `line.current_stock_qty_base`, then: critical-under gate (`is_critical and final < suggested and reason is None → 400`) and deviation gate (`abs(final − suggested)/max(suggested, step) > 0.20 and reason is None → 400`). With stock `0`, `suggested = target`, so any normal/under order trips the deviation gate. **`captain_order_edit` has the identical block.**
- **Stored model.** `app/models.py` `OrderLine.current_stock_qty_base: float = 0`; Postgres `order_lines.current_stock_qty_base numeric(12,4) NOT NULL DEFAULT 0` (`migrations/0001_initial_schema.sql`). `delta_vs_suggestion_pct numeric(8,6)` is **nullable**.
- **Frontend payload.** `buildPayloadLines` (`frontend/src/pages/captain-mp/lib/buildPayloadLines.ts`) maps blank stock → `0`. `OrderLineSubmit.current_stock_qty_base: number` (`frontend/src/types.ts:81`).
- **Frontend gate.** `compute.ts` `computeRowState` (Bug A version): blank stock → `current = 0`, runs the deviation + critical gates with no-`%` message keys (`state.devNoReasonNoStock` / `state.devReasonNoStock` / `state.smallAdjNoStock`). `OrderableItem` carries `max_stock_qty_base`, `target_stock_qty_base`, `allow_over_max_due_to_packaging`, `units_per_purchase_unit` (`frontend/src/types.ts:60-74`).
- **Edit screen.** `OrderEditPage.lineToItem` hardcodes `max_stock_qty_base: 0, allow_over_max_due_to_packaging: true`; `lineToFormState` shows the persisted stock (always a number after coercion). Because a persisted line always has a numeric stock, the edit screen never hits the blank-stock branch unless the Captain clears the field — so it needs no max-plumbing for this change.

### Key Discoveries

- The "uncounted vs counted-zero" distinction is **only needed at validation time**. Persisting `0` for uncounted keeps the `NOT NULL` column happy and avoids a prod DB migration. The only cost is the edit round-trip showing `0` for a once-blank line (pre-existing F2 behavior from order-screen-ux-fixes; not a regression).
- Over-MAX threshold is identical on both sides: `captain_final_qty_purchase * units_per_purchase_unit > max_stock_qty_base`, gated on `max > 0 && !allow_over_max_due_to_packaging`. Backend reads `setting.*`; frontend reads `item.*`.
- `suggestion.py` is untouched — we coerce `None → 0` before `compute_suggestion`, so its `current_stock_qty_base: float` contract holds.
- `delta_vs_suggestion_pct` is stored `None` for uncounted lines, so the manager-queue / captain-orders `deviation_count` (counts `abs(delta or 0) >= 0.20`) does not inflate, and `/api/manager/suggestion-review` ignores them (already averages only lines that carry a delta).

## Desired End State

- A Captain orders without counting stock → the line submits with **no reason required** unless the order exceeds MAX. The row shows a neutral "Zamówienie bez stanu" pill; SUGESTIA stays "—".
- A Captain orders **over MAX** without counting → red "Powyżej MAX — wymagany powód", submit blocked until a reason is chosen (orange once a reason is set). Frontend and backend agree (no 400 surprise).
- A Captain who **does** count stock → behavior byte-identical to today (deviation + critical gates unchanged).
- No DB migration; the `order_lines` schema is unchanged.

## What We're NOT Doing

- **No DB / schema migration.** `order_lines.current_stock_qty_base` stays `NOT NULL DEFAULT 0`; uncounted persists as `0`. Only the request models become nullable.
- **No over-MAX gate on the counted path.** When stock is entered, the existing deviation gate already catches gross over-orders; we do not add a second ceiling check there.
- **No edit-screen max-plumbing / detail-model change.** `ManagerOrderLineDetail` / `CaptainOrderDetail` are untouched; the edit screen keeps its current behavior (a persisted line has a numeric stock → counted path).
- **No change to `InventoryCountPage`**, the SUGESTIA "—" display, the manager summary, or anything from `manager-queue-ux`.
- **No backend error-message localization** — still the separate Parked item.

## Phase 1: Backend — nullable request stock + over-MAX-only gate

### Overview

Make `current_stock_qty_base` optional on the submit/edit request; when omitted (`None`), skip the deviation + critical gates and force a reason only on an over-MAX order. Persist `None → 0`, `delta → None`.

### Changes Required

#### 1. Request model nullable

**File**: `supply-os-v1/app/models.py` (`OrderLineSubmit`)

**Contract**: `current_stock_qty_base: Optional[float] = Field(default=None, ge=0)`. `None` = "not counted". `CaptainSubmitRequest` / `CaptainEditRequest` reuse `OrderLineSubmit`, so both paths inherit it. `OrderLine` (stored) is unchanged (`float = 0`).

#### 2. Shared gate helper + wire into submit & edit

**File**: `supply-os-v1/app/main.py` (`captain_submit` ~`:330-430`, `captain_order_edit` ~`:660-770`)

**Intent**: One place defines the uncounted-vs-counted branch so submit and edit cannot drift.

**Contract**: For each line, `stock = line.current_stock_qty_base`; `current_for_math = stock if stock is not None else 0.0`; compute `suggestion` from `current_for_math` (suggested_qty_base/purchase stored as today).
- **`stock is None` (uncounted)**: skip the critical-under and deviation gates. Compute `order_base = line.captain_final_qty_purchase * sp.units_per_purchase_unit`; `over_max = setting.max_stock_qty_base > 0 and not setting.allow_over_max_due_to_packaging and order_base > setting.max_stock_qty_base`. If `over_max and reason_code is None → 400` ("ordered over MAX without reason_code"); if `over_max and reason_code is not None →` append a warning. Persist the `OrderLine` with `current_stock_qty_base=0.0`, `delta_vs_suggestion_pct=None`.
- **`stock is not None` (counted)**: existing critical + deviation gates and `delta_pct` computation, byte-identical. Persist `current_stock_qty_base=stock`.

Factor the per-line evaluation into a module-level pure helper (e.g. `_evaluate_submit_line(line, sp, setting, product) -> (OrderLine, warning|None)` raising `HTTPException` on a hard gate) and call it from both endpoints, so the two loops converge. Keep `order_line_id` generation in the caller (it differs by index/order_id).

#### 3. Backend tests

**File**: `supply-os-v1/tests/test_captain_submit.py` (+ edit cases where that suite covers edit, else `test_captain_orders.py`)

**Contract**: New cases — (a) uncounted (`current_stock_qty_base` omitted/None) + normal order ≤ MAX, no reason → **201/200, no 400**, persisted line has `current_stock_qty_base == 0` and `delta_vs_suggestion_pct is None`; (b) uncounted + over-MAX, no reason → **400**; (c) uncounted + over-MAX + reason → OK with warning; (d) counted (stock given) path unchanged — keep/ချreuse existing deviation + critical assertions; (e) edit endpoint mirrors (a)+(b). Follow the existing `test_captain_submit.py` fixture/style.

### Success Criteria

#### Automated

- [ ] 1.1 `cd supply-os-v1 && /opt/homebrew/bin/python3 -m ruff check .`
- [ ] 1.2 `cd supply-os-v1 && /opt/homebrew/bin/python3 -m pytest -q`

#### Manual

- [ ] 1.3 (covered by 2.x end-to-end after frontend lands)

## Phase 2: Frontend — send null + over-MAX-only gate

### Overview

Send `null` for blank stock and mirror the backend gate in `computeRowState`: blank stock → over-MAX-only, otherwise a neutral no-reason state.

### Changes Required

#### 1. Payload sends null

**File**: `frontend/src/types.ts` (`OrderLineSubmit`), `frontend/src/pages/captain-mp/lib/buildPayloadLines.ts`

**Contract**: `OrderLineSubmit.current_stock_qty_base: number | null`. In `buildPayloadLines`, included row → `current_stock_qty_base: l.current_stock_qty_base === "" ? null : Number(l.current_stock_qty_base)` (was `=== "" ? 0`). Inclusion rule (qty entered AND `> 0`) unchanged.

#### 2. Over-MAX gate in computeRowState

**File**: `frontend/src/pages/captain-mp/lib/compute.ts`

**Contract**: Keep the grey short-circuit on blank ORDER qty. Add a `stockBlank` branch that RETURNS before the counted path: compute `orderBase = final * item.units_per_purchase_unit`; `overMax = item.max_stock_qty_base > 0 && !item.allow_over_max_due_to_packaging && orderBase > item.max_stock_qty_base`. `overMax` → `{ state: hasReason ? "orange" : "red", messageKey: hasReason ? "state.overMaxNoStockReason" : "state.overMaxNoStock", requiresReason: true, deviationPct: null }`; else → `{ state: "yellow", messageKey: "state.smallAdjNoStock", requiresReason: false, deviationPct: null }`. The counted path (stock entered) reverts to its pre-Bug-A shape (no `stockBlank` branching in `reasonResult`/green/yellow).

#### 3. i18n

**File**: `frontend/src/i18n/strings.ts`

**Contract**: Add `state.overMaxNoStock` (pl "Powyżej MAX — wymagany powód" / en "Above MAX — reason required") and `state.overMaxNoStockReason` (pl "Powyżej MAX — powód podany" / en "Above MAX — reason provided"). Keep `state.smallAdjNoStock` ("Zamówienie bez stanu"). **Remove** the now-unused `state.devNoReasonNoStock` and `state.devReasonNoStock` (added by order-screen-ux-fixes, no longer referenced).

#### 4. Tests

**File**: `frontend/src/pages/captain-mp/lib/compute.test.ts`

**Contract**: Rewrite the "blank stock, order entered (Bug A)" block to over-MAX semantics with the default fixture (units=10, max=100, allow_over_max=false): (a) blank + order 11 (base 110 > 100), no reason → red `state.overMaxNoStock`, `requiresReason: true`, `deviationPct: null`; (b) same + reason → orange `state.overMaxNoStockReason`; (c) blank + order 9 (base 90 ≤ 100) → yellow `state.smallAdjNoStock`, `requiresReason: false` (the key win: a normal uncounted order needs no reason); (d) blank ORDER qty → grey (unchanged); (e) counted path cases unchanged.

### Success Criteria

#### Automated

- [ ] 2.1 `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run build`
- [ ] 2.2 `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run lint`
- [ ] 2.3 `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run test`

#### Manual (owner, on deploy)

- [ ] 2.4 `/captain-v2`: blank OBECNY STAN + normal order ≤ MAX → **no reason required**, submits.
- [ ] 2.5 Blank stock + order over MAX → red "Powyżej MAX — wymagany powód", submit blocked until a reason; orange once chosen; submits.
- [ ] 2.6 Stock entered → behaves exactly as before (deviation %, colors).

## Migration Notes

None — no schema/data change. Uncounted persists as `0`; the request models are the only contract change (additive: `null` newly accepted, existing numeric payloads still valid). Revert = revert the two phase commits.

## References

- Corrects: `context/changes/order-screen-ux-fixes/` (Bug A)
- Backend gate: `supply-os-v1/app/main.py` `captain_submit`, `captain_order_edit`; `app/models.py` `OrderLineSubmit`
- Schema: `supply-os-v1/migrations/0001_initial_schema.sql` (`order_lines.current_stock_qty_base NOT NULL DEFAULT 0`)
- Frontend gate: `frontend/src/pages/captain-mp/lib/compute.ts`, `buildPayloadLines.ts`, `frontend/src/types.ts`, `i18n/strings.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Backend — nullable request stock + over-MAX-only gate

#### Automated

- [ ] 1.1 ruff clean
- [ ] 1.2 pytest green (incl. new uncounted + over-MAX cases)

#### Manual

- [ ] 1.3 (end-to-end, covered with Phase 2 on deploy)

### Phase 2: Frontend — send null + over-MAX-only gate

#### Automated

- [ ] 2.1 build passes
- [ ] 2.2 lint passes
- [ ] 2.3 unit tests pass

#### Manual

- [ ] 2.4 blank stock + normal order → no reason required, submits
- [ ] 2.5 blank stock + over-MAX → reason required, then submits
- [ ] 2.6 stock entered → unchanged
