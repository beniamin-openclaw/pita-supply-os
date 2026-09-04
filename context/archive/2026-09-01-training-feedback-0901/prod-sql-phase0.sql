-- ============================================================
-- training-feedback-0901 — Phase 0: RLS on leftover backup tables
--
-- Found while grounding this change, unrelated to the training feedback.
-- Nine snapshot/backup tables in `public` have RLS DISABLED, so they are
-- readable AND writable with the anon/authenticated Supabase key. Every real
-- product table carries deny-all RLS from migration 0002.
--
-- The app connects as the table owner (postgres role) and bypasses RLS, so
-- enabling it here costs nothing operationally.
--
-- Verified on prod 2026-09-02:
--   select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
--   where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false;
-- ============================================================

ALTER TABLE _lps_backup_20260831                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE _draft_bak_batches_20260901          ENABLE ROW LEVEL SECURITY;
ALTER TABLE _draft_bak_lines_20260901            ENABLE ROW LEVEL SECURITY;
ALTER TABLE _draft_bak_orders_20260901           ENABLE ROW LEVEL SECURITY;
ALTER TABLE _training_bak_batches_20260901       ENABLE ROW LEVEL SECURITY;
ALTER TABLE _training_bak_lines_20260901         ENABLE ROW LEVEL SECURITY;
ALTER TABLE _training_bak_orders_20260901        ENABLE ROW LEVEL SECURITY;
ALTER TABLE _training_bak_receipts_20260901      ENABLE ROW LEVEL SECURITY;
ALTER TABLE _training_bak_receipt_lines_20260901 ENABLE ROW LEVEL SECURITY;

-- AUDIT — must return zero rows:
-- select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname='public' and c.relkind='r' and c.relrowsecurity = false;

-- ALTERNATIVE, if these snapshots are no longer needed. Confirm each first —
-- _lps_backup_20260831 is the rollback for the KEN/BROWARY threshold rollout.
-- DROP TABLE IF EXISTS _draft_bak_batches_20260901;
-- DROP TABLE IF EXISTS _draft_bak_lines_20260901;
-- DROP TABLE IF EXISTS _draft_bak_orders_20260901;
-- DROP TABLE IF EXISTS _training_bak_batches_20260901;
-- DROP TABLE IF EXISTS _training_bak_lines_20260901;
-- DROP TABLE IF EXISTS _training_bak_orders_20260901;
-- DROP TABLE IF EXISTS _training_bak_receipts_20260901;
-- DROP TABLE IF EXISTS _training_bak_receipt_lines_20260901;
