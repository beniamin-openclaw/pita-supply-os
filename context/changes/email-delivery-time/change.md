---
change_id: email-delivery-time
title: Supplier email shows a fixed "delivery from 11:00" line instead of the delivery date
status: implemented
created: 2026-06-26
updated: 2026-06-26
archived_at: null
---

## Notes

Demo-feedback follow-up to email-delivery-address. The supplier dispatch email's
`Data dostawy: <date>` / `Data dostawy: do potwierdzenia` line is replaced by a
fixed line `Dostawa możliwa od godziny 11:00` for ALL locations.

Owner decision (Variant A): drop the requested delivery DATE from the supplier
email entirely and hardcode 11:00. `requested_delivery_date` still exists on the
order and is captured on the Captain screen — it is simply no longer printed in
the supplier email.

Both builders change identically: the authoritative client builder
(`emailBody.ts`) and the backend twin (`gmail_url.py`).
