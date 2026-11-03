-- order-watch / DIAGNOSIS (READ-ONLY) — safe to run anytime.
-- Cel: „kto/gdzie zawinił” backlog statusów + weryfikacja buga „same zera z remanentu”.
-- Uruchom: psql $SUPPLY_OS_DATABASE_URL -f prod-sql-diagnosis.sql (operator, 2026-11-03+)

BEGIN TRANSACTION READ ONLY;

-- 1) Backlog per status × wiek (odpowiedź: GDZIE tkwi zator)
SELECT status,
       count(*) AS n,
       min(captain_submitted_at) AS oldest,
       max(captain_submitted_at) AS newest,
       round(avg(EXTRACT(epoch FROM (now() - captain_submitted_at))/3600)::numeric, 1) AS avg_age_h
FROM orders
WHERE status IN ('manager_claimed','manager_sent')
GROUP BY status ORDER BY status;

-- 2) Rozbicie per lokal × dostawca (35/47 w mailu Bena to Pago/Mory — sprawdź czy nadal tak)
SELECT location_id, supplier_id, status, count(*) AS n
FROM orders
WHERE status = 'manager_claimed'
GROUP BY 1,2,3 ORDER BY n DESC, 1;

-- 3) „Kto zawinił”: claimed-nie-wysłane vs wysłane-nieodebrane
--    uwaga: manager_claimed_at/manager_user NIE istnieją — wiek liczony od captain_submitted_at
SELECT o.location_id, o.supplier_id, o.order_id, o.captain_submitted_at, o.manager_sent_at,
       (SELECT count(*) FROM receipts r WHERE r.order_id = o.order_id) AS receipts_n
FROM orders o
WHERE o.status = 'manager_sent'
  AND o.manager_sent_at < now() - interval '3 days'
ORDER BY o.manager_sent_at;

-- 4) Bug „same zera z remanentu” (Rajeshwari 15.10): zamówienia, gdzie WSZYSTKIE linie mają qty 0
SELECT o.order_id, o.location_id, o.status, o.captain_submitted_at, count(l.*) AS lines_n,
       count(*) FILTER (WHERE COALESCE(l.captain_qty, l.qty, 0) = 0) AS zero_lines
FROM orders o JOIN order_lines l ON l.order_id = o.order_id
WHERE o.captain_submitted_at > '2026-10-01'
GROUP BY 1,2,3,4
HAVING count(*) FILTER (WHERE COALESCE(l.captain_qty, l.qty, 0) = 0) = count(l.*)
ORDER BY 4 DESC;

ROLLBACK;
