-- Batch: 00-shared-suppliers.sql
-- Purpose: Add supplier(s) that appear in the onboarding sheets but do not yet exist in the suppliers table (inactive — same pattern as SUP_ALLEGRO; ordering_method unconfirmed, operator fills in).
-- Preconditions:
--   none — additive, inactive rows only
-- Diff-before (run first, record the result):
--   SELECT supplier_id, supplier_name, active FROM suppliers WHERE supplier_id IN ('SUP_SELGROS', 'SUP_SPEC');

INSERT INTO suppliers (supplier_id, supplier_name, email, ordering_method, delivery_days, cutoff_time, minimum_order_value_pln, active, notes)
VALUES ('SUP_SELGROS', 'Selgros', NULL, 'manual', NULL, NULL, NULL, FALSE, 'method TBC by operator')
ON CONFLICT (supplier_id) DO NOTHING;
INSERT INTO suppliers (supplier_id, supplier_name, email, ordering_method, delivery_days, cutoff_time, minimum_order_value_pln, active, notes)
VALUES ('SUP_SPEC', 'Spec Food', NULL, 'manual', NULL, NULL, NULL, FALSE, 'method TBC by operator')
ON CONFLICT (supplier_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT supplier_id, supplier_name, active FROM suppliers WHERE supplier_id IN ('SUP_SELGROS', 'SUP_SPEC');
-- Rollback:
--   DELETE FROM suppliers WHERE supplier_id IN ('SUP_SELGROS', 'SUP_SPEC');
