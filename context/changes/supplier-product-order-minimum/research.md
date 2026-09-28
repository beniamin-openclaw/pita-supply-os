---
date: 2026-09-28T12:59:49+02:00
researcher: Claude (Opus 5.5)
git_commit: 122a9c87ae2d975234cfeab03aa21bc225a80280
branch: claude/xenodochial-cerf-3c59f5
repository: pita-supply-os
topic: "Per-supplier product display order on every screen/document, and Bukat logistic-minimum exclusions"
tags: [research, codebase, supplier_products, ordering, minimum-order, gmail_url, emailBody, transport, inventory]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude (Opus 5.5)
---

# Research: per-supplier product display order + logistic-minimum exclusions

**Date**: 2026-09-28T12:59:49+02:00
**Git Commit**: 122a9c8 (main after PR #34)
**Branch**: claude/xenodochial-cerf-3c59f5

## Research Question

Operator feedback (Marek, 28.09): (a) product order per supplier must be the same on
every screen and document; (b) Bukat's logistic minimum (500 PLN) must not count
Tzatzyki (P011), Tirokafteri/Hot Feta (P012) and Feta blok (P014). The minimum stays
informational, never a gate. Where does ordering happen today, what does the minimum
chip see, and what is the smallest principled change?

## Summary

1. **There is no "name" sort on the Captain order screen.** The lane's `change.md`
   assumption was wrong: `CaptainMP.tsx:807` renders `api.orderable()` in API order,
   and the backend emits `supplier_products` in `ORDER BY supplier_product_id`
   (`supabase_backend.py:322`). `productListFilter.ts` (default sort "name") is used
   only by the Manager inventory view; the Captain count grid calls
   `filterProductRows` only, which preserves input order.
2. **Today's de-facto order is `supplier_product_id`, and it carries meaning.** Prod
   `by_sp_id` listings group Blue Service (bowls → sauce cups → bags → foils → cutlery
   → chemicals → gloves XL/L/M/S…), Intermlecz (dairy → frozen → oils → sauces →
   spices → sachets) and Coca-Cola by type. An alphabetical tie-break would scatter
   those 50- and 31-item lists (gloves would read L, M, S, XL). Bukat's current
   `sp_id` order (Cytryna, Papryka, Awokado, Ogórek, Pomidor, …) is what the
   operator wants replaced.
3. **The stored order already follows the Captain screen.** Submit numbers
   `OL-{order}-{idx:03d}` in payload order = screen order (`main.py:704`,
   `buildPayloadLines.ts:18`); every surface that sorts by `order_line_id` (e-mail FE
   + BE, dispatch/resend copy lists, Manager detail, Captain detail, receiving)
   inherits the Captain screen's order at submit time. Manager-added lines (`-M-hex`)
   and Transport prefill lines (`-P-NNN`) sort after the numbered ones. Transport
   aggregate and matrix sort by **name** instead (BE code-point order, FE pl
   collation — they already disagree on diacritics).
4. **The minimum chip only ever sees the server's stored `total_value_estimate_pln`**
   on three screens (Manager queue, Manager order detail, Captain order detail); it
   renders only when "below". The Captain new-order screen shows no money by design.
   The queue item has no lines, so a basis that excludes products must be computed
   server-side; `manager_queue` already loads the page's lines (F-7) but not
   `supplier_products`.
5. **Impact of (b) on real data:** of the last 15 Bukat orders in prod (15–28 Sept),
   12 have total ≥ 500 PLN; after excluding P011/P012/P014, 8 of those 12 fall below
   500 (e.g. WOLA 28.09: 756.80 → 341.80). Only BROWARY 27.09 (562.00), WOLA 25.09
   (556.20), BROWARY 24.09 (544.10) and BROWARY 17.09 (503.20, no excluded line) stay
   above. The chip
   will therefore start showing "below" on most Bukat orders — which is exactly the
   information the operator asked for, but worth announcing.

## Detailed Findings

### Current order per surface

| Surface | Code | Order today | Row type |
|---|---|---|---|
| Captain new order | `frontend/src/pages/captain-mp/CaptainMP.tsx:229-233, 807` | API order (no FE sort) | `OrderableItem` |
| Captain edit | `OrderEditPage.tsx:143` `[...orderable, ...missing]`, render `:289` | API order, missing (no-longer-orderable) lines appended | `OrderableItem` (via `lineToItem` `:37-61` fallback) |
| Captain order detail | `OrderDetailPage.tsx:255` | backend line order | `ManagerOrderLineDetail` |
| Captain receiving | `ReceiveDeliveryPage.tsx:264` | backend line order; submit `:117` in same order | `ManagerOrderLineDetail` |
| Manager order table | `OrderLineTable.tsx:97` via `OrderDetailPane.tsx:194-201` | backend line order | `ManagerOrderLineDetail` |
| Manager add-line picker | `ManagerPage.tsx:133-137, 369-373`, `AddProductPicker.tsx:104` | orderable API order | `OrderableItem` |
| Manager delivery section | `DeliverySection.tsx:65` | backend receipt-line order | `ManagerOrderReceiptLine` |
| Dispatch e-mail (authoritative) | `pages/manager/lib/emailBody.ts:77-79` | `order_line_id` | `ManagerOrderLineDetail` |
| Dispatch e-mail BE twin | `supply-os-v1/app/gmail_url.py:83-84` | `order_line_id` | `OrderLine` + merged `products_by_id` incl. `SupplierProduct` |
| Portal/phone copy list | `DispatchPanel.tsx:82-91` (sort `:85`) | `order_line_id` | `ManagerOrderLineDetail` |
| Post-send "dosyłka" copy list | `ResendPanel.tsx:61-72` (sort `:64`) | `order_line_id` | `ManagerOrderLineDetail` |
| Transport aggregate (BE) | `main.py:3935` | `product_name_pl` (code-point) | `TransportAggregateLine` |
| Transport matrix (draft editor) | `transport.ts:302-324` (sort `:322`) | name (pl), manager-added rows pinned below (v5.1 decision) | `ManagerOrderLineDetail` |
| Transport add-all options | `transport.ts:336-351` | name (pl) | `OrderableItem` |
| Transport driver/Pago docs, e-mail | `transport.ts:153, 199, 745-759, 921-938` | aggregate order (no FE sort) | `TransportAggregateLine` |
| Transport sent view | `TransportPage.tsx:733-746, 1333, 1363` | aggregate order | `TransportAggregateLine` |
| Captain count grid + edit | `InventoryCountPage.tsx:345`, `InventoryCountEditPage.tsx:128`, `lib/inventoryGrouping.ts:21-37` | API order (`location_product_settings ORDER BY setting_id` = `LOC__Pnnn`), categories first-seen | `InventoryProduct` (primary supplier only) |
| Manager inventory detail | `ManagerInventoryPage.tsx:51-58`, `productListFilter.ts:56-63, 143-188` | user-selected view; default group=category, sort=name | `InventoryCountDetailLine` |
| Captain inventory history | `InventoryHistoryPage.tsx:118-132` | `count_line_id` (= grid order at submit) | `InventoryLatestLine` |
| Manager inventory CSV | `inventoryCsv.ts:163` | `count_line_id` | `InventoryCountDetailLine` |

Out of scope (not per-supplier product lists): finance compare pane, suggestion review, orders lists.

### Backend producers

- `_build_orderable_items` `main.py:223-274` (+ `_build_orderable_item` `:191-220`,
  plain dict, no response model): output follows `load_supplier_products()`. Feeds the
  Captain screen, Manager `/orderable`, add-line membership check and Transport
  prefill (line ids `OL-{order}-P-{idx:03d}` at `main.py:4942-4960`).
- `manager_order_detail` `main.py:1108-1145` enriches lines **inline** (does not call
  `_enrich_lines_for_detail`); `sps_by_id` is loaded at `:1096`.
- `_enrich_lines_for_detail` `main.py:1211-1262`: Captain detail (`:1374`) and Transport
  member orders (`:4270`).
- `_load_order_receipts` `main.py:1002-1075` and `captain_receipt_detail` `:3618-3688`:
  receipt lines in `receipt_line_id` order.
- `_aggregate_transport_lines` `main.py:3838-3936`: `sps_by_id` is already a parameter.
- `captain_inventory_products` `main.py:2586-2636`: iterates settings in `setting_id`
  order; primary supplier product via `_primary_supplier_product` `:2551-2579`
  (lowest active `supplier_product_id`, `SUP_INTERNAL` skipped when another exists).
- `_enrich_inventory_count_detail` `main.py:3083-3145` gets `primary_sp_by_pid` from
  `manager_inventory_count_detail` `:3208-3278`.
- `gmail_url._build_body` `gmail_url.py:59-150`: `products_by_id` already contains the
  `SupplierProduct` entries keyed by `supplier_product_id` (dispatch merges them at
  `main.py:2049`), so `display_order` is reachable without new plumbing.

### Schema seam

- `SupplierProduct` `models.py:105-145`; last field `warehouse_pickup: bool = False`
  with the comment explaining why a NOT NULL boolean must be `bool = <default>`, not
  `Optional` (`_insert` binds every column from `model_dump()`).
- `_SUPPLIER_PRODUCT_COLUMNS` `supabase_backend.py:107-112` — used by `_insert` /
  `_insert_many`, the integration fixture (`tests/test_supabase_integration.py:206-212`)
  and `scripts/backfill_supabase.py:35-36`. Reads are `SELECT *`, so **old code tolerates
  the new columns and new code tolerates their absence** (model defaults apply).
- Sheets (`sheets.py:147-164, 203-228, 273-274`) and seed (`seed_loader.py:32-59`) both
  drop empty/missing columns and fall back to the Pydantic default. The seed CSV
  (`docs/pita-supply-os-v1/seed/supplier_products.csv`) already lacks four later
  columns; Bukat rows are lines 42-55 (+ inactive `SP_BUKAT_P135` at 136).
- Migration conventions (0006, 0012, 0015, 0022): banner header, `ADD COLUMN IF NOT
  EXISTS`, commented rollback, **no percent sign** (psycopg2 `exec_driver_sql` treats it
  as a parameter marker), applied on prod before the code deploy.
- Integration fixture `_schema` (`tests/test_supabase_integration.py:68-221`) reads each
  migration into a variable and runs it explicitly (`:90-191`); 0022 is last. PR #33
  (0021) edits the same block → expect a trivial merge conflict.
- CI `backend-integration` job (`.github/workflows/ci.yml:33-69`) has no migration step;
  the fixture applies them.

### Minimum order

- `frontend/src/lib/minimumOrder.ts:35-42` `checkMinimumOrder(total, minimum)`, 400 PLN
  fallback (`:13`), header forbids gating. Only caller: `components/ui/MinimumOrderChip.tsx:28`
  (renders only when "below", `:30`). Chip props are plain numbers.
- Rendered at `ManagerQueue.tsx:242-245`, `OrderDetailPane.tsx:261-264`,
  `captain-mp/OrderDetailPage.tsx:220-223` — all with the server total.
- i18n: `minOrder.below` (`strings.ts:71-74`) "Poniżej progu zamówienia (min. {minimum} PLN)".
- Server totals: Σ qty × `price_estimate_pln` (0 when no price). Submit
  `main.py:604-608, 663-710`; captain edit `:1464-1514`; manager save `:2146-2183`
  (touched → payload qty, else stored manager_final if > 0, else captain_final);
  dispatch `:2003-2028` (touched → payload, else captain_final). The stored total is a
  **price snapshot**; stored `manager_final = 0` is ambiguous (zeroed vs unset) app-wide.
- Minimum joined at `manager_queue` `:972-974`, `manager_order_detail` `:1196`,
  `captain_order_detail` `:1392`. Queue loads lines (`:902-905`), suppliers, locations —
  not `supplier_products`; test harnesses already patch `load_supplier_products`
  (`test_manager_queue.py:164-169`, `test_manager_receiving.py:155`).
- Prod check (read-only SELECT): for all 15 recent Bukat orders the stored total equals
  Σ effective qty × current price, i.e. no price drift in practice.

### Prod master data (read-only SELECTs, 2026-09-28)

- `supplier_products` columns end at `warehouse_pickup`; no order/min column exists.
- SUP_BUKAT: 14 active rows P002–P018 exactly matching the operator list, plus inactive
  `SP_BUKAT_P135` (Bombilla, product inactive). P011 `pojemnik`×3, P012 `wiadro`×2,
  P014 `szt`×2 (names/units are being changed in a parallel session — ids are stable).
- `suppliers.minimum_order_value_pln`: BUKAT 500, BLUESERV 500, COCACOLA 500,
  INTERMLECZ 650, KUCHNIE 600; others NULL.
- Applied migrations on prod end at `0022_supplier_suggestion_alerts`.

## Code References

- `frontend/src/pages/captain-mp/CaptainMP.tsx:807` — orderable render, no sort
- `frontend/src/pages/manager/lib/emailBody.ts:77-79` — e-mail sort by `order_line_id`
- `supply-os-v1/app/gmail_url.py:83-84` — BE twin sort
- `frontend/src/pages/manager/DispatchPanel.tsx:85`, `ResendPanel.tsx:64` — copy-list sorts
- `frontend/src/pages/manager/lib/transport.ts:322, 348-350` — matrix / add-all name sorts
- `supply-os-v1/app/main.py:3935` — transport aggregate name sort
- `supply-os-v1/app/main.py:223-274` — orderable producer
- `supply-os-v1/app/main.py:1108-1145, 1211-1262` — the two line-enrichment copies
- `supply-os-v1/app/main.py:853-999` — `manager_queue`
- `supply-os-v1/app/models.py:105-145` — `SupplierProduct`
- `supply-os-v1/app/supabase_backend.py:107-112` — `_SUPPLIER_PRODUCT_COLUMNS`
- `supply-os-v1/tests/test_supabase_integration.py:68-221` — migration fixture
- `frontend/src/lib/minimumOrder.ts`, `frontend/src/components/ui/MinimumOrderChip.tsx`

## Architecture Insights

- **One comparator, keyed on ids, is the only way to make the FE/BE e-mail twins
  byte-identical.** Python has no Polish collation; `supplier_product_id` is ASCII, so
  `(display_order NULLS LAST, supplier_product_id)` compares identically in both
  languages. A name tie-break would reintroduce the code-point vs `localeCompare("pl")`
  split the Transport code already has.
- **Sorting at read time, not by rewriting line ids**, makes historical orders render in
  the new order too; line ids stay opaque identifiers.
- **Every order line carries `supplier_product_id`**, so the tie-break never needs a
  master-data join; only `display_order` does, and every enrichment path already holds
  `sps_by_id`.
- **Location-wide lists (inventory) span suppliers.** A per-supplier position only
  orders rows within one supplier; a location-wide list needs a supplier-block key first.
  Meeting 2026-09-18 §2.6: Sławek sorts the inventory "A→Z, żeby mieć Blue Service w
  jednym bloku, w kolejności jak zamawia" — i.e. supplier block + ordering order.

## Historical Context (from prior changes)

- `context/changes/week2-feedback-quantities/meeting-2026-09-18.md:38` — first Bukat
  order request (different sequence; superseded by Marek's 28.09 list); `plan.md:126`
  deferred "`sort_order` for Bukat" to a follow-up.
- `context/archive/2026-09-01-training-feedback-0901/plan.md:46-47, 144-154, 325-326` —
  minimum is information only, joined server-side, "no server-side reader — the no-gate
  property is structural"; prices are not exposed on the Captain entry screen.
- `context/archive/2026-09-05-rolki-minima-master-data/plan.md:34-35, 165-167, 202` —
  Bukat 500 is a soft minimum ("za 300 też dowiozą").
- `context/archive/2026-08-21-to-ordering-pago/plan.md:71, 394` — transport lists sorted
  by name; v5.1 pins manager-added matrix rows below the base, in add order.
- `context/changes/pago-suggestion-no-alerts/` — closest precedent: per-supplier flag in
  master data (not hardcoded), migration 0022, `prod-sql.sql` diff/apply/audit/rollback.
- `context/archive/2026-06-05-bukat-master-data-ready/audit.md:33-35` — P011/P012/P014
  are fixed packs with `allow_over_max`.

## Related Research

- `context/archive/2026-09-01-training-feedback-0901/research.md` (minimum indicator)
- `context/changes/week2-feedback-quantities/plan.md` Phase 4 (product list view)

## Open Questions (for the plan / operator)

1. **Tie-break for products without a position**: `supplier_product_id` (keeps every
   other supplier's current Captain screen order, twin-safe) vs name (the lane's
   proposal; reshuffles Blue Service / Intermlecz alphabetically). Recommendation:
   `supplier_product_id`.
2. **Minimum basis formula**: "stored total − Σ excluded lines × current price" (anchored
   to the displayed total, errs toward warning) vs "Σ eligible lines × current price"
   (independent of the snapshot, can miss a warning when a line was zeroed).
   Recommendation: the former, `None` when an order has no excluded line.
3. **Inventory scope**: apply supplier-block + ordering order to the Captain count grid
   and offer it as a sort in the Manager inventory view, or leave inventory untouched.
4. **Transport matrix**: keep the v5.1 "manager-added rows at the bottom" pin while the
   base rows switch to the canonical order.
5. Parallel lanes: PR #33 (0021) and PR #30 (0018) touch `test_supabase_integration.py`,
   `models.py`, `types.ts`, `main.py`, and PR #30 touches `_build_orderable_items` —
   whichever merges second resolves small conflicts.
