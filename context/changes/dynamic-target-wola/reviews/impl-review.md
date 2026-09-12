<!-- independent agent report, post-implementation review, 2026-09-07. Verdict: SHIP. F2 (progress ticks), F3 (comment), F4 (submit gated on flag) fixed after the report. -->

# Post-Implementation Review: `dynamic-target-wola`

**Scope reviewed**: `context/changes/dynamic-target-wola/` plan (revision 2) + hardening/plan-review docs vs. the actual working-tree diff, restricted to the files listed as belonging to this change. Finance-lane files/edits (`ebiuro.py`, `finance_match.py`, `migrations/0017_finance_documents.sql`, `pages/manager/finance/`, and the finance-only hunks in shared files) were read only enough to confirm they don't entangle with this change, then set aside.

**Verification performed**: full backend pytest (727 passed / 3 failed, all 3 in `tests/test_finance_routes.py`, unrelated), `ruff check .` clean, full frontend vitest (375/375 passed, 28 files), `eslint` clean on every file this change touches (2 pre-existing errors live only in `pages/manager/finance/ReceiptComparePane.tsx`), `tsc -b && vite build` clean. Hand-verified the arithmetic in `prod-sql.sql` sections D and E against the real seed CSV min/usage values and the engine formula — every one of the 11 computed values (4 in D, 7 in E) checks out exactly.

---

## Verdict: **SHIP**

This is an unusually disciplined implementation. Every row of the plan's "Hardening decisions" table that I could locate in code is implemented, and most are backed by a named unit or route test that pins the exact scenario the hardening review raised. I found no CRITICAL or HIGH findings — only cosmetic/documentation nits, listed below.

---

## 1. Hardening-decisions table — implementation status

| # | Decision | Status | Evidence |
|---|---|---|---|
| H1 | `effective_max = max(max, target_dynamic)` everywhere incl. uncounted over‑MAX gate | ✅ Done | `dynamic_target.py:241` (`effective_max = max(static_max, calc.target_base)`); `main.py:582,622-625` (`max_base` used in the uncounted branch); test `test_submit_uncounted_pago_gyros_uses_raised_max` |
| H2 | `SAFETY_CAP_DAYS = 3` formula | ✅ Done | `dynamic_target.py:45,172`; `test_safety_cap_limits_a_stale_min` |
| H3 | Section C (calendars) mandatory, ordered before B | ✅ Done | `prod-sql.sql` header ("Order: A → C → B → D"); section C is unconditioned |
| H4 | `OrderEditPage` overlays snapshot target for lines already on the order | ✅ Done | `dynamicTarget.ts:overlaySnapshotTargets`, wired at `OrderEditPage.tsx:142`; backend mirror `main.py:1508-1526`; test `test_edit_reuses_snapshot_target_and_resolves_new_products_fresh` |
| H5 | `requested_delivery_date` accepted only within window + valid weekday, else server's own calendar | ✅ Done | `dynamic_target.py:112-134` (`resolve_delivery_window`, `MAX_REQUESTED_AHEAD_DAYS=14`); test `test_submit_invalid_requested_date_uses_server_calendar` (far/wrong-weekday/past/absent, parametrized) |
| H6 | Negative/NaN usage never 500s a submit | ✅ Done | `LocationProductUsage.usage_per_day_base/safety_days: Field(ge=0)` (`models.py:155,160`); `_evaluate_submit_line`'s try/except around `_suggest` (`main.py:600-613`); test `test_submit_degrades_a_corrupt_dynamic_target_to_static` |
| H7 | `_load_usage_safe` catches any `Exception`, not `WorksheetNotFound` | ✅ Done | `main.py:409` (`except Exception:`) |
| H8 | `_build_orderable_item` keeps its 3-arg signature; overlay is a separate step | ✅ Done | `main.py:261` unchanged 3-arg call; `tests/test_orderable_order_note.py` has **zero diff** and still passes |
| H10 | Flag off ⇒ usage never loaded | ✅ Done | `main.py:266` gates the entire overlay block; `_load_usage_safe` also self-checks the flag (`main.py:401`); test `test_orderable_flag_off_never_loads_usage` |
| H11 / review H2 | Numeric `delivery_days` documented + tested as `no_calendar` | ✅ Done | `dynamic_target.py:34-36` comment; `parametrize` case `("3", None)` in `test_dynamic_target.py:55`, `(dict(supplier=_supplier("3")), "no_calendar")` at line 223 |
| H13/H14 | No `order_lines.target_mode` column — accepted, documented | ✅ Done (as accepted limitation) | `change.md:81-83` "Known limitations" section names both H13 and H14 explicitly |
| H15 | Below-minimum compares against `safety_base` when dynamic | ✅ Done | `ProductCard.tsx:98-101`, `i18n/strings.ts` `card.belowSafety`; test "compares the below-floor signal against the safety stock, not the raw min" |
| H17 | New product on edit resolves fresh (`requested_delivery_date=None`), not the stale stored date | ✅ Done | `main.py:1523` `requested_delivery_date=None` |
| H19 | `today_warsaw` never conflated with the UTC `today` used for order ids | ✅ Done | `main.py:385-389` (`_today_warsaw`), `main.py:723-726` names both variables distinctly with a comment |
| C1 | `_build_orderable_item` signature unchanged | ✅ Done | see H8 |
| C2 | New table wired into `test_supabase_integration.py` | ✅ Done | `_ALL_TABLES` includes it; migration applied in `_schema`; `test_location_product_usage_insert_and_read_roundtrip` |
| C3 | Two-stage rounding pinned, worked example matches formula | ✅ Done | `dynamic_target.py:172-174`; `test_worked_example_wola_gyros_monday` asserts `76.6` exactly |
| Review H1 | DDL written inline, not just cited | ✅ Done | `migrations/0018_location_product_usage.sql` — full DDL, RLS, rollback comment |
| Review W1 | `delivery_date = max(requested, today)` clamp | ✅ Done | `resolve_delivery_window` (see H5) |
| Review LOW | `_LOCATION_PRODUCT_USAGE_COLUMNS`/`as_of` in `_DATE_COLS` kept (smoke test uses `_insert`); seed loader explicit `try/except FileNotFoundError` | ✅ Done | `supabase_backend.py:117-120,173`; `seed_loader.py:105-110` |

Every decision I could locate is implemented and, in nearly every case, pinned by a specific test. Nothing is missing or half-done.

---

## 2. Gate parity — traced end to end

**Create flow (Wola × Coca‑Cola)**: `GET /api/captain/orderable` → `_build_orderable_items` overlays `target_source`/effective target+max via `_apply_effective_target` (`requested_delivery_date=None`, i.e. "today's own next delivery") → `ProductCard` reads `item.target_stock_qty_base` for `computeSuggestion`/`computeRowState` (unchanged code path — the item dict already carries the effective number) → `CaptainMP.handleSubmit` sends `requested_delivery_date: getRequestedDeliveryDate(supplier.delivery_days)` (`CaptainMP.tsx:519`) → `POST /api/captain/submit` recomputes `resolve_effective_target(..., req.requested_delivery_date, ...)` per line (`main.py:770`) → `_evaluate_submit_line` gates on that same number. Under same-session, same-calendar-day use (the normal case), the FE's own next-weekday calc and the BE's `next_delivery_date` compute the identical date, so `resolve_delivery_window` picks the client's date and the numbers match exactly — confirmed by `test_submit_accepting_dynamic_suggestion_passes_without_warning`, which asserts a 60‑target line snapshots exactly what the orderable list showed, with zero warnings.

**Divergence window (disclosed, not hidden)**: if a Captain leaves the tab open across midnight, the on-screen card still shows yesterday's target while a submit recomputes today's — `change.md`'s "Known limitations" section names this explicitly ("A tab left open across midnight can show yesterday's target... reload fixes it"), matching `research.md`'s originally-identified risk #1. This is an accepted, bounded, non-silent trade-off (worst case is a clear 400, not data corruption) — not a fresh gap this review is surfacing.

**Edit flow**: `OrderEditPage` fetches `GET /api/captain/order/{id}` for snapshot lines, then `GET /api/captain/orderable` for the fresh r6 merge, then `overlaySnapshotTargets` re-injects `line.target_stock_qty_base`/`max(item.max, line.target)` onto any product already on the order (`OrderEditPage.tsx:142`). Backend `captain_order_edit` does the mirror: `effective_target = snap.target_stock_qty_base` for lines on `existing.lines`, fresh resolve for new ones (`main.py:1508-1526`). Confirmed via `test_edit_reuses_snapshot_target_and_resolves_new_products_fresh` and `test_edit_flag_off_ignores_snapshot_and_uses_static_setting`. This is exactly the fix the hardening review's #4 (CRITICAL) demanded, and it's correctly wired on both sides.

**Manager Transport add-location prefill**: `manager_transport_add_location`'s `prefill_products` branch calls the same `_build_orderable_items` (`main.py:4688`) and builds skeleton lines from `item["target_stock_qty_base"]` (`main.py:4695`) — it inherits the dynamic target with zero extra code, exactly as the plan-review's "promise gaps" analysis predicted. `manager_add_line` (`main.py:2196`) is the same shared function. No divergence risk here since Manager-added lines start at qty 0 and are filled via `manager_order_save`, which carries no deviation gate at all.

---

## 3. Flag-off byte-identity

Confirmed for the orderable routes: the entire overlay block is gated behind `if settings.dynamic_target_enabled and items:` (`main.py:266`) — with the flag off, no `target_source` key is even added to the dict, and `test_orderable_flag_off_never_loads_usage` asserts the loader is never called.

For `captain_submit`/`_evaluate_submit_line`, one minor observation (not a functional regression — see F4 below): `captain_submit` unconditionally calls `resolve_effective_target(...)` per line even with the flag off, rather than gating like `captain_order_edit` does. Since `resolve_effective_target` returns `float(setting.target_stock_qty_base)` immediately on `enabled=False`, the *values* are byte-identical to before, and `test_submit_flag_off_is_byte_identical` confirms it. The only observable difference is on an already-broken-data path (see F4).

---

## 4. Seam and degrade behavior

- `_load_usage_safe` catches `except Exception` (not `WorksheetNotFound`), matching the documented lesson from `_load_inventory_events_safe`/`_load_transport_events_safe` — confirmed by `test_orderable_degrades_to_static_when_usage_loader_raises` (generic `RuntimeError`, backend-agnostic).
- Seed loader: explicit `try/except FileNotFoundError` returning `[]` (`seed_loader.py:105-110`), tested (`test_load_location_product_usage_missing_file_returns_empty`).
- Sheets: `_read_with_ttl` happy-path tested (`test_sheets_read.py`); relies on `_load_usage_safe`'s generic catch for the missing-worksheet case, same as the seed test above.
- Supabase: `load_location_product_usage()` happy-path tested (`test_supabase_backend.py`); the deploy-ordering "table not yet migrated" case is covered by the same generic-catch mechanism plus the integration smoke test proving the table itself is correct once migrated.
- Integration fixture: migration 0018 applied, table added to `_ALL_TABLES`, smoke test round-trips a real row through Postgres.

---

## 5. Migration 0018 vs. concurrent 0017

No conflict — `location_product_usage` has no dependency on the finance tables, and the numbering is sequential (0016 → 0017 finance → 0018 dynamic-target, confirmed via `ls migrations/`). `tests/test_supabase_integration.py`'s `_schema` fixture explicitly documents the split ("0017 (finance documents) belongs to the finance-invoice-reconciliation lane and is wired in by that change") and only applies 0018 here — sound.

---

## 6. Frontend checks

- **i18n rule**: no hardcoded copy found in any touched file — all new strings route through `card.dynamicBadge`/`dynamicMath`/`dynamicDates`/`belowSafety`/`dates.delivery.window`.
- **apiClient rule**: no new `fetch` calls anywhere in this change's frontend files; `target_source` rides the existing `/api/captain/orderable` payload.
- **Explicit types**: `TargetSource` interface mirrors the Pydantic model's optionality field-for-field (`?:` everywhere but `mode`).
- **`roundQty` display change** (`ProductCard.tsx:111`): applied unconditionally to `suggestedBase`, not gated on `dyn`, so it also touches static items' "brakuje X" display text. This is a cosmetic float-precision fix (`Math.round(n*100)/100`), does **not** feed the gate (the purchase-unit suggestion is computed separately from the raw, unrounded value), and is explicitly self-disclosed in `change.md:67-68` as "Display fix found on the way." Minor drift from Phase 3's literal "Static items unchanged" wording, but functionally harmless and already acknowledged. See F1.
- **`formatDateTime` + `${iso}T12:00:00`**: correct defensive pattern — parsing without a `Z` suffix treats it as local noon, which stays inside the same calendar day for any realistic UTC offset, avoiding a midnight-boundary date shift. Used consistently in both `ProductCard.tsx` and `ContextStrip.tsx`.
- **`belowMin` → `belowFloor`**: correctly swaps to `safety_base` only when `dyn` is present; static items are unaffected (verified by the dedicated test and confirmed the doc string explicitly reasons about why).

---

## 7. `prod-sql.sql`

BEFORE/AFTER blocks present for every mandatory section (A/C/B/D) plus optional E; ordering is A → C → B → D as the header states, matching `Migration Notes`. I independently recomputed every numeric UPDATE:

- **Section D** (max = 7-day cover): P024 → 102.1, P026 → 76, P027 → 100, P028 → 18.1 — all four match `ceil_unit(usage×7 + safety_base)` exactly against the real seed `min_stock_qty_base` values.
- **Section E** (min = 3 days of usage, ≥1): all 7 rows match `ceil(usage_per_day × SAFETY_CAP_DAYS)` exactly, including the P068 value (14) which independently matches the `safety_base=14` asserted in `test_orderable_cola_dynamic_and_kinley_static`.
- Section B's 18 rows are byte-identical to `docs/pita-supply-os-v1/seed/location_product_usage.csv`.

No value contradicts the seed CSV or the engine's formula.

---

## 8. Out-of-scope / dangerous diff check

No secrets in any touched file (only pre-existing `SecretStr` declarations in the finance-lane hunks of `config.py`, unrelated to this change). No prod writes — `prod-sql.sql` is explicitly headed "NOT APPLIED", migration 0018 is additive-only with RLS deny-all + a rollback comment. No unrelated edits found inside the files this change owns.

---

## Findings

### F1 — `roundQty` applied to static items' display, contradicting the plan's literal wording
- **Severity**: LOW
- **Location**: `frontend/src/pages/captain-mp/components/ProductCard.tsx:111`
- **Detail**: Plan Phase 3 states "Static items unchanged," but `suggestedBase = roundQty(suggestedBaseRaw)` runs for every item, not just `dyn` ones. Cosmetic float-precision cleanup only (doesn't touch the gate), and self-disclosed in `change.md`. No fix required — worth a one-line note in the plan if it's revisited, nothing more.

### F2 — Progress checkboxes in `plan.md` are stale relative to `change.md`'s reported state
- **Severity**: LOW
- **Location**: `context/changes/dynamic-target-wola/plan.md:304,310` (`3.5`, `4.1` both `[ ]`)
- **Detail**: `change.md` narrates a completed manual click-through with concrete output strings, and a completed `/verify` run with exact pass counts (both independently reproduced by me) — but the Progress table still shows both as pending. Pure bookkeeping drift, zero functional risk.
- **Fix**: Check `3.5` and `4.1` in `plan.md`'s Progress section to match `change.md`.

### F3 — Stale migration-number comment in the integration test
- **Severity**: LOW
- **Location**: `supply-os-v1/tests/test_supabase_integration.py:695`
- **Detail**: Section header comment reads "migration 0017" (a leftover from before the finance lane claimed 0017), but the code two lines below correctly applies `0018_location_product_usage.sql`.
- **Fix**: `s/migration 0017/migration 0018/` in the comment.

### F4 — `captain_submit` always takes the dynamic-fallback code path in `_evaluate_submit_line`, even with the flag off
- **Severity**: OBSERVATION
- **Location**: `supply-os-v1/app/main.py:770-778` (unconditional `resolve_effective_target` call), `main.py:597-613` (the `if effective_target is None` branch is consequently dead for `captain_submit`, only reachable from `captain_order_edit`)
- **Detail**: Because `resolve_effective_target` never returns `None`, `_evaluate_submit_line` always enters the try/except branch for `captain_submit`. Functionally invisible on every real path (confirmed by `test_submit_flag_off_is_byte_identical`); the only observable effect is on an already-broken static master-data row (negative/NaN target — pre-existing risk, unrelated to this change), where the retry now logs a misleading "dynamic target rejected" line before re-raising, even though nothing dynamic was involved. Not worth a code change; flagging only so the log message isn't misread during an incident.

---

## What I verified and found correct

- All 19 hardening-review findings (H1–H19) and all 3 plan-review CRITICALs (C1–C3) are implemented and test-covered, with several pinned to hand-verified exact numeric worked examples.
- Full test suites green for everything in scope: 727/730 backend tests (3 finance-lane failures, unrelated), 375/375 frontend tests, `ruff` clean, `eslint` clean on every file this change owns, `tsc -b && vite build` clean.
- Gate parity holds end-to-end for create, edit, and Manager Transport prefill paths under normal (same-session) use; the one disclosed midnight-crossing risk is explicitly documented as an accepted v1 trade-off, not a silent gap.
- `prod-sql.sql`'s numeric package (sections B/D/E) independently recomputed and matches the formula and real seed data exactly; ordering (A→C→B→D) and rollback comments present throughout.
- Migration 0018 has no logical or numbering conflict with the concurrent finance lane's 0017.
- No secrets, no prod writes, no unrelated edits in the diff.