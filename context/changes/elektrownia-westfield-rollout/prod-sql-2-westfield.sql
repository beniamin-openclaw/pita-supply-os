-- ============================================================
-- elektrownia-westfield-rollout, step 2 (2026-09-29) — operator answers:
--   * WESTFIELD company = Pita Bros sp. z o.o., NIP 9522100633 (as NORBLIN); own address + own mailbox
--     (mailbox not given yet — email stays NULL).
--   * WESTFIELD takes Coca-Cola in glass: thresholds move from the 0,33 can (P068/P069) to the
--     0,25 glass SKUs (P186/P187), same min/max; the can rows are removed, as at WOLA/BRACKA/KEN.
--   * ELEKTROWNIA and NORBLIN keep cans (no change).
-- Before-state (read 2026-09-29, before apply):
--   locations.WESTFIELD: company_name/company_address/company_nip/email NULL,
--     notes 'rollout 2026-09-29; adres: westfield.com; SPÓŁKA, NIP i e-mail lokalu DO UZUPEŁNIENIA'
--   WESTFIELD__P068 50/100/100, critical false, allow_over_max false,
--     notes 'threshold TBC (sheet had no min/max) [2026-09-29 arkusz min/max, przed 0/0/0; puszka 0,33 (jak istniejący wiersz lokalu)]'
--   WESTFIELD__P069 70/130/130, same flags, same notes
--   WESTFIELD__P186 / WESTFIELD__P187: absent
-- ============================================================

DO $$
DECLARE n int;
BEGIN
  IF (SELECT company_nip FROM locations WHERE location_id = 'WESTFIELD') IS NOT NULL THEN
    RAISE EXCEPTION 'WESTFIELD company_nip already set — re-check';
  END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = 'WESTFIELD' AND product_id IN ('P186','P187')) THEN
    RAISE EXCEPTION 'WESTFIELD glass rows already exist — re-check';
  END IF;
  IF (SELECT count(*) FROM location_product_settings
       WHERE location_id = 'WESTFIELD'
         AND ((product_id = 'P068' AND min_stock_qty_base = 50 AND max_stock_qty_base = 100)
           OR (product_id = 'P069' AND min_stock_qty_base = 70 AND max_stock_qty_base = 130))) <> 2 THEN
    RAISE EXCEPTION 'WESTFIELD can rows not in the expected state';
  END IF;

  UPDATE locations SET
    company_name    = 'Pita Bros sp. z o.o.',
    company_nip     = '9522100633',
    company_address = 'ul. W. Laskonogiego 9, 02-496 Warszawa',
    notes           = 'rollout 2026-09-29; adres: westfield.com; spółka: operator 2026-09-29 (jak NORBLIN); E-MAIL LOKALU DO UZUPEŁNIENIA'
  WHERE location_id = 'WESTFIELD';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'WESTFIELD location update touched % rows', n; END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT 'WESTFIELD__' || m.glass, 'WESTFIELD', m.glass,
         s.min_stock_qty_base, s.target_stock_qty_base, s.max_stock_qty_base,
         s.is_critical_for_location, s.allow_over_max_due_to_packaging,
         '2026-09-29 arkusz min/max; szkło 0,25 l (operator 2026-09-29), progi przeniesione z ' || m.can
  FROM location_product_settings s
  JOIN (VALUES ('P068','P186'), ('P069','P187')) AS m(can, glass) ON m.can = s.product_id
  WHERE s.location_id = 'WESTFIELD';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'glass insert touched % rows', n; END IF;

  DELETE FROM location_product_settings
   WHERE location_id = 'WESTFIELD' AND product_id IN ('P068','P069');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'can delete touched % rows', n; END IF;
END $$;

-- Audit (read-only): expect WESTFIELD with company + NIP; P186 50/100/100, P187 70/130/130; no P068/P069.
SELECT location_id, company_name, company_nip, company_address, email FROM locations WHERE location_id = 'WESTFIELD';
SELECT product_id, min_stock_qty_base::float8, target_stock_qty_base::float8, max_stock_qty_base::float8, notes
  FROM location_product_settings
 WHERE location_id = 'WESTFIELD' AND product_id IN ('P068','P069','P186','P187') ORDER BY 1;

-- ============================================================
-- ROLLBACK for step 2 only (run BEFORE rollback.sql if undoing the whole rollout):
-- BEGIN;
-- INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base,
--   target_stock_qty_base, max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
-- VALUES
--  ('WESTFIELD__P068','WESTFIELD','P068',50,100,100,false,false,'threshold TBC (sheet had no min/max) [2026-09-29 arkusz min/max, przed 0/0/0; puszka 0,33 (jak istniejący wiersz lokalu)]'),
--  ('WESTFIELD__P069','WESTFIELD','P069',70,130,130,false,false,'threshold TBC (sheet had no min/max) [2026-09-29 arkusz min/max, przed 0/0/0; puszka 0,33 (jak istniejący wiersz lokalu)]');
-- DELETE FROM location_product_settings WHERE location_id = 'WESTFIELD' AND product_id IN ('P186','P187');
-- UPDATE locations SET company_name = NULL, company_nip = NULL, company_address = NULL,
--   notes = 'rollout 2026-09-29; adres: westfield.com; SPÓŁKA, NIP i e-mail lokalu DO UZUPEŁNIENIA'
--  WHERE location_id = 'WESTFIELD';
-- COMMIT;
-- ============================================================
