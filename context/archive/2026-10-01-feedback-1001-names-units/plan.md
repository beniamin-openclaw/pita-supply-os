# Feedback 2026-10-01 — names, units, bulk packs Implementation Plan

## Overview

Operator and staff feedback from 2026-09-30 and 2026-10-01 (Elektrownia and Norblin onboarding), plus Marek's
Norblin sheet. There are four parts:

- a prod master-data batch: product names, thresholds, units, gyros, rolls, Coca-Cola/Cappy glass, spices;
- a frontend PR that makes units easy to read and makes "Powód zbiorczo" sticky;
- a full-stack PR that adds optional bulk packs ("opakowania zbiorcze": karton, skrzynka, worek) on top of the base
  purchase unit;
- small leftovers.

The decision record is `plan-draft.md` (D1–D30, Q1–Q13). This plan supersedes its "Phase" and "Order of work"
sections. The planning session on 2026-10-01 added D31–D36 below.

## Current State Analysis

- **Names.** Names are master data, not code. The generic names ("Frytki Aviko (opakowania)", "Halloumi") are
  stored in `products.product_name_pl` and `supplier_products.supplier_product_name`.
  - Both builders print `supplier_product_name`: `gmail_url.py` and `emailBody.ts`.
  - The screens print `product_name_pl`.
  - Seed CSVs are stale for P021 (`kg / opak / 2.5`; prod is `szt / opak / 1`) and P129 (`SP_PAGO_P129`; prod is
    `SP_MORY_P129`).
- **Bulk-pack products (prod, read 2026-10-01).** Every D23 product has `units_per_purchase_unit = 1` and a
  purchase unit equal to the inventory unit, except P021, whose purchase unit is `opak` and inventory unit `szt`.

  | Supplier product | Inventory / purchase unit | Rounding rule | `is_critical` |
  |---|---|---|---|
  | SP_BUKAT_P006 Pomidor | kg / kg | tenth_kg | yes |
  | SP_BUKAT_P016 Cebula czerwona | kg / kg | tenth_kg | yes |
  | SP_BUKAT_P018 Cebula biała | kg / kg | tenth_kg | |
  | SP_INTERMLECZ_P015 Halloumi | szt / szt | full_only | yes |
  | SP_INTERMLECZ_P021 Frytki | szt / opak | full_only | yes |
  | SP_BLUESERV_P121 Gąbka | szt / szt | full_only | |
  | SP_MORY_P129 Rolki 80/80 | szt / szt | full_only | |
  | SP_MORY_P183 Rolki 80/20 | szt / szt | full_only | |

- **Two-field stock input.** It already exists for `upp > 1` (pago-stock-packs-plus-kg):
  `PackStockInput.tsx`, `lib/packStock.ts`, `lib/packUnits.ts`, and the declension table `i18n/packUnits.ts`.
  The table already has karton, worek, skrzynka, opak and paczka; its Python twin is in `gmail_url.py:105-152`.
- **Engine.** `suggestion.py:93-130` rounds per rule. The reason gates in `main._evaluate_submit_line` (:662-679)
  measure the deviation against `suggested_qty_purchase`; the frontend twins are `compute.ts:185` and `:192`.
  The visible math the Captain sees is rendered by `ProductCard.tsx:322-352`, not by the backend explanation text.
- **Readability.** No i18n helper returns parts: `t()` returns a string (`i18n/index.ts:61-73`), and so does
  `formatPacks` (`lib/packUnits.ts:37-39`). The units on the Captain screens are 10 px slate-500 text.
- **Bulk reason.** `overruleAll` (`lib/overruleAll.ts:46-58`) is one-shot. It skips lines that already have a
  reason (:49), and the control resets after Apply (`OverruleAllControl.tsx:56-57`).
- **Neighbouring PRs.**
  - PR #44 (inventory-card-order, migration 0027) touched none of the Captain components; it shares only additions
    to `strings.ts`.
  - PR #43 (order-email-v2, migration 0026) built the sender alias and the Gmail draft path.
  - **The next free migration number is 0028.**

## Desired End State

- On prod, every location's names, thresholds and units match the decisions below. Diffs and audits are saved in
  this folder.
- On every screen where the Captain counts, orders or reads history, the unit is bold and dark next to the number.
- Once the Captain picks "Powód zbiorczo", it fills the reason on lines added later as well, until the Captain turns
  it off. It works on the edit screen too.
- Products with a bulk pack:
  - stock and order are entered as `[karton] + [luz]`;
  - the suggestion is the nearest whole number of packs;
  - ordering either the raw need or that suggestion needs no reason;
  - the supplier e-mail prints "6 kartonów + 2 paczki (26 paczek)";
  - order lines, receipts, finance and thresholds stay in the invoice unit.
- WESTFIELD e-mails CC `westfieldpitabros@gmail.com`. The staff message has gone out.

### Key Discoveries:

- Bulk-pack fields must be threaded into these builders:
  - `_build_orderable_item` (`main.py:202-232`);
  - `ManagerOrderLineDetail`, built twice (`main.py:1286-1307` and `_enrich_lines_for_detail` `:1417-1438`);
  - `captain_inventory_products` (`:2904`);
  - `_enrich_inventory_count_detail` (`:3436`);
  - `_aggregate_transport_lines` (`:4250`, `:4275`);
  - `OrderEditPage.lineToItem` (`OrderEditPage.tsx:37-62`).
- `sheets.py` and `seed_loader.py` need no code for new Optional columns. A blank CSV cell drops out, and
  header validation accepts Optional fields.
- The integration fixture applies migrations explicitly (`tests/test_supabase_integration.py:207-211`, `:239`).
  A new migration must be added there (lessons: order-cancel-with-trace).
- The e-mail body is pinned byte-for-byte by golden fixtures (`tests/fixtures/order_email/`,
  `test_order_email_golden.py`, `emailBody.golden.test.ts`). Backend and frontend must change together.
- Mory rolls go out through the manual/portal copy lists: `DispatchPanel.tsx:133-137` and `ResendPanel.tsx:125`.

## Decisions added in planning (operator, 2026-10-01)

| # | Topic | Decision |
|---|---|---|
| D31 | Q13 Browary Cola | Glass P186/P187 with the current can thresholds (Cola 24/72, Zero 48/96, already whole crates of 24). Can rows P068/P069 deleted (pattern `prod-sql-2-westfield.sql`). |
| D32 | Cebula biała P018 | Also worek 5 kg (case), like P016. |
| D33 | Case rounding | The suggestion is the need rounded to the **nearest** whole number of packs, half up. Example with a 6 kg crate: need 2 kg → 0, need 3 kg → 6, need 4 kg → 6, need 10 kg → 12. |
| D34 | Reason gates with a case | No reason is required when the Captain orders either the **need** (per-rule rounded, no case) or the **case suggestion**. The deviation is measured against the nearer of the two. The critical under-order gate fires only below the smaller of the two. Going over max because of case rounding counts as packaging: no "exceeds max" note, and the uncounted over-MAX gate allows up to max rounded up to a whole pack. |
| D35 | E-mail / copy-list format | Whole packs: "6 kartonów (24 paczki)". Otherwise: "6 kartonów + 2 paczki (26 paczek)". Under one pack: "2 paczki" (no case part). |
| D36 | Manager screens | One quantity field in the invoice unit (paczka / kg / szt), as today. Next to it, a read-only hint "= 6 kartonów + 2 paczki". Only the Captain gets two fields. |

## What We're NOT Doing

- No change to `order_lines` columns. The need is not persisted:
  - `suggested_qty_purchase` stores the case suggestion the Captain saw;
  - `delta_vs_suggestion_pct` stores the deviation against the nearer of need and case suggestion.
- No relabelling of history. `units_per_purchase_unit` never changes in place on a row with order lines.
- No bulk packs for Tzatzyki, Cieciorka, Batat, Masło or Ketchup (D23 "not now").
- No case format on Transport/Pago documents. No D23 product is on Pago, so `transport.ts` and `transportPdf.ts`
  are unchanged.
- No case handling for a row with both `upp > 1` and a case: no such row exists. The migration CHECK does not
  forbid it, and the frontend falls back to the case. That fallback is documented, not tested on data.
- Transport Gmail drafts keep the order mailbox as From (D30).
- Batch N2 (supplier-only invoice names) only if the operator approves it separately.
- No deletes from Phase 6 until the operator ticks `zero-thresholds-review.md`.

## Implementation Approach

Data first, because it is independent of code and fixes most of the visible complaints. Then the code, as **one PR**
from `claude/feedback-1001-names-units-safzk7` with separate commits:

- **readability** (Phase 2) — frontend only, low risk;
- **bulk packs** (Phase 3) — migration, engine, UI, e-mail.

Why one PR: the cloud session may push only to this branch. Merge waits for migration 0028 on prod.

The bulk-pack data batch runs only after migration 0028 is on prod and the PR is merged and live.

Every prod write follows lessons.md "Master-data ops: diff before, audit after":

- a SELECT diff saved before the write, which is the rollback;
- one guarded `DO $$` block per step that re-checks the before-state and asserts row counts;
- an audit after the write;
- a dry run on a local Postgres copy before the operator sees the diff (lessons: pago-data-unity).

Operator gates in chat:

- every prod write (data batches, migration 0028);
- every merge.

## Critical Implementation Details

- **State sequencing (prod).**
  1. Migration 0028 on prod.
  2. Merge the bulk-pack PR, then confirm the Railway `/health` and the new Vercel bundle.
  3. Phase 4 data.

  Data written before the code is live is harmless: the old code ignores unknown columns. Data written before the
  migration fails.
- **Engine parity.** `compute_suggestion` and `computeSuggestion` must agree. Each side gets tests for the D33/D34
  examples with the same numbers, so a drift fails on both sides.
- **Frytki relabel (D21).** `opak` → `paczka` on SP_INTERMLECZ_P021 is label-only (upp stays 1), so relabelling old
  lines keeps their meaning. Same for gyros `blok` → `szt` (upp unchanged).

## Phase 1: Prod master-data batch (no code)

### Overview

One prod session of guarded steps, prepared as SQL files in this folder. The operator approves the full diff in
chat before anything is applied.

### Changes Required:

#### 1. Prepared SQL and diffs

**File**: `context/changes/feedback-1001-names-units/prod-sql-1.sql` (new), `prod-sql-1-diff.md` (new),
`prod-sql-1-audit.md` (written after apply)

**Intent**: One guarded `DO` block per step. Each block re-checks the before-state (names / thresholds / units equal
the read values) and raises on a mismatch or an unexpected row count.

**Contract**: the steps and their targets:

- **1.1 Names N1.** Apply `names.md` batch N1 to `products.product_name_pl` and
  `supplier_products.supplier_product_name`, guarded on the current "Now" name. Resolved rows:
  - P017: "Helcom Papryka Grillowana Czerwona 4,2kg/2,5kg" (D27);
  - P189: "Cukier w kostkach Diamant 0,5kg", supplier name "DIAMANT CUKIER KOSTKA BIAŁY 0,5kg/10" (D20);
  - P050/P051/P052/P054/P055: Prymat names from D28, with Ziele angielskie now Prymat 600 g.
- **Scope.** "All locations" means the 7 active ones: WOLA, BRACKA, KEN, BROWARY, NORBLIN, ELEKTROWNIA and
  WESTFIELD. Rows on the 6 inactive locations are left untouched.
- **Targets.** Target = max unless a step says otherwise (D17 and D18 are the exceptions).
- **1.2 Oliwki P013**, at the 7 active locations: min 1 / target 1 / max 2 (D17).
- **1.3 Liść laurowy P054**, at the 7 active locations: min 0 / target 0 / max 1 opak (D18).
- **1.4 Gyros unit** `blok` → `szt` on SP_PAGO_P024, SP_PAGO_P025 and SP_SPEC_P179 (D9). Label only.
- **1.5 Gyros nieścięty.** `products.active = false` for P177 and P185 (D8). Applied only after the staff message
  (Phase 5) has been sent; the operator confirms that in chat.
- **1.6 Miód saszetki P139.** `products.active = false` everywhere (D19).
- **1.7 Cukier P189.** `price_estimate_pln = 4.08` (D20).
- **1.8 Frytki P021** (D21):
  - `purchase_unit` `opak` → `paczka`;
  - price 18.86;
  - `order_note` "1 paczka = 2,5 kg; karton = 4 paczki";
  - Frytki z batatów P022 stay per paczka; its unit is relabelled to `paczka` only if it is `opak` today.
- **1.9 Rolls** (D24), at NORBLIN, ELEKTROWNIA and WESTFIELD:
  - P183 80/20: min 12 / target 30 / max 30 rolls;
  - P129 80/80: min 12 / target 24 / max 24 rolls;
  - rows are created where missing; P142 stays inactive; thresholds at the other locations are unchanged.
- **1.10 Coca-Cola glass.** Same pattern as `prod-sql-2-westfield.sql`:
  - ELEKTROWNIA (D25): P186 48/120, P187 72/144; can rows deleted;
  - WESTFIELD re-round (D25): P186 48/96, P187 72/120;
  - BROWARY (D31): P186 24/72, P187 48/96; P068/P069 rows deleted.
- **1.11 Cappy** (D26):
  - two new products "Cappy Jabłko 0,25 l szkło" and "Cappy Pomarańcza 0,25 l szkło";
  - IDs: the next free `P…` numbers, read from prod at dry-run time;
  - supplier Coca-Cola, purchase unit skrzynka, upp 24, 100.32 zł;
  - copied from P186/P187: `rounding_rule`, `is_critical`, `counts_toward_minimum`, category;
  - positions: `inventory_order` and `display_order` placed right after P064/P065;
  - P064/P065 renamed "… 0,33 l PET";
  - glass rows at WOLA, BRACKA, KEN, WESTFIELD, ELEKTROWNIA and BROWARY, with max rounded to a whole crate
    (never 0) and min ≤ max; the PET rows there are deleted;
  - NORBLIN keeps PET;
  - ambiguous roundings are listed separately in the diff for the operator.
- **Moved to Phase 1b:** papryka P017 and the Prymat spice units. Both change what stored counts mean.

Guards (plan-review F3):

- **1.4 and 1.8** are label-only, so they get no open-order guard. The diff lists the open lines for information.
- **1.10 and 1.11 deletes.** A setting row is deleted only when no `captain_submitted` or `manager_claimed` order at
  that location has a line for that product. Otherwise the step raises.
  - Reason: a sent-back order whose setting row is gone cannot be edited by the Captain (400).
  - Today this blocks KEN (P065 claimed) and BRACKA (P068/P069 claimed) until those orders leave the queue.
  - The step is retried when the queue is clear. Its other rows do not wait: the block is split per location.

Audit:

- every touched row equals its target;
- `min ≤ target ≤ max` on every active location row touched;
- P139, P177 and P185 are `active = false`; their setting rows are kept on purpose (history, no `active` column
  there);
- no "(opakowania)" left on an active name;
- no placeholder e-mails.

### Success Criteria:

#### Automated Verification:

- `prod-sql-1.sql` runs clean once on a local Postgres loaded with the prod schema + master data + open
  orders/order_lines (so the open-order guards are exercised); a second run raises on its guards.
- Opus xhigh review of `prod-sql-1.sql` + diff: no blocking findings.

#### Manual Verification:

- The operator approves `prod-sql-1-diff.md` in chat before apply.
- The post-apply audit is saved in `prod-sql-1-audit.md` and shows every assertion green.
- The operator spot-checks one location's Captain order screen (Intermlecz) and inventory list on prod.

**Implementation Note**: Steps 1.5 and 1.13 can be held back without blocking the rest. The diff marks them as
separable.

---

## Phase 1b: Units that change what stored counts mean (papryka, Prymat spices)

### Overview

These are steps 1.12 and 1.13 of the draft. Counts are stored as plain numbers and the unit is joined live, so
changing `inventory_unit` re-reads old counts in the new unit (plan-review F2). Approach:

- no history rewrite;
- the old papryka row is retired, not edited;
- per-location threshold decisions in the diff;
- applied on the day of a full inventory count, with the staff message.

### Changes Required:

#### 1. Prepared SQL

**File**: `prod-sql-1b.sql`, `prod-sql-1b-diff.md`, `prod-sql-1b-audit.md`

**Intent**: Move papryka and four Prymat spices to per-jar/per-pack counting without corrupting thresholds or
re-labelling past order lines.

**Contract**:

- **Papryka P017** (D27, history-safe technique from `plan-draft.md` Phase 2):
  - new supplier row `SP_INTERMLECZ_P017_H`, named "Helcom Papryka Grillowana Czerwona 4,2kg/2,5kg", `opak`, upp 1;
  - the old `SP_INTERMLECZ_P017` (`opak × 3,6`) set `active = false`, so its 10 order lines keep reading in kg;
  - `products.inventory_unit` kg → `opak`;
  - thresholds min 0,5 / target 1,5 / max 1,5 at the 7 active locations;
  - guard: no `captain_submitted` or `manager_claimed` line on the old row, and no `manager_sent` one without a
    receipt.
- **Prymat spices** (D28):
  - P050 pieprz, P051 oregano and P052 papryka słodka: inventory and purchase unit kg → `szt`, upp 1;
  - P055 ziele is already `opak` → `szt` (label only);
  - prices 47.60 / 11.30 / 25.76 (unchanged) / 43.90; P054 liść 14.70 (in Phase 1).
- **Per-location thresholds.**
  - Already in packs (copied from Marek's sheet), so they stay: WOLA, BRACKA, ELEKTROWNIA, NORBLIN, WESTFIELD.
  - Clearly kg, so they are divided by the jar weight and rounded to 0,5: BROWARY.
  - KEN: shown in the diff with both readings; the operator decides.
- **Diff contents.** Every active location's last count of P017/P050/P051/P052/P055, with its date and the unit
  it was really entered in.
- **Same guard as P017** on the spice supplier rows: no line in `captain_submitted` or `manager_claimed`, and none
  `manager_sent` without a receipt.

### Success Criteria:

#### Automated Verification:

- `prod-sql-1b.sql` runs clean once on the local copy; a second run raises on its guards.

#### Manual Verification:

- The operator approves the diff, including the per-location choices, and names the full-count day.
- The staff message (part 1b) has gone out before apply.
- Applied, and the audit is saved.

---

## Phase 2: PR "readability" — bold units and sticky bulk reason (frontend only)

### Overview

Units are bold and dark wherever the Captain counts, orders or reads history (D11, D29). "Powód zbiorczo" becomes
sticky, can overwrite, and appears on the edit screen (D10).

### Changes Required:

#### 1. Unit rendering helpers

**File**: `frontend/src/i18n/index.ts`, `frontend/src/lib/packUnits.ts`,
`frontend/src/pages/captain-mp/components/UnitLabel.tsx` (new)

**Intent**: Bold a unit inside an interpolated sentence without moving copy out of `src/i18n/`.

**Contract**:
- `tParts(key, vars)` returns `(string | ReactNode)[]`. A var may be a node; `t()` is unchanged.
- `formatPacksParts(n, unit, lang)` sits next to `formatPacks`, which stays for the Manager.
- `UnitLabel` uses `font-bold text-slate-900`. Captions under inputs go from 10 px to 11 px.

#### 2. Captain screens

**Files**:
- `ProductCard.tsx`:
  - stock caption :280-285, order caption :385-390;
  - header :156-199;
  - below-minimum line :214-228;
  - suggestion detail :322-353.
- `PackStockInput.tsx`: captions :134-136 and :155-157, reading :86-95/:159-165, prompt :173-175.
- `InventoryCountGrid.tsx`: unit :215, pack hint :247-255, "ostatnio" :262-269 (which gains its unit).
- D29 screens:
  - `OrderDetailPage.tsx` :271-272 (moves the hard-coded "stan … sugestia …" into i18n), :286-295, :307, :321-324;
  - `InventoryHistoryPage.tsx` :227;
  - `ReceiptLineCard.tsx` :30, :44.

**Intent**: Every number+unit pair the Captain reads shows the unit via `UnitLabel`.

**Contract**: The text content is unchanged except for the "ostatnio" unit and the OrderDetailPage line now
coming from i18n.

#### 3. Sticky "Powód zbiorczo"

**Files**:
- `lib/overruleAll.ts` and its test;
- `components/OverruleAllControl.tsx`;
- `CaptainMP.tsx`:
  - effect :251-267;
  - draft restore :280-311;
  - auto-save :403-425;
  - flush :435-465;
  - save :513-522;
  - clears :490/:498/:654/:662;
  - apply :604-611;
  - :799-800;
- `captain-mp/types.ts` `DraftState`;
- `OrderEditPage.tsx` :290.

**Intent**: Picking a bulk reason applies it now and to future lines until the Captain turns it off.

**Contract**:
- `overruleAll(items, lines, bulk, mode)`:
  - `"overwrite"` (explicit Apply) replaces the reason on every line that requires one;
  - `"fillMissing"` (automatic) fills only lines without a reason;
  - switching away from OTHER drops the stale OTHER comment;
  - returns the same object when nothing changed.
- `bulkReason: {code, comment} | null` lives in the CaptainMP state:
  - reset on supplier switch;
  - an effect applies `fillMissing` on line changes;
  - stored as an optional field in `DraftState` through save, auto-save, flush and every clear;
  - counted by `draftHasValues`.
- The control shows the active reason and a "Wyłącz" action; copy goes in `src/i18n/`.
- The control is hidden when `suggestion_alerts_enabled === false`.
- `OrderEditPage` gets the same control (no drafts there).
- A hand-picked reason on a line is never overwritten by `fillMissing`.

### Success Criteria:

#### Automated Verification:

- `cd frontend && npm run build && npm run lint && npm run test` green.
- New or updated tests:
  - `overruleAll` overwrite / fillMissing / OTHER comment / alerts-off;
  - ProductCard, PackStockInput and InventoryCountGrid text assertions moved to `toHaveTextContent`;
  - a sticky-flow component test on CaptainMP and OrderEditPage;
  - draft round-trip carrying `bulkReason`.
- `/10x-impl-review`: no blocking findings.

#### Manual Verification:

- After merge and a confirmed Vercel bundle, on prod with a Captain token:
  - units are bold on the order card, the inventory grid and the order history at 375 px;
  - the bulk reason sticks to a line added after Apply and survives a draft reload;
  - "Wyłącz" stops it;
  - nothing is submitted (back out).

---

## Phase 3: PR "bulk packs" — migration 0028, engine, inputs, e-mail

### Overview

Optional case on `supplier_products`. Captain two-field inputs, a case-aware suggestion and gates, a Manager hint,
and case formatting in the e-mail and copy lists.

### Changes Required:

#### 1. Schema and threading

**Files**:
- `supply-os-v1/migrations/0028_supplier_product_case.sql` (new);
- `tests/test_supabase_integration.py` (fixture :207-211/:239);
- `app/supabase_backend.py` `_SUPPLIER_PRODUCT_COLUMNS`;
- `app/models.py`: `SupplierProduct`, `ManagerOrderLineDetail`, `InventoryProduct`;
- `app/main.py`: `_build_orderable_item`, both `ManagerOrderLineDetail` builders, `captain_inventory_products`.
  `InventoryCountDetailLine` and `TransportAggregateLine` are NOT threaded: no reader exists (plan-review F10).
- `frontend/src/types.ts`;
- `OrderEditPage.lineToItem`;
- seed CSVs under `docs/pita-supply-os-v1/seed/` (plan-review F6):
  - P021: inventory `szt`, purchase `paczka`, upp 1;
  - P129 stays on `SP_PAGO_P129`, so the Mory move is not mirrored in seed and
    `test_captain_orderable_wola_pago_returns_18_items` stays valid;
  - one seed row gets a case (Bukat P006, skrzynka 6) so seed-mode tests exercise the path.

**Intent**: Carry `case_unit` and `units_per_case` from master data to every screen and builder that prints or
inputs quantities.

**Contract**:
- `case_unit text NULL` and `units_per_case numeric NULL`.
- `CHECK ((case_unit IS NULL) = (units_per_case IS NULL))`.
- `CHECK (units_per_case IS NULL OR units_per_case > 1)`.
- Pydantic: `Optional[str] = None` and `Optional[float] = None`. TS: optional fields.
- The header comment gives the rollback (`ALTER TABLE … DROP COLUMN …`) and says the migration is applied on prod
  before the code.
- No `%` character anywhere in the file.
- `ADD COLUMN IF NOT EXISTS`, and the CHECKs are added in a re-runnable way (drop-if-exists then add, or guarded
  by a `pg_constraint` lookup).

#### 2. Engine + gates (backend and frontend parity)

**Files**:
- `app/suggestion.py`;
- `app/main.py` `_evaluate_submit_line` (and the `/api/captain/suggest` input);
- `frontend/src/pages/captain-mp/lib/compute.ts`;
- `pages/manager/components/OrderLineTable.tsx` :176 and `OrderDetailPage.tsx` :337 (the "no baseline" branch);
- tests `tests/test_suggestion.py`, `tests/test_captain_submit.py`, `compute.test.ts`;
- a shared fixture `docs/pita-supply-os-v1/fixtures/case_suggestion_cases.json`, read by both pytest and vitest
  (F9).

**Intent**: D33 rounding and D34 gates.

**Contract**:
- `SuggestionInput.units_per_case: Optional[float]`.
- The output keeps `suggested_qty_purchase` (the case suggestion) and adds `need_qty_purchase` (the per-rule
  rounded need; equal to the suggestion when there is no case).
- Case suggestion = `round_half_up(need / upc) × upc`, where `round_half_up(x) = floor(x + 0.5)` on both sides.
- **Half-up fix (plan-review F4).** The `up_for_critical` rule switches from Python `round()` (banker's rounding)
  to `floor(x + 0.5)`, matching the frontend. 0.5, 1.5 and 2.5 are pinned on both sides. This fixes an existing
  drift.
- **"No baseline" branch (plan-review F1).** It keys on `need == 0`, not `suggested_qty_purchase == 0`:
  - `main.py:649`, `compute.ts:145`;
  - on the two detail screens: show the stored deviation whenever it is set; "brak bazy" only when it is null.
  - When the case suggestion is 0 but the need is not, the normal D34 gates apply.
- Gates:
  - `ref = need` if `|final − need| ≤ |final − case|`, else `case`;
  - `delta = |final − ref| / max(ref, step)`; the frontend gets the same `step` floor, so no "+∞%" (F9);
  - the critical gate fires when `final < min(need, case)`;
  - the uncounted over-MAX gate allows up to `ceil(max / (upc·upp)) · upc·upp`.
- When the case suggestion exceeds max only because of case rounding, the "exceeds max" note is dropped.
- Without a case, behaviour is byte-identical, and the existing tests pass unchanged.
- Shared examples, pinned on both sides with a 6 kg crate:

  | Need | Case suggestion | Ordered | Reason required? |
  |---|---|---|---|
  | 2 | 0 | 0 or 2 | no |
  | 4 | 6 | 4 or 6 | no |
  | 4 | 6 | 1 | yes, critical |
  | 10 | 12 | 18 | yes, >25% |
  | 2 | 0 | 18 | yes, >25% (F1) |
  | 3 | 6 | 3 or 6 | no (half-up boundary) |

#### 3. Captain inputs

**Files**: `ProductCard.tsx` (stock :236-255, order :356-391, header thresholds), `InventoryCountGrid.tsx` :182-227,
`PackStockInput.tsx`, `lib/packStock.ts`, `lib/packUnits.ts`, `i18n/strings.ts`.

**Intent**: When a case is set, stock and order show `[case] + [loose]`. Thresholds and the suggestion also show the
case equivalent.

**Contract**:
- The pack size for stock is `units_per_case × upp` in inventory units, with `packUnit = case_unit`.
- The split reuses `splitPackStock` (`lib/packStock.ts`), and so does `formatCaseQty` (F9).
- For the order, the pack size is `units_per_case` in purchase units.
- The component still emits one combined number, so drafts and `buildPayloadLines` are unchanged.
- A case takes precedence over `upp > 1`.
- Order-input copy gets its own keys (not `stock.*`).
- The layout stays readable at 375 px.

#### 4. Manager hint

**Files**: `pages/manager/components/OrderLineTable.tsx` :216-231 and the Sugestia cell :161-167;
`transport/TransportMatrix.tsx` :109 only if a D23 product can appear there (it cannot today — skip).

**Intent**: D36 — one field in the invoice unit, plus a read-only "= N kartonów + M paczek".

#### 5. E-mail and copy lists

**Files**:
- `app/gmail_url.py` (`_build_body` :245-270), with a new `_format_case_qty` next to the declension table;
- `frontend/src/pages/manager/lib/emailBody.ts` :140-149, with a new `formatCaseQty` in `lib/packUnits.ts`;
- `DispatchPanel.tsx` :133-137;
- `ResendPanel.tsx` :125;
- golden fixtures `tests/fixtures/order_email/` (one new fixture with a case line);
- `test_order_email_golden.py`, `emailBody.golden.test.ts`.

**Intent**: D35. Quantities still go through `effective_ordered_qty` / `lib/orderQty.ts` only.

**Contract**:
- Python and TS produce identical strings for the shared fixture.
- Lines without a case are byte-identical to today, so the existing fixtures are unchanged.
- The golden tests read the new case keys with `.get` / optional chaining, so the old fixtures need no edit (F9).

### Success Criteria:

#### Automated Verification:

- `cd supply-os-v1 && ruff check . && python -m pytest -q` green.
- `python -m pytest -m integration` green on a local Postgres 16 with 0028 applied (also runs in CI).
- `cd frontend && npm run build && npm run lint && npm run test` green.
- The golden e-mail tests are green on both sides with the new case fixture.
- `/10x-impl-review` (Opus xhigh): no blocking findings.

#### Manual Verification:

- The operator approves migration 0028 in chat. It is applied on prod before merge, and the columns are verified.
- After merge, Railway `/health` and the new Vercel bundle are confirmed.
- Before the Phase 4 data exists, the order screens are unchanged on prod: no case is set yet.

---

## Phase 4: Prod bulk-pack data (D23, D32)

### Overview

Set `case_unit` / `units_per_case` on the eight supplier_products. Runs only after Phase 3 is live.

### Changes Required:

#### 1. Prepared SQL

**File**: `prod-sql-2-cases.sql`, `prod-sql-2-diff.md`, `prod-sql-2-audit.md` (all in this folder)

**Intent**: Write the cases with a guard that both columns are NULL before, upp = 1, and the purchase unit is as
expected (`paczka` on SP_INTERMLECZ_P021, so Phase 1 step 1.8 has run).

**Contract**:

| Supplier product | case_unit | units_per_case |
|---|---|---|
| SP_BUKAT_P006 | skrzynka | 6 |
| SP_BUKAT_P016 | worek | 5 |
| SP_BUKAT_P018 | worek | 5 |
| SP_INTERMLECZ_P021 | karton | 4 |
| SP_INTERMLECZ_P015 | karton | 12 |
| SP_MORY_P129 | opak | 6 |
| SP_MORY_P183 | opak | 6 |
| SP_BLUESERV_P121 | opak | 10 |

`order_note` is cleared where it only restated the case ("opak. zbiorcze 12 szt", "worek 5 kg"). This is listed in
the diff.

**Rows where the case suggestion is always 0 (plan-review F5).** The diff lists every active location whose target
is under half a case. Today these are P018 cebula biała (target 0,5–1 kg vs worek 5 kg) and BRACKA P129 (target 2 vs
opak 6). Ordering one real pack on such a row always asks for a reason. For each listed row the operator picks one:

- raise the thresholds to at least one pack;
- drop the case on that product;
- keep it as it is.

The choice is applied in the same block.

### Success Criteria:

#### Automated Verification:

- Local dry run green; guards re-raise on the second run.

#### Manual Verification:

- The operator approves the diff in chat. After apply, the audit is saved.
- On prod with a Captain token, the Bukat card for Pomidor shows `[skrzynki] + [kg]` and the suggestion in whole
  crates. The order is backed out.
- The Manager dispatch preview shows "N skrzynek (… kg)". Never sent.

---

## Phase 5: Leftovers and staff message

### Changes Required:

#### 1. WESTFIELD mailbox (old step 1.7)

**File**: `prod-sql-3-westfield-email.sql` (guarded single UPDATE + audit)

**Intent**: `locations.email = 'westfieldpitabros@gmail.com'` (D12; DW on supplier e-mails).

#### 2. New-location checklist

**File**: `docs/pita-supply-os-v1/NEW_LOCATION_CHECKLIST.md`

**Intent**: Add these lines (the doc commit lands with the Phase 3 PR):
- set `locations.sender_email` (send-as alias of biuro@), `locations.phone` and `locations.email`;
- pick glass or PET for Coca-Cola and Cappy;
- set roll sizes from Sławek's table.

#### 3. Staff message

**File**: `staff-message.md` (Polish text for the operator to send)

**Intent**: The draft from `plan-draft.md` Phase 6, updated:
- gyros nieścięty, and gyros counted in szt;
- frytki in paczki + kartony;
- liść laurowy 80 g;
- the new names;
- sticky bulk reason;
- `[skrzynka] + [kg]` for pomidory and cebula, `[karton] + [szt]` for halloumi, `[opak] + [szt]` for rolls and
  gąbka;
- miód w saszetkach removed (F7);
- Coca-Cola now in glass at ELEKTROWNIA and BROWARY (F7);
- Cappy split into glass 0,25 and PET 0,33 (F7);
- (part 1b) spices counted per jar (szt) and papryka per opak, with a full count that day — do not pre-fill these
  products from earlier counts (F7).

There are three parts:
- part 1 goes out before Phase 1 is applied;
- part 1b on the full-count day;
- part 2 when Phase 4 is live.

### Success Criteria:

#### Manual Verification:

- The operator approves and applies 5.1. The audit shows the mailbox set.
- The operator confirms the staff message was sent.
- The NEW_LOCATION_CHECKLIST lines are committed.

---

## Phase 6: 0/0/0 cleanup (after the operator ticks `zero-thresholds-review.md`)

### Changes Required:

**File**: `prod-sql-4-zero-rows.sql`

**Intent**:
- delete only the ticked `location_product_settings` rows;
- for products that are 0/0/0 everywhere, set `products.active = false` instead (operator's choice per row);
- diff, guard and audit as above.

### Success Criteria:

#### Manual Verification:

- The ticked list is in this folder. The operator approves the diff. The audit is saved.

---

## Testing Strategy

### Unit Tests:

- **Engine:** the D33/D34 table on both sides:
  - half-up boundary (need = 3 with a 6 kg crate → 6);
  - need 0 → 0;
  - `tenth_kg` need rounded before the case;
  - `full_only` with a case of 12.
- **Gates:** submit tests for need / case / below-min-critical / over-max-by-case / uncounted over-max within a
  rounded max, plus alerts-off unchanged.
- **Formatting:** `formatCaseQty` / `_format_case_qty` for whole packs, packs + loose, under one pack, and
  decimals (kg).
- **overruleAll:** all modes.

### Integration Tests:

- `test_supabase_integration.py` reads/writes a supplier_product with a case through the backend, and the CHECK
  rejects a half-set pair.

### Manual Testing Steps:

1. Captain on prod (Bukat, WOLA): enter stock as crates + kg, see the suggestion in crates, order the raw need, and
   confirm no reason prompt; back out.
2. Captain: pick "Powód zbiorczo", add a new product line, and confirm it has the reason; reload the draft.
3. Manager: open a claimed order with frytki and confirm the "= N kartonów" hint and the e-mail preview line;
   do not dispatch.

## Migration Notes

- 0028 is additive and nullable. Old code ignores it. Rollback is a `DROP COLUMN` (data loss only of the cases,
  which `prod-sql-2-diff.md` records).
- Seed CSV changes are part of the Phase 3 PR so local dev and tests match prod.

## References

- Decision record: `context/changes/feedback-1001-names-units/plan-draft.md`
- Names: `names.md`. 0/0/0 review: `zero-thresholds-review.md`. Operator inputs: `inputs/`.
- Pack input precedent: `context/archive/2026-09-28-pago-stock-packs-plus-kg/`
- Prod SQL pattern: `context/archive/2026-09-29-elektrownia-westfield-rollout/` (`prod-sql-2-westfield.sql`),
  `context/archive/2026-09-28-pago-data-unity/`
- Sender alias: `context/changes/order-email-v2/handoff-feedback-1001.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Prod master-data batch

#### Automated

- [x] 1.1 prod-sql-1.sql dry-run clean on local Postgres; guards re-raise on second run — b18d17f
- [x] 1.2 Opus xhigh review of prod-sql-1 + diff with no blocking findings — b18d17f

#### Manual

- [x] 1.3 Operator approves prod-sql-1-diff.md in chat — f7b960b
- [ ] 1.4 Applied; prod-sql-1-audit.md saved, all assertions green (partial 2026-10-02, see prod-run-2026-10-02.md: DELETE blocks, 1.5, 1.11d/h pending)
- [ ] 1.5 Operator spot-check on prod (Intermlecz order screen, inventory list)

### Phase 1b: Units that change stored meaning

#### Automated

- [x] 1b.1 prod-sql-1b.sql dry-run clean; guards re-raise on second run — b18d17f

#### Manual

- [ ] 1b.2 Operator approves diff and names the full-count day
- [ ] 1b.3 Staff message part 1b sent before apply
- [ ] 1b.4 Applied; audit saved

### Phase 2: PR readability

#### Automated

- [x] 2.1 Frontend build, lint and tests green — 9dc5b21, 2d1394d
- [x] 2.2 New/updated tests for overruleAll modes, sticky flow, draft bulkReason, text assertions — 9dc5b21, 2d1394d, e3b01cd
- [x] 2.3 impl-review with no blocking findings — 08590b0 (review), F1 fixed in e3b01cd

#### Manual

- [ ] 2.4 After merge and confirmed Vercel bundle: bold units and sticky reason verified on prod, backed out

### Phase 3: PR bulk packs

#### Automated

- [x] 3.1 Backend ruff and pytest green — 056f7bf, 6ac6dab, 3d4b890, 2a2ab42, 439976a
- [x] 3.2 Integration tests green with 0028 — 056f7bf, 439976a
- [x] 3.3 Frontend build, lint and tests green — e77994c, f4979e2, 3d4b890, 2a2ab42, b0ff862, 66d9287
- [x] 3.4 Golden e-mail tests green on both sides with the case fixture — 3d4b890
- [x] 3.5 impl-review with no blocking findings — 08590b0 (review), F1–F5 fixed in 439976a, e3b01cd, b0ff862, 66d9287

#### Manual

- [x] 3.6 Operator approves 0028; applied on prod before merge; columns verified — f7b960b
- [ ] 3.7 After merge: Railway health and new Vercel bundle confirmed (Vercel READY on ec58b78; Railway /health for the operator)
- [ ] 3.8 Order screens unchanged on prod before case data

### Phase 4: Prod bulk-pack data

#### Automated

- [x] 4.1 prod-sql-2 dry-run clean; guards re-raise on second run — f7b960b

#### Manual

- [x] 4.2 Operator approves diff; applied; audit saved — f7b960b
- [ ] 4.3 Captain Pomidor card verified on prod, backed out
- [ ] 4.4 Manager e-mail preview verified on prod, not sent

### Phase 5: Leftovers and staff message

#### Manual

- [x] 5.1 WESTFIELD mailbox applied; audit saved — see prod-run-2026-10-02.md
- [x] 5.2 NEW_LOCATION_CHECKLIST updated — ce05824
- [ ] 5.3 Staff message sent (operator confirms)

### Phase 6: 0/0/0 cleanup

#### Manual

- [ ] 6.1 Ticked list received; diff approved; applied; audit saved
