-- ============================================================
-- Pita Supply OS — migration 0009: Transport batch header (v2 draft
-- lifecycle, to-ordering-pago ADDENDUM v2)
--
-- ADDITIVE ONLY. Independent of migration 0008 (multi-location-master-data
-- lane) — 0008 is NOT applied by this migration and this migration does not
-- depend on it.
--
-- Adds the ``transport_batches`` header row that a "TRN-" marker group of
-- orders (``orders.supplier_order_reference``) now points at, plus a
-- per-supplier-product weight column for the Transport batch weight
-- preview. A marker group with no header row is a v1-created legacy batch
-- (read-only, implicit status="sent" — see app/models.py TransportBatchSummary).
--
-- Rollback:
--   ALTER TABLE supplier_products DROP COLUMN IF EXISTS unit_weight_kg;
--   DROP TABLE IF EXISTS transport_batches;
-- ============================================================

CREATE TABLE transport_batches (
    transport_id  text            PRIMARY KEY,
    supplier_id   text            NOT NULL REFERENCES suppliers(supplier_id),
    status        text            NOT NULL DEFAULT 'draft'
        CONSTRAINT transport_batches_status_check
            CHECK (status IN ('draft', 'sent')),
    driver        text,
    vehicle       text,
    pickup_date   date,
    pickup_time   text,
    limit_kg      numeric(10,2)   DEFAULT 700,
    notes         text            NOT NULL DEFAULT '',
    created_at    timestamptz,
    created_by    text,
    sent_at       timestamptz
);

CREATE INDEX transport_batches_supplier_status_idx
    ON transport_batches (supplier_id, status);

ALTER TABLE supplier_products
    ADD COLUMN IF NOT EXISTS unit_weight_kg numeric(10,3);
