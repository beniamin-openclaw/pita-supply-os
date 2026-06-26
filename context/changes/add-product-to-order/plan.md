# Implementation Plan: add-product-to-order

## Background

Backlog #5 from DEMO_FEEDBACK round-1. Allow a Captain or Manager to add a product to an
order that was not in the original submission — picking from the orderable list for the
supplier + location, constrained by the backend's existing validation seam.

## Goals

1. **Captain edit (OrderEditPage)** — add a product from `/api/captain/orderable` that is
   not already in the order being edited. Persists via the existing PATCH endpoint (replaces
   the full line set, so new lines are transparently included).
2. **Manager claimed (OrderDetailPane)** — add a product from a new `/api/manager/orderable`
   endpoint that is not already in the order. Persists via a new
   `POST /api/manager/order/{id}/add-line` endpoint (single-line append).

## Non-Goals (confirmed)

- CaptainMP new-submit: all orderable products are already shown as ProductCards. No change.
- Adding products not configured in `location_product_settings` for this supplier+location.
- Reason-code / deviation / critical-under gates for manager-added lines (orderable check
  only — the Manager has override authority on qty, same as today).

---

## Current State Analysis

### OrderEditPage (captain edit)

`items` state = only the saved order's lines (via `lineToItem`). `api.orderable` is NOT
fetched. Comment at top of file: "Scope deliberately narrowed — no add-product."

The existing PATCH endpoint (`captain_order_edit`) accepts any line in `OrderLineSubmit[]`
that passes `_evaluate_submit_line`. Adding a line from orderable to the PATCH payload
already works server-side — we just need the frontend to offer the picker.

### Manager (OrderDetailPane + OrderLineTable)

No add-product UI. `DraftMap` is keyed by `order_line_id`; `manager_order_save` (PATCH)
only updates existing line rows. A manager-added line must be persisted before the order
can be dispatched with it.

The manager token does not encode a location — so `/api/captain/orderable` (which derives
`location_id` from the captain token) is inaccessible. Need a manager-auth version.

### Backend orderable logic

`captain_orderable` in `main.py`:
1. `products_by_id`, `settings_by_pid` (filtered by `location_id`), `sps` filtered by
   `supplier_id AND product_id in settings_by_pid`.
2. Returns list of enriched dicts (purchase unit, rounding, targets…).

This logic can be extracted and shared with a manager-auth twin.

---

## API Contract

### New: `GET /api/manager/orderable`

```
Auth: require_manager
Query params: supplier_id (required), location_id (required)
Response: list[OrderableItem]  (same shape as /api/captain/orderable)
```

Returns products the Manager can add to an order at `location_id` from `supplier_id`.
No status restriction — used before claiming (to pre-fetch) or during claimed edit.

Implementation: identical logic to `captain_orderable`, but `location_id` is taken from the
query param (Manager token carries no location).

### New: `POST /api/manager/order/{order_id}/add-line`

```
Auth: require_manager
Path: order_id (string)
Body: ManagerAddLineRequest { product_id: str, supplier_product_id: str }
Response: ManagerAddLineResponse { order_id: str, order_line_id: str, status: OrderStatus }
```

Validation gates (deterministic):
- Order must exist → 404 otherwise.
- `order.status == manager_claimed` → 409 otherwise.
- `supplier_product_id` must be in the order's supplier's orderable list for
  `order.location_id` → 400 otherwise.
- `supplier_product.product_id == req.product_id` → 400 on mismatch.
- `product_id` must not already appear in `order.lines` → 400 (no duplicates).

On success:
- Generates `order_line_id = f"OL-{order_id}-M-{secrets.token_hex(3)}"`.
- Creates `OrderLine` with `captain_final_qty_purchase=0`, `manager_final_qty_purchase=0`,
  `current_stock_qty_base=0`, `suggested_qty_purchase=0`, `delta_vs_suggestion_pct=None`.
- Calls `backend.invalidate_cache("orders")`, `backend.append_order_lines([new_line])`.
- Returns confirmation; frontend re-fetches the order detail to pull the updated line set.

### New backend models

```python
class ManagerAddLineRequest(BaseModel):
    product_id: str
    supplier_product_id: str

class ManagerAddLineResponse(BaseModel):
    order_id: str
    order_line_id: str
    status: OrderStatus  # always manager_claimed on success
```

---

## Frontend Changes

### 1. Shared UI component: `AddProductPicker`

**File:** `frontend/src/components/ui/AddProductPicker.tsx`

A controlled combobox that filters `OrderableItem[]` by free-text and fires `onSelect`
when the user picks one. Closes on selection, Escape, or outside click.

```tsx
interface AddProductPickerProps {
  items: OrderableItem[];      // products available to add
  onSelect: (item: OrderableItem) => void;
  disabled?: boolean;
}
```

Display label per item: `"{product_name_pl} ({purchase_unit})"`.  
Shows `t("addProduct.empty")` when `items` is empty.  
Button renders `t("addProduct.button")` and hides itself when `items.length === 0`.

### 2. `OrderEditPage.tsx` — captain edit

**Changes:**

a. After the order loads (inside the existing `.then()` callback), fire a second fetch
   sequentially: `api.orderable(data.supplier_id)`. (`supplier_id` is only available once
   the order resolves, so this cannot run in parallel with the captainOrder call.)
   Store as `availableToAdd: OrderableItem[]` state (filter out any that share a
   `product_id` with `data.lines`).

b. Track added products in `items` and `lines` state (already happens — adding via
   `setItems` and `setLines` is identical to how the initial list is built).

c. Render `<AddProductPicker items={availableToAdd} onSelect={handleAddProduct} />`
   below the card list, above the `StickyActionBar`.

d. `handleAddProduct(item: OrderableItem)`:
   ```ts
   setItems(prev => [...prev, item]);
   setLines(prev => ({
     ...prev,
     [item.product_id]: {
       product_id: item.product_id,
       supplier_product_id: item.supplier_product_id,
       current_stock_qty_base: "",
       captain_final_qty_purchase: "",
     },
   }));
   setAvailableToAdd(prev => prev.filter(o => o.product_id !== item.product_id));
   // Scroll new card into view after next paint
   requestAnimationFrame(() => {
     document.getElementById(`card-${item.product_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
   });
   ```

e. Remove the "Scope deliberately narrowed" scope comment.

f. No draft persistence changes: edit mode already has no draft.

### 3. `ManagerPage.tsx`

**Changes:**

a. Add `orderableForSelected: OrderableItem[]` state (default `[]`).

b. After `api.managerOrder(id)` resolves (on order select or after add-line re-fetch):
   also call `api.managerOrderable(detail.supplier_id, detail.location_id)` if the order
   is `manager_claimed`. Store in `orderableForSelected`.

c. Compute `availableToAdd = orderableForSelected.filter(o => !detail.lines.some(l => l.product_id === o.product_id))`.

d. Add `handleAddLine(orderId: string, productId: string, supplierProductId: string)`:
   - Call `const resp = await api.managerAddLine(orderId, productId, supplierProductId)`.
   - On success: re-fetch `const newDetail = await api.managerOrder(orderId)`, call
     `setDetail(newDetail)`, then **merge** only the new line into the existing draft map
     — do NOT call `seedDrafts`, which creates a fresh map and wipes unsaved edits:
     ```ts
     setDrafts(prev => ({
       ...prev,
       [resp.order_line_id]: { qty: 0, comment: "" },
     }));
     ```
     (`resp.order_line_id` is provided by `ManagerAddLineResponse`; the new line starts at
     qty=0 / comment="" — the same baseline seedDrafts would produce for a zero-qty line.)
   - On error: show toast with error detail.

e. Pass `availableToAdd` and `onAddLine` as new props to `OrderDetailPane`.

### 4. `OrderDetailPane.tsx`

**Changes:**

a. Add props:
   ```ts
   availableToAdd: OrderableItem[];
   onAddLine: (orderId: string, productId: string, supplierProductId: string) => void;
   ```

b. Below `<OrderLineTable>`, when `editable && availableToAdd.length > 0`:
   ```tsx
   <AddProductPicker
     items={availableToAdd}
     onSelect={(item) => onAddLine(detail.order_id, item.product_id, item.supplier_product_id)}
   />
   ```

### 5. `apiClient.ts` — new entries

```ts
// Manager orderable (for manager add-line picker)
managerOrderable: (supplier_id: string, location_id: string) =>
  apiGet<OrderableItem[]>(
    `/api/manager/orderable?supplier_id=${encodeURIComponent(supplier_id)}&location_id=${encodeURIComponent(location_id)}`,
    "manager",
  ),

// Add a product line to a manager-claimed order
managerAddLine: (order_id: string, product_id: string, supplier_product_id: string) =>
  apiPost<ManagerAddLineResponse>(
    `/api/manager/order/${encodeURIComponent(order_id)}/add-line`,
    { product_id, supplier_product_id },
    "manager",
  ),
```

Add `ManagerAddLineResponse` to `frontend/src/types.ts`:
```ts
export interface ManagerAddLineResponse {
  order_id: string;
  order_line_id: string;
  status: OrderStatus;
}
```

---

## i18n Strings (`frontend/src/i18n/strings.ts`)

```ts
"addProduct.button":      { pl: "+ Dodaj produkt",           en: "+ Add product" },
"addProduct.placeholder": { pl: "Szukaj produktu…",          en: "Search product…" },
"addProduct.empty":       { pl: "Brak produktów do dodania", en: "No products to add" },
```

---

## Backend Tests

File: `supply-os-v1/tests/test_manager_add_line.py` (or extend
`test_manager_dispatch.py` / `test_captain_submit.py`).

Test matrix for `POST /api/manager/order/{id}/add-line`:
1. **Happy path** — adds a new orderable product to a `manager_claimed` order.
2. **404** — order does not exist.
3. **409** — order status is not `manager_claimed` (e.g. `captain_submitted`).
4. **400** — `supplier_product_id` not orderable for this supplier+location.
5. **400** — `product_id` already in `order.lines` (duplicate).
6. **400** — `product_id` / `supplier_product_id` mismatch.
7. **401** — captain token rejected (manager auth required).

Test matrix for `GET /api/manager/orderable`:
1. **Happy path** — returns same list as captain_orderable for the same supplier+location.
2. **Empty result** — valid supplier+location with no products.
3. **401** — no auth.

These tests use `SUPPLY_OS_DATA_BACKEND=seed` and mock/patch `_choose_backend` as per
existing test patterns. NO real supplier orders placed.

---

## Decision Notes

**Backend shape — dedicated append-one-line endpoint (adversary pair, 2026-06-26).**
Order-status / `order_lines` is hard-rule territory, so the direction was pressure-tested
before implementing. Alternatives weighed: (A) dedicated `POST …/add-line` that appends one
skeleton line via `append_order_lines`; (B) fold new-lines into the existing manager save
PATCH; (C) whole-set `replace_order_lines_atomic`. **Chose (A)** — it leaves the load-bearing
`manager_order_save` / dispatch / `captain_order_edit` paths untouched (smallest blast radius,
most reversible) and mirrors the existing manager-route preflight (`invalidate → get_order →
status-gate`). The atomicity gap (unconditional append, no `expected_status`) is **accepted**:
add-line requires `manager_claimed` while captain edit requires `captain_submitted` (mutually
exclusive → that race is impossible by construction), and the single-manager pilot makes
manager-vs-manager races nil. Carry-forward risk — a forgotten 0-qty skeleton line — is inert:
both email builders already skip zero-qty lines (`gmail_url._build_body`, `emailBody.ts`), it
carries `delta_vs_suggestion_pct=None` (never counts in deviation roll-ups), and receiving reads
its effective ordered qty as 0.

## Implementation Phases

### Phase 1 — Backend (endpoints + tests)

1. Extract `_build_orderable_items(backend, location_id, supplier_id) → list[dict]`
   helper in `main.py` (shared by captain + manager orderable routes).
2. Add `GET /api/manager/orderable` route using that helper + `require_manager`.
3. Add `ManagerAddLineRequest` and `ManagerAddLineResponse` models to `models.py`.
4. Add `POST /api/manager/order/{order_id}/add-line` route to `main.py`.
5. Write backend tests (`python -m pytest`; confirm all pass).

   > **Mock pattern required**: the add-line endpoint gates on `_is_persistent(backend)`;
   > the seed backend returns 503 before any business logic runs. Use the same mock
   > pattern as other manager write routes (see `test_manager_claim_release.py`
   > `_enable_sheet` helper): `mocker.patch.object(sheets.settings, "data_backend",
   > DataBackend.SHEET)` + `mocker.patch.object(sheets, "is_configured", return_value=True)`
   > + mock `get_order` / `invalidate_cache` / `append_order_lines`. Do NOT use the
   > seed backend for these tests.

### Phase 2 — Frontend: OrderEditPage

1. Add `availableToAdd: OrderableItem[]` state, fetch orderable in parallel with order load.
2. Implement `AddProductPicker` component in `src/components/ui/AddProductPicker.tsx`.
3. Wire `handleAddProduct` into `OrderEditPage` and render the picker below cards.
4. Add i18n strings.
5. Run `npm run lint` and `npm run build`.

### Phase 3 — Frontend: Manager

1. Add `managerOrderable` and `managerAddLine` to `apiClient.ts`.
2. Add `ManagerAddLineResponse` to `types.ts`.
3. Update `ManagerPage` (fetch orderable, `handleAddLine`, pass props).
4. Update `OrderDetailPane` (accept + render picker).
5. Run `npm run lint` and `npm run build`.

### Phase 4 — Verify & deploy

1. `/verify` — backend tests green, lint clean, frontend build clean.
2. Merge to main → Railway auto-deploys backend → Vercel auto-deploys frontend.
3. Confirm new Vercel production bundle hash from the merge commit.
4. Live-test on prod (captain edit + manager claimed, both surfaces).

---

## Progress

### Phase 1: Backend

- [x] 1.1 `_build_orderable_items` helper extracted; existing captain_orderable uses it
- [x] 1.2 `GET /api/manager/orderable` returns correct items for supplier+location
- [x] 1.3 `ManagerAddLineRequest` + `ManagerAddLineResponse` models added to models.py
- [x] 1.4 `POST /api/manager/order/{id}/add-line` happy path (201)
- [x] 1.5 add-line rejects non-claimed order → 409
- [x] 1.6 add-line rejects duplicate product → 400
- [x] 1.7 add-line rejects non-orderable supplier_product → 400
- [x] 1.8 `python -m pytest` green (416 passed, 16 deselected) + new add-line tests

### Phase 2: Frontend — OrderEditPage

- [x] 2.1 `AddProductPicker` component renders, filters by text, fires onSelect
- [x] 2.2 Picker appears below cards; hides itself when items list is empty
- [x] 2.3 Adding a product appends its card, removes it from picker
- [x] 2.4 `npm run lint` + `npm run build` clean

### Phase 3: Frontend — Manager

- [x] 3.1 `managerOrderable` + `managerAddLine` added to `apiClient.ts`
- [x] 3.2 `ManagerAddLineResponse` added to `types.ts`
- [x] 3.3 `ManagerPage` fetches orderable after order loads (claimed only)
- [x] 3.4 `handleAddLine` merges new line into existing drafts (no seedDrafts)
- [x] 3.5 `OrderDetailPane` accepts `availableToAdd` + `onAddLine`; renders picker when editable
- [x] 3.6 `npm run lint` + `npm run build` clean

### Phase 4: Verify & deploy

- [x] 4.1 `/verify` clean (backend tests + lint + frontend build) — 417 pytest + ruff, 83 vitest + eslint + build; proof in verification/
- [ ] 4.2 Merge → confirm Railway auto-deploy + new Vercel bundle hash  (stop boundary — user drives push)
- [ ] 4.3 Live prod test: captain edit — add product, submit  (post-deploy)
- [ ] 4.4 Live prod test: manager claimed — add product, save, dispatch  (post-deploy)
