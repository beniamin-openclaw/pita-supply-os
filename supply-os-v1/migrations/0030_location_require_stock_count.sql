-- ============================================================
-- Pita Supply OS — migration 0030: locations.require_stock_count
-- (captain-stock-count-warning, owner decision D6 of 2026-10-17)
--
-- ADDITIVE ONLY. Per-location switch for the Captain order screen: when
-- true, the pre-submit dialog warns (never blocks) if the supplier's cards
-- carry no stock count at all, or only zeros. False = no such warning.
--
-- Default true: the owner's rule is "every location except NORBLIN and
-- ELEKTROWNIA, until revoked", so every existing row and every location
-- added later starts ON. The two exceptions are a separate guarded data
-- step (context/changes/captain-stock-count-warning/prod-sql.sql), as with
-- 0022 and the Pago switch. The backend reads the same default when the
-- column is absent (models.Location.require_stock_count = True).
--
-- Numbered 0030 (0029 = per-location supplier catalog, the latest on main).
-- Keep this file free of the percent sign (the integration fixture applies it
-- via psycopg2 exec_driver_sql). Apply on prod BEFORE the backend that binds
-- the column (_LOCATION_COLUMNS lists it for inserts; reads are SELECT * and
-- tolerate either order). Re-runnable: ADD COLUMN IF NOT EXISTS.
--
-- Rollback:
--   ALTER TABLE locations DROP COLUMN IF EXISTS require_stock_count;
-- ============================================================

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS require_stock_count boolean NOT NULL DEFAULT true;
