-- ============================================================
-- krakow-katowice-rollout — STEP C: remove Warsaw-template leftovers at FORUM / SUPERSAM
-- Date: 2026-10-08. Run AFTER step A, as its own call, with the operator at the screen
-- (lessons.md: a DELETE is never bundled with other writes). Read STEP 0 first.
-- What: every FORUM/SUPERSAM settings row that is NOT in the final set (rollout-notes.md
--   "Usunięte") — 14 at FORUM, 12 at SUPERSAM, 26 in total. All are 0/0/0 template rows
--   except FORUM P017 (0.5/1.5/1.5, Florinis — no city supplier in the sheet).
-- Backup: the literal VALUES below are the full rows as read on 2026-10-08 (all columns).
--   rollback.sql section R-C re-inserts exactly these rows.
-- Expected: DELETE 26 rows; after C: FORUM 104 rows, SUPERSAM 107 rows (= the final set).
-- ============================================================

-- ============================================================
-- STEP 0 — diff before (read-only): the rows that will be deleted -> 26 rows, all 'match'
-- ============================================================
WITH bk(setting_id, location_id, product_id, mn, tg, mx, crit, allow_over, notes, inventory_order) AS (VALUES
  ('FORUM__P017','FORUM','P017',0.5,1.5,1.5,false,false,'',NULL),
  ('FORUM__P037','FORUM','P037',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P039','FORUM','P039',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P056','FORUM','P056',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P099','FORUM','P099',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P103','FORUM','P103',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P109','FORUM','P109',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P111','FORUM','P111',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P112','FORUM','P112',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P113','FORUM','P113',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P114','FORUM','P114',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P125','FORUM','P125',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P128','FORUM','P128',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P170','FORUM','P170',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P017','SUPERSAM','P017',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P037','SUPERSAM','P037',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P039','SUPERSAM','P039',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P056','SUPERSAM','P056',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P099','SUPERSAM','P099',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P103','SUPERSAM','P103',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P109','SUPERSAM','P109',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P111','SUPERSAM','P111',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P112','SUPERSAM','P112',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P113','SUPERSAM','P113',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P114','SUPERSAM','P114',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P130','SUPERSAM','P130',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL)
)
SELECT bk.setting_id, p.product_name_pl, s.min_stock_qty_base::float8 AS min_now,
       s.target_stock_qty_base::float8 AS target_now, s.max_stock_qty_base::float8 AS max_now,
       CASE WHEN s.setting_id IS NULL THEN 'MISSING'
            WHEN (s.location_id, s.product_id, s.min_stock_qty_base, s.target_stock_qty_base,
                  s.max_stock_qty_base, s.is_critical_for_location,
                  s.allow_over_max_due_to_packaging, s.notes, s.inventory_order)
                 IS NOT DISTINCT FROM (bk.location_id, bk.product_id, bk.mn::numeric, bk.tg::numeric,
                  bk.mx::numeric, bk.crit, bk.allow_over, bk.notes, bk.inventory_order::int)
              THEN 'match' ELSE 'DIFFERS' END AS state
  FROM bk
  LEFT JOIN location_product_settings s ON s.setting_id = bk.setting_id
  LEFT JOIN products p ON p.product_id = bk.product_id
 ORDER BY bk.setting_id;

-- ============================================================
-- STEP 1 — delete (one DO block = one transaction)
-- ============================================================
DO $$
DECLARE
  n_match int;
  n_del int;
BEGIN
  IF (SELECT count(*) FROM locations
       WHERE location_id IN ('FORUM','SUPERSAM') AND own_catalog AND active) <> 2 THEN
    RAISE EXCEPTION 'step A not applied (FORUM/SUPERSAM not own_catalog + active) — run A first';
  END IF;
  IF EXISTS (SELECT 1 FROM inventory_counts WHERE location_id IN ('FORUM','SUPERSAM'))
     OR EXISTS (SELECT 1 FROM orders WHERE location_id IN ('FORUM','SUPERSAM')) THEN
    RAISE EXCEPTION 'counts or orders exist at FORUM/SUPERSAM — stop and re-diff';
  END IF;
  IF (SELECT count(*) FROM location_product_settings WHERE location_id = 'FORUM') <> 118
     OR (SELECT count(*) FROM location_product_settings WHERE location_id = 'SUPERSAM') <> 119 THEN
    RAISE EXCEPTION 'FORUM/SUPERSAM should have 118/119 rows after step A';
  END IF;

  -- every backup row must still be byte-identical to what was read on 2026-10-08
  SELECT count(*) INTO n_match
    FROM (VALUES
  ('FORUM__P017','FORUM','P017',0.5,1.5,1.5,false,false,'',NULL),
  ('FORUM__P037','FORUM','P037',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P039','FORUM','P039',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P056','FORUM','P056',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P099','FORUM','P099',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P103','FORUM','P103',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P109','FORUM','P109',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P111','FORUM','P111',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P112','FORUM','P112',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P113','FORUM','P113',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P114','FORUM','P114',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P125','FORUM','P125',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P128','FORUM','P128',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('FORUM__P170','FORUM','P170',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P017','SUPERSAM','P017',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P037','SUPERSAM','P037',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P039','SUPERSAM','P039',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P056','SUPERSAM','P056',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P099','SUPERSAM','P099',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P103','SUPERSAM','P103',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P109','SUPERSAM','P109',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P111','SUPERSAM','P111',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P112','SUPERSAM','P112',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P113','SUPERSAM','P113',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P114','SUPERSAM','P114',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL),
  ('SUPERSAM__P130','SUPERSAM','P130',0,0,0,false,false,'threshold TBC (sheet had no min/max)',NULL)
    ) AS bk(setting_id, location_id, product_id, mn, tg, mx, crit, allow_over, notes, inventory_order)
    JOIN location_product_settings s ON s.setting_id = bk.setting_id
   WHERE (s.location_id, s.product_id, s.min_stock_qty_base, s.target_stock_qty_base,
          s.max_stock_qty_base, s.is_critical_for_location, s.allow_over_max_due_to_packaging,
          s.notes, s.inventory_order)
         IS NOT DISTINCT FROM (bk.location_id, bk.product_id, bk.mn::numeric, bk.tg::numeric,
          bk.mx::numeric, bk.crit, bk.allow_over, bk.notes, bk.inventory_order::int);
  IF n_match <> 26 THEN
    RAISE EXCEPTION 'only % of 26 rows match the 2026-10-08 backup — stop and re-diff', n_match;
  END IF;

  DELETE FROM location_product_settings
   WHERE location_id IN ('FORUM','SUPERSAM')
     AND setting_id IN (
       'FORUM__P017'
      ,'FORUM__P037'
      ,'FORUM__P039'
      ,'FORUM__P056'
      ,'FORUM__P099'
      ,'FORUM__P103'
      ,'FORUM__P109'
      ,'FORUM__P111'
      ,'FORUM__P112'
      ,'FORUM__P113'
      ,'FORUM__P114'
      ,'FORUM__P125'
      ,'FORUM__P128'
      ,'FORUM__P170'
      ,'SUPERSAM__P017'
      ,'SUPERSAM__P037'
      ,'SUPERSAM__P039'
      ,'SUPERSAM__P056'
      ,'SUPERSAM__P099'
      ,'SUPERSAM__P103'
      ,'SUPERSAM__P109'
      ,'SUPERSAM__P111'
      ,'SUPERSAM__P112'
      ,'SUPERSAM__P113'
      ,'SUPERSAM__P114'
      ,'SUPERSAM__P130'
     );
  GET DIAGNOSTICS n_del = ROW_COUNT;
  IF n_del <> 26 THEN RAISE EXCEPTION 'delete touched % rows, expected 26', n_del; END IF;

  IF (SELECT count(*) FROM location_product_settings WHERE location_id = 'FORUM') <> 104
     OR (SELECT count(*) FROM location_product_settings WHERE location_id = 'SUPERSAM') <> 107 THEN
    RAISE EXCEPTION 'after delete FORUM/SUPERSAM should have 104/107 rows';
  END IF;
END $$;

-- ============================================================
-- STEP 2 — audit (read-only)
-- ============================================================

-- a) row counts -> FORUM 104, SUPERSAM 107
SELECT location_id, count(*) FROM location_product_settings
 WHERE location_id IN ('FORUM','SUPERSAM') GROUP BY 1 ORDER BY 1;

-- b) deleted rows gone -> 0 rows
SELECT setting_id FROM location_product_settings
 WHERE location_id IN ('FORUM','SUPERSAM')
   AND product_id IN ('P017', 'P037', 'P039', 'P056', 'P099', 'P103', 'P109', 'P111', 'P112', 'P113', 'P114', 'P125', 'P128', 'P130', 'P170')
   AND setting_id IN ('FORUM__P017', 'FORUM__P037', 'FORUM__P039', 'FORUM__P056', 'FORUM__P099', 'FORUM__P103', 'FORUM__P109', 'FORUM__P111', 'FORUM__P112', 'FORUM__P113', 'FORUM__P114', 'FORUM__P125', 'FORUM__P128', 'FORUM__P170', 'SUPERSAM__P017', 'SUPERSAM__P037', 'SUPERSAM__P039', 'SUPERSAM__P056', 'SUPERSAM__P099', 'SUPERSAM__P103', 'SUPERSAM__P109', 'SUPERSAM__P111', 'SUPERSAM__P112', 'SUPERSAM__P113', 'SUPERSAM__P114', 'SUPERSAM__P130');

-- c) settings at FORUM/SUPERSAM on an inactive product -> 0 rows
SELECT s.location_id, s.product_id FROM location_product_settings s JOIN products p USING (product_id)
 WHERE s.location_id IN ('FORUM','SUPERSAM') AND NOT p.active;
