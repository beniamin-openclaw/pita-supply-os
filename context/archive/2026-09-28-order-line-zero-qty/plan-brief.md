# Durable Manager zero on order lines — Plan Brief

> Full plan: `context/changes/order-line-zero-qty/plan.md`
> Frame brief: `context/changes/order-line-zero-qty/frame.md`
> Research: `context/changes/order-line-zero-qty/research.md`

## What & Why

Marek (28.09): setting a line to 0 neither removes it nor corrects the value. The
actual problem: a Manager's explicit 0 on a captain-ordered line is not durable —
the data model cannot tell "Manager set 0" from "Manager has not set anything", so
every reader after the save restores the captain quantity. On the single-order
screen, **Zapisz → Wyślij** puts the zeroed line back into the supplier e-mail at
the captain quantity.

## Starting Point

`order_lines.manager_final_qty_purchase` is `NOT NULL DEFAULT 0` and 0 doubles as
"unset". Save reloads the order and reseeds the draft through
`manager_final > 0 ? manager_final : captain_final`; the same rule lives in the
backend e-mail URL, totals, receipts and the Transport aggregate. Prod has no
existing row where a stored 0 means "explicitly zeroed".

## Desired End State

A zero typed by the Manager survives save and reload on the order screen and the
Transport matrix: the row stays visible as "Anulowane przez managera", the total
excludes it, no e-mail or driver document carries it, receiving shows "0 ordered"
and the Captain's detail shows the change. Untouched lines behave exactly as today.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where the fix lives | Data model, not one helper | Storage cannot hold the fact; every reader restores the captain qty | Frame |
| Data model | New `order_lines.manager_final_set boolean NOT NULL DEFAULT false` (migration 0024) | Additive; history columns untouched; no reader signature changes | Plan (research compared nullable and copy-at-claim) |
| Rule | `set = flag OR manager_final > 0`; `effective = set ? manager_final : captain_final` | Every existing row, sheet mode and the deploy window keep today's behaviour | Plan |
| Backfill | Flag true where `manager_final > 0` or the order was dispatched outside Transport | Makes the flag mean the same for old and new rows | Plan (prod data) |
| Zeroed line | Kept as a row, shown as cancelled; not deleted, not hidden from receiving | Learning-loop history; an unexpected delivery can still be recorded | Plan |
| One rule per side | New `app/order_qty.py` mirrors `lib/orderQty.ts`; hand-rolled copies removed | The copies are how the rule drifted | Research |
| Visual state | `lineVisualState` / Captain `managerChangedLine` rebuilt on the helper | Drops the status/transport gates; fixes false "cancelled" on transport-sent rows | Research |
| Migration number | 0024 | Confirmed across lanes (0023 display order, 0025 delivery calendar, 0026 order e-mail v2) | Coordinator |

## Scope

**In scope:** migration 0024 + integration fixture; model/column; save and dispatch
set the flag; all backend and frontend effective-qty readers; API exposure; unit
and integration tests; prod-sql companion; PR.

**Out of scope:** deleting or hiding zeroed lines; live draft total in the header;
learning-loop aggregate; nullable `manager_final`; the legacy Google Sheet column;
Transport finalize flow changes.

## Architecture / Approach

Save/dispatch write `manager_final_set=true` with the quantity → the order detail
API returns the normalized flag → `effectiveOrderedQtyPurchase` (frontend) and
`effective_ordered_qty` (backend) honour it → draft seeding, e-mail builders,
totals, receipts and Transport all follow without further changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema and backend rule | Column, flag writes, one backend helper, API field, tests | Code deployed before the column → captain submit fails |
| 2. Frontend rule | Helper + row state + captain hint, new draftState tests, local E2E on demo Postgres | A missed reader keeps the old rule |
| 3. Rollout (operator-gated) | prod-sql.sql (dry-run locally), PR, stop; prod smoke on a throwaway order | Live check must never click Wyślij |

**Prerequisites:** operator applies 0024 on prod before merge.
**Estimated effort:** one session for phases 1–2; operator steps for phase 3.

## Open Risks & Assumptions

- Marek's screen is unconfirmed (order screen or Transport); both are covered.
- A fully zeroed captain-origin Transport member is released back to the queue
  at finalize (existing empty-column behaviour, newly reachable), not cancelled.
- No Transport draft on prod has a captain-origin member today, so the Transport
  case is proven locally, not on prod.
- The live header total still updates only on Zapisz; if Marek meant the pre-save
  state, a live draft total is a small follow-up.

## Success Criteria (Summary)

- Zero → Zapisz → reload: still 0, cancelled, total down, absent from the e-mail.
- The same on the Transport matrix.
- Untouched orders and already-sent orders look exactly as before.
