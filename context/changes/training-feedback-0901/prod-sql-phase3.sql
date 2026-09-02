-- ============================================================
-- training-feedback-0901 — Phase 3: master-data batch (UNBLOCKED items only)
--
-- Shape follows wolska-blueservice-master-data/prod-sql.sql and the
-- lessons.md rule "Master-data ops: diff before, audit after":
--   (1) BEFORE snapshot   — run it and SAVE the output; that IS the rollback
--   (2) APPLY             — idempotent
--   (3) AUDIT             — assertions that must all return zero rows
--
-- Baseline read from prod 2026-09-02: 175 products, max product_id = P175.
-- New SKUs therefore start at P176.
--
-- STILL BLOCKED, deliberately NOT in this file (waiting on Marek —
-- https://trello.com/c/UIpn3qyg and https://trello.com/c/PG9I61nu, due 04.09):
--   * roll pack sizes (P128/P129/P130/P142 szt -> opak, po 10 or po 6)
--   * tapes (absent from the catalogue entirely)
--   * crates: empty vs holding empty bottles (absent entirely)
--   * bottle-crate pairing rules
--   * suppliers.minimum_order_value_pln real values
--   * a chicken-gyros BLOCK SKU under SUP_PAGO (operator confirmation)
-- ============================================================


-- ------------------------------------------------------------
-- (1) BEFORE — run first, save the output. This is the rollback.
-- ------------------------------------------------------------
-- select product_id, product_name_pl, product_category, inventory_unit, active
--   from products where product_id in ('P012','P036','P037','P046','P134','P135','P157');
-- select supplier_product_id, supplier_id, product_id, supplier_product_name,
--        purchase_unit, units_per_purchase_unit, active
--   from supplier_products where product_id in ('P012','P037','P134','P157');
-- select setting_id, location_id, product_id, min_stock_qty_base,
--        max_stock_qty_base, target_stock_qty_base
--   from location_product_settings where product_id in ('P037','P134','P157');
-- select supplier_id, supplier_name, active from suppliers
--   where supplier_id in ('SUP_ALLEGRO','SUP_SELGROS');


-- ------------------------------------------------------------
-- (2) APPLY
-- ------------------------------------------------------------

BEGIN;

-- 2.1  "Bąbila" — not stocked any more (operator: "tego nie bierzemy, nie szło").
UPDATE products SET active = false WHERE product_id = 'P135';   -- Bombilla

-- 2.2  Tirokafteri — tubs are 2 kg, not 3 kg; the Pago row was also priced per
--      kg while the goods arrive in tubs (operator, training 01.09).
UPDATE supplier_products SET units_per_purchase_unit = 2
  WHERE product_id = 'P012';
UPDATE supplier_products SET purchase_unit = 'wiadro'
  WHERE product_id = 'P012' AND supplier_id = 'SUP_PAGO';

-- 2.3  Corfu Pilsner already existed (P157) but was configured as loose bottles
--      while every other Corfu is a 6-pack, and it had no thresholds anywhere —
--      which is why Bracka/KEN/Wolska could not order it.
UPDATE supplier_products
   SET purchase_unit = 'zgrzewka', units_per_purchase_unit = 6
 WHERE product_id = 'P157';

INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base,
     max_stock_qty_base, target_stock_qty_base)
VALUES
    ('WOLA__P157',   'WOLA',   'P157', 6, 24, 24),
    ('BRACKA__P157', 'BRACKA', 'P157', 6, 24, 24),
    ('KEN__P157',    'KEN',    'P157', 6, 24, 24)
ON CONFLICT (location_id, product_id) DO NOTHING;
-- ^ CONFIRM the 6/24/24 levels with the operator; they mirror the other Corfu
--   lines. Nothing else in this file invents a threshold.

-- 2.4  Allegro + Selgros are real purchasing channels but sat inactive.
--      (Selgros already carries supplier_products rows.)
UPDATE suppliers SET active = true
 WHERE supplier_id IN ('SUP_ALLEGRO', 'SUP_SELGROS');

-- 2.5  GYROS SPLIT (operator decision 01.09):
--      cut state everywhere, meat type only where chicken is stocked.
--      Four SKUs at KEN, the two pork ones at WOLA / BRACKA / NORBLIN / BROWARY.
--      P037 "Gyros (ścięty + nieścięty)" is DEACTIVATED, never deleted —
--      order_lines history references it.
INSERT INTO products
    (product_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES
    ('P176', 'Gyros wieprzowy ścięty',    'Produkcja', 'kg', false, true, 'Split z P037 (training-feedback-0901)'),
    ('P177', 'Gyros wieprzowy nieścięty', 'Produkcja', 'kg', false, true, 'Split z P037 (training-feedback-0901)'),
    ('P178', 'Gyros kurczak ścięty',      'Produkcja', 'kg', false, true, 'Split z P037 — tylko KEN'),
    ('P179', 'Gyros kurczak nieścięty',   'Produkcja', 'kg', false, true, 'Split z P037 — tylko KEN')
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name,
     purchase_unit, units_per_purchase_unit, price_estimate_pln, active)
VALUES
    ('SP_INTERNAL_P176', 'SUP_INTERNAL', 'P176', 'Gyros wieprzowy ścięty',    'kg', 1, 0, true),
    ('SP_INTERNAL_P177', 'SUP_INTERNAL', 'P177', 'Gyros wieprzowy nieścięty', 'kg', 1, 0, true),
    ('SP_INTERNAL_P178', 'SUP_INTERNAL', 'P178', 'Gyros kurczak ścięty',      'kg', 1, 0, true),
    ('SP_INTERNAL_P179', 'SUP_INTERNAL', 'P179', 'Gyros kurczak nieścięty',   'kg', 1, 0, true)
ON CONFLICT (supplier_product_id) DO NOTHING;

-- Thresholds carried from each location's existing P037 row onto BOTH pork
-- variants. THIS IS A PLACEHOLDER SPLIT: today's single number covers cut and
-- uncut together, so duplicating it overstates the total. The operator must
-- rebalance the pairs — flagged loudly rather than silently guessed.
INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base,
     max_stock_qty_base, target_stock_qty_base)
SELECT loc || '__' || pid, loc, pid, mn, mx, tg
FROM (
    VALUES
      ('WOLA',    1.0, 3.0, 3.0),
      ('BRACKA',  1.0, 3.0, 3.0),
      ('KEN',     1.0, 3.0, 3.0),
      ('NORBLIN', 1.3, 3.8, 3.8),
      ('BROWARY', 15.0, 25.0, 25.0)
) AS l(loc, mn, mx, tg)
CROSS JOIN (VALUES ('P176'), ('P177')) AS p(pid)
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Chicken gyros: KEN only ("Kurczak jest tylko na KEN").
INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base,
     max_stock_qty_base, target_stock_qty_base)
VALUES
    ('KEN__P178', 'KEN', 'P178', 1.0, 3.0, 3.0),
    ('KEN__P179', 'KEN', 'P179', 1.0, 3.0, 3.0)
ON CONFLICT (location_id, product_id) DO NOTHING;

UPDATE products SET active = false WHERE product_id = 'P037';

-- 2.6  Cooked chickpeas as a production item, next to the cooked pearl barley.
--      P046 CIECIORKA stays as the PURCHASED tin (Spożywcze) — untouched.
UPDATE products
   SET product_name_pl = 'Kasza Pęczak ugotowana'
 WHERE product_id = 'P036';

INSERT INTO products
    (product_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES
    ('P180', 'Cieciorka gotowana', 'Produkcja', 'kg', false, true, 'training-feedback-0901')
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name,
     purchase_unit, units_per_purchase_unit, price_estimate_pln, active)
VALUES
    ('SP_INTERNAL_P180', 'SUP_INTERNAL', 'P180', 'Cieciorka gotowana', 'kg', 1, 0, true)
ON CONFLICT (supplier_product_id) DO NOTHING;

-- 2.7  GAS CYLINDERS — operator: "rozróżnić butle gazowe na otwarte i zamknięte".
--      A sealed cylinder is what you order; an opened one is what you are using.
--      P134 is deactivated in favour of the pair.
--      CONFIRM before running: this assumes Kamino supplies the SEALED one and
--      the opened one is inventory-only (SUP_INTERNAL).
INSERT INTO products
    (product_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES
    ('P181', 'Butla gazowa 10L zamknięta', 'Gaz', 'szt', false, true, 'Split z P134'),
    ('P182', 'Butla gazowa 10L otwarta',   'Gaz', 'szt', false, true, 'Split z P134 — stan w użyciu')
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name,
     purchase_unit, units_per_purchase_unit, price_estimate_pln, active)
VALUES
    ('SP_KAMINO_P181',   'SUP_KAMINO',   'P181', 'Butla gazowa 10L', 'szt', 1, 55.61, true),
    ('SP_INTERNAL_P182', 'SUP_INTERNAL', 'P182', 'Butla otwarta',    'szt', 1, 0,     true)
ON CONFLICT (supplier_product_id) DO NOTHING;

INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base,
     max_stock_qty_base, target_stock_qty_base)
VALUES
    ('WOLA__P181',    'WOLA',    'P181', 2, 8, 8),
    ('BRACKA__P181',  'BRACKA',  'P181', 2, 8, 8),
    ('KEN__P181',     'KEN',     'P181', 2, 8, 8),
    ('NORBLIN__P181', 'NORBLIN', 'P181', 0, 0, 0),
    ('WOLA__P182',    'WOLA',    'P182', 0, 0, 0),
    ('BRACKA__P182',  'BRACKA',  'P182', 0, 0, 0),
    ('KEN__P182',     'KEN',     'P182', 0, 0, 0),
    ('NORBLIN__P182', 'NORBLIN', 'P182', 0, 0, 0)
ON CONFLICT (location_id, product_id) DO NOTHING;

UPDATE products SET active = false WHERE product_id = 'P134';

COMMIT;


-- ------------------------------------------------------------
-- (3) AUDIT — every query below must return ZERO rows.
-- ------------------------------------------------------------
-- min above max
-- select setting_id from location_product_settings where min_stock_qty_base > max_stock_qty_base;

-- target diverging from max (house convention)
-- select setting_id from location_product_settings where target_stock_qty_base <> max_stock_qty_base;

-- a new product with no supplier_product row
-- select p.product_id from products p
--  left join supplier_products sp on sp.product_id = p.product_id
--  where p.product_id in ('P176','P177','P178','P179','P180','P181','P182')
--    and sp.supplier_product_id is null;

-- orphan FKs
-- select sp.supplier_product_id from supplier_products sp
--  left join products p on p.product_id = sp.product_id where p.product_id is null;
-- select s.setting_id from location_product_settings s
--  left join products p on p.product_id = s.product_id where p.product_id is null;

-- chicken gyros must exist ONLY at KEN
-- select setting_id from location_product_settings
--  where product_id in ('P178','P179') and location_id <> 'KEN';

-- placeholder names
-- select product_id from products where product_name_pl ~* '^(tbd|test|xxx)$';

-- SANITY (expect rows): the four gyros SKUs and their per-location spread
-- select p.product_id, p.product_name_pl, count(s.setting_id) as locations
--   from products p left join location_product_settings s on s.product_id = p.product_id
--  where p.product_id in ('P176','P177','P178','P179') group by 1,2 order by 1;


-- ------------------------------------------------------------
-- ROLLBACK (if needed) — restore from the (1) snapshot, then:
-- ------------------------------------------------------------
-- UPDATE products SET active = true WHERE product_id in ('P037','P134','P135');
-- UPDATE products SET product_name_pl = 'Kasza Pęczak' WHERE product_id = 'P036';
-- UPDATE supplier_products SET units_per_purchase_unit = 3 WHERE product_id = 'P012';
-- UPDATE supplier_products SET purchase_unit = 'kg' WHERE product_id='P012' AND supplier_id='SUP_PAGO';
-- UPDATE supplier_products SET purchase_unit='szt', units_per_purchase_unit=1 WHERE product_id='P157';
-- UPDATE suppliers SET active = false WHERE supplier_id IN ('SUP_ALLEGRO','SUP_SELGROS');
-- DELETE FROM location_product_settings WHERE product_id IN ('P157','P176','P177','P178','P179','P181','P182');
-- DELETE FROM supplier_products WHERE product_id IN ('P176','P177','P178','P179','P180','P181','P182');
-- DELETE FROM products WHERE product_id IN ('P176','P177','P178','P179','P180','P181','P182');
