# Captain "sent today" from the database, second-order warning, open-order hint — Implementation Plan

## Overview

WP6 + D10 variant A (owner decision 2026-10-17, final). The Captain order screen
remembers "sent" suppliers only in tab memory, so the ✓ disappears on refresh and
nothing warns before a second order to the same supplier on the same day. This
change makes the per-supplier state come from the database, adds a non-blocking
second-order warning (screen + confirm dialog), and adds a supplier-level
"you already have an open order with this supplier" hint.

## Current State Analysis

- `frontend/src/pages/captain-mp/CaptainMP.tsx:110` — `sentSuppliers` is a
  `useState<Set<string>>` that only `handleSubmit` fills (`:749`). Nothing reads
  the database; a reload empties it. `:752-757` moves to the next supplier not
  in that set after a submit.
- `frontend/src/pages/captain-mp/components/SupplierPicker.tsx:43,54-66` — the
  set drives the grey tab with a green ✓ (`Check`, `aria-hidden`); a screen
  reader gets no "sent" signal.
- `frontend/src/pages/captain-mp/components/ConfirmSubmitDialog.tsx` — the
  only non-blocking warning today is "critical products with nothing ordered"
  (amber block + "Wyślij mimo to").
- `supply-os-v1/app/main.py:515-541` — `GET /api/captain/suppliers`
  (`response_model=list[Supplier]`), location from the captain token, the tab
  list the screen loads once (`CaptainMP.tsx:183-207` through
  `lib/orderingSuppliers.ts:33` `loadCaptainSuppliers`, which falls back to the
  global `/api/suppliers` on a non-401 error).
- `supply-os-v1/app/main.py:389-477` — `_OPEN_ORDER_STATUSES`
  (captain_submitted / manager_claimed / manager_sent), `_OPEN_ORDER_WINDOW_DAYS = 7`
  and `_open_orders_elsewhere`: per PRODUCT, other suppliers only; submit day =
  `captain_submitted_at` in Europe/Warsaw, else `order_date`; never raises
  (non-persistent backend / any error → `{}`).
- `supply-os-v1/app/main.py:707-716` — `_is_persistent` (seed backend =
  `SUPPORTS_PERSISTENCE = False`, orders not stored).
- `supply-os-v1/app/main.py:1033,1088-1096` — `captain_submit` stores
  `order_date` as the UTC date and `captain_submitted_at` as UTC now, so the
  Warsaw day must come from the timestamp (00:00–02:00 Warsaw is the previous
  UTC date).
- `supply-os-v1/app/main.py:5975-5985` — Transport add-location creates a
  `manager_claimed` order with `captain_submitted_at = now` for a location; it
  counts as that location's order (see Open questions below).
- `supply-os-v1/app/supabase_backend.py:365` — `load_orders()` is a full
  `SELECT * FROM orders` (no lines), already paid by `GET /api/captain/orders`
  and by `captain_orderable` for multi-supplier products.
- `frontend/src/i18n/strings.ts:808-813` — `orders.status.*` labels reused for
  the hint; `frontend/src/i18n/index.ts` `formatDateTime` formats in
  Europe/Warsaw; `frontend/src/lib/dates.ts` has `warsawTodayIso` and
  `formatDayMonth`.

## Desired End State

- `GET /api/captain/suppliers` rows carry two optional fields per supplier:
  `sent_today` (the newest order of this location with this supplier submitted
  today in Warsaw, any status except cancelled/draft) and `open_order` (the
  newest open order submitted in the 7 days before today). Both `null` when
  there is nothing to report, on the seed backend, or when the order read fails.
- The Captain tab ✓ comes from `sent_today` (plus this session's own submits),
  so it survives a refresh. The ✓ carries a screen-reader label.
- With a supplier that has `sent_today`, the screen shows an amber notice
  "Dziś już wysłano zamówienie do {dostawca} ({godzina})." and the confirm
  dialog adds "… Wysłać kolejne?" with the amber "Wyślij mimo to" button. The
  Captain can always submit.
- With a supplier that has `open_order`, the screen shows "Masz już otwarte
  zamówienie u tego dostawcy (z DD.MM, status: …)." Information only.
- Both notices link to the order detail ("Zobacz zamówienie"), so a Captain can
  edit a still-editable earlier order instead of sending a duplicate.

### Key Discoveries:

- Extending the existing tab-list response avoids a new round-trip: the screen
  already loads it once on mount (`CaptainMP.tsx:188`).
- The orderable endpoint returns a bare list of product dicts
  (`main.py:487-512`, no response model), so it cannot carry supplier-level data
  without a shape break.
- `Supplier` is a master-data model bound to `_SUPPLIER_COLUMNS` on insert;
  the new fields go on a response-only subclass, never on `Supplier`.

## What We're NOT Doing

- No migration, no new backend data-layer function (reuses `load_orders()`).
- No blocking: submit is never refused for a second order.
- No change to `_open_orders_elsewhere` semantics (product-level hint stays).
- No change to the default tab (Bukat pilot) on load.
- No Manager-side change.

## Implementation Approach

### Backend (`supply-os-v1/app/models.py`, `supply-os-v1/app/main.py`)

- `CaptainSupplierOrderRef` (order_id, status, order_date, `submitted_on` = the
  Warsaw day used for the decision, optional `captain_submitted_at`,
  `requested_delivery_date`).
- `CaptainSupplier(Supplier)` adds `sent_today: Optional[CaptainSupplierOrderRef] = None`
  and `open_order: Optional[CaptainSupplierOrderRef] = None`. The endpoint's
  `response_model` becomes `list[CaptainSupplier]` — additive, the global
  `/api/suppliers` is untouched.
- `_order_submit_day(order)` — the Warsaw submit day, extracted from
  `_open_orders_elsewhere` (same expression, now shared).
- `_captain_supplier_orders(orders, location_id, today)` — pure; returns
  `(sent_today_by_supplier, open_order_by_supplier)`:
  - sent today: `location_id` matches, status not cancelled/draft, submit day
    == today; newest by (`captain_submitted_at`, `order_id`).
  - open order: status in `_OPEN_ORDER_STATUSES`, `today − 7 <= submit day < today`
    (today's orders are reported by `sent_today`); newest by
    (submit day, `captain_submitted_at`, `order_id`).
- `_captain_supplier_orders_safe(backend, location_id)` — `({}, {})` for a
  non-persistent backend; any read error logged and `({}, {})`; never raises.
- `captain_suppliers` builds the same filtered list as before and wraps each
  row in `CaptainSupplier` with the two lookups.

### Frontend

- `src/types.ts`: `CaptainSupplierOrderRef`, `CaptainSupplier extends Supplier`
  (optional fields mirror the Pydantic defaults; `submitted_on` required since
  the backend always emits it).
- `src/apiClient.ts`: `captainSuppliers` returns `CaptainSupplier[]`;
  `src/lib/orderingSuppliers.ts` `loadCaptainSuppliers` returns
  `CaptainSupplier[]` (the global fallback rows simply have no extras).
- `pages/captain-mp/lib/sentToday.ts` (pure): `newerOrderRef`,
  `sentTodayBySupplier(suppliers, sentThisSession, todayIso)` (server
  `sent_today` merged with this session's submits, newer wins, only refs whose
  `submitted_on` is today — a screen left open overnight drops the ✓),
  `localSentRef(orderId, status, now)`, `mergeSupplierOrders(current, fresh)`
  (refresh the two fields without touching the tab list).
- `CaptainMP.tsx`: `sentSuppliers` becomes derived from the server data plus a
  `sentThisSession` map; after a successful submit the map gets the new order and
  the tab list's order fields are refreshed silently (`api.captainSuppliers()`,
  merged by id; errors ignored). Notices for the active supplier render at the
  top of the main column; the confirm dialog gets the sent-today info.
- `components/SupplierOrderNotices.tsx` (new): amber "sent today" notice and
  slate "open order" notice, each with "Zobacz zamówienie".
- `components/ConfirmSubmitDialog.tsx`: optional `sentToday` prop → amber
  block "Dziś już wysłano … Wysłać kolejne?" (part of `aria-describedby`), and
  the amber "Wyślij mimo to" button when any warning is present.
- `components/SupplierPicker.tsx`: sr-only "wysłano dziś" next to the ✓.
- i18n (pl + en): `supplier.sentToday`, `captain.sentToday`,
  `captain.sentTodayNoTime`, `captain.openOrder`, `captain.showOrder`,
  `confirm.sentToday`, `confirm.sentTodayNoTime`. Status labels reuse
  `orders.status.*`.

## Critical Implementation Details

- Day boundary: Warsaw date of `captain_submitted_at`, not `order_date` (UTC).
  Same helper as the product-level hint, so the two hints agree.
- Never raise: the tab list must load even when the order read fails; the
  fields are then `null` and the screen behaves as before.
- The Captain's own location only: the lookup filters on the token's
  `location_id`, like every captain endpoint.
- The session map keeps the ✓ after a submit on the seed backend (dev), where
  the server never reports orders — same as today's behaviour.

## Testing Strategy

### Unit Tests (backend, `supply-os-v1/tests/test_captain_sent_today.py`):

- Pure `_captain_supplier_orders` with a fixed `today`: 22:30 UTC the previous
  UTC day = 00:30 Warsaw today → sent today; 21:30 UTC = 23:30 Warsaw yesterday →
  not today (becomes the open order); `order_date` fallback without a
  timestamp; cancelled and draft excluded; other location excluded; the newest
  of two today wins; open statuses only, 7-day window, closed excluded, today's
  order not repeated as `open_order`.
- Endpoint (mocked sheet backend): fields filled for the right suppliers, other
  location excluded, cancelled excluded, `null` on the seed backend, `null` when
  `load_orders` raises (tab list still 200), auth still required.

### Unit Tests (frontend):

- `pages/captain-mp/lib/sentToday.test.ts`: merge, newer-wins, today filter,
  `mergeSupplierOrders` keeps tabs.
- `pages/captain-mp/components/ConfirmSubmitDialog.test.tsx`: warning text with
  time, "Wyślij mimo to" enabled and calls `onConfirm`; no block without it.
- `pages/captain-mp/captainSentToday.test.tsx` (CaptainMP + mocked api): ✓ and
  notice from server data on a fresh mount (= after reload), the confirm warning
  and a submit that still goes through, the open-order hint, and the ✓ + refresh
  after a submit.

### Manual Testing Steps:

Live checklist for the operator in the PR body (prod only, after deploy).

## Performance Considerations

One extra `load_orders()` per Captain screen load and one tab-list refetch per
submit. `load_orders()` is the same full-table read `GET /api/captain/orders`
already does; a targeted per-location query would need a new data-layer
function in all three backends — deferred.

## Migration Notes

None. No schema change; the response change is additive (two optional fields).

## Open questions

- Resolved after impl-review (W1): a Transport add-location order
  (`manager_claimed`, `captain_user = "manager-default"`, `captain_submitted_at`
  = the Manager's click) is never `sent_today`. No one at the location sent it
  and it may still be empty (removed at send), so "already sent today" could
  stop the Captain's real order. It still shows as the open-order hint on later
  days. Test: `test_transport_add_location_order_is_never_sent_today`.
- Backlog (impl-review O1): `load_orders()` reads the whole `orders` table on
  every Captain screen load; a `load_orders_since(location_id, since)` in all
  three backends would serve this and `_open_orders_elsewhere`.
- A screen left open past midnight drops yesterday's ✓ on the next render, but
  yesterday's order shows as the open order only after a reload or a submit.

## Impl-review (Opus) applied

- W1 Transport orders (above); notices: the `role="status"` region stays
  mounted, each "Zobacz zamówienie" is described by its own notice; a test for
  the dialog's default `sentToday`.

## References

- `supply-os-v1/app/main.py:389-477` (`_open_orders_elsewhere`)
- `context/archive/2026-10-05-manager-add-any-product/change.md` (change.md format)
- `context/foundation/lessons.md` (mirror Pydantic optionality, deploy before live test)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Backend — per-supplier order state on the captain tab list

#### Automated

- [x] 1.1 New backend tests pass
- [x] 1.2 Full backend suite passes (1128 passed, 37 integration deselected)
- [x] 1.3 Lint passes

### Phase 2: Frontend — ✓ from server data, second-order warning, open-order hint

#### Automated

- [x] 2.1 New frontend tests pass (17 in 3 files)
- [x] 2.2 Full frontend suite passes except the 3 known local-only failures
  (`localStorage.setItem is not a function` under Node 25; also on clean main)
- [x] 2.3 Lint passes
- [x] 2.4 Build passes

#### Manual

- [ ] 2.5 On prod after deploy: ✓ survives a refresh, warning shown before a second order, open-order hint shown (operator)
