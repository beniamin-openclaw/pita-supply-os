-- porzadek-2026-10 — prod SQL: Marek's answers of 26.10, items A1–A7 of marek-answers-2026-10-26.md
-- Prepared 2026-10-28. Supabase project lpzhphufjwrndfogkfub.
-- Run STEP 0 (read-only) first, then STEP 1 + AUDIT.
--
-- Sources:
--   Marek, e-mail 26.10 ("Re: Supply OS – czego jeszcze potrzebujemy do domknięcia lokali"):
--     1.  "Norblin 10-12, Elektrownia 10-12, Browary 10-12, Westfield 9-10, Wolska od 11, Ken od 11,
--          Bracka od 11, Kraków 10:30, Katowice od 10, Gdańsk od 10"; 2b (Gdańsk) "10-12"   -> A1
--     2a. "Wejście od ul. Chmielnej"; 2c "pitabrosslony@gmail.com 692 105 365"              -> A2
--     3b. Coca-Cola Katowice "500netto"; 3d "Kuchnie 600netto, Selgros 750";
--         4a Pepsi "minimum to 450pln"; 4b Kraków "Kuchnie 600netto, Selgros 750"            -> A3
--     3d. "wszyscy wszedzie powinni składać do 17:00 (jedyny wyjatek to Bukat poza warszawą
--          ... do 16:00)"; 4b Kraków "pon-sob do 17:00"                                       -> A4
--     2d. Gdańsk "Kuchnie i Selgros poniedzialek-sobota"; 4b Kraków "pon-sob do 17:00"      -> A5
--     3c. "10szt w paczce kazdej rolki z wyjatkiem 80/80 te sa po 6"; 5b (57 mm Wola) "tak"  -> A6
--     4a. "puszki po 2,10pln woda po 1,30pln, sok toma 2,60pln"                              -> A7
--   Ben, chat 28.10: "Tak, przygotuj SQL A1–A7 ze strażnikami i review subagenta, potem pokaż mi
--     przed wgraniem."
--
-- What this file does (one transaction, all or nothing):
--   A1. locations.delivery_window_from/_to (migration 0031, on prod since 24.10):
--       NORBLIN, ELEKTROWNIA, BROWARY, SLONY 10:00–12:00; WOLA, KEN, BRACKA from 11:00; FORUM from 10:30;
--       SUPERSAM from 10:00. E-mail line: both set -> "w godzinach 10:00–12:00", from only ->
--       "od godziny 11:00". WESTFIELD (9:00–10:00) and the 3 inactive locations untouched.
--       Gdańsk: 2b "10-12" taken over 1 "od 10" (asked Marek to correct it in the 28.10 reply).
--   A2. SLONY: email pitabrosslony@gmail.com (NULL today); delivery_address gets
--       "(wejście od strony ul. Chmielnej)". Phone 692 105 365 already right. No visible effect today: all 5
--       SLONY suppliers are ordering_method manual and the e-mail is built only for 'email' (main.py:2861);
--       ready for when one moves to e-mail (CC + "ADRES DOSTAWY:" line).
--   A3. suppliers.minimum_order_value_pln: SUP_COCACOLA_KAT 500, SUP_KUCHNIE_KAT 600, SUP_SELGROS_KAT 750,
--       SUP_KUCHNIE_KRK 600, SUP_SELGROS_KRK 750 (NULL today), SUP_PEPSI_KRK 450 (0 today).
--       Netto, as every price in the catalogue.
--   A4. suppliers.cutoff_time 17:00 for the 8 Katowice / Kraków suppliers that have NULL:
--       SUP_COCACOLA_KAT, SUP_DISPACK_KAT, SUP_DISPACK_KRK, SUP_KUCHNIE_KAT, SUP_KUCHNIE_KRK, SUP_PEPSI_KRK,
--       SUP_SELGROS_KAT, SUP_SELGROS_KRK. The Captain strip shows "Zamów do 17:00" (a delivery rule, when
--       one exists, overrides it with its own deadline). Gdańsk already has 17:00, Bukat KRK keeps 16:00.
--       Not here: Warsaw suppliers with cutoff 'TBD' and the internal ones (SUP_MORY, SUP_WARSZAWA_*,
--       SUP_SPEC NULL, SUP_COCACOLA_GDA NULL) — their own rule or Ben's call.
--   A5. supplier_delivery_rules, 4 new shared rules (location_id NULL; each supplier serves one location):
--       DR-KUCHNIE-KRK-ALL, DR-SELGROS-KRK-ALL, DR-KUCHNIE-GDA-ALL, DR-SELGROS-GDA-ALL:
--       order any day, lead_days 1, delivery Mon–Sat, deadline 17:00. Same shape as DR-KUCHNIE-ALL (Warsaw).
--       lead_days 1 is an assumption (Marek gave days and the deadline, not the lead time).
--   A6. Rolls, pack of 10 (case_unit 'opak', units_per_case 10; purchase unit stays szt, thresholds untouched):
--       P183 80/20 in SP_MORY, SP_WARSZAWA_GDA, SP_WARSZAWA_KAT (x6 today);
--       P128 57/20, P130 57/30, P184 57/80 in SP_MORY (no pack today). P129 80/80 stays x6.
--       SP_WARSZAWA_KRK_P130 is already opak x10.
--       The engine rounds the need to the nearest whole case, half up (suggestion.py case_suggestion), so
--       BRACKA's small thresholds would round to 0 forever: BRACKA__P183 1/4/4 and BRACKA__P184 1/2/2 (need 4
--       or 2 of a x10 pack -> 0). A6 raises their target/max to one pack: 1/10/10 (review 28.10, blocker).
--       Every other P128/P130/P183/P184 threshold is already >= 20 at target and works with x10.
--       Captain card and stock count for P128/P130/P184 now show packs + loose rolls.
--   A7. SUP_PEPSI_KRK prices per zgrzewka from Marek's per-unit prices:
--       cans x24 at 2.10 = 50.40 (P155 7Up, P165 Mirinda, P166 Pepsi, P167 Pepsi Zero);
--       Krystaliczne Źródło PET x12 at 1.30 = 15.60 (P163, P164); Toma x12 at 2.60 = 31.20 (P193, P194).
--       Assumes netto and 12 Toma per zgrzewka (the row name says 1/12; asked Marek to confirm).
-- Untouched: Kropla Beskidu (C1, Ben's decision), the e-mail warning line (C2, code change), Dis-Pack (C3),
--   Mory office items (C4), A9 transport note, SUPERSAM P183 thresholds 12/30 (were set with x6 in mind).

-- ============================================================
-- STEP 0 — before (read-only; save the output, it is the rollback)
-- ============================================================
SELECT location_id, active, delivery_window_from, delivery_window_to, email, phone, delivery_address
  FROM locations ORDER BY location_id;
-- expect: all 13 windows NULL except WESTFIELD 9:00/10:00; SLONY email NULL,
--         address 'Słony Spichlerz, ul. Chmielna 10', phone '692 105 365'
SELECT supplier_id, active, minimum_order_value_pln, cutoff_time FROM suppliers
 WHERE supplier_id IN ('SUP_COCACOLA_KAT','SUP_DISPACK_KAT','SUP_DISPACK_KRK','SUP_KUCHNIE_KAT',
                       'SUP_KUCHNIE_KRK','SUP_PEPSI_KRK','SUP_SELGROS_KAT','SUP_SELGROS_KRK',
                       'SUP_KUCHNIE_GDA','SUP_SELGROS_GDA')
 ORDER BY 1;
-- expect: all active; minimum NULL except DISPACK_KAT/KRK 700, PEPSI_KRK 0, KUCHNIE_GDA 600, SELGROS_GDA NULL;
--         cutoff NULL except KUCHNIE_GDA / SELGROS_GDA 17:00
SELECT rule_id, supplier_id FROM supplier_delivery_rules
 WHERE supplier_id IN ('SUP_KUCHNIE_KRK','SUP_SELGROS_KRK','SUP_KUCHNIE_GDA','SUP_SELGROS_GDA');
-- expect 0 rows
SELECT supplier_product_id, active, purchase_unit, case_unit, units_per_case, price_estimate_pln
  FROM supplier_products
 WHERE supplier_product_id IN ('SP_MORY_P128','SP_MORY_P130','SP_MORY_P183','SP_MORY_P184',
                               'SP_WARSZAWA_GDA_P183','SP_WARSZAWA_KAT_P183')
    OR supplier_id = 'SUP_PEPSI_KRK'
 ORDER BY 1;
-- expect: SP_MORY_P128/P130/P184 case NULL/NULL; SP_MORY_P183, SP_WARSZAWA_GDA_P183, SP_WARSZAWA_KAT_P183
--         opak/6; all szt. Pepsi 8 rows zgrzewka: P155 63.12, P163 17.40, P164 17.40, P165 62.40,
--         P166 64.80, P167 62.40, P193 NULL, P194 NULL
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base FROM location_product_settings
 WHERE setting_id IN ('BRACKA__P183','BRACKA__P184') ORDER BY 1;
-- expect: BRACKA__P183 1/4/4, BRACKA__P184 1/2/2

-- ============================================================
-- STEP 1 — apply (one transaction)
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE n int;
BEGIN
  -- ---------- A1. delivery windows ----------
  IF (SELECT string_agg(location_id || '=' || coalesce(delivery_window_from, '-') || '/'
                        || coalesce(delivery_window_to, '-'), ',' ORDER BY location_id)
        FROM locations)
     IS DISTINCT FROM
     'BRACKA=-/-,BROWARY=-/-,ELEKTROWNIA=-/-,FORUM=-/-,KAMIENICA=-/-,KEN=-/-,KULINARNA=-/-,'
     'NORBLIN=-/-,SLONY=-/-,STARY_BROWAR=-/-,SUPERSAM=-/-,WESTFIELD=9:00/10:00,WOLA=-/-'
  THEN
    RAISE EXCEPTION 'A1: delivery windows changed since 2026-10-28 STEP 0 — re-diff';
  END IF;

  UPDATE locations l
     SET delivery_window_from = v.wf, delivery_window_to = v.wt
    FROM (VALUES
      ('NORBLIN',     '10:00', '12:00'),
      ('ELEKTROWNIA', '10:00', '12:00'),
      ('BROWARY',     '10:00', '12:00'),
      ('SLONY',       '10:00', '12:00'),
      ('WOLA',        '11:00', NULL),
      ('KEN',         '11:00', NULL),
      ('BRACKA',      '11:00', NULL),
      ('FORUM',       '10:30', NULL),
      ('SUPERSAM',    '10:00', NULL)
    ) AS v(location_id, wf, wt)
   WHERE l.location_id = v.location_id
     AND l.active
     AND l.delivery_window_from IS NULL AND l.delivery_window_to IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 9 THEN RAISE EXCEPTION 'A1: expected 9 locations, got %', n; END IF;

  -- ---------- A2. Gdańsk e-mail and entrance ----------
  UPDATE locations
     SET email = 'pitabrosslony@gmail.com',
         delivery_address = 'Słony Spichlerz, ul. Chmielna 10 (wejście od strony ul. Chmielnej)'
   WHERE location_id = 'SLONY'
     AND email IS NULL
     AND delivery_address = 'Słony Spichlerz, ul. Chmielna 10'
     AND phone = '692 105 365';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'A2: SLONY not in the expected state (% rows)', n; END IF;

  -- ---------- A3. minimum order values ----------
  UPDATE suppliers s
     SET minimum_order_value_pln = v.new_min
    FROM (VALUES
      ('SUP_COCACOLA_KAT', NULL::numeric, 500::numeric),
      ('SUP_KUCHNIE_KAT',  NULL,          600),
      ('SUP_SELGROS_KAT',  NULL,          750),
      ('SUP_KUCHNIE_KRK',  NULL,          600),
      ('SUP_SELGROS_KRK',  NULL,          750),
      ('SUP_PEPSI_KRK',    0,             450)
    ) AS v(supplier_id, old_min, new_min)
   WHERE s.supplier_id = v.supplier_id
     AND s.active
     AND s.minimum_order_value_pln IS NOT DISTINCT FROM v.old_min;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 6 THEN RAISE EXCEPTION 'A3: expected 6 suppliers, got %', n; END IF;

  -- ---------- A4. order cutoff 17:00 (Katowice / Kraków) ----------
  UPDATE suppliers
     SET cutoff_time = '17:00'
   WHERE supplier_id IN ('SUP_COCACOLA_KAT','SUP_DISPACK_KAT','SUP_DISPACK_KRK','SUP_KUCHNIE_KAT',
                         'SUP_KUCHNIE_KRK','SUP_PEPSI_KRK','SUP_SELGROS_KAT','SUP_SELGROS_KRK')
     AND active
     AND cutoff_time IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 8 THEN RAISE EXCEPTION 'A4: expected 8 suppliers, got %', n; END IF;

  -- ---------- A5. delivery rules Kraków / Gdańsk ----------
  IF EXISTS (SELECT 1 FROM supplier_delivery_rules
              WHERE supplier_id IN ('SUP_KUCHNIE_KRK','SUP_SELGROS_KRK','SUP_KUCHNIE_GDA','SUP_SELGROS_GDA'))
  THEN
    RAISE EXCEPTION 'A5: a rule for these suppliers already exists — re-diff';
  END IF;
  IF (SELECT count(*) FROM suppliers
       WHERE supplier_id IN ('SUP_KUCHNIE_KRK','SUP_SELGROS_KRK','SUP_KUCHNIE_GDA','SUP_SELGROS_GDA')
         AND active) <> 4
  THEN
    RAISE EXCEPTION 'A5: expected 4 active suppliers';
  END IF;

  INSERT INTO supplier_delivery_rules
    (rule_id, supplier_id, location_id, order_weekdays, lead_days, delivery_weekdays, order_deadline,
     active, notes)
  VALUES
    ('DR-KUCHNIE-KRK-ALL', 'SUP_KUCHNIE_KRK', NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1,
     'Mon,Tue,Wed,Thu,Fri,Sat', '17:00', true,
     'Marek 26.10: pon-sob do 17:00; lead 1 assumed (as DR-KUCHNIE-ALL), to confirm'),
    ('DR-SELGROS-KRK-ALL', 'SUP_SELGROS_KRK', NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1,
     'Mon,Tue,Wed,Thu,Fri,Sat', '17:00', true,
     'Marek 26.10: pon-sob do 17:00; lead 1 assumed (as DR-KUCHNIE-ALL), to confirm'),
    ('DR-KUCHNIE-GDA-ALL', 'SUP_KUCHNIE_GDA', NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1,
     'Mon,Tue,Wed,Thu,Fri,Sat', '17:00', true,
     'Marek 26.10: poniedzialek-sobota, 17:00 wszedzie; lead 1 assumed (as DR-KUCHNIE-ALL), to confirm'),
    ('DR-SELGROS-GDA-ALL', 'SUP_SELGROS_GDA', NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1,
     'Mon,Tue,Wed,Thu,Fri,Sat', '17:00', true,
     'Marek 26.10: poniedzialek-sobota, 17:00 wszedzie; lead 1 assumed (as DR-KUCHNIE-ALL), to confirm');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'A5: expected 4 rules, got %', n; END IF;

  -- ---------- A6. rolls, pack of 10 ----------
  UPDATE supplier_products sp
     SET case_unit = 'opak',
         units_per_case = 10,
         notes = CASE WHEN sp.notes = '' THEN v.note ELSE sp.notes || ' | ' || v.note END
    FROM (VALUES
      ('SP_MORY_P183',         'opak', 6::numeric,    'Marek 26.10: 10 szt w paczce (bylo x6)'),
      ('SP_WARSZAWA_GDA_P183', 'opak', 6,             'Marek 26.10: 10 szt w paczce (bylo x6)'),
      ('SP_WARSZAWA_KAT_P183', 'opak', 6,             'Marek 26.10: 10 szt w paczce (bylo x6)'),
      ('SP_MORY_P128',         NULL,   NULL,          'Marek 26.10: 10 szt w paczce'),
      ('SP_MORY_P130',         NULL,   NULL,          'Marek 26.10: 10 szt w paczce'),
      ('SP_MORY_P184',         NULL,   NULL,          'Marek 26.10: 10 szt w paczce')
    ) AS v(supplier_product_id, old_case, old_upc, note)
   WHERE sp.supplier_product_id = v.supplier_product_id
     AND sp.active
     AND sp.purchase_unit = 'szt'
     AND sp.case_unit IS NOT DISTINCT FROM v.old_case
     AND sp.units_per_case IS NOT DISTINCT FROM v.old_upc;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 6 THEN RAISE EXCEPTION 'A6: expected 6 roll rows, got %', n; END IF;

  -- A6b. BRACKA thresholds up to one pack (else the x10 case rounds the suggestion to 0)
  UPDATE location_product_settings s
     SET target_stock_qty_base = 10,
         max_stock_qty_base = 10,
         notes = s.notes || ' [2026-10-28 rolki x10 (Marek 26.10), przed ' || v.before || ']'
    FROM (VALUES
      ('BRACKA__P183', 4::numeric, '1/4/4'),
      ('BRACKA__P184', 2,          '1/2/2')
    ) AS v(setting_id, old_tm, before)
   WHERE s.setting_id = v.setting_id
     AND s.min_stock_qty_base = 1
     AND s.target_stock_qty_base = v.old_tm
     AND s.max_stock_qty_base = v.old_tm;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'A6b: expected 2 BRACKA settings, got %', n; END IF;

  -- ---------- A7. Pepsi Kraków prices ----------
  IF (SELECT count(*) FROM supplier_products WHERE supplier_id = 'SUP_PEPSI_KRK') <> 8 THEN
    RAISE EXCEPTION 'A7: SUP_PEPSI_KRK no longer has exactly 8 rows — re-diff';
  END IF;

  UPDATE supplier_products sp
     SET price_estimate_pln = v.new_price,
         notes = sp.notes || ' | ' || v.note
    FROM (VALUES
      ('SP_PEPSI_KRK_P155', 24::numeric, 63.12::numeric, 50.40::numeric, 'Marek 26.10: puszki 2,10 zl/szt x24'),
      ('SP_PEPSI_KRK_P165', 24,          62.40,          50.40,          'Marek 26.10: puszki 2,10 zl/szt x24'),
      ('SP_PEPSI_KRK_P166', 24,          64.80,          50.40,          'Marek 26.10: puszki 2,10 zl/szt x24'),
      ('SP_PEPSI_KRK_P167', 24,          62.40,          50.40,          'Marek 26.10: puszki 2,10 zl/szt x24'),
      ('SP_PEPSI_KRK_P163', 12,          17.40,          15.60,          'Marek 26.10: woda 1,30 zl/szt x12'),
      ('SP_PEPSI_KRK_P164', 12,          17.40,          15.60,          'Marek 26.10: woda 1,30 zl/szt x12'),
      ('SP_PEPSI_KRK_P193', 12,          NULL,           31.20,          'Marek 26.10: Toma 2,60 zl/szt x12 (x12 do potw.)'),
      ('SP_PEPSI_KRK_P194', 12,          NULL,           31.20,          'Marek 26.10: Toma 2,60 zl/szt x12 (x12 do potw.)')
    ) AS v(supplier_product_id, upu, old_price, new_price, note)
   WHERE sp.supplier_product_id = v.supplier_product_id
     AND sp.supplier_id = 'SUP_PEPSI_KRK'
     AND sp.purchase_unit = 'zgrzewka'
     AND sp.units_per_purchase_unit = v.upu
     AND sp.price_estimate_pln IS NOT DISTINCT FROM v.old_price;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 8 THEN RAISE EXCEPTION 'A7: expected 8 Pepsi rows, got %', n; END IF;
END $$;
COMMIT;

-- ============================================================
-- AUDIT
-- ============================================================
-- (a) windows: BRACKA/KEN/WOLA 11:00/-, BROWARY/ELEKTROWNIA/NORBLIN/SLONY 10:00/12:00, FORUM 10:30/-,
--     SUPERSAM 10:00/-, WESTFIELD 9:00/10:00, KAMIENICA/KULINARNA/STARY_BROWAR -/-
SELECT location_id, active, delivery_window_from, delivery_window_to FROM locations ORDER BY 1;
-- (b) SLONY: pitabrosslony@gmail.com, 'Słony Spichlerz, ul. Chmielna 10 (wejście od strony ul. Chmielnej)'
SELECT location_id, email, phone, delivery_address FROM locations WHERE location_id = 'SLONY';
-- (c) suppliers: COCACOLA_KAT 500/17:00, DISPACK_KAT 700/17:00, DISPACK_KRK 700/17:00, KUCHNIE_KAT 600/17:00,
--     KUCHNIE_KRK 600/17:00, PEPSI_KRK 450/17:00, SELGROS_KAT 750/17:00, SELGROS_KRK 750/17:00
SELECT supplier_id, minimum_order_value_pln, cutoff_time FROM suppliers
 WHERE supplier_id IN ('SUP_COCACOLA_KAT','SUP_DISPACK_KAT','SUP_DISPACK_KRK','SUP_KUCHNIE_KAT',
                       'SUP_KUCHNIE_KRK','SUP_PEPSI_KRK','SUP_SELGROS_KAT','SUP_SELGROS_KRK')
 ORDER BY 1;
-- (d) 4 new rules, 28 in total (24 before)
SELECT rule_id, supplier_id, location_id, order_weekdays, lead_days, delivery_weekdays, order_deadline, active
  FROM supplier_delivery_rules
 WHERE rule_id IN ('DR-KUCHNIE-KRK-ALL','DR-SELGROS-KRK-ALL','DR-KUCHNIE-GDA-ALL','DR-SELGROS-GDA-ALL') ORDER BY 1;
SELECT count(*) FROM supplier_delivery_rules;                                   -- expect 28
-- (e) rolls: P128/P130/P183/P184 opak x10 (MORY, WARSZAWA_GDA/KAT P183, WARSZAWA_KRK P130), P129 opak x6 everywhere
SELECT supplier_product_id, case_unit, units_per_case FROM supplier_products
 WHERE product_id IN ('P128','P129','P130','P183','P184') AND active ORDER BY product_id, 1;
-- (e2) BRACKA__P183 1/10/10, BRACKA__P184 1/10/10
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base FROM location_product_settings
 WHERE setting_id IN ('BRACKA__P183','BRACKA__P184') ORDER BY 1;
-- (f) Pepsi: P155/P165/P166/P167 50.40, P163/P164 15.60, P193/P194 31.20
SELECT supplier_product_id, units_per_purchase_unit, price_estimate_pln FROM supplier_products
 WHERE supplier_id = 'SUP_PEPSI_KRK' ORDER BY 1;

-- ============================================================
-- ROLLBACK (commented out) — restores STEP 0 values
-- ============================================================
-- BEGIN;
-- UPDATE locations SET delivery_window_from = NULL, delivery_window_to = NULL
--  WHERE location_id IN ('NORBLIN','ELEKTROWNIA','BROWARY','SLONY','WOLA','KEN','BRACKA','FORUM','SUPERSAM');
-- UPDATE locations SET email = NULL, delivery_address = 'Słony Spichlerz, ul. Chmielna 10'
--  WHERE location_id = 'SLONY';
-- UPDATE suppliers SET minimum_order_value_pln = NULL
--  WHERE supplier_id IN ('SUP_COCACOLA_KAT','SUP_KUCHNIE_KAT','SUP_SELGROS_KAT','SUP_KUCHNIE_KRK','SUP_SELGROS_KRK');
-- UPDATE suppliers SET minimum_order_value_pln = 0 WHERE supplier_id = 'SUP_PEPSI_KRK';
-- UPDATE suppliers SET cutoff_time = NULL
--  WHERE supplier_id IN ('SUP_COCACOLA_KAT','SUP_DISPACK_KAT','SUP_DISPACK_KRK','SUP_KUCHNIE_KAT',
--                        'SUP_KUCHNIE_KRK','SUP_PEPSI_KRK','SUP_SELGROS_KAT','SUP_SELGROS_KRK');
-- DELETE FROM supplier_delivery_rules
--  WHERE rule_id IN ('DR-KUCHNIE-KRK-ALL','DR-SELGROS-KRK-ALL','DR-KUCHNIE-GDA-ALL','DR-SELGROS-GDA-ALL');
-- UPDATE supplier_products SET units_per_case = 6
--  WHERE supplier_product_id IN ('SP_MORY_P183','SP_WARSZAWA_GDA_P183','SP_WARSZAWA_KAT_P183');
-- UPDATE supplier_products SET case_unit = NULL, units_per_case = NULL
--  WHERE supplier_product_id IN ('SP_MORY_P128','SP_MORY_P130','SP_MORY_P184');
-- UPDATE location_product_settings SET target_stock_qty_base = 4, max_stock_qty_base = 4 WHERE setting_id = 'BRACKA__P183';
-- UPDATE location_product_settings SET target_stock_qty_base = 2, max_stock_qty_base = 2 WHERE setting_id = 'BRACKA__P184';
-- UPDATE supplier_products SET price_estimate_pln = v.p
--   FROM (VALUES ('SP_PEPSI_KRK_P155', 63.12), ('SP_PEPSI_KRK_P165', 62.40), ('SP_PEPSI_KRK_P166', 64.80),
--                ('SP_PEPSI_KRK_P167', 62.40), ('SP_PEPSI_KRK_P163', 17.40), ('SP_PEPSI_KRK_P164', 17.40),
--                ('SP_PEPSI_KRK_P193', NULL::numeric), ('SP_PEPSI_KRK_P194', NULL::numeric)) AS v(id, p)
--  WHERE supplier_product_id = v.id;
-- (notes keep the appended " | Marek 26.10: ..." text; strip by hand if needed)
-- COMMIT;
