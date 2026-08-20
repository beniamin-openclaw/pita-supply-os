-- wolska-blueservice-master-data — tor A, faza 3
-- Apply to PROD Supabase. Idempotent (ON CONFLICT DO NOTHING), purely additive.
-- NO deploy needed: tor A changes no backend or frontend code.
--
-- Per lessons.md "Master-data ops: diff przed, audyt po" — the BEFORE snapshot
-- below IS the rollback path.
--
-- ============================ (1) BEFORE (2026-08-20) ========================
--   products                    145
--   supplier_products           145
--   location_product_settings   568  (WOLA 141 · BRACKA 144 · NORBLIN 145 · KEN 138)
--   P146..P154 present            0
--   WOLA__P143 present            0
--   WOLA × Blue Service items    40
--   order_lines for P143..P154    0   (verified — no history at risk)
--
-- Expected AFTER: 154 / 154 / 578 (WOLA 151) / 9 / 1 / 50
-- ============================================================================

-- ---------------------------- (2) APPLY -------------------------------------

INSERT INTO products
    (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES
    ('P146', NULL, 'Aroma Patyczki zapachowe',                              'Chemia', 'szt', FALSE, TRUE, 'dodane 2026-08-20 (wolska-blueservice-master-data) - arkusz Wolskiej'),
    ('P147', NULL, 'Attis odświeżacz powietrza 300 ml',                     'Chemia', 'szt', FALSE, TRUE, 'dodane 2026-08-20 (wolska-blueservice-master-data) - arkusz Wolskiej'),
    ('P148', NULL, 'Szczotka do zamiatania na kiju Vileda',                 'Chemia', 'szt', FALSE, TRUE, 'dodane 2026-08-20 (wolska-blueservice-master-data) - arkusz Wolskiej (arkusz: Szczotlka)'),
    ('P149', NULL, 'Szufelka ze zmiotką',                                   'Chemia', 'szt', FALSE, TRUE, 'dodane 2026-08-20 (wolska-blueservice-master-data) - arkusz Wolskiej'),
    ('P150', NULL, 'Marker podświetlacz',                                   'Chemia', 'szt', FALSE, TRUE, 'dodane 2026-08-20 (wolska-blueservice-master-data) - kategoria Chemia za arkuszem (zakreslacz)'),
    ('P151', NULL, 'Płyn do podłogi 5L',                                    'Chemia', 'szt', FALSE, TRUE, 'dodane 2026-08-20 (wolska-blueservice-master-data) - arkusz Wolskiej'),
    ('P152', NULL, 'Cleaner w sprayu do stolików drewnianych lakierowanych','Chemia', 'szt', FALSE, TRUE, 'dodane 2026-08-20 (wolska-blueservice-master-data) - arkusz Wolskiej'),
    ('P153', NULL, 'Zapas do mopa płaskiego Vileda Ultra Max',              'Chemia', 'szt', FALSE, TRUE, 'dodane 2026-08-20 (wolska-blueservice-master-data) - arkusz Wolskiej'),
    ('P154', NULL, 'Tetra',                                                 'Chemia', 'szt', FALSE, TRUE, 'dodane 2026-08-20 (wolska-blueservice-master-data) - arkusz Wolskiej')
ON CONFLICT (product_id) DO NOTHING;

-- price_estimate_pln left NULL on purpose (Corfu / P143-P145 convention):
-- order valuation skips these rows rather than carrying a guessed number.
INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit,
     units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes)
VALUES
    ('SP_BLUESERV_P146', 'SUP_BLUESERV', 'P146', 'Aroma Patyczki zapachowe',                               'szt', 1, 'full_only', NULL, TRUE, 'cena do uzupelnienia po pierwszej fakturze'),
    ('SP_BLUESERV_P147', 'SUP_BLUESERV', 'P147', 'Attis odświeżacz powietrza 300 ml',                      'szt', 1, 'full_only', NULL, TRUE, 'cena do uzupelnienia po pierwszej fakturze'),
    ('SP_BLUESERV_P148', 'SUP_BLUESERV', 'P148', 'Szczotka do zamiatania na kiju Vileda',                  'szt', 1, 'full_only', NULL, TRUE, 'cena do uzupelnienia po pierwszej fakturze'),
    ('SP_BLUESERV_P149', 'SUP_BLUESERV', 'P149', 'Szufelka ze zmiotką',                                    'szt', 1, 'full_only', NULL, TRUE, 'cena do uzupelnienia po pierwszej fakturze'),
    ('SP_BLUESERV_P150', 'SUP_BLUESERV', 'P150', 'Marker podświetlacz',                                    'szt', 1, 'full_only', NULL, TRUE, 'cena do uzupelnienia po pierwszej fakturze'),
    ('SP_BLUESERV_P151', 'SUP_BLUESERV', 'P151', 'Płyn do podłogi 5L',                                     'szt', 1, 'full_only', NULL, TRUE, 'cena do uzupelnienia po pierwszej fakturze'),
    ('SP_BLUESERV_P152', 'SUP_BLUESERV', 'P152', 'Cleaner w sprayu do stolików drewnianych lakierowanych', 'szt', 1, 'full_only', NULL, TRUE, 'cena do uzupelnienia po pierwszej fakturze'),
    ('SP_BLUESERV_P153', 'SUP_BLUESERV', 'P153', 'Zapas do mopa płaskiego Vileda Ultra Max',               'szt', 1, 'full_only', NULL, TRUE, 'cena do uzupelnienia po pierwszej fakturze'),
    ('SP_BLUESERV_P154', 'SUP_BLUESERV', 'P154', 'Tetra',                                                  'szt', 1, 'full_only', NULL, TRUE, 'cena do uzupelnienia po pierwszej fakturze')
ON CONFLICT (supplier_product_id) DO NOTHING;

-- WOLA thresholds from Tushar's sheet. target = max (repo-wide convention).
-- WOLA__P143 closes an existing gap: P143 was added for Bracka/Norblin at the
-- Norblin rollout but never got WOLA thresholds, so it was invisible at Wolska.
INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base,
     target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES
    ('WOLA__P143', 'WOLA', 'P143', 1, 3, 3, FALSE, FALSE, 'wolska-blueservice-master-data 2026-08-20: arkusz min/max'),
    ('WOLA__P146', 'WOLA', 'P146', 1, 2, 2, FALSE, FALSE, 'wolska-blueservice-master-data 2026-08-20: arkusz min/max'),
    ('WOLA__P147', 'WOLA', 'P147', 1, 3, 3, FALSE, FALSE, 'wolska-blueservice-master-data 2026-08-20: arkusz min/max'),
    ('WOLA__P148', 'WOLA', 'P148', 1, 2, 2, FALSE, FALSE, 'wolska-blueservice-master-data 2026-08-20: arkusz min/max'),
    ('WOLA__P149', 'WOLA', 'P149', 1, 2, 2, FALSE, FALSE, 'wolska-blueservice-master-data 2026-08-20: arkusz min/max'),
    ('WOLA__P150', 'WOLA', 'P150', 1, 3, 3, FALSE, FALSE, 'wolska-blueservice-master-data 2026-08-20: arkusz min/max'),
    ('WOLA__P151', 'WOLA', 'P151', 1, 2, 2, FALSE, FALSE, 'wolska-blueservice-master-data 2026-08-20: arkusz min/max'),
    ('WOLA__P152', 'WOLA', 'P152', 1, 2, 2, FALSE, FALSE, 'wolska-blueservice-master-data 2026-08-20: arkusz min/max'),
    ('WOLA__P153', 'WOLA', 'P153', 1, 2, 2, FALSE, FALSE, 'wolska-blueservice-master-data 2026-08-20: arkusz min/max'),
    ('WOLA__P154', 'WOLA', 'P154', 2, 5, 5, FALSE, FALSE, 'wolska-blueservice-master-data 2026-08-20: arkusz min/max')
ON CONFLICT (setting_id) DO NOTHING;

-- ---------------------------- (3) AUDYT PO ----------------------------------
-- Expect: 154 / 154 / 151 / 9 / 1 / 50, and zero rows from every assertion below.
--
-- SELECT (SELECT count(*) FROM products) AS products,
--        (SELECT count(*) FROM supplier_products) AS supplier_products,
--        (SELECT count(*) FROM location_product_settings WHERE location_id='WOLA') AS wola_settings;
--
-- -- a) min <= max and target = max on every new row
-- SELECT setting_id FROM location_product_settings
--  WHERE location_id='WOLA' AND (product_id BETWEEN 'P146' AND 'P154' OR product_id='P143')
--    AND NOT (min_stock_qty_base <= max_stock_qty_base
--             AND max_stock_qty_base = target_stock_qty_base);
--
-- -- b) no placeholder values leaked in (the 'TBD' email class of bug)
-- SELECT product_id FROM products WHERE product_id BETWEEN 'P146' AND 'P154'
--    AND (product_name_pl ILIKE '%TBD%' OR product_category NOT IN
--        (SELECT DISTINCT product_category FROM products WHERE product_id < 'P146'));
--
-- -- c) every new product resolves to exactly one supplier_product
-- SELECT p.product_id FROM products p LEFT JOIN supplier_products s USING (product_id)
--  WHERE p.product_id BETWEEN 'P146' AND 'P154'
--  GROUP BY p.product_id HAVING count(s.supplier_product_id) <> 1;
--
-- -- d) no other location picked up rows by accident
-- SELECT location_id, count(*) FROM location_product_settings
--  WHERE product_id BETWEEN 'P146' AND 'P154' GROUP BY 1;   -- expect WOLA / 9 only

-- ---------------------------- ROLLBACK --------------------------------------
-- Restores the BEFORE snapshot exactly. FK order matters.
-- DELETE FROM location_product_settings
--  WHERE location_id='WOLA' AND (product_id BETWEEN 'P146' AND 'P154' OR product_id='P143');
-- DELETE FROM supplier_products WHERE product_id BETWEEN 'P146' AND 'P154';
-- DELETE FROM products          WHERE product_id BETWEEN 'P146' AND 'P154';
