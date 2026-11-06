-- Additive only: no historical order changes or backfill. Apply before enabling capture.
-- Rollback: disable SUPPLY_OS_ORDER_NOTIFICATIONS_ENABLED; preserve this table and receipts.
CREATE TABLE IF NOT EXISTS order_submission_events (
    order_id text PRIMARY KEY REFERENCES orders(order_id),
    submitted_at timestamptz NOT NULL,
    payload jsonb NOT NULL,
    ingested_at timestamptz NULL
);

ALTER TABLE order_submission_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS order_submission_events_pending_idx
    ON order_submission_events (submitted_at, order_id) WHERE ingested_at IS NULL;
CREATE INDEX IF NOT EXISTS order_submission_events_time_idx
    ON order_submission_events (submitted_at, order_id);

CREATE OR REPLACE FUNCTION protect_order_submission_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.order_id IS DISTINCT FROM OLD.order_id
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.payload IS DISTINCT FROM OLD.payload THEN
        RAISE EXCEPTION 'Order submission snapshots are immutable';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_submission_snapshot_immutable ON order_submission_events;
CREATE TRIGGER order_submission_snapshot_immutable BEFORE UPDATE ON order_submission_events
    FOR EACH ROW EXECUTE FUNCTION protect_order_submission_snapshot();
