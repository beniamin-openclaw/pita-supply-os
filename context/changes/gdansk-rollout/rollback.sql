-- gdansk-rollout — rollback
-- PART 1 (kill switch, UPDATE only — safe unattended): deactivates the 5 Gdańsk suppliers and every
--   SLONY-scoped catalog row. The captain then sees no supplier tabs. NOT a hard stop: an already open
--   order screen can still submit (captain_submit resolves inactive scoped rows). The hard stop is
--   removing the SLONY:<code> pair from Railway SUPPLY_OS_CAPTAIN_TOKENS.
-- PART 2 (full data rollback, has DELETE — operator at the screen): ONLY after the SLONY token is
--   removed from Railway — it restores own_catalog=false + the template, i.e. the Warsaw catalog.
--   Refuses if SLONY has any order / count / receipt. Ends by checking the settings md5 equals the
--   2026-10-16 read (11ee78f0bec056bf308d9adbc2feb457).

-- =====================================================================================
-- PART 1 — kill switch
-- =====================================================================================
BEGIN;
DO $$
DECLARE n_sup int; n_sp int;
BEGIN
  UPDATE suppliers SET active = false WHERE supplier_id IN ('SUP_KUCHNIE_GDA', 'SUP_SELGROS_GDA', 'SUP_COCACOLA_GDA', 'SUP_WARSZAWA_GDA', 'SUP_BLUESERV_GDA') AND active;
  GET DIAGNOSTICS n_sup = ROW_COUNT;
  UPDATE supplier_products SET active = false WHERE location_id = 'SLONY' AND supplier_id IN ('SUP_KUCHNIE_GDA', 'SUP_SELGROS_GDA', 'SUP_COCACOLA_GDA', 'SUP_WARSZAWA_GDA', 'SUP_BLUESERV_GDA') AND active;
  GET DIAGNOSTICS n_sp = ROW_COUNT;
  IF n_sup > 5 OR n_sp > 130 THEN RAISE EXCEPTION 'unexpected counts % / %', n_sup, n_sp; END IF;
  RAISE NOTICE 'kill switch: % suppliers, % catalog rows deactivated', n_sup, n_sp;
END $$;
COMMIT;
-- Undo PART 1: UPDATE suppliers SET active = true WHERE supplier_id IN ('SUP_KUCHNIE_GDA', 'SUP_SELGROS_GDA', 'SUP_COCACOLA_GDA', 'SUP_WARSZAWA_GDA', 'SUP_BLUESERV_GDA');
--              UPDATE supplier_products SET active = true WHERE location_id = 'SLONY' AND supplier_id IN ('SUP_KUCHNIE_GDA', 'SUP_SELGROS_GDA', 'SUP_COCACOLA_GDA', 'SUP_WARSZAWA_GDA', 'SUP_BLUESERV_GDA');

-- =====================================================================================
-- PART 2 — full data rollback (opt-in: uncomment the SET LOCAL line)
-- =====================================================================================
BEGIN;
-- SET LOCAL gdansk.rollback = 'yes';
DO $$
DECLARE n int;
BEGIN
  IF coalesce(current_setting('gdansk.rollback', true), '') <> 'yes' THEN
    RAISE EXCEPTION 'PART 2 is opt-in: uncomment SET LOCAL gdansk.rollback = ''yes'' (token removed from Railway first)';
  END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE location_id = 'SLONY')
     OR EXISTS (SELECT 1 FROM inventory_counts WHERE location_id = 'SLONY')
     OR EXISTS (SELECT 1 FROM receipts WHERE location_id = 'SLONY') THEN
    RAISE EXCEPTION 'SLONY has orders / counts / receipts — stay on PART 1 (keeps history)';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_delivery_rules WHERE supplier_id IN ('SUP_KUCHNIE_GDA', 'SUP_SELGROS_GDA', 'SUP_COCACOLA_GDA', 'SUP_WARSZAWA_GDA', 'SUP_BLUESERV_GDA')) THEN
    RAISE EXCEPTION 'delivery rules reference Gdańsk suppliers — remove them first';
  END IF;

  -- R-2: re-insert the 12 leftovers deleted by step 2 (no-op if step 2 never ran)
  INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base,
         max_stock_qty_base, target_stock_qty_base, is_critical_for_location,
         allow_over_max_due_to_packaging, notes, inventory_order)
  VALUES
    ('SLONY__P017', 'SLONY', 'P017', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL),
    ('SLONY__P037', 'SLONY', 'P037', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL),
    ('SLONY__P039', 'SLONY', 'P039', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL),
    ('SLONY__P056', 'SLONY', 'P056', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL),
    ('SLONY__P064', 'SLONY', 'P064', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL),
    ('SLONY__P065', 'SLONY', 'P065', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL),
    ('SLONY__P068', 'SLONY', 'P068', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL),
    ('SLONY__P069', 'SLONY', 'P069', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL),
    ('SLONY__P109', 'SLONY', 'P109', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL),
    ('SLONY__P113', 'SLONY', 'P113', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL),
    ('SLONY__P114', 'SLONY', 'P114', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL),
    ('SLONY__P130', 'SLONY', 'P130', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL)
  ON CONFLICT (setting_id) DO NOTHING;

  -- R-1: catalog rows, suppliers, settings, location
  DELETE FROM supplier_products WHERE location_id = 'SLONY' AND supplier_id IN ('SUP_KUCHNIE_GDA', 'SUP_SELGROS_GDA', 'SUP_COCACOLA_GDA', 'SUP_WARSZAWA_GDA', 'SUP_BLUESERV_GDA');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n NOT IN (0, 130) THEN RAISE EXCEPTION 'catalog rows deleted: %', n; END IF;
  IF EXISTS (SELECT 1 FROM supplier_products WHERE supplier_id IN ('SUP_KUCHNIE_GDA', 'SUP_SELGROS_GDA', 'SUP_COCACOLA_GDA', 'SUP_WARSZAWA_GDA', 'SUP_BLUESERV_GDA')) THEN
    RAISE EXCEPTION 'Gdańsk supplier rows outside SLONY exist';
  END IF;
  DELETE FROM suppliers WHERE supplier_id IN ('SUP_KUCHNIE_GDA', 'SUP_SELGROS_GDA', 'SUP_COCACOLA_GDA', 'SUP_WARSZAWA_GDA', 'SUP_BLUESERV_GDA');

  UPDATE location_product_settings s
     SET min_stock_qty_base = m[1]::numeric, target_stock_qty_base = m[2]::numeric, max_stock_qty_base = m[3]::numeric,
         notes = regexp_replace(s.notes, ' \[2026-10-16 arkusz GDA, przed [^]]*\]$', '')
    FROM (SELECT setting_id, regexp_match(notes, '\[2026-10-16 arkusz GDA, przed ([0-9.]+)/([0-9.]+)/([0-9.]+);') AS m
            FROM location_product_settings WHERE location_id = 'SLONY') x
   WHERE s.setting_id = x.setting_id AND x.m IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n NOT IN (0, 90) THEN RAISE EXCEPTION 'settings restored: %', n; END IF;

  DELETE FROM location_product_settings WHERE location_id = 'SLONY' AND notes LIKE '2026-10-16 arkusz GDA (nowy wiersz)%';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n NOT IN (0, 18) THEN RAISE EXCEPTION 'new settings rows deleted: %', n; END IF;

  UPDATE locations SET
    delivery_address = NULL,
    city = 'Gdańsk',
    active = false,
    notes = 'added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator',
    company_name = NULL,
    company_address = NULL,
    company_nip = NULL,
    email = NULL,
    sender_email = 'slony@pitabros.pl',
    phone = NULL,
    own_catalog = false
   WHERE location_id = 'SLONY';

  IF (SELECT md5(string_agg(s::text, '|' ORDER BY s.setting_id)) FROM location_product_settings s
       WHERE s.location_id = 'SLONY') <> '11ee78f0bec056bf308d9adbc2feb457' THEN
    RAISE EXCEPTION 'SLONY settings do not match the 2026-10-16 state after rollback';
  END IF;
  RAISE NOTICE 'rolled back: SLONY back to the 2026-10-16 template';
END $$;
COMMIT;
