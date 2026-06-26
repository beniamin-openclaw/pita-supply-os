---
change_id: email-delivery-address
title: Supplier email carries the exact delivery address, not just the location name
status: archived
created: 2026-06-25
updated: 2026-06-26
archived_at: 2026-06-26T10:45:23Z
---

## Notes

Demo-feedback #2. The dispatch email's "Adres dostawy:" line printed only the
location *name* (e.g. "Pita Bros Wola") because `ManagerOrderDetail` never
carried the street address. The Python twin (`gmail_url.py`) already read
`location.delivery_address or location_name` but dropped `city` and never
combined name + street; the client builder (`emailBody.ts`) — the one that
actually sends the draft — had only `location_name`.

Fix: `ManagerOrderDetail` gains `delivery_address` + `city` (populated from the
already-loaded `location` in `manager_order_detail`); both email builders emit a
combined `location_name, delivery_address, city` line (empty parts skipped),
kept in lockstep.

CAVEAT (master data, outside this change): Wola's `delivery_address` seed value
is the placeholder `TBD` — the owner must set the real street in master data
before the live run, or the email will read "…, TBD, Warsaw". See
`verification/preview-notes.md`.
