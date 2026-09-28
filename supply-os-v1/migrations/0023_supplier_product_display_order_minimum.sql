-- ============================================================
-- Pita Supply OS — migration 0023: supplier_products.display_order +
-- supplier_products.counts_toward_minimum (supplier-product-order-minimum)
--
-- ADDITIVE ONLY. Two per-supplier-product master-data columns:
--
--   display_order          integer, nullable. The product's position in its
--                          supplier's list. Every per-supplier screen and
--                          document (Captain order/edit/detail/receiving,
--                          Manager order detail, dispatch e-mail, copy
--                          lists, Transport) sorts by it, then by
--                          supplier_product_id for rows without a position
--                          (app/product_order.py and its TS twin
--                          frontend/src/lib/productOrder.ts). NULL keeps the
--                          current supplier_product_id order.
--   counts_toward_minimum  boolean NOT NULL DEFAULT true. False removes the
--                          product from the basis the informational
--                          minimum-order chip compares against the
--                          supplier minimum (Bukat: Tzatzyki, Tirokafteri,
--                          Feta blok). Never a gate.
--
-- Defaults leave every existing row exactly as before; the Bukat positions and
-- exclusions are a separate data UPDATE
-- (context/changes/supplier-product-order-minimum/prod-sql.sql).
--
-- Numbered 0023: 0018 belongs to the dynamic-target-wola branch (PR #30),
-- 0024 to the zero-quantity lane. Keep this file free of the percent sign
-- (the integration fixture applies it via psycopg2 exec_driver_sql).
-- Apply on prod BEFORE the backend that binds it (_SUPPLIER_PRODUCT_COLUMNS
-- lists both columns; reads are SELECT * and tolerate either order).
--
-- Rollback:
--   ALTER TABLE supplier_products DROP COLUMN IF EXISTS counts_toward_minimum;
--   ALTER TABLE supplier_products DROP COLUMN IF EXISTS display_order;
-- ============================================================

ALTER TABLE supplier_products
    ADD COLUMN IF NOT EXISTS display_order integer;

ALTER TABLE supplier_products
    ADD COLUMN IF NOT EXISTS counts_toward_minimum boolean NOT NULL DEFAULT true;
