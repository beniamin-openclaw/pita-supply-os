-- ============================================================
-- inventory-confirm-and-history — Track C: prod master-data batch
-- = the unrun training-feedback-0901 phase 3, re-verified 2026-09-06, plus
--   the Corfu `active` fix and the Spec Food chicken block.
-- BEFORE snapshot: before-snapshot-2026-09-06.md (the rollback reference).
-- Idempotent (ON CONFLICT DO NOTHING / absolute UPDATEs). One transaction.
--
-- DELIBERATELY NOT DONE (differs from phase 3):
--   * SUP_ALLEGRO / SUP_SELGROS stay inactive — the Captain picker lists every
--     active supplier globally (CaptainMP.tsx:129) and neither has a single
--     ACTIVE supplier_product (Allegro 0 rows, Selgros 39 all inactive), so
--     activating them adds only an empty tab at every location. Allegro's own
--     notes say the same. Activate together with their first catalogue rows.
--   * No "Gyros kurczak nieścięty" production SKU — operator 2026-09-06: chicken
--     is a purchased 15 kg block (Spec Food) and a CUT production item only.
-- ============================================================

BEGIN;

-- 1  Bombilla — not stocked any more.
UPDATE products SET active = false WHERE product_id = 'P135';

-- 2  Tirokafteri — tubs are 2 kg; the Pago row was priced per kg.
UPDATE supplier_products SET units_per_purchase_unit = 2 WHERE product_id = 'P012';
UPDATE supplier_products SET purchase_unit = 'wiadro'
 WHERE product_id = 'P012' AND supplier_id = 'SUP_PAGO';

-- 3  Corfu Pilsner (P157): the supplier row was INACTIVE (phase 3 missed it),
--    loose bottles instead of a 6-pack, thresholds only at Stary Browar.
--    Thresholds mirror each location's OWN Corfu Lager row (read 2026-09-06).
UPDATE supplier_products
   SET active = true, purchase_unit = 'zgrzewka', units_per_purchase_unit = 6,
       notes = 'zgrzewka 6 szt (inventory-confirm-and-history 2026-09-06)'
 WHERE supplier_product_id = 'SP_FILBER_P157';

INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base,
     target_stock_qty_base, notes)
VALUES
    ('WOLA__P157',   'WOLA',   'P157', 6, 6,  6,  'kopia progów Corfu Lager 2026-09-06'),
    ('BRACKA__P157', 'BRACKA', 'P157', 5, 12, 12, 'kopia progów Corfu Lager 2026-09-06'),
    ('KEN__P157',    'KEN',    'P157', 6, 6,  6,  'kopia progów Corfu Lager 2026-09-06')
ON CONFLICT (location_id, product_id) DO NOTHING;

-- 4  GYROS SPLIT. P037 "Gyros (ścięty + nieścięty)" -> P176/P177 pork cut/uncut
--    (production, every location that had P037 — same numbers, incl. the 0/0/0
--    TBC rows, so the inventory list keeps gyros everywhere it had it).
--    Chicken (KEN only): P178 cut production item + P179 purchased 15 kg block
--    from Spec Food. P037 deactivated, never deleted (count-line history).
INSERT INTO products
    (product_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES
    ('P176', 'Gyros wieprzowy ścięty',        'Produkcja', 'kg', false, true, 'Split z P037 (2026-09-06)'),
    ('P177', 'Gyros wieprzowy nieścięty',     'Produkcja', 'kg', false, true, 'Split z P037 (2026-09-06)'),
    ('P178', 'Gyros kurczak ścięty',          'Produkcja', 'kg', false, true, 'Tylko KEN; z bloku P179 (2026-09-06)'),
    ('P179', 'Kebab z Kurczaka 50/50 15 KG',  'Mrożonki',  'kg', false, true, 'Blok 15 kg, Spec Food, tylko KEN (2026-09-06)')
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name,
     purchase_unit, units_per_purchase_unit, price_estimate_pln, active, notes)
VALUES
    ('SP_INTERNAL_P176', 'SUP_INTERNAL', 'P176', 'Gyros wieprzowy ścięty',       'kg',   1,  0,    true, 'Internal production'),
    ('SP_INTERNAL_P177', 'SUP_INTERNAL', 'P177', 'Gyros wieprzowy nieścięty',    'kg',   1,  0,    true, 'Internal production'),
    ('SP_INTERNAL_P178', 'SUP_INTERNAL', 'P178', 'Gyros kurczak ścięty',         'kg',   1,  0,    true, 'Internal production (KEN)'),
    ('SP_SPEC_P179',     'SUP_SPEC',     'P179', 'Kebab z Kurczaka 50/50 15KG',  'blok', 15, NULL, true, 'nazwa jak w mailach zamówień KEN 2025-11/12; cena TBC')
ON CONFLICT (supplier_product_id) DO NOTHING;

-- Pork variants: every location's P037 row copied verbatim onto both. PLACEHOLDER:
-- one number now covers two SKUs (operator 2026-09-06: leave as is, rebalance later).
INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base,
     target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
SELECT s.location_id || '__' || p.pid, s.location_id, p.pid,
       s.min_stock_qty_base, s.max_stock_qty_base, s.target_stock_qty_base,
       s.is_critical_for_location, s.allow_over_max_due_to_packaging,
       'kopia P037 2026-09-06 (placeholder, do rozbicia): ' || s.notes
  FROM location_product_settings s
 CROSS JOIN (VALUES ('P176'), ('P177')) AS p(pid)
 WHERE s.product_id = 'P037'
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Chicken: KEN only. Cut production item mirrors KEN's P037 numbers; the block
-- mirrors the ordering pattern seen in mail (3–4 blocks per delivery) = 1/4/4
-- blocks in kg, critical like KEN's Gyros 15 KG. Both PLACEHOLDERS.
INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base,
     target_stock_qty_base, is_critical_for_location, notes)
VALUES
    ('KEN__P178', 'KEN', 'P178', 1,  3,  3,  false, 'placeholder = KEN P037 (2026-09-06)'),
    ('KEN__P179', 'KEN', 'P179', 15, 60, 60, true,  'placeholder: 1/4/4 bloki wg maili zamówień 2025-11/12 (2026-09-06)')
ON CONFLICT (location_id, product_id) DO NOTHING;

UPDATE products SET active = false WHERE product_id = 'P037';

-- 5  Spec Food becomes a real email channel (facts from the Nov-2025 mail thread).
UPDATE suppliers
   SET active = true,
       email = 'l.raczkowski@specfood.pl',
       ordering_method = 'email',
       notes = 'SPEC Food Service — Łukasz Raczkowski, tel. 502-725-701. Kebab z kurczaka 50/50 15 kg dla KEN; dostawa 11:00–12:00, Al. KEN 21 U13 (wjazd od tyłu). Faktury: klaudia@pitabros.pl. (2026-09-06)'
 WHERE supplier_id = 'SUP_SPEC';

-- 6  Cooked chickpeas as a production item; P046 stays the purchased tin.
UPDATE products SET product_name_pl = 'Kasza Pęczak ugotowana' WHERE product_id = 'P036';

INSERT INTO products
    (product_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P180', 'Cieciorka gotowana', 'Produkcja', 'kg', false, true, 'training-feedback-0901 / 2026-09-06')
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name,
     purchase_unit, units_per_purchase_unit, price_estimate_pln, active, notes)
VALUES ('SP_INTERNAL_P180', 'SUP_INTERNAL', 'P180', 'Cieciorka gotowana', 'kg', 1, 0, true, 'Internal production')
ON CONFLICT (supplier_product_id) DO NOTHING;

-- 7  GAS CYLINDERS — sealed (ordered from Kamino) vs opened (in use, inventory only).
--    P134 deactivated in favour of the pair; thresholds copied from P134.
INSERT INTO products
    (product_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES
    ('P181', 'Butla gazowa 10L zamknięta', 'Gaz', 'szt', false, true, 'Split z P134 (2026-09-06)'),
    ('P182', 'Butla gazowa 10L otwarta',   'Gaz', 'szt', false, true, 'Split z P134 — stan w użyciu (2026-09-06)')
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name,
     purchase_unit, units_per_purchase_unit, price_estimate_pln, active, notes)
VALUES
    ('SP_KAMINO_P181',   'SUP_KAMINO',   'P181', 'Butla gazowa 10L', 'szt', 1, 55.61, true, 'cena z SP_KAMINO_P134'),
    ('SP_INTERNAL_P182', 'SUP_INTERNAL', 'P182', 'Butla otwarta',    'szt', 1, 0,     true, 'stan w użyciu, nie zamawiana')
ON CONFLICT (supplier_product_id) DO NOTHING;

INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base,
     target_stock_qty_base, notes)
SELECT s.location_id || '__P181', s.location_id, 'P181',
       s.min_stock_qty_base, s.max_stock_qty_base, s.target_stock_qty_base,
       'kopia P134 2026-09-06'
  FROM location_product_settings s WHERE s.product_id = 'P134'
ON CONFLICT (location_id, product_id) DO NOTHING;

INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base,
     target_stock_qty_base, notes)
SELECT s.location_id || '__P182', s.location_id, 'P182', 0, 0, 0,
       'stan w użyciu — bez progów (2026-09-06)'
  FROM location_product_settings s WHERE s.product_id = 'P134'
ON CONFLICT (location_id, product_id) DO NOTHING;

UPDATE products SET active = false WHERE product_id = 'P134';

COMMIT;

-- ------------------------------------------------------------
-- AUDIT — every query must return ZERO rows (run after COMMIT)
-- ------------------------------------------------------------
-- select setting_id from location_product_settings where min_stock_qty_base > max_stock_qty_base;
-- select setting_id from location_product_settings where target_stock_qty_base <> max_stock_qty_base;
-- select p.product_id from products p left join supplier_products sp on sp.product_id = p.product_id
--  where p.product_id in ('P176','P177','P178','P179','P180','P181','P182') and sp.supplier_product_id is null;
-- select sp.supplier_product_id from supplier_products sp left join products p on p.product_id = sp.product_id where p.product_id is null;
-- select s.setting_id from location_product_settings s left join products p on p.product_id = s.product_id where p.product_id is null;
-- select setting_id from location_product_settings where product_id in ('P178','P179') and location_id <> 'KEN';
-- select supplier_id from suppliers where active and email is not null and email not like '%@%' and ordering_method = 'email';

-- ------------------------------------------------------------
-- ROLLBACK — restore from before-snapshot-2026-09-06.md:
-- ------------------------------------------------------------
-- UPDATE products SET active = true WHERE product_id in ('P037','P134','P135');
-- UPDATE products SET product_name_pl = 'Kasza Pęczak' WHERE product_id = 'P036';
-- UPDATE supplier_products SET units_per_purchase_unit = 3 WHERE product_id = 'P012';
-- UPDATE supplier_products SET purchase_unit = 'kg' WHERE product_id='P012' AND supplier_id='SUP_PAGO';
-- UPDATE supplier_products SET active=false, purchase_unit='szt', units_per_purchase_unit=1, notes='packaging TBC' WHERE supplier_product_id='SP_FILBER_P157';
-- UPDATE suppliers SET active=false, email=NULL, ordering_method='manual', notes='method TBC by operator' WHERE supplier_id='SUP_SPEC';
-- DELETE FROM location_product_settings WHERE product_id IN ('P176','P177','P178','P179','P181','P182') OR setting_id IN ('WOLA__P157','BRACKA__P157','KEN__P157');
-- DELETE FROM supplier_products WHERE product_id IN ('P176','P177','P178','P179','P180','P181','P182');
-- DELETE FROM products WHERE product_id IN ('P176','P177','P178','P179','P180','P181','P182');
