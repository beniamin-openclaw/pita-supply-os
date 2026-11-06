-- porzadek-data-2026-10 — prod SQL 4: "cut" items, count-only (D8)
-- Prepared 2026-10-17. Run in the Supabase SQL editor (project lpzhphufjwrndfogkfub):
-- STEP 0 alone first (read-only), then STEP 1 + AUDIT.
--
-- D8 research result (details in audits.md, section D8): the data model ALREADY holds count-only
-- items, no code change needed. A product is count-only when:
--   * it has a location_product_settings row at the location (=> it is on the inventory list,
--     app/main.py captain_inventory_products), and
--   * its only supplier_products row is SUP_INTERNAL ("on-site production": no order tab,
--     captain_submit and Transport refuse it, app/main.py:980-986), or it has no row in the
--     location's catalog at all (own-catalog FORUM/SUPERSAM, app/supplier_catalog.py:12-14).
-- No order tab => no suggestion. Precedent on prod: P176/P177 "Gyros wieprzowy ścięty/nieścięty",
-- P178/P185 chicken cut/uncut (KEN), P182 opened gas cylinder (2026-09-06).
--
-- What this file does (only what the sources name; everything else waits for Ben/Marek):
--   1. New product P192 "Halloumi cięte" (Produkcja, kg) + SP_INTERNAL_P192 (SUP_INTERNAL, kg, price 0).
--      Kraków report 11.10: halloumi split into "in stock" and "cut", both in kg. Whole halloumi
--      stays P015 (szt = 200 g pack) — changing its unit is out of scope.
--   2. FORUM__P192 0/0/0 (count only). Card position: P192 takes P015's template inventory_order
--      (products table); the location override stays NULL — positions are owned by the card
--      pipeline (migration 0027), so no per-location value is hand-set here.
--   3. WESTFIELD__P176 "Gyros wieprzowy ścięty" 0/0/0 (Mirsini 04.10 "Please put cut gyros in the
--      system"; D19: Molotov = WESTFIELD). Westfield (rollout 29.09) has no P176 today.
--      P177 (uncut) is NOT added: Westfield counts the whole block as P024 "Gyros 15 KG" (Pago).
--   NOT here (needs Ben/Marek — which locations cut halloumi): Alla 02.10 says halloumi is cut
--   ahead (Norblin/Elektrownia/Westfield, location not recorded). Add more rows to the VALUES list
--   in STEP 1 (section 2) once the list is confirmed; nothing else changes.
--
-- Before (expected; the agent could not read prod on 17.10 — STEP 0 confirms):
--   max product_id = P191 (P190/P191 Cappy, feedback-1001-names-units); P192 absent;
--   no product named like 'halloumi%ci%t%'; SUP_INTERNAL exists; FORUM has P015 and P176;
--   WESTFIELD has P015 (24/80/80) and P024, no P176.
-- Rollback: at the end (deletes the 3 rows only when nothing references P192 / WESTFIELD__P176).

-- ============================================================
-- STEP 0 — before (read-only)
-- ============================================================
SELECT max(product_id) AS max_product_id,
       (SELECT count(*) FROM products WHERE product_id = 'P192') AS p192_exists,              -- 0
       (SELECT count(*) FROM products WHERE product_name_pl ILIKE '%halloumi%ci%t%') AS cut_named, -- 0
       (SELECT count(*) FROM suppliers WHERE supplier_id = 'SUP_INTERNAL') AS internal          -- 1
  FROM products WHERE product_id ~ '^P[0-9]+$';
SELECT location_id, product_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base, inventory_order
  FROM location_product_settings
 WHERE (location_id = 'FORUM' AND product_id IN ('P015', 'P176', 'P192'))
    OR (location_id = 'WESTFIELD' AND product_id IN ('P015', 'P024', 'P176', 'P177'))
 ORDER BY 1, 2;
SELECT product_id, product_name_pl, product_category, inventory_unit, active, inventory_order
  FROM products WHERE product_id IN ('P015', 'P176', 'P177') ORDER BY 1;
-- every catalog row of P176 (expect SP_INTERNAL_P176 only)
SELECT supplier_product_id, supplier_id, location_id, active FROM supplier_products WHERE product_id = 'P176';

-- ============================================================
-- STEP 1 — apply
-- ============================================================
BEGIN;

DO $$
DECLARE n int;
BEGIN
  IF EXISTS (SELECT 1 FROM products WHERE product_id = 'P192')
     OR EXISTS (SELECT 1 FROM products WHERE product_name_pl ILIKE '%halloumi%ci%t%') THEN
    RAISE EXCEPTION 'P192 or a cut-halloumi product already exists — re-diff (pick the next free id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_id = 'SUP_INTERNAL') THEN
    RAISE EXCEPTION 'SUP_INTERNAL missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM location_product_settings WHERE location_id = 'FORUM' AND product_id = 'P015') THEN
    RAISE EXCEPTION 'FORUM__P015 missing — re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings WHERE location_id = 'WESTFIELD' AND product_id = 'P176')
     OR NOT EXISTS (SELECT 1 FROM products WHERE product_id = 'P176' AND active) THEN
    RAISE EXCEPTION 'WESTFIELD__P176 already exists or P176 inactive — re-diff';
  END IF;

  -- 1. product + internal catalog row (inventory_order next to whole halloumi)
  INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit,
                        is_critical, active, notes, inventory_order)
  SELECT 'P192', NULL, 'Halloumi cięte', 'Produkcja', 'kg', false, true,
         'D8 2026-10-17: pokrojone halloumi, tylko do liczenia (bez zamawiania); całe = P015',
         p.inventory_order
    FROM products p WHERE p.product_id = 'P015';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'P192 insert: expected 1, got %', n; END IF;

  INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name,
                                 purchase_unit, units_per_purchase_unit, rounding_rule,
                                 price_estimate_pln, active, notes)
  VALUES ('SP_INTERNAL_P192', 'SUP_INTERNAL', 'P192', 'Halloumi cięte', 'kg', 1, 'tenth_kg', 0, true,
          'Internal production (D8 2026-10-17)');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'SP_INTERNAL_P192 insert: expected 1, got %', n; END IF;

  -- 2. count-only settings. Extend this VALUES list when Ben/Marek confirm more locations.
  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT v.loc || '__' || v.pid, v.loc, v.pid, 0, 0, 0, false, false,
         'D8 2026-10-17: tylko do liczenia, bez sugestii (' || v.src || ')'
    FROM (VALUES
      ('FORUM',     'P192', 'raport Krakowa 11.10'),
      ('WESTFIELD', 'P176', 'Mirsini 04.10, Molotov = Westfield')
    ) AS v(loc, pid, src);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'settings insert: expected 2, got %', n; END IF;
END $$;

COMMIT;

-- ============================================================
-- AUDIT
-- ============================================================
-- (a) P192 Produkcja/kg active, one catalog row SP_INTERNAL_P192
SELECT p.product_id, p.product_name_pl, p.product_category, p.inventory_unit, p.active,
       string_agg(sp.supplier_product_id || ':' || sp.supplier_id, ', ') AS catalog
  FROM products p LEFT JOIN supplier_products sp ON sp.product_id = p.product_id
 WHERE p.product_id = 'P192' GROUP BY 1, 2, 3, 4, 5;
-- (b) FORUM__P192 and WESTFIELD__P176, both 0/0/0
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base, notes
  FROM location_product_settings WHERE setting_id IN ('FORUM__P192', 'WESTFIELD__P176');
-- (c) count-only check: no non-internal ACTIVE row for P192 / P176 -> 0 rows
SELECT supplier_product_id FROM supplier_products
 WHERE product_id IN ('P192', 'P176') AND active AND supplier_id <> 'SUP_INTERNAL';
-- Live check after apply (GET only, FORUM and WESTFIELD codes): /api/captain/inventory/products lists
-- "Halloumi cięte" (FORUM) and "Gyros wieprzowy ścięty" (WESTFIELD); no new order tab appears.

-- ============================================================
-- ROLLBACK (commented out)
-- ============================================================
-- BEGIN;
-- DO $$ BEGIN
--   IF EXISTS (SELECT 1 FROM inventory_count_lines WHERE product_id = 'P192')
--      OR EXISTS (SELECT 1 FROM order_lines WHERE product_id = 'P192') THEN
--     RAISE EXCEPTION 'P192 already counted/ordered — deactivate instead: UPDATE products SET active = false WHERE product_id = ''P192''';
--   END IF;
-- END $$;
-- DELETE FROM location_product_settings WHERE setting_id IN ('FORUM__P192', 'WESTFIELD__P176');
-- DELETE FROM supplier_products WHERE supplier_product_id = 'SP_INTERNAL_P192';
-- DELETE FROM products WHERE product_id = 'P192';
-- COMMIT;
