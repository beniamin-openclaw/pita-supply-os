-- ============================================================
-- Pita Supply OS — migration 0018: location_product_usage
-- (dynamic-target-wola)
--
-- ADDITIVE ONLY (new table, no change to existing tables).
--
-- Daily usage estimate per location × product, in the product's inventory
-- unit — the first input of the dynamic target:
--     target = usage_per_day × (days until delivery + days to the next
--              delivery) + safety
-- Seeded from the GoStock analysis of 2026-09-06 (8 weeks of PZ, POS and
-- stock-flow per SKU, confidence A/B/C — see
-- docs/pita-supply-os-v1/analysis/gostock-2026-09-06/target_seed.csv).
-- The engine (app/dynamic_target.py) uses only ACTIVE rows with confidence
-- A or B; a location × product without such a row keeps the static
-- location_product_settings.target_stock_qty_base, byte-identically.
--
-- ORDER OF OPERATIONS: this migration may land before OR after the code —
-- main._load_usage_safe degrades a missing table to "static targets", so
-- code-first never 500s. The 18 WOLA rows, the supplier calendars (Pago
-- 'Tue, Sat', Coca-Cola 'Thu') and the max ceilings are a separate data
-- batch in context/changes/dynamic-target-wola/prod-sql.sql (BEFORE/AFTER).
--
-- Rollback:
--   DROP TABLE IF EXISTS location_product_usage;
-- ============================================================

CREATE TABLE location_product_usage (
    usage_id            text            PRIMARY KEY,
    location_id         text            NOT NULL REFERENCES locations(location_id),
    product_id          text            NOT NULL REFERENCES products(product_id),
    usage_per_day_base  numeric(12,4)   NOT NULL
        CONSTRAINT location_product_usage_usage_check CHECK (usage_per_day_base >= 0),
    confidence          text            NOT NULL
        CONSTRAINT location_product_usage_confidence_check CHECK (confidence IN ('A', 'B', 'C')),
    basis               text            NOT NULL DEFAULT '',
    source              text            NOT NULL DEFAULT '',
    as_of               date,
    safety_days         numeric(6,2)    NOT NULL DEFAULT 1
        CONSTRAINT location_product_usage_safety_check CHECK (safety_days >= 0),
    active              boolean         NOT NULL DEFAULT true,
    notes               text            NOT NULL DEFAULT '',
    -- one estimate per (location, product)
    CONSTRAINT location_product_usage_unique UNIQUE (location_id, product_id)
);

-- RLS deny-all (same rationale as migration 0002): the app connects as the
-- table owner and bypasses RLS; enabling it with no policies closes the anon
-- PostgREST surface.
ALTER TABLE location_product_usage ENABLE ROW LEVEL SECURITY;
