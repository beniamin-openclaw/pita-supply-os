-- gdansk-rollout — prod SQL 4: Coca-Cola Gdańsk = cans and PET, no glass
-- Prepared 2026-10-19. Supabase project lpzhphufjwrndfogkfub.
-- Run STEP 0 (read-only) first, then STEP 1 + AUDIT. Apply only with Ben's OK after review.
--
-- Source: Ben, chat 2026-10-19: "W Gdańsku nie kupujemy szkła, tylko puszki i PET."
--   Fanta and Sprite: can, pack of 24. Kropla (500 ml) and juices (Cappy PET 330 ml): pack of 12.
--   Thresholds: "Progi dla Marka, jak nie ma w plikach" — keep the thresholds Marek's Gdańsk sheet
--   gave (Fanta, Sprite, Kropla, in szt); cola cans and Cappy PET are not in the sheet -> stay
--   0/0/0 until Marek gives them (orderable, no suggestion).
-- Prod facts (read 2026-10-19): SLONY own_catalog = true. The SUP_COCACOLA_GDA catalog has 8 rows,
--   all glass-named: P186/P187 cola, P190/P191 Cappy, P066/P067 Fanta/Sprite "0.25 RGB SZKŁO X24",
--   P070/P071 Kropla "0.33 NRG SZKŁO X24". No SLONY order references any of them (Gdańsk has
--   2 orders in total, Blue Service and Kuchnie). Count 18.10: Cappy PET 14+14, cola cans 88+69,
--   Fanta 34, Sprite 10, Kropla 49+20, all glass 0.
--
-- What this file does:
--   1. New SLONY rows: Cappy Jabłko/Pomarańcza PET 0,33 l (zgrzewka x12) and Coca-Cola /
--      Coca-Cola Zero 0,33 l puszka (zgrzewka x24). Fields and price are copied from the Warsaw
--      rows SP_COCACOLA_P064/P065/P068/P069. They take the display_order of the glass rows they replace.
--   2. P066/P067 Fanta/Sprite rows: renamed to "0,33 l puszka", 'zgrzewka' x24 (was skrzynka x24).
--   3. P070/P071 Kropla rows: renamed to "PET 0,5 l", x12 (was x24). Price set to NULL, because the
--      old price was for a pack of 24.
--   4. Glass rows P186/P187/P190/P191: catalog row inactive, SLONY thresholds 0/0/0, with the old
--      values kept in notes. They stay on the count list (count-only, 0) until Ben OKs removing them
--      (optional STEP 2, DELETE).
-- Untouched: SLONY thresholds for P066/P067/P070/P071 (in szt; they still fit whole packs),
--   P064/P065/P068/P069 settings (stay 0/0/0), every non-SLONY row.

-- ============================================================
-- STEP 0 — before (read-only; save the output, it is the rollback)
-- ============================================================
SELECT supplier_product_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit,
       price_estimate_pln, active, order_note, display_order
  FROM supplier_products WHERE supplier_id = 'SUP_COCACOLA_GDA' ORDER BY supplier_product_id;   -- expect 8 rows
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base, notes
  FROM location_product_settings
 WHERE location_id = 'SLONY' AND product_id IN ('P064','P065','P066','P067','P068','P069','P070','P071','P186','P187','P190','P191')
 ORDER BY setting_id;                                                                              -- expect 12 rows
SELECT count(*) AS refs FROM order_lines WHERE supplier_product_id LIKE 'SP_COCACOLA_GDA_%';      -- expect 0

-- ============================================================
-- STEP 1 — apply
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE n int;
BEGIN
  IF (SELECT own_catalog FROM locations WHERE location_id = 'SLONY') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SLONY is not own_catalog — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products WHERE supplier_id = 'SUP_COCACOLA_GDA') <> 8 THEN
    RAISE EXCEPTION 'SUP_COCACOLA_GDA does not have 8 rows — re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products
              WHERE supplier_product_id IN ('SP_COCACOLA_GDA_P064','SP_COCACOLA_GDA_P065','SP_COCACOLA_GDA_P068','SP_COCACOLA_GDA_P069')) THEN
    RAISE EXCEPTION 'a new SLONY can/PET row already exists — re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM order_lines WHERE supplier_product_id LIKE 'SP_COCACOLA_GDA_%') THEN
    RAISE EXCEPTION 'an order references a SUP_COCACOLA_GDA row — changing pack sizes would break it';
  END IF;
  IF (SELECT count(*) FROM supplier_products
       WHERE supplier_product_id IN ('SP_COCACOLA_P064','SP_COCACOLA_P065','SP_COCACOLA_P068','SP_COCACOLA_P069')
         AND active AND location_id IS NULL
         AND units_per_purchase_unit = CASE WHEN product_id IN ('P064','P065') THEN 12 ELSE 24 END) <> 4 THEN
    RAISE EXCEPTION 'Warsaw source rows P064/P065/P068/P069 not as expected — re-diff';
  END IF;
  IF (SELECT count(*) FROM location_product_settings
       WHERE location_id = 'SLONY' AND product_id IN ('P064','P065','P068','P069')) <> 4 THEN
    RAISE EXCEPTION 'SLONY settings for P064/P065/P068/P069 missing — re-diff';
  END IF;
  -- guard the exact rows being changed (state read 2026-10-19)
  IF (SELECT count(*) FROM supplier_products
       WHERE supplier_id = 'SUP_COCACOLA_GDA' AND location_id = 'SLONY' AND active
         AND ((product_id IN ('P066','P067','P186','P187','P190','P191') AND purchase_unit = 'skrzynka' AND units_per_purchase_unit = 24)
           OR (product_id IN ('P070','P071') AND purchase_unit = 'zgrzewka' AND units_per_purchase_unit = 24))) <> 8 THEN
    RAISE EXCEPTION 'SUP_COCACOLA_GDA rows changed since 2026-10-19 — re-diff';
  END IF;

  -- 1. cans and PET, copied from the Warsaw rows
  INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit,
     units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note,
     unit_weight_kg, supplier_sku, warehouse_pickup, display_order, counts_toward_minimum,
     case_unit, units_per_case, location_id, is_backup)
  SELECT 'SP_COCACOLA_GDA_' || sp.product_id, 'SUP_COCACOLA_GDA', sp.product_id, v.name, sp.purchase_unit,
         sp.units_per_purchase_unit, sp.rounding_rule, sp.price_estimate_pln, true,
         'gdansk-rollout 2026-10-19: Ben "w Gdańsku puszki i PET, nie szkło"; kopia ' || sp.supplier_product_id
           || ' (Warszawa); zastępuje szkło ' || v.replaces || '; progi do Marka',
         v.order_note, sp.unit_weight_kg, sp.supplier_sku, sp.warehouse_pickup, v.display_order,
         sp.counts_toward_minimum, sp.case_unit, sp.units_per_case, 'SLONY', false
    FROM supplier_products sp
    JOIN (VALUES
      ('SP_COCACOLA_P068', 'Coca-Cola 0,33 l puszka',      '1 zgrzewka = 24 szt (puszka 0,33)', 1, 'P186'),
      ('SP_COCACOLA_P069', 'Coca-Cola Zero 0,33 l puszka', '1 zgrzewka = 24 szt (puszka 0,33)', 2, 'P187'),
      ('SP_COCACOLA_P065', 'Cappy Pomarańcza PET 0,33 l',  '1 zgrzewka = 12 szt (PET 0,33)',    5, 'P191'),
      ('SP_COCACOLA_P064', 'Cappy Jabłko PET 0,33 l',      '1 zgrzewka = 12 szt (PET 0,33)',    6, 'P190')
    ) AS v(src, name, order_note, display_order, replaces) ON v.src = sp.supplier_product_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'can/PET insert: expected 4, got %', n; END IF;

  -- 2. Fanta / Sprite: cans x24
  UPDATE supplier_products sp
     SET supplier_product_name = v.name, purchase_unit = 'zgrzewka',
         order_note = '1 zgrzewka = 24 szt (puszka 0,33)',
         notes = sp.notes || ' [2026-10-19 Ben: puszka x24; przed: ' || sp.supplier_product_name || ', skrzynka x24]'
    FROM (VALUES ('SP_COCACOLA_GDA_P066', 'Fanta 0,33 l puszka'),
                 ('SP_COCACOLA_GDA_P067', 'Sprite 0,33 l puszka')) AS v(id, name)
   WHERE sp.supplier_product_id = v.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'Fanta/Sprite update: expected 2, got %', n; END IF;

  -- 3. Kropla: PET 0,5 l x12, price unknown for a pack of 12
  UPDATE supplier_products sp
     SET supplier_product_name = v.name, units_per_purchase_unit = 12, price_estimate_pln = NULL,
         order_note = '1 zgrzewka = 12 szt (PET 0,5)',
         notes = sp.notes || ' [2026-10-19 Ben: PET 0,5 x12; przed: ' || sp.supplier_product_name
                 || ', zgrzewka x24, cena ' || coalesce(sp.price_estimate_pln::text, 'NULL') || '; cena do uzupełnienia]'
    FROM (VALUES ('SP_COCACOLA_GDA_P070', 'Kropla Beskidu niegazowana PET 0,5 l'),
                 ('SP_COCACOLA_GDA_P071', 'Kropla Beskidu gazowana PET 0,5 l')) AS v(id, name)
   WHERE sp.supplier_product_id = v.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'Kropla update: expected 2, got %', n; END IF;

  -- 4. glass: catalog row off, thresholds 0/0/0 (old values into notes)
  UPDATE supplier_products
     SET active = false,
         notes = notes || ' [2026-10-19 wyłączone: Gdańsk nie kupuje szkła (Ben)]'
   WHERE supplier_product_id IN ('SP_COCACOLA_GDA_P186','SP_COCACOLA_GDA_P187','SP_COCACOLA_GDA_P190','SP_COCACOLA_GDA_P191');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'glass deactivate: expected 4, got %', n; END IF;

  UPDATE location_product_settings
     SET notes = notes || ' [2026-10-19 przed ' || min_stock_qty_base || '/' || target_stock_qty_base || '/'
                 || max_stock_qty_base || '; Gdańsk nie kupuje szkła]',
         min_stock_qty_base = 0, target_stock_qty_base = 0, max_stock_qty_base = 0
   WHERE location_id = 'SLONY' AND product_id IN ('P186','P187','P190','P191');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'glass thresholds: expected 4, got %', n; END IF;
END $$;

COMMIT;

-- ============================================================
-- AUDIT
-- ============================================================
-- (a) active SLONY Coca-Cola catalog: 8 rows, none named SZKŁO/szkło, units 24/24/24/24/12/12/12/12
SELECT supplier_product_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit,
       price_estimate_pln, display_order
  FROM supplier_products WHERE supplier_id = 'SUP_COCACOLA_GDA' AND active ORDER BY display_order;
-- (b) -> 0 rows: an active SLONY Coca-Cola row still named like glass
SELECT supplier_product_id FROM supplier_products
 WHERE supplier_id = 'SUP_COCACOLA_GDA' AND active AND supplier_product_name ILIKE '%szk%o%';
-- (c) thresholds: P186/P187/P190/P191 0/0/0; P064/P065/P068/P069 0/0/0; P066/P067 12/48/48; P070 36/96/96; P071 24/48/48
SELECT product_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base
  FROM location_product_settings
 WHERE location_id = 'SLONY' AND product_id IN ('P064','P065','P066','P067','P068','P069','P070','P071','P186','P187','P190','P191')
 ORDER BY product_id;
-- Live check (no deploy): SLONY Captain -> Coca-Cola tab lists cola/Zero cans, Fanta/Sprite cans,
-- Cappy PET, Kropla PET; no glass. Count list still shows the 4 glass products (0) until STEP 2.

-- ============================================================
-- STEP 2 — OPTIONAL, only with Ben's separate OK: remove glass from the SLONY count list
-- ============================================================
-- BEGIN;
-- DELETE FROM location_product_settings
--  WHERE location_id = 'SLONY' AND product_id IN ('P186','P187','P190','P191')
--    AND min_stock_qty_base = 0 AND target_stock_qty_base = 0 AND max_stock_qty_base = 0;
-- -- expect 4; backup = the STEP 0 output
-- COMMIT;

-- ============================================================
-- ROLLBACK (commented out) — restores the STEP 0 state
-- ============================================================
-- One DO block with a row count after every statement (review 2026-10-19, W2). It contains a
-- DELETE, so the operator confirms it at the screen. The settings restore is an upsert, so it
-- also works after the optional STEP 2 has deleted the glass settings.
-- BEGIN;
-- SET LOCAL lock_timeout = '5s';
-- DO $$
-- DECLARE n int;
-- BEGIN
--   IF EXISTS (SELECT 1 FROM order_lines WHERE supplier_product_id LIKE 'SP_COCACOLA_GDA_%') THEN
--     RAISE EXCEPTION 'orders already reference SUP_COCACOLA_GDA rows — roll back by hand';
--   END IF;
--   DELETE FROM supplier_products WHERE supplier_product_id IN
--     ('SP_COCACOLA_GDA_P064','SP_COCACOLA_GDA_P065','SP_COCACOLA_GDA_P068','SP_COCACOLA_GDA_P069');
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 4 THEN RAISE EXCEPTION 'delete: expected 4, got %', n; END IF;
--   UPDATE supplier_products SET supplier_product_name = '0.25 RGB SZKŁO X24 FANTA ORANGE', purchase_unit = 'skrzynka',
--          order_note = '1 skrzynka = 24 szt (szkło 0,25)' WHERE supplier_product_id = 'SP_COCACOLA_GDA_P066';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'P066: got %', n; END IF;
--   UPDATE supplier_products SET supplier_product_name = '0.25 RGB SZKŁO X24 SPRITE', purchase_unit = 'skrzynka',
--          order_note = '1 skrzynka = 24 szt (szkło 0,25)' WHERE supplier_product_id = 'SP_COCACOLA_GDA_P067';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'P067: got %', n; END IF;
--   UPDATE supplier_products SET supplier_product_name = '0.33 NRG SZKŁO X24 WODA KROPLA BESKIDU', units_per_purchase_unit = 24,
--          price_estimate_pln = 34.80, order_note = '1 zgrzewka = 24 szt' WHERE supplier_product_id = 'SP_COCACOLA_GDA_P070';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'P070: got %', n; END IF;
--   UPDATE supplier_products SET supplier_product_name = '0.33 NRG SZKŁO X24 WODA KROPLA DELICE GAZOWANA', units_per_purchase_unit = 24,
--          price_estimate_pln = 34.80, order_note = '1 zgrzewka = 24 szt' WHERE supplier_product_id = 'SP_COCACOLA_GDA_P071';
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'P071: got %', n; END IF;
--   UPDATE supplier_products SET active = true WHERE supplier_product_id IN
--     ('SP_COCACOLA_GDA_P186','SP_COCACOLA_GDA_P187','SP_COCACOLA_GDA_P190','SP_COCACOLA_GDA_P191');
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 4 THEN RAISE EXCEPTION 'glass reactivate: expected 4, got %', n; END IF;
--   INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base)
--   VALUES ('SLONY__P186','SLONY','P186',24,96,96), ('SLONY__P187','SLONY','P187',24,120,120),
--          ('SLONY__P190','SLONY','P190',12,48,48), ('SLONY__P191','SLONY','P191',12,48,48)
--   ON CONFLICT (location_id, product_id) DO UPDATE
--     SET min_stock_qty_base = EXCLUDED.min_stock_qty_base,
--         target_stock_qty_base = EXCLUDED.target_stock_qty_base,
--         max_stock_qty_base = EXCLUDED.max_stock_qty_base;
--   GET DIAGNOSTICS n = ROW_COUNT; IF n <> 4 THEN RAISE EXCEPTION 'glass settings: expected 4, got %', n; END IF;
-- END $$;
-- COMMIT;
-- (notes keep the appended "[2026-10-19 …]" markers; harmless)
