-- ============================================================
-- Pita Supply OS — migration 0027: products.inventory_order +
-- location_product_settings.inventory_order (inventory-card-order)
--
-- ADDITIVE ONLY. The position of a product on the printed inventory card
-- (the "… - DRUK" tabs of each location's inventory workbook):
--
--   products.inventory_order                   integer, nullable. The common
--                                              card template shared by every
--                                              location.
--   location_product_settings.inventory_order  integer, nullable. A
--                                              per-location override on the
--                                              same scale.
--
-- Effective position = the location override when set, else the template
-- (app/product_order.py: effective_inventory_order). The Captain inventory grid,
-- its correction screen, the Captain count history and the Manager inventory
-- detail sort by it, then by product_id; NULL on both sorts last. NULL
-- everywhere keeps the current order.
--
-- Positions are master data owned by the card pipeline
-- (context/changes/inventory-card-order/data/); never hand-edit them. The
-- values are a separate data UPDATE (context/changes/inventory-card-order/
-- prod-sql.sql).
--
-- Numbered 0027: 0025 is delivery-calendar, 0026 belongs to the
-- location-sender lane (branch claude/loving-feynman-2e6946). Keep this file
-- free of the percent sign (the integration fixture applies it via psycopg2
-- exec_driver_sql). Apply on prod BEFORE the backend that binds it
-- (_PRODUCT_COLUMNS and _LOCATION_PRODUCT_SETTING_COLUMNS list the column;
-- reads are SELECT * and tolerate either order), and before running
-- scripts/backfill_supabase.py against any database.
--
-- Rollback:
--   ALTER TABLE location_product_settings DROP COLUMN IF EXISTS inventory_order;
--   ALTER TABLE products DROP COLUMN IF EXISTS inventory_order;
-- ============================================================

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS inventory_order integer;

ALTER TABLE location_product_settings
    ADD COLUMN IF NOT EXISTS inventory_order integer;
