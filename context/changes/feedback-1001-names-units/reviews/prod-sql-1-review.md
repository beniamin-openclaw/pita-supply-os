# Review: prod SQL drafts, Phase 1 and Phase 1b (feedback-1001-names-units)

- **Reviewed:** `prod-sql-1.sql`, `prod-sql-1-diff.md`, `prod-sql-1b.sql`, `prod-sql-1b-diff.md` (commit 3e25562), against
  `plan.md` (Phase 1, Phase 1b, D31–D36), `plan-draft.md` (D1–D30), `names.md`, `reviews/plan-review.md` and lessons.md
  "Master-data ops: diff before, audit after".
- **Date:** 2026-10-01. **Mode:** adversarial, read-only on prod.
- **Verdict:** no blocking finding survives verification. Five should-fix items were small and unambiguous, and are
  applied to the SQL and diff files. Four should-fix items need an operator decision and stay open.

## What was verified

**Prod reads** (Supabase `lpzhphufjwrndfogkfub`, SELECT only, about 17:15–17:40 CEST):

- Before-state of every guarded value matches the guards:
  - 50 products;
  - 72 supplier rows of the touched products, including inactive Selgros and Kuchnie rows;
  - 150 setting rows of the touched products, including inactive locations.
- Constraints on `products`, `supplier_products` and `location_product_settings` are compatible with every insert:
  - PKs, the product and supplier FKs, `UNIQUE (location_id, product_id)`, the `rounding_rule` CHECK;
  - NOT NULL columns and their defaults (`notes` is `NOT NULL DEFAULT ''`, so `notes || …` is safe);
  - `order_note varchar(60)`.
  - There is no `(supplier_id, product_id)` uniqueness, so `SP_INTERMLECZ_P017_H` can sit next to the old row.
- P190/P191 are free. The highest ID is P189 (189 products). No order line or inventory line references P190/P191.
- No product, setting or Coca-Cola supplier row has `inventory_order` or `display_order` set.
- Audit row 3 holds on prod after 1.1: only P026 "Pita (opakowania) szt 10" is left, and it is excluded.
- Audit row 19 holds today: no placeholder e-mails.
- Open lines today:
  - KEN `ORD-20260930-KEN-COCA-b8acbc` (P065) is still `manager_claimed`, so 1.11d stays blocked;
  - WOLA `ORD-20261001-WOL-INTE-8971b4` (P052, sent 01.10) blocks 1b.4;
  - the stale BRACKA `c673c7` (P068/P069, claimed since 02.09) has no setting row to delete;
  - the ELEKTROWNIA Mory order `c48d59` moved to `manager_claimed` after the diff was written (information only).
- Receipt timing, which is the evidence for the 1b window:
  - the first receipt flips `manager_sent` → `closed`, so no `manager_sent` order ever has a receipt;
  - over 113 receipted orders, the first receipt came at most 6.7 days after sending (p95 2.7 days, none over 7);
  - `manager_sent` today: 54 orders (12 under 7 days, 6 at 7–14 days, 36 over 14 days); none has a NULL
    `manager_sent_at`.

**Local dry run (Postgres 16, re-run by the reviewer on a fresh copy of the previous agent's template `pita_tpl`):**

- Template fidelity:
  - every guarded or written column of the touched rows matches prod (per-row hashes);
  - only `products.gostock_id` and the `notes` of products, supplier rows and inactive-location settings are blank
    in the template;
  - no guard, write or rollback reads those columns.
- Results before and after the fixes below:
  - run 1 applies, except the blocked blocks;
  - run 2 raises in every block, and the table checksums are unchanged;
  - the unblock paths apply cleanly, with audits 21 of 21 (Phase 1) and 10 of 10 (1b);
  - STEP R of 1b, then STEP R of Phase 1, restore `products`, `supplier_products` and `location_product_settings`
    byte-identical to the template, including on a copy where the blocked steps never ran.
- Guard test: moving NORBLIN P050 max to 2 makes the new 1b.2 kept-row check raise.

**Code read on `origin/main`:**

- `suggestion.py:58-73`: the rounding rules.
- `main.py` `_evaluate_submit_line`: the over-MAX gate fires only for uncounted lines.
- `compute.ts:110-122`: the same gate on the frontend.
- `gmail_url.py`: the e-mail line format `N.  | <supplier_product_name> | <qty> <unit>`; `paczka` and `szt` are in the
  declension tables on both sides.
- `product_order.py:80-84`: a NULL position sorts last.
- Nothing parses `supplier_product_id`, and nothing hard-codes `blok` or `opak`.

## Checklist from the brief

| Check | Result |
|---|---|
| Every guard re-checks before-state and row counts | Yes in Phase 1: exact names, exact thresholds, exact unit/upp/price, inserts derived from the exact before-row, deletes counted. One gap in 1b: the "kept" spice rows were not re-checked. **Fixed** (S4). |
| Nothing touches inactive locations | Yes. Every location-scoped write names active locations only. Product-level writes (names, `inventory_unit`, `active`) are global by nature (see O5). |
| Deletes cannot orphan open orders | Yes for `captain_submitted` / `manager_claimed`, guarded per location. `manager_sent` post-send edits, receipts and the detail screens do not need the setting row. Residual race: O3. |
| P190/P191 satisfy NOT NULL / CHECK / FK; position semantics | Yes. `inventory_order` / `display_order` NULL is correct today. The cross-change effect is S7. |
| Names match names.md and decisions; no "(opakowania)" left | Yes, with documented deviations (Prymat names per D28; Ziele = Prymat 600 g per plan line 174). "Diament" fixed (S1). Only P026 keeps "(opakowania)", on purpose. |
| Units label-only where claimed | Yes. Gyros upp 15/25/15 unchanged; frytki and batat upp 1; P055 opak → szt with upp 1. P050–P052 kg → szt changes meaning and is correctly in 1b. |
| Rollback complete and exact | Yes, byte-identical (see the dry run). One addition: a deactivate path when P190/P191 are already referenced (in the R 1.11a comment now). |
| Audit asserts what the plan says | Yes, plus two rows added (S3). Small gap: O7. |
| 14-day window relaxation of the 1b guard | Sound (O1): it rests on prod data. The evidence is now in the SQL header and the diff. |
| Polish typos | "Diament" → "Diamant" (S1). Everything else is correct: jednoczęściowe, pojedyncze, Aluminiowa, Effo, odsączeniu, skrzynki, słoik. |
| Numbers | Cola and Cappy crates of 24 confirmed by invoices ("0.25 RGB X24"). Rolls 12/30 and 12/24 = 2/5 and 2/4 opak of 6 (D24). Oliwki: bidon 2 kg = SP upp 2, invoice 45,31; 1/1/2 kg per D17. Liść: 80 g box at 14,70. Papryka słodka 25,76 = KEN invoice line. Cappy price: S5. |

## Findings

### Blocking (CRITICAL)

None.

### Should-fix (WARNING), applied in this review

**S1. P189 screen name spells the brand "Diament".**
- **Scenario:** the invoice reads "DIAMANT CUKIER KOSTKA", and the brand is Diamant. Marek's sheet has the typo, as it
  has "Eppo". names.md already fixed "Eppo" → "Effo" on the same grounds.
- **Fix (applied):** new name "Cukier w kostkach Diamant 0,5kg" in 1.1 and in audit row 1.
- **Follow-up:** `plan.md:173` still says "Diament"; the plan owner should align it.

**S2. The P064/P065 "… 0,33 l PET" rename in 1.11a reaches glass locations that have not switched yet.**
- **Scenario:**
  - Names are joined live, and Coca-Cola is a `portal` supplier.
  - KEN's claimed order `b8acbc` has a P065 line (2 zgrzewki). That line is what blocks 1.11d.
  - If 1.11a runs and the Manager dispatches `b8acbc` afterwards, the portal copy list reads
    "Cappy Pomarańcza 0,33 l PET". The Manager can pick PET for a location that stocks glass.
  - The same holds for any glass location whose switch is still pending.
- **Fix (applied):** the two renames moved out of 1.11a into a new last block, 1.11h. It raises while any of the six
  glass locations still has a P064/P065 row, or an open P064/P065 line. Audit row 14 no longer checks the rename; new
  row 20 does (pending until 1.11h). The header, STEP 0 comments, rollback comment and diff are updated.

**S3. The audit did not assert the Cappy glass threshold values.**
- **Scenario:** row 15 counted the glass rows per location but not their values. A wrong `v_max` edit or a wrong
  `min` would pass the audit.
- **Fix (applied):** new audit row 21:
  - every P190/P191 row has min = the PET min, target = max, and max 24;
  - WOLA and KEN may have 48 or 24, the operator's choice;
  - at least 10 rows exist.

**S4. 1b.2–1b.5 did not re-check the thresholds they keep.**
- **Scenario:**
  - From each block on, the six kept rows per spice (WOLA, BRACKA, ELEKTROWNIA, NORBLIN, WESTFIELD, KEN) are read in
    jars.
  - 1b runs on a later full-count day.
  - If one of those rows was edited in the meantime (for example a kg value typed in), it would be reinterpreted
    without review.
  - lessons.md asks every block to re-check the before-state it depends on.
- **Fix (applied):** each block asserts that the six kept rows still hold the diff values (count = 6), and raises
  "expected 6 kept threshold rows as reviewed" otherwise. Tested.

**S6. BROWARY P055 converted to 0,5/0,5/0,5 jar: max below one jar.**
- **Scenario:**
  - The smallest orderable quantity is 1 jar (`full_only`).
  - An uncounted 1-jar order is 1 > max 0,5, so the submit returns 400 "ordered over MAX without reason_code"
    (`main.py` uncounted branch, `compute.ts:115-122`).
  - Every BROWARY Captain who skips the count gets a forced reason for an ordinary order.
- **Fix (applied):** 0,5/1/1, the same as KEN's 1b.6 result. Rule added to the diff: max is never below one jar.
  Audit row 7 is updated; the rollback is unchanged (it restores 0,01/0,1/0,1).

### Should-fix (WARNING), open: operator decision

**S5. Cappy glass price 100,32 is the pre-discount unit price; the paid netto is 75,24.**
- **Evidence:** KEN invoice 2424225127 (06.08), "0.25 RGB X24 CAPPY APPLE / ORANGE": 1 CS, unit price 100,32,
  line netto 75,24.
- **How other prices were set:** prod prices are the paid netto (oliwki 45,31 = line netto). The Coca-Cola glass lines
  show the unit-price column is unreliable (84–177 for the same ~60,67 netto per crate).
- **Scenario:** order totals overstate Cappy by a third. Coca-Cola has a 500 zł minimum, so the minimum chip can read
  "met" too early.
- **Fix:** set 75,24 in 1.11a (supplier insert, the `notes` text, and audit row 14), or confirm 100,32 deliberately.
- **Related open point in the diff:** Coca-Cola glass P186/P187 have no price. The invoices give about 60,67 (Cola) and
  58,87 (Zero) per crate.

**S7. Interaction with the pending `inventory-card-order` positions batch.**
- **What the other batch does:** `context/changes/inventory-card-order/prod-sql.sql` maps the printed cards:
  - Cappy to P064/P065 at every location;
  - can Cola to P068/P069 at ELEKTROWNIA and BROWARY.
- **Scenario:**
  - After 1.10 and 1.11 those rows no longer exist at the switched locations.
  - If the positions batch runs after this one, P190/P191 become "extras" at the end of the Napoje section, not after
    P064/P065 as the plan says.
  - If it runs before, P190/P191 have no position and sort at the very end of the inventory grid
    (`product_order.py:80-84`).
- **Fix:** before that batch runs, map those card rows to P190/P191 and P186/P187 at the switched locations, or re-run
  its pipeline after 1.11h. Do not hand-set `inventory_order` here: that batch owns it and clears it. Added to the diff
  open points.

**S8. The Prymat jar names (1.1) reach the supplier e-mail before the units change (1b).**
- **Scenario:**
  - P050/P051/P052 keep purchase unit `kg` until 1b.2–1b.4.
  - Until then, an Intermlecz e-mail line reads "PRYMAT OREGANO 110g/6 pet | 1 kg", which a supplier can read as 9
    jars of 110 g.
  - This is the same contradiction for which P017's rename was moved to 1b.
- **Fix:** move those three renames (screen and supplier) into 1b.2–1b.4, or schedule 1b right after Phase 1 with no
  Intermlecz dispatch in between. Added to the diff open points.

**S9. P121 "Gąbka do naczyń 10szt" while it is counted per sponge.**
- **Scenario:** the unit is `szt` and the thresholds are ×10 (sponges). The name invites counting packs into the szt
  field, which understates stock tenfold until Phase 4 adds the opak-10 case.
- **Fix:** rename P121 together with Phase 4, or use "Gąbka do naczyń (opak. 10 szt)". Added to the diff open points.

### Optional (OBSERVATION)

**O1. The 14-day window in 1b is sound.**
- "`manager_sent` without a receipt" is the same as "`manager_sent`", because the first receipt closes the order.
- With a receipt lag of at most 6,7 days on prod, an order older than 14 days is an unconfirmed delivery.
- If such an order is confirmed late, its line reads "N szt" with upp 1, which is harmless.
- An explicit list of exempt order IDs (the ones in the diff) would be stricter if the full-count day slips by weeks;
  the 14-day bound is enough given the data. The evidence is now in the SQL header and the diff.

**O2. Cappy glass with `is_critical = false` uses the non-critical rounding of `up_for_critical`.**
- Until the Phase 3 half-up fix (plan-review F4) is merged, the backend `round()` and the frontend `Math.round` disagree
  at half a crate.
- Example: stock 12 against target 24 gives 0 on the backend and 1 on the frontend. A Captain who orders 1 crate gets
  an "(info)" warning and `delta = NULL` stored, but no 400 (targets ≤ 48 never reach 2,5 crates).
- Either accept this until Phase 3, or apply Phase 1 after Phase 3 is live.

**O3. Check-then-delete race in 1.10a/c and 1.11b–g.**
- A Captain submit that lands between the open-line count and the commit (milliseconds) is not seen by the guard.
- To close it, add `LOCK TABLE order_lines IN SHARE MODE;` at the start of those blocks. It blocks inserts for the
  length of the block.

**O4. Flags on new glass rows.**
- At ELEKTROWNIA and BROWARY, 1.10a/c copy `crit = false`, `aomp = false` from the can rows (WESTFIELD stays false).
- The existing glass rows at WOLA, BRACKA and KEN are `true` / `true`.
- Only the uncounted over-MAX gate reads the flag, and max is a whole crate, so the impact is low. Consider `aomp = true`
  for consistency.

**O5. Product-level changes and inactive locations.**
- Unit changes (1b) and renames are global.
- Inactive-location settings keep their old numbers: for example, FORUM P017 0,5/1,5 is then read in opak.
- Re-check these rows when a location is re-activated.

**O6. Editing an old inventory count.**
- After 1.10/1.11 delete the PET and can rows, and after 1.5/1.6 deactivate products, a Captain who edits a count made
  earlier cannot keep those lines.
- Depending on how the edit screen builds its line set, they are either refused (400 "no location_product_setting") or
  dropped and logged as "usunięto".
- This is a pre-existing behaviour class; the staff message could say "do not edit counts from before the switch".

**O7. Audit gap.**
- The plan's audit says the P177/P185 setting rows are kept. Row 8 checks this for P139 only.
- Add a count of the P177/P185 rows to row 7 if you want it asserted.

**O8. Diff snapshot drift.**
- The ELEKTROWNIA Mory order `c48d59` is now `manager_claimed`, not `captain_submitted`.
- Thresholds only (1.9), so it is information only.

## Files changed by this review

- `prod-sql-1.sql`: S1, S2 (new block 1.11h, header, STEP 0 and rollback comments), S3 (audit rows 20 and 21).
- `prod-sql-1-diff.md`: S1, S2; sections "Review changes" and "Review open points" (S5, S7, S8, S9); reviewer dry run.
- `prod-sql-1b.sql`: S4 (kept-row checks in 1b.2–1b.5), S6 (BROWARY P055 0,5/1/1, audit row 7), and the 14-day
  evidence in the header.
- `prod-sql-1b-diff.md`: S6, the S4 decision, the 14-day evidence, and the reviewer dry run.
