-- order-ordered-by: Captain submit captures a required free-text "who orders"
-- (ordered_by), surfaced to the Manager. Add one additive, nullable column to
-- orders. No backfill (existing rows keep ordered_by NULL).
-- NOTE: keep this file free of the percent sign — the integration fixture applies
-- it via psycopg2 exec_driver_sql, where a literal percent is read as a param marker.
-- Apply live to prod Supabase BEFORE deploying the backend code (append_order now
-- writes this column); recorded here for CI + fresh provisions.
-- IF NOT EXISTS so a re-apply (re-provision, repeated MCP apply) is idempotent.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS ordered_by text;
