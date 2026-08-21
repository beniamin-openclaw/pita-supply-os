-- Batch: 10-stary_browar-settings.sql
-- Purpose: Add location_product_settings rows for every product on STARY_BROWAR's price list (target = max convention; 0/0/0 + a TBC note where the sheet had no min/max).
-- APPLIED to prod 2026-08-22 (column source_supplier_id stripped -- pre-0008 schema); ON CONFLICT makes re-runs safe.
-- Preconditions:
--   03-locations.sql applied (STARY_BROWAR row exists)
-- Diff-before (run first, record the result):
--   SELECT product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base FROM location_product_settings WHERE location_id = 'STARY_BROWAR' AND product_id IN ('P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009', 'P010', 'P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017', 'P018', 'P019', 'P020', 'P021', 'P022', 'P023', 'P024', 'P025', 'P026', 'P027', 'P028', 'P029', 'P030', 'P031', 'P032', 'P033', 'P034', 'P035', 'P036', 'P037', 'P038', 'P039', 'P040', 'P042', 'P043', 'P044', 'P046', 'P047', 'P048', 'P049', 'P050', 'P051', 'P052', 'P053', 'P054', 'P055', 'P056', 'P057', 'P058', 'P059', 'P060', 'P061', 'P062', 'P064', 'P065', 'P066', 'P067', 'P068', 'P069', 'P070', 'P071', 'P072', 'P073', 'P075', 'P076', 'P077', 'P082', 'P083', 'P084', 'P085', 'P086', 'P087', 'P088', 'P089', 'P090', 'P091', 'P092', 'P093', 'P094', 'P095', 'P096', 'P097', 'P098', 'P099', 'P100', 'P101', 'P102', 'P103', 'P104', 'P106', 'P107', 'P109', 'P110', 'P111', 'P112', 'P113', 'P115', 'P116', 'P117', 'P118', 'P119', 'P120', 'P121', 'P122', 'P123', 'P124', 'P125', 'P126', 'P127', 'P129', 'P130', 'P131', 'P132', 'P133', 'P136', 'P137', 'P138', 'P156', 'P157', 'P175');

INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P001', 'STARY_BROWAR', 'P001', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P002', 'STARY_BROWAR', 'P002', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P003', 'STARY_BROWAR', 'P003', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P004', 'STARY_BROWAR', 'P004', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P005', 'STARY_BROWAR', 'P005', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P006', 'STARY_BROWAR', 'P006', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P007', 'STARY_BROWAR', 'P007', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P008', 'STARY_BROWAR', 'P008', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P009', 'STARY_BROWAR', 'P009', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P010', 'STARY_BROWAR', 'P010', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P011', 'STARY_BROWAR', 'P011', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P012', 'STARY_BROWAR', 'P012', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P013', 'STARY_BROWAR', 'P013', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P014', 'STARY_BROWAR', 'P014', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P015', 'STARY_BROWAR', 'P015', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P016', 'STARY_BROWAR', 'P016', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P017', 'STARY_BROWAR', 'P017', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P018', 'STARY_BROWAR', 'P018', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P019', 'STARY_BROWAR', 'P019', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P020', 'STARY_BROWAR', 'P020', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P021', 'STARY_BROWAR', 'P021', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P022', 'STARY_BROWAR', 'P022', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P023', 'STARY_BROWAR', 'P023', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P024', 'STARY_BROWAR', 'P024', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P025', 'STARY_BROWAR', 'P025', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P026', 'STARY_BROWAR', 'P026', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P027', 'STARY_BROWAR', 'P027', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P028', 'STARY_BROWAR', 'P028', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P029', 'STARY_BROWAR', 'P029', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P030', 'STARY_BROWAR', 'P030', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P031', 'STARY_BROWAR', 'P031', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P032', 'STARY_BROWAR', 'P032', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P033', 'STARY_BROWAR', 'P033', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P034', 'STARY_BROWAR', 'P034', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P035', 'STARY_BROWAR', 'P035', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P036', 'STARY_BROWAR', 'P036', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P037', 'STARY_BROWAR', 'P037', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P038', 'STARY_BROWAR', 'P038', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P039', 'STARY_BROWAR', 'P039', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P040', 'STARY_BROWAR', 'P040', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P042', 'STARY_BROWAR', 'P042', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P043', 'STARY_BROWAR', 'P043', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P044', 'STARY_BROWAR', 'P044', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P046', 'STARY_BROWAR', 'P046', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P047', 'STARY_BROWAR', 'P047', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P048', 'STARY_BROWAR', 'P048', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P049', 'STARY_BROWAR', 'P049', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P050', 'STARY_BROWAR', 'P050', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P051', 'STARY_BROWAR', 'P051', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P052', 'STARY_BROWAR', 'P052', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P053', 'STARY_BROWAR', 'P053', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P054', 'STARY_BROWAR', 'P054', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P055', 'STARY_BROWAR', 'P055', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P056', 'STARY_BROWAR', 'P056', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P057', 'STARY_BROWAR', 'P057', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P058', 'STARY_BROWAR', 'P058', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P059', 'STARY_BROWAR', 'P059', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P060', 'STARY_BROWAR', 'P060', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P061', 'STARY_BROWAR', 'P061', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P062', 'STARY_BROWAR', 'P062', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P064', 'STARY_BROWAR', 'P064', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P065', 'STARY_BROWAR', 'P065', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P066', 'STARY_BROWAR', 'P066', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P067', 'STARY_BROWAR', 'P067', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P068', 'STARY_BROWAR', 'P068', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P069', 'STARY_BROWAR', 'P069', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P070', 'STARY_BROWAR', 'P070', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P071', 'STARY_BROWAR', 'P071', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P072', 'STARY_BROWAR', 'P072', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P073', 'STARY_BROWAR', 'P073', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P075', 'STARY_BROWAR', 'P075', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P076', 'STARY_BROWAR', 'P076', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P077', 'STARY_BROWAR', 'P077', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P082', 'STARY_BROWAR', 'P082', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P083', 'STARY_BROWAR', 'P083', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P084', 'STARY_BROWAR', 'P084', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P085', 'STARY_BROWAR', 'P085', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P086', 'STARY_BROWAR', 'P086', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P087', 'STARY_BROWAR', 'P087', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P088', 'STARY_BROWAR', 'P088', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P089', 'STARY_BROWAR', 'P089', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P090', 'STARY_BROWAR', 'P090', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P091', 'STARY_BROWAR', 'P091', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P092', 'STARY_BROWAR', 'P092', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P093', 'STARY_BROWAR', 'P093', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P094', 'STARY_BROWAR', 'P094', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P095', 'STARY_BROWAR', 'P095', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P096', 'STARY_BROWAR', 'P096', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P097', 'STARY_BROWAR', 'P097', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P098', 'STARY_BROWAR', 'P098', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P099', 'STARY_BROWAR', 'P099', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P100', 'STARY_BROWAR', 'P100', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P101', 'STARY_BROWAR', 'P101', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P102', 'STARY_BROWAR', 'P102', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P103', 'STARY_BROWAR', 'P103', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P104', 'STARY_BROWAR', 'P104', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P106', 'STARY_BROWAR', 'P106', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P107', 'STARY_BROWAR', 'P107', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P109', 'STARY_BROWAR', 'P109', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P110', 'STARY_BROWAR', 'P110', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P111', 'STARY_BROWAR', 'P111', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P112', 'STARY_BROWAR', 'P112', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P113', 'STARY_BROWAR', 'P113', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P115', 'STARY_BROWAR', 'P115', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P116', 'STARY_BROWAR', 'P116', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P117', 'STARY_BROWAR', 'P117', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P118', 'STARY_BROWAR', 'P118', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P119', 'STARY_BROWAR', 'P119', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P120', 'STARY_BROWAR', 'P120', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P121', 'STARY_BROWAR', 'P121', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P122', 'STARY_BROWAR', 'P122', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P123', 'STARY_BROWAR', 'P123', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P124', 'STARY_BROWAR', 'P124', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P125', 'STARY_BROWAR', 'P125', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P126', 'STARY_BROWAR', 'P126', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P127', 'STARY_BROWAR', 'P127', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P129', 'STARY_BROWAR', 'P129', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P130', 'STARY_BROWAR', 'P130', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P131', 'STARY_BROWAR', 'P131', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P132', 'STARY_BROWAR', 'P132', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P133', 'STARY_BROWAR', 'P133', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P136', 'STARY_BROWAR', 'P136', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P137', 'STARY_BROWAR', 'P137', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P138', 'STARY_BROWAR', 'P138', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P156', 'STARY_BROWAR', 'P156', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P157', 'STARY_BROWAR', 'P157', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('STARY_BROWAR__P175', 'STARY_BROWAR', 'P175', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT count(*) FROM location_product_settings WHERE location_id = 'STARY_BROWAR';
-- Rollback:
--   DELETE FROM location_product_settings WHERE location_id = 'STARY_BROWAR';
