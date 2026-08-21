-- Batch: 20-stary_browar-activation.sql
-- Purpose: OPERATOR-RUN LAST for STARY_BROWAR. Flips the location + its new catalog rows live, and narrows visibility exactly where a product gains a second real-world carrier (this location's own pin, and — the first time it happens — the four already-live locations).
-- Preconditions:
--   migration 0008 deployed (location_product_settings.source_supplier_id column exists)
--   PR #26 deployed (supplier-per-location read/write path live)
--   00/01/02/03 and 10-<loc>-settings.sql already applied
-- Diff-before (run first, record the result):
--   SELECT active FROM locations WHERE location_id = 'STARY_BROWAR';
--   SELECT supplier_product_id, active FROM supplier_products WHERE supplier_product_id IN ('SP_BLUESERV_P175', 'SP_COCACOLA_P156', 'SP_FILBER_P157', 'SP_KUCHNIE_P013', 'SP_KUCHNIE_P015', 'SP_KUCHNIE_P017', 'SP_KUCHNIE_P021', 'SP_KUCHNIE_P038', 'SP_KUCHNIE_P048', 'SP_PAGO_P014', 'SP_SELGROS_P001', 'SP_SELGROS_P002', 'SP_SELGROS_P003', 'SP_SELGROS_P004', 'SP_SELGROS_P005', 'SP_SELGROS_P006', 'SP_SELGROS_P007', 'SP_SELGROS_P008', 'SP_SELGROS_P009', 'SP_SELGROS_P010', 'SP_SELGROS_P016', 'SP_SELGROS_P018', 'SP_SELGROS_P022', 'SP_SELGROS_P023', 'SP_SELGROS_P039', 'SP_SELGROS_P040', 'SP_SELGROS_P042', 'SP_SELGROS_P043', 'SP_SELGROS_P044', 'SP_SELGROS_P046', 'SP_SELGROS_P047', 'SP_SELGROS_P049', 'SP_SELGROS_P050', 'SP_SELGROS_P051', 'SP_SELGROS_P052', 'SP_SELGROS_P053', 'SP_SELGROS_P054', 'SP_SELGROS_P055', 'SP_SELGROS_P056', 'SP_SELGROS_P057', 'SP_SELGROS_P058', 'SP_SELGROS_P088', 'SP_SELGROS_P102');

UPDATE locations SET active = TRUE WHERE location_id = 'STARY_BROWAR';
UPDATE supplier_products SET active = TRUE WHERE supplier_product_id IN ('SP_BLUESERV_P175', 'SP_COCACOLA_P156', 'SP_FILBER_P157', 'SP_KUCHNIE_P013', 'SP_KUCHNIE_P015', 'SP_KUCHNIE_P017', 'SP_KUCHNIE_P021', 'SP_KUCHNIE_P038', 'SP_KUCHNIE_P048', 'SP_PAGO_P014', 'SP_SELGROS_P001', 'SP_SELGROS_P002', 'SP_SELGROS_P003', 'SP_SELGROS_P004', 'SP_SELGROS_P005', 'SP_SELGROS_P006', 'SP_SELGROS_P007', 'SP_SELGROS_P008', 'SP_SELGROS_P009', 'SP_SELGROS_P010', 'SP_SELGROS_P016', 'SP_SELGROS_P018', 'SP_SELGROS_P022', 'SP_SELGROS_P023', 'SP_SELGROS_P039', 'SP_SELGROS_P040', 'SP_SELGROS_P042', 'SP_SELGROS_P043', 'SP_SELGROS_P044', 'SP_SELGROS_P046', 'SP_SELGROS_P047', 'SP_SELGROS_P049', 'SP_SELGROS_P050', 'SP_SELGROS_P051', 'SP_SELGROS_P052', 'SP_SELGROS_P053', 'SP_SELGROS_P054', 'SP_SELGROS_P055', 'SP_SELGROS_P056', 'SP_SELGROS_P057', 'SP_SELGROS_P058', 'SP_SELGROS_P088', 'SP_SELGROS_P102');
-- Pin STARY_BROWAR to its sheet's single named supplier for every product that now has >= 2 catalog carriers:
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P001';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P002';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P003';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P004';
UPDATE location_product_settings SET source_supplier_id = 'SUP_BUKAT' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P011';
UPDATE location_product_settings SET source_supplier_id = 'SUP_BUKAT' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P012';
UPDATE location_product_settings SET source_supplier_id = 'SUP_KUCHNIE' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P013';
UPDATE location_product_settings SET source_supplier_id = 'SUP_KUCHNIE' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P015';
UPDATE location_product_settings SET source_supplier_id = 'SUP_KUCHNIE' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P017';
UPDATE location_product_settings SET source_supplier_id = 'SUP_KUCHNIE' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P021';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P022';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P023';
UPDATE location_product_settings SET source_supplier_id = 'SUP_KUCHNIE' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P038';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P039';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P040';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P042';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P043';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P044';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P046';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P047';
UPDATE location_product_settings SET source_supplier_id = 'SUP_KUCHNIE' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P048';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P049';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P050';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P051';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P052';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P053';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P054';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P055';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P056';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P057';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P058';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P088';
UPDATE location_product_settings SET source_supplier_id = 'SUP_BLUESERV' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P095';
UPDATE location_product_settings SET source_supplier_id = 'SUP_BLUESERV' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P096';
UPDATE location_product_settings SET source_supplier_id = 'SUP_BLUESERV' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P097';
UPDATE location_product_settings SET source_supplier_id = 'SUP_SELGROS' WHERE location_id = 'STARY_BROWAR' AND product_id = 'P102';
-- This activation gives the following product(s) a SECOND active carrier for the first time — pin the four already-live locations to their CURRENT (pre-onboarding) supplier so their behavior does not change (FR-026 narrowing, plan-review F1):
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'WOLA' AND product_id = 'P038';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'BRACKA' AND product_id = 'P038';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'NORBLIN' AND product_id = 'P038';
UPDATE location_product_settings SET source_supplier_id = 'SUP_INTERMLECZ' WHERE location_id = 'KEN' AND product_id = 'P038';
-- Substitutes at STARY_BROWAR — left UNPINNED on purpose (FR-027/028): the sheet names more than one supplier for these, so all remain visible:
--   P005: Bukat, Selgros
--   P006: Bukat, Selgros
--   P007: Bukat, Selgros
--   P008: Bukat, Selgros
--   P009: Bukat, Selgros
--   P010: Bukat, Selgros
--   P014: Bukat, Pago
--   P016: Bukat, Selgros
--   P018: Bukat, Selgros

-- Audit-after (run after applying, compare to diff-before):
--   SELECT active FROM locations WHERE location_id = 'STARY_BROWAR'; -- expect true
--   SELECT product_id, source_supplier_id FROM location_product_settings WHERE location_id = 'STARY_BROWAR';
-- Rollback:
--   UPDATE locations SET active = FALSE WHERE location_id = 'STARY_BROWAR';
--   -- plus reversing each UPDATE above by hand if needed
