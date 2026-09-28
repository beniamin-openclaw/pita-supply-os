-- ============================================================
-- Pita Supply OS — migration 0024: order_lines.manager_final_set
-- (order-line-zero-qty)
--
-- ADDITIVE ONLY. No existing column changes value.
--
-- manager_final_qty_purchase is NOT NULL DEFAULT 0, so a stored 0 meant both
-- "the Manager has not set this line" and "the Manager set it to 0". Every
-- reader took the first meaning and fell back to captain_final, so a line the
-- Manager zeroed came back at the Captain's quantity after the next reload —
-- and into the supplier e-mail on dispatch. This flag records that the
-- Manager committed a quantity for the line (including 0). The effective
-- quantity rule (app/order_qty.py, frontend/src/lib/orderQty.ts) is:
--   set = manager_final_set OR manager_final_qty_purchase > 0
--   effective = manager_final if set, else captain_final
-- so every row the backfill leaves false behaves exactly as before.
--
-- Backfill: true where the Manager demonstrably committed a value — a
-- positive manager_final, or any line of an order dispatched outside
-- Transport (the Manager dispatch writes every line). Transport finalize
-- writes no line, so untouched lines of transport-sent orders stay false
-- (they shipped at the Captain's quantity). On 2026-09-28 no dispatched
-- non-transport line had manager_final 0 with captain_final above 0.
--
-- Numbered 0024 (confirmed across lanes on 2026-09-28: 0023 display order,
-- 0025 delivery calendar, 0026 order e-mail v2). Keep this file free of the
-- percent sign (integration fixture applies it via psycopg2 exec_driver_sql).
-- Apply on prod BEFORE the backend that reads it (_ORDER_LINE_COLUMNS lists
-- it, so every order_lines INSERT binds the column).
-- Applied on prod: not yet.
--
-- Rollback (revert the code first):
--   ALTER TABLE order_lines DROP COLUMN IF EXISTS manager_final_set;
-- ============================================================

ALTER TABLE order_lines
    ADD COLUMN IF NOT EXISTS manager_final_set boolean NOT NULL DEFAULT false;

UPDATE order_lines
   SET manager_final_set = true
 WHERE manager_final_set = false
   AND manager_final_qty_purchase > 0;

UPDATE order_lines AS l
   SET manager_final_set = true
  FROM orders AS o
 WHERE l.order_id = o.order_id
   AND l.manager_final_set = false
   AND o.status IN ('manager_sent', 'closed')
   AND coalesce(o.sent_method, '') <> 'transport'
   AND left(coalesce(o.supplier_order_reference, ''), 4) <> 'TRN-';
