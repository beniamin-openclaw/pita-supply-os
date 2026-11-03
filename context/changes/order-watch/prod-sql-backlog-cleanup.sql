-- order-watch / BACKLOG CLEANUP — SZKIELET OPERATORSKI.
-- ❗ NIE URUCHAMIAĆ hurtowo bez decyzji Bena. Kolumny zweryfikowane z migracją 0004:
--   orders.cancel_reason, orders.cancelled_at, orders.cancelled_by
--   + ślad zamknięcia w aplikacji: order_events.closed_without_receipt.
-- TRN-* (drafty transportu w supplier_order_reference) — WYKLUCZONE.
-- Procedura: 1) BEFORE, 2) porównaj z oczekiwaniami, 3) odkomentuj UPDATE krokami, 4) AUDIT, 5) COMMIT.

-- KROK 1 — BEFORE (odczyt; zapisz wynik jako dowód stanu przed)
SELECT status, count(*) AS n
FROM orders
WHERE (status = 'manager_claimed' AND captain_submitted_at < now() - interval '7 days')
   OR (status = 'manager_sent' AND manager_sent_at < now() - interval '30 days'
       AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = orders.order_id))
  AND COALESCE(supplier_order_reference,'') NOT LIKE 'TRN-%'
GROUP BY status;
-- GUARD (manualny): jeśli liczby rozjechane z prod-sql-diagnosis.sql → STOP.

-- KROK 2 — ZMIANA (odkomentuj dopiero po review BEFORE)
-- BEGIN;
-- a) claimed > 7 dni → cancelled ze śladem kto/kiedy/dlaczego
-- UPDATE orders SET status='cancelled',
--        cancel_reason = COALESCE(cancel_reason,'') || 'backlog-cleanup>7d (order-watch)',
--        cancelled_at = now(), cancelled_by = 'operator-watchdog'
-- WHERE status='manager_claimed' AND captain_submitted_at < now() - interval '7 days'
--   AND COALESCE(supplier_order_reference,'') NOT LIKE 'TRN-%';
-- b) sent > 30 dni bez odbioru → closed + ślad zgodny z aplikacją (order_events.closed_without_receipt)
-- UPDATE orders SET status='closed'
-- WHERE status='manager_sent' AND manager_sent_at < now() - interval '30 days'
--   AND COALESCE(supplier_order_reference,'') NOT LIKE 'TRN-%'
--   AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = orders.order_id);
-- INSERT INTO order_events (order_id, event_type, created_at, actor)
--   SELECT order_id, 'closed_without_receipt', now(), 'operator-watchdog'
--   FROM orders WHERE status='closed' AND manager_sent_at < now() - interval '30 days'
--     AND COALESCE(supplier_order_reference,'') NOT LIKE 'TRN-%'
--     AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = orders.order_id);
-- KROK 3 — AUDIT (w transakcji)
-- SELECT status, count(*) FROM orders WHERE cancel_reason LIKE '%order-watch%' GROUP BY status;
-- COMMIT;   -- ROLLBACK; jeśli przed commit. Po commicie: restore z BEFORE dump.

-- Bezpieczniejsza alternatywa produktowa (rekomendowana): auto-'sent' dla Pago/Mory
-- albo flagowany odbiór 'claimed' przez kapitana — osobny change po decyzji.
