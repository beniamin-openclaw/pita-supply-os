# Transport Location Columns Implementation Plan

## Overview

The Transport draft matrix (`frontend/src/pages/manager/transport/TransportMatrix.tsx`) renders
one column per member order. A batch can hold two orders from one location (create has no
per-location dedupe; real case: KEN Mory "przejęte" ×3), which gives identical headers. Merge
the columns per location in the matrix only. Each order keeps its own lines, inputs, save
payload, remove and status — no backend change, no data change.

## Current State Analysis

- `TransportMatrix.tsx`: `<th key={order.order_id}>{order.location_name}</th>`, cells from
  `row.linesByOrderId[order.order_id]`, input `data-mx-col={order.order_id}`, add-one `<select>`
  over orders with `location_name` text, remove button per order with a location-only aria label.
- `lib/transport.ts` `buildTransportMatrix(orders)` → rows keyed by product with
  `linesByOrderId`. Drafts (`TransportDraftMap`) and `transportDirtySavePayloads` are per order.
- `TransportPage.tsx` passes one section's orders per supplier, so Pago and Mory orders from
  one location are in different tables (not this bug).
- Backend: `manager_transport_create` combines both; batch detail keeps two `orders` entries,
  `location_ids` deduped, aggregate `per_location` one entry per line (new pytest locks this).

## Desired End State

- One header per location in a section. When the location has more than one order in the
  batch, the header shows a small note "2 zamówienia" and one remove button per order labelled
  "zam. 1" / "zam. 2" (aria: location + order number; tooltip: order id). Order numbers follow
  the batch's order list.
- A cell lists the lines of that location's orders carrying the product:
  - none → "+" (adds to the first of the location's orders whose orderable list carries it on the
    location's list) or "–";
  - one → the same input / value as today (no visual change in the common case);
  - two or more → one input (or value) per order, stacked, each prefixed "zam. n", with a small
    "razem X" total under them. Each input writes its own order line (no hidden writes).
- Manager-zero styling (PR #68) applies per input.
- Enter-navigation hops down the location's column (`data-mx-col` = location id); the first
  input of the next row that has one.
- Add-one select lists locations once; adding goes to the first order of that location and
  skips products any of the location's orders already carries.
- Add-to-all ("+ Dodaj produkt" for every location) adds ONE line per location: the first order
  that can take it, skipped when another order of the location already carries the product
  (`transportAddAllTargets`, plan review M1).
- Toasts and the remove confirm name the order when the location has several: "Ken, zam. 2"
  (the matrix passes a label to `onAddProductOne` / `onRemoveOrder`, plan review M2/m3).
- The matrix is only rendered editable on the page (the sent view is a separate per-location
  table); its read-only branch keeps the same merged columns for tests (plan review m4).

## What We're NOT Doing

- No backend change, no dedupe on create, no automatic merge of the orders' data (each order
  stays its own row, PATCH, status and e-mail/PDF entry).
- No change to the sent view, driver PDF or aggregate (already per location).

## Implementation Approach

1. `lib/transport.ts`: pure `groupTransportColumns(orders): TransportLocationColumn[]` —
   `{ location_id, location_name, orders }`, first-seen location order, orders in batch order.
   Unit tests in `lib/transport.test.ts`.
2. `TransportMatrix.tsx`: iterate columns instead of orders as above. New i18n keys
   `manager.transport.matrix.ordersAtLocation` ("{n} zamówienia"), `.orderTag` ("zam. {n}"),
   `.cellTotal` ("razem {qty}"), `.removeOrderAria` ("Usuń zamówienie {n} lokalu {location}"),
   `.qtyOrderAria` (qty aria with the order number).
3. `TransportPage.tsx`: `handleAddProductAll` uses `transportAddAllTargets`;
   `handleAddProductOne` / `handleRemoveOrder` take the matrix's label for toasts and confirm.
4. Tests (`TransportMatrix.test.tsx`, `lib/transport.test.ts`): one header per location
   (reproduction, failed before the fix), stacked inputs each calling `onQtyChange` with its own
   order/line, total, remove per order, Enter through stacked inputs, "+" and add-one target the
   first order, add-one skips a product on another order of the location, per-input zero, KEN ×3,
   add-to-all one line per location. Backend pytest (`tests/test_transport.py`, part of step 1):
   create combines two same-location orders; batch detail keeps both orders and one location id.

## Plan review

No blockers. M1 (add-to-all doubled the line in a merged column) and M2 (remove confirm named
only the location) fixed as above; m3 (toast/aria name the order), m4 (wording), m5 (step
numbering) and m6 (missing tests) addressed. `data-mx-row` dropped (Enter now walks the
column's inputs in document order).

## Impl review (9db8e6a)

No blockers. Major fixed: the add-to-all picker could offer a product that added nothing (options
were per order, targets per location) — `buildTransportAddAllOptions` now works per location too.
Minor/nits fixed: add-one reads the first order with a loaded catalogue; a merged cell is amber
only when every order in it is zeroed, otherwise only the zeroed order's row; explicit return
type; unused `data-mx-row` prop removed; a separate "Dodano X (Ken, zam. 2)" toast; tests for
Enter in a one-order column, "+" falling through to zam. 2, per-order tint, per-location options.
Not added: page-level tests for the confirm/toast label (TransportPage has no add/remove test
harness; the matrix tests assert the label passed to the callbacks).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

- [x] 1 Reproduce (Vitest fails with 2 headers; pytest locks the backend contract) — 9db8e6a
- [x] 2 Column grouping helper + tests — 9db8e6a
- [x] 3 Matrix renders merged columns + tests — 9db8e6a
- [x] 4 Verify, impl review, PR
