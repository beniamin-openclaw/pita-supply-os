-- porzadek-2026-10 — prod SQL: Ben's answers on the open data items (second round, 19.10 evening)
-- Prepared 2026-10-19. Supabase project lpzhphufjwrndfogkfub.
-- Run STEP 0 (read-only) first, then STEP 1 + AUDIT.
--
-- Sources:
--   Ben, chat 19.10 (answers to "Dane, które czekają na Marka albo na Twoje OK"):
--     - "rolki 80/20 daj tak jak jest, jakimś innym"                       -> A (SUPERSAM rolls as other locations)
--     - "Fusty i Kinley po jednej zgrzewce"                                -> B (max one crate of 24 = WOLA/KEN 6/24;
--         the HBC invoice 2424313581 sells Fuzetea 0,25 as a x24 crate, the app row x12 is half of it)
--     - "Gdańsk. Ceny i progi daj tak jak mamy w Kamienicy Kulinarnej. Usuń stamtąd ustawienia szkła."
--         KAMIENICA has 0/0/0 for every Coca-Cola product ("threshold TBC (sheet had no min/max)"), so it cannot be
--         copied. Thresholds come from the Gdańsk tab of the sheet "Miasta poza Warszawą" (rows 86–93, cans x24,
--         PET x12) -> C. Glass settings SLONY__P186/P187/P190/P191 (all 0/0/0) are deleted (STEP 2 of
--         gdansk-rollout/prod-sql-4, now with Ben's OK). No FK references location_product_settings.
--     - "Katowice: ceny ustaw zgodnie z fakturami i z realem ... ceny zunifikowane. Możesz potwierdzić to z fakturami." -> D
--     - "Kraków — tak, tam jest Pepsi zamiast coli."                       -> E (sheet Kraków A125:D134, portal pephub)
--     - "jeżeli jest pet, to jest 12 sztuk"                               -> every PET row in C and E is x12
--   Coca-Cola HBC invoices in finance_documents — all three are KEN's (NIP 5223241275), glass deliveries; used for
--   Katowice because Ben wants one price for all locations ("ceny zunifikowane"); price = line netto / quantity:
--     2424225127 (06.08): Coca-Cola 0,25 60.67, Zero 58.87, Cappy apple/orange 75.24
--     2424267367 (20.08): Fanta 0,25 RGB x24 58.27, Sprite 0,25 RGB x24 59.47, Kropla Beskidu 0,33 NRG x24 niegaz 48.96
--     2424313581 (07.09): Coca-Cola 60.67, Zero 58.87, Fuzetea 0,25 x24 78.96 (= 2 x 39.48, matches the x12 row)
--   Threshold conversion: sheet min/max in packs x pack size, max not rounded up (same as the 19.10 Katowice file).
--
-- What this file does (one transaction):
--   A. SUPERSAM rolls: P183 (80/20) 12/30 = ELEKTROWNIA/NORBLIN/WESTFIELD; P129 (80/80) 6/24 = Katowice sheet min
--      ("80/80 6szt", 1 opak) + max as FORUM / KEN / BROWARY.
--   B. Fuzetea and Kinley, one crate of 24: ELEKTROWNIA P081 6/24, P079 6/24; WESTFIELD P081 6/24 (= WOLA / KEN).
--      WESTFIELD has no Kinley setting (not on its count list) -> not added.
--   C. Gdańsk SLONY Coca-Cola (cans / PET): thresholds from the sheet; prices of the cans as in Warsaw
--      (Fanta 62.40, Sprite 63.12 — no can invoice); Kropla PET 0,5 x12 = 17.40 (Warsaw 1.45 zł/szt x 12 — no invoice);
--      glass settings deleted.
--   D. Katowice SUPERSAM glass prices from the invoices: Fanta 58.27, Sprite 59.47, Kropla niegaz 48.96;
--      Kropla gaz 48.96 (no invoice line; same as niegaz). Coca-Cola / Zero / Cappy already match the invoices.
--   E. Kraków FORUM Pepsi: new products P193 Toma sok pomarańczowy, P194 Toma sok jabłkowy; new supplier
--      SUP_PEPSI_KRK "Pepsi (Kraków)" (portal pephub, minimum 0 — not known yet, alerts on); 8 FORUM rows;
--      thresholds from the sheet (6 updated from 0/0/0, 2 inserted). Prices: cans and Krystaliczne Źródło from the
--      existing per-unit estimates of the inactive SP_COCACOLA_P155/P163..P167 rows; Toma NULL (no source).
-- Untouched: Warsaw shared rows (incl. SP_COCACOLA_P070/P071 Kropla x24 at 34.80 vs KEN glass invoice 48.96 — open
--   question for Ben / Marek, logged in prod-applied-2026-10-19.md), Wola rolls 57
--   (P128 10/40, P130 10/80 already set), Katowice feta / majonez / olej (SUPERSAM P014 1/2, P041 0.5/1.5, P044 1/2
--   already set; thresholds are per product, the Kuchnie rows are backups), P052 / P019 (already kg x1, full_only).

-- ============================================================
-- STEP 0 — before (read-only; save the output, it is the rollback)
-- ============================================================
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base, notes
  FROM location_product_settings
 WHERE (location_id = 'SUPERSAM' AND product_id IN ('P183','P129'))
    OR (location_id = 'ELEKTROWNIA' AND product_id IN ('P079','P081'))
    OR (location_id = 'WESTFIELD' AND product_id IN ('P079','P081'))
    OR (location_id = 'SLONY' AND product_id IN ('P064','P065','P066','P067','P068','P069','P070','P071',
                                                 'P186','P187','P190','P191'))
    OR (location_id = 'FORUM' AND product_id IN ('P155','P163','P164','P165','P166','P167','P193','P194'))
 ORDER BY setting_id;                                        -- expect 2 + 2 + 1 + 12 + 6 = 23
SELECT supplier_product_id, price_estimate_pln FROM supplier_products
 WHERE supplier_product_id IN ('SP_COCACOLA_GDA_P066','SP_COCACOLA_GDA_P067','SP_COCACOLA_GDA_P070','SP_COCACOLA_GDA_P071',
                               'SP_COCACOLA_KAT_P066','SP_COCACOLA_KAT_P067','SP_COCACOLA_KAT_P070','SP_COCACOLA_KAT_P071')
 ORDER BY 1;                                                 -- expect GDA 4x NULL, KAT NULL NULL 34.80 34.80
SELECT supplier_id FROM suppliers WHERE supplier_id = 'SUP_PEPSI_KRK';                         -- expect 0 rows
SELECT product_id FROM products WHERE product_id IN ('P193','P194') OR product_name_pl ILIKE '%toma%';  -- expect 0 rows

-- ============================================================
-- STEP 1 — apply
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

-- before (b_*) and after (mn / mx) thresholds of every setting this file updates; target = max
CREATE TEMP TABLE _thr (location_id text, product_id text, b_mn numeric, b_tg numeric, b_mx numeric,
                        mn numeric, mx numeric, src text) ON COMMIT DROP;
INSERT INTO _thr VALUES
  -- A. SUPERSAM rolls
  ('SUPERSAM','P183', 0, 0, 0, 12, 30, 'jak ELEKTROWNIA/NORBLIN/WESTFIELD (Ben 19.10)'),
  ('SUPERSAM','P129', 0, 0, 0,  6, 24, 'arkusz KAT min 1 opak x6, max jak FORUM/KEN/BROWARY (Ben 19.10)'),
  -- B. Fuzetea / Kinley, one pack
  ('ELEKTROWNIA','P081', 0, 0, 0,  6, 24, 'po jednej zgrzewce (skrzynka x24), jak WOLA/KEN (Ben 19.10)'),
  ('ELEKTROWNIA','P079', 0, 0, 0,  6, 24, 'po jednej zgrzewce x24, jak WOLA/KEN (Ben 19.10)'),
  ('WESTFIELD','P081',   0, 0, 0,  6, 24, 'po jednej zgrzewce (skrzynka x24), jak WOLA/KEN (Ben 19.10)'),
  -- C. Gdańsk, sheet tab Gdańsk rows 86–93 (min/max in packs)
  ('SLONY','P068',  0,  0,  0, 24, 72, 'arkusz GDA poz. 86: 1/3 skrzynka x24'),
  ('SLONY','P069',  0,  0,  0, 24, 96, 'arkusz GDA poz. 87: 1/4 skrzynka x24'),
  ('SLONY','P067', 12, 48, 48, 12, 36, 'arkusz GDA poz. 88: 0.5/1.5 x24'),
  ('SLONY','P066', 12, 48, 48, 12, 36, 'arkusz GDA poz. 89: 0.5/1.5 x24'),
  ('SLONY','P065',  0,  0,  0,  6, 18, 'arkusz GDA poz. 90: 0.5/1.5 PET x12'),
  ('SLONY','P064',  0,  0,  0,  6, 18, 'arkusz GDA poz. 91: 0.5/1.5 PET x12'),
  ('SLONY','P070', 36, 96, 96, 18, 36, 'arkusz GDA poz. 92: 1.5/3 PET x12'),
  ('SLONY','P071', 24, 48, 48, 12, 24, 'arkusz GDA poz. 93: 1/2 PET x12'),
  -- E. Kraków Pepsi, sheet tab Kraków rows 127–132 (P193/P194 are inserted below)
  ('FORUM','P166', 0, 0, 0, 24, 120, 'arkusz KRK poz. 127: 1/5 x24'),
  ('FORUM','P167', 0, 0, 0, 48, 144, 'arkusz KRK poz. 128: 2/6 x24'),
  ('FORUM','P165', 0, 0, 0, 12,  36, 'arkusz KRK poz. 129: 0.5/1.5 x24'),
  ('FORUM','P155', 0, 0, 0, 12,  36, 'arkusz KRK poz. 130: 0.5/1.5 x24'),
  ('FORUM','P164', 0, 0, 0, 24,  72, 'arkusz KRK poz. 131: 2/6 PET x12'),
  ('FORUM','P163', 0, 0, 0, 12,  36, 'arkusz KRK poz. 132: 1/3 PET x12');

DO $$
DECLARE n int;
BEGIN
  -- ---------- guards ----------
  IF (SELECT count(*) FROM _thr) <> 19 THEN RAISE EXCEPTION '_thr: expected 19 rows'; END IF;
  IF (SELECT count(*) FROM locations WHERE location_id IN ('FORUM','SLONY','SUPERSAM') AND own_catalog) <> 3 THEN
    RAISE EXCEPTION 'FORUM/SLONY/SUPERSAM not all own_catalog — re-diff';
  END IF;
  IF (SELECT count(*) FROM _thr t JOIN location_product_settings l USING (location_id, product_id)
       WHERE l.min_stock_qty_base = t.b_mn AND l.target_stock_qty_base = t.b_tg AND l.max_stock_qty_base = t.b_mx) <> 19 THEN
    RAISE EXCEPTION 'a threshold changed since STEP 0 on 2026-10-19 — re-diff';
  END IF;
  IF (SELECT count(*) FROM location_product_settings
       WHERE location_id = 'SLONY' AND product_id IN ('P186','P187','P190','P191')
         AND min_stock_qty_base = 0 AND target_stock_qty_base = 0 AND max_stock_qty_base = 0) <> 4 THEN
    RAISE EXCEPTION 'SLONY glass settings not 4 x 0/0/0 — re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM suppliers WHERE supplier_id = 'SUP_PEPSI_KRK')
     OR EXISTS (SELECT 1 FROM supplier_products WHERE supplier_id = 'SUP_PEPSI_KRK')
     OR EXISTS (SELECT 1 FROM products WHERE product_id IN ('P193','P194') OR product_name_pl ILIKE '%toma%')
     OR EXISTS (SELECT 1 FROM location_product_settings WHERE product_id IN ('P193','P194')) THEN
    RAISE EXCEPTION 'a row this file creates already exists — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products
       WHERE supplier_product_id IN ('SP_COCACOLA_GDA_P066','SP_COCACOLA_GDA_P067','SP_COCACOLA_GDA_P070','SP_COCACOLA_GDA_P071')
         AND active AND price_estimate_pln IS NULL AND location_id = 'SLONY'
         AND units_per_purchase_unit = CASE WHEN product_id IN ('P070','P071') THEN 12 ELSE 24 END) <> 4 THEN
    RAISE EXCEPTION 'SUP_COCACOLA_GDA rows not as on 2026-10-19 — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products
       WHERE active AND location_id = 'SUPERSAM' AND units_per_purchase_unit = 24
         AND ((supplier_product_id IN ('SP_COCACOLA_KAT_P066','SP_COCACOLA_KAT_P067') AND price_estimate_pln IS NULL)
           OR (supplier_product_id IN ('SP_COCACOLA_KAT_P070','SP_COCACOLA_KAT_P071') AND price_estimate_pln = 34.80))) <> 4 THEN
    RAISE EXCEPTION 'SUP_COCACOLA_KAT rows not as on 2026-10-19 — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products
       WHERE supplier_product_id IN ('SP_COCACOLA_P155','SP_COCACOLA_P163','SP_COCACOLA_P164','SP_COCACOLA_P165',
                                     'SP_COCACOLA_P166','SP_COCACOLA_P167')
         AND NOT active AND units_per_purchase_unit = 1 AND price_estimate_pln IS NOT NULL) <> 6 THEN
    RAISE EXCEPTION 'Pepsi estimate source rows not as expected — re-diff';
  END IF;

  -- ---------- A, B, C, E: thresholds (19) ----------
  UPDATE location_product_settings l
     SET notes = coalesce(l.notes, '') || ' [2026-10-19 odpowiedzi Bena, przed ' || l.min_stock_qty_base || '/'
                 || l.target_stock_qty_base || '/' || l.max_stock_qty_base || '; ' || t.src || ']',
         min_stock_qty_base = t.mn, target_stock_qty_base = t.mx, max_stock_qty_base = t.mx
    FROM _thr t
   WHERE l.location_id = t.location_id AND l.product_id = t.product_id
     AND l.min_stock_qty_base = t.b_mn AND l.target_stock_qty_base = t.b_tg AND l.max_stock_qty_base = t.b_mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 19 THEN RAISE EXCEPTION 'thresholds: expected 19, got %', n; END IF;

  -- ---------- C. Gdańsk: glass settings out, prices ----------
  DELETE FROM location_product_settings
   WHERE location_id = 'SLONY' AND product_id IN ('P186','P187','P190','P191')
     AND min_stock_qty_base = 0 AND target_stock_qty_base = 0 AND max_stock_qty_base = 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'C glass delete: expected 4, got %', n; END IF;

  UPDATE supplier_products sp
     SET price_estimate_pln = v.price,
         notes = coalesce(sp.notes, '') || ' [2026-10-19 Ben: ceny jak w innych lokalach; ' || v.src || '; przed: NULL]'
    FROM (VALUES
      ('SP_COCACOLA_GDA_P066', 62.40, 'cena puszki jak SP_COCACOLA_P066 (Warszawa)'),
      ('SP_COCACOLA_GDA_P067', 63.12, 'cena puszki jak SP_COCACOLA_P067 (Warszawa)'),
      ('SP_COCACOLA_GDA_P070', 17.40, '1.45 zł/szt jak SP_COCACOLA_P070 (Warszawa) x12; brak faktury PET 0,5'),
      ('SP_COCACOLA_GDA_P071', 17.40, '1.45 zł/szt jak SP_COCACOLA_P071 (Warszawa) x12; brak faktury PET 0,5')
    ) AS v(id, price, src)
   WHERE sp.supplier_product_id = v.id AND sp.price_estimate_pln IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'C prices: expected 4, got %', n; END IF;

  -- ---------- D. Katowice glass prices from invoices ----------
  UPDATE supplier_products sp
     SET price_estimate_pln = v.price,
         notes = coalesce(sp.notes, '') || ' [2026-10-19 Ben: ceny z faktur; ' || v.src || '; przed: '
                 || coalesce(sp.price_estimate_pln::text, 'NULL') || ']'
    FROM (VALUES
      ('SP_COCACOLA_KAT_P066', 58.27, 'faktura Coca-Cola HBC (KEN) 2424267367 z 20.08: 0.25 RGB X24 FANTA ORANGE'),
      ('SP_COCACOLA_KAT_P067', 59.47, 'faktura Coca-Cola HBC (KEN) 2424267367 z 20.08: 0.25 RGB X24 SPRITE'),
      ('SP_COCACOLA_KAT_P070', 48.96, 'faktura Coca-Cola HBC (KEN) 2424267367 z 20.08: 0.33 NRG X24 KROPLA BESKIDU NGAZ'),
      ('SP_COCACOLA_KAT_P071', 48.96, 'brak pozycji na fakturach; przyjęto cenę niegazowanej 0.33 NRG X24')
    ) AS v(id, price, src)
   WHERE sp.supplier_product_id = v.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'D prices: expected 4, got %', n; END IF;

  -- ---------- E. Kraków Pepsi ----------
  INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical,
                        active, notes, inventory_order)
  VALUES
    ('P193', NULL, 'Toma Sok Pomarańczowy', 'Napoje', 'szt', false, true,
     'porzadek-2026-10 19.10: Pepsi Kraków (arkusz KRK poz. 133, PET 0,33 x12)', 732),
    ('P194', NULL, 'Toma Sok Jabłkowy', 'Napoje', 'szt', false, true,
     'porzadek-2026-10 19.10: Pepsi Kraków (arkusz KRK poz. 134, PET 0,33 x12)', 734);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'E products: expected 2, got %', n; END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base,
     is_critical_for_location, allow_over_max_due_to_packaging, notes, inventory_order)
  VALUES
    ('FORUM__P193', 'FORUM', 'P193', 12, 24, 24, false, false,
     '2026-10-19 odpowiedzi Bena; arkusz KRK poz. 133: 1/2 PET x12', NULL),
    ('FORUM__P194', 'FORUM', 'P194', 12, 24, 24, false, false,
     '2026-10-19 odpowiedzi Bena; arkusz KRK poz. 134: 1/2 PET x12', NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'E settings: expected 2, got %', n; END IF;

  INSERT INTO suppliers
    (supplier_id, supplier_name, email, ordering_method, delivery_days, cutoff_time, minimum_order_value_pln,
     active, notes, nip, suggestion_alerts_enabled, coverage_prompt_enabled)
  VALUES
    ('SUP_PEPSI_KRK', 'Pepsi (Kraków)', NULL, 'portal', NULL, NULL, 0.00, true,
     'porzadek-2026-10 19.10: Ben "Kraków — tak, tam jest Pepsi zamiast coli"; katalog tylko dla FORUM '
       || '(supplier_products.location_id); arkusz Kraków A125:D134; zamawianie przez portal: https://pephub.pepsico.com/; '
       || 'minimum nieznane (0 = bez progu, do potw. z Markiem); dni dostaw do potw.',
     NULL, true, false);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'E supplier: expected 1, got %', n; END IF;

  INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit,
     units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note,
     unit_weight_kg, supplier_sku, warehouse_pickup, display_order, counts_toward_minimum,
     case_unit, units_per_case, location_id, is_backup)
  SELECT 'SP_PEPSI_KRK_' || v.product_id, 'SUP_PEPSI_KRK', v.product_id, v.name, 'zgrzewka',
         v.upp, 'up_for_critical',
         CASE WHEN v.src IS NULL THEN NULL ELSE round(src.price_estimate_pln * v.upp, 2) END, true,
         'porzadek-2026-10 19.10: arkusz Kraków (Pepsi); '
           || CASE WHEN v.src IS NULL THEN 'cena: brak źródła'
                   ELSE 'cena szacunkowa: ' || src.price_estimate_pln || ' zł/szt z ' || v.src || ' x' || v.upp END,
         '1 zgrzewka = ' || v.upp || ' szt (' || v.pack || ')',
         NULL, NULL, false, v.display_order, true, NULL, NULL, 'FORUM', false
    FROM (VALUES
      ('P166', 'PEPSI CAN 1/24 330 ML',                          24, 'puszka 0,33', 10, 'SP_COCACOLA_P166'),
      ('P167', 'PEPSI ZERO CAN 1/24 330 ML',                     24, 'puszka 0,33', 20, 'SP_COCACOLA_P167'),
      ('P165', 'MIRINDA ORANGE SLEEK CAN 1/24 330 ML',           24, 'puszka 0,33', 30, 'SP_COCACOLA_P165'),
      ('P155', '7UP SLEEK CAN 1/24 330 ML',                      24, 'puszka 0,33', 40, 'SP_COCACOLA_P155'),
      ('P164', 'KRYSTALICZNE ŹRÓDŁO NIEGAZOWANA PET 1/12 500 ML', 12, 'PET 0,5',    50, 'SP_COCACOLA_P164'),
      ('P163', 'KRYSTALICZNE ŹRÓDŁO GAZOWANA PET 1/12 500 ML',    12, 'PET 0,5',    60, 'SP_COCACOLA_P163'),
      ('P193', 'TOMA SOK POMARAŃCZOWY PET 1/12 330 ML',           12, 'PET 0,33',   70, NULL),
      ('P194', 'TOMA SOK JABŁKOWY PET 1/12 330 ML',               12, 'PET 0,33',   80, NULL)
    ) AS v(product_id, name, upp, pack, display_order, src)
    LEFT JOIN supplier_products src ON src.supplier_product_id = v.src;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 8 THEN RAISE EXCEPTION 'E rows: expected 8, got %', n; END IF;
END $$;

COMMIT;

-- ============================================================
-- AUDIT
-- ============================================================
-- (a) -> 0 rows: a threshold that differs from the file
SELECT t.*, l.min_stock_qty_base, l.target_stock_qty_base, l.max_stock_qty_base
  FROM (VALUES
    ('SUPERSAM','P183',12,30),('SUPERSAM','P129',6,24),
    ('ELEKTROWNIA','P081',6,24),('ELEKTROWNIA','P079',6,24),('WESTFIELD','P081',6,24),
    ('SLONY','P068',24,72),('SLONY','P069',24,96),('SLONY','P067',12,36),('SLONY','P066',12,36),
    ('SLONY','P065',6,18),('SLONY','P064',6,18),('SLONY','P070',18,36),('SLONY','P071',12,24),
    ('FORUM','P166',24,120),('FORUM','P167',48,144),('FORUM','P165',12,36),('FORUM','P155',12,36),
    ('FORUM','P164',24,72),('FORUM','P163',12,36),('FORUM','P193',12,24),('FORUM','P194',12,24)
  ) AS t(location_id, product_id, mn, mx)
  LEFT JOIN location_product_settings l USING (location_id, product_id)
 WHERE l.setting_id IS NULL OR l.min_stock_qty_base <> t.mn OR l.target_stock_qty_base <> t.mx
    OR l.max_stock_qty_base <> t.mx;
-- (b) -> 0 rows: SLONY glass settings gone
SELECT setting_id FROM location_product_settings WHERE location_id = 'SLONY' AND product_id IN ('P186','P187','P190','P191');
-- (c) prices: GDA 62.40 / 63.12 / 17.40 / 17.40; KAT 58.27 / 59.47 / 48.96 / 48.96
SELECT supplier_product_id, units_per_purchase_unit, price_estimate_pln FROM supplier_products
 WHERE supplier_product_id IN ('SP_COCACOLA_GDA_P066','SP_COCACOLA_GDA_P067','SP_COCACOLA_GDA_P070','SP_COCACOLA_GDA_P071',
                               'SP_COCACOLA_KAT_P066','SP_COCACOLA_KAT_P067','SP_COCACOLA_KAT_P070','SP_COCACOLA_KAT_P071')
 ORDER BY 1;
-- (d) Pepsi: supplier portal / 0 / alerts on; 8 FORUM rows, cans x24 64.80 62.40 62.40 63.12, PET x12 17.40 17.40, Toma NULL
SELECT supplier_id, supplier_name, ordering_method, minimum_order_value_pln, suggestion_alerts_enabled
  FROM suppliers WHERE supplier_id = 'SUP_PEPSI_KRK';
SELECT supplier_product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, price_estimate_pln,
       order_note, location_id, display_order
  FROM supplier_products WHERE supplier_id = 'SUP_PEPSI_KRK' ORDER BY display_order;
-- Live check (no deploy): Kraków Captain -> new tab "Pepsi (Kraków)" with 8 rows; Gdańsk count list without glass;
-- Katowice Coca-Cola order shows a value for Fanta / Sprite.

-- ============================================================
-- ROLLBACK (commented out) — back to the STEP 0 state. Before-values are all in this file (_thr b_* columns,
-- the "przed" prices, SLONY glass 0/0/0). The SLONY glass settings come back with a short note; the original notes are
-- in the STEP 0 output. Text appended to notes stays (audit trail).
-- ============================================================
-- BEGIN;
-- SET LOCAL lock_timeout = '5s';
-- DO $$
-- DECLARE n int;
-- BEGIN
--   IF EXISTS (SELECT 1 FROM order_lines WHERE supplier_product_id LIKE 'SP_PEPSI_KRK_%' OR product_id IN ('P193','P194'))
--      OR EXISTS (SELECT 1 FROM receipt_lines WHERE supplier_product_id LIKE 'SP_PEPSI_KRK_%' OR product_id IN ('P193','P194'))
--      OR EXISTS (SELECT 1 FROM inventory_count_lines WHERE product_id IN ('P193','P194'))
--      OR EXISTS (SELECT 1 FROM finance_line_aliases WHERE product_id IN ('P193','P194'))
--      OR EXISTS (SELECT 1 FROM location_product_settings WHERE product_id IN ('P193','P194')
--                   AND setting_id NOT IN ('FORUM__P193','FORUM__P194'))
--      OR EXISTS (SELECT 1 FROM supplier_products WHERE product_id IN ('P193','P194') AND supplier_id <> 'SUP_PEPSI_KRK')
--      OR EXISTS (SELECT 1 FROM orders WHERE supplier_id = 'SUP_PEPSI_KRK')
--      OR EXISTS (SELECT 1 FROM receipts WHERE supplier_id = 'SUP_PEPSI_KRK')
--      OR EXISTS (SELECT 1 FROM transport_batches WHERE supplier_id = 'SUP_PEPSI_KRK')
--      OR EXISTS (SELECT 1 FROM supplier_delivery_rules WHERE supplier_id = 'SUP_PEPSI_KRK') THEN
--     RAISE EXCEPTION 'new rows already referenced — roll back by hand';
--   END IF;
--   DELETE FROM supplier_products WHERE supplier_id = 'SUP_PEPSI_KRK';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 8 THEN RAISE EXCEPTION 'Pepsi rows: got %', n; END IF;
--   DELETE FROM suppliers WHERE supplier_id = 'SUP_PEPSI_KRK';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Pepsi supplier: got %', n; END IF;
--   DELETE FROM location_product_settings WHERE setting_id IN ('FORUM__P193','FORUM__P194');
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 2 THEN RAISE EXCEPTION 'Toma settings: got %', n; END IF;
--   DELETE FROM products WHERE product_id IN ('P193','P194');
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 2 THEN RAISE EXCEPTION 'Toma products: got %', n; END IF;
--   INSERT INTO location_product_settings
--     (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base,
--      is_critical_for_location, allow_over_max_due_to_packaging, notes, inventory_order)
--   SELECT 'SLONY__' || v.p, 'SLONY', v.p, 0, 0, 0, false, false, v.note, NULL
--     FROM (VALUES
--       ('P186', '2026-10-16 arkusz GDA (nowy wiersz); Coca-Cola Gdańsk poz. 86: arkusz 1/4 Skrzynka -> 24/96 (x24) [2026-10-19 przed 24.0000/96.0000/96.0000; Gdańsk nie kupuje szkła]'),
--       ('P187', '2026-10-16 arkusz GDA (nowy wiersz); Coca-Cola Gdańsk poz. 87: arkusz 1/5 Skrzynka -> 24/120 (x24) [2026-10-19 przed 24.0000/120.0000/120.0000; Gdańsk nie kupuje szkła]'),
--       ('P190', '2026-10-16 arkusz GDA (nowy wiersz); Coca-Cola Gdańsk poz. 91: arkusz 0.5/1.5 Skrzynka -> 12/48 (x24) [2026-10-19 przed 12.0000/48.0000/48.0000; Gdańsk nie kupuje szkła]'),
--       ('P191', '2026-10-16 arkusz GDA (nowy wiersz); Coca-Cola Gdańsk poz. 90: arkusz 0.5/1.5 Skrzynka -> 12/48 (x24) [2026-10-19 przed 12.0000/48.0000/48.0000; Gdańsk nie kupuje szkła]')
--     ) AS v(p, note);
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 4 THEN RAISE EXCEPTION 'glass settings: got %', n; END IF;
--   UPDATE supplier_products SET price_estimate_pln = NULL
--    WHERE supplier_product_id IN ('SP_COCACOLA_GDA_P066','SP_COCACOLA_GDA_P067','SP_COCACOLA_GDA_P070',
--                                  'SP_COCACOLA_GDA_P071','SP_COCACOLA_KAT_P066','SP_COCACOLA_KAT_P067');
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 6 THEN RAISE EXCEPTION 'prices to NULL: got %', n; END IF;
--   UPDATE supplier_products SET price_estimate_pln = 34.80
--    WHERE supplier_product_id IN ('SP_COCACOLA_KAT_P070','SP_COCACOLA_KAT_P071');
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 2 THEN RAISE EXCEPTION 'KAT Kropla: got %', n; END IF;
--   UPDATE location_product_settings l
--      SET min_stock_qty_base = v.mn, target_stock_qty_base = v.tg, max_stock_qty_base = v.mx
--     FROM (VALUES ('SUPERSAM','P183',0,0,0),('SUPERSAM','P129',0,0,0),('ELEKTROWNIA','P081',0,0,0),
--                  ('ELEKTROWNIA','P079',0,0,0),('WESTFIELD','P081',0,0,0),('SLONY','P068',0,0,0),('SLONY','P069',0,0,0),
--                  ('SLONY','P067',12,48,48),('SLONY','P066',12,48,48),('SLONY','P065',0,0,0),('SLONY','P064',0,0,0),
--                  ('SLONY','P070',36,96,96),('SLONY','P071',24,48,48),('FORUM','P166',0,0,0),('FORUM','P167',0,0,0),
--                  ('FORUM','P165',0,0,0),('FORUM','P155',0,0,0),('FORUM','P164',0,0,0),('FORUM','P163',0,0,0)
--          ) AS v(location_id, product_id, mn, tg, mx)
--    WHERE l.location_id = v.location_id AND l.product_id = v.product_id;
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 19 THEN RAISE EXCEPTION 'thresholds back: got %', n; END IF;
-- END $$;
-- COMMIT;
