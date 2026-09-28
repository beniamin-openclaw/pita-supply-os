-- ============================================================
-- Pita Supply OS — migration 0025: delivery calendar
-- (delivery-calendar)
--
-- ADDITIVE ONLY.
--
--   orders.suggested_delivery_date   date, nullable. The delivery date the
--                                    calendar proposed when the Captain
--                                    submitted (requested_delivery_date is the
--                                    date the Captain chose). NULL = no
--                                    rule-based proposal (legacy rows,
--                                    suppliers without a rule).
--   orders.coverage_days             smallint, nullable, 1 or 3. The
--                                    Thursday "na 1 dzien / na 3 dni" choice.
--                                    Informational only; NULL = not asked or
--                                    not answered.
--   suppliers.coverage_prompt_enabled
--                                    boolean NOT NULL DEFAULT false. Which
--                                    suppliers show the Thursday prompt.
--   supplier_delivery_rules          one row per supplier (location_id NULL =
--                                    shared rule) or per supplier + location
--                                    (override). order_weekdays + lead_days +
--                                    delivery_weekdays + order_deadline (HH:MM
--                                    Europe/Warsaw) — see app/delivery_calendar.py.
--
-- Defaults leave every existing row exactly as before; the rules and the two
-- flagged suppliers are a separate data step
-- (context/changes/delivery-calendar/prod-sql.sql).
--
-- Numbered 0025: 0018 belongs to the dynamic-target-wola branch (PR #30),
-- 0024 to the zero-quantity lane, 0026 to the order e-mail lane. Keep this
-- file free of the percent sign (the integration fixture applies it via
-- psycopg2 exec_driver_sql). Apply on prod BEFORE the backend that binds it
-- (_ORDER_COLUMNS and _SUPPLIER_COLUMNS list the new columns, so an insert
-- against an unmigrated DB fails). UNIQUE NULLS NOT DISTINCT needs
-- Postgres 15+ (prod 17, CI 16).
--
-- Rollback:
--   DROP TABLE IF EXISTS supplier_delivery_rules;
--   ALTER TABLE suppliers DROP COLUMN IF EXISTS coverage_prompt_enabled;
--   ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_coverage_days_check;
--   ALTER TABLE orders DROP COLUMN IF EXISTS coverage_days;
--   ALTER TABLE orders DROP COLUMN IF EXISTS suggested_delivery_date;
-- ============================================================

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS suggested_delivery_date date;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS coverage_days smallint;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_coverage_days_check;
ALTER TABLE orders
    ADD CONSTRAINT orders_coverage_days_check
    CHECK (coverage_days IS NULL OR coverage_days IN (1, 3));

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS coverage_prompt_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS supplier_delivery_rules (
    rule_id            text        PRIMARY KEY,
    supplier_id        text        NOT NULL REFERENCES suppliers (supplier_id),
    location_id        text        REFERENCES locations (location_id),
    order_weekdays     text        NOT NULL,
    lead_days          smallint    NOT NULL,
    delivery_weekdays  text        NOT NULL,
    order_deadline     text        NOT NULL DEFAULT '17:00',
    active             boolean     NOT NULL DEFAULT true,
    notes              text        NOT NULL DEFAULT '',
    CONSTRAINT supplier_delivery_rules_supplier_location_key
        UNIQUE NULLS NOT DISTINCT (supplier_id, location_id),
    CONSTRAINT supplier_delivery_rules_lead_days_check
        CHECK (lead_days BETWEEN 0 AND 14),
    CONSTRAINT supplier_delivery_rules_order_deadline_check
        CHECK (order_deadline ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT supplier_delivery_rules_order_weekdays_check
        CHECK (order_weekdays ~ '^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(,(Mon|Tue|Wed|Thu|Fri|Sat|Sun))*$'),
    CONSTRAINT supplier_delivery_rules_delivery_weekdays_check
        CHECK (delivery_weekdays ~ '^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(,(Mon|Tue|Wed|Thu|Fri|Sat|Sun))*$')
);

-- RLS deny-all (same rationale as migration 0002).
ALTER TABLE supplier_delivery_rules ENABLE ROW LEVEL SECURITY;
