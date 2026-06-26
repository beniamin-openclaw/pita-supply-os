---
change_id: email-delivery-address
title: Supplier email carries the exact delivery address, not just the location name
created: 2026-06-25
updated: 2026-06-25
---

# Plan: Email delivery address

## Goal

The supplier dispatch email's `Adres dostawy:` line must carry the **exact**
delivery address (location name + street + city), not just the location name.
Both email builders — the authoritative client builder (`emailBody.ts`) and the
backend twin (`gmail_url.py`) — must emit the **same** combined line, and the
`ManagerOrderDetail` payload must actually carry the address fields.

## Design decisions

- **One combined format, both builders:** `Adres dostawy:` =
  `join(", ", [location_name, delivery_address, city])` with empty/missing parts
  skipped. Replaces the Python builder's old `delivery_address or location_name`
  (which dropped both the name and the city when a street existed).
- **No new I/O:** `manager_order_detail` already loads `location`; the two new
  fields come from that object. No extra master-data read.
- **Copy stays inline:** the Gmail draft body is a generated artifact mirrored
  byte-for-byte with the Python twin, not app UI chrome — `Adres dostawy:` stays
  hardcoded next to the other body strings (existing dual-builder convention),
  not lifted into `i18n/`.

## Phase 1 — Backend: carry + emit the address

### Changes Required
- `supply-os-v1/app/models.py` — `ManagerOrderDetail`: add
  `delivery_address: Optional[str] = None`, `city: Optional[str] = None`.
- `supply-os-v1/app/main.py` — `manager_order_detail`: populate both from the
  already-loaded `location`.
- `supply-os-v1/app/gmail_url.py` — add `_format_delivery_address(location)`
  helper; `_build_body` uses it for the combined line.
- `supply-os-v1/tests/test_gmail_url.py` — assert the combined format (name +
  street + city; empties skipped).

### Automated Verification
- [ ] `cd supply-os-v1 && python3 -m pytest` is green.

### Manual Verification
- [ ] (covered by the Phase 2 frontend live run — same string)

## Phase 2 — Frontend: type + client builder + test

### Changes Required
- `frontend/src/types.ts` — `ManagerOrderDetail`: add `delivery_address?: string`,
  `city?: string` (mirror Pydantic optionality).
- `frontend/src/pages/manager/lib/emailBody.ts` — `buildEmailBody`: combined
  address line; drop the "fidelity gap" comment.
- `frontend/src/pages/manager/lib/emailBody.test.ts` — new: assert the address
  line joins name/address/city and skips empties.

### Automated Verification
- [ ] `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run build && npm run lint && npm run test` is green.

### Manual Verification
- [ ] Owner live run on prod: dispatch panel preview shows the full street
  address (requires Wola master-data `delivery_address` filled — see caveat).

## What We're NOT Doing

- Not editing master data (Wola's `TBD` placeholder is the owner's to fill).
- Not lifting the email body into `i18n/` (it mirrors the Python twin by design).
- Not changing the subject line or any other body line.

## Progress

### Phase 1: Backend
#### Automated
- [x] 1.1 backend pytest green (404 passed, 16 deselected) — 1078240
- [x] 1.3 GET /api/manager/order/{id} returns delivery_address + city — 1d6740c
#### Manual
- [x] 1.2 n/a — body string verified by the Phase 2 unit test — 1078240

### Phase 2: Frontend
#### Automated
- [x] 2.1 frontend build + lint + test green (82 passed) — dbcffca
#### Manual
- [x] 2.2 owner live-run dispatch preview shows full address — verified live by owner 2026-06-26 (Wola master-data filled in prod Supabase + seed)
