-- ============================================================
-- Pita Supply OS — migration 0022: suppliers.suggestion_alerts_enabled
-- (pago-suggestion-no-alerts)
--
-- ADDITIVE ONLY. Per-supplier switch for the Captain order screen: when
-- false, the suggestion (target minus stock, with its math) is still shown,
-- but no deviation alert is displayed and no reason is ever required — the
-- backend skips the >25 pct deviation, critical under-order and uncounted
-- over-MAX gates for that supplier. Default true keeps every existing
-- supplier exactly as before; the Pago switch is a separate data UPDATE
-- (context/changes/pago-suggestion-no-alerts/prod-sql.sql).
--
-- Numbered 0022: 0018 belongs to the dynamic-target-wola branch (PR #30),
-- 0021 to pago-transport-only-dispatch. Keep this file free of the percent
-- sign (integration fixture applies it via psycopg2 exec_driver_sql).
-- Apply on prod BEFORE the backend that reads it (_SUPPLIER_COLUMNS lists it).
-- Applied on prod 2026-09-27 (MCP apply_migration), before the code deploy.
--
-- Rollback:
--   ALTER TABLE suppliers DROP COLUMN IF EXISTS suggestion_alerts_enabled;
-- ============================================================

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS suggestion_alerts_enabled boolean NOT NULL DEFAULT true;
