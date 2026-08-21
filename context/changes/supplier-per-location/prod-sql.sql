-- supplier-per-location — prod master data
--
-- STATUS 2026-08-20: NOT APPLIED. Prod writes were blocked in the authoring
-- session, so everything below is ready to run but unrun.
--
-- SCOPE CHANGED 2026-08-20, after checking Wolska's own inventory sheet:
-- the office-supply pin this lane was built around is NOT happening yet, and
-- what remains here is (a) the schema column and (b) a threshold correction the
-- operator asked for. See section (1).
--
-- Per lessons.md "Master-data ops: diff before, audit after".

-- ======================= (1) WHY THE PIN IS NOT HERE ========================
--
-- The lane's problem statement said Wolska buys staples (P127), markers (P132)
-- and pens (P133) from Blue Service. Three checks contradicted that:
--
--   * Wolska's inventory sheet ("Wolska - Inwentaryzacja", Drive, modified
--     2026-08-16) lists all seven Biurowe products under PAGO in every dated
--     snapshot, with prices matching the database exactly (0,70 / 6,00 / 1,20).
--   * The same sheet shows Wolska holding real stock of them (Zszywki 2,5 opak,
--     Markery 10 szt, Długopisy 10 szt), so they are actively used.
--   * No Blue Service price exists for them anywhere — because Wolska does not
--     buy them there. The missing price was information, not a gap to fill.
--
-- The operator then confirmed (2026-08-20): these come from **Selgros or
-- Allegro**, and is not certain which — it will be checked with the location.
-- NEITHER supplier exists in `suppliers` today. So the pin is deferred: it needs
-- a supplier row and a catalog row before any pin can point at it, or the
-- products become orderable from nobody at Wolska.
--
-- An earlier draft of this file pinned them to Blue Service and moved
-- WOLA × Pago from 18 items to 15. That was reverted before anything ran; seed
-- and prod are both unpinned, and the test asserts 18 again.
--
-- The real supplier-per-location candidates at Wolska, found in the same sheet
-- and NOT yet acted on (they need the same missing-supplier decision):
--     P088 Opakowanie Frytki  — sheet: Selgros   | db: Blue Service
--     P102 Słomki 250szt      — sheet: Selgros   | db: Blue Service
--     P095 Folia Aluminiowa   — sheet: Intermlecz| db: Blue Service
--     P096 Folia spożywcza    — sheet: Intermlecz| db: Blue Service
--     P097 Papier Pergamin    — sheet: Intermlecz| db: Blue Service

-- ======================= (2) BEFORE — run first, record output ==============

SELECT 'settings'                         AS metric, count(*)::text AS value FROM location_product_settings
UNION ALL SELECT 'pinned rows',           count(*)::text FROM location_product_settings WHERE source_supplier_id IS NOT NULL
UNION ALL SELECT 'supplier_products',     count(*)::text FROM supplier_products
UNION ALL SELECT 'WOLA x PAGO items',     count(*)::text FROM supplier_products sp
    JOIN location_product_settings l ON l.product_id = sp.product_id AND l.location_id = 'WOLA'
    WHERE sp.supplier_id = 'SUP_PAGO' AND sp.active;

SELECT location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base
  FROM location_product_settings
 WHERE location_id = 'WOLA' AND product_id IN ('P132','P133');

-- Recorded 2026-08-20, before any of this ran (read by query, not eyeballed):
--   settings 578 · supplier_products 154 · WOLA × PAGO 18
--   WOLA P132: 0 / 0 / 0     WOLA P133: 0 / 0 / 0
--   ("pinned rows" errors before section 3 — the column does not exist yet)

-- ======================= (3) SCHEMA — migration 0008 ========================
-- Additive and nullable: changes no row, and safe in either deploy order —
-- old code ignores an extra column, new code falls back to the default when the
-- column is absent (both verified).

ALTER TABLE location_product_settings
    ADD COLUMN IF NOT EXISTS source_supplier_id text
        REFERENCES suppliers(supplier_id);

COMMENT ON COLUMN location_product_settings.source_supplier_id IS
    'Supplier this location buys this product from. NULL = any active supplier '
    'carrying the product (default, backwards-compatible). Narrows visibility '
    'only; never widens it.';

-- With no rows pinned, the deployed feature is a no-op until master data opts in.
-- That is the intended state while the Selgros/Allegro question is open.

-- ======================= (4) WOLA threshold correction ======================
-- Operator instruction 2026-08-20: markers min 3 max 10, pens min 5 max 20.
-- Both sat at 0/0/0 despite the sheet showing 10 szt of each on hand, so they
-- suggested nothing. target = max follows the Bracka/Norblin convention for
-- these SKUs (both are 1/3/3) — CHANGE IT if target should differ from max.
-- Unrelated to the supplier dimension; included because it was asked for in the
-- same pass and touches the same table.

UPDATE location_product_settings
   SET min_stock_qty_base = 3, max_stock_qty_base = 10, target_stock_qty_base = 10,
       notes = 'operator 2026-08-20: min 3 max 10 (target=max per Bracka/Norblin convention)'
 WHERE location_id = 'WOLA' AND product_id = 'P132';
-- expect: UPDATE 1

UPDATE location_product_settings
   SET min_stock_qty_base = 5, max_stock_qty_base = 20, target_stock_qty_base = 20,
       notes = 'operator 2026-08-20: min 5 max 20 (target=max per Bracka/Norblin convention)'
 WHERE location_id = 'WOLA' AND product_id = 'P133';
-- expect: UPDATE 1

-- NOT DONE: KEN carries identical 0/0/0 values for both, because KEN is still on
-- a copy of Wolska's data. Deliberately left alone — no instruction was given for
-- KEN, and it deserves its own threshold pass rather than an inherited guess.

-- ======================= (5) AFTER — audit ==================================
-- Re-run section (2). Expected:
--   settings           578 (unchanged — this batch updates, never inserts)
--   pinned rows        0   (unchanged — no pin in this batch)
--   supplier_products  154 (unchanged)
--   WOLA × PAGO        18  (UNCHANGED — the office items stay at Pago)
--   WOLA P132: 3 / 10 / 10     WOLA P133: 5 / 20 / 20
--
-- Orphan check — must return zero rows after ANY future pinning batch. A row
-- here means a product is orderable from no supplier at that location:

SELECT l.location_id, l.product_id, l.source_supplier_id
  FROM location_product_settings l
 WHERE l.source_supplier_id IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM supplier_products sp
        WHERE sp.product_id = l.product_id
          AND sp.supplier_id = l.source_supplier_id
          AND sp.active
   );

-- ======================= (6) Seed mirror — ALREADY DONE =====================
-- The seed CSVs carry the same two threshold values and no pins, matching what
-- this batch produces.

-- ======================= (7) ROLLBACK =======================================
--   UPDATE location_product_settings SET min_stock_qty_base=0, max_stock_qty_base=0,
--          target_stock_qty_base=0, notes=''
--    WHERE location_id='WOLA' AND product_id IN ('P132','P133');
--
-- Schema (only if the whole change is reverted — revert the code first, since it
-- reads this column):
--   ALTER TABLE location_product_settings DROP COLUMN source_supplier_id;

-- ======================= (8) BLOCKED ON THE OPERATOR ========================
-- Before any pin can be applied at Wolska:
--   1. Selgros or Allegro? (operator is checking with the location)
--   2. Add that supplier to `suppliers` — name, email, ordering_method.
--      Allegro in particular is a marketplace, not an email supplier; it likely
--      needs ordering_method 'portal' or 'manual', which changes how dispatch
--      behaves for it.
--   3. Add catalog rows for whichever products move, THEN pin. Never the reverse.
