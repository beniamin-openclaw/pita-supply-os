-- product-order-note-and-min-flag — apply to PROD Supabase BEFORE deploying the
-- backend (supabase_backend._SUPPLIER_PRODUCT_COLUMNS now references order_note).
-- Run in the Supabase SQL editor. Idempotent.

-- 1. Schema: add the annotation column (few-words cap enforced here at the DB).
ALTER TABLE supplier_products
    ADD COLUMN IF NOT EXISTS order_note varchar(60);

-- 2. Tzatziki annotation (Bukat).
UPDATE supplier_products
   SET order_note = '1 karton = 6 szt (18 kg)'
 WHERE supplier_product_id = 'SP_BUKAT_P011';

-- 3. Wola Tzatziki min -> 18 kg (6 szt = 1 karton) to exercise the below-min badge.
UPDATE location_product_settings
   SET min_stock_qty_base = 18
 WHERE location_id = 'WOLA' AND product_id = 'P011';
