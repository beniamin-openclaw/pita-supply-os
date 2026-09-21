-- ============================================================
-- Pita Supply OS — pago-transport-only-dispatch, prod master data
-- Prod Supabase lpzhphufjwrndfogkfub
--
-- !!! ORDER OF OPERATIONS — READ BEFORE RUNNING ANYTHING !!!
--
--   1. Apply migration 0021_supplier_ordering_method_transport.sql.
--      Safe at any time: it only widens a CHECK, every existing value stays
--      valid, and no row is touched.
--   2. Deploy the backend AND the frontend, then CONFIRM BOTH ARE LIVE
--      (Railway /openapi.json carries the new value, Vercel serves the new
--      bundle). Do not take "merged" for "live".
--   3. ONLY THEN run section B below.
--
--   Running section B before step 2 takes the app down: a supplier row
--   carrying 'transport' read by a build whose OrderingMethod lacks the
--   member raises a Pydantic ValidationError inside load_suppliers, which
--   500s the Captain order screen, the Manager queue and the Transport
--   screen. This repo has had that exact failure once already, with
--   supplier_products.rounding_rule = 'tenth_kg'.
-- ============================================================


-- ---------- A. BEFORE diff (save this output — it is the rollback) ----------

SELECT supplier_id, supplier_name, ordering_method, email, notes, active
  FROM suppliers
 WHERE supplier_id = 'SUP_PAGO';

-- Expected before section B: ordering_method = 'manual' (set by the stopgap on
-- 2026-09-21) or, if that stopgap was never run, still 'email'.


-- ---------- B. APPLY — the data pass (only after step 2 above) ----------

UPDATE suppliers
   SET ordering_method = 'transport'
 WHERE supplier_id = 'SUP_PAGO'
   AND ordering_method IN ('manual', 'email');
-- expect: UPDATE 1
--
-- The guard accepts BOTH prior values on purpose. The plan specified 'manual'
-- alone, on the assumption the stopgap had already run; guarding on 'manual'
-- only would silently match zero rows if it had not, leaving Pago dispatchable
-- and the incident unfixed. Accepting 'email' as well makes the statement
-- correct from either starting point, while still refusing to overwrite a
-- value somebody set deliberately to something else. Re-running it is a no-op.


-- ---------- C. AUDIT after ----------

-- C1. Pago is on the transport channel and still carries its full recipient
--     list — the Transport Gmail draft reads its recipients from this column.
SELECT supplier_id,
       ordering_method,
       (ordering_method = 'transport')                          AS channel_ok,
       (position('@' in email) > 0)                             AS email_intact,
       (length(email) - length(replace(email, ',', '')) + 1)    AS recipient_count
  FROM suppliers
 WHERE supplier_id = 'SUP_PAGO';
-- expect: channel_ok = true, email_intact = true, recipient_count = 6

-- C2. No other supplier changed channel.
SELECT ordering_method, count(*) AS suppliers
  FROM suppliers
 WHERE active
 GROUP BY 1
 ORDER BY 1;
-- expect: exactly one row with ordering_method = 'transport'

-- C3. Pago orders still waiting. These now go through the Transport screen;
--     the queue will refuse to dispatch them.
SELECT order_id, location_id, status, captain_submitted_at::date AS submitted,
       supplier_order_reference
  FROM orders
 WHERE supplier_id = 'SUP_PAGO'
   AND status IN ('captain_submitted', 'manager_claimed')
 ORDER BY captain_submitted_at DESC;


-- ---------- D. ROLLBACK (only if the guard has to come off) ----------

-- UPDATE suppliers SET ordering_method = 'manual' WHERE supplier_id = 'SUP_PAGO';
--
-- Rolling the MIGRATION back as well is only valid once no supplier row
-- carries 'transport' — see the header of
-- supply-os-v1/migrations/0021_supplier_ordering_method_transport.sql.
