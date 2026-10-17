-- porzadek-data-2026-10 — prod SQL 3: Westfield ("Molotov", D19) and Powiśle (= ELEKTROWNIA)
-- Prepared 2026-10-17. Run in the Supabase SQL editor (project lpzhphufjwrndfogkfub).
--
-- HOW TO RUN: STEP 0 alone first (read-only). Then ONE block per editor run (3.1 … 3.4). Each DO
-- block is its own transaction; a block that raises changes nothing. Ids come from the repo (the
-- agent could not read prod on 17.10).
--
-- Sources (Connecteam "Pita Supply OS" chat, context/changes/porzadek-2026-10/inputs/connecteam-chat.md):
--   B50 04.10 Mirsini (Westfield): add Fuzetea and Burn; drinks in glass "skrzynka 24, nie 12";
--       paper rolls under cleaning supplies.
--   B52 08.10 Sebastian (Powiśle/Westfield): Powiśle Fuzetea and Kinley; Westfield Fuzetea and Burn.
--   D19: "Molotov" = WESTFIELD. Powiśle = ELEKTROWNIA ("Pita Bros Elektrownia Powiśle", Dobra 42).
--   Burn (P156) is NOT here: it has no active supplier; Marek has to name one first.
--
-- Before (repo state; STEP 0 confirms):
--   WESTFIELD and ELEKTROWNIA have no P079 Kinley and no P081 Fuzetea row
--   (feedback-1001 zero-thresholds-review, 01.10). SP_COCACOLA_P079 / SP_COCACOLA_P081 are shared
--   (location_id NULL) and active.
--   Westfield glass: Coca-Cola P186/P187 are already in skrzynka×24 (29.09, re-rounded to whole
--   crates by feedback-1001 1.10b on 02.10). Cappy is still PET: WESTFIELD__P064/P065 10/24/24;
--   P190/P191 Cappy szkło (skrzynka×24) exist with no row (feedback-1001 1.11e never applied).
--   Westfield paper: only P104 Ręczniki ZZ. "Papier duży w Roli 1–4 szt" was held on 29.09 (unclear
--   whether it is towel or jumbo toilet roll, and from whom).
--
-- What changes:
--   3.1 WESTFIELD__P081 Fuzetea              0/0/0 (on the list and the Coca-Cola tab, no suggestion
--                                              until Marek gives thresholds — same as Katowice B2)
--   3.2 WESTFIELD Cappy -> glass              = feedback-1001 1.11e: P190/P191 10/24/24 in, PET out
--   3.3 ELEKTROWNIA__P081 Fuzetea, __P079 Kinley 0/0/0 (same reason as 3.1)
--   3.4 paper roll under cleaning             HELD: operator variable v_pid is NULL -> no-op NOTICE
--
-- Rollback: at the end (commented out).

-- ============================================================
-- STEP 0 — before (read-only)
-- ============================================================
SELECT location_id, product_id, min_stock_qty_base AS min, target_stock_qty_base AS target,
       max_stock_qty_base AS max, left(notes, 60) AS notes
  FROM location_product_settings
 WHERE location_id IN ('WESTFIELD', 'ELEKTROWNIA')
   AND product_id IN ('P064', 'P065', 'P079', 'P081', 'P104', 'P120', 'P156', 'P186', 'P187', 'P190', 'P191')
 ORDER BY 1, 2;
SELECT supplier_product_id, supplier_id, location_id, active, purchase_unit, units_per_purchase_unit AS upp,
       case_unit, units_per_case
  FROM supplier_products
 WHERE product_id IN ('P079', 'P081', 'P156', 'P190', 'P191') ORDER BY product_id, 1;
SELECT product_id, product_name_pl, product_category, inventory_unit, active
  FROM products WHERE product_id IN ('P079', 'P081', 'P104', 'P120', 'P156', 'P190', 'P191') ORDER BY 1;
-- open Cappy PET lines at WESTFIELD (3.2 refuses to run while any exist)
SELECT o.order_id, o.status, ol.product_id FROM orders o JOIN order_lines ol USING (order_id)
 WHERE o.location_id = 'WESTFIELD' AND o.status IN ('captain_submitted', 'manager_claimed')
   AND ol.product_id IN ('P064', 'P065');

-- ============================================================
-- 3.1 WESTFIELD Fuzetea (count + manual order, no suggestion yet)
-- ============================================================
DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supplier_products WHERE supplier_product_id = 'SP_COCACOLA_P081'
                    AND active AND location_id IS NULL) THEN
    RAISE EXCEPTION '3.1: SP_COCACOLA_P081 not an active shared row — re-diff';
  END IF;
  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  VALUES ('WESTFIELD__P081', 'WESTFIELD', 'P081', 0, 0, 0, false, false,
          '[2026-10-17 porzadek-data D19: Mirsini 04.10 / Sebastian 08.10; progi do uzupełnienia (Marek)]')
  ON CONFLICT (location_id, product_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '3.1: WESTFIELD__P081 already exists — re-diff'; END IF;
  RAISE NOTICE '3.1 applied: WESTFIELD Fuzetea 0/0/0';
END $$;

-- ============================================================
-- 3.2 WESTFIELD Cappy -> glass 0,25 l, crate of 24 (= feedback-1001 1.11e, PET 10/24/24 -> 24 exact)
-- ============================================================
DO $$
DECLARE n int; v_loc text := 'WESTFIELD'; v_pet_mn numeric := 10; v_pet_mx numeric := 24;
        v_max numeric := 24;
BEGIN
  IF (SELECT count(*) FROM products WHERE product_id IN ('P190', 'P191') AND active) <> 2
     OR (SELECT count(*) FROM supplier_products
          WHERE supplier_product_id IN ('SP_COCACOLA_P190', 'SP_COCACOLA_P191') AND active) <> 2 THEN
    RAISE EXCEPTION '3.2: P190/P191 or their Coca-Cola rows missing — re-diff';
  END IF;
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE o.location_id = v_loc AND o.status IN ('captain_submitted', 'manager_claimed')
     AND ol.product_id IN ('P064', 'P065');
  IF n > 0 THEN RAISE EXCEPTION '3.2: % open Cappy PET line(s) at WESTFIELD — retry when the queue is clear', n; END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = v_loc AND product_id IN ('P190', 'P191')) THEN
    RAISE EXCEPTION '3.2: WESTFIELD glass rows already exist';
  END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT v_loc || '__' || m.glass, v_loc, m.glass, s.min_stock_qty_base, v_max, v_max,
         s.is_critical_for_location, s.allow_over_max_due_to_packaging,
         format('2026-10-17 porzadek-data D19 (feedback-1001 1.11e): Cappy szkło 0,25 l, skrzynka 24 (Mirsini 04.10); z %s %s/%s/%s',
                m.pet, s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                s.max_stock_qty_base::float8)
    FROM location_product_settings s
    JOIN (VALUES ('P064', 'P190'), ('P065', 'P191')) AS m(pet, glass) ON m.pet = s.product_id
   WHERE s.location_id = v_loc AND s.min_stock_qty_base = v_pet_mn
     AND s.target_stock_qty_base = v_pet_mx AND s.max_stock_qty_base = v_pet_mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '3.2: glass insert expected 2, got % — PET rows are not 10/24/24', n; END IF;

  DELETE FROM location_product_settings WHERE location_id = v_loc AND product_id IN ('P064', 'P065');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '3.2: PET delete expected 2, got %', n; END IF;
  RAISE NOTICE '3.2 applied: WESTFIELD Cappy glass 10/24/24';
END $$;

-- ============================================================
-- 3.3 Powiśle (ELEKTROWNIA) Fuzetea + Kinley (count + manual order, no suggestion yet)
-- ============================================================
DO $$
DECLARE n int;
BEGIN
  IF (SELECT count(*) FROM supplier_products
       WHERE supplier_product_id IN ('SP_COCACOLA_P079', 'SP_COCACOLA_P081')
         AND active AND location_id IS NULL) <> 2 THEN
    RAISE EXCEPTION '3.3: SP_COCACOLA_P079/P081 not both active shared rows — re-diff';
  END IF;
  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  VALUES ('ELEKTROWNIA__P081', 'ELEKTROWNIA', 'P081', 0, 0, 0, false, false,
          '[2026-10-17 porzadek-data: Sebastian 08.10 Powiśle; progi do uzupełnienia (Marek)]'),
         ('ELEKTROWNIA__P079', 'ELEKTROWNIA', 'P079', 0, 0, 0, false, false,
          '[2026-10-17 porzadek-data: Sebastian 08.10 Powiśle; progi do uzupełnienia (Marek)]')
  ON CONFLICT (location_id, product_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '3.3: expected 2 new rows, got % — one already exists; re-diff', n; END IF;
  RAISE NOTICE '3.3 applied: ELEKTROWNIA Fuzetea + Kinley 0/0/0';
END $$;

-- ============================================================
-- 3.4 WESTFIELD paper roll under cleaning supplies — HELD until the product is named
-- ============================================================
-- Mirsini asks for "rolki papieru" under cleaning (Chemia). The 29.09 sheet had "Papier duży w Roli
-- 1–4 szt" for ELEKTROWNIA and WESTFIELD, held because nobody knew which product it is. The only
-- Chemia paper in the catalog is P104 Ręczniki ZZ (Westfield has it) and P120 Papier Toaletowy
-- 8 rolek (Blue Service). Set v_pid once Marek/Mirsini confirm (P120, or a new product).
DO $$
DECLARE n int;
        v_pid text := NULL;            -- OPERATOR: e.g. 'P120' once confirmed; NULL = no-op
        v_mn numeric := 1; v_mx numeric := 4;  -- sheet 29.09 "1–4 szt"; target = max
BEGIN
  IF v_pid IS NULL THEN
    RAISE NOTICE '3.4 skipped: paper-roll product not named yet (needs Marek/Mirsini)';
    RETURN;
  END IF;
  IF (SELECT product_category FROM products WHERE product_id = v_pid AND active) IS DISTINCT FROM 'Chemia' THEN
    RAISE EXCEPTION '3.4: % is not an active Chemia product', v_pid;
  END IF;
  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  VALUES ('WESTFIELD__' || v_pid, 'WESTFIELD', v_pid, v_mn, v_mx, v_mx, false, false,
          '[2026-10-17 porzadek-data D19: Mirsini 04.10 rolki papieru w chemii; arkusz 29.09 1–4 szt]')
  ON CONFLICT (location_id, product_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '3.4: WESTFIELD__% already exists', v_pid; END IF;
  RAISE NOTICE '3.4 applied: WESTFIELD__% %/%/%', v_pid, v_mn, v_mx, v_mx;
END $$;

-- ============================================================
-- AUDIT
-- ============================================================
SELECT location_id, product_id, min_stock_qty_base AS min, target_stock_qty_base AS target,
       max_stock_qty_base AS max
  FROM location_product_settings
 WHERE location_id IN ('WESTFIELD', 'ELEKTROWNIA')
   AND product_id IN ('P064', 'P065', 'P079', 'P081', 'P120', 'P190', 'P191')
 ORDER BY 1, 2;
-- expected: ELEKTROWNIA P064/P065 unchanged (Cappy PET; its glass switch is feedback-1001 1.11f,
-- not part of this lane), P079 0/0/0, P081 0/0/0; WESTFIELD P081 0/0/0, P190/P191 10/24/24,
-- no P064/P065.
-- Live check (GET only, WESTFIELD and ELEKTROWNIA codes): inventory shows Fuzetea (and Kinley at
-- ELEKTROWNIA); the Coca-Cola tab lists them with suggestion 0.

-- ============================================================
-- ROLLBACK (commented out)
-- ============================================================
-- 3.1 / 3.3 / 3.4 (only while no count or order line references them at that location):
--   DELETE FROM location_product_settings
--    WHERE setting_id IN ('WESTFIELD__P081', 'ELEKTROWNIA__P081', 'ELEKTROWNIA__P079')
--      AND notes LIKE '%2026-10-17 porzadek-data%';
-- 3.2:
--   BEGIN;
--   INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base,
--     target_stock_qty_base, max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
--   SELECT 'WESTFIELD__' || m.pet, 'WESTFIELD', m.pet, s.min_stock_qty_base, 24, 24, s.is_critical_for_location,
--          s.allow_over_max_due_to_packaging, 'rollback 3.2 porzadek-data'
--     FROM location_product_settings s JOIN (VALUES ('P064','P190'), ('P065','P191')) AS m(pet, glass)
--       ON s.product_id = m.glass WHERE s.location_id = 'WESTFIELD';
--   DELETE FROM location_product_settings WHERE location_id = 'WESTFIELD' AND product_id IN ('P190','P191');
--   COMMIT;
