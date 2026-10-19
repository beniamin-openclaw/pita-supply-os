# Gdańsk Słony Spichlerz (SLONY) rollout Implementation Plan

## Overview

Activate the existing prod location `SLONY` (Pita Bros Słony Spichlerz, Gdańsk) as an own-catalog
city location, with five Gdańsk supplier records and the min/max thresholds from the "Gdańsk" tab of
Marek's sheet "Miasta poza Warszawą", following the Katowice SUPERSAM rollout. Then give the captain
access with the operator-chosen code `<kod demo SLONY>`. Data only — no application code changes.

## Current State Analysis

From `research.md` (prod read 2026-10-16):
- `locations.SLONY` exists: inactive, `own_catalog=false`, no address/company/phone,
  `sender_email='slony@pitabros.pl'`, `city='Gdańsk'`.
- 115 template settings rows (`SLONY__<pid>`, all 0/0/0, untouched copy of KAMIENICA).
- No SLONY orders, counts, receipts, transport rows, delivery rules or scoped catalog rows.
- Migration 0029 and the per-location catalog code are live (FORUM/SUPERSAM already use them).
- All 123 products the mapping needs are active; all source catalog rows exist.

## Desired End State

- `SLONY` is `active=true`, `own_catalog=true`, with delivery address, city, company, NIP, phone.
- Five city suppliers exist, each with only SLONY-scoped rows:
  `SUP_KUCHNIE_GDA` (7 rows), `SUP_SELGROS_GDA` (49 = 30 primary + 19 backup),
  `SUP_COCACOLA_GDA` (8), `SUP_WARSZAWA_GDA` "Pago + Magazyn + Lemoniady (Gdańsk)" (18),
  `SUP_BLUESERV_GDA` (48 = 38 with thresholds + 10 at 0/0/0). Total 130 scoped rows, all active.
- SLONY has 121 settings rows: 101 with thresholds from the sheet (target = max), 10 primary rows at
  0/0/0 (sheet 0/0), 10 count-only own-production rows (P029–P036, P176, P177), 0 leftovers.
- All Katowice invariants hold (see Phase 1 contract). Warsaw, FORUM and SUPERSAM are byte-identical
  (shared catalog count + md5, FORUM/SUPERSAM scoped rows count + md5 unchanged).
- Captain logs in with `<kod demo SLONY>`, sees exactly 5 supplier tabs and a 121-item inventory list.

Verify with the STEP 2 audits of each SQL file (expected values written in the file), plus the
GET-only smoke after the token is live.

### Key Discoveries:

- Inventory list = every settings row with an active product (`supply-os-v1/app/main.py:3232-3299`)
  → template leftovers must be deleted, not zeroed.
- Own-catalog scope is exact `location_id` match (`supply-os-v1/app/supplier_catalog.py:44-62`);
  a city supplier must have no shared rows.
- One active row per (location, supplier, product) is a hard UI constraint
  (`main.py:336-341`, `frontend/src/pages/captain-mp/CaptainMP.tsx:308-309`); nothing in the DB
  enforces it or "one primary per product" — audit by SELECT.
- `manual`/`portal` dispatch never sends e-mail (`main.py:2576-2689`) → NULL e-mails are safe.
- Captain token: `LOC:token` pairs, ASCII, no comma; `SLONY` must match exactly
  (`supply-os-v1/app/auth.py:39-49,78`).
- The Supabase connector asks a human to confirm any statement with `DELETE`; unattended it times out
  after 60 s and writes nothing (`context/foundation/lessons.md`, last entry).

## Decisions (made autonomously from research + Katowice precedent)

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | IDs | Suppliers `SUP_<BRAND>_GDA`; rows `SP_<BRAND>_GDA_<pid>`; settings `SLONY__<pid>` | Katowice convention (`SUP_X_KAT`, first 3 letters of the city); `GDA` already used for Gdańsk in payroll |
| D2 | Supplier records | 5 new city records, never the shared Warsaw ones (incl. Blue Service) | Shared records carry Warsaw e-mail/minimum/rules; own-catalog needs scoped rows anyway |
| D3 | Supplier fields | `manual`, e-mail/minimum/days/cutoff NULL (Coca-Cola `portal`; "Pago + Magazyn + Lemoniady (Gdańsk)" minimum 0); alerts ON for Kuchnie, Selgros, Coca-Cola, Blue Service and OFF for "Pago + Magazyn + Lemoniady (Gdańsk)"; coverage OFF; NIP only where known (Kuchnie S.A. 1180039859, Coca-Cola 5242106963). Names "<Brand> Gdańsk" | Same as Katowice; Warsaw goods follow SUP_PAGO / SUP_WARSZAWA_KAT (alerts off — `context/archive/2026-09-27-pago-suggestion-no-alerts/`), the other four have thresholds and match their Warsaw twins |
| D4 | Duplicates | Specialist supplier primary, Selgros backup: fries/sweet-potato/halloumi → Kuchnie; Domestos/Ludwik/gloves/foils/bags/towels/scourers/cloths/staples/marker/fries bag/cups → Blue Service | Katowice decision 3 + 6; one threshold per (location, product) |
| D5 | Selgros rows without thresholds | Backup when another Gdańsk supplier carries the product; held when no product or pack differs; fries "op" row = duplicate | Katowice decision 6 |
| D6 | Blue Service 0/0 rows with a product | Primary at 0/0/0 (orderable ad hoc, counted) | Katowice "grey → primary 0/0/0" rule; keeps the item orderable |
| D7 | Items without a catalog product | Held (20 rows), no new products | Katowice decision 7; listed in rollout notes for Marek |
| D8 | Unit conversions | `sheet-mapping.csv` `factor` column (falafel ×5, oliwki ×2, fasolka ×2,5, drinks ×24, gyros ×15, souvlaki ×5, pita ×12, lemonades ×12, rolls ×10/×6, gąbki ×10, przyprawa ×2); target = max | Katowice/Elektrownia precedent; uncertain ones flagged "do potw." |
| D9 | Coca-Cola | Glass 0,25 products where they exist (P186/P187/P190/P191); Sprite/Fanta on P067/P066 as `skrzynka` ×24 (upp pinned, source guarded at 24) with price and SKU NULL; max rounded up to whole crates/packs of 24 (36 → 48) | Westfield/Browary glass pattern; checklist §2 "max do pełnej skrzynki"; no glass Sprite/Fanta product |
| D10 | Catalog row fields | `INSERT … SELECT` from a named source row (Katowice city row, else Warsaw row); override supplier, id, location, name (sheet name, WAW rows + " (Pago/Magazyn/Filber/Bukat)"), position, is_backup, notes, **`active = true` always** (4 sources are inactive Warsaw rows); for cross-brand sources outside the WAW section (Mory → Blue Service, Kuchnie → Selgros) `supplier_sku`/`order_note` NULL and `warehouse_pickup` false | Katowice B/B2 patterns; inherits checked pack/price/rounding |
| D11 | Leftovers | Delete 12 template rows (P017, P037, P039, P056, P064, P065, P068, P069, P109, P113, P114, P130) in a separate step with a literal backup | Same 12-ish set Katowice deleted; DELETE needs the operator at the screen |
| D12 | Rehearsal | Run the STEP 1 block on prod with `dry_run = true` first (it raises at the end → full rollback), then for real | No local Postgres; real-data rehearsal with zero writes |
| D13 | Captain code | `<kod demo SLONY>` as the operator asked; set by the operator in Railway (`SLONY:<kod demo SLONY>`) only after step 2; recommend rotating to a random code after the demo | This host has no Railway CLI/credentials; guessable (checklist §4 says random hex) |
| D15 | Coca-Cola crates | No code change; the crate-return prompt stays `SUP_COCACOLA`-only (`frontend/src/pages/captain-mp/lib/supplierPrompts.ts:18-20`); captain writes crate counts in the order comment; one-line follow-up proposed | Keeps this rollout data-only (no deploy possible from this host) |
| D16 | Thresholds far above Warsaw scale | Keep Marek's values (tzatziki 28, rolls 120, zmywak 120, souvlaki 110 kg, gyros 225 kg); first item of the Marek questions | Sheet is the source (Katowice rule); editable in the manager UI |
| D14 | Seed / code | No seed export, no code change | Katowice precedent; seed counts are asserted by tests |

## What We're NOT Doing

- No application code, migration, or frontend change.
- No new products (20 held rows go to Marek's question list).
- No supplier e-mails, minimums, delivery days, cutoffs or `supplier_delivery_rules` (unknown).
- No seed CSV export; no `sync_master_data.py` / `backfill_supabase.py` runs.
- No test order to any supplier (hard rule); smoke test is GET-only.
- No change to Warsaw, FORUM or SUPERSAM data; the pending `inventory-card-order` SQL is not touched.
- No Gmail alias setup for slony@ (only matters once a supplier switches to e-mail).
- No code change for the Coca-Cola crate prompt (D15) — proposed follow-up only.

## Implementation Approach

`sheet-mapping.csv` (built by `tools/build_mapping.py` from the sheet dump + per-row decisions) is
the single source of truth. A generator (`tools/gen_prod_sql.py`) turns it into self-contained SQL
files in the Katowice shape: STEP 0 read-only diff, STEP 1 one guarded `DO` block, STEP 2 audits.
Step 1 (location + suppliers + catalog + settings) has no DELETE, so it can run unattended; step 2
(DELETE leftovers) runs as its own call. The captain token goes last.

## Critical Implementation Details

- **Order:** step 1 dry-run → step 1 real → step 1 audits → step 2 (DELETE, may need the operator) →
  token. `own_catalog=true` lands in the same transaction as the scoped rows, so the location can
  never show the Warsaw catalog. The token goes live only after step 2: before it, the count list
  would hold 133 items including cans/PET next to glass Cola.
- **Kill switch is not a hard stop:** `captain_submit` resolves inactive scoped rows; removing the
  `SLONY:` token from Railway is the hard stop. Rollback PART 2 requires the token removed first
  (it restores `own_catalog=false` + template settings = Warsaw catalog).
- **Guards are SLONY-scoped:** never `WHERE location_id IS NOT NULL` (FORUM/SUPERSAM rows exist).
- **Global invariants** (backup→primary, no double primary, no duplicate active rows, scoped rows
  only at own-catalog locations) run across all locations; a pre-existing defect elsewhere would
  block SLONY — read them in STEP 0 first.

## Phase 1: Mapping and SQL artifacts

### Overview

Freeze the mapping and generate the prod SQL, rollback and a "diff before" record.

### Changes Required:

#### 1. Mapping

**File**: `context/changes/gdansk-rollout/sheet-mapping.csv`, `tools/build_mapping.py`

**Intent**: One row per sheet product row with role (P/P0/B/H/D/X), product, source row, factor,
converted min/max, overrides and a note.

**Contract**: 153 rows; 130 with a catalog role (P/P0/B); no (supplier, product) pair twice; every B
product has exactly one P/P0 row at another supplier; no product has two P/P0 rows; columns
`pu`/`upp`/`price`/`order_note` are optional overrides.

#### 2. Generator + step 1 SQL

**File**: `tools/gen_prod_sql.py` → `prod-sql-1-location-catalog.sql`

**Intent**: Location update, 5 suppliers, 130 scoped rows, settings upsert, invariants, audits.

**Contract**:
- STEP 0 (read-only): SLONY row; settings plan (INSERT 18 / UPDATE 90 / unchanged 13 among the
  final 121; 12 leftovers untouched here — 133 rows after step 1); new supplier/row ids absent; shared-catalog and
  FORUM/SUPERSAM fingerprints (count + md5); invariant pre-check across all locations.
- STEP 1 `DO` block, `dry_run boolean := true` at the top. Guards: 0029 columns exist; SLONY is
  inactive, not own-catalog, no address/NIP, 115 settings, no orders/counts/receipts; no
  `SUP_%_GDA` supplier and no `location_id='SLONY'` row exists; every source row exists (count
  check, STEP 0 prints each source's `active`); SP_COCACOLA_P066/P067 have upp 24 and no case.
  Then: UPDATE `locations` (ROW_COUNT 1); INSERT 5 suppliers; INSERT 130 rows via a temp
  mapping table `INSERT … SELECT` from the source rows with overrides; settings upsert over the final
  set (`ON CONFLICT (location_id, product_id) DO UPDATE … WHERE (min,target,max) IS DISTINCT`,
  notes appended `[2026-10-16 arkusz GDA, przed a/b/c; …]`, new rows noted `(nowy wiersz)`).
  Post-checks: per-supplier primary/backup counts; every backup has an active primary at SLONY;
  every scoped row has settings; no scoped row on an inactive product; no double primary; no
  duplicate active (location, supplier, product); min ≤ target ≤ max; shared + FORUM/SUPERSAM
  fingerprints unchanged. `dry_run` → `RAISE EXCEPTION 'DRY RUN OK …'` with the counts.
- STEP 2 audits with expected results written next to each query.

#### 3. Step 2 SQL (leftovers)

**File**: `prod-sql-2-delete-template.sql`

**Intent**: Delete the 12 leftover template rows after step 1.

**Contract**: literal VALUES backup of the 12 rows (all columns) read before the change; guard that
step 1 is applied (own_catalog, 5 suppliers, 130 rows, 133 settings) and that the 12 live rows are
identical to the backup; DELETE by setting_id AND location_id, ROW_COUNT 12; post-check 121.

#### 4. Rollback

**File**: `rollback.sql`

**Intent**: PART 1 kill switch (deactivate the 5 GDA suppliers and SLONY-scoped rows — the captain
then sees no tabs; remove the token for a hard stop); PART 2 opt-in full data rollback, only after the
`SLONY:` token is removed from Railway (re-insert the 12 rows, delete 130 rows and 5
suppliers, restore settings from the `przed` stamps, delete `(nowy wiersz)` rows, restore the SLONY
row to its literal 2026-10-16 values). PART 2 refuses if any SLONY order/count/receipt exists.

### Success Criteria:

#### Automated Verification:

- `tools/build_mapping.py` and `tools/gen_prod_sql.py` run cleanly and their internal assertions pass
- Generated step 1 expects 5 suppliers, 130 active rows, 121 final settings (101 thresholds / 20 zero)
- Step 1 dry run on prod ends with `DRY RUN OK` and the expected counts (no data written)

#### Manual Verification:

- Spot-check 10 mapping rows against the sheet (thresholds, units, primary/backup)

---

## Phase 2: Prod apply and audit

### Overview

Apply step 1 for real, audit, then step 2.

### Changes Required:

#### 1. Apply log

**File**: `context/changes/gdansk-rollout/rollout-notes.md`

**Intent**: Record STEP 0 output (diff before), dry-run result, apply result, every audit result,
step 2 outcome, held items, open questions for Marek, operator to-dos.

**Contract**: one section per step with timestamp and the counts returned.

### Success Criteria:

#### Automated Verification:

- Step 1 applied: audits return the expected values (5 suppliers; 130 active rows by supplier; 133 settings
  before step 2; all invariant audits 0 rows; fingerprints unchanged)
- Step 2 applied (or explicitly handed to the operator if the DELETE confirmation times out):
  121 settings, 0 leftovers
- Read-only "captain view" query: 5 suppliers with orderable rows, 121 inventory products

#### Manual Verification:

- Operator confirms the DELETE prompt for step 2 if the connector asks

---

## Phase 3: Captain access, docs, verification

### Overview

Token on Railway (operator), GET-only smoke, docs.

### Changes Required:

#### 1. Captain token (operator)

**Intent**: After step 2, append `,SLONY:<kod demo SLONY>` to Railway → Variables →
`SUPPLY_OS_CAPTAIN_TOKENS` (no existing pair removed; check no other `SLONY:` pair exists — last one
wins; saving redeploys every location, do it off-peak). The captain pastes `<kod demo SLONY>`; clear the
demo browser's localStorage first (inventory draft key is not location-scoped,
`frontend/src/pages/captain-mp/InventoryCountPage.tsx:30-32`).

#### 2. Docs

**File**: `docs/pita-supply-os-v1/COMPANY_ENTITIES.md`, `docs/pita-supply-os-v1/NEW_LOCATION_CHECKLIST.md`,
`context/changes/gdansk-rollout/rollout-notes.md`

**Intent**: Move Gdańsk to the "objęte systemem" table (SLONY row, company, NIP, registered office);
add Gdańsk to the checklist's list of precedents; rollout notes with held items, questions for
Marek (D16 thresholds first, pack sizes, 0/0 rows, contacts), the crate follow-up (D15), token
rotation (D13), and the stale `inventory-card-order` SQL for SLONY.

### Success Criteria:

#### Automated Verification:

- `/verify` green (backend ruff + pytest, frontend build + lint + test) — docs-only repo change
- `supply-os-v1/tests/test_agents_md_imports.py` passes (no new `@` imports)

#### Manual Verification:

- Operator adds `SLONY:<kod demo SLONY>` on Railway and the backend redeploys
- GET-only smoke with the token: `/api/captain/suppliers` lists 5 Gdańsk suppliers; inventory list
  has 121 products; no submit
- Captain logs in with `<kod demo SLONY>` on the phone

---

## Testing Strategy

### Unit Tests:

- None (no code change). The generator self-asserts mapping invariants.

### Integration Tests:

- Prod dry run of step 1 (full transaction rolled back) is the rehearsal.

### Manual Testing Steps:

1. Log in as captain with `<kod demo SLONY>`; check tabs Kuchnie Świata Gdańsk, Selgros Gdańsk,
   Coca-Cola Gdańsk, Pago + Magazyn + Lemoniady, Blue Service Gdańsk.
2. Selgros tab shows fries greyed as backup with "Sugestia u: Kuchnie Świata Gdańsk".
3. Inventory list shows 121 products, no Warsaw-only leftovers (e.g. no "Ocet spirytusowy").
4. Do not submit an order to a supplier from a test.

## Migration Notes

Rollback is `rollback.sql` (PART 1 kill switch first, PART 2 opt-in). PART 2 contains DELETEs →
operator at the screen.

## References

- Research: `context/changes/gdansk-rollout/research.md`
- Template: `context/changes/krakow-katowice-rollout/prod-sql-B-suppliers-catalog.sql:300-358`,
  `prod-sql-B2-katowice-warsaw-cola.sql:68-193`, `prod-sql-C-delete-template.sql`, `rollback.sql`
- Checklist: `docs/pita-supply-os-v1/NEW_LOCATION_CHECKLIST.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Mapping and SQL artifacts

#### Automated

- [ ] 1.1 `tools/build_mapping.py` and `tools/gen_prod_sql.py` run cleanly and their internal assertions pass
- [ ] 1.2 Generated step 1 expects 5 suppliers, 130 active rows, 121 final settings (101 thresholds / 20 zero)
- [ ] 1.3 Step 1 dry run on prod ends with `DRY RUN OK` and the expected counts (no data written)

#### Manual

- [ ] 1.4 Spot-check 10 mapping rows against the sheet (thresholds, units, primary/backup)

### Phase 2: Prod apply and audit

#### Automated

- [ ] 2.1 Step 1 applied: audits return the expected values
- [ ] 2.2 Step 2 applied (or explicitly handed to the operator): 121 settings, 0 leftovers
- [ ] 2.3 Read-only "captain view" query: 5 suppliers with orderable rows, 121 inventory products

#### Manual

- [ ] 2.4 Operator confirms the DELETE prompt for step 2 if the connector asks

### Phase 3: Captain access, docs, verification

#### Automated

- [ ] 3.1 `/verify` green (backend ruff + pytest, frontend build + lint + test)
- [ ] 3.2 `supply-os-v1/tests/test_agents_md_imports.py` passes

#### Manual

- [ ] 3.3 Operator adds `SLONY:<kod demo SLONY>` on Railway and the backend redeploys
- [ ] 3.4 GET-only smoke with the token: 5 suppliers, 121 inventory products, no submit
- [ ] 3.5 Captain logs in with `<kod demo SLONY>` on the phone
