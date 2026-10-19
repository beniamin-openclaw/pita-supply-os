---
change_id: transport-v2
title: Transport v2 — one send place (Gmail drafts in biuro@), undo-send, Pago-only ZOW body, Pago/Mory chips, cleaner history
status: implemented
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Notes

Operator feedback 2026-10-05 after the first live combined run (TRN-20261005-PAGO-7b64e0, five
locations, Pago + Magazyn Mory). The ZOW for that run was finally sent from Marek's sheet, not
from the app. Decisions, as given by the operator:

1. Off-catalogue items go to PAGO only in exceptional cases, after explicit approval and a
   confirmation that they should come from PAGO.
2. The Pago ZOW e-mail body must not contain off-catalogue items; the PDF is correct; it is
   addressed to PAGO (the SUP_PAGO list). The "Zamówienie zbiorcze Pago" compose e-mail (bottom
   "Otwórz email" button) is also addressed to PAGO — that path is wrong and goes away, together
   with "Kopiuj listę dla kierowcy" (it crashed). Sending is unified: one place to send, one place
   to mark.
3. The driver gets Pago and Magazyn on one sheet, sorted (already the case).
4. Only Pago takes the order as an attachment only; other suppliers keep their body e-mails —
   unchanged.
5. The driver e-mail also carries date, time, driver and vehicle. A missing value raises a soft
   alert after clicking "Wyślij", before the e-mail is created; the manager can continue.
6. Buttons: "Wyślij zamówienie" and "Wyślij listę kierowcy" replace "Szkic Gmail — …" and the
   copy/open-e-mail buttons. PDFs stay downloadable for preview.
7. "Wyślij" creates a Gmail draft and the human sends it from Gmail after checking it and the
   attachment. The manager must be able to un-mark "sent", fix something, and only then create
   the draft again and send. "To jest ważne."
8. Transport offers only Pago and Magazyn Mory, as two chips, both on by default; unticking one
   leaves the other.
9. History: newest first, easier filtering — city tiles (tick/untick), supplier chips.
10. One transport, one driver sheet with Pago + Magazyn (no variants).
11. Marek may use the sheet until the app does the ZOW flawlessly, but from the next run he should
    use the app. Next run: Wola + Bracka, delivery Wed 07.10 (orders submitted 05.10).
12. Tacki bez logo = Box beżowy bez logo (same item). Przyprawa do souvlaków can come from
    Magazyn or MEZE (two sources) — the batch note carries where to collect it.
13. Locations record quantity differences themselves at receipt; no SQL corrections of the
    05.10 orders.

Scope: code only, no migration. Prod data steps (two Mory orders for 06.10 still `manager_claimed`,
stale claimed orders 21.09–01.10) are operator actions, listed in plan.md, not part of the code.

## Operations log

### 2026-10-05 — the two 04.10 Mory orders for 06.10 (prod Supabase) — not applied by Claude

The operator asked in chat for Claude to mark ORD-20261004-BRO-MORY-8fbdd2 and
ORD-20261004-KEN-MORY-06569d as sent, so that Browary and KEN can receive the Magazyn goods on
06.10. The guarded UPDATE, which mirrors `POST /api/manager/dispatch` for a `manual` supplier,
was blocked by the agent's permission layer and was NOT run. The operator marks both orders in
the Manager UI ("Oznacz jako wysłane"), which writes the same fields.

State before (SELECT at ~21:15), for checking afterwards:

| order | status | sent_method | manager_user | manager_sent_at | total_value_estimate_pln | supplier_order_reference |
|---|---|---|---|---|---|---|
| ORD-20261004-BRO-MORY-8fbdd2 | manager_claimed | null | null | null | 262.51 | null |
| ORD-20261004-KEN-MORY-06569d | manager_claimed | null | null | null | 68.62 | null |

Lines:
- BRO line 001 (P019) has `manager_final_set=true`, qty 1 (the Captain ordered 5).
- The other 7 lines have `manager_final_set=false`:
  - BRO 002–005: P089 1, P090 1, P092 2, P098 1;
  - KEN 001–003: P089 1, P127 5, P131 60.
- App-dispatched Mory orders (e.g. ORD-20261004-ELE-MORY-8eb1dc) end with:
  - `sent_method='manual'`;
  - `manager_user='manager-default'`;
  - `manager_final_set=true` on every line;
  - no order event.
