-- ============================================================
-- Pita Supply OS — migration 0028: optional bulk pack ("opakowanie
-- zbiorcze") on supplier_products (feedback-1001-names-units, D22/D33-D36)
--
-- ADDITIVE ONLY.
--
--   supplier_products.case_unit       text, nullable. The bulk pack the
--                                     supplier ships the purchase unit in
--                                     (karton, skrzynka, worek, opak). A
--                                     master-data value declined by the
--                                     frontend i18n/packUnits.ts table and its
--                                     Python twin in app/gmail_url.py.
--   supplier_products.units_per_case  numeric, nullable. How many PURCHASE
--                                     units one case holds (karton = 4
--                                     paczki, skrzynka = 6 kg). Must be > 1.
--
-- Both columns are set together or not at all (CHECK below). NULL on both
-- keeps today's behaviour byte-for-byte: no two-field order input, no case
-- rounding of the suggestion, no case wording in the supplier e-mail. Order
-- lines, receipts, finance and thresholds stay in the purchase unit, so
-- nothing already stored is re-labelled.
--
-- The case values are a separate data step
-- (context/changes/feedback-1001-names-units/prod-sql-2-cases.sql), run only
-- after this migration and the code that reads it are live.
--
-- Numbered 0028: 0027 is inventory-card-order. Keep this file free of the
-- percent sign (the integration fixture applies it via psycopg2
-- exec_driver_sql). Apply on prod BEFORE the backend that binds it
-- (_SUPPLIER_PRODUCT_COLUMNS lists both columns, so a supplier_products
-- insert against an unmigrated DB fails; reads are SELECT * and tolerate
-- either order). Re-runnable: ADD COLUMN IF NOT EXISTS, and each CHECK is
-- dropped if it exists before it is added.
--
-- Rollback (loses only the case values, which prod-sql-2-diff.md records):
--   ALTER TABLE supplier_products DROP CONSTRAINT IF EXISTS supplier_products_case_pair_check;
--   ALTER TABLE supplier_products DROP CONSTRAINT IF EXISTS supplier_products_units_per_case_check;
--   ALTER TABLE supplier_products DROP COLUMN IF EXISTS units_per_case;
--   ALTER TABLE supplier_products DROP COLUMN IF EXISTS case_unit;
-- ============================================================

ALTER TABLE supplier_products
    ADD COLUMN IF NOT EXISTS case_unit text;

ALTER TABLE supplier_products
    ADD COLUMN IF NOT EXISTS units_per_case numeric;

ALTER TABLE supplier_products DROP CONSTRAINT IF EXISTS supplier_products_case_pair_check;
ALTER TABLE supplier_products
    ADD CONSTRAINT supplier_products_case_pair_check
    CHECK ((case_unit IS NULL) = (units_per_case IS NULL));

ALTER TABLE supplier_products DROP CONSTRAINT IF EXISTS supplier_products_units_per_case_check;
ALTER TABLE supplier_products
    ADD CONSTRAINT supplier_products_units_per_case_check
    CHECK (units_per_case IS NULL OR units_per_case > 1);
