-- ============================================================
-- Pita Supply OS — migration 0012: supplier catalog code (Nr katalogowy)
-- (to-ordering-pago, Nr katalogowy feature)
--
-- ADDITIVE ONLY.
--
-- Adds an optional supplier-owned catalog code to a supplier_product row,
-- distinct from our own product_name_pl / supplier_product_name. Pago's
-- systems need their own catalog codes (e.g. 'GYRSW15KG') on the Transport
-- "PDF — zamówienie" (Pago pickup order) "Nr katalogowy" column; every other
-- surface (driver doc, matrix, emails) keeps friendly names. NULL/unset keeps
-- today's behavior: the FE falls back to the friendly product name (see
-- frontend/src/pages/manager/lib/transport.ts::buildTransportPagoPrintDoc).
--
-- Rollback:
--   ALTER TABLE supplier_products DROP COLUMN IF EXISTS supplier_sku;
-- ============================================================

ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS supplier_sku text;
