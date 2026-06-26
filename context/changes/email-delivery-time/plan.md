---
change_id: email-delivery-time
title: Supplier email shows a fixed "delivery from 11:00" line instead of the delivery date
created: 2026-06-26
updated: 2026-06-26
---

# Plan: Fixed delivery-window line in the supplier email

## Goal

Replace the supplier email's `Data dostawy:` line (the requested date, or the
`do potwierdzenia` fallback) with a single fixed line
`Dostawa możliwa od godziny 11:00` for every location. The requested delivery
DATE is intentionally dropped from the supplier email (owner: Variant A).

## Changes Required

- `frontend/src/pages/manager/lib/emailBody.ts` (authoritative builder): drop the
  `requested_delivery_date` if/else; push the fixed line.
- `supply-os-v1/app/gmail_url.py` (backend twin): same change, byte-identical line.
- `supply-os-v1/tests/test_gmail_url.py`: rewrite the date test → assert the fixed
  line is present and that `Data dostawy` / the date / `do potwierdzenia` are gone.
- `frontend/src/pages/manager/lib/emailBody.test.ts`: add a case for the fixed line.

## What We're NOT Doing

- Not making the time configurable per location — hardcoded 11:00 (owner request).
- Not removing `requested_delivery_date` from the model or the order/captain
  screen — only from the supplier email body.

## Progress

### Phase 1: Email builders + tests
#### Automated
- [x] 1.1 backend pytest green (404 passed, 16 deselected)
- [x] 1.2 frontend build + lint + test green (83 passed; bundle index-DXBOAN8Q.js)
#### Manual
- [x] 1.3 owner live-run: dispatch preview shows "Dostawa możliwa od godziny 11:00", no date line — verified live by owner 2026-06-26
