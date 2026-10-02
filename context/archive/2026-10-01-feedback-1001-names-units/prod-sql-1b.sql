-- =====================================================================
-- feedback-1001-names-units — Phase 1b: units that change what stored
-- counts mean (papryka P017, Prymat spices P050/P051/P052/P055)
-- Project: Supabase lpzhphufjwrndfogkfub
--
-- STATUS 2026-10-02: NOT RUN YET (waits for the full-count day). PREPARED 2026-10-01. Before-state read from prod with
-- SELECT only on 2026-10-01 (~16:30 CEST). Human-readable diff with the
-- per-location decisions and the last counts: prod-sql-1b-diff.md.
--
-- Apply ON THE FULL-COUNT DAY, after staff message part 1b has gone out
-- (plan.md Phase 1b). Counts are stored as plain numbers and the unit is
-- joined live, so from the moment a block runs, earlier counts of that
-- product are read in the new unit (szt / opak). Nothing in the history
-- is rewritten. Independent of prod-sql-1.sql (no guard here depends on
-- it). The Prymat names of P050/P051/P052/P055 (screen + supplier name)
-- are set HERE, in the same block as the unit change, so no screen or
-- supplier e-mail ever shows a jar name next to "kg" (main-loop decision
-- 2026-10-01; P054 liść keeps its name step in prod-sql-1.sql 1.1).
--
-- Pattern: STEP 0 diff (read-only) -> one guarded DO block per product ->
-- STEP 2 audit -> STEP R rollback (commented out). One block per
-- execution; each DO block is its own transaction.
--
-- Open-order guard (plan Phase 1b): a block raises when its supplier row
-- has a line in captain_submitted / manager_claimed, or in manager_sent
-- WITHOUT a receipt. Prod has 54 manager_sent orders and none of them has
-- a receipt (the oldest is 2026-06-23), so the literal guard could never
-- pass. Each block therefore counts only manager_sent orders sent within
-- v_sent_window (default 14 days); older ones are listed in the diff as
-- stale. Set v_sent_window := interval '100 years' for the literal guard.
-- Why 14 days is safe (review 2026-10-01, prod read): a receipt flips
-- manager_sent -> closed, so a manager_sent order has no receipt by
-- construction. Over all 113 receipted orders the first receipt came at
-- most 6,7 days after sending (p95 2,7 days), so an order sent more than
-- 14 days ago is an unconfirmed delivery, not a pending one. If one is
-- confirmed after all, its old line simply reads "N szt" (upp stays 1).
--   * 1b.4 (P052) is BLOCKED on 2026-10-01 by ORD-20261001-WOL-INTE-8971b4
--     (WOLA, sent 2026-10-01 12:25 UTC, no receipt yet). Re-run after WOLA
--     confirms that delivery.
--   * 1b.6 (KEN thresholds read as kg): the operator chose YES on
--     2026-10-02 — run it after 1b.2..1b.5.
-- =====================================================================


-- =====================================================================
-- STEP 0 — DIFF BEFORE (read-only). Save every result set.
-- =====================================================================

-- 0.1 products and supplier rows
SELECT p.product_id, p.product_name_pl, p.inventory_unit, p.active,
       sp.supplier_product_id, sp.supplier_product_name, sp.purchase_unit,
       sp.units_per_purchase_unit::float8 AS upp, sp.price_estimate_pln::float8 AS price,
       sp.active AS sp_active, sp.order_note
  FROM products p
  LEFT JOIN supplier_products sp ON sp.product_id = p.product_id AND sp.supplier_id = 'SUP_INTERMLECZ'
 WHERE p.product_id IN ('P017','P050','P051','P052','P055')
 ORDER BY p.product_id, sp.supplier_product_id;

-- 0.2 thresholds at the 7 active locations
SELECT s.location_id, s.product_id, s.min_stock_qty_base::float8 AS mn,
       s.target_stock_qty_base::float8 AS tg, s.max_stock_qty_base::float8 AS mx, s.notes
  FROM location_product_settings s JOIN locations l USING (location_id)
 WHERE l.active AND s.product_id IN ('P017','P050','P051','P052','P055')
 ORDER BY s.product_id, s.location_id;

-- 0.3 last count per active location (the number that will be re-read in the new unit)
SELECT DISTINCT ON (c.location_id, il.product_id)
       c.location_id, il.product_id, c.count_date, c.count_submitted_at, c.count_user,
       il.current_stock_qty_base::float8 AS qty
  FROM inventory_count_lines il
  JOIN inventory_counts c USING (count_id)
  JOIN locations l ON l.location_id = c.location_id
 WHERE l.active AND il.product_id IN ('P017','P050','P051','P052','P055')
 ORDER BY c.location_id, il.product_id, c.count_date DESC, c.count_submitted_at DESC NULLS LAST;

-- 0.4 open lines on the supplier rows (guard preview). stale = manager_sent
--     longer than 14 days ago without a receipt (not counted by the guard).
SELECT o.status, o.location_id, o.order_id, ol.supplier_product_id,
       ol.captain_final_qty_purchase::float8 AS cap, ol.manager_final_qty_purchase::float8 AS mgr,
       o.manager_sent_at,
       (SELECT count(*) FROM receipts r WHERE r.order_id = o.order_id) AS receipts,
       (o.status = 'manager_sent' AND o.manager_sent_at < now() - interval '14 days') AS stale
  FROM orders o JOIN order_lines ol USING (order_id)
 WHERE ol.supplier_product_id IN ('SP_INTERMLECZ_P017','SP_INTERMLECZ_P050','SP_INTERMLECZ_P051',
                                  'SP_INTERMLECZ_P052','SP_INTERMLECZ_P055')
   AND (o.status IN ('captain_submitted','manager_claimed')
        OR (o.status = 'manager_sent'
            AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = o.order_id)))
 ORDER BY ol.supplier_product_id, o.order_id;


-- =====================================================================
-- STEP 1 — APPLY (one block per execution, on the full-count day)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1b.1 Papryka P017 -> Helcom per opak (D27), history-safe:
--      new supplier row SP_INTERMLECZ_P017_H (opak x 1); the old Florinis
--      row SP_INTERMLECZ_P017 (opak x 3,6 kg) is retired, not edited, so
--      its 10 order lines keep reading in kg; products.inventory_unit
--      kg -> opak and the screen name -> Helcom; thresholds 0,5/1,5/1,5
--      opak at the 7 active locations.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int; v_sent_window interval := interval '14 days';
BEGIN
  IF (SELECT count(*) FROM products WHERE product_id = 'P017' AND active AND inventory_unit = 'kg'
        AND product_name_pl = 'Papryka grillowana grecka Florina (Florinis)') <> 1 THEN
    RAISE EXCEPTION '1b.1 P017: product not in the expected state (kg, Florinis)';
  END IF;
  IF (SELECT count(*) FROM supplier_products WHERE supplier_product_id = 'SP_INTERMLECZ_P017'
        AND active AND purchase_unit = 'opak' AND units_per_purchase_unit = 3.6) <> 1 THEN
    RAISE EXCEPTION '1b.1 SP_INTERMLECZ_P017: not active opak x 3.6';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products WHERE supplier_product_id = 'SP_INTERMLECZ_P017_H') THEN
    RAISE EXCEPTION '1b.1 SP_INTERMLECZ_P017_H already exists';
  END IF;
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE ol.supplier_product_id = 'SP_INTERMLECZ_P017'
     AND (o.status IN ('captain_submitted','manager_claimed')
          OR (o.status = 'manager_sent' AND o.manager_sent_at >= now() - v_sent_window
              AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = o.order_id)));
  IF n > 0 THEN RAISE EXCEPTION '1b.1 P017: % open line(s) on the old row — retry later', n; END IF;

  INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id,
      supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule,
      price_estimate_pln, active, notes, order_note, unit_weight_kg, supplier_sku,
      warehouse_pickup, display_order, counts_toward_minimum)
  SELECT 'SP_INTERMLECZ_P017_H', 'SUP_INTERMLECZ', 'P017',
         'Helcom Papryka Grillowana Czerwona 4,2kg/2,5kg', 'opak', 1, 'full_only',
         39.66, true,
         '2026-10-01 feedback-1001 1b.1 D27: Helcom per opak; zastępuje SP_INTERMLECZ_P017 (Florinis, opak 3,6 kg); cena 39,66 zł netto (operator 2026-10-02)',
         '1 opak = puszka 4,2 kg (2,5 kg po odsączeniu)', NULL, NULL,
         sp.warehouse_pickup, sp.display_order, sp.counts_toward_minimum
    FROM supplier_products sp WHERE sp.supplier_product_id = 'SP_INTERMLECZ_P017';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.1 new row insert: expected 1, got %', n; END IF;

  UPDATE supplier_products SET active = false
   WHERE supplier_product_id = 'SP_INTERMLECZ_P017' AND active;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.1 retire old row: expected 1, got %', n; END IF;

  UPDATE products SET product_name_pl = 'Helcom Papryka Grillowana Czerwona 4,2kg/2,5kg',
                      inventory_unit = 'opak'
   WHERE product_id = 'P017' AND inventory_unit = 'kg';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.1 product: expected 1, got %', n; END IF;

  UPDATE location_product_settings s
     SET notes = s.notes || format(' [2026-10-01 feedback-1001 1b.1 D27, przed %s/%s/%s kg]',
                                   s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                                   s.max_stock_qty_base::float8),
         min_stock_qty_base = 0.5, target_stock_qty_base = 1.5, max_stock_qty_base = 1.5
    FROM (VALUES ('WOLA',0.5,1.5,1.5), ('BRACKA',0.5,1.5,1.5), ('KEN',0.2,2,2),
                 ('BROWARY',1.4,4.2,4.2), ('NORBLIN',1.8,5.4,5.4), ('ELEKTROWNIA',1.8,5.4,5.4),
                 ('WESTFIELD',1.8,5.4,5.4)) AS v(loc, mn, tg, mx)
   WHERE s.location_id = v.loc AND s.product_id = 'P017'
     AND s.min_stock_qty_base = v.mn AND s.target_stock_qty_base = v.tg
     AND s.max_stock_qty_base = v.mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 7 THEN RAISE EXCEPTION '1b.1 thresholds: expected 7, got % — before-state changed', n; END IF;
  RAISE NOTICE '1b.1 applied: P017 Helcom per opak, old row retired, 7 thresholds 0.5/1.5/1.5';
END $$;

-- ---------------------------------------------------------------------
-- 1b.2 Prymat pieprz P050 kg -> szt (1 szt = 820 g jar), price 47,60,
--      names "Prymat Pieprz czarny mielony 820g" / invoice name.
--      Thresholds kept everywhere (already in jars) except BROWARY
--      (kg, divided by 0,82 kg and rounded to 0,5): 0,2/0,82/0,82 -> 0,5/1/1.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int; v_sent_window interval := interval '14 days';
BEGIN
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE ol.supplier_product_id = 'SP_INTERMLECZ_P050'
     AND (o.status IN ('captain_submitted','manager_claimed')
          OR (o.status = 'manager_sent' AND o.manager_sent_at >= now() - v_sent_window
              AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = o.order_id)));
  IF n > 0 THEN RAISE EXCEPTION '1b.2 P050: % open line(s) — retry later', n; END IF;

  -- Kept rows (already in jars, operator-reviewed in prod-sql-1b-diff.md):
  -- they are re-read in szt from this block on, so re-check they did not move.
  SELECT count(*) INTO n FROM location_product_settings s
    JOIN (VALUES ('WOLA',0.5,1.5,1.5), ('BRACKA',0.5,1.5,1.5), ('ELEKTROWNIA',0.5,1.5,1.5),
                 ('NORBLIN',0.5,1.5,1.5), ('WESTFIELD',0.5,1.5,1.5), ('KEN',0.2,1,1)) AS v(loc, mn, tg, mx)
      ON s.location_id = v.loc AND s.product_id = 'P050' AND s.min_stock_qty_base = v.mn
     AND s.target_stock_qty_base = v.tg AND s.max_stock_qty_base = v.mx;
  IF n <> 6 THEN RAISE EXCEPTION '1b.2 P050: expected 6 kept threshold rows as reviewed, got % — re-read the diff', n; END IF;

  UPDATE products SET inventory_unit = 'szt', product_name_pl = 'Prymat Pieprz czarny mielony 820g'
   WHERE product_id = 'P050' AND inventory_unit = 'kg' AND product_name_pl = 'Pieprz';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.2 P050 product: expected 1 row in kg named "Pieprz", got %', n; END IF;

  UPDATE supplier_products SET purchase_unit = 'szt', price_estimate_pln = 47.60,
                               order_note = '1 szt = słoik 820 g',
                               supplier_product_name = 'PRYMAT PIEPRZ CZARNY MIELONY 820g/9 pet'
   WHERE supplier_product_id = 'SP_INTERMLECZ_P050' AND purchase_unit = 'kg'
     AND supplier_product_name = 'Pieprz'
     AND units_per_purchase_unit = 1 AND price_estimate_pln = 43.79;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.2 SP_INTERMLECZ_P050: expected 1 row kg/43.79, got %', n; END IF;

  UPDATE location_product_settings s
     SET notes = s.notes || ' [2026-10-01 feedback-1001 1b.2 D28, przed 0.2/0.82/0.82 kg]',
         min_stock_qty_base = 0.5, target_stock_qty_base = 1, max_stock_qty_base = 1
   WHERE s.location_id = 'BROWARY' AND s.product_id = 'P050'
     AND s.min_stock_qty_base = 0.2 AND s.target_stock_qty_base = 0.82 AND s.max_stock_qty_base = 0.82;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.2 BROWARY P050: expected 1, got %', n; END IF;
  RAISE NOTICE '1b.2 applied: P050 Prymat name, szt, 47.60, BROWARY 0.5/1/1';
END $$;

-- ---------------------------------------------------------------------
-- 1b.3 Prymat oregano P051 kg -> szt (1 szt = 110 g jar), price 11,30,
--      names "Prymat Oregano 110g" / invoice name.
--      BROWARY 0,5/1/1 kg / 0,11 -> 4,5/9/9 jars (see diff: check).
-- ---------------------------------------------------------------------
DO $$
DECLARE n int; v_sent_window interval := interval '14 days';
BEGIN
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE ol.supplier_product_id = 'SP_INTERMLECZ_P051'
     AND (o.status IN ('captain_submitted','manager_claimed')
          OR (o.status = 'manager_sent' AND o.manager_sent_at >= now() - v_sent_window
              AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = o.order_id)));
  IF n > 0 THEN RAISE EXCEPTION '1b.3 P051: % open line(s) — retry later', n; END IF;

  -- Kept rows (already in jars, operator-reviewed in prod-sql-1b-diff.md):
  -- they are re-read in szt from this block on, so re-check they did not move.
  SELECT count(*) INTO n FROM location_product_settings s
    JOIN (VALUES ('WOLA',0.5,1,1), ('BRACKA',0.5,1.5,1.5), ('ELEKTROWNIA',0.5,1.5,1.5),
                 ('NORBLIN',0.5,1.5,1.5), ('WESTFIELD',0.5,1.5,1.5), ('KEN',0.3,1,1)) AS v(loc, mn, tg, mx)
      ON s.location_id = v.loc AND s.product_id = 'P051' AND s.min_stock_qty_base = v.mn
     AND s.target_stock_qty_base = v.tg AND s.max_stock_qty_base = v.mx;
  IF n <> 6 THEN RAISE EXCEPTION '1b.3 P051: expected 6 kept threshold rows as reviewed, got % — re-read the diff', n; END IF;

  UPDATE products SET inventory_unit = 'szt', product_name_pl = 'Prymat Oregano 110g'
   WHERE product_id = 'P051' AND inventory_unit = 'kg' AND product_name_pl = 'Oregano';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.3 P051 product: expected 1 row in kg named "Oregano", got %', n; END IF;

  UPDATE supplier_products SET purchase_unit = 'szt', price_estimate_pln = 11.30,
                               order_note = '1 szt = słoik 110 g',
                               supplier_product_name = 'PRYMAT OREGANO 110g/6 pet'
   WHERE supplier_product_id = 'SP_INTERMLECZ_P051' AND purchase_unit = 'kg'
     AND supplier_product_name = 'Oregano'
     AND units_per_purchase_unit = 1 AND price_estimate_pln = 30.71;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.3 SP_INTERMLECZ_P051: expected 1 row kg/30.71, got %', n; END IF;

  UPDATE location_product_settings s
     SET notes = s.notes || ' [2026-10-01 feedback-1001 1b.3 D28, przed 0.5/1/1 kg]',
         min_stock_qty_base = 4.5, target_stock_qty_base = 9, max_stock_qty_base = 9
   WHERE s.location_id = 'BROWARY' AND s.product_id = 'P051'
     AND s.min_stock_qty_base = 0.5 AND s.target_stock_qty_base = 1 AND s.max_stock_qty_base = 1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.3 BROWARY P051: expected 1, got %', n; END IF;
  RAISE NOTICE '1b.3 applied: P051 Prymat name, szt, 11.30, BROWARY 4.5/9/9';
END $$;

-- ---------------------------------------------------------------------
-- 1b.4 Prymat papryka słodka P052 kg -> szt (1 szt = 720 g jar), names
--      "Prymat Papryka słodka mielona 720g" / invoice name, price
--      unchanged 25,76. BROWARY 0,36/0,72/0,72 kg / 0,72 -> 0,5/1/1.
--      BLOCKED on 2026-10-01 by ORD-20261001-WOL-INTE-8971b4 (sent today).
-- ---------------------------------------------------------------------
DO $$
DECLARE n int; v_sent_window interval := interval '14 days';
BEGIN
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE ol.supplier_product_id = 'SP_INTERMLECZ_P052'
     AND (o.status IN ('captain_submitted','manager_claimed')
          OR (o.status = 'manager_sent' AND o.manager_sent_at >= now() - v_sent_window
              AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = o.order_id)));
  IF n > 0 THEN RAISE EXCEPTION '1b.4 P052: % open line(s) — retry after the delivery is confirmed', n; END IF;

  -- Kept rows (already in jars, operator-reviewed in prod-sql-1b-diff.md):
  -- they are re-read in szt from this block on, so re-check they did not move.
  SELECT count(*) INTO n FROM location_product_settings s
    JOIN (VALUES ('WOLA',0.5,1.5,1.5), ('BRACKA',0.5,1.5,1.5), ('ELEKTROWNIA',0.5,1.5,1.5),
                 ('NORBLIN',0.5,1.5,1.5), ('WESTFIELD',0.5,1.5,1.5), ('KEN',0.2,1,1)) AS v(loc, mn, tg, mx)
      ON s.location_id = v.loc AND s.product_id = 'P052' AND s.min_stock_qty_base = v.mn
     AND s.target_stock_qty_base = v.tg AND s.max_stock_qty_base = v.mx;
  IF n <> 6 THEN RAISE EXCEPTION '1b.4 P052: expected 6 kept threshold rows as reviewed, got % — re-read the diff', n; END IF;

  UPDATE products SET inventory_unit = 'szt', product_name_pl = 'Prymat Papryka słodka mielona 720g'
   WHERE product_id = 'P052' AND inventory_unit = 'kg' AND product_name_pl = 'Papryka słodka - mielona';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.4 P052 product: expected 1 row in kg named "Papryka słodka - mielona", got %', n; END IF;

  UPDATE supplier_products SET purchase_unit = 'szt', order_note = '1 szt = słoik 720 g',
                               supplier_product_name = 'PRYMAT PAPRYKA SŁODKA 720g/9 pet'
   WHERE supplier_product_id = 'SP_INTERMLECZ_P052' AND purchase_unit = 'kg'
     AND supplier_product_name = 'Papryka słodka - mielona'
     AND units_per_purchase_unit = 1 AND price_estimate_pln = 25.76;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.4 SP_INTERMLECZ_P052: expected 1 row kg/25.76, got %', n; END IF;

  UPDATE location_product_settings s
     SET notes = s.notes || ' [2026-10-01 feedback-1001 1b.4 D28, przed 0.36/0.72/0.72 kg]',
         min_stock_qty_base = 0.5, target_stock_qty_base = 1, max_stock_qty_base = 1
   WHERE s.location_id = 'BROWARY' AND s.product_id = 'P052'
     AND s.min_stock_qty_base = 0.36 AND s.target_stock_qty_base = 0.72 AND s.max_stock_qty_base = 0.72;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.4 BROWARY P052: expected 1, got %', n; END IF;
  RAISE NOTICE '1b.4 applied: P052 Prymat name, szt, BROWARY 0.5/1/1';
END $$;

-- ---------------------------------------------------------------------
-- 1b.5 Prymat ziele angielskie P055 opak -> szt (label only; 1 szt =
--      600 g jar; Prymat 600 g replaces Kamis 500 g, names "Prymat Ziele
--      angielskie 600g" / invoice name), price 43,90. BROWARY values are kg
--      typed into the opak field (0,01/0,1/0,1): / 0,6 -> 0,5 min; target =
--      max = 1 jar
--      (review 2026-10-01: a max below one jar makes every uncounted
--      1-jar order a 400 "over MAX without reason"; same as KEN 1b.6).
-- ---------------------------------------------------------------------
DO $$
DECLARE n int; v_sent_window interval := interval '14 days';
BEGIN
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE ol.supplier_product_id = 'SP_INTERMLECZ_P055'
     AND (o.status IN ('captain_submitted','manager_claimed')
          OR (o.status = 'manager_sent' AND o.manager_sent_at >= now() - v_sent_window
              AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = o.order_id)));
  IF n > 0 THEN RAISE EXCEPTION '1b.5 P055: % open line(s) — retry later', n; END IF;

  -- Kept rows (already in jars, operator-reviewed in prod-sql-1b-diff.md):
  -- they are re-read in szt from this block on, so re-check they did not move.
  SELECT count(*) INTO n FROM location_product_settings s
    JOIN (VALUES ('WOLA',1,1,1), ('BRACKA',0.5,1.5,1.5), ('ELEKTROWNIA',0.5,1.5,1.5),
                 ('NORBLIN',0.5,1.5,1.5), ('WESTFIELD',0.5,1.5,1.5), ('KEN',0.1,0.5,0.5)) AS v(loc, mn, tg, mx)
      ON s.location_id = v.loc AND s.product_id = 'P055' AND s.min_stock_qty_base = v.mn
     AND s.target_stock_qty_base = v.tg AND s.max_stock_qty_base = v.mx;
  IF n <> 6 THEN RAISE EXCEPTION '1b.5 P055: expected 6 kept threshold rows as reviewed, got % — re-read the diff', n; END IF;

  UPDATE products SET inventory_unit = 'szt', product_name_pl = 'Prymat Ziele angielskie 600g'
   WHERE product_id = 'P055' AND inventory_unit = 'opak' AND product_name_pl = 'Ziele Angielskie';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.5 P055 product: expected 1 row in opak named "Ziele Angielskie", got %', n; END IF;

  UPDATE supplier_products SET purchase_unit = 'szt', price_estimate_pln = 43.90,
                               order_note = '1 szt = słoik 600 g',
                               supplier_product_name = 'PRYMAT ZIELE ANGIELSKIE 600g/9 pet'
   WHERE supplier_product_id = 'SP_INTERMLECZ_P055' AND purchase_unit = 'opak'
     AND supplier_product_name = 'Ziele Angielskie 500g' AND order_note = '1 opak = 500 g'
     AND units_per_purchase_unit = 1 AND price_estimate_pln = 40.83;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.5 SP_INTERMLECZ_P055: expected 1 row opak/40.83, got %', n; END IF;

  UPDATE location_product_settings s
     SET notes = s.notes || ' [2026-10-01 feedback-1001 1b.5 D28, przed 0.01/0.1/0.1 (kg)]',
         min_stock_qty_base = 0.5, target_stock_qty_base = 1, max_stock_qty_base = 1
   WHERE s.location_id = 'BROWARY' AND s.product_id = 'P055'
     AND s.min_stock_qty_base = 0.01 AND s.target_stock_qty_base = 0.1 AND s.max_stock_qty_base = 0.1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '1b.5 BROWARY P055: expected 1, got %', n; END IF;
  RAISE NOTICE '1b.5 applied: P055 Prymat name, szt, 43.90, BROWARY 0.5/1/1';
END $$;

-- ---------------------------------------------------------------------
-- 1b.6 [OPTIONAL — run only if the operator picks the kg reading for KEN]
--      KEN spice thresholds divided by the jar weight, rounded to 0,5:
--      P050 0,2/1/1 -> 0,5/1/1; P051 0,3/1/1 -> 2,5/9/9;
--      P052 0,2/1/1 -> 0,5/1,5/1,5; P055 0,1/0,5/0,5 -> 0,5/1/1.
--      Needs 1b.2..1b.5 first (all four products already in szt).
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  IF (SELECT count(*) FROM products WHERE product_id IN ('P050','P051','P052','P055')
        AND inventory_unit = 'szt') <> 4 THEN
    RAISE EXCEPTION '1b.6 KEN: run 1b.2..1b.5 first (all four spices must be in szt)';
  END IF;
  UPDATE location_product_settings s
     SET notes = s.notes || format(' [2026-10-01 feedback-1001 1b.6 D28 KEN kg->szt, przed %s/%s/%s kg]',
                                   s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                                   s.max_stock_qty_base::float8),
         min_stock_qty_base = v.new_mn, target_stock_qty_base = v.new_mx, max_stock_qty_base = v.new_mx
    FROM (VALUES ('P050',0.2,1,1,0.5,1), ('P051',0.3,1,1,2.5,9),
                 ('P052',0.2,1,1,0.5,1.5), ('P055',0.1,0.5,0.5,0.5,1)) AS v(pid, mn, tg, mx, new_mn, new_mx)
   WHERE s.location_id = 'KEN' AND s.product_id = v.pid
     AND s.min_stock_qty_base = v.mn AND s.target_stock_qty_base = v.tg AND s.max_stock_qty_base = v.mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION '1b.6 KEN: expected 4 rows, got % — before-state changed', n; END IF;
  RAISE NOTICE '1b.6 applied: KEN spice thresholds converted from kg';
END $$;


-- =====================================================================
-- STEP 2 — AUDIT (read-only). Save the output as prod-sql-1b-audit.md.
-- =====================================================================

SELECT n, check_name, ok FROM (
  SELECT 1 AS n, '1b.1 P017 Helcom, inventory unit opak' AS check_name,
         (SELECT count(*) FROM products WHERE product_id = 'P017' AND active AND inventory_unit = 'opak'
            AND product_name_pl = 'Helcom Papryka Grillowana Czerwona 4,2kg/2,5kg') = 1 AS ok
  UNION ALL
  SELECT 2, '1b.1 exactly one active Intermlecz row for P017: SP_INTERMLECZ_P017_H opak x1; old row inactive, still opak x3.6',
         (SELECT string_agg(supplier_product_id, ',') FROM supplier_products
           WHERE product_id = 'P017' AND supplier_id = 'SUP_INTERMLECZ' AND active) = 'SP_INTERMLECZ_P017_H'
     AND (SELECT count(*) FROM supplier_products WHERE supplier_product_id = 'SP_INTERMLECZ_P017_H'
            AND purchase_unit = 'opak' AND units_per_purchase_unit = 1) = 1
     AND (SELECT count(*) FROM supplier_products WHERE supplier_product_id = 'SP_INTERMLECZ_P017'
            AND NOT active AND purchase_unit = 'opak' AND units_per_purchase_unit = 3.6) = 1
  UNION ALL
  SELECT 3, '1b.1 P017 thresholds 0.5/1.5/1.5 at the 7 active locations',
         (SELECT count(*) FROM location_product_settings s JOIN locations l USING (location_id)
           WHERE l.active AND s.product_id = 'P017' AND s.min_stock_qty_base = 0.5
             AND s.target_stock_qty_base = 1.5 AND s.max_stock_qty_base = 1.5) = 7
  UNION ALL
  SELECT 4, '1b.1 old order lines still point at the old row (none moved)',
         NOT EXISTS (SELECT 1 FROM order_lines WHERE supplier_product_id = 'SP_INTERMLECZ_P017_H')
  UNION ALL
  SELECT 5, '1b.2-1b.5 spices in szt (product + supplier row, upp 1) (pending: 1b.4 until WOLA receipt)',
         (SELECT count(*) FROM products p JOIN supplier_products sp
             ON sp.product_id = p.product_id AND sp.supplier_id = 'SUP_INTERMLECZ' AND sp.active
           WHERE p.product_id IN ('P050','P051','P052','P055') AND p.inventory_unit = 'szt'
             AND sp.purchase_unit = 'szt' AND sp.units_per_purchase_unit = 1) = 4
  UNION ALL
  SELECT 6, '1b.2-1b.5 prices 47.60 / 11.30 / 25.76 / 43.90',
         (SELECT count(*) FROM supplier_products
           WHERE (supplier_product_id, price_estimate_pln) IN
                 (('SP_INTERMLECZ_P050',47.60), ('SP_INTERMLECZ_P051',11.30),
                  ('SP_INTERMLECZ_P052',25.76), ('SP_INTERMLECZ_P055',43.90))) = 4
  UNION ALL
  SELECT 7, '1b BROWARY spices: P050 0.5/1/1, P051 4.5/9/9, P052 0.5/1/1, P055 0.5/1/1 (pending: 1b.4)',
         (SELECT count(*) FROM location_product_settings
           WHERE location_id = 'BROWARY'
             AND (product_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base) IN
                 (('P050',0.5,1,1), ('P051',4.5,9,9), ('P052',0.5,1,1), ('P055',0.5,1,1))) = 4
  UNION ALL
  SELECT 8, '1b KEN spices: kept (0.2/1/1, 0.3/1/1, 0.2/1/1, 0.1/0.5/0.5) OR converted by 1b.6',
         (SELECT count(*) FROM location_product_settings
           WHERE location_id = 'KEN'
             AND (product_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base) IN
                 (('P050',0.2,1,1), ('P051',0.3,1,1), ('P052',0.2,1,1), ('P055',0.1,0.5,0.5))) = 4
      OR (SELECT count(*) FROM location_product_settings
           WHERE location_id = 'KEN'
             AND (product_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base) IN
                 (('P050',0.5,1,1), ('P051',2.5,9,9), ('P052',0.5,1.5,1.5), ('P055',0.5,1,1))) = 4
  UNION ALL
  SELECT 9, '1b other locations unchanged: WOLA/BRACKA/ELEKTROWNIA/NORBLIN/WESTFIELD spice rows carry no 1b note',
         NOT EXISTS (SELECT 1 FROM location_product_settings
                      WHERE location_id IN ('WOLA','BRACKA','ELEKTROWNIA','NORBLIN','WESTFIELD')
                        AND product_id IN ('P050','P051','P052','P055')
                        AND notes LIKE '%feedback-1001 1b%')
  UNION ALL
  SELECT 11, '1b.2-1b.5 Prymat names on screen and supplier row (pending: 1b.4 until WOLA receipt)',
         (SELECT count(*) FROM products WHERE (product_id, product_name_pl) IN
            (('P050','Prymat Pieprz czarny mielony 820g'), ('P051','Prymat Oregano 110g'),
             ('P052','Prymat Papryka słodka mielona 720g'), ('P055','Prymat Ziele angielskie 600g'))) = 4
     AND (SELECT count(*) FROM supplier_products WHERE active AND (supplier_product_id, supplier_product_name) IN
            (('SP_INTERMLECZ_P050','PRYMAT PIEPRZ CZARNY MIELONY 820g/9 pet'),
             ('SP_INTERMLECZ_P051','PRYMAT OREGANO 110g/6 pet'),
             ('SP_INTERMLECZ_P052','PRYMAT PAPRYKA SŁODKA 720g/9 pet'),
             ('SP_INTERMLECZ_P055','PRYMAT ZIELE ANGIELSKIE 600g/9 pet'))) = 4
  UNION ALL
  SELECT 10, 'min <= target <= max and max > 0 on every row 1b wrote',
         NOT EXISTS (SELECT 1 FROM location_product_settings
                      WHERE notes LIKE '%2026-10-01 feedback-1001 1b%'
                        AND NOT (min_stock_qty_base <= target_stock_qty_base
                                 AND target_stock_qty_base <= max_stock_qty_base
                                 AND max_stock_qty_base > 0))
) c
ORDER BY n;


-- =====================================================================
-- STEP R — ROLLBACK (commented out). Run only the parts that were
-- applied, newest first. Values are the prod state read on 2026-10-01.
-- =====================================================================

-- -- R 1b.6 (KEN, only if it ran)
-- BEGIN;
-- UPDATE location_product_settings s
--    SET min_stock_qty_base = v.mn, target_stock_qty_base = v.tg, max_stock_qty_base = v.mx,
--        notes = regexp_replace(s.notes, ' \[2026-10-01 feedback-1001 1b\.6 [^]]*\]$', '')
--   FROM (VALUES ('P050',0.2,1,1), ('P051',0.3,1,1), ('P052',0.2,1,1), ('P055',0.1,0.5,0.5)) AS v(pid, mn, tg, mx)
--  WHERE s.location_id = 'KEN' AND s.product_id = v.pid AND s.notes LIKE '%feedback-1001 1b.6%';
-- COMMIT;
--
-- -- R 1b.2..1b.5 (spices back to kg / opak and their old names; BROWARY thresholds back)
-- BEGIN;
-- UPDATE products SET inventory_unit = 'kg', product_name_pl = 'Pieprz' WHERE product_id = 'P050' AND inventory_unit = 'szt';
-- UPDATE products SET inventory_unit = 'kg', product_name_pl = 'Oregano' WHERE product_id = 'P051' AND inventory_unit = 'szt';
-- UPDATE products SET inventory_unit = 'kg', product_name_pl = 'Papryka słodka - mielona' WHERE product_id = 'P052' AND inventory_unit = 'szt';
-- UPDATE products SET inventory_unit = 'opak', product_name_pl = 'Ziele Angielskie' WHERE product_id = 'P055' AND inventory_unit = 'szt';
-- UPDATE supplier_products SET purchase_unit = 'kg', price_estimate_pln = 43.79, order_note = NULL, supplier_product_name = 'Pieprz'
--  WHERE supplier_product_id = 'SP_INTERMLECZ_P050' AND purchase_unit = 'szt';
-- UPDATE supplier_products SET purchase_unit = 'kg', price_estimate_pln = 30.71, order_note = NULL, supplier_product_name = 'Oregano'
--  WHERE supplier_product_id = 'SP_INTERMLECZ_P051' AND purchase_unit = 'szt';
-- UPDATE supplier_products SET purchase_unit = 'kg', order_note = NULL, supplier_product_name = 'Papryka słodka - mielona'
--  WHERE supplier_product_id = 'SP_INTERMLECZ_P052' AND purchase_unit = 'szt';
-- UPDATE supplier_products SET purchase_unit = 'opak', price_estimate_pln = 40.83, order_note = '1 opak = 500 g',
--        supplier_product_name = 'Ziele Angielskie 500g'
--  WHERE supplier_product_id = 'SP_INTERMLECZ_P055' AND purchase_unit = 'szt';
-- UPDATE location_product_settings s
--    SET min_stock_qty_base = v.mn, target_stock_qty_base = v.tg, max_stock_qty_base = v.mx,
--        notes = regexp_replace(s.notes, ' \[2026-10-01 feedback-1001 1b\.[2-5] [^]]*\]$', '')
--   FROM (VALUES ('P050',0.2,0.82,0.82), ('P051',0.5,1,1), ('P052',0.36,0.72,0.72), ('P055',0.01,0.1,0.1))
--        AS v(pid, mn, tg, mx)
--  WHERE s.location_id = 'BROWARY' AND s.product_id = v.pid AND s.notes ~ 'feedback-1001 1b\.[2-5]';
-- COMMIT;
--
-- -- R 1b.1 (only while no order line points at SP_INTERMLECZ_P017_H — the FK makes the DELETE fail otherwise)
-- BEGIN;
-- UPDATE location_product_settings s
--    SET min_stock_qty_base = v.mn, target_stock_qty_base = v.tg, max_stock_qty_base = v.mx,
--        notes = regexp_replace(s.notes, ' \[2026-10-01 feedback-1001 1b\.1 [^]]*\]$', '')
--   FROM (VALUES ('WOLA',0.5,1.5,1.5), ('BRACKA',0.5,1.5,1.5), ('KEN',0.2,2,2),
--                ('BROWARY',1.4,4.2,4.2), ('NORBLIN',1.8,5.4,5.4), ('ELEKTROWNIA',1.8,5.4,5.4),
--                ('WESTFIELD',1.8,5.4,5.4)) AS v(loc, mn, tg, mx)
--  WHERE s.location_id = v.loc AND s.product_id = 'P017' AND s.notes LIKE '%feedback-1001 1b.1%';
-- UPDATE products SET product_name_pl = 'Papryka grillowana grecka Florina (Florinis)', inventory_unit = 'kg'
--  WHERE product_id = 'P017';
-- UPDATE supplier_products SET active = true WHERE supplier_product_id = 'SP_INTERMLECZ_P017';
-- DELETE FROM supplier_products WHERE supplier_product_id = 'SP_INTERMLECZ_P017_H';
-- COMMIT;
