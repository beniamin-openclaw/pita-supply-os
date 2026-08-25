-- ============================================================
-- Pita Supply OS — migration 0011: friendly Transport batch name
-- (to-ordering-pago v4 feedback round, feature 1)
--
-- ADDITIVE ONLY.
--
-- Adds an optional operator-facing display name to a Transport batch header,
-- distinct from the machine-generated ``transport_id`` (TRN-YYYYMMDD-...).
-- NULL/unset keeps today's behavior: the FE falls back to
-- "Transport {supplier_name} · {created date}" (see
-- frontend/src/pages/manager/lib/transport.ts::transportDisplayLabel).
--
-- Rollback:
--   ALTER TABLE transport_batches DROP COLUMN IF EXISTS name;
-- ============================================================

ALTER TABLE transport_batches ADD COLUMN IF NOT EXISTS name text;
