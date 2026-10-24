# porzadek-data-2026-10 — Lane D (prod data): audits, D8 answer, needs-Marek

Prepared 2026-10-17 for Ben (operator). Source contract: `context/changes/porzadek-2026-10/contracts.md`
(Lane D, on branch `claude/projekt-porzadek-plan-80179e`, PR #63).

The agent could **not** read prod on 17.10: the classifier blocked SELECTs through the Supabase MCP too.
Every id in these files therefore comes from the repo (rollout SQL, notes, seed). Every write sits in
a guarded `DO` block that re-checks the "before" state and the row counts, and aborts the whole
transaction on any mismatch. Run each file's **STEP 0** alone first and compare it with the header.

## Paste order

Each file: run **STEP 0** alone, compare it with the file header, then the blocks. Any `ERROR` means
"prod differs from the repo": nothing in that block was written, so re-diff before going on.

1. **`prod-sql-0-audits.sql`** (read-only, any time). It shows the live state that the other files
   assume. Expected results are in sections A–C below.
2. **`prod-sql-1-krk-kat.sql`**: Kraków/Katowice contacts, minimums, the Bukat 16:00 calendar rule,
   the Supersam e-mail and FORUM onion. One transaction.
   - Afterwards, AUDIT (e) / C4 must return 0 rows: no `email` supplier without an address.
   - The Kraków captain should see a 16:00 deadline for Bukat.
3. **`prod-sql-2-warsaw.sql`**: Warsaw. One block per editor run (2.1 … 2.7); skip any you disagree with.
   - 2.3 applies only P129 until the pack sizes of the 57 mm rolls are known.
   - 2.6 needs no open Cappy PET order at Wola; `v_max` is 48 or 24, your choice.
   - 2.7 assumes Khushi meant pork P024; switch to P179 if the screenshot says chicken.
   - 2.8 is read-only (D18).
4. **`prod-sql-3-westfield.sql`**: Westfield/Powiśle. One block per run (3.1 … 3.3). 3.4 is a no-op
   until the paper-roll product is named.
5. **`prod-sql-4-cut-count-only.sql`**: D8, cut halloumi at FORUM and cut gyros at WESTFIELD. One transaction.
6. **`draft-0030-supplier-products-unique.sql`**: only if A1 = 0 rows and A4 ≥ 150000. Then move it into
   `supply-os-v1/migrations/` in a code PR.

After each file, do a GET-only live check with the affected location's code; the steps are listed at
the end of each file. No file sends anything to a supplier.

**Tested locally on 17.10:** all files ran against a scratch Postgres 16 with migrations 0001–0029
and a fixture of the expected "before" rows.
- Every block applied with the expected counts.
- A second run of each block refused (guard error or "already" NOTICE), so nothing was double-applied.
- The 2.6, 3.2 and `prod-sql-4` rollbacks restored the before state.
- The draft index created cleanly.
- This proves the SQL and the guards. It does **not** prove that prod matches the repo; STEP 0 does that.

## A. Duplicate catalog rows (D10)

File `prod-sql-0-audits.sql`, section A.

- **Finding (repo):** `supplier_products` has no uniqueness beyond the PK `supplier_product_id`. Migration
  0029 added only a **non-unique** index on `location_id`. `_build_orderable_items`
  (`supply-os-v1/app/main.py:335-385`) does not dedupe. Two active rows of the same supplier and product
  in one scope therefore give two cards in one order tab, and the card state is keyed by `product_id`
  (warning in `krakow-katowice-rollout/prod-sql-B-suppliers-catalog.sql:415-422`).
  `_primary_supplier_product` (`main.py:3178-3212`) and `suppliers_by_product`
  (`supplier_catalog.py:93-96`) silently pick the lowest id.
- **Last known result:** B(i) duplicate audit = 0 rows on 09.10 (krakow-katowice rollout notes).
- **What each query should return:**

  | Query | Expected | If not |
  |---|---|---|
  | A1 active duplicates | **0 rows** | Deactivate the newer twin (`UPDATE supplier_products SET active=false WHERE supplier_product_id='…'`) after checking which one `order_lines` uses. Do not apply the index. |
  | A2 all duplicates | informational | Inactive twins are harmless. The index is partial (`WHERE active`). |
  | A3 shared + scoped at a non-own-catalog location | **0 rows** | Same fix as A1: two cards at that location. |
  | A4 `server_version_num` | ≥ 150000 | Below 15: drop `NULLS NOT DISTINCT` and add a second partial index `WHERE active AND location_id IS NULL` on (supplier_id, product_id). |

- **Draft migration:** `draft-0030-supplier-products-unique.sql`. This is a partial unique index on
  `(supplier_id, product_id, location_id) NULLS NOT DISTINCT WHERE active`.
  - The app never writes `supplier_products` (`supabase_backend.py` only loads it), so it has no code
    impact. With the index, a twin from a prod-sql script fails with 23505 instead of being created silently.
  - It is kept **outside** `migrations/` because the integration CI applies every file there.
  - Promote it to `supply-os-v1/migrations/0030_…` in a code PR once A1 = 0.

## B. Katowice overstock — Coca-Cola ~56 crates (D10)

File `prod-sql-0-audits.sql`, section B. Background:

- **Supplier:** `SUP_COCACOLA_KAT` (portal, alerts off, minimum NULL). Eight rows scoped to SUPERSAM,
  `SP_COCACOLA_KAT_P064..P071`: Cappy jabłko/pomarańcza, Fanta, Sprite, Coca-Cola, Cola Zero,
  Kropla Beskidu ×2. They were copied from the shared Warsaw rows in B2 on 09.10.
- **Thresholds:** all 24 B2 products at SUPERSAM are **0/0/0**, with notes "[2026-10-09 B2 … progi do
  uzupełnienia]". Prod audit "b2 24/24".
  - With target 0 the engine suggests nothing.
  - **MAX = 0 is not a ceiling.** Nothing in the app stops a captain or the manager from ordering
    50 crates.
  - The ~56 crates (meeting 12.10, `contracts.md:101`) cannot be "over MAX" in the data sense,
    because no MAX exists.
- **Sources disagree:** crosscheck M6 notes that the S24 notes and Marek's 15.10 mail differ on whether
  min/max were loaded. B1 settles it.
- **What each query should return:**
  - **B1:** the SUPERSAM drink thresholds.
    - Expected: still 0/0/0 on P064–P071.
    - Any non-zero values mean somebody entered them by hand. Write them down; `prod-sql-1` does not touch them.
  - **B2:** the latest SUPERSAM count of each Coca-Cola product, in base units and in crates.
    - `over_max_base` only means something once MAX > 0.
  - **B3:** total crates in the latest count. Compare with "~56".
    - Sahil, 12.10: crates of 24 (cola 250 ml, water 330 ml glass).
    - If the catalog row's `units_per_purchase_unit` is not 24, the crate count is off. Check that
      column in B2 first.
  - **B4:** every SUPERSAM order and receipt line of those goods.
    - This shows whether the stock came through the app (and from which order) or arrived outside it.
- **No write in this lane.** Thresholds need Marek's numbers (needs-Marek #5). The overstock report
  itself is Lane M/D16 material (control report).

## C. Readiness per location (D10)

Tokens live only in the Railway env var `SUPPLY_OS_CAPTAIN_TOKENS` (`LOC:token,…`, parsed in
`supply-os-v1/app/auth.py:39-49`; the last pair per location wins). They are **not** in the database
and are **not** written here. Ben checks the names in Railway: Variables → `SUPPLY_OS_CAPTAIN_TOKENS`,
location prefixes only. `require_captain` does not check `locations.active` (`auth.py:52-85`).
`prod-sql-0-audits.sql` C1–C4 give the live columns, and C3 (last count / last submit) is the
practical proof that a token works.

Latest values in the repo (e-mails: `week2-feedback-quantities/prod-sql.sql:138-147`, confirmed
01.10 in `order-email-v2/prod-sql-applied.md`; sender/phone: `order-email-v2/prod-sql.sql:45-62`):

| Location | Active | Own catalog | Location e-mail (DW) | Sender | Phone | Token (per repo docs) | Training |
|---|---|---|---|---|---|---|---|
| WOLA | Y | N | wolskapitabros@gmail.com | biuro@ | Y | yes (pilot, rotated in July) | 01.09 |
| BRACKA | Y | N | pitabrosbracka@gmail.com | bracka@ | Y | yes (r5, re-added 18.08) | 01.09 |
| KEN | Y | N | pitabrosken@gmail.com | ken@ | Y | yes (r5) | 01.09 |
| BROWARY | Y | N | pitabrosbrowary@gmail.com | browary@ | Y | inferred (live since 31.08, no explicit note) | 01.09 |
| NORBLIN | Y | N | norblinpitabros@gmail.com | norblin@ | Y | yes (18.08, GET smoke) | no record |
| ELEKTROWNIA (= Powiśle) | Y | N | pitabroselektrownia@gmail.com | elektrownia@ | Y | yes (short codes 30.09; checklist box unticked) | likely 29.09 session (Natalia/Ala) |
| WESTFIELD (= "Molotov") | Y | N | **missing** (waiting on operator) | mokotow@ | Y | yes (short codes 30.09; checklist box unticked) | 29.09 |
| FORUM (Kraków) | Y | **Y** | pitabrosforum@gmail.com | forum@ | Y | yes (09.10, GET smoke) | no record |
| SUPERSAM (Katowice) | Y | **Y** | **missing**; `prod-sql-1` sets supersampitabros@gmail.com | supersam@ | Y | yes (09.10, GET smoke) | Sahil with Tushar at Wola 09.10; unconfirmed whether he got the code |
| SLONY (Gdańsk) | Y | **Y** | **missing** | slony@ | Y (Marek to confirm the number) | **unconfirmed** (plan 1.4 open; 2 orders suggest yes) | no record |
| STARY_BROWAR, KULINARNA, KAMIENICA | N | N | STARY_BROWAR pitabrospoznan@; others none | poznan@ / kulinarna@ / – | N | n/a | not rolled out |

Gaps to close: e-mail for WESTFIELD and SLONY; the SLONY token (check the Railway prefix list); a
training record for NORBLIN, FORUM and SLONY. The only training material in the repo is
`docs/pita-supply-os-v1/training/2026-10-09-captain-training/`, and it exists only on the porządek branch.

**Security finding (outside Lane D, not fixed here):** a literal BRACKA captain token is committed in
`context/archive/2026-08-18-bracka-rollout/rollout-notes.md:80`. The Norblin notes already mention it.
The repo is public on GitHub. Rotating the BRACKA token is the fix; scrubbing the file alone does not
help because the value is in git history. This is plan item 4.8 (token rotation), still open.

## D8 — can the model hold count-only items (cut halloumi / cut gyros)?

**Yes, no code change needed.** A product is "count-only" at a location when:

1. it has a `location_product_settings` row there (so it is on the captain's inventory list), and
2. its only catalog row is `SUP_INTERNAL` ("produkcja na miejscu"). That supplier has no order tab;
   `captain_submit` and Transport refuse it (`supply-os-v1/app/main.py:980-986`).
   - For own-catalog locations (FORUM, SUPERSAM, SLONY), "no row in that location's scope" also works
     (`supplier_catalog.py:12-14`).

No order tab means no suggestion. Thresholds 0/0/0 keep it out of every report that compares against
target. Prod precedent:

- P176/P177 "Gyros wieprzowy ścięty/nieścięty";
- P178/P185 chicken cut/uncut (KEN);
- P182 opened gas cylinder (06.09).

`prod-sql-4-cut-count-only.sql` adds the following:

- P192 "Halloumi cięte" (Produkcja, kg) + `SP_INTERNAL_P192`, at FORUM (Kraków report 11.10).
- `WESTFIELD__P176` "Gyros wieprzowy ścięty" (Mirsini 04.10). P177 is **not** added: Westfield counts
  the whole block as P024 (Pago).
- Other halloumi locations: append them to the `VALUES` list once named (needs-Marek #9).

What this does **not** give (would be Lane C code):

- a conversion "cut kg → whole packs" in the suggestion for P015;
- a shared "cut + whole" total on the card.

Today the two numbers sit side by side and the captain/manager adds them up by eye. Ask for that only
if the manager actually needs it.

## Needs Marek (nothing below was guessed into SQL)

Kraków / Katowice (`prod-sql-1`):

1. **Dis-Pack:**
   - order deadline (hour) and delivery days;
   - whether Katowice has the same terms (minimum 700 zł, agata.filipowicz@) — `prod-sql-1` applies them
     to both cities; R-2 undoes KAT only;
   - product names/EAN for the catalog.
2. **Kuchnie Świata:** minimum, delivery days, cutoff. Until then it stays `manual` with only the e-mail.
3. **Selgros KRK / Bytom:** minimum, days, cutoff (stays `manual`). Should `SUP_SELGROS_KAT` be renamed
   "Selgros Bytom"? (Not renamed in this lane.)
4. **Bukat KRK:** Marek wrote "ideally 2 days ahead". The rule uses lead 1 day, deadline 16:00. Should
   the lead be 2? Change `lead_days` in `DR-BUKAT-KRK-ALL`.
5. **Katowice thresholds:** min/target/max for the 24 B2 products (Coca-Cola KAT + Warsaw goods), today
   0/0/0. Also the Coca-Cola KAT account and minimum.
6. **FORUM white onion:** min stays 0,5 kg with target/max 1 kg — OK?
7. **Kraków/Katowice captains:** confirm that SUPERSAM (Sahil) has the code; e-mail for SLONY (Gdańsk).

Count-only (`prod-sql-4`):

8. Burn — which supplier? (Westfield/Powiśle, not in `prod-sql-3`.)
9. **Halloumi cięte:** which locations besides FORUM cut halloumi ahead (Alla 02.10, location not
   recorded)? Add them to the `VALUES` list.

Warsaw / Westfield (`prod-sql-2`, `prod-sql-3`):

10. **Wola rolls:** how many rolls per pack for 57/20 (P128) and 57/30 (P130) from Mory? Fill
    `v_pack_p128` and `v_pack_p130` in 2.3. Is "max 5 op" also meant for 80/80 (P129, 6 per pack → 30)?
    Separate issue: the KAN 1350 Fillo / till-roll mix-up at Browary (biuro@ 15.10).
11. **Sponges P121:** is the Blue Service price 0,60 zł per piece or per pack of 10 (the catalog note says
    "cena 0,6 byla za opak")? Thresholds are unaffected; the order value estimate is.
12. **Browary mustard/mayo:** 1/2/2 szt is the reading of "1/2 zmienic". Is min 1 right?
13. **KEN gyros "3 pcs":** pork P024 (default) or chicken P179? Min stays as it is today.
14. **Wola Cappy glass:** max 48 (2 crates) or 24 (1 crate)?
15. **Corfu "karton":** should the lemonades P075–P077 (also `box`×12 at Filber) change too?
16. **"Spinacze":** no product exists. Are they paper clips (a new Mory product: name, pack, price), or the
    staples P127 that Khushi and Marek name? Does KEN need P127/P131 thresholds (2.8 (c) shows the rows)?
17. **KEN Mory order `ORD-20261004-KEN-MORY-06569d`:** was it actually sent? It is still marked claimed
    per the 04.10 notes. 2.8 (b) shows the status.
18. **Thresholds for the new 0/0/0 rows:** Fuzetea at WESTFIELD and ELEKTROWNIA, Kinley at ELEKTROWNIA.
19. **Westfield paper rolls "w chemii":** which product (P120 toilet paper 8 rolls, a towel roll, a jumbo
    roll?) and from whom? Fill `v_pid` in 3.4. Thresholds default to the 29.09 sheet's 1–4 szt.
20. **Burn (P156):** which supplier? Westfield and Powiśle wait for it.

Not in this lane, already prepared elsewhere: Cappy glass for BRACKA/KEN/ELEKTROWNIA/BROWARY and
Coca-Cola glass for ELEKTROWNIA/BROWARY (feedback-1001 `prod-sql-1.sql` blocks 1.11c/d/f/g, 1.10a/c —
never applied). Only Wola (2.6) and Westfield (3.2) were in this brief.
