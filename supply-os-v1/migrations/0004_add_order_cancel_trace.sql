-- order-cancel-with-trace: Manager soft-cancel of a pre-dispatch order records a
-- durable who/when/why trace. Add three additive, nullable/defaulted columns to
-- orders. The status CHECK already allows 'cancelled' (0001), so no constraint
-- change. No backfill (existing rows keep cancelled_at/cancelled_by NULL,
-- cancel_reason '').
-- NOTE: keep this file free of the percent sign — the integration fixture applies
-- it via psycopg2 exec_driver_sql, where a literal percent is read as a param marker.
-- Apply live to prod Supabase BEFORE deploying the backend code (the cancel write
-- targets these columns); recorded here for CI + fresh provisions.
-- IF NOT EXISTS so a re-apply (re-provision, repeated MCP apply) is idempotent.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS cancelled_at  timestamptz,
    ADD COLUMN IF NOT EXISTS cancelled_by  text,
    ADD COLUMN IF NOT EXISTS cancel_reason text NOT NULL DEFAULT '';
