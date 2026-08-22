-- ============================================================
-- Pita Supply OS — migration 0010: Transport event history (v3,
-- to-ordering-pago ADDENDUM v3 Phase 6)
--
-- ADDITIVE ONLY.
--
-- Adds the append-only transport_events audit log — emitted server-side from
-- create/add-location/remove-order/finalize/logistics-PATCH/cancel/
-- quantities-changed (manager_order_save on a transport member)/
-- delivery-confirmed (captain_receipt_submit on a transport member). Never
-- updated or deleted. Also extends transport_batches.status to allow
-- 'cancelled' (v3 Phase 7 cancel-draft), which migration 0009's CHECK
-- constraint did not anticipate.
--
-- Rollback:
--   ALTER TABLE transport_batches DROP CONSTRAINT transport_batches_status_check;
--   ALTER TABLE transport_batches ADD CONSTRAINT transport_batches_status_check
--       CHECK (status IN ('draft', 'sent'));
--   DROP TABLE IF EXISTS transport_events;
-- ============================================================

CREATE TABLE transport_events (
    event_id      text            PRIMARY KEY,
    transport_id  text            NOT NULL,
    order_id      text,
    event_type    text            NOT NULL,
    actor         text,
    at            timestamptz,
    details       text            NOT NULL DEFAULT ''
);

CREATE INDEX transport_events_transport_id_idx
    ON transport_events (transport_id);

ALTER TABLE transport_batches
    DROP CONSTRAINT transport_batches_status_check;

ALTER TABLE transport_batches
    ADD CONSTRAINT transport_batches_status_check
        CHECK (status IN ('draft', 'sent', 'cancelled'));

-- RLS deny-all (same rationale as migration 0002).
ALTER TABLE transport_events ENABLE ROW LEVEL SECURITY;
