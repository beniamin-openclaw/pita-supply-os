# prod-sql dry run (prod read-only + local, 2026-10-17)

`prod-sql.sql` was regenerated against prod as of 2026-10-17. Nothing was written to prod. Only SELECTs ran there (Supabase `lpzhphufjwrndfogkfub`, MCP `execute_sql`). Step 2 and the audits ran only on a throwaway local Postgres.

- Snapshot: `data/prod_snapshot.json`, taken 2026-10-17T15:18:42Z. It holds 192 products, 13 locations, 1,575 location_product_settings and the supplier display_order counts.
- Prod step-1 check: 2026-10-17T15:57:50Z, after the review fixes below.

## Review fixes (APPLY WITH FIXES, 2026-10-17)

1. **Cappy glass aliases.** WOLA and WESTFIELD now stock the 0,25 l glass P190/P191 instead of P064/P065. Their Cappy card rows had therefore fallen out as extras (WOLA 1031, WESTFIELD 1001). `data/alias.json` now maps:
   - "Cappy Jabłko" to [P064, P190];
   - "Cappy Pomarańcza" to [P065, P191].

   This works the same way as "Coca Cola" mapping to [P068, P186].
   - **`card_order.json` changed on purpose.** The extractor resolves card names through `alias.json`, so 22 rows changed: "Cappy Jabłko" and "Cappy Pomarańcza" on all 11 cards except FORUM. They now list two product ids instead of one. Card text, suppliers, sections, row order and the unmatched lists are unchanged; that was checked row by row against the previous file.
   - `positions.json` was regenerated:
     - the template has 167 products, with P190 at 800 right after P064 (790) and P191 at 820 right after P065 (810);
     - every later template position moved by +20;
     - the 26 overrides are the same products with shifted values.
2. **lock_timeout.** Step 2 now starts with `BEGIN; SET LOCAL lock_timeout = '5s';`, before the LOCK. If another session holds a conflicting lock for more than 5 s, the LOCK fails with "canceling statement due to lock timeout" and nothing is written.

## Preconditions

| Check | Result |
| --- | --- |
| 0027 applied | Both columns exist on prod: `products.inventory_order integer` and `location_product_settings.inventory_order integer` (information_schema). 0027 is **not** in `list_migrations`, so it was applied outside the migration log. The file is `supply-os-v1/migrations/0027_inventory_order.sql` on origin/main. |
| Code | `inventory_sort_key` is in `supply-os-v1/app/product_order.py:80` on origin/main (5fe1dd2). The file was last changed in 4a1c4dd (2026-09-28). The Railway/Vercel deploy was not checked separately in this run. |
| Workbooks | All 12 "Inwentaryzacja" workbooks were re-downloaded from Drive (last edited 10-12.10) and the extract was re-run. The card text is unchanged since 28.09. The only `card_order.json` change is the Cappy product_ids above. |

Card matching notes:
- 22 products were renamed on prod since 28.09. For 16 of them the card text no longer matched the new name, so `data/alias.json` maps those names to the ids they resolved to on 28.09.
- Together with the 2 Cappy entries, `alias.json` grew from 30 to 48 entries.
- Unmatched card names are the same as on 28.09:
  - Promo Beer x2 at WOLA;
  - Corfu Radler at BRACKA and STARY_BROWAR;
  - "Ręcznik(i) papierowy rolka" at 7 locations.
- ELEKTROWNIA still has no food DRUK tab. Its food rows come from tab "1904", the first dated tab, the same as on 28.09.

## Prod since 28.09

New products:

| Product | Category | Placement |
| --- | --- | --- |
| P189 Cukier w kostkach Diamant 0,5kg | Spożywcze | extra: ELEKTROWNIA 641, NORBLIN 671, WESTFIELD 671 |
| P190 Cappy Jabłko 0,25 l szkło | Napoje | card (template 800): SLONY, WESTFIELD, WOLA |
| P191 Cappy Pomarańcza 0,25 l szkło | Napoje | card (template 820): SLONY, WESTFIELD, WOLA |
| P192 Halloumi cięte | Produkcja | extra: FORUM 431 |

Cappy glass after the fix:
- **WOLA:** P063 Monster 780, then P190 800, P191 820, then P066 830.
- **WESTFIELD:** P190 800, P191 820, then P066 830. The WESTFIELD card has no Monster.
- **SLONY:** P064 790, P190 800, P065 810, P191 820.

P192 sits at the end of Produkcja, after P177 (430). It is **not** next to P015 Halloumi Reha 200gr, which is in Chłodnia (template 180). That follows the pipeline's rule: an extra goes to the end of its own category's section. Putting P192 next to P015 would need a hand-set override or a category change, and that is a product decision.

Changed products:
- P139 is now inactive.
- Renamed: P012, P013, P015, P021, P022, P023, P038, P040, P043, P044, P046, P053, P054, P084, P085, P094, P095, P121, P140, P141, P162, P172.
- No category changed.

Settings added (+56), with each one's effective position:

| Location | Added |
| --- | --- |
| ELEKTROWNIA | Card: P045 530. Extras: P041, P053, P057, P058, P140, P141, P189 at 641; P079, P081 at 1021; P109 at 1541. |
| FORUM | Card: P023 260, P045 530. Extras: P172 221, P192 431, P126 1541. |
| NORBLIN | Extra: P189 671. |
| SLONY | Card: P045 530, P190 800, P191 820, P186 860, P187 880. Extras: P108 P110 P124 P126 P146-P152 P169 at 1541; P183 1651. |
| SUPERSAM | Card: P045 530. Extras: P124, P126 at 1541. |
| WESTFIELD | Card: P021 240, P022 250, P023 260, P026 310, P176 420, P045 530, P190 800, P191 820, P186 860, P187 880, P090 1150. Extras: P025 331; P140 P141 P189 at 671; P081 1021. |
| WOLA | Card: P190 800, P191 820. |

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
| SLONY | yes | 133 | 132 | 118 | 1 | 13 | 0 | 0 | 1 |
| STARY_BROWAR | no | 130 | 129 | 122 | 7 | 0 | 0 | 0 | 1 |
| SUPERSAM | yes | 107 | 107 | 104 | 1 | 2 | 0 | 0 | 0 |
| WESTFIELD | yes | 119 | 119 | 113 | 1 | 5 | 0 | 0 | 0 |
| WOLA | yes | 157 | 154 | 137 | 0 | 17 | 0 | 0 | 3 |

Totals:
- Template: 167 products.
- Overrides: 26.
- Extras: 112, of which 98 are active products and 14 are settings of inactive products.
- Card rows: 1,514.

## Oddities

- **Inactive locations:** KAMIENICA, KULINARNA and STARY_BROWAR are positioned anyway. KULINARNA has no card, so its 19 settings keep their template positions.
- **Products with no category:** none.
- **Empty `inventory_unit`:** P161, P168, P170. Ordering does not depend on it.
- **Template fallbacks:** KEN P181/P182 (Gaz, 1660/1670) sort last. NORBLIN P059-P062 (Wino, 740-770) sort between Spożywcze and Napoje. In both cases the category has no section on that location's card, the same as on 28.09.
- **Cappy glass on cards that do not stock it:** P190/P191 now appear on 8 cards with no glass setting (BRACKA, BROWARY, ELEKTROWNIA, KAMIENICA, KEN, NORBLIN, STARY_BROWAR, SUPERSAM). That adds 16 rows to 1b, which is informational only.
- **Duplicate effective positions:** these occur only among extras that share a section end, by design, with product_id as the tie-break. Examples:
  - SLONY 1541: 12 Chemia products;
  - NORBLIN 1021: 11 Napoje products;
  - WOLA 1551: 10 Chemia products.

  No card product shares a position with another.
- **Settings of inactive products:** 16. Of these, 14 are extras. The other two, KEN P134 and NORBLIN P134, stay NULL: the product has no template position and its category has no section on those cards. They never render, because the product is inactive, and 3e counts only active products.

## Prod step 1, read-only, 15:57Z

The file's 1a-1e ran as one equivalent SELECT, with the same predicates and a compact encoding of the card and template VALUES. The md5 of the expanded rows equals the md5 of the file's literal VALUES, computed locally:
- card: 1514 rows, `34685dd85a30056bd3587480733f55e4`
- template: 167 rows, `2ab1bc3f4d7421d34ad17a34b60cdea6`
- overrides: `2c91dac5b579284328c253074bf9c14a`

| Step | Prod | Expected (file) |
| --- | --- | --- |
| 1a current values | 0 | 0 rows |
| 1b card products with no setting | 78: BRACKA 6, BROWARY 5, ELEKTROWNIA 5, FORUM 12, KAMIENICA 6, KEN 5, NORBLIN 5, SLONY 1, STARY_BROWAR 8, SUPERSAM 15, WESTFIELD 6, WOLA 4 | 78 rows |
| 1c overrides with no setting | 0 | 0 rows |
| 1d active off-card products | 104: 98 extras, plus KEN P181/P182 and NORBLIN P059-P062, which have no section | 104 rows |
| 1e guard preview | 0, 0, true, true, 167, 26, 112 | 0, 0, true, true, 167, 26, 112 |

The md5 of the 1b and 1d row sets is identical on prod and on the local copy: `161c01e0cf1dc5a953b397560c4d7f61` and `7e6e0bfb6eb73776ea6cb46b48acf894`. Both fingerprints are still true, so prod master data has not changed since the snapshot.

## Expected audit results (step 3) and in-transaction checks

- 3a: 167 | 0.
- 3b: BRACKA 8, BROWARY 1, ELEKTROWNIA 1, FORUM 1, KAMIENICA 1, KEN 3, NORBLIN 1, SLONY 1, STARY_BROWAR 7, SUPERSAM 1, WESTFIELD 1.
- 3c: 0 rows.
- 3d: 0 rows.
- 3e: 0 rows.
- 3f: unchanged, as read on prod at 15:35Z. 15 suppliers:
  - SUP_BLUESERV_GDA 48, SUP_BUKAT 14, SUP_BUKAT_KRK 14;
  - SUP_COCACOLA_GDA 8, SUP_COCACOLA_KAT 8;
  - SUP_DISPACK_KAT 28, SUP_DISPACK_KRK 26;
  - SUP_KUCHNIE_GDA 7, SUP_KUCHNIE_KAT 9, SUP_KUCHNIE_KRK 9;
  - SUP_SELGROS_GDA 49, SUP_SELGROS_KAT 48, SUP_SELGROS_KRK 47;
  - SUP_WARSZAWA_GDA 18, SUP_WARSZAWA_KAT 16.
- Inside the DO block:
  - every UPDATE's row count is asserted: 2a 0/0, 2b 167, 2c 26, 2d 112;
  - A1 inversions: 0;
  - A2 contiguity breaks: 0;
  - A3: 167 products and 138 settings positioned, 0 unpositioned active settings.

## Local dry run

The test database was `supply_os_prodsql_1017` on 127.0.0.1. It uses the schema of the integration fixture DB (`supply_os_it_0029`), loaded with today's read-only prod dump.

The revised file ran end to end with exit 0. Every step-1 and step-3 result matched the expectations above. All 1,767 inventory_order values after the run (192 products and 1,575 settings) equal the generator's simulation, with 0 mismatches.

Guard tests on the local copy:

| Test | Result |
| --- | --- |
| Re-run on the applied DB | `G1 products.inventory_order set on 167 rows, expected 0`. Nothing changed. |
| Another session holds ROW EXCLUSIVE on location_product_settings for 12 s | `canceling statement due to lock timeout` after 5 s. 0 rows written. The session's lock_timeout is back to 0 afterwards. |
| One extra setting row (first version of the file; G1 code unchanged) | `G1 location_product_settings rows added or removed since the snapshot`. 0 rows written. |
| One product category changed (first version; G1 code unchanged) | `G1 products (id, category, active) changed since the snapshot`. |

## prod-sql-pago-mory.sql: not applied

Prod read at 15:35Z:
- SUP_PAGO has 24 rows, 6 of them active.
- SUP_MORY has 19 rows, 18 of them active.
- None of the 43 rows has a display_order.
- All 24 supplier_product_ids the file targets exist and are active.

The file's expectations still hold. Step 1 returns 43 rows, all NULL, and the two updates return 6 and 18. Its 3a and 3b checks cover only Pago, Mory and Bukat (14). The file was not changed.

## Risks

- **The G1 fingerprint guard is strict.** If any product's id, category or active flag changes before the apply, or a setting is added or removed, step 2 RAISEs and nothing is written. In that case take a new snapshot (`SNAPSHOT_QUERY` in `data/gen_prod_sql.py.txt`) and re-run the pipeline.
- **The DO block locks two tables.** It holds SHARE ROW EXCLUSIVE on products and location_product_settings for the length of the transaction, which took about 0.05 s locally.
  - It waits at most 5 s for the lock (lock_timeout).
  - Master-data writes to those two tables wait while it runs.
  - Reads are not blocked. Order, count and receipt writes go to other tables and are not blocked either (`supply-os-v1/app/supabase_backend.py:444`, `:569`, `:649`).
- **The file is now one-shot.** A second run RAISEs at G1, so a later re-apply needs a fresh snapshot.
- **0027 is missing from the migration log.** The columns exist on prod, but `list_migrations` does not show the migration.
