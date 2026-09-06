-- week1-feedback-targets — APPLIED to PROD Supabase (lpzhphufjwrndfogkfub) 2026-09-06 ~22:00.
-- Data only: no schema change, no deploy needed for this file (the ReasonCode
-- migration 0016 is a separate file under supply-os-v1/migrations/).
-- Sources: Connect Teams "Pita Supply OS" 2026-09-06 (Khushi 19:49, Tushar 18:48,
-- Uliana 18:40, Ajith 14:25) + operator decisions (plan.md §2.1, hardening §8).
--
-- Per lessons.md "Master-data ops: diff before, audit after" — the BEFORE
-- snapshot below IS the rollback path.
--
-- ============================ (1) BEFORE (2026-09-06) ========================
--   products                    184   (last id P184)
--   supplier_products           252
--   location_product_settings  1551
--   P185 / SP_INTERNAL_P185 / KEN__P185 present: 0
--
--   Rows UPDATED (exact old values min / target / max ; crit ; allow_over_max ; notes):
--     BROWARY__P145   1 /   4 /   4 ; f ; f ; 'browary-arkusz-2026-08-31'
--     KEN__P011       3 /   8 /   8 ; t ; t ; 'ken-arkusz-2026-08-31'
--     KEN__P015      24 /  72 /  72 ; t ; f ; 'ken-arkusz-2026-08-31'
--     KEN__P039     0.5 / 1.5 / 1.5 ; f ; f ; 'ken-arkusz-2026-08-31'
--     KEN__P041       2 /   5 /   5 ; f ; f ; 'ken-arkusz-2026-08-31'
--     KEN__P043       0 /   3 /   3 ; f ; f ; 'ken-arkusz-2026-08-31'
--     KEN__P044       0 /   4 /   4 ; f ; f ; 'ken-arkusz-2026-08-31'
--     KEN__P068      24 /  96 /  96 ; t ; t ; 'ken-arkusz-2026-08-31'
--     KEN__P069      24 / 120 / 120 ; t ; t ; 'ken-arkusz-2026-08-31'
--     KEN__P070      24 /  48 /  48 ; f ; t ; 'ken-arkusz-2026-08-31'
--     KEN__P071      24 /  48 /  48 ; f ; t ; 'ken-arkusz-2026-08-31'
--     KEN__P072       2 /   2 /   2 ; f ; f ; 'ken-arkusz-2026-08-31'
--     KEN__P075      10 /  48 /  48 ; f ; t ; 'ken-arkusz-2026-08-31'
--     KEN__P076      10 /  48 /  48 ; f ; t ; 'ken-arkusz-2026-08-31'
--     KEN__P077      10 /  48 /  48 ; f ; t ; 'ken-arkusz-2026-08-31'
--     KEN__P136       6 /   6 /   6 ; f ; t ; 'ken-arkusz-2026-08-31'
--     KEN__P137       6 /   6 /   6 ; f ; t ; 'ken-arkusz-2026-08-31'
--     KEN__P138       6 /   6 /   6 ; f ; t ; 'ken-arkusz-2026-08-31'
--     KEN__P157       6 /   6 /   6 ; f ; f ; 'kopia progów Corfu Lager 2026-09-06'
--     WOLA__P007      5 /  15 /  15 ; f ; f ; 'Rucola 125 gr'
--     WOLA__P118      3 /  12 /  12 ; f ; f ; 'ESTIM - verify after first order cycle'
--     WOLA__P121      4 /  10 /  10 ; f ; f ; 'ESTIM - verify after first order cycle'
--   (crit / allow_over_max were NOT touched by the UPDATE; listed for completeness.)
--
-- ============================ (2) APPLIED ====================================
BEGIN;
WITH v(setting_id, mn, tgt) AS (VALUES
  ('KEN__P015', 24, 60),
  ('KEN__P068', 24, 72),  ('KEN__P069', 24, 96),
  ('KEN__P071', 12, 24),  ('KEN__P070', 12, 24),
  ('KEN__P011',  6, 18),
  ('KEN__P072',  3, 12),
  ('KEN__P077',  6, 24),  ('KEN__P075',  6, 24),  ('KEN__P076',  6, 24),
  ('KEN__P136',  6, 12),  ('KEN__P137',  6, 12),  ('KEN__P138',  6, 12),  ('KEN__P157', 6, 12),
  ('KEN__P039',  0,  0),
  ('KEN__P041',  1,  2),
  ('KEN__P043',  1,  2),  ('KEN__P044',  1,  2),
  ('WOLA__P121', 1,  3),
  ('WOLA__P118', 2,  6),
  ('WOLA__P007', 4, 10),
  ('BROWARY__P145', 0, 1)   -- bifteki WORKAROUND: 1 "karton" while upp=1; revert after Pago gives carton kg
)
UPDATE location_product_settings s
SET min_stock_qty_base = v.mn,
    target_stock_qty_base = v.tgt,
    max_stock_qty_base = v.tgt,
    notes = trim(both '; ' from coalesce(s.notes,'') || '; week1-feedback-targets 2026-09-06'
      || CASE WHEN v.setting_id='BROWARY__P145' THEN ' — OBEJŚCIE: 1 karton przy upp=1, cofnąć po wadze kartonu od Pago' ELSE '' END)
FROM v WHERE s.setting_id = v.setting_id;                      -- UPDATE 22

INSERT INTO products (product_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P185', 'Gyros kurczak nieścięty', 'Produkcja', 'kg', false, true, 'Tylko KEN; blok w zamrażarce, z P179 (2026-09-06, Ajith)');
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes)
VALUES ('SP_INTERNAL_P185', 'SUP_INTERNAL', 'P185', 'Gyros kurczak nieścięty', 'kg', 1, 'full_only', 0, true, 'Internal production (KEN)');
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('KEN__P185', 'KEN', 'P185', 1, 3, 3, false, false, 'week1-feedback-targets 2026-09-06 (Ajith)');
COMMIT;

-- ============================ (3) AFTER audit (2026-09-06) ===================
--   rows with notes LIKE '%week1-feedback-targets%'          : 23  (22 + KEN__P185)  OK
--   min_stock > target in KEN/WOLA/BRACKA/BROWARY/NORBLIN    :  0                    OK
--   products 185 · supplier_products 253 · location_product_settings 1552      OK
--
-- ============================ PENDING (not applied) =========================
-- Bifteki conversion — ONLY after the manager confirms the carton weight (plan §4 C-1):
--   UPDATE supplier_products SET units_per_purchase_unit = <KG_NA_KARTON>,
--     notes = 'karton = <KG> kg wg Pago (2026-09-xx)' WHERE supplier_product_id = 'SP_PAGO_P145';
--   UPDATE location_product_settings SET min_stock_qty_base = <..>, target_stock_qty_base = <kg>,
--     max_stock_qty_base = <kg>, notes = 'week1-feedback-targets: target w kg po wadze kartonu'
--     WHERE setting_id = 'BROWARY__P145';
--
-- ============================ ROLLBACK ======================================
-- Restore the 22 rows from the BEFORE block literally (min/target/max/notes), then:
--   DELETE FROM location_product_settings WHERE setting_id='KEN__P185';
--   DELETE FROM supplier_products WHERE supplier_product_id='SP_INTERNAL_P185';
--   DELETE FROM products WHERE product_id='P185';   -- only if no inventory_count_lines reference it
