---
date: 2026-10-08T21:19:01+0200
researcher: Claude (Opus 5.5) with 4 read-only sub-agents
git_commit: 5051e56
branch: claude/rollout-katowice-krakow-b96616
repository: 10xDEVS (Pita Supply OS)
topic: "Roll out Kraków FORUM and Katowice SUPERSAM: per-location supplier catalog, hide empty captain tabs, duplicate-order hint, master data"
tags: [research, codebase, supplier_products, captain-orderable, inventory, rollout, master-data]
status: complete
last_updated: 2026-10-08
last_updated_by: Claude
---

# Research: Kraków FORUM + Katowice SUPERSAM rollout

**Date**: 2026-10-08 21:19 CEST · **Git commit**: 5051e56 · **Branch**: claude/rollout-katowice-krakow-b96616

## Research Question

What must change (code + prod data) so that Kraków FORUM and Katowice SUPERSAM can do a full stock count on Sunday 2026-10-11 and order/receive from Monday 2026-10-12, given that both cities buy the same products from different suppliers than Warsaw (Dis-Pack, Kuchnie Świata, Selgros, Bukat Kraków), and that some products are legitimately orderable from two suppliers at one location (Katowice fries: Kuchnie Świata and Selgros)?

Operator decisions already taken (2026-10-08):
- Per-location catalog = nullable `supplier_products.location_id` (option B; PR #26's `source_supplier_id` pin rejected).
- Hide empty supplier tabs for captains, **plus** a hint "already ordered X from supplier Y" for products orderable from 2 suppliers at a location.
- Each city orders separately → separate supplier rows per city (unless Marek's email or mailbox says otherwise — it doesn't: thread 1a11bcd4b96fa9db has no supplier contacts).
- Inventory Sunday 11.10, ordering + receiving from Monday 12.10.

Source email (Marek, 2026-10-08): Kraków Bukat (from this week) brings tzatziki/tiro/feta from Warsaw; rule "order vegetables from Bukat 2×/week and add tzatziki then"; Selgros only weekly/bi-weekly for mayo, mustard etc.; mayo/oil may also come from Kuchnie Świata with fries; greyed Selgros items are NOT priority for that supplier — only top-up to the logistic minimum or emergency (e.g. gloves normally from Dis-Pack, fries from Kuchnie Świata). Sheet mapping: scratchpad `sheet-mapping.md` (to be copied into rollout notes).

## Summary

1. **The catalog is global today.** `_build_orderable_items` shows a product under a supplier if an active `supplier_products` row exists, the location has a settings row and the product is active (`supply-os-v1/app/main.py:255-317`, filter at :300-306). Prod has exactly 1 active `supplier_products` row per product and **no unique constraint/index** on `(supplier_id, product_id)` (only the PK, `migrations/0001_initial_schema.sql:51-54`). Adding city suppliers without code would leak them into every Warsaw screen and double suggestions.
2. **Option B is consistent with the codebase.** One shared helper (effective catalog per location) fixes every location-blind consumer: orderable list, submit/edit gate, primary pack row, inventory unit price, captain supplier list. Every other consumer resolves rows by `supplier_product_id`, so history, email, receipts, finance and Transport are safe. Pitfall: apply the helper over **all suppliers' rows first**, then filter by supplier — otherwise the Warsaw default row reappears in its own supplier's tab at Katowice.
3. **Captain tabs are global** (`CaptainMP.tsx:183-203`, default tab `PILOT_SUPPLIER_ID="SUP_BUKAT"` at :69 and :258-267, `orderingSuppliers.ts:12-18`). A location-scoped supplier list is needed.
4. **Duplicates.** Stock is entered per supplier tab (line state keyed by `product_id`, wiped on supplier switch, `CaptainMP.tsx:109`, :270-348). Thresholds are per (location, product), so a product with 2 suppliers would show the **same suggestion in both tabs**. Suggestion math (`suggestion.py:184-188`, frontend twin `compute.ts:91-100`) ignores open orders; changing that would break the visible-math contract. Recommended: (A) informational hint built from open orders of the same location/product at other suppliers, carried in the existing orderable payload and manager order detail; (C) a per-row `is_backup` flag on location-scoped catalog rows so backup rows show no suggestion and no reason checks (reuses the `suggestion_alerts_enabled` machinery, `compute.ts:156-173`, `main.py:603`/:887/:1777).
5. **Inventory needs only data.** The count list = every `location_product_settings` row of the location with an active product (`main.py:3006-3071`); no supplier row needed; 0/0/0 rows are listed, so only DELETE hides a product. `locations.active` is not checked by any captain endpoint. The pack hint comes from `_primary_supplier_product` (`main.py:2957-2985`), which is location-blind (lowest `supplier_product_id`) and must become location-aware.
6. **Data is far from ready.** Both locations are `active=false`, with no address, company, NIP or phone; SUPERSAM has no DW email. FORUM has 114 settings rows (24 non-zero, August values); SUPERSAM has 116 rows (all 0/0/0). No delivery rules for either. No orders yet (0 orders, 0 lines). The new city suppliers don't exist; `SUP_SELGROS` is inactive with 34 inactive rows, 11 of them with wrong units.

## Detailed Findings

### Catalog consumers (option B touch points)

| Consumer | file:line | Change |
|---|---|---|
| `_build_orderable_items` | main.py:255-317 (filter :300-306) | helper over all rows, then `supplier_id`; keep settings and `product.active` filters |
| ↳ `captain_orderable` | main.py:327-351 | via helper; returns raw dicts (no `response_model`), so optional keys are safe |
| ↳ `manager_orderable` (R-35 `include_unconfigured`) | main.py:431-452 | via helper; only the **settings** filter may be dropped, never the scope |
| ↳ manager add-line re-check | main.py:2725-2740 | via helper |
| ↳ Transport add-location prefill | main.py:5762-5781 | via helper |
| `_resolve_master_data` (submit/edit gate) | main.py:547-566, used at :837/:847 and :1716/:1723 | via helper; also fixes today's missing `sp.active` filter |
| `_primary_supplier_product` | main.py:2957-2985 | location-aware: pass effective rows; prefer non-backup; keep the rule "active supplier, drop SUP_INTERNAL if another exists, min `supplier_product_id`" |
| ↳ captain inventory pack hint | main.py:3037-3046 | pass effective rows for the token location |
| ↳ manager count detail grouping | main.py:3757-3761, `_enrich_inventory_count_detail` :3538-3645 | pass effective rows for `count.location_id` |
| `inventory_unit_price` | app/inventory_value.py:67-93, called main.py:3765-3767 | pass effective rows (price > 0 filter runs after scoping) |
| `GET /api/suppliers` | main.py:201-203 | keep for manager/Transport; add a captain-scoped list (suppliers with ≥ 1 orderable item at the token location) |
| Captain picker | CaptainMP.tsx:183-203, :258-267; lib/orderingSuppliers.ts:16-18 | use the scoped list; default = first supplier with items |
| `_aggregate_transport_lines` | main.py:4477-4604 (key ~:4541) | add `supplier_product_id` to the key (no effect with today's 1:1 data; prevents unit mixing) |
| Order email, dispatch, receipts, finance, queue, detail | main.py:2373-2444, 3947-4104, 6687-6730, 1062-1229, 1307-1515; gmail_url.py:290-310 | none — resolved by the line's own `supplier_product_id` |
| `_aggregate_suggestion_review` | main.py:3790, 3847-3871 | none now (display only; backup lines mix into averages — post-launch) |
| Finance supplier label by NIP | main.py:6800-6804 | none now (city copies sharing a NIP get an arbitrary label — cosmetic) |

Storage:
- Model `SupplierProduct` `app/models.py:147-211` — add `location_id: Optional[str] = None`, `is_backup: bool = False` (non-optional default because `_insert` binds every column, comments at :188/:200).
- Supabase `_SUPPLIER_PRODUCT_COLUMNS` `app/supabase_backend.py:110-116`; `load_supplier_products` (:331-335) is `SELECT *`.
- Seed: `docs/pita-supply-os-v1/seed/supplier_products.csv` (154 rows) — add trailing columns; `seed_loader._normalize` (:33-46) maps blanks to None.
- Sheets legacy: no code change (`sheets._validate_headers` :204-229 allows extra columns).
- **Hazards**: `scripts/sync_master_data.py:20-26,58-63` and `scripts/backfill_supabase.py:35-36` write via the Sheet header — a Sheet without `location_id` silently turns scoped rows into global defaults. Do not run them after scoped rows exist (or teach them the column). `scripts/diag_orderable.py:6-43` re-implements the old filter (stale).
- Tests: `tests/test_supabase_backend.py:202-232` (bind test), `tests/test_supabase_integration.py:95-140` (fixture must apply 0029; pattern :216, rerunnable :489), stub-backend pattern `tests/test_orderable_active_filter.py:17-31`.
- DDL: `ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS location_id text NULL REFERENCES locations(location_id)` + `is_backup boolean NOT NULL DEFAULT false`. Next free migration: **0029** (0008 belongs to PR #26's dead lane, 0018 is used by the unmerged dynamic-target branch). Prod tracker's last row is `0028_supplier_product_case`; 0027 is applied but unrecorded.

### Duplicate-order hint and backup rows

- Order statuses (`models.py:21-27`): `captain_submitted` (main.py:900), `manager_claimed` (:1873, Transport :5315), `manager_sent` (:2462, Transport finalize :5593), `closed` (first receipt, :4061-4078), `cancelled` (:2285). Server-side `DRAFT` is never written; drafts are localStorage per supplier (`frontend/src/auth.ts:81,89-118`).
- Ordered quantity must come from `order_qty.effective_ordered_qty` (`app/order_qty.py:27-37`; twin `lib/orderQty.ts:18-32`).
- Reads by location: `backend.load_orders()` + `load_order_lines_for_orders(ids)` (`supabase_backend.py:363-385`), as in `captain_orders` (main.py:1518-1590). Seed backend has no `load_orders`; gate with `_is_persistent()` (main.py:517). No read cache, so a just-submitted order is visible immediately.
- After submit the captain screen jumps to the next unsent supplier and refetches the orderable list (`CaptainMP.tsx:748-754`), so a hint in the orderable payload is fresh without a new endpoint.
- Slots: captain `ProductCard.tsx:236` (annotation block), suggestion tile :340-370; manager `OrderLineTable.tsx:142-153` (used only by `OrderDetailPane.tsx:231-237`).
- `suggestion_alerts_enabled` already turns off every check for an item (frontend `compute.ts:156-173`, `ProductCard.tsx:103-107`, `CaptainMP.tsx:779-791`, :875-879; backend `_evaluate_submit_line(alerts_enabled=...)` main.py:603, applied :693/:733/:746/:761, called with the supplier flag at :887 submit and :1777 edit). Backup rows can reuse it: item flag = supplier flag AND NOT `is_backup`. The edit page must mirror it (`OrderEditPage.tsx:61`), or a backup line shows red and blocks re-saving.
- Detecting "2+ suppliers at this location": one pass over the effective catalog of the location (active row, active non-internal supplier, active product, settings row), group by `product_id`, keep groups with ≥ 2 distinct suppliers. Warsaw gets nothing (1:1 today).

### Inventory, receiving, go-live prerequisites

- Count endpoints: list main.py:3006-3071, submit :3074-3184 (400 if a product has no settings row; blanks = not counted), edit :3187-3328, latest :3331-3386, last 10 :3389. Count ids `INV-YYYYMMDD-FOR-…` / `…-SUP-…` (:2817).
- Grouping is by `product_category` in the UI (`inventoryGrouping.ts:21-37`), not by supplier; sort by `inventory_sort_key` (`product_order.py:73-84`).
- Counts are stored in `products.inventory_unit` and reinterpreted live if a unit changes — **pending** `context/archive/2026-10-01-feedback-1001-names-units/prod-sql-1b.sql` (P017, P050–P052, P055 → szt/opak, "waits for the full-count day") would reinterpret Sunday's counts of those products at the new locations.
- Order screen pre-fills stock from an inventory count per tab by `product_id` (`CaptainMP.tsx:209-251`, :569-625) — so after Sunday's count both tabs of a duplicate product get the same stock automatically.
- Receiving: `POST /api/captain/receipt/submit` main.py:3946-4104 — only `manager_sent`/`closed` orders of the token's location; nothing per location to configure. Goods ordered outside the app cannot be received in the app.
- Captain token: `SUPPLY_OS_CAPTAIN_TOKENS` parsed at `auth.py:39-49` (dict; last pair wins); `require_captain` (:52-85) does not check `locations.active`.

### Hardcoded Warsaw assumptions

- `PAGO_ENTITY` (`frontend/src/pages/manager/lib/transport.ts:883-893`, used :946-950) = Pita Bros sp. z o.o. — correct for SUPERSAM, **wrong for FORUM** (Pita Bros Mokotów sp. z o.o., NIP 5223356334). Relevant only once Pago ships to Kraków (deferred).
- Transport is Warsaw-driver logic (`transport.ts:791-798`, :849-870, :1002; main.py:4437-4444; drivers from `_meta`, main.py:6610-6660); `ordering_method=transport` → 409 on direct dispatch (main.py:1920-1943).
- Coca-Cola crate prompt keyed to `SUP_COCACOLA` (`supplierPrompts.ts:18-20`).
- Delivery calendar: location rule → shared NULL rule → `suppliers.delivery_days` (`delivery_calendar.py`); Thursday coverage prompt for suppliers with `coverage_prompt_enabled` (Bukat, Intermlecz in prod).
- Email: delivery address = `location_name` + `delivery_address` + `city` (gmail_url.py:85-98), subject "Zamówienie {location_name}" (:262-263), phone (:362-364), footer company fields (:381-387); fixed "od godziny 11:00" (~:358, `emailBody.ts:197-199`). Sender = `locations.sender_email` (main.py:934-952), CC = biuro@ + `locations.email` (main.py:2437-2438).
- Finance: eBiuro company ids env `SUPPLY_OS_EBIURO_COMPANY_IDS` (only KEN), page defaults to KEN (`ManagerFinancePage.tsx:31`).
- Inventory header shows no location name (`InventoryCountPage.tsx:418`); drafts are not location-scoped (`auth.ts:81`, `InventoryCountPage.tsx:32`).

## Prod data snapshot (read-only SELECTs, 2026-10-08)

- `locations`: FORUM "Pita Bros Forum", city "Kraków", active=false, email pitabrosforum@gmail.com, sender forum@pitabros.pl, address/company/NIP/phone NULL. SUPERSAM "Pita Bros Supersam", city "Katowice", active=false, email NULL, sender supersam@pitabros.pl, rest NULL.
- `location_product_settings` columns: setting_id, location_id, product_id, min/max/target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, inventory_order; UNIQUE (location_id, product_id). FORUM 114 rows (24 non-zero — August values, incl. P024 Gyros 4/15 kg and P026 Pita 2/11 opak, 4–6× below every Warsaw location); SUPERSAM 116 rows (0 non-zero).
- `suppliers` (14): Selgros and Allegro inactive; Kuchnie Świata `SUP_KUCHNIE` email zamowienie@/b2b@kuchnieswiata.com.pl, min 600, NIP 1180039859; Bukat biuro@bukat.com, min 500, coverage prompt on; Pago `transport`, alerts off.
- `supplier_products`: columns supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note, unit_weight_kg, supplier_sku, warehouse_pickup, display_order, counts_toward_minimum, case_unit, units_per_case. 72 of the 72 checked products have exactly 1 active row (BLUESERV 33, INTERMLECZ 25, BUKAT 11, MORY 2, KUCHNIE 1). Inactive KUCHNIE rows exist for P013, P015, P021 (22.55 zł), P022, P038, P048; inactive SELGROS rows for 34 products (11 with wrong purchase units).
- `supplier_delivery_rules`: none for FORUM/SUPERSAM; shared NULL rules for BLUESERV, BUKAT, EUROFOOD, FILBER, INTERMLECZ, KAMINO, KUCHNIE, SPEC; Pago/Mory per Warsaw location only.
- `products`: no pack columns; P143/P144 have no gostock_id. Settings rows missing at both locations for P045, P120, P124, P126.

## Architecture Insights

- Location context exists everywhere a catalog decision is made (token or `order.location_id`), so scoping is a pure read-side filter — no write path needs to know about `location_id` beyond master-data SQL.
- Sequencing hazard: the old code ignores `location_id`. Scoped rows and new city suppliers inserted **before** the new code is live would become globally visible in Warsaw. Order: migration 0029 → code deploy → city suppliers + scoped rows. Settings, locations and tokens can go earlier.
- The inventory count does not depend on the catalog, so Sunday's count is reachable with data only (settings + token); Monday's ordering depends on the code.
- `is_backup` defaults to false and `location_id` to NULL, so Warsaw behaviour is unchanged by construction; the only Warsaw-visible change is hiding empty supplier tabs.

## Historical Context (from prior changes)

- `context/changes/supplier-per-location/change.md` — blocked lane; PR #26 (pin `location_product_settings.source_supplier_id`, migration 0008) closed 2026-10-01, never applied. Superseded by this change's option B.
- `context/archive/2026-09-29-elektrownia-westfield-rollout/` — SQL pattern to reuse: guards with `RAISE EXCEPTION`, one `DO $$` block, upsert with a `[date arkusz min/max, przed a/b/c]` notes stamp for mechanical rollback, target = max, audit queries (counts, min>max, inactive products, location row), rollback.sql parsing the stamp.
- `context/archive/2026-08-18-bracka-rollout/rollout-notes.md` — backup-table pattern for deleting template rows.
- `context/archive/2026-09-28-delivery-calendar/prod-sql.sql:42-80` — delivery-rule seeding pattern.
- `context/changes/order-email-v2/prod-sql-applied.md` — sender aliases forum@/supersam@ already set.
- R-35 manager add-any-product (`manager_orderable include_unconfigured`) — manager can already add any catalog product to an order; must stay scoped.
- lessons.md: diff before / audit after; DELETE needs the operator at the screen; migration before code; deploy end-to-end before live test; agent prod writes go through the operator.

## Related Research

- `context/changes/supplier-per-location/change.md` (option A history).

## Open Questions

1. Primary vs backup per product at each location (from Marek): Katowice fries P021/P022 (sheet has values under both Kuchnie Świata 10/36, 2/4 and Selgros 16/44, 2/5 — email says fries normally from Kuchnie Świata). Thresholds are per location+product, so one pair must win.
2. Kraków Bukat thresholds + the 2 order days; Kraków Selgros items with thresholds (all greyed in the sheet).
3. Contacts, ordering method and minimum per city supplier (Dis-Pack, Kuchnie Świata, Selgros, Bukat Kraków). Until known: `ordering_method='manual'`, email NULL (lessons: a placeholder email can swallow an order).
4. Pago (Katowice via Sahil; Kraków unknown), Mory items, drinks — out of scope for Monday; settings rows can still let captains count them on Sunday.
5. SUPERSAM DW email (`locations.email`) — none on record.
6. New products (Ręcznik 100 mb, Papryka Red Sweet 450 g), JAX-GRILL/DIX vs Fenix/Tenzi, P083 paper vs plastic lid, P104 karton vs opak, Selgros "large" oregano/paprika pack weight.
7. Whether to run the pending unit change (prod-sql-1b) before Sunday or exclude those products from the new locations' count.
