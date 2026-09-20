-- ============================================================
-- Pita Supply OS — migration 0019: locations.email
-- (week2-feedback-quantities, Phase 2)
--
-- ADDITIVE ONLY. Each location has its own mailbox (the Gmail account the
-- location's phone reads); the supplier dispatch e-mail CCs it next to the
-- standing office copy (settings.order_cc_email) so the location can see the
-- order was placed and react to problems. Nullable: a location without an
-- address simply gets no extra CC, and the sheets/seed backends ignore it.
--
-- Numbered 0019 (0018 belongs to the dynamic-target-wola branch, PR #30).
-- Keep this file free of the percent sign (integration fixture applies it via
-- psycopg2 exec_driver_sql). Applied on prod 2026-09-19 (MCP apply_migration)
-- BEFORE the backend that reads it; recorded here for CI and fresh provisions.
--
-- Rollback:
--   ALTER TABLE locations DROP COLUMN IF EXISTS email;
-- ============================================================

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS email varchar(120);
