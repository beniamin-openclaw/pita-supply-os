-- porzadek-2026-10 — prod SQL: answers from the 19.10 meeting (Ben, Marek, Sławek) + sheet "Miasta poza Warszawą"
-- Prepared 2026-10-19. Supabase project lpzhphufjwrndfogkfub.
-- Run STEP 0 (read-only) first, then STEP 1 + AUDIT.
-- Ben's OK, chat 2026-10-19: "reszte przeanalizuj ... wykonaj wgraj na prod potrzebne elementy. (braki progów uzupełnimy potem)".
--
-- Sources:
--   Ben, chat 19.10: "Katowice to szklo, a gdansk to puszka/pet (zgodnie z arkuszem teraz)".
--   Meeting 19.10 (transcript pasted by Ben):
--     - Bukat Kraków: "ustawiam ... że muszą zamawiać dwa dni wcześniej" -> lead_days 2, deadline 16:00 stays;
--       ordered ~300 zł and Bukat accepted, "nie mam minimum w tym przypadku" -> minimum 0.00
--       (0 = no minimum; NULL would fall back to the default 400 zł in minimumOrder.ts).
--     - Bukat tzatziki: max one third of 72, "Ok, trzyście pojemników" (transcribed; read as 30) -> max 30.
--       Tirokafteri: "osiem pojemników" -> max 8. Min values stay as in the sheet (18 and 2).
--     - Selgros Kraków: no thresholds; a backup source shares the primary's thresholds
--       (location_product_settings are per location + product, so this already holds).
--     - Gdańsk Kuchnie Świata / Selgros / Blue Service: order by 17:00 (already on prod);
--       minima copied from the Warsaw suppliers. Coca-Cola Gdańsk: WhatsApp group, no minimum, marked sent by hand
--       -> ordering_method portal -> manual, minimum 0.00.
--     - Gdańsk vinegar and sugar sachets: remove. Not on prod (no SLONY row) -> nothing to do.
--     - Gdańsk own production: thresholds stay 0 -> nothing to do.
--   Sheet "Miasta poza Warszawą" (Drive 1i-sXUd5zQUyA4YASKkb9SBl61r3sV5M5fazagnsJnpg, downloaded 19.10 12:42):
--     Katowice A123:D152 (Cola, Pago + Magazyn + Lemoniady), Kraków A136:D170 (Pago + Magazyn + Lemoniady, Bukat).
--   Base-unit conversions follow the reviewed Gdańsk rows (SUP_WARSZAWA_GDA, 16.10): gyros szt x15 kg,
--   souvlaki karton x5 kg, pita karton x12 opak, przyprawa pojemnik 2 kg, rolki: P130 57/30 opak x10 (Kraków sheet "10szt"), P129 80/80 opak x6,
--   lemoniady karton x12 szt, cola skrzynka / zgrzewka x24 szt. Target = max (repo convention).
--
-- What this file does (one transaction):
--   A. Katowice Coca-Cola = glass (mirror of gdansk-rollout prod-sql-4):
--      new SUPERSAM rows P186/P187/P190/P191 (0,25 szkło, skrzynka x24, copied from the Warsaw rows);
--      P066/P067 renamed to "0.25 RGB SZKŁO X24 ..." skrzynka x24, price NULL (was a can price);
--      P070/P071 renamed to "0.33 NRG SZKŁO X24 ..." (zgrzewka x24 unchanged);
--      can / PET rows P064/P065/P068/P069 inactive, thresholds stay 0/0/0 (they stay on the count list).
--      Thresholds from the sheet.
--   B. Katowice Pago + Magazyn + Lemoniady: thresholds from the sheet; new rows tzatziki / tirokafteri /
--      feta (N2: they come with the Pago run), copied from SUP_WARSZAWA_GDA; Kuchnie Świata feta becomes backup.
--      Not set (sheet max "?"): rolki 80/20 (P183), 80/80 (P129). Not in the sheet: długopisy (P133).
--   C. Kraków Bukat: thresholds from the sheet (tzatziki max 30, tiro max 8); rule lead_days 1 -> 2; minimum 0.00.
--   D. Kraków: new supplier SUP_WARSZAWA_KRK "Pago + Magazyn + Lemoniady (Kraków)" for FORUM, copied from
--      SUP_WARSZAWA_KAT (manual, minimum 0, alerts off like KAT — open question for Ben), 15 rows from the Kraków
--      sheet section with thresholds. P130 (rolki 57/30) gets opak x10 and the Mory price 1.29 (its template P183
--      is opak x6); P092 is named "Boxy bezowe bez logo (Magazyn)" as in the sheet and in Gdańsk.
--      Tzatziki / tiro / feta stay with Bukat (meeting: Captains may add them to the Pago order by hand).
--   E. Gdańsk: Kuchnie Świata minimum 600, Blue Service 500 (as Warsaw); Coca-Cola Gdańsk: manual (WhatsApp group), minimum 0.
-- Untouched: Pepsi for Kraków (needs new products, R3 open), Dis-Pack / Kuchnie / Selgros thresholds,
--   delivery hours (code change), every other location.
-- Open orders: ORD-20261013-SUP-COCA-27ba14 (claimed; P068/P069 rows only deactivated),
--   ORD-20261013-SUP-WARS-85739d (claimed; 13 KAT lines, none modified), ORD-20261014-FOR-BUKA-1bcc2c (claimed;
--   11 Bukat lines, thresholds only), ORD-20261015-SUP-KUCH-cafd11 (manager_sent; feta row only re-flagged backup).
--   No row they reference is renamed or re-packed, so they render as before.

-- ============================================================
-- STEP 0 — before (read-only; save the output, it is the rollback)
-- ============================================================
SELECT supplier_product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, price_estimate_pln,
       active, is_backup, display_order, order_note
  FROM supplier_products
 WHERE supplier_id IN ('SUP_COCACOLA_KAT','SUP_WARSZAWA_KAT','SUP_BUKAT_KRK') OR supplier_product_id = 'SP_KUCHNIE_KAT_P014'
 ORDER BY supplier_product_id;                                                       -- expect 8 + 16 + 14 + 1 = 39
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base, notes
  FROM location_product_settings
 WHERE (location_id = 'SUPERSAM' AND product_id IN ('P064','P065','P066','P067','P068','P069','P070','P071',
          'P024','P026','P027','P028','P019','P089','P090','P091','P092','P098','P075','P076','P077','P011','P012','P014'))
    OR (location_id = 'FORUM' AND product_id IN ('P002','P003','P004','P005','P006','P007','P008','P009','P010',
          'P011','P012','P014','P016','P018','P024','P026','P027','P028','P019','P089','P090','P091','P092','P098',
          'P129','P130','P075','P076','P077'))
 ORDER BY setting_id;                                                                -- expect 24 + 29 = 53
SELECT * FROM supplier_delivery_rules WHERE supplier_id = 'SUP_BUKAT_KRK';          -- expect DR-BUKAT-KRK-ALL lead 1
SELECT supplier_id, ordering_method, minimum_order_value_pln, notes FROM suppliers
 WHERE supplier_id IN ('SUP_BUKAT_KRK','SUP_KUCHNIE_GDA','SUP_BLUESERV_GDA','SUP_COCACOLA_GDA','SUP_WARSZAWA_KRK');
                                                                                     -- expect 4 rows, no SUP_WARSZAWA_KRK

-- ============================================================
-- STEP 1 — apply
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE _thr (location_id text, product_id text, mn numeric, mx numeric) ON COMMIT DROP;
INSERT INTO _thr VALUES
  -- A. Katowice Coca-Cola (szt)
  ('SUPERSAM','P186',24,96), ('SUPERSAM','P187',24,120), ('SUPERSAM','P067',12,36), ('SUPERSAM','P066',12,36),
  ('SUPERSAM','P191',12,36), ('SUPERSAM','P190',12,36), ('SUPERSAM','P070',36,96), ('SUPERSAM','P071',24,48),
  -- B. Katowice Pago + Magazyn + Lemoniady
  ('SUPERSAM','P024',60,240), ('SUPERSAM','P027',15,110), ('SUPERSAM','P028',5,30), ('SUPERSAM','P026',24,96),
  ('SUPERSAM','P011',2,20), ('SUPERSAM','P012',1,4), ('SUPERSAM','P014',1,2), ('SUPERSAM','P019',2,4),
  ('SUPERSAM','P089',1,3), ('SUPERSAM','P092',1,4), ('SUPERSAM','P090',1,2), ('SUPERSAM','P098',1,2),
  ('SUPERSAM','P091',6,12), ('SUPERSAM','P077',12,48), ('SUPERSAM','P075',12,48), ('SUPERSAM','P076',12,48),
  -- C. Kraków Bukat
  ('FORUM','P004',1,4), ('FORUM','P016',5,20), ('FORUM','P002',0.5,1.5), ('FORUM','P005',0.5,2.5),
  ('FORUM','P003',0.5,2.5), ('FORUM','P008',10,25), ('FORUM','P007',7,18), ('FORUM','P009',0.2,0.5),
  ('FORUM','P006',12,48), ('FORUM','P010',0.2,0.5), ('FORUM','P018',0.5,1), ('FORUM','P011',18,30),
  ('FORUM','P012',2,8), ('FORUM','P014',1,2),
  -- D. Kraków Pago + Magazyn + Lemoniady
  ('FORUM','P024',90,300), ('FORUM','P027',50,300), ('FORUM','P028',10,50), ('FORUM','P026',48,192),
  ('FORUM','P019',2,6), ('FORUM','P089',1,4), ('FORUM','P092',1,4), ('FORUM','P090',1,3), ('FORUM','P098',1,3),
  ('FORUM','P091',6,12), ('FORUM','P130',20,60), ('FORUM','P129',6,24), ('FORUM','P077',12,72),
  ('FORUM','P075',12,72), ('FORUM','P076',12,72);

DO $$
DECLARE n int;
BEGIN
  -- ---------- guards ----------
  IF (SELECT count(*) FROM _thr) <> 53 THEN RAISE EXCEPTION '_thr: expected 53 rows'; END IF;
  IF (SELECT count(*) FROM locations WHERE location_id IN ('SUPERSAM','FORUM','SLONY') AND own_catalog) <> 3 THEN
    RAISE EXCEPTION 'SUPERSAM/FORUM/SLONY not all own_catalog — re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM suppliers WHERE supplier_id = 'SUP_WARSZAWA_KRK')
     OR EXISTS (SELECT 1 FROM supplier_products WHERE supplier_id = 'SUP_WARSZAWA_KRK'
                   OR supplier_product_id IN ('SP_COCACOLA_KAT_P186','SP_COCACOLA_KAT_P187','SP_COCACOLA_KAT_P190',
                        'SP_COCACOLA_KAT_P191','SP_WARSZAWA_KAT_P011','SP_WARSZAWA_KAT_P012','SP_WARSZAWA_KAT_P014')) THEN
    RAISE EXCEPTION 'a row this file creates already exists — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products
       WHERE supplier_id = 'SUP_COCACOLA_KAT' AND location_id = 'SUPERSAM' AND active
         AND ((product_id IN ('P066','P067','P068','P069','P070','P071') AND purchase_unit = 'zgrzewka' AND units_per_purchase_unit = 24)
           OR (product_id IN ('P064','P065') AND purchase_unit = 'zgrzewka' AND units_per_purchase_unit = 12))) <> 8
     OR (SELECT count(*) FROM supplier_products WHERE supplier_id = 'SUP_COCACOLA_KAT') <> 8 THEN
    RAISE EXCEPTION 'SUP_COCACOLA_KAT rows changed since 2026-10-19 — re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM order_lines WHERE supplier_product_id IN
               ('SP_COCACOLA_KAT_P066','SP_COCACOLA_KAT_P067','SP_COCACOLA_KAT_P070','SP_COCACOLA_KAT_P071')) THEN
    RAISE EXCEPTION 'an order references a Coca-Cola KAT row this file renames — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products
       WHERE supplier_product_id IN ('SP_COCACOLA_P186','SP_COCACOLA_P187','SP_COCACOLA_P190','SP_COCACOLA_P191')
         AND active AND location_id IS NULL AND purchase_unit = 'skrzynka' AND units_per_purchase_unit = 24) <> 4 THEN
    RAISE EXCEPTION 'Warsaw glass source rows not as expected — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products WHERE supplier_id = 'SUP_WARSZAWA_KAT' AND location_id = 'SUPERSAM' AND active) <> 16 THEN
    RAISE EXCEPTION 'SUP_WARSZAWA_KAT does not have 16 active rows — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products WHERE supplier_product_id IN
        ('SP_WARSZAWA_GDA_P011','SP_WARSZAWA_GDA_P012','SP_WARSZAWA_GDA_P014') AND active AND location_id = 'SLONY'
        AND purchase_unit = 'pojemnik' AND units_per_purchase_unit = 1) <> 3 THEN
    RAISE EXCEPTION 'Gdańsk tzatziki/tiro/feta source rows not as expected — re-diff';
  END IF;
  IF (SELECT is_backup FROM supplier_products WHERE supplier_product_id = 'SP_KUCHNIE_KAT_P014') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'SP_KUCHNIE_KAT_P014 is not a primary row — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products WHERE supplier_id = 'SUP_BUKAT_KRK' AND location_id = 'FORUM' AND active) <> 14 THEN
    RAISE EXCEPTION 'SUP_BUKAT_KRK does not have 14 active rows — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_delivery_rules
       WHERE rule_id = 'DR-BUKAT-KRK-ALL' AND supplier_id = 'SUP_BUKAT_KRK' AND location_id IS NULL
         AND lead_days = 1 AND order_deadline = '16:00' AND delivery_weekdays = 'Mon,Wed,Fri' AND active) <> 1 THEN
    RAISE EXCEPTION 'Bukat Kraków rule changed — re-diff';
  END IF;
  IF (SELECT minimum_order_value_pln FROM suppliers WHERE supplier_id = 'SUP_BUKAT_KRK') IS DISTINCT FROM 500.00
     OR (SELECT minimum_order_value_pln FROM suppliers WHERE supplier_id = 'SUP_KUCHNIE_GDA') IS NOT NULL
     OR (SELECT minimum_order_value_pln FROM suppliers WHERE supplier_id = 'SUP_BLUESERV_GDA') IS NOT NULL THEN
    RAISE EXCEPTION 'supplier minima changed since 2026-10-19 — re-diff';
  END IF;
  IF (SELECT count(*) FROM suppliers WHERE supplier_id = 'SUP_COCACOLA_GDA'
        AND ordering_method = 'portal' AND minimum_order_value_pln IS NULL) <> 1 THEN
    RAISE EXCEPTION 'SUP_COCACOLA_GDA changed since 2026-10-19 — re-diff';
  END IF;
  IF (SELECT count(*) FROM suppliers WHERE supplier_id = 'SUP_WARSZAWA_KAT'
        AND ordering_method = 'manual' AND minimum_order_value_pln = 0.00 AND NOT suggestion_alerts_enabled) <> 1 THEN
    RAISE EXCEPTION 'SUP_WARSZAWA_KAT (template for KRK) changed — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products WHERE active AND location_id = 'SUPERSAM' AND supplier_product_id IN
        ('SP_WARSZAWA_KAT_P024','SP_WARSZAWA_KAT_P027','SP_WARSZAWA_KAT_P028','SP_WARSZAWA_KAT_P026',
         'SP_WARSZAWA_KAT_P019','SP_WARSZAWA_KAT_P089','SP_WARSZAWA_KAT_P092','SP_WARSZAWA_KAT_P090',
         'SP_WARSZAWA_KAT_P098','SP_WARSZAWA_KAT_P091','SP_WARSZAWA_KAT_P183','SP_WARSZAWA_KAT_P129',
         'SP_WARSZAWA_KAT_P077','SP_WARSZAWA_KAT_P075','SP_WARSZAWA_KAT_P076')) <> 15
     OR (SELECT count(*) FROM supplier_products WHERE supplier_product_id = 'SP_WARSZAWA_KAT_P183'
           AND purchase_unit = 'szt' AND units_per_purchase_unit = 1 AND case_unit = 'opak' AND units_per_case = 6) <> 1 THEN
    RAISE EXCEPTION 'SP_WARSZAWA_KAT template rows changed — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products WHERE supplier_product_id = 'SP_MORY_P130' AND active
        AND purchase_unit = 'szt' AND units_per_purchase_unit = 1 AND price_estimate_pln = 1.29) <> 1 THEN
    RAISE EXCEPTION 'SP_MORY_P130 changed since 2026-10-19 — re-diff';
  END IF;
  -- every SUPERSAM threshold this file sets is still 0/0/0 (state read 19.10), except the new glass products
  IF EXISTS (SELECT 1 FROM _thr t JOIN location_product_settings l USING (location_id, product_id)
              WHERE t.location_id = 'SUPERSAM'
                AND (l.min_stock_qty_base <> 0 OR l.target_stock_qty_base <> 0 OR l.max_stock_qty_base <> 0)) THEN
    RAISE EXCEPTION 'a SUPERSAM threshold is no longer 0/0/0 — re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = 'SUPERSAM' AND product_id IN ('P186','P187','P190','P191')) THEN
    RAISE EXCEPTION 'SUPERSAM glass settings already exist — re-diff';
  END IF;
  -- FORUM Pago-section thresholds still 0/0/0; Bukat ones as read 19.10
  IF (SELECT count(*) FROM _thr t JOIN location_product_settings l USING (location_id, product_id)
       WHERE t.location_id = 'FORUM' AND t.product_id IN ('P024','P026','P027','P028','P019','P089','P090','P091',
               'P092','P098','P129','P130','P075','P076','P077')
         AND l.min_stock_qty_base = 0 AND l.target_stock_qty_base = 0 AND l.max_stock_qty_base = 0) <> 15 THEN
    RAISE EXCEPTION 'FORUM Pago-section thresholds not all 0/0/0 — re-diff';
  END IF;
  IF (SELECT count(*) FROM location_product_settings l
        JOIN (VALUES ('P006',12,54,54),('P016',5,20,20),('P004',2,6,6),('P002',0.5,2,2),('P005',1,2.5,2.5),
                     ('P003',1,2.5,2.5),('P008',8,25,25),('P007',10,35,35),('P009',0.3,1,1),('P010',0.2,1,1),
                     ('P018',0.5,1,1),('P011',5,14,14),('P012',1.5,4,4.5),('P014',0.5,2,2))
             AS v(product_id, mn, tg, mx) USING (product_id)
       WHERE l.location_id = 'FORUM' AND l.min_stock_qty_base = v.mn
         AND l.target_stock_qty_base = v.tg AND l.max_stock_qty_base = v.mx) <> 14 THEN
    RAISE EXCEPTION 'FORUM Bukat thresholds changed since 2026-10-19 — re-diff';
  END IF;

  -- ---------- A. Katowice Coca-Cola = glass ----------
  INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit,
     units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note,
     unit_weight_kg, supplier_sku, warehouse_pickup, display_order, counts_toward_minimum,
     case_unit, units_per_case, location_id, is_backup)
  SELECT 'SP_COCACOLA_KAT_' || sp.product_id, 'SUP_COCACOLA_KAT', sp.product_id, v.name, sp.purchase_unit,
         sp.units_per_purchase_unit, sp.rounding_rule, sp.price_estimate_pln, true,
         'porzadek-2026-10 19.10: Ben "Katowice to szkło"; kopia ' || sp.supplier_product_id
           || ' (Warszawa); zastępuje ' || v.replaces,
         '1 skrzynka = 24 szt (szkło 0,25)', sp.unit_weight_kg, sp.supplier_sku, sp.warehouse_pickup, v.display_order,
         sp.counts_toward_minimum, sp.case_unit, sp.units_per_case, 'SUPERSAM', false
    FROM supplier_products sp
    JOIN (VALUES
      ('SP_COCACOLA_P186', '0.25 RGB SZKŁO X24 COCA-COLA',      10, 'SP_COCACOLA_KAT_P068 (puszka)'),
      ('SP_COCACOLA_P187', '0.25 RGB SZKŁO X24 COCA-COLA ZERO', 20, 'SP_COCACOLA_KAT_P069 (puszka)'),
      ('SP_COCACOLA_P191', '0.25 RGB SZKŁO X24 CAPPY ORANGE',   50, 'SP_COCACOLA_KAT_P065 (PET)'),
      ('SP_COCACOLA_P190', '0.25 RGB SZKŁO X24 CAPPY APPLE',    60, 'SP_COCACOLA_KAT_P064 (PET)')
    ) AS v(src, name, display_order, replaces) ON v.src = sp.supplier_product_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'A glass insert: expected 4, got %', n; END IF;

  UPDATE supplier_products sp
     SET supplier_product_name = v.name, purchase_unit = 'skrzynka', price_estimate_pln = NULL,
         order_note = '1 skrzynka = 24 szt (szkło 0,25)',
         notes = coalesce(sp.notes, '') || ' [2026-10-19 Ben: Katowice szkło; przed: ' || sp.supplier_product_name
                 || ', zgrzewka x24, cena ' || coalesce(sp.price_estimate_pln::text, 'NULL') || '; cena szkła do uzupełnienia]'
    FROM (VALUES ('SP_COCACOLA_KAT_P066', '0.25 RGB SZKŁO X24 FANTA ORANGE'),
                 ('SP_COCACOLA_KAT_P067', '0.25 RGB SZKŁO X24 SPRITE')) AS v(id, name)
   WHERE sp.supplier_product_id = v.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'A Fanta/Sprite: expected 2, got %', n; END IF;

  UPDATE supplier_products sp
     SET supplier_product_name = v.name, order_note = '1 zgrzewka = 24 szt (szkło 0,33)',
         notes = coalesce(sp.notes, '') || ' [2026-10-19 Ben: Katowice szkło; przed: ' || sp.supplier_product_name || ']'
    FROM (VALUES ('SP_COCACOLA_KAT_P070', '0.33 NRG SZKŁO X24 WODA KROPLA BESKIDU'),
                 ('SP_COCACOLA_KAT_P071', '0.33 NRG SZKŁO X24 WODA KROPLA DELICE GAZOWANA')) AS v(id, name)
   WHERE sp.supplier_product_id = v.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'A Kropla: expected 2, got %', n; END IF;

  UPDATE supplier_products
     SET active = false, notes = coalesce(notes, '') || ' [2026-10-19 wyłączone: Katowice kupują szkło (Ben)]'
   WHERE supplier_product_id IN ('SP_COCACOLA_KAT_P064','SP_COCACOLA_KAT_P065','SP_COCACOLA_KAT_P068','SP_COCACOLA_KAT_P069');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'A cans/PET off: expected 4, got %', n; END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base,
     is_critical_for_location, allow_over_max_due_to_packaging, notes, inventory_order)
  SELECT 'SUPERSAM__' || product_id, 'SUPERSAM', product_id, mn, mx, mx, false, false,
         '2026-10-19 porzadek: arkusz Katowice (szkło), Ben "Katowice to szkło"', NULL
    FROM _thr WHERE location_id = 'SUPERSAM' AND product_id IN ('P186','P187','P190','P191');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'A glass settings: expected 4, got %', n; END IF;

  -- ---------- B. Katowice Pago + Magazyn + Lemoniady ----------
  INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit,
     units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note,
     unit_weight_kg, supplier_sku, warehouse_pickup, display_order, counts_toward_minimum,
     case_unit, units_per_case, location_id, is_backup)
  SELECT 'SP_WARSZAWA_KAT_' || sp.product_id, 'SUP_WARSZAWA_KAT', sp.product_id, sp.supplier_product_name,
         sp.purchase_unit, sp.units_per_purchase_unit, sp.rounding_rule, sp.price_estimate_pln, true,
         'porzadek-2026-10 19.10: Ben N2 "tzatziki, tiro, feta jadą z Pago (Mateusz)"; kopia ' || sp.supplier_product_id,
         sp.order_note, sp.unit_weight_kg, sp.supplier_sku, sp.warehouse_pickup, v.display_order,
         sp.counts_toward_minimum, sp.case_unit, sp.units_per_case, 'SUPERSAM', false
    FROM supplier_products sp
    JOIN (VALUES ('SP_WARSZAWA_GDA_P011', 41), ('SP_WARSZAWA_GDA_P012', 42), ('SP_WARSZAWA_GDA_P014', 43))
         AS v(src, display_order) ON v.src = sp.supplier_product_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'B insert: expected 3, got %', n; END IF;

  UPDATE supplier_products
     SET is_backup = true,
         notes = coalesce(notes, '') || ' [2026-10-19 zapasowe: feta jedzie z Pago (Ben N2)]'
   WHERE supplier_product_id = 'SP_KUCHNIE_KAT_P014';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'B feta backup: expected 1, got %', n; END IF;

  UPDATE location_product_settings l
     SET notes = coalesce(l.notes, '') || ' [2026-10-19 przed ' || l.min_stock_qty_base || '/' || l.target_stock_qty_base
                 || '/' || l.max_stock_qty_base || '; arkusz Katowice]',
         min_stock_qty_base = t.mn, target_stock_qty_base = t.mx, max_stock_qty_base = t.mx
    FROM _thr t
   WHERE l.location_id = t.location_id AND l.product_id = t.product_id
     AND t.location_id = 'SUPERSAM' AND t.product_id NOT IN ('P186','P187','P190','P191');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 20 THEN RAISE EXCEPTION 'A+B SUPERSAM thresholds: expected 20, got %', n; END IF;

  -- ---------- C. Kraków Bukat ----------
  UPDATE location_product_settings l
     SET notes = coalesce(l.notes, '') || ' [2026-10-19 przed ' || l.min_stock_qty_base || '/' || l.target_stock_qty_base
                 || '/' || l.max_stock_qty_base || '; arkusz Kraków Bukat'
                 || CASE WHEN t.product_id IN ('P011','P012') THEN ', max ze spotkania 19.10' ELSE '' END || ']',
         min_stock_qty_base = t.mn, target_stock_qty_base = t.mx, max_stock_qty_base = t.mx
    FROM _thr t
   WHERE l.location_id = t.location_id AND l.product_id = t.product_id AND t.location_id = 'FORUM'
     AND t.product_id IN ('P002','P003','P004','P005','P006','P007','P008','P009','P010','P011','P012','P014','P016','P018');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 14 THEN RAISE EXCEPTION 'C Bukat thresholds: expected 14, got %', n; END IF;

  UPDATE supplier_delivery_rules
     SET lead_days = 2,
         notes = notes || ' | 2026-10-19 spotkanie: kapitan zamawia 2 dni przed dostawą do 16:00 (było 1 dzień)'
   WHERE rule_id = 'DR-BUKAT-KRK-ALL';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'C rule: expected 1, got %', n; END IF;

  UPDATE suppliers
     SET minimum_order_value_pln = 0.00,
         notes = notes || ' [2026-10-19 spotkanie: brak minimum — zamówienie ~300 zł przyjęte; 0 = bez progu; przed: 500]'
   WHERE supplier_id = 'SUP_BUKAT_KRK';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'C minimum: expected 1, got %', n; END IF;

  -- ---------- D. Kraków Pago + Magazyn + Lemoniady ----------
  INSERT INTO suppliers
    (supplier_id, supplier_name, email, ordering_method, delivery_days, cutoff_time, minimum_order_value_pln,
     active, notes, nip, suggestion_alerts_enabled, coverage_prompt_enabled)
  SELECT 'SUP_WARSZAWA_KRK', 'Pago + Magazyn + Lemoniady (Kraków)', s.email, s.ordering_method, s.delivery_days,
         s.cutoff_time, s.minimum_order_value_pln, true,
         'porzadek-2026-10 19.10: kopia SUP_WARSZAWA_KAT dla FORUM (sekcja "Pago + Magazyn + Lemoniady" w arkuszu '
           || 'Kraków); katalog tylko dla FORUM; tzatziki/tiro/feta zostają w Bukacie (kapitan może dopisać ręcznie)',
         s.nip, s.suggestion_alerts_enabled, s.coverage_prompt_enabled
    FROM suppliers s WHERE s.supplier_id = 'SUP_WARSZAWA_KAT';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'D supplier: expected 1, got %', n; END IF;

  INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit,
     units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note,
     unit_weight_kg, supplier_sku, warehouse_pickup, display_order, counts_toward_minimum,
     case_unit, units_per_case, location_id, is_backup)
  SELECT 'SP_WARSZAWA_KRK_' || v.product_id, 'SUP_WARSZAWA_KRK', v.product_id,
         coalesce(v.name, sp.supplier_product_name), sp.purchase_unit, sp.units_per_purchase_unit, sp.rounding_rule,
         coalesce(v.price, sp.price_estimate_pln), true,
         'porzadek-2026-10 19.10: arkusz Kraków; kopia ' || sp.supplier_product_id
           || CASE WHEN v.upc IS NOT NULL THEN '; opak x' || v.upc || ' z arkusza, cena z SP_MORY_P130' ELSE '' END,
         sp.order_note, sp.unit_weight_kg, sp.supplier_sku, sp.warehouse_pickup, v.display_order,
         sp.counts_toward_minimum, CASE WHEN v.upc IS NOT NULL THEN 'opak' ELSE sp.case_unit END,
         coalesce(v.upc, sp.units_per_case), 'FORUM', false
    FROM (VALUES
      ('P024','SP_WARSZAWA_KAT_P024',  10, NULL::text, NULL::numeric, NULL::numeric),
      ('P027','SP_WARSZAWA_KAT_P027',  20, NULL, NULL, NULL),
      ('P028','SP_WARSZAWA_KAT_P028',  30, NULL, NULL, NULL),
      ('P026','SP_WARSZAWA_KAT_P026',  40, NULL, NULL, NULL),
      ('P019','SP_WARSZAWA_KAT_P019',  50, NULL, NULL, NULL),
      ('P089','SP_WARSZAWA_KAT_P089',  60, NULL, NULL, NULL),
      ('P092','SP_WARSZAWA_KAT_P092',  70, 'Boxy bezowe bez logo (Magazyn)', NULL, NULL),
      ('P090','SP_WARSZAWA_KAT_P090',  80, NULL, NULL, NULL),
      ('P098','SP_WARSZAWA_KAT_P098',  90, NULL, NULL, NULL),
      ('P091','SP_WARSZAWA_KAT_P091', 100, NULL, NULL, NULL),
      ('P130','SP_WARSZAWA_KAT_P183', 110, 'Rolki do kasy 57 na 30 (Magazyn)', 10, 1.29),
      ('P129','SP_WARSZAWA_KAT_P129', 120, NULL, NULL, NULL),
      ('P077','SP_WARSZAWA_KAT_P077', 130, NULL, NULL, NULL),
      ('P075','SP_WARSZAWA_KAT_P075', 140, NULL, NULL, NULL),
      ('P076','SP_WARSZAWA_KAT_P076', 150, NULL, NULL, NULL)
    ) AS v(product_id, src, display_order, name, upc, price)
    JOIN supplier_products sp ON sp.supplier_product_id = v.src;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 15 THEN RAISE EXCEPTION 'D rows: expected 15, got %', n; END IF;

  UPDATE location_product_settings l
     SET notes = coalesce(l.notes, '') || ' [2026-10-19 przed ' || l.min_stock_qty_base || '/' || l.target_stock_qty_base
                 || '/' || l.max_stock_qty_base || '; arkusz Kraków, Pago + Magazyn + Lemoniady]',
         min_stock_qty_base = t.mn, target_stock_qty_base = t.mx, max_stock_qty_base = t.mx
    FROM _thr t
   WHERE l.location_id = t.location_id AND l.product_id = t.product_id AND t.location_id = 'FORUM'
     AND t.product_id IN ('P024','P026','P027','P028','P019','P089','P090','P091','P092','P098','P129','P130','P075','P076','P077');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 15 THEN RAISE EXCEPTION 'D thresholds: expected 15, got %', n; END IF;

  -- ---------- E. Gdańsk ----------
  UPDATE suppliers s
     SET minimum_order_value_pln = v.mn,
         notes = s.notes || ' [2026-10-19 spotkanie: minimum jak w Warszawie (' || v.src || ')]'
    FROM (VALUES ('SUP_KUCHNIE_GDA', 600.00, 'SUP_KUCHNIE'), ('SUP_BLUESERV_GDA', 500.00, 'SUP_BLUESERV')) AS v(id, mn, src)
   WHERE s.supplier_id = v.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'E minima: expected 2, got %', n; END IF;

  UPDATE suppliers
     SET ordering_method = 'manual', minimum_order_value_pln = 0.00,
         notes = notes || ' [2026-10-19 spotkanie: zamówienie przez grupę WhatsApp, bez minimum; manager oznacza jako wysłane ręcznie; przed: portal, minimum NULL]'
   WHERE supplier_id = 'SUP_COCACOLA_GDA' AND ordering_method = 'portal' AND minimum_order_value_pln IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'E Coca-Cola GDA: expected 1, got %', n; END IF;
END $$;

COMMIT;

-- ============================================================
-- AUDIT
-- ============================================================
-- (a) SUPERSAM Coca-Cola active: 8 rows, all glass-named, order 10..80
SELECT supplier_product_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, display_order
  FROM supplier_products WHERE supplier_id = 'SUP_COCACOLA_KAT' AND active ORDER BY display_order;
-- (b) -> 0 rows: a threshold that differs from the file
SELECT t.*, l.min_stock_qty_base, l.target_stock_qty_base, l.max_stock_qty_base
  FROM (VALUES
    ('SUPERSAM','P186',24,96),('SUPERSAM','P187',24,120),('SUPERSAM','P067',12,36),('SUPERSAM','P066',12,36),
    ('SUPERSAM','P191',12,36),('SUPERSAM','P190',12,36),('SUPERSAM','P070',36,96),('SUPERSAM','P071',24,48),
    ('SUPERSAM','P024',60,240),('SUPERSAM','P027',15,110),('SUPERSAM','P028',5,30),('SUPERSAM','P026',24,96),
    ('SUPERSAM','P011',2,20),('SUPERSAM','P012',1,4),('SUPERSAM','P014',1,2),('SUPERSAM','P019',2,4),
    ('SUPERSAM','P089',1,3),('SUPERSAM','P092',1,4),('SUPERSAM','P090',1,2),('SUPERSAM','P098',1,2),
    ('SUPERSAM','P091',6,12),('SUPERSAM','P077',12,48),('SUPERSAM','P075',12,48),('SUPERSAM','P076',12,48),
    ('FORUM','P004',1,4),('FORUM','P016',5,20),('FORUM','P002',0.5,1.5),('FORUM','P005',0.5,2.5),
    ('FORUM','P003',0.5,2.5),('FORUM','P008',10,25),('FORUM','P007',7,18),('FORUM','P009',0.2,0.5),
    ('FORUM','P006',12,48),('FORUM','P010',0.2,0.5),('FORUM','P018',0.5,1),('FORUM','P011',18,30),
    ('FORUM','P012',2,8),('FORUM','P014',1,2),
    ('FORUM','P024',90,300),('FORUM','P027',50,300),('FORUM','P028',10,50),('FORUM','P026',48,192),
    ('FORUM','P019',2,6),('FORUM','P089',1,4),('FORUM','P092',1,4),('FORUM','P090',1,3),('FORUM','P098',1,3),
    ('FORUM','P091',6,12),('FORUM','P130',20,60),('FORUM','P129',6,24),('FORUM','P077',12,72),
    ('FORUM','P075',12,72),('FORUM','P076',12,72)) AS t(location_id, product_id, mn, mx)
  LEFT JOIN location_product_settings l USING (location_id, product_id)
 WHERE l.setting_id IS NULL OR l.min_stock_qty_base <> t.mn OR l.target_stock_qty_base <> t.mx
    OR l.max_stock_qty_base <> t.mx;
-- (c) SUPERSAM Pago: 19 active rows (16 + tzatziki/tiro/feta); SP_KUCHNIE_KAT_P014 is_backup = true
SELECT count(*) FROM supplier_products WHERE supplier_id = 'SUP_WARSZAWA_KAT' AND active;
SELECT is_backup FROM supplier_products WHERE supplier_product_id = 'SP_KUCHNIE_KAT_P014';
-- (d) FORUM: SUP_WARSZAWA_KRK 15 active rows, all location FORUM
SELECT supplier_product_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, location_id, display_order
  FROM supplier_products WHERE supplier_id = 'SUP_WARSZAWA_KRK' ORDER BY display_order;
-- (e) Bukat KRK lead 2 / minimum 0; Gdańsk minima 600 / 500; Coca-Cola GDA manual / 0; KRK P130 szt/opak/10/1.29
SELECT rule_id, lead_days, order_deadline, delivery_weekdays FROM supplier_delivery_rules WHERE supplier_id = 'SUP_BUKAT_KRK';
SELECT supplier_id, ordering_method, minimum_order_value_pln, suggestion_alerts_enabled FROM suppliers
 WHERE supplier_id IN ('SUP_BUKAT_KRK','SUP_KUCHNIE_GDA','SUP_BLUESERV_GDA','SUP_WARSZAWA_KRK','SUP_COCACOLA_GDA') ORDER BY 1;
SELECT supplier_product_id, supplier_product_name, purchase_unit, case_unit, units_per_case, price_estimate_pln
  FROM supplier_products WHERE supplier_product_id IN ('SP_WARSZAWA_KRK_P130','SP_WARSZAWA_KRK_P092');
-- Live check (no deploy): Katowice Captain -> Coca-Cola tab shows 8 glass rows; Pago tab has tzatziki/tiro/feta;
-- Kraków Captain -> new tab "Pago + Magazyn + Lemoniady (Kraków)"; Bukat tab shows order-by two days before delivery.

-- ============================================================
-- ROLLBACK (commented out) — back to the STEP 0 state. Before-values are all known: SUPERSAM (20) and FORUM Pago (15)
-- thresholds were 0/0/0 (guarded), FORUM Bukat values are in the VALUES below. Text appended to notes stays (audit trail).
-- ============================================================
-- BEGIN;
-- SET LOCAL lock_timeout = '5s';
-- DO $$
-- DECLARE n int;
-- BEGIN
--   IF EXISTS (SELECT 1 FROM order_lines WHERE supplier_product_id IN ('SP_COCACOLA_KAT_P186','SP_COCACOLA_KAT_P187',
--        'SP_COCACOLA_KAT_P190','SP_COCACOLA_KAT_P191','SP_WARSZAWA_KAT_P011','SP_WARSZAWA_KAT_P012','SP_WARSZAWA_KAT_P014')
--        OR supplier_product_id LIKE 'SP_WARSZAWA_KRK_%')
--      OR EXISTS (SELECT 1 FROM receipt_lines WHERE supplier_product_id IN ('SP_COCACOLA_KAT_P186','SP_COCACOLA_KAT_P187',
--        'SP_COCACOLA_KAT_P190','SP_COCACOLA_KAT_P191','SP_WARSZAWA_KAT_P011','SP_WARSZAWA_KAT_P012','SP_WARSZAWA_KAT_P014')
--        OR supplier_product_id LIKE 'SP_WARSZAWA_KRK_%')
--      OR EXISTS (SELECT 1 FROM orders WHERE supplier_id = 'SUP_WARSZAWA_KRK')
--      OR EXISTS (SELECT 1 FROM receipts WHERE supplier_id = 'SUP_WARSZAWA_KRK')
--      OR EXISTS (SELECT 1 FROM transport_batches WHERE supplier_id = 'SUP_WARSZAWA_KRK') THEN
--     RAISE EXCEPTION 'new rows already referenced — roll back by hand';
--   END IF;
--   DELETE FROM supplier_products WHERE supplier_id = 'SUP_WARSZAWA_KRK';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 15 THEN RAISE EXCEPTION 'KRK rows: got %', n; END IF;
--   DELETE FROM suppliers WHERE supplier_id = 'SUP_WARSZAWA_KRK';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'KRK supplier: got %', n; END IF;
--   DELETE FROM supplier_products WHERE supplier_product_id IN ('SP_COCACOLA_KAT_P186','SP_COCACOLA_KAT_P187',
--     'SP_COCACOLA_KAT_P190','SP_COCACOLA_KAT_P191','SP_WARSZAWA_KAT_P011','SP_WARSZAWA_KAT_P012','SP_WARSZAWA_KAT_P014');
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 7 THEN RAISE EXCEPTION 'new rows: got %', n; END IF;
--   DELETE FROM location_product_settings WHERE location_id = 'SUPERSAM' AND product_id IN ('P186','P187','P190','P191');
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 4 THEN RAISE EXCEPTION 'glass settings: got %', n; END IF;
--   UPDATE supplier_products SET active = true WHERE supplier_product_id IN
--     ('SP_COCACOLA_KAT_P064','SP_COCACOLA_KAT_P065','SP_COCACOLA_KAT_P068','SP_COCACOLA_KAT_P069');
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 4 THEN RAISE EXCEPTION 'cans/PET on: got %', n; END IF;
--   UPDATE supplier_products SET supplier_product_name = 'Fanta', purchase_unit = 'zgrzewka', price_estimate_pln = 62.40,
--          order_note = '1 zgrzewka = 24 szt' WHERE supplier_product_id = 'SP_COCACOLA_KAT_P066';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'P066: got %', n; END IF;
--   UPDATE supplier_products SET supplier_product_name = 'Sprite', purchase_unit = 'zgrzewka', price_estimate_pln = 63.12,
--          order_note = '1 zgrzewka = 24 szt' WHERE supplier_product_id = 'SP_COCACOLA_KAT_P067';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'P067: got %', n; END IF;
--   UPDATE supplier_products SET supplier_product_name = 'Kropla Beskidu Niegazowana', order_note = '1 zgrzewka = 24 szt'
--    WHERE supplier_product_id = 'SP_COCACOLA_KAT_P070';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'P070: got %', n; END IF;
--   UPDATE supplier_products SET supplier_product_name = 'Kropla Beskidu Gazowana', order_note = '1 zgrzewka = 24 szt'
--    WHERE supplier_product_id = 'SP_COCACOLA_KAT_P071';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'P071: got %', n; END IF;
--   UPDATE supplier_products SET is_backup = false WHERE supplier_product_id = 'SP_KUCHNIE_KAT_P014';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'feta backup: got %', n; END IF;
--   UPDATE supplier_delivery_rules SET lead_days = 1 WHERE rule_id = 'DR-BUKAT-KRK-ALL';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'rule: got %', n; END IF;
--   UPDATE suppliers SET minimum_order_value_pln = 500.00 WHERE supplier_id = 'SUP_BUKAT_KRK';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Bukat minimum: got %', n; END IF;
--   UPDATE suppliers SET minimum_order_value_pln = NULL WHERE supplier_id IN ('SUP_KUCHNIE_GDA','SUP_BLUESERV_GDA');
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 2 THEN RAISE EXCEPTION 'GDA minima: got %', n; END IF;
--   UPDATE suppliers SET ordering_method = 'portal', minimum_order_value_pln = NULL WHERE supplier_id = 'SUP_COCACOLA_GDA';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Coca-Cola GDA: got %', n; END IF;
--   UPDATE location_product_settings SET min_stock_qty_base = 0, target_stock_qty_base = 0, max_stock_qty_base = 0
--    WHERE (location_id = 'SUPERSAM' AND product_id IN ('P066','P067','P070','P071','P024','P027','P028','P026','P011',
--             'P012','P014','P019','P089','P092','P090','P098','P091','P077','P075','P076'))
--       OR (location_id = 'FORUM' AND product_id IN ('P024','P026','P027','P028','P019','P089','P090','P091','P092',
--             'P098','P129','P130','P075','P076','P077'));
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 35 THEN RAISE EXCEPTION 'thresholds to 0: got %', n; END IF;
--   UPDATE location_product_settings l
--      SET min_stock_qty_base = v.mn, target_stock_qty_base = v.tg, max_stock_qty_base = v.mx
--     FROM (VALUES ('P006',12,54,54),('P016',5,20,20),('P004',2,6,6),('P002',0.5,2,2),('P005',1,2.5,2.5),
--                  ('P003',1,2.5,2.5),('P008',8,25,25),('P007',10,35,35),('P009',0.3,1,1),('P010',0.2,1,1),
--                  ('P018',0.5,1,1),('P011',5,14,14),('P012',1.5,4,4.5),('P014',0.5,2,2)) AS v(product_id, mn, tg, mx)
--    WHERE l.location_id = 'FORUM' AND l.product_id = v.product_id;
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 14 THEN RAISE EXCEPTION 'Bukat thresholds: got %', n; END IF;
-- END $$;
-- COMMIT;
