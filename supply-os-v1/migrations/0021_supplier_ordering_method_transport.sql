-- ============================================================
-- Pita Supply OS — migration 0021: suppliers.ordering_method = 'transport'
-- (pago-transport-only-dispatch)
--
-- ADDITIVE ONLY (one more allowed value in an existing CHECK). No row is
-- changed here.
--
-- 'transport' marks a supplier whose orders leave the system ONLY through a
-- Manager Transport batch (POST /api/manager/transport/finalize). The
-- per-order dispatch route (manager_dispatch) refuses such an order with 409
-- and points the operator at the Transport screen. First use: SUP_PAGO.
--
-- ORDER OF OPERATIONS: this migration is safe to apply at ANY time (it only
-- widens the CHECK; every existing value stays valid). The DATA pass that
-- sets a supplier row to 'transport' must run ONLY AFTER the build carrying
-- the new enum member (app/models.py OrderingMethod.TRANSPORT) is live: an
-- unknown value raises a Pydantic ValidationError inside load_suppliers and
-- 500s every screen that reads suppliers (Captain order screen, Manager
-- queue, Transport). The repo already had this failure once with
-- supplier_products.rounding_rule = 'tenth_kg' ahead of its enum member.
--
-- Rollback (only while no supplier row carries 'transport'):
--   ALTER TABLE suppliers DROP CONSTRAINT suppliers_ordering_method_check;
--   ALTER TABLE suppliers ADD CONSTRAINT suppliers_ordering_method_check
--       CHECK (ordering_method IN ('email','portal','phone','manual'));
-- ============================================================

ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_ordering_method_check;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_ordering_method_check
    CHECK (ordering_method IN ('email','portal','phone','manual','transport'));
