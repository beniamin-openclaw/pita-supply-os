# Handoff: order-email-v2 → feedback-1001-names-units

Date: 2026-10-01. From the order-email-v2 lane (PR #43, roadmap R-32) to the
feedback-1001-names-units lane.

## What order-email-v2 already covers

`feedback-1001-names-units` Q7 and Phase 5 ("Full" option) describe the same thing PR #43 builds:

- Migration **0026** adds `locations.sender_email` and `locations.phone`.
- `ManagerOrderDetail` returns `sender_email`, `order_mailbox`, `location_phone` and `email_signers`.
- The dispatch panel ("Zrób draft w Gmailu") and the dosyłka panel create a Gmail API draft in biuro@:
  - From is the location alias. After creating the draft the app reads the From header back; if Gmail rewrote it, the draft is deleted and the Manager sees an error.
  - DW is the location mailbox (`locations.email`).
- The compose-URL path stays as a fallback. It cannot choose a sender.
- `prod-sql.sql` in this lane sets WESTFIELD `sender_email = 'mokotow@pitabros.pl'` and `phone = '784 984 092'` (operator, 2026-10-01).

So **Q7 is answered (the "build it" option) and Phase 5 shrinks**. The Phase 5 "Facts" lines will be stale once PR #43 merges: `gmail_url.py` and `emailBody.ts` gain the signature and phone, and dispatch gains the draft path.

## What stays in feedback-1001-names-units

- **Step 1.7:** `locations.email = 'westfieldpitabros@gmail.com'` for WESTFIELD (the DW mailbox). order-email-v2 does NOT set it, so there is no double write. Until 1.7 runs, Westfield e-mails go without the location DW.
- **Transport Gmail drafts setting `From:`.** Out of scope for order-email-v2, which leaves Pago and Transport untouched. If it is still wanted, it is a separate small step:
  - add a `from` argument in `frontend/src/pages/manager/lib/gmailDraft.ts` (the MIME builder already supports `From`/`Cc` after PR #43);
  - reuse `locations.sender_email`.
- **Docs-only part of Phase 5** (COMPANY_ENTITIES.md / NEW_LOCATION_CHECKLIST.md: "Westfield — wysyłka z mokotow@"). Still useful as a note, but the app now picks the alias itself. Add to NEW_LOCATION_CHECKLIST: "set `locations.sender_email` (send-as alias of biuro@) and `locations.phone`".

## Coordination rules

- Migration numbers: **0026 is taken** by order-email-v2. A new migration in feedback-1001 must be 0027 or later.
- Order on prod: 0026 → order-email-v2 `prod-sql.sql` → merge PR #43. Feedback-1001 step 1.7 can run before or after; it touches only `locations.email` and `notes`.
- Quantities in any e-mail or document go through `order_qty.effective_ordered_qty` / `lib/orderQty.ts` only.
