-- ============================================================================
-- dynamic-target-wola — prod Supabase (lpzhphufjwrndfogkfub) data package
-- Status: NOT APPLIED. Every section below needs the operator's explicit "tak".
-- Order: A (migration) -> C (calendars) -> B (usage rows) -> D (max ceilings)
--        -> deploy code. E is optional. Run the AFTER audit at the end.
-- Rule (lessons.md "diff before, audit after"): the BEFORE blocks are the
-- rollback; do not run an UPDATE without re-checking its BEFORE value first.
-- ============================================================================

-- ============================ A. MIGRATION 0018 ===========================
-- Apply supply-os-v1/migrations/0018_location_product_usage.sql verbatim
-- (Supabase MCP apply_migration or the SQL editor). Creates the table + RLS.
-- Rollback: DROP TABLE IF EXISTS location_product_usage;

-- ============================ C. SUPPLIER CALENDARS (MANDATORY) ============
-- BEFORE (checked 2026-09-07, SELECT on prod):
--   SUP_PAGO      delivery_days = 'Tue'   cutoff_time = '14:00'
--   SUP_COCACOLA  delivery_days = 'TBD'   cutoff_time = 'TBD'
-- Source of the new values: GoStock PZ dates 24.03–29.08.2026 in every
-- Warsaw location (Pago Tue + Sat, Coca-Cola Thu). Ask Marek first whether the
-- PZ date is the physical delivery date (question 1 in the email draft).
-- Without C the engine computes a 7-day Pago horizon (single weekday) and
-- Coca-Cola stays static ('TBD' is unparseable).
SELECT supplier_id, delivery_days, cutoff_time FROM suppliers
 WHERE supplier_id IN ('SUP_PAGO', 'SUP_COCACOLA');
UPDATE suppliers SET delivery_days = 'Tue, Sat',
       notes = notes || ' | dynamic-target-wola 2026-09-07: Tue+Sat from GoStock PZ dates (was Tue)'
 WHERE supplier_id = 'SUP_PAGO' AND delivery_days = 'Tue';
UPDATE suppliers SET delivery_days = 'Thu',
       notes = notes || ' | dynamic-target-wola 2026-09-07: Thu from GoStock PZ dates (was TBD)'
 WHERE supplier_id = 'SUP_COCACOLA' AND delivery_days = 'TBD';
-- Rollback C:
--   UPDATE suppliers SET delivery_days = 'Tue' WHERE supplier_id = 'SUP_PAGO';
--   UPDATE suppliers SET delivery_days = 'TBD' WHERE supplier_id = 'SUP_COCACOLA';

-- ============================ B. USAGE ROWS, WOLA (MANDATORY) ==============
-- BEFORE assertion (must return 0 — the table is new):
SELECT count(*) AS before_rows FROM location_product_usage WHERE location_id = 'WOLA';
-- Values = docs/pita-supply-os-v1/seed/location_product_usage.csv
-- (target_seed.csv, 8 weeks to 2026-08-30, pita already in opak = szt/10).
-- Confidence C rows are inserted for transparency; the engine ignores them.
INSERT INTO location_product_usage
  (usage_id, location_id, product_id, usage_per_day_base, confidence, basis, source, as_of, safety_days, active, notes)
VALUES
  ('WOLA__P024','WOLA','P024',12.75,'A','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Gyros 15 KG; 8 weeks to 2026-08-30'),
  ('WOLA__P026','WOLA','P026',9.4,'A','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Pita (opakowania) szt 10; 8 weeks to 2026-08-30'),
  ('WOLA__P027','WOLA','P027',12.5,'A','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Souvlaki Kurczak; 8 weeks to 2026-08-30'),
  ('WOLA__P028','WOLA','P028',2.25,'A','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Souvlaki Wieprz; 8 weeks to 2026-08-30'),
  ('WOLA__P063','WOLA','P063',0.02,'C','POS_only','gostock-2026-09-06',DATE '2026-08-30',1,true,'Monster (wszystkie); 8 weeks to 2026-08-30'),
  ('WOLA__P064','WOLA','P064',0.2,'C','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Cappy Jabłko; 8 weeks to 2026-08-30'),
  ('WOLA__P065','WOLA','P065',0.33,'B','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Cappy Pomarańcza; 8 weeks to 2026-08-30'),
  ('WOLA__P066','WOLA','P066',0.88,'B','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Fanta; 8 weeks to 2026-08-30'),
  ('WOLA__P067','WOLA','P067',0.82,'A','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Sprite; 8 weeks to 2026-08-30'),
  ('WOLA__P068','WOLA','P068',4.53,'A','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Coca Cola; 8 weeks to 2026-08-30'),
  ('WOLA__P069','WOLA','P069',7.77,'A','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Coca Cola Zero; 8 weeks to 2026-08-30'),
  ('WOLA__P070','WOLA','P070',1.2,'B','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Kropla Beskidu Niegazowana; 8 weeks to 2026-08-30'),
  ('WOLA__P071','WOLA','P071',0.32,'B','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Kropla Beskidu Gazowana; 8 weeks to 2026-08-30'),
  ('WOLA__P074','WOLA','P074',0.77,'A','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Corona; 8 weeks to 2026-08-30'),
  ('WOLA__P078','WOLA','P078',0.0,'C','POS_only','gostock-2026-09-06',DATE '2026-08-30',1,true,'Lech Free; 8 weeks to 2026-08-30'),
  ('WOLA__P079','WOLA','P079',0.34,'C','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Kinley; 8 weeks to 2026-08-30'),
  ('WOLA__P080','WOLA','P080',0.37,'C','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Corona 0%; 8 weeks to 2026-08-30'),
  ('WOLA__P081','WOLA','P081',0.12,'C','purch+teoret+real','gostock-2026-09-06',DATE '2026-08-30',1,true,'Fuzetea; 8 weeks to 2026-08-30');
-- Rollback B:
--   DELETE FROM location_product_usage WHERE source = 'gostock-2026-09-06';

-- ============================ D. MAX CEILINGS, WOLA (MANDATORY with B) =====
-- Static max = target everywhere at Wola; the dynamic target (5 days Pago,
-- 10 days Coca-Cola) sits above it, so the card would read "Cel 76 · Max 10".
-- The engine already raises the EFFECTIVE max to the target, but the stored
-- ceiling should be a real one: max = 7 days of usage + safety (rounded up).
-- Rows whose current max already covers that are left alone; C rows untouched.
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base, notes
  FROM location_product_settings WHERE location_id = 'WOLA'
   AND product_id IN ('P024','P026','P027','P028','P063','P064','P065','P066','P067','P068','P069','P070','P071','P074','P078','P079','P080','P081');
UPDATE location_product_settings SET max_stock_qty_base = 102.1, notes = notes || ' | dynamic-target-wola: max = 7-day cover (was 10)' WHERE setting_id = 'WOLA__P024';  -- Gyros 15 KG: BEFORE max 10, usage 12.75/d
UPDATE location_product_settings SET max_stock_qty_base = 76, notes = notes || ' | dynamic-target-wola: max = 7-day cover (was 5)' WHERE setting_id = 'WOLA__P026';  -- Pita (opakowania) szt 10: BEFORE max 5, usage 9.4/d
UPDATE location_product_settings SET max_stock_qty_base = 100, notes = notes || ' | dynamic-target-wola: max = 7-day cover (was 12)' WHERE setting_id = 'WOLA__P027';  -- Souvlaki Kurczak: BEFORE max 12, usage 12.5/d
UPDATE location_product_settings SET max_stock_qty_base = 18.1, notes = notes || ' | dynamic-target-wola: max = 7-day cover (was 4)' WHERE setting_id = 'WOLA__P028';  -- Souvlaki Wieprz: BEFORE max 4, usage 2.25/d
-- Rollback D: restore the BEFORE max from the comment on each line.

-- ============================ E. LOWER MINS, WOLA (OPTIONAL) ===============
-- 12 of the 18 rows carry min values marked "ESTIM - verify after first order
-- cycle" (12–24 szt = 2–7 weeks of usage for the slow beverages). The engine
-- caps their effect at 3 days of usage (SAFETY_CAP_DAYS), so these rows only
-- change the "Poniżej minimum" signal on a STATIC target and the stored data
-- hygiene. Proposal: min = 3 days of usage, rounded up, at least 1.
UPDATE location_product_settings SET min_stock_qty_base = 1, notes = notes || ' | dynamic-target-wola: min = 3 days of usage (was 12)' WHERE setting_id = 'WOLA__P065';  -- Cappy Pomarańcza: BEFORE min 12, usage 0.33/d
UPDATE location_product_settings SET min_stock_qty_base = 3, notes = notes || ' | dynamic-target-wola: min = 3 days of usage (was 12)' WHERE setting_id = 'WOLA__P066';  -- Fanta: BEFORE min 12, usage 0.88/d
UPDATE location_product_settings SET min_stock_qty_base = 3, notes = notes || ' | dynamic-target-wola: min = 3 days of usage (was 12)' WHERE setting_id = 'WOLA__P067';  -- Sprite: BEFORE min 12, usage 0.82/d
UPDATE location_product_settings SET min_stock_qty_base = 14, notes = notes || ' | dynamic-target-wola: min = 3 days of usage (was 24)' WHERE setting_id = 'WOLA__P068';  -- Coca Cola: BEFORE min 24, usage 4.53/d
UPDATE location_product_settings SET min_stock_qty_base = 4, notes = notes || ' | dynamic-target-wola: min = 3 days of usage (was 24)' WHERE setting_id = 'WOLA__P070';  -- Kropla Beskidu Niegazowana: BEFORE min 24, usage 1.2/d
UPDATE location_product_settings SET min_stock_qty_base = 1, notes = notes || ' | dynamic-target-wola: min = 3 days of usage (was 24)' WHERE setting_id = 'WOLA__P071';  -- Kropla Beskidu Gazowana: BEFORE min 24, usage 0.32/d
UPDATE location_product_settings SET min_stock_qty_base = 3, notes = notes || ' | dynamic-target-wola: min = 3 days of usage (was 12)' WHERE setting_id = 'WOLA__P074';  -- Corona: BEFORE min 12, usage 0.77/d
-- Rollback E: restore the BEFORE min from the comment on each line.

-- ============================ AFTER AUDIT ==================================
SELECT count(*) AS usage_rows, count(*) FILTER (WHERE confidence IN ('A','B')) AS trusted
  FROM location_product_usage WHERE location_id = 'WOLA';                 -- expect 18 / 12
SELECT supplier_id, delivery_days FROM suppliers
 WHERE supplier_id IN ('SUP_PAGO','SUP_COCACOLA');                        -- 'Tue, Sat' / 'Thu'
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base
  FROM location_product_settings
 WHERE location_id = 'WOLA' AND (min_stock_qty_base > target_stock_qty_base
    OR target_stock_qty_base > max_stock_qty_base);                       -- expect 0 rows
SELECT u.product_id, u.usage_per_day_base, s.max_stock_qty_base
  FROM location_product_usage u JOIN location_product_settings s
    ON s.location_id = u.location_id AND s.product_id = u.product_id
 WHERE u.location_id = 'WOLA' AND u.confidence IN ('A','B')
   AND s.max_stock_qty_base < u.usage_per_day_base * 7;                   -- expect 0 rows
