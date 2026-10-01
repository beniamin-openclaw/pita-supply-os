# prod-sql dry run (local, 2026-09-28)

Both data files were run end-to-end on a throwaway local Postgres 16. Nothing ran on prod.

The database was `supply_os_prodsql_0027` on 127.0.0.1:
- migrations 0001–0025 and 0027 were applied;
- it was loaded with a read-only export of prod master data taken 2026-09-28:
  - 188 products (id, name, category, unit, active);
  - 13 locations;
  - 1,551 location_product_settings (id, location, product);
  - 14 suppliers;
  - 257 supplier_products (id, supplier, product, active, display_order).

## prod-sql.sql

| Step | Result |
| --- | --- |
| 1a current values | 0 rows (first run) |
| 1b card products with no setting at their location | 50 rows (informational) |
| 1c overrides matching no setting | 0 rows |
| 1d extras | 75 active rows |
| 2 apply | UPDATE 0, 0 (clears), 165 (template), 26 (overrides), 82 (extras incl. inactive products' settings) |
| 3a template positioned | 165, 0 non-positive |
| 3b card overrides per location | BRACKA 8, BROWARY 1, ELEKTROWNIA 1, FORUM 1, KAMIENICA 1, KEN 3, NORBLIN 1, SLONY 1, STARY_BROWAR 7, SUPERSAM 1, WESTFIELD 1 |
| 3c card-order inversions | 0 rows |
| 3d contiguity breaks | 0 rows |
| 3e unpositioned active products | 0 rows |
| 3f other suppliers' display_order | SUP_BUKAT 14 (untouched) |

On the re-run, 1a listed the 273 values set by the first run. Step 2 cleared them (UPDATE 165,
UPDATE 108) and re-set them. The resulting per-location state was byte-identical to the first run,
so the file is re-runnable.

## prod-sql-pago-mory.sql

| Step | Result |
| --- | --- |
| 1 diff | 43 rows, all display_order NULL |
| 2 apply | UPDATE 6 (Pago), UPDATE 18 (Mory) |
| 3a | SUP_MORY 18/18/18/0, SUP_PAGO 6/6/6/0 |
| 3b | Bukat positioned 14 |
