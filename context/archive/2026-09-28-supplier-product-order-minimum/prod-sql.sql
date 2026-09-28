-- supplier-product-order-minimum — prod data step
-- Supabase project lpzhphufjwrndfogkfub.
--
-- Run ONLY with the operator's explicit approval, and only AFTER:
--   1. migration 0023 is applied on prod (list_migrations shows it), and
--   2. the PR is merged and the new Railway backend + Vercel bundle are live.
-- Lessons: diff before (the diff IS the rollback), apply, audit after.
--
-- Touches ONLY supplier_products.display_order and
-- supplier_products.counts_toward_minimum, keyed by supplier_product_id and
-- scoped to SUP_BUKAT. It never writes names, units or packaging: a parallel
-- coordinator batch renames P011/P012/P014/P007 and changes their units — ids
-- are stable, names are not, so nothing below matches on a name.
--
-- Positions come in steps of 10 (operator order, Marek 2026-09-28) so a later
-- product can slot in without renumbering. SP_BUKAT_P135 (Bombilla, inactive)
-- stays without a position.

-- ---------- 1. Diff before (save the output — it is the rollback) ----------

SELECT supplier_product_id, product_id, supplier_product_name, active,
       display_order, counts_toward_minimum
FROM supplier_products
WHERE supplier_id = 'SUP_BUKAT'
ORDER BY supplier_product_id;

-- Expected right after migration 0023: 0 positioned rows, 0 excluded rows.
SELECT count(*) FILTER (WHERE display_order IS NOT NULL) AS positioned,
       count(*) FILTER (WHERE NOT counts_toward_minimum)  AS excluded
FROM supplier_products;

-- ---------- 2. Apply ----------

UPDATE supplier_products AS sp
SET display_order = v.pos
FROM (VALUES
    ('SP_BUKAT_P006',  10),  -- Pomidor
    ('SP_BUKAT_P016',  20),  -- Cebula czerwona
    ('SP_BUKAT_P004',  30),  -- Awokado
    ('SP_BUKAT_P002',  40),  -- Cytryna
    ('SP_BUKAT_P005',  50),  -- Ogórek
    ('SP_BUKAT_P003',  60),  -- Papryka zielona
    ('SP_BUKAT_P008',  70),  -- Sałata bolero mix 150gr
    ('SP_BUKAT_P007',  80),  -- Rucola
    ('SP_BUKAT_P009',  90),  -- Natka Pietruszki
    ('SP_BUKAT_P010', 100),  -- Czosnek
    ('SP_BUKAT_P018', 110),  -- Cebula Biała
    ('SP_BUKAT_P011', 120),  -- Tzatzyki
    ('SP_BUKAT_P012', 130),  -- Tirokafteri / Hot Feta
    ('SP_BUKAT_P014', 140)   -- Feta blok
) AS v(supplier_product_id, pos)
WHERE sp.supplier_product_id = v.supplier_product_id
  AND sp.supplier_id = 'SUP_BUKAT';
-- expect: UPDATE 14

UPDATE supplier_products
SET counts_toward_minimum = false
WHERE supplier_id = 'SUP_BUKAT'
  AND supplier_product_id IN ('SP_BUKAT_P011', 'SP_BUKAT_P012', 'SP_BUKAT_P014');
-- expect: UPDATE 3

-- ---------- 3. Audit after ----------

-- Exactly 14 positioned rows, all SUP_BUKAT, 14 distinct positions 10..140.
SELECT count(*) AS positioned,
       count(DISTINCT display_order) AS distinct_positions,
       min(display_order) AS min_pos,
       max(display_order) AS max_pos,
       bool_and(supplier_id = 'SUP_BUKAT') AS all_bukat
FROM supplier_products
WHERE display_order IS NOT NULL;
-- expect: 14 | 14 | 10 | 140 | true

-- Exactly the three excluded rows.
SELECT supplier_product_id
FROM supplier_products
WHERE NOT counts_toward_minimum
ORDER BY supplier_product_id;
-- expect: SP_BUKAT_P011, SP_BUKAT_P012, SP_BUKAT_P014

-- Read back the Bukat list in the order every screen now uses.
SELECT supplier_product_id, supplier_product_name, display_order, counts_toward_minimum
FROM supplier_products
WHERE supplier_id = 'SUP_BUKAT'
ORDER BY display_order NULLS LAST, supplier_product_id;

-- ---------- Rollback ----------
-- UPDATE supplier_products SET display_order = NULL WHERE supplier_id = 'SUP_BUKAT';
-- UPDATE supplier_products SET counts_toward_minimum = true WHERE supplier_id = 'SUP_BUKAT';
