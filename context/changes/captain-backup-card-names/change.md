---
change_id: captain-backup-card-names
title: Captain backup-source card look (D10 A) and hidden "/N" bulk suffix in the Captain view (WP4 / D3)
status: implemented
created: 2026-10-17
updated: 2026-10-17
---

## Trigger

Owner decisions: D10 variant A (a backup-source product card must look deliberate, not empty) and D3 (the Captain sees product names without the "how many per carton" suffix; data, e-mail and PDF stay unchanged).

## Scope

Frontend display only. No data, API payload, e-mail builder (`gmail_url.py`, `emailBody.ts`, `orderEmailDraft.ts`) or PDF change. Manager, Transport and e-mail screens untouched.

## Verification

- Frontend: build and lint clean; vitest 978 tests, 3 failures that also fail on clean `origin/main` (localStorage: `stickyBulkReason` x2, ProductCard "English copy").
- Backend unaffected: pytest 1110 passed, ruff clean.
