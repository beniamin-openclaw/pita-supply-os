-- Batch: 10-supersam-settings.sql
-- Purpose: Add location_product_settings rows for every product on SUPERSAM's price list (target = max convention; 0/0/0 + a TBC note where the sheet had no min/max).
-- Preconditions:
--   03-locations.sql applied (SUPERSAM row exists)
-- Diff-before (run first, record the result):
--   SELECT product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base FROM location_product_settings WHERE location_id = 'SUPERSAM' AND product_id IN ('P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009', 'P010', 'P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017', 'P018', 'P019', 'P020', 'P021', 'P022', 'P023', 'P024', 'P026', 'P027', 'P028', 'P029', 'P030', 'P031', 'P032', 'P033', 'P034', 'P035', 'P036', 'P037', 'P038', 'P039', 'P040', 'P041', 'P042', 'P043', 'P044', 'P046', 'P047', 'P048', 'P049', 'P050', 'P051', 'P052', 'P053', 'P054', 'P055', 'P056', 'P057', 'P058', 'P064', 'P065', 'P066', 'P067', 'P068', 'P069', 'P070', 'P071', 'P075', 'P076', 'P077', 'P082', 'P083', 'P084', 'P085', 'P086', 'P087', 'P088', 'P089', 'P090', 'P091', 'P092', 'P093', 'P094', 'P095', 'P096', 'P097', 'P098', 'P099', 'P100', 'P101', 'P102', 'P103', 'P104', 'P106', 'P107', 'P109', 'P111', 'P112', 'P113', 'P114', 'P116', 'P117', 'P118', 'P119', 'P121', 'P122', 'P123', 'P125', 'P127', 'P129', 'P130', 'P131', 'P132', 'P133', 'P143', 'P144');

INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P001', 'SUPERSAM', 'P001', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P002', 'SUPERSAM', 'P002', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P003', 'SUPERSAM', 'P003', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P004', 'SUPERSAM', 'P004', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P005', 'SUPERSAM', 'P005', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P006', 'SUPERSAM', 'P006', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P007', 'SUPERSAM', 'P007', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P008', 'SUPERSAM', 'P008', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P009', 'SUPERSAM', 'P009', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P010', 'SUPERSAM', 'P010', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P011', 'SUPERSAM', 'P011', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P012', 'SUPERSAM', 'P012', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P013', 'SUPERSAM', 'P013', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P014', 'SUPERSAM', 'P014', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P015', 'SUPERSAM', 'P015', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P016', 'SUPERSAM', 'P016', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P017', 'SUPERSAM', 'P017', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P018', 'SUPERSAM', 'P018', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P019', 'SUPERSAM', 'P019', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P020', 'SUPERSAM', 'P020', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P021', 'SUPERSAM', 'P021', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P022', 'SUPERSAM', 'P022', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P023', 'SUPERSAM', 'P023', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P024', 'SUPERSAM', 'P024', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P026', 'SUPERSAM', 'P026', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P027', 'SUPERSAM', 'P027', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P028', 'SUPERSAM', 'P028', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P029', 'SUPERSAM', 'P029', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P030', 'SUPERSAM', 'P030', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P031', 'SUPERSAM', 'P031', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P032', 'SUPERSAM', 'P032', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P033', 'SUPERSAM', 'P033', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P034', 'SUPERSAM', 'P034', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P035', 'SUPERSAM', 'P035', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P036', 'SUPERSAM', 'P036', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P037', 'SUPERSAM', 'P037', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P038', 'SUPERSAM', 'P038', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P039', 'SUPERSAM', 'P039', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P040', 'SUPERSAM', 'P040', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P041', 'SUPERSAM', 'P041', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P042', 'SUPERSAM', 'P042', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P043', 'SUPERSAM', 'P043', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P044', 'SUPERSAM', 'P044', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P046', 'SUPERSAM', 'P046', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P047', 'SUPERSAM', 'P047', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P048', 'SUPERSAM', 'P048', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P049', 'SUPERSAM', 'P049', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P050', 'SUPERSAM', 'P050', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P051', 'SUPERSAM', 'P051', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P052', 'SUPERSAM', 'P052', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P053', 'SUPERSAM', 'P053', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P054', 'SUPERSAM', 'P054', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P055', 'SUPERSAM', 'P055', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P056', 'SUPERSAM', 'P056', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P057', 'SUPERSAM', 'P057', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P058', 'SUPERSAM', 'P058', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P064', 'SUPERSAM', 'P064', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P065', 'SUPERSAM', 'P065', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P066', 'SUPERSAM', 'P066', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P067', 'SUPERSAM', 'P067', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P068', 'SUPERSAM', 'P068', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P069', 'SUPERSAM', 'P069', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P070', 'SUPERSAM', 'P070', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P071', 'SUPERSAM', 'P071', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P075', 'SUPERSAM', 'P075', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P076', 'SUPERSAM', 'P076', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P077', 'SUPERSAM', 'P077', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P082', 'SUPERSAM', 'P082', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P083', 'SUPERSAM', 'P083', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P084', 'SUPERSAM', 'P084', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P085', 'SUPERSAM', 'P085', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P086', 'SUPERSAM', 'P086', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P087', 'SUPERSAM', 'P087', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P088', 'SUPERSAM', 'P088', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P089', 'SUPERSAM', 'P089', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P090', 'SUPERSAM', 'P090', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P091', 'SUPERSAM', 'P091', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P092', 'SUPERSAM', 'P092', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P093', 'SUPERSAM', 'P093', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P094', 'SUPERSAM', 'P094', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P095', 'SUPERSAM', 'P095', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P096', 'SUPERSAM', 'P096', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P097', 'SUPERSAM', 'P097', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P098', 'SUPERSAM', 'P098', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P099', 'SUPERSAM', 'P099', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P100', 'SUPERSAM', 'P100', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P101', 'SUPERSAM', 'P101', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P102', 'SUPERSAM', 'P102', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P103', 'SUPERSAM', 'P103', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P104', 'SUPERSAM', 'P104', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P106', 'SUPERSAM', 'P106', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P107', 'SUPERSAM', 'P107', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P109', 'SUPERSAM', 'P109', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P111', 'SUPERSAM', 'P111', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P112', 'SUPERSAM', 'P112', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P113', 'SUPERSAM', 'P113', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P114', 'SUPERSAM', 'P114', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P116', 'SUPERSAM', 'P116', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P117', 'SUPERSAM', 'P117', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P118', 'SUPERSAM', 'P118', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P119', 'SUPERSAM', 'P119', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P121', 'SUPERSAM', 'P121', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P122', 'SUPERSAM', 'P122', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P123', 'SUPERSAM', 'P123', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P125', 'SUPERSAM', 'P125', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P127', 'SUPERSAM', 'P127', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P129', 'SUPERSAM', 'P129', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P130', 'SUPERSAM', 'P130', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P131', 'SUPERSAM', 'P131', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P132', 'SUPERSAM', 'P132', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P133', 'SUPERSAM', 'P133', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P143', 'SUPERSAM', 'P143', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('SUPERSAM__P144', 'SUPERSAM', 'P144', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT count(*) FROM location_product_settings WHERE location_id = 'SUPERSAM';
-- Rollback:
--   DELETE FROM location_product_settings WHERE location_id = 'SUPERSAM';
