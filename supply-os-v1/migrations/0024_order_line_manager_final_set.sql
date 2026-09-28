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
-- Backfill: true only where manager_final is positive. Under both rules such
-- a line reads at manager_final, so the backfill never changes an existing
-- line's effective quantity. A line with manager_final 0 keeps the flag off
-- and keeps reading at the Captain's quantity, exactly as before; the flag
-- only starts to matter for zeros the Manager saves after this deploy. The
-- statement is re-runnable at any time (it only ever marks positive values).
--
-- Numbered 0024 (confirmed across lanes on 2026-09-28: 0023 display order,
-- 0025 delivery calendar, 0026 order e-mail v2). Keep this file free of the
-- percent sign (integration fixture applies it via psycopg2 exec_driver_sql).
-- Apply on prod BEFORE the backend that reads it: _ORDER_LINE_COLUMNS lists
-- it, so without the column every order_lines INSERT (captain submit, captain
-- edit, Manager add-line, Transport add-location) and every Manager save /
-- dispatch UPDATE fails.
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
