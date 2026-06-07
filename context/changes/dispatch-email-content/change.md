---
change_id: dispatch-email-content
title: Dispatch email — subject "Zamówienie {location}" + supplier-facing product names
status: implementing
created: 2026-06-07
updated: 2026-06-07
archived_at: null
---

## Notes

Owner-flagged during the S-02 smoke and deferred as a separate change (chip `task_ffe7ae5f`). The dispatch email must:

1. Use subject **`Zamówienie {location_name}`** (e.g. "Zamówienie Pita Bros Wola") instead of the current `Zamowienie {order_id} - {supplier_name} - dostawa {date}`.
2. List the **supplier-facing product name** (`supplier_product_name`) in the body, not the internal `product_name_pl` / `product_id` — the supplier cannot read our internal names.

Two parallel builders change together (the S-02 NOTE contract): backend `supply-os-v1/app/gmail_url.py` (feeds `gmail_compose_url`, session-only re-open link) + frontend `frontend/src/pages/manager/lib/emailBody.ts` (the authoritative draft the operator sends). Plus backend unit tests `supply-os-v1/tests/test_gmail_url.py`.

Order id + delivery date stay in the BODY (subject is intentionally simplified for the supplier). Suggest-only / hard-rule untouched — no dispatch flow change, pure content. Autonomous run: self-decided, unit-tested, back-out-safe.
