-- pago-suggestion-no-alerts — prod data step (run AFTER migration 0022, operator-approved)
-- Lessons: diff before, audit after.

-- 1. Diff before (save the output — it is the rollback)
SELECT supplier_id, supplier_name, suggestion_alerts_enabled
FROM suppliers
ORDER BY supplier_id;

-- 2. Apply
UPDATE suppliers
SET suggestion_alerts_enabled = false
WHERE supplier_id = 'SUP_PAGO';

-- 3. Audit after: exactly one supplier with alerts off, and it is Pago
SELECT supplier_id, suggestion_alerts_enabled
FROM suppliers
WHERE suggestion_alerts_enabled = false;

-- Rollback
-- UPDATE suppliers SET suggestion_alerts_enabled = true WHERE supplier_id = 'SUP_PAGO';
