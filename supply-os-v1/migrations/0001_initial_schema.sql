-- ============================================================
-- Pita Supply OS — Supabase Postgres schema (S-10, migration 0001)
--
-- Column names match the Pydantic model_dump() field names exactly, so the
-- supabase_backend (Phase 3) round-trips the same models as the sheets backend.
-- All PKs are text (existing IDs like ORD-20260615-WOL-BUKA-a1b2c3 are
-- meaningful + URL-transparent). Quantities/prices are numeric (not float) so
-- the suggestion-review SUM/AVG stays exact. Enums are text + CHECK (not native
-- ENUM) so adding a value later is a transactional DROP/ADD CONSTRAINT and the
-- Supabase Table Editor (future CRUD) treats cells as plain text.
-- ============================================================

-- -------------------------------------------------------
-- MASTER DATA
-- -------------------------------------------------------

CREATE TABLE products (
    product_id          text        PRIMARY KEY,
    gostock_id          integer,
    product_name_pl     text        NOT NULL,
    product_category    text        NOT NULL,
    inventory_unit      text        NOT NULL,
    is_critical         boolean     NOT NULL DEFAULT false,
    active              boolean     NOT NULL DEFAULT true,
    notes               text        NOT NULL DEFAULT ''
);

CREATE TABLE suppliers (
    supplier_id              text          PRIMARY KEY,
    supplier_name            text          NOT NULL,
    email                    text,
    ordering_method          text          NOT NULL DEFAULT 'email'
        CONSTRAINT suppliers_ordering_method_check
            CHECK (ordering_method IN ('email','portal','phone','manual')),
    delivery_days            text,
    cutoff_time              text,
    minimum_order_value_pln  numeric(10,2),
    active                   boolean       NOT NULL DEFAULT true,
    notes                    text          NOT NULL DEFAULT ''
);

CREATE TABLE locations (
    location_id         text        PRIMARY KEY,
    location_name       text        NOT NULL,
    delivery_address    text,
    city                text,
    active              boolean     NOT NULL DEFAULT true,
    notes               text        NOT NULL DEFAULT ''
);

CREATE TABLE supplier_products (
    supplier_product_id      text            PRIMARY KEY,
    supplier_id              text            NOT NULL REFERENCES suppliers(supplier_id),
    product_id               text            NOT NULL REFERENCES products(product_id),
    supplier_product_name    text            NOT NULL,
    purchase_unit            text            NOT NULL,
    units_per_purchase_unit  numeric(12,4)   NOT NULL DEFAULT 1.0,
    rounding_rule            text            NOT NULL DEFAULT 'full_only'
        CONSTRAINT supplier_products_rounding_rule_check
            CHECK (rounding_rule IN ('full_only','half_allowed','up_for_critical','tenth_kg')),
    price_estimate_pln       numeric(10,2),
    active                   boolean         NOT NULL DEFAULT true,
    notes                    text            NOT NULL DEFAULT ''
);

CREATE TABLE location_product_settings (
    setting_id                       text            PRIMARY KEY,
    location_id                      text            NOT NULL REFERENCES locations(location_id),
    product_id                       text            NOT NULL REFERENCES products(product_id),
    min_stock_qty_base               numeric(12,4)   NOT NULL DEFAULT 0,
    max_stock_qty_base               numeric(12,4)   NOT NULL DEFAULT 0,
    target_stock_qty_base            numeric(12,4)   NOT NULL DEFAULT 0,
    is_critical_for_location         boolean         NOT NULL DEFAULT false,
    allow_over_max_due_to_packaging  boolean         NOT NULL DEFAULT false,
    notes                            text            NOT NULL DEFAULT '',
    -- CRUD-UI safety: one setting per (location, product)
    CONSTRAINT location_product_settings_unique UNIQUE (location_id, product_id)
);

-- -------------------------------------------------------
-- TRANSACTIONAL DATA — ORDERS
-- -------------------------------------------------------

CREATE TABLE orders (
    order_id                  text            PRIMARY KEY,
    location_id               text            NOT NULL REFERENCES locations(location_id),
    supplier_id               text            NOT NULL REFERENCES suppliers(supplier_id),
    order_date                date            NOT NULL,
    requested_delivery_date   date,
    status                    text            NOT NULL DEFAULT 'draft'
        CONSTRAINT orders_status_check
            CHECK (status IN ('draft','captain_submitted','manager_claimed',
                              'manager_sent','closed','cancelled')),
    captain_user              text,
    captain_submitted_at      timestamptz,
    manager_user              text,
    manager_sent_at           timestamptz,
    sent_method               text,
    supplier_order_reference  text,
    total_value_estimate_pln  numeric(10,2),
    last_edited_at            timestamptz,
    notes                     text            NOT NULL DEFAULT ''
);

CREATE INDEX orders_location_status_idx ON orders (location_id, status);
CREATE INDEX orders_submitted_idx ON orders (captain_submitted_at DESC NULLS LAST);

CREATE TABLE order_lines (
    order_line_id               text            PRIMARY KEY,
    order_id                    text            NOT NULL REFERENCES orders(order_id),
    product_id                  text            NOT NULL REFERENCES products(product_id),
    supplier_product_id         text            NOT NULL REFERENCES supplier_products(supplier_product_id),
    current_stock_qty_base      numeric(12,4)   NOT NULL DEFAULT 0,
    target_stock_qty_base       numeric(12,4)   NOT NULL DEFAULT 0,
    -- LEARNING LOOP (backfill-critical; feeds /api/manager/suggestion-review):
    -- suggested_qty_purchase, captain_final_qty_purchase, manager_final_qty_purchase,
    -- delta_vs_suggestion_pct, reason_code must be migrated verbatim from Sheets.
    suggested_qty_base          numeric(12,4)   NOT NULL DEFAULT 0,
    suggested_qty_purchase      numeric(12,4)   NOT NULL DEFAULT 0,
    captain_final_qty_purchase  numeric(12,4)   NOT NULL DEFAULT 0,
    captain_final_qty_base      numeric(12,4)   NOT NULL DEFAULT 0,
    manager_final_qty_purchase  numeric(12,4)   NOT NULL DEFAULT 0,
    manager_final_qty_base      numeric(12,4)   NOT NULL DEFAULT 0,
    delta_vs_suggestion_pct     numeric(8,6),
    reason_code                 text
        CONSTRAINT order_lines_reason_code_check
            CHECK (reason_code IS NULL OR reason_code IN (
                'EVENT_HIGH_TRAFFIC','WEEKEND_HIGH_TRAFFIC','LOW_STORAGE',
                'PACKAGING_LIMITATION','SUPPLIER_UNDERDELIVERS',
                'SYSTEM_SUGGESTION_WRONG','OTHER')),
    captain_comment             text            NOT NULL DEFAULT '',
    manager_comment             text            NOT NULL DEFAULT ''
);

CREATE INDEX order_lines_order_id_idx ON order_lines (order_id);
CREATE INDEX order_lines_product_id_idx ON order_lines (product_id);  -- suggestion-review scan

-- -------------------------------------------------------
-- TRANSACTIONAL DATA — INVENTORY COUNTS
-- -------------------------------------------------------

CREATE TABLE inventory_counts (
    count_id            text        PRIMARY KEY,
    location_id         text        NOT NULL REFERENCES locations(location_id),
    count_date          date        NOT NULL,
    count_user          text,
    count_submitted_at  timestamptz,
    line_count          integer     NOT NULL DEFAULT 0,   -- denormalised for list endpoints
    notes               text        NOT NULL DEFAULT ''
);

CREATE INDEX inventory_counts_loc_date_idx ON inventory_counts (location_id, count_date DESC);

CREATE TABLE inventory_count_lines (
    count_line_id           text            PRIMARY KEY,
    count_id                text            NOT NULL REFERENCES inventory_counts(count_id),
    product_id              text            NOT NULL REFERENCES products(product_id),
    current_stock_qty_base  numeric(12,4)   NOT NULL DEFAULT 0,
    count_comment           text            NOT NULL DEFAULT ''
);

CREATE INDEX inventory_count_lines_count_id_idx ON inventory_count_lines (count_id);

-- -------------------------------------------------------
-- TRANSACTIONAL DATA — RECEIPTS (GOODS RECEIVING)
-- -------------------------------------------------------

CREATE TABLE receipts (
    receipt_id                text        PRIMARY KEY,
    order_id                  text        NOT NULL REFERENCES orders(order_id),
    location_id               text        NOT NULL REFERENCES locations(location_id),
    supplier_id               text        NOT NULL REFERENCES suppliers(supplier_id),
    receipt_date              date        NOT NULL,
    received_by               text,
    received_submitted_at     timestamptz,
    line_count                integer     NOT NULL DEFAULT 0,   -- denormalised
    discrepancy_count         integer     NOT NULL DEFAULT 0,   -- denormalised
    received_with_missing_wz  boolean     NOT NULL DEFAULT true,
    wz_photo_path_prefix      text,                             -- Supabase Storage: wz/<order_id>
    wz_photo_count            integer     NOT NULL DEFAULT 0,
    notes                     text        NOT NULL DEFAULT ''
);

CREATE INDEX receipts_order_id_idx ON receipts (order_id);
CREATE INDEX receipts_location_submitted_idx ON receipts (location_id, received_submitted_at DESC NULLS LAST);

CREATE TABLE receipt_lines (
    receipt_line_id        text            PRIMARY KEY,
    receipt_id             text            NOT NULL REFERENCES receipts(receipt_id),
    order_id               text            NOT NULL REFERENCES orders(order_id),
    order_line_id          text            NOT NULL REFERENCES order_lines(order_line_id),
    product_id             text            NOT NULL REFERENCES products(product_id),
    supplier_product_id    text            NOT NULL REFERENCES supplier_products(supplier_product_id),
    ordered_qty_purchase   numeric(12,4)   NOT NULL DEFAULT 0,  -- snapshot: manager_final if >0 else captain_final
    received_qty_purchase  numeric(12,4)   NOT NULL DEFAULT 0,
    variance_qty_purchase  numeric(12,4)   NOT NULL DEFAULT 0,  -- stored (received - ordered)
    receipt_comment        text            NOT NULL DEFAULT ''
);

CREATE INDEX receipt_lines_receipt_id_idx ON receipt_lines (receipt_id);

-- -------------------------------------------------------
-- CONFIG
-- -------------------------------------------------------

CREATE TABLE _meta (
    key     text    PRIMARY KEY,
    value   text
);
