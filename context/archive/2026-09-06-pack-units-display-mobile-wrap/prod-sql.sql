-- pack-units-display-mobile-wrap — prod master data, 2026-09-06
-- BEFORE (prod, verified 2026-09-06):
--   products P179: product_name_pl = 'Kebab z Kurczaka 50/50 15 KG', category Mrożonki, kg, active
--   supplier_products SP_SPEC_P179: supplier_product_name = 'Kebab z Kurczaka 50/50 15KG', blok x 15
-- Only the internal display name changes; the supplier catalogue name (printed in the Spec Food
-- order e-mail — gmail_url.py prefers supplier_product_name) is deliberately kept.
-- ROLLBACK: UPDATE products SET product_name_pl = 'Kebab z Kurczaka 50/50 15 KG' WHERE product_id = 'P179';
BEGIN;
UPDATE products SET product_name_pl = 'Gyros z Kurczaka (Kebab)' WHERE product_id = 'P179';
-- AUDIT (expect 1 row with the new name, 0 rows with the old one)
SELECT product_id, product_name_pl FROM products WHERE product_id = 'P179';
COMMIT;
