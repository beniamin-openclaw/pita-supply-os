# Supplier Groups Implementation Plan

## Overview

Two Manager-side changes from Ben's D4 (17.10):

1. The Manager supplier filters (queue and archive) show Pago and Magazyn Mory as one option,
   "Pago + Magazyn Mory", that matches orders of either supplier.
2. A Filber order can be marked as ordered without the e-mail, the way a manual supplier
   (Coca-Cola) is marked today.

Frontend only. No backend code change, no migration, no prod SQL.

## Current State Analysis

- `frontend/src/pages/ManagerPage.tsx` builds `supplierOptions` with
  `pages/manager/lib/supplierOptions.ts` `buildSupplierOptions` (manager-queue-control) and filters
  the lanes with `q.supplier_id === selectedSupplierId`. `pages/manager/ManagerArchivePage.tsx`
  does the same over the archive list.
- `pages/manager/lib/transport.ts` `TRANSPORT_CHIP_SUPPLIER_IDS = ["SUP_PAGO", "SUP_MORY"]` names
  the pair for the Transport filter chips.
- Filber (`SUP_FILBER`) is an `email` supplier (seed `suppliers.csv`). `DispatchPanel.tsx` (Lane E,
  not edited here) offers the Gmail link and the draft for e-mail, and "Oznacz jako zamówione"
  only for the manual/phone/portal channels.
- `POST /api/manager/dispatch` takes a free `sent_method` string and branches on the supplier's
  `ordering_method`, not on `sent_method`. For an e-mail supplier it returns a
  `gmail_compose_url` whatever `sent_method` says; it sends no e-mail itself.

## Desired End State

- One filter option "Pago + Magazyn Mory" (id `GRP_PAGO_MORY`) replaces the two in both Manager
  filters whenever at least one of them is listed; selecting it shows Pago and Mory orders.
- A claimed Filber order shows a "Zamówione (bez e-maila)" button next to Release/Cancel. After a
  confirm it dispatches with `sent_method: "manual"`, with the live draft quantities, like every
  other dispatch. Disabled while busy or when every line is 0.
- A dispatch with a non-email `sent_method` keeps no compose URL on the page, so the sent order
  does not show "Otwórz email do dostawcy" for an e-mail that never went out.

## What We're NOT Doing

- No data change: Pago and Mory stay separate suppliers. No grouping in the Captain screens
  (`captain-mp/**` belongs to Lane C; a follow-up for the coordinator if Ben wants it there).
- No Filber in the Pago Transport run, no new aggregation layer.
- No edit to `DispatchPanel.tsx` (Lane E). The button lives in `OrderDetailPane.tsx`.
- No backend change. The backend still returns a compose URL for the manual dispatch of an e-mail
  supplier; the frontend ignores it. The backend's "@" gate also still applies: a supplier whose
  address is a placeholder gets a 400 even for "bez e-maila". Prod Filber has a real address
  (`wyspypiwne@filber.pl`, set 16.07, `context/archive/2026-07-15-feedback-r4-suppliers-master-data/change.md`);
  the seed's `TBD` does not.
- The order stores `sent_method = "manual"`, but no Manager screen shows `sent_method` today and
  dispatch writes no order event. So after the fact the app does not tell a Filber order marked
  by hand from one e-mailed. The post-send "Dosyłka" composer (`ResendPanel.tsx`) also still offers
  an e-mail top-up for such an order. Follow-up candidate: expose `sent_method` on the Manager
  detail and show "zamówione bez e-maila" (and the copy-list instead of the e-mail top-up).
- Filber is allowlisted by id (`MARK_ORDERED_EMAIL_SUPPLIER_IDS`). If more suppliers need this,
  move it to a supplier flag, as `suggestion_alerts_enabled` did.

## Implementation Approach

1. `frontend/src/lib/supplierGroups.ts` (new): `PAGO_MORY_SUPPLIER_IDS`, `SUPPLIER_GROUPS`,
   `supplierFilterMatches(selectedId, supplierId)`, `groupSupplierOptions(options, label)`,
   `MARK_ORDERED_EMAIL_SUPPLIER_IDS = ["SUP_FILBER"]`. `lib/transport.ts`
   `TRANSPORT_CHIP_SUPPLIER_IDS` points at the same pair.
2. `ManagerPage.tsx` and `ManagerArchivePage.tsx`: group the options, filter with the matcher.
   `handleDispatch` stores the compose URL only for `sent_method === "email"`.
3. `OrderDetailPane.tsx`: the Filber button (allowlisted id + `ordering_method === "email"`).
4. i18n: `manager.filter.group.pagoMory`, `manager.markOrderedNoEmail`,
   `manager.markOrderedNoEmailHint`, `manager.markOrderedNoEmailConfirm`.
5. Tests: `lib/supplierGroups.test.ts`, `pages/manager/OrderDetailPane.test.tsx`,
   `pages/ManagerPage.supplierGroups.test.tsx`, and the backend contract
   `test_dispatch_email_supplier_marked_ordered_without_email` in
   `supply-os-v1/tests/test_manager_dispatch.py` (an e-mail supplier dispatched as manual ends
   `manager_sent` with `sent_method` manual, no e-mail sent).

## Success Criteria

- `python -m pytest`, `ruff check .`, `npm run build`, `npm run lint`, `npm run test` pass.
- Live check after deploy (Ben, prod): the filter shows "Pago + Magazyn Mory" and lists both
  suppliers' orders; a claimed Filber order shows "Zamówione (bez e-maila)" and moves to the sent
  lane with no e-mail link. If Filber is not an e-mail supplier on prod, the button stays hidden
  and the existing "Oznacz jako zamówione" in the dispatch panel covers it. Read-only check
  before: `SELECT supplier_id, ordering_method, email FROM suppliers WHERE supplier_id = 'SUP_FILBER';`
  (expect `email` and an address with "@").

## Impl review (13290a8)

No blockers or majors. Addressed: the plan's wrong claim that the history shows `sent_method`
(corrected above, with the follow-up), the "@" gate and the post-send top-up written down, a prod
read-only check added to the live check, tests for the busy/drafting lock, a sent Filber order and
a non-email Filber, and the backend test now pins the compose URL the frontend guard drops. Left
as is: the hint lives only in `title` (the confirm carries the message on touch screens), and the
archive-page grouping has no own test (same helper and matcher as the queue, which is tested).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

- [x] 1 Helpers + Transport chips — 13290a8
- [x] 2 Manager and archive filters, compose-URL guard — 13290a8
- [x] 3 Filber button — 13290a8
- [x] 4 Tests — 13290a8
- [x] 5 Verify + reviews addressed
- [ ] 6 PR open, CI green
