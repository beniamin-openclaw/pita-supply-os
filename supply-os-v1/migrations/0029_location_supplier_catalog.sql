-- ============================================================
-- Pita Supply OS — migration 0029: per-location supplier catalog
-- (krakow-katowice-rollout)
--
-- ADDITIVE ONLY.
--
--   locations.own_catalog           boolean NOT NULL DEFAULT false. True =
--                                   the location orders ONLY from
--                                   supplier_products rows scoped to it
--                                   (Kraków FORUM, Katowice SUPERSAM buy from
--                                   their own city suppliers). False = the
--                                   location uses the shared rows, exactly as
--                                   before (every Warsaw location).
--   supplier_products.location_id   text, nullable, FK locations. NULL = a
--                                   shared row (today's catalog). Set = the
--                                   row exists only at that location.
--   supplier_products.is_backup     boolean NOT NULL DEFAULT false. A backup
--                                   source for the product at its location:
--                                   orderable in that supplier's tab, but the
--                                   Captain gets no suggestion and no reason
--                                   gates for it (the primary supplier's tab
--                                   carries the suggestion). Only a scoped row
--                                   can be a backup (CHECK below).
--
-- The defaults keep today's behaviour byte-for-byte: no location has
-- own_catalog, no row is scoped, no row is a backup (app/supplier_catalog.py).
-- The city suppliers and scoped rows are a separate data step
-- (context/changes/krakow-katowice-rollout/prod-sql-B-suppliers-catalog.sql),
-- run only AFTER the backend that reads these columns is live: older code
-- ignores location_id and would show a scoped row at every location.
--
-- The legacy Sheet has no location_id / is_backup column. The Sheet ->
-- Postgres backfill (scripts/backfill_supabase.py) is insert-only (ON CONFLICT
-- DO NOTHING), so it never rewrites a scoped row, but any Sheet-only
-- supplier_products row it adds lands as a SHARED row: read its dry run first.
--
-- Keep this file free of the percent sign (the integration fixture applies it
-- via psycopg2 exec_driver_sql). Apply on prod BEFORE the backend that binds
-- the columns (_SUPPLIER_PRODUCT_COLUMNS and _LOCATION_COLUMNS list them, so an
-- insert against an unmigrated DB fails; reads are SELECT * and tolerate
-- either order). Re-runnable: ADD COLUMN IF NOT EXISTS, and the CHECK and the
-- index are dropped/created idempotently.
--
-- Rollback (after deleting every scoped row and the city suppliers —
-- context/changes/krakow-katowice-rollout/rollback.sql):
--   ALTER TABLE supplier_products DROP CONSTRAINT IF EXISTS supplier_products_backup_scoped_check;
--   DROP INDEX IF EXISTS supplier_products_location_id_idx;
--   ALTER TABLE supplier_products DROP COLUMN IF EXISTS is_backup;
--   ALTER TABLE supplier_products DROP COLUMN IF EXISTS location_id;
--   ALTER TABLE locations DROP COLUMN IF EXISTS own_catalog;
-- ============================================================

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS own_catalog boolean NOT NULL DEFAULT false;

ALTER TABLE supplier_products
    ADD COLUMN IF NOT EXISTS location_id text NULL REFERENCES locations(location_id);

ALTER TABLE supplier_products
    ADD COLUMN IF NOT EXISTS is_backup boolean NOT NULL DEFAULT false;

ALTER TABLE supplier_products DROP CONSTRAINT IF EXISTS supplier_products_backup_scoped_check;
ALTER TABLE supplier_products
    ADD CONSTRAINT supplier_products_backup_scoped_check
    CHECK (NOT is_backup OR location_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS supplier_products_location_id_idx
    ON supplier_products (location_id);
