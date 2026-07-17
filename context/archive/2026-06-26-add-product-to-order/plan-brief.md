# Plan Brief: add-product-to-order

**Status:** planned | **Complexity:** MEDIUM | **Phases:** 4

## What

Allow Captain (on edit screen) and Manager (on a claimed order) to add a product from the
orderable list that was not in the original submission.

**CaptainMP new-submit: no change** — all orderable products are already shown as cards.

## Key decisions

| Decision | Choice |
|---|---|
| CaptainMP submit | Skip — already covered |
| Manager backend | New `POST /api/manager/order/{id}/add-line` endpoint |
| Validation for manager add | Orderable check only (no captain deviation/reason gates) |
| Picker UI | Inline `+ Dodaj produkt` button + searchable dropdown |
| Manager input at add time | Pick product only; qty=0 row appears in table for editing |

## New backend surface

- `GET /api/manager/orderable?supplier_id=&location_id=` — manager-auth twin of captain orderable
- `POST /api/manager/order/{id}/add-line` — appends a skeleton OrderLine (all zeroes); Manager fills qty via table + save
- Models: `ManagerAddLineRequest`, `ManagerAddLineResponse` (in `models.py`)
- Helper: `_build_orderable_items(backend, location_id, supplier_id)` extracted to DRY the two routes

## New frontend surface

- `src/components/ui/AddProductPicker.tsx` — shared combobox used in both captain edit and Manager
- `OrderEditPage.tsx` — fetch orderable in parallel with order load; render picker below cards
- `ManagerPage.tsx` — fetch orderable after order loads (if claimed); handle `addLine`; re-fetch detail on success
- `OrderDetailPane.tsx` — render picker below `OrderLineTable` when editable
- `apiClient.ts` — `managerOrderable` + `managerAddLine`
- `types.ts` — `ManagerAddLineResponse`
- `i18n/strings.ts` — 3 new string keys (`addProduct.button/placeholder/empty`)

## Phases

1. **Backend** — extract helper; add orderable + add-line routes; tests
2. **Frontend: OrderEditPage** — AddProductPicker component + captain-edit wiring
3. **Frontend: Manager** — ManagerPage + OrderDetailPane wiring
4. **Verify + deploy** — `/verify`, merge → auto-deploy, confirm bundle hash, live-test on prod
