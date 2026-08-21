-- Batch: 20-westfield-activation.sql
-- Purpose: OPERATOR-RUN LAST for WESTFIELD. Flips the location + its new catalog rows live, and narrows visibility exactly where a product gains a second real-world carrier (this location's own pin, and — the first time it happens — the four already-live locations).
-- Preconditions:
--   migration 0008 deployed (location_product_settings.source_supplier_id column exists)
--   PR #26 deployed (supplier-per-location read/write path live)
--   00/01/02/03 and 10-<loc>-settings.sql already applied
-- Diff-before (run first, record the result):
--   SELECT active FROM locations WHERE location_id = 'WESTFIELD';
--   SELECT supplier_product_id, active FROM supplier_products WHERE supplier_product_id IN ('SP_INTERMLECZ_P095', 'SP_INTERMLECZ_P096', 'SP_INTERMLECZ_P097', 'SP_KUCHNIE_P015', 'SP_SELGROS_P001', 'SP_SELGROS_P002', 'SP_SELGROS_P003', 'SP_SELGROS_P004', 'SP_SELGROS_P005', 'SP_SELGROS_P006', 'SP_SELGROS_P007', 'SP_SELGROS_P008', 'SP_SELGROS_P009', 'SP_SELGROS_P010', 'SP_SELGROS_P013', 'SP_SELGROS_P016', 'SP_SELGROS_P017', 'SP_SELGROS_P018', 'SP_SELGROS_P088', 'SP_SELGROS_P102', 'SP_SELGROS_P144');

UPDATE locations SET active = TRUE WHERE location_id = 'WESTFIELD';
UPDATE supplier_products SET active = TRUE WHERE supplier_product_id IN ('SP_INTERMLECZ_P095', 'SP_INTERMLECZ_P096', 'SP_INTERMLECZ_P097', 'SP_KUCHNIE_P015', 'SP_SELGROS_P001', 'SP_SELGROS_P002', 'SP_SELGROS_P003', 'SP_SELGROS_P004', 'SP_SELGROS_P005', 'SP_SELGROS_P006', 'SP_SELGROS_P007', 'SP_SELGROS_P008', 'SP_SELGROS_P009', 'SP_SELGROS_P010', 'SP_SELGROS_P013', 'SP_SELGROS_P016', 'SP_SELGROS_P017', 'SP_SELGROS_P018', 'SP_SELGROS_P088', 'SP_SELGROS_P102', 'SP_SELGROS_P144');
-- Pin WESTFIELD to its sheet's single named supplier for every product that now has >= 2 catalog carriers:
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P001';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P002';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P003';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P004';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P005';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P006';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P007';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P008';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P009';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P010';
UPDATE location_product_settings SET source_supplier_id = 'SUP_BUKAT' WHERE location_id = 'WESTFIELD' AND product_id = 'P011';
UPDATE location_product_settings SET source_supplier_id = 'SUP_BUKAT' WHERE location_id = 'WESTFIELD' AND product_id = 'P012';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P013';
UPDATE location_product_settings SET source_supplier_id = 'SUP_BUKAT' WHERE location_id = 'WESTFIELD' AND product_id = 'P014';
UPDATE location_product_settings SET source_supplier_id = 'SUP_KUCHNIE' WHERE location_id = 'WESTFIELD' AND product_id = 'P015';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P016';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P017';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P018';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P038';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P039';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P040';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P041';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P042';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P043';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P044';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P046';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P047';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P048';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P049';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P050';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P051';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P052';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P053';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P054';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P055';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P056';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P057';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P058';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P088';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P095';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P096';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WESTFIELD' AND product_id = 'P097';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P102';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'WESTFIELD' AND product_id = 'P144';

-- Audit-after (run after applying, compare to diff-before):
--   SELECT active FROM locations WHERE location_id = 'WESTFIELD'; -- expect true
--   SELECT product_id, source_supplier_id FROM location_product_settings WHERE location_id = 'WESTFIELD';
-- Rollback:
--   UPDATE locations SET active = FALSE WHERE location_id = 'WESTFIELD';
--   -- plus reversing each UPDATE above by hand if needed
