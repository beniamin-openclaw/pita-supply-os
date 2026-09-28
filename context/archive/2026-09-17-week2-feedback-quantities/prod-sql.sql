-- ============================================================
-- week2-feedback-quantities — Phase 0 prod master-data package
-- Supabase project lpzhphufjwrndfogkfub. BEFORE values: prod-diff-before.md
-- (that file is the rollback). Applied section by section via MCP execute_sql
-- on 2026-09-19 with operator permission (chat, 2026-09-19).
-- Section H (supplier days) skipped: still TBD per operator.
-- ============================================================

-- ---------- A. Bifteki: karton = 4,2 kg (APPLIED 2026-09-19) ----------
UPDATE supplier_products
   SET units_per_purchase_unit = 4.2,
       order_note = '1 karton = 4,2 kg',
       notes = 'karton 4,2 kg (spotkanie 2026-09-18); cena do potwierdzenia'
 WHERE supplier_product_id = 'SP_PAGO_P145';
UPDATE location_product_settings
   SET min_stock_qty_base = 2, target_stock_qty_base = 4.2, max_stock_qty_base = 4.2,
       allow_over_max_due_to_packaging = true,
       notes = notes || '; week2-feedback-quantities 2026-09-19: karton 4,2 kg'
 WHERE setting_id IN ('BRACKA__P145', 'NORBLIN__P145');
UPDATE location_product_settings
   SET min_stock_qty_base = 2, target_stock_qty_base = 8.4, max_stock_qty_base = 8.4,
       allow_over_max_due_to_packaging = true,
       notes = 'browary-arkusz-2026-08-31; week2-feedback-quantities 2026-09-19: 2 kartony po 4,2 kg (obejscie z 09-06 cofniete)'
 WHERE setting_id = 'BROWARY__P145';
INSERT INTO location_product_settings
  (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base,
   is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('WOLA__P145', 'WOLA', 'P145', 2, 4.2, 4.2, false, true,
        'week2-feedback-quantities 2026-09-19: karton 4,2 kg');

-- ---------- B. Coca-Cola: can 0,33 (NORBLIN, BROWARY) vs glass 0,25 (WOLA, BRACKA, KEN) (APPLIED) ----------
UPDATE products SET product_name_pl = 'Coca-Cola 0,33 l puszka' WHERE product_id = 'P068';
UPDATE products SET product_name_pl = 'Coca-Cola Zero 0,33 l puszka' WHERE product_id = 'P069';
UPDATE supplier_products SET supplier_product_name = 'Coca-Cola 0,33 l puszka' WHERE supplier_product_id = 'SP_COCACOLA_P068';
UPDATE supplier_products SET supplier_product_name = 'Coca-Cola Zero 0,33 l puszka' WHERE supplier_product_id = 'SP_COCACOLA_P069';
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes) VALUES
  ('P186', NULL, 'Coca-Cola 0,25 l szkło', 'Napoje', 'szt', true, true,
   'szkło 0,25 l — WOLA/BRACKA/KEN (week2-feedback-quantities 2026-09-19)'),
  ('P187', NULL, 'Coca-Cola Zero 0,25 l szkło', 'Napoje', 'szt', true, true,
   'szkło 0,25 l — WOLA/BRACKA/KEN (week2-feedback-quantities 2026-09-19)');
INSERT INTO supplier_products
  (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit,
   rounding_rule, price_estimate_pln, active, notes, order_note, unit_weight_kg, supplier_sku, warehouse_pickup) VALUES
  ('SP_COCACOLA_P186', 'SUP_COCACOLA', 'P186', 'Coca-Cola 0,25 l szkło', 'skrzynka', 24, 'up_for_critical', NULL, true,
   'skrzynka = 24 butelki (operator 2026-09-19); cena z portalu CC do uzupelnienia', '1 skrzynka = 24 szt', NULL, NULL, false),
  ('SP_COCACOLA_P187', 'SUP_COCACOLA', 'P187', 'Coca-Cola Zero 0,25 l szkło', 'skrzynka', 24, 'up_for_critical', NULL, true,
   'skrzynka = 24 butelki (operator 2026-09-19); cena z portalu CC do uzupelnienia', '1 skrzynka = 24 szt', NULL, NULL, false);
INSERT INTO location_product_settings
  (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base,
   is_critical_for_location, allow_over_max_due_to_packaging, notes)
SELECT location_id || '__P186', location_id, 'P186', min_stock_qty_base, max_stock_qty_base, target_stock_qty_base,
       is_critical_for_location, allow_over_max_due_to_packaging,
       'szkło 0,25 l; progi skopiowane z P068 (week2-feedback-quantities 2026-09-19)'
  FROM location_product_settings WHERE product_id = 'P068' AND location_id IN ('WOLA', 'BRACKA', 'KEN');
INSERT INTO location_product_settings
  (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base,
   is_critical_for_location, allow_over_max_due_to_packaging, notes)
SELECT location_id || '__P187', location_id, 'P187', min_stock_qty_base, max_stock_qty_base, target_stock_qty_base,
       is_critical_for_location, allow_over_max_due_to_packaging,
       'szkło 0,25 l; progi skopiowane z P069 (week2-feedback-quantities 2026-09-19)'
  FROM location_product_settings WHERE product_id = 'P069' AND location_id IN ('WOLA', 'BRACKA', 'KEN');
DELETE FROM location_product_settings WHERE product_id IN ('P068', 'P069') AND location_id IN ('WOLA', 'BRACKA', 'KEN');

-- ---------- C. Filber: Korfu + lemonades, box = 12 (APPLIED) ----------
UPDATE supplier_products
   SET purchase_unit = 'box', units_per_purchase_unit = 12, order_note = '1 box = 12 szt'
 WHERE supplier_product_id IN ('SP_FILBER_P075', 'SP_FILBER_P076', 'SP_FILBER_P077',
                               'SP_FILBER_P136', 'SP_FILBER_P137', 'SP_FILBER_P138', 'SP_FILBER_P157');
-- price was per zgrzewka of 6; doubled so the order total estimate stays coherent
UPDATE supplier_products SET price_estimate_pln = 71.4
 WHERE supplier_product_id IN ('SP_FILBER_P075', 'SP_FILBER_P076', 'SP_FILBER_P077');
UPDATE supplier_products SET rounding_rule = 'up_for_critical', notes = 'box 12 szt (spotkanie 2026-09-18)'
 WHERE supplier_product_id = 'SP_FILBER_P157';

-- ---------- D. Sponges in pieces, scrubbers + grill brush from Mory (APPLIED) ----------
UPDATE products SET inventory_unit = 'szt' WHERE product_id = 'P121';
UPDATE supplier_products
   SET purchase_unit = 'szt', order_note = 'opak. zbiorcze 10 szt',
       notes = 'liczone w sztukach (spotkanie 2026-09-18); opak. zbiorcze 10 szt; cena 0,6 byla za opak'
 WHERE supplier_product_id = 'SP_BLUESERV_P121';
UPDATE location_product_settings
   SET min_stock_qty_base = 5, max_stock_qty_base = 12, target_stock_qty_base = 12,
       notes = 'sztuki (week2-feedback-quantities 2026-09-19)'
 WHERE setting_id = 'WOLA__P121';
UPDATE supplier_products
   SET active = false, notes = 'nieaktywny od 2026-09-19: druciaki z magazynu Mory (Allegro/Selgros)'
 WHERE supplier_product_id = 'SP_BLUESERV_P122';
INSERT INTO supplier_products
  (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit,
   rounding_rule, price_estimate_pln, active, notes, order_note, unit_weight_kg, supplier_sku, warehouse_pickup) VALUES
  ('SP_MORY_P122', 'SUP_MORY', 'P122', 'Druciak do mycia', 'szt', 1, 'full_only', NULL, true,
   'magazyn Mory — Allegro/Selgros (spotkanie 2026-09-18)', NULL, NULL, NULL, false);
INSERT INTO products (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes) VALUES
  ('P188', NULL, 'Szczotka do grilla', 'Chemia', 'szt', false, true,
   'dodane 2026-09-19 (week2-feedback-quantities); magazyn Mory');
INSERT INTO supplier_products
  (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit,
   rounding_rule, price_estimate_pln, active, notes, order_note, unit_weight_kg, supplier_sku, warehouse_pickup) VALUES
  ('SP_MORY_P188', 'SUP_MORY', 'P188', 'Szczotka do grilla', 'szt', 1, 'full_only', NULL, true,
   'magazyn Mory — Allegro/Selgros (spotkanie 2026-09-18)', NULL, NULL, NULL, false);
INSERT INTO location_product_settings
  (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base,
   is_critical_for_location, allow_over_max_due_to_packaging, notes)
SELECT l || '__P188', l, 'P188', 0, 0, 0, false, false, 'bez progow — zamawiane wg potrzeby (2026-09-19)'
  FROM unnest(ARRAY['WOLA', 'BRACKA', 'NORBLIN', 'KEN', 'BROWARY']) AS l;

-- ---------- E. Gas bottles: free, no limits (APPLIED) ----------
UPDATE location_product_settings
   SET min_stock_qty_base = 0, max_stock_qty_base = 0, target_stock_qty_base = 0,
       notes = 'bez limitu — butle wg pustych (operator 2026-09-19)'
 WHERE setting_id IN ('WOLA__P181', 'BRACKA__P181', 'KEN__P181');
DELETE FROM location_product_settings WHERE setting_id IN ('NORBLIN__P181', 'NORBLIN__P182');
UPDATE supplier_products SET order_note = 'bez limitu — zamów tyle, ile pustych'
 WHERE supplier_product_id = 'SP_KAMINO_P181';

-- ---------- F. Bombilla: not ordered any more (APPLIED) ----------
UPDATE supplier_products SET active = false, notes = 'nieaktywny od 2026-09-19 (spotkanie: nie zamawiamy)'
 WHERE supplier_product_id = 'SP_BUKAT_P135';
DELETE FROM location_product_settings WHERE product_id = 'P135';

-- ---------- G. Names and notes (APPLIED) ----------
UPDATE products SET product_name_pl = 'Papryka grillowana grecka Florina (Florinis)' WHERE product_id = 'P017';
UPDATE supplier_products SET supplier_product_name = 'Papryka grillowana grecka Florina (Florinis)'
 WHERE supplier_product_id = 'SP_INTERMLECZ_P017';
UPDATE supplier_products
   SET purchase_unit = 'pojemnik', order_note = '1 pojemnik = 3 kg (karton 6)',
       notes = '1 pojemnik = 3 kg (cena 40 zl/pojemnik); karton = 6 pojemnikow'
 WHERE supplier_product_id = 'SP_BUKAT_P011';
UPDATE supplier_products SET order_note = 'opak. zbiorcze 12 szt' WHERE supplier_product_id = 'SP_INTERMLECZ_P015';
UPDATE supplier_products SET order_note = 'worek 5 kg' WHERE supplier_product_id IN ('SP_BUKAT_P016', 'SP_BUKAT_P018');
UPDATE suppliers
   SET notes = notes || ' Kapitani zgłaszają w apce; realizuje Marek/Mateusz. Druciaki, szczotki do grilla — Allegro/Selgros.'
 WHERE supplier_id = 'SUP_MORY';

-- ---------- H. Supplier days — SKIPPED (TBD per operator 2026-09-19) ----------

-- ---------- I. Location mailboxes (requires migration 0019; APPLIED) ----------
UPDATE locations SET email = CASE location_id
    WHEN 'WOLA' THEN 'wolskapitabros@gmail.com'
    WHEN 'BRACKA' THEN 'pitabrosbracka@gmail.com'
    WHEN 'NORBLIN' THEN 'norblinpitabros@gmail.com'
    WHEN 'KEN' THEN 'pitabrosken@gmail.com'
    WHEN 'BROWARY' THEN 'pitabrosbrowary@gmail.com'
    WHEN 'ELEKTROWNIA' THEN 'pitabroselektrownia@gmail.com'
    WHEN 'FORUM' THEN 'pitabrosforum@gmail.com'
    WHEN 'STARY_BROWAR' THEN 'pitabrospoznan@gmail.com'
  END
 WHERE location_id IN ('WOLA', 'BRACKA', 'NORBLIN', 'KEN', 'BROWARY', 'ELEKTROWNIA', 'FORUM', 'STARY_BROWAR');

-- ---------- J. Queue cleanup (operator permission 2026-09-19; explicit ids, see prod-diff-before.md) ----------
-- J1: manager_sent orders that already have a goods receipt -> closed (17)
UPDATE orders SET status = 'closed'
 WHERE status = 'manager_sent' AND order_id IN (
  'ORD-20260616-WOL-BUKA-911e57','ORD-20260615-WOL-BUKA-c091f5','ORD-20260622-WOL-BUKA-8d47ce',
  'ORD-20260622-WOL-BUKA-6da9a4','ORD-20260622-WOL-BUKA-f1e2d3','ORD-20260623-WOL-BUKA-2dd089',
  'ORD-20260623-WOL-BUKA-a5c54d','ORD-20260624-WOL-BUKA-f9826d','ORD-20260627-WOL-BUKA-f66919',
  'ORD-20260628-WOL-BUKA-0f9139','ORD-20260629-WOL-BLUE-b05222','ORD-20260629-WOL-INTE-579480',
  'ORD-20260702-WOL-BUKA-b541a3','ORD-20260713-WOL-INTE-c76735','ORD-20260713-WOL-BLUE-78ca5e',
  'ORD-20260713-WOL-BUKA-0f1721','ORD-20260714-WOL-BUKA-2fd2f1');
-- J2: Wola manager_sent before September without a receipt -> closed (18)
UPDATE orders SET status = 'closed'
 WHERE status = 'manager_sent' AND order_id IN (
  'ORD-20260620-WOL-BUKA-304eba','ORD-20260620-WOL-BUKA-7bffbc','ORD-20260622-WOL-BUKA-8ac755',
  'ORD-20260623-WOL-INTE-d9570e','ORD-20260703-WOL-INTE-542992','ORD-20260706-WOL-BUKA-f9730a',
  'ORD-20260709-WOL-BUKA-b4d788','ORD-20260709-WOL-INTE-7ac047','ORD-20260616-WOL-BUKA-499c65',
  'ORD-20260714-WOL-KUCH-a27c33','ORD-20260714-WOL-BLUE-78d932','ORD-20260723-WOL-INTE-16a1f7',
  'ORD-20260724-WOL-BUKA-f08c58','ORD-20260724-WOL-INTE-6320a7','ORD-20260731-WOL-INTE-ab35b3',
  'ORD-20260813-WOL-BUKA-a514fe','ORD-20260813-WOL-INTE-9cf7e6','ORD-20260730-WOL-PAGO-163f86');
-- J3: stale manager_claimed (before 2026-09-12) -> cancelled with trace (7)
UPDATE orders
   SET status = 'cancelled', cancelled_at = now(), cancelled_by = 'operator-cleanup',
       cancel_reason = 'porządki 2026-09-19 — zrealizowane poza apką'
 WHERE status = 'manager_claimed' AND order_id IN (
  'ORD-20260902-BRA-PAGO-3a9bea','ORD-20260902-BRO-PAGO-a1fbe8','ORD-20260902-ELE-PAGO-c11e06',
  'ORD-20260902-BRA-COCA-c673c7','ORD-20260904-KEN-PAGO-626d49','ORD-20260907-KEN-PAGO-63620f',
  'ORD-20260907-BRA-PAGO-ffdb4f');
-- J4: the abandoned Pago transport draft
UPDATE transport_batches SET status = 'cancelled' WHERE transport_id = 'TRN-20260902-PAGO-aa283f' AND status = 'draft';
INSERT INTO transport_events (event_id, transport_id, order_id, event_type, actor, at, details)
VALUES ('TEV-' || substr(md5(random()::text), 1, 8), 'TRN-20260902-PAGO-aa283f', NULL, 'batch_cancelled',
        'operator-cleanup', now(), 'porządki 2026-09-19: 3 members cancelled (zrealizowane poza apką)');

-- ---------- AFTER assertions (every count must be 0 unless stated) ----------
-- SELECT
--  (SELECT count(*) FROM location_product_settings WHERE NOT (min_stock_qty_base <= target_stock_qty_base AND target_stock_qty_base <= max_stock_qty_base)) AS bad_thresholds,
--  (SELECT count(*) FROM location_product_settings WHERE product_id IN ('P068','P069') AND location_id IN ('WOLA','BRACKA','KEN')) AS cc_can_rows_left,
--  (SELECT count(*) FROM location_product_settings WHERE product_id IN ('P186','P187')) AS cc_glass_rows,  -- expect 6
--  (SELECT count(*) FROM supplier_products WHERE supplier_id='SUP_FILBER' AND product_id IN ('P075','P076','P077','P136','P137','P138','P157') AND units_per_purchase_unit <> 12) AS filber_not_12,
--  (SELECT count(*) FROM supplier_products WHERE length(order_note) > 60) AS long_notes,
--  (SELECT count(*) FROM products) AS products_n,  -- expect 188
--  (SELECT count(*) FROM (SELECT product_id, supplier_id FROM supplier_products WHERE active GROUP BY 1,2 HAVING count(*) > 1) d) AS dup_active_sp,
--  (SELECT count(*) FROM location_product_settings WHERE product_id='P135') AS bombilla_rows,
--  (SELECT count(*) FROM locations WHERE active AND (email IS NULL OR position('@' in email) = 0)) AS active_without_email,
--  (SELECT count(*) FROM orders WHERE status='manager_claimed' AND captain_submitted_at < '2026-09-12') AS stale_claimed;
