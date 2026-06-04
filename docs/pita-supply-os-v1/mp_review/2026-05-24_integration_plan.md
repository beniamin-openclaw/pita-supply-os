# MP Captain UI — Backend Integration Plan

Date: 2026-05-24
Source: Magic Patterns generated zip (id `ea09d61c-8332-47a4-b619-4c1bb324afec`)
Reviewer: general-purpose sub-agent (Claude)

## TL;DR

**Adapter layer needed? YES** — but lightweight. MP types are ~80% renames + a few semantic shims. Keep MP's components (visual layer is good) but rewrite `types.ts`, `apiClient.ts`, `storage.ts`, `Captain.tsx` page-shell, and `dates.ts`. Replace MP `AuthModal` with our `AuthGate`. Drop `@emotion/react` (unused). Add `lucide-react` to our `package.json`.

## 1. Field-name mismatches

### `Supplier` (MP `types.ts:1-6` vs backend `models.py:55-64`)

| MP field | Backend field |
|---|---|
| `id` | `supplier_id` |
| `name` | `supplier_name` |
| `delivery_days: number` | `delivery_days?: string` (semantic mismatch) |
| `cutoff_time: string` | `cutoff_time?: string` (optional in backend) |

### `Location` (MP `types.ts:8-11` vs backend `models.py:67-73`)

| MP field | Backend field |
|---|---|
| `id` | `location_id` |
| `display_name` | `location_name` |

### `OrderableItem` (MP `types.ts:13-24` vs backend `main.py:101-115`)

| MP field | Backend field |
|---|---|
| `title` | `product_name_pl` |
| `target` | `target_stock_qty_base` |
| `max` | `max_stock_qty_base` |
| `location_id` | **NOT RETURNED** (location implicit in token) |
| — | `min_stock_qty_base` (extra) |
| — | `rounding_rule` (extra) |
| — | `allow_over_max_due_to_packaging` (extra) |
| `product_id`, `supplier_product_id`, `inventory_unit`, `is_critical`, `purchase_unit`, `units_per_purchase_unit` | match ✓ |

### `OrderLine` → `OrderLineSubmit` (backend)
Field names match. ✓ MP allows `| ''` for empty — must coerce before submit.

### `SubmitResponse` matches `CaptainSubmitResponse` ✓

## 2. Semantic mismatches (need code logic changes, not just renames)

- **`Supplier.delivery_days`**: MP types as `number` and does arithmetic (`dates.ts:21,33`); backend returns `string | null` (e.g. `"Tue,Fri"` or `"2"`). **Cannot do `today + delivery_days`** without parsing. Hard break.
- **`OrderableItem.target` / `max`**: Same value/unit as backend fields — pure rename.
- **`is_critical`**: backend OR-combines location + product flag (`main.py:105`). MP uses as-is. ✓
- **`location_id` on items**: Backend deliberately doesn't return it. MP's `Captain.tsx:55-63` flow to resolve `locationName` **will throw**. Workarounds: stub `locationName=''`, OR add `/api/whoami` endpoint.

## 3. Endpoint contracts

- `GET /api/suppliers` → shape OK, field renames needed
- `GET /api/locations` → ditto
- `GET /api/captain/orderable?supplier_id=…` → path OK, renames + extras
- `POST /api/captain/submit` → payload `{supplier_id, requested_delivery_date, lines, notes}` matches `CaptainSubmitRequest`. ✓
- **MP never calls `/api/captain/suggest`** — does math client-side. OK to keep.

## 4. Auth flow

- **Event name**: MP fires `auth:unauthorized`; ours expects `supply_os_auth_invalid` with `detail: { role }`. → Replace MP's apiClient with ours.
- **Auth UI**: MP `AuthModal.tsx` is naive password box. Our `AuthGate.tsx` has `sanitizeTokenInput` (strips WOLA: prefix, env-var noise) + `validateToken`. → Keep our `AuthGate`.
- **No role separation** in MP. Our `auth.ts` uses `Role = "captain" | "manager"`. Wire MP's calls to `role: "captain"`.

## 5. Token storage

- Key match ✓ (`supply_os_captain_token`)
- Draft prefix match ✓ (`supply_os_captain_draft_`)
- Draft payload shape differs: MP `{lines, timestamp}` vs ours `{supplier_id, saved_at, state}`. → Replace MP's `storage.ts` with our `saveDraft`/`loadDraft`/`clearDraft`.

## 6. Dependency conflicts

| Dep | MP | Ours | Action |
|---|---|---|---|
| `react` | 18.3 | 19.2 | Keep 19. MP components compatible (no `forwardRef`, no `defaultProps`). |
| `react-router-dom` | 6.26 | 7.15 | MP `Captain.tsx` doesn't import router. No change. |
| `tailwindcss` | 3.4 | 4.3 | All MP utility classes work in v4. Add `.hide-scrollbar` to `index.css`. |
| `lucide-react` | 0.522 | absent | **Add `lucide-react@^0.469`** (3 icons used: Clock, Menu, Check + new state icons) |
| `@emotion/react` | 11.13 | absent | **Skip** — not actually imported in any reviewed file. |

## 7. Component-level disposition

| File | Action |
|---|---|
| `types.ts` | Drop MP version, use our `frontend/src/types.ts`. Map at boundary in `apiClient`. |
| `lib/apiClient.ts` | Drop, use our `apiClient.ts`. |
| `lib/storage.ts` | Drop, use our `auth.ts`. |
| `lib/dates.ts` | Rewrite — handle string/null `delivery_days`, null `cutoff_time`. Polish microcopy in `getCutoffDisplay`. |
| `lib/compute.ts` | Patch — rename `item.target` → `item.target_stock_qty_base`. Optionally use `max_stock_qty_base` cap. |
| `pages/Captain.tsx` | Patch — kill `location_id` lookup (l55-63). Migrate `supplier.id`→`supplier_id`, `supplier.name`→`supplier_name`. Use our `saveDraft`/`loadDraft`. Convert `apiClient.get/post` to our `api` shortcuts. |
| `components/Header.tsx` | Patch — keep lucide Menu (now we have lucide), Polish microcopy. |
| `components/SupplierPicker.tsx` | Patch — `supplier.id`→`supplier_id`, `name`→`supplier_name`. |
| `components/ContextStrip.tsx` | Patch — `supplier.name`→`supplier_name`. Handle null cutoff/string delivery_days. |
| `components/ProductCard.tsx` | Patch — `item.title`→`item.product_name_pl`, `target`→`target_stock_qty_base`, `max`→`max_stock_qty_base`. + A11y BLOCKERs. |
| `components/ReasonPicker.tsx` | Keep + a11y patches (B4: aria-invalid). Hide comment field until OTHER selected. |
| `components/StickyActionBar.tsx` | Polish microcopy (BLOCKER A1) + touch targets (≥44px). |
| `components/SkeletonCard.tsx` | Keep + add left border accent. |
| `components/Toast.tsx` | Patch — a11y BLOCKER B2 (role + aria-live + close button). |
| `components/AuthModal.tsx` | **Delete** — replaced by our `AuthGate`. |

## 8. Order of operations

1. **Stay in current lane** `claude/romantic-elbakyan-3d712b`. Same Captain initiative.
2. **Mount under new route** `frontend/src/pages/captain-mp/` — keep existing `/captain` placeholder for rollback.
3. **Copy MP `components/` and `lib/{compute,dates}.ts`** into `frontend/src/pages/captain-mp/components/` and `.../lib/`. Skip `apiClient.ts`, `storage.ts`, `AuthModal.tsx`, `types.ts`.
4. **Add `lucide-react`** to `frontend/package.json` deps. Run `npm install`.
5. **Add `.hide-scrollbar`** rules to `frontend/src/index.css`.
6. **Apply field-name patches** mechanically per file. Compile must pass.
7. **Wire `Captain.tsx`** to our `api` object — replace `apiClient.get/post` calls 1:1. Delete location-resolution block (l55-63), stub `locationName=''`.
8. **Wire `dates.ts`** — write `parseDeliveryDays(s: string|null|undefined): number` helper (return `1` on null/empty/non-numeric for now; TODO richer day-name parsing).
9. **Mount under route** `/captain-v2` in `App.tsx`, wrap with `<AuthGate role="captain">`.
10. **E2E smoke** on new route with real Pago supplier from WOLA token; verify submit creates order row.
11. **Cutover** `/captain` to new component only after smoke passes; keep old importable for one commit as rollback.
