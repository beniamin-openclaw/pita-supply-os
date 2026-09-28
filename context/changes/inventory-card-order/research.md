---
date: 2026-09-28T20:20:25Z
researcher: Claude (Opus 5.5)
git_commit: 7531216
branch: claude/inventory-card-order
repository: pita-supply-os
topic: "Inventory screens in each location's printed card order; Pago and Mory list order"
tags: [research, codebase, inventory, location_product_settings, productListFilter, supplier_products, display_order]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude (Opus 5.5)
---

# Research: inventory screens in printed card order; Pago and Mory list order

**Date**: 2026-09-28T20:20:25Z
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 7531216 (main after PR #41)
**Branch**: claude/inventory-card-order
**Repository**: pita-supply-os

## Research Question

Where does the order of products on the inventory screens come from today, what must change so
every location's screens follow its printed inventory card ("… - DRUK" tabs in the location's
"Inwentaryzacja" Google Sheet), and what order do Pago and Magazyn Mory follow in the
"Ordering PB v5" sheet?

## Summary

1. **Nothing sorts on purpose today.** The Captain grid shows the backend's order, which is the
   loader's order (`location_product_settings ORDER BY setting_id` = `LOC__Pnnn` = product-id
   order on Supabase). Categories appear first-seen. The Manager inventory view sorts rows by name
   and then **re-sorts the groups alphabetically** (`groupProductRows`), so no backend order
   survives there.
2. **The cards are per location.** Twelve workbooks share one template (two print tabs, sections
   Chłodnia, Mrożonki, Produkcja | Spożywcze, Wino, Napoje/Soft drinks | Opakowania, Chemia,
   Biurowe, Gaz), but row order and membership differ (sequence similarity to Wolska 0.84–0.90).
   A per-location position is required: `location_product_settings.inventory_order`.
3. **The cards map cleanly to the catalogue.** With a 33-entry alias map, 1,398 card rows resolve
   to product ids. Only four names have no product: "Ręcznik(i) papierowy/e rolka" (7 cards),
   "Corfu Radler" (2), "Promo Beer 0,33l / 0,5l" (Wolska). Elektrownia has no food print tab; its
   newest count tab ("1904") carries the same layout and supplies the food rows.
4. **The DB categories match the card sections**, so once the backend returns card order the
   Captain grid's first-seen grouping reproduces the card's section order with no frontend change.
5. **Ordering PB v5** lists Pago as Gyros 15 KG, Gyros 25 KG, Souvlaki Kurczak, Souvlaki Wieprz,
   Pita, Bifteki; and after the MEZE "Przyprawa" row, Mory as Boxy PB, Box beżowy bez logo,
   Papier do Pita PB, Papier termiczny, Serwetki PB, Rolki do kas typ 1/2/3. Two Mory mappings are
   open questions to Marek (pago-data-unity proposal Q2): "Box beżowy bez logo" = Tacki bez logo
   (P092, inferred), and which till rolls are "typ 1/2/3".

## Detailed Findings

### Captain inventory products (backend)

- `captain_inventory_products` (`supply-os-v1/app/main.py:2704-2758`) loops the settings, skips
  other locations and inactive products, and returns `InventoryProduct` rows **unsorted**.
- Loader order: Supabase `ORDER BY setting_id` (`supabase_backend.py:328-332`); Sheets row order
  (`sheets.py:277-278`); seed CSV order (`seed_loader.py:92-96`, WOLA rows not sorted at row 53).
- The loop already holds the `setting` and the primary `sp` (`_primary_supplier_product`,
  `main.py:2673-2701`).
- `InventoryProduct` (`models.py:698-721`) has no `inventory_order`, `display_order` or
  `supplier_product_id`.

### Manager inventory detail (backend)

- `_enrich_inventory_count_detail` (`main.py:3205-3267`) keeps `count.lines` order; it already
  receives `settings_by_pid`, `primary_sp_by_pid` and `suppliers_by_id`.
- Stored line order: `count_line_id` = `ICL-{count}-{idx:03d}` in request order at submit
  (`main.py:2827`), but `ICL-{count}-E-{hex}` after a correction (`main.py:2967`) — **a corrected
  count's lines come back in random order on Supabase** (`ORDER BY count_line_id`).
- `InventoryCountDetailLine` (`models.py:866-888`) has no order fields.

### Captain history and pre-fill

- `captain_inventory_count_detail` (`main.py:3129-3199`) and `captain_inventory_latest`
  (`main.py:3018-3073`) return stored line order and load no settings.
- `InventoryHistoryPage.tsx:118-132` renders `detail.lines` in that order (so a corrected count
  shows shuffled); the order and edit pre-fills key by `product_id` and do not care.

### LocationProductSetting across the three backends

- Model `models.py:163-172`; DDL `migrations/0001_initial_schema.sql:66-78`.
- Supabase reads are `SELECT *` into the model; `_LOCATION_PRODUCT_SETTING_COLUMNS`
  (`supabase_backend.py:113-117`) is used for writes (insert, integration fixture, backfill).
- Sheets and seed tolerate a missing optional column (`sheets.py:147-164, 203-256`,
  `seed_loader.py:48-59`); 0023's `display_order` needed no loader change (commit 7aa1022).

### Frontend

- Captain grid: `InventoryCountPage.tsx:173, 345`, `InventoryCountEditPage.tsx:65, 128`,
  `InventoryCountGrid.tsx:102-120` and `lib/inventoryGrouping.ts:21-37` preserve backend order,
  categories first-seen. No sort control on the Captain grid.
- Manager view: `ManagerInventoryPage.tsx:51, 56-59, 101`; `lib/productListFilter.ts`:
  `ProductListSort = "name" | "stock" | "delta" | "category"` (9), default
  `{groupBy: "category", sort: "name"}` (56-63), `sortProductRows` (143-160),
  **`groupProductRows` sorts groups by label (182-186)**. Toolbar options
  `components/ui/ProductListToolbar.tsx:40-45`; labels `i18n/strings.ts:968-972`. View state is
  never persisted.
- CSV export `pages/manager/lib/inventoryCsv.ts:163-177` follows backend line order.
- Canonical supplier order helpers: `app/product_order.py:21-45`
  (`supplier_product_sort_key`, `line_sort_key`), `frontend/src/lib/productOrder.ts:10-26`
  (`compareProductOrder`) — both need `supplier_product_id` on the row.

### Tests that pin shape (none pin order)

- `tests/test_inventory_submit.py:38-53` asserts the exact `InventoryProduct` key set.
- Integration fixture `tests/test_supabase_integration.py:70-244` lists migrations explicitly
  (92-214); round-trip template 326-349; bind-test template `tests/test_supabase_backend.py:222-236`.
- Vitest: `lib/productListFilter.test.ts:156-238` (asserts alphabetical group order),
  `InventoryCountGrid.test.tsx:15-45` fixtures, `inventoryCsv.test.ts:175` (given order).

### The inventory cards (data)

- Drive folder `1MeAcGn3eHar6xe58Yt76wU6icHDje0M8` (owner biuro@), one workbook per location,
  modified 26–28.09. Downloaded read-only as xlsx on 2026-09-28 (six fresh via the Drive
  connector, six from the same day's earlier session).
- Layout: print tabs "Spożywcze & napoje - DRUK" / "Spożywcze, napoje - DRUK" and
  "Opakowania, chemia - DRUK"; two column blocks (A–F and H–M); rows
  `Dostawca | Produkt | Magazyn | Wydawka | Suma | Jedn. miary`; section titles in the product
  column. Reading order used: left block top-to-bottom, then right block, then the second tab.
- Supplier labels on the cards: Blue Service, Pago, Selgros, Intermlecz, Pita Bros, Coca Cola Hub,
  Filber Wyspy Piwne, Bukat, Kuchnie Świata, Eurofood, Frutis, Pepsi, Kamino.
- Card → location: wolska→WOLA, bracka→BRACKA, ken→KEN, norblin→NORBLIN, browary→BROWARY,
  elektrownia→ELEKTROWNIA, forum→FORUM, kulinarna_kamienica→KAMIENICA, slony_spichlerz→SLONY,
  stary_browar→STARY_BROWAR, supersam→SUPERSAM, westfield→WESTFIELD. KULINARNA (19-setting stub,
  probable duplicate of KAMIENICA) has no card.
- Resolved rows per location: WOLA 135, BRACKA 135, KEN 138, NORBLIN 116, BROWARY 117,
  ELEKTROWNIA 110, FORUM 112, KAMIENICA 114, SLONY 114, STARY_BROWAR 132, SUPERSAM 114,
  WESTFIELD 114. Data in `data/card_order.json`, aliases in `data/alias.json`, extraction code in
  `data/extract_card_order.py.txt`.
- Aliases that map one card row to several products, in order: "Gyros (ścięty + nieścięty)" →
  P176, P177; "Gyros kurcz (ścięty + nieścięty)" → P178, P185; "Butla gazowa 10L" → P181, P182;
  "Coca Cola" → P068, P186 and "Coca Cola Zero" → P069, P187 (BRACKA, KEN and WOLA carry the glass
  products, the others the cans); "Sałata bolero mix 500gr" → P170, P008.
- Card names differ from catalogue names for renamed products (P007 Rucola 100 gr, P011 Tzatzyki
  3kg, P012 Hot Feta 2kg, P014 Feta blok 2kg, P036 Kasza Pęczak ugotowana) — covered by aliases.

### Ordering PB v5 (data)

- Workbook "Ordering PB v5 prod" (Drive `1jNMwKNHpbSCsak9Yuo9UPgMYM10CJ1dEO4ghDdaVPcU`),
  `ORDER_INPUT` / `STOCK_MASTER` / `DRIVER_PICKLIST` share one 24-row product order.
- Pago rows → app: Gyros 15 KG `SP_PAGO_P024`, Gyros 25 KG `SP_PAGO_P025`, Souvlaki Kurczak
  `SP_PAGO_P027`, Souvlaki Wieprz `SP_PAGO_P028`, Pita `SP_PAGO_P026`, Bifteki Black Pork
  `SP_PAGO_P145`. Sheet-only Pago rows (Ciasto fillo, Armenonville, trials) are not in the app.
- MEZE "Przyprawa" → `SP_MORY_P019` (the app sources it from Mory).
- Mory rows → app: Boxy PB `SP_MORY_P089`; Box beżowy bez logo → `SP_MORY_P092` Tacki bez logo
  (inferred, open with Marek); Papier do Pita PB `SP_MORY_P090`; Papier termiczny `SP_MORY_P098`;
  Serwetki PB `SP_MORY_P091`; Rolki do kas typ 1/2/3 → the five active till rolls, mapping
  unknown. Not on the sheet: Skepasti box PB, Druciak, Szczotka do grilla, Zszywki, Koperty,
  Markery, Długopisy.

## Code References

- `supply-os-v1/app/main.py:2704-2758` — `captain_inventory_products`, unsorted
- `supply-os-v1/app/main.py:3205-3267` — `_enrich_inventory_count_detail`, stored order
- `supply-os-v1/app/main.py:2967` — corrected count line ids use random hex
- `supply-os-v1/app/models.py:163-172, 698-721, 866-888` — setting, inventory product, detail line
- `supply-os-v1/app/supabase_backend.py:113-117, 328-332` — setting columns, loader order
- `supply-os-v1/app/product_order.py:21-45` — canonical supplier order keys
- `frontend/src/lib/productListFilter.ts:9, 56-63, 143-188` — sorts, default view, group re-sort
- `frontend/src/lib/inventoryGrouping.ts:21-37` — first-seen grouping
- `frontend/src/components/ui/ProductListToolbar.tsx:40-45` — sort options
- `frontend/src/i18n/strings.ts:968-972` — sort labels

## Architecture Insights

- Order belongs in master data, resolved server-side, mirroring 0023 (`display_order` on
  `supplier_products` + a shared sort key in `product_order.py` / `productOrder.ts`).
- Per-location data lives on `location_product_settings` (unique per location + product), the
  natural home for a card position.
- Optional columns are free on Sheets and seed; Supabase needs the column list for writes and the
  integration fixture for the migration.

## Historical Context (from prior changes)

- `context/archive/2026-09-28-supplier-product-order-minimum/` — plan-review F7 and operator
  decision (3): inventory reordering deferred to after 1.10; research §"location-wide lists need a
  supplier-block key". Replaced by the operator on 2026-09-28: default = card order.
- `context/changes/pago-data-unity/proposal.md` (c) and Q2 — the Ordering PB v5 row order, the
  Mory mapping questions (Box beżowy / Rolki typ).
- `origin/claude/multi-location-master-data` (PR #27) — the same 12 workbooks parsed for master
  data; its engine has normalisation but no curated alias map.

## Related Research

- `context/archive/2026-09-28-supplier-product-order-minimum/research.md`

## Open Questions

- Mory: is "Box beżowy bez logo" our Tacki bez logo (P092), and which till rolls are "typ 1/2/3"?
  Low stakes — positions are data, adjustable with one UPDATE.
- Four card names have no catalogue product (paper towel rolls, Corfu Radler, Promo Beer). They
  stay unpositioned; adding them to the catalogue is master-data work outside this change.
