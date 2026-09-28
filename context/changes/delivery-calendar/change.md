---
change_id: delivery-calendar
title: Delivery calendar — proposed delivery date, 17:00 deadline and Thursday coverage prompt
status: impl_reviewed
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

Operator decisions 2026-09-28:

1. Soft default delivery date. When a Captain starts an order for a supplier, the app proposes the next possible delivery date from the supplier's rules (and per-location overrides), taking the 17:00 Captain deadline into account (Europe/Warsaw). The Captain can freely pick any other date — nothing blocks. Persist what the app proposed (e.g. `suggested_delivery_date`) next to the existing `requested_delivery_date`. In the Manager view (queue row + order detail) show a subtle marker only when the chosen date differs from the proposal — styled like the existing over-max exception marker.
2. Thursday prompt. On Thursdays, when a Captain opens an order for an in-scope supplier, show a choice "na 1 dzień" / "na 3 dni (do końca tygodnia)" with the text "Pamiętaj o ilościach na 3 dni!". Informational only — must NOT change the suggestion math. Store the choice on the order (`coverage_days` 1|3) and show it to the Manager. Supplier scope is data (a flag per supplier). Default in scope (pending confirmation by operations manager Marek): SUP_BUKAT, SUP_INTERMLECZ, SUP_KUCHNIE, SUP_EUROFOOD (= Go Gastro), SUP_COCACOLA, SUP_BLUESERV; out of scope: SUP_PAGO, SUP_MORY.
3. Show the 17:00 Captain deadline on the order screen where the cutoff is shown today.

Marek's ordering rules (28.09) to seed — unknown items stay TBD with the current fallback:
- 17:00 order deadline everywhere.
- SUP_PAGO and SUP_MORY: BRACKA and WOLA order Monday → Wednesday delivery (one per week). NORBLIN, BROWARY, ELEKTROWNIA, WESTFIELD, KEN: order Sunday → Tuesday, order Thursday → Saturday.
- SUP_FILBER: order Wednesday → Thursday.
- SUP_COCACOLA: deliveries Mon–Fri; bottles need 2 days lead; cans per-location schedule (unknown → TBD).
- SUP_KUCHNIE and SUP_EUROFOOD: ongoing, business days only (assume next business day; to-confirm).
- SUP_BLUESERV: 2 days lead (delivery weekdays unknown → TBD).
- SUP_INTERMLECZ and SUP_BUKAT: order by 17:00 for the next day; no Sunday deliveries.
- Emergency purchases up to 100 zł are out of the app.

Pago is not sent from the app (sent from the "Ordering PB v5" sheet); the app only records Pago orders. Do not change any Pago sending/transport behaviour.

Out of scope: supplier e-mail builder (another lane renders the chosen date), reminders/notifications, Pago e-mail.
Coordination: PR #33 (migration 0021), display order + Bukat minimum (0023), zero-quantity fix lane. Rebase on main before the PR.

Updates relayed by the coordinating lane from the operator's call with Marek (2026-09-28), pending operator confirmation at the plan STOP:
- Migration number: 0024 is taken by the zero-quantity lane (`order_lines.manager_final_set`); this change uses 0025 (0026 = order e-mail lane, 0027 reserved).
- Thursday prompt scope: only SUP_BUKAT and SUP_INTERMLECZ. When "na 3 dni" is picked, add "czy to wystarczy do końca weekendu?". No per-day quantity math.
- Rules: either one shared rule per supplier or per-location rules. The Captain sees by when to order and when the delivery can arrive.
- SUP_COCACOLA: delivery days are per location, same for cans and bottles; WESTFIELD Mon, Tue, Thu, Fri; other locations TBD (no hint). Order by the evening two days before delivery.
- Pago/Mory: WOLA and BRACKA Mon → Wed; other Warsaw locations Sun → Tue and Thu → Sat. Do not copy PR #30's 'Tue, Sat'.
- Reminders later; keep the rule data ready for them.
- Expose a pure `delivery_window(...)` → (next delivery, following delivery, order deadline) for a later dynamic-target lane; keep `WEEKDAY_MAP` / `_parse_weekdays` in main.py.

Planning decisions (operator, 2026-09-28): fallback proposals are shown but not stored; uncertain rules seeded as business days with "to confirm" notes; Thursday = whole Warsaw calendar Thursday; the Thursday choice is optional.

Second relay from the coordinating lane (2026-09-28), pending operator confirmation at the plan STOP:
- Delivery days confirmed: Go Gastro (SUP_EUROFOOD, to be renamed — rename out of scope), Blue Service (SUP_BLUESERV), Spec Food (SUP_SPEC), Kamino (SUP_KAMINO) Mon–Fri; Kuchnie Świata (SUP_KUCHNIE) Mon–Sat. Lead times as before (Blue Service 2 days); Spec Food and Kamino lead 1 assumed.
- SUP_MORY follows the Pago schedule per location.
- Migration 0025 confirmed by the coordinator.
- Reminders later via a Telegram bot (anti-spam design, separate change); keep the rule data ready.
- PR #33 merged; rebase on main before implementing.
