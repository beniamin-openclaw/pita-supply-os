# Frame Brief: Delivery calendar (proposed delivery date, 17:00 deadline, Thursday prompt)

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Captains start a supplier order without the app knowing when that supplier can actually
deliver to their location. Marek (operations manager) has now stated the ordering rules per
supplier and per location (28.09): a 17:00 Captain deadline everywhere, fixed weekly windows
for Pago / Mory, next-day for Bukat / Intermlecz, lead times for Coca-Cola and Blue Service.
On Thursdays Captains also need a reminder to order stock for 3 days.

## Initial Framing (preserved)

- **User's stated cause or approach**: the order screen's delivery date is a "tomorrow"
  fallback (`frontend/src/pages/captain-mp/lib/dates.ts` `getRequestedDeliveryDate`) and the
  supplier master data (`suppliers.delivery_days` / `cutoff_time`) is mostly `TBD`, so the
  app cannot propose the right date.
- **User's proposed direction**: (1) a soft default delivery date from supplier rules with
  per-location overrides and the 17:00 Warsaw deadline, persisted as
  `suggested_delivery_date` next to `requested_delivery_date`, with a subtle Manager marker
  only when they differ, styled like the existing over-max marker; (2) a Thursday
  "na 1 dzień / na 3 dni" prompt for a data-driven supplier scope, stored as
  `coverage_days`, informational only; (3) show the 17:00 deadline where the cutoff is shown.
- **Pre-dispatch narrowing**: not asked interactively. The operator's brief already fixes
  the decisions (soft default, nothing blocks, informational prompt, scope as data, seed
  only known rules, Pago sending untouched). Open points are collected for the plan STOP.

## Dimension Map

1. **Captain input surface** — the framing assumes the Captain sees a date and can change it.
2. **Location context** — per-location overrides assume the order screen knows the location.
3. **Deadline semantics** — "the cutoff shown today" vs. the new 17:00 Captain deadline.
4. **Manager marker vocabulary** — "styled like the existing over-max marker".
5. **Existing data meaning** — what `requested_delivery_date` means on today's orders, and
   who else reads it (e-mail builders, PR #30).

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. The Captain already picks the date; only the default is wrong | No date state, input or draft field exists. The date is computed once at submit: `CaptainMP.tsx:516-519` → `getRequestedDeliveryDate(supplier.delivery_days)`. `DraftState` has no date (`captain-mp/types.ts:32-37`). `ConfirmSubmitDialog` shows no date. `OrderEditPage.tsx:207` echoes the stored value; no edit UI. | **NONE** — framing gap: "the Captain can freely pick any other date" requires a NEW visible date control, not just a better default |
| 2. The order screen can compute per-location proposals | The Captain screen does not know its location (`CaptainMP.tsx:5-7`, `Header locationName=""` at `:685`); the backend derives it from the token (`require_captain`). | **STRONG** that the proposal must be computed server-side |
| 3. "Where the cutoff is shown today" means the supplier cutoff | The Captain strip shows `supplier.cutoff_time` as "Wyślij do dziś {time}" with local-time urgency (`ContextStrip.tsx:17-47`, `dates.ts:52-69`). The Manager queue/detail cutoff (`cutoff_iso`, `main.py:827-850`, `:955`) is a separate supplier-side value. | **STRONG** — two different deadlines; only the Captain strip switches to 17:00 |
| 4. An over-max marker exists on the Manager order screens | None in `ManagerQueue.tsx`, `OrderDetailPane.tsx`, `OrderLineTable.tsx` (also absent on `origin/main`). The Captain over-MAX pill (`ProductCard.tsx:395-402`) is loud. The subtle Manager over-max flag is the inventory "Uwaga" column: amber-700 text + `AlertTriangle size=12`, no background (`ManagerInventoryPage.tsx:302-325`, key `manager.inventory.attention.overMax`). | **WEAK** as stated — the style to mirror is the inventory "Uwaga" flag |
| 5. Today's `requested_delivery_date` is trustworthy data | For `TBD` suppliers it is the "tomorrow" fallback from the browser clock, converted with `toISOString()` (UTC shift between 00:00 and 02:00 Warsaw). Both e-mail builders deliberately do NOT use it (`gmail_url.py:143-153`, `emailBody.ts:120-125`). PR #30 (`feat/dynamic-target-wola`, open) will read it via `resolve_delivery_window` (trusted if 1..14 days ahead on a delivery weekday). | **STRONG** — the field is a guess today; the change makes it a real Captain choice, which PR #30 will benefit from |

## Narrowing Signals

- The date is invisible to the Captain today (hypothesis 1). This is the main scope addition.
- Location is only known server-side (hypothesis 2) → a Captain endpoint, not frontend logic.
- `/api/captain/orderable` returns a bare list shared with three Manager/Transport paths
  (`main.py:223-324`, `:2355`, `:4973`); wrapping it breaks callers → a separate endpoint.
- Existing orders have no proposal → the Manager marker must stay silent when
  `suggested_delivery_date` is null.

## Cross-System Convention

Supplier-level behaviour flags are data (`suggestion_alerts_enabled`, migration 0022;
`ordering_method='transport'`, 0021). New master-data tables follow `location_product_usage`
(PR #30, 0018): FKs, CHECKs, RLS, tolerant loaders in all three backends, and a route helper
that degrades to "no data" on any exception. The "warn only on the exception" chip philosophy
is `components/ui/MinimumOrderChip.tsx`. The proposal matches these conventions.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: give the Captain a visible, editable delivery
> date that defaults to a server-computed proposal (supplier rules + location override + 17:00
> Warsaw deadline), and record both the proposal and the choice so the Manager sees deviations.

The initial framing was correct in direction. Four refinements change the plan's scope: a new
date control on the Captain screen (none exists), a server-side proposal endpoint (the screen
has no location), the Captain strip's deadline replaced by the rule's 17:00 order-by moment
(the Manager `cutoff_iso` stays as is), and the Manager marker mirroring the amber inventory
"Uwaga" flag.

## Confidence

**HIGH** — every refinement is backed by file:line evidence; no hypothesis contradicts the
operator's direction.

## What Changes for /10x-plan

Plan a backend delivery-rules table + pure proposal engine + Captain proposal endpoint, a
Captain date control (default = proposal, freely editable) and Thursday coverage prompt, and
Manager display of the deviation marker and coverage. Coordinate with PR #30 (it touches
`WEEKDAY_MAP` / `_parse_weekdays` and the integration `_schema` fixture): keep the new logic in
a new module and avoid moving shared helpers.

## References

- `frontend/src/pages/captain-mp/CaptainMP.tsx:5-7, 516-519, 685, 696-705`
- `frontend/src/pages/captain-mp/lib/dates.ts:17-69`
- `frontend/src/pages/captain-mp/components/ContextStrip.tsx:17-47`
- `frontend/src/pages/manager/ManagerInventoryPage.tsx:302-325`
- `frontend/src/pages/manager/OrderDetailPane.tsx:144-166`, `ManagerQueue.tsx:193-308`
- `supply-os-v1/app/main.py:767-850, 955, 1533-1542`
- `supply-os-v1/app/gmail_url.py:143-153`
- PR #30 branch `feat/dynamic-target-wola` (commit `b581fce`)
