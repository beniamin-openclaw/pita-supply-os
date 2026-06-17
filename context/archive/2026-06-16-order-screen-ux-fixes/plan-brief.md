# Order-Screen UX Fixes — Plan Brief

> Full plan: `context/changes/order-screen-ux-fixes/plan.md`

## What & Why

Three owner-reported, frontend-only UX bugs on the order screens (sibling to the just-shipped `manager-queue-ux`). Together they make ordering without a stock count impossible or unsafe, and show a misleading manager label before the manager engages. Fixing them lets the Captain order with current stock optional while still being guarded against over-orders, and stops a meaningless "no changes vs captain" label from appearing pre-claim.

## Starting Point

On `/captain-v2`, the line-builder (`CaptainMP.tsx:349`, and the same filter in `OrderEditPage.tsx:154`) requires BOTH current stock and order qty, so ordering without counting stock builds 0 lines → backend 422. `computeRowState` (`compute.ts:66`) returns a no-alert grey state whenever stock is blank, so a huge order shows no warning. On the Manager screen, `OrderDetailPane.tsx:163` shows "Bez zmian vs kapitan" for any order with `changeCount === 0`, which is always true for an unclaimed `captain_submitted` order.

## Desired End State

A Captain can submit (and edit) an order with ZAMAWIASZ filled and OBECNY STAN blank. A blank-stock order more than 20% off the target-based level shows a reason-required alert (stock-agnostic message, no orphan "%"; SUGESTIA stays "—") and blocks submit until a reason is given — matching what the backend computes, so no 400 surprise. The manager-vs-captain summary strip is hidden until the manager has claimed the order.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Blank-stock semantics | Treat as UNKNOWN; guard via deviation (stock→0 for the gate) | Owner: absence of a count must not bypass the over-order guard | Plan |
| Bug A alert scope | Reuse existing deviation gate (no new `max` check) | The system has no `max` row-gate; "alert" = >20% deviation from target | Plan |
| Bug A presentation | Keep SUGESTIA "—"; message without "%" | Avoid an orphan "%" next to a "—" suggestion | Plan |
| Bug B line inclusion | Include rows where ZAMAWIASZ > 0; blank stock → 0 | Clean payload, no meaningless 0-qty lines | Plan |
| Backend | No change | Frontend mirrors the backend's stock=0 gate; field stays required-but-0 | Plan |
| Bug C pre-claim view | Hide the summary strip until manager_claimed/sent | Comparison is meaningless before the manager engages | Plan |
| Structure | One change, 3 phases (B → A → C) | Independent, revertible; mirrors `manager-queue-ux` | Plan |
| Testing | Unit-test all 3 (extract `buildPayloadLines`) | Lock each bug at its condition; matches precedent | Plan |

## Scope

**In scope:** Captain new-order + edit line assembly (`CaptainMP`, `OrderEditPage`); `computeRowState` blank-stock gating + new i18n copy; `OrderDetailPane` summary status-gate; 3 unit-test files/extensions.

**Out of scope:** any backend/API change; a new `max` ceiling gate; `InventoryCountPage` (its stock filter is correct); the SUGESTIA "—" display; the editable line visual + `dispatched` cancelled logic; backend validation-message localization (separate Parked item — but Bug B removes the common trigger of the empty-lines 422).

## Architecture / Approach

All three are client-side. Each bug's logic is moved into (or already lives in) a pure function that gets a Vitest test: `buildPayloadLines` (new, shared by both order paths), `computeRowState` (extend), `isManagerEngaged` (new predicate). Bug B fixes two call sites with one helper; Bug A and Bug C each fix one shared spot, automatically covering both order screens / the manager view.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bug B (stock optional) | Order/edit submit without current stock; shared `buildPayloadLines` | Missing the edit-path call site (mitigated: both grounded) |
| 2. Bug A (over-order alert) | Reason gate fires on blank-stock over-orders, no "%" | Frontend/backend gate parity (mitigated: coerce stock→0) |
| 3. Bug C (manager label) | Summary strip hidden pre-claim | Over-hiding for valid states (mitigated: `isManagerEngaged`) |

**Prerequisites:** none — runnable in parallel with S-10 (different layers, no file overlap).
**Estimated effort:** ~1 session, 3 small phases.

## Open Risks & Assumptions

- Blank-stock orders now require a reason for any >20% deviation from target (over OR under), because the backend gate is symmetric and treats coerced stock as 0 — accepted as the no-backend-change behavior.
- Assumes `OrderEditPage` shares the exact line-builder shape (grounded at `:151-168`); the extracted helper must satisfy both call sites.

## Success Criteria (Summary)

- Captain can order/edit with current stock blank; the 0-lines 422 no longer occurs in the normal flow.
- A blank-stock over-order is flagged and reason-gated before submit, with no 400 surprise.
- The manager-vs-captain summary appears only once the manager has claimed the order.
