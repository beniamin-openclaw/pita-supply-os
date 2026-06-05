# Sub-kg (0.1 kg) Rounding Rule for Weight SKUs — Implementation Plan

## Overview

Add a new `tenth_kg` `RoundingRule` (ceil to the next 0.1 kg) to the suggestion engine so weight-based SKUs sold per kilogram can suggest 0.7 / 1.5 kg instead of ceiling to whole kilos. Assign it to the 8 Bukat continuous-kg produce SKUs via a new explicit `rounding_rule` column, fix the `>20%` deviation gate so it stays meaningful for sub-1.0 suggestions, and make the frontend honor the rule end-to-end (display parity + fractional input). This removes the cosmetic over-max warning on P009 Natka / P010 Czosnek and is the proper engine fix the F-01 audit spun out as S-09. The engine stays suggest-only; visible math stays a Tier-1 contract.

## Current State Analysis

- **Rounding is centralized.** `_round_per_rule` ([suggestion.py:59-70](supply-os-v1/app/suggestion.py:59)) is the only quantity-snapping logic; granularity is hardcoded per branch (1.0 ceil for `FULL_ONLY`, 0.5 for `HALF_ALLOWED`). `suggested_base` is derived backward from the rounded purchase qty, which drives `over_max` ([suggestion.py:86-93](supply-os-v1/app/suggestion.py:86)).
- **The column exists in the model + docs but not the data.** `SupplierProduct.rounding_rule` defaults to `FULL_ONLY` ([models.py:84](supply-os-v1/app/models.py:84)); the seed CSV has **no** `rounding_rule` column, so every SKU ceils to whole kg today. `DATA_MODEL.md:101` and `SHEETS_SCHEMA.md:54` already document the column (a live doc-vs-seed drift). An optional column is schema-safe on both backends — `_validate_headers` treats a defaulted Pydantic field as optional ([sheets.py:219-244](supply-os-v1/app/sheets.py:219)), and `seed_loader` falls back to the default for an absent/blank cell ([seed_loader.py:49-54](supply-os-v1/app/seed_loader.py:49)).
- **P009/P010 are the target case.** `WOLA__P009`/`P010`: `target=0.5, max=0.5` ([location_product_settings.csv:10-11](docs/pita-supply-os-v1/seed/location_product_settings.csv:10)); `SP_BUKAT_P009`/`P010`: `kg, units_per_purchase_unit=1` ([supplier_products.csv:49-50](docs/pita-supply-os-v1/seed/supplier_products.csv:49)). Today `ceil(0.5/1)=1 kg` → `over_max=(0+1)−0.5=0.5` → cosmetic warning. No test pins this, so changing it breaks nothing.
- **Deviation-gate ripple.** `delta_pct = |final − suggested| / max(suggested, 1.0)` ([main.py:354-356](supply-os-v1/app/main.py:354) and [:986-988](supply-os-v1/app/main.py:986)). The `1.0` floor is a no-op for integer suggestions but inflates the denominator for sub-1.0 suggestions, so the `>20%` gate under-trips on small-weight SKUs.
- **Preview ignores the rule.** `POST /api/captain/suggest` ([main.py:165-188](supply-os-v1/app/main.py:165)) builds `SuggestionInput` without `rounding_rule` → always `FULL_ONLY`.
- **Frontend.** Display is already fractional-safe (raw numbers). But `compute.ts` hardcodes `Math.ceil`, ignoring `rounding_rule` ([compute.ts:11-12](frontend/src/pages/captain-mp/lib/compute.ts:11)); the Captain input is `step="1"` ([ProductCard.tsx:234-250](frontend/src/pages/captain-mp/components/ProductCard.tsx:234)); the Manager input `Math.floor()`s every keystroke ([OrderLineTable.tsx:189-205](frontend/src/pages/manager/OrderLineTable.tsx:189)); `OrderEditPage` hardcodes `rounding_rule:"full_only"` ([OrderEditPage.tsx:37](frontend/src/pages/captain-mp/OrderEditPage.tsx:37)) because `ManagerOrderLineDetail` doesn't carry the rule.
- **Tests.** 217 functions, **no `conftest.py`** — 8 files use per-file `os.environ.setdefault`, against the order-independence lesson ([lessons.md:40](context/foundation/lessons.md:40)). `test_suggestion.py` already has a 0.1-unit float-trap test ([test_suggestion.py:156-163](supply-os-v1/tests/test_suggestion.py:156)).

## Desired End State

- A `tenth_kg` rule exists in the engine and rounds the raw purchase need **up to the next 0.1 kg**, free of float artifacts.
- The 8 Bukat continuous-kg produce SKUs carry `rounding_rule = tenth_kg` in the seed CSV (and, via an owner migration step, the live Sheet). Everything else stays `full_only`.
- Submitting/editing a P009 order with stock 0 and target 0.5 suggests **0.5 kg** (1 purchase unit of 0.5? no — 0.5 kg), persists `suggested_qty_purchase = 0.5`, and raises **no** over-max warning.
- The `>20%` deviation gate reflects the true percentage for sub-1.0 suggestions and is **byte-identical** for existing `full_only` SKUs.
- `POST /api/captain/suggest` honors a `rounding_rule` in the request body.
- The Captain order + edit screens show the same suggestion the backend computes (parity), and both Captain and Manager can enter fractional (0.1 kg) quantities; the supplier email carries the decimals.
- A session-scoped `tests/conftest.py` exists; new sub-kg tests rely on it. `python -m pytest` and `ruff check .` pass; `npm run build` and `npm run lint` pass.

### Key Discoveries

- Single rounding chokepoint at [suggestion.py:59-70](supply-os-v1/app/suggestion.py:59) — the rule itself is `+1 enum + 1 branch`.
- Optional column is schema-safe on both backends ([sheets.py:219-244](supply-os-v1/app/sheets.py:219), [seed_loader.py:49-54](supply-os-v1/app/seed_loader.py:49)); the docs already anticipate it.
- `max(suggested, 1.0)` is really "floor at the rounding step" — generalizing to `max(suggested, rounding_step(rule))` preserves `full_only` exactly while fixing sub-kg.
- Float trap: `2.3 * 10 == 23.000000000000004` → naive `ceil` gives 2.4; must pre-clean before the ceil (the team already guards this — [test_suggestion.py:156](supply-os-v1/tests/test_suggestion.py:156)).
- Both detail builders ([`_enrich_lines_for_detail`](supply-os-v1/app/main.py:602) and the inline builder in `manager_order_detail`) already have the joined `sp` in scope, so exposing `rounding_rule` on the detail line is a one-field add per path.

## What We're NOT Doing

- **Not** adding a kg-default / unit-string derivation in the engine (rejected: unsafe on `inventory_unit`, opaque on `purchase_unit`). Assignment is the explicit column only.
- **Not** assigning `tenth_kg` to non-Bukat kg SKUs (Pago/Intermlecz/internal spices) in this slice — trivial follow-on (set the column), out of pilot scope.
- **Not** surfacing the engine's `over_max` / `explanation` / `warnings[]` in the UI (the "full" frontend option). Over-max stays engine-only, as today.
- **Not** refactoring the 8 legacy per-file `os.environ.setdefault` test files — only adding `conftest.py` for new tests.
- **Not** a configurable/parameterized step — `tenth_kg` is fixed at 0.1.
- **Not** writing to the live Google Sheet from this worktree — the live-tab column add is documented as an owner migration step.

## Implementation Approach

Three phases, each independently verifiable, in dependency order: (1) the pure-code engine + gate + preview + test harness, fully testable in seed mode; (2) the data/schema assignment that makes P009/P010 actually use the rule, proven by integration tests; (3) the frontend parity + fractional-input work so the rule is visible and enterable Captain→Manager. The `rounding_step` generalization is the keystone that lets the gate fix ship with zero regression to existing `full_only` behavior.

## Critical Implementation Details

- **Float pre-clean before the ceil.** The `tenth_kg` branch must clean the scaled value before `ceil` — e.g. `math.ceil(round(raw * 10, _PRECISION)) / 10` — or `2.3` becomes `2.4`. Mirrors the existing `_clean`/`_PRECISION` discipline and the `test_float_artifacts_cleaned_for_01_units` precedent.
- **`rounding_step(full_only) == 1.0`** makes the deviation-gate change a no-op for every existing SKU (all `full_only`), so the current `test_captain_submit.py` deviation/critical tests must continue to pass unchanged — treat that as a regression tripwire, not new behavior.
- **conftest loads before app/config.** Settings load once at first `app.config` import; `conftest.py` must set `SUPPLY_OS_CAPTAIN_TOKENS` / `SUPPLY_OS_MANAGER_TOKEN` / `SUPPLY_OS_DATA_BACKEND` at module top level (before importing the app), matching the existing token values, so it wins the race ([lessons.md:40-45](context/foundation/lessons.md:40)).

## Phase 1: Backend engine + deviation gate

### Overview

Introduce the `tenth_kg` rule and a `rounding_step` helper, fix the deviation denominator in submit + edit, teach the stateless preview to honor `rounding_rule`, and stand up the test harness (conftest + unit tests). Fully testable in seed mode without any data change.

### Changes Required:

#### 1. RoundingRule enum

**File**: `supply-os-v1/app/models.py`

**Intent**: Add the new rule value the engine and data will reference.

**Contract**: `RoundingRule` ([models.py:39-42](supply-os-v1/app/models.py:39)) gains `TENTH_KG = "tenth_kg"`.

#### 2. Engine rule + step helper

**File**: `supply-os-v1/app/suggestion.py`

**Intent**: Round the raw purchase need up to the next 0.1 for `tenth_kg`, with float pre-cleaning so artifacts don't bump the ceil; expose each rule's snap granularity for the deviation gate.

**Contract**: New branch in `_round_per_rule` ([suggestion.py:59-70](supply-os-v1/app/suggestion.py:59)); new module-level `rounding_step(rule: RoundingRule) -> float` returning `1.0` for `FULL_ONLY`/`UP_FOR_CRITICAL`, `0.5` for `HALF_ALLOWED`, `0.1` for `TENTH_KG`. The non-obvious bit is the artifact-safe ceil:

```python
if rule == RoundingRule.TENTH_KG:
    return math.ceil(round(raw * 10, _PRECISION)) / 10
```

#### 3. Deviation gate + preview

**File**: `supply-os-v1/app/main.py`

**Intent**: Replace the hardcoded `1.0` deviation floor with the SKU's rounding step so sub-1.0 suggestions get a true percentage (no change for `full_only`); make the preview reflect the rule.

**Contract**: In `captain_submit` ([main.py:354-356](supply-os-v1/app/main.py:354)) and `captain_order_edit` ([main.py:986-988](supply-os-v1/app/main.py:986)), `delta_pct = abs(final − suggested) / max(suggested_qty_purchase, rounding_step(sp.rounding_rule))` (import `rounding_step`). `SuggestRequest` ([main.py:135-146](supply-os-v1/app/main.py:135)) gains `rounding_rule: RoundingRule = RoundingRule.FULL_ONLY`; `captain_suggest` ([main.py:165-188](supply-os-v1/app/main.py:165)) threads it into `SuggestionInput`.

#### 4. Test harness

**File**: `supply-os-v1/tests/conftest.py` (new)

**Intent**: Set auth + backend env once before app import per the order-independence lesson; new test files rely on it. Do not touch the 8 legacy files.

**Contract**: Module-top `os.environ.setdefault` for `SUPPLY_OS_CAPTAIN_TOKENS="WOLA:test_wola_token,KEN:test_ken_token"`, `SUPPLY_OS_MANAGER_TOKEN="test_manager_token"` (values matching the legacy files so both styles coexist), set before any app/config import.

#### 5. Engine unit tests

**File**: `supply-os-v1/tests/test_suggestion.py`

**Intent**: Cover `tenth_kg` ceil-to-0.1 incl. the float-artifact case, exact-0.1 multiples, the P009/P010 sub-kg case, and `rounding_step` values.

**Contract**: New tests asserting `suggested_qty_purchase` for `tenth_kg` inputs — e.g. `target=0.5,current=0,upu=1 → 0.5` (and `over_max==0`); `target=2.3 → 2.3` (artifact guard); `target=0.74 → 0.8`; plus `rounding_step(FULL_ONLY)==1.0` / `(TENTH_KG)==0.1`.

### Success Criteria:

#### Automated Verification:

- [ ] Unit tests pass: `cd supply-os-v1 && python -m pytest tests/test_suggestion.py`
- [ ] Full suite passes (no regression in deviation/critical tests): `cd supply-os-v1 && python -m pytest`
- [ ] Lint passes: `cd supply-os-v1 && ruff check .`

#### Manual Verification:

- [ ] `POST /api/captain/suggest` with `rounding_rule:"tenth_kg"`, `target=0.5, current=0, upu=1` returns `suggested_qty_purchase: 0.5` and empty/over-max-free explanation.

**Implementation Note**: After Phase 1 automated checks pass, pause for human confirmation of the manual check before Phase 2.

---

## Phase 2: Data + schema assignment

### Overview

Add the `rounding_rule` column to the seed data and assign `tenth_kg` to the 8 Bukat continuous-kg produce SKUs, sync the schema docs and test header constants, and prove P009/P010 end-to-end in seed mode. The live Sheet column is an owner migration step.

### Changes Required:

#### 1. Seed data

**File**: `docs/pita-supply-os-v1/seed/supplier_products.csv`

**Intent**: Introduce the column and assign the new rule to the Bukat weight produce; every other row gets a blank cell (→ default `full_only`).

**Contract**: Header becomes `...,units_per_purchase_unit,rounding_rule,price_estimate_pln,active,notes` (position matches [SHEETS_SCHEMA.md:54](docs/pita-supply-os-v1/SHEETS_SCHEMA.md:54)). Set `rounding_rule = tenth_kg` on `SP_BUKAT_P002, _P003, _P005, _P006, _P009, _P010, _P016, _P018`; blank on all others.

#### 2. Schema docs

**File**: `docs/pita-supply-os-v1/DATA_MODEL.md`, `docs/pita-supply-os-v1/SHEETS_SCHEMA.md`

**Intent**: Keep the documented enum in sync with the new value.

**Contract**: Add `tenth_kg` to the `rounding_rule` enum list at [DATA_MODEL.md:101](docs/pita-supply-os-v1/DATA_MODEL.md:101) (and any restating line); confirm `SHEETS_SCHEMA.md` column layout already lists `rounding_rule`.

#### 3. Test fixtures / parse coverage

**File**: `supply-os-v1/tests/test_sheets_read.py` (+ any header-pinning fixture)

**Intent**: Confirm the sheet read path parses the new enum value, and that adding the seed column doesn't break a header-pinned test.

**Contract**: Add a test asserting `load_supplier_products()` maps `rounding_rule="tenth_kg"` → `RoundingRule.TENTH_KG`; update `SUPPLIER_PRODUCT_HEADERS`/seed header constants only if a test pins the exact column set.

#### 4. Integration coverage

**File**: `supply-os-v1/tests/test_captain_submit.py`, `supply-os-v1/tests/test_main.py`

**Intent**: Prove the real seed-backed behavior: P009 with stock 0 / target 0.5 suggests 0.5 kg (not 1), no over-max, and a sub-kg final doesn't trip a spurious deviation.

**Contract**: New tests submitting `P009`/`SP_BUKAT_P009` (Bukat) and asserting persisted `suggested_qty_purchase == 0.5` + no over-max warning; a `/api/captain/suggest`-equivalent assertion for the Bukat case.

### Success Criteria:

#### Automated Verification:

- [ ] Seed loads with the new column: `cd supply-os-v1 && python -m pytest tests/test_seed_loader.py tests/test_sheets_read.py`
- [ ] Integration tests pass: `cd supply-os-v1 && python -m pytest tests/test_captain_submit.py tests/test_main.py`
- [ ] Full suite + lint pass: `cd supply-os-v1 && python -m pytest && ruff check .`

#### Manual Verification:

- [ ] In seed mode, a Captain submit for P009 (stock 0, accept suggestion) records 0.5 kg and shows no over-max warning.
- [ ] Owner has added the `rounding_rule` column + `tenth_kg` values for the 8 Bukat rows to the **live** Google Sheet `supplier_products` tab (see Migration Notes).

**Implementation Note**: After Phase 2 automated checks pass, pause for human confirmation (incl. the live-Sheet migration) before Phase 3.

---

## Phase 3: Frontend parity + fractional input

### Overview

Expose `rounding_rule` on the order-line detail, make the Captain client-side suggestion mirror the engine for all rules, and let both Captain and Manager enter fractional (0.1 kg) quantities — closing the Tier-1 visible-math gap end-to-end.

### Changes Required:

#### 1. Detail-line rule field (backend)

**File**: `supply-os-v1/app/models.py`, `supply-os-v1/app/main.py`

**Intent**: Carry the SKU's rule on the order-line detail so the Captain edit screen recomputes the right suggestion.

**Contract**: `ManagerOrderLineDetail` gains `rounding_rule: RoundingRule = RoundingRule.FULL_ONLY`; both `_enrich_lines_for_detail` ([main.py:602](supply-os-v1/app/main.py:602)) and the inline builder in `manager_order_detail` set `rounding_rule = sp.rounding_rule if sp else RoundingRule.FULL_ONLY`.

#### 2. Types

**File**: `frontend/src/types.ts`

**Intent**: Add the new enum member and the detail-line field.

**Contract**: `RoundingRule` union ([types.ts:22](frontend/src/types.ts:22)) gains `"tenth_kg"`; the order-line detail type ([types.ts:217-240](frontend/src/types.ts:217)) gains `rounding_rule: RoundingRule`.

#### 3. Client suggestion parity

**File**: `frontend/src/pages/captain-mp/lib/compute.ts`

**Intent**: Replace the hardcoded `Math.ceil` with a per-rule mirror of the backend engine so the on-screen Captain suggestion matches what submit will compute.

**Contract**: `compute.ts:11-12` branches on `item.rounding_rule` — `full_only`→ceil, `half_allowed`→nearest 0.5, `up_for_critical`→`is_critical?ceil:round`, `tenth_kg`→`Math.ceil(round(raw*10))/10` (float-guarded).

#### 4. Captain input granularity

**File**: `frontend/src/pages/captain-mp/components/ProductCard.tsx`

**Intent**: Let the Captain enter the suggestion's granularity.

**Contract**: The final-qty input ([ProductCard.tsx:234-250](frontend/src/pages/captain-mp/components/ProductCard.tsx:234)) derives `step` from the rule (`tenth_kg`→0.1, `half_allowed`→0.5, else 1) and uses `inputMode="decimal"` when step < 1 (mirrors the existing current-stock input).

#### 5. Captain edit honors the rule

**File**: `frontend/src/pages/captain-mp/OrderEditPage.tsx`

**Intent**: Stop forcing `full_only` when rebuilding an `OrderableItem` from a detail line.

**Contract**: [OrderEditPage.tsx:37](frontend/src/pages/captain-mp/OrderEditPage.tsx:37) uses `line.rounding_rule` (now present) instead of the hardcoded literal.

#### 6. Manager fractional input

**File**: `frontend/src/pages/manager/OrderLineTable.tsx`

**Intent**: Allow the Manager to set fractional purchase units on dispatch.

**Contract**: [OrderLineTable.tsx:189-205](frontend/src/pages/manager/OrderLineTable.tsx:189) drops `Math.floor(...)` (parse as `Number`), sets `step="any"` and keeps `min={0}`.

### Success Criteria:

#### Automated Verification:

- [ ] Build passes: `cd frontend && npm run build`
- [ ] Lint passes: `cd frontend && npm run lint`
- [ ] Backend detail field covered + suite green: `cd supply-os-v1 && python -m pytest && ruff check .`

#### Manual Verification:

- [ ] Captain order screen for P009 shows a 0.5 kg suggestion (not 1) and accepts a typed `0.7`.
- [ ] Captain edit screen for an existing P009 order shows the same sub-kg suggestion (no full_only re-ceil).
- [ ] Manager can change a Bukat line to `1.5` kg and save/dispatch; the generated email draft shows `1.50`.
- [ ] No regression: a Pago carton order (full_only) still suggests/enters whole units exactly as before.

**Implementation Note**: After Phase 3 automated checks pass, pause for human confirmation of the manual UI checks. Run `/verify` for the full four-check sweep before considering the slice done.

---

## Testing Strategy

### Unit Tests:
- `tenth_kg` ceil-to-0.1: exact multiple (0.5→0.5), non-multiple (0.74→0.8), float artifact (2.3→2.3 not 2.4), zero need (→0).
- `rounding_step` returns 1.0 / 0.5 / 0.1 per rule.
- Regression: existing `full_only`, `half_allowed`, packaging-overage, and critical tests unchanged.

### Integration Tests:
- Seed-backed P009/P010 submit → `suggested_qty_purchase == 0.5`, no over-max, sub-kg final accepted without spurious deviation.
- Sheet read parses `rounding_rule="tenth_kg"`.
- `/api/captain/suggest` honors `rounding_rule` in the body.

### Manual Testing Steps:
1. Captain: open a Bukat order, confirm P009 suggests 0.5 kg, type 0.7, submit.
2. Captain: edit that order — confirm the suggestion is still sub-kg.
3. Manager: claim it, set a line to 1.5 kg, dispatch, confirm the email draft shows `1.50`.
4. Regression: a Pago carton SKU still behaves in whole units.

## Performance Considerations

None. Pure arithmetic in a hot-path-free engine; no new I/O. The optional column adds no read/write cost (schema-safe, fixed columns).

## Migration Notes

- **Live Google Sheet (owner step).** Add a `rounding_rule` column to the `supplier_products` tab (between `units_per_purchase_unit` and `price_estimate_pln`) and set `tenth_kg` on the 8 Bukat rows. This is **schema-safe**: the field has a default, so `_validate_headers` won't raise `ConfigDriftError` whether the column is present or absent, and existing rows read back as `full_only`. Not performed from this worktree (isolated branch; out-of-band master-data edit, mirroring F-01).
- **No backfill.** Existing `order_lines` are untouched; the rule only affects new suggestions.

## References

- Research: `context/changes/subkg-rounding-rule/research.md`
- Origin: `context/archive/2026-06-05-bukat-master-data-ready/audit.md:109-111,148` (S-09 spin-out)
- Order-independence lesson: `context/foundation/lessons.md:40-45`
- Engine: `supply-os-v1/app/suggestion.py:59-70`; gate: `supply-os-v1/app/main.py:354-356,986-988`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend engine + deviation gate

#### Automated

- [x] 1.1 Unit tests pass: `cd supply-os-v1 && python -m pytest tests/test_suggestion.py`
- [x] 1.2 Full suite passes (no regression in deviation/critical tests): `cd supply-os-v1 && python -m pytest`
- [x] 1.3 Lint passes: `cd supply-os-v1 && ruff check .`

#### Manual

- [x] 1.4 `/api/captain/suggest` with `rounding_rule:"tenth_kg"`, target 0.5 / current 0 / upu 1 returns `suggested_qty_purchase: 0.5`, over-max-free.

### Phase 2: Data + schema assignment

#### Automated

- [ ] 2.1 Seed loads with the new column: `python -m pytest tests/test_seed_loader.py tests/test_sheets_read.py`
- [ ] 2.2 Integration tests pass: `python -m pytest tests/test_captain_submit.py tests/test_main.py`
- [ ] 2.3 Full suite + lint pass: `python -m pytest && ruff check .`

#### Manual

- [ ] 2.4 Seed-mode Captain submit for P009 records 0.5 kg, no over-max warning.
- [ ] 2.5 Owner added `rounding_rule` column + `tenth_kg` for the 8 Bukat rows to the live Sheet.

### Phase 3: Frontend parity + fractional input

#### Automated

- [ ] 3.1 Build passes: `cd frontend && npm run build`
- [ ] 3.2 Lint passes: `cd frontend && npm run lint`
- [ ] 3.3 Backend detail field covered + suite green: `cd supply-os-v1 && python -m pytest && ruff check .`

#### Manual

- [ ] 3.4 Captain screen shows P009 0.5 kg suggestion and accepts typed 0.7.
- [ ] 3.5 Captain edit screen shows the same sub-kg suggestion (no full_only re-ceil).
- [ ] 3.6 Manager sets a Bukat line to 1.5 kg; email draft shows `1.50`.
- [ ] 3.7 No regression: a Pago carton (full_only) order still uses whole units.
