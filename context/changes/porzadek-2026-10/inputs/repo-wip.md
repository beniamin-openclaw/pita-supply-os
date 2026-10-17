# Pita Supply OS: repo WIP inventory (read-only), 2026-10-17

The report file could not be written. The Write tool refused it ("subagents should return findings as text"), so the full report is below and nothing exists at `.../scratchpad/report-repo.md`.

Basis: origin/main = 7b03cf9 (PR #62 merge, 2026-10-09). Nothing has landed on main since 10-09. Fetched origin with --prune.

Read-only prod SELECT via the Supabase MCP: `list_migrations` and one `information_schema` query worked. The data query was DENIED by the auto-mode classifier ("Production Reads"). Prod DATA state is therefore taken from repo docs. Anything marked UNVERIFIED-PROD could not be confirmed.

Side effect: I ran `git fetch origin` on the mini, which updates remote refs only. I changed no files.

## A) Unfinished lanes

### A1. `krakow-katowice-rollout` (R-37, PR #62 merged 10-09)
- **Where:** `context/changes/krakow-katowice-rollout/` on main. Status `implementing`, no `plan.md` Progress ticks beyond phases 1-3.
- **Unique work not on main:** 2 docs commits on `origin/claude/rollout-katowice-krakow-b96616`.
  - `b844dfb`: prod run log for 0029, A, C, B, B2 and the deploy.
  - `455822e`: captain codes and GET smoke for FORUM and SUPERSAM.
  - Main's copy still shows these as undone. The branch has 0 PR; it needs a docs PR.
- **Done on prod (from the branch docs, `rollout-notes.md` "Do zrobienia przez operatora"):**
  - Migration 0029 (also confirmed in the prod `list_migrations`).
  - Prod SQL A, C, B, B2.
  - Deploy of `7b03cf9`.
  - Captain codes in Railway.
  - GET smoke: FORUM 4 tabs / 104 products, SUPERSAM 5 tabs / 107 products.
- **Left, operator (Ben):**
  - GET smoke with one Warsaw token (plan 1.4, 2.4, 4.2).
  - Friday-training check 4.3, "no test order dispatched" (the notes say training was 2026-10-09).
  - SUPERSAM location e-mail for DW (empty).
  - Seed CSV drift: `docs/pita-supply-os-v1/seed/` lacks the new data.
- **Left, Marek:**
  - Supplier contacts, e-mails, minimums, order days and cutoffs (until then orders are `manual`, to the manager).
  - Empty prices.
  - Items on hold.
  - Conversions to confirm.
  - The 7 open questions in `rollout-notes.md` ("Pytania do Marka").
  - FORUM P018 onion: target 2 kg vs a 5 kg sack gives suggestion 0 forever, and needs a decision.
- **Left, agent:** archive after the above, and fix roadmap R-37 (it still says "PR open; migration + SQL pending").

### A2. `gdansk-rollout` (SLONY, Gdańsk Słony Spichlerz). NOT on origin; exists only uncommitted
- **Where:**
  - Mini: untracked `~/remote-agent/repos/pita-supply-os/.claude/worktrees/bridge-cse_019No8f7ehaWxUUrGe4iM4SM/context/changes/gdansk-rollout/`.
  - Laptop: an identical untracked copy in this worktree. All 14 files have matching md5.
- **Status:** `implementing`, created and updated 2026-10-16.
- **Contents:**
  - `change.md`, `research.md`, `plan-brief.md`, `plan.md`.
  - `reviews/plan-review.md`: round 1 REVISE (0 critical, 8 warnings), later a SOUND verdict; the plan was revised.
  - `sheet-mapping.csv`, `inputs/`, `tools/{build_mapping,gen_prod_sql}.py`.
  - `prod-sql-1-location-catalog.sql` (55 KB, `gdansk_rollout_step1(dry_run)`), `prod-sql-2-delete-template.sql`, `rollback.sql`.
  - `rollout-notes.md`: only the read-only "Diff przed" (STEP 0) from 2026-10-16 ~11:30.
- **Done:** research, plan, plan review, generated SQL and rollback.
- **`plan.md` Progress: all 15 items unchecked.** Nothing is applied to prod, by its own notes:
  - 1.1-1.3: generator assertions and prod dry run (`DRY RUN OK`; expected 5 suppliers, 130 rows, 121 settings).
  - 1.4: spot-check 10 mapping rows.
  - 2.1-2.4: apply step 1, apply step 2 (DELETE of 12 template rows, needs the operator at the connector), captain-view query.
  - 3.1-3.2: `/verify` and the agents-md test.
  - 3.3: operator adds `SLONY:<kod demo SLONY>` on Railway.
  - 3.4: GET smoke.
  - 3.5: captain logs in on a phone.
- **Who acts:**
  - Agent: dry run, then apply step 1. Prod writes are blocked for the agent (memory `prod-writes-blocked-for-agent`), so the operator will probably run it.
  - Operator: step 2 DELETE, the Railway token, the phone login.
  - Marek: contacts, minimums, days, is "BlueService" Gdańsk the Warsaw Blue Service?, pack conversions flagged "do potw." (rolls 80/20, przyprawa 2 kg, zmywak, spices), 20 held rows, SLONY location e-mail.
- **Risks:**
  - `<kod demo SLONY>` is guessable (review F8): replace it after the demo.
  - Rollback PART 2 re-opens the Warsaw catalog if the token is live (F6).
- **Not in the roadmap** (no R-38).
- **Risk:** it lives only as untracked files in two checkouts. Commit it to a branch.

### A3. `transport-v2` (R-36, PR #60 merged and live 10-05)
- **Where:** `context/changes/transport-v2/` on main; status `implemented`. Docs commit `a633703` (plan Progress 4.2/4.3 plus change.md ops log) is on `origin/claude/transport-v2` only.
- **Left:**
  - Plan 4.4: operator E2E on the 07.10 Wola+Bracka run (Marek's first run from the app). No evidence of it in the repo as of 10-17.
  - Then archive. Archiving also carries `a633703` to main.
- **Prod orders for the operator (from memory 10-05, state may have changed):**
  - Mark the 04.10 Browary and KEN Mory orders as sent in the UI.
  - Decide cancel or mark on 9 stale claimed Pago/Mory orders from 21.09-01.10, plus KEN Coca-Cola 30.09 and WOL Intermlecz 01.10. They show in the Transport eligible list.
- **Unverified:** access to the biuro@ mailbox (draft-config).

### A4. `inventory-card-order` (PR #44 merged 10-01). Unarchived, no roadmap row
- **Where:** `context/changes/inventory-card-order/`, status `impl_reviewed`. Phase 4 items are all unchecked: 4.1 CI, 4.2 0027, 4.3 merged, 4.4 `prod-sql.sql`, 4.5 `prod-sql-pago-mory.sql`, 4.6-4.8 live checks.
- **Evidence:**
  - PR #44 is merged.
  - The prod column `inventory_order` exists on `products` and `location_product_settings` (information_schema, 10-17).
  - `0027` is not in the prod `list_migrations` output, so it was applied another way. 0027's columns exist.
  - On 10-01, `feedback-1001/prod-sql-1-diff.md:154` says no product or setting had an `inventory_order` yet.
- **UNVERIFIED-PROD:** whether `prod-sql.sql` (card positions) and `prod-sql-pago-mory.sql` (Pago/Mory `display_order`) were ever applied. Run a read-only SELECT of the non-null counts. The Pago/Mory file is independent and can run on its own.
- **Left:** operator applies SQL 4.4/4.5 (diff saved, audit clean), live checks 4.6-4.8, then archive and add a roadmap row.

### A5. `transport-pago-mory-combined` (PR #45 merged 10-01). Unarchived, no roadmap row
- **Where:** `context/changes/transport-pago-mory-combined/`, status `impl_reviewed`.
- **Left:** 5.1 CI, 5.2 "merged and live" (true), 5.3 live check (Pago PDF Pago-only, driver PDF Pago then Mory, nothing sent).
- **Evidence:** the 10-05 combined run TRN-20261005-PAGO-7b64e0 used it live (transport-v2 change.md). 5.3 is probably satisfied by that run. Operator should confirm, then archive.

### A6. `order-email-v2` (R-33, PR #43 merged 10-01). Unarchived
- **Where:** `context/changes/order-email-v2/`, status `implemented`.
- **Done:** 0026 plus `prod-sql.sql` applied 2026-10-01 (`prod-sql-applied.md`; 0026 is in prod `list_migrations`).
- **Unchecked in `plan.md`:** 3.5, 4.1 CI, 4.3 bundle and Railway commit confirmed, 4.4 live E2E of the Gmail draft in the operator's browser, 4.5 "dosyłka" draft and fallback link.
- **Evidence of use:** transport-v2 later built on the same draft mechanism, and Marek ran it, so 4.4 is probably fine in practice. Nothing is recorded.
- **Left:** operator confirms 4.4/4.5, then archive. **Roadmap R-33 is stale** ("PR open; migration 0026 + prod-sql pending").

### A7. `master-data-followups` (status `implementing`, standing list)
Open `[ ]` items in `context/changes/master-data-followups/change.md`:
- Lines 16-19, from week1:
  - C-1 bifteki carton weight.
  - C-3 Coca-Cola KEN, 72/96 vs 48/72.
  - A′ Tuesday snapshots: halloumi KEN/BRACKA/BROWARY, gyros BROWARY.
  - D Monday e-mail send.
- Lines 22-27:
  - BROWARY address, company name and NIP empty.
  - 3 held items: Halloumi ×2, Gyros 15 KG.
  - KEN gyros pork vs chicken split.
  - BROWARY rolls "57 na 80".
  - Export KEN/BROWARY thresholds to the seed CSVs.
  - Token rotation (open since feedback-r4).
- Lines 30-31:
  - Verify the Gmail window shows both Intermlecz addresses in To and biuro@ in CC.
  - Intermlecz delivery days and hours.
- Lines 38-46:
  - KEN Souvlaki 6 kg vs "6 boxes".
  - KEN Koperty unit label.
  - WOLA Cappy: 24-bottle case vs prod zgrzewka ×12.
  - Pago units: blocks vs kg.
  - Product names to suppliers should carry brand, variant and pack size.
- Lines 183-192: six threshold-calibration questions (BROWARY Fanex/Develey, Aviko fries WOLA/BROWARY, WOLA rolki 57/30 target 80, WOLA Bukat produce plus Blue Service chemia, KEN Gąbka, BRACKA mop).
- The `[x]` at line 35 (KEN yogurt) was done as R-30.
- Mostly Marek/operator decisions, then agent-prepared prod SQL, which the operator runs.

### A8. `supplier-per-location` (R-18, status `blocked`)
- **Where:** `context/changes/supplier-per-location/change.md`.
- **Left:** blocked on the five Wolska candidates (Selgros vs Allegro vs Blue Service). Blue Service prices are NULL. Operator/Marek decision.
- **Related:** 0029 (R-37) gives a whole-catalog `own_catalog` switch, not a per-product pin.
- The code lives on closed PR #26 (`origin/claude/supplier-per-location`, 10 commits). See C.

### A9. H-01 quality-hardening (roadmap: "implemented on PR #27, unmerged")
- Not on main: backend lockfile (`requirements.lock`), pyright, TS `strict` is OFF in main per CLAUDE.md, ruff I/B/UP.
- Per memory 10-01: redo fresh from main. Open PR #27 is only the source. It is based on closed #26 (mergeable, "UNSTABLE").
- Older variant: `origin/claude/jolly-mestorf-a20182` has 8 commits from 2026-06-23 (pip-tools lock, CI wiring, ruff). Agent work.

### A10. `10x-autonomous-workflow-v2` (local only)
- **Where:** worktree `.claude/worktrees/autonomous-workflow-v2`, branch `claude/10x-autonomous-workflow-v2`. 9 commits, never pushed, 89 behind main, 86 files changed, +8099/-7.
- **Uncommitted:** `change.md` modified (status `impl_reviewed`) and untracked `reviews/impl-review.md` (151 lines).
- **Left:** push or commit, PR, archive. Not product code (skills, scripts, `autonomy-profile.md`, `seed_demo.py` and `test_seed_demo.py`, hooks, AGENTS.md edits).

### A11. PR #59 `claude/agents-md-guard-hardening` (open)
- All checks green, MERGEABLE, CLEAN. One commit 35836d7: guard for absolute and `~` imports, plus a `ci.yml` change. Needs a merge decision from the operator.

### A12. Untracked "meeting tasks" decision sheet (waiting on the operator)
- **Where:** `.claude/worktrees/przepisz-nr-normlanie-ce84a6/context/meetings/supply-os-ze-spotkan.html` (31 KB, 10-13, uncommitted).
- **What it is:** a decision page of 8 tasks from the 10-12 Office Day and Daily Huddle, each with variants A/B/C and a recommendation. Operator picks, pastes the choices into a Claude session. Not started.
- **The 8 tasks:**
  - Readiness table for all locations by end of October. Wrocław: PDT Renoma ~1.11 and Hala Świebodzka ~15.11, both operational targets, not confirmed.
  - Bug list owned by Marek (Warsaw config and Pago).
  - Training location "SZKOLENIE" so trainers do not place real orders. Kamesh will train next.
  - Below-minimum guidance, which needs delivery costs from Marek.
  - Katowice Coca-Cola audit (~56 crates in stock) plus an overstock report.
  - Fries price delta on the backup card (Selgros ~39.99 PLN vs 20-something).
  - Kraków min/max review around 27.10.
  - Huddle summaries from HappyScribe (outside Supply OS).
- **UI items listed:** backup card looks empty (and a screen-reader bug), "sent" supplier tab not persisted (double-order risk), manager zero shown inconsistently, Transport city filter strikethrough, backup line "—" for the manager.

### A13. Roadmap items not done (`context/foundation/roadmap.md`)
- **R-32 `delivery-calendar-visual`:** backlog. Operator said "record only, do not shape".
- **R-17 `dynamic-target-wola`:** closed unmerged (PR #30); to be rebuilt on the GoStock usage method (next free migration number is now 0030, not 0028). Nothing was applied on prod.
- **R-18:** parked (A8).
- **R-19 and H-01:** unmerged (A9).
- **R-33 and R-37 rows are stale** (A1, A6). R-36 row is correct: "awaiting operator E2E".
- **Missing rows:** `gdansk-rollout`, `inventory-card-order`, `transport-pago-mory-combined`.
- **Horizon 1/2 lines:** S-01/S-02 are marked done; the "Backlog Handoff" table (roadmap.md ~311-323) still shows S-01..S-08 as waiting/blocked. Stale text only.

## B) Pending operator/human verifications

### Recent
1. **Krakow/Katowice:** Warsaw-token GET smoke; training-day no-test-order confirmation; SUPERSAM e-mail (A1).
2. **Gdańsk:** every Phase 2 and 3 manual item (A2).
3. **transport-v2:** E2E on the 07.10 run; mark/cancel the stale claimed orders (A3).
4. **order-email-v2:** live Gmail-draft E2E and fallback link (A6).
5. **inventory-card-order:** `prod-sql.sql`, `prod-sql-pago-mory.sql`, live checks 4.6-4.8 (A4). NORBLIN grid is 4.8.
6. **transport-pago-mory-combined:** confirm 5.3 (A5).

### feedback-1001-names-units (archived 10-02, R-34)
From `prod-run-2026-10-02.md` "Still open" and `plan.md` Progress:
- The 7 DELETE blocks (1.10a, 1.10c, 1.11b/c/e/f/g) were never applied. The connector times out on DELETE, so the operator must be at the screen. Until then P190/P191 Cappy have no setting row at those locations and are invisible there.
- 1.11d (KEN Cappy) and 1.11h (PET rename) were blocked by KEN order `ORD-20260930-KEN-COCA-b8acbc` (manager_claimed).
- 1.5 gyros "nieścięty off" held until staff message part 1.
- 1.5 operator spot-check.
- Phase 1b (units that change stored meaning): needs the full-count day, the diff approved, the staff message.
- 2.4 bold units and sticky reason on prod.
- 3.7 Railway `/health` confirmed (agent egress was blocked).
- 3.8, 4.3 (Pomidor captain card), 4.4 (e-mail preview, not sent).
- 5.3 staff message.
- 6.1 zero-threshold review ticked, then applied (`zero-thresholds-review.md`).
- `ORD-20261001-WOL-INTE-1851ca` ("TEST TEST TEST"): cancel.
- Question Q13: Browary Coca-Cola glass.

### week2-feedback-quantities (archived 09-28, R-21)
- **Unchecked manual items in the archived plan:** 0.4-0.7, 1.5-1.7, 2.3-2.4, 3.3, 4.2-4.3, 5.2-5.4, 6.3-6.4, 7.2 (archive `plan.md` 816-902).
- **Prod migrations:** 2.3 and 6.3 show 0019/0020 unchecked, but both are in the prod migration list (applied 09-19).
- **Not done, carried over:**
  - Post `team-message.md` on Connecteam.
  - Coca-Cola glass prices from the CC portal.
  - Crate rules with Marek.
  - **Rotate the Viva Payments keys exposed in the "KLUCZE" mail.**
  - **Token rotation** (`master-data-followups` line 27; also `change.md:227`).
- **J2-J4 cleanup:** the `prod-sql.sql` section J (18 Wola closes, 7 stale cancels, transport draft `TRN-20260902-PAGO-aa283f`) was not run by the agent. The pago-data-unity cleanup of 09-28 (13/13 audit) overlaps (2 drafts cancelled, 5 old orders closed). Whether J2-J4 still matters: UNVERIFIED-PROD.

### Other archived items with unchecked manual steps
- **training-feedback-0901:**
  - `prod-sql-phase0.sql` (RLS on nine backup tables) "STILL OPEN" as of 09-03. UNVERIFIED-PROD whether applied since. Security hygiene.
  - Live PDF check on prod.
  - `prod-sql-phase3` Bombilla/Corfu: superseded by the 09-06 gyros/Corfu batch per memory.
  - Marek-blocked rolls/tapes/crates/minimums: partly done (rolki-minima 09-05).
- **pago-stock-packs-plus-kg:** 2.5, 2.7, 3.4 unchecked. 3.5 and 4.5 were ticked by PR #52. Later superseded by feedback-1001 two-field input.
- **delivery-calendar:** 3.5, 3.6, 4.4, 5.3 (local previews and post-deploy check). The operator confirmed messages and markers on 10-01 (memory), so the unchecked boxes are bookkeeping.
- **order-line-zero-qty** 3.5-3.7 and **pago-transport-only-dispatch** 3.6-3.7: passed by operator per memory and roadmap; the archive plan still shows unchecked (bookkeeping).
- **Memory notes stating open operator items, still open:**
  - Open with Marek: Coca-Cola delivery rule exists only for WESTFIELD; Spec and Kamino lead time 1 day assumed.
  - Mory WOL 21.09 order waits on Marek.
  - Pack sizes / GoGastro / Blue Service catalogue (rolki-minima, demo-feedback-round2 notes).

### Prod migrations newer than 0024 (prod `list_migrations`, 10-17)

| Migration | In list_migrations | Docs / evidence |
|---|---|---|
| 0025 delivery_calendar | yes (09-28) | applied |
| 0026 location_sender_and_phone | yes (10-01) | `order-email-v2/prod-sql-applied.md` |
| 0027 inventory_order | NO (columns exist: information_schema) | applied via another route; data (positions) UNVERIFIED-PROD |
| 0028 supplier_product_case | yes (10-02) | `prod-run-2026-10-02.md` |
| 0029 location_supplier_catalog | yes (10-09) | `rollout-notes.md` on branch b844dfb; `own_catalog` column exists |

- No migration above 0029 exists in `supply-os-v1/migrations/` (and none claimed). 0018 is an unused gap on main (dynamic-target was closed unmerged); 0008 was never applied on prod.
- Nothing is pending migration-wise, but the 0027 data is unconfirmed (A4).
- **0008:** `branch-blocked-migration-0008` warns against merging `claude/multi-location-master-data` or `claude/supplier-per-location`. Still true.

## C) Branch and worktree cleanup candidates

### Open PRs
- #59: needs merge (A11).
- #27: base is closed PR #26's branch. Holds unique work (sheet-to-db reconciliation engine, onboarding generator, H-01, prod-sql batches), already applied to prod per memory. Source to mine for H-01. DO NOT merge (0008 block). Keep until H-01 is redone, then close.

### Fully merged: 0 commits ahead of origin/main, safe to delete the branch (local and/or remote)
cert/builder-readiness, chore/wip-cleanup-2026-10-01, claude/agents-md-no-eager-imports, claude/charming-robinson-8e6f6b, claude/compact-rules-standard-ae9ef2, claude/delivery-calendar, claude/feedback-1001-names-units, claude/feedback-1001-names-units-safzk7, claude/inventory-card-order, claude/loving-feynman-2e6946, claude/manager-add-any-product, claude/manager-add-any-product-followup, claude/sleepy-dhawan-d97005, claude/transport-pago-mory-combined, claude/tuszar-training-materials-455bb2, claude/wonderful-albattani-d25a04, claude/xenodochial-cerf-3c59f5, claude/sharp-tharp-b7ea7d, claude/silly-varahamihira-986122, claude/specfood-app-orders-013ad1, claude/api-engineering-tasks-906b29, claude/przepisz-nr-normlanie-ce84a6, feat/pago-suggestion-no-alerts, feat/pago-transport-only-dispatch, feat/week2-feedback-quantities, finance-invoice-reconciliation, plus the old remote-only merged ones: origin/claude/{admiring-blackwell-f31c63, dreamy-shockley-005215, exciting-curie-e20933, exciting-fermi-aeb98f, nervous-visvesvaraya-8c58ca, norblin-*, product-feedback-quantities-a7ebd9, repo-cleanup, three-missing-products, to-ordering-pago}, origin/feat/pago-queue-deviation-chips, origin/docs/archive-supplier-product-order-minimum.
Caveat: `claude/specfood-app-orders-013ad1` has a lane-like name but no commits; ask the operator whether a session is still using it.

### Ahead of main but patch-equivalent already on main (`git cherry` shows "-"): safe to delete
chore/lesson-deploy-before-livetest, claude/archive-pago-stock-e2e-ticks (PR #52), claude/determined-proskuriakova-00cc13, claude/objective-varahamihira-fd4c7e, claude/receiving-confirm-quickfix, claude/ken-intermlecz-yogurt-gouda, claude/thirsty-pike-054242, docs/master-data-batch1-gostock-api, chore/elektrownia-westfield-rollout (local only, both commits "-").

### Superseded (probably): old June work, `git cherry` "+"
- claude/angry-haibt-eed8b1, claude/awesome-haslett-b3da20, claude/sleepy-proskuriakova-b9957f, claude/sharp-boyd-9e4c54 (lint cleanups from 06-06; the `2026-06-07-frontend-lint-debt` archive exists).
- claude/ecstatic-yalow-439e8c (the skill is now on main in `.claude/skills/10x-autonomous-workflow`).
- Not diffed in detail, so mark uncertain.

### Closed or abandoned PR code (history only, safe to delete if you accept losing it)
- feat/dynamic-target-wola (PR #30 closed; 37 files, the engine and the prod-sql package). Possible reference for the GoStock-based rebuild.
- claude/supplier-per-location (PR #26 closed).
- claude/fervent-cohen-63df85 (PR #38 closed; archive commit for pago-data-unity; main already has the archive folder).
- fervent-cohen worktree: see "Keep" below, because it is also the Katowice docs branch.

### Holds unique work: do NOT delete
- `origin/claude/rollout-katowice-krakow-b96616` (A1).
- `origin/claude/transport-v2` (A3, docs commit a633703).
- `claude/10x-autonomous-workflow-v2` (A10, local only, 9 commits plus uncommitted).
- `claude/sharp-fermat-2d60ce` (local only, 3 commits, `captain-history-and-draft-ux`): never merged. Main still has the old draft banner (`captain.draftBannerDiscard`) and lacks "Wyczyść formularz". 4 months old. Decide: rebase or drop (uncertain).
- `claude/employee-call-analysis-a3502e` (local on the laptop AND on the mini, same sha e271a70): phone-number mapping docs (`docs/pita-supply-os-v1/telefony/*`, 370-row CSV). Contains personal data; never pushed.
- `claude/jolly-mestorf-a20182` (H-01 June commits, pushed).
- `claude/supplier-per-location` and `claude/multi-location-master-data` (see above; also carries the engine and prod SQL).

### Worktrees (`git worktree list`, 15). Nothing removed.

| Worktree | Branch | Verdict |
|---|---|---|
| `10xDEVS` (primary) | feedback-1001-names-units 54c6354 | clean, merged. Keep as base, or switch to main. |
| `10xDEVS-wt-addany` | manager-add-any-product-followup | merged (PR #61), clean: safe to remove |
| `10xDEVS-wt-agents-imports` | agents-md-guard-hardening | keep until PR #59 merges. Untracked `AGENTS 2.md` / `frontend/AGENTS 2.md` / `supply-os-v1/AGENTS 2.md` are Finder duplicates, delete. |
| `.claude/worktrees/autonomous-workflow-v2` | 10x-autonomous-workflow-v2 | KEEP: unpushed commits and uncommitted review files |
| `.../charming-robinson-8e6f6b` | archive-pago-stock-e2e-ticks | merged; untracked `context/changes/{order-line-zero-qty,pago-data-unity,pago-stock-packs-plus-kg,builder-certification-readiness}` are " 2/3" Finder duplicates of archived folders, and `master-data-followups` is identical to main's. Safe to remove after a glance at `supplier-per-location/change.md` (differs from main, likely older). |
| `.../fervent-cohen-63df85` | rollout-katowice-krakow-b96616 | KEEP until the 2 docs commits reach main |
| `.../loving-feynman-2e6946` | order-email-v2 (merged) | safe to remove; untracked `useralias.html` (181 KB saved Google page, junk) |
| `.../projekt-porzadek-plan-80179e` | this one | holds the untracked gdansk copy (A2); commit it before removing |
| `.../przepisz-nr-normlanie-ce84a6` | api-engineering-tasks | KEEP until `context/meetings/supply-os-ze-spotkan.html` is committed or the decisions recorded (A12) |
| `.../sharp-tharp-b7ea7d` | local `main` ca88a03 (stale, 2026-10-01) | clean except " 2.md" Finder duplicates. Update or remove. |
| `.../silly-varahamihira-986122` | specfood-app-orders | no commits, clean: remove (ask first) |
| `.../transport-v2` | transport-v2 | KEEP until a633703 reaches main |
| `.../wip-cleanup-2026-10-01` | wip-cleanup | merged (PR #46), clean: safe to remove |
| `.../wonderful-albattani-d25a04` | tuszar-training-materials | branch merged, but untracked `docs/pita-supply-os-v1/training/2026-10-09-captain-training/` (4.4 MB: prework-sahil(-pl).html/pdf, trainer-cheat-sheet-tushar.html/pdf, img/*.png, print.css) is NOT in git anywhere. KEEP or commit. |
| `.../xenodochial-cerf-3c59f5` | transport-pago-mory-combined | merged, clean: safe to remove |

## D) Mini-only work at risk (`ssh jarvis-mini`, `~/remote-agent/repos/pita-supply-os`)
- **Commits not on origin:** none, apart from `claude/employee-call-analysis-a3502e` (e271a70; the same commit is on the laptop, never pushed anywhere). The mini's `claude/feedback-szkolenie-0109` (fec545a), `claude/to-ordering-pago`, `main`, `impl-to-ordering-pago` and `worktree-agent-*` have 0 commits ahead of origin/main.
  - The mini's main clone is stale: 241 commits behind.
  - `claude/feedback-szkolenie-0109` is a leftover 08-31 branch whose commits are on main.
  - Its uncommitted change is `frontend/package-lock.json` (63 lines removed): noise.
- **`context/changes/` folders on the mini** (`feedback-r7-tushar`, `ken-browary-master-data`, `to-ordering-pago`, `wolska-blueservice-master-data`, `deployment`, `product-order-note-and-min-flag`, `supplier-per-location`): all tracked in that old checkout, and all already archived on origin (`context/archive/2026-07-25-feedback-r7-tushar`, `2026-08-31-ken-browary-master-data`, `2026-08-21-to-ordering-pago`, `2026-08-20-wolska-blueservice-master-data`, `2026-06-04-deployment`, `2026-06-26-product-order-note-and-min-flag`). Nothing mini-only there. `supplier-per-location` is the only one still active (laptop main has it).
- **Mini-only and at risk:** `context/changes/gdansk-rollout/` (A2).
  - It is an untracked folder in the locked worktree `.claude/worktrees/bridge-cse_019No8f7ehaWxUUrGe4iM4SM` (at 7b03cf9, i.e. current main).
  - It is not committed on any branch or remote. If the worktree or the mini is wiped, it is lost.
  - The laptop copy (this worktree) is identical (14 files, md5 match), also untracked.
  - Action: commit it on a branch and push it (the plan's own docs and SQL tooling).
- Second worktree `bridge-cse_01R5T4p3ztWxEVC98zxgN5VC`: clean, at 7b03cf9.
- Several worktrees listed on the mini point to laptop paths (`/Users/ben/.../agent-ab4a964f463060f95`, `ecstatic-tu-c7ae8d` and others) and are marked prunable. They are stale metadata.
- Uncertainty:
  - I did not check whether the mini-hosted `claude rc` servers (mini-ops, mini-supply-os) hold other uncommitted work outside this repo.
  - Prod DB data could not be read (classifier denial). All prod-state claims come from repo docs and the migration list.