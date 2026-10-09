-- ============================================================
-- krakow-katowice-rollout — STEP B2: Katowice (SUPERSAM) orders Coca-Cola and the Warsaw goods
-- Date: 2026-10-09. Operator decision 2026-10-09: in Katowice the captain orders
--   * Coca-Cola (own tab), and
--   * "Pago + Magazyn + Lemoniady" — Pago, Magazyn własny Mory and Filber lemonades on ONE tab,
--     sent as ONE order from Warsaw.
-- Run order: 0029 -> A -> C -> code deploy + verify -> B -> B2 (this file).
-- What:
--   * 2 suppliers, both scoped to SUPERSAM through their catalog rows (supplier_products.location_id):
--       SUP_COCACOLA_KAT  'Coca-Cola Katowice'          portal, alerts off, minimum NULL (to confirm)
--       SUP_WARSZAWA_KAT  'Pago + Magazyn + Lemoniady'  manual, alerts off, minimum 0 (internal goods)
--     Alerts off: SUPERSAM has no thresholds for these 24 products (0/0/0, Marek's sheet has none),
--     so the captain types quantities without a reason; the suggestion is still shown.
--   * 24 supplier_products rows with location_id = 'SUPERSAM', each an exact copy of the active
--     Warsaw row named in its notes (units, rounding, price, order_note, sku, case, pickup flag):
--       SUP_COCACOLA_KAT  8 rows  <- SP_COCACOLA_P064..P071
--       SUP_WARSZAWA_KAT 16 rows  <- SP_PAGO_P024/P026/P027/P028, SP_MORY_P019/P089/P090/P091/
--                                    P092/P098/P129/P133/P183, SP_FILBER_P075/P076/P077
--     The Warsaw-goods rows carry the source in the name ("Gyros 15 KG (Pago)") so the captain
--     card and the manager's copied list say where each line is collected.
--   * the 24 SUPERSAM settings rows keep 0/0/0; their notes get a "[2026-10-09 B2: ...]" marker
--     appended (the old note — and any step A "przed" stamp — stays untouched).
-- Shared catalog is never touched; the DO block re-checks it inside the transaction.
-- Rollback: switch B2 off alone -> rollback-B2-off.sql (keeps B, keeps history);
--   everything -> rollback.sql (PART 1 kill switch covers both B2 suppliers, PART 2 R-B2
--   deletes B2 before R-B).
-- ============================================================

-- ============================================================
-- STEP 0 — diff before (read-only)
-- ============================================================

-- 0a) B is in place, B2 is not -> 7 / 181 / 0 / 0
SELECT (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')) AS city_suppliers,
       (SELECT count(*) FROM supplier_products WHERE location_id IS NOT NULL) AS scoped_rows,
       (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_COCACOLA_KAT','SUP_WARSZAWA_KAT')) AS b2_suppliers,
       (SELECT count(*) FROM supplier_products WHERE supplier_id IN ('SUP_COCACOLA_KAT','SUP_WARSZAWA_KAT')) AS b2_rows;

-- 0b) the 24 source rows (shared, active) -> 24 rows
SELECT supplier_product_id, product_id, purchase_unit, units_per_purchase_unit, price_estimate_pln
  FROM supplier_products
 WHERE location_id IS NULL AND active
   AND supplier_product_id IN ('SP_COCACOLA_P064','SP_COCACOLA_P065','SP_COCACOLA_P066','SP_COCACOLA_P067',
                               'SP_COCACOLA_P068','SP_COCACOLA_P069','SP_COCACOLA_P070','SP_COCACOLA_P071',
                               'SP_PAGO_P024','SP_PAGO_P026','SP_PAGO_P027','SP_PAGO_P028',
                               'SP_MORY_P019','SP_MORY_P089','SP_MORY_P090','SP_MORY_P091','SP_MORY_P092',
                               'SP_MORY_P098','SP_MORY_P129','SP_MORY_P133','SP_MORY_P183',
                               'SP_FILBER_P075','SP_FILBER_P076','SP_FILBER_P077')
 ORDER BY 1;

-- 0c) SUPERSAM count-only before -> 36, all 0/0/0
SELECT count(*) AS count_only, count(*) FILTER (WHERE s.max_stock_qty_base <> 0) AS nonzero
  FROM location_product_settings s
 WHERE s.location_id = 'SUPERSAM'
   AND NOT EXISTS (SELECT 1 FROM supplier_products sp
                    WHERE sp.location_id = s.location_id AND sp.product_id = s.product_id AND sp.active);

-- ============================================================
-- STEP 1 — apply (one DO block = one transaction)
-- ============================================================
DO $$
DECLARE
  n int;
  shared_before bigint;
  shared_active_before bigint;
  shared_md5_before text;
BEGIN
  CREATE TEMP TABLE b2_map (src text PRIMARY KEY, supplier_id text NOT NULL, label text, pos int NOT NULL)
    ON COMMIT DROP;
  INSERT INTO b2_map (src, supplier_id, label, pos) VALUES
    ('SP_COCACOLA_P068', 'SUP_COCACOLA_KAT', NULL, 10),
    ('SP_COCACOLA_P069', 'SUP_COCACOLA_KAT', NULL, 20),
    ('SP_COCACOLA_P066', 'SUP_COCACOLA_KAT', NULL, 30),
    ('SP_COCACOLA_P067', 'SUP_COCACOLA_KAT', NULL, 40),
    ('SP_COCACOLA_P064', 'SUP_COCACOLA_KAT', NULL, 50),
    ('SP_COCACOLA_P065', 'SUP_COCACOLA_KAT', NULL, 60),
    ('SP_COCACOLA_P070', 'SUP_COCACOLA_KAT', NULL, 70),
    ('SP_COCACOLA_P071', 'SUP_COCACOLA_KAT', NULL, 80),
    ('SP_PAGO_P024',     'SUP_WARSZAWA_KAT', 'Pago', 10),
    ('SP_PAGO_P026',     'SUP_WARSZAWA_KAT', 'Pago', 20),
    ('SP_PAGO_P027',     'SUP_WARSZAWA_KAT', 'Pago', 30),
    ('SP_PAGO_P028',     'SUP_WARSZAWA_KAT', 'Pago', 40),
    ('SP_MORY_P019',     'SUP_WARSZAWA_KAT', 'Magazyn', 50),
    ('SP_MORY_P089',     'SUP_WARSZAWA_KAT', 'Magazyn', 60),
    ('SP_MORY_P090',     'SUP_WARSZAWA_KAT', 'Magazyn', 70),
    ('SP_MORY_P091',     'SUP_WARSZAWA_KAT', 'Magazyn', 80),
    ('SP_MORY_P092',     'SUP_WARSZAWA_KAT', 'Magazyn', 90),
    ('SP_MORY_P098',     'SUP_WARSZAWA_KAT', 'Magazyn', 100),
    ('SP_MORY_P129',     'SUP_WARSZAWA_KAT', 'Magazyn', 110),
    ('SP_MORY_P183',     'SUP_WARSZAWA_KAT', 'Magazyn', 120),
    ('SP_MORY_P133',     'SUP_WARSZAWA_KAT', 'Magazyn', 130),
    ('SP_FILBER_P075',   'SUP_WARSZAWA_KAT', 'Filber', 140),
    ('SP_FILBER_P076',   'SUP_WARSZAWA_KAT', 'Filber', 150),
    ('SP_FILBER_P077',   'SUP_WARSZAWA_KAT', 'Filber', 160);

  -- Guards
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public'
         AND ((table_name = 'locations' AND column_name = 'own_catalog')
           OR (table_name = 'supplier_products' AND column_name IN ('location_id','is_backup')))) <> 3 THEN
    RAISE EXCEPTION 'migration 0029 not applied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM locations WHERE location_id = 'SUPERSAM' AND own_catalog AND active) THEN
    RAISE EXCEPTION 'SUPERSAM is not own_catalog + active (steps A/C missing)';
  END IF;
  IF (SELECT count(*) FROM suppliers WHERE supplier_id IN ('SUP_BUKAT_KRK', 'SUP_DISPACK_KRK', 'SUP_DISPACK_KAT', 'SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT', 'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')) <> 7 THEN
    RAISE EXCEPTION 'step B not applied (7 city suppliers expected)';
  END IF;
  IF EXISTS (SELECT 1 FROM suppliers WHERE supplier_id IN ('SUP_COCACOLA_KAT','SUP_WARSZAWA_KAT'))
     OR EXISTS (SELECT 1 FROM supplier_products WHERE supplier_id IN ('SUP_COCACOLA_KAT','SUP_WARSZAWA_KAT')) THEN
    RAISE EXCEPTION 'B2 already applied — re-diff';
  END IF;
  IF (SELECT count(*) FROM supplier_products sp JOIN b2_map m ON m.src = sp.supplier_product_id
       WHERE sp.location_id IS NULL AND sp.active) <> 24 THEN
    RAISE EXCEPTION 'a source Warsaw row is missing or inactive (24 expected)';
  END IF;
  IF (SELECT count(*) FROM location_product_settings s JOIN supplier_products sp
         ON sp.product_id = s.product_id JOIN b2_map m ON m.src = sp.supplier_product_id
       WHERE s.location_id = 'SUPERSAM') <> 24 THEN
    RAISE EXCEPTION 'a SUPERSAM settings row is missing (24 expected)';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products t JOIN supplier_products sp ON sp.product_id = t.product_id
               JOIN b2_map m ON m.src = sp.supplier_product_id
              WHERE t.location_id = 'SUPERSAM' AND t.active) THEN
    RAISE EXCEPTION 'one of the 24 products already has a SUPERSAM row — re-diff';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE active),
         md5(string_agg(supplier_product_id || ':' || active::text, ',' ORDER BY supplier_product_id))
    INTO shared_before, shared_active_before, shared_md5_before
    FROM supplier_products WHERE location_id IS NULL;

  INSERT INTO suppliers (supplier_id, supplier_name, email, ordering_method, delivery_days,
                         cutoff_time, minimum_order_value_pln, active, notes, nip,
                         suggestion_alerts_enabled, coverage_prompt_enabled)
  VALUES
    ('SUP_COCACOLA_KAT', 'Coca-Cola Katowice', NULL, 'portal', NULL, NULL, NULL, true,
     'krakow-katowice-rollout 2026-10-09 (decyzja operatora): Coca-Cola dla Katowic, katalog tylko dla SUPERSAM (supplier_products.location_id); zamawianie przez portal: https://cchbcshop.com/websitePL/login (jak SUP_COCACOLA w Warszawie; konto / adres dostawy Katowice i minimum do potw.); NIP jak SUP_COCACOLA; alerty sugestii wył. — brak progów w arkuszu',
     '5242106963', false, false),
    ('SUP_WARSZAWA_KAT', 'Pago + Magazyn + Lemoniady', NULL, 'manual', NULL, NULL, 0, true,
     'krakow-katowice-rollout 2026-10-09 (decyzja operatora): jedno zamówienie Katowic (SUPERSAM) z Warszawy — Pago (Lineage), Magazyn własny Mory, lemoniady Filber; jedna zakładka u kapitana; manager zbiera towar w Warszawie (Kopiuj listę) i oznacza jako zamówione; poza Transportem zbiorczym; minimum 0 — towar wewnętrzny; alerty sugestii wył. — brak progów w arkuszu',
     NULL, false, false);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'supplier insert touched % rows, expected 2', n; END IF;

  INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name,
                                 purchase_unit, units_per_purchase_unit, rounding_rule,
                                 price_estimate_pln, active, notes, order_note, unit_weight_kg,
                                 supplier_sku, warehouse_pickup, display_order,
                                 counts_toward_minimum, case_unit, units_per_case,
                                 location_id, is_backup)
  SELECT 'SP_' || substr(m.supplier_id, 5) || '_' || sp.product_id,
         m.supplier_id, sp.product_id,
         CASE WHEN m.label IS NULL THEN sp.supplier_product_name
              ELSE sp.supplier_product_name || ' (' || m.label || ')' END,
         sp.purchase_unit, sp.units_per_purchase_unit, sp.rounding_rule,
         sp.price_estimate_pln, true,
         'krakow-katowice-rollout 2026-10-09: kopia ' || sp.supplier_product_id || ' (Warszawa), decyzja operatora 2026-10-09',
         sp.order_note, sp.unit_weight_kg, sp.supplier_sku, sp.warehouse_pickup, m.pos,
         sp.counts_toward_minimum, sp.case_unit, sp.units_per_case,
         'SUPERSAM', false
    FROM b2_map m JOIN supplier_products sp ON sp.supplier_product_id = m.src;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 24 THEN RAISE EXCEPTION 'catalog insert touched % rows, expected 24', n; END IF;

  -- Append, never overwrite: the old note stays and rollback.sql R-B2 strips only this marker.
  UPDATE location_product_settings s
     SET notes = btrim(s.notes || ' [2026-10-09 B2: zamawiane ' || sup.supplier_name
                       || '; progi do uzupełnienia — brak w arkuszu]')
    FROM supplier_products t JOIN suppliers sup ON sup.supplier_id = t.supplier_id
   WHERE t.supplier_id IN ('SUP_COCACOLA_KAT','SUP_WARSZAWA_KAT')
     AND s.location_id = 'SUPERSAM' AND s.product_id = t.product_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 24 THEN RAISE EXCEPTION 'settings notes update touched % rows, expected 24', n; END IF;

  -- Post-checks
  IF EXISTS (SELECT 1 FROM (SELECT location_id, product_id FROM supplier_products
                             WHERE location_id IS NOT NULL AND active AND NOT is_backup
                             GROUP BY 1, 2 HAVING count(*) > 1) d) THEN
    RAISE EXCEPTION 'a product has two primary rows at one location';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products sp
              WHERE sp.location_id IS NOT NULL AND sp.active
                AND NOT EXISTS (SELECT 1 FROM location_product_settings s
                                 WHERE s.location_id = sp.location_id AND s.product_id = sp.product_id)) THEN
    RAISE EXCEPTION 'a scoped row has no settings row at its location';
  END IF;
  IF (SELECT count(*) FROM supplier_products WHERE location_id IS NULL) <> shared_before
     OR (SELECT count(*) FILTER (WHERE active) FROM supplier_products WHERE location_id IS NULL) <> shared_active_before
     OR (SELECT md5(string_agg(supplier_product_id || ':' || active::text, ',' ORDER BY supplier_product_id))
           FROM supplier_products WHERE location_id IS NULL) <> shared_md5_before THEN
    RAISE EXCEPTION 'shared catalog changed inside step B2';
  END IF;
END $$;

-- ============================================================
-- STEP 2 — audit (read-only). Every query must return the stated result.
-- ============================================================

-- a) per supplier -> SUP_COCACOLA_KAT portal 8, SUP_WARSZAWA_KAT manual 16, both alerts off, SUPERSAM
SELECT s.supplier_id, s.supplier_name, s.ordering_method, s.suggestion_alerts_enabled,
       s.minimum_order_value_pln, sp.location_id, count(*) AS n
  FROM suppliers s JOIN supplier_products sp ON sp.supplier_id = s.supplier_id AND sp.active
 WHERE s.supplier_id IN ('SUP_COCACOLA_KAT','SUP_WARSZAWA_KAT')
 GROUP BY 1, 2, 3, 4, 5, 6 ORDER BY 1;

-- b) each copy equals its Warsaw source on every order-relevant field -> 0 rows
SELECT t.supplier_product_id
  FROM supplier_products t
  JOIN supplier_products sp ON sp.location_id IS NULL
   AND sp.supplier_product_id = substring(t.notes from 'kopia (SP_[A-Z]+_P[0-9]+)')
 WHERE t.supplier_id IN ('SUP_COCACOLA_KAT','SUP_WARSZAWA_KAT')
   AND (t.product_id, t.purchase_unit, t.units_per_purchase_unit, t.rounding_rule,
        t.price_estimate_pln, t.order_note, t.case_unit, t.units_per_case)
       IS DISTINCT FROM
       (sp.product_id, sp.purchase_unit, sp.units_per_purchase_unit, sp.rounding_rule,
        sp.price_estimate_pln, sp.order_note, sp.case_unit, sp.units_per_case);

-- b2) the 24 settings rows carry exactly one B2 marker -> 24 / 24
SELECT count(*) AS marked,
       count(*) FILTER (WHERE notes ~ '^(.*[^ ])? ?\[2026-10-09 B2: zamawiane [^]]*\]$'
                          AND notes NOT LIKE '%[2026-10-09 B2:%[2026-10-09 B2:%') AS marked_once
  FROM location_product_settings
 WHERE location_id = 'SUPERSAM' AND notes LIKE '%[2026-10-09 B2: %';

-- c) SUPERSAM count-only after -> 12 (36 - 24), all 0/0/0
SELECT count(*) AS count_only, count(*) FILTER (WHERE s.max_stock_qty_base <> 0) AS nonzero
  FROM location_product_settings s
 WHERE s.location_id = 'SUPERSAM'
   AND NOT EXISTS (SELECT 1 FROM supplier_products sp
                    WHERE sp.location_id = s.location_id AND sp.product_id = s.product_id AND sp.active);

-- d) no product with two primary rows at one location -> 0 rows
SELECT location_id, product_id, count(*) FROM supplier_products
 WHERE location_id IS NOT NULL AND active AND NOT is_backup
 GROUP BY 1, 2 HAVING count(*) > 1;

-- e) shared catalog unchanged -> same numbers as B STEP 0c / audit f
SELECT count(*) AS shared_rows, count(*) FILTER (WHERE active) AS shared_active,
       md5(string_agg(supplier_product_id || ':' || active::text, ',' ORDER BY supplier_product_id)) AS shared_md5
  FROM supplier_products WHERE location_id IS NULL;
