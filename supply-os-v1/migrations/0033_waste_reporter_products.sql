BEGIN;

ALTER TABLE waste_reports ADD COLUMN reported_by text
    CHECK (reported_by IS NULL OR length(trim(reported_by)) BETWEEN 1 AND 120);
ALTER TABLE waste_report_lines ADD COLUMN source_product_id text
    CHECK (source_product_id IS NULL OR length(trim(source_product_id)) BETWEEN 1 AND 120);

ALTER TABLE waste_report_lines
    DROP CONSTRAINT waste_report_lines_unit_check,
    DROP CONSTRAINT waste_report_lines_submitted_unit_check,
    DROP CONSTRAINT waste_report_lines_check1,
    DROP CONSTRAINT waste_report_lines_check4,
    DROP CONSTRAINT waste_report_lines_check5,
    DROP CONSTRAINT waste_report_lines_check6;

ALTER TABLE waste_report_lines
    ADD CONSTRAINT waste_report_lines_unit_check CHECK (
        (source_product_id IS NULL AND unit IN ('kg', 'szt')) OR
        (source_product_id IS NOT NULL AND length(trim(unit)) BETWEEN 1 AND 120)),
    ADD CONSTRAINT waste_report_lines_submitted_unit_check CHECK (
        (source_product_id IS NULL AND submitted_unit IN ('kg', 'g', 'szt')) OR
        (source_product_id IS NOT NULL AND length(trim(submitted_unit)) BETWEEN 1 AND 120)),
    ADD CONSTRAINT waste_report_lines_check1 CHECK (
        (source_product_id IS NOT NULL AND product_id IS NULL AND description IS NULL) OR
        (source_product_id IS NULL AND (
            (product_id IS NOT NULL AND length(trim(product_id)) > 0 AND description IS NULL) OR
            (product_id IS NULL AND description IS NOT NULL AND
             length(trim(description)) BETWEEN 1 AND 120)))),
    ADD CONSTRAINT waste_report_lines_check4 CHECK (
        (source_product_id IS NOT NULL AND unit = submitted_unit) OR
        (source_product_id IS NULL AND (
            (unit = 'kg' AND submitted_unit IN ('kg', 'g')) OR
            (unit = 'szt' AND submitted_unit = 'szt')))),
    ADD CONSTRAINT waste_report_lines_check5 CHECK (
        source_product_id IS NOT NULL OR product_id IS NOT NULL OR submitted_unit <> 'g'),
    ADD CONSTRAINT waste_report_lines_check6 CHECK (
        (source_product_id IS NOT NULL AND quantity = submitted_quantity) OR
        (source_product_id IS NULL AND (
            (submitted_unit = 'g' AND submitted_quantity = trunc(submitted_quantity)
             AND quantity = submitted_quantity / 1000) OR
            (submitted_unit <> 'g' AND quantity = submitted_quantity))));

COMMIT;
