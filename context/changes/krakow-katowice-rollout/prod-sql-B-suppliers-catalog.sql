-- ============================================================
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !!  RUN ONLY AFTER the new backend is live (check /health + bundle).                     !!
-- !!  The old backend ignores supplier_products.location_id: run before the deploy, every   !!
-- !!  row below (and the 7 new active suppliers) would show up at every Warsaw location.    !!
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- krakow-katowice-rollout — STEP B: city suppliers + catalog scoped to FORUM / SUPERSAM
-- Date: 2026-10-08. Run order: 0029 -> A -> C -> code deploy + verify -> B (this file).
-- Before running: Railway /health is up on the new commit AND the Vercel bundle hash changed
--   (lessons.md: never assume merged = live).
-- What:
--   * 7 suppliers, ordering_method 'manual' (orders go to the manager, placed outside the app),
--     email / delivery_days / cutoff_time / minimum NULL, suggestion alerts on, coverage prompt off,
--     notes "kontakt do potwierdzenia — Marek (mail 2026-10-08)" + public data marked "publiczne, niepotwierdzone".
--   * 181 supplier_products rows, every one with location_id = FORUM or SUPERSAM, id
--     SP_<SUPPLIER without SUP_>_<PRODUCT>. Fields copied from the active Warsaw row named in each
--     row's notes (units, rounding, order_note, case, price "cena z Warszawy") unless the sheet
--     pack differs (noted per row). supplier_product_name = Marek's sheet item name
--     (Bukat Kraków: the Warsaw Bukat name); display_order = sheet row order.
--   SUP_BUKAT_KRK    FORUM      14 rows = 14 primary +  0 backup
--   SUP_DISPACK_KRK  FORUM      26 rows = 26 primary +  0 backup
--   SUP_DISPACK_KAT  SUPERSAM   28 rows = 28 primary +  0 backup
--   SUP_KUCHNIE_KRK  FORUM       9 rows =  7 primary +  2 backup
--   SUP_KUCHNIE_KAT  SUPERSAM    9 rows =  8 primary +  1 backup
--   SUP_SELGROS_KRK  FORUM      47 rows = 24 primary + 23 backup
--   SUP_SELGROS_KAT  SUPERSAM   48 rows = 35 primary + 13 backup
-- Shared catalog (location_id NULL) on 2026-10-08: 260 rows, 172 active,
--   md5 of active rows per product = c7fa486d3ab4f85dc1030996edd444ce. This file never touches a
--   shared row; the DO block re-checks shared counts before vs after inside the transaction.
-- Rollback: rollback.sql — PART 1 kill switch (R-0) FIRST, before any code rollback; then the
--   code rollback; then, optionally, PART 2 (R-B deletes this step).
-- ============================================================

-- ============================================================
-- STEP 0 — diff before (read-only)
-- ============================================================

-- 0a) none of the new suppliers / scoped rows exist yet -> 0 / 0
SELECT (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')) AS suppliers_existing,
       (SELECT count(*) FROM supplier_products WHERE location_id IS NOT NULL) AS scoped_rows_existing;

-- 0b) steps A and C are in place -> FORUM 104 / SUPERSAM 107, own_catalog + active true
SELECT l.location_id, l.own_catalog, l.active,
       (SELECT count(*) FROM location_product_settings s WHERE s.location_id = l.location_id) AS settings
  FROM locations l WHERE l.location_id IN ('FORUM','SUPERSAM') ORDER BY 1;

-- 0c) shared catalog today (record the numbers; must be equal after B) -> 260 / 172 on 2026-10-08
SELECT count(*) AS shared_rows, count(*) FILTER (WHERE active) AS shared_active,
       md5(string_agg(supplier_product_id || ':' || active::text, ',' ORDER BY supplier_product_id)) AS shared_md5
  FROM supplier_products WHERE location_id IS NULL;

-- ============================================================
-- STEP 1 — apply (one DO block = one transaction)
-- ============================================================
DO $$
DECLARE
  n int;
  shared_before bigint;
  shared_active_before bigint;
  shared_md5_before text;
  r record;
  np int;
  nb int;
BEGIN
  -- Guards
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public'
         AND ((table_name = 'locations' AND column_name = 'own_catalog')
           OR (table_name = 'supplier_products' AND column_name IN ('location_id','is_backup')))) <> 3 THEN
    RAISE EXCEPTION 'migration 0029 not applied';
  END IF;
  IF (SELECT count(*) FROM locations
       WHERE location_id IN ('FORUM','SUPERSAM') AND own_catalog AND active) <> 2 THEN
    RAISE EXCEPTION 'step A not applied (FORUM/SUPERSAM not own_catalog + active)';
  END IF;
  IF (SELECT count(*) FROM location_product_settings WHERE location_id = 'FORUM') <> 104
     OR (SELECT count(*) FROM location_product_settings WHERE location_id = 'SUPERSAM') <> 107 THEN
    RAISE EXCEPTION 'step C not applied (FORUM/SUPERSAM should have 104/107 settings rows)';
  END IF;
  IF EXISTS (SELECT 1 FROM suppliers WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')) THEN
    RAISE EXCEPTION 'a city supplier already exists — B was run before? re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products WHERE location_id IS NOT NULL) THEN
    RAISE EXCEPTION 'scoped supplier_products rows already exist — re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE location_id IN ('FORUM','SUPERSAM')) THEN
    RAISE EXCEPTION 'orders exist at FORUM/SUPERSAM before B (Warsaw catalog leaked?) — stop';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE active),
         md5(string_agg(supplier_product_id || ':' || active::text, ',' ORDER BY supplier_product_id))
    INTO shared_before, shared_active_before, shared_md5_before
    FROM supplier_products WHERE location_id IS NULL;

  INSERT INTO suppliers (supplier_id, supplier_name, email, ordering_method, delivery_days,
                         cutoff_time, minimum_order_value_pln, active, notes, nip,
                         suggestion_alerts_enabled, coverage_prompt_enabled)
  VALUES
    ('SUP_BUKAT_KRK', 'Bukat Kraków', NULL, 'manual', NULL, NULL, NULL, true, 'krakow-katowice-rollout 2026-10-08: dostawca miejski, katalog tylko dla FORUM (supplier_products.location_id); kontakt do potwierdzenia — Marek (mail 2026-10-08); katalog: kopia aktywnego katalogu SUP_BUKAT (warzywa, tzatziki, tirokafteri, feta), progi Forum z sierpnia (decyzja operatora 4); czy Bukat dowozi do Krakowa i w jakie dni - do potw.', NULL, true, false),
    ('SUP_DISPACK_KRK', 'Dis-Pack Kraków', NULL, 'manual', NULL, NULL, NULL, true, 'krakow-katowice-rollout 2026-10-08: dostawca miejski, katalog tylko dla FORUM (supplier_products.location_id); kontakt do potwierdzenia — Marek (mail 2026-10-08); arkusz Marka 2026-10-08, zakładka Kraków; publiczne, niepotwierdzone: Dis-Pack Opakowania sp. z o.o., magazyn Morawica 356, 32-084 Morawica (k. Krakowa), biuro@dis-pack.pl (opakowaniakrakow.pl + panoramafirm.pl)', NULL, true, false),
    ('SUP_DISPACK_KAT', 'Dis-Pack Katowice', NULL, 'manual', NULL, NULL, NULL, true, 'krakow-katowice-rollout 2026-10-08: dostawca miejski, katalog tylko dla SUPERSAM (supplier_products.location_id); kontakt do potwierdzenia — Marek (mail 2026-10-08); arkusz Marka 2026-10-08, zakładka Katowice; publiczne, niepotwierdzone: Dis-Pack Opakowania sp. z o.o., magazyn Morawica 356, 32-084 Morawica (k. Krakowa), biuro@dis-pack.pl (opakowaniakrakow.pl + panoramafirm.pl); jak obsługują Katowice - do potw.', NULL, true, false),
    ('SUP_KUCHNIE_KRK', 'Kuchnie Świata Kraków', NULL, 'manual', NULL, NULL, NULL, true, 'krakow-katowice-rollout 2026-10-08: dostawca miejski, katalog tylko dla FORUM (supplier_products.location_id); kontakt do potwierdzenia — Marek (mail 2026-10-08); arkusz Marka 2026-10-08, zakładka Kraków; NIP jak SUP_KUCHNIE (Kuchnie Świata S.A., decyzja operatora 2026-10-08); publiczne, niepotwierdzone: oddział Kraków tel. 12 296 76 60 (kuchnieswiata.com.pl + panoramafirm.pl)', '1180039859', true, false),
    ('SUP_KUCHNIE_KAT', 'Kuchnie Świata Katowice', NULL, 'manual', NULL, NULL, NULL, true, 'krakow-katowice-rollout 2026-10-08: dostawca miejski, katalog tylko dla SUPERSAM (supplier_products.location_id); kontakt do potwierdzenia — Marek (mail 2026-10-08); arkusz Marka 2026-10-08, zakładka Katowice; NIP jak SUP_KUCHNIE (Kuchnie Świata S.A., decyzja operatora 2026-10-08); który oddział obsługuje Katowice - do potw.', '1180039859', true, false),
    ('SUP_SELGROS_KRK', 'Selgros Kraków', NULL, 'manual', NULL, NULL, NULL, true, 'krakow-katowice-rollout 2026-10-08: dostawca miejski, katalog tylko dla FORUM (supplier_products.location_id); kontakt do potwierdzenia — Marek (mail 2026-10-08); arkusz Marka 2026-10-08, zakładka Kraków (wszystkie pozycje szare); publiczne, niepotwierdzone: hala Selgros ul. Nowohucka 52, 31-580 Kraków, tel. 12 68 33 000 (selgros.pl + directmap.info + pkt.pl)', NULL, true, false),
    ('SUP_SELGROS_KAT', 'Selgros Katowice', NULL, 'manual', NULL, NULL, NULL, true, 'krakow-katowice-rollout 2026-10-08: dostawca miejski, katalog tylko dla SUPERSAM (supplier_products.location_id); kontakt do potwierdzenia — Marek (mail 2026-10-08); arkusz Marka 2026-10-08, zakładka Katowice; publiczne, niepotwierdzone: hala Selgros ul. Lwowska 32, 40-389 Katowice, tel. 32 208 80 00 (selgros.pl + targeo.pl + pkt.pl)', NULL, true, false);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 7 THEN RAISE EXCEPTION 'supplier insert touched % rows, expected 7', n; END IF;

  INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name,
                                 purchase_unit, units_per_purchase_unit, rounding_rule,
                                 price_estimate_pln, active, notes, order_note, unit_weight_kg,
                                 supplier_sku, warehouse_pickup, display_order,
                                 counts_toward_minimum, case_unit, units_per_case,
                                 location_id, is_backup)
  VALUES
    ('SP_BUKAT_KRK_P006', 'SUP_BUKAT_KRK', 'P006', 'Pomidor', 'kg', 1, 'tenth_kg', 10.5, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P006 (Warszawa), decyzja 4; cena z Warszawy', NULL, NULL, NULL, false, 10, true, 'skrzynka', 6, 'FORUM', false),
    ('SP_BUKAT_KRK_P016', 'SUP_BUKAT_KRK', 'P016', 'Cebula czerwona', 'kg', 1, 'tenth_kg', 2.2, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P016 (Warszawa), decyzja 4; cena z Warszawy', NULL, NULL, NULL, false, 20, true, 'worek', 5, 'FORUM', false),
    ('SP_BUKAT_KRK_P004', 'SUP_BUKAT_KRK', 'P004', 'Awokado', 'szt', 1, 'full_only', 4.6, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P004 (Warszawa), decyzja 4; cena z Warszawy', NULL, NULL, NULL, false, 30, true, NULL, NULL, 'FORUM', false),
    ('SP_BUKAT_KRK_P002', 'SUP_BUKAT_KRK', 'P002', 'Cytryna', 'kg', 1, 'tenth_kg', 9.4, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P002 (Warszawa), decyzja 4; cena z Warszawy', NULL, NULL, NULL, false, 40, true, NULL, NULL, 'FORUM', false),
    ('SP_BUKAT_KRK_P005', 'SUP_BUKAT_KRK', 'P005', 'Ogórek', 'kg', 1, 'tenth_kg', 16.9, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P005 (Warszawa), decyzja 4; cena z Warszawy', NULL, NULL, NULL, false, 50, true, NULL, NULL, 'FORUM', false),
    ('SP_BUKAT_KRK_P003', 'SUP_BUKAT_KRK', 'P003', 'Papryka zielona', 'kg', 1, 'tenth_kg', 22, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P003 (Warszawa), decyzja 4; cena z Warszawy', NULL, NULL, NULL, false, 60, true, NULL, NULL, 'FORUM', false),
    ('SP_BUKAT_KRK_P008', 'SUP_BUKAT_KRK', 'P008', 'Sałata bolero mix 150gr', 'opak', 1, 'full_only', 4.2, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P008 (Warszawa), decyzja 4; cena z Warszawy', NULL, NULL, NULL, false, 70, true, NULL, NULL, 'FORUM', false),
    ('SP_BUKAT_KRK_P007', 'SUP_BUKAT_KRK', 'P007', 'Rucola 100 gr', 'opak', 1, 'full_only', 4.2, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P007 (Warszawa), decyzja 4; cena z Warszawy', NULL, NULL, NULL, false, 80, true, NULL, NULL, 'FORUM', false),
    ('SP_BUKAT_KRK_P009', 'SUP_BUKAT_KRK', 'P009', 'Natka Pietruszki', 'kg', 1, 'tenth_kg', 18, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P009 (Warszawa), decyzja 4; cena z Warszawy', NULL, NULL, NULL, false, 90, true, NULL, NULL, 'FORUM', false),
    ('SP_BUKAT_KRK_P010', 'SUP_BUKAT_KRK', 'P010', 'Czosnek', 'kg', 1, 'tenth_kg', 27, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P010 (Warszawa), decyzja 4; cena z Warszawy', NULL, NULL, NULL, false, 100, true, NULL, NULL, 'FORUM', false),
    ('SP_BUKAT_KRK_P018', 'SUP_BUKAT_KRK', 'P018', 'Cebula Biała', 'kg', 1, 'tenth_kg', 1.5, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P018 (Warszawa), decyzja 4; cena z Warszawy', NULL, NULL, NULL, false, 110, true, 'worek', 5, 'FORUM', false),
    ('SP_BUKAT_KRK_P011', 'SUP_BUKAT_KRK', 'P011', 'Tzatzyki 3kg', 'pojemnik', 1, 'full_only', 40, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P011 (Warszawa), decyzja 4; cena z Warszawy', '1 pojemnik = 3 kg (karton 6)', NULL, NULL, false, 120, false, NULL, NULL, 'FORUM', false),
    ('SP_BUKAT_KRK_P012', 'SUP_BUKAT_KRK', 'P012', 'Hot Feta (Tirokafteri) 2kg', 'pojemnik', 1, 'full_only', 60, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P012 (Warszawa), decyzja 4; cena z Warszawy', '1 pojemnik = 2 kg', NULL, NULL, false, 130, false, NULL, NULL, 'FORUM', false),
    ('SP_BUKAT_KRK_P014', 'SUP_BUKAT_KRK', 'P014', 'Feta blok 2kg', 'pojemnik', 1, 'full_only', 95, true, 'krakow-katowice-rollout 2026-10-08: kopia SP_BUKAT_P014 (Warszawa), decyzja 4; cena z Warszawy', '1 pojemnik = blok 2 kg', NULL, NULL, false, 140, false, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P082', 'SUP_DISPACK_KRK', 'P082', 'Miski papierowe 1300 ml kraft na sałatkę - 50 szt./opak. 45193', 'opak', 1, 'full_only', 22.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 1; pola z SP_BLUESERV_P082; cena z Warszawy', NULL, NULL, NULL, false, 1, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P083', 'SUP_DISPACK_KRK', 'P083', 'Pokrywki do miski papierowej 1100, 1300 ml - 50 szt. 53115', 'opak', 1, 'full_only', 13.27, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 2; pola z SP_BLUESERV_P083; cena z Warszawy; pokrywka do miski papierowej - w katalogu P083 to pokrywka plastik, do potw.', NULL, NULL, NULL, false, 2, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P085', 'SUP_DISPACK_KRK', 'P085', 'Pojemnik PET okrągły z łączonym wieczkiem - 250 ml - 50 szt./opak. 45138', 'opak', 1, 'full_only', 8.92, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 3; pola z SP_BLUESERV_P085; cena z Warszawy', NULL, NULL, NULL, false, 3, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P084', 'SUP_DISPACK_KRK', 'P084', 'Pojemnik PET okrągły z łączonym wieczkiem - 750 ml - 50 szt./opak. 45142', 'opak', 1, 'full_only', 24, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 4; pola z SP_BLUESERV_P084; cena z Warszawy', NULL, NULL, NULL, false, 4, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P086', 'SUP_DISPACK_KRK', 'P086', 'Sosjerka PP Reuse 80 ml (70) transparent - 100 szt./opak. 7080C', 'opak', 1, 'full_only', 5.7, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 5; pola z SP_BLUESERV_P086; cena z Warszawy', NULL, NULL, NULL, false, 5, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P087', 'SUP_DISPACK_KRK', 'P087', 'Pokrywki PP do sosjerki Reuse 50 ml, 80 ml - 100 szt./opak. P7100C', 'opak', 1, 'full_only', 3.6, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 6; pola z SP_BLUESERV_P087; cena z Warszawy', NULL, NULL, NULL, false, 6, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P093', 'SUP_DISPACK_KRK', 'P093', 'Torba papierowa brązowa z uchwytem płaskim 32 x 22 x 25 cm - 250 szt./karton TUCHO001', 'box', 1, 'full_only', 105, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 7; pola z SP_BLUESERV_P093; cena z Warszawy; arkusz: karton 250 szt = 1 box', NULL, NULL, NULL, false, 7, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P094', 'SUP_DISPACK_KRK', 'P094', 'Torebka papierowa biała fałdowa 18 x 6 x 37 cm - 1000 szt./opak. 17892', 'opak', 1, 'full_only', 19.55, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 8; pola z SP_BLUESERV_P094; cena z Warszawy', NULL, NULL, NULL, false, 8, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P095', 'SUP_DISPACK_KRK', 'P095', 'Folia aluminiowa gastronomiczna 44 cm, gruba 13µ, 1,3 kg 5886', 'szt', 1, 'full_only', 31.32, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 9; pola z SP_BLUESERV_P095; cena z Warszawy', NULL, NULL, NULL, false, 9, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P096', 'SUP_DISPACK_KRK', 'P096', 'Folia do żywności PE szerokość 45/200 m - 1 rolka/opak. FOLIA PE45200', 'szt', 1, 'full_only', 8.65, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 10; pola z SP_BLUESERV_P096; cena z Warszawy', NULL, NULL, NULL, false, 10, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P097', 'SUP_DISPACK_KRK', 'P097', 'Papier do pieczenia dwustronnie silikonowany brązowy 38 cm x 50 m - 1 rolka', 'szt', 1, 'full_only', 12.6, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 11; pola z SP_BLUESERV_P097; cena z Warszawy; nazwa w arkuszu ucięta po kodzie PAPBAKE3', NULL, NULL, NULL, false, 11, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P100', 'SUP_DISPACK_KRK', 'P100', 'Noże wielokrotnego użytku WPC 18 cm, miodowy - 50 szt./opak. 45870', 'opak', 1, 'full_only', 8, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 12; pola z SP_BLUESERV_P100; cena z Warszawy', NULL, NULL, NULL, false, 12, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P101', 'SUP_DISPACK_KRK', 'P101', 'Widelce wielokrotnego użytku WPC 18 cm, miodowy - 50 szt./opak. 45869', 'opak', 1, 'full_only', 8, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 13; pola z SP_BLUESERV_P101; cena z Warszawy', NULL, NULL, NULL, false, 13, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P104', 'SUP_DISPACK_KRK', 'P104', 'Ręcznik składany ZZ eco gray 1W szary - 4000 list./karton 19508', 'opak', 1, 'full_only', 48, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 14; pola z SP_BLUESERV_P104; cena z Warszawy; karton 4000 list. vs opak. ZZ w Warszawie - do potw.', NULL, NULL, NULL, false, 14, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P121', 'SUP_DISPACK_KRK', 'P121', 'Zmywak gąbka MEGA 14,5 x 7,5 cm - 5 szt./opak. G003', 'opak', 5, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 17; pola z SP_BLUESERV_P121; cena do uzupełnienia; bez opakowania zbiorczego (Warszawa: opak 10); opak. 5 szt (Warszawa: szt); cena Warszawy była za sztukę', NULL, NULL, NULL, false, 17, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P122', 'SUP_DISPACK_KRK', 'P122', 'Druciak metalowy MEGA 13 cm - 1 szt. G001', 'szt', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 18; pola z SP_MORY_P122; cena do uzupełnienia', NULL, NULL, NULL, false, 18, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P123', 'SUP_DISPACK_KRK', 'P123', 'Highteh ścierka mikrofaza 30x30 cm, niebieska H-172S', 'szt', 1, 'full_only', 1.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 19; pola z SP_BLUESERV_P123; cena z Warszawy', NULL, NULL, NULL, false, 19, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P126', 'SUP_DISPACK_KRK', 'P126', 'Worki na śmieci 160 L czarne - 10 szt./rolka WM120-E', 'szt', 1, 'full_only', 5.3, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 20; pola z SP_BLUESERV_P126; cena z Warszawy', NULL, NULL, NULL, false, 20, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P102', 'SUP_DISPACK_KRK', 'P102', 'Słomki papierowe 19,7 cm x 8 mm pastelowe mix kolorów - 100 szt./opak 40-12', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 21; pola z SP_BLUESERV_P102; cena do uzupełnienia; opak. 100 szt (katalog: Słomki 250szt) - do potw.', NULL, NULL, NULL, false, 21, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P131', 'SUP_DISPACK_KRK', 'P131', 'Koperta biurowa biała C6 - 50 szt./opak KOPERTY008', 'box', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 22; pola z SP_MORY_P131; cena do uzupełnienia; opak. 50 szt = 1 box; cena Warszawy była za sztukę', NULL, NULL, NULL, false, 22, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P144', 'SUP_DISPACK_KRK', 'P144', 'Kubki papierowe 240 ml kraft - 50 szt./opak. 133249', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 23; pola z SP_BLUESERV_P144; cena do uzupełnienia', NULL, NULL, NULL, false, 23, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P143', 'SUP_DISPACK_KRK', 'P143', 'Tacka papierowa 14 x 25 cm - 100 szt./opak. TAC14X25-100', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 25; pola z SP_BLUESERV_P143; cena do uzupełnienia', NULL, NULL, NULL, false, 25, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P116', 'SUP_DISPACK_KRK', 'P116', 'Rękawiczki nitrylowe easyCARE rozmiar XL CZARNE - 100 szt./opak. RNCS10001', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 26; pola z SP_BLUESERV_P116; cena z Warszawy', NULL, NULL, NULL, false, 26, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P117', 'SUP_DISPACK_KRK', 'P117', 'Rękawiczki nitrylowe easyCARE rozmiar L CZARNE - 100 szt./opak. RNBCL10001', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 27; pola z SP_BLUESERV_P117; cena z Warszawy', NULL, NULL, NULL, false, 27, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P118', 'SUP_DISPACK_KRK', 'P118', 'Rękawiczki nitrylowe easyCARE rozmiar M CZARNE - 100 szt./opak. RNCM10001', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 28; pola z SP_BLUESERV_P118; cena z Warszawy', NULL, NULL, NULL, false, 28, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KRK_P119', 'SUP_DISPACK_KRK', 'P119', 'Rękawiczki nitrylowe easyCARE rozmiar S CZARNE - 100 szt./opak. RNCS10001', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 29; pola z SP_BLUESERV_P119; cena z Warszawy', NULL, NULL, NULL, false, 29, true, NULL, NULL, 'FORUM', false),
    ('SP_DISPACK_KAT_P082', 'SUP_DISPACK_KAT', 'P082', 'Miski papierowe 1300 ml kraft na sałatkę - 50 szt./opak. 45193', 'opak', 1, 'full_only', 22.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 1; pola z SP_BLUESERV_P082; cena z Warszawy', NULL, NULL, NULL, false, 1, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P083', 'SUP_DISPACK_KAT', 'P083', 'Pokrywki do miski papierowej 1100, 1300 ml - 50 szt. 53115', 'opak', 1, 'full_only', 13.27, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 2; pola z SP_BLUESERV_P083; cena z Warszawy; pokrywka do miski papierowej - w katalogu P083 to pokrywka plastik, do potw.', NULL, NULL, NULL, false, 2, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P085', 'SUP_DISPACK_KAT', 'P085', 'Pojemnik PET okrągły z łączonym wieczkiem - 250 ml - 50 szt./opak. 45138', 'opak', 1, 'full_only', 8.92, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 3; pola z SP_BLUESERV_P085; cena z Warszawy', NULL, NULL, NULL, false, 3, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P084', 'SUP_DISPACK_KAT', 'P084', 'Pojemnik PET okrągły z łączonym wieczkiem - 750 ml - 50 szt./opak. 45142', 'opak', 1, 'full_only', 24, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 4; pola z SP_BLUESERV_P084; cena z Warszawy', NULL, NULL, NULL, false, 4, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P086', 'SUP_DISPACK_KAT', 'P086', 'Sosjerka PP Reuse 80 ml (70) transparent - 100 szt./opak. 7080C', 'opak', 1, 'full_only', 5.7, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 5; pola z SP_BLUESERV_P086; cena z Warszawy', NULL, NULL, NULL, false, 5, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P087', 'SUP_DISPACK_KAT', 'P087', 'Pokrywki PP do sosjerki Reuse 50 ml, 80 ml - 100 szt./opak. P7100C', 'opak', 1, 'full_only', 3.6, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 6; pola z SP_BLUESERV_P087; cena z Warszawy', NULL, NULL, NULL, false, 6, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P093', 'SUP_DISPACK_KAT', 'P093', 'Torba papierowa brązowa z uchwytem płaskim 32 x 22 x 25 cm - 250 szt./karton TUCHO001', 'box', 1, 'full_only', 105, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 7; pola z SP_BLUESERV_P093; cena z Warszawy; arkusz: karton 250 szt = 1 box', NULL, NULL, NULL, false, 7, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P094', 'SUP_DISPACK_KAT', 'P094', 'Torebka papierowa biała fałdowa 18 x 6 x 37 cm - 1000 szt./opak. 17892', 'opak', 1, 'full_only', 19.55, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 8; pola z SP_BLUESERV_P094; cena z Warszawy', NULL, NULL, NULL, false, 8, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P095', 'SUP_DISPACK_KAT', 'P095', 'Folia aluminiowa gastronomiczna 44 cm, gruba 13µ, 1,3 kg 5886', 'szt', 1, 'full_only', 31.32, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 9; pola z SP_BLUESERV_P095; cena z Warszawy', NULL, NULL, NULL, false, 9, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P096', 'SUP_DISPACK_KAT', 'P096', 'Folia do żywności PE szerokość 45/200 m - 1 rolka/opak. FOLIA PE45200', 'szt', 1, 'full_only', 8.65, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 10; pola z SP_BLUESERV_P096; cena z Warszawy', NULL, NULL, NULL, false, 10, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P097', 'SUP_DISPACK_KAT', 'P097', 'Papier do pieczenia dwustronnie silikonowany brązowy 38 cm x 50 m - 1 rolka', 'szt', 1, 'full_only', 12.6, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 11; pola z SP_BLUESERV_P097; cena z Warszawy; nazwa w arkuszu ucięta po kodzie PAPBAKE3', NULL, NULL, NULL, false, 11, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P100', 'SUP_DISPACK_KAT', 'P100', 'Noże wielokrotnego użytku WPC 18 cm, miodowy - 50 szt./opak. 45870', 'opak', 1, 'full_only', 8, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 12; pola z SP_BLUESERV_P100; cena z Warszawy', NULL, NULL, NULL, false, 12, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P101', 'SUP_DISPACK_KAT', 'P101', 'Widelce wielokrotnego użytku WPC 18 cm, miodowy - 50 szt./opak. 45869', 'opak', 1, 'full_only', 8, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 13; pola z SP_BLUESERV_P101; cena z Warszawy', NULL, NULL, NULL, false, 13, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P104', 'SUP_DISPACK_KAT', 'P104', 'Ręcznik składany ZZ eco gray 1W szary - 4000 list./karton 19508', 'opak', 1, 'full_only', 48, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 14; pola z SP_BLUESERV_P104; cena z Warszawy; karton 4000 list. vs opak. ZZ w Warszawie - do potw.', NULL, NULL, NULL, false, 14, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P121', 'SUP_DISPACK_KAT', 'P121', 'Zmywak gąbka MEGA 14,5 x 7,5 cm - 5 szt./opak. G003', 'opak', 5, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 17; pola z SP_BLUESERV_P121; cena do uzupełnienia; bez opakowania zbiorczego (Warszawa: opak 10); opak. 5 szt (Warszawa: szt); cena Warszawy była za sztukę', NULL, NULL, NULL, false, 17, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P122', 'SUP_DISPACK_KAT', 'P122', 'Druciak metalowy MEGA 13 cm - 1 szt. G001', 'szt', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 18; pola z SP_MORY_P122; cena do uzupełnienia', NULL, NULL, NULL, false, 18, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P123', 'SUP_DISPACK_KAT', 'P123', 'Highteh ścierka mikrofaza 30x30 cm, niebieska H-172S', 'szt', 1, 'full_only', 1.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 19; pola z SP_BLUESERV_P123; cena z Warszawy', NULL, NULL, NULL, false, 19, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P124', 'SUP_DISPACK_KAT', 'P124', 'Worki na śmieci 60 L czarne LDPE - 50 szt./opak. 09462', 'szt', 1, 'full_only', 5.3, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 20; pola z SP_BLUESERV_P124; cena z Warszawy', NULL, NULL, NULL, false, 20, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P125', 'SUP_DISPACK_KAT', 'P125', 'Worki na śmieci 120 L czarne LDPE - 25 szt./rolka S024', 'szt', 1, 'full_only', 5.3, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 21; pola z SP_BLUESERV_P125; cena z Warszawy', NULL, NULL, NULL, false, 21, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P126', 'SUP_DISPACK_KAT', 'P126', 'Worki na śmieci 160 L czarne - 10 szt./rolka WM120-E', 'szt', 1, 'full_only', 5.3, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 22; pola z SP_BLUESERV_P126; cena z Warszawy', NULL, NULL, NULL, false, 22, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P102', 'SUP_DISPACK_KAT', 'P102', 'Słomki papierowe 19,7 cm x 8 mm pastelowe mix kolorów - 100 szt./opak 40-12', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 23; pola z SP_BLUESERV_P102; cena do uzupełnienia; opak. 100 szt (katalog: Słomki 250szt) - do potw.', NULL, NULL, NULL, false, 23, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P131', 'SUP_DISPACK_KAT', 'P131', 'Koperta biurowa biała C6 - 50 szt./opak KOPERTY008', 'box', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 24; pola z SP_MORY_P131; cena do uzupełnienia; opak. 50 szt = 1 box; cena Warszawy była za sztukę', NULL, NULL, NULL, false, 24, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P144', 'SUP_DISPACK_KAT', 'P144', 'Kubki papierowe 240 ml kraft - 50 szt./opak. 133249', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 25; pola z SP_BLUESERV_P144; cena do uzupełnienia', NULL, NULL, NULL, false, 25, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P143', 'SUP_DISPACK_KAT', 'P143', 'Tacka papierowa 14 x 25 cm - 100 szt./opak. TAC14X25-100', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 27; pola z SP_BLUESERV_P143; cena do uzupełnienia', NULL, NULL, NULL, false, 27, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P116', 'SUP_DISPACK_KAT', 'P116', 'Rękawiczki nitrylowe easyCARE rozmiar XL CZARNE - 100 szt./opak. RNCS10001', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 28; pola z SP_BLUESERV_P116; cena z Warszawy', NULL, NULL, NULL, false, 28, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P117', 'SUP_DISPACK_KAT', 'P117', 'Rękawiczki nitrylowe easyCARE rozmiar L CZARNE - 100 szt./opak. RNBCL10001', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 29; pola z SP_BLUESERV_P117; cena z Warszawy', NULL, NULL, NULL, false, 29, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P118', 'SUP_DISPACK_KAT', 'P118', 'Rękawiczki nitrylowe easyCARE rozmiar M CZARNE - 100 szt./opak. RNCM10001', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 30; pola z SP_BLUESERV_P118; cena z Warszawy', NULL, NULL, NULL, false, 30, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_DISPACK_KAT_P119', 'SUP_DISPACK_KAT', 'P119', 'Rękawiczki nitrylowe easyCARE rozmiar S CZARNE - 100 szt./opak. RNCS10001', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 31; pola z SP_BLUESERV_P119; cena z Warszawy', NULL, NULL, NULL, false, 31, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_KUCHNIE_KRK_P021', 'SUP_KUCHNIE_KRK', 'P021', 'Aviko 806704 Frytki proste 9,5mm Premium Super Crunch Fries 2,5kg/4 Aviko 806704', 'paczka', 1, 'full_only', 18.86, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 1; pola z SP_INTERMLECZ_P021; cena z Warszawy', '1 szt = 1 paczka 2,5 kg', NULL, NULL, false, 1, true, 'karton', 4, 'FORUM', false),
    ('SP_KUCHNIE_KRK_P022', 'SUP_KUCHNIE_KRK', 'P022', 'Frytki z batatów proste 9,5mm Sweet potato, 2,27kg/5 Aviko 809564', 'paczka', 1, 'full_only', 46.08, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 2; pola z SP_INTERMLECZ_P022; cena z Warszawy', '1 paczka = 2,27 kg', NULL, NULL, false, 2, true, NULL, NULL, 'FORUM', false),
    ('SP_KUCHNIE_KRK_P015', 'SUP_KUCHNIE_KRK', 'P015', 'Ser na grilla 200g/12 Reha', 'szt', 1, 'full_only', 7.73, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 3; pola z SP_INTERMLECZ_P015; cena z Warszawy', NULL, NULL, NULL, false, 3, true, 'karton', 12, 'FORUM', false),
    ('SP_KUCHNIE_KRK_P020', 'SUP_KUCHNIE_KRK', 'P020', 'Falafel standard. bób/ciecierzyca mroż. 5kg', 'karton', 5, 'full_only', 160, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 4; pola z SP_KUCHNIE_P020; cena z Warszawy', NULL, NULL, NULL, false, 4, true, NULL, NULL, 'FORUM', false),
    ('SP_KUCHNIE_KRK_P038', 'SUP_KUCHNIE_KRK', 'P038', 'Frytura oleina słonecznikowa Deep Fry 15L EFFO', 'szt', 1, 'full_only', 154.07, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 5; pola z SP_INTERMLECZ_P038; cena z Warszawy', NULL, NULL, NULL, false, 5, true, NULL, NULL, 'FORUM', false),
    ('SP_KUCHNIE_KRK_P048', 'SUP_KUCHNIE_KRK', 'P048', 'Sos Sriracha Original 730ml/12 F.Goose', 'szt', 1, 'full_only', 16.56, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 6; pola z SP_INTERMLECZ_P048; cena z Warszawy', NULL, NULL, NULL, false, 6, true, NULL, NULL, 'FORUM', false),
    ('SP_KUCHNIE_KRK_P013', 'SUP_KUCHNIE_KRK', 'P013', 'Oliwki czarne z/p Kalamata Superior (261-290), 2kg/3,1kg Olivellas', 'opak', 2, 'full_only', 45.31, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 8; pola z SP_INTERMLECZ_P013; cena z Warszawy; 1 opak = bidon 2 kg', NULL, NULL, NULL, false, 8, true, NULL, NULL, 'FORUM', false),
    ('SP_KUCHNIE_KRK_P014', 'SUP_KUCHNIE_KRK', 'P014', 'Ser Feta grecki pl.box 2kg Hotos', 'pojemnik', 1, 'full_only', 95, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 9; pola z SP_BUKAT_P014; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy', '1 pojemnik = blok 2 kg', NULL, NULL, false, 9, true, NULL, NULL, 'FORUM', true),
    ('SP_KUCHNIE_KRK_P041', 'SUP_KUCHNIE_KRK', 'P041', 'Olej rzepakowy TopQ (uniwersalny) 5L', 'szt', 1, 'full_only', 28.56, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 11; pola z SP_INTERMLECZ_P041; ZAPASOWY (główny: Selgros Kraków); cena z Warszawy', NULL, NULL, NULL, false, 11, true, NULL, NULL, 'FORUM', true),
    ('SP_KUCHNIE_KAT_P021', 'SUP_KUCHNIE_KAT', 'P021', 'Aviko 806704 Frytki proste 9,5mm Premium Super Crunch Fries 2,5kg/4 Aviko 806704', 'paczka', 1, 'full_only', 18.86, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 1; pola z SP_INTERMLECZ_P021; cena z Warszawy', '1 szt = 1 paczka 2,5 kg', NULL, NULL, false, 1, true, 'karton', 4, 'SUPERSAM', false),
    ('SP_KUCHNIE_KAT_P022', 'SUP_KUCHNIE_KAT', 'P022', 'Frytki z batatów proste 9,5mm Sweet potato, 2,27kg/5 Aviko 809564', 'paczka', 1, 'full_only', 46.08, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 2; pola z SP_INTERMLECZ_P022; cena z Warszawy', '1 paczka = 2,27 kg', NULL, NULL, false, 2, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_KUCHNIE_KAT_P015', 'SUP_KUCHNIE_KAT', 'P015', 'Ser na grilla 200g/12 Reha', 'szt', 1, 'full_only', 7.73, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 3; pola z SP_INTERMLECZ_P015; cena z Warszawy', NULL, NULL, NULL, false, 3, true, 'karton', 12, 'SUPERSAM', false),
    ('SP_KUCHNIE_KAT_P020', 'SUP_KUCHNIE_KAT', 'P020', 'Falafel standard. bób/ciecierzyca mroż. 5kg', 'karton', 5, 'full_only', 160, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 4; pola z SP_KUCHNIE_P020; cena z Warszawy', NULL, NULL, NULL, false, 4, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_KUCHNIE_KAT_P038', 'SUP_KUCHNIE_KAT', 'P038', 'Frytura oleina słonecznikowa Deep Fry 15L EFFO', 'szt', 1, 'full_only', 154.07, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 5; pola z SP_INTERMLECZ_P038; cena z Warszawy', NULL, NULL, NULL, false, 5, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_KUCHNIE_KAT_P048', 'SUP_KUCHNIE_KAT', 'P048', 'Sos Sriracha Original 730ml/12 F.Goose', 'szt', 1, 'full_only', 16.56, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 6; pola z SP_INTERMLECZ_P048; cena z Warszawy', NULL, NULL, NULL, false, 6, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_KUCHNIE_KAT_P013', 'SUP_KUCHNIE_KAT', 'P013', 'Oliwki czarne z/p Kalamata Superior (261-290), 2kg/3,1kg Olivellas', 'opak', 2, 'full_only', 45.31, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 8; pola z SP_INTERMLECZ_P013; cena z Warszawy; 1 opak = bidon 2 kg', NULL, NULL, NULL, false, 8, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_KUCHNIE_KAT_P014', 'SUP_KUCHNIE_KAT', 'P014', 'Ser Feta grecki pl.box 2kg Hotos', 'pojemnik', 1, 'full_only', 95, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 9; pola z SP_BUKAT_P014; cena z Warszawy', '1 pojemnik = blok 2 kg', NULL, NULL, false, 9, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_KUCHNIE_KAT_P041', 'SUP_KUCHNIE_KAT', 'P041', 'Olej rzepakowy TopQ (uniwersalny) 5L', 'szt', 1, 'full_only', 28.56, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 11; pola z SP_INTERMLECZ_P041; ZAPASOWY (główny: Selgros Katowice); cena z Warszawy', NULL, NULL, NULL, false, 11, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KRK_P004', 'SUP_SELGROS_KRK', 'P004', 'Awokado', 'szt', 1, 'full_only', 4.6, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 1; pola z SP_BUKAT_P004; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy', NULL, NULL, NULL, false, 1, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P016', 'SUP_SELGROS_KRK', 'P016', 'Cebula czerwona (duże)', 'kg', 1, 'tenth_kg', 2.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 2; pola z SP_BUKAT_P016; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy; bez opakowania zbiorczego (Warszawa: worek 5)', NULL, NULL, NULL, false, 2, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P002', 'SUP_SELGROS_KRK', 'P002', 'Cytryna', 'kg', 1, 'tenth_kg', 9.4, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 3; pola z SP_BUKAT_P002; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy', NULL, NULL, NULL, false, 3, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P005', 'SUP_SELGROS_KRK', 'P005', 'Ogórek', 'kg', 1, 'tenth_kg', 16.9, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 4; pola z SP_BUKAT_P005; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy', NULL, NULL, NULL, false, 4, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P003', 'SUP_SELGROS_KRK', 'P003', 'Papryka zielona (nie czerwona)', 'kg', 1, 'tenth_kg', 22, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 5; pola z SP_BUKAT_P003; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy', NULL, NULL, NULL, false, 5, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P008', 'SUP_SELGROS_KRK', 'P008', 'Sałata bolero mix 150gr (lub inny mix jak nie będzie bolero bez buraka)', 'opak', 1, 'full_only', 4.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 6; pola z SP_BUKAT_P008; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy', NULL, NULL, NULL, false, 6, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P007', 'SUP_SELGROS_KRK', 'P007', 'Rucola 100gr', 'opak', 1, 'full_only', 4.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 7; pola z SP_BUKAT_P007; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy', NULL, NULL, NULL, false, 7, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P009', 'SUP_SELGROS_KRK', 'P009', 'Natka Pietruszki', 'kg', 1, 'tenth_kg', 18, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 8; pola z SP_BUKAT_P009; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy', NULL, NULL, NULL, false, 8, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P006', 'SUP_SELGROS_KRK', 'P006', 'Pomidor (twardy, duży)', 'kg', 1, 'tenth_kg', 10.5, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 9; pola z SP_BUKAT_P006; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy; bez opakowania zbiorczego (Warszawa: skrzynka 6)', NULL, NULL, NULL, false, 9, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P010', 'SUP_SELGROS_KRK', 'P010', 'Czosnek obrany', 'kg', 1, 'tenth_kg', 27, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 10; pola z SP_BUKAT_P010; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy', NULL, NULL, NULL, false, 10, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P018', 'SUP_SELGROS_KRK', 'P018', 'Cebula Biała', 'kg', 1, 'tenth_kg', 1.5, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 11; pola z SP_BUKAT_P018; ZAPASOWY (główny: Bukat Kraków); cena z Warszawy; bez opakowania zbiorczego (Warszawa: worek 5)', NULL, NULL, NULL, false, 11, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P045', 'SUP_SELGROS_KRK', 'P045', 'Oliwa z Oliwek tania 1L', 'szt', 1, 'full_only', 11.59, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 12; pola z SP_INTERMLECZ_P045; cena z Warszawy', NULL, NULL, NULL, false, 12, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P001', 'SUP_SELGROS_KRK', 'P001', 'Masło roślinne MR 500g', 'szt', 1, 'full_only', 6.27, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 13; pola z SP_INTERMLECZ_P001; cena z Warszawy', NULL, NULL, NULL, false, 13, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P046', 'SUP_SELGROS_KRK', 'P046', 'Cieciorka puszka mała', 'szt', 1, 'full_only', 2.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 14; pola z SP_INTERMLECZ_P046; cena z Warszawy', NULL, NULL, NULL, false, 14, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P047', 'SUP_SELGROS_KRK', 'P047', 'Kasza Pęczak 1kg', 'szt', 1, 'full_only', 4.36, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 15; pola z SP_INTERMLECZ_P047; cena z Warszawy', NULL, NULL, NULL, false, 15, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P043', 'SUP_SELGROS_KRK', 'P043', 'MUSZTARDA Stołowa 3 kg', 'szt', 1, 'full_only', 18.4, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 16; pola z SP_INTERMLECZ_P043; cena z Warszawy', NULL, NULL, NULL, false, 16, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P042', 'SUP_SELGROS_KRK', 'P042', 'Ketchup Fanex VII 1,1 kg', 'szt', 1, 'full_only', 12.79, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 17; pola z SP_INTERMLECZ_P042; cena z Warszawy', NULL, NULL, NULL, false, 17, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P044', 'SUP_SELGROS_KRK', 'P044', 'Fanex Majonez 4kg Sałatkowy', 'szt', 1, 'full_only', 53, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 18; pola z SP_INTERMLECZ_P044; cena z Warszawy', NULL, NULL, NULL, false, 18, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P041', 'SUP_SELGROS_KRK', 'P041', 'Olej Uniwersalny Rzepakowy 5 L', 'szt', 1, 'full_only', 28.56, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 19; pola z SP_INTERMLECZ_P041; cena z Warszawy', NULL, NULL, NULL, false, 19, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P049', 'SUP_SELGROS_KRK', 'P049', 'Miód 1 kg', 'kg', 1, 'full_only', 13, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 20; pola z SP_INTERMLECZ_P049; cena z Warszawy', NULL, NULL, NULL, false, 20, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P023', 'SUP_SELGROS_KRK', 'P023', 'Fasolka Szparagowa Mrożona 2,5 kg', 'opak', 2.5, 'full_only', 13.04, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 21; pola z SP_INTERMLECZ_P023; cena z Warszawy', NULL, NULL, NULL, false, 21, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P040', 'SUP_SELGROS_KRK', 'P040', 'Woda 5L', 'szt', 1, 'full_only', 6.01, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 22; pola z SP_INTERMLECZ_P040; cena z Warszawy', NULL, NULL, NULL, false, 22, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P021', 'SUP_SELGROS_KRK', 'P021', 'Frytki Aviko Super Crunch 9,5', 'paczka', 1, 'full_only', 18.86, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 23; pola z SP_INTERMLECZ_P021; ZAPASOWY (główny: Kuchnie Świata Kraków); cena z Warszawy; bez opakowania zbiorczego (Warszawa: karton 4); w arkuszu drugi raz jako ''Frytki Aviko Super Crunch 9,5'' (op) - jeden wiersz', '1 szt = 1 paczka 2,5 kg', NULL, NULL, false, 23, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P022', 'SUP_SELGROS_KRK', 'P022', 'Frytki z batatów Avico 2,27 KG', 'paczka', 1, 'full_only', 46.08, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 24; pola z SP_INTERMLECZ_P022; ZAPASOWY (główny: Kuchnie Świata Kraków); cena z Warszawy', '1 paczka = 2,27 kg', NULL, NULL, false, 24, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P106', 'SUP_SELGROS_KRK', 'P106', 'Domestos 5L', 'szt', 1, 'full_only', 33.79, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 25; pola z SP_BLUESERV_P106; cena z Warszawy', NULL, NULL, NULL, false, 25, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P107', 'SUP_SELGROS_KRK', 'P107', 'Ludwik 5L', 'szt', 1, 'full_only', 25.9, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 26; pola z SP_BLUESERV_P107; cena z Warszawy', NULL, NULL, NULL, false, 26, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P053', 'SUP_SELGROS_KRK', 'P053', 'Sól drobna 1kg', 'kg', 1, 'full_only', 19.37, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 27; pola z SP_INTERMLECZ_P053; cena z Warszawy', NULL, NULL, NULL, false, 27, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P051', 'SUP_SELGROS_KRK', 'P051', 'Oregano duże', 'kg', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 28; pola z SP_INTERMLECZ_P051; cena do uzupełnienia; waga opakowania ''duże'' do potw.', NULL, NULL, NULL, false, 28, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P052', 'SUP_SELGROS_KRK', 'P052', 'Papryka słodka - mielona duża (nie ostra, nie wędzona)', 'kg', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 29; pola z SP_INTERMLECZ_P052; cena do uzupełnienia; waga opakowania ''duża'' do potw.', NULL, NULL, NULL, false, 29, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P172', 'SUP_SELGROS_KRK', 'P172', 'Ser Gouda Blok 3kg', 'szt', 3, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 31; pola z SP_INTERMLECZ_P172; cena do uzupełnienia; arkusz: blok 3 kg = szt (x3 kg); Warszawa: kg', 'blok ok. 3 kg', NULL, NULL, false, 31, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P054', 'SUP_SELGROS_KRK', 'P054', 'Liść Laurowy', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 32; pola z SP_INTERMLECZ_P054; cena do uzupełnienia; wielkość opakowania w Selgrosie nieznana', NULL, NULL, NULL, false, 32, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P055', 'SUP_SELGROS_KRK', 'P055', 'Ziele Angielskie', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 33; pola z SP_INTERMLECZ_P055; cena do uzupełnienia; wielkość opakowania w Selgrosie nieznana', NULL, NULL, NULL, false, 33, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P057', 'SUP_SELGROS_KRK', 'P057', 'Sól saszetki 2gr', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 34; pola z SP_INTERMLECZ_P057; cena do uzupełnienia; saszetki 2 g (katalog: 5 g) - do potw.', NULL, NULL, NULL, false, 34, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P058', 'SUP_SELGROS_KRK', 'P058', 'Pieprz saszetki 2gr', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 35; pola z SP_INTERMLECZ_P058; cena do uzupełnienia; saszetki 2 g (katalog: 5 g) - do potw.', NULL, NULL, NULL, false, 35, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P050', 'SUP_SELGROS_KRK', 'P050', 'Pieprz czarny mielony duży', 'kg', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 36; pola z SP_INTERMLECZ_P050; cena do uzupełnienia; arkusz ''op'', katalog ''kg'' - 1:1, waga do potw.', NULL, NULL, NULL, false, 36, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P118', 'SUP_SELGROS_KRK', 'P118', 'Rękawiczki jednorazowe M Czarne', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 37; pola z SP_BLUESERV_P118; ZAPASOWY (główny: Dis-Pack Kraków); cena z Warszawy; arkusz ''szt'', przyjęto 1 opak.', NULL, NULL, NULL, false, 37, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P117', 'SUP_SELGROS_KRK', 'P117', 'Rękawiczki jednorazowe L Czarne', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 38; pola z SP_BLUESERV_P117; ZAPASOWY (główny: Dis-Pack Kraków); cena z Warszawy; arkusz ''szt'', przyjęto 1 opak.', NULL, NULL, NULL, false, 38, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P119', 'SUP_SELGROS_KRK', 'P119', 'Rękawiczki jednorazowe S Czarne', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 39; pola z SP_BLUESERV_P119; ZAPASOWY (główny: Dis-Pack Kraków); cena z Warszawy; arkusz ''szt'', przyjęto 1 opak.', NULL, NULL, NULL, false, 39, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P116', 'SUP_SELGROS_KRK', 'P116', 'Rękawiczki jednorazowe XL Czarne', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 40; pola z SP_BLUESERV_P116; ZAPASOWY (główny: Dis-Pack Kraków); cena z Warszawy; arkusz ''szt'', przyjęto 1 opak.', NULL, NULL, NULL, false, 40, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P104', 'SUP_SELGROS_KRK', 'P104', 'Reczniki papierowe ZZ Top seler', 'opak', 1, 'full_only', 48, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 43; pola z SP_BLUESERV_P104; ZAPASOWY (główny: Dis-Pack Kraków); cena z Warszawy; arkusz: karton', NULL, NULL, NULL, false, 43, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P126', 'SUP_SELGROS_KRK', 'P126', 'Worki na śmieci 160L', 'szt', 1, 'full_only', 5.3, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 44; pola z SP_BLUESERV_P126; ZAPASOWY (główny: Dis-Pack Kraków); cena z Warszawy', NULL, NULL, NULL, false, 44, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P122', 'SUP_SELGROS_KRK', 'P122', 'Druciaki duże 5szt', 'opak', 5, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 45; pola z SP_MORY_P122; ZAPASOWY (główny: Dis-Pack Kraków); cena do uzupełnienia; op. 5 szt', NULL, NULL, NULL, false, 45, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P127', 'SUP_SELGROS_KRK', 'P127', 'Zszywki 24/6 op. 1000szt', 'opak', 1, 'full_only', 0.7, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 48; pola z SP_MORY_P127; cena z Warszawy', NULL, NULL, NULL, false, 48, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P095', 'SUP_SELGROS_KRK', 'P095', 'Folia aluminiowa duża', 'szt', 1, 'full_only', 31.32, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 52; pola z SP_BLUESERV_P095; ZAPASOWY (główny: Dis-Pack Kraków); cena z Warszawy', NULL, NULL, NULL, false, 52, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P096', 'SUP_SELGROS_KRK', 'P096', 'Folia spożywcza duża', 'szt', 1, 'full_only', 8.65, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 53; pola z SP_BLUESERV_P096; ZAPASOWY (główny: Dis-Pack Kraków); cena z Warszawy', NULL, NULL, NULL, false, 53, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KRK_P088', 'SUP_SELGROS_KRK', 'P088', 'Torebka na frytki kwadratowa', 'opak', 1, 'full_only', 5.04, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 60; pola z SP_BLUESERV_P088; cena z Warszawy; = P088 Opakowanie Frytki? do potw.', NULL, NULL, NULL, false, 60, true, NULL, NULL, 'FORUM', false),
    ('SP_SELGROS_KRK_P123', 'SUP_SELGROS_KRK', 'P123', 'Ścierki z mikrofibry kolorowe 5szt', 'opak', 5, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Kraków poz. 62; pola z SP_BLUESERV_P123; ZAPASOWY (główny: Dis-Pack Kraków); cena do uzupełnienia; op. 5 szt', NULL, NULL, NULL, false, 62, true, NULL, NULL, 'FORUM', true),
    ('SP_SELGROS_KAT_P004', 'SUP_SELGROS_KAT', 'P004', 'Awokado', 'szt', 1, 'full_only', 4.6, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 1; pola z SP_BUKAT_P004; cena z Warszawy', NULL, NULL, NULL, false, 1, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P016', 'SUP_SELGROS_KAT', 'P016', 'Cebula czerwona (duże)', 'kg', 1, 'tenth_kg', 2.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 2; pola z SP_BUKAT_P016; cena z Warszawy; bez opakowania zbiorczego (Warszawa: worek 5)', NULL, NULL, NULL, false, 2, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P002', 'SUP_SELGROS_KAT', 'P002', 'Cytryna', 'kg', 1, 'tenth_kg', 9.4, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 3; pola z SP_BUKAT_P002; cena z Warszawy', NULL, NULL, NULL, false, 3, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P005', 'SUP_SELGROS_KAT', 'P005', 'Ogórek', 'kg', 1, 'tenth_kg', 16.9, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 4; pola z SP_BUKAT_P005; cena z Warszawy', NULL, NULL, NULL, false, 4, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P003', 'SUP_SELGROS_KAT', 'P003', 'Papryka zielona (nie czerwona)', 'kg', 1, 'tenth_kg', 22, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 5; pola z SP_BUKAT_P003; cena z Warszawy', NULL, NULL, NULL, false, 5, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P008', 'SUP_SELGROS_KAT', 'P008', 'Sałata bolero mix 150gr (lub inny mix jak nie będzie bolero bez buraka)', 'opak', 1, 'full_only', 4.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 6; pola z SP_BUKAT_P008; cena z Warszawy', NULL, NULL, NULL, false, 6, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P007', 'SUP_SELGROS_KAT', 'P007', 'Rucola 100gr', 'opak', 1, 'full_only', 4.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 7; pola z SP_BUKAT_P007; cena z Warszawy', NULL, NULL, NULL, false, 7, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P009', 'SUP_SELGROS_KAT', 'P009', 'Natka Pietruszki', 'kg', 1, 'tenth_kg', 18, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 8; pola z SP_BUKAT_P009; cena z Warszawy', NULL, NULL, NULL, false, 8, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P006', 'SUP_SELGROS_KAT', 'P006', 'Pomidor (twardy, duży)', 'kg', 1, 'tenth_kg', 10.5, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 9; pola z SP_BUKAT_P006; cena z Warszawy; bez opakowania zbiorczego (Warszawa: skrzynka 6)', NULL, NULL, NULL, false, 9, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P010', 'SUP_SELGROS_KAT', 'P010', 'Czosnek obrany', 'kg', 1, 'tenth_kg', 27, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 10; pola z SP_BUKAT_P010; cena z Warszawy', NULL, NULL, NULL, false, 10, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P018', 'SUP_SELGROS_KAT', 'P018', 'Cebula Biała', 'kg', 1, 'tenth_kg', 1.5, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 11; pola z SP_BUKAT_P018; cena z Warszawy; bez opakowania zbiorczego (Warszawa: worek 5)', NULL, NULL, NULL, false, 11, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P045', 'SUP_SELGROS_KAT', 'P045', 'Oliwa z Oliwek tania 1L', 'szt', 1, 'full_only', 11.59, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 12; pola z SP_INTERMLECZ_P045; cena z Warszawy', NULL, NULL, NULL, false, 12, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P001', 'SUP_SELGROS_KAT', 'P001', 'Masło roślinne MR 500g', 'szt', 1, 'full_only', 6.27, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 13; pola z SP_INTERMLECZ_P001; cena z Warszawy', NULL, NULL, NULL, false, 13, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P046', 'SUP_SELGROS_KAT', 'P046', 'Cieciorka puszka mała', 'szt', 1, 'full_only', 2.2, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 14; pola z SP_INTERMLECZ_P046; cena z Warszawy', NULL, NULL, NULL, false, 14, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P047', 'SUP_SELGROS_KAT', 'P047', 'Kasza Pęczak 1kg', 'szt', 1, 'full_only', 4.36, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 15; pola z SP_INTERMLECZ_P047; cena z Warszawy', NULL, NULL, NULL, false, 15, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P043', 'SUP_SELGROS_KAT', 'P043', 'MUSZTARDA Stołowa 3 kg', 'szt', 1, 'full_only', 18.4, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 16; pola z SP_INTERMLECZ_P043; cena z Warszawy', NULL, NULL, NULL, false, 16, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P042', 'SUP_SELGROS_KAT', 'P042', 'Ketchup Fanex VII 1,1 kg', 'szt', 1, 'full_only', 12.79, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 17; pola z SP_INTERMLECZ_P042; cena z Warszawy', NULL, NULL, NULL, false, 17, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P044', 'SUP_SELGROS_KAT', 'P044', 'Fanex Majonez 4kg Sałatkowy', 'szt', 1, 'full_only', 53, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 18; pola z SP_INTERMLECZ_P044; cena z Warszawy', NULL, NULL, NULL, false, 18, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P041', 'SUP_SELGROS_KAT', 'P041', 'Olej Uniwersalny Rzepakowy 5 L', 'szt', 1, 'full_only', 28.56, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 19; pola z SP_INTERMLECZ_P041; cena z Warszawy', NULL, NULL, NULL, false, 19, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P049', 'SUP_SELGROS_KAT', 'P049', 'Miód 1 kg', 'kg', 1, 'full_only', 13, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 20; pola z SP_INTERMLECZ_P049; cena z Warszawy', NULL, NULL, NULL, false, 20, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P023', 'SUP_SELGROS_KAT', 'P023', 'Fasolka Szparagowa Mrożona 2,5 kg', 'opak', 2.5, 'full_only', 13.04, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 21; pola z SP_INTERMLECZ_P023; cena z Warszawy', NULL, NULL, NULL, false, 21, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P040', 'SUP_SELGROS_KAT', 'P040', 'Woda 5L', 'szt', 1, 'full_only', 6.01, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 22; pola z SP_INTERMLECZ_P040; cena z Warszawy', NULL, NULL, NULL, false, 22, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P021', 'SUP_SELGROS_KAT', 'P021', 'Frytki Aviko Super Crunch 9,5', 'paczka', 1, 'full_only', 18.86, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 23; pola z SP_INTERMLECZ_P021; ZAPASOWY (główny: Kuchnie Świata Katowice); cena z Warszawy; bez opakowania zbiorczego (Warszawa: karton 4); w arkuszu drugi raz jako ''Frytki Aviko Super Crunch 9,5'' (op) - jeden wiersz', '1 szt = 1 paczka 2,5 kg', NULL, NULL, false, 23, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P022', 'SUP_SELGROS_KAT', 'P022', 'Frytki z batatów Avico 2,27 KG', 'paczka', 1, 'full_only', 46.08, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 24; pola z SP_INTERMLECZ_P022; ZAPASOWY (główny: Kuchnie Świata Katowice); cena z Warszawy', '1 paczka = 2,27 kg', NULL, NULL, false, 24, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P106', 'SUP_SELGROS_KAT', 'P106', 'Domestos 5L', 'szt', 1, 'full_only', 33.79, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 25; pola z SP_BLUESERV_P106; cena z Warszawy', NULL, NULL, NULL, false, 25, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P107', 'SUP_SELGROS_KAT', 'P107', 'Ludwik 5L', 'szt', 1, 'full_only', 25.9, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 26; pola z SP_BLUESERV_P107; cena z Warszawy', NULL, NULL, NULL, false, 26, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P053', 'SUP_SELGROS_KAT', 'P053', 'Sól drobna 1kg', 'kg', 1, 'full_only', 19.37, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 27; pola z SP_INTERMLECZ_P053; cena z Warszawy', NULL, NULL, NULL, false, 27, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P051', 'SUP_SELGROS_KAT', 'P051', 'Oregano duże', 'kg', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 28; pola z SP_INTERMLECZ_P051; cena do uzupełnienia; waga opakowania ''duże'' do potw.', NULL, NULL, NULL, false, 28, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P052', 'SUP_SELGROS_KAT', 'P052', 'Papryka słodka - mielona duża (nie ostra, nie wędzona)', 'kg', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 29; pola z SP_INTERMLECZ_P052; cena do uzupełnienia; waga opakowania ''duża'' do potw.', NULL, NULL, NULL, false, 29, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P054', 'SUP_SELGROS_KAT', 'P054', 'Liść Laurowy', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 30; pola z SP_INTERMLECZ_P054; cena do uzupełnienia; wielkość opakowania w Selgrosie nieznana', NULL, NULL, NULL, false, 30, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P055', 'SUP_SELGROS_KAT', 'P055', 'Ziele Angielskie', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 31; pola z SP_INTERMLECZ_P055; cena do uzupełnienia; wielkość opakowania w Selgrosie nieznana', NULL, NULL, NULL, false, 31, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P057', 'SUP_SELGROS_KAT', 'P057', 'Sól saszetki 2gr', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 32; pola z SP_INTERMLECZ_P057; cena do uzupełnienia; saszetki 2 g (katalog: 5 g) - do potw.', NULL, NULL, NULL, false, 32, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P058', 'SUP_SELGROS_KAT', 'P058', 'Pieprz saszetki 2gr', 'opak', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 33; pola z SP_INTERMLECZ_P058; cena do uzupełnienia; saszetki 2 g (katalog: 5 g) - do potw.', NULL, NULL, NULL, false, 33, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P050', 'SUP_SELGROS_KAT', 'P050', 'Pieprz czarny mielony duży', 'kg', 1, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 34; pola z SP_INTERMLECZ_P050; cena do uzupełnienia; arkusz ''op'', katalog ''kg'' - 1:1, waga do potw.', NULL, NULL, NULL, false, 34, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P118', 'SUP_SELGROS_KAT', 'P118', 'Rękawiczki jednorazowe M Czarne', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 35; pola z SP_BLUESERV_P118; ZAPASOWY (główny: Dis-Pack Katowice); cena z Warszawy; arkusz ''szt'', przyjęto 1 opak.', NULL, NULL, NULL, false, 35, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P117', 'SUP_SELGROS_KAT', 'P117', 'Rękawiczki jednorazowe L Czarne', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 36; pola z SP_BLUESERV_P117; ZAPASOWY (główny: Dis-Pack Katowice); cena z Warszawy; arkusz ''szt'', przyjęto 1 opak.', NULL, NULL, NULL, false, 36, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P119', 'SUP_SELGROS_KAT', 'P119', 'Rękawiczki jednorazowe S Czarne', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 37; pola z SP_BLUESERV_P119; ZAPASOWY (główny: Dis-Pack Katowice); cena z Warszawy; arkusz ''szt'', przyjęto 1 opak.', NULL, NULL, NULL, false, 37, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P116', 'SUP_SELGROS_KAT', 'P116', 'Rękawiczki jednorazowe XL Czarne', 'opak', 1, 'full_only', 9.75, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 38; pola z SP_BLUESERV_P116; ZAPASOWY (główny: Dis-Pack Katowice); cena z Warszawy; arkusz ''szt'', przyjęto 1 opak.', NULL, NULL, NULL, false, 38, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P104', 'SUP_SELGROS_KAT', 'P104', 'Reczniki papierowe ZZ Top seler', 'opak', 1, 'full_only', 48, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 41; pola z SP_BLUESERV_P104; ZAPASOWY (główny: Dis-Pack Katowice); cena z Warszawy; arkusz: karton', NULL, NULL, NULL, false, 41, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P125', 'SUP_SELGROS_KAT', 'P125', 'Worki na śmieci 120L', 'szt', 1, 'full_only', 5.3, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 42; pola z SP_BLUESERV_P125; ZAPASOWY (główny: Dis-Pack Katowice); cena z Warszawy', NULL, NULL, NULL, false, 42, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P126', 'SUP_SELGROS_KAT', 'P126', 'Worki na śmieci 160L', 'szt', 1, 'full_only', 5.3, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 43; pola z SP_BLUESERV_P126; ZAPASOWY (główny: Dis-Pack Katowice); cena z Warszawy', NULL, NULL, NULL, false, 43, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P122', 'SUP_SELGROS_KAT', 'P122', 'Druciaki duże 5szt', 'opak', 5, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 44; pola z SP_MORY_P122; ZAPASOWY (główny: Dis-Pack Katowice); cena do uzupełnienia; op. 5 szt', NULL, NULL, NULL, false, 44, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P127', 'SUP_SELGROS_KAT', 'P127', 'Zszywki 24/6 op. 1000szt', 'opak', 1, 'full_only', 0.7, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 47; pola z SP_MORY_P127; cena z Warszawy', NULL, NULL, NULL, false, 47, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P095', 'SUP_SELGROS_KAT', 'P095', 'Folia aluminiowa duża', 'szt', 1, 'full_only', 31.32, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 51; pola z SP_BLUESERV_P095; ZAPASOWY (główny: Dis-Pack Katowice); cena z Warszawy', NULL, NULL, NULL, false, 51, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P096', 'SUP_SELGROS_KAT', 'P096', 'Folia spożywcza duża', 'szt', 1, 'full_only', 8.65, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 52; pola z SP_BLUESERV_P096; ZAPASOWY (główny: Dis-Pack Katowice); cena z Warszawy', NULL, NULL, NULL, false, 52, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P088', 'SUP_SELGROS_KAT', 'P088', 'Torebka na frytki kwadratowa', 'opak', 1, 'full_only', 5.04, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 59; pola z SP_BLUESERV_P088; cena z Warszawy; = P088 Opakowanie Frytki? do potw.', NULL, NULL, NULL, false, 59, true, NULL, NULL, 'SUPERSAM', false),
    ('SP_SELGROS_KAT_P123', 'SUP_SELGROS_KAT', 'P123', 'Ścierki z mikrofibry kolorowe 5szt', 'opak', 5, 'full_only', NULL, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 61; pola z SP_BLUESERV_P123; ZAPASOWY (główny: Dis-Pack Katowice); cena do uzupełnienia; op. 5 szt', NULL, NULL, NULL, false, 61, true, NULL, NULL, 'SUPERSAM', true),
    ('SP_SELGROS_KAT_P132', 'SUP_SELGROS_KAT', 'P132', 'Marker permanentny czarny', 'szt', 1, 'full_only', 6, true, 'krakow-katowice-rollout 2026-10-08: arkusz Marka Katowice poz. 64; pola z SP_MORY_P132; cena z Warszawy', NULL, NULL, NULL, false, 64, true, NULL, NULL, 'SUPERSAM', false);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 181 THEN RAISE EXCEPTION 'supplier_products insert touched % rows, expected 181', n; END IF;

  -- per supplier: primary / backup counts
  FOR r IN SELECT * FROM (VALUES
      ('SUP_BUKAT_KRK', 'FORUM', 14, 0),
      ('SUP_DISPACK_KRK', 'FORUM', 26, 0),
      ('SUP_DISPACK_KAT', 'SUPERSAM', 28, 0),
      ('SUP_KUCHNIE_KRK', 'FORUM', 7, 2),
      ('SUP_KUCHNIE_KAT', 'SUPERSAM', 8, 1),
      ('SUP_SELGROS_KRK', 'FORUM', 24, 23),
      ('SUP_SELGROS_KAT', 'SUPERSAM', 35, 13)
    ) AS e(supplier_id, location_id, n_primary, n_backup)
  LOOP
    SELECT count(*) FILTER (WHERE NOT is_backup), count(*) FILTER (WHERE is_backup)
      INTO np, nb
      FROM supplier_products
     WHERE supplier_id = r.supplier_id AND location_id = r.location_id AND active;
    IF np <> r.n_primary OR nb <> r.n_backup THEN
      RAISE EXCEPTION '% at %: % primary / % backup, expected % / %',
        r.supplier_id, r.location_id, np, nb, r.n_primary, r.n_backup;
    END IF;
  END LOOP;

  -- invariants (any failure rolls the whole step back)
  IF EXISTS (SELECT 1 FROM supplier_products b
              WHERE b.location_id IS NOT NULL AND b.is_backup AND b.active
                AND NOT EXISTS (SELECT 1 FROM supplier_products p
                                 WHERE p.location_id = b.location_id AND p.product_id = b.product_id
                                   AND p.active AND NOT p.is_backup)) THEN
    RAISE EXCEPTION 'a backup row has no active primary row at its location';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products sp
              WHERE sp.location_id IS NOT NULL AND sp.active
                AND NOT EXISTS (SELECT 1 FROM location_product_settings s
                                 WHERE s.location_id = sp.location_id AND s.product_id = sp.product_id)) THEN
    RAISE EXCEPTION 'a scoped row has no settings row at its location';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products sp JOIN products p USING (product_id)
              WHERE sp.location_id IS NOT NULL AND NOT p.active) THEN
    RAISE EXCEPTION 'a scoped row points at an inactive product';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products sp JOIN locations l ON l.location_id = sp.location_id
              WHERE NOT l.own_catalog) THEN
    RAISE EXCEPTION 'a scoped row sits at a location without own_catalog';
  END IF;
  IF EXISTS (SELECT 1 FROM (SELECT location_id, product_id FROM supplier_products
                             WHERE location_id IS NOT NULL AND active AND NOT is_backup
                             GROUP BY 1, 2 HAVING count(*) > 1) d) THEN
    RAISE EXCEPTION 'a product has two primary rows at one location';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products
              WHERE location_id IS NOT NULL AND active
              GROUP BY location_id, supplier_id, product_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate active scoped rows for one (location, supplier, product)';
  END IF;
  IF (SELECT count(*) FROM supplier_products WHERE location_id IS NULL) <> shared_before
     OR (SELECT count(*) FILTER (WHERE active) FROM supplier_products WHERE location_id IS NULL) <> shared_active_before
     OR (SELECT md5(string_agg(supplier_product_id || ':' || active::text, ',' ORDER BY supplier_product_id))
           FROM supplier_products WHERE location_id IS NULL) <> shared_md5_before THEN
    RAISE EXCEPTION 'shared catalog changed inside step B';
  END IF;
END $$;

-- ============================================================
-- STEP 2 — audit (read-only). Every query must return the stated result.
-- ============================================================

-- a) per supplier -> see the header table (181 rows in total)
SELECT s.supplier_id, s.supplier_name, s.ordering_method, s.active, sp.location_id,
       count(*) FILTER (WHERE NOT sp.is_backup) AS n_primary,
       count(*) FILTER (WHERE sp.is_backup) AS n_backup
  FROM suppliers s LEFT JOIN supplier_products sp ON sp.supplier_id = s.supplier_id AND sp.active
 WHERE s.supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')
 GROUP BY 1, 2, 3, 4, 5 ORDER BY 1;

-- b) every new supplier has >= 1 active row -> 0 rows
SELECT s.supplier_id FROM suppliers s
 WHERE s.supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')
   AND NOT EXISTS (SELECT 1 FROM supplier_products sp WHERE sp.supplier_id = s.supplier_id AND sp.active);

-- c) every backup row has an active primary for the same (location, product) -> 0 rows
SELECT b.location_id, b.product_id, b.supplier_product_id FROM supplier_products b
 WHERE b.is_backup AND b.active
   AND NOT EXISTS (SELECT 1 FROM supplier_products p
                    WHERE p.location_id = b.location_id AND p.product_id = b.product_id
                      AND p.active AND NOT p.is_backup);

-- d) every orderable scoped product has a settings row at its location -> 0 rows
SELECT sp.location_id, sp.product_id, sp.supplier_product_id FROM supplier_products sp
 WHERE sp.location_id IS NOT NULL AND sp.active
   AND NOT EXISTS (SELECT 1 FROM location_product_settings s
                    WHERE s.location_id = sp.location_id AND s.product_id = sp.product_id);

-- e) settings rows with no scoped row = count-only -> FORUM 33, SUPERSAM 36, all 0/0/0
SELECT s.location_id, count(*) AS count_only,
       count(*) FILTER (WHERE s.max_stock_qty_base <> 0) AS nonzero
  FROM location_product_settings s
 WHERE s.location_id IN ('FORUM','SUPERSAM')
   AND NOT EXISTS (SELECT 1 FROM supplier_products sp
                    WHERE sp.location_id = s.location_id AND sp.product_id = s.product_id AND sp.active)
 GROUP BY 1 ORDER BY 1;

-- f) no shared row touched -> 260 / 172 / md5 equal to STEP 0c (2026-10-08 values unless the
--    Warsaw catalog changed between the diff and this run), 0 shared rows with is_backup
SELECT count(*) AS shared_rows, count(*) FILTER (WHERE active) AS shared_active,
       md5(string_agg(supplier_product_id || ':' || active::text, ',' ORDER BY supplier_product_id)) AS shared_md5,
       count(*) FILTER (WHERE is_backup) AS shared_backup
  FROM supplier_products WHERE location_id IS NULL;

-- g) shared active rows per product unchanged -> md5 c7fa486d3ab4f85dc1030996edd444ce (2026-10-08)
SELECT md5(string_agg(product_id || ':' || n, ',' ORDER BY product_id))
  FROM (SELECT product_id, count(*) n FROM supplier_products
         WHERE location_id IS NULL AND active GROUP BY 1) x;

-- h) scoped rows only at own-catalog locations -> 0 rows
SELECT sp.supplier_product_id FROM supplier_products sp JOIN locations l ON l.location_id = sp.location_id
 WHERE NOT l.own_catalog;

-- i) no duplicate ACTIVE scoped rows per (location, supplier, product) -> 0 rows
--    (client state on the order card is keyed by product_id; two rows would break the card)
SELECT location_id, supplier_id, product_id, count(*) AS n,
       string_agg(supplier_product_id, ', ' ORDER BY supplier_product_id) AS rows
  FROM supplier_products
 WHERE location_id IS NOT NULL AND active
 GROUP BY 1, 2, 3 HAVING count(*) > 1;
