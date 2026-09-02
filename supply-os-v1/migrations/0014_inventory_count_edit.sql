-- ============================================================
-- Pita Supply OS — migration 0014: inventory-count edit + audit log
-- (training-feedback-0901, Phase 2)
--
-- ADDITIVE ONLY.
--
-- Until now an inventory count was append-only and immutable: a Captain
-- interrupted halfway had to redo the whole location. This adds a safe,
-- audited correction path.
--
--   inventory_count_events — append-only audit log, modelled on
--                            transport_events (0010). One row per correction,
--                            with a server-computed "Product: old -> new"
--                            diff in `details`. Emitted best-effort: a failure
--                            here must never fail the correction itself.
--
--   inventory_counts.last_edited_at — mirrors orders.last_edited_at. NULL means
--                            never corrected. count_submitted_at deliberately
--                            keeps the ORIGINAL submit moment: it is the
--                            recency key for captain_inventory_latest and the
--                            timestamp the FR-017 pre-fill banner names.
--
-- Apply to PROD Supabase BEFORE deploying the backend. Wire into
-- tests/test_supabase_integration.py::_schema — including _ALL_TABLES
-- (before inventory_counts; the drop order is children-first) and _TXN_TABLES.
--
-- Rollback:
--   DROP TABLE IF EXISTS inventory_count_events;
--   ALTER TABLE inventory_counts DROP COLUMN IF EXISTS last_edited_at;
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_count_events (
    event_id    text            PRIMARY KEY,
    count_id    text            NOT NULL,
    event_type  text            NOT NULL,
    actor       text,
    at          timestamptz,
    details     text            NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS inventory_count_events_count_id_idx
    ON inventory_count_events (count_id);

ALTER TABLE inventory_counts
    ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

-- RLS deny-all (same rationale as migration 0002).
ALTER TABLE inventory_count_events ENABLE ROW LEVEL SECURITY;
