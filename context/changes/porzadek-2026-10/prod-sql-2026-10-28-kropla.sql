-- porzadek-2026-10 — C1 Kropla Beskidu in Warsaw: PET 0,5 x12 at NORBLIN and BROWARY, glass 0,33 x24 elsewhere
-- Marek 26.10 (answer to Ben's 24.10 mail): Norblin and Browary order PET 0,5 l in packs of 12;
--   the other Warsaw locations order glass 0,33 l in packs of 24 ("zgrzewka", not a crate).
-- Ben, chat 2026-10-28: "Tak, przygotuj SQL dla Kropli wg C1 (P195/P196 PET dla Norblina i Browarów,
--   szkło 0,33 x24 za 48,96 dla reszty Warszawy) i pokaż przed wgraniem."
-- Plan: marek-answers-2026-10-26.md, section C1.
--
-- Why two new products and not a NORBLIN-only supplier row: a Warsaw location (own_catalog = false)
-- sees only shared catalog rows (location_id NULL); a location_id row would be ignored there
-- (supplier_catalog.py). The Captain sees a product only if the location has a
-- location_product_settings row for it, so moving the 4 settings from P070/P071 to P195/P196
-- switches Norblin and Browary to PET without code.
--
-- Changes:
--   1. products P195 "Kropla Beskidu Niegazowana PET 0,5 l", P196 "Kropla Beskidu Gazowana PET 0,5 l"
--      (Napoje, szt, card positions 911/921 right after P070=910/P071=920).
--   2. shared supplier_products SP_COCACOLA_P195/P196: SUP_COCACOLA, zgrzewka x12, 17.40
--      (estimate 1.45 zł/szt x12, same as SP_COCACOLA_GDA_P070/P071; no PET 0,5 invoice).
--   3. location_product_settings NORBLIN/BROWARY: P070 -> P195, P071 -> P196, same min/target/max
--      in szt; the old P070/P071 settings are deleted.
--   4. shared SP_COCACOLA_P070/P071 become glass: 34.80 -> 48.96 (Coca-Cola HBC invoice 2424267367,
--      KEN, 20.08: 0.33 NRG X24 KROPLA BESKIDU NGAZ; gazowana not on any invoice, same price assumed,
--      as on SP_COCACOLA_KAT_P071), name and order_note say "szkło 0,33".
-- Not touched: SLONY (own catalog, SP_COCACOLA_GDA_P070/P071 stay PET x12 on P070/P071),
--   SUPERSAM (SP_COCACOLA_KAT_*, already glass), products P070/P071 names, inventory history.
--
-- Side effects (flagged to Ben):
--   - Open NORBLIN/BROWARY Coca-Cola orders with P070/P071 lines (3 manager_sent, 1 manager_claimed
--     with qty 0) read the supplier row live, so they will show the glass name and price 48.96.
--   - Norblin/Browary stock counts so far are under P070/P071; P195/P196 start with no count.
--   - Before applying (review 28.10): close/receive or leave alone the 3 manager_sent NOR/BRO orders
--     (a re-send would e-mail the glass name); correct today's NOR/BRO counts first, because
--     "Popraw" on a count holding P070/P071 returns 400 once the settings are gone.
--   - Old P070/P071 counts are re-valued at the glass price (48.96/24 per szt).

-- STEP 0 (read 28.10)
SELECT product_id, gostock_id, product_name_pl, product_category, inventory_unit, inventory_order
  FROM products WHERE product_id IN ('P070', 'P071', 'P195', 'P196') ORDER BY 1;
-- expect P070 (910), P071 (920); no P195/P196; max(product_id) = P194
SELECT supplier_product_id, supplier_id, location_id, supplier_product_name, purchase_unit,
       units_per_purchase_unit, price_estimate_pln, order_note, notes, active, rounding_rule,
       display_order, counts_toward_minimum, warehouse_pickup, case_unit, is_backup
  FROM supplier_products WHERE product_id IN ('P070', 'P071') ORDER BY 1;
-- expect shared SP_COCACOLA_P070/P071: x24, 34.80, '1 zgrzewka = 24 szt', notes '', up_for_critical,
--        display_order NULL, counts_toward_minimum t, no pickup, no case, not backup
SELECT location_id, own_catalog FROM locations WHERE location_id IN ('NORBLIN', 'BROWARY');
-- expect both own_catalog f
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base,
       is_critical_for_location, allow_over_max_due_to_packaging, inventory_order, notes
  FROM location_product_settings
 WHERE location_id IN ('NORBLIN', 'BROWARY') AND product_id IN ('P070', 'P071') ORDER BY 1;
-- expect BROWARY__P070 12/36/36, BROWARY__P071 12/36/36, NORBLIN__P070 30/50/50,
--        NORBLIN__P071 15/24/24; all not critical, allow_over_max false, inventory_order NULL
SELECT o.order_id, o.status
  FROM orders o
 WHERE o.location_id IN ('NORBLIN', 'BROWARY') AND o.status NOT IN ('closed', 'cancelled')
   AND EXISTS (SELECT 1 FROM order_lines l
                WHERE l.order_id = o.order_id AND l.product_id IN ('P070', 'P071'))
 ORDER BY 1;
-- expect ORD-20261004-BRO-COCA-c319a2 manager_sent, ORD-20261011-NOR-COCA-b5bf5e manager_claimed,
--        ORD-20261025-NOR-COCA-af07cf manager_sent, ORD-20261004-NOR-COCA-080582 manager_sent

-- STEP 1
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE n int;
BEGIN
  -- Guards: new ids are free.
  IF EXISTS (SELECT 1 FROM products WHERE product_id IN ('P195', 'P196')) THEN
    RAISE EXCEPTION 'P195/P196 already exist — re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products
              WHERE supplier_product_id IN ('SP_COCACOLA_P195', 'SP_COCACOLA_P196')
                 OR product_id IN ('P195', 'P196')) THEN
    RAISE EXCEPTION 'supplier rows for P195/P196 already exist — re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings WHERE product_id IN ('P195', 'P196')) THEN
    RAISE EXCEPTION 'settings for P195/P196 already exist — re-diff';
  END IF;

  -- Guard: the design relies on NORBLIN/BROWARY reading the shared catalog only.
  IF (SELECT count(*) FROM locations
       WHERE location_id IN ('NORBLIN', 'BROWARY') AND own_catalog = false) <> 2 THEN
    RAISE EXCEPTION 'NORBLIN/BROWARY no longer both own_catalog = false — re-think C1';
  END IF;

  -- Guard: the shared glass-to-be rows are exactly what STEP 0 saw.
  IF (SELECT string_agg(concat_ws('|', supplier_product_id, supplier_id, product_id,
                                  coalesce(location_id, '-'), supplier_product_name, purchase_unit,
                                  units_per_purchase_unit::numeric(10, 4), price_estimate_pln,
                                  order_note, notes, active, is_backup, rounding_rule),
                        ';' ORDER BY supplier_product_id)
        FROM supplier_products
       WHERE supplier_product_id IN ('SP_COCACOLA_P070', 'SP_COCACOLA_P071'))
     IS DISTINCT FROM
     'SP_COCACOLA_P070|SUP_COCACOLA|P070|-|Kropla Beskidu Niegazowana|zgrzewka|24.0000|34.80|'
     '1 zgrzewka = 24 szt||t|f|up_for_critical;'
     'SP_COCACOLA_P071|SUP_COCACOLA|P071|-|Kropla Beskidu Gazowana|zgrzewka|24.0000|34.80|'
     '1 zgrzewka = 24 szt||t|f|up_for_critical'
  THEN
    RAISE EXCEPTION 'SP_COCACOLA_P070/P071 changed since 2026-10-28 STEP 0 — re-diff';
  END IF;

  -- Guard: exactly the 4 settings to move, with STEP 0 values.
  IF (SELECT string_agg(concat_ws('|', setting_id, location_id, product_id,
                                  min_stock_qty_base::numeric(10, 4),
                                  target_stock_qty_base::numeric(10, 4),
                                  max_stock_qty_base::numeric(10, 4),
                                  is_critical_for_location, allow_over_max_due_to_packaging,
                                  coalesce(inventory_order::text, '-')),
                        ';' ORDER BY setting_id)
        FROM location_product_settings
       WHERE location_id IN ('NORBLIN', 'BROWARY') AND product_id IN ('P070', 'P071'))
     IS DISTINCT FROM
     'BROWARY__P070|BROWARY|P070|12.0000|36.0000|36.0000|f|f|-;'
     'BROWARY__P071|BROWARY|P071|12.0000|36.0000|36.0000|f|f|-;'
     'NORBLIN__P070|NORBLIN|P070|30.0000|50.0000|50.0000|f|f|-;'
     'NORBLIN__P071|NORBLIN|P071|15.0000|24.0000|24.0000|f|f|-'
  THEN
    RAISE EXCEPTION 'NORBLIN/BROWARY P070/P071 settings changed since 2026-10-28 STEP 0 — re-diff';
  END IF;

  -- Guard: no new open NORBLIN/BROWARY order with Kropla lines since STEP 0 (an unsent order
  -- would need a look before its products move).
  IF (SELECT count(*) FROM orders o
       WHERE o.location_id IN ('NORBLIN', 'BROWARY') AND o.status NOT IN ('closed', 'cancelled')
         AND EXISTS (SELECT 1 FROM order_lines l
                      WHERE l.order_id = o.order_id AND l.product_id IN ('P070', 'P071'))
         AND o.order_id NOT IN ('ORD-20261004-BRO-COCA-c319a2', 'ORD-20261011-NOR-COCA-b5bf5e',
                                'ORD-20261025-NOR-COCA-af07cf', 'ORD-20261004-NOR-COCA-080582')) <> 0
  THEN
    RAISE EXCEPTION 'new open NORBLIN/BROWARY order with P070/P071 lines — look before moving';
  END IF;

  -- 1. products: category, unit and criticality copied from P070/P071
  INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit,
                        is_critical, active, notes, inventory_order)
  SELECT m.new_pid, NULL, m.name, p.product_category, p.inventory_unit, p.is_critical, true,
         'porzadek-2026-10 C1 2026-10-28: PET 0,5 l x12 dla NORBLIN i BROWARY (Marek 26.10, '
           || 'Ben 28.10); reszta Warszawy zamawia ' || p.product_id || ' (szkło 0,33 x24)',
         p.inventory_order + 1
    FROM products p
    JOIN (VALUES ('P070', 'P195', 'Kropla Beskidu Niegazowana PET 0,5 l'),
                 ('P071', 'P196', 'Kropla Beskidu Gazowana PET 0,5 l')) AS m(old_pid, new_pid, name)
      ON m.old_pid = p.product_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'products: expected 2 rows, got %', n; END IF;

  -- 2. shared Coca-Cola rows for PET: everything except id, product, name, pack, price, notes
  --    copied from SP_COCACOLA_P070/P071 (display_order, counts_toward_minimum, rounding, ...)
  INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name,
                                 purchase_unit, units_per_purchase_unit, rounding_rule,
                                 price_estimate_pln, active, notes, order_note, unit_weight_kg,
                                 supplier_sku, warehouse_pickup, display_order, counts_toward_minimum,
                                 case_unit, units_per_case, location_id, is_backup)
  SELECT 'SP_COCACOLA_' || m.new_pid, sp.supplier_id, m.new_pid, m.name,
         sp.purchase_unit, 12, sp.rounding_rule, 17.40, sp.active,
         'porzadek-2026-10 C1 2026-10-28: NORBLIN i BROWARY PET 0,5 x12 (Marek 26.10); cena '
           || 'szacunkowa 1.45 zł/szt x12 jak SP_COCACOLA_GDA_' || m.old_pid
           || '; brak faktury PET 0,5',
         '1 zgrzewka = 12 szt (PET 0,5)', sp.unit_weight_kg, sp.supplier_sku, sp.warehouse_pickup,
         sp.display_order, sp.counts_toward_minimum, sp.case_unit, sp.units_per_case,
         sp.location_id, sp.is_backup
    FROM supplier_products sp
    JOIN (VALUES ('P070', 'P195', 'Kropla Beskidu niegazowana PET 0,5 l'),
                 ('P071', 'P196', 'Kropla Beskidu gazowana PET 0,5 l')) AS m(old_pid, new_pid, name)
      ON sp.supplier_product_id = 'SP_COCACOLA_' || m.old_pid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'supplier_products: expected 2 rows, got %', n; END IF;

  -- 3a. settings: copy the 4 rows onto the PET products (same numbers, in szt)
  INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base,
                                         max_stock_qty_base, target_stock_qty_base,
                                         is_critical_for_location, allow_over_max_due_to_packaging,
                                         notes, inventory_order)
  SELECT s.location_id || '__' || m.new_pid, s.location_id, m.new_pid, s.min_stock_qty_base,
         s.max_stock_qty_base, s.target_stock_qty_base, s.is_critical_for_location,
         s.allow_over_max_due_to_packaging,
         'porzadek-2026-10 C1 2026-10-28: przeniesione z ' || s.setting_id
           || ' (PET 0,5 x12, Marek 26.10); wcześniej: ' || s.notes,
         s.inventory_order
    FROM location_product_settings s
    JOIN (VALUES ('P070', 'P195'), ('P071', 'P196')) AS m(old_pid, new_pid)
      ON m.old_pid = s.product_id
   WHERE s.location_id IN ('NORBLIN', 'BROWARY');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'settings insert: expected 4 rows, got %', n; END IF;

  -- 3b. drop the old ones (Norblin/Browary stop seeing the glass products)
  DELETE FROM location_product_settings
   WHERE setting_id IN ('NORBLIN__P070', 'NORBLIN__P071', 'BROWARY__P070', 'BROWARY__P071');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'settings delete: expected 4 rows, got %', n; END IF;

  -- 4. shared P070/P071 rows become glass 0,33 x24
  UPDATE supplier_products sp
     SET supplier_product_name = v.name,
         price_estimate_pln = 48.96,
         order_note = '1 zgrzewka = 24 szt (szkło 0,33)',
         notes = v.note
    FROM (VALUES
      ('SP_COCACOLA_P070', 'Kropla Beskidu niegazowana szkło 0,33 l',
       '[2026-10-28 Ben C1: Warszawa szkło 0,33 x24, NORBLIN i BROWARY PET -> SP_COCACOLA_P195; '
       'cena z faktury Coca-Cola HBC (KEN) 2424267367 z 20.08: 0.33 NRG X24 KROPLA BESKIDU NGAZ; '
       'przed: Kropla Beskidu Niegazowana, 34.80, 1 zgrzewka = 24 szt]'),
      ('SP_COCACOLA_P071', 'Kropla Beskidu gazowana szkło 0,33 l',
       '[2026-10-28 Ben C1: Warszawa szkło 0,33 x24, NORBLIN i BROWARY PET -> SP_COCACOLA_P196; '
       'brak pozycji na fakturach, przyjęto cenę niegazowanej 0.33 NRG X24; '
       'przed: Kropla Beskidu Gazowana, 34.80, 1 zgrzewka = 24 szt]')
    ) AS v(spid, name, note)
   WHERE sp.supplier_product_id = v.spid
     AND sp.price_estimate_pln = 34.80 AND sp.units_per_purchase_unit = 24;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'glass update: expected 2 rows, got %', n; END IF;
END $$;
COMMIT;

-- AUDIT
-- (a) new products
SELECT product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical,
       active, inventory_order
  FROM products WHERE product_id IN ('P070', 'P071', 'P195', 'P196') ORDER BY inventory_order;
-- expect P070 910, P195 911, P071 920, P196 921
-- (b) Coca-Cola rows for Kropla
SELECT supplier_product_id, location_id, supplier_product_name, units_per_purchase_unit,
       price_estimate_pln, order_note, active
  FROM supplier_products WHERE supplier_id = 'SUP_COCACOLA' AND product_id IN ('P070', 'P071', 'P195', 'P196')
 ORDER BY 1;
-- expect P070/P071 glass x24 48.96; P195/P196 PET x12 17.40; all location_id NULL, active
-- (c) who sees what: Kropla settings per Warsaw location
SELECT s.location_id, string_agg(s.product_id || ' ' || s.min_stock_qty_base::int || '/'
                                 || s.target_stock_qty_base::int || '/' || s.max_stock_qty_base::int,
                                 ', ' ORDER BY s.product_id) AS kropla
  FROM location_product_settings s
  JOIN locations l ON l.location_id = s.location_id
 WHERE s.product_id IN ('P070', 'P071', 'P195', 'P196')
 GROUP BY 1 ORDER BY 1;
-- expect BROWARY P195 12/36/36, P196 12/36/36; NORBLIN P195 30/50/50, P196 15/24/24;
--        BRACKA, ELEKTROWNIA, KEN, WESTFIELD, WOLA only P070/P071 (unchanged); SLONY and SUPERSAM
--        P070/P071 (own catalogs, unchanged); inactive locations may appear with P070/P071 too
-- (d) nobody has both the glass and the PET product
SELECT location_id FROM location_product_settings WHERE product_id IN ('P070', 'P071')
INTERSECT
SELECT location_id FROM location_product_settings WHERE product_id IN ('P195', 'P196');
-- expect 0 rows
-- (e) untouched rows
SELECT supplier_product_id, units_per_purchase_unit, price_estimate_pln
  FROM supplier_products
 WHERE supplier_product_id IN ('SP_COCACOLA_GDA_P070', 'SP_COCACOLA_GDA_P071',
                               'SP_COCACOLA_KAT_P070', 'SP_COCACOLA_KAT_P071') ORDER BY 1;
-- expect GDA x12 17.40, KAT x24 48.96

-- ROLLBACK (commented out). r3 deletes P195/P196 only when nothing references them, else
-- deactivates them. Reference check, for the record:
--   SELECT count(*) FROM order_lines WHERE product_id IN ('P195','P196');            -- must be 0
--   SELECT count(*) FROM receipt_lines WHERE product_id IN ('P195','P196');          -- must be 0
--   SELECT count(*) FROM inventory_count_lines WHERE product_id IN ('P195','P196');  -- must be 0
--   SELECT count(*) FROM finance_line_aliases WHERE product_id IN ('P195','P196');   -- must be 0
-- BEGIN;
-- DO $$
-- DECLARE n int;
-- BEGIN
--   -- r1. settings back on P070/P071 (values copied from the PET rows, original notes restored)
--   INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base,
--                                          max_stock_qty_base, target_stock_qty_base,
--                                          is_critical_for_location, allow_over_max_due_to_packaging,
--                                          notes, inventory_order)
--   SELECT s.location_id || '__' || m.old_pid, s.location_id, m.old_pid, s.min_stock_qty_base,
--          s.max_stock_qty_base, s.target_stock_qty_base, s.is_critical_for_location,
--          s.allow_over_max_due_to_packaging,
--          substring(s.notes FROM '; wcześniej: (.*)$'), s.inventory_order
--     FROM location_product_settings s
--     JOIN (VALUES ('P070', 'P195'), ('P071', 'P196')) AS m(old_pid, new_pid)
--       ON m.new_pid = s.product_id
--    WHERE s.location_id IN ('NORBLIN', 'BROWARY');
--   GET DIAGNOSTICS n = ROW_COUNT;
--   IF n <> 4 THEN RAISE EXCEPTION 'rollback settings insert: expected 4, got %', n; END IF;
--   DELETE FROM location_product_settings WHERE product_id IN ('P195', 'P196');
--   GET DIAGNOSTICS n = ROW_COUNT;
--   IF n <> 4 THEN RAISE EXCEPTION 'rollback settings delete: expected 4, got %', n; END IF;
--   -- r2. shared rows back to PET-era values
--   UPDATE supplier_products
--      SET supplier_product_name = CASE supplier_product_id
--            WHEN 'SP_COCACOLA_P070' THEN 'Kropla Beskidu Niegazowana'
--            ELSE 'Kropla Beskidu Gazowana' END,
--          price_estimate_pln = 34.80, order_note = '1 zgrzewka = 24 szt', notes = ''
--    WHERE supplier_product_id IN ('SP_COCACOLA_P070', 'SP_COCACOLA_P071');
--   GET DIAGNOSTICS n = ROW_COUNT;
--   IF n <> 2 THEN RAISE EXCEPTION 'rollback glass: expected 2, got %', n; END IF;
--   -- r3. delete P195/P196 only if nothing references them; otherwise just deactivate
--   IF NOT EXISTS (SELECT 1 FROM order_lines WHERE product_id IN ('P195', 'P196'))
--      AND NOT EXISTS (SELECT 1 FROM receipt_lines WHERE product_id IN ('P195', 'P196'))
--      AND NOT EXISTS (SELECT 1 FROM inventory_count_lines WHERE product_id IN ('P195', 'P196'))
--      AND NOT EXISTS (SELECT 1 FROM finance_line_aliases WHERE product_id IN ('P195', 'P196')) THEN
--     DELETE FROM supplier_products WHERE supplier_product_id IN ('SP_COCACOLA_P195', 'SP_COCACOLA_P196');
--     GET DIAGNOSTICS n = ROW_COUNT;
--     IF n <> 2 THEN RAISE EXCEPTION 'rollback sp delete: expected 2, got %', n; END IF;
--     DELETE FROM products WHERE product_id IN ('P195', 'P196');
--     GET DIAGNOSTICS n = ROW_COUNT;
--     IF n <> 2 THEN RAISE EXCEPTION 'rollback products delete: expected 2, got %', n; END IF;
--   ELSE
--     UPDATE supplier_products SET active = false
--      WHERE supplier_product_id IN ('SP_COCACOLA_P195', 'SP_COCACOLA_P196');
--     UPDATE products SET active = false WHERE product_id IN ('P195', 'P196');
--   END IF;
-- END $$;
-- COMMIT;
