# Receiving display — received as headline — Plan Brief

> Full plan: `context/changes/receiving-received-headline/plan.md`
> Research: `context/changes/receiving-received-headline/research.md`

## What & Why

After a delivery is confirmed, the Captain order-detail line shows the *ordered* qty as the big
number with "Dostarczono" tiny beneath — so the owner who received 3 sees a big "2" and reads it as
wrong. Make the **received** qty the headline post-delivery (labeled "Przyjęto"), with ordered +
variance as a labeled secondary; label the pre-delivery headline too. Display-only.

## Starting Point

The order-detail line already fetches the receipt overlay (`receiptLine` with received / ordered
snapshot / variance) from the previous order-qty-display change. The headline is just hardcoded to
the live-derived effective ordered qty, unlabeled, regardless of receipt presence.

## Desired End State

Delivered line: "Przyjęto" + big received (3 szt), then "Zamówiono: 2 szt · Różnica: +1 szt" (from
the receipt snapshot). Undelivered line: "Zamówiono" + ordered qty + the manager-changed hint, as
today. Resolves research inconsistencies 1–4.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Post-delivery headline | Received qty (labeled "Przyjęto") | Owner's expectation: see what arrived | Owner |
| Ordered secondary source | Receipt's `ordered_qty_purchase` snapshot | Internally consistent with the stored variance | Research |
| Pre-delivery headline | Keep ordered, add a "Zamówiono" label | Anchors the number (fixes the unlabeled-headline confusion) | Plan |
| Post-delivery hint/deviation% | Dropped | The order is done; ordered/received is the story | Plan |

## Scope

**In scope:** restructure the per-line right column in `OrderDetailPage.tsx` (branch on `receiptLine`);
3 i18n labels; remove the now-redundant full-width "Dostarczono" sub-line.

**Out of scope:** backend, the receive screen, Manager receipt-visibility, recount gate, variance/
deviation colour overlap, number locale — deferred backlog.

## Architecture / Approach

Pure presentational change in one component, reusing the `receiptLine`/`variance` already computed in
the line map. Frontend build/lint/test gate.

## Phases at a Glance

| Phase | Delivers | Key risk |
| --- | --- | --- |
| 1. Received-as-headline | Delivered line leads with received; labeled ordered + variance beneath | Branch must not break the undelivered/editable line layout |

**Prerequisites:** order-qty-display (the receipt overlay) — already shipped + live.
**Estimated effort:** ~1 short session, 1 phase.

## Open Risks & Assumptions

- Assumes `receiptLine.ordered_qty_purchase` is populated (backend snapshots it at receipt submit).
- Pre-delivery label "Zamówiono" reads slightly forward for a captain_submitted order but is accurate
  enough across statuses.

## Success Criteria (Summary)

- Delivered: received headline ("Przyjęto") + ordered/variance secondary.
- Undelivered: ordered headline ("Zamówiono") + hint, unchanged.
- Build/lint/test green.
