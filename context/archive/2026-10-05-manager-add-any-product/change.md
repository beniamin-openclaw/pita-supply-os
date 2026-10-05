---
change_id: manager-add-any-product
title: Manager one-off override — add any supplier product to an order, also from a draft Transport
status: archived
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05T20:48:12Z
---

## Trigger

Operator, 2026-10-05: "Westfield Mokotów has the 15 kg gyros unavailable, the manager cannot place the order — check why and fix on prod. There should also be a manual override to add any product, e.g. 15 kg gyros as a one-off at Norblin or Elektrownia." Follow-up the same day: the override exists in the order pane before the Transport; add it to the view after the Transport is created too, and the order itself must be updated so the goods receipt is correct.

## Diagnosis (prod, read-only, 2026-10-05)

- `WESTFIELD__P024` (Gyros 15 KG) exists: min/target/max 30/60/60 kg, set 2026-09-29. `SP_PAGO_P024` and `P024` are active. Nothing in master data blocks the product at Westfield, so no prod data change was made.
- `ORD-20261004-WES-PAGO-53041e`: the Captain ordered 3 × Gyros 25 KG and no 15 kg block. The Manager added the 15 kg line by hand (line id `...-M-d1b212`), set it 0 → 10 → 1 in Transport `TRN-20261005-PAGO-7b64e0` (10:12 and 10:18 UTC), and the batch was sent at 10:18 UTC.
- In the Transport matrix a location without the product shows an inert "–" cell. The only way to fill it was the matrix-wide "+ Dodaj produkt", which adds the product to every order that lacks it, and only where the location has a setting. A location without a setting (or a one-location add) had no path — that is the "unavailable" the Manager hits.

## What changed

Backend (`supply-os-v1/app/main.py`, `models.py`):
- `_build_orderable_items(..., include_unconfigured=False)`: when True, drops only the location-setting filter (supplier, `sp.active`, `product.active` still apply). Every item now carries `configured_for_location`; unconfigured ones read zero thresholds.
- `GET /api/manager/orderable?include_unconfigured=true` (Manager only; Captain path unchanged).
- `ManagerAddLineRequest.allow_unconfigured` (default False): the explicit override on add-line. The line is a normal order line (target 0), so the Transport pickup, the e-mail and the goods receipt see it. An override add is always written to `order_events` as `line_added` "…: dodano (unit) — poza listą lokalu".
- Sent Transport members stay frozen (`_reject_if_not_editable_after_send` unchanged).

Frontend:
- `AddProductPicker`: items with `configured_for_location === false` sit behind a "Wyjątkowo: pokaż wszystkie produkty dostawcy" checkbox and carry a "poza listą lokalu" tag. The Captain list never has such items, so it looks unchanged.
- Manager order pane: fetches the full list; the pick passes the override when needed.
- Transport draft matrix: an empty cell is a "+" that adds the row's product to that one location's order when the product is on that location's list; a "Tylko dla jednego lokalu:" row pairs a location select with the picker over that order's full list (one-offs behind the checkbox). Add-to-all never uses the override. Unsaved matrix edits survive a one-location add.
- Captain edit (`PATCH /api/captain/order/{id}`) after a Manager send-back keeps an existing one-off line editable (zero thresholds, packaging allowance on) instead of a 400; a new product without a setting is still rejected.

## Impl-review (Opus, 2026-10-05)

No critical findings. Fixed: the matrix "+" skipped the checkbox for one-offs (now list products only); the send-back Captain edit 400 on a one-off line; the picker checkbox carried over after Escape/outside click; a stale comment. Accepted as is: the override event on a claimed order shows in the detail only once the order is sent (`manager_order_detail` loads events for sent/closed orders); a quick double "+" gets the existing "already on order" 400 toast.

## Verification

- Backend: `python -m pytest` 1008 passed; `ruff check .` clean. New tests in `tests/test_manager_add_line.py`, `tests/test_orderable_active_filter.py` and `tests/test_captain_orders.py`.
- Frontend: build + lint clean; new tests `AddProductPicker.test.tsx` and `lib/transport.test.ts` (`orderAddOneOptions`, add-to-all exclusion). Three captain-mp vitest failures (localStorage) reproduce on clean `main` locally and are unrelated.

## Prod master data (2026-10-05, after the live test)

Owner confirmed the override works on prod ("działa") and asked for Westfield's Gyros 15 KG thresholds: target 2 blocks, max 4 blocks, min 1 block (P024 is counted in kg, 1 block = 15 kg).

| setting_id | before (min/target/max kg) | after (min/target/max kg) |
|---|---|---|
| WESTFIELD__P024 | 30 / 60 / 60 | 15 / 30 / 60 |

- Diff before: the row above (it is the rollback: `UPDATE location_product_settings SET min_stock_qty_base=30, target_stock_qty_base=60, max_stock_qty_base=60 WHERE setting_id='WESTFIELD__P024'`).
- Apply: single guarded UPDATE (`WHERE` on the old 30/60/60 values), 1 row; note appended "[2026-10-05 owner: cel 2 szt / max 4 szt / min 1 szt; przed 30/60/60]".
- Audit after: exactly 1 WESTFIELD×P024 row, min <= target <= max, `SP_PAGO_P024.units_per_purchase_unit` = 15 (so 15/30/60 kg = 1/2/4 blocks).

## Rollback

Revert the PR. No migration, no prod data written.
