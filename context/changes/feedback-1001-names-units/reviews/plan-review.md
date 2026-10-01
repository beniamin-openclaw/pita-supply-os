<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Feedback 2026-10-01 — names, units, bulk packs

- **Plan**: context/changes/feedback-1001-names-units/plan.md (baseline commit 4586eae)
- **Mode**: Deep. Code was verified directly against `supply-os-v1/app` and `frontend/src`, plus five read-only SELECTs on prod Supabase (`lpzhphufjwrndfogkfub`, 2026-10-01). Nothing was written.
- **Date**: 2026-10-01
- **Verdict**: REVISE
- **Findings**: 2 critical, 6 warnings, 2 observations

> **Context.** While this review was running, Phase 2 was implemented and committed on this branch (`9dc5b21 feat(captain): bold units and sticky bulk reason`), and `UnitLabel.tsx`, `tParts` and `formatPacksParts` appeared. Code evidence below cites the plan baseline 4586eae unless it says otherwise. Phase 2 points go to its impl-review (see F10).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | WARNING |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

- Paths: 12/12 exist (`main.py`, `suggestion.py`, `compute.ts`, `gmail_url.py`, `emailBody.ts`, `DispatchPanel.tsx`, `ResendPanel.tsx`, `OrderLineTable.tsx`, `test_supabase_integration.py`, seed `supplier_products.csv`, `NEW_LOCATION_CHECKLIST.md`, `order-email-v2/handoff-feedback-1001.md`). 0028 is free (the highest is 0027).
- Symbols: 9/9 (`_build_orderable_item`, `_enrich_lines_for_detail`, `_aggregate_transport_lines`, `_evaluate_submit_line`, `_SUPPLIER_PRODUCT_COLUMNS`, `overruleAll`, `formatPacks`, `PackStockInput`, `effective_ordered_qty`). Line references are accurate to within a few lines.
- Brief vs plan: consistent.
- Draft vs plan: the plan correctly supersedes D22 (0027 → 0028, "up to full cases" → D33 nearest).
- The D23 before-state table matches prod.

## Findings

### F1 — The D34 gate breaks when the case suggestion rounds to 0 but the need is above 0

- **Severity**: ❌ CRITICAL (blocking)
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 3 §2 Engine + gates; §4 Manager hint; Testing Strategy

**Detail.** The plan stores the case suggestion in `suggested_qty_purchase` (§2 contract, "What We're NOT Doing"). Four places branch on `suggested_qty_purchase == 0` before any gate runs:

- `main.py:649` (`elif suggested_qty_purchase == 0:` means no gate, `delta=None`, and the warning "stock X ≥ target Y (info)");
- `compute.ts:145` (`suggested === 0` returns an info pill, `requiresReason: false`);
- `OrderLineTable.tsx:176` and `OrderDetailPage.tsx:337` (both show "brak bazy" or "ponad cel").

With D33 nearest-pack rounding, a case suggestion of 0 with a need above 0 is common:

- halloumi with a need of 5 or less (case 12);
- frytki with a need of 1 (case 4);
- P018 at every location (see F5);
- P129 at BRACKA.

Failure scenario: KEN halloumi needs 5 szt, so the case suggestion is 0, and the Captain orders 48.

- With an unchanged zero branch, no reason is asked.
- The backend stores `delta=None` with an "info" warning claiming stock ≥ target, which is false.
- The Manager table shows "brak bazy".
- Under D34 the nearer reference is the need (5), so the deviation is 860% and a reason is required.

Table row 1 ("2 | 0 | 0 or 2 | no") passes either way, so the planned tests do not catch this.

The detail screens cannot use the need either, because it is not persisted.

**Fix**:

- Branch on `need == 0`, not on the stored suggestion, in `_evaluate_submit_line` and `computeRowState`. With a need above 0, always run the D34 gate, even when the case is 0. Without a case, need equals the suggestion, so this is byte-identical.
- In `OrderLineTable.tsx:176` and `OrderDetailPage.tsx:337`, show the stored `delta_vs_suggestion_pct` whenever it is not null, before the `suggested === 0` fallback. Under D34 a case-0 line with a need above 0 carries a delta.
- Add these pinned rows on both sides:
  - need 2, case 0, ordered 18 → reason;
  - halloumi need 5, case 0, ordered 48 → reason;
  - need 2, case 0, ordered 0 → green.
- State the pill colour when the order equals the need: green "match", like the case.

**Confidence**: HIGH. All four branches are read at the cited lines.
**Blind spot**: none significant.
**Decision**: APPLIED to plan.md (main loop, 2026-10-01; F2 → Fix A with a new Helcom row, as Phase 1b)

### F2 — Steps 1.12 and 1.13 change what stored numbers mean; the conversion rule is wrong for 5 of 7 locations and history is not addressed

- **Severity**: ❌ CRITICAL (blocking for 1.12/1.13 only; both are separable)
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 steps 1.12, 1.13; "What We're NOT Doing"; Critical Implementation Details

**Detail.** Prod reads from 2026-10-01 show four problems.

(a) **P055 is already `opak`, not kg.** P055's inventory and purchase unit are `opak` (upp 1). Only P050, P051 and P052 are kg. The plan applies "Thresholds converted from kg to jars" to all four.

(b) **Most spice thresholds are already in packs.** Prymat P050/51/52/55 thresholds are 0.5/1.5 at WOLA, BRACKA, ELEKTROWNIA, NORBLIN and WESTFIELD. These were copied 1:1 from Marek's sheet, which says "Opak" (`inputs/norblin-min-max-marek.csv` rows 77–82; `names.md`: "thresholds were copied 1:1, so only the label differs"). They already mean packs. Only BROWARY is clearly in kg (P050 0.2/0.82, P052 0.36/0.72), and KEN (0.2/1, 0.3/1) is ambiguous. A uniform kg → jar conversion would corrupt 5 of the 7 locations; for example NORBLIN pepper 1.5 / 0.82 gives 1.83 jars, where the sheet means 1.5 packs.

(c) **History and pre-fill.** Counts are stored in base units, while `inventory_unit` is joined live (`InventoryCountDetailLine.inventory_unit`, `captain_inventory_latest`, `InventoryCountGrid` "ostatnio", which shows the unit since Phase 2). After the relabel:

- BROWARY's latest counts (papryka 0.742, oregano 0.702, pepper 1.8, all kg) read as jars.
- The opt-in FR-017 pre-fill puts them into a szt field.

P017 is worse. WOLA last counted 3.6 (kg, which is 1 pack), and BROWARY 3.756 and ELEKTROWNIA 4.4 (also kg). After 1.12 these read as "3,6 opak", which is ≥ target 1.5, so the suggestion is 0. That is an under-order while stock is below target.

(d) **1.12 changes upp in place.** Step 1.12 has to change SP_INTERMLECZ_P017 from `opak × 3.6` (inventory kg) to `opak × 1` (inventory opak). That is an in-place `units_per_purchase_unit` change on a row with 10 order lines, two of them `manager_sent` and not yet received (BRACKA, WOLA). It contradicts "What We're NOT Doing" ("upp never changes in place on a row with order lines"). It also switches off `finance_match`'s `upp != 1` conversion path for past P017 receipts.

**Fix A ⭐ Recommended**: keep history, but make the step explicit and timed.

- Classify each location in the diff:
  - values that came from the sheet: keep as packs;
  - values that are clearly kg (BROWARY, and KEN after checking): divide by the pack weight, rounded to 0.5 jar.
- List every location's last count and its meaning in `prod-sql-1-diff.md`.
- For 1.12, either:
  - carve out a written exception to the upp rule, guarded on all non-terminal statuses; or
  - use the history-safe technique from `plan-draft.md` Phase 2 (new Helcom row, old row inactive). Helcom is a different product anyway (4,2 kg / 2,5 kg vs Florinis 3,6 kg).
- Apply 1.12/1.13 together with the staff message (F7), right before a full inventory count. The message says not to pre-fill spices or papryka from counts made before that date.
- Strength: no history rewrite; the operator sees every per-location decision.
- Tradeoff: one inventory cycle where old counts read in the new unit.
- Confidence: HIGH (all values above are prod reads).
- Blind spot: KEN's semantics need one more look.

**Fix B**: also rewrite the kg-valued `inventory_count_lines` for P017/P050–P052 at BROWARY, WOLA and the others into packs, in a guarded block.

- Strength: pre-fill and history are correct immediately.
- Tradeoff: it rewrites an audited snapshot (count events exist) and contradicts "no relabelling of history".
- Confidence: MED.
- Blind spot: which counts were kg and which were packs is a per-row judgement.

**Decision**: APPLIED to plan.md (main loop, 2026-10-01; F2 → Fix A with a new Helcom row, as Phase 1b)

### F3 — Open-order guards guard the wrong steps

- **Severity**: ⚠️ WARNING (should-fix)
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 Audit ("no `captain_submitted` order line depends on a changed unit, checked before 1.4, 1.8 and 1.13"); 1.10; 1.11

**Detail.** Two mismatches.

(1) **The guard blocks safe steps.** Steps 1.4 (gyros blok → szt) and 1.8 (frytki opak → paczka) are label-only and keep meaning, so open orders are safe. Prod has 5 open `captain_submitted` gyros lines (SP_PAGO_P024/P025 at BRACKA, BROWARY, ELEKTROWNIA and NORBLIN). The guard would make 1.4 raise until the weekly Pago Transport drains.

(2) **Riskier steps get no guard or only a narrow one.** The meaning-changing steps get none (1.12) or only a `captain_submitted` check (1.13), and the `location_product_settings` deletes in 1.10 and 1.11 get none. Nothing references `location_product_settings` by foreign key (0001 schema), so the deletes are safe for history.

They are not safe for open orders. `captain_order_edit` refuses any line without a setting (`main.py`: "product … has no location_product_setting at this location" → 400). Prod today has:

- a `manager_claimed` order on KEN with Cappy P065;
- a `manager_claimed` order on BRACKA with P068/P069.

If the Manager sends either back ("Odrzuć do poprawy") after 1.11, the Captain cannot edit it.

**Fix**:

- Drop the open-order guard for 1.4 and 1.8; list the open lines in the diff for information only.
- For 1.12 and 1.13, guard on `captain_submitted`, `manager_claimed`, and `manager_sent` without a receipt.
- For 1.10 and 1.11, guard on `captain_submitted` and `manager_claimed` lines for the deleted product at that location, or apply when the Coca-Cola queue is empty.

**Decision**: APPLIED to plan.md (main loop, 2026-10-01; F2 → Fix A with a new Helcom row, as Phase 1b)

### F4 — Backend and frontend round halves differently (pre-existing), and the Cappy glass crates in 1.11 will hit it

- **Severity**: ⚠️ WARNING (should-fix)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 §2 (engine parity); Phase 1 §1.11

**Detail.** For non-critical `up_for_critical` rows:

- the backend (`suggestion.py:69`) uses `float(round(raw))`, Python's half-to-even rounding: 0.5 → 0 and 2.5 → 2;
- the frontend (`compute.ts:21`) uses `Math.round`, which rounds half up: 0.5 → 1 and 2.5 → 3.

No test covers `up_for_critical` rounding on either side.

Cappy P064/P065 are non-critical `up_for_critical` rows (zgrzewka 12, targets 12/24/36). Glass crates of 24 with targets 24/48 hit raw 0.5 whenever stock is half a crate.

Failure scenario: the screen shows suggestion 1 crate. The Captain orders 1. The backend computes 0, stores `delta=None`, and the Manager sees "ponad cel" or "brak bazy".

D33 also says "half up". An implementer who reaches for Python `round()` gets D33's own example wrong: need 3 kg with a 6 kg crate would give 0 instead of 6.

**Fix**: in Phase 3, use `math.floor(x + 0.5)` (after a 6-decimal clean) for D33 and for `up_for_critical` when the product is not critical. Pin 0.5 / 1.5 / 2.5 on both sides.

**Decision**: APPLIED to plan.md (main loop, 2026-10-01; F2 → Fix A with a new Helcom row, as Phase 1b)

### F5 — For P018 everywhere and P129 at BRACKA, the case suggestion is always 0 and a one-case order always needs a reason

- **Severity**: ⚠️ WARNING (should-fix; data feasibility, not a re-run of D32)
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 4 (D23/D32 table)

**Detail.** Prod thresholds:

- Cebula biała P018: target 0.5–1 kg at all 7 active locations, while the bag (worek) is 5 kg.
- P129 at BRACKA: target 2 rolls, while the pack (opak) is 6.

Since `need / upc < 0.5`, the D33 case suggestion is always 0. Under D34, ordering one real bag (5 kg against a need of 1) is a 400% deviation, so the counted path asks for a reason every time. The uncounted path allows it, because max is rounded up to a whole pack.

The two-field `[worki] + [kg]` input for a product whose maximum is 1 kg adds noise.

**Fix**: in `prod-sql-2-diff.md`, list every row where `target < units_per_case / 2`, and ask the operator, row by row, to either raise the thresholds to case scale or skip the case for that product or location.

**Decision**: APPLIED to plan.md (main loop, 2026-10-01; F2 → Fix A with a new Helcom row, as Phase 1b)

### F6 — The seed-CSV "fix to match prod" breaks a test and needs rows the plan does not list

- **Severity**: ⚠️ WARNING (should-fix)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §1 (seed `supplier_products.csv`)

**Detail.** Moving seed `SP_PAGO_P129` to `SP_MORY_P129` breaks `tests/test_main.py::test_captain_orderable_wola_pago_returns_18_items`, which asserts `len == 18` and that P129 is among them. It also needs rows the plan never lists:

- a `SUP_MORY` row in seed `suppliers.csv` (absent);
- a P183 row in `products.csv` (absent), plus its `location_product_settings` rows;
- seed `products.csv` P021 `inventory_unit` changed from kg to szt (prod is szt).

**Fix**: either list these seed edits and the test update, or (leaner) leave P129 alone and add case values only to the seed rows that the new tests use (for example P006 and P021).

**Decision**: APPLIED to plan.md (main loop, 2026-10-01; F2 → Fix A with a new Helcom row, as Phase 1b)

### F7 — The staff message leaves out the changes that most affect how staff count

- **Severity**: ⚠️ WARNING (should-fix)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 5 §3 Staff message

**Detail.** The bullets cover gyros, frytki, liść, names, the sticky reason and cases. They do not cover:

- spices moving from kg to szt (1.13);
- papryka counted per opak (1.12);
- the Cappy glass/PET split, the new names and the Coca-Cola glass switch at ELEKTROWNIA and BROWARY (1.10, 1.11);
- the removal of honey sachets (1.6).

Only 1.5 is tied to the message being sent.

**Fix**: add these bullets, and gate 1.12 and 1.13 on the message, as 1.5 is (see F2).

**Decision**: APPLIED to plan.md (main loop, 2026-10-01; F2 → Fix A with a new Helcom row, as Phase 1b)

### F8 — Phase 1 targets and scope are under-specified, and the audit contradicts itself

- **Severity**: ⚠️ WARNING (should-fix)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 (1.2, 1.3, 1.10–1.13, Audit, Automated criteria); Progress

**Detail.**

(a) **Location scope.** Prod has 13 locations, 6 of them inactive (FORUM, KAMIENICA, KULINARNA, SLONY, STARY_BROWAR, SUPERSAM), and some of the inactive ones have setting rows (P017 has 12). "All 7 locations" and "every location that has the row" must name the 7 active ones.

(b) **Targets.** 1.10 and 1.11 give min/max but no target. Is target = max intended, given that D17 and D18 are explicit exceptions?

(c) **New Cappy glass products.** They need:

- product and supplier_product IDs;
- `inventory_order` (migration 0027) and `display_order` (0023);
- `rounding_rule`, `is_critical` and `counts_toward_minimum`.

Copy from P186/P187: skrzynka, upp 24, up_for_critical.

(d) **Audit contradiction.** "No active location row on an inactive product" cannot hold. `location_product_settings` has no `active` column, and 1.5/1.6 keep the rows of P139, P177 and P185.

(e) **Automated criterion wording.** "Runs clean twice … second run raises" should read "runs clean once; a second run raises". The local dump also needs `orders`/`order_lines`, or the open-order guards are never exercised.

(f) **Papryka price.** "KEN mirror" for papryka is 25.76, which is unchanged (finding recorded in `ken-intermlecz-yogurt-gouda`).

(g) **Progress vs criteria.** Phase 4 Manual has 3 criteria bullets but 2 Progress items (4.3 merges two). Progress 5.2 has no matching criterion.

**Fix**: tighten the step text as listed above. Add Progress `4.4` and a 5.x criterion. Do not rename the existing titles.

**Decision**: APPLIED to plan.md (main loop, 2026-10-01; F2 → Fix A with a new Helcom row, as Phase 1b)

### F9 — Parity and pattern details for the Phase 3 implementer

- **Severity**: 💡 OBSERVATION (optional)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 §1, §2, §5; Phase 4 guard

**Detail.**

- **Deviation floor.** Frontend `computeDeviation` has no `max(ref, step)` floor. With a reference of 0 it shows "+∞%", while the backend stores 5.0 (500%). The gate outcome is the same, but the display differs. A `roundingStep` twin is needed.
- **Shared fixture.** Pin the D33/D34 table as one shared JSON fixture read by both pytest and vitest, as `tests/fixtures/order_email/` does, so drift fails mechanically.
- **Case split.** `formatCaseQty` / `_format_case_qty` should reuse `splitPackStock` (`lib/packStock.ts`: EPS 1e-6, 3-decimal round) and port it to Python, rather than inventing a second split.
- **Migration 0028.** Avoid the `%` character (the fixture uses `exec_driver_sql`). Make the CHECKs re-runnable with `DROP CONSTRAINT IF EXISTS` + `ADD`, as 0021 and 0025 do.
- **Golden harness.** `_render` in `test_order_email_golden.py` reads keys as `ln["…"]`. New case keys need `.get` so the old fixtures stay unchanged.
- **Phase 4 guard.** Also check `purchase_unit`. P021 must already be `paczka` (from 1.8), or the e-mail prints "6 kartonów + 2 opak".

**Decision**: APPLIED to plan.md (main loop, 2026-10-01; F2 → Fix A with a new Helcom row, as Phase 1b)

### F10 — Unused data paths, plus Phase 2 notes for impl-review

- **Severity**: 💡 OBSERVATION (optional)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Key Discoveries; Phase 3 §1, §2; Phase 2

**Detail.**

- **Unused fields.** Threading `case_unit` / `units_per_case` into `InventoryCountDetailLine` and `TransportAggregateLine` has no consumer:
  - `ManagerInventoryPage`, `inventoryCsv.ts`, `TransportMatrix` and `transport.ts` read no pack fields;
  - Transport documents are a non-goal.
- **Unused note.** The "exceeds max" explanation is returned only by `/api/captain/suggest`, which no client calls.
- **Transport picker.** The Transport supplier picker lists every active supplier (`TransportPage.tsx:851`), so a Bukat batch is possible. It would print kg without the case. That is acceptable, but should be stated.
- **Phase 2, already committed in 9dc5b21.** While the sticky bulk reason is active, a Captain who clears a line's reason has it refilled at once by `fillMissing`. The empty option in the reason picker stops working until "Wyłącz". Decide this in impl-review.

**Fix**: drop the two unused model threads, or name their consumer. Say in the plan that Transport keeps invoice units. Raise the sticky-clear behaviour in the Phase 2 impl-review.

**Decision**: APPLIED to plan.md (main loop, 2026-10-01; F2 → Fix A with a new Helcom row, as Phase 1b)
