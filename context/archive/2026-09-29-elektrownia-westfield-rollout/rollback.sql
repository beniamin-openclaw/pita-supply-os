-- ============================================================
-- elektrownia-westfield-rollout — ROLLBACK (run only on operator instruction)
-- Restores every threshold row changed on 2026-09-29 from the "przed a/b/c" value
-- embedded in its notes, deletes the rows the rollout inserted, removes P189 and puts
-- ELEKTROWNIA / WESTFIELD back to their literal pre-rollout state (read 2026-09-29).
-- One transaction. If an order line already references P189, the product DELETE fails
-- on the FK — in that case drop the two P189 DELETEs and set products.active = false.
-- Step 2 (prod-sql-2-westfield.sql: WESTFIELD company + Coca-Cola glass) has its own
-- rollback at the bottom of that file — run it FIRST, then this one.
-- ============================================================
BEGIN;

UPDATE location_product_settings s SET
  min_stock_qty_base    = x.m[1]::numeric,
  target_stock_qty_base = x.m[2]::numeric,
  max_stock_qty_base    = x.m[3]::numeric,
  notes = btrim(regexp_replace(s.notes, ' ?\[2026-09-29 arkusz min/max, przed [^]]*\]', ''))
FROM (
  SELECT setting_id,
         regexp_match(notes, '\[2026-09-29 arkusz min/max, przed ([0-9.eE+-]+)/([0-9.eE+-]+)/([0-9.eE+-]+)') AS m
    FROM location_product_settings
   WHERE notes LIKE '%[2026-09-29 arkusz min/max, przed %'
) x
WHERE s.setting_id = x.setting_id;
-- expected: 237 rows (ELEKTROWNIA 89, WESTFIELD 89, NORBLIN 59)

DELETE FROM location_product_settings
 WHERE notes LIKE '2026-09-29 arkusz min/max (nowy wiersz)%';
-- expected: 20 rows (ELEKTROWNIA 9, WESTFIELD 10, NORBLIN 1)

DELETE FROM supplier_products WHERE supplier_product_id = 'SP_INTERMLECZ_P189';
DELETE FROM products          WHERE product_id = 'P189';

UPDATE locations SET
  location_name = 'Pita Bros Elektrownia', delivery_address = NULL, city = 'Warszawa',
  company_name = NULL, company_address = NULL, company_nip = NULL, active = false,
  notes = 'added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator'
WHERE location_id = 'ELEKTROWNIA';

UPDATE locations SET
  location_name = 'Pita Bros Westfield', delivery_address = NULL, city = 'Warszawa',
  active = false,
  notes = 'added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator'
WHERE location_id = 'WESTFIELD';

COMMIT;
