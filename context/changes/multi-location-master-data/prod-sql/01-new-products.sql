-- Batch: 01-new-products.sql
-- Purpose: Add products that appear in the onboarding sheets' price lists but have no catalog match at all (near-miss candidates are deliberately excluded — those need a human decision, not an auto-created row).
-- Preconditions:
--   none — additive rows only, active=TRUE (new SKUs, not location-scoped)
-- Diff-before (run first, record the result):
--   SELECT product_id, product_name_pl FROM products WHERE product_id IN ('P155', 'P156', 'P157', 'P158', 'P159', 'P160', 'P161', 'P162', 'P163', 'P164', 'P165', 'P166', 'P167', 'P168', 'P169', 'P170', 'P171', 'P172', 'P173', 'P174', 'P175');

INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P155', NULL, '7Up', 'Napoje', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from forum inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P156', NULL, 'Burn', 'Napoje', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from browary, elektrownia, ken, stary_browar inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P157', NULL, 'Corfu Pilsner', 'Napoje', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from bracka, ken, norblin, stary_browar, wolska inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P158', NULL, 'Cukier w saszetkach 5g/200 szt', 'Spożywcze', 'kg', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from elektrownia inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P159', NULL, 'Franciskaner', 'Napoje', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from wolska inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P160', NULL, 'Francuski', 'Napoje', 'szt.', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from wolska inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P161', NULL, 'Jogurt Grecki naturalny', 'Chłodnia', '', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from norblin inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P162', NULL, 'Jogurt naturalny', 'Chłodnia', 'kg', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from ken inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P163', NULL, 'Krystaliczne Źródło Gazowana', 'Napoje', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from forum inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P164', NULL, 'Krystaliczne Źródło Niegazowana', 'Napoje', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from forum inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P165', NULL, 'Mirinda', 'Napoje', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from forum inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P166', NULL, 'Pepsi', 'Napoje', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from forum inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P167', NULL, 'Pepsi Zero', 'Napoje', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from forum inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P168', NULL, 'Piwo regionalne', 'Napoje', '', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from norblin inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P169', NULL, 'Płyn do mycia szyb Cif', 'Chemia', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from elektrownia inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P170', NULL, 'Sałata bolero mix- 500 grm', 'Chłodnia', '', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from forum inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P171', NULL, 'Ścierka z mikrofibry(oil)', 'Chemia', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from wolska inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P172', NULL, 'Ser Gouda', 'Chłodnia', 'kg', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from ken, norblin inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P173', NULL, 'Skepasti box PB', 'Opakowania', 'opak', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from ken, norblin inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P174', NULL, 'Stella', 'Napoje', 'szt', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from wolska inventory sheets')
ON CONFLICT (product_id) DO NOTHING;
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P175', NULL, 'Wykałaczki', 'Opakowania', 'opak', FALSE, TRUE, 'added 2026-08-22 (multi-location-master-data) from bracka, stary_browar inventory sheets')
ON CONFLICT (product_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT product_id, product_name_pl, product_category, inventory_unit FROM products WHERE product_id IN ('P155', 'P156', 'P157', 'P158', 'P159', 'P160', 'P161', 'P162', 'P163', 'P164', 'P165', 'P166', 'P167', 'P168', 'P169', 'P170', 'P171', 'P172', 'P173', 'P174', 'P175');
-- Rollback:
--   DELETE FROM products WHERE product_id IN ('P155', 'P156', 'P157', 'P158', 'P159', 'P160', 'P161', 'P162', 'P163', 'P164', 'P165', 'P166', 'P167', 'P168', 'P169', 'P170', 'P171', 'P172', 'P173', 'P174', 'P175');
