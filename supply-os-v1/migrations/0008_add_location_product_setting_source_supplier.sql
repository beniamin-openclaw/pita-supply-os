-- 0008 — supplier-per-location: which supplier a location buys a product from.
--
-- NULL (the default, and every existing row) = unpinned: the product stays
-- orderable from every active supplier that carries it, i.e. today's behavior.
-- A value narrows visibility to exactly that supplier. Narrowing only — the
-- supplier_products catalog remains the universe.
--
-- Additive and nullable, so this is a no-op against current data (2026-08-20:
-- 578 rows, all unpinned; 154 products against 154 catalog entries).
--
-- ROLLBACK:
--   ALTER TABLE location_product_settings DROP COLUMN source_supplier_id;

ALTER TABLE location_product_settings
    ADD COLUMN IF NOT EXISTS source_supplier_id text
        REFERENCES suppliers(supplier_id);

COMMENT ON COLUMN location_product_settings.source_supplier_id IS
    'Supplier this location buys this product from. NULL = any active supplier '
    'carrying the product (default, backwards-compatible). Narrows visibility '
    'only; never widens it.';
