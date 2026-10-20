-- porzadek-2026-10 — real Pago catalogue codes back in supplier_products.supplier_sku
-- Ben, chat 2026-10-20: "Załącznik produkujący dla Pago nie ma numerów kodów produktów. Napraw to."
--   then "Akcept. Naprawiaj: SQL z kodami na prod i kolumna Kod w PDF Pago. Bifteki = BURG-200GR."
--
-- History:
--   25.08 v5.3 (8ab98b4, migration 0012): supplier_sku filled with Pago's own codes recovered from the
--         legacy "Ordering PB v5 prod" sheet (PAGO NrKat column): GYRSW15KG, GYRSW25KG, SUVKUR5kg,
--         SUVSW5kg, PITTA018, BURG-200GR. Source: context/archive/2026-08-21-to-ordering-pago/
--         research-spreadsheet.md §1.3 and the "Pago SKU codes" paragraph.
--   02.09 training-feedback-0901 data pass overwrote them with the sheet's internal SKU_IDs
--         PAGO-001…PAGO-006 (Import PB scheme, not Pago's codes).
--   01.10 PR #47 removed the code column from the pickup PDF because it showed PAGO-00x.
-- This file restores the real codes on the 6 SUP_PAGO rows and the 12 city copies
-- (SUP_WARSZAWA_GDA/KAT/KRK: P024/P026/P027/P028; their non-pickup rows have NULL and stay NULL).
-- Mapping by product: P024 Gyros 15 KG GYRSW15KG · P025 Gyros 25 KG GYRSW25KG ·
--   P027 Souvlaki Kurczak SUVKUR5kg · P028 Souvlaki Wieprz SUVSW5kg · P026 Pita PITTA018 ·
--   P145 Bifteki burgers BURG-200GR (Ben confirmed 20.10).
-- Effect today: none visible (the PDF ignores supplier_sku until the "Kod" column ships).

-- STEP 0 (read 20.10): exactly 18 rows carry a supplier_sku, all PAGO-00x, all warehouse_pickup
SELECT supplier_product_id, product_id, supplier_sku, warehouse_pickup
  FROM supplier_products WHERE supplier_sku IS NOT NULL ORDER BY 1;

-- STEP 1
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE n int;
BEGIN
  -- Guard: the set of rows with a code, and their codes, are exactly what STEP 0 saw.
  IF (SELECT string_agg(supplier_product_id || '=' || supplier_sku, ',' ORDER BY supplier_product_id)
        FROM supplier_products WHERE supplier_sku IS NOT NULL)
     IS DISTINCT FROM
     'SP_PAGO_P024=PAGO-001,SP_PAGO_P025=PAGO-002,SP_PAGO_P026=PAGO-005,SP_PAGO_P027=PAGO-003,'
     'SP_PAGO_P028=PAGO-004,SP_PAGO_P145=PAGO-006,'
     'SP_WARSZAWA_GDA_P024=PAGO-001,SP_WARSZAWA_GDA_P026=PAGO-005,SP_WARSZAWA_GDA_P027=PAGO-003,'
     'SP_WARSZAWA_GDA_P028=PAGO-004,'
     'SP_WARSZAWA_KAT_P024=PAGO-001,SP_WARSZAWA_KAT_P026=PAGO-005,SP_WARSZAWA_KAT_P027=PAGO-003,'
     'SP_WARSZAWA_KAT_P028=PAGO-004,'
     'SP_WARSZAWA_KRK_P024=PAGO-001,SP_WARSZAWA_KRK_P026=PAGO-005,SP_WARSZAWA_KRK_P027=PAGO-003,'
     'SP_WARSZAWA_KRK_P028=PAGO-004'
  THEN
    RAISE EXCEPTION 'supplier_sku state changed since 2026-10-20 STEP 0 — re-diff';
  END IF;

  UPDATE supplier_products sp
     SET supplier_sku = v.code
    FROM (VALUES
      ('PAGO-001', 'GYRSW15KG'),
      ('PAGO-002', 'GYRSW25KG'),
      ('PAGO-003', 'SUVKUR5kg'),
      ('PAGO-004', 'SUVSW5kg'),
      ('PAGO-005', 'PITTA018'),
      ('PAGO-006', 'BURG-200GR')
    ) AS v(placeholder, code)
   WHERE sp.supplier_sku = v.placeholder
     AND sp.supplier_id IN ('SUP_PAGO', 'SUP_WARSZAWA_GDA', 'SUP_WARSZAWA_KAT', 'SUP_WARSZAWA_KRK');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 18 THEN RAISE EXCEPTION 'pago codes: expected 18 rows, got %', n; END IF;
END $$;
COMMIT;

-- AUDIT: expect 18 rows, no PAGO-00x left; codes per product identical across the 4 suppliers
SELECT product_id, supplier_sku, count(*) AS n, string_agg(supplier_id, ',' ORDER BY supplier_id) AS suppliers
  FROM supplier_products WHERE supplier_sku IS NOT NULL GROUP BY 1, 2 ORDER BY 1;
-- expect: P024 GYRSW15KG 4 · P025 GYRSW25KG 1 · P026 PITTA018 4 · P027 SUVKUR5kg 4 ·
--         P028 SUVSW5kg 4 · P145 BURG-200GR 1
SELECT count(*) FROM supplier_products WHERE supplier_sku LIKE 'PAGO-%';  -- expect 0

-- ROLLBACK (commented out) — restores the 02.09 placeholders
-- BEGIN;
-- DO $$
-- DECLARE n int;
-- BEGIN
--   UPDATE supplier_products sp
--      SET supplier_sku = v.placeholder
--     FROM (VALUES
--       ('PAGO-001', 'GYRSW15KG'), ('PAGO-002', 'GYRSW25KG'), ('PAGO-003', 'SUVKUR5kg'),
--       ('PAGO-004', 'SUVSW5kg'), ('PAGO-005', 'PITTA018'), ('PAGO-006', 'BURG-200GR')
--     ) AS v(placeholder, code)
--    WHERE sp.supplier_sku = v.code
--      AND sp.supplier_id IN ('SUP_PAGO', 'SUP_WARSZAWA_GDA', 'SUP_WARSZAWA_KAT', 'SUP_WARSZAWA_KRK');
--   GET DIAGNOSTICS n = ROW_COUNT;
--   IF n <> 18 THEN RAISE EXCEPTION 'rollback: expected 18 rows, got %', n; END IF;
-- END $$;
-- COMMIT;
