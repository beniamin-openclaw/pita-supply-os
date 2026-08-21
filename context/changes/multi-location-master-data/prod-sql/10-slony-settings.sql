-- Batch: 10-slony-settings.sql
-- Purpose: Add location_product_settings rows for every product on SLONY's price list (target = max convention; 0/0/0 + a TBC note where the sheet had no min/max).
-- APPLIED to prod 2026-08-22 (column source_supplier_id stripped -- pre-0008 schema); ON CONFLICT makes re-runs safe.
-- Preconditions:
--   03-locations.sql applied (SLONY row exists)
-- Diff-before (run first, record the result):
--   SELECT product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base FROM location_product_settings WHERE location_id = 'SLONY' AND product_id IN ('P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009', 'P010', 'P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017', 'P018', 'P019', 'P020', 'P021', 'P022', 'P023', 'P024', 'P026', 'P027', 'P028', 'P029', 'P030', 'P031', 'P032', 'P033', 'P034', 'P035', 'P036', 'P037', 'P038', 'P039', 'P040', 'P041', 'P042', 'P043', 'P044', 'P046', 'P047', 'P048', 'P049', 'P050', 'P051', 'P052', 'P053', 'P054', 'P055', 'P056', 'P057', 'P058', 'P064', 'P065', 'P066', 'P067', 'P068', 'P069', 'P070', 'P071', 'P075', 'P076', 'P077', 'P082', 'P083', 'P084', 'P085', 'P086', 'P087', 'P088', 'P089', 'P090', 'P091', 'P092', 'P093', 'P094', 'P095', 'P096', 'P097', 'P098', 'P099', 'P100', 'P101', 'P102', 'P103', 'P104', 'P106', 'P107', 'P109', 'P111', 'P112', 'P113', 'P114', 'P116', 'P117', 'P118', 'P119', 'P121', 'P122', 'P123', 'P125', 'P127', 'P129', 'P130', 'P131', 'P132', 'P133', 'P143', 'P144');

INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P001', 'SLONY', 'P001', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P002', 'SLONY', 'P002', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P003', 'SLONY', 'P003', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P004', 'SLONY', 'P004', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P005', 'SLONY', 'P005', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P006', 'SLONY', 'P006', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P007', 'SLONY', 'P007', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P008', 'SLONY', 'P008', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P009', 'SLONY', 'P009', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P010', 'SLONY', 'P010', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P011', 'SLONY', 'P011', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P012', 'SLONY', 'P012', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P013', 'SLONY', 'P013', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P014', 'SLONY', 'P014', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P015', 'SLONY', 'P015', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P016', 'SLONY', 'P016', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P017', 'SLONY', 'P017', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P018', 'SLONY', 'P018', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P019', 'SLONY', 'P019', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P020', 'SLONY', 'P020', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P021', 'SLONY', 'P021', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P022', 'SLONY', 'P022', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P023', 'SLONY', 'P023', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P024', 'SLONY', 'P024', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P026', 'SLONY', 'P026', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P027', 'SLONY', 'P027', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P028', 'SLONY', 'P028', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P029', 'SLONY', 'P029', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P030', 'SLONY', 'P030', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P031', 'SLONY', 'P031', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P032', 'SLONY', 'P032', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P033', 'SLONY', 'P033', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P034', 'SLONY', 'P034', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P035', 'SLONY', 'P035', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P036', 'SLONY', 'P036', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P037', 'SLONY', 'P037', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P038', 'SLONY', 'P038', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P039', 'SLONY', 'P039', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P040', 'SLONY', 'P040', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P041', 'SLONY', 'P041', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P042', 'SLONY', 'P042', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P043', 'SLONY', 'P043', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P044', 'SLONY', 'P044', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P046', 'SLONY', 'P046', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P047', 'SLONY', 'P047', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P048', 'SLONY', 'P048', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P049', 'SLONY', 'P049', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P050', 'SLONY', 'P050', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P051', 'SLONY', 'P051', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P052', 'SLONY', 'P052', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P053', 'SLONY', 'P053', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P054', 'SLONY', 'P054', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P055', 'SLONY', 'P055', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P056', 'SLONY', 'P056', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P057', 'SLONY', 'P057', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P058', 'SLONY', 'P058', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P064', 'SLONY', 'P064', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P065', 'SLONY', 'P065', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P066', 'SLONY', 'P066', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P067', 'SLONY', 'P067', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P068', 'SLONY', 'P068', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P069', 'SLONY', 'P069', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P070', 'SLONY', 'P070', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P071', 'SLONY', 'P071', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P075', 'SLONY', 'P075', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P076', 'SLONY', 'P076', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P077', 'SLONY', 'P077', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P082', 'SLONY', 'P082', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P083', 'SLONY', 'P083', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P084', 'SLONY', 'P084', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P085', 'SLONY', 'P085', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P086', 'SLONY', 'P086', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P087', 'SLONY', 'P087', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P088', 'SLONY', 'P088', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P089', 'SLONY', 'P089', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P090', 'SLONY', 'P090', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P091', 'SLONY', 'P091', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P092', 'SLONY', 'P092', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P093', 'SLONY', 'P093', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P094', 'SLONY', 'P094', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P095', 'SLONY', 'P095', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P096', 'SLONY', 'P096', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P097', 'SLONY', 'P097', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P098', 'SLONY', 'P098', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P099', 'SLONY', 'P099', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P100', 'SLONY', 'P100', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P101', 'SLONY', 'P101', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P102', 'SLONY', 'P102', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P103', 'SLONY', 'P103', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P104', 'SLONY', 'P104', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P106', 'SLONY', 'P106', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P107', 'SLONY', 'P107', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P109', 'SLONY', 'P109', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P111', 'SLONY', 'P111', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P112', 'SLONY', 'P112', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P113', 'SLONY', 'P113', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P114', 'SLONY', 'P114', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P116', 'SLONY', 'P116', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P117', 'SLONY', 'P117', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P118', 'SLONY', 'P118', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P119', 'SLONY', 'P119', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P121', 'SLONY', 'P121', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P122', 'SLONY', 'P122', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P123', 'SLONY', 'P123', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P125', 'SLONY', 'P125', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P127', 'SLONY', 'P127', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P129', 'SLONY', 'P129', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P130', 'SLONY', 'P130', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P131', 'SLONY', 'P131', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P132', 'SLONY', 'P132', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P133', 'SLONY', 'P133', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P143', 'SLONY', 'P143', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('SLONY__P144', 'SLONY', 'P144', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT count(*) FROM location_product_settings WHERE location_id = 'SLONY';
-- Rollback:
--   DELETE FROM location_product_settings WHERE location_id = 'SLONY';
