-- supplier-per-location — Phase 4 (master data)
--
-- ############################################################################
-- ##  NOT APPLIED. Requires explicit operator consent AND two decisions       ##
-- ##  below. Do not run any part of section (3) before section (2) is run     ##
-- ##  and its output recorded — that snapshot IS the rollback path.           ##
-- ############################################################################
--
-- The schema half (migration 0008) is separate and safe on its own: it adds one
-- nullable column and changes no row. It ships with the code deploy.
--
-- Per lessons.md "Master-data ops: diff before, audit after".

-- ======================= (1) TWO OPEN DECISIONS =============================
--
-- D1. Blue Service does NOT carry P127/P132/P133 today. They exist only as
--     SP_PAGO_P127 / SP_PAGO_P132 / SP_PAGO_P133. Pinning WOLA to SUP_BLUESERV
--     without first creating Blue Service catalog entries makes those products
--     orderable from NO supplier at WOLA. The backend logs "Orphaned supplier
--     pin" in that case, but the products still disappear from the screen.
--     -> Section 3a MUST run before section 3b. Prices and purchase units for
--        the three Blue Service entries are unknown and must come from the
--        operator; the placeholders below are deliberately invalid.
--
-- P1. PRECONDITION (impl-review F1) — no in-flight order may carry the products
--     about to be pinned. `captain_order_edit` re-validates the FULL line set, so
--     a pin landing between a submit and an edit makes that edit 400 on a line the
--     Captain never touched. Run this first; it must return zero rows:
--
--       SELECT o.order_id, o.status, ol.product_id
--         FROM orders o JOIN order_lines ol ON ol.order_id = o.order_id
--        WHERE o.location_id = 'WOLA'
--          AND o.status IN ('captain_submitted', 'manager_claimed')
--          AND ol.product_id IN ('P127', 'P132', 'P133');
--
--     If it returns rows, dispatch or cancel those orders before pinning.
--
-- D2. WOLA's targets for P132 (Markery) and P133 (Długopisy) are 0 today —
--     they suggest nothing at WOLA as things stand. P127 (Zszywki) is target 5.
--     Confirm the pin is still wanted, and whether the targets should change.
--     Thresholds are NOT touched by this batch either way.

-- ======================= (2) BEFORE — run first, record output ==============
-- The rollback path: every pinned row is currently NULL, so undoing this batch
-- is "set source_supplier_id back to NULL for the rows listed in 3b".

SELECT 'settings'          AS metric, count(*)::text AS value FROM location_product_settings
UNION ALL SELECT 'pinned rows (expect 0)', count(*)::text FROM location_product_settings WHERE source_supplier_id IS NOT NULL
UNION ALL SELECT 'supplier_products',      count(*)::text FROM supplier_products
UNION ALL SELECT 'blueserv catalog rows',  count(*)::text FROM supplier_products WHERE supplier_id = 'SUP_BLUESERV'
UNION ALL SELECT 'WOLA x PAGO items',      count(*)::text FROM supplier_products sp
    JOIN location_product_settings l ON l.product_id = sp.product_id AND l.location_id = 'WOLA'
    WHERE sp.supplier_id = 'SUP_PAGO' AND sp.active
UNION ALL SELECT 'WOLA x BLUESERV items',  count(*)::text FROM supplier_products sp
    JOIN location_product_settings l ON l.product_id = sp.product_id AND l.location_id = 'WOLA'
    WHERE sp.supplier_id = 'SUP_BLUESERV' AND sp.active;

-- Recorded 2026-08-20 (pre-batch, code phase only):
--   settings 578 · pinned rows 0 · supplier_products 154 · blueserv 49
--   WOLA × PAGO 18 · WOLA × BLUESERV 49

-- ======================= (3a) Blue Service catalog entries ==================
-- BLOCKED ON D1 — purchase_unit / units_per_purchase_unit / price are unknown.
-- Fill from the Blue Service price list before running. Left commented on purpose.
--
-- INSERT INTO supplier_products
--     (supplier_product_id, supplier_id, product_id, supplier_product_name,
--      purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln,
--      active, notes)
-- VALUES
--     ('SP_BLUESERV_P127', 'SUP_BLUESERV', 'P127', '<name from price list>',
--      '<unit>', 1.0, 'full_only', NULL, TRUE,
--      'added 2026-08-20 (supplier-per-location) - WOLA buys office items here'),
--     ('SP_BLUESERV_P132', 'SUP_BLUESERV', 'P132', '<name from price list>',
--      '<unit>', 1.0, 'full_only', NULL, TRUE,
--      'added 2026-08-20 (supplier-per-location)'),
--     ('SP_BLUESERV_P133', 'SUP_BLUESERV', 'P133', '<name from price list>',
--      '<unit>', 1.0, 'full_only', NULL, TRUE,
--      'added 2026-08-20 (supplier-per-location)')
-- ON CONFLICT (supplier_product_id) DO NOTHING;

-- ======================= (3b) Pin WOLA to Blue Service ======================
-- BLOCKED ON 3a. Running this first makes the three products vanish at WOLA.
-- BRACKA / NORBLIN / KEN are deliberately untouched: their rows stay NULL, so
-- they keep seeing these products at Pago with their existing thresholds.
--
-- UPDATE location_product_settings
--    SET source_supplier_id = 'SUP_BLUESERV'
--  WHERE location_id = 'WOLA'
--    AND product_id IN ('P127', 'P132', 'P133');
-- -- expect: UPDATE 3

-- ======================= (4) AFTER — audit ==================================
-- Re-run section (2). Expected deltas:
--   pinned rows        0  -> 3
--   supplier_products  154 -> 157
--   blueserv catalog   49  -> 52
--   WOLA × PAGO        18  -> 15   (exactly P127/P132/P133 dropped)
--   WOLA × BLUESERV    49  -> 52
-- Every other location's counts MUST be unchanged:

SELECT l.location_id, sp.supplier_id, count(*) AS items
  FROM supplier_products sp
  JOIN location_product_settings l ON l.product_id = sp.product_id
 WHERE sp.active
   AND (l.source_supplier_id IS NULL OR l.source_supplier_id = sp.supplier_id)
 GROUP BY 1, 2
 ORDER BY 1, 2;

-- Orphan check — must return zero rows after any pinning batch:
SELECT l.location_id, l.product_id, l.source_supplier_id
  FROM location_product_settings l
 WHERE l.source_supplier_id IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM supplier_products sp
        WHERE sp.product_id = l.product_id
          AND sp.supplier_id = l.source_supplier_id
          AND sp.active
   );

-- ======================= (5) Seed mirror ====================================
-- Apply the same three pins to
-- docs/pita-supply-os-v1/seed/location_product_settings.csv (new column
-- source_supplier_id) plus the three Blue Service rows in supplier_products.csv,
-- in the SAME batch, so the mirror does not drift. Then
-- test_captain_orderable_wola_pago_returns_18_items -> 15, dropping exactly
-- P127/P132/P133.

-- ======================= (6) ROLLBACK =======================================
-- UPDATE location_product_settings SET source_supplier_id = NULL
--  WHERE location_id = 'WOLA' AND product_id IN ('P127','P132','P133');
-- DELETE FROM supplier_products
--  WHERE supplier_product_id IN ('SP_BLUESERV_P127','SP_BLUESERV_P132','SP_BLUESERV_P133');
-- Schema rollback (only if the whole change is reverted):
-- ALTER TABLE location_product_settings DROP COLUMN source_supplier_id;
