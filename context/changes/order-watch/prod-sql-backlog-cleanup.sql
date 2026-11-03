-- order-watch / BACKLOG CLEANUP — SZKIELET OPERATORSKI.
-- ❗ NIE URUCHAMIAĆ hurtowo bez decyzji Bena. Kolumny zweryfikowane z migracjami
--   0001/0004/0020: orders.cancel_reason/cancelled_at/cancelled_by,
--   order_events(event_id, order_id, event_type, actor, at, details).
-- TRN-* (drafty transportu w supplier_order_reference) — WYKLUCZONE w obu statusach.
-- Procedura: 1) BEFORE, 2) porównaj z prod-sql-diagnosis.sql, 3) odkomentuj BEGIN…COMMIT, 4) AUDIT.

-- KROK 1 — BEFORE (odczyt; zapisz wynik jako dowód stanu przed)
-- UWAGA na nawiasy: wykluczenie TRN-% dotyczy OBU statusów (jak w UPDATE niżej).
SELECT status, count(*) AS n
FROM orders
WHERE ((status = 'manager_claimed' AND captain_submitted_at < now() - interval '7 days')
    OR (status = 'manager_sent' AND manager_sent_at < now() - interval '30 days'
        AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = orders.order_id)))
  AND COALESCE(supplier_order_reference,'') NOT LIKE 'TRN-%'
GROUP BY status;

-- Podgląd konkretnych ID (odczyt) — sprawdź, że to „twój" zbiór:
SELECT order_id, location_id, status, captain_submitted_at, manager_sent_at,
       supplier_order_reference
FROM orders
WHERE ((status = 'manager_claimed' AND captain_submitted_at < now() - interval '7 days')
    OR (status = 'manager_sent' AND manager_sent_at < now() - interval '30 days'
        AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = orders.order_id)))
  AND COALESCE(supplier_order_reference,'') NOT LIKE 'TRN-%'
ORDER BY captain_submitted_at NULLS LAST LIMIT 50;

-- GUARD (manualny): jeśli liczby/ID rozjechane z diagnozą → STOP, nie odkomentowuj.

-- KROK 2 — ZMIANA (odkomentuj dopiero po review BEFORE; jeden BEGIN…COMMIT)
-- BEGIN;
--
-- a) claimed > 7 dni → cancelled (ślad w polach orders: reason/at/by)
-- WITH changed AS (
--   UPDATE orders
--      SET status = 'cancelled',
--          cancel_reason = 'backlog-cleanup>7d (order-watch)',
--          cancelled_at = now(),
--          cancelled_by = 'operator-watchdog'
--    WHERE status = 'manager_claimed'
--      AND captain_submitted_at < now() - interval '7 days'
--      AND COALESCE(supplier_order_reference,'') NOT LIKE 'TRN-%'
--   RETURNING order_id)
-- SELECT count(*) AS cancelled_now FROM changed;
--
-- b) sent > 30 dni bez odbioru → closed + ślad zgodny z aplikacją
--    (event_type 'closed_without_receipt', ten sam co endpoint /manager/close).
--    INSERT dotyczy WYŁĄCZNIE wierszy zmienionych przez UPDATE (RETURNING),
--    nie wszystkich starych 'closed'.
-- WITH changed AS (
--   UPDATE orders SET status = 'closed'
--    WHERE status = 'manager_sent'
--      AND manager_sent_at < now() - interval '30 days'
--      AND COALESCE(supplier_order_reference,'') NOT LIKE 'TRN-%'
--      AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = orders.order_id)
--   RETURNING order_id)
-- INSERT INTO order_events (event_id, order_id, event_type, actor, at, details)
--   SELECT 'OC-' || order_id, order_id, 'closed_without_receipt',
--          'operator-watchdog', now(),
--          'backlog-cleanup>30d (order-watch): zamknięto bez odbioru — decyzja operatora'
--   FROM changed;
--
-- KROK 3 — AUDIT (w tej samej transakcji, przed COMMIT)
-- SELECT status, count(*) FROM orders
--  WHERE cancel_reason LIKE '%order-watch%' GROUP BY status;
-- SELECT event_type, count(*) FROM order_events
--  WHERE actor = 'operator-watchdog' GROUP BY event_type;
-- COMMIT;   -- albo ROLLBACK; jeśli AUDIT nie zgadza się z BEFORE.
-- Po COMMIT rollback = przywrócenie statusów z BEFORE dump (UPDATE per order_id).

-- Bezpieczniejsza alternatywa produktowa (rekomendowana): auto-'sent' dla Pago/Mory
-- albo flagowany odbiór 'claimed' przez kapitana — osobny change po decyzji.
