-- Batch: 10-browary-settings.sql
-- Purpose: Add location_product_settings rows for every product on BROWARY's price list (target = max convention; 0/0/0 + a TBC note where the sheet had no min/max).
-- Preconditions:
--   03-locations.sql applied (BROWARY row exists)
-- Diff-before (run first, record the result):
--   SELECT product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base FROM location_product_settings WHERE location_id = 'BROWARY' AND product_id IN ('P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P008', 'P009', 'P010', 'P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017', 'P018', 'P019', 'P020', 'P021', 'P022', 'P023', 'P024', 'P026', 'P027', 'P028', 'P029', 'P030', 'P031', 'P032', 'P033', 'P034', 'P035', 'P036', 'P037', 'P038', 'P039', 'P040', 'P041', 'P042', 'P043', 'P044', 'P046', 'P047', 'P048', 'P049', 'P050', 'P051', 'P052', 'P053', 'P054', 'P055', 'P056', 'P057', 'P058', 'P064', 'P065', 'P066', 'P067', 'P068', 'P069', 'P070', 'P071', 'P075', 'P076', 'P077', 'P079', 'P081', 'P082', 'P083', 'P084', 'P085', 'P086', 'P087', 'P089', 'P090', 'P091', 'P092', 'P093', 'P094', 'P095', 'P096', 'P097', 'P098', 'P099', 'P100', 'P101', 'P103', 'P104', 'P106', 'P107', 'P109', 'P111', 'P112', 'P113', 'P114', 'P116', 'P117', 'P118', 'P119', 'P121', 'P122', 'P123', 'P125', 'P127', 'P128', 'P129', 'P131', 'P132', 'P133', 'P135', 'P143', 'P145', 'P156');

INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P001', 'BROWARY', 'P001', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P002', 'BROWARY', 'P002', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P003', 'BROWARY', 'P003', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P004', 'BROWARY', 'P004', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P005', 'BROWARY', 'P005', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P006', 'BROWARY', 'P006', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P008', 'BROWARY', 'P008', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P009', 'BROWARY', 'P009', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P010', 'BROWARY', 'P010', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P011', 'BROWARY', 'P011', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P012', 'BROWARY', 'P012', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P013', 'BROWARY', 'P013', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P014', 'BROWARY', 'P014', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P015', 'BROWARY', 'P015', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P016', 'BROWARY', 'P016', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P017', 'BROWARY', 'P017', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P018', 'BROWARY', 'P018', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P019', 'BROWARY', 'P019', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P020', 'BROWARY', 'P020', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P021', 'BROWARY', 'P021', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P022', 'BROWARY', 'P022', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P023', 'BROWARY', 'P023', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P024', 'BROWARY', 'P024', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P026', 'BROWARY', 'P026', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P027', 'BROWARY', 'P027', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P028', 'BROWARY', 'P028', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P029', 'BROWARY', 'P029', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P030', 'BROWARY', 'P030', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P031', 'BROWARY', 'P031', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P032', 'BROWARY', 'P032', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P033', 'BROWARY', 'P033', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P034', 'BROWARY', 'P034', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P035', 'BROWARY', 'P035', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P036', 'BROWARY', 'P036', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P037', 'BROWARY', 'P037', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P038', 'BROWARY', 'P038', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P039', 'BROWARY', 'P039', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P040', 'BROWARY', 'P040', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P041', 'BROWARY', 'P041', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P042', 'BROWARY', 'P042', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P043', 'BROWARY', 'P043', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P044', 'BROWARY', 'P044', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P046', 'BROWARY', 'P046', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P047', 'BROWARY', 'P047', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P048', 'BROWARY', 'P048', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P049', 'BROWARY', 'P049', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P050', 'BROWARY', 'P050', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P051', 'BROWARY', 'P051', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P052', 'BROWARY', 'P052', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P053', 'BROWARY', 'P053', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P054', 'BROWARY', 'P054', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P055', 'BROWARY', 'P055', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P056', 'BROWARY', 'P056', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P057', 'BROWARY', 'P057', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P058', 'BROWARY', 'P058', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P064', 'BROWARY', 'P064', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P065', 'BROWARY', 'P065', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P066', 'BROWARY', 'P066', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P067', 'BROWARY', 'P067', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P068', 'BROWARY', 'P068', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P069', 'BROWARY', 'P069', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P070', 'BROWARY', 'P070', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P071', 'BROWARY', 'P071', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P075', 'BROWARY', 'P075', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P076', 'BROWARY', 'P076', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P077', 'BROWARY', 'P077', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P079', 'BROWARY', 'P079', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P081', 'BROWARY', 'P081', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P082', 'BROWARY', 'P082', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P083', 'BROWARY', 'P083', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P084', 'BROWARY', 'P084', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P085', 'BROWARY', 'P085', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P086', 'BROWARY', 'P086', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P087', 'BROWARY', 'P087', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P089', 'BROWARY', 'P089', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P090', 'BROWARY', 'P090', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P091', 'BROWARY', 'P091', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P092', 'BROWARY', 'P092', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P093', 'BROWARY', 'P093', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P094', 'BROWARY', 'P094', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P095', 'BROWARY', 'P095', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P096', 'BROWARY', 'P096', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P097', 'BROWARY', 'P097', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P098', 'BROWARY', 'P098', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P099', 'BROWARY', 'P099', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P100', 'BROWARY', 'P100', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P101', 'BROWARY', 'P101', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P103', 'BROWARY', 'P103', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P104', 'BROWARY', 'P104', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P106', 'BROWARY', 'P106', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P107', 'BROWARY', 'P107', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P109', 'BROWARY', 'P109', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P111', 'BROWARY', 'P111', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P112', 'BROWARY', 'P112', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P113', 'BROWARY', 'P113', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P114', 'BROWARY', 'P114', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P116', 'BROWARY', 'P116', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P117', 'BROWARY', 'P117', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P118', 'BROWARY', 'P118', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P119', 'BROWARY', 'P119', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P121', 'BROWARY', 'P121', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P122', 'BROWARY', 'P122', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P123', 'BROWARY', 'P123', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P125', 'BROWARY', 'P125', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P127', 'BROWARY', 'P127', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P128', 'BROWARY', 'P128', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P129', 'BROWARY', 'P129', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P131', 'BROWARY', 'P131', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P132', 'BROWARY', 'P132', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P133', 'BROWARY', 'P133', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P135', 'BROWARY', 'P135', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P143', 'BROWARY', 'P143', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P145', 'BROWARY', 'P145', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('BROWARY__P156', 'BROWARY', 'P156', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT count(*) FROM location_product_settings WHERE location_id = 'BROWARY';
-- Rollback:
--   DELETE FROM location_product_settings WHERE location_id = 'BROWARY';
