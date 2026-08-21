-- Batch: 10-elektrownia-settings.sql
-- Purpose: Add location_product_settings rows for every product on ELEKTROWNIA's price list (target = max convention; 0/0/0 + a TBC note where the sheet had no min/max).
-- Preconditions:
--   03-locations.sql applied (ELEKTROWNIA row exists)
-- Diff-before (run first, record the result):
--   SELECT product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base FROM location_product_settings WHERE location_id = 'ELEKTROWNIA' AND product_id IN ('P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009', 'P010', 'P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017', 'P018', 'P019', 'P020', 'P021', 'P022', 'P023', 'P024', 'P025', 'P026', 'P027', 'P028', 'P029', 'P030', 'P031', 'P032', 'P033', 'P034', 'P035', 'P036', 'P037', 'P038', 'P039', 'P040', 'P042', 'P043', 'P044', 'P046', 'P047', 'P048', 'P049', 'P050', 'P051', 'P052', 'P054', 'P055', 'P064', 'P065', 'P066', 'P067', 'P068', 'P069', 'P070', 'P071', 'P075', 'P076', 'P077', 'P082', 'P083', 'P084', 'P085', 'P086', 'P087', 'P088', 'P089', 'P090', 'P091', 'P092', 'P093', 'P094', 'P095', 'P096', 'P097', 'P098', 'P099', 'P100', 'P101', 'P102', 'P103', 'P104', 'P106', 'P107', 'P111', 'P112', 'P113', 'P114', 'P116', 'P117', 'P118', 'P119', 'P121', 'P122', 'P123', 'P125', 'P127', 'P129', 'P131', 'P132', 'P133', 'P143', 'P144', 'P156', 'P158', 'P169');

INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P001', 'ELEKTROWNIA', 'P001', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P002', 'ELEKTROWNIA', 'P002', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P003', 'ELEKTROWNIA', 'P003', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P004', 'ELEKTROWNIA', 'P004', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P005', 'ELEKTROWNIA', 'P005', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P006', 'ELEKTROWNIA', 'P006', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P007', 'ELEKTROWNIA', 'P007', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P008', 'ELEKTROWNIA', 'P008', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P009', 'ELEKTROWNIA', 'P009', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P010', 'ELEKTROWNIA', 'P010', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P011', 'ELEKTROWNIA', 'P011', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P012', 'ELEKTROWNIA', 'P012', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P013', 'ELEKTROWNIA', 'P013', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P014', 'ELEKTROWNIA', 'P014', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P015', 'ELEKTROWNIA', 'P015', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P016', 'ELEKTROWNIA', 'P016', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P017', 'ELEKTROWNIA', 'P017', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P018', 'ELEKTROWNIA', 'P018', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P019', 'ELEKTROWNIA', 'P019', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P020', 'ELEKTROWNIA', 'P020', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P021', 'ELEKTROWNIA', 'P021', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P022', 'ELEKTROWNIA', 'P022', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P023', 'ELEKTROWNIA', 'P023', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P024', 'ELEKTROWNIA', 'P024', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P025', 'ELEKTROWNIA', 'P025', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P026', 'ELEKTROWNIA', 'P026', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P027', 'ELEKTROWNIA', 'P027', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P028', 'ELEKTROWNIA', 'P028', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P029', 'ELEKTROWNIA', 'P029', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P030', 'ELEKTROWNIA', 'P030', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P031', 'ELEKTROWNIA', 'P031', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P032', 'ELEKTROWNIA', 'P032', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P033', 'ELEKTROWNIA', 'P033', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P034', 'ELEKTROWNIA', 'P034', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P035', 'ELEKTROWNIA', 'P035', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P036', 'ELEKTROWNIA', 'P036', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P037', 'ELEKTROWNIA', 'P037', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P038', 'ELEKTROWNIA', 'P038', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P039', 'ELEKTROWNIA', 'P039', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P040', 'ELEKTROWNIA', 'P040', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P042', 'ELEKTROWNIA', 'P042', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P043', 'ELEKTROWNIA', 'P043', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P044', 'ELEKTROWNIA', 'P044', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P046', 'ELEKTROWNIA', 'P046', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P047', 'ELEKTROWNIA', 'P047', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P048', 'ELEKTROWNIA', 'P048', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P049', 'ELEKTROWNIA', 'P049', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P050', 'ELEKTROWNIA', 'P050', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P051', 'ELEKTROWNIA', 'P051', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P052', 'ELEKTROWNIA', 'P052', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P054', 'ELEKTROWNIA', 'P054', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P055', 'ELEKTROWNIA', 'P055', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P064', 'ELEKTROWNIA', 'P064', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P065', 'ELEKTROWNIA', 'P065', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P066', 'ELEKTROWNIA', 'P066', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P067', 'ELEKTROWNIA', 'P067', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P068', 'ELEKTROWNIA', 'P068', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P069', 'ELEKTROWNIA', 'P069', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P070', 'ELEKTROWNIA', 'P070', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P071', 'ELEKTROWNIA', 'P071', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P075', 'ELEKTROWNIA', 'P075', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P076', 'ELEKTROWNIA', 'P076', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P077', 'ELEKTROWNIA', 'P077', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P082', 'ELEKTROWNIA', 'P082', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P083', 'ELEKTROWNIA', 'P083', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P084', 'ELEKTROWNIA', 'P084', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P085', 'ELEKTROWNIA', 'P085', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P086', 'ELEKTROWNIA', 'P086', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P087', 'ELEKTROWNIA', 'P087', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P088', 'ELEKTROWNIA', 'P088', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P089', 'ELEKTROWNIA', 'P089', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P090', 'ELEKTROWNIA', 'P090', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P091', 'ELEKTROWNIA', 'P091', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P092', 'ELEKTROWNIA', 'P092', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P093', 'ELEKTROWNIA', 'P093', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P094', 'ELEKTROWNIA', 'P094', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P095', 'ELEKTROWNIA', 'P095', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P096', 'ELEKTROWNIA', 'P096', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P097', 'ELEKTROWNIA', 'P097', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P098', 'ELEKTROWNIA', 'P098', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P099', 'ELEKTROWNIA', 'P099', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P100', 'ELEKTROWNIA', 'P100', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P101', 'ELEKTROWNIA', 'P101', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P102', 'ELEKTROWNIA', 'P102', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P103', 'ELEKTROWNIA', 'P103', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P104', 'ELEKTROWNIA', 'P104', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P106', 'ELEKTROWNIA', 'P106', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P107', 'ELEKTROWNIA', 'P107', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P111', 'ELEKTROWNIA', 'P111', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P112', 'ELEKTROWNIA', 'P112', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P113', 'ELEKTROWNIA', 'P113', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P114', 'ELEKTROWNIA', 'P114', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P116', 'ELEKTROWNIA', 'P116', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P117', 'ELEKTROWNIA', 'P117', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P118', 'ELEKTROWNIA', 'P118', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P119', 'ELEKTROWNIA', 'P119', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P121', 'ELEKTROWNIA', 'P121', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P122', 'ELEKTROWNIA', 'P122', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P123', 'ELEKTROWNIA', 'P123', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P125', 'ELEKTROWNIA', 'P125', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P127', 'ELEKTROWNIA', 'P127', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P129', 'ELEKTROWNIA', 'P129', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P131', 'ELEKTROWNIA', 'P131', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P132', 'ELEKTROWNIA', 'P132', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P133', 'ELEKTROWNIA', 'P133', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P143', 'ELEKTROWNIA', 'P143', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P144', 'ELEKTROWNIA', 'P144', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P156', 'ELEKTROWNIA', 'P156', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P158', 'ELEKTROWNIA', 'P158', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes, source_supplier_id)
VALUES ('ELEKTROWNIA__P169', 'ELEKTROWNIA', 'P169', 0, 0, 0, FALSE, FALSE, 'threshold TBC (sheet had no min/max)', NULL)
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT count(*) FROM location_product_settings WHERE location_id = 'ELEKTROWNIA';
-- Rollback:
--   DELETE FROM location_product_settings WHERE location_id = 'ELEKTROWNIA';
