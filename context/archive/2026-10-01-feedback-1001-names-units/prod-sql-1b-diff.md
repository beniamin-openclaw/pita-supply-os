# Phase 1b — diff for the operator (`prod-sql-1b.sql`)

- **Source:** prod read-only SELECTs, 2026-10-01 ~16:30 CEST. **Nothing has been written to prod** (still pending on 2026-10-02: waits for the full-count day).
- **What it does:** moves papryka P017 and four Prymat spices to per-tin / per-jar counting.
- **When to apply:** on the full-count day, after staff message part 1b has gone out.
- **Why the timing matters:**
  - Counts are stored as bare numbers, and the unit is read live.
  - From the moment a block runs, every earlier count of that product reads in the new unit (szt / opak).
  - The opt-in pre-fill would also offer those old numbers.
  - The staff message must therefore say: count these five products from scratch that day, and do not use pre-fill
    for them.
- **What stays as is:** no history is rewritten. Old order lines on the retired papryka row still read in kg.
- **How it runs:** one block per product, one block per execution. Each block re-checks its before-state.

## Summary

| Block | What | Rows | Today |
|---|---|---|---|
| 1b.1 | P017 → Helcom per opak; new row SP_INTERMLECZ_P017_H, old Florinis row retired | +1 supplier row, 1 retired, 1 product, 7 thresholds | runs |
| 1b.2 | P050 pieprz kg → szt, 43,79 → 47,60, Prymat names | 1 product, 1 supplier row, BROWARY 1 threshold | runs |
| 1b.3 | P051 oregano kg → szt, 30,71 → 11,30, Prymat names | same | runs |
| 1b.4 | P052 papryka słodka kg → szt, 25,76 unchanged, Prymat names | same | **blocked** (see below) |
| 1b.5 | P055 ziele `opak` → `szt` (label only), 40,83 → 43,90, Prymat names (replaces Kamis) | same | runs |
| 1b.6 | **Optional:** KEN spice thresholds read as kg | 4 thresholds | only if you choose it |

## 1b.1 Papryka P017 (D27)

| | Before | After |
|---|---|---|
| Product P017 | "Papryka grillowana grecka Florina (Florinis)", unit **kg** | "Helcom Papryka Grillowana Czerwona 4,2kg/2,5kg", unit **opak** |
| SP_INTERMLECZ_P017 | active, opak × 3,6 kg, 40,53 | **inactive**, unchanged otherwise (its 10 order lines keep reading in kg) |
| SP_INTERMLECZ_P017_H | — | **new**, active, opak × 1; name as the product |

Details of the new row SP_INTERMLECZ_P017_H:

- price: ∅, to be filled in;
- note: "1 opak = puszka 4,2 kg (2,5 kg po odsączeniu)".

| Location | Thresholds now (kg) | After (opak) | Last count (date) | Unit really entered (my reading) |
|---|---|---|---|---|
| WOLA | 0,5/1,5/1,5 | 0,5/1,5/1,5 | 3,6 (27.09) | kg (= 1 Florinis tin) |
| BRACKA | 0,5/1,5/1,5 | 0,5/1,5/1,5 | 2 (27.09) | unclear |
| KEN | 0,2/2/2 | 0,5/1,5/1,5 | 1,8 (27.09) | kg: 1 tin ordered 04.09, counts 1,9 → 2 → 1,8 |
| BROWARY | 1,4/4,2/4,2 | 0,5/1,5/1,5 | 3,756 (27.09) | kg: scale value; 1 tin ordered 25.09 |
| NORBLIN | 1,8/5,4/5,4 | 0,5/1,5/1,5 | 1,5 (30.09) | unclear (sheet says opak, row says kg) |
| ELEKTROWNIA | 1,8/5,4/5,4 | 0,5/1,5/1,5 | 4,4 (27.09, sent 30.09) | probably kg |
| WESTFIELD | 1,8/5,4/5,4 | 0,5/1,5/1,5 | no count yet | — |

Consequence: until the recount, WOLA, BROWARY and ELEKTROWNIA read as 3,6 / 3,8 / 4,4 opak, which is above max
1,5, so they get no suggestion.

## 1b.2–1b.5 Prymat spices (D28)

| Product | Screen name → | Supplier name → | Unit | Price | Supplier-row note |
|---|---|---|---|---|---|
| P050 | Pieprz → Prymat Pieprz czarny mielony 820g | Pieprz → PRYMAT PIEPRZ CZARNY MIELONY 820g/9 pet | kg → szt | 43,79 → **47,60** | ∅ → "1 szt = słoik 820 g" |
| P051 | Oregano → Prymat Oregano 110g | Oregano → PRYMAT OREGANO 110g/6 pet | kg → szt | 30,71 → **11,30** | ∅ → "1 szt = słoik 110 g" |
| P052 | Papryka słodka - mielona → Prymat Papryka słodka mielona 720g | Papryka słodka - mielona → PRYMAT PAPRYKA SŁODKA 720g/9 pet | kg → szt | 25,76 (unchanged) | ∅ → "1 szt = słoik 720 g" |
| P055 | Ziele Angielskie → Prymat Ziele angielskie 600g | Ziele Angielskie 500g → PRYMAT ZIELE ANGIELSKIE 600g/9 pet | opak → szt | 40,83 → **43,90** | "1 opak = 500 g" → "1 szt = słoik 600 g" |

Upp stays 1. Each name changes in the same block as its unit (main-loop decision 2026-10-01), so no screen or
supplier e-mail shows a jar name next to "kg". Each block guards on the old names. P054 liść is renamed in Phase 1
(1.1), because it is already `opak`.

**Thresholds per location (min / target / max):**

- **Kept**, because they are already in jars (copied 1:1 from Marek's sheet): WOLA, BRACKA, ELEKTROWNIA, NORBLIN,
  WESTFIELD.
- **Converted at BROWARY.** BROWARY is clearly kg (3-decimal scale values). Each value is divided by the jar weight
  and rounded to the nearest 0,5, half up. A positive threshold never becomes 0, and max is never below one jar: an
  uncounted order of one jar above max is refused with "over MAX without reason" (review 2026-10-01).

| | P050 pieprz | P051 oregano | P052 papryka | P055 ziele |
|---|---|---|---|---|
| WOLA (kept) | 0,5/1,5/1,5 | 0,5/1/1 | 0,5/1,5/1,5 | 1/1/1 |
| BRACKA (kept) | 0,5/1,5/1,5 | 0,5/1,5/1,5 | 0,5/1,5/1,5 | 0,5/1,5/1,5 |
| ELEKTROWNIA, NORBLIN, WESTFIELD (kept) | 0,5/1,5/1,5 | 0,5/1,5/1,5 | 0,5/1,5/1,5 | 0,5/1,5/1,5 |
| **BROWARY** | 0,2/0,82/0,82 kg → **0,5/1/1** | 0,5/1/1 kg → **4,5/9/9** ⚠ | 0,36/0,72/0,72 kg → **0,5/1/1** | 0,01/0,1/0,1 (kg typed into opak) → **0,5/1/1** |
| **KEN: keep** (default, 1b.6 not run) | 0,2/1/1 | 0,3/1/1 | 0,2/1/1 | 0,1/0,5/0,5 |
| **KEN: read as kg** (run 1b.6) | 0,5/1/1 | 2,5/9/9 | 0,5/1,5/1,5 | 0,5/1/1 |

⚠ **BROWARY oregano.** 9 jars of 110 g equals the old max of 1 kg, and BROWARY's counts (0,70–0,85 kg) mean about
7 jars on hand. Please check whether BROWARY really keeps that much oregano, or uses a larger pack.

**KEN.** Your choice. Evidence for kg:

- P055: count 0,05 on 13.09, one 500 g pack ordered 16.09, then 0,6 on 20.09. That is 0,05 kg + 0,5 kg. Read as
  jars, it would mean nearly half a jar used in two days.
- P050, P051 and P052 have no orders since August, so there is no evidence for them.
- **Recommendation: run 1b.6 (kg reading).**

**Last counts (the numbers that will be re-read as szt):**

| Location | Date | P050 | P051 | P052 | P055 | Unit really entered (my reading) |
|---|---|---|---|---|---|---|
| WOLA | 27.09 | 1,2 | 1,5 | 0,8 | 1 | jars |
| BRACKA | 27.09 | 1,1 | 3,5 | 1,8 | 0,4 | jars (3,5 kg of oregano is implausible) |
| KEN | 27.09 | 1 | 0,2 | 1 | 0,6 | probably kg (see above) |
| BROWARY | 27.09 | 1,8 | 0,702 | 0,742 | 0,254 | kg (scale) |
| NORBLIN | 30.09 | 0,4 | 0,7 | 0,9 | 0,6 | jars (sheet "Opak") |
| ELEKTROWNIA | 27.09 (sent 30.09) | 0,6 | 0,18 | 0,65 | 0,5 | unclear (look like weights) |
| WESTFIELD | — | — | — | — | — | no count yet |

## Open-order guard and what blocks today

The plan's guard: no line on the supplier row in `captain_submitted` or `manager_claimed`, and none in
`manager_sent` without a receipt.

- **The literal guard never passes.** All 54 `manager_sent` orders on prod have no receipt; the oldest is from
  23.06.
- **What the blocks count instead:** only `manager_sent` orders sent in the last **14 days** (`v_sent_window`). Older
  ones are listed below as stale.
- **To restore the literal guard:** set `v_sent_window := interval '100 years'`. The dry run confirms it then blocks
  all five products.
- **Why 14 days is safe (review, prod read 2026-10-01).** The first receipt flips `manager_sent` → `closed`, so a
  `manager_sent` order never has a receipt; "without a receipt" adds nothing. Over all 113 receipted orders the first
  receipt came at most 6,7 days after sending (p95 2,7 days). Today 36 of the 54 `manager_sent` orders are older than
  14 days: unconfirmed deliveries, not pending ones. If one is confirmed after all, its old line simply reads "N szt"
  (upp stays 1).

| Supplier row | Open lines | Counted by the guard? |
|---|---|---|
| SP_INTERMLECZ_P017 | BRACKA `ORD-20260903-BRA-INTE-e6d497` (sent 03.09); WOLA `ORD-20260623-WOL-INTE-d9570e` (23.06) | no, stale |
| SP_INTERMLECZ_P050 | BRACKA e6d497 (03.09); WOLA `ORD-20260723-WOL-INTE-16a1f7` (23.07) | no, stale |
| SP_INTERMLECZ_P051 | BRACKA e6d497 (03.09) | no, stale |
| SP_INTERMLECZ_P052 | BRACKA e6d497; WOLA 16a1f7; **WOLA `ORD-20261001-WOL-INTE-8971b4` (sent 01.10 12:25 UTC, 1 kg)** | **yes, blocks 1b.4** |
| SP_INTERMLECZ_P055 | WOLA d9570e (23.06) | no, stale |

**1b.4 runs after WOLA confirms the delivery of `ORD-20261001-WOL-INTE-8971b4`.** The order was e-mailed as "1 kg";
the jar that arrives is 720 g.

1b.6 needs all four spices already in szt, so it waits for 1b.4 as well.

## Decisions I made (please confirm or change)

1. **The 14-day window** described above, in place of the literal "no receipt" guard.
2. **Helcom row (SP_INTERMLECZ_P017_H).** Price left empty: no invoice, and Florinis's 40,53 is a different tin.
   The note reads "1 opak = puszka 4,2 kg (2,5 kg po odsączeniu)", from the product name.
3. **Rounding for BROWARY / KEN:** nearest 0,5, half up, and a positive threshold never becomes 0.
4. **Supplier-row notes for the jars:** "1 szt = słoik N g".
5. **One block per product.** A blocked spice (P052 today) does not hold the others. The staff message for part 1b
   should mention papryka słodka only once 1b.4 has run, or say it follows a few days later.
6. **Kept rows are re-checked (review).** 1b.2–1b.5 also assert that the six kept rows per spice (WOLA, BRACKA,
   ELEKTROWNIA, NORBLIN, WESTFIELD, KEN) still hold the values in the table above. They are re-read in szt from that
   block on, so a change after this diff raises instead of being reinterpreted unreviewed.

## Dry run (local Postgres 16, 2026-10-01)

Same copy as Phase 1 (see `prod-sql-1-diff.md`), with `prod-sql-1.sql` applied first, as on prod.

- **Run 1:**
  - 1b.1, 1b.2, 1b.3 and 1b.5 applied.
  - **1b.4 raised:** "P052: 1 open line(s)", the WOLA order sent today.
  - **1b.6 raised:** "run 1b.2..1b.5 first", because P052 is still in kg.
  - Audit: 8 of 10 ok. Rows 5 and 7 are pending on 1b.4.
- **Run 2:** every block raised on its guard. The state is identical to after run 1.
- **Rollback:** STEP R restored the state byte-identical to after `prod-sql-1.sql`.
- **Unblock test:**
  - A receipt was inserted for `ORD-20261001-WOL-INTE-8971b4`.
  - 1b.4 applied, then 1b.6 (KEN, kg) applied.
  - Audit: 10 of 10 ok.
- **Literal guard (`interval '100 years'`):** 1b.1–1b.5 all raise, as described above.
- **Re-run after the main-loop decisions (names in 1b):** run 1 applies 1b.1/1b.2/1b.3/1b.5 (P052 keeps its old name
  while 1b.4 is blocked), audit 8 of 11 ok (rows 5, 7 and 11 pending on 1b.4); run 2 raises in every block
  ("expected 1 row in kg named …"), checksums unchanged; unblock gives 11 of 11. 1b still runs alone on an untouched
  copy, and STEP R of 1b, then of Phase 1, restores the template byte-identical on every variant.
- **Reviewer re-run (after the review changes):** same results (run 1: 1b.4 and 1b.6 raise, audit 8 of 10; run 2:
  every block raises, checksums unchanged; unblock with a receipt: 10 of 10). Moving NORBLIN P050 max to 2 makes 1b.2
  raise "expected 6 kept threshold rows as reviewed, got 5". STEP R of 1b then of Phase 1 restores the template
  byte-identical. 1b also runs on a copy without Phase 1 (1b.1, 1b.3, 1b.5 apply).
