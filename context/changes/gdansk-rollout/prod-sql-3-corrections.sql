-- gdansk-rollout — prod SQL step 3: Marek's corrections of 16.10 + cleanup (prepared 2026-10-17)
-- Run in the Supabase SQL editor (project lpzhphufjwrndfogkfub), whole file at once.
-- The agent's own call was blocked by the auto-mode classifier (Production Deploy).
--
-- Before (read 2026-10-17):
--   SUP_KUCHNIE_GDA / SUP_SELGROS_GDA / SUP_BLUESERV_GDA / SUP_COCACOLA_GDA / SUP_WARSZAWA_GDA: cutoff_time NULL
--   SLONY P011/P012/P014 at SUP_WARSZAWA_GDA: "Tzatzyki pojemnik 3 kg (Bukat)", "Tirokafteri pojemnik 2 kg (Bukat)",
--   "Feta blok 2 kg (Bukat)"; function gdansk_rollout_step1(boolean) still present.
-- Rollback: rename "(Magazyn)" back to "(Bukat)" for the same 3 rows; cutoff_time = NULL for the 3 suppliers.
-- The function is reproducible from prod-sql-1-location-catalog.sql.
--
-- NOT here: the 12-leftover DELETE (prod-sql-2). The 16.10 count INV-20261016-SLO-da3c42 shows stock on 7 of them
-- (Coca-Cola 0,33 puszka 119, Cola Zero 102, Cappy jabłko 16, Cappy pomarańcza 19, rolki 57/30 24, Top Glass 8,
-- papryka Florina 3), so SLONY does carry them — decision pending (porzadek-2026-10, D15).

BEGIN;

DO $$
DECLARE n int;
BEGIN
  UPDATE supplier_products
     SET supplier_product_name = replace(supplier_product_name, '(Bukat)', '(Magazyn)'),
         notes = notes || '; 2026-10-17 etykieta (Bukat)->(Magazyn) wg korekty Marka 16.10'
   WHERE location_id = 'SLONY' AND supplier_id = 'SUP_WARSZAWA_GDA'
     AND product_id IN ('P011', 'P012', 'P014') AND supplier_product_name LIKE '%(Bukat)';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'labels: expected 3, got %', n; END IF;

  -- Order the day before by 17:00. The delivery calendar already falls back to 17:00 without a rule;
  -- this records it on the supplier row. Coca-Cola and Pago + Magazyn + Lemoniady stay untouched.
  UPDATE suppliers
     SET cutoff_time = '17:00',
         notes = coalesce(notes || '; ', '') || '2026-10-17 zamówienie dzień wcześniej do 17:00 (Marek 16.10)'
   WHERE supplier_id IN ('SUP_KUCHNIE_GDA', 'SUP_SELGROS_GDA', 'SUP_BLUESERV_GDA') AND cutoff_time IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'cutoff: expected 3, got %', n; END IF;
END $$;

DROP FUNCTION IF EXISTS gdansk_rollout_step1(boolean);

COMMIT;

-- Audit: expect 3 x "(Magazyn)", 17:00 for KUCHNIE/SELGROS/BLUESERV, NULL for COCACOLA/WARSZAWA, fn = 0
SELECT supplier_id, cutoff_time FROM suppliers WHERE supplier_id LIKE '%\_GDA' ORDER BY 1;
SELECT product_id, supplier_product_name FROM supplier_products
 WHERE location_id = 'SLONY' AND product_id IN ('P011', 'P012', 'P014') ORDER BY 1;
SELECT count(*) AS fn FROM pg_proc WHERE proname = 'gdansk_rollout_step1';
