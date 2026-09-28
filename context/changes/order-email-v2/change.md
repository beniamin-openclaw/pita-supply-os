---
change_id: order-email-v2
title: Supplier order e-mail v2 — location send-as alias, Gmail draft, manager signature, location phone, delivery date
status: implemented
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

New per-order supplier e-mail, layout approved by the operator 2026-09-28 (example Bracka × Bukat):

```
Od:    Pita Bros Bracka <bracka@pitabros.pl>
Do:    biuro@bukat.com
DW:    pitabrosbracka@gmail.com
Temat: Zamówienie Pita Bros Bracka – dostawa wt 29.09

Dzień dobry,

proszę o przygotowanie zamówienia:

Lp. | Produkt      | Ilość
1.  | Pomidor      | 6 kg
2.  | Tzatzyki 3kg | 4 pojemniki

Dostawa: wtorek 29.09.2026, od godziny 11:00
ADRES DOSTAWY: Pita Bros Bracka, ul. Bracka 20, 00-028 Warszawa
Telefon lokalu: 600 722 252

Pozdrawiam,
Marek Złotopolski
tel. +48 662 184 258 · marek@pitabros.pl
Pita Bros Centrum Sp. z o.o.
ul. W. Laskonogiego 9, 02-496 Warszawa
NIP: 5223314413
(zamówienie #ORD-…)
```

Rules (from the operator brief):

1. Sender = the location's send-as alias in the biuro@pitabros.pl mailbox (BRACKA bracka@, BROWARY browary@,
   ELEKTROWNIA elektrownia@, KEN ken@, NORBLIN norblin@, WESTFIELD mokotow@; later FORUM forum@,
   STARY_BROWAR poznan@, SLONY slony@, SUPERSAM supersam@, KULINARNA kulinarna@ — all @pitabros.pl;
   spelling to be confirmed with the operator before seeding). WOLA has no alias → biuro@pitabros.pl.
   Stored per location (new column).
2. Mechanism: "Zrób draft w Gmailu" creates a Gmail API DRAFT (never sends) in biuro@ with that From —
   reuse `frontend/src/pages/manager/lib/gmailDraft.ts`. Warn when the authorized mailbox is not biuro@.
   Keep "Otwórz w Gmail" compose link as fallback. The dispatch state-write stays tied to the manager's
   explicit action.
3. CC: always the location mailbox (`locations.email`) unless it is the sender; biuro@
   (`settings.order_cc_email`) only on the fallback path. Mirror in `main._join_cc` / `joinCc`.
4. Signature = the sending manager: default Marek Złotopolski (+48 662 184 258, marek@pitabros.pl),
   switchable to Sławomir Glanowski (+48 692 840 194, slawek@pitabros.pl), remembered per browser.
   Config (e.g. a `_meta` key), not hard-coded. No Captain phone field.
5. Location phone line from a new `locations.phone` (WOLA 662015470, BRACKA 600722252, KEN 530699266,
   NORBLIN 535300514, ELEKTROWNIA 608037499; BROWARY/WESTFIELD unknown → line omitted).
6. Delivery date: render `requested_delivery_date` and put it in the subject. Depends on the parallel
   `delivery-calendar` lane — merge after it; if it is not merged, keep the date line blank.
7. Polish diacritics everywhere; units declined via `frontend/src/i18n/packUnits.ts`.
8. Pago is not e-mailed per order (SUP_PAGO = transport since PR #33) — do not touch Pago/Transport sending.

Coordination: migration number **0026** (0021 applied; 0023 display-order, 0024 zero-quantity,
0025 delivery-calendar are other lanes). Rebase on main before the builder changes and before the PR
(zero-quantity lane changes the effective-quantity rule; display-order lane changes line ordering).
Prod data (aliases, phones, signature config) ships as a diff-before / audit-after SQL file for the
operator to approve and apply. STOPs: after plan-review (show plan + rendered Bracka × Bukat and
Wola × Intermlecz e-mails), and before merge (operator applies 0026; live E2E of the draft after deploy).
