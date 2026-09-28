-- delivery-calendar — prod rollout (operator-run; lessons: diff before, audit after)
--
-- Order:
--   1. Diff before (save the output).
--   2. Apply migration 0025 BEFORE merging/deploying the backend
--      (supply-os-v1/migrations/0025_delivery_calendar.sql — MCP apply_migration
--      or the Supabase SQL editor). The new backend binds the new order and
--      supplier columns on every insert, so it fails against an unmigrated DB.
--   3. Seed the rules and the two Thursday-prompt flags (can run right after 2).
--   4. Audit after.
-- Rules come from Marek (28.09) and the operator (28.09). A supplier or
-- location missing on prod is SKIPPED by the WHERE EXISTS guard, not failed —
-- step 4 lists what actually landed.

-- ============================================================
-- 1. Diff before
-- ============================================================
SELECT supplier_id, supplier_name, active, delivery_days, cutoff_time
FROM suppliers
ORDER BY supplier_id;

SELECT location_id, location_name, active
FROM locations
ORDER BY location_id;

-- Expect: suggested_delivery_date / coverage_days / coverage_prompt_enabled
-- absent and supplier_delivery_rules missing (0 rows) before step 2.
SELECT table_name, column_name
FROM information_schema.columns
WHERE (table_name = 'orders' AND column_name IN ('suggested_delivery_date', 'coverage_days'))
   OR (table_name = 'suppliers' AND column_name = 'coverage_prompt_enabled')
   OR table_name = 'supplier_delivery_rules'
ORDER BY table_name, column_name;

-- ============================================================
-- 2. Migration 0025 — apply supply-os-v1/migrations/0025_delivery_calendar.sql
-- ============================================================

-- ============================================================
-- 3. Seed
-- ============================================================
WITH v (rule_id, supplier_id, location_id, order_weekdays, lead_days, delivery_weekdays, notes) AS (
    VALUES
    -- Pago and Mory: WOLA, BRACKA order Mon -> Wed; the other Warsaw locations
    -- order Sun -> Tue and Thu -> Sat (Marek 28.09).
    ('DR-PAGO-WOLA',        'SUP_PAGO', 'WOLA',        'Mon',     2, 'Wed',     'Marek 28.09'),
    ('DR-PAGO-BRACKA',      'SUP_PAGO', 'BRACKA',      'Mon',     2, 'Wed',     'Marek 28.09'),
    ('DR-PAGO-NORBLIN',     'SUP_PAGO', 'NORBLIN',     'Sun,Thu', 2, 'Tue,Sat', 'Marek 28.09'),
    ('DR-PAGO-BROWARY',     'SUP_PAGO', 'BROWARY',     'Sun,Thu', 2, 'Tue,Sat', 'Marek 28.09'),
    ('DR-PAGO-ELEKTROWNIA', 'SUP_PAGO', 'ELEKTROWNIA', 'Sun,Thu', 2, 'Tue,Sat', 'Marek 28.09'),
    ('DR-PAGO-WESTFIELD',   'SUP_PAGO', 'WESTFIELD',   'Sun,Thu', 2, 'Tue,Sat', 'Marek 28.09'),
    ('DR-PAGO-KEN',         'SUP_PAGO', 'KEN',         'Sun,Thu', 2, 'Tue,Sat', 'Marek 28.09'),
    ('DR-MORY-WOLA',        'SUP_MORY', 'WOLA',        'Mon',     2, 'Wed',     'Marek 28.09'),
    ('DR-MORY-BRACKA',      'SUP_MORY', 'BRACKA',      'Mon',     2, 'Wed',     'Marek 28.09'),
    ('DR-MORY-NORBLIN',     'SUP_MORY', 'NORBLIN',     'Sun,Thu', 2, 'Tue,Sat', 'Marek 28.09'),
    ('DR-MORY-BROWARY',     'SUP_MORY', 'BROWARY',     'Sun,Thu', 2, 'Tue,Sat', 'Marek 28.09'),
    ('DR-MORY-ELEKTROWNIA', 'SUP_MORY', 'ELEKTROWNIA', 'Sun,Thu', 2, 'Tue,Sat', 'Marek 28.09'),
    ('DR-MORY-WESTFIELD',   'SUP_MORY', 'WESTFIELD',   'Sun,Thu', 2, 'Tue,Sat', 'Marek 28.09'),
    ('DR-MORY-KEN',         'SUP_MORY', 'KEN',         'Sun,Thu', 2, 'Tue,Sat', 'Marek 28.09'),
    -- Filber: order Wed -> Thu.
    ('DR-FILBER-ALL',       'SUP_FILBER', NULL, 'Wed', 1, 'Thu', 'Marek 28.09'),
    -- Bukat, Intermlecz: by 17:00 for the next day, no Sunday deliveries.
    ('DR-BUKAT-ALL',        'SUP_BUKAT',      NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1, 'Mon,Tue,Wed,Thu,Fri,Sat', 'Marek 28.09'),
    ('DR-INTERMLECZ-ALL',   'SUP_INTERMLECZ', NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1, 'Mon,Tue,Wed,Thu,Fri,Sat', 'Marek 28.09'),
    -- Coca-Cola: per location; only WESTFIELD is known (Mon, Tue, Thu, Fri;
    -- order by the evening two days before). Other locations: no row (TBD).
    ('DR-COCACOLA-WESTFIELD', 'SUP_COCACOLA', 'WESTFIELD', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 2, 'Mon,Tue,Thu,Fri', 'Marek 28.09; other locations TBD'),
    -- Business-day suppliers (operator 28.09).
    ('DR-KUCHNIE-ALL',      'SUP_KUCHNIE',  NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1, 'Mon,Tue,Wed,Thu,Fri,Sat', 'operator 28.09'),
    ('DR-EUROFOOD-ALL',     'SUP_EUROFOOD', NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1, 'Mon,Tue,Wed,Thu,Fri',     'operator 28.09 (Go Gastro)'),
    ('DR-SPEC-ALL',         'SUP_SPEC',     NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1, 'Mon,Tue,Wed,Thu,Fri',     'operator 28.09 (days); lead 1 assumed, to confirm'),
    ('DR-KAMINO-ALL',       'SUP_KAMINO',   NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1, 'Mon,Tue,Wed,Thu,Fri',     'operator 28.09 (days); lead 1 assumed, to confirm'),
    ('DR-BLUESERV-ALL',     'SUP_BLUESERV', NULL, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 2, 'Mon,Tue,Wed,Thu,Fri',     'operator 28.09')
)
INSERT INTO supplier_delivery_rules
    (rule_id, supplier_id, location_id, order_weekdays, lead_days, delivery_weekdays, order_deadline, active, notes)
SELECT v.rule_id, v.supplier_id, v.location_id, v.order_weekdays, v.lead_days::smallint,
       v.delivery_weekdays, '17:00', true, v.notes
FROM v
WHERE EXISTS (SELECT 1 FROM suppliers s WHERE s.supplier_id = v.supplier_id)
  AND (v.location_id IS NULL
       OR EXISTS (SELECT 1 FROM locations l WHERE l.location_id = v.location_id))
-- Re-runnable: a corrected value in a later run overwrites the existing row.
ON CONFLICT (rule_id) DO UPDATE SET
    supplier_id       = EXCLUDED.supplier_id,
    location_id       = EXCLUDED.location_id,
    order_weekdays    = EXCLUDED.order_weekdays,
    lead_days         = EXCLUDED.lead_days,
    delivery_weekdays = EXCLUDED.delivery_weekdays,
    order_deadline    = EXCLUDED.order_deadline,
    active            = EXCLUDED.active,
    notes             = EXCLUDED.notes;

-- Converges to exactly this scope on every run (a supplier dropped from the
-- list is switched off again).
UPDATE suppliers
SET coverage_prompt_enabled = (supplier_id IN ('SUP_BUKAT', 'SUP_INTERMLECZ'))
WHERE coverage_prompt_enabled IS DISTINCT FROM (supplier_id IN ('SUP_BUKAT', 'SUP_INTERMLECZ'));

-- ============================================================
-- 4. Audit after
-- ============================================================
-- 4a. Seeded rules (compare with plan.md "Rule model and algorithm"; a missing
--     row = that supplier or location does not exist on prod).
SELECT r.rule_id, r.supplier_id, COALESCE(r.location_id, '(all)') AS location_id,
       r.order_weekdays, r.lead_days, r.delivery_weekdays, r.order_deadline, r.notes
FROM supplier_delivery_rules r
ORDER BY r.supplier_id, r.location_id NULLS FIRST;

-- 4b. Expect 0 rows: a rule whose supplier or location is missing.
SELECT r.rule_id
FROM supplier_delivery_rules r
LEFT JOIN suppliers s ON s.supplier_id = r.supplier_id
LEFT JOIN locations l ON l.location_id = r.location_id
WHERE s.supplier_id IS NULL OR (r.location_id IS NOT NULL AND l.location_id IS NULL);

-- 4c. Expect 0 rows: more than one shared rule per supplier.
SELECT supplier_id, count(*)
FROM supplier_delivery_rules
WHERE location_id IS NULL
GROUP BY supplier_id
HAVING count(*) > 1;

-- 4d. Expect exactly SUP_BUKAT and SUP_INTERMLECZ.
SELECT supplier_id
FROM suppliers
WHERE coverage_prompt_enabled
ORDER BY supplier_id;

-- 4e. Rules skipped by the WHERE EXISTS guard (supplier or location absent).
SELECT v.sid AS missing_supplier
FROM (VALUES ('SUP_MORY'), ('SUP_SPEC'), ('SUP_FILBER'), ('SUP_KAMINO')) AS v (sid)
WHERE NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.supplier_id = v.sid);

SELECT v.lid AS missing_location
FROM (VALUES ('ELEKTROWNIA'), ('WESTFIELD')) AS v (lid)
WHERE NOT EXISTS (SELECT 1 FROM locations l WHERE l.location_id = v.lid);

-- ============================================================
-- Rollback
-- ============================================================
-- DELETE FROM supplier_delivery_rules;
-- UPDATE suppliers SET coverage_prompt_enabled = false
--   WHERE supplier_id IN ('SUP_BUKAT', 'SUP_INTERMLECZ');
-- Then the migration's own rollback block (0025_delivery_calendar.sql header).
