<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Feedback 2026-10-01 — names, units, bulk packs

- **Plan**: context/changes/feedback-1001-names-units/plan.md
- **Scope**: Phase 2 and Phase 3 of 7 (code diff `54c6354..HEAD` on `claude/feedback-1001-names-units-safzk7`, head `2a2ab42`, limited to `supply-os-v1`, `frontend`, `docs/pita-supply-os-v1`)
- **Date**: 2026-10-01
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 4 observations

Post-plan main-loop decisions were reviewed as the intended behaviour:

- D34 extended (interval rule): any order in [min(need, case), max(need, case)] has zero deviation.
- `half_allowed` rounding is half-up on both sides.
- The Phase 2 fix: a reason the Captain cleared by hand is not refilled by the sticky bulk reason.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Verification run (this review)

| Check | Result |
|---|---|
| `cd supply-os-v1 && ruff check .` | All checks passed |
| `python -m pytest -q` | 959 passed, 35 deselected |
| `python -m pytest -m integration -q` on a throwaway local Postgres 16 DB (`pita_ir_int`, dropped afterwards) | 35 passed (incl. `test_supplier_product_case_roundtrip_and_checks`, `test_migration_0028_is_rerunnable`) |
| 0028 applied twice by `psql -f` on that DB | both runs clean; columns `text`/`numeric` nullable; both CHECKs present; no `%` in the file |
| new backend test files run alone (`test_case_suggestion_fixture.py`, `test_supplier_product_case.py`) | 43 passed (order-independent; no per-file env) |
| `cd frontend && npm run build` | built |
| `npm run lint` | clean |
| `npm run test` | 54 files, 739 tests passed |
| Prod (read-only SELECT, no writes) | 57 legacy order lines in 31 orders carry `suggested_qty_purchase = 0` with a non-null delta (see F2) |

## Checked, no finding

- **Engine parity.** `round_half_up`/`roundHalfUp`, `case_suggestion`/`caseSuggestion`, `deviation_reference`/`deviationReference`, `case_rounded_max`/`caseRoundedMax` and `has_case`/`caseSizeOf` match line for line. The `rounding_step` floor is mirrored by `roundingStep`, so no "+∞%" remains.
- **Shared fixture.** `case_suggestion_cases.json` is read by both suites: 17 engine rows and 20 gate rows. The backend asserts the 400 kind and the stored delta.
- **F1 branch.** Both engines key the "information" branch on `need == 0` (`main.py:683`, `compute.ts:220`). A case suggestion of 0 with a need above 0 runs the D34 gates, as the halloumi 48 / pomidor 18 rows prove.
- **Byte-identical without a case.**
  - Existing backend test expectations are unchanged; only an import line changed.
  - The three existing golden e-mail fixtures are untouched. `case_lines` is new and green on both sides.
  - Non-case e-mail and copy-list strings are built exactly as before.
- **Threading.** The case fields reach:
  - `_build_orderable_item`;
  - both `ManagerOrderLineDetail` builders;
  - `captain_inventory_products`;
  - `OrderEditPage.lineToItem`;
  - `types.ts`;
  - the e-mail (Python via `sp_entry`; TS via the joined line);
  - the copy lists in `DispatchPanel` and `ResendPanel`.

  `InventoryCountDetailLine` and `TransportAggregateLine` are deliberately not threaded (plan F10).
- **Seam.** No route imports a backend module.
- **Optional fields.** All new model fields are `Optional[...] = None`, and the TS mirrors are `field?: T | null` (lessons: TS optionality).
- **Migration 0028.** It is additive, re-runnable and has a rollback note. Old code tolerates it. New code also tolerates an unmigrated DB on every route, because reads are `SELECT *` and no route inserts `supplier_products`.
- **Captain inputs.**
  - Stock pack = `units_per_case × upp` in inventory units; order pack = `units_per_case` in purchase units.
  - Both emit one combined number, so drafts and `buildPayloadLines` are unchanged.
  - The order mode passes no references, so there is no "did you mean" prompt.
- **Manager hint.** One field in the invoice unit, with the read-only "= N kartonów + M paczek" next to it (D36).
- **i18n.** New copy is in `strings.ts`. The literals ("= ", "→ ", " + ") were already in the code before this change.
- **Auth.** No new API calls. `apiClient` is unchanged and `/api/captain/suggest` is still `require_captain`.

## Findings

### F1 — The sticky bulk reason leaves a hidden, stale reason on lines that only required one while the Captain was typing

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/captain-mp/lib/overruleAll.ts:57; CaptainMP.tsx:669-678; OrderEditPage.tsx:203-209; components/ProductCard.tsx:503
- **Detail**: `DecimalInput` emits on every keystroke, and the sticky effect runs `overruleAll(..., "fillMissing")` on every `lines` change. Nothing ever removes an auto-filled reason, and the `ReasonPicker` is rendered only while `requiresReason` is true.

  Failure scenario: the Captain applies "Weekend" in Powód zbiorczo. On a line whose suggestion is 12 (target 12, stock 0), they type the order "12":
  - after "1" the line deviates by 92%, so the sticky pass sets `WEEKEND_HIGH_TRAFFIC`;
  - after "2" the line is green and the picker disappears, but `reason_code` stays set;
  - `buildPayloadLines` submits it, and the backend stores it.

  A throwaway probe test run during this review reproduced this: green, `requiresReason: false`, payload `reason_code: "WEEKEND_HIGH_TRAFFIC"`. Any multi-digit quantity triggers it, so with a bulk reason active, most ordered lines are submitted with a reason they never needed. This inflates:
  - the Manager queue `reason_count` chip;
  - the `OrderLineTable` reason badges;
  - the FR-012 suggestion-review reason histogram (the same statistics problem `week1-feedback-targets` had to clean up).

  The Captain cannot see or clear it. The underlying "stale hidden reason" existed before for manual picks; the sticky pass makes it systematic. No test covers typing through a requires-reason state.
- **Fix A ⭐ Recommended**: Track which reasons were filled automatically, and un-fill them when the line no longer requires one.
  - Add an optional `reason_auto?: boolean` to the captain-mp `OrderLine`.
  - `overruleAll` sets it on lines it fills, in both modes.
  - In "fillMissing" mode, it clears `reason_code` (and an OTHER `captain_comment`) on a `reason_auto` line whose `computeRowState(...).requiresReason` is false. It still returns the same reference when nothing changes.
  - `ProductCard.handleReasonChange` clears the flag.
  - `buildPayloadLines` ignores it.
  - Add a vitest for "1" → "12" and a sticky-flow component case.
  - Strength: hand-picked reasons on green lines stay stored, as the backend documents ("a reason, if given, is still stored"). The flag rides in the draft lines for free, so it survives a reload.
  - Tradeoff: one more optional field on the draft line shape.
  - Confidence: HIGH — reproduced. The fix is local to `overruleAll` plus one handler.
  - Blind spot: a legacy draft has no flag, so a stale reason restored from it stays, as it does today.
- **Fix B**: At submit, send `reason_code` only for rows where `computeRowState(item, line).requiresReason` is true (in `CaptainMP.handleSubmit` and `OrderEditPage`, or a variant of `buildPayloadLines` that takes the items).
  - Strength: smallest change, and it also clears stale manual picks.
  - Tradeoff: a reason the Captain deliberately gave on a non-requiring line (for example the "stock ≥ target, ordered anyway" info branch) is no longer stored. That is a behaviour change to FR-011 history.
  - Confidence: MED.
  - Blind spot: the on-screen sticky-bar `reasonCount` still counts the stale reasons.
- **Decision**: PENDING

### F2 — "Stored deviation wins" relabels 57 legacy order lines from "ponad cel" / "brak bazy" to "+N%"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/manager/OrderLineTable.tsx:200; frontend/src/pages/captain-mp/OrderDetailPage.tsx:347
- **Detail**: Before week2-feedback-quantities Phase 1 (`b22f6e8`, 2026-09-20), a counted line with suggestion 0 stored `delta = final / step`, for example 5.0 for 5 szt ordered. Since Phase 1, both screens checked `suggested_qty_purchase === 0` first and showed "ponad cel" / "brak bazy". The plan-review F1 change puts the stored delta first, so these legacy lines now show an orange "+500%" on the Manager table and the Captain order detail.

  A read-only prod SELECT on 2026-10-01 found 57 such lines in 31 orders, dated 2026-05-24 to 2026-09-20:

  | Status | Lines | Orders |
  |---|---|---|
  | manager_sent | 22 | 11 |
  | closed | 16 | 8 |
  | cancelled | 19 | 12 |

  No line with a case can exist yet, so the new ordering only needs to apply to case lines.
- **Fix**: Keep the old branch first for lines without a case. In both screens, test `line.suggested_qty_purchase === 0 && caseOf(line) === null` before the stored delta. Add one `OrderLineTable` test: a legacy line with suggestion 0, delta 5 and no case still reads "ponad cel".
- **Decision**: PENDING

### F3 — A blank `case_unit` passes the 0028 CHECKs; the engine then rounds to cases that no screen or e-mail shows

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/migrations/0028_supplier_product_case.sql:48-56; supply-os-v1/app/suggestion.py:90; frontend/src/lib/packUnits.ts:79
- **Detail**: On the 0028 schema, an insert with `case_unit = '  '` and `units_per_case = 6` succeeded (local probe, rolled back). `has_case` and `caseSizeOf` look only at `units_per_case`, so both engines round to whole sixes. But `caseOf` and `_line_case` require a non-blank unit, so:
  - the card shows a single field and "→ 6 kg" with no case wording;
  - the e-mail prints plain kg.

  The suggestion jumps in steps of 6 with no explanation. 0028 is not yet on prod, so this is cheap to close now.
- **Fix**: In 0028, add `CHECK (case_unit IS NULL OR btrim(case_unit) <> '')`, using the same drop-if-exists + add pattern and no percent sign, and extend `test_supplier_product_case_roundtrip_and_checks` with a blank-unit case.
- **Decision**: PENDING

### F4 — Small parity and documentation drifts around D34

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/captain-mp/lib/compute.ts:162; supply-os-v1/app/main.py:603, :790; frontend/src/pages/manager/lib/emailBody.ts:53-54
- **Detail**:
  - (a) For a supplier with alerts off, the pill is green only when the order equals the need or the case suggestion exactly. An order strictly inside the interval shows the neutral grey pill, although the backend stores delta 0 for it (interval rule). This affects colour only, and only Pago, which has no case product today.
  - (b) The `_evaluate_submit_line` docstring (:603) and the `captain_submit` docstring (:790) still say the information branch keys on `suggested_qty_purchase == 0`. The code keys on the need.
  - (c) In the copy list, case lines use `formatQtyG` ("2,5") while non-case lines keep the raw `${qty}` ("2.5"). One list can therefore mix decimal separators.
- **Fix**:
  - (a) Use `deviationReference(final, s.need, s.purchase) === final` for the green test.
  - (b) Reword both docstrings to "need == 0 (the suggestion without a case)".
  - (c) Optional: leave as is, or format non-case lines with `formatQtyG` too. That second option is a visible change to today's list.
- **Decision**: PENDING

### F5 — The case card hides the per-rule need that D34 accepts without a reason

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/captain-mp/components/ProductCard.tsx:362-390; i18n `card.suggestionCase`
- **Detail**: The case variant renders "brakuje {raw base} → {N cases} ({total})". Without a case, the card shows the per-rule rounded purchase quantity ("→ 3 kg"). With a case, that need is never shown, yet it is one end of the no-reason interval.

  Example: pomidor (critical, `tenth_kg`, crate 6) at stock 7.05.
  - The card reads "brakuje 2,95 kg → 1 skrzynka (6 kg)".
  - Ordering the visible 2.95 is below min(3.0, 6), so it raises the critical prompt; 3.0 would pass.

  Related, by design (D34, pinned in the fixture as an operator choice): a critical product whose need is under half a case (for example halloumi with a need of 5 and a karton of 12) gets suggestion 0, and ordering 0 needs no reason. Phase 4 lists only rows whose target is under half a case, not critical rows that often have a small need.
- **Fix**: Show the need in purchase units in the case line through i18n, for example "brakuje 2,95 kg → 3 kg ≈ 1 skrzynka (6 kg)". In the Phase 4 diff, also list the critical case rows (P006, P016, P015, P021) so the operator confirms the "0 without a reason" consequence.
- **Decision**: PENDING

### F6 — Progress and change status not updated for work that is done

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/feedback-1001-names-units/plan.md `## Progress`; change.md
- **Detail**: Progress items 2.1, 2.2, 3.1, 3.2, 3.3 and 3.4 are green in this review, but all are still `- [ ]`. Item 5.2 (NEW_LOCATION_CHECKLIST) has landed in `ce05824` and is unticked too. `change.md` still reads `status: plan_reviewed`.

  This review did not stamp `change.md`, because the orchestrator limited this session's commit to the review file. Manual items (2.4, 3.6–3.8) are correctly pending: they need the merge, migration 0028 on prod, and the operator.
- **Fix**: Tick 2.1, 2.2, 3.1–3.4 and 5.2 with their SHAs (`9dc5b21`/`2d1394d`, `056f7bf`…`2a2ab42`, `ce05824`). Set `change.md` `status: impl_reviewed`, `updated: 2026-10-01`. Tick 2.3 and 3.5 once F1 and F2 are resolved.
- **Decision**: PENDING
