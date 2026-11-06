-- porzadek-data-2026-10 — prod SQL 0: read-only audits (D10)
-- Prepared 2026-10-17. Run in the Supabase SQL editor (project lpzhphufjwrndfogkfub).
-- READ-ONLY: every statement is a SELECT. Safe to run any time, in any order, as often as needed.
-- Expected results and what to do with them: audits.md (sections A, B, C).
-- Run this file FIRST — audit A decides whether draft-0030-supplier-products-unique.sql can go in.

-- ============================================================
-- A. Duplicate rows in one supplier's catalog
-- ============================================================
-- No UNIQUE constraint exists on supplier_products(supplier_id, product_id, location_id)
-- (only the PK supplier_product_id; 0029 added a NON-unique index on location_id).
-- _build_orderable_items (app/main.py:335-385) does not dedupe: two active rows of the same
-- supplier + product + scope give two cards in one order tab, and the card state is keyed by
-- product_id, so the card breaks.

-- A1. ACTIVE duplicates, same supplier + product + scope (NULL scope = shared row). Expect 0 rows.
SELECT sp.supplier_id, sp.product_id, coalesce(sp.location_id, '(shared)') AS scope,
       count(*) AS n, string_agg(sp.supplier_product_id, ', ' ORDER BY sp.supplier_product_id) AS ids
  FROM supplier_products sp
 WHERE sp.active
 GROUP BY sp.supplier_id, sp.product_id, sp.location_id
HAVING count(*) > 1
 ORDER BY 1, 2, 3;

-- A2. ALL duplicates incl. inactive rows (decides whether the index can be full or must be
--     partial WHERE active). Informational; inactive duplicates are harmless to the app.
SELECT sp.supplier_id, sp.product_id, coalesce(sp.location_id, '(shared)') AS scope,
       count(*) AS n, count(*) FILTER (WHERE sp.active) AS n_active,
       string_agg(sp.supplier_product_id || CASE WHEN sp.active THEN '' ELSE '(off)' END, ', '
                  ORDER BY sp.supplier_product_id) AS ids
  FROM supplier_products sp
 GROUP BY sp.supplier_id, sp.product_id, sp.location_id
HAVING count(*) > 1
 ORDER BY 1, 2, 3;

-- A3. Shared + scoped row of the same supplier/product that both reach one location.
--     For an own_catalog location (FORUM, SUPERSAM, SLONY) only scoped rows apply, so a shared twin
--     is ignored there; for the others a scoped row next to a shared one gives two cards. Expect 0.
SELECT s.location_id, s.supplier_id, s.product_id,
       string_agg(s.supplier_product_id, ', ' ORDER BY s.supplier_product_id) AS ids
  FROM supplier_products s
  JOIN supplier_products t
    ON t.supplier_id = s.supplier_id AND t.product_id = s.product_id
   AND t.location_id IS NULL AND t.active
  JOIN locations l ON l.location_id = s.location_id AND NOT l.own_catalog
 WHERE s.location_id IS NOT NULL AND s.active AND NOT s.is_backup
 GROUP BY 1, 2, 3
 ORDER BY 1, 2, 3;

-- A4. Postgres version (UNIQUE NULLS NOT DISTINCT needs 15+). Expect server_version_num >= 150000.
SHOW server_version_num;

-- ============================================================
-- B. Katowice (SUPERSAM) overstock — Coca-Cola ~56 crates, drink MAX thresholds
-- ============================================================
-- B1. Drink thresholds at SUPERSAM. After B2 (09.10) all 24 rows were 0/0/0 "progi do uzupełnienia".
--     Expect: Coca-Cola rows (P064..P071) still 0/0/0 unless Marek's minimums were entered by hand.
SELECT s.product_id, p.product_name_pl, p.inventory_unit,
       s.min_stock_qty_base AS min, s.target_stock_qty_base AS target, s.max_stock_qty_base AS max,
       left(s.notes, 80) AS notes
  FROM location_product_settings s
  JOIN products p ON p.product_id = s.product_id
 WHERE s.location_id = 'SUPERSAM'
   AND (p.product_category ILIKE '%napo%' OR s.product_id IN
        (SELECT product_id FROM supplier_products WHERE supplier_id = 'SUP_COCACOLA_KAT'))
 ORDER BY s.product_id;

-- B2. Latest SUPERSAM count of those drinks vs MAX, in base units and in purchase units (crates).
--     "over_max" > 0 = overstock. With MAX = 0 every counted unit shows as over_max — read it as
--     "no MAX set", not as a real excess.
WITH last_count AS (
  SELECT count_id, count_date FROM inventory_counts
   WHERE location_id = 'SUPERSAM' AND count_submitted_at IS NOT NULL
   ORDER BY count_date DESC, count_submitted_at DESC LIMIT 1
)
SELECT lc.count_date, cl.product_id, p.product_name_pl,
       cl.current_stock_qty_base AS stock_base,
       sp.purchase_unit, sp.units_per_purchase_unit AS per_unit,
       round(cl.current_stock_qty_base / nullif(sp.units_per_purchase_unit, 0), 1) AS stock_in_purchase_units,
       s.max_stock_qty_base AS max_base,
       greatest(cl.current_stock_qty_base - s.max_stock_qty_base, 0) AS over_max_base
  FROM last_count lc
  JOIN inventory_count_lines cl ON cl.count_id = lc.count_id
  JOIN products p ON p.product_id = cl.product_id
  LEFT JOIN location_product_settings s ON s.location_id = 'SUPERSAM' AND s.product_id = cl.product_id
  LEFT JOIN supplier_products sp ON sp.supplier_id = 'SUP_COCACOLA_KAT' AND sp.product_id = cl.product_id
       AND sp.location_id = 'SUPERSAM' AND sp.active
 WHERE cl.product_id IN (SELECT product_id FROM supplier_products WHERE supplier_id = 'SUP_COCACOLA_KAT')
 ORDER BY cl.product_id;

-- B3. Total crates of Coca-Cola goods at SUPERSAM in the latest count (compare with "~56 skrzynek").
WITH last_count AS (
  SELECT count_id FROM inventory_counts
   WHERE location_id = 'SUPERSAM' AND count_submitted_at IS NOT NULL
   ORDER BY count_date DESC, count_submitted_at DESC LIMIT 1
)
SELECT round(sum(cl.current_stock_qty_base / nullif(sp.units_per_purchase_unit, 0)), 1) AS crates_total
  FROM last_count lc
  JOIN inventory_count_lines cl ON cl.count_id = lc.count_id
  JOIN supplier_products sp ON sp.product_id = cl.product_id AND sp.supplier_id = 'SUP_COCACOLA_KAT'
       AND sp.location_id = 'SUPERSAM' AND sp.active;

-- B4. Where the Katowice cola came from: every SUPERSAM order/receipt line of Coca-Cola goods.
SELECT o.order_id, o.status, o.supplier_id, o.captain_submitted_at::date AS submitted,
       ol.product_id, ol.manager_final_qty_purchase AS mgr_qty, ol.captain_final_qty_purchase AS cpt_qty,
       rl.received_qty_purchase AS received
  FROM orders o
  JOIN order_lines ol ON ol.order_id = o.order_id
  LEFT JOIN receipt_lines rl ON rl.order_line_id = ol.order_line_id
 WHERE o.location_id = 'SUPERSAM'
   AND ol.product_id IN (SELECT product_id FROM supplier_products WHERE supplier_id = 'SUP_COCACOLA_KAT')
 ORDER BY o.captain_submitted_at NULLS LAST, ol.product_id;

-- ============================================================
-- C. Readiness per location (no secrets: tokens are NOT in the database — see audits.md)
-- ============================================================
-- C1. Location row: active, own catalog, e-mail (DW), sender alias, phone present.
SELECT l.location_id, l.active, l.own_catalog,
       coalesce(l.email, '— BRAK —') AS email_dw,
       coalesce(l.sender_email, '(biuro@)') AS sender,
       (l.phone IS NOT NULL AND l.phone <> '') AS has_phone
  FROM locations l ORDER BY l.active DESC, l.location_id;

-- C2. Suppliers reachable per active location + thresholds filled.
--     orderable = settings rows that have an active non-internal catalog row reaching the location;
--     zero_thr  = settings rows with target = 0 (count-only or "progi do uzupełnienia").
WITH reach AS (
  SELECT DISTINCT l.location_id, sp.supplier_id, sp.product_id
    FROM locations l
    JOIN supplier_products sp ON sp.active AND sp.supplier_id <> 'SUP_INTERNAL'
     AND ((l.own_catalog AND sp.location_id = l.location_id)
       OR (NOT l.own_catalog AND (sp.location_id IS NULL OR sp.location_id = l.location_id)))
    JOIN suppliers su ON su.supplier_id = sp.supplier_id AND su.active
   WHERE l.active
)
SELECT s.location_id,
       count(*) AS settings_rows,
       count(*) FILTER (WHERE s.target_stock_qty_base = 0) AS zero_thr,
       count(DISTINCT r.supplier_id) AS suppliers,
       count(DISTINCT r.product_id) AS orderable_products
  FROM location_product_settings s
  JOIN locations l ON l.location_id = s.location_id AND l.active
  LEFT JOIN reach r ON r.location_id = s.location_id AND r.product_id = s.product_id
 GROUP BY s.location_id ORDER BY s.location_id;

-- C3. Activity proves the token works: last count and last submitted order per location.
SELECT l.location_id,
       (SELECT max(count_date) FROM inventory_counts c
         WHERE c.location_id = l.location_id AND c.count_submitted_at IS NOT NULL) AS last_count,
       (SELECT max(captain_submitted_at)::date FROM orders o
         WHERE o.location_id = l.location_id) AS last_submit,
       (SELECT count(*) FROM orders o WHERE o.location_id = l.location_id
           AND o.captain_submitted_at >= now() - interval '14 days') AS orders_14d
  FROM locations l WHERE l.active ORDER BY l.location_id;

-- C4. "email" suppliers without an e-mail (would fail at dispatch). Expect 0 rows.
SELECT supplier_id, supplier_name, ordering_method, email FROM suppliers
 WHERE active AND ordering_method = 'email' AND (email IS NULL OR email = '');
