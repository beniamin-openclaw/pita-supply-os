-- ============================================================
-- krakow-katowice-rollout — ROLLBACK (run only on operator instruction)
-- Two parts, run SEPARATELY, in this order:
--   PART 1  R-0 KILL SWITCH — run ALONE and FIRST, BEFORE any Railway / Vercel rollback.
--           Deactivates the 7 city suppliers, the 2 step-B2 suppliers (SUP_COCACOLA_KAT,
--           SUP_WARSZAWA_KAT — when B2 was applied) and every scoped supplier_products row
--           (181 after B, 205 after B2).
--           (To switch off ONLY step B2 and keep Kraków / Katowice running, use
--            rollback-B2-off.sql instead — no code rollback needed for that.)
--           Why: the old backend ignores supplier_products.location_id and lists every active
--           supplier as a tab, so after a code rollback Bukat Kraków & co. would show at all
--           Warsaw locations; and the old _primary_supplier_product picks the lowest
--           supplier_product_id among ACTIVE rows (main:supply-os-v1/app/main.py:2761-2790),
--           so SP_BUKAT_KRK_Pxxx (sorts before SP_BUKAT_Pxxx) would take over Warsaw pack hints
--           and stock value. Deactivated rows are invisible to both old and new code.
--   (then)  code rollback on Railway / Vercel, if needed.
--   PART 2  optional full data rollback: R-B2 (delete B2) -> R-B (delete B) -> R-C (re-insert C)
--           -> R-A (undo A),
--           one transaction, opt-in: uncomment the SET LOCAL line under its BEGIN.
--           Each section checks whether its step was applied and skips itself (NOTICE) when it
--           was not, so PART 2 works after A only, after A+C, or after A+C+B (with or without
--           PART 1). R-B fails on purpose when an order / receipt already references a city
--           supplier or a scoped row (FK) — then stay on PART 1 (deactivated) and keep history.
--   (last)  0029 drop, only if wanted — its rollback note is in the 0029 header.
-- R-A restores every threshold row changed on 2026-10-08 from the "przed a/b/c" value in its
--   notes (archive pattern), deletes the rows A inserted and puts FORUM / SUPERSAM back to their
--   literal pre-rollout state (read 2026-10-08), own_catalog = false.
-- ============================================================

-- ############################################################
-- PART 1 — R-0 KILL SWITCH (run alone, first)
-- ############################################################

-- R-0 STEP 0 (read-only) -> city_suppliers 7, b2_suppliers 0 or 2, scoped_rows 181 (no B2) or
--   205 (with B2), scoped_other_suppliers 0
--   (scoped_rows differs only if a city catalog was edited after 2026-10-09 — then put the
--    new number into the guard below before running)
SELECT (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')) AS city_suppliers,
       (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT') AND active) AS city_suppliers_active,
       (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT')) AS b2_suppliers,
       (SELECT count(*) FROM supplier_products WHERE location_id IS NOT NULL) AS scoped_rows,
       (SELECT count(*) FROM supplier_products WHERE location_id IS NOT NULL AND active) AS scoped_rows_active,
       (SELECT count(*) FROM supplier_products
         WHERE location_id IS NOT NULL AND supplier_id NOT IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT', 'SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT')) AS scoped_other_suppliers;

BEGIN;
DO $$
DECLARE
  n int;
  b2 int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT'))
     AND NOT EXISTS (SELECT 1 FROM supplier_products WHERE location_id IS NOT NULL) THEN
    RAISE NOTICE 'R-0: step B not applied — nothing to switch off';
    RETURN;
  END IF;
  SELECT count(*) INTO b2 FROM suppliers WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT');
  IF b2 NOT IN (0, 2) THEN
    RAISE EXCEPTION 'R-0: % of the 2 step-B2 suppliers exist — partial state, check by hand', b2;
  END IF;
  -- The old backend lists every active supplier as a tab everywhere, so the B2 pair must go
  -- dark too (and SP_COCACOLA_KAT_Pxxx sorts before SP_COCACOLA_Pxxx in the old primary pick).
  UPDATE suppliers SET active = false WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT', 'SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 7 + b2 THEN RAISE EXCEPTION 'R-0: matched % city / B2 suppliers, expected %', n, 7 + b2; END IF;
  UPDATE supplier_products SET active = false WHERE location_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 181 + 12 * b2 THEN
    RAISE EXCEPTION 'R-0: matched % scoped rows, expected % (a city catalog edited since 2026-10-09? check STEP 0, fix the number)', n, 181 + 12 * b2;
  END IF;
END $$;
COMMIT;

-- R-0 audit -> 0 / 0
SELECT (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT', 'SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT') AND active) AS city_and_b2_suppliers_active,
       (SELECT count(*) FROM supplier_products WHERE location_id IS NOT NULL AND active) AS scoped_rows_active;

-- ############################################################
-- PART 2 — full data rollback (optional; run separately, after PART 1 / the code rollback)
-- ############################################################
BEGIN;
-- Opt-in: uncomment the next line to run PART 2. Without it the first block raises and nothing
-- in PART 2 is written (guards against running the whole file by accident).
-- SET LOCAL rollout.krk_kat_data_rollback = 'yes';
DO $$
BEGIN
  IF coalesce(current_setting('rollout.krk_kat_data_rollback', true), '') <> 'yes' THEN
    RAISE EXCEPTION 'PART 2 not confirmed: uncomment the SET LOCAL line under BEGIN';
  END IF;
END $$;

-- R-B2: Katowice Coca-Cola + Warsaw goods (step B2, 2026-10-09) — must go before R-B
DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT'))
     AND NOT EXISTS (SELECT 1 FROM supplier_products WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT')) THEN
    RAISE NOTICE 'R-B2: step B2 not applied, skipping';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT'))
     OR EXISTS (SELECT 1 FROM receipts WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT'))
     OR EXISTS (SELECT 1 FROM order_lines ol JOIN supplier_products sp USING (supplier_product_id)
                 WHERE sp.supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT'))
     OR EXISTS (SELECT 1 FROM receipt_lines rl JOIN supplier_products sp USING (supplier_product_id)
                 WHERE sp.supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT')) THEN
    RAISE EXCEPTION 'R-B2: orders / receipts reference the B2 suppliers — keep PART 1 (deactivated) instead';
  END IF;
  IF EXISTS (SELECT 1 FROM transport_batches WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT'))
     OR EXISTS (SELECT 1 FROM supplier_delivery_rules WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT')) THEN
    RAISE EXCEPTION 'R-B2: transport batches / delivery rules reference the B2 suppliers — remove them by hand first or keep PART 1';
  END IF;
  UPDATE location_product_settings
     SET notes = btrim(regexp_replace(notes, ' ?\[2026-10-09 B2: [^]]*\]', '', 'g'))
   WHERE location_id = 'SUPERSAM' AND notes LIKE '%[2026-10-09 B2: %';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 24 THEN RAISE EXCEPTION 'R-B2: stripped the B2 marker from % settings rows, expected 24', n; END IF;
  DELETE FROM supplier_products
   WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT') AND location_id = 'SUPERSAM';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 24 THEN RAISE EXCEPTION 'R-B2: deleted % catalog rows, expected 24', n; END IF;
  IF EXISTS (SELECT 1 FROM supplier_products WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT')) THEN
    RAISE EXCEPTION 'R-B2: other rows reference the B2 suppliers — check by hand';
  END IF;
  DELETE FROM suppliers WHERE supplier_id IN ('SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'R-B2: deleted % suppliers, expected 2', n; END IF;
END $$;

-- R-B: city suppliers + scoped catalog
DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')) THEN
    RAISE NOTICE 'R-B: step B not applied, skipping';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT'))
     OR EXISTS (SELECT 1 FROM receipts WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT'))
     OR EXISTS (SELECT 1 FROM order_lines ol JOIN supplier_products sp USING (supplier_product_id)
                 WHERE sp.location_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM receipt_lines rl JOIN supplier_products sp USING (supplier_product_id)
                 WHERE sp.location_id IS NOT NULL) THEN
    RAISE EXCEPTION 'R-B: orders / receipts reference the city catalog — keep PART 1 (deactivated) instead';
  END IF;
  IF EXISTS (SELECT 1 FROM transport_batches WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT'))
     OR EXISTS (SELECT 1 FROM supplier_delivery_rules WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')) THEN
    RAISE EXCEPTION 'R-B: transport batches / delivery rules reference the city suppliers — remove them by hand first or keep PART 1';
  END IF;
  DELETE FROM supplier_products
   WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT') AND location_id IN ('FORUM','SUPERSAM');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 181 THEN RAISE EXCEPTION 'R-B: deleted % scoped rows, expected 181', n; END IF;
  IF EXISTS (SELECT 1 FROM supplier_products WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')) THEN
    RAISE EXCEPTION 'R-B: other rows reference the city suppliers — check by hand';
  END IF;
  DELETE FROM suppliers WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 7 THEN RAISE EXCEPTION 'R-B: deleted % suppliers, expected 7', n; END IF;
END $$;

-- R-C: re-insert the 26 template rows deleted in step C (literal backup, read 2026-10-08)
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM location_product_settings
   WHERE setting_id IN ('FORUM__P017', 'FORUM__P037', 'FORUM__P039', 'FORUM__P056', 'FORUM__P099', 'FORUM__P103', 'FORUM__P109', 'FORUM__P111', 'FORUM__P112', 'FORUM__P113', 'FORUM__P114', 'FORUM__P125', 'FORUM__P128', 'FORUM__P170', 'SUPERSAM__P017', 'SUPERSAM__P037', 'SUPERSAM__P039', 'SUPERSAM__P056', 'SUPERSAM__P099', 'SUPERSAM__P103', 'SUPERSAM__P109', 'SUPERSAM__P111', 'SUPERSAM__P112', 'SUPERSAM__P113', 'SUPERSAM__P114', 'SUPERSAM__P130');
  IF n = 26 THEN
    RAISE NOTICE 'R-C: step C not applied (all 26 rows present), skipping';
    RETURN;
  ELSIF n <> 0 THEN
    RAISE EXCEPTION 'R-C: % of the 26 backup rows exist — partial state, check by hand', n;
  END IF;
  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes,
     inventory_order)
  VALUES
  ('FORUM__P017','FORUM','P017',0.5,1.5,1.5,false,false,'',NULL),
  ('FORUM__P037','FORUM','P037',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P039','FORUM','P039',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P056','FORUM','P056',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P099','FORUM','P099',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P103','FORUM','P103',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P109','FORUM','P109',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P111','FORUM','P111',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P112','FORUM','P112',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P113','FORUM','P113',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P114','FORUM','P114',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P125','FORUM','P125',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P128','FORUM','P128',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P170','FORUM','P170',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P017','SUPERSAM','P017',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P037','SUPERSAM','P037',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P039','SUPERSAM','P039',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P056','SUPERSAM','P056',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P099','SUPERSAM','P099',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P103','SUPERSAM','P103',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P109','SUPERSAM','P109',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P111','SUPERSAM','P111',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P112','SUPERSAM','P112',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P113','SUPERSAM','P113',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P114','SUPERSAM','P114',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P130','SUPERSAM','P130',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 26 THEN RAISE EXCEPTION 'R-C: inserted % rows, expected 26', n; END IF;
END $$;

-- R-A: thresholds + locations
DO $$
DECLARE n int;
BEGIN
  IF EXISTS (SELECT 1 FROM supplier_products WHERE location_id IN ('FORUM','SUPERSAM')) THEN
    RAISE EXCEPTION 'R-A: scoped rows still exist — R-B must run first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM locations WHERE location_id IN ('FORUM','SUPERSAM') AND own_catalog)
     AND NOT EXISTS (SELECT 1 FROM location_product_settings
                      WHERE location_id IN ('FORUM','SUPERSAM') AND notes LIKE '%2026-10-08 arkusz KRK/KAT%') THEN
    RAISE NOTICE 'R-A: step A not applied, skipping';
    RETURN;
  END IF;

  UPDATE location_product_settings s SET
    min_stock_qty_base    = x.m[1]::numeric,
    target_stock_qty_base = x.m[2]::numeric,
    max_stock_qty_base    = x.m[3]::numeric,
    notes = btrim(regexp_replace(s.notes, ' ?\[2026-10-08 arkusz KRK/KAT, przed [^]]*\]', ''))
  FROM (
    SELECT setting_id,
           regexp_match(notes, '\[2026-10-08 arkusz KRK/KAT, przed ([0-9.eE+-]+)/([0-9.eE+-]+)/([0-9.eE+-]+)') AS m
      FROM location_product_settings
     WHERE location_id IN ('FORUM','SUPERSAM') AND notes LIKE '%[2026-10-08 arkusz KRK/KAT, przed %'
  ) x
  WHERE s.setting_id = x.setting_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  -- expected: 94 rows (FORUM 35, SUPERSAM 59)
  IF n <> 94 THEN RAISE EXCEPTION 'R-A: restored % rows, expected 94', n; END IF;

  DELETE FROM location_product_settings
   WHERE location_id IN ('FORUM','SUPERSAM') AND notes LIKE '2026-10-08 arkusz KRK/KAT (nowy wiersz)%';
  GET DIAGNOSTICS n = ROW_COUNT;
  -- expected: 7 rows (FORUM 4, SUPERSAM 3)
  IF n <> 7 THEN RAISE EXCEPTION 'R-A: deleted % new rows, expected 7', n; END IF;

  UPDATE locations SET
    delivery_address = NULL, city = 'Kraków', company_name = NULL, company_address = NULL,
    company_nip = NULL, phone = NULL, own_catalog = false, active = false,
    notes = 'added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator'
  WHERE location_id = 'FORUM';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'R-A: FORUM restore touched % rows', n; END IF;

  UPDATE locations SET
    delivery_address = NULL, city = 'Katowice', company_name = NULL, company_address = NULL,
    company_nip = NULL, phone = NULL, own_catalog = false, active = false,
    notes = 'added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator'
  WHERE location_id = 'SUPERSAM';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'R-A: SUPERSAM restore touched % rows', n; END IF;

  IF (SELECT count(*) FROM location_product_settings WHERE location_id = 'FORUM') <> 114
     OR (SELECT count(*) FROM location_product_settings WHERE location_id = 'SUPERSAM') <> 116 THEN
    RAISE EXCEPTION 'R-A: FORUM/SUPERSAM should be back at 114/116 rows (was R-C run?)';
  END IF;
END $$;

COMMIT;

-- Audit after rollback -> FORUM 114 / SUPERSAM 116 rows, 0 stamped rows, both locations
-- inactive with own_catalog false, 0 city / B2 suppliers, 0 scoped rows
SELECT location_id, count(*) AS settings,
       count(*) FILTER (WHERE notes LIKE '%2026-10-08 arkusz KRK/KAT%') AS stamped
  FROM location_product_settings WHERE location_id IN ('FORUM','SUPERSAM') GROUP BY 1 ORDER BY 1;
SELECT location_id, active, own_catalog, delivery_address, company_nip, phone
  FROM locations WHERE location_id IN ('FORUM','SUPERSAM') ORDER BY 1;
SELECT (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT', 'SUP_COCACOLA_KAT', 'SUP_WARSZAWA_KAT')) AS city_and_b2_suppliers,
       (SELECT count(*) FROM supplier_products WHERE location_id IS NOT NULL) AS scoped_rows;

