# prod-sql dry run (prod read-only + local, 2026-10-17)

`prod-sql.sql` was regenerated against prod as of 2026-10-17. Nothing was written to prod.
Only SELECTs ran there (Supabase `lpzhphufjwrndfogkfub`, MCP `execute_sql`). Step 2 and the
audits ran on a throwaway local Postgres only.

- Snapshot: `data/prod_snapshot.json`, taken 2026-10-17T15:18:42Z (192 products,
  13 locations, 1,575 location_product_settings, supplier display_order counts).
- Prod step-1 check: 2026-10-17T15:35:44Z.

## Preconditions

| Check | Result |
| --- | --- |
| 0027 applied | Both columns exist on prod: `products.inventory_order integer`, `location_product_settings.inventory_order integer` (information_schema). 0027 is **not** in `list_migrations`; it was applied outside the migration log. File: `supply-os-v1/migrations/0027_inventory_order.sql` on origin/main. |
| Code | `inventory_sort_key` is in `supply-os-v1/app/product_order.py:80` on origin/main (5fe1dd2). The file was last changed in 4a1c4dd (2026-09-28). This run did not check the Railway/Vercel deploy separately. |
| Workbooks | All 12 "Inwentaryzacja" workbooks were re-downloaded from Drive (last edited 10-12.10) and the extract was re-run. `card_order.json` is byte-identical to 28.09 and `positions.json` is unchanged: 165 template products, 26 overrides. |

Card matching notes:
- 22 products were renamed on prod since 28.09. For 16 of them the card text no longer matched the new name, so `data/alias.json` (+16 entries) maps those names to the ids they resolved to on 28.09.
- Unmatched card names are the same as on 28.09: Promo Beer x2 at WOLA, Corfu Radler at BRACKA and STARY_BROWAR, and "Ręcznik(i) papierowy rolka" at 7 locations.
- ELEKTROWNIA still has no food DRUK tab. Its food rows come from tab "1904", the first dated tab, the same as on 28.09.

## Prod since 28.09

New products. None is on a card, none gets a template position, and each lands at the end of its category section as an extra:

| Product | Category | Placement |
| --- | --- | --- |
| P189 Cukier w kostkach Diamant 0,5kg | Spożywcze | ELEKTROWNIA 641, NORBLIN 671, WESTFIELD 671 |
| P190 Cappy Jabłko 0,25 l szkło | Napoje | SLONY 1001, WESTFIELD 1001, WOLA 1031 |
| P191 Cappy Pomarańcza 0,25 l szkło | Napoje | SLONY 1001, WESTFIELD 1001, WOLA 1031 |
| P192 Halloumi cięte | Produkcja | FORUM 431 |

P192 sits at the end of Produkcja, after P177 (430). It is **not** next to P015 Halloumi Reha 200gr, which is in Chłodnia (template 180). This follows the pipeline's rule: an extra goes to its own category's section end. Putting P192 next to P015 would take a hand-set override or a category change, which is a product decision.

Changed products:
- P139 is now inactive.
- Renamed: P012, P013, P015, P021, P022, P023, P038, P040, P043, P044, P046, P053, P054, P084, P085, P094, P095, P121, P140, P141, P162, P172.
- No category changed.

Settings added (+56). Each row shows the effective position and why it lands there:

| Location | Added |
| --- | --- |
| ELEKTROWNIA | P045 530 (card). Extras: P041, P053, P057, P058, P140, P141, P189 at 641; P079, P081 at 1001; P109 at 1521. |
| FORUM | P023 260 and P045 530 (card). Extras: P172 221, P192 431, P126 1521. |
| NORBLIN | P189 671 (extra). |
| SLONY | P045 530, P186 840, P187 860 (card). Extras: P190, P191 at 1001; P108 P110 P124 P126 P146-P152 P169 at 1521; P183 1631. |
| SUPERSAM | P045 530 (card). Extras: P124, P126 at 1521. |
| WESTFIELD | P021 240, P022 250, P023 260, P026 310, P045 530, P176 420, P090 1130, P186 840, P187 860 (card). Extras: P025 331; P140 P141 P189 at 671; P081 P190 P191 at 1001. |
| WOLA | P190, P191 at 1031 (extra). |

Settings removed (-32):
- FORUM: P017 P037 P039 P056 P099 P103 P109 P111 P112 P113 P114 P125 P128 P170
- SUPERSAM: P017 P037 P039 P056 P099 P103 P109 P111 P112 P113 P114 P130
- WESTFIELD: P064 P065 P068 P069
- WOLA: P064 P065

## Per location

| Location | Active | Settings | Active settings | Card rows on template | Card overrides | Extras (active) | Template fallback | Unpositioned | Extras (inactive product) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BRACKA | yes | 149 | 146 | 126 | 8 | 12 | 0 | 0 | 3 |
| BROWARY | yes | 122 | 121 | 116 | 1 | 4 | 0 | 0 | 1 |
| ELEKTROWNIA | yes | 124 | 123 | 109 | 1 | 13 | 0 | 0 | 1 |
| FORUM | yes | 105 | 105 | 101 | 1 | 3 | 0 | 0 | 0 |
| KAMIENICA | no | 115 | 114 | 113 | 1 | 0 | 0 | 0 | 1 |
| KEN | yes | 149 | 147 | 136 | 3 | 6 | 2 | 0 | 1 |
| KULINARNA | no | 19 | 19 | 0 | 0 | 0 | 19 | 0 | 0 |
| NORBLIN | yes | 146 | 143 | 115 | 1 | 23 | 4 | 0 | 2 |
| SLONY | yes | 133 | 132 | 116 | 1 | 15 | 0 | 0 | 1 |
| STARY_BROWAR | no | 130 | 129 | 122 | 7 | 0 | 0 | 0 | 1 |
| SUPERSAM | yes | 107 | 107 | 104 | 1 | 2 | 0 | 0 | 0 |
| WESTFIELD | yes | 119 | 119 | 111 | 1 | 7 | 0 | 0 | 0 |
| WOLA | yes | 157 | 154 | 135 | 0 | 19 | 0 | 0 | 3 |

Totals:
- Template: 165 products.
- Overrides: 26.
- Extras: 118, made of 104 active products and 14 settings of inactive products.
- Card rows: 1,492.

## Oddities

- **Inactive locations** KAMIENICA, KULINARNA and STARY_BROWAR are positioned anyway.
  - KULINARNA has no card. Its 19 settings keep their template positions.
- **Products with no category:** none.
- **Empty `inventory_unit`:** P161, P168, P170. Ordering does not depend on it.
- **Template fallbacks, same as on 28.09:**
  - KEN P181/P182 (Gaz, 1640/1650) sort last.
  - NORBLIN P059-P062 (Wino, 740-770) sort between Spożywcze and Napoje.
  - In both cases the category has no section on that location's card.
- **Duplicate effective positions** occur only among extras that share a section end. This is by design; the tie-break is product_id. For example:
  - SLONY 1521: 12 Chemia products;
  - NORBLIN 1001: 11 Napoje products;
  - WOLA 1531: 10 Chemia products.
  
  No card product shares a position with another.
- **Settings of inactive products:** 16. Of these, 14 are extras. The other two, KEN P134 and NORBLIN P134, stay NULL: the product has no template position and its category has no section on those cards. They never render, because the product is inactive, and 3e counts only active products.

## Prod step 1, read-only, 15:35Z

The file's 1a-1e were run as one equivalent SELECT. It used the same predicates and a compact encoding of the card and template VALUES. An md5 over the expanded rows equals the md5 of the file's literal VALUES:
- card: 1492 rows, `5d623128b81105c7544487e2c78d4d17`;
- template: 165 rows, `0804fbe48f38ac0c35189b81e0d842b3`.

| Step | Prod | Expected (file) |
| --- | --- | --- |
| 1a current values | 0 | 0 rows |
| 1b card products with no setting | 62. BRACKA 4, BROWARY 3, ELEKTROWNIA 3, FORUM 12, KAMIENICA 4, KEN 3, NORBLIN 3, SLONY 1, STARY_BROWAR 6, SUPERSAM 13, WESTFIELD 6, WOLA 4 | 62 rows |
| 1c overrides with no setting | 0 | 0 rows |
| 1d active off-card products | 110 (104 extras plus KEN P181/P182 and NORBLIN P059-P062 with no section) | 110 rows |
| 1e guard preview | 0, 0, true, true, 165, 26, 118 | 0, 0, true, true, 165, 26, 118 |

The md5 of the 1b and 1d row sets is identical on prod and on the local copy (`7b0ef7b6900f0315c53cf657e9971a07`, `a1f2fe597492014ff4fbb1141ee09cf6`).

The pago-mory step 1 is reported in its own section below.

## Expected audit results (step 3) and in-transaction checks

- 3a: 165 | 0.
- 3b: BRACKA 8, BROWARY 1, ELEKTROWNIA 1, FORUM 1, KAMIENICA 1, KEN 3, NORBLIN 1, SLONY 1, STARY_BROWAR 7, SUPERSAM 1, WESTFIELD 1.
- 3c: 0 rows.
- 3d: 0 rows.
- 3e: 0 rows.
- 3f: on prod at 15:35Z, unchanged. 15 suppliers:
  - SUP_BLUESERV_GDA 48, SUP_BUKAT 14, SUP_BUKAT_KRK 14;
  - SUP_COCACOLA_GDA 8, SUP_COCACOLA_KAT 8;
  - SUP_DISPACK_KAT 28, SUP_DISPACK_KRK 26;
  - SUP_KUCHNIE_GDA 7, SUP_KUCHNIE_KAT 9, SUP_KUCHNIE_KRK 9;
  - SUP_SELGROS_GDA 49, SUP_SELGROS_KAT 48, SUP_SELGROS_KRK 47;
  - SUP_WARSZAWA_GDA 18, SUP_WARSZAWA_KAT 16.
- Inside the DO block:
  - every UPDATE's row count is asserted: 2a 0/0, 2b 165, 2c 26, 2d 118;
  - A1 inversions 0;
  - A2 contiguity 0;
  - A3: 165 products and 144 settings positioned, 0 unpositioned active settings.

## Local dry run

The database was `supply_os_prodsql_1017` on 127.0.0.1. It has the schema of the integration fixture DB (`supply_os_it_0029`), loaded with today's prod read-only dump.

The whole file ran with exit 0 and every step-1 and step-3 result matched the expectations above. All 1,767 inventory_order values after the run (192 products + 1,575 settings) equal the generator's simulation; there were 0 mismatches.

Guard tests on the local copy:

| Test | Result |
| --- | --- |
| Re-run on the applied DB | `G1 products.inventory_order set on 165 rows, expected 0`. Nothing changed. |
| One extra setting row | `G1 location_product_settings rows added or removed since the snapshot`. 0 rows written. |
| One product category changed | `G1 products (id, category, active) changed since the snapshot`. |
| Restored state | DO and COMMIT. P192 at FORUM is 431. |

## prod-sql-pago-mory.sql: not applied

Prod read at 15:35Z:
- SUP_PAGO has 24 rows, 6 of them active. SUP_MORY has 19 rows, 18 of them active.
- 0 of the 43 rows has a display_order.
- All 24 supplier_product_ids the file targets exist and are active.

The file's expectations still hold: step 1 returns 43 rows, all NULL, and the updates return 6 and 18. Its 3a and 3b check only Pago, Mory and Bukat (14). The file was not changed.

## Risks

- **The G1 fingerprint guard is strict.** Any change to product (id, category, active), or any added or removed setting, between this snapshot and the apply makes step 2 RAISE, and nothing is written. Then take a new snapshot (`SNAPSHOT_QUERY` in `data/gen_prod_sql.py.txt`) and re-run the generator.
- **The DO block locks two tables.** It takes SHARE ROW EXCLUSIVE on products and location_product_settings for the length of the transaction; step 2 took 0.05 s locally. Master-data writes to those two tables wait meanwhile. Reads are not blocked, and neither are order, count and receipt writes, which go to other tables (`supply-os-v1/app/supabase_backend.py:444`, `:569`, `:649`).
- **The file is now one-shot.** Earlier versions could be re-run. A second run RAISEs at G1, so a later re-apply needs a fresh snapshot.
- **0027 is missing from the migration log.** The columns exist, but `list_migrations` does not show the migration.
