-- rolki-minima-master-data — apply to PROD Supabase (lpzhphufjwrndfogkfub)
-- Data only: no schema change, no deploy (prod reads Supabase; code untouched).
-- Sources: mail Sławka "Rolki" 2026-09-04 (thread 1a06b92dd784e680) + arkusz Marka
-- 19fknN9XAJKnjnK547AKvKLmF08N_lnlAxv5gYN96liI (zakładka 2: minima, Warszawa).
-- Hardened after Gemini 3.8 Flash review 2026-09-05 (see plan.md "Review").
--
-- Per lessons.md "Master-data ops: diff before, audit after" — the BEFORE
-- snapshot below IS the rollback path.
--
-- ============================ (1) BEFORE (2026-09-05) ========================
--   products                    175   (last id P175; P176–P182 reserved by the
--                                      never-applied training-feedback-0901 phase3)
--   supplier_products           243
--   location_product_settings  1514   BRACKA 144 · BROWARY 119 · KEN 142 ·
--                                     NORBLIN 145 · WOLA 151 · ELEKTROWNIA 110 ·
--                                     STARY_BROWAR 127 · SUPERSAM 113 · WESTFIELD 106
--   suppliers                    14   (minimum_order_value_pln NULL on all)
--   P183 / P184 present           0
--   order_lines for P142          1   (cancelled order only; 0 live)
--   Latest inventory counts: BRACKA 2026-09-01 has P128=0, P130=0; KEN 2026-09-02
--   has no P130 line; NORBLIN has no count yet → no on-hand stock evidence for
--   any row deleted below.
--
--   Rows that will be DELETED (full values = rollback):
--     setting_id      loc      pid   min  max  target  notes
--     KEN__P130       KEN      P130   10   80   80     'ken-arkusz-2026-08-31'
--     BRACKA__P128    BRACKA   P128    1    4    4     'baza: kopia WOLA 2026-07-16'
--     BRACKA__P130    BRACKA   P130    1    2    2     'baza: kopia WOLA 2026-07-16'
--     NORBLIN__P142   NORBLIN  P142    5   40   40     'norblin-rollout 2026-08-18: arkusz min/max (nowe SKU 57/50)'
--     NORBLIN__P128   NORBLIN  P128    0    0    0     'norblin-rollout 2026-08-18: brak na liscie CSV Norblin'
--     NORBLIN__P130   NORBLIN  P130    0    0    0     'norblin-rollout 2026-08-18: brak na liscie CSV Norblin'
--     (is_critical_for_location=false, allow_over_max_due_to_packaging=false on all)
--
--   Rows that will be UPDATED (exact old values — restored literally on rollback):
--     products.P142:        active=true,
--       notes='norblin-rollout 2026-08-18: rozmiar z arkusza Norblina; do potwierdzenia przy 1. dostawie Pago'
--     supplier_products.SP_MORY_P142: active=true,
--       notes='Przeniesione z SUP_PAGO 2026-09-03 — brak stalego dostawcy, kupowane w roznych miejscach, magazynowane w Mory'
--     suppliers (minimum_order_value_pln NULL on all five):
--       SUP_INTERMLECZ notes='Largest by SKU count (26): dairy + olives + frozen + dry goods + spices'
--       SUP_BUKAT      notes='Fresh produce + Greek cheese/dips (Chłodnia) — most frequent supplier, daily/3x weekly. Ordering habit Mon/Wed/Fri; deliveries Mon–Sat; Sunday order → Monday delivery.'
--       SUP_COCACOLA   notes='Beverages (Napoje + Alkohol) — zamawianie przez portal: https://cchbcshop.com/websitePL/login (login wymagany)'
--       SUP_KUCHNIE    notes='Falafel (Mrożonki)'
--       SUP_BLUESERV   notes='Packaging (Opakowania) + cleaning chemicals (Chemia) — biweekly or as-needed'
--
-- Expected AFTER: products 177 · supplier_products 245 · settings 1516 · suppliers 14
--   (BRACKA 144 · BROWARY 120 · KEN 141 · NORBLIN 143 · WOLA 151 · ELEKTROWNIA 111 ·
--    STARY_BROWAR 128 · SUPERSAM 114 · WESTFIELD 107)
-- ============================================================================

-- Re-run before APPLY and compare with the numbers/strings above:
-- SELECT (SELECT count(*) FROM products) AS products,
--        (SELECT count(*) FROM supplier_products) AS supplier_products,
--        (SELECT count(*) FROM location_product_settings) AS settings,
--        (SELECT count(*) FROM suppliers) AS suppliers;
-- SELECT * FROM location_product_settings WHERE setting_id IN
--   ('KEN__P130','BRACKA__P128','BRACKA__P130','NORBLIN__P142','NORBLIN__P128','NORBLIN__P130');
-- SELECT supplier_id, minimum_order_value_pln, notes FROM suppliers
--  WHERE supplier_id IN ('SUP_INTERMLECZ','SUP_BUKAT','SUP_COCACOLA','SUP_KUCHNIE','SUP_BLUESERV');
-- SELECT product_id, active, notes FROM products WHERE product_id = 'P142';
-- SELECT supplier_product_id, active, notes FROM supplier_products WHERE product_id = 'P142';

-- ---------------------------- (2) APPLY -------------------------------------
BEGIN;

-- 2.1 KATALOG — two roll sizes missing from the catalogue (Sławek 2026-09-04).
--     Ids P183/P184 skip P176–P182, reserved by the pending 0901 phase3 script.
INSERT INTO products
    (product_id, gostock_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES
    ('P183', NULL, 'Rolki do kasy 80 na 20', 'Biurowe', 'szt', FALSE, TRUE, 'POS receipt rolls (Sunmi V3 Mix / Bracka / Stary Browar) — rolki-minima-master-data 2026-09-05, tabela Sławka'),
    ('P184', NULL, 'Rolki do kasy 57 na 80', 'Biurowe', 'szt', FALSE, TRUE, 'Kasa fiskalna (Browary, Bracka) — rolki-minima-master-data 2026-09-05, tabela Sławka')
ON CONFLICT (product_id) DO NOTHING;

-- price unknown → NULL (P143–P154 convention); pack size (opak 10/6) still
-- unknown → purchase_unit stays szt like the other Mory rolls.
INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit,
     units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes)
VALUES
    ('SP_MORY_P183', 'SUP_MORY', 'P183', 'Rolki do kasy 80 na 20', 'szt', 1, 'full_only', NULL, TRUE, 'Brak stalego dostawcy, kupowane w roznych miejscach, magazynowane w Mory. Cena do uzupelnienia po pierwszej fakturze'),
    ('SP_MORY_P184', 'SUP_MORY', 'P184', 'Rolki do kasy 57 na 80', 'szt', 1, 'full_only', NULL, TRUE, 'Brak stalego dostawcy, kupowane w roznych miejscach, magazynowane w Mory. Cena do uzupelnienia po pierwszej fakturze')
ON CONFLICT (supplier_product_id) DO NOTHING;

-- 57/50 (P142) appears in no location on Sławek's table. Product AND its Mory
-- supplier row deactivated together (review finding 2), never deleted — one
-- cancelled order_line references it. Restored literally on rollback.
UPDATE products
   SET active = FALSE,
       notes  = notes || ' | rolki-minima-master-data 2026-09-05: rozmiar nie wystepuje w tabeli Slawka — dezaktywowane'
 WHERE product_id = 'P142' AND active = TRUE;
UPDATE supplier_products
   SET active = FALSE,
       notes  = notes || ' | rolki-minima-master-data 2026-09-05: SKU wycofane (P142 nieaktywne)'
 WHERE product_id = 'P142' AND active = TRUE;

-- 2.2 PROGI — thresholds copied from the row whose ROLE the new size takes over
--     (operator decision 2026-09-05); marked ESTIM so FR-012 review knows.
INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base,
     target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES
    ('BRACKA__P183',       'BRACKA',       'P183',  1,  4,  4, FALSE, FALSE, 'rolki-minima-master-data 2026-09-05: rolka POS wg tabeli Slawka; ESTIM: kopia z BRACKA__P128'),
    ('BRACKA__P184',       'BRACKA',       'P184',  1,  2,  2, FALSE, FALSE, 'rolki-minima-master-data 2026-09-05: kasa fiskalna wg tabeli Slawka; ESTIM: kopia z BRACKA__P130'),
    ('BROWARY__P184',      'BROWARY',      'P184', 10, 30, 30, FALSE, FALSE, 'rolki-minima-master-data 2026-09-05: kasa fiskalna wg tabeli Slawka; ESTIM: kopia z BROWARY__P128'),
    ('NORBLIN__P183',      'NORBLIN',      'P183',  5, 40, 40, FALSE, FALSE, 'rolki-minima-master-data 2026-09-05: rolka POS Sunmi wg tabeli Slawka; ESTIM: kopia z NORBLIN__P142 (57/50)'),
    ('ELEKTROWNIA__P183',  'ELEKTROWNIA',  'P183',  0,  0,  0, FALSE, FALSE, 'rolki-minima-master-data 2026-09-05: rolka POS Sunmi wg tabeli Slawka; threshold TBC (lokal nieaktywny)'),
    ('STARY_BROWAR__P183', 'STARY_BROWAR', 'P183',  0,  0,  0, FALSE, FALSE, 'rolki-minima-master-data 2026-09-05: rolka POS wg tabeli Slawka; threshold TBC (lokal nieaktywny)'),
    ('SUPERSAM__P183',     'SUPERSAM',     'P183',  0,  0,  0, FALSE, FALSE, 'rolki-minima-master-data 2026-09-05: rolka POS Sunmi wg tabeli Slawka; threshold TBC (lokal nieaktywny)'),
    ('WESTFIELD__P183',    'WESTFIELD',    'P183',  0,  0,  0, FALSE, FALSE, 'rolki-minima-master-data 2026-09-05: rolka POS Sunmi wg tabeli Slawka; threshold TBC (lokal nieaktywny)')
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Sizes the location does NOT use (Sławek's table wins over Marek's 2025 report).
-- DELETE, not 0/0/0: the inventory and order screens do not filter on
-- thresholds, so a zero row would still show the roll to the captain. Latest
-- inventory counts show no on-hand stock for these rows (see BEFORE).
DELETE FROM location_product_settings
 WHERE setting_id IN ('KEN__P130', 'BRACKA__P128', 'BRACKA__P130',
                      'NORBLIN__P142', 'NORBLIN__P128', 'NORBLIN__P130');

-- 2.3 MINIMA DOSTAWCÓW — arkusz Marka, zakładka 2 (Warszawa). Informational
--     only: nothing server-side reads this column; the FE chip stops using its
--     400 PLN fallback for these suppliers. GoGastro (600 PLN) is NOT inserted:
--     it has no catalogue in the system — recorded in change.md instead.
UPDATE suppliers SET minimum_order_value_pln = 650,
       notes = notes || ' | min. 650 PLN (arkusz Marka 2026-09, Warszawa)'
 WHERE supplier_id = 'SUP_INTERMLECZ' AND minimum_order_value_pln IS NULL;
UPDATE suppliers SET minimum_order_value_pln = 500,
       notes = notes || ' | min. miekkie: "niby bez limitu, ok. 500 PLN, za 300 tez dowioza" (arkusz Marka 2026-09)'
 WHERE supplier_id = 'SUP_BUKAT' AND minimum_order_value_pln IS NULL;
UPDATE suppliers SET minimum_order_value_pln = 500,
       notes = notes || ' | min. 500 PLN (arkusz Marka 2026-09, Warszawa)'
 WHERE supplier_id = 'SUP_COCACOLA' AND minimum_order_value_pln IS NULL;
UPDATE suppliers SET minimum_order_value_pln = 600,
       notes = notes || ' | min. 600 PLN (arkusz Marka 2026-09, Warszawa)'
 WHERE supplier_id = 'SUP_KUCHNIE' AND minimum_order_value_pln IS NULL;
UPDATE suppliers SET minimum_order_value_pln = 500,
       notes = notes || ' | min. miekkie: "bez sztywnego limitu, 500 mozna ustawic" (arkusz Marka 2026-09)'
 WHERE supplier_id = 'SUP_BLUESERV' AND minimum_order_value_pln IS NULL;

COMMIT;

-- ---------------------------- (3) AUDYT PO ----------------------------------
-- Expect: 177 / 245 / 1516 / 14, then zero rows from every assertion.
--
-- SELECT (SELECT count(*) FROM products) AS products,
--        (SELECT count(*) FROM supplier_products) AS supplier_products,
--        (SELECT count(*) FROM location_product_settings) AS settings,
--        (SELECT count(*) FROM suppliers) AS suppliers;
--
-- -- per-location counts for the touched locations only (expect BRACKA 144,
-- -- BROWARY 120, KEN 141, NORBLIN 143, WOLA 151, ELEKTROWNIA 111,
-- -- STARY_BROWAR 128, SUPERSAM 114, WESTFIELD 107)
-- SELECT location_id, count(*) FROM location_product_settings
--  WHERE location_id IN ('BRACKA','BROWARY','KEN','NORBLIN','WOLA','ELEKTROWNIA','STARY_BROWAR','SUPERSAM','WESTFIELD')
--  GROUP BY 1 ORDER BY 1;
--
-- -- a) min <= max and target = max on every roll row
-- SELECT setting_id FROM location_product_settings
--  WHERE product_id IN ('P128','P129','P130','P142','P183','P184')
--    AND NOT (min_stock_qty_base <= max_stock_qty_base
--             AND max_stock_qty_base = target_stock_qty_base);
--
-- -- b) each active location carries EXACTLY Sławek's sizes (expect 0 rows)
-- WITH expected(location_id, product_id) AS (VALUES
--   ('WOLA','P128'),('WOLA','P129'),('WOLA','P130'),
--   ('KEN','P128'),('KEN','P129'),
--   ('BROWARY','P128'),('BROWARY','P129'),('BROWARY','P184'),
--   ('BRACKA','P183'),('BRACKA','P129'),('BRACKA','P184'),
--   ('NORBLIN','P183'),('NORBLIN','P129'))
-- SELECT 'missing' AS why, e.* FROM expected e
--   LEFT JOIN location_product_settings s USING (location_id, product_id) WHERE s.setting_id IS NULL
-- UNION ALL
-- SELECT 'extra', s.location_id, s.product_id FROM location_product_settings s
--   LEFT JOIN expected e USING (location_id, product_id)
--  WHERE s.product_id IN ('P128','P129','P130','P142','P183','P184')
--    AND s.location_id IN ('WOLA','KEN','BROWARY','BRACKA','NORBLIN') AND e.location_id IS NULL;
--
-- -- c) new products resolve to exactly one supplier_product; P142 + SP_MORY_P142 inactive
-- SELECT p.product_id FROM products p LEFT JOIN supplier_products s USING (product_id)
--  WHERE p.product_id IN ('P183','P184') GROUP BY p.product_id HAVING count(s.supplier_product_id) <> 1;
-- SELECT product_id FROM products WHERE product_id = 'P142' AND active;
-- SELECT supplier_product_id FROM supplier_products WHERE product_id = 'P142' AND active;
--
-- -- d) minima landed (expect exactly 5 rows: 650/500/500/600/500)
-- SELECT supplier_id, minimum_order_value_pln FROM suppliers
--  WHERE minimum_order_value_pln IS NOT NULL ORDER BY 1;
--
-- -- e) API (captain tokens): GET /api/captain/orderable?supplier_id=SUP_MORY —
-- --    among items whose name starts with 'Rolki do kasy', BRACKA returns only
-- --    80 na 20 / 80 na 80 / 57 na 80; NORBLIN 80 na 20 / 80 na 80;
-- --    KEN 57 na 20 / 80 na 80; BROWARY 57 na 20 / 80 na 80 / 57 na 80.
-- --    (Mory also serves packaging etc. — the total item count is NOT 3.)

-- ---------------------------- ROLLBACK --------------------------------------
-- Restores the BEFORE snapshot exactly. FK order matters. order_lines,
-- inventory_count_lines and receipt_lines all FK products / supplier_products,
-- so a P183/P184 that was already used cannot be hard-deleted — it is
-- deactivated instead (review finding 1).
-- BEGIN;
-- DELETE FROM location_product_settings WHERE product_id IN ('P183','P184');
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM order_lines           WHERE product_id IN ('P183','P184'))
--   OR EXISTS (SELECT 1 FROM inventory_count_lines WHERE product_id IN ('P183','P184'))
--   OR EXISTS (SELECT 1 FROM receipt_lines         WHERE product_id IN ('P183','P184')) THEN
--     UPDATE supplier_products SET active = FALSE WHERE product_id IN ('P183','P184');
--     UPDATE products          SET active = FALSE WHERE product_id IN ('P183','P184');
--   ELSE
--     DELETE FROM supplier_products WHERE product_id IN ('P183','P184');
--     DELETE FROM products          WHERE product_id IN ('P183','P184');
--   END IF;
-- END $$;
-- INSERT INTO location_product_settings
--     (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base,
--      target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
-- VALUES
--     ('KEN__P130',     'KEN',     'P130', 10, 80, 80, FALSE, FALSE, 'ken-arkusz-2026-08-31'),
--     ('BRACKA__P128',  'BRACKA',  'P128',  1,  4,  4, FALSE, FALSE, 'baza: kopia WOLA 2026-07-16'),
--     ('BRACKA__P130',  'BRACKA',  'P130',  1,  2,  2, FALSE, FALSE, 'baza: kopia WOLA 2026-07-16'),
--     ('NORBLIN__P142', 'NORBLIN', 'P142',  5, 40, 40, FALSE, FALSE, 'norblin-rollout 2026-08-18: arkusz min/max (nowe SKU 57/50)'),
--     ('NORBLIN__P128', 'NORBLIN', 'P128',  0,  0,  0, FALSE, FALSE, 'norblin-rollout 2026-08-18: brak na liscie CSV Norblin'),
--     ('NORBLIN__P130', 'NORBLIN', 'P130',  0,  0,  0, FALSE, FALSE, 'norblin-rollout 2026-08-18: brak na liscie CSV Norblin')
-- ON CONFLICT (location_id, product_id) DO NOTHING;
-- UPDATE products SET active = TRUE,
--        notes = 'norblin-rollout 2026-08-18: rozmiar z arkusza Norblina; do potwierdzenia przy 1. dostawie Pago'
--  WHERE product_id = 'P142';
-- UPDATE supplier_products SET active = TRUE,
--        notes = 'Przeniesione z SUP_PAGO 2026-09-03 — brak stalego dostawcy, kupowane w roznych miejscach, magazynowane w Mory'
--  WHERE supplier_product_id = 'SP_MORY_P142';
-- UPDATE suppliers SET minimum_order_value_pln = NULL, notes = 'Largest by SKU count (26): dairy + olives + frozen + dry goods + spices' WHERE supplier_id = 'SUP_INTERMLECZ';
-- UPDATE suppliers SET minimum_order_value_pln = NULL, notes = 'Fresh produce + Greek cheese/dips (Chłodnia) — most frequent supplier, daily/3x weekly. Ordering habit Mon/Wed/Fri; deliveries Mon–Sat; Sunday order → Monday delivery.' WHERE supplier_id = 'SUP_BUKAT';
-- UPDATE suppliers SET minimum_order_value_pln = NULL, notes = 'Beverages (Napoje + Alkohol) — zamawianie przez portal: https://cchbcshop.com/websitePL/login (login wymagany)' WHERE supplier_id = 'SUP_COCACOLA';
-- UPDATE suppliers SET minimum_order_value_pln = NULL, notes = 'Falafel (Mrożonki)' WHERE supplier_id = 'SUP_KUCHNIE';
-- UPDATE suppliers SET minimum_order_value_pln = NULL, notes = 'Packaging (Opakowania) + cleaning chemicals (Chemia) — biweekly or as-needed' WHERE supplier_id = 'SUP_BLUESERV';
-- COMMIT;
