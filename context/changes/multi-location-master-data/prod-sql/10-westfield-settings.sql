-- Batch: 10-westfield-settings.sql
-- Purpose: Add location_product_settings rows for every product on WESTFIELD's price list (target = max convention; 0/0/0 + a TBC note where the sheet had no min/max).
-- APPLIED to prod 2026-08-22 (column source_supplier_id stripped -- pre-0008 schema); ON CONFLICT makes re-runs safe.
-- Preconditions:
--   03-locations.sql applied (WESTFIELD row exists)
-- Diff-before (run first, record the result):
--   SELECT product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base FROM location_product_settings WHERE location_id = 'WESTFIELD' AND product_id IN ('P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009', 'P010', 'P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017', 'P018', 'P019', 'P020', 'P024', 'P027', 'P028', 'P029', 'P030', 'P031', 'P032', 'P033', 'P034', 'P035', 'P036', 'P038', 'P039', 'P040', 'P041', 'P042', 'P043', 'P044', 'P046', 'P047', 'P048', 'P049', 'P050', 'P051', 'P052', 'P053', 'P054', 'P055', 'P056', 'P057', 'P058', 'P064', 'P065', 'P066', 'P067', 'P068', 'P069', 'P070', 'P071', 'P075', 'P076', 'P077', 'P082', 'P083', 'P084', 'P085', 'P086', 'P087', 'P088', 'P089', 'P091', 'P092', 'P093', 'P094', 'P095', 'P096', 'P097', 'P098', 'P099', 'P100', 'P101', 'P102', 'P103', 'P104', 'P106', 'P107', 'P109', 'P111', 'P112', 'P113', 'P114', 'P116', 'P117', 'P118', 'P119', 'P121', 'P122', 'P123', 'P125', 'P127', 'P129', 'P131', 'P132', 'P133', 'P143', 'P144');

INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P001', 'WESTFIELD', 'P001', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P002', 'WESTFIELD', 'P002', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P003', 'WESTFIELD', 'P003', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P004', 'WESTFIELD', 'P004', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P005', 'WESTFIELD', 'P005', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P006', 'WESTFIELD', 'P006', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P007', 'WESTFIELD', 'P007', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P008', 'WESTFIELD', 'P008', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P009', 'WESTFIELD', 'P009', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P010', 'WESTFIELD', 'P010', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P011', 'WESTFIELD', 'P011', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P012', 'WESTFIELD', 'P012', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P013', 'WESTFIELD', 'P013', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P014', 'WESTFIELD', 'P014', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P015', 'WESTFIELD', 'P015', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P016', 'WESTFIELD', 'P016', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P017', 'WESTFIELD', 'P017', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P018', 'WESTFIELD', 'P018', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P019', 'WESTFIELD', 'P019', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P020', 'WESTFIELD', 'P020', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P024', 'WESTFIELD', 'P024', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P027', 'WESTFIELD', 'P027', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P028', 'WESTFIELD', 'P028', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P029', 'WESTFIELD', 'P029', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P030', 'WESTFIELD', 'P030', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P031', 'WESTFIELD', 'P031', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P032', 'WESTFIELD', 'P032', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P033', 'WESTFIELD', 'P033', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P034', 'WESTFIELD', 'P034', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P035', 'WESTFIELD', 'P035', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P036', 'WESTFIELD', 'P036', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P038', 'WESTFIELD', 'P038', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P039', 'WESTFIELD', 'P039', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P040', 'WESTFIELD', 'P040', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P041', 'WESTFIELD', 'P041', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P042', 'WESTFIELD', 'P042', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P043', 'WESTFIELD', 'P043', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P044', 'WESTFIELD', 'P044', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P046', 'WESTFIELD', 'P046', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P047', 'WESTFIELD', 'P047', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P048', 'WESTFIELD', 'P048', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P049', 'WESTFIELD', 'P049', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P050', 'WESTFIELD', 'P050', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P051', 'WESTFIELD', 'P051', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P052', 'WESTFIELD', 'P052', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P053', 'WESTFIELD', 'P053', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P054', 'WESTFIELD', 'P054', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P055', 'WESTFIELD', 'P055', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P056', 'WESTFIELD', 'P056', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P057', 'WESTFIELD', 'P057', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P058', 'WESTFIELD', 'P058', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P064', 'WESTFIELD', 'P064', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P065', 'WESTFIELD', 'P065', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P066', 'WESTFIELD', 'P066', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P067', 'WESTFIELD', 'P067', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P068', 'WESTFIELD', 'P068', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P069', 'WESTFIELD', 'P069', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P070', 'WESTFIELD', 'P070', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P071', 'WESTFIELD', 'P071', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P075', 'WESTFIELD', 'P075', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P076', 'WESTFIELD', 'P076', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P077', 'WESTFIELD', 'P077', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P082', 'WESTFIELD', 'P082', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P083', 'WESTFIELD', 'P083', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P084', 'WESTFIELD', 'P084', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P085', 'WESTFIELD', 'P085', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P086', 'WESTFIELD', 'P086', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P087', 'WESTFIELD', 'P087', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P088', 'WESTFIELD', 'P088', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P089', 'WESTFIELD', 'P089', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P091', 'WESTFIELD', 'P091', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P092', 'WESTFIELD', 'P092', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P093', 'WESTFIELD', 'P093', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P094', 'WESTFIELD', 'P094', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P095', 'WESTFIELD', 'P095', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P096', 'WESTFIELD', 'P096', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P097', 'WESTFIELD', 'P097', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P098', 'WESTFIELD', 'P098', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P099', 'WESTFIELD', 'P099', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P100', 'WESTFIELD', 'P100', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P101', 'WESTFIELD', 'P101', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P102', 'WESTFIELD', 'P102', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P103', 'WESTFIELD', 'P103', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P104', 'WESTFIELD', 'P104', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P106', 'WESTFIELD', 'P106', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P107', 'WESTFIELD', 'P107', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P109', 'WESTFIELD', 'P109', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P111', 'WESTFIELD', 'P111', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P112', 'WESTFIELD', 'P112', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P113', 'WESTFIELD', 'P113', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P114', 'WESTFIELD', 'P114', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P116', 'WESTFIELD', 'P116', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P117', 'WESTFIELD', 'P117', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P118', 'WESTFIELD', 'P118', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P119', 'WESTFIELD', 'P119', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P121', 'WESTFIELD', 'P121', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P122', 'WESTFIELD', 'P122', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P123', 'WESTFIELD', 'P123', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P125', 'WESTFIELD', 'P125', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P127', 'WESTFIELD', 'P127', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P129', 'WESTFIELD', 'P129', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P131', 'WESTFIELD', 'P131', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P132', 'WESTFIELD', 'P132', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P133', 'WESTFIELD', 'P133', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P143', 'WESTFIELD', 'P143', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WESTFIELD__P144', 'WESTFIELD', 'P144', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT count(*) FROM location_product_settings WHERE location_id = 'WESTFIELD';
-- Rollback:
--   DELETE FROM location_product_settings WHERE location_id = 'WESTFIELD';
