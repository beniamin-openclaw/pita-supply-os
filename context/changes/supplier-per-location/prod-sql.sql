-- supplier-per-location — Phase 4 (prod master data)
--
-- STATUS 2026-08-20: NOT APPLIED. Prod writes were blocked in the authoring
-- session, so every statement below is ready to run but unrun. Run sections in
-- order: (2) snapshot -> (3) migration -> deploy -> (4) catalog -> (5) pins ->
-- (6) audit. The section (2) snapshot IS the rollback record.
--
-- Per lessons.md "Master-data ops: diff before, audit after".

-- ======================= (1) PRECONDITIONS ==================================
--
-- P1 [VERIFIED 2026-08-20 — returned 0 rows]. No in-flight order may carry the
--    products about to be pinned. `captain_order_edit` re-validates the FULL line
--    set, so a pin landing between a submit and an edit makes that edit 400 on a
--    line the Captain never touched. RE-RUN this immediately before section (5):

SELECT o.order_id, o.status, ol.product_id
  FROM orders o JOIN order_lines ol ON ol.order_id = o.order_id
 WHERE o.location_id = 'WOLA'
   AND o.status IN ('captain_submitted', 'manager_claimed')
   AND ol.product_id IN ('P127', 'P132', 'P133');
-- Must return zero rows. If it does not, dispatch or cancel those orders first.
--
-- P2 [RESOLVED]. Blue Service carries none of P127/P132/P133 today — they exist
--    only as SP_PAGO_*. Section (4) creates the catalog entries, and it MUST run
--    before section (5); pinning first makes the products orderable from no
--    supplier at all at WOLA (the backend logs "Orphaned supplier pin", but they
--    still vanish from the screen).
--
-- P3 [OPEN — operator input]. price_estimate_pln is left NULL on the three new
--    catalog rows. The Blue Service price list was not available and inventing a
--    number would put a fabricated value into order totals. Price feeds only
--    `total_value_estimate_pln`, so NULL degrades an estimate rather than
--    breaking a flow. Fill it in when the first invoice arrives:
--      UPDATE supplier_products SET price_estimate_pln = <x>
--       WHERE supplier_product_id = 'SP_BLUESERV_P127';
--
-- P4 [OPEN — operator input]. WOLA's targets for P132 (Markery) and P133
--    (Długopisy) are 0/0/0 (min/max/target); P127 is 0.5/5/5. With target 0 the
--    products appear on the Blue Service screen and suggest nothing, and the
--    over-MAX gate stays off (it requires max > 0), so the pin is harmless either
--    way. Set real thresholds when you want them to suggest.

-- ======================= (2) BEFORE — run first, record output ==============

SELECT 'settings'                        AS metric, count(*)::text AS value FROM location_product_settings
UNION ALL SELECT 'pinned rows',          count(*)::text FROM location_product_settings WHERE source_supplier_id IS NOT NULL
UNION ALL SELECT 'supplier_products',    count(*)::text FROM supplier_products
UNION ALL SELECT 'blueserv catalog',     count(*)::text FROM supplier_products WHERE supplier_id = 'SUP_BLUESERV'
UNION ALL SELECT 'WOLA x PAGO items',    count(*)::text FROM supplier_products sp
    JOIN location_product_settings l ON l.product_id = sp.product_id AND l.location_id = 'WOLA'
    WHERE sp.supplier_id = 'SUP_PAGO' AND sp.active
UNION ALL SELECT 'WOLA x BLUESERV items', count(*)::text FROM supplier_products sp
    JOIN location_product_settings l ON l.product_id = sp.product_id AND l.location_id = 'WOLA'
    WHERE sp.supplier_id = 'SUP_BLUESERV' AND sp.active;

-- Recorded 2026-08-20, before any of this ran:
--   settings 578 · pinned 0 · supplier_products 154 · blueserv 49
--   WOLA × PAGO 18 · WOLA × BLUESERV 49
-- (the "pinned rows" line errors before section 3 — the column does not exist yet)

-- ======================= (3) SCHEMA — migration 0008 ========================
-- Safe on its own and safe to run before the code deploy: it changes no row, and
-- the old code ignores the column (Pydantic ignores extra fields).

ALTER TABLE location_product_settings
    ADD COLUMN IF NOT EXISTS source_supplier_id text
        REFERENCES suppliers(supplier_id);

COMMENT ON COLUMN location_product_settings.source_supplier_id IS
    'Supplier this location buys this product from. NULL = any active supplier '
    'carrying the product (default, backwards-compatible). Narrows visibility '
    'only; never widens it.';

-- >>> DEPLOY THE CODE HERE (merge PR #26). Sections 4-5 change what Captains
-- >>> see, so they belong after the code that understands the column is live.

-- ======================= (4) Blue Service catalog entries ===================
-- Packaging mirrored from the existing Pago rows (all units_per_purchase_unit
-- = 1, full_only — verified 2026-08-20). Price NULL: see P3.

INSERT INTO supplier_products
    (supplier_product_id, supplier_id, product_id, supplier_product_name,
     purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln,
     active, notes)
VALUES
    ('SP_BLUESERV_P127', 'SUP_BLUESERV', 'P127', 'Zszywki do zszywacza',
     'opak', 1.0, 'full_only', NULL, TRUE,
     'dodane 2026-08-20 (supplier-per-location) - opakowanie odwzorowane z Pago; cena do uzupelnienia z cennika Blue Service'),
    ('SP_BLUESERV_P132', 'SUP_BLUESERV', 'P132', 'Markery',
     'szt', 1.0, 'full_only', NULL, TRUE,
     'dodane 2026-08-20 (supplier-per-location) - opakowanie odwzorowane z Pago; cena do uzupelnienia z cennika Blue Service'),
    ('SP_BLUESERV_P133', 'SUP_BLUESERV', 'P133', 'Długopisy',
     'szt', 1.0, 'full_only', NULL, TRUE,
     'dodane 2026-08-20 (supplier-per-location) - opakowanie odwzorowane z Pago; cena do uzupelnienia z cennika Blue Service')
ON CONFLICT (supplier_product_id) DO NOTHING;
-- expect: INSERT 0 3

-- ======================= (5) Pin WOLA to Blue Service =======================
-- Re-run P1 first. BRACKA / NORBLIN / KEN are deliberately untouched: their rows
-- stay NULL, so they keep seeing these products at Pago with their own thresholds.

UPDATE location_product_settings
   SET source_supplier_id = 'SUP_BLUESERV'
 WHERE location_id = 'WOLA'
   AND product_id IN ('P127', 'P132', 'P133');
-- expect: UPDATE 3

-- ======================= (6) AFTER — audit ==================================
-- Re-run section (2). Expected:
--   pinned rows        0   -> 3
--   supplier_products  154 -> 157
--   blueserv catalog   49  -> 52
--   WOLA × PAGO        18  -> 15   (exactly P127/P132/P133 dropped)
--   WOLA × BLUESERV    49  -> 52
--
-- Effective per-location visibility — every location EXCEPT WOLA must be
-- unchanged from its pre-batch numbers:

SELECT l.location_id, sp.supplier_id, count(*) AS items
  FROM supplier_products sp
  JOIN location_product_settings l ON l.product_id = sp.product_id
 WHERE sp.active
   AND (l.source_supplier_id IS NULL OR l.source_supplier_id = sp.supplier_id)
 GROUP BY 1, 2
 ORDER BY 1, 2;

-- Orphan check — MUST return zero rows after any pinning batch. A row here means
-- a product is orderable from no supplier at that location:

SELECT l.location_id, l.product_id, l.source_supplier_id
  FROM location_product_settings l
 WHERE l.source_supplier_id IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM supplier_products sp
        WHERE sp.product_id = l.product_id
          AND sp.supplier_id = l.source_supplier_id
          AND sp.active
   );

-- ======================= (7) Seed mirror — ALREADY DONE =====================
-- Applied in commit 8721b8f (PR #26): the three Blue Service rows in
-- supplier_products.csv, the source_supplier_id column plus WOLA's three pins in
-- location_product_settings.csv, and the tests that assert all three effects
-- (Pago 18 -> 15, the products appearing at Blue Service, and Bracka/Norblin
-- keeping them at Pago).

-- ======================= (8) ROLLBACK =======================================
-- Data only (leaves the column in place):
--   UPDATE location_product_settings SET source_supplier_id = NULL
--    WHERE location_id = 'WOLA' AND product_id IN ('P127','P132','P133');
--   DELETE FROM supplier_products
--    WHERE supplier_product_id IN ('SP_BLUESERV_P127','SP_BLUESERV_P132','SP_BLUESERV_P133');
--
-- Schema too (only if the whole change is reverted — revert PR #26 first, since
-- the code reads this column):
--   ALTER TABLE location_product_settings DROP COLUMN source_supplier_id;
