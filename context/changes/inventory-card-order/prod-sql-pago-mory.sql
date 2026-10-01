-- inventory-card-order — prod data step: Pago and Magazyn Mory list order
-- Supabase project lpzhphufjwrndfogkfub.
--
-- Run ONLY with the operator's explicit approval. INDEPENDENT of the merge and
-- of migration 0027: supplier_products.display_order exists on prod since 0023
-- and the live code already sorts by it, so the new order shows the moment this
-- commits (Captain order screen, Manager order detail, dispatch copy lists and
-- the Transport documents for Pago).
-- Lessons: diff before (the diff IS the rollback), apply, audit after.
--
-- Touches ONLY supplier_products.display_order, keyed by supplier_product_id and
-- scoped to SUP_PAGO / SUP_MORY. Never names, units or packaging.
-- Order source: the "Ordering PB v5" sheet the Manager copies from.
--   Pago rows: Gyros 15 kg, Gyros 25 kg, Souvlaki kurczak, Souvlaki wieprz,
--   Pita, Bifteki.
--   Mory rows: Przyprawa, Boxy PB, "Box beżowy bez logo" (-> P092 Tacki bez logo,
--   INFERRED), Papier do pity, Papier termiczny, Serwetki, then "Rolki typ 1/2/3"
--   (the sheet gives no mapping; ordered here by size, INFERRED), then the
--   products the sheet does not list, in product-id order.
-- Positions in steps of 10 so a later product can slot in. Inactive rows
-- (the old SP_PAGO_* rows that moved to Mory, SP_MORY_P142) stay without a position.

-- ---------- 1. Diff before (save the output — it is the rollback) ----------

SELECT supplier_id, supplier_product_id, product_id, active, display_order
FROM supplier_products
WHERE supplier_id IN ('SUP_PAGO', 'SUP_MORY')
ORDER BY supplier_id, supplier_product_id;
-- expect on the first run: every display_order NULL

-- ---------- 2. Apply (one transaction) ----------

BEGIN;

UPDATE supplier_products AS sp
SET display_order = v.pos
FROM (VALUES
    ('SP_PAGO_P024',  10),  -- Gyros 15 KG
    ('SP_PAGO_P025',  20),  -- Gyros 25 KG
    ('SP_PAGO_P027',  30),  -- Souvlaki Kurczak
    ('SP_PAGO_P028',  40),  -- Souvlaki Wieprz
    ('SP_PAGO_P026',  50),  -- Pita (opakowania) szt 10
    ('SP_PAGO_P145',  60)   -- Bifteki burgers
) AS v(supplier_product_id, pos)
WHERE sp.supplier_product_id = v.supplier_product_id
  AND sp.supplier_id = 'SUP_PAGO';
-- expect: UPDATE 6

UPDATE supplier_products AS sp
SET display_order = v.pos
FROM (VALUES
    ('SP_MORY_P019',  10),  -- Przyprawa do souvlakow
    ('SP_MORY_P089',  20),  -- Boxy PB
    ('SP_MORY_P092',  30),  -- Tacki bez logo (sheet: "Box beżowy bez logo", inferred)
    ('SP_MORY_P090',  40),  -- Papier do Pita (PB)
    ('SP_MORY_P098',  50),  -- Papier termiczny - aluminiowy
    ('SP_MORY_P091',  60),  -- Serwetki PB
    ('SP_MORY_P128',  70),  -- Rolki do kasy 57 na 20  (sheet "Rolki typ 1/2/3": by size, inferred)
    ('SP_MORY_P130',  80),  -- Rolki do kasy 57 na 30
    ('SP_MORY_P184',  90),  -- Rolki do kasy 57 na 80
    ('SP_MORY_P183', 100),  -- Rolki do kasy 80 na 20
    ('SP_MORY_P129', 110),  -- Rolki do kasy 80 na 80
    ('SP_MORY_P173', 120),  -- Skepasti box PB        (not on the sheet)
    ('SP_MORY_P122', 130),  -- Druciak do mycia       (not on the sheet)
    ('SP_MORY_P188', 140),  -- Szczotka do grilla     (not on the sheet)
    ('SP_MORY_P127', 150),  -- Zszywki do zszywacza   (not on the sheet)
    ('SP_MORY_P131', 160),  -- Koperty                (not on the sheet)
    ('SP_MORY_P132', 170),  -- Markery                (not on the sheet)
    ('SP_MORY_P133', 180)   -- Długopisy              (not on the sheet)
) AS v(supplier_product_id, pos)
WHERE sp.supplier_product_id = v.supplier_product_id
  AND sp.supplier_id = 'SUP_MORY';
-- expect: UPDATE 18

COMMIT;

-- ---------- 3. Audit after ----------

-- 3a. Every ACTIVE Pago / Mory row positioned, no duplicate position per supplier,
--     no inactive row positioned.
SELECT supplier_id,
       count(*) FILTER (WHERE active)                              AS active_rows,
       count(*) FILTER (WHERE active AND display_order IS NOT NULL) AS active_positioned,
       count(DISTINCT display_order)                               AS distinct_positions,
       count(*) FILTER (WHERE NOT active AND display_order IS NOT NULL) AS inactive_positioned
FROM supplier_products
WHERE supplier_id IN ('SUP_PAGO', 'SUP_MORY')
GROUP BY 1 ORDER BY 1;
-- expect: SUP_MORY | 18 | 18 | 18 | 0
--         SUP_PAGO |  6 |  6 |  6 | 0

-- 3b. Bukat untouched.
SELECT count(*) FILTER (WHERE display_order IS NOT NULL) AS bukat_positioned
FROM supplier_products WHERE supplier_id = 'SUP_BUKAT';
-- expect: 14

-- ---------- R. Rollback ----------
-- First run: every value was NULL (step 1), so:
--   UPDATE supplier_products SET display_order = NULL
--   WHERE supplier_id IN ('SUP_PAGO', 'SUP_MORY');
-- Later runs: restore the rows saved from step 1.
