-- Batch: 10-forum-settings.sql
-- Purpose: Add location_product_settings rows for every product on FORUM's price list (target = max convention; 0/0/0 + a TBC note where the sheet had no min/max).
-- APPLIED to prod 2026-08-22 (column source_supplier_id stripped -- pre-0008 schema); ON CONFLICT makes re-runs safe.
-- Preconditions:
--   03-locations.sql applied (FORUM row exists)
-- Diff-before (run first, record the result):
--   SELECT product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base FROM location_product_settings WHERE location_id = 'FORUM' AND product_id IN ('P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009', 'P010', 'P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017', 'P018', 'P019', 'P020', 'P021', 'P022', 'P024', 'P026', 'P027', 'P028', 'P029', 'P030', 'P031', 'P032', 'P033', 'P034', 'P035', 'P036', 'P037', 'P038', 'P039', 'P040', 'P041', 'P042', 'P043', 'P044', 'P046', 'P047', 'P048', 'P049', 'P050', 'P051', 'P052', 'P053', 'P054', 'P055', 'P056', 'P057', 'P058', 'P075', 'P076', 'P077', 'P082', 'P083', 'P084', 'P085', 'P086', 'P087', 'P088', 'P089', 'P090', 'P091', 'P092', 'P093', 'P094', 'P095', 'P096', 'P097', 'P098', 'P099', 'P100', 'P101', 'P102', 'P103', 'P104', 'P106', 'P107', 'P109', 'P111', 'P112', 'P113', 'P114', 'P116', 'P117', 'P118', 'P119', 'P121', 'P122', 'P123', 'P125', 'P127', 'P128', 'P129', 'P130', 'P131', 'P132', 'P133', 'P143', 'P144', 'P155', 'P163', 'P164', 'P165', 'P166', 'P167', 'P170');

INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P001', 'FORUM', 'P001', 3, 9, 9, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P002', 'FORUM', 'P002', 0.5, 2, 2, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P003', 'FORUM', 'P003', 1, 2.5, 2.5, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P004', 'FORUM', 'P004', 2, 6, 6, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P005', 'FORUM', 'P005', 1, 2.5, 2.5, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P006', 'FORUM', 'P006', 12, 54, 54, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P007', 'FORUM', 'P007', 10, 35, 35, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P008', 'FORUM', 'P008', 8, 25, 25, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P009', 'FORUM', 'P009', 0.3, 1, 1, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P010', 'FORUM', 'P010', 0.2, 1, 1, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P011', 'FORUM', 'P011', 15, 42, 42, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P012', 'FORUM', 'P012', 3, 9, 9, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P013', 'FORUM', 'P013', 0.5, 1.5, 1.5, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P014', 'FORUM', 'P014', 1, 4, 4, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P015', 'FORUM', 'P015', 24, 100, 100, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P016', 'FORUM', 'P016', 5, 20, 20, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P017', 'FORUM', 'P017', 0.5, 1.5, 1.5, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P018', 'FORUM', 'P018', 0.5, 2, 2, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P019', 'FORUM', 'P019', 0.5, 2, 2, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P020', 'FORUM', 'P020', 5, 20, 20, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P021', 'FORUM', 'P021', 20, 60, 60, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P022', 'FORUM', 'P022', 2, 6, 6, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P024', 'FORUM', 'P024', 4, 15, 15, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P026', 'FORUM', 'P026', 2, 11, 11, FALSE, FALSE, '')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P027', 'FORUM', 'P027', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P028', 'FORUM', 'P028', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P029', 'FORUM', 'P029', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P030', 'FORUM', 'P030', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P031', 'FORUM', 'P031', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P032', 'FORUM', 'P032', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P033', 'FORUM', 'P033', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P034', 'FORUM', 'P034', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P035', 'FORUM', 'P035', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P036', 'FORUM', 'P036', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P037', 'FORUM', 'P037', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P038', 'FORUM', 'P038', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P039', 'FORUM', 'P039', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P040', 'FORUM', 'P040', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P041', 'FORUM', 'P041', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P042', 'FORUM', 'P042', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P043', 'FORUM', 'P043', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P044', 'FORUM', 'P044', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P046', 'FORUM', 'P046', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P047', 'FORUM', 'P047', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P048', 'FORUM', 'P048', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P049', 'FORUM', 'P049', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P050', 'FORUM', 'P050', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P051', 'FORUM', 'P051', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P052', 'FORUM', 'P052', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P053', 'FORUM', 'P053', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P054', 'FORUM', 'P054', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P055', 'FORUM', 'P055', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P056', 'FORUM', 'P056', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P057', 'FORUM', 'P057', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P058', 'FORUM', 'P058', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P075', 'FORUM', 'P075', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P076', 'FORUM', 'P076', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P077', 'FORUM', 'P077', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P082', 'FORUM', 'P082', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P083', 'FORUM', 'P083', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P084', 'FORUM', 'P084', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P085', 'FORUM', 'P085', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P086', 'FORUM', 'P086', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P087', 'FORUM', 'P087', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P088', 'FORUM', 'P088', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P089', 'FORUM', 'P089', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P090', 'FORUM', 'P090', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P091', 'FORUM', 'P091', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P092', 'FORUM', 'P092', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P093', 'FORUM', 'P093', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P094', 'FORUM', 'P094', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P095', 'FORUM', 'P095', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P096', 'FORUM', 'P096', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P097', 'FORUM', 'P097', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P098', 'FORUM', 'P098', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P099', 'FORUM', 'P099', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P100', 'FORUM', 'P100', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P101', 'FORUM', 'P101', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P102', 'FORUM', 'P102', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P103', 'FORUM', 'P103', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P104', 'FORUM', 'P104', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P106', 'FORUM', 'P106', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P107', 'FORUM', 'P107', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P109', 'FORUM', 'P109', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P111', 'FORUM', 'P111', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P112', 'FORUM', 'P112', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P113', 'FORUM', 'P113', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P114', 'FORUM', 'P114', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P116', 'FORUM', 'P116', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P117', 'FORUM', 'P117', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P118', 'FORUM', 'P118', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P119', 'FORUM', 'P119', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P121', 'FORUM', 'P121', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P122', 'FORUM', 'P122', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P123', 'FORUM', 'P123', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P125', 'FORUM', 'P125', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P127', 'FORUM', 'P127', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P128', 'FORUM', 'P128', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P129', 'FORUM', 'P129', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P130', 'FORUM', 'P130', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P131', 'FORUM', 'P131', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P132', 'FORUM', 'P132', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P133', 'FORUM', 'P133', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P143', 'FORUM', 'P143', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P144', 'FORUM', 'P144', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P155', 'FORUM', 'P155', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P163', 'FORUM', 'P163', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P164', 'FORUM', 'P164', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P165', 'FORUM', 'P165', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P166', 'FORUM', 'P166', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P167', 'FORUM', 'P167', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('FORUM__P170', 'FORUM', 'P170', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)')
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT count(*) FROM location_product_settings WHERE location_id = 'FORUM';
-- Rollback:
--   DELETE FROM location_product_settings WHERE location_id = 'FORUM';
