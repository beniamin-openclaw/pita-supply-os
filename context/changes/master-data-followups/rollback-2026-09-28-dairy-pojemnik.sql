-- master-data-followups · Batch 1 · ROLLBACK (Step 0 diff, generated from prod before apply, 2026-09-28 evening)
-- Restores products / supplier_products / location_product_settings / inventory_count_lines for P007, P011, P012, P014.
-- No open order_lines (draft / captain_submitted / manager_claimed) carried these products at diff time.
BEGIN;
UPDATE products SET product_name_pl='Rucola 125 gr', inventory_unit='opak' WHERE product_id='P007';
UPDATE products SET product_name_pl='Tzatzyki', inventory_unit='kg' WHERE product_id='P011';
UPDATE products SET product_name_pl='Tirokafteri', inventory_unit='kg' WHERE product_id='P012';
UPDATE products SET product_name_pl='Feta blok', inventory_unit='kg' WHERE product_id='P014';
UPDATE supplier_products SET supplier_product_name='Rucola 125 gr', purchase_unit='opak', units_per_purchase_unit=1.0000, order_note=NULL WHERE supplier_product_id='SP_BUKAT_P007';
UPDATE supplier_products SET supplier_product_name='Tzatzyki', purchase_unit='pojemnik', units_per_purchase_unit=3.0000, order_note='1 pojemnik = 3 kg (karton 6)' WHERE supplier_product_id='SP_BUKAT_P011';
UPDATE supplier_products SET supplier_product_name='Tirokafteri', purchase_unit='wiadro', units_per_purchase_unit=2.0000, order_note=NULL WHERE supplier_product_id='SP_BUKAT_P012';
UPDATE supplier_products SET supplier_product_name='Feta blok', purchase_unit='szt', units_per_purchase_unit=2.0000, order_note='1 szt = blok 2 kg' WHERE supplier_product_id='SP_BUKAT_P014';
UPDATE location_product_settings SET min_stock_qty_base=9.0000, target_stock_qty_base=36.0000, max_stock_qty_base=36.0000, notes='baza: kopia WOLA 2026-07-16' WHERE setting_id='BRACKA__P011';
UPDATE location_product_settings SET min_stock_qty_base=2.0000, target_stock_qty_base=6.0000, max_stock_qty_base=6.0000, notes='baza: kopia WOLA 2026-07-16' WHERE setting_id='BRACKA__P012';
UPDATE location_product_settings SET min_stock_qty_base=1.0000, target_stock_qty_base=2.0000, max_stock_qty_base=2.0000, notes='baza: kopia WOLA 2026-07-16' WHERE setting_id='BRACKA__P014';
UPDATE location_product_settings SET min_stock_qty_base=9.0000, target_stock_qty_base=36.0000, max_stock_qty_base=36.0000, notes='browary-arkusz-2026-08-31' WHERE setting_id='BROWARY__P011';
UPDATE location_product_settings SET min_stock_qty_base=2.0000, target_stock_qty_base=4.0000, max_stock_qty_base=4.0000, notes='browary-arkusz-2026-08-31' WHERE setting_id='BROWARY__P012';
UPDATE location_product_settings SET min_stock_qty_base=0.5000, target_stock_qty_base=2.0000, max_stock_qty_base=2.0000, notes='browary-arkusz-2026-08-31' WHERE setting_id='BROWARY__P014';
UPDATE location_product_settings SET min_stock_qty_base=0.0000, target_stock_qty_base=0.0000, max_stock_qty_base=0.0000, notes='threshold TBC (sheet had no min/max)' WHERE setting_id IN ('ELEKTROWNIA__P011','ELEKTROWNIA__P012','ELEKTROWNIA__P014','KAMIENICA__P011','KAMIENICA__P012','KAMIENICA__P014','KULINARNA__P011','KULINARNA__P012','KULINARNA__P014','SLONY__P011','SLONY__P012','SLONY__P014','STARY_BROWAR__P011','STARY_BROWAR__P012','STARY_BROWAR__P014','SUPERSAM__P011','SUPERSAM__P012','SUPERSAM__P014','WESTFIELD__P011','WESTFIELD__P012','WESTFIELD__P014');
UPDATE location_product_settings SET min_stock_qty_base=15.0000, target_stock_qty_base=42.0000, max_stock_qty_base=42.0000, notes='' WHERE setting_id='FORUM__P011';
UPDATE location_product_settings SET min_stock_qty_base=3.0000, target_stock_qty_base=9.0000, max_stock_qty_base=9.0000, notes='' WHERE setting_id='FORUM__P012';
UPDATE location_product_settings SET min_stock_qty_base=1.0000, target_stock_qty_base=4.0000, max_stock_qty_base=4.0000, notes='' WHERE setting_id='FORUM__P014';
UPDATE location_product_settings SET min_stock_qty_base=6.0000, target_stock_qty_base=18.0000, max_stock_qty_base=18.0000, notes='ken-arkusz-2026-08-31; week1-feedback-targets 2026-09-06' WHERE setting_id='KEN__P011';
UPDATE location_product_settings SET min_stock_qty_base=1.0000, target_stock_qty_base=3.0000, max_stock_qty_base=3.0000, notes='ken-arkusz-2026-08-31' WHERE setting_id='KEN__P012';
UPDATE location_product_settings SET min_stock_qty_base=1.0000, target_stock_qty_base=2.0000, max_stock_qty_base=2.0000, notes='ken-arkusz-2026-08-31' WHERE setting_id='KEN__P014';
UPDATE location_product_settings SET min_stock_qty_base=15.0000, target_stock_qty_base=42.0000, max_stock_qty_base=42.0000, notes='norblin-rollout 2026-08-18: arkusz min/max' WHERE setting_id='NORBLIN__P011';
UPDATE location_product_settings SET min_stock_qty_base=3.0000, target_stock_qty_base=6.0000, max_stock_qty_base=6.0000, notes='norblin-rollout 2026-08-18: arkusz min/max' WHERE setting_id='NORBLIN__P012';
UPDATE location_product_settings SET min_stock_qty_base=1.0000, target_stock_qty_base=2.0000, max_stock_qty_base=2.0000, notes='norblin-rollout 2026-08-18: arkusz min/max' WHERE setting_id='NORBLIN__P014';
UPDATE location_product_settings SET min_stock_qty_base=6.0000, target_stock_qty_base=36.0000, max_stock_qty_base=36.0000, notes='Tzatzyki — core menu sauce' WHERE setting_id='WOLA__P011';
UPDATE location_product_settings SET min_stock_qty_base=3.0000, target_stock_qty_base=6.0000, max_stock_qty_base=6.0000, notes='Tirokafteri' WHERE setting_id='WOLA__P012';
UPDATE location_product_settings SET min_stock_qty_base=1.0000, target_stock_qty_base=3.0000, max_stock_qty_base=3.0000, notes='Feta blok' WHERE setting_id='WOLA__P014';
-- inventory_count_lines (count_line_id, kg value before conversion)
UPDATE inventory_count_lines l SET current_stock_qty_base = v.q FROM (VALUES
('ICL-INV-20260608-WOL-1b8d37-011',38.8000),('ICL-INV-20260608-WOL-1b8d37-012',5.0000),('ICL-INV-20260608-WOL-1b8d37-014',0.0000),
('ICL-INV-20260609-WOL-3bf948-011',5.0000),('ICL-INV-20260609-WOL-3bf948-012',3.0000),('ICL-INV-20260609-WOL-3bf948-014',2.0000),
('ICL-INV-20260620-WOL-2d2c6a-005',5.0000),
('ICL-INV-20260622-WOL-93af92-011',5.0000),('ICL-INV-20260622-WOL-93af92-012',0.0000),('ICL-INV-20260622-WOL-93af92-014',7.0000),
('ICL-INV-20260713-WOL-8364b1-011',32.7000),('ICL-INV-20260713-WOL-8364b1-012',1.4000),('ICL-INV-20260713-WOL-8364b1-014',3.6000),
('ICL-INV-20260727-WOL-5eab88-011',39.0000),('ICL-INV-20260727-WOL-5eab88-012',4.8000),('ICL-INV-20260727-WOL-5eab88-014',2.6300),
('ICL-INV-20260809-WOL-080f7e-011',36.0000),('ICL-INV-20260809-WOL-080f7e-012',4.4000),('ICL-INV-20260809-WOL-080f7e-014',3.0000),
('ICL-INV-20260901-BRA-a3add9-011',32.8400),('ICL-INV-20260901-BRA-a3add9-012',1.5500),('ICL-INV-20260901-BRA-a3add9-014',2.0000),
('ICL-INV-20260901-BRO-7a76f6-011',28.1160),('ICL-INV-20260901-BRO-7a76f6-012',2.0000),('ICL-INV-20260901-BRO-7a76f6-014',4.0000),
('ICL-INV-20260901-BRO-d81c80-011',25.1160),('ICL-INV-20260901-BRO-d81c80-012',2.0000),('ICL-INV-20260901-BRO-d81c80-014',4.0000),
('ICL-INV-20260901-KEN-b86dba-011',22.0000),('ICL-INV-20260901-KEN-b86dba-012',3.5000),('ICL-INV-20260901-KEN-b86dba-014',2.3000),
('ICL-INV-20260901-WOL-af0c09-011',45.0000),('ICL-INV-20260901-WOL-af0c09-012',4.1000),('ICL-INV-20260901-WOL-af0c09-014',3.0000),
('ICL-INV-20260906-BRA-cb64ee-011',8.0000),('ICL-INV-20260906-BRA-cb64ee-012',2.3000),('ICL-INV-20260906-BRA-cb64ee-014',0.9500),
('ICL-INV-20260906-BRO-e004b3-011',24.0000),('ICL-INV-20260906-BRO-e004b3-012',3.2700),('ICL-INV-20260906-BRO-e004b3-014',2.0000),
('ICL-INV-20260906-KEN-008363-011',15.0000),('ICL-INV-20260906-KEN-008363-012',2.0000),('ICL-INV-20260906-KEN-008363-014',1.5000),
('ICL-INV-20260907-WOL-002895-011',28.0000),('ICL-INV-20260907-WOL-002895-012',5.0000),('ICL-INV-20260907-WOL-002895-014',2.0000),
('ICL-INV-20260913-BRA-8b67b5-011',38.2000),('ICL-INV-20260913-BRA-8b67b5-012',4.0000),('ICL-INV-20260913-BRA-8b67b5-014',1.4000),
('ICL-INV-20260913-BRO-87ed3d-011',27.0000),('ICL-INV-20260913-BRO-87ed3d-012',3.1000),('ICL-INV-20260913-BRO-87ed3d-014',2.0000),
('ICL-INV-20260913-KEN-be908f-011',27.0000),('ICL-INV-20260913-KEN-be908f-012',3.0000),('ICL-INV-20260913-KEN-be908f-014',4.0000),
('ICL-INV-20260913-WOL-c112e6-E-171506',18.0000),('ICL-INV-20260913-WOL-c112e6-E-9247c8',3.0000),('ICL-INV-20260913-WOL-c112e6-E-f3fba9',3.0000),
('ICL-INV-20260920-BRO-9c1f85-011',21.0000),('ICL-INV-20260920-BRO-9c1f85-012',1.7440),('ICL-INV-20260920-BRO-9c1f85-013',2.0000),
('ICL-INV-20260920-KEN-231631-011',18.0000),('ICL-INV-20260920-KEN-231631-012',3.0000),('ICL-INV-20260920-KEN-231631-014',2.0000),
('ICL-INV-20260920-WOL-d7582d-E-884ae7',4.0000),('ICL-INV-20260920-WOL-d7582d-E-958f02',21.0000),('ICL-INV-20260920-WOL-d7582d-E-9a2498',0.8000),
('ICL-INV-20260921-BRA-0f30df-011',27.5000),('ICL-INV-20260921-BRA-0f30df-012',6.7000),('ICL-INV-20260921-BRA-0f30df-014',2.0000),
('ICL-INV-20260927-BRA-f29346-011',15.9000),('ICL-INV-20260927-BRA-f29346-012',4.0000),('ICL-INV-20260927-BRA-f29346-014',2.0000),
('ICL-INV-20260927-BRO-2a6279-011',25.3840),('ICL-INV-20260927-BRO-2a6279-012',4.0000),('ICL-INV-20260927-BRO-2a6279-014',3.5600),
('ICL-INV-20260927-KEN-653010-011',13.0000),('ICL-INV-20260927-KEN-653010-012',1.8000),('ICL-INV-20260927-KEN-653010-014',3.0000),
('ICL-INV-20260927-WOL-edba33-E-278a50',27.0000),('ICL-INV-20260927-WOL-edba33-E-377e59',3.0000),('ICL-INV-20260927-WOL-edba33-E-6eb99d',3.0000)
) AS v(id, q) WHERE l.count_line_id = v.id;
COMMIT;
-- expect: 82 inventory_count_lines rows updated
