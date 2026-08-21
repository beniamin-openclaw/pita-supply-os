-- Batch: 02-new-supplier-products.sql
-- Purpose: Add new (supplier, product) catalog pairs referenced by the onboarding sheets. INSERTED INACTIVE ON PURPOSE (plan-review F1): a global, active supplier_products row would leak an "also supplied by" badge into the four LIVE locations before their pin is applied. Each onboarding location's own 20-<loc>-activation.sql flips its rows active.
-- Preconditions:
--   none to apply this batch — every row lands active=FALSE
--   activation batches below must not run before this batch
-- Diff-before (run first, record the result):
--   SELECT supplier_product_id, supplier_id, product_id, active FROM supplier_products WHERE supplier_product_id IN ('SP_BLUESERV_P169', 'SP_BLUESERV_P171', 'SP_BLUESERV_P175', 'SP_COCACOLA_P155', 'SP_COCACOLA_P156', 'SP_COCACOLA_P159', 'SP_COCACOLA_P160', 'SP_COCACOLA_P163', 'SP_COCACOLA_P164', 'SP_COCACOLA_P165', 'SP_COCACOLA_P166', 'SP_COCACOLA_P167', 'SP_COCACOLA_P168', 'SP_COCACOLA_P174', 'SP_EUROFOOD_P135', 'SP_EUROFOOD_P174', 'SP_FILBER_P157', 'SP_INTERMLECZ_P095', 'SP_INTERMLECZ_P096', 'SP_INTERMLECZ_P097', 'SP_INTERMLECZ_P158', 'SP_INTERMLECZ_P161', 'SP_INTERMLECZ_P162', 'SP_INTERMLECZ_P172', 'SP_KUCHNIE_P013', 'SP_KUCHNIE_P015', 'SP_KUCHNIE_P017', 'SP_KUCHNIE_P021', 'SP_KUCHNIE_P022', 'SP_KUCHNIE_P038', 'SP_KUCHNIE_P048', 'SP_PAGO_P011', 'SP_PAGO_P012', 'SP_PAGO_P014', 'SP_PAGO_P173', 'SP_SELGROS_P001', 'SP_SELGROS_P002', 'SP_SELGROS_P003', 'SP_SELGROS_P004', 'SP_SELGROS_P005', 'SP_SELGROS_P006', 'SP_SELGROS_P007', 'SP_SELGROS_P008', 'SP_SELGROS_P009', 'SP_SELGROS_P010', 'SP_SELGROS_P013', 'SP_SELGROS_P016', 'SP_SELGROS_P017', 'SP_SELGROS_P018', 'SP_SELGROS_P022', 'SP_SELGROS_P023', 'SP_SELGROS_P039', 'SP_SELGROS_P040', 'SP_SELGROS_P041', 'SP_SELGROS_P042', 'SP_SELGROS_P043', 'SP_SELGROS_P044', 'SP_SELGROS_P046', 'SP_SELGROS_P047', 'SP_SELGROS_P048', 'SP_SELGROS_P049', 'SP_SELGROS_P050', 'SP_SELGROS_P051', 'SP_SELGROS_P052', 'SP_SELGROS_P053', 'SP_SELGROS_P054', 'SP_SELGROS_P055', 'SP_SELGROS_P056', 'SP_SELGROS_P057', 'SP_SELGROS_P058', 'SP_SELGROS_P088', 'SP_SELGROS_P102', 'SP_SELGROS_P144', 'SP_SELGROS_P170');

INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_BLUESERV_P169', 'SUP_BLUESERV', 'P169', 'Płyn do mycia szyb Cif', 'szt', 1, 'full_only', 14.1, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_BLUESERV_P171', 'SUP_BLUESERV', 'P171', 'Ścierka z mikrofibry(oil)', 'szt', 1, 'full_only', 1.2, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_BLUESERV_P175', 'SUP_BLUESERV', 'P175', 'Wykałaczki', 'opak', 1, 'full_only', 15, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_COCACOLA_P155', 'SUP_COCACOLA', 'P155', '7Up', 'szt', 1, 'full_only', 2.63, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_COCACOLA_P156', 'SUP_COCACOLA', 'P156', 'Burn', 'szt', 1, 'full_only', 3.9, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_COCACOLA_P159', 'SUP_COCACOLA', 'P159', 'Franciskaner', 'szt', 1, 'full_only', NULL, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_COCACOLA_P160', 'SUP_COCACOLA', 'P160', 'Francuski', 'szt.', 1, 'full_only', NULL, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_COCACOLA_P163', 'SUP_COCACOLA', 'P163', 'Krystaliczne Źródło Gazowana', 'szt', 1, 'full_only', 1.45, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_COCACOLA_P164', 'SUP_COCACOLA', 'P164', 'Krystaliczne Źródło Niegazowana', 'szt', 1, 'full_only', 1.45, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_COCACOLA_P165', 'SUP_COCACOLA', 'P165', 'Mirinda', 'szt', 1, 'full_only', 2.6, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_COCACOLA_P166', 'SUP_COCACOLA', 'P166', 'Pepsi', 'szt', 1, 'full_only', 2.7, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_COCACOLA_P167', 'SUP_COCACOLA', 'P167', 'Pepsi Zero', 'szt', 1, 'full_only', 2.6, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_COCACOLA_P168', 'SUP_COCACOLA', 'P168', 'Piwo regionalne', '', 1, 'full_only', NULL, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_COCACOLA_P174', 'SUP_COCACOLA', 'P174', 'Stella', 'szt.', 1, 'full_only', NULL, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_EUROFOOD_P135', 'SUP_EUROFOOD', 'P135', 'Bombilla', 'szt', 1, 'full_only', NULL, FALSE, 'packaging copied from SP_BUKAT_P135', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_EUROFOOD_P174', 'SUP_EUROFOOD', 'P174', 'Stella', 'szt', 1, 'full_only', 4.66, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_FILBER_P157', 'SUP_FILBER', 'P157', 'Corfu Pilsner', 'szt', 1, 'full_only', 7.6, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_INTERMLECZ_P095', 'SUP_INTERMLECZ', 'P095', 'Folia Alumiuniowa', 'szt', 1, 'full_only', 31.32, FALSE, 'packaging copied from SP_BLUESERV_P095', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_INTERMLECZ_P096', 'SUP_INTERMLECZ', 'P096', 'Folia spożywcza', 'szt', 1, 'full_only', 8.65, FALSE, 'packaging copied from SP_BLUESERV_P096', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_INTERMLECZ_P097', 'SUP_INTERMLECZ', 'P097', 'Papier Pergamin do pieczenia', 'szt', 1, 'full_only', 12.6, FALSE, 'packaging copied from SP_BLUESERV_P097', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_INTERMLECZ_P158', 'SUP_INTERMLECZ', 'P158', 'Cukier w saszetkach 5g/200 szt', 'kg', 1, 'full_only', 19.37, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_INTERMLECZ_P161', 'SUP_INTERMLECZ', 'P161', 'Jogurt Grecki naturalny', '', 1, 'full_only', NULL, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_INTERMLECZ_P162', 'SUP_INTERMLECZ', 'P162', 'Jogurt naturalny', 'kg', 1, 'full_only', 14.7, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_INTERMLECZ_P172', 'SUP_INTERMLECZ', 'P172', 'Ser Gouda', 'kg', 1, 'full_only', 25.4, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_KUCHNIE_P013', 'SUP_KUCHNIE', 'P013', 'Oliwki kalamata', 'kg', 2, 'full_only', 45.31, FALSE, 'packaging copied from SP_INTERMLECZ_P013', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_KUCHNIE_P015', 'SUP_KUCHNIE', 'P015', 'Halloumi', 'szt', 1, 'full_only', 7.73, FALSE, 'packaging copied from SP_INTERMLECZ_P015', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_KUCHNIE_P017', 'SUP_KUCHNIE', 'P017', 'Florinis', 'kg', 3.6, 'full_only', 40.53, FALSE, 'packaging copied from SP_INTERMLECZ_P017', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_KUCHNIE_P021', 'SUP_KUCHNIE', 'P021', 'Frytki Aviko (opakowania)', 'szt', 1, 'full_only', 22.55, FALSE, 'packaging copied from SP_INTERMLECZ_P021', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_KUCHNIE_P022', 'SUP_KUCHNIE', 'P022', 'Frytki z batatów (opakowania)', 'szt', 1, 'full_only', 46.08, FALSE, 'packaging copied from SP_INTERMLECZ_P022', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_KUCHNIE_P038', 'SUP_KUCHNIE', 'P038', 'Frytura Eppo 15L', 'szt', 1, 'full_only', 154.07, FALSE, 'packaging copied from SP_INTERMLECZ_P038', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_KUCHNIE_P048', 'SUP_KUCHNIE', 'P048', 'Sriracha chili 730 ml', 'kg', 1, 'full_only', 16.56, FALSE, 'packaging copied from SP_INTERMLECZ_P048', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_PAGO_P011', 'SUP_PAGO', 'P011', 'Tzatzyki', 'kg', 3, 'full_only', 47, FALSE, 'packaging copied from SP_BUKAT_P011', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_PAGO_P012', 'SUP_PAGO', 'P012', 'Tirokafteri', 'kg', 3, 'full_only', 64, FALSE, 'packaging copied from SP_BUKAT_P012', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_PAGO_P014', 'SUP_PAGO', 'P014', 'Feta blok', 'kg', 2, 'full_only', 90, FALSE, 'packaging copied from SP_BUKAT_P014', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_PAGO_P173', 'SUP_PAGO', 'P173', 'Skepasti box PB', 'opak', 1, 'full_only', 53.12, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P001', 'SUP_SELGROS', 'P001', 'Masło MR 500g', 'szt', 1, 'full_only', 6.27, FALSE, 'packaging copied from SP_INTERMLECZ_P001', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P002', 'SUP_SELGROS', 'P002', 'Cytryna', 'kg', 1, 'tenth_kg', 9.4, FALSE, 'packaging copied from SP_BUKAT_P002', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P003', 'SUP_SELGROS', 'P003', 'Papryka zielona', 'kg', 1, 'tenth_kg', 22, FALSE, 'packaging copied from SP_BUKAT_P003', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P004', 'SUP_SELGROS', 'P004', 'Awokado', 'szt', 1, 'full_only', 4.6, FALSE, 'packaging copied from SP_BUKAT_P004', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P005', 'SUP_SELGROS', 'P005', 'Ogórek', 'kg', 1, 'tenth_kg', 16.9, FALSE, 'packaging copied from SP_BUKAT_P005', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P006', 'SUP_SELGROS', 'P006', 'Pomidor', 'kg', 1, 'tenth_kg', 10.5, FALSE, 'packaging copied from SP_BUKAT_P006', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P007', 'SUP_SELGROS', 'P007', 'Rucola 125 gr', 'opak', 1, 'full_only', 4.2, FALSE, 'packaging copied from SP_BUKAT_P007', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P008', 'SUP_SELGROS', 'P008', 'Sałata bolero mix 150gr', 'opak', 1, 'full_only', 4.2, FALSE, 'packaging copied from SP_BUKAT_P008', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P009', 'SUP_SELGROS', 'P009', 'Natka Pietruszki', 'kg', 1, 'tenth_kg', 18, FALSE, 'packaging copied from SP_BUKAT_P009', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P010', 'SUP_SELGROS', 'P010', 'Czosnek', 'kg', 1, 'tenth_kg', 27, FALSE, 'packaging copied from SP_BUKAT_P010', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P013', 'SUP_SELGROS', 'P013', 'Oliwki kalamata', 'opak', 2, 'full_only', 45.31, FALSE, 'packaging copied from SP_INTERMLECZ_P013', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P016', 'SUP_SELGROS', 'P016', 'Cebula czerwona', 'kg', 1, 'tenth_kg', 11, FALSE, 'packaging copied from SP_BUKAT_P016', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P017', 'SUP_SELGROS', 'P017', 'Florinis', 'opak', 3.6, 'full_only', 40.53, FALSE, 'packaging copied from SP_INTERMLECZ_P017', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P018', 'SUP_SELGROS', 'P018', 'Cebula Biała', 'kg', 1, 'tenth_kg', 1.5, FALSE, 'packaging copied from SP_BUKAT_P018', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P022', 'SUP_SELGROS', 'P022', 'Frytki z batatów (opakowania)', 'szt', 1, 'full_only', 46.08, FALSE, 'packaging copied from SP_INTERMLECZ_P022', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P023', 'SUP_SELGROS', 'P023', 'Fasolka Szparagowa (op.)', 'szt', 2.5, 'full_only', 13.04, FALSE, 'packaging copied from SP_INTERMLECZ_P023', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P039', 'SUP_SELGROS', 'P039', 'Ocet spirytusowy', 'szt', 1, 'full_only', 16.01, FALSE, 'packaging copied from SP_INTERMLECZ_P039', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P040', 'SUP_SELGROS', 'P040', 'Woda 5l pracownicza', 'szt', 1, 'full_only', 6.01, FALSE, 'packaging copied from SP_INTERMLECZ_P040', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P041', 'SUP_SELGROS', 'P041', 'Olej Rzepakowy 5 L', 'kg', 1, 'full_only', 28.56, FALSE, 'packaging copied from SP_INTERMLECZ_P041', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P042', 'SUP_SELGROS', 'P042', 'Ketchup Fanex VII 1,1 kg', 'kg', 1, 'full_only', 12.79, FALSE, 'packaging copied from SP_INTERMLECZ_P042', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P043', 'SUP_SELGROS', 'P043', 'Develey Musztarda 3 kg', 'kg', 1, 'full_only', 18.4, FALSE, 'packaging copied from SP_INTERMLECZ_P043', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P044', 'SUP_SELGROS', 'P044', 'Fanex Majonez 4kg', 'kg', 1, 'full_only', 53, FALSE, 'packaging copied from SP_INTERMLECZ_P044', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P046', 'SUP_SELGROS', 'P046', 'Cieciorka', 'szt', 1, 'full_only', 2.2, FALSE, 'packaging copied from SP_INTERMLECZ_P046', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P047', 'SUP_SELGROS', 'P047', 'Kasza Pęczak Melvit 900g', 'szt', 1, 'full_only', 4.36, FALSE, 'packaging copied from SP_INTERMLECZ_P047', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P048', 'SUP_SELGROS', 'P048', 'Sriracha chili 730 ml', 'kg', 1, 'full_only', 16.56, FALSE, 'packaging copied from SP_INTERMLECZ_P048', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P049', 'SUP_SELGROS', 'P049', 'Miód 1 kg', 'kg', 1, 'full_only', 13, FALSE, 'packaging copied from SP_INTERMLECZ_P049', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P050', 'SUP_SELGROS', 'P050', 'Pieprz', 'kg', 1, 'full_only', 43.79, FALSE, 'packaging copied from SP_INTERMLECZ_P050', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P051', 'SUP_SELGROS', 'P051', 'Oregano', 'kg', 1, 'full_only', 30.71, FALSE, 'packaging copied from SP_INTERMLECZ_P051', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P052', 'SUP_SELGROS', 'P052', 'Papryka słodka - mielona', 'kg', 1, 'full_only', 25.76, FALSE, 'packaging copied from SP_INTERMLECZ_P052', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P053', 'SUP_SELGROS', 'P053', 'Sól 1kg', 'kg', 1, 'full_only', 19.37, FALSE, 'packaging copied from SP_INTERMLECZ_P053', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P054', 'SUP_SELGROS', 'P054', 'Liść Laurowy', 'kg', 1, 'full_only', 13.67, FALSE, 'packaging copied from SP_INTERMLECZ_P054', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P055', 'SUP_SELGROS', 'P055', 'Ziele Angielskie', 'kg', 1, 'full_only', 40.83, FALSE, 'packaging copied from SP_INTERMLECZ_P055', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P056', 'SUP_SELGROS', 'P056', 'Cukier w saszetkach 5g', 'kg', 1, 'full_only', 11.08, FALSE, 'packaging copied from SP_INTERMLECZ_P056', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P057', 'SUP_SELGROS', 'P057', 'Sól w saszetkach 5g', 'kg', 1, 'full_only', 31.29, FALSE, 'packaging copied from SP_INTERMLECZ_P057', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P058', 'SUP_SELGROS', 'P058', 'Pieprz  w saszetkach 5g', 'kg', 1, 'full_only', 44.15, FALSE, 'packaging copied from SP_INTERMLECZ_P058', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P088', 'SUP_SELGROS', 'P088', 'Opakowanie Frytki', 'opak', 1, 'full_only', 5.04, FALSE, 'packaging copied from SP_BLUESERV_P088', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P102', 'SUP_SELGROS', 'P102', 'Słomki 250szt', 'opak', 1, 'full_only', 8, FALSE, 'packaging copied from SP_BLUESERV_P102', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P144', 'SUP_SELGROS', 'P144', 'Kubeczki papierowe', 'opak', 1, 'full_only', 5.04, FALSE, 'packaging copied from SP_BLUESERV_P144', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes, order_note)
VALUES ('SP_SELGROS_P170', 'SUP_SELGROS', 'P170', 'Sałata bolero mix- 500 grm', '', 1, 'full_only', 4.2, FALSE, 'packaging TBC', NULL)
ON CONFLICT (supplier_product_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT supplier_product_id, active FROM supplier_products WHERE supplier_product_id IN ('SP_BLUESERV_P169', 'SP_BLUESERV_P171', 'SP_BLUESERV_P175', 'SP_COCACOLA_P155', 'SP_COCACOLA_P156', 'SP_COCACOLA_P159', 'SP_COCACOLA_P160', 'SP_COCACOLA_P163', 'SP_COCACOLA_P164', 'SP_COCACOLA_P165', 'SP_COCACOLA_P166', 'SP_COCACOLA_P167', 'SP_COCACOLA_P168', 'SP_COCACOLA_P174', 'SP_EUROFOOD_P135', 'SP_EUROFOOD_P174', 'SP_FILBER_P157', 'SP_INTERMLECZ_P095', 'SP_INTERMLECZ_P096', 'SP_INTERMLECZ_P097', 'SP_INTERMLECZ_P158', 'SP_INTERMLECZ_P161', 'SP_INTERMLECZ_P162', 'SP_INTERMLECZ_P172', 'SP_KUCHNIE_P013', 'SP_KUCHNIE_P015', 'SP_KUCHNIE_P017', 'SP_KUCHNIE_P021', 'SP_KUCHNIE_P022', 'SP_KUCHNIE_P038', 'SP_KUCHNIE_P048', 'SP_PAGO_P011', 'SP_PAGO_P012', 'SP_PAGO_P014', 'SP_PAGO_P173', 'SP_SELGROS_P001', 'SP_SELGROS_P002', 'SP_SELGROS_P003', 'SP_SELGROS_P004', 'SP_SELGROS_P005', 'SP_SELGROS_P006', 'SP_SELGROS_P007', 'SP_SELGROS_P008', 'SP_SELGROS_P009', 'SP_SELGROS_P010', 'SP_SELGROS_P013', 'SP_SELGROS_P016', 'SP_SELGROS_P017', 'SP_SELGROS_P018', 'SP_SELGROS_P022', 'SP_SELGROS_P023', 'SP_SELGROS_P039', 'SP_SELGROS_P040', 'SP_SELGROS_P041', 'SP_SELGROS_P042', 'SP_SELGROS_P043', 'SP_SELGROS_P044', 'SP_SELGROS_P046', 'SP_SELGROS_P047', 'SP_SELGROS_P048', 'SP_SELGROS_P049', 'SP_SELGROS_P050', 'SP_SELGROS_P051', 'SP_SELGROS_P052', 'SP_SELGROS_P053', 'SP_SELGROS_P054', 'SP_SELGROS_P055', 'SP_SELGROS_P056', 'SP_SELGROS_P057', 'SP_SELGROS_P058', 'SP_SELGROS_P088', 'SP_SELGROS_P102', 'SP_SELGROS_P144', 'SP_SELGROS_P170'); -- expect active=false for every row
-- Rollback:
--   DELETE FROM supplier_products WHERE supplier_product_id IN ('SP_BLUESERV_P169', 'SP_BLUESERV_P171', 'SP_BLUESERV_P175', 'SP_COCACOLA_P155', 'SP_COCACOLA_P156', 'SP_COCACOLA_P159', 'SP_COCACOLA_P160', 'SP_COCACOLA_P163', 'SP_COCACOLA_P164', 'SP_COCACOLA_P165', 'SP_COCACOLA_P166', 'SP_COCACOLA_P167', 'SP_COCACOLA_P168', 'SP_COCACOLA_P174', 'SP_EUROFOOD_P135', 'SP_EUROFOOD_P174', 'SP_FILBER_P157', 'SP_INTERMLECZ_P095', 'SP_INTERMLECZ_P096', 'SP_INTERMLECZ_P097', 'SP_INTERMLECZ_P158', 'SP_INTERMLECZ_P161', 'SP_INTERMLECZ_P162', 'SP_INTERMLECZ_P172', 'SP_KUCHNIE_P013', 'SP_KUCHNIE_P015', 'SP_KUCHNIE_P017', 'SP_KUCHNIE_P021', 'SP_KUCHNIE_P022', 'SP_KUCHNIE_P038', 'SP_KUCHNIE_P048', 'SP_PAGO_P011', 'SP_PAGO_P012', 'SP_PAGO_P014', 'SP_PAGO_P173', 'SP_SELGROS_P001', 'SP_SELGROS_P002', 'SP_SELGROS_P003', 'SP_SELGROS_P004', 'SP_SELGROS_P005', 'SP_SELGROS_P006', 'SP_SELGROS_P007', 'SP_SELGROS_P008', 'SP_SELGROS_P009', 'SP_SELGROS_P010', 'SP_SELGROS_P013', 'SP_SELGROS_P016', 'SP_SELGROS_P017', 'SP_SELGROS_P018', 'SP_SELGROS_P022', 'SP_SELGROS_P023', 'SP_SELGROS_P039', 'SP_SELGROS_P040', 'SP_SELGROS_P041', 'SP_SELGROS_P042', 'SP_SELGROS_P043', 'SP_SELGROS_P044', 'SP_SELGROS_P046', 'SP_SELGROS_P047', 'SP_SELGROS_P048', 'SP_SELGROS_P049', 'SP_SELGROS_P050', 'SP_SELGROS_P051', 'SP_SELGROS_P052', 'SP_SELGROS_P053', 'SP_SELGROS_P054', 'SP_SELGROS_P055', 'SP_SELGROS_P056', 'SP_SELGROS_P057', 'SP_SELGROS_P058', 'SP_SELGROS_P088', 'SP_SELGROS_P102', 'SP_SELGROS_P144', 'SP_SELGROS_P170');
