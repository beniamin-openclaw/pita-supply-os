-- gdansk-rollout — prod SQL step 2: delete the 12 template leftovers at SLONY
-- Contains DELETE: the Supabase connector asks a human to confirm — run as its own call with the
-- operator at the screen (lessons.md). Run only after step 1. The captain token goes live after this.
-- Leftovers = template products Gdańsk does not carry (they would show on the inventory list):
-- P017, P037, P039, P056, P064, P065, P068, P069, P109, P113, P114, P130.

-- STEP 0 — backup check (read-only): expect 12 x 'match'
WITH b(setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base,
       is_critical_for_location, allow_over_max_due_to_packaging, notes, inventory_order) AS (VALUES
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
    ('SLONY__P130', 'SLONY', 'P130', 0.0000, 0.0000, 0.0000, false, false, 'threshold TBC (sheet had no min/max)', NULL))
SELECT b.setting_id,
       CASE WHEN s.setting_id IS NULL THEN 'MISSING'
            WHEN (s.location_id, s.product_id, s.min_stock_qty_base, s.max_stock_qty_base, s.target_stock_qty_base,
                  s.is_critical_for_location, s.allow_over_max_due_to_packaging, s.notes, s.inventory_order)
                 IS NOT DISTINCT FROM
                 (b.location_id, b.product_id, b.min_stock_qty_base, b.max_stock_qty_base, b.target_stock_qty_base,
                  b.is_critical_for_location, b.allow_over_max_due_to_packaging, b.notes, b.inventory_order::int)
            THEN 'match' ELSE 'DIFFERS' END AS state
  FROM b LEFT JOIN location_product_settings s ON s.setting_id = b.setting_id ORDER BY 1;

-- STEP 1 — guarded delete (one transaction)
DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM locations WHERE location_id = 'SLONY' AND own_catalog AND active) THEN
    RAISE EXCEPTION 'step 1 not applied (SLONY not own_catalog/active)';
  END IF;
  SELECT count(*) INTO n FROM suppliers WHERE supplier_id IN ('SUP_KUCHNIE_GDA', 'SUP_SELGROS_GDA', 'SUP_COCACOLA_GDA', 'SUP_WARSZAWA_GDA', 'SUP_BLUESERV_GDA') AND active;
  IF n <> 5 THEN RAISE EXCEPTION 'step 1 not applied (suppliers %)', n; END IF;
  SELECT count(*) INTO n FROM supplier_products WHERE location_id = 'SLONY' AND active;
  IF n <> 130 THEN RAISE EXCEPTION 'step 1 not applied (catalog rows %)', n; END IF;
  SELECT count(*) INTO n FROM location_product_settings WHERE location_id = 'SLONY';
  IF n <> 133 THEN RAISE EXCEPTION 'SLONY settings: expected 133, found %', n; END IF;
  IF EXISTS (SELECT 1 FROM inventory_counts WHERE location_id = 'SLONY') THEN
    RAISE EXCEPTION 'SLONY already has inventory counts';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products WHERE location_id = 'SLONY' AND product_id IN ('P017', 'P037', 'P039', 'P056', 'P064', 'P065', 'P068', 'P069', 'P109', 'P113', 'P114', 'P130')) THEN
    RAISE EXCEPTION 'a leftover product has a SLONY catalog row';
  END IF;

  SELECT count(*) INTO n FROM location_product_settings s
   WHERE s.setting_id IN ('SLONY__P017', 'SLONY__P037', 'SLONY__P039', 'SLONY__P056', 'SLONY__P064', 'SLONY__P065', 'SLONY__P068', 'SLONY__P069', 'SLONY__P109', 'SLONY__P113', 'SLONY__P114', 'SLONY__P130') AND s.location_id = 'SLONY'
     AND s.min_stock_qty_base = 0 AND s.max_stock_qty_base = 0 AND s.target_stock_qty_base = 0
     AND NOT s.is_critical_for_location AND NOT s.allow_over_max_due_to_packaging
     AND s.notes = 'threshold TBC (sheet had no min/max)' AND s.inventory_order IS NULL;
  IF n <> 12 THEN RAISE EXCEPTION 'leftover rows differ from the backup (% of 12 match)', n; END IF;

  DELETE FROM location_product_settings WHERE location_id = 'SLONY' AND setting_id IN ('SLONY__P017', 'SLONY__P037', 'SLONY__P039', 'SLONY__P056', 'SLONY__P064', 'SLONY__P065', 'SLONY__P068', 'SLONY__P069', 'SLONY__P109', 'SLONY__P113', 'SLONY__P114', 'SLONY__P130');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 12 THEN RAISE EXCEPTION 'deleted %', n; END IF;

  SELECT count(*) INTO n FROM location_product_settings WHERE location_id = 'SLONY';
  IF n <> 121 THEN RAISE EXCEPTION 'SLONY settings after delete: expected 121, got %', n; END IF;
  RAISE NOTICE 'DELETED 12 leftovers; SLONY settings = 121';
END $$;

-- STEP 2 — audits: expect total 121, inventory list 121, leftovers 0
SELECT count(*) AS total,
       (SELECT count(*) FROM location_product_settings s JOIN products p USING (product_id) WHERE s.location_id = 'SLONY' AND p.active) AS inventory_list,
       (SELECT count(*) FROM location_product_settings WHERE setting_id IN ('SLONY__P017', 'SLONY__P037', 'SLONY__P039', 'SLONY__P056', 'SLONY__P064', 'SLONY__P065', 'SLONY__P068', 'SLONY__P069', 'SLONY__P109', 'SLONY__P113', 'SLONY__P114', 'SLONY__P130')) AS leftovers
  FROM location_product_settings WHERE location_id = 'SLONY';
