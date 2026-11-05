CREATE TABLE waste_reports (
    report_id uuid PRIMARY KEY,
    location_id text NOT NULL REFERENCES locations(location_id),
    business_date date NOT NULL,
    batch_uuid uuid NOT NULL,
    request_digest text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (location_id, batch_uuid)
);
CREATE INDEX waste_reports_location_date_id ON waste_reports (location_id, business_date, report_id);
CREATE TABLE waste_report_lines (
    line_id uuid PRIMARY KEY,
    report_id uuid NOT NULL REFERENCES waste_reports(report_id),
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    product_id text,
    description text,
    name_pl text NOT NULL,
    name_en text NOT NULL,
    quantity numeric NOT NULL CHECK (quantity > 0 AND quantity <= 999999.999 AND quantity = trunc(quantity, 3)),
    unit text NOT NULL CHECK (unit IN ('kg', 'szt')),
    submitted_quantity numeric NOT NULL CHECK (submitted_quantity > 0 AND submitted_quantity <= 999999999 AND submitted_quantity = trunc(submitted_quantity, 3)),
    submitted_unit text NOT NULL CHECK (submitted_unit IN ('kg', 'g', 'szt')),
    reason text NOT NULL CHECK (reason IN ('burned', 'dropped', 'expired', 'spoiled', 'other')),
    reason_detail text CHECK (length(reason_detail) <= 500),
    voided_at timestamptz,
    void_reason text,
    void_role text,
    UNIQUE (report_id, ordinal),
    CHECK (product_id IS NULL OR product_id IN ('avocado', 'tomato', 'arugula', 'salad_mix',
        'feta_block', 'halloumi_reha', 'tirokafteri_8kg', 'tzatziki_5kg', 'falafel_1kg',
        'fries_aviko_2_5kg', 'sweet_potato_fries_2_27kg', 'gyros', 'pita',
        'souvlaki_chicken', 'souvlaki_pork', 'chickpea_mix', 'barley_mix')),
    CHECK (product_id IS NULL OR
        (product_id IN ('avocado', 'halloumi_reha', 'pita', 'souvlaki_chicken', 'souvlaki_pork') AND unit = 'szt') OR
        (product_id NOT IN ('avocado', 'halloumi_reha', 'pita', 'souvlaki_chicken', 'souvlaki_pork') AND unit = 'kg')),
    CHECK ((product_id IS NOT NULL AND length(trim(product_id)) > 0 AND description IS NULL) OR
           (product_id IS NULL AND description IS NOT NULL AND length(trim(description)) BETWEEN 1 AND 120)),
    CHECK (reason <> 'other' OR (reason_detail IS NOT NULL AND length(trim(reason_detail)) > 0)),
    CHECK ((voided_at IS NULL AND void_reason IS NULL AND void_role IS NULL) OR
           (voided_at IS NOT NULL AND void_reason IS NOT NULL AND void_role IS NOT NULL AND length(trim(void_reason)) BETWEEN 1 AND 500
            AND void_role IN ('captain', 'manager'))),
    CHECK ((unit = 'kg' AND submitted_unit IN ('kg', 'g')) OR
           (unit = 'szt' AND submitted_unit = 'szt')),
    CHECK (product_id IS NOT NULL OR submitted_unit <> 'g'),
    CHECK ((submitted_unit = 'g' AND submitted_quantity = trunc(submitted_quantity)
            AND quantity = submitted_quantity / 1000) OR
           (submitted_unit <> 'g' AND quantity = submitted_quantity))
);
ALTER TABLE waste_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_report_lines ENABLE ROW LEVEL SECURITY;
