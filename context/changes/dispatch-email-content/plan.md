# Plan — Dispatch email content: subject + supplier-facing names

- **Change**: `context/changes/dispatch-email-content/`
- **Status**: planned (self-reviewed — autonomous run)
- **Chip**: task_ffe7ae5f

## Desired End State

A dispatched order's email (both the backend `gmail_compose_url` and the authoritative frontend draft) opens with:

- **Subject** = `Zamówienie {location_name}` (e.g. `Zamówienie Pita Bros Wola`). No order_id / supplier / date in the subject.
- **Body** product lines labelled with the **supplier-facing** `supplier_product_name`, never the internal `product_name_pl` or `product_id`.

Order id, total, delivery date, address stay in the body unchanged. The dispatch flow, status workflow, and the hard rule (no real orders from tests) are untouched.

## Current State Analysis

- `supply-os-v1/app/gmail_url.py`
  - `_build_subject` → `f"Zamowienie {order.order_id} - {supplier.supplier_name} - dostawa {delivery}"` (gmail_url.py:38).
  - `_build_body` labels each line with `product.product_name_pl` (gmail_url.py:89). It already looks up the `SupplierProduct` via `products_by_id.get(line.supplier_product_id)` for `purchase_unit` (gmail_url.py:93), so `supplier_product_name` is reachable in the same dict. `location` is already a parameter → `location.location_name` available.
- `frontend/src/pages/manager/lib/emailBody.ts`
  - `buildEmailSubject` mirrors the old Python subject (emailBody.ts:39). `detail.location_name` is available (required on `ManagerOrderDetail`).
  - `buildEmailBody` labels each line with `line.product_name_pl` (emailBody.ts:75). `ManagerOrderLineDetail.supplier_product_name` is available (types.ts:73).
- `supply-os-v1/tests/test_gmail_url.py` — several tests assert the OLD subject (order_id + supplier_name + date) and the internal `product_name_pl` in the body. These must move to the new contract.

Fallbacks (deliberate): subject uses `location_name`, else `order.order_id` (backend `location` is Optional). Body name uses `supplier_product_name`, else `product_name_pl`, else `product_id`.

## Phase 1: Subject + body in both builders + tests

Single phase — the two builders must change together (S-02 NOTE contract); landing them split would diverge the emails.

### Changes Required

1. **`supply-os-v1/app/gmail_url.py`**
   - `_build_subject(order, supplier, location)`: return `f"Zamówienie {location.location_name}"` when `location` else `f"Zamówienie {order.order_id}"`. Pass `location` through from `build_draft_url`.
   - `_build_body`: prefer `sp_entry.supplier_product_name` → `product.product_name_pl` → `line.product_id` for the line label; keep `purchase_unit` fallback chain for the unit.
   - Update module docstring + the S-02 NOTE to the new subject/body contract.

2. **`frontend/src/pages/manager/lib/emailBody.ts`**
   - `buildEmailSubject`: `` `Zamówienie ${detail.location_name}` ``.
   - `buildEmailBody`: label = `line.supplier_product_name || line.product_name_pl`.
   - Update the NOTE + JSDoc to match.

3. **`supply-os-v1/tests/test_gmail_url.py`**
   - `_make_sp`: add optional `name` param → `supplier_product_name`.
   - Rewrite the subject test → assert `Zamówienie {location_name}` (with location) + `Zamówienie {order_id}` fallback (location None); assert order_id absent when location present.
   - Update body tests to assert `supplier_product_name` (and add an assertion the internal `product_name_pl` is absent when it differs — locks the requirement).
   - Drop the subject delivery-date assertions from `test_build_url_includes_delivery_date_or_TBD` (date now body-only).

### Success Criteria

#### Automated Verification:
- [ ] `cd supply-os-v1 && python -m pytest tests/test_gmail_url.py` passes.
- [ ] `cd supply-os-v1 && python -m pytest` full suite green (no collateral break).
- [ ] `cd supply-os-v1 && ruff check .` clean.
- [ ] Frontend `tsc --noEmit` + `eslint` (no new findings) + `vite build` on Homebrew node.

#### Manual Verification:
- [ ] Owner eyeballs a real dispatch draft tomorrow: subject reads `Zamówienie Pita Bros Wola`, body shows supplier product names. (Back-out on submit — no real order.)

## What We're NOT Doing

- No change to the dispatch flow, status workflow, recipient resolution, or the 8000-char Gmail guard.
- Not touching the queue/detail panels or `manager_dispatch` itself (it already passes `location` + the merged products dict).
- Not adding a new i18n string (subject/body are Polish plaintext built in these two builders, not via `STRINGS`).

## Progress

### Phase 1: Subject + body in both builders + tests

#### Automated
- [x] 1.1 gmail_url.py subject → `Zamówienie {location_name}` (+ fallback)
- [x] 1.2 gmail_url.py body → supplier_product_name (+ NOTE/docstring)
- [x] 1.3 emailBody.ts subject + body → location_name / supplier_product_name (+ NOTE)
- [x] 1.4 test_gmail_url.py updated to new contract; `pytest tests/test_gmail_url.py` green
- [x] 1.5 full backend pytest + ruff green
- [x] 1.6 frontend tsc + eslint + build green

#### Manual
- [ ] 1.7 Owner verifies a real draft tomorrow (subject + supplier names), back-out on submit
