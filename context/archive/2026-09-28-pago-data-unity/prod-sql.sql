-- =====================================================================
-- pago-data-unity — one-time cleanup of Pago orders in prod Supabase
-- Project: lpzhphufjwrndfogkfub
--
-- PREPARED 2026-09-28, NOT RUN. Approved in direction by the operator
-- (28.09, via the coordinator session). Run only after the operator has
-- read cleanup-diff.md and gives an explicit go.
--
-- Lessons.md "Master-data ops: diff before, audit after":
--   STEP 0  read-only SELECT; save the output to cleanup-diff-before.md
--           (that file is the rollback source)
--   STEP 1  one transaction; every statement is guarded and checks its
--           row count, so any surprise rolls everything back
--   STEP 2  read-only audit; every row must show ok = true
--   STEP R  rollback (commented out), only if STEP 2 fails after COMMIT
--
-- Run the steps as three SEPARATE executions (Supabase SQL editor or psql),
-- and do not start STEP 1 unless STEP 0 matches cleanup-diff.md.
--
-- Tested 2026-09-28 on a throwaway local Postgres 16 with the repo
-- migrations and a copy of these rows (not on prod):
--   - STEP 1 + STEP 2: 13/13 checks ok = true;
--   - a second STEP 1 fails at A1 and rolls back with no change;
--   - STEP R restores a state identical to the STEP 0 snapshot;
--   - re-applying after STEP R works.
--
-- Scope (see proposal.md (a) and cleanup-diff.md):
--   A  cancel 2 abandoned draft transports and their 8 manager-created
--      orders
--   B  close 5 historical manager_claimed Pago orders as ordered (sheet
--      ODB); KEN 07.09 Pita 1 -> 2; comment on BRA 07.09 Bifteki
--   C  fix ORD-20260914-BRA-PAGO-dbb70d to the revised 16.09 sheet
--      version (G15 8, Pita 8, SK 12, + Gyros 25 KG 1)
-- Out of scope on purpose:
--   - ORD-20260921-WOL-MORY-0cdb48 (Mory): waits for Marek's answer on
--     "Tacki bez logo" = "Box beżowy bez logo"; close it in the app
--     afterwards ("Oznacz jako zamówione ✓", SUP_MORY is manual)
--   - past weeks: no backfill
--   - biuro@ drafts: the operator deletes them by hand
--   - no e-mail is sent by anything below; only status/quantity rows change
-- =====================================================================


-- =====================================================================
-- STEP 0 — DIFF BEFORE (read-only). Save all four result sets to
-- context/changes/pago-data-unity/cleanup-diff-before.md
-- =====================================================================

-- 0.1 orders
SELECT order_id, location_id, supplier_id, status, captain_user, manager_user,
       manager_sent_at, sent_method, supplier_order_reference,
       total_value_estimate_pln, last_edited_at,
       cancelled_at, cancelled_by, cancel_reason
  FROM orders
 WHERE order_id IN (
   -- A
   'ORD-20260902-BRA-PAGO-3a9bea', 'ORD-20260902-BRO-PAGO-a1fbe8', 'ORD-20260902-ELE-PAGO-c11e06',
   'ORD-20260925-BRO-PAGO-810239', 'ORD-20260925-ELE-PAGO-a141d9', 'ORD-20260925-KEN-PAGO-a3b234',
   'ORD-20260925-NOR-PAGO-6702dd', 'ORD-20260925-WES-PAGO-f3732e',
   -- B
   'ORD-20260904-KEN-PAGO-626d49', 'ORD-20260907-KEN-PAGO-63620f', 'ORD-20260907-BRA-PAGO-ffdb4f',
   'ORD-20260914-KEN-PAGO-9ec6c9', 'ORD-20260914-WOL-PAGO-61280b',
   -- C
   'ORD-20260914-BRA-PAGO-dbb70d',
   -- untouched control
   'ORD-20260921-WOL-MORY-0cdb48')
 ORDER BY order_id;

-- 0.2 order lines of B + C (A lines are not changed)
SELECT ol.order_id, ol.order_line_id, ol.product_id, p.product_name_pl,
       ol.captain_final_qty_purchase, ol.manager_final_qty_purchase,
       ol.manager_final_qty_base, ol.manager_comment
  FROM order_lines ol
  JOIN products p ON p.product_id = ol.product_id
 WHERE ol.order_id IN (
   'ORD-20260904-KEN-PAGO-626d49', 'ORD-20260907-KEN-PAGO-63620f', 'ORD-20260907-BRA-PAGO-ffdb4f',
   'ORD-20260914-KEN-PAGO-9ec6c9', 'ORD-20260914-WOL-PAGO-61280b', 'ORD-20260914-BRA-PAGO-dbb70d')
 ORDER BY ol.order_id, ol.order_line_id;

-- 0.3 transport headers
SELECT transport_id, supplier_id, status, created_at, sent_at
  FROM transport_batches
 WHERE transport_id IN ('TRN-20260902-PAGO-aa283f', 'TRN-20260925-PAGO-2d5342');

-- 0.4 preconditions — expected: receipts 0, ids_taken 0, lps_bracka_p025 1
SELECT 'receipts_on_B_C' AS k, count(*) AS v FROM receipts
 WHERE order_id IN ('ORD-20260904-KEN-PAGO-626d49', 'ORD-20260907-KEN-PAGO-63620f',
                    'ORD-20260907-BRA-PAGO-ffdb4f', 'ORD-20260914-KEN-PAGO-9ec6c9',
                    'ORD-20260914-WOL-PAGO-61280b', 'ORD-20260914-BRA-PAGO-dbb70d')
UNION ALL
SELECT 'ids_taken', count(*) FROM (
  SELECT event_id FROM transport_events WHERE event_id IN ('TEV-6c5af516', 'TEV-2aeffb78')
  UNION ALL
  SELECT event_id FROM order_events WHERE event_id IN ('OEV-a0c129b7', 'OEV-e205fdcf', 'OEV-11df8f69',
                                                       'OEV-51cdbf07', 'OEV-2792f0e2', 'OEV-48b3d281',
                                                       'OEV-85ee7c03')
  UNION ALL
  SELECT order_line_id FROM order_lines WHERE order_line_id = 'OL-ORD-20260914-BRA-PAGO-dbb70d-M-0b3ab1'
) x
UNION ALL
SELECT 'lps_bracka_p025', count(*) FROM location_product_settings
 WHERE location_id = 'BRACKA' AND product_id = 'P025';


-- =====================================================================
-- STEP 1 — APPLY (one transaction; all or nothing)
-- =====================================================================

BEGIN;

DO $$
DECLARE
  n integer;
BEGIN
  -- ---------- preconditions ----------
  SELECT count(*) INTO n FROM receipts
   WHERE order_id IN ('ORD-20260904-KEN-PAGO-626d49', 'ORD-20260907-KEN-PAGO-63620f',
                      'ORD-20260907-BRA-PAGO-ffdb4f', 'ORD-20260914-KEN-PAGO-9ec6c9',
                      'ORD-20260914-WOL-PAGO-61280b', 'ORD-20260914-BRA-PAGO-dbb70d');
  IF n <> 0 THEN RAISE EXCEPTION 'pre: % receipt(s) exist on B/C orders — stop and re-check', n; END IF;

  -- ---------- A. cancel the two abandoned draft transports ----------
  -- All 8 members are manager-created (captain_user = 'manager-default').
  -- End state mirrors the 01.09 cleanup of earlier abandoned drafts:
  -- order cancelled with a trace, marker cleared, header 'cancelled', one
  -- batch_cancelled event. Done in SQL rather than "Anuluj" on the
  -- Transport screen because that route first RELEASES these orders to
  -- captain_submitted (they have lines), where they would show up in the
  -- BRA/BRO/KEN/NOR captains' lists until cancelled one by one.
  UPDATE orders
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = 'manager-default',
         cancel_reason = CASE supplier_order_reference
           WHEN 'TRN-20260902-PAGO-aa283f' THEN
             'porzucony draft transportu Pago TRN-20260902-PAGO-aa283f (próba 02.09, nie zamówiono) — anulowane 28.09 (pago-data-unity)'
           WHEN 'TRN-20260925-PAGO-2d5342' THEN
             'porzucony draft transportu Pago TRN-20260925-PAGO-2d5342 (25.09; odbiór 26.09 zamówiony z arkusza) — anulowane 28.09 (pago-data-unity)'
         END,
         supplier_order_reference = NULL
   WHERE order_id IN ('ORD-20260902-BRA-PAGO-3a9bea', 'ORD-20260902-BRO-PAGO-a1fbe8',
                      'ORD-20260902-ELE-PAGO-c11e06', 'ORD-20260925-BRO-PAGO-810239',
                      'ORD-20260925-ELE-PAGO-a141d9', 'ORD-20260925-KEN-PAGO-a3b234',
                      'ORD-20260925-NOR-PAGO-6702dd', 'ORD-20260925-WES-PAGO-f3732e')
     AND supplier_order_reference IN ('TRN-20260902-PAGO-aa283f', 'TRN-20260925-PAGO-2d5342')
     AND status = 'manager_claimed'
     AND captain_user = 'manager-default'
     AND supplier_id = 'SUP_PAGO';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 8 THEN RAISE EXCEPTION 'A1: expected 8 orders cancelled, got %', n; END IF;

  SELECT count(*) INTO n FROM orders
   WHERE supplier_order_reference IN ('TRN-20260902-PAGO-aa283f', 'TRN-20260925-PAGO-2d5342');
  IF n <> 0 THEN RAISE EXCEPTION 'A1: % other order(s) still carry the markers — stop', n; END IF;

  UPDATE transport_batches
     SET status = 'cancelled'
   WHERE transport_id IN ('TRN-20260902-PAGO-aa283f', 'TRN-20260925-PAGO-2d5342')
     AND status = 'draft'
     AND supplier_id = 'SUP_PAGO';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'A2: expected 2 headers cancelled, got %', n; END IF;

  INSERT INTO transport_events (event_id, transport_id, order_id, event_type, actor, at, details)
  VALUES
    ('TEV-6c5af516', 'TRN-20260902-PAGO-aa283f', NULL, 'batch_cancelled', 'manager-default', now(),
     'porzucony draft — 3 zamówienia anulowane (pago-data-unity 28.09)'),
    ('TEV-2aeffb78', 'TRN-20260925-PAGO-2d5342', NULL, 'batch_cancelled', 'manager-default', now(),
     'porzucony draft — 5 zamówień anulowanych (pago-data-unity 28.09)');

  -- ---------- B. close 5 historical Pago orders as ordered ----------
  -- sent_method 'transport' on purpose: it is what Transport finalize writes
  -- for Pago, and the only value for which the captain's order view reads
  -- the untouched manager-0 lines as "unchanged" (OrderDetailPage
  -- managerChangedLine). manager_sent_at = the ODB document time from the
  -- sheet (Europe/Warsaw, CEST = +02).
  UPDATE orders o
     SET status = 'manager_sent',
         sent_method = 'transport',
         manager_user = 'manager-default',
         manager_sent_at = v.sent_at
    FROM (VALUES
      ('ORD-20260904-KEN-PAGO-626d49', '2026-09-04 12:42:19+02'::timestamptz),
      ('ORD-20260907-KEN-PAGO-63620f', '2026-09-07 11:39:09+02'::timestamptz),
      ('ORD-20260907-BRA-PAGO-ffdb4f', '2026-09-08 11:45:17+02'::timestamptz),
      ('ORD-20260914-KEN-PAGO-9ec6c9', '2026-09-14 14:32:59+02'::timestamptz),
      ('ORD-20260914-WOL-PAGO-61280b', '2026-09-15 13:07:44+02'::timestamptz)
    ) AS v(order_id, sent_at)
   WHERE o.order_id = v.order_id
     AND o.status = 'manager_claimed'
     AND o.supplier_id = 'SUP_PAGO'
     AND o.supplier_order_reference IS NULL
     AND o.manager_sent_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 5 THEN RAISE EXCEPTION 'B1: expected 5 orders closed as ordered, got %', n; END IF;

  -- KEN 07.09 (pickup 08.09): sheet had Pita 2, app has 1. 12 szt per karton.
  UPDATE order_lines
     SET manager_final_qty_purchase = 2,
         manager_final_qty_base = 24
   WHERE order_line_id = 'OL-ORD-20260907-KEN-PAGO-63620f-002'
     AND order_id = 'ORD-20260907-KEN-PAGO-63620f'
     AND product_id = 'P026'
     AND captain_final_qty_purchase = 1
     AND manager_final_qty_purchase = 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'B2: KEN 07.09 Pita line not in expected state (% rows)', n; END IF;

  -- total = 1x378 + 2x94 + 1x157
  UPDATE orders
     SET total_value_estimate_pln = 723.00
   WHERE order_id = 'ORD-20260907-KEN-PAGO-63620f'
     AND total_value_estimate_pln = 629.00;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'B2: KEN 07.09 total not 629.00 before update (% rows)', n; END IF;

  -- BRA 07.09 (pickup 09.09): no Bifteki on the sheet. A manager 0 would fall
  -- back to the captain's 2, so the line keeps 2/1 and gets a comment.
  UPDATE order_lines
     SET manager_comment = 'nie było w zamówieniu z 09.09 (arkusz Ordering)'
   WHERE order_line_id = 'OL-ORD-20260907-BRA-PAGO-ffdb4f-005'
     AND order_id = 'ORD-20260907-BRA-PAGO-ffdb4f'
     AND product_id = 'P145'
     AND manager_comment = '';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'B3: BRA 07.09 Bifteki line not in expected state (% rows)', n; END IF;

  -- One history row per order; the Manager detail shows it under "Historia zmian".
  INSERT INTO order_events (event_id, order_id, event_type, actor, at, details)
  VALUES
    ('OEV-a0c129b7', 'ORD-20260904-KEN-PAGO-626d49', 'reconciled_from_sheet', 'manager-default', now(),
     'Zamówione z arkusza Ordering PB v5: ODB-WAW-2026-09-05-20260904-124219 (odbiór 05.09). Status uzupełniony 28.09 (pago-data-unity).'),
    ('OEV-e205fdcf', 'ORD-20260907-KEN-PAGO-63620f', 'reconciled_from_sheet', 'manager-default', now(),
     'Zamówione z arkusza Ordering PB v5: ODB-WAW-2026-09-08-20260907-113909 (odbiór 08.09). Pita (opakowania) szt 10: 1 → 2 wg arkusza. Status uzupełniony 28.09 (pago-data-unity).'),
    ('OEV-11df8f69', 'ORD-20260907-BRA-PAGO-ffdb4f', 'reconciled_from_sheet', 'manager-default', now(),
     'Zamówione z arkusza Ordering PB v5: ODB-WAW-2026-09-09-20260908-114517 (odbiór 09.09). Bifteki burgers nie było w arkuszu (komentarz na linii). Status uzupełniony 28.09 (pago-data-unity).'),
    ('OEV-51cdbf07', 'ORD-20260914-KEN-PAGO-9ec6c9', 'reconciled_from_sheet', 'manager-default', now(),
     'Zamówione z arkusza Ordering PB v5: ODB-WAW-2026-09-15-20260914-143259 (odbiór 15.09). Status uzupełniony 28.09 (pago-data-unity).'),
    ('OEV-2792f0e2', 'ORD-20260914-WOL-PAGO-61280b', 'reconciled_from_sheet', 'manager-default', now(),
     'Zamówione z arkusza Ordering PB v5: ODB-WAW-2026-09-16-20260915-130744 (odbiór 16.09). Status uzupełniony 28.09 (pago-data-unity).');

  -- ---------- C. BRA 14.09 -> revised 16.09 sheet version ----------
  -- Mirrors the app's post-send edit: order row first (guarded on status),
  -- then lines, then the history rows. Nothing is sent.
  UPDATE orders
     SET total_value_estimate_pln = 6457.48,   -- 8x378 + 8x94 + 12x145 + 2x157 + 1x627.48 (Bifteki has no price)
         last_edited_at = now()
   WHERE order_id = 'ORD-20260914-BRA-PAGO-dbb70d'
     AND status = 'manager_sent'
     AND supplier_order_reference IS NULL
     AND total_value_estimate_pln = 3879.00;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'C1: BRA 14.09 order not in expected state (% rows)', n; END IF;

  UPDATE order_lines ol
     SET manager_final_qty_purchase = v.new_qty,
         manager_final_qty_base = v.new_base
    FROM (VALUES
      ('OL-ORD-20260914-BRA-PAGO-dbb70d-001', 'P024', 6::numeric, 8::numeric, 120::numeric),  -- Gyros 15 KG, 15 kg/blok
      ('OL-ORD-20260914-BRA-PAGO-dbb70d-002', 'P026', 3::numeric, 8::numeric,  96::numeric),  -- Pita, 12 szt/karton
      ('OL-ORD-20260914-BRA-PAGO-dbb70d-003', 'P027', 7::numeric, 12::numeric, 60::numeric)   -- Souvlaki Kurczak, 5/karton
    ) AS v(order_line_id, product_id, old_qty, new_qty, new_base)
   WHERE ol.order_line_id = v.order_line_id
     AND ol.order_id = 'ORD-20260914-BRA-PAGO-dbb70d'
     AND ol.product_id = v.product_id
     AND ol.manager_final_qty_purchase = v.old_qty;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'C2: expected 3 BRA 14.09 lines updated, got %', n; END IF;

  -- Gyros 25 KG = 1 blok (25 kg), shaped like the app's add-line skeleton
  -- (captain 0, suggestion 0, target from the location setting).
  INSERT INTO order_lines (order_line_id, order_id, product_id, supplier_product_id,
                           current_stock_qty_base, target_stock_qty_base,
                           suggested_qty_base, suggested_qty_purchase,
                           captain_final_qty_purchase, captain_final_qty_base,
                           manager_final_qty_purchase, manager_final_qty_base,
                           delta_vs_suggestion_pct, reason_code, captain_comment, manager_comment)
  SELECT 'OL-ORD-20260914-BRA-PAGO-dbb70d-M-0b3ab1', 'ORD-20260914-BRA-PAGO-dbb70d', 'P025', 'SP_PAGO_P025',
         0, lps.target_stock_qty_base,
         0, 0,
         0, 0,
         1, 25,
         NULL, NULL, '', ''
    FROM location_product_settings lps
   WHERE lps.location_id = 'BRACKA' AND lps.product_id = 'P025'
     AND NOT EXISTS (SELECT 1 FROM order_lines
                      WHERE order_id = 'ORD-20260914-BRA-PAGO-dbb70d' AND product_id = 'P025');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'C3: expected 1 Gyros 25 KG line inserted, got %', n; END IF;

  -- Same two event types the app writes for a post-send add-line + save.
  INSERT INTO order_events (event_id, order_id, event_type, actor, at, details)
  VALUES
    ('OEV-48b3d281', 'ORD-20260914-BRA-PAGO-dbb70d', 'line_added', 'manager-default', now(),
     'Gyros 25 KG: dodano (blok)'),
    ('OEV-85ee7c03', 'ORD-20260914-BRA-PAGO-dbb70d', 'quantities_changed', 'manager-default',
     now() + interval '1 second',
     'Gyros 15 KG: 6 → 8; Pita (opakowania) szt 10: 3 → 8; Souvlaki Kurczak: 7 → 12; Gyros 25 KG: 0 → 1 (wg arkusza, ODB-WAW-2026-09-16-20260915-130744; pago-data-unity 28.09)');

  RAISE NOTICE 'pago-data-unity cleanup applied: A 8 orders + 2 transports, B 5 orders, C 1 order';
END $$;

COMMIT;


-- =====================================================================
-- STEP 2 — AUDIT (read-only). Every row must show ok = true.
-- Then re-run STEP 0 and save it as the "after" state in change.md.
-- =====================================================================

SELECT check_name, ok FROM (
  SELECT 1 AS n, 'A: 8 orders cancelled, trace set, marker cleared' AS check_name,
         (SELECT count(*) FROM orders
           WHERE order_id IN ('ORD-20260902-BRA-PAGO-3a9bea', 'ORD-20260902-BRO-PAGO-a1fbe8',
                              'ORD-20260902-ELE-PAGO-c11e06', 'ORD-20260925-BRO-PAGO-810239',
                              'ORD-20260925-ELE-PAGO-a141d9', 'ORD-20260925-KEN-PAGO-a3b234',
                              'ORD-20260925-NOR-PAGO-6702dd', 'ORD-20260925-WES-PAGO-f3732e')
             AND status = 'cancelled' AND cancelled_at IS NOT NULL
             AND cancelled_by = 'manager-default' AND cancel_reason LIKE '%pago-data-unity%'
             AND supplier_order_reference IS NULL) = 8 AS ok
  UNION ALL
  SELECT 2, 'A: both transport headers cancelled',
         (SELECT count(*) FROM transport_batches
           WHERE transport_id IN ('TRN-20260902-PAGO-aa283f', 'TRN-20260925-PAGO-2d5342')
             AND status = 'cancelled') = 2
  UNION ALL
  SELECT 3, 'A: 2 batch_cancelled events',
         (SELECT count(*) FROM transport_events
           WHERE event_id IN ('TEV-6c5af516', 'TEV-2aeffb78') AND event_type = 'batch_cancelled') = 2
  UNION ALL
  SELECT 4, 'B: 5 orders manager_sent via transport with ODB times',
         (SELECT count(*) FROM orders
           WHERE order_id IN ('ORD-20260904-KEN-PAGO-626d49', 'ORD-20260907-KEN-PAGO-63620f',
                              'ORD-20260907-BRA-PAGO-ffdb4f', 'ORD-20260914-KEN-PAGO-9ec6c9',
                              'ORD-20260914-WOL-PAGO-61280b')
             AND status = 'manager_sent' AND sent_method = 'transport'
             AND manager_user = 'manager-default'
             AND manager_sent_at BETWEEN '2026-09-04' AND '2026-09-16') = 5
  UNION ALL
  SELECT 5, 'B: line counts unchanged (3+3+5+4+4 = 19)',
         (SELECT count(*) FROM order_lines
           WHERE order_id IN ('ORD-20260904-KEN-PAGO-626d49', 'ORD-20260907-KEN-PAGO-63620f',
                              'ORD-20260907-BRA-PAGO-ffdb4f', 'ORD-20260914-KEN-PAGO-9ec6c9',
                              'ORD-20260914-WOL-PAGO-61280b')) = 19
  UNION ALL
  SELECT 6, 'B: only KEN Pita manager qty changed (sum of manager qty 1 -> 3)',
         (SELECT sum(manager_final_qty_purchase) FROM order_lines
           WHERE order_id IN ('ORD-20260904-KEN-PAGO-626d49', 'ORD-20260907-KEN-PAGO-63620f',
                              'ORD-20260907-BRA-PAGO-ffdb4f', 'ORD-20260914-KEN-PAGO-9ec6c9',
                              'ORD-20260914-WOL-PAGO-61280b')) = 3
  UNION ALL
  SELECT 7, 'B: KEN 07.09 Pita 2 / base 24, total 723.00',
         (SELECT count(*) FROM order_lines
           WHERE order_line_id = 'OL-ORD-20260907-KEN-PAGO-63620f-002'
             AND manager_final_qty_purchase = 2 AND manager_final_qty_base = 24) = 1
     AND (SELECT total_value_estimate_pln FROM orders
           WHERE order_id = 'ORD-20260907-KEN-PAGO-63620f') = 723.00
  UNION ALL
  SELECT 8, 'B: BRA 07.09 Bifteki comment set, quantities still 2/1',
         (SELECT count(*) FROM order_lines
           WHERE order_line_id = 'OL-ORD-20260907-BRA-PAGO-ffdb4f-005'
             AND captain_final_qty_purchase = 2 AND manager_final_qty_purchase = 1
             AND manager_comment LIKE 'nie było w zamówieniu%') = 1
  UNION ALL
  SELECT 9, 'B: 5 reconciled_from_sheet events',
         (SELECT count(*) FROM order_events
           WHERE event_id IN ('OEV-a0c129b7', 'OEV-e205fdcf', 'OEV-11df8f69', 'OEV-51cdbf07',
                              'OEV-2792f0e2') AND event_type = 'reconciled_from_sheet') = 5
  UNION ALL
  SELECT 10, 'C: BRA 14.09 lines = G15 8, Pita 8, SK 12, SW 2, Bif 1, G25 1 (6 lines)',
         (SELECT string_agg(product_id || '=' || manager_final_qty_purchase::numeric(12,0), ',' ORDER BY product_id)
            FROM order_lines WHERE order_id = 'ORD-20260914-BRA-PAGO-dbb70d')
         = 'P024=8,P025=1,P026=8,P027=12,P028=2,P145=1'
  UNION ALL
  SELECT 11, 'C: BRA 14.09 still manager_sent, total 6457.48, last_edited_at set',
         (SELECT count(*) FROM orders
           WHERE order_id = 'ORD-20260914-BRA-PAGO-dbb70d' AND status = 'manager_sent'
             AND total_value_estimate_pln = 6457.48 AND last_edited_at IS NOT NULL) = 1
  UNION ALL
  SELECT 12, 'C: line_added + quantities_changed events',
         (SELECT count(*) FROM order_events
           WHERE event_id IN ('OEV-48b3d281', 'OEV-85ee7c03')) = 2
  UNION ALL
  SELECT 13, 'Untouched: Mory WOL 21.09 still manager_claimed',
         (SELECT status FROM orders WHERE order_id = 'ORD-20260921-WOL-MORY-0cdb48') = 'manager_claimed'
) c
ORDER BY n;


-- =====================================================================
-- STEP R — ROLLBACK (only if STEP 2 fails after COMMIT, or on the
-- operator's request). Values below are the state read on 2026-09-28
-- 14:59 CEST; check them against cleanup-diff-before.md before running.
-- =====================================================================

-- BEGIN;
-- -- C
-- DELETE FROM order_events WHERE event_id IN ('OEV-48b3d281', 'OEV-85ee7c03');
-- DELETE FROM order_lines WHERE order_line_id = 'OL-ORD-20260914-BRA-PAGO-dbb70d-M-0b3ab1';
-- UPDATE order_lines SET manager_final_qty_purchase = 6, manager_final_qty_base = 90 WHERE order_line_id = 'OL-ORD-20260914-BRA-PAGO-dbb70d-001';
-- UPDATE order_lines SET manager_final_qty_purchase = 3, manager_final_qty_base = 36 WHERE order_line_id = 'OL-ORD-20260914-BRA-PAGO-dbb70d-002';
-- UPDATE order_lines SET manager_final_qty_purchase = 7, manager_final_qty_base = 35 WHERE order_line_id = 'OL-ORD-20260914-BRA-PAGO-dbb70d-003';
-- UPDATE orders SET total_value_estimate_pln = 3879.00, last_edited_at = NULL WHERE order_id = 'ORD-20260914-BRA-PAGO-dbb70d';
-- -- B
-- DELETE FROM order_events WHERE event_id IN ('OEV-a0c129b7', 'OEV-e205fdcf', 'OEV-11df8f69', 'OEV-51cdbf07', 'OEV-2792f0e2');
-- UPDATE order_lines SET manager_comment = '' WHERE order_line_id = 'OL-ORD-20260907-BRA-PAGO-ffdb4f-005';
-- UPDATE order_lines SET manager_final_qty_purchase = 0, manager_final_qty_base = 0 WHERE order_line_id = 'OL-ORD-20260907-KEN-PAGO-63620f-002';
-- UPDATE orders SET total_value_estimate_pln = 629.00 WHERE order_id = 'ORD-20260907-KEN-PAGO-63620f';
-- UPDATE orders SET status = 'manager_claimed', sent_method = NULL, manager_user = NULL, manager_sent_at = NULL
--  WHERE order_id IN ('ORD-20260904-KEN-PAGO-626d49', 'ORD-20260907-KEN-PAGO-63620f', 'ORD-20260907-BRA-PAGO-ffdb4f',
--                     'ORD-20260914-KEN-PAGO-9ec6c9', 'ORD-20260914-WOL-PAGO-61280b');
-- -- A
-- DELETE FROM transport_events WHERE event_id IN ('TEV-6c5af516', 'TEV-2aeffb78');
-- UPDATE transport_batches SET status = 'draft' WHERE transport_id IN ('TRN-20260902-PAGO-aa283f', 'TRN-20260925-PAGO-2d5342');
-- UPDATE orders SET status = 'manager_claimed', cancelled_at = NULL, cancelled_by = NULL, cancel_reason = '',
--        supplier_order_reference = 'TRN-20260902-PAGO-aa283f'
--  WHERE order_id IN ('ORD-20260902-BRA-PAGO-3a9bea', 'ORD-20260902-BRO-PAGO-a1fbe8', 'ORD-20260902-ELE-PAGO-c11e06');
-- UPDATE orders SET status = 'manager_claimed', cancelled_at = NULL, cancelled_by = NULL, cancel_reason = '',
--        supplier_order_reference = 'TRN-20260925-PAGO-2d5342'
--  WHERE order_id IN ('ORD-20260925-BRO-PAGO-810239', 'ORD-20260925-ELE-PAGO-a141d9', 'ORD-20260925-KEN-PAGO-a3b234',
--                     'ORD-20260925-NOR-PAGO-6702dd', 'ORD-20260925-WES-PAGO-f3732e');
-- COMMIT;
