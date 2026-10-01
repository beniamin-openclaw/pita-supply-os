-- =====================================================================
-- feedback-1001-names-units — Phase 1: prod master-data batch
-- Project: Supabase lpzhphufjwrndfogkfub
--
-- PREPARED 2026-10-01, NOT RUN ON PROD. Before-state read from prod with
-- SELECT only on 2026-10-01 (~16:30 CEST). Human-readable diff:
-- prod-sql-1-diff.md. Run nothing until the operator approves that diff.
--
-- Pattern (lessons.md "Master-data ops: diff before, audit after"):
--   STEP 0  read-only SELECTs; save the output as the "before" record
--           (it is the rollback source together with STEP R below)
--   STEP 1  one guarded DO block per step. Each block re-checks the exact
--           before-state of every row it touches and asserts row counts;
--           any mismatch raises, and the block rolls back on its own.
--   STEP 2  read-only audit; every row must show ok = true
--   STEP R  rollback (commented out), built from the STEP 0 values
--
-- HOW TO RUN: one block per execution (one execute_sql call / one SQL
-- editor run), in the order below. Each DO block is its own transaction,
-- so a block that raises changes nothing and the next block can still run.
--   * 1.5  is HELD: run only after the operator confirms the staff message
--          (gyros nieścięty) has been sent.
--   * 1.11d (KEN Cappy) is BLOCKED today by the claimed order
--          ORD-20260930-KEN-COCA-b8acbc (P065 line). Re-run when that order
--          has left captain_submitted / manager_claimed.
--   * 1.11b..g need 1.11a first.
--   * 1.11h (P064/P065 renamed "… 0,33 l PET") runs LAST, only after all
--          six glass locations have switched (1.11b..g, KEN included). It is
--          therefore blocked as long as 1.11d is. Until then P064/P065 keep
--          their generic names, so the Coca-Cola portal copy list for a glass
--          location never says "PET" (review 2026-10-01).
--
-- Scope: the 7 active locations (WOLA, BRACKA, KEN, BROWARY, NORBLIN,
-- ELEKTROWNIA, WESTFIELD). Rows of the 6 inactive locations are untouched.
-- Target = max unless the step says otherwise (D17, D18).
-- Moved out of this file on purpose: papryka P017 (name, unit, Helcom row)
-- and the Prymat spice units/prices -> prod-sql-1b.sql (Phase 1b).
--
-- Dry run: see prod-sql-1-diff.md, section "Dry run".
-- =====================================================================


-- =====================================================================
-- STEP 0 — DIFF BEFORE (read-only). Save every result set.
-- =====================================================================

-- 0.1 products touched by 1.1, 1.5, 1.6, 1.11a, 1.11h
SELECT product_id, product_name_pl, inventory_unit, is_critical, active
  FROM products
 WHERE product_id IN ('P012','P013','P015','P021','P022','P023','P038','P040','P043','P044',
                      'P046','P050','P051','P052','P053','P054','P055','P084','P085','P094',
                      'P095','P121','P140','P141','P189','P139','P177','P185',
                      'P064','P065','P186','P187','P190','P191')
 ORDER BY product_id;

-- 0.2 supplier_products touched by 1.1, 1.3, 1.4, 1.7, 1.8, 1.11a, 1.11h
SELECT supplier_product_id, product_id, supplier_product_name, purchase_unit,
       units_per_purchase_unit::float8 AS upp, rounding_rule,
       price_estimate_pln::float8 AS price, active, order_note
  FROM supplier_products
 WHERE supplier_product_id IN (
   'SP_INTERMLECZ_P001','SP_INTERMLECZ_P013','SP_INTERMLECZ_P015','SP_INTERMLECZ_P021',
   'SP_INTERMLECZ_P022','SP_INTERMLECZ_P023','SP_INTERMLECZ_P038','SP_INTERMLECZ_P040',
   'SP_INTERMLECZ_P041','SP_INTERMLECZ_P042','SP_INTERMLECZ_P043','SP_INTERMLECZ_P044',
   'SP_INTERMLECZ_P045','SP_INTERMLECZ_P046','SP_INTERMLECZ_P047','SP_INTERMLECZ_P048',
   'SP_INTERMLECZ_P049','SP_INTERMLECZ_P050','SP_INTERMLECZ_P051','SP_INTERMLECZ_P052',
   'SP_INTERMLECZ_P053','SP_INTERMLECZ_P054','SP_INTERMLECZ_P055','SP_INTERMLECZ_P189',
   'SP_BLUESERV_P084','SP_BLUESERV_P085','SP_BLUESERV_P094','SP_BLUESERV_P095',
   'SP_PAGO_P024','SP_PAGO_P025','SP_SPEC_P179',
   'SP_COCACOLA_P064','SP_COCACOLA_P065','SP_COCACOLA_P186','SP_COCACOLA_P190','SP_COCACOLA_P191')
 ORDER BY supplier_product_id;

-- 0.3 thresholds touched by 1.2, 1.3, 1.9, 1.10, 1.11 (active locations)
SELECT s.setting_id, s.location_id, s.product_id,
       s.min_stock_qty_base::float8 AS mn, s.target_stock_qty_base::float8 AS tg,
       s.max_stock_qty_base::float8 AS mx, s.is_critical_for_location AS crit,
       s.allow_over_max_due_to_packaging AS aomp, s.notes
  FROM location_product_settings s
  JOIN locations l USING (location_id)
 WHERE l.active
   AND s.product_id IN ('P013','P054','P129','P183','P064','P065','P068','P069',
                        'P186','P187','P190','P191')
 ORDER BY s.product_id, s.location_id;

-- 0.4 open order lines on touched products (information + delete guards).
--     open = captain_submitted / manager_claimed, or manager_sent without a receipt
SELECT o.status, o.location_id, o.order_id, ol.product_id, ol.supplier_product_id,
       ol.captain_final_qty_purchase::float8 AS cap, ol.manager_final_qty_purchase::float8 AS mgr,
       (SELECT count(*) FROM receipts r WHERE r.order_id = o.order_id) AS receipts
  FROM orders o JOIN order_lines ol USING (order_id)
 WHERE o.status IN ('captain_submitted','manager_claimed','manager_sent')
   AND ol.product_id IN ('P021','P022','P024','P025','P179','P064','P065','P068','P069',
                         'P129','P183','P139','P177','P185')
 ORDER BY o.status, o.location_id, o.order_id, ol.product_id;

-- 0.5 delete-guard preview (1.10a, 1.10c, 1.11b..g): blocked = true means the
--     block for that location will raise today.
SELECT v.step, v.loc,
       (SELECT count(*) FROM orders o JOIN order_lines ol USING (order_id)
         WHERE o.location_id = v.loc AND o.status IN ('captain_submitted','manager_claimed')
           AND ol.product_id = ANY (v.pids)) > 0 AS blocked
  FROM (VALUES ('1.10a', 'ELEKTROWNIA', ARRAY['P068','P069']),
               ('1.10c', 'BROWARY',     ARRAY['P068','P069']),
               ('1.11b', 'WOLA',        ARRAY['P064','P065']),
               ('1.11c', 'BRACKA',      ARRAY['P064','P065']),
               ('1.11d', 'KEN',         ARRAY['P064','P065']),
               ('1.11e', 'WESTFIELD',   ARRAY['P064','P065']),
               ('1.11f', 'ELEKTROWNIA', ARRAY['P064','P065']),
               ('1.11g', 'BROWARY',     ARRAY['P064','P065'])) AS v(step, loc, pids)
 ORDER BY v.step;


-- =====================================================================
-- STEP 1 — APPLY (one block per execution)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1.1 Names, batch N1 (names.md, D1, D20, D28). Screen name
--     (products.product_name_pl) and supplier name
--     (supplier_products.supplier_product_name, printed in supplier
--     e-mails). Guarded on the current name. P017 is in Phase 1b.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE products p SET product_name_pl = v.new_name
    FROM (VALUES
      ('P012','Hot Feta 2kg','Tirokafteri 2kg'),
      ('P013','Oliwki kalamata','Oliwki kalamata 2kg Bidon'),
      ('P015','Halloumi','Halloumi Reha 200gr'),
      ('P021','Frytki Aviko (opakowania)','Frytki Aviko Super Crunch 9,5mm 2,5kg'),
      ('P022','Frytki z batatów (opakowania)','Frytki z batatów Aviko 2,27kg'),
      ('P023','Fasolka Szparagowa (op.)','Fasolka Szparagowa mrożona 2,5kg'),
      ('P038','Frytura Eppo 15L','Frytura Effo 15L'),
      ('P040','Woda 5l pracownicza','Woda 5L'),
      ('P043','DEVELEY MUSZTARDA 3 kg','Develey Musztarda 3 kg'),
      ('P044','FANEX MAJONEZ 4kg','Fanex Majonez 4kg'),
      ('P046','CIECIORKA','Cieciorka w zalewie 400g/240g'),
      ('P050','Pieprz','Prymat Pieprz czarny mielony 820g'),
      ('P051','Oregano','Prymat Oregano 110g'),
      ('P052','Papryka słodka - mielona','Prymat Papryka słodka mielona 720g'),
      ('P053','Sól 1kg','Sól kamienna 1kg'),
      ('P054','Liść Laurowy','Prymat Liść Laurowy 80g'),
      ('P055','Ziele Angielskie','Prymat Ziele angielskie 600g'),
      ('P084','Opakowaie sałatki duże jednocześciowe 750ml','Opakowanie sałatki duże jednoczęściowe 750ml'),
      ('P085','Opakowanie sałatki małe jednocześciowe 250ml','Opakowanie sałatki małe jednoczęściowe 250ml'),
      ('P094','Torby fałdowane pojedycze do pity','Torby fałdowane pojedyncze do pity'),
      ('P095','Folia Alumiuniowa','Folia Aluminiowa'),
      ('P121','Gąbka do naczyń','Gąbka do naczyń 10szt'),
      ('P140','KAWA JACOBS CRONAT GOLD ROZPUSZCZALNA 200g/6','Kawa Jacobs Cronat Gold Rozpuszczalna 200gr'),
      ('P141','LIPTON HERBATA YELLOW LABEL 100szt./12 koperta','Herbata Lipton Yellow Label 100szt'),
      ('P189','Cukier w kostkach Diament 1kg','Cukier w kostkach Diamant 0,5kg')
    ) AS v(pid, old_name, new_name)
   WHERE p.product_id = v.pid AND p.product_name_pl = v.old_name;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 25 THEN RAISE EXCEPTION '1.1 products: expected 25 renames, got % — before-state changed', n; END IF;

  UPDATE supplier_products sp SET supplier_product_name = v.new_name
    FROM (VALUES
      ('SP_INTERMLECZ_P001','Masło MR 500g','KRUSZWICA MASŁO ROŚLINNE 500g/12 kubek'),
      ('SP_INTERMLECZ_P013','Oliwki kalamata','GREEK OLIWKI KALAMATA Z PESTKĄ 2kg/6 BIDON'),
      ('SP_INTERMLECZ_P015','Halloumi','EURIAL REHA HALLOUMI SER DO GRILLOWANIA 200g/12'),
      ('SP_INTERMLECZ_P021','Frytki Aviko (opakowania)','AVIKO FRYTKI SUPER CRUNCH 9,5mm 2,5kg/4'),
      ('SP_INTERMLECZ_P022','Frytki z batatów (opakowania)','AVIKO FRYTKI Z BATATÓW 9,5mm 2,27kg/5'),
      ('SP_INTERMLECZ_P023','Fasolka Szparagowa (op.)','IMF FASOLKA SZPARAGOWA ZIELONA CIĘTA 2,5kg/4'),
      ('SP_INTERMLECZ_P038','Frytura Eppo 15L','EFFO DEEP FRY FRYTURA ROŚLINNA 15L BIB'),
      ('SP_INTERMLECZ_P040','Woda 5l pracownicza','KURACJUSZ WODA NIEGAZOWANA 5L'),
      ('SP_INTERMLECZ_P041','Olej Rzepakowy 5 L','OLEJ UNIWERSALNY RZEPAKOWY 5L (4)'),
      ('SP_INTERMLECZ_P042','Ketchup Fanex VII 1,1 kg','FANEX KETCHUP VII 1,1kg/4 PREMIUM'),
      ('SP_INTERMLECZ_P043','DEVELEY MUSZTARDA 3 kg','Develey Musztarda 3 kg'),
      ('SP_INTERMLECZ_P044','FANEX MAJONEZ 4kg','FANEX MAJONEZ 4kg SAŁATKOWY WYŚMIENITY'),
      ('SP_INTERMLECZ_P045','Oliwa z Oliwek 1L','GREEK OLIWA Z OLIWEK POMACE HELCOM 1L/15 plastik'),
      ('SP_INTERMLECZ_P046','CIECIORKA','ROLNIK CIECIORKA W ZALEWIE 400g/240g (12) puszka'),
      ('SP_INTERMLECZ_P047','Kasza Pęczak Melvit 900g','MELVIT KASZA PĘCZAK 900g/10'),
      ('SP_INTERMLECZ_P048','Sriracha chili 730 ml','ASIA SOS SRIRACHA CHILI PIKANTNY FG 730ml/12'),
      ('SP_INTERMLECZ_P049','Miód 1 kg','CD MIÓD WIELOKWIATOWY 1kg/6'),
      ('SP_INTERMLECZ_P050','Pieprz','PRYMAT PIEPRZ CZARNY MIELONY 820g/9 pet'),
      ('SP_INTERMLECZ_P051','Oregano','PRYMAT OREGANO 110g/6 pet'),
      ('SP_INTERMLECZ_P052','Papryka słodka - mielona','PRYMAT PAPRYKA SŁODKA 720g/9 pet'),
      ('SP_INTERMLECZ_P053','Sól 1kg','Sól kamienna 1kg'),
      ('SP_INTERMLECZ_P054','Liść Laurowy 80g','PRYMAT LIŚĆ LAUROWY 80g/10 pudełko'),
      ('SP_INTERMLECZ_P055','Ziele Angielskie 500g','PRYMAT ZIELE ANGIELSKIE 600g/9 pet'),
      ('SP_INTERMLECZ_P189','Cukier w kostkach Diament 1 kg','DIAMANT CUKIER KOSTKA BIAŁY 0,5kg/10'),
      ('SP_BLUESERV_P084','Opakowaie sałatki duże jednocześciowe 750ml','Opakowanie sałatki duże jednoczęściowe 750ml'),
      ('SP_BLUESERV_P085','Opakowanie sałatki małe jednocześciowe 250ml','Opakowanie sałatki małe jednoczęściowe 250ml'),
      ('SP_BLUESERV_P094','Torby fałdowane pojedycze do pity','Torby fałdowane pojedyncze do pity'),
      ('SP_BLUESERV_P095','Folia Alumiuniowa','Folia Aluminiowa')
    ) AS v(spid, old_name, new_name)
   WHERE sp.supplier_product_id = v.spid AND sp.supplier_product_name = v.old_name
     AND sp.active;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 28 THEN RAISE EXCEPTION '1.1 supplier_products: expected 28 renames, got % — before-state changed', n; END IF;

  -- Ziele: Prymat 600 g replaces Kamis 500 g (D28); the per-pack note follows.
  UPDATE supplier_products SET order_note = '1 opak = 600 g'
   WHERE supplier_product_id = 'SP_INTERMLECZ_P055' AND order_note = '1 opak = 500 g';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1.1 P055 order_note: expected 1 row, got %', n; END IF;

  RAISE NOTICE '1.1 applied: 25 product names, 28 supplier names, 1 order_note';
END $$;

-- ---------------------------------------------------------------------
-- 1.2 Oliwki P013 — min 1 / target 1 / max 2 kg at the 7 active
--     locations (D17: target 1 on purpose, below max).
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE location_product_settings s
     SET notes = s.notes || format(' [2026-10-01 feedback-1001 1.2 D17, przed %s/%s/%s]',
                                   s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                                   s.max_stock_qty_base::float8),
         min_stock_qty_base = 1, target_stock_qty_base = 1, max_stock_qty_base = 2
    FROM (VALUES ('WOLA',0.5,1.5,1.5), ('BRACKA',0.5,1.5,1.5), ('KEN',0.5,2,2),
                 ('BROWARY',1,3.3,3.3), ('NORBLIN',1,3,3), ('ELEKTROWNIA',1,3,3),
                 ('WESTFIELD',1,3,3)) AS v(loc, mn, tg, mx)
   WHERE s.location_id = v.loc AND s.product_id = 'P013'
     AND s.min_stock_qty_base = v.mn AND s.target_stock_qty_base = v.tg
     AND s.max_stock_qty_base = v.mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 7 THEN RAISE EXCEPTION '1.2 P013: expected 7 rows, got % — before-state changed', n; END IF;
  RAISE NOTICE '1.2 applied: P013 1/1/2 at 7 locations';
END $$;

-- ---------------------------------------------------------------------
-- 1.3 Liść laurowy P054 — min 0 / target 0 / max 1 opak at the 7 active
--     locations (D18: target 0, ordered by hand when empty); price per
--     the Prymat invoice 14,70 zł netto per 80 g box (D28).
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE location_product_settings s
     SET notes = s.notes || format(' [2026-10-01 feedback-1001 1.3 D18, przed %s/%s/%s]',
                                   s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                                   s.max_stock_qty_base::float8),
         min_stock_qty_base = 0, target_stock_qty_base = 0, max_stock_qty_base = 1
    FROM (VALUES ('WOLA',1,1,1), ('BRACKA',0.5,1.5,1.5), ('KEN',0.1,0.5,0.5),
                 ('BROWARY',0.02,0.08,0.08), ('NORBLIN',0.5,1.5,1.5),
                 ('ELEKTROWNIA',0.5,1.5,1.5), ('WESTFIELD',0.5,1.5,1.5)) AS v(loc, mn, tg, mx)
   WHERE s.location_id = v.loc AND s.product_id = 'P054'
     AND s.min_stock_qty_base = v.mn AND s.target_stock_qty_base = v.tg
     AND s.max_stock_qty_base = v.mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 7 THEN RAISE EXCEPTION '1.3 P054 thresholds: expected 7 rows, got %', n; END IF;

  UPDATE supplier_products SET price_estimate_pln = 14.70
   WHERE supplier_product_id = 'SP_INTERMLECZ_P054' AND price_estimate_pln = 13.67
     AND purchase_unit = 'opak' AND units_per_purchase_unit = 1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1.3 P054 price: expected 1 row at 13.67, got %', n; END IF;
  RAISE NOTICE '1.3 applied: P054 0/0/1 at 7 locations, price 14.70';
END $$;

-- ---------------------------------------------------------------------
-- 1.4 Gyros unit blok -> szt (D9). Label only: units_per_purchase_unit
--     stays 15/25/15, so every past and open line keeps its meaning.
--     No open-order guard (plan-review F3); open lines are listed in the diff.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE supplier_products sp SET purchase_unit = 'szt'
    FROM (VALUES ('SP_PAGO_P024',15), ('SP_PAGO_P025',25), ('SP_SPEC_P179',15)) AS v(spid, upp)
   WHERE sp.supplier_product_id = v.spid AND sp.purchase_unit = 'blok'
     AND sp.units_per_purchase_unit = v.upp;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION '1.4 gyros: expected 3 rows in blok, got %', n; END IF;
  RAISE NOTICE '1.4 applied: 3 gyros rows blok -> szt';
END $$;

-- ---------------------------------------------------------------------
-- 1.5 [HELD — separately runnable] Gyros nieścięty off (D8):
--     products.active = false for P177 (pork) and P185 (chicken).
--     RUN ONLY AFTER the operator confirms the staff message was sent.
--     Setting rows and inventory history are kept on purpose.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE products SET active = false
   WHERE product_id IN ('P177','P185') AND active
     AND product_name_pl IN ('Gyros wieprzowy nieścięty','Gyros kurczak nieścięty');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.5 gyros nieścięty: expected 2 active rows, got %', n; END IF;
  RAISE NOTICE '1.5 applied: P177, P185 inactive';
END $$;

-- ---------------------------------------------------------------------
-- 1.6 Miód saszetki P139 off everywhere, WOLA included (D19).
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE ol.product_id = 'P139' AND o.status IN ('captain_submitted','manager_claimed');
  IF n > 0 THEN RAISE EXCEPTION '1.6 P139: % open line(s) — wait until they leave the queue', n; END IF;

  UPDATE products SET active = false
   WHERE product_id = 'P139' AND active
     AND product_name_pl = 'AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1.6 P139: expected 1 active row, got %', n; END IF;
  RAISE NOTICE '1.6 applied: P139 inactive';
END $$;

-- ---------------------------------------------------------------------
-- 1.7 Cukier w kostkach P189 — price 4,08 zł netto (D20).
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE supplier_products SET price_estimate_pln = 4.08
   WHERE supplier_product_id = 'SP_INTERMLECZ_P189' AND price_estimate_pln IS NULL
     AND purchase_unit = 'opak' AND units_per_purchase_unit = 1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1.7 P189: expected 1 row without price, got %', n; END IF;
  RAISE NOTICE '1.7 applied: P189 price 4.08';
END $$;

-- ---------------------------------------------------------------------
-- 1.8 Frytki (D21): SP_INTERMLECZ_P021 opak -> paczka (label only, upp
--     stays 1), price 18,86 (KEN invoice), note names bag and carton.
--     Frytki z batatów SP_INTERMLECZ_P022 is opak today, so it is
--     relabelled to paczka too (price unchanged). No open-order guard
--     (label only, plan-review F3).
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE supplier_products
     SET purchase_unit = 'paczka', price_estimate_pln = 18.86,
         order_note = '1 paczka = 2,5 kg; karton = 4 paczki'
   WHERE supplier_product_id = 'SP_INTERMLECZ_P021' AND purchase_unit = 'opak'
     AND units_per_purchase_unit = 1 AND price_estimate_pln = 22.55
     AND order_note = '1 opak = worek 2,5 kg';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1.8 P021: expected 1 row in opak/22.55, got %', n; END IF;

  UPDATE supplier_products
     SET purchase_unit = 'paczka', order_note = '1 paczka = 2,27 kg'
   WHERE supplier_product_id = 'SP_INTERMLECZ_P022' AND purchase_unit = 'opak'
     AND units_per_purchase_unit = 1 AND order_note = '1 opak = worek 2,27 kg';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1.8 P022: expected 1 row in opak, got %', n; END IF;
  RAISE NOTICE '1.8 applied: P021 + P022 paczka, P021 price 18.86';
END $$;

-- ---------------------------------------------------------------------
-- 1.9 Rolls (D24, Sławek's table) at NORBLIN, ELEKTROWNIA, WESTFIELD:
--     P183 80/20 min 12 / max 30 rolls, P129 80/80 min 12 / max 24 rolls.
--     All 6 rows exist on prod (read 2026-10-01), so nothing is created.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE location_product_settings s
     SET notes = s.notes || format(' [2026-10-01 feedback-1001 1.9 D24, przed %s/%s/%s]',
                                   s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                                   s.max_stock_qty_base::float8),
         min_stock_qty_base = v.new_mn, target_stock_qty_base = v.new_mx,
         max_stock_qty_base = v.new_mx
    FROM (VALUES ('NORBLIN','P183',5,40,40,12,30), ('ELEKTROWNIA','P183',0,0,0,12,30),
                 ('WESTFIELD','P183',0,0,0,12,30), ('NORBLIN','P129',3,20,20,12,24),
                 ('ELEKTROWNIA','P129',0,0,0,12,24), ('WESTFIELD','P129',0,0,0,12,24))
         AS v(loc, pid, mn, tg, mx, new_mn, new_mx)
   WHERE s.location_id = v.loc AND s.product_id = v.pid
     AND s.min_stock_qty_base = v.mn AND s.target_stock_qty_base = v.tg
     AND s.max_stock_qty_base = v.mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 6 THEN RAISE EXCEPTION '1.9 rolls: expected 6 rows, got % — a row is missing or changed', n; END IF;
  RAISE NOTICE '1.9 applied: rolls at NORBLIN/ELEKTROWNIA/WESTFIELD';
END $$;

-- ---------------------------------------------------------------------
-- 1.10a ELEKTROWNIA Coca-Cola -> glass (D25): P186 48/120, P187 72/144
--       (target = max, whole crates of 24); flags copied from the can
--       rows; can rows P068/P069 deleted. Guarded on open lines.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE o.location_id = 'ELEKTROWNIA' AND o.status IN ('captain_submitted','manager_claimed')
     AND ol.product_id IN ('P068','P069');
  IF n > 0 THEN RAISE EXCEPTION '1.10a ELEKTROWNIA: % open can line(s) — retry when the queue is clear', n; END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = 'ELEKTROWNIA' AND product_id IN ('P186','P187')) THEN
    RAISE EXCEPTION '1.10a ELEKTROWNIA glass rows already exist';
  END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT 'ELEKTROWNIA__' || v.glass, 'ELEKTROWNIA', v.glass, v.new_mn, v.new_mx, v.new_mx,
         s.is_critical_for_location, s.allow_over_max_due_to_packaging,
         format('2026-10-01 feedback-1001 1.10 D25: szkło 0,25 l; z %s %s/%s/%s, zaokr. do skrzynek 24',
                v.can, s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                s.max_stock_qty_base::float8)
    FROM location_product_settings s
    JOIN (VALUES ('P068','P186',50,120,120,48,120), ('P069','P187',70,150,150,72,144))
         AS v(can, glass, mn, tg, mx, new_mn, new_mx)
      ON s.product_id = v.can AND s.min_stock_qty_base = v.mn
     AND s.target_stock_qty_base = v.tg AND s.max_stock_qty_base = v.mx
   WHERE s.location_id = 'ELEKTROWNIA';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.10a ELEKTROWNIA glass insert: expected 2, got % — can rows changed', n; END IF;

  DELETE FROM location_product_settings
   WHERE location_id = 'ELEKTROWNIA' AND product_id IN ('P068','P069');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.10a ELEKTROWNIA can delete: expected 2, got %', n; END IF;
  RAISE NOTICE '1.10a applied: ELEKTROWNIA Coca-Cola in glass';
END $$;

-- ---------------------------------------------------------------------
-- 1.10b WESTFIELD Coca-Cola glass re-rounded to whole crates (D25):
--       P186 50/100 -> 48/96, P187 70/130 -> 72/120.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE location_product_settings s
     SET notes = s.notes || format(' [2026-10-01 feedback-1001 1.10 D25, przed %s/%s/%s]',
                                   s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                                   s.max_stock_qty_base::float8),
         min_stock_qty_base = v.new_mn, target_stock_qty_base = v.new_mx,
         max_stock_qty_base = v.new_mx
    FROM (VALUES ('P186',50,100,100,48,96), ('P187',70,130,130,72,120))
         AS v(pid, mn, tg, mx, new_mn, new_mx)
   WHERE s.location_id = 'WESTFIELD' AND s.product_id = v.pid
     AND s.min_stock_qty_base = v.mn AND s.target_stock_qty_base = v.tg
     AND s.max_stock_qty_base = v.mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.10b WESTFIELD: expected 2 rows, got %', n; END IF;
  RAISE NOTICE '1.10b applied: WESTFIELD glass re-rounded';
END $$;

-- ---------------------------------------------------------------------
-- 1.10c BROWARY Coca-Cola -> glass (D31): P186 24/72, P187 48/96 (the
--       can thresholds, already whole crates); can rows deleted.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE o.location_id = 'BROWARY' AND o.status IN ('captain_submitted','manager_claimed')
     AND ol.product_id IN ('P068','P069');
  IF n > 0 THEN RAISE EXCEPTION '1.10c BROWARY: % open can line(s) — retry when the queue is clear', n; END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = 'BROWARY' AND product_id IN ('P186','P187')) THEN
    RAISE EXCEPTION '1.10c BROWARY glass rows already exist';
  END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT 'BROWARY__' || v.glass, 'BROWARY', v.glass, v.mn, v.mx, v.mx,
         s.is_critical_for_location, s.allow_over_max_due_to_packaging,
         format('2026-10-01 feedback-1001 1.10 D31: szkło 0,25 l; progi przeniesione z %s', v.can)
    FROM location_product_settings s
    JOIN (VALUES ('P068','P186',24,72,72), ('P069','P187',48,96,96)) AS v(can, glass, mn, tg, mx)
      ON s.product_id = v.can AND s.min_stock_qty_base = v.mn
     AND s.target_stock_qty_base = v.tg AND s.max_stock_qty_base = v.mx
   WHERE s.location_id = 'BROWARY';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.10c BROWARY glass insert: expected 2, got % — can rows changed', n; END IF;

  DELETE FROM location_product_settings
   WHERE location_id = 'BROWARY' AND product_id IN ('P068','P069');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.10c BROWARY can delete: expected 2, got %', n; END IF;
  RAISE NOTICE '1.10c applied: BROWARY Coca-Cola in glass';
END $$;

-- ---------------------------------------------------------------------
-- 1.11a Cappy glass products (D26). New IDs P190/P191 (prod max is P189).
--       Copied from P186 / SP_COCACOLA_P186: category, rounding_rule,
--       counts_toward_minimum, purchase unit skrzynka x 24, order_note.
--       is_critical = false (same as Cappy PET P064/P065, not Coca-Cola —
--       see prod-sql-1-diff.md). Price 100,32 zł netto per crate (KEN
--       invoice). inventory_order / display_order stay NULL: no Coca-Cola
--       product and no product at all has a position on prod today.
--       The P064/P065 "… 0,33 l PET" rename moved to 1.11h (runs last).
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  IF EXISTS (SELECT 1 FROM products WHERE product_id IN ('P190','P191'))
     OR EXISTS (SELECT 1 FROM supplier_products
                 WHERE product_id IN ('P190','P191')
                    OR supplier_product_id IN ('SP_COCACOLA_P190','SP_COCACOLA_P191')) THEN
    RAISE EXCEPTION '1.11a P190/P191 already taken — re-read the next free product ids';
  END IF;
  IF (SELECT count(*) FROM supplier_products
       WHERE supplier_product_id = 'SP_COCACOLA_P186' AND purchase_unit = 'skrzynka'
         AND units_per_purchase_unit = 24 AND rounding_rule = 'up_for_critical') <> 1 THEN
    RAISE EXCEPTION '1.11a SP_COCACOLA_P186 not in the expected shape';
  END IF;

  INSERT INTO products (product_id, gostock_id, product_name_pl, product_category,
                        inventory_unit, is_critical, active, notes, inventory_order)
  SELECT v.pid, NULL, v.name, p.product_category, 'szt', false, true,
         '2026-10-01 feedback-1001 1.11 D26: Cappy szkło 0,25 l, skrzynka 24 (faktura KEN "0.25 RGB X24 CAPPY ' || v.inv || '")',
         NULL
    FROM products p
    CROSS JOIN (VALUES ('P190','Cappy Jabłko 0,25 l szkło','APPLE'),
                       ('P191','Cappy Pomarańcza 0,25 l szkło','ORANGE')) AS v(pid, name, inv)
   WHERE p.product_id = 'P186';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11a products insert: expected 2, got %', n; END IF;

  INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id,
      supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule,
      price_estimate_pln, active, notes, order_note, unit_weight_kg, supplier_sku,
      warehouse_pickup, display_order, counts_toward_minimum)
  SELECT 'SP_COCACOLA_' || v.pid, 'SUP_COCACOLA', v.pid, v.name, 'skrzynka', 24,
         sp.rounding_rule, 100.32, true,
         '2026-10-01 feedback-1001 1.11 D26: cena z faktury KEN (100,32 zł netto / skrzynka)',
         sp.order_note, NULL, NULL, false, NULL, sp.counts_toward_minimum
    FROM supplier_products sp
    CROSS JOIN (VALUES ('P190','Cappy Jabłko 0,25 l szkło'),
                       ('P191','Cappy Pomarańcza 0,25 l szkło')) AS v(pid, name)
   WHERE sp.supplier_product_id = 'SP_COCACOLA_P186';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11a supplier_products insert: expected 2, got %', n; END IF;
  RAISE NOTICE '1.11a applied: P190/P191 created (PET rename waits for 1.11h)';
END $$;

-- ---------------------------------------------------------------------
-- 1.11b..g Cappy per location: glass rows P190/P191 in, PET rows
--       P064/P065 out. min = PET min, target = max = PET max rounded to a
--       whole crate of 24 (never 0); flags copied from the PET row.
--       Guarded on open PET lines AT THAT LOCATION, one block per
--       location so a blocked location does not hold the others.
--       NORBLIN keeps PET (no block).
--       v_max is the operator's choice where the rounding is ambiguous
--       (WOLA, KEN: 36 = 1,5 crate; default 48 = half up, alternative 24).
-- ---------------------------------------------------------------------

-- 1.11b WOLA (PET 12/36/36; 36 = 1,5 skrzynki -> AMBIGUOUS, default 48)
DO $$
DECLARE n int; v_loc text := 'WOLA'; v_pet_mn numeric := 12; v_pet_mx numeric := 36;
        v_max numeric := 48;  -- OPERATOR: 48 (half up, default) or 24
BEGIN
  IF (SELECT count(*) FROM products WHERE product_id IN ('P190','P191') AND active) <> 2 THEN
    RAISE EXCEPTION '1.11b %: run 1.11a first', v_loc;
  END IF;
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE o.location_id = v_loc AND o.status IN ('captain_submitted','manager_claimed')
     AND ol.product_id IN ('P064','P065');
  IF n > 0 THEN RAISE EXCEPTION '1.11b %: % open Cappy PET line(s) — retry when the queue is clear', v_loc, n; END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = v_loc AND product_id IN ('P190','P191')) THEN
    RAISE EXCEPTION '1.11b %: glass rows already exist', v_loc;
  END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT v_loc || '__' || m.glass, v_loc, m.glass, s.min_stock_qty_base, v_max, v_max,
         s.is_critical_for_location, s.allow_over_max_due_to_packaging,
         format('2026-10-01 feedback-1001 1.11 D26: Cappy szkło 0,25 l; z %s %s/%s/%s, max do pełnej skrzynki 24',
                m.pet, s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                s.max_stock_qty_base::float8)
    FROM location_product_settings s
    JOIN (VALUES ('P064','P190'), ('P065','P191')) AS m(pet, glass) ON m.pet = s.product_id
   WHERE s.location_id = v_loc AND s.min_stock_qty_base = v_pet_mn
     AND s.target_stock_qty_base = v_pet_mx AND s.max_stock_qty_base = v_pet_mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11b %: glass insert expected 2, got % — PET rows changed', v_loc, n; END IF;

  DELETE FROM location_product_settings WHERE location_id = v_loc AND product_id IN ('P064','P065');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11b %: PET delete expected 2, got %', v_loc, n; END IF;
  RAISE NOTICE '1.11b applied: % Cappy glass max %', v_loc, v_max;
END $$;

-- 1.11c BRACKA (PET 5/12/12 -> 24; half a crate, never 0)
DO $$
DECLARE n int; v_loc text := 'BRACKA'; v_pet_mn numeric := 5; v_pet_mx numeric := 12;
        v_max numeric := 24;
BEGIN
  IF (SELECT count(*) FROM products WHERE product_id IN ('P190','P191') AND active) <> 2 THEN
    RAISE EXCEPTION '1.11c %: run 1.11a first', v_loc;
  END IF;
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE o.location_id = v_loc AND o.status IN ('captain_submitted','manager_claimed')
     AND ol.product_id IN ('P064','P065');
  IF n > 0 THEN RAISE EXCEPTION '1.11c %: % open Cappy PET line(s) — retry when the queue is clear', v_loc, n; END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = v_loc AND product_id IN ('P190','P191')) THEN
    RAISE EXCEPTION '1.11c %: glass rows already exist', v_loc;
  END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT v_loc || '__' || m.glass, v_loc, m.glass, s.min_stock_qty_base, v_max, v_max,
         s.is_critical_for_location, s.allow_over_max_due_to_packaging,
         format('2026-10-01 feedback-1001 1.11 D26: Cappy szkło 0,25 l; z %s %s/%s/%s, max do pełnej skrzynki 24',
                m.pet, s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                s.max_stock_qty_base::float8)
    FROM location_product_settings s
    JOIN (VALUES ('P064','P190'), ('P065','P191')) AS m(pet, glass) ON m.pet = s.product_id
   WHERE s.location_id = v_loc AND s.min_stock_qty_base = v_pet_mn
     AND s.target_stock_qty_base = v_pet_mx AND s.max_stock_qty_base = v_pet_mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11c %: glass insert expected 2, got % — PET rows changed', v_loc, n; END IF;

  DELETE FROM location_product_settings WHERE location_id = v_loc AND product_id IN ('P064','P065');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11c %: PET delete expected 2, got %', v_loc, n; END IF;
  RAISE NOTICE '1.11c applied: % Cappy glass max %', v_loc, v_max;
END $$;

-- 1.11d KEN (PET 12/36/36; AMBIGUOUS, default 48) — BLOCKED on 2026-10-01
--       by ORD-20260930-KEN-COCA-b8acbc (manager_claimed, P065 line).
DO $$
DECLARE n int; v_loc text := 'KEN'; v_pet_mn numeric := 12; v_pet_mx numeric := 36;
        v_max numeric := 48;  -- OPERATOR: 48 (half up, default) or 24
BEGIN
  IF (SELECT count(*) FROM products WHERE product_id IN ('P190','P191') AND active) <> 2 THEN
    RAISE EXCEPTION '1.11d %: run 1.11a first', v_loc;
  END IF;
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE o.location_id = v_loc AND o.status IN ('captain_submitted','manager_claimed')
     AND ol.product_id IN ('P064','P065');
  IF n > 0 THEN RAISE EXCEPTION '1.11d %: % open Cappy PET line(s) — retry when the queue is clear', v_loc, n; END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = v_loc AND product_id IN ('P190','P191')) THEN
    RAISE EXCEPTION '1.11d %: glass rows already exist', v_loc;
  END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT v_loc || '__' || m.glass, v_loc, m.glass, s.min_stock_qty_base, v_max, v_max,
         s.is_critical_for_location, s.allow_over_max_due_to_packaging,
         format('2026-10-01 feedback-1001 1.11 D26: Cappy szkło 0,25 l; z %s %s/%s/%s, max do pełnej skrzynki 24',
                m.pet, s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                s.max_stock_qty_base::float8)
    FROM location_product_settings s
    JOIN (VALUES ('P064','P190'), ('P065','P191')) AS m(pet, glass) ON m.pet = s.product_id
   WHERE s.location_id = v_loc AND s.min_stock_qty_base = v_pet_mn
     AND s.target_stock_qty_base = v_pet_mx AND s.max_stock_qty_base = v_pet_mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11d %: glass insert expected 2, got % — PET rows changed', v_loc, n; END IF;

  DELETE FROM location_product_settings WHERE location_id = v_loc AND product_id IN ('P064','P065');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11d %: PET delete expected 2, got %', v_loc, n; END IF;
  RAISE NOTICE '1.11d applied: % Cappy glass max %', v_loc, v_max;
END $$;

-- 1.11e WESTFIELD (PET 10/24/24 -> 24, exact)
DO $$
DECLARE n int; v_loc text := 'WESTFIELD'; v_pet_mn numeric := 10; v_pet_mx numeric := 24;
        v_max numeric := 24;
BEGIN
  IF (SELECT count(*) FROM products WHERE product_id IN ('P190','P191') AND active) <> 2 THEN
    RAISE EXCEPTION '1.11e %: run 1.11a first', v_loc;
  END IF;
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE o.location_id = v_loc AND o.status IN ('captain_submitted','manager_claimed')
     AND ol.product_id IN ('P064','P065');
  IF n > 0 THEN RAISE EXCEPTION '1.11e %: % open Cappy PET line(s) — retry when the queue is clear', v_loc, n; END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = v_loc AND product_id IN ('P190','P191')) THEN
    RAISE EXCEPTION '1.11e %: glass rows already exist', v_loc;
  END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT v_loc || '__' || m.glass, v_loc, m.glass, s.min_stock_qty_base, v_max, v_max,
         s.is_critical_for_location, s.allow_over_max_due_to_packaging,
         format('2026-10-01 feedback-1001 1.11 D26: Cappy szkło 0,25 l; z %s %s/%s/%s, max do pełnej skrzynki 24',
                m.pet, s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                s.max_stock_qty_base::float8)
    FROM location_product_settings s
    JOIN (VALUES ('P064','P190'), ('P065','P191')) AS m(pet, glass) ON m.pet = s.product_id
   WHERE s.location_id = v_loc AND s.min_stock_qty_base = v_pet_mn
     AND s.target_stock_qty_base = v_pet_mx AND s.max_stock_qty_base = v_pet_mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11e %: glass insert expected 2, got % — PET rows changed', v_loc, n; END IF;

  DELETE FROM location_product_settings WHERE location_id = v_loc AND product_id IN ('P064','P065');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11e %: PET delete expected 2, got %', v_loc, n; END IF;
  RAISE NOTICE '1.11e applied: % Cappy glass max %', v_loc, v_max;
END $$;

-- 1.11f ELEKTROWNIA (PET 10/24/24 -> 24, exact)
DO $$
DECLARE n int; v_loc text := 'ELEKTROWNIA'; v_pet_mn numeric := 10; v_pet_mx numeric := 24;
        v_max numeric := 24;
BEGIN
  IF (SELECT count(*) FROM products WHERE product_id IN ('P190','P191') AND active) <> 2 THEN
    RAISE EXCEPTION '1.11f %: run 1.11a first', v_loc;
  END IF;
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE o.location_id = v_loc AND o.status IN ('captain_submitted','manager_claimed')
     AND ol.product_id IN ('P064','P065');
  IF n > 0 THEN RAISE EXCEPTION '1.11f %: % open Cappy PET line(s) — retry when the queue is clear', v_loc, n; END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = v_loc AND product_id IN ('P190','P191')) THEN
    RAISE EXCEPTION '1.11f %: glass rows already exist', v_loc;
  END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT v_loc || '__' || m.glass, v_loc, m.glass, s.min_stock_qty_base, v_max, v_max,
         s.is_critical_for_location, s.allow_over_max_due_to_packaging,
         format('2026-10-01 feedback-1001 1.11 D26: Cappy szkło 0,25 l; z %s %s/%s/%s, max do pełnej skrzynki 24',
                m.pet, s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                s.max_stock_qty_base::float8)
    FROM location_product_settings s
    JOIN (VALUES ('P064','P190'), ('P065','P191')) AS m(pet, glass) ON m.pet = s.product_id
   WHERE s.location_id = v_loc AND s.min_stock_qty_base = v_pet_mn
     AND s.target_stock_qty_base = v_pet_mx AND s.max_stock_qty_base = v_pet_mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11f %: glass insert expected 2, got % — PET rows changed', v_loc, n; END IF;

  DELETE FROM location_product_settings WHERE location_id = v_loc AND product_id IN ('P064','P065');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11f %: PET delete expected 2, got %', v_loc, n; END IF;
  RAISE NOTICE '1.11f applied: % Cappy glass max %', v_loc, v_max;
END $$;

-- 1.11g BROWARY (PET 6/12/12 -> 24; half a crate, never 0)
DO $$
DECLARE n int; v_loc text := 'BROWARY'; v_pet_mn numeric := 6; v_pet_mx numeric := 12;
        v_max numeric := 24;
BEGIN
  IF (SELECT count(*) FROM products WHERE product_id IN ('P190','P191') AND active) <> 2 THEN
    RAISE EXCEPTION '1.11g %: run 1.11a first', v_loc;
  END IF;
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE o.location_id = v_loc AND o.status IN ('captain_submitted','manager_claimed')
     AND ol.product_id IN ('P064','P065');
  IF n > 0 THEN RAISE EXCEPTION '1.11g %: % open Cappy PET line(s) — retry when the queue is clear', v_loc, n; END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = v_loc AND product_id IN ('P190','P191')) THEN
    RAISE EXCEPTION '1.11g %: glass rows already exist', v_loc;
  END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT v_loc || '__' || m.glass, v_loc, m.glass, s.min_stock_qty_base, v_max, v_max,
         s.is_critical_for_location, s.allow_over_max_due_to_packaging,
         format('2026-10-01 feedback-1001 1.11 D26: Cappy szkło 0,25 l; z %s %s/%s/%s, max do pełnej skrzynki 24',
                m.pet, s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                s.max_stock_qty_base::float8)
    FROM location_product_settings s
    JOIN (VALUES ('P064','P190'), ('P065','P191')) AS m(pet, glass) ON m.pet = s.product_id
   WHERE s.location_id = v_loc AND s.min_stock_qty_base = v_pet_mn
     AND s.target_stock_qty_base = v_pet_mx AND s.max_stock_qty_base = v_pet_mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11g %: glass insert expected 2, got % — PET rows changed', v_loc, n; END IF;

  DELETE FROM location_product_settings WHERE location_id = v_loc AND product_id IN ('P064','P065');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11g %: PET delete expected 2, got %', v_loc, n; END IF;
  RAISE NOTICE '1.11g applied: % Cappy glass max %', v_loc, v_max;
END $$;

-- 1.11h P064/P065 renamed "… 0,33 l PET" (screen + supplier name). LAST
--       Cappy step (review 2026-10-01): names are joined live, so renaming
--       while a glass location still orders P064/P065 would put "0,33 l PET"
--       on its Coca-Cola portal copy list (KEN's claimed b8acbc has a P065
--       line today). Runs only when no glass location has a PET row left and
--       no open PET line remains at a glass location. NORBLIN (PET) is fine.
DO $$
DECLARE n int;
BEGIN
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id IN ('WOLA','BRACKA','KEN','WESTFIELD','ELEKTROWNIA','BROWARY')
                AND product_id IN ('P064','P065')) THEN
    RAISE EXCEPTION '1.11h: a glass location still has a Cappy PET row — run 1.11b..g (incl. KEN 1.11d) first';
  END IF;
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE o.location_id IN ('WOLA','BRACKA','KEN','WESTFIELD','ELEKTROWNIA','BROWARY')
     AND o.status IN ('captain_submitted','manager_claimed')
     AND ol.product_id IN ('P064','P065');
  IF n > 0 THEN RAISE EXCEPTION '1.11h: % open Cappy PET line(s) at a glass location — retry when the queue is clear', n; END IF;

  UPDATE products p SET product_name_pl = v.new_name
    FROM (VALUES ('P064','Cappy Jabłko','Cappy Jabłko 0,33 l PET'),
                 ('P065','Cappy Pomarańcza','Cappy Pomarańcza 0,33 l PET')) AS v(pid, old_name, new_name)
   WHERE p.product_id = v.pid AND p.product_name_pl = v.old_name;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11h PET product rename: expected 2, got %', n; END IF;

  UPDATE supplier_products sp SET supplier_product_name = v.new_name
    FROM (VALUES ('SP_COCACOLA_P064','Cappy Jabłko','Cappy Jabłko 0,33 l PET'),
                 ('SP_COCACOLA_P065','Cappy Pomarańcza','Cappy Pomarańcza 0,33 l PET')) AS v(spid, old_name, new_name)
   WHERE sp.supplier_product_id = v.spid AND sp.supplier_product_name = v.old_name;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '1.11h PET supplier rename: expected 2, got %', n; END IF;
  RAISE NOTICE '1.11h applied: P064/P065 renamed "… 0,33 l PET"';
END $$;


-- =====================================================================
-- STEP 2 — AUDIT (read-only). Every row must show ok = true, except the
-- rows marked "(pending: …)" while a held/blocked step has not run.
-- Save the output as prod-sql-1-audit.md.
-- =====================================================================

SELECT n, check_name, ok FROM (
  SELECT 1 AS n, '1.1 25 new screen names' AS check_name,
         (SELECT count(*) FROM products WHERE product_name_pl IN (
            'Tirokafteri 2kg','Oliwki kalamata 2kg Bidon','Halloumi Reha 200gr',
            'Frytki Aviko Super Crunch 9,5mm 2,5kg','Frytki z batatów Aviko 2,27kg',
            'Fasolka Szparagowa mrożona 2,5kg','Frytura Effo 15L','Woda 5L','Develey Musztarda 3 kg',
            'Fanex Majonez 4kg','Cieciorka w zalewie 400g/240g','Prymat Pieprz czarny mielony 820g',
            'Prymat Oregano 110g','Prymat Papryka słodka mielona 720g','Sól kamienna 1kg',
            'Prymat Liść Laurowy 80g','Prymat Ziele angielskie 600g',
            'Opakowanie sałatki duże jednoczęściowe 750ml','Opakowanie sałatki małe jednoczęściowe 250ml',
            'Torby fałdowane pojedyncze do pity','Folia Aluminiowa','Gąbka do naczyń 10szt',
            'Kawa Jacobs Cronat Gold Rozpuszczalna 200gr','Herbata Lipton Yellow Label 100szt',
            'Cukier w kostkach Diamant 0,5kg')) = 25 AS ok
  UNION ALL
  SELECT 2, '1.1 28 new supplier names (active rows)',
         (SELECT count(*) FROM supplier_products WHERE active AND supplier_product_name IN (
            'KRUSZWICA MASŁO ROŚLINNE 500g/12 kubek','GREEK OLIWKI KALAMATA Z PESTKĄ 2kg/6 BIDON',
            'EURIAL REHA HALLOUMI SER DO GRILLOWANIA 200g/12','AVIKO FRYTKI SUPER CRUNCH 9,5mm 2,5kg/4',
            'AVIKO FRYTKI Z BATATÓW 9,5mm 2,27kg/5','IMF FASOLKA SZPARAGOWA ZIELONA CIĘTA 2,5kg/4',
            'EFFO DEEP FRY FRYTURA ROŚLINNA 15L BIB','KURACJUSZ WODA NIEGAZOWANA 5L',
            'OLEJ UNIWERSALNY RZEPAKOWY 5L (4)','FANEX KETCHUP VII 1,1kg/4 PREMIUM','Develey Musztarda 3 kg',
            'FANEX MAJONEZ 4kg SAŁATKOWY WYŚMIENITY','GREEK OLIWA Z OLIWEK POMACE HELCOM 1L/15 plastik',
            'ROLNIK CIECIORKA W ZALEWIE 400g/240g (12) puszka','MELVIT KASZA PĘCZAK 900g/10',
            'ASIA SOS SRIRACHA CHILI PIKANTNY FG 730ml/12','CD MIÓD WIELOKWIATOWY 1kg/6',
            'PRYMAT PIEPRZ CZARNY MIELONY 820g/9 pet','PRYMAT OREGANO 110g/6 pet',
            'PRYMAT PAPRYKA SŁODKA 720g/9 pet','Sól kamienna 1kg','PRYMAT LIŚĆ LAUROWY 80g/10 pudełko',
            'PRYMAT ZIELE ANGIELSKIE 600g/9 pet','DIAMANT CUKIER KOSTKA BIAŁY 0,5kg/10',
            'Opakowanie sałatki duże jednoczęściowe 750ml','Opakowanie sałatki małe jednoczęściowe 250ml',
            'Torby fałdowane pojedyncze do pity','Folia Aluminiowa')) = 28
  UNION ALL
  SELECT 3, '1.1 no "(opakowania)"/"(op.)" left on an active name except Pago P026 Pita',
         NOT EXISTS (SELECT 1 FROM products WHERE active AND product_id <> 'P026'
                      AND (product_name_pl ILIKE '%(opakowania)%' OR product_name_pl ILIKE '%(op.)%'))
     AND NOT EXISTS (SELECT 1 FROM supplier_products WHERE active AND product_id <> 'P026'
                      AND (supplier_product_name ILIKE '%(opakowania)%' OR supplier_product_name ILIKE '%(op.)%'))
  UNION ALL
  SELECT 4, '1.2 P013 = 1/1/2 at the 7 active locations',
         (SELECT count(*) FROM location_product_settings s JOIN locations l USING (location_id)
           WHERE l.active AND s.product_id = 'P013' AND s.min_stock_qty_base = 1
             AND s.target_stock_qty_base = 1 AND s.max_stock_qty_base = 2) = 7
  UNION ALL
  SELECT 5, '1.3 P054 = 0/0/1 at the 7 active locations, price 14.70',
         (SELECT count(*) FROM location_product_settings s JOIN locations l USING (location_id)
           WHERE l.active AND s.product_id = 'P054' AND s.min_stock_qty_base = 0
             AND s.target_stock_qty_base = 0 AND s.max_stock_qty_base = 1) = 7
     AND (SELECT price_estimate_pln FROM supplier_products WHERE supplier_product_id = 'SP_INTERMLECZ_P054') = 14.70
  UNION ALL
  SELECT 6, '1.4 gyros in szt, upp unchanged',
         (SELECT count(*) FROM supplier_products
           WHERE (supplier_product_id, units_per_purchase_unit) IN
                 (('SP_PAGO_P024',15), ('SP_PAGO_P025',25), ('SP_SPEC_P179',15))
             AND purchase_unit = 'szt') = 3
  UNION ALL
  SELECT 7, '1.5 P177/P185 inactive (pending: held until the staff message)',
         (SELECT count(*) FROM products WHERE product_id IN ('P177','P185') AND NOT active) = 2
  UNION ALL
  SELECT 8, '1.6 P139 inactive; setting rows kept',
         (SELECT NOT active FROM products WHERE product_id = 'P139')
     AND (SELECT count(*) FROM location_product_settings WHERE product_id = 'P139') = 3
  UNION ALL
  SELECT 9, '1.7 P189 price 4.08',
         (SELECT price_estimate_pln FROM supplier_products WHERE supplier_product_id = 'SP_INTERMLECZ_P189') = 4.08
  UNION ALL
  SELECT 10, '1.8 P021 paczka 18.86 upp 1; P022 paczka upp 1',
         (SELECT count(*) FROM supplier_products
           WHERE supplier_product_id = 'SP_INTERMLECZ_P021' AND purchase_unit = 'paczka'
             AND units_per_purchase_unit = 1 AND price_estimate_pln = 18.86) = 1
     AND (SELECT count(*) FROM supplier_products
           WHERE supplier_product_id = 'SP_INTERMLECZ_P022' AND purchase_unit = 'paczka'
             AND units_per_purchase_unit = 1) = 1
  UNION ALL
  SELECT 11, '1.9 rolls: P183 12/30/30 and P129 12/24/24 at NORBLIN/ELEKTROWNIA/WESTFIELD',
         (SELECT count(*) FROM location_product_settings
           WHERE location_id IN ('NORBLIN','ELEKTROWNIA','WESTFIELD')
             AND ((product_id = 'P183' AND min_stock_qty_base = 12 AND target_stock_qty_base = 30 AND max_stock_qty_base = 30)
               OR (product_id = 'P129' AND min_stock_qty_base = 12 AND target_stock_qty_base = 24 AND max_stock_qty_base = 24))) = 6
  UNION ALL
  SELECT 12, '1.10 Coca-Cola glass: ELEKTROWNIA 48/120 + 72/144, WESTFIELD 48/96 + 72/120, BROWARY 24/72 + 48/96',
         (SELECT count(*) FROM location_product_settings
           WHERE (location_id, product_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base) IN
                 (('ELEKTROWNIA','P186',48,120,120), ('ELEKTROWNIA','P187',72,144,144),
                  ('WESTFIELD','P186',48,96,96), ('WESTFIELD','P187',72,120,120),
                  ('BROWARY','P186',24,72,72), ('BROWARY','P187',48,96,96))) = 6
  UNION ALL
  SELECT 13, '1.10 no can rows left at ELEKTROWNIA/BROWARY; NORBLIN keeps cans',
         NOT EXISTS (SELECT 1 FROM location_product_settings
                      WHERE location_id IN ('ELEKTROWNIA','BROWARY') AND product_id IN ('P068','P069'))
     AND (SELECT count(*) FROM location_product_settings
           WHERE location_id = 'NORBLIN' AND product_id IN ('P068','P069')) = 2
  UNION ALL
  SELECT 14, '1.11a P190/P191 + SP_COCACOLA_P190/P191 (skrzynka x24, 100.32)',
         (SELECT count(*) FROM products WHERE product_id IN ('P190','P191') AND active
            AND inventory_unit = 'szt' AND NOT is_critical) = 2
     AND (SELECT count(*) FROM supplier_products WHERE supplier_product_id IN ('SP_COCACOLA_P190','SP_COCACOLA_P191')
            AND active AND purchase_unit = 'skrzynka' AND units_per_purchase_unit = 24
            AND price_estimate_pln = 100.32 AND rounding_rule = 'up_for_critical') = 2
  UNION ALL
  SELECT 15, '1.11 glass-only (2 glass, 0 PET) at WOLA, BRACKA, WESTFIELD, ELEKTROWNIA, BROWARY',
         (SELECT count(*) FROM (
            SELECT s.location_id FROM location_product_settings s
             WHERE s.location_id IN ('WOLA','BRACKA','WESTFIELD','ELEKTROWNIA','BROWARY')
             GROUP BY s.location_id
            HAVING count(*) FILTER (WHERE product_id IN ('P190','P191')) = 2
               AND count(*) FILTER (WHERE product_id IN ('P064','P065')) = 0) x) = 5
  UNION ALL
  SELECT 16, '1.11d KEN glass-only (pending: blocked by ORD-20260930-KEN-COCA-b8acbc)',
         (SELECT count(*) FILTER (WHERE product_id IN ('P190','P191')) = 2
             AND count(*) FILTER (WHERE product_id IN ('P064','P065')) = 0
            FROM location_product_settings WHERE location_id = 'KEN')
  UNION ALL
  SELECT 17, '1.11 NORBLIN keeps PET only',
         (SELECT count(*) FILTER (WHERE product_id IN ('P064','P065')) = 2
             AND count(*) FILTER (WHERE product_id IN ('P190','P191')) = 0
            FROM location_product_settings WHERE location_id = 'NORBLIN')
  UNION ALL
  SELECT 18, 'min <= target <= max and max > 0 on every row this batch wrote',
         NOT EXISTS (SELECT 1 FROM location_product_settings
                      WHERE notes LIKE '%2026-10-01 feedback-1001%'
                        AND NOT (min_stock_qty_base <= target_stock_qty_base
                                 AND target_stock_qty_base <= max_stock_qty_base
                                 AND max_stock_qty_base > 0))
  UNION ALL
  SELECT 19, 'no placeholder e-mail: active e-mail suppliers and location mailboxes carry "@"',
         NOT EXISTS (SELECT 1 FROM suppliers WHERE active AND ordering_method = 'email'
                      AND (email IS NULL OR email NOT LIKE '%@%'))
     AND NOT EXISTS (SELECT 1 FROM locations WHERE email IS NOT NULL AND email NOT LIKE '%@%')
  UNION ALL
  SELECT 20, '1.11h P064/P065 named "… 0,33 l PET" (pending: until every glass location switched, KEN included)',
         (SELECT count(*) FROM products WHERE product_id IN ('P064','P065') AND product_name_pl LIKE '%0,33 l PET') = 2
     AND (SELECT count(*) FROM supplier_products WHERE supplier_product_id IN ('SP_COCACOLA_P064','SP_COCACOLA_P065')
            AND supplier_product_name LIKE '%0,33 l PET') = 2
  UNION ALL
  SELECT 21, '1.11 Cappy glass values: min = PET min, target = max, max 24 (WOLA/KEN: 48 or 24 per operator)',
         (SELECT count(*) FROM location_product_settings
           WHERE product_id IN ('P190','P191') AND target_stock_qty_base = max_stock_qty_base
             AND (((location_id, min_stock_qty_base) IN (('WOLA',12), ('KEN',12))
                   AND max_stock_qty_base IN (24, 48))
               OR (location_id, min_stock_qty_base, max_stock_qty_base) IN
                   (('BRACKA',5,24), ('WESTFIELD',10,24), ('ELEKTROWNIA',10,24), ('BROWARY',6,24))))
         = (SELECT count(*) FROM location_product_settings WHERE product_id IN ('P190','P191'))
     AND (SELECT count(*) FROM location_product_settings WHERE product_id IN ('P190','P191')) >= 10
) c
ORDER BY n;

-- Re-run STEP 0 after the audit and save it as the "after" state.


-- =====================================================================
-- STEP R — ROLLBACK (commented out). Run only the parts of the steps
-- that were applied, newest first, one block per step. Values are the
-- prod state read on 2026-10-01; check them against the saved STEP 0.
-- =====================================================================

-- -- R 1.11b..g (per location; replace v_loc and the PET values per location:
-- --   WOLA 12/36/36 aomp true, BRACKA 5/12/12 aomp true, KEN 12/36/36 aomp true,
-- --   WESTFIELD 10/24/24, ELEKTROWNIA 10/24/24, BROWARY 6/12/12; crit false everywhere)
-- BEGIN;
-- INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base,
--   target_stock_qty_base, max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
-- VALUES
--  ('WOLA__P064','WOLA','P064',12,36,36,false,true,'ESTIM - verify after first order cycle'),
--  ('WOLA__P065','WOLA','P065',12,36,36,false,true,'ESTIM - verify after first order cycle'),
--  ('BRACKA__P064','BRACKA','P064',5,12,12,false,true,'baza: kopia WOLA 2026-07-16'),
--  ('BRACKA__P065','BRACKA','P065',5,12,12,false,true,'baza: kopia WOLA 2026-07-16'),
--  ('KEN__P064','KEN','P064',12,36,36,false,true,'ken-arkusz-2026-08-31'),
--  ('KEN__P065','KEN','P065',12,36,36,false,true,'ken-arkusz-2026-08-31'),
--  ('WESTFIELD__P064','WESTFIELD','P064',10,24,24,false,false,'threshold TBC (sheet had no min/max) [2026-09-29 arkusz min/max, przed 0/0/0]'),
--  ('WESTFIELD__P065','WESTFIELD','P065',10,24,24,false,false,'threshold TBC (sheet had no min/max) [2026-09-29 arkusz min/max, przed 0/0/0]'),
--  ('ELEKTROWNIA__P064','ELEKTROWNIA','P064',10,24,24,false,false,'threshold TBC (sheet had no min/max) [2026-09-29 arkusz min/max, przed 0/0/0]'),
--  ('ELEKTROWNIA__P065','ELEKTROWNIA','P065',10,24,24,false,false,'threshold TBC (sheet had no min/max) [2026-09-29 arkusz min/max, przed 0/0/0]'),
--  ('BROWARY__P064','BROWARY','P064',6,12,12,false,false,'browary-arkusz-2026-08-31'),
--  ('BROWARY__P065','BROWARY','P065',6,12,12,false,false,'browary-arkusz-2026-08-31')
-- ON CONFLICT (setting_id) DO NOTHING;   -- a location that was never applied keeps its PET rows
-- DELETE FROM location_product_settings WHERE product_id IN ('P190','P191');
-- COMMIT;
--
-- -- R 1.11a + R 1.11h (only after every 1.11b..g is rolled back, and only if no
-- --          order line, receipt line or inventory count line references P190/P191 —
-- --          the FKs make the DELETE fail otherwise; if they do, set P190/P191
-- --          active = false instead of deleting). The four name UPDATEs undo 1.11h
-- --          and are no-ops when 1.11h never ran.
-- BEGIN;
-- DELETE FROM supplier_products WHERE supplier_product_id IN ('SP_COCACOLA_P190','SP_COCACOLA_P191');
-- DELETE FROM products WHERE product_id IN ('P190','P191');
-- UPDATE products SET product_name_pl = 'Cappy Jabłko' WHERE product_id = 'P064';
-- UPDATE products SET product_name_pl = 'Cappy Pomarańcza' WHERE product_id = 'P065';
-- UPDATE supplier_products SET supplier_product_name = 'Cappy Jabłko' WHERE supplier_product_id = 'SP_COCACOLA_P064';
-- UPDATE supplier_products SET supplier_product_name = 'Cappy Pomarańcza' WHERE supplier_product_id = 'SP_COCACOLA_P065';
-- COMMIT;
--
-- -- R 1.10c BROWARY / R 1.10a ELEKTROWNIA (cans back, glass out)
-- BEGIN;
-- INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base,
--   target_stock_qty_base, max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
-- VALUES
--  ('BROWARY__P068','BROWARY','P068',24,72,72,false,false,'browary-arkusz-2026-08-31'),
--  ('BROWARY__P069','BROWARY','P069',48,96,96,false,false,'browary-arkusz-2026-08-31'),
--  ('ELEKTROWNIA__P068','ELEKTROWNIA','P068',50,120,120,false,false,'threshold TBC (sheet had no min/max) [2026-09-29 arkusz min/max, przed 0/0/0; puszka 0,33 (jak istniejący wiersz lokalu)]'),
--  ('ELEKTROWNIA__P069','ELEKTROWNIA','P069',70,150,150,false,false,'threshold TBC (sheet had no min/max) [2026-09-29 arkusz min/max, przed 0/0/0; puszka 0,33 (jak istniejący wiersz lokalu)]')
-- ON CONFLICT (setting_id) DO NOTHING;
-- DELETE FROM location_product_settings WHERE location_id IN ('BROWARY','ELEKTROWNIA') AND product_id IN ('P186','P187');
-- COMMIT;
--
-- -- R 1.10b, 1.9, 1.3, 1.2 (thresholds back + the appended note suffix removed)
-- BEGIN;
-- UPDATE location_product_settings s
--    SET min_stock_qty_base = v.mn, target_stock_qty_base = v.tg, max_stock_qty_base = v.mx,
--        notes = regexp_replace(s.notes, ' \[2026-10-01 feedback-1001 [^]]*\]$', '')
--   FROM (VALUES
--     ('WESTFIELD','P186',50,100,100), ('WESTFIELD','P187',70,130,130),
--     ('NORBLIN','P183',5,40,40), ('ELEKTROWNIA','P183',0,0,0), ('WESTFIELD','P183',0,0,0),
--     ('NORBLIN','P129',3,20,20), ('ELEKTROWNIA','P129',0,0,0), ('WESTFIELD','P129',0,0,0),
--     ('WOLA','P054',1,1,1), ('BRACKA','P054',0.5,1.5,1.5), ('KEN','P054',0.1,0.5,0.5),
--     ('BROWARY','P054',0.02,0.08,0.08), ('NORBLIN','P054',0.5,1.5,1.5),
--     ('ELEKTROWNIA','P054',0.5,1.5,1.5), ('WESTFIELD','P054',0.5,1.5,1.5),
--     ('WOLA','P013',0.5,1.5,1.5), ('BRACKA','P013',0.5,1.5,1.5), ('KEN','P013',0.5,2,2),
--     ('BROWARY','P013',1,3.3,3.3), ('NORBLIN','P013',1,3,3), ('ELEKTROWNIA','P013',1,3,3),
--     ('WESTFIELD','P013',1,3,3)) AS v(loc, pid, mn, tg, mx)
--  WHERE s.location_id = v.loc AND s.product_id = v.pid
--    AND s.notes LIKE '%2026-10-01 feedback-1001%';
-- COMMIT;
--
-- -- R 1.8, 1.7, 1.6, 1.5, 1.4, 1.3 price
-- BEGIN;
-- UPDATE supplier_products SET purchase_unit = 'opak', price_estimate_pln = 22.55, order_note = '1 opak = worek 2,5 kg' WHERE supplier_product_id = 'SP_INTERMLECZ_P021';
-- UPDATE supplier_products SET purchase_unit = 'opak', order_note = '1 opak = worek 2,27 kg' WHERE supplier_product_id = 'SP_INTERMLECZ_P022';
-- UPDATE supplier_products SET price_estimate_pln = NULL WHERE supplier_product_id = 'SP_INTERMLECZ_P189';
-- UPDATE products SET active = true WHERE product_id IN ('P139');
-- UPDATE products SET active = true WHERE product_id IN ('P177','P185');   -- only if 1.5 ran
-- UPDATE supplier_products SET purchase_unit = 'blok' WHERE supplier_product_id IN ('SP_PAGO_P024','SP_PAGO_P025','SP_SPEC_P179');
-- UPDATE supplier_products SET price_estimate_pln = 13.67 WHERE supplier_product_id = 'SP_INTERMLECZ_P054';
-- COMMIT;
--
-- -- R 1.1 (names back; roll back prod-sql-1b.sql first if it ran — it renames P055's note again)
-- BEGIN;
-- UPDATE products p SET product_name_pl = v.old_name FROM (VALUES
--   ('P012','Hot Feta 2kg'), ('P013','Oliwki kalamata'), ('P015','Halloumi'),
--   ('P021','Frytki Aviko (opakowania)'), ('P022','Frytki z batatów (opakowania)'),
--   ('P023','Fasolka Szparagowa (op.)'), ('P038','Frytura Eppo 15L'), ('P040','Woda 5l pracownicza'),
--   ('P043','DEVELEY MUSZTARDA 3 kg'), ('P044','FANEX MAJONEZ 4kg'), ('P046','CIECIORKA'),
--   ('P050','Pieprz'), ('P051','Oregano'), ('P052','Papryka słodka - mielona'), ('P053','Sól 1kg'),
--   ('P054','Liść Laurowy'), ('P055','Ziele Angielskie'),
--   ('P084','Opakowaie sałatki duże jednocześciowe 750ml'), ('P085','Opakowanie sałatki małe jednocześciowe 250ml'),
--   ('P094','Torby fałdowane pojedycze do pity'), ('P095','Folia Alumiuniowa'), ('P121','Gąbka do naczyń'),
--   ('P140','KAWA JACOBS CRONAT GOLD ROZPUSZCZALNA 200g/6'), ('P141','LIPTON HERBATA YELLOW LABEL 100szt./12 koperta'),
--   ('P189','Cukier w kostkach Diament 1kg')) AS v(pid, old_name)
--  WHERE p.product_id = v.pid;
-- UPDATE supplier_products sp SET supplier_product_name = v.old_name FROM (VALUES
--   ('SP_INTERMLECZ_P001','Masło MR 500g'), ('SP_INTERMLECZ_P013','Oliwki kalamata'),
--   ('SP_INTERMLECZ_P015','Halloumi'), ('SP_INTERMLECZ_P021','Frytki Aviko (opakowania)'),
--   ('SP_INTERMLECZ_P022','Frytki z batatów (opakowania)'), ('SP_INTERMLECZ_P023','Fasolka Szparagowa (op.)'),
--   ('SP_INTERMLECZ_P038','Frytura Eppo 15L'), ('SP_INTERMLECZ_P040','Woda 5l pracownicza'),
--   ('SP_INTERMLECZ_P041','Olej Rzepakowy 5 L'), ('SP_INTERMLECZ_P042','Ketchup Fanex VII 1,1 kg'),
--   ('SP_INTERMLECZ_P043','DEVELEY MUSZTARDA 3 kg'), ('SP_INTERMLECZ_P044','FANEX MAJONEZ 4kg'),
--   ('SP_INTERMLECZ_P045','Oliwa z Oliwek 1L'), ('SP_INTERMLECZ_P046','CIECIORKA'),
--   ('SP_INTERMLECZ_P047','Kasza Pęczak Melvit 900g'), ('SP_INTERMLECZ_P048','Sriracha chili 730 ml'),
--   ('SP_INTERMLECZ_P049','Miód 1 kg'), ('SP_INTERMLECZ_P050','Pieprz'), ('SP_INTERMLECZ_P051','Oregano'),
--   ('SP_INTERMLECZ_P052','Papryka słodka - mielona'), ('SP_INTERMLECZ_P053','Sól 1kg'),
--   ('SP_INTERMLECZ_P054','Liść Laurowy 80g'), ('SP_INTERMLECZ_P055','Ziele Angielskie 500g'),
--   ('SP_INTERMLECZ_P189','Cukier w kostkach Diament 1 kg'),
--   ('SP_BLUESERV_P084','Opakowaie sałatki duże jednocześciowe 750ml'),
--   ('SP_BLUESERV_P085','Opakowanie sałatki małe jednocześciowe 250ml'),
--   ('SP_BLUESERV_P094','Torby fałdowane pojedycze do pity'), ('SP_BLUESERV_P095','Folia Alumiuniowa')) AS v(spid, old_name)
--  WHERE sp.supplier_product_id = v.spid;
-- UPDATE supplier_products SET order_note = '1 opak = 500 g' WHERE supplier_product_id = 'SP_INTERMLECZ_P055';
-- COMMIT;
