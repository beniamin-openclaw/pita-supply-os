-- feedback-r5 (stopka NIP): locations gain the operating-company footer fields
-- (each location orders under its own spółka; the supplier email appends
-- company name + address + NIP). Additive, nullable — sheets/seed backends and
-- unfilled rows simply skip the footer block.
-- _LOCATION_COLUMNS references these, so inserts would error against a
-- pre-0007 schema (wire into the integration fixture — lessons.md).
-- NOTE: keep this file free of the percent sign — the integration fixture applies
-- it via psycopg2 exec_driver_sql, where a literal percent is read as a param marker.
-- Apply live to prod Supabase BEFORE deploying the backend code; recorded here for
-- CI + fresh provisions. IF NOT EXISTS so a re-apply is idempotent.
ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS company_name varchar(120),
    ADD COLUMN IF NOT EXISTS company_address varchar(160),
    ADD COLUMN IF NOT EXISTS company_nip varchar(20);
