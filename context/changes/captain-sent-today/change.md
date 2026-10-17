---
change_id: captain-sent-today
title: Captain order screen — "sent today" from the database, second-order warning, open-order hint
status: implemented
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Trigger

WP6 + D10 variant A (owner decision 2026-10-17, final). On the Captain order screen the ✓ on a supplier tab lived only in tab memory: a refresh dropped it, and nothing warned before a second order to the same supplier on the same day.

## What changed

Backend (`supply-os-v1/app/models.py`, `supply-os-v1/app/main.py`):
- `GET /api/captain/suppliers` now returns `CaptainSupplier` rows (a response-only subclass of `Supplier`) with two optional fields: `sent_today` and `open_order`, each a `CaptainSupplierOrderRef` (order_id, status, order_date, submitted_on, captain_submitted_at, requested_delivery_date). Additive: same rows, same order, same supplier fields; `GET /api/suppliers` is untouched.
- `sent_today`: the location's newest order with the supplier submitted today (Europe/Warsaw day of `captain_submitted_at`, else `order_date`), any status except cancelled and draft.
- `open_order`: the newest order in captain_submitted / manager_claimed / manager_sent submitted in the 7 days before today. Today's orders are reported only as `sent_today`.
- Only the token's location. Never raises: the seed backend (orders not stored) and any read error give `null` fields, and the tab list still loads. `_order_submit_day` is shared with `_open_orders_elsewhere`, so the product-level hint and the tab state agree on "today".

Frontend:
- The tab ✓ comes from `sent_today` plus this session's own submits (`pages/captain-mp/lib/sentToday.ts`), so it survives a refresh; it also has a screen-reader label "wysłano dziś".
- Amber notice at the top of the order screen: "Dziś już wysłano zamówienie do {dostawca} ({godzina})." The confirm dialog adds "… Wysłać kolejne?" and switches to the amber "Wyślij mimo to". Submitting is never blocked.
- Slate notice: "Masz już otwarte zamówienie u tego dostawcy (z DD.MM, status: …)." Information only. Status labels reuse `orders.status.*`.
- Both notices link to the order ("Zobacz zamówienie").
- After a submit the tab list's order fields are re-read silently and merged by supplier id (the tabs themselves do not change).

## Verification

- Backend: `python -m pytest` 1128 passed (37 integration deselected); `ruff check .` clean. New tests in `supply-os-v1/tests/test_captain_sent_today.py`.
- Frontend: `npm run build` and `npm run lint` clean; `npm run test` 963 passed, 3 failed — the known local-only `localStorage.setItem is not a function` failures under Node 25, also on clean main (CI runs Node 20). New tests: `pages/captain-mp/lib/sentToday.test.ts`, `pages/captain-mp/components/ConfirmSubmitDialog.test.tsx`, `pages/captain-mp/captainSentToday.test.tsx`.
- Integration tests (`pytest -m integration`) not run locally (no Postgres); no data-layer function changed.
- Manual: on prod after deploy (operator checklist in the PR).

## Rollback

Revert the PR. No migration and no stored data: the fields are computed per request.
