-- porzadek-data-2026-10 — prod SQL 2: Warsaw, "gotowe od ręki" (contracts.md Lane D item 2)
-- Prepared 2026-10-17. Run in the Supabase SQL editor (project lpzhphufjwrndfogkfub).
--
-- HOW TO RUN: STEP 0 alone first (read-only) and compare it with "Before" below. Then ONE block
-- per editor run (2.1 … 2.7). Each DO block is its own transaction: a block that raises changes
-- nothing, and the next block can still run. Skip any block you do not want. 2.8 is read-only.
-- The agent could not read prod on 17.10 (classifier blocked reads too). Ids and "before" values
-- come from the repo (rollout SQL, diffs, notes). Where the repo has no exact "before", the block
-- does not assume one: it records the old value in notes ("[2026-10-17 przed x/y/z …]") and
-- guards only what must be true.
--
-- Sources: Marek's mail answers 28–29.09 ("6 rzeczy do ustalenia"), quoted in
-- context/changes/porzadek-2026-10/inputs/mail-2026-10-16.md item 2; Wispr 12.10 (souvlaki);
-- Connecteam chat B51 (Tushar, Cappy glass 24) and B53 (Khushi, gyros 3 pcs); decisions D17, D18.
-- Rule used everywhere: target = max (the engine reads target only).
--
-- Before (repo state; STEP 0 confirms):
--   2.1 BROWARY__P019 Przyprawa do souvlaków (kg): about 5 kg max ("było 5", Marek 12.10) — exact
--       value not recorded. SP_MORY_P019 active kg×1.
--   2.2 BROWARY__P043 Develey Musztarda 3 kg target 6, BROWARY__P044 Fanex Majonez 4 kg target 8 —
--       entered in kg by mistake; the unit is szt (one jar/bucket). Min not recorded.
--   2.3 WOLA rolls (szt): P128 57/20 10/40/40, P130 57/30 10/80/80 (no case on SP_MORY_P128/P130),
--       P129 80/80 6/60/60 (SP_MORY_P129 case opak×6).
--   2.4 P121 Gąbka do naczyń 10szt (szt), SP_BLUESERV_P121 szt×1 with case opak×10. Thresholds:
--       WOLA 5/12/12, BRACKA 5/10/10, BROWARY 6/12/12, KEN 6/24/24, NORBLIN/ELEKTROWNIA/WESTFIELD 10/20/20.
--   2.5 SP_FILBER_P136/P137/P138/P157 (Corfu) purchase_unit 'box', ×12, order_note '1 box = 12 szt'.
--   2.6 WOLA__P064/P065 Cappy PET 12/36/36; P190/P191 Cappy szkło exist (skrzynka×24) with no
--       setting row anywhere (feedback-1001 1.11b never applied — prod-run-2026-10-02.md:30).
--   2.7 KEN__P024 Gyros 15 KG (kg, Pago szt×15 = 15 kg block): kg values after the 28.09 conversion
--       not recorded per row (likely 30/150/150).
--
-- What changes:
--   2.1 BROWARY__P019 -> 0,5/2/2 (Marek 12.10: max 2 kg, reorder below 0,5).
--   2.2 BROWARY__P043, BROWARY__P044 -> 1/2/2 szt (Marek: "2x3=6 2x4=8 1/2 zmienic i bedzie ok";
--       same as KEN/NORBLIN/WESTFIELD/ELEKTROWNIA).
--   2.3 WOLA rolls "na paczki, max 5 op": P129 max 5 × 6 = 30 szt (target = max = 30, min kept).
--       P128/P130: the pack size of the 57 mm rolls is unknown (open at Marek since 05.09). The block
--       has two operator variables; while they are NULL those two products are skipped with a NOTICE.
--   2.4 P121 at the 7 Warsaw locations -> 5/15/15 szt (= 0,5/1,5 opak of 10; D17). The opak×10 case is
--       already on SP_BLUESERV_P121, so the engine already rounds the order to whole packs.
--       FORUM/SUPERSAM are not touched (Dis-Pack sponge, opak×5).
--   2.5 Corfu: purchase_unit 'box' -> 'karton', order_note '1 karton = 12 szt' (packUnits.ts has
--       "karton" with Polish declension; "box" does not decline).
--   2.6 WOLA Cappy -> glass: WOLA__P190/P191 in (min 12 from PET, target = max = v_max), PET
--       WOLA__P064/P065 out. This is feedback-1001 block 1.11b unchanged. v_max = 48 (2 crates,
--       default) or 24 (1 crate) — the operator's choice, as in 1.11b.
--   2.7 KEN gyros: KEN__P024 target = max = 45 kg (3 blocks × 15 kg; Khushi 08.10 "3 pcs are enough
--       until next delivery"; matches the pork-waste report of 04.10). Min kept if <= 45.
--       INTERPRETATION: the chat message was a screenshot; P024 (pork, Pago) is the likely item.
--       If Khushi meant chicken P179 (Spec Food, also 15 kg blocks), change v_pid before running.
--   2.8 Envelopes/staples on Mory (D18): read-only check, no write — see the block.
--
-- Rollback: at the end (commented out). Every changed settings row keeps its old values in notes.

-- ============================================================
-- STEP 0 — before (read-only)
-- ============================================================
-- 0.1 every settings row touched below
SELECT location_id, product_id, min_stock_qty_base AS min, target_stock_qty_base AS target,
       max_stock_qty_base AS max, is_critical_for_location AS crit, left(notes, 60) AS notes
  FROM location_product_settings
 WHERE (location_id = 'BROWARY' AND product_id IN ('P019', 'P043', 'P044'))
    OR (location_id = 'WOLA' AND product_id IN ('P128', 'P129', 'P130', 'P064', 'P065', 'P190', 'P191'))
    OR (product_id = 'P121')
    OR (location_id = 'KEN' AND product_id IN ('P024', 'P179', 'P127', 'P131'))
 ORDER BY location_id, product_id;
-- 0.2 every catalog row touched or relied on below
SELECT supplier_product_id, supplier_id, location_id, active, purchase_unit, units_per_purchase_unit AS upp,
       rounding_rule, case_unit, units_per_case, order_note, price_estimate_pln
  FROM supplier_products
 WHERE supplier_product_id IN ('SP_MORY_P019', 'SP_MORY_P128', 'SP_MORY_P129', 'SP_MORY_P130',
                               'SP_BLUESERV_P121', 'SP_FILBER_P136', 'SP_FILBER_P137', 'SP_FILBER_P138',
                               'SP_FILBER_P157', 'SP_COCACOLA_P190', 'SP_COCACOLA_P191', 'SP_PAGO_P024',
                               'SP_SPEC_P179')
 ORDER BY 1;
-- 0.3 open orders on the touched products (2.6 refuses to run while WOLA has open Cappy PET lines)
SELECT o.order_id, o.location_id, o.status, ol.product_id
  FROM orders o JOIN order_lines ol USING (order_id)
 WHERE o.status IN ('captain_submitted', 'manager_claimed')
   AND ol.product_id IN ('P019', 'P043', 'P044', 'P121', 'P128', 'P129', 'P130', 'P136', 'P137', 'P138',
                         'P157', 'P064', 'P065', 'P024')
 ORDER BY o.location_id, o.order_id;

-- ============================================================
-- 2.1 BROWARY souvlaki spice -> 0,5/2/2 kg
-- ============================================================
DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supplier_products WHERE supplier_product_id = 'SP_MORY_P019' AND active) THEN
    RAISE EXCEPTION '2.1: SP_MORY_P019 not active — re-diff';
  END IF;
  UPDATE location_product_settings
     SET min_stock_qty_base = 0.5, target_stock_qty_base = 2, max_stock_qty_base = 2,
         notes = notes || format(' [2026-10-17 przed %s/%s/%s; Marek 12.10: max 2 kg, zamawiać poniżej 0,5]',
                                 min_stock_qty_base::float8, target_stock_qty_base::float8,
                                 max_stock_qty_base::float8)
   WHERE location_id = 'BROWARY' AND product_id = 'P019'
     AND NOT (min_stock_qty_base = 0.5 AND target_stock_qty_base = 2 AND max_stock_qty_base = 2);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '2.1: expected 1 row, got % (missing or already 0,5/2/2)', n; END IF;
  RAISE NOTICE '2.1 applied: BROWARY__P019 0,5/2/2';
END $$;

-- ============================================================
-- 2.2 BROWARY mustard / mayo: kg values -> 1/2/2 szt
-- ============================================================
DO $$
DECLARE n int;
BEGIN
  UPDATE location_product_settings
     SET min_stock_qty_base = 1, target_stock_qty_base = 2, max_stock_qty_base = 2,
         notes = notes || format(' [2026-10-17 przed %s/%s/%s (wpisane w kg); Marek 29.09: 1/2 szt]',
                                 min_stock_qty_base::float8, target_stock_qty_base::float8,
                                 max_stock_qty_base::float8)
   WHERE location_id = 'BROWARY'
     AND ((product_id = 'P043' AND target_stock_qty_base = 6)
       OR (product_id = 'P044' AND target_stock_qty_base = 8));
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '2.2: expected 2 rows (P043 target 6, P044 target 8), got % — re-diff', n; END IF;
  RAISE NOTICE '2.2 applied: BROWARY__P043/P044 1/2/2';
END $$;

-- ============================================================
-- 2.3 WOLA rolls: in packs, max 5 packs
-- ============================================================
DO $$
DECLARE n int; r record;
        v_pack_p128 numeric := NULL;  -- OPERATOR: rolls per pack of 57/20 (Mory), e.g. 10; NULL = skip
        v_pack_p130 numeric := NULL;  -- OPERATOR: rolls per pack of 57/30 (Mory); NULL = skip
        v_max_packs numeric := 5;     -- Marek 29.09: "max 5 op"
BEGIN
  -- P129: pack of 6 already on the catalog row
  IF NOT EXISTS (SELECT 1 FROM supplier_products WHERE supplier_product_id = 'SP_MORY_P129' AND active
                    AND units_per_purchase_unit = 1 AND case_unit = 'opak' AND units_per_case = 6) THEN
    RAISE EXCEPTION '2.3: SP_MORY_P129 is not szt×1 with case opak×6 — re-diff';
  END IF;

  FOR r IN SELECT * FROM (VALUES ('P128', v_pack_p128), ('P129', 6::numeric), ('P130', v_pack_p130))
           AS v(pid, pack)
  LOOP
    IF r.pack IS NULL THEN
      RAISE NOTICE '2.3: % skipped — pack size unknown (needs Marek)', r.pid;
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM location_product_settings WHERE location_id = 'WOLA' AND product_id = r.pid
                  AND target_stock_qty_base = v_max_packs * r.pack AND notes LIKE '%max % op ×%') THEN
      RAISE NOTICE '2.3: % already at max % — nothing to do', r.pid, v_max_packs * r.pack;
      CONTINUE;
    END IF;
    IF r.pid <> 'P129' THEN
      UPDATE supplier_products SET case_unit = 'opak', units_per_case = r.pack,
             notes = notes || format('; 2026-10-17 opak = %s szt (Marek: rolki na paczki)', r.pack::float8)
       WHERE supplier_product_id = 'SP_MORY_' || r.pid AND active AND units_per_purchase_unit = 1
         AND case_unit IS NULL AND r.pack > 1;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n <> 1 THEN RAISE EXCEPTION '2.3 %: case update expected 1, got %', r.pid, n; END IF;
    END IF;
    UPDATE location_product_settings
       SET target_stock_qty_base = v_max_packs * r.pack, max_stock_qty_base = v_max_packs * r.pack,
           notes = notes || format(' [2026-10-17 przed %s/%s/%s; Marek 29.09: na paczki, max %s op × %s]',
                                   min_stock_qty_base::float8, target_stock_qty_base::float8,
                                   max_stock_qty_base::float8, v_max_packs::float8, r.pack::float8)
     WHERE location_id = 'WOLA' AND product_id = r.pid
       AND min_stock_qty_base <= v_max_packs * r.pack;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION '2.3 %: expected 1 WOLA row with min <= %, got %', r.pid, v_max_packs * r.pack, n; END IF;
    RAISE NOTICE '2.3 applied: WOLA__% max %', r.pid, v_max_packs * r.pack;
  END LOOP;
END $$;

-- ============================================================
-- 2.4 Sponges: 0,5/1,5 packs of 10 = 5/15/15 szt at the 7 Warsaw locations (D17)
-- ============================================================
DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supplier_products WHERE supplier_product_id = 'SP_BLUESERV_P121' AND active
                    AND units_per_purchase_unit = 1 AND case_unit = 'opak' AND units_per_case = 10) THEN
    RAISE EXCEPTION '2.4: SP_BLUESERV_P121 is not szt×1 with case opak×10 — re-diff';
  END IF;
  IF (SELECT inventory_unit FROM products WHERE product_id = 'P121') <> 'szt' THEN
    RAISE EXCEPTION '2.4: P121 inventory unit is not szt — re-diff';
  END IF;
  UPDATE location_product_settings
     SET min_stock_qty_base = 5, target_stock_qty_base = 15, max_stock_qty_base = 15,
         notes = notes || format(' [2026-10-17 przed %s/%s/%s; D17 Marek: 0,5/1,5 opak po 10]',
                                 min_stock_qty_base::float8, target_stock_qty_base::float8,
                                 max_stock_qty_base::float8)
   WHERE product_id = 'P121'
     AND location_id IN ('WOLA', 'BRACKA', 'BROWARY', 'KEN', 'NORBLIN', 'ELEKTROWNIA', 'WESTFIELD')
     AND NOT (min_stock_qty_base = 5 AND target_stock_qty_base = 15 AND max_stock_qty_base = 15);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 7 THEN
    RAISE EXCEPTION '2.4: expected 7 rows, got % — a Warsaw location has no P121 row or is already 5/15/15', n;
  END IF;
  RAISE NOTICE '2.4 applied: P121 5/15/15 at 7 locations';
END $$;

-- ============================================================
-- 2.5 Corfu "box" -> "karton"
-- ============================================================
DO $$
DECLARE n int;
BEGIN
  UPDATE supplier_products
     SET purchase_unit = 'karton',
         order_note = CASE WHEN order_note = '1 box = 12 szt' THEN '1 karton = 12 szt' ELSE order_note END,
         notes = notes || '; 2026-10-17 box -> karton (porzadek-data)'
   WHERE supplier_product_id IN ('SP_FILBER_P136', 'SP_FILBER_P137', 'SP_FILBER_P138', 'SP_FILBER_P157')
     AND purchase_unit = 'box' AND units_per_purchase_unit = 12;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION '2.5: expected 4 Corfu rows box×12, got % — re-diff', n; END IF;
  RAISE NOTICE '2.5 applied: Corfu in karton';
END $$;

-- ============================================================
-- 2.6 WOLA Cappy -> glass 0,25 l, crate of 24 (= feedback-1001 1.11b)
-- ============================================================
DO $$
DECLARE n int; v_loc text := 'WOLA'; v_pet_mn numeric := 12; v_pet_mx numeric := 36;
        v_max numeric := 48;  -- OPERATOR: 48 (2 crates, default) or 24 (1 crate)
BEGIN
  IF (SELECT count(*) FROM products WHERE product_id IN ('P190', 'P191') AND active) <> 2
     OR (SELECT count(*) FROM supplier_products
          WHERE supplier_product_id IN ('SP_COCACOLA_P190', 'SP_COCACOLA_P191') AND active) <> 2 THEN
    RAISE EXCEPTION '2.6: P190/P191 or their Coca-Cola rows missing — re-diff';
  END IF;
  SELECT count(*) INTO n FROM orders o JOIN order_lines ol USING (order_id)
   WHERE o.location_id = v_loc AND o.status IN ('captain_submitted', 'manager_claimed')
     AND ol.product_id IN ('P064', 'P065');
  IF n > 0 THEN RAISE EXCEPTION '2.6: % open Cappy PET line(s) at WOLA — retry when the queue is clear', n; END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id = v_loc AND product_id IN ('P190', 'P191')) THEN
    RAISE EXCEPTION '2.6: WOLA glass rows already exist';
  END IF;

  INSERT INTO location_product_settings
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT v_loc || '__' || m.glass, v_loc, m.glass, s.min_stock_qty_base, v_max, v_max,
         s.is_critical_for_location, s.allow_over_max_due_to_packaging,
         format('2026-10-17 porzadek-data (feedback-1001 1.11b): Cappy szkło 0,25 l, skrzynka 24 (Tushar 04.10); z %s %s/%s/%s',
                m.pet, s.min_stock_qty_base::float8, s.target_stock_qty_base::float8,
                s.max_stock_qty_base::float8)
    FROM location_product_settings s
    JOIN (VALUES ('P064', 'P190'), ('P065', 'P191')) AS m(pet, glass) ON m.pet = s.product_id
   WHERE s.location_id = v_loc AND s.min_stock_qty_base = v_pet_mn
     AND s.target_stock_qty_base = v_pet_mx AND s.max_stock_qty_base = v_pet_mx;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '2.6: glass insert expected 2, got % — PET rows are not 12/36/36', n; END IF;

  DELETE FROM location_product_settings WHERE location_id = v_loc AND product_id IN ('P064', 'P065');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '2.6: PET delete expected 2, got %', n; END IF;
  RAISE NOTICE '2.6 applied: WOLA Cappy glass max %', v_max;
END $$;

-- ============================================================
-- 2.7 KEN gyros: 3 blocks of 15 kg = 45 kg
-- ============================================================
DO $$
DECLARE n int;
        v_pid text := 'P024';      -- OPERATOR: P024 pork (Pago, default) or P179 chicken (Spec Food)
        v_sp  text := CASE v_pid WHEN 'P024' THEN 'SP_PAGO_P024' ELSE 'SP_SPEC_P179' END;
        v_kg  numeric := 45;       -- 3 × 15 kg
BEGIN
  IF (SELECT inventory_unit FROM products WHERE product_id = v_pid) <> 'kg'
     OR NOT EXISTS (SELECT 1 FROM supplier_products WHERE supplier_product_id = v_sp AND active
                       AND units_per_purchase_unit = 15) THEN
    RAISE EXCEPTION '2.7: % is not kg or % is not an active 15 kg block — re-diff', v_pid, v_sp;
  END IF;
  UPDATE location_product_settings
     SET target_stock_qty_base = v_kg, max_stock_qty_base = v_kg,
         notes = notes || format(' [2026-10-17 przed %s/%s/%s; Khushi 08.10: 3 szt (bloki 15 kg) do następnej dostawy]',
                                 min_stock_qty_base::float8, target_stock_qty_base::float8,
                                 max_stock_qty_base::float8)
   WHERE location_id = 'KEN' AND product_id = v_pid AND min_stock_qty_base <= v_kg
     AND target_stock_qty_base <> v_kg;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION '2.7: expected 1 KEN__% row with min <= 45 and target <> 45, got %', v_pid, n; END IF;
  RAISE NOTICE '2.7 applied: KEN__% target/max % kg', v_pid, v_kg;
END $$;

-- ============================================================
-- 2.8 Envelopes / staples on Mory (D18) — READ-ONLY check, nothing to write
-- ============================================================
-- Repo state: SP_MORY_P131 (Koperty, box×1) and SP_MORY_P127 (Zszywki, opak×1) are active; the Pago
-- rows are inactive; there are no Blue Service rows (track B dropped). So D18 "Mory" is already
-- the catalog state. The open part of D18 is whether KEN's Mory orders actually went out.
-- (a) expect SP_MORY_P127/P131 active; no other active row for P127/P131 in Warsaw scope
SELECT supplier_product_id, supplier_id, location_id, active, purchase_unit, price_estimate_pln
  FROM supplier_products WHERE product_id IN ('P127', 'P131') ORDER BY active DESC, 1;
-- (b) KEN Mory orders since 15.09 and their status. Expect ORD-20261004-KEN-MORY-06569d. If it is
--     still manager_claimed, Ben/Marek decide: mark it sent (if it was sent outside the app) or cancel.
SELECT o.order_id, o.status, o.captain_submitted_at::date AS submitted, o.manager_sent_at::date AS sent,
       o.sent_method, string_agg(ol.product_id, ',' ORDER BY ol.product_id) AS products
  FROM orders o LEFT JOIN order_lines ol USING (order_id)
 WHERE o.location_id = 'KEN' AND o.supplier_id = 'SUP_MORY' AND o.order_date >= DATE '2026-09-15'
 GROUP BY 1, 2, 3, 4, 5 ORDER BY 3;
-- (c) does KEN have settings rows for P127 / P131? (Khushi asks for envelopes and staples)
SELECT location_id, product_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base
  FROM location_product_settings WHERE location_id = 'KEN' AND product_id IN ('P127', 'P131');
-- "Spinacze" (paper clips) has no product. Not created here: needs Marek (is it clips, or the
-- staples P127 that Khushi and Marek name?).

-- ============================================================
-- AUDIT (after the blocks you ran)
-- ============================================================
SELECT location_id, product_id, min_stock_qty_base AS min, target_stock_qty_base AS target,
       max_stock_qty_base AS max, right(notes, 90) AS notes_tail
  FROM location_product_settings
 WHERE notes LIKE '%2026-10-17%'
   AND (product_id IN ('P019', 'P043', 'P044', 'P121', 'P128', 'P129', 'P130', 'P190', 'P191', 'P024', 'P179'))
 ORDER BY product_id, location_id;
-- expected: 2.1 BROWARY P019 0,5/2/2 · 2.2 BROWARY P043/P044 1/2/2 · 2.3 WOLA P129 */30/30 (+P128/P130
-- if filled) · 2.4 seven P121 rows 5/15/15 · 2.6 WOLA P190/P191 12/48/48 (or 24) · 2.7 KEN P024 */45/45
SELECT supplier_product_id, purchase_unit, units_per_purchase_unit, order_note, case_unit, units_per_case
  FROM supplier_products
 WHERE supplier_product_id IN ('SP_FILBER_P136', 'SP_FILBER_P137', 'SP_FILBER_P138', 'SP_FILBER_P157',
                               'SP_MORY_P128', 'SP_MORY_P130')
 ORDER BY 1;
-- expected: 4 Corfu rows karton×12 '1 karton = 12 szt'
-- 2.6: WOLA must have NO P064/P065 row and both P190/P191 rows
SELECT product_id FROM location_product_settings WHERE location_id = 'WOLA'
   AND product_id IN ('P064', 'P065', 'P190', 'P191') ORDER BY 1;  -- expect P190, P191
-- Live check (GET only, WOLA code): Coca-Cola tab shows "Cappy … 0,25 l szkło" with "skrzynka" hint.

-- ============================================================
-- ROLLBACK (commented out). Old threshold values are in each row's notes "[2026-10-17 przed a/b/c …]".
-- ============================================================
-- 2.1 / 2.2 / 2.4 / 2.7: put back the "przed" values from notes, row by row, e.g.
--   UPDATE location_product_settings SET min_stock_qty_base = <a>, target_stock_qty_base = <b>,
--          max_stock_qty_base = <c> WHERE location_id = '<LOC>' AND product_id = '<PID>';
-- 2.3: as above for WOLA P128/P129/P130; for P128/P130 also
--   UPDATE supplier_products SET case_unit = NULL, units_per_case = NULL
--    WHERE supplier_product_id IN ('SP_MORY_P128', 'SP_MORY_P130');
-- 2.5:
--   UPDATE supplier_products SET purchase_unit = 'box',
--          order_note = CASE WHEN order_note = '1 karton = 12 szt' THEN '1 box = 12 szt' ELSE order_note END
--    WHERE supplier_product_id IN ('SP_FILBER_P136','SP_FILBER_P137','SP_FILBER_P138','SP_FILBER_P157');
-- 2.6 (only while no order line references P190/P191 at WOLA):
--   BEGIN;
--   INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base,
--     target_stock_qty_base, max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
--   SELECT 'WOLA__' || m.pet, 'WOLA', m.pet, s.min_stock_qty_base, 36, 36, s.is_critical_for_location,
--          s.allow_over_max_due_to_packaging, 'rollback 2.6 porzadek-data'
--     FROM location_product_settings s JOIN (VALUES ('P064','P190'), ('P065','P191')) AS m(pet, glass)
--       ON s.product_id = m.glass WHERE s.location_id = 'WOLA';
--   DELETE FROM location_product_settings WHERE location_id = 'WOLA' AND product_id IN ('P190','P191');
--   COMMIT;
