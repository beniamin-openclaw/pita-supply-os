-- porzadek-2026-10 — suggestion alerts on for every supplier
-- Ben, chat 2026-10-19 (after the explanation of what the flag does): "wszedzie wlacz alerty".
-- STEP 0 read 19.10: alerts off at exactly 5 suppliers, all active:
--   SUP_COCACOLA_KAT, SUP_PAGO, SUP_WARSZAWA_GDA, SUP_WARSZAWA_KAT, SUP_WARSZAWA_KRK.
-- Effect: Captains see colour states, "poniżej minimum", critical warnings and must give a reason for a >25%
-- deviation from the suggestion at these suppliers; the Manager queue shows deviation markers. Backup rows stay
-- without alerts (code: alerts_enabled and not is_backup).

-- STEP 0
SELECT supplier_id, suggestion_alerts_enabled FROM suppliers WHERE NOT suggestion_alerts_enabled ORDER BY 1;  -- expect the 5 above

-- STEP 1
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE n int;
BEGIN
  IF (SELECT array_agg(supplier_id ORDER BY supplier_id) FROM suppliers WHERE NOT suggestion_alerts_enabled)
     IS DISTINCT FROM ARRAY['SUP_COCACOLA_KAT','SUP_PAGO','SUP_WARSZAWA_GDA','SUP_WARSZAWA_KAT','SUP_WARSZAWA_KRK'] THEN
    RAISE EXCEPTION 'suppliers with alerts off changed since 2026-10-19 — re-diff';
  END IF;
  UPDATE suppliers
     SET suggestion_alerts_enabled = true,
         notes = notes || ' [2026-10-19 Ben: alerty sugestii włączone wszędzie; przed: wyłączone]'
   WHERE NOT suggestion_alerts_enabled;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 5 THEN RAISE EXCEPTION 'alerts on: expected 5, got %', n; END IF;
END $$;
COMMIT;

-- AUDIT: expect 0 rows
SELECT supplier_id FROM suppliers WHERE NOT suggestion_alerts_enabled;

-- ROLLBACK (commented out)
-- UPDATE suppliers SET suggestion_alerts_enabled = false
--  WHERE supplier_id IN ('SUP_COCACOLA_KAT','SUP_PAGO','SUP_WARSZAWA_GDA','SUP_WARSZAWA_KAT','SUP_WARSZAWA_KRK');  -- expect 5
