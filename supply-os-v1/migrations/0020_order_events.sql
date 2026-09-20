-- ============================================================
-- Pita Supply OS — migration 0020: order_events (post-send edit log)
-- (week2-feedback-quantities, Phase 6)
--
-- ADDITIVE ONLY.
--
-- A manager may now change quantities or add lines on a manager_sent order
-- until the first goods receipt exists. Every such change is one append-only
-- row here, modelled on transport_events (0010) and inventory_count_events
-- (0014): a server-computed "Product: old -> new" summary in `details`,
-- emitted best-effort (a failure here never fails the edit itself).
--
-- Applied on prod 2026-09-19 (MCP apply_migration) BEFORE deploying the
-- backend. Wire into tests/test_supabase_integration.py::_schema — including
-- _ALL_TABLES (before orders; the drop order is children-first) and
-- _TXN_TABLES. Keep this file free of the percent sign (psycopg2
-- exec_driver_sql).
--
-- Rollback:
--   DROP TABLE IF EXISTS order_events;
-- ============================================================

CREATE TABLE IF NOT EXISTS order_events (
    event_id    text            PRIMARY KEY,
    order_id    text            NOT NULL,
    event_type  text            NOT NULL,
    actor       text,
    at          timestamptz,
    details     text            NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS order_events_order_id_idx
    ON order_events (order_id);

-- RLS deny-all (same rationale as migration 0002).
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
