-- ============================================================
-- order-line-zero-qty — prod companion for migration 0024
-- (order_lines.manager_final_set)
--
-- Operator runs this on prod Supabase BEFORE merging the PR: the new backend
-- binds the column on every order_lines INSERT (captain submit / edit, add-line,
-- add-location) and every Manager save / dispatch UPDATE. Nothing here touches
-- supplier e-mail or dispatch. House style: diff before / apply / audit after.
--
-- Section A  read-only pre-check   — save the output, it is the diff.
-- Section B  the only write        — identical to migrations/0024;
--            re-runnable, it only ever marks positive manager_final.
-- Section C  read-only audit       — must match A.
--
-- Rollback (revert the code first, then):
--   ALTER TABLE order_lines DROP COLUMN IF EXISTS manager_final_set;
-- ============================================================


-- ---------- A. PRE-CHECK (read-only) ----------

-- A1. Column must not exist yet (0 rows expected).
SELECT column_name
  FROM information_schema.columns
 WHERE table_name = 'order_lines' AND column_name = 'manager_final_set';

-- A2. Lines the backfill will flag (positive manager_final only). Save it.
SELECT count(*) AS expected_flagged
  FROM order_lines
 WHERE manager_final_qty_purchase > 0;

-- A3. Informational: dispatched non-transport lines with manager_final 0 and
-- captain_final above 0. The backfill leaves them unflagged, so they keep
-- reading at the Captain quantity exactly as before (0 rows on 2026-09-28).
SELECT l.order_id, l.order_line_id, l.product_id,
       l.captain_final_qty_purchase, l.manager_final_qty_purchase,
       o.status, o.sent_method, o.supplier_order_reference
  FROM order_lines AS l
  JOIN orders AS o ON o.order_id = l.order_id
 WHERE l.manager_final_qty_purchase = 0
   AND l.captain_final_qty_purchase > 0
   AND o.status IN ('manager_sent', 'closed')
   AND coalesce(o.sent_method, '') <> 'transport'
   AND left(coalesce(o.supplier_order_reference, ''), 4) <> 'TRN-';

-- A4. Open orders (claimed) with a zero manager_final: after 0024 these keep
-- showing the Captain quantity (flag stays false). Informational.
SELECT o.status, count(*) AS lines
  FROM order_lines AS l
  JOIN orders AS o ON o.order_id = l.order_id
 WHERE l.manager_final_qty_purchase = 0
   AND o.status IN ('captain_submitted', 'manager_claimed')
 GROUP BY o.status;


-- ---------- B. APPLY (the only write; same statements as migration 0024) ----------

BEGIN;

ALTER TABLE order_lines
    ADD COLUMN IF NOT EXISTS manager_final_set boolean NOT NULL DEFAULT false;

UPDATE order_lines
   SET manager_final_set = true
 WHERE manager_final_set = false
   AND manager_final_qty_purchase > 0;

-- Run section C inside this transaction, then COMMIT (or ROLLBACK if C disagrees with A).
-- COMMIT;


-- ---------- C. AUDIT (read-only) ----------

-- C1. Column exists, boolean, NOT NULL, default false.
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'order_lines' AND column_name = 'manager_final_set';

-- C2. Flagged total must equal A2 expected_flagged.
SELECT count(*) AS flagged FROM order_lines WHERE manager_final_set;

-- C3. No flagged line has a zero manager_final (0 expected): the backfill
-- never changes an existing line's effective quantity.
SELECT count(*) AS zero_flagged
  FROM order_lines
 WHERE manager_final_set AND manager_final_qty_purchase <= 0;
