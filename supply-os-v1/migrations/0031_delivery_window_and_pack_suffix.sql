-- ============================================================
-- Pita Supply OS — migration 0031: per-location delivery window +
-- per-supplier "strip the pack suffix" switch for the supplier e-mail
-- (supplier-email-1019, owner decisions of the 2026-10-19 meeting)
--
-- ADDITIVE ONLY. Three columns:
--
--   locations.delivery_window_from / delivery_window_to (text, nullable)
--     The hours the location accepts deliveries, "H:MM" or "HH:MM", printed
--     as written on the "Dostawa:" line of the supplier e-mail:
--       both set   -> "w godzinach 9:00–10:00"
--       from only  -> "od godziny 10:00"
--       to only    -> "do godziny 10:00"
--       neither    -> "od godziny 11:00" (today's fixed line, unchanged)
--     NULL everywhere after this migration, so no e-mail changes until the
--     guarded data step (context/changes/supplier-email-1019/prod-sql.sql)
--     sets WESTFIELD 9:00–10:00.
--
--   suppliers.email_strip_pack_suffix (boolean NOT NULL DEFAULT false)
--     True = the supplier e-mail drops the "how many per carton" suffix from
--     product names ("MIÓD 25g/30" -> "MIÓD 25g"), the rule of the Captain
--     view (PR #65, D3). Intermlecz only, set by the same data step.
--
-- Numbered 0031 (0030 = locations.require_stock_count, the latest on main).
-- Keep this file free of the percent sign (the integration fixture applies it
-- via psycopg2 exec_driver_sql). Apply on prod BEFORE the backend that binds
-- the columns (_LOCATION_COLUMNS / _SUPPLIER_COLUMNS list them for inserts;
-- reads are SELECT * and tolerate their absence). Re-runnable.
--
-- Rollback:
--   ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_delivery_window_from_format;
--   ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_delivery_window_to_format;
--   ALTER TABLE locations DROP COLUMN IF EXISTS delivery_window_from;
--   ALTER TABLE locations DROP COLUMN IF EXISTS delivery_window_to;
--   ALTER TABLE suppliers DROP COLUMN IF EXISTS email_strip_pack_suffix;
-- ============================================================

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS delivery_window_from text,
    ADD COLUMN IF NOT EXISTS delivery_window_to text;

-- "H:MM" / "HH:MM", 0:00..23:59. Dropped and re-added so a re-run stays clean.
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_delivery_window_from_format;
ALTER TABLE locations
    ADD CONSTRAINT locations_delivery_window_from_format
    CHECK (delivery_window_from IS NULL
           OR delivery_window_from ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_delivery_window_to_format;
ALTER TABLE locations
    ADD CONSTRAINT locations_delivery_window_to_format
    CHECK (delivery_window_to IS NULL
           OR delivery_window_to ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS email_strip_pack_suffix boolean NOT NULL DEFAULT false;
