-- ============================================================
-- krakow-katowice-rollout — switch OFF step B2 only (run only on operator instruction)
-- Katowice stops ordering Coca-Cola and "Pago + Magazyn + Lemoniady"; Kraków, the Katowice city
-- suppliers (step B) and the code stay as they are — no Railway / Vercel rollback needed.
-- What: deactivates SUP_COCACOLA_KAT, SUP_WARSZAWA_KAT and their 24 SUPERSAM catalog rows.
--   Nothing is deleted, so orders / receipts already placed keep their history; the 24 products
--   go back to count-only at SUPERSAM (the captain tab disappears).
-- Back ON: the same two UPDATEs with active = true (see the end of the file).
-- Full removal (no orders yet): rollback.sql PART 2 section R-B2.
-- ============================================================

-- STEP 0 (read-only) -> b2_suppliers 2, b2_suppliers_active 2, b2_rows 24, b2_rows_active 24
SELECT (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT')) AS b2_suppliers,
       (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT') AND active) AS b2_suppliers_active,
       (SELECT count(*) FROM supplier_products WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT')) AS b2_rows,
       (SELECT count(*) FROM supplier_products WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT') AND active) AS b2_rows_active;

BEGIN;
DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT')) THEN
    RAISE NOTICE 'B2-off: step B2 not applied — nothing to switch off';
    RETURN;
  END IF;
  UPDATE suppliers SET active = false WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'B2-off: matched % suppliers, expected 2', n; END IF;
  UPDATE supplier_products SET active = false
   WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT') AND location_id = 'SUPERSAM';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 24 THEN RAISE EXCEPTION 'B2-off: matched % catalog rows, expected 24', n; END IF;
END $$;
COMMIT;

-- Audit -> 0 / 0, and SUPERSAM count-only back to 36
SELECT (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT') AND active) AS b2_suppliers_active,
       (SELECT count(*) FROM supplier_products WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT') AND active) AS b2_rows_active,
       (SELECT count(*) FROM location_product_settings s
         WHERE s.location_id = 'SUPERSAM'
           AND NOT EXISTS (SELECT 1 FROM supplier_products sp
                            WHERE sp.location_id = s.location_id AND sp.product_id = s.product_id AND sp.active)) AS supersam_count_only;

-- Back ON (only on operator instruction; run as one transaction):
-- BEGIN;
-- UPDATE suppliers SET active = true WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT');            -- 2 rows
-- UPDATE supplier_products SET active = true
--  WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT') AND location_id = 'SUPERSAM';                -- 24 rows
-- COMMIT;
