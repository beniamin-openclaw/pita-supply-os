-- ============================================================
-- Pita Supply OS — migration 0015: warehouse-pickup flag
-- (training-feedback-0901, Phase 4)
--
-- ADDITIVE ONLY.
--
-- SUP_PAGO is a PURCHASING CHANNEL, not a warehouse: one Pago batch mixes
-- frozen meat and chilled dips with till rolls, napkins and trays. The
-- self-pickup document ("ZLECENIE ODBIORU WLASNEGO") is the run to the
-- cold-storage warehouse, so it must list only the goods actually collected
-- there. This flag is that distinction, held as master data rather than a
-- hardcoded category list.
--
-- Scope: ONLY the pickup document filters on this column. The Pago order email
-- and the order PDF still cover the whole batch — the warehouse run is a
-- subset of the purchase.
--
-- DEFAULT false means every existing row starts excluded. Apply the data pass
-- (UPDATE ... SET warehouse_pickup = true for the Pago cold/frozen SKUs, with
-- a SELECT-diff saved first) BEFORE deploying the filtering code, or the
-- pickup document renders an empty product table.
--
-- Modelled in Pydantic as `bool = False`, not Optional[bool] = None — see 0013.
--
-- Rollback:
--   ALTER TABLE supplier_products DROP COLUMN IF EXISTS warehouse_pickup;
-- ============================================================

ALTER TABLE supplier_products
    ADD COLUMN IF NOT EXISTS warehouse_pickup boolean NOT NULL DEFAULT false;
