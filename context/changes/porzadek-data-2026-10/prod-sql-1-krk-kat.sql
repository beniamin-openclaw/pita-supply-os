-- porzadek-data-2026-10 — prod SQL 1: Kraków / Katowice contacts, minimums, Bukat calendar (D7)
-- Prepared 2026-10-17. Run in the Supabase SQL editor (project lpzhphufjwrndfogkfub):
-- first STEP 0 alone (read-only), compare with "Before", then STEP 1 + AUDIT.
-- The agent could not read prod on 17.10 (classifier blocked both reads and writes), so every id
-- below comes from context/changes/krakow-katowice-rollout/prod-sql-B-suppliers-catalog.sql (08.10)
-- and rollout-notes.md. The DO block re-checks each row and aborts on any mismatch.
--
-- Source: Marek, reply of 15.10 in "Kraków i Katowice – czego jeszcze potrzebuję"
-- (summary: context/changes/porzadek-2026-10/inputs/mail-2026-10-16.md, item 6):
--   Dis-Pack        order the day before; minimum 700 zł; agata.filipowicz@dis-pack.pl
--   Kuchnie Świata  the Kraków branch also serves Katowice; krakow@kuchnieswiata.com.pl
--   Selgros         HoReCa.Krakow@selgros.pl and horeca.bytom@selgros.pl
--   Bukat Kraków    delivers Mon/Wed/Fri; order by mail by 16:00 the day before (ideally 2 days
--                   ahead); minimum 500 zł; "nie możemy zamawiać 150kg Tzazyków na raz"; biuro@bukat.com
--   Supersam        supersampitabros@gmail.com
--   White onion KRK by kg, about 1 kg per 2 weeks
--
-- Before (expected, from the 08.10 rollout — STEP 0 must show exactly this):
--   SUP_BUKAT_KRK / SUP_DISPACK_KRK / SUP_DISPACK_KAT / SUP_KUCHNIE_KRK / SUP_KUCHNIE_KAT /
--   SUP_SELGROS_KRK / SUP_SELGROS_KAT: active, ordering_method 'manual', email NULL,
--   delivery_days NULL, cutoff_time NULL, minimum_order_value_pln NULL.
--   No supplier_delivery_rules row for any of them -> calendar fallback "tomorrow, 17:00"
--   (this is the 17:00 the Kraków captain reported on 11.10; Bukat's real cutoff is 16:00).
--   SUPERSAM.email NULL. FORUM__P018 (Cebula Biała) 0,5/2/2;
--   SP_BUKAT_KRK_P018 case 'worek' x 5 (so with target 2 kg the case suggestion is always 0).
--
-- What changes:
--   1. SUP_BUKAT_KRK  email biuro@bukat.com, minimum 500, cutoff 16:00, ordering_method 'email';
--      delivery rule DR-BUKAT-KRK-ALL: order any day, lead 1, deliveries Mon/Wed/Fri, deadline 16:00.
--   2. SUP_DISPACK_KRK + SUP_DISPACK_KAT  email agata.filipowicz@dis-pack.pl, minimum 700,
--      ordering_method 'email'. No delivery rule: "the day before" is already what the fallback does
--      (tomorrow, any weekday); the hour and the delivery days are unknown -> needs Marek.
--      ASSUMPTION: Marek's Dis-Pack answer is not split by city and Dis-Pack serves both cities from
--      Morawica, so it is applied to both. If Marek says Katowice differs, run R-2 for KAT only.
--   3. SUP_KUCHNIE_KRK + SUP_KUCHNIE_KAT  email krakow@kuchnieswiata.com.pl; note "oddział Kraków
--      obsługuje też Katowice". Stays 'manual' (no minimum yet, D7: email only with address + minimum).
--   4. SUP_SELGROS_KRK email HoReCa.Krakow@selgros.pl; SUP_SELGROS_KAT email horeca.bytom@selgros.pl
--      (Bytom hall serves Katowice — supplier name unchanged). Both stay 'manual' (no minimum).
--   5. SUPERSAM.email (DW of the supplier e-mail) = supersampitabros@gmail.com.
--   6. FORUM white onion: SP_BUKAT_KRK_P018 drops the 5 kg sack (ordered by kg, Marek);
--      FORUM__P018 0,5/2/2 -> 0,5/1/1 (1 kg covers 2 weeks; min 0,5 kept — confirm with Marek).
--
-- Order e-mails: 'email' suppliers get the Gmail draft flow at dispatch. Nothing is sent by this
-- file; the manager still sends each draft by hand.
--
-- Rollback: R-1 .. R-6 at the end of this file (commented out; each restores the "Before" values).

-- ============================================================
-- STEP 0 — before (read-only). Expect the values in the header.
-- ============================================================
SELECT supplier_id, active, ordering_method, email, delivery_days, cutoff_time,
       minimum_order_value_pln
  FROM suppliers
 WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK',
                       'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')
 ORDER BY 1;
-- expect 0 rows
SELECT rule_id, supplier_id, location_id, order_weekdays, lead_days, delivery_weekdays, order_deadline
  FROM supplier_delivery_rules
 WHERE supplier_id LIKE '%\_KRK' OR supplier_id LIKE '%\_KAT';
-- expect SUPERSAM email NULL, FORUM pitabrosforum@gmail.com
SELECT location_id, email, sender_email FROM locations WHERE location_id IN ('FORUM', 'SUPERSAM') ORDER BY 1;
-- expect FORUM__P018 0.5/2/2 and SP_BUKAT_KRK_P018 worek/5
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base, notes
  FROM location_product_settings WHERE location_id = 'FORUM' AND product_id = 'P018';
SELECT supplier_product_id, supplier_id, purchase_unit, case_unit, units_per_case, is_backup, active
  FROM supplier_products WHERE location_id = 'FORUM' AND product_id = 'P018' ORDER BY 1;
-- open orders that would switch channel (informational; 'email' only matters at dispatch)
SELECT supplier_id, status, count(*) FROM orders
 WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT')
   AND status IN ('draft', 'captain_submitted', 'manager_claimed')
 GROUP BY 1, 2 ORDER BY 1, 2;

-- ============================================================
-- STEP 1 — apply (one transaction; any mismatch aborts everything)
-- ============================================================
BEGIN;

DO $$
DECLARE n int;
BEGIN
  -- Guard: the 7 city suppliers are still exactly as the 08.10 rollout left them.
  SELECT count(*) INTO n FROM suppliers
   WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK',
                         'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')
     AND active AND ordering_method = 'manual' AND email IS NULL
     AND cutoff_time IS NULL AND minimum_order_value_pln IS NULL;
  IF n <> 7 THEN
    RAISE EXCEPTION 'city suppliers: expected 7 untouched (manual, no email/cutoff/minimum), got % — re-diff', n;
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_delivery_rules WHERE supplier_id = 'SUP_BUKAT_KRK') THEN
    RAISE EXCEPTION 'SUP_BUKAT_KRK already has a delivery rule — re-diff';
  END IF;

  -- 1. Bukat Kraków
  UPDATE suppliers
     SET email = 'biuro@bukat.com',
         minimum_order_value_pln = 500,
         cutoff_time = '16:00',
         ordering_method = 'email',
         notes = notes || '; 2026-10-17 (Marek 15.10): dostawy pn/śr/pt, zamówienie mailem do 16:00 dzień'
                       || ' wcześniej (najlepiej 2 dni), minimum 500 zł, nie zamawiać 150 kg tzatziki naraz'
   WHERE supplier_id = 'SUP_BUKAT_KRK';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'bukat_krk: expected 1, got %', n; END IF;

  INSERT INTO supplier_delivery_rules
      (rule_id, supplier_id, location_id, order_weekdays, lead_days, delivery_weekdays,
       order_deadline, active, notes)
  VALUES ('DR-BUKAT-KRK-ALL', 'SUP_BUKAT_KRK', NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1, 'Mon,Wed,Fri',
          '16:00', true, 'Marek 15.10: dostawy pn/śr/pt, zamówienie do 16:00 dzień wcześniej (2026-10-17)');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'bukat_krk rule: expected 1, got %', n; END IF;

  -- 2. Dis-Pack (both cities — see ASSUMPTION in the header)
  UPDATE suppliers
     SET email = 'agata.filipowicz@dis-pack.pl',
         minimum_order_value_pln = 700,
         ordering_method = 'email',
         notes = notes || '; 2026-10-17 (Marek 15.10): zamówienie dzień wcześniej, minimum 700 zł,'
                       || ' kontakt agata.filipowicz@dis-pack.pl; godzina i dni dostaw do potw.'
   WHERE supplier_id IN ('SUP_DISPACK_KRK', 'SUP_DISPACK_KAT');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'dispack: expected 2, got %', n; END IF;

  -- 3. Kuchnie Świata: the Kraków branch serves both cities (stays manual: no minimum)
  UPDATE suppliers
     SET email = 'krakow@kuchnieswiata.com.pl',
         notes = notes || '; 2026-10-17 (Marek 15.10): oddział Kraków obsługuje też Katowice,'
                       || ' krakow@kuchnieswiata.com.pl; minimum, dni i godzina do potw. (zostaje manual)'
   WHERE supplier_id IN ('SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'kuchnie: expected 2, got %', n; END IF;

  -- 4. Selgros: Kraków hall and Bytom hall (Katowice). Stays manual: no minimum
  UPDATE suppliers
     SET email = 'HoReCa.Krakow@selgros.pl',
         notes = notes || '; 2026-10-17 (Marek 15.10): HoReCa.Krakow@selgros.pl; minimum i dni do potw. (zostaje manual)'
   WHERE supplier_id = 'SUP_SELGROS_KRK';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'selgros_krk: expected 1, got %', n; END IF;

  UPDATE suppliers
     SET email = 'horeca.bytom@selgros.pl',
         notes = notes || '; 2026-10-17 (Marek 15.10): Katowice zamawia z hali Bytom, horeca.bytom@selgros.pl;'
                       || ' minimum i dni do potw. (zostaje manual)'
   WHERE supplier_id = 'SUP_SELGROS_KAT';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'selgros_kat: expected 1, got %', n; END IF;

  -- 5. Supersam location e-mail (DW on supplier e-mails)
  UPDATE locations
     SET email = 'supersampitabros@gmail.com',
         notes = notes || '; 2026-10-17 e-mail lokalu od Marka (15.10)'
   WHERE location_id = 'SUPERSAM' AND email IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'supersam email: expected 1 (email NULL), got %', n; END IF;

  -- 6. FORUM white onion: by kg, about 1 kg per 2 weeks
  UPDATE supplier_products
     SET case_unit = NULL, units_per_case = NULL,
         notes = notes || '; 2026-10-17 bez worka 5 kg — Kraków zamawia na kg (Marek 15.10)'
   WHERE supplier_product_id = 'SP_BUKAT_KRK_P018' AND location_id = 'FORUM'
     AND case_unit = 'worek' AND units_per_case = 5;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'SP_BUKAT_KRK_P018: expected 1 (worek x5), got %', n; END IF;

  UPDATE location_product_settings
     SET target_stock_qty_base = 1, max_stock_qty_base = 1,
         notes = notes || ' [2026-10-17 przed 0,5/2/2; Marek 15.10: ok. 1 kg na 2 tygodnie]'
   WHERE location_id = 'FORUM' AND product_id = 'P018'
     AND min_stock_qty_base = 0.5 AND target_stock_qty_base = 2 AND max_stock_qty_base = 2;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FORUM P018 thresholds: expected 1 (0.5/2/2), got %', n; END IF;
END $$;

COMMIT;

-- ============================================================
-- AUDIT — expected results
-- ============================================================
-- (a) BUKAT_KRK email/500/16:00; DISPACK_KRK+KAT email/700; the other four manual with an e-mail, minimum NULL
SELECT supplier_id, ordering_method, email, cutoff_time, minimum_order_value_pln
  FROM suppliers
 WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK',
                       'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')
 ORDER BY 1;
-- (b) one rule: DR-BUKAT-KRK-ALL, all weekdays / 1 / Mon,Wed,Fri / 16:00
SELECT rule_id, supplier_id, order_weekdays, lead_days, delivery_weekdays, order_deadline, active
  FROM supplier_delivery_rules WHERE supplier_id LIKE '%\_KRK' OR supplier_id LIKE '%\_KAT';
-- (c) 'email' supplier without an e-mail address anywhere in the table -> 0 rows
SELECT supplier_id FROM suppliers WHERE active AND ordering_method = 'email' AND coalesce(btrim(email), '') = '';
-- (d) SUPERSAM email = supersampitabros@gmail.com
SELECT location_id, email FROM locations WHERE location_id = 'SUPERSAM';
-- (e) FORUM P018: 0.5/1/1; SP_BUKAT_KRK_P018 case NULL/NULL
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base
  FROM location_product_settings WHERE location_id = 'FORUM' AND product_id = 'P018';
SELECT supplier_product_id, case_unit, units_per_case FROM supplier_products
 WHERE supplier_product_id = 'SP_BUKAT_KRK_P018';
-- After deploy-free check in the app (GET only): the FORUM Bukat tab shows the 16:00 deadline and a
-- Mon/Wed/Fri delivery date; Dis-Pack/Bukat orders show the e-mail draft button in the manager view.

-- ============================================================
-- ROLLBACK (commented out). Each section restores the "Before" values; the notes suffix stays
-- (harmless audit trail) unless you also strip it.
-- ============================================================
-- BEGIN;
-- -- R-1 Bukat Kraków
-- DELETE FROM supplier_delivery_rules WHERE rule_id = 'DR-BUKAT-KRK-ALL';
-- UPDATE suppliers SET email = NULL, minimum_order_value_pln = NULL, cutoff_time = NULL, ordering_method = 'manual'
--  WHERE supplier_id = 'SUP_BUKAT_KRK';
-- -- R-2 Dis-Pack (for Katowice only: WHERE supplier_id = 'SUP_DISPACK_KAT')
-- UPDATE suppliers SET email = NULL, minimum_order_value_pln = NULL, ordering_method = 'manual'
--  WHERE supplier_id IN ('SUP_DISPACK_KRK', 'SUP_DISPACK_KAT');
-- -- R-3 / R-4 Kuchnie Świata, Selgros
-- UPDATE suppliers SET email = NULL
--  WHERE supplier_id IN ('SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT');
-- -- R-5 Supersam
-- UPDATE locations SET email = NULL WHERE location_id = 'SUPERSAM';
-- -- R-6 FORUM onion
-- UPDATE supplier_products SET case_unit = 'worek', units_per_case = 5 WHERE supplier_product_id = 'SP_BUKAT_KRK_P018';
-- UPDATE location_product_settings SET target_stock_qty_base = 2, max_stock_qty_base = 2
--  WHERE location_id = 'FORUM' AND product_id = 'P018';
-- COMMIT;
