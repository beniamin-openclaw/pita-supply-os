-- =====================================================================
-- feedback-1001-names-units — Phase 4: bulk-pack ("opakowanie zbiorcze")
-- data (D22/D23/D32-D36, plan-review F5, impl-review F5)
-- Project: Supabase lpzhphufjwrndfogkfub
--
-- PREPARED 2026-10-02, NOT RUN ON PROD. Before-state read from prod with
-- SELECT only on 2026-10-02. Human-readable diff: prod-sql-2-diff.md. Run
-- nothing until the operator approves that diff.
--
-- Preconditions (all true on 2026-10-02 except the last, which the operator
-- confirms in chat):
--   * migration 0028 applied (case_unit, units_per_case + 3 CHECKs; 0.2 shows it)
--   * Phase 1 steps 1.1 and 1.8 applied (P021 is 'paczka', P015 has the Reha
--     supplier name; the 4.3 guard re-checks the unit and the note)
--   * PR #53 (ec58b78) live: Railway /health + the new Vercel bundle. Data
--     written before the code is harmless (old code ignores the columns), but
--     staff message part 2 must not go out before the screens show the case.
--
-- Pattern (lessons.md "Master-data ops: diff before, audit after"):
--   STEP 0  read-only SELECTs; save the output as the "before" record
--   STEP 1  one guarded DO block per product group. Each block re-checks the
--           exact before-state of every row it touches (case_unit and
--           units_per_case NULL, purchase_unit, units_per_purchase_unit,
--           rounding_rule, active, order_note, thresholds where it writes them)
--           and asserts row counts; any mismatch raises and the block rolls
--           back on its own. No DELETE anywhere.
--   STEP 2  read-only audit; every row must show ok = true
--   STEP R  rollback (commented out), built from the STEP 0 values
--
-- HOW TO RUN: one block per execution (one execute_sql call / one SQL editor
-- run), in the order below. Each DO block is its own transaction.
--   * 4.2 (cebula biała P018) is SEPARABLE. Skip it to leave P018 without a
--         case (recommended in the diff: Bukat bills it by weight). If it runs,
--         v_choice picks 'keep' (case only, D32 as decided) or 'raise' (case
--         + target = max = 5 kg at the 7 active locations).
--   * 4.4 (rolls) carries v_bracka: 'keep' (default, BRACKA thresholds
--         unchanged) or 'raise' (BRACKA P129 and P183 target = max = 6 rolls).
--   * The other blocks have no choice.
--
-- Scope: 8 active supplier_products (7 when 4.2 is skipped) and the P121
-- screen name. Inactive sibling rows (SP_SELGROS_*, SP_KUCHNIE_*,
-- SP_PAGO_P129) get no case. Thresholds change only on an operator 'raise'.
-- Dry run: see prod-sql-2-diff.md, section "Dry run".
-- =====================================================================


-- =====================================================================
-- STEP 0 — DIFF BEFORE (read-only). Save every result set.
-- =====================================================================

-- 0.1 the touched supplier rows (and their inactive siblings) + product
SELECT sp.supplier_product_id, sp.active, sp.product_id, p.product_name_pl, p.inventory_unit,
       p.is_critical, sp.purchase_unit, sp.units_per_purchase_unit::float8 AS upp,
       sp.rounding_rule, sp.order_note, sp.case_unit, sp.units_per_case::float8 AS upc
  FROM supplier_products sp JOIN products p USING (product_id)
 WHERE sp.product_id IN ('P006','P016','P018','P015','P021','P121','P129','P183')
 ORDER BY sp.product_id, sp.supplier_product_id;

-- 0.2 precondition: migration 0028 is applied and no row carries a case yet
SELECT (SELECT count(*) FROM information_schema.columns
         WHERE table_name = 'supplier_products' AND column_name IN ('case_unit','units_per_case')) = 2
   AND (SELECT count(*) FROM pg_constraint
         WHERE conrelid = 'public.supplier_products'::regclass
           AND conname IN ('supplier_products_case_pair_check',
                           'supplier_products_units_per_case_check',
                           'supplier_products_case_unit_not_blank_check')) = 3 AS migration_0028_applied,
       (SELECT count(*) FROM supplier_products
         WHERE case_unit IS NOT NULL OR units_per_case IS NOT NULL) AS rows_with_case_now;

-- 0.3 thresholds at the 7 active locations against the planned case
--     (plan-review F5 + impl-review F5). always_case_0 = target under half a
--     case, so the case suggestion is always 0 there; max_under_1_case = one
--     case always exceeds max.
SELECT s.product_id, s.location_id,
       s.min_stock_qty_base::float8 AS mn, s.target_stock_qty_base::float8 AS tg,
       s.max_stock_qty_base::float8 AS mx,
       (s.is_critical_for_location OR p.is_critical) AS critical,
       c.case_unit, c.upc,
       s.target_stock_qty_base < c.upc / 2.0 AS always_case_0,
       s.max_stock_qty_base < c.upc AS max_under_1_case
  FROM location_product_settings s
  JOIN locations l USING (location_id)
  JOIN products p USING (product_id)
  JOIN (VALUES ('P006','skrzynka',6), ('P016','worek',5), ('P018','worek',5), ('P021','karton',4),
               ('P015','karton',12), ('P129','opak',6), ('P183','opak',6), ('P121','opak',10))
       AS c(product_id, case_unit, upc) USING (product_id)
 WHERE l.active
 ORDER BY s.product_id, s.location_id;

-- 0.4 open order lines on the touched products (information only: a case
--     changes how a quantity is worded, never the quantity, so there is no
--     open-order guard)
SELECT o.status, o.location_id, o.order_id, ol.product_id,
       ol.captain_final_qty_purchase::float8 AS cap, ol.manager_final_qty_purchase::float8 AS mgr,
       ol.manager_final_set,
       (SELECT count(*) FROM receipts r WHERE r.order_id = o.order_id) AS receipts
  FROM orders o JOIN order_lines ol USING (order_id)
 WHERE o.status IN ('captain_submitted','manager_claimed','manager_sent')
   AND ol.product_id IN ('P006','P016','P018','P015','P021','P121','P129','P183')
 ORDER BY o.status, o.location_id, o.order_id, ol.product_id;


-- =====================================================================
-- STEP 1 — APPLY (one block per execution)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4.1 Bukat: pomidor P006 skrzynka 6 kg; cebula czerwona P016 worek 5 kg
--     (D23). The P016 note "worek 5 kg" only restated the case (the card now
--     shows "1 worek = 5 kg"), so it is cleared. P006 has no note.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE supplier_products sp
     SET case_unit = v.case_unit, units_per_case = v.upc, order_note = v.new_note
    FROM (VALUES ('SP_BUKAT_P006', 'skrzynka', 6, NULL::text, NULL::text),
                 ('SP_BUKAT_P016', 'worek',    5, 'worek 5 kg', NULL::text))
         AS v(spid, case_unit, upc, old_note, new_note)
   WHERE sp.supplier_product_id = v.spid
     AND sp.case_unit IS NULL AND sp.units_per_case IS NULL
     AND sp.active AND sp.purchase_unit = 'kg' AND sp.units_per_purchase_unit = 1
     AND sp.rounding_rule = 'tenth_kg'
     AND sp.order_note IS NOT DISTINCT FROM v.old_note;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '4.1 Bukat P006/P016: expected 2 rows without a case in kg, got % — a row changed or 4.1 already ran', n; END IF;
  RAISE NOTICE '4.1 applied: P006 skrzynka 6, P016 worek 5';
END $$;

-- ---------------------------------------------------------------------
-- 4.2 SEPARABLE — Bukat cebula biała P018 worek 5 kg (D32). Skip this block
--     to leave P018 without a case (see the diff: KEN invoices bill it by
--     weight, 1,1 kg, and every order since July was 0,5 or 1 kg).
--     Target is 0,5-1 kg at all 7 active locations, under half a bag, so the
--     case suggestion is always 0 and ordering one bag always asks for a
--     reason (plan-review F5). v_choice:
--       'keep'  — case only, thresholds unchanged (D32 as decided)
--       'raise' — case + target = max = 5 kg at the 7 active locations
--                 (min unchanged); the setting notes get a suffix
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_choice text := 'keep';
  n int;
BEGIN
  IF v_choice NOT IN ('keep', 'raise') THEN
    RAISE EXCEPTION '4.2 P018: v_choice must be keep or raise, got %', v_choice;
  END IF;

  UPDATE supplier_products
     SET case_unit = 'worek', units_per_case = 5, order_note = NULL
   WHERE supplier_product_id = 'SP_BUKAT_P018'
     AND case_unit IS NULL AND units_per_case IS NULL
     AND active AND purchase_unit = 'kg' AND units_per_purchase_unit = 1
     AND rounding_rule = 'tenth_kg' AND order_note = 'worek 5 kg';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '4.2 P018: expected 1 row without a case in kg, got % — the row changed or 4.2 already ran', n; END IF;

  IF v_choice = 'raise' THEN
    UPDATE location_product_settings s
       SET notes = s.notes || format(' [2026-10-02 feedback-1001 4.2 F5, przed %s/%s/%s]',
                                     s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                                     s.max_stock_qty_base::float8),
           target_stock_qty_base = 5, max_stock_qty_base = 5
      FROM (VALUES ('WOLA',0.5,1,1), ('BRACKA',0.2,0.5,0.5), ('KEN',0.1,1,1), ('BROWARY',0.3,1,1),
                   ('NORBLIN',0.2,1,1), ('ELEKTROWNIA',0.2,1,1), ('WESTFIELD',0.2,1,1))
           AS v(loc, mn, tg, mx)
     WHERE s.location_id = v.loc AND s.product_id = 'P018'
       AND s.min_stock_qty_base = v.mn AND s.target_stock_qty_base = v.tg
       AND s.max_stock_qty_base = v.mx;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 7 THEN RAISE EXCEPTION '4.2 P018 raise: expected 7 threshold rows, got % — a row changed', n; END IF;
  END IF;
  RAISE NOTICE '4.2 applied: P018 worek 5 (%)', v_choice;
END $$;

-- ---------------------------------------------------------------------
-- 4.3 Intermlecz: frytki P021 karton = 4 paczki; halloumi P015 karton = 12
--     szt (D23). Guarded on Phase 1 step 1.8 (P021 in 'paczka').
--     Notes (D23 "cleared where it only restated the case"):
--       P015 "opak. zbiorcze 12 szt" -> NULL (it now reads "1 karton = 12 szt";
--            "opak." would contradict "karton")
--       P021 "1 paczka = 2,5 kg; karton = 4 paczki" -> "1 szt = 1 paczka 2,5 kg"
--            (keeps the bag weight; the case part is on the card now; the
--            stock field counts in szt (inventory unit) and the order field in
--            paczki, and this note says they are the same thing)
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE supplier_products sp
     SET case_unit = 'karton', units_per_case = v.upc, order_note = v.new_note
    FROM (VALUES ('SP_INTERMLECZ_P021', 'paczka', 4,  '1 paczka = 2,5 kg; karton = 4 paczki', '1 szt = 1 paczka 2,5 kg'),
                 ('SP_INTERMLECZ_P015', 'szt',    12, 'opak. zbiorcze 12 szt',                NULL::text))
         AS v(spid, unit, upc, old_note, new_note)
   WHERE sp.supplier_product_id = v.spid
     AND sp.case_unit IS NULL AND sp.units_per_case IS NULL
     AND sp.active AND sp.purchase_unit = v.unit AND sp.units_per_purchase_unit = 1
     AND sp.rounding_rule = 'full_only' AND sp.order_note = v.old_note;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '4.3 Intermlecz P021/P015: expected 2 rows (P021 in paczka after 1.8), got % — a row changed or 4.3 already ran', n; END IF;
  RAISE NOTICE '4.3 applied: P021 karton 4, P015 karton 12';
END $$;

-- ---------------------------------------------------------------------
-- 4.4 Mory rolls: 80/80 P129 and 80/20 P183, opak = 6 szt (D23, D24),
--     the active SP_MORY rows only (SP_PAGO_P129 is inactive). No notes.
--     BRACKA has P129 1/2/2 (target under half a pack: the case suggestion is
--     always 0, plan-review F5) and P183 1/4/4 (max under one pack). v_bracka:
--       'keep'  — BRACKA thresholds unchanged (default)
--       'raise' — BRACKA P129 and P183 target = max = 6 (min unchanged)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_bracka text := 'keep';
  n int;
BEGIN
  IF v_bracka NOT IN ('keep', 'raise') THEN
    RAISE EXCEPTION '4.4 rolls: v_bracka must be keep or raise, got %', v_bracka;
  END IF;

  UPDATE supplier_products
     SET case_unit = 'opak', units_per_case = 6
   WHERE supplier_product_id IN ('SP_MORY_P129', 'SP_MORY_P183')
     AND case_unit IS NULL AND units_per_case IS NULL
     AND active AND purchase_unit = 'szt' AND units_per_purchase_unit = 1
     AND rounding_rule = 'full_only' AND order_note IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '4.4 Mory P129/P183: expected 2 rows without a case in szt, got % — a row changed or 4.4 already ran', n; END IF;

  IF v_bracka = 'raise' THEN
    UPDATE location_product_settings s
       SET notes = s.notes || format(' [2026-10-02 feedback-1001 4.4 F5, przed %s/%s/%s]',
                                     s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                                     s.max_stock_qty_base::float8),
           target_stock_qty_base = 6, max_stock_qty_base = 6
      FROM (VALUES ('P129',1,2,2), ('P183',1,4,4)) AS v(pid, mn, tg, mx)
     WHERE s.location_id = 'BRACKA' AND s.product_id = v.pid
       AND s.min_stock_qty_base = v.mn AND s.target_stock_qty_base = v.tg
       AND s.max_stock_qty_base = v.mx;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 2 THEN RAISE EXCEPTION '4.4 BRACKA raise: expected 2 threshold rows, got % — a row changed', n; END IF;
  END IF;
  RAISE NOTICE '4.4 applied: P129 + P183 opak 6 (BRACKA %)', v_bracka;
END $$;

-- ---------------------------------------------------------------------
-- 4.5 Blue Service gąbka P121, opak = 10 szt (D23), plus the screen name
--     "Gąbka do naczyń 10szt" moved here from Phase 1 (names.md N1). The
--     note "opak. zbiorcze 10 szt" only restated the case: cleared. The
--     supplier name (printed in the e-mail) stays "Gąbka do naczyń".
-- ---------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  UPDATE supplier_products
     SET case_unit = 'opak', units_per_case = 10, order_note = NULL
   WHERE supplier_product_id = 'SP_BLUESERV_P121'
     AND case_unit IS NULL AND units_per_case IS NULL
     AND active AND purchase_unit = 'szt' AND units_per_purchase_unit = 1
     AND rounding_rule = 'full_only' AND order_note = 'opak. zbiorcze 10 szt';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '4.5 P121: expected 1 row without a case in szt, got % — the row changed or 4.5 already ran', n; END IF;

  UPDATE products SET product_name_pl = 'Gąbka do naczyń 10szt'
   WHERE product_id = 'P121' AND product_name_pl = 'Gąbka do naczyń' AND inventory_unit = 'szt';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '4.5 P121 name: expected 1 product named "Gąbka do naczyń" in szt, got %', n; END IF;
  RAISE NOTICE '4.5 applied: P121 opak 10, renamed';
END $$;


-- =====================================================================
-- STEP 2 — AUDIT (read-only). Every row must show ok = true. Rows 2, 7 and
-- 8 accept each documented choice (4.2 skipped / keep / raise; BRACKA keep /
-- raise). Save the output as prod-sql-2-audit.md, with the choices made.
-- =====================================================================

SELECT n, check_name, ok FROM (
  SELECT 1 AS n, '4.1/4.3/4.4/4.5 seven cases set as planned' AS check_name,
         (SELECT count(*) FROM supplier_products
           WHERE (supplier_product_id, case_unit, units_per_case) IN
                 (('SP_BUKAT_P006','skrzynka',6), ('SP_BUKAT_P016','worek',5),
                  ('SP_INTERMLECZ_P021','karton',4), ('SP_INTERMLECZ_P015','karton',12),
                  ('SP_MORY_P129','opak',6), ('SP_MORY_P183','opak',6), ('SP_BLUESERV_P121','opak',10))) = 7 AS ok
  UNION ALL
  SELECT 2, '4.2 P018: worek 5 + note cleared (ran), or no case + note "worek 5 kg" (skipped)',
         EXISTS (SELECT 1 FROM supplier_products WHERE supplier_product_id = 'SP_BUKAT_P018'
                  AND ((case_unit = 'worek' AND units_per_case = 5 AND order_note IS NULL)
                    OR (case_unit IS NULL AND units_per_case IS NULL AND order_note = 'worek 5 kg')))
  UNION ALL
  SELECT 3, 'no other supplier_product carries a case',
         NOT EXISTS (SELECT 1 FROM supplier_products
                      WHERE (case_unit IS NOT NULL OR units_per_case IS NOT NULL)
                        AND supplier_product_id NOT IN ('SP_BUKAT_P006','SP_BUKAT_P016','SP_BUKAT_P018',
                              'SP_INTERMLECZ_P021','SP_INTERMLECZ_P015','SP_MORY_P129','SP_MORY_P183',
                              'SP_BLUESERV_P121'))
  UNION ALL
  SELECT 4, 'every case row: active, upp 1, base unit as before, case unit the screens and e-mail decline',
         NOT EXISTS (SELECT 1 FROM supplier_products
                      WHERE case_unit IS NOT NULL
                        AND NOT (active AND units_per_purchase_unit = 1
                                 AND case_unit IN ('skrzynka','worek','karton','opak')
                                 AND units_per_case = trunc(units_per_case) AND units_per_case > 1
                                 AND (supplier_product_id, purchase_unit) IN
                                     (('SP_BUKAT_P006','kg'), ('SP_BUKAT_P016','kg'), ('SP_BUKAT_P018','kg'),
                                      ('SP_INTERMLECZ_P021','paczka'), ('SP_INTERMLECZ_P015','szt'),
                                      ('SP_MORY_P129','szt'), ('SP_MORY_P183','szt'), ('SP_BLUESERV_P121','szt'))))
  UNION ALL
  SELECT 5, 'notes: P016/P015/P121 cleared, P021 "1 szt = 1 paczka 2,5 kg", P006/P129/P183 still none',
         (SELECT count(*) FROM supplier_products
           WHERE (supplier_product_id IN ('SP_BUKAT_P016','SP_INTERMLECZ_P015','SP_BLUESERV_P121',
                                          'SP_BUKAT_P006','SP_MORY_P129','SP_MORY_P183') AND order_note IS NULL)
              OR (supplier_product_id = 'SP_INTERMLECZ_P021' AND order_note = '1 szt = 1 paczka 2,5 kg')) = 7
  UNION ALL
  SELECT 6, '4.5 P121 screen name "Gąbka do naczyń 10szt"; supplier name unchanged',
         (SELECT product_name_pl FROM products WHERE product_id = 'P121') = 'Gąbka do naczyń 10szt'
     AND (SELECT supplier_product_name FROM supplier_products WHERE supplier_product_id = 'SP_BLUESERV_P121') = 'Gąbka do naczyń'
  UNION ALL
  SELECT 7, 'P018 thresholds: unchanged (skipped/keep) or target = max = 5 at the 7 active locations (raise)',
         (SELECT count(*) FROM location_product_settings s
            JOIN (VALUES ('WOLA',0.5,1), ('BRACKA',0.2,0.5), ('KEN',0.1,1), ('BROWARY',0.3,1),
                         ('NORBLIN',0.2,1), ('ELEKTROWNIA',0.2,1), ('WESTFIELD',0.2,1)) AS v(loc, mn, mx)
              ON s.location_id = v.loc AND s.product_id = 'P018' AND s.min_stock_qty_base = v.mn
             AND s.target_stock_qty_base = v.mx AND s.max_stock_qty_base = v.mx) = 7
      OR ((SELECT count(*) FROM location_product_settings s
            JOIN (VALUES ('WOLA',0.5), ('BRACKA',0.2), ('KEN',0.1), ('BROWARY',0.3),
                         ('NORBLIN',0.2), ('ELEKTROWNIA',0.2), ('WESTFIELD',0.2)) AS v(loc, mn)
              ON s.location_id = v.loc AND s.product_id = 'P018' AND s.min_stock_qty_base = v.mn
             AND s.target_stock_qty_base = 5 AND s.max_stock_qty_base = 5) = 7
          AND (SELECT case_unit FROM supplier_products WHERE supplier_product_id = 'SP_BUKAT_P018') = 'worek')
  UNION ALL
  SELECT 8, 'BRACKA rolls: P129 1/2/2 + P183 1/4/4 (keep) or both 1/6/6 (raise)',
         (SELECT count(*) FROM location_product_settings
           WHERE location_id = 'BRACKA' AND min_stock_qty_base = 1
             AND ((product_id = 'P129' AND target_stock_qty_base = 2 AND max_stock_qty_base = 2)
               OR (product_id = 'P183' AND target_stock_qty_base = 4 AND max_stock_qty_base = 4))) = 2
      OR (SELECT count(*) FROM location_product_settings
           WHERE location_id = 'BRACKA' AND product_id IN ('P129','P183') AND min_stock_qty_base = 1
             AND target_stock_qty_base = 6 AND max_stock_qty_base = 6) = 2
  UNION ALL
  SELECT 9, 'min <= target <= max and max > 0 on every setting row this batch wrote',
         NOT EXISTS (SELECT 1 FROM location_product_settings
                      WHERE notes LIKE '%2026-10-02 feedback-1001%'
                        AND NOT (min_stock_qty_base <= target_stock_qty_base
                                 AND target_stock_qty_base <= max_stock_qty_base
                                 AND max_stock_qty_base > 0))
  UNION ALL
  SELECT 10, 'the 0028 CHECKs hold: no half-set pair, no blank unit, no case of 1 or less',
         NOT EXISTS (SELECT 1 FROM supplier_products
                      WHERE (case_unit IS NULL) <> (units_per_case IS NULL)
                         OR btrim(case_unit) = '' OR units_per_case <= 1)
) c
ORDER BY n;

-- Re-run STEP 0 after the audit and save it as the "after" state.


-- =====================================================================
-- STEP R — ROLLBACK (commented out). Run only the parts that were applied,
-- newest first. Values are the prod state read on 2026-10-02; check them
-- against the saved STEP 0. The case columns go back to NULL; nothing else
-- reads them (order lines, receipts and finance stay in the purchase unit).
-- =====================================================================

-- -- R 4.5
-- BEGIN;
-- UPDATE supplier_products SET case_unit = NULL, units_per_case = NULL, order_note = 'opak. zbiorcze 10 szt'
--  WHERE supplier_product_id = 'SP_BLUESERV_P121';
-- UPDATE products SET product_name_pl = 'Gąbka do naczyń' WHERE product_id = 'P121';
-- COMMIT;
--
-- -- R 4.4 (the threshold UPDATE is a no-op when v_bracka was 'keep')
-- BEGIN;
-- UPDATE supplier_products SET case_unit = NULL, units_per_case = NULL
--  WHERE supplier_product_id IN ('SP_MORY_P129','SP_MORY_P183');
-- UPDATE location_product_settings s
--    SET target_stock_qty_base = v.tg, max_stock_qty_base = v.mx,
--        notes = regexp_replace(s.notes, ' \[2026-10-02 feedback-1001 [^]]*\]$', '')
--   FROM (VALUES ('P129',2,2), ('P183',4,4)) AS v(pid, tg, mx)
--  WHERE s.location_id = 'BRACKA' AND s.product_id = v.pid
--    AND s.notes LIKE '%2026-10-02 feedback-1001 4.4%';
-- COMMIT;
--
-- -- R 4.3
-- BEGIN;
-- UPDATE supplier_products SET case_unit = NULL, units_per_case = NULL,
--        order_note = '1 paczka = 2,5 kg; karton = 4 paczki'
--  WHERE supplier_product_id = 'SP_INTERMLECZ_P021';
-- UPDATE supplier_products SET case_unit = NULL, units_per_case = NULL,
--        order_note = 'opak. zbiorcze 12 szt'
--  WHERE supplier_product_id = 'SP_INTERMLECZ_P015';
-- COMMIT;
--
-- -- R 4.2 (only if it ran; the threshold UPDATE is a no-op when v_choice was 'keep')
-- BEGIN;
-- UPDATE supplier_products SET case_unit = NULL, units_per_case = NULL, order_note = 'worek 5 kg'
--  WHERE supplier_product_id = 'SP_BUKAT_P018';
-- UPDATE location_product_settings s
--    SET target_stock_qty_base = v.tg, max_stock_qty_base = v.mx,
--        notes = regexp_replace(s.notes, ' \[2026-10-02 feedback-1001 [^]]*\]$', '')
--   FROM (VALUES ('WOLA',1,1), ('BRACKA',0.5,0.5), ('KEN',1,1), ('BROWARY',1,1),
--                ('NORBLIN',1,1), ('ELEKTROWNIA',1,1), ('WESTFIELD',1,1)) AS v(loc, tg, mx)
--  WHERE s.location_id = v.loc AND s.product_id = 'P018'
--    AND s.notes LIKE '%2026-10-02 feedback-1001 4.2%';
-- COMMIT;
--
-- -- R 4.1
-- BEGIN;
-- UPDATE supplier_products SET case_unit = NULL, units_per_case = NULL
--  WHERE supplier_product_id = 'SP_BUKAT_P006';
-- UPDATE supplier_products SET case_unit = NULL, units_per_case = NULL, order_note = 'worek 5 kg'
--  WHERE supplier_product_id = 'SP_BUKAT_P016';
-- COMMIT;
