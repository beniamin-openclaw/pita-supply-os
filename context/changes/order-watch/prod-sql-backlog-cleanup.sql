-- order-watch / BACKLOG CLEANUP — NIE URUCHAMIAĆ bez decyzji Bena.
-- Konwencja porządku: BEFORE → guard → zmiana → AUDIT → rollback.
-- UWAGA (review grok-4.7): zamknięcie claimed/sent przez SQL omija ścieżkę UI
-- „Zamknij bez przyjęcia" (tam jest powód + ślad). Ten plik to opcja hurtowa
-- TYLKO dla zamówień starszych niż próg i uznanych za martwe.
-- Bezpieczniejsza alternatywa produktowa: auto-„sent" dla Pago/Mory albo
-- flagowany odbiór „claimed" przez kapitana — osobny change po decyzji.

\set claimed_stale_days 7
\set sent_stale_days 30

-- BEFORE (odczyt — zapisz wynik jako dowód stanu przed)
SELECT status, count(*) FROM orders
WHERE (status = 'manager_claimed' AND captain_submitted_at < now() - interval '7 days')
   OR (status = 'manager_sent' AND manager_sent_at < now() - interval '30 days'
       AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = orders.order_id))
GROUP BY status;

-- GUARD: jeśli liczby powyżej ≠ oczekiwania z diagnosis → STOP, nie wykonuj zmian.
-- Oczekiwano (~mail 19.10): claimed ~47 (dziś może być mniej), sent-ancient ~70.

BEGIN;
-- Zmiana: martwe claimed → cancelled z powodem (pole/column do potwierdzenia na prod —
-- jeśli orders.cancelled_reason nie istnieje, użyj notes lub pomiń sekcję UPDATE-2)
UPDATE orders SET status = 'cancelled',
       cancelled_reason = COALESCE(cancelled_reason,'') || ' backlog-cleanup>7d'
WHERE status = 'manager_claimed'
  AND captain_submitted_at < now() - interval '7 days';

UPDATE orders SET status = 'closed',
       cancelled_reason = COALESCE(cancelled_reason,'') || ' closed-without-receipt>30d (watchdog)'
WHERE status = 'manager_sent'
  AND manager_sent_at < now() - interval '30 days'
  AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = orders.order_id);

-- AUDIT (po zmianie, w tej samej transakcji)
SELECT status, count(*) FROM orders
WHERE cancelled_reason LIKE '%backlog-cleanup%' OR cancelled_reason LIKE '%closed-without-receipt>%'
GROUP BY status;
COMMIT;

-- ROLLBACK (jeśli przed COMMIT): ROLLBACK;  (po COMMIT: restore z BEFORE dump / backup Supabase)
