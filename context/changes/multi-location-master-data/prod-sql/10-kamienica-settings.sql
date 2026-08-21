-- Batch: 10-kamienica-settings.sql
-- Purpose: Add location_product_settings rows for every product on KAMIENICA's price list (target = max convention; 0/0/0 + a TBC note where the sheet had no min/max).
-- Preconditions:
--   03-locations.sql applied (KAMIENICA row exists)
-- Diff-before (run first, record the result):
--   SELECT product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base FROM location_product_settings WHERE location_id = 'KAMIENICA' AND product_id IN ('P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009', 'P010', 'P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017', 'P018', 'P019', 'P020', 'P021', 'P022', 'P023', 'P024', 'P026', 'P027', 'P028', 'P029', 'P030', 'P031', 'P032', 'P033', 'P034', 'P035', 'P036', 'P037', 'P038', 'P039', 'P040', 'P041', 'P042', 'P043', 'P044', 'P046', 'P047', 'P048', 'P049', 'P050', 'P051', 'P052', 'P053', 'P054', 'P055', 'P056', 'P057', 'P058', 'P064', 'P065', 'P066', 'P067', 'P068', 'P069', 'P070', 'P071', 'P075', 'P076', 'P077', 'P082', 'P083', 'P084', 'P085', 'P086', 'P087', 'P088', 'P089', 'P090', 'P091', 'P092', 'P093', 'P094', 'P095', 'P096', 'P097', 'P098', 'P099', 'P100', 'P101', 'P102', 'P103', 'P104', 'P106', 'P107', 'P109', 'P111', 'P112', 'P113', 'P114', 'P116', 'P117', 'P118', 'P119', 'P121', 'P122', 'P123', 'P125', 'P127', 'P129', 'P130', 'P131', 'P132', 'P133', 'P143', 'P144');

INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P001', 'KAMIENICA', 'P001', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P002', 'KAMIENICA', 'P002', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P003', 'KAMIENICA', 'P003', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P004', 'KAMIENICA', 'P004', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P005', 'KAMIENICA', 'P005', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P006', 'KAMIENICA', 'P006', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P007', 'KAMIENICA', 'P007', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P008', 'KAMIENICA', 'P008', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P009', 'KAMIENICA', 'P009', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P010', 'KAMIENICA', 'P010', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P011', 'KAMIENICA', 'P011', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P012', 'KAMIENICA', 'P012', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P013', 'KAMIENICA', 'P013', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P014', 'KAMIENICA', 'P014', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P015', 'KAMIENICA', 'P015', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P016', 'KAMIENICA', 'P016', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P017', 'KAMIENICA', 'P017', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P018', 'KAMIENICA', 'P018', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P019', 'KAMIENICA', 'P019', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P020', 'KAMIENICA', 'P020', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P021', 'KAMIENICA', 'P021', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P022', 'KAMIENICA', 'P022', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P023', 'KAMIENICA', 'P023', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P024', 'KAMIENICA', 'P024', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P026', 'KAMIENICA', 'P026', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P027', 'KAMIENICA', 'P027', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P028', 'KAMIENICA', 'P028', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P029', 'KAMIENICA', 'P029', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P030', 'KAMIENICA', 'P030', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P031', 'KAMIENICA', 'P031', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P032', 'KAMIENICA', 'P032', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P033', 'KAMIENICA', 'P033', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P034', 'KAMIENICA', 'P034', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P035', 'KAMIENICA', 'P035', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P036', 'KAMIENICA', 'P036', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P037', 'KAMIENICA', 'P037', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P038', 'KAMIENICA', 'P038', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P039', 'KAMIENICA', 'P039', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P040', 'KAMIENICA', 'P040', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P041', 'KAMIENICA', 'P041', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P042', 'KAMIENICA', 'P042', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P043', 'KAMIENICA', 'P043', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P044', 'KAMIENICA', 'P044', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P046', 'KAMIENICA', 'P046', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P047', 'KAMIENICA', 'P047', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P048', 'KAMIENICA', 'P048', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P049', 'KAMIENICA', 'P049', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P050', 'KAMIENICA', 'P050', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P051', 'KAMIENICA', 'P051', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P052', 'KAMIENICA', 'P052', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P053', 'KAMIENICA', 'P053', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P054', 'KAMIENICA', 'P054', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P055', 'KAMIENICA', 'P055', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P056', 'KAMIENICA', 'P056', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P057', 'KAMIENICA', 'P057', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P058', 'KAMIENICA', 'P058', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P064', 'KAMIENICA', 'P064', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P065', 'KAMIENICA', 'P065', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P066', 'KAMIENICA', 'P066', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P067', 'KAMIENICA', 'P067', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P068', 'KAMIENICA', 'P068', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P069', 'KAMIENICA', 'P069', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P070', 'KAMIENICA', 'P070', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P071', 'KAMIENICA', 'P071', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P075', 'KAMIENICA', 'P075', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P076', 'KAMIENICA', 'P076', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P077', 'KAMIENICA', 'P077', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P082', 'KAMIENICA', 'P082', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P083', 'KAMIENICA', 'P083', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P084', 'KAMIENICA', 'P084', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P085', 'KAMIENICA', 'P085', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P086', 'KAMIENICA', 'P086', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P087', 'KAMIENICA', 'P087', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P088', 'KAMIENICA', 'P088', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P089', 'KAMIENICA', 'P089', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P090', 'KAMIENICA', 'P090', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P091', 'KAMIENICA', 'P091', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P092', 'KAMIENICA', 'P092', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P093', 'KAMIENICA', 'P093', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P094', 'KAMIENICA', 'P094', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P095', 'KAMIENICA', 'P095', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P096', 'KAMIENICA', 'P096', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P097', 'KAMIENICA', 'P097', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P098', 'KAMIENICA', 'P098', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P099', 'KAMIENICA', 'P099', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P100', 'KAMIENICA', 'P100', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P101', 'KAMIENICA', 'P101', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P102', 'KAMIENICA', 'P102', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P103', 'KAMIENICA', 'P103', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P104', 'KAMIENICA', 'P104', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P106', 'KAMIENICA', 'P106', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P107', 'KAMIENICA', 'P107', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P109', 'KAMIENICA', 'P109', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P111', 'KAMIENICA', 'P111', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P112', 'KAMIENICA', 'P112', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P113', 'KAMIENICA', 'P113', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P114', 'KAMIENICA', 'P114', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P116', 'KAMIENICA', 'P116', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P117', 'KAMIENICA', 'P117', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P118', 'KAMIENICA', 'P118', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P119', 'KAMIENICA', 'P119', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P121', 'KAMIENICA', 'P121', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P122', 'KAMIENICA', 'P122', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P123', 'KAMIENICA', 'P123', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P125', 'KAMIENICA', 'P125', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P127', 'KAMIENICA', 'P127', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P129', 'KAMIENICA', 'P129', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P130', 'KAMIENICA', 'P130', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P131', 'KAMIENICA', 'P131', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P132', 'KAMIENICA', 'P132', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P133', 'KAMIENICA', 'P133', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P143', 'KAMIENICA', 'P143', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('KAMIENICA__P144', 'KAMIENICA', 'P144', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT count(*) FROM location_product_settings WHERE location_id = 'KAMIENICA';
-- Rollback:
--   DELETE FROM location_product_settings WHERE location_id = 'KAMIENICA';
