---
date: 2026-06-05T18:26:38+0200
researcher: Claude (Opus 4.8)
git_commit: c78ad6de97329c196c3a8171bf713278b249c387
branch: claude/dreamy-shockley-005215
repository: dreamy-shockley-005215 (Pita Supply OS, worktree)
topic: "Engine sub-kg (0.1 kg) rounding rule for weight-based SKUs (S-09)"
tags: [research, codebase, suggestion-engine, rounding, supplier_products, data-layer, frontend, visible-math]
status: complete
last_updated: 2026-06-05
last_updated_by: Claude (Opus 4.8)
---

# Research: Engine sub-kg (0.1 kg) rounding rule for weight-based SKUs (S-09)

**Date**: 2026-06-05T18:26:38+0200
**Researcher**: Claude (Opus 4.8)
**Git Commit**: c78ad6de97329c196c3a8171bf713278b249c387
**Branch**: claude/dreamy-shockley-005215
**Repository**: Pita Supply OS (worktree `dreamy-shockley-005215`)

## Research Question

S-09 was spun out of the F-01 master-data audit: weight-based (kg) SKUs ceil to whole kilograms because `RoundingRule` has no sub-unit granularity, so the engine can't suggest 0.7 / 1.5 kg and a sub-kg target on a whole-unit SKU (P009 Natka, P010 Czosnek at Wola×Bukat) trips a cosmetic over-max warning. Research the codebase so a planner can add a sub-kg (0.1 kg) rounding rule + a way to assign it + tests, without regressing the Tier-1 visible-math contract. Cover: (1) the engine and every call site, (2) the data-layer/schema assignment options, (3) the frontend visible-math display, (4) existing tests and the P009/P010 cases.

## Summary

The change is **small at its core and centralized**: all quantity rounding lives in one function, `suggestion._round_per_rule` ([suggestion.py:59-70](supply-os-v1/app/suggestion.py:59)). Adding a sub-kg rule is `+1 enum value` ([models.py:39-42](supply-os-v1/app/models.py:39)) + `+1 branch` in that function. But three things make it larger than "add a branch":

1. **Assignment is the real design fork.** The model field `SupplierProduct.rounding_rule` already exists and defaults to `FULL_ONLY`, but **no seed CSV carries the column**, so every SKU is `FULL_ONLY` today. Two ways to assign the new rule: an explicit `rounding_rule` column (schema-safe on both backends; already documented in `DATA_MODEL.md`/`SHEETS_SCHEMA.md` — there's a live doc-vs-seed drift) **or** an automatic kg-default. The kg-default is **provably unsafe if keyed on the product's `inventory_unit`** (many discrete packs — feta blok, gyros, falafel karton — have `inventory_unit=kg`); only `purchase_unit=="kg" AND units_per_purchase_unit==1` is safe, and that bakes a unit-string convention into the engine.

2. **A latent deviation-gate ripple.** `captain_submit`/`captain_order_edit` compute `delta_pct = |captain_final − suggested| / max(suggested_qty_purchase, 1.0)` ([main.py:354-356](supply-os-v1/app/main.py:354)). The `1.0` floor was harmless when suggestions were integers ≥1; with sub-1.0 kg suggestions it dominates and changes the >20%-deviation gate's sensitivity for small-weight SKUs. Decide whether the floor is still right for kg goods.

3. **Frontend has the bigger surface.** Display is already fractional-safe (raw numbers, no integer coercion), but the Captain card **recomputes the suggestion client-side and hardcodes `Math.ceil`**, ignoring `rounding_rule` ([compute.ts:12](frontend/src/pages/captain-mp/lib/compute.ts:12)) — so a non-`full_only` suggestion already silently diverges from the backend, breaking visible-math. Plus two number inputs assume whole units (Captain `step="1"`; Manager `Math.floor()` on every keystroke). And `ManagerOrderLineDetail` doesn't carry `rounding_rule` (the edit page hardcodes `"full_only"`).

Net: backend core is ~2 files; the honest scope spans engine + assignment data + deviation-gate decision + 3 frontend touch-points + tests (and a missing `conftest.py` to reconcile with the order-independence lesson).

---

## Detailed Findings

### Area 1 — Engine + call sites

**Rounding is centralized.** `_round_per_rule` ([suggestion.py:59-70](supply-os-v1/app/suggestion.py:59)) is the only quantity-snapping logic in the backend. Rounding **direction differs per rule**:
- `FULL_ONLY` → `math.ceil(raw)` (always up to whole purchase unit).
- `HALF_ALLOWED` → `round(raw*2)/2` (nearest 0.5; Python banker's rounding on the half-step).
- `UP_FOR_CRITICAL` → ceil if critical else nearest integer.
- Granularity (1.0, 0.5) is hardcoded into each branch — there is no step-size parameter. A new 0.1-kg rule is a new enum value + new branch.

**The math chain** ([suggestion.py:86-93](supply-os-v1/app/suggestion.py:86)):
```
needed_base      = max(0, target - current)
raw_purchase     = needed_base / units_per_purchase_unit
suggested_purchase = _round_per_rule(raw_purchase, rounding_rule, is_critical)
suggested_base   = _clean(suggested_purchase * units_per_purchase_unit)   # derived BACKWARD
over_max         = _clean(max(0, (current + suggested_base) - max_stock))
```
`suggested_base` is derived **backward** from the rounded purchase qty, so changing rounding granularity directly moves `suggested_base`, which drives `over_max`. `_clean` rounds to 6 decimals to kill IEEE-754 artifacts ([suggestion.py:54-56](supply-os-v1/app/suggestion.py:54)) — already adequate for 0.1 steps. `over_max` is only narrated when `over_max > 0 AND not allow_over_max_due_to_packaging` ([suggestion.py:102-103](supply-os-v1/app/suggestion.py:102)).

**Three call sites** (`compute_suggestion` imported at [main.py:46](supply-os-v1/app/main.py:46)):
- **`captain_suggest`** `POST /api/captain/suggest` ([main.py:165-188](supply-os-v1/app/main.py:165)) — stateless preview. Builds `SuggestionInput` from the `SuggestRequest` body ([main.py:135-162](supply-os-v1/app/main.py:135)). **Does NOT pass `rounding_rule`** → always `FULL_ONLY`. The new rule won't show here unless the request model + this call are extended. Returns `over_max_qty_base` + `explanation` verbatim.
- **`captain_submit`** ([main.py:340-350](supply-os-v1/app/main.py:340)) — assembles input from master data, passing `rounding_rule=sp.rounding_rule` ([main.py:346](supply-os-v1/app/main.py:346)). Persists `suggested_qty_base`, `suggested_qty_purchase`, `delta_vs_suggestion_pct` onto each `OrderLine`. `over_max_qty_base` is computed but **never consumed** in submit (no order-line column, not added to warnings).
- **`captain_order_edit`** `PATCH /api/captain/order/{id}` ([main.py:973-983](supply-os-v1/app/main.py:973)) — byte-for-byte mirror of submit; recomputes on every edit (`rounding_rule=sp.rounding_rule` at [main.py:979](supply-os-v1/app/main.py:979)).

**Storage** — `OrderLine.suggested_qty_base` / `suggested_qty_purchase` / `delta_vs_suggestion_pct` ([models.py OrderLine](supply-os-v1/app/models.py:106)). All `float`; finer values serialize fine via `_cell_value` → `str(float)`.

**No other rounding anywhere.** Every other `round(...)` is currency 2-dp on `total_value_estimate_pln` ([main.py:419](supply-os-v1/app/main.py:419), :433, :1040, …); `gmail_url._format_qty` is `f"{v:.2f}"` display only. Confirmed: snapping lives only in `_round_per_rule`.

**Ripple analysis (load-bearing):**
- `delta_pct` denominator floor `max(suggested_qty_purchase, 1.0)` ([main.py:354-356](supply-os-v1/app/main.py:354) and [main.py:986-988](supply-os-v1/app/main.py:986)) — **highest-risk ripple.** With integer suggestions ≥1 the floor was moot; with sub-1.0 kg suggestions it dominates: captain 0.5 vs suggested 0.3 → `0.2/1.0 = 20%` instead of `0.2/0.3 = 67%`. The >20% gate and critical-under-order gate both compare against the finer `suggested_qty_purchase`. **Decision for the plan:** is the `1.0` floor still appropriate for kg goods?
- `captain_suggest` hardcodes `FULL_ONLY` → preview won't reflect the new rule unless updated.
- `total_value_estimate_pln` is computed from `captain_final * price`, not the suggestion, so it only moves if the captain accepts the finer suggested value.

### Area 2 — Data layer + schema assignment

**The column is absent from data but present in the model + docs (drift).**
- Seed CSV header ([supplier_products.csv:1](docs/pita-supply-os-v1/seed/supplier_products.csv:1)) ends `...,units_per_purchase_unit,price_estimate_pln,active,notes` — **no `rounding_rule`**. `grep` across all 7 seed CSVs: zero matches.
- Model field exists: `SupplierProduct.rounding_rule: RoundingRule = RoundingRule.FULL_ONLY` ([models.py:84](supply-os-v1/app/models.py:84)).
- Schema docs **already document the column**: [DATA_MODEL.md:101](docs/pita-supply-os-v1/DATA_MODEL.md:101) (`enum: full_only, half_allowed, up_for_critical`) and [SHEETS_SCHEMA.md:54](docs/pita-supply-os-v1/SHEETS_SCHEMA.md:54) (column positioned between `units_per_purchase_unit` and `price_estimate_pln`). So **the docs anticipate the column; the seed CSV and live Sheet just never grew it.** A new enum value must be added to both doc enum lists.

**An optional column is schema-safe on BOTH backends:**
- `seed_loader`: rows via `csv.DictReader`; `_normalize` then `{k:v for ... if v is not None}` then `model(**cleaned)` ([seed_loader.py:49-54](supply-os-v1/app/seed_loader.py:49)). A column absent from the CSV never appears → Pydantic default applies. Adding a column is picked up **automatically**, no code change. A blank cell also falls back to default.
- `sheets._validate_headers` ([sheets.py:219-244](supply-os-v1/app/sheets.py:219)): `required = {name for name,field in model_fields if field.is_required()}`. Because `rounding_rule` has a default it is **not required** → a live Sheet tab lacking the column does **not** raise `ConfigDriftError` (the docstring names this field as the example). Extra columns allowed.
- Write path: `_model_to_row` lays cells against the **live header order** ([sheets.py:356-379](supply-os-v1/app/sheets.py:356)); a model field with no matching column is simply not written, and a present column gets `Enum→.value`. **Nothing on the write side needs changing.**
- There is **no hardcoded header allow-list** anywhere — validation is derived dynamically from the model.

**Assignment options:**
- **(a) Explicit `rounding_rule` column** — surfaces to change: seed CSV (`supplier_products.csv`, add header + per-row value/blank), live Google Sheet `supplier_products` tab (operator adds column), enum lists in `DATA_MODEL.md:101` + `SHEETS_SCHEMA.md:54`. Code: none for the data plumbing (only the engine enum+branch, needed regardless). Explicit, auditable, per-SKU override, and the path the docs already anticipate. Cost: per-row data entry on two surfaces.
- **(b) Automatic kg-default** — avoids data entry but **unsafe if keyed on `inventory_unit`**. Evidence from `supplier_products.csv` × `products.csv`: discrete packs with `inventory_unit=kg` include P011 Tzatzyki (`wiadro,3`), P012 Tirokafteri (`wiadro,3`), P014 Feta blok (`blok,2`), P020 Falafel (`karton,5`), P024/P025 Gyros (`blok,15/25`), P027/P028 Souvlaki (`karton,5`), P013 Oliwki (`opak,2`), P017 Florinis (`opak,3.6`), P021/P022 Frytki (`opak,2.5/2.27`), P057/P058 saszetki (`opak,2/4`). A `inventory_unit==kg → sub-kg` rule would wrongly fractionalize ~15 discrete packs (e.g. "1.5 blok gyros"). Only **`purchase_unit=="kg" AND units_per_purchase_unit==1`** is safe — the engine already divides by `upu`, so for `upu=1` the raw purchase qty is in kg. Bukat continuous-kg rows that qualify: **P002, P003, P005, P006, P009, P010, P016, P018**. Downside: bakes the `"kg"` unit-string into the engine, mis-handles future kg-packs/localized labels, no per-row escape hatch.

**Seam:** no new backend — a column (a) or pure in-engine derivation (b). Reads stay behind `_choose_backend()`; the `lessons.md` "never bypass the data-layer seam" rule is not at risk.

### Area 3 — Frontend visible-math display

**Display path is already fractional-safe.** No `toFixed`/`Math.round`/`Intl` on quantity fields anywhere — only on PLN money. `0.7`/`1.5 kg` render verbatim in:
- Captain read-only detail ([OrderDetailPage.tsx:149-156](frontend/src/pages/captain-mp/OrderDetailPage.tsx:149)).
- Manager line table ([OrderLineTable.tsx:142-161](frontend/src/pages/manager/OrderLineTable.tsx:142)).
- Supplier email body — `formatQty = (qty) => String(qty)` deliberately preserves fractions ([emailBody.ts:24-26](frontend/src/pages/manager/lib/emailBody.ts:24)).

**Three input/compute blockers (the real work):**
1. **Captain suggestion is recomputed client-side and hardcodes `Math.ceil`**, ignoring `rounding_rule`: `const suggestedPurchase = Math.ceil(suggestedBase / item.units_per_purchase_unit)` ([compute.ts:11-12](frontend/src/pages/captain-mp/lib/compute.ts:12)). `OrderableItem` already carries `rounding_rule` ([types.ts:67](frontend/src/types.ts:67)) but it's ignored. **This is an existing visible-math divergence for any non-`full_only` SKU** — and would silently re-ceil a sub-kg suggestion. Cleanest fix: honor `rounding_rule` in `compute.ts`, or call the unused backend `/api/captain/suggest` (which returns `over_max` + `explanation`).
2. **Captain final-qty input** `type="number" inputMode="numeric" min="0" step="1"` ([ProductCard.tsx:234-250](frontend/src/pages/captain-mp/components/ProductCard.tsx:234)) — whole-unit UX (the current-stock input above it already uses `inputMode="decimal" step="any"`, a ready pattern to copy).
3. **Manager qty input floors to integer on every keystroke**: `const raw = Math.floor(Number(e.target.value))` + `step={1}` ([OrderLineTable.tsx:189-205](frontend/src/pages/manager/OrderLineTable.tsx:198)) — hardest blocker; a manager cannot enter 1.5 today.

**Over-max / warnings are never surfaced in the UI.** No component reads `over_max_qty_base`, `explanation`, or `warnings[]`. `CaptainMP.tsx` awaits `CaptainSubmitResponse` but **discards `warnings`** ([CaptainMP.tsx:203-208](frontend/src/pages/captain-mp/CaptainMP.tsx:203)). So the "cosmetic over-max warning" from the audit is an **engine-level artifact**, not something shown to the Captain in the live flow. Adding it would need a new i18n key (none exists for over-max in [strings.ts](frontend/src/i18n/strings.ts)).

**Types:** `RoundingRule` in [types.ts:22](frontend/src/types.ts:22) lists the 3 values (add the new one). `ManagerOrderLineDetail` ([types.ts:217-240](frontend/src/types.ts:217)) does **not** carry `rounding_rule` — `OrderEditPage.tsx:37` hardcodes `rounding_rule: "full_only"` when rebuilding an `OrderableItem` ("detail endpoint doesn't carry it").

### Area 4 — Tests + P009/P010 cases

**217 test functions, 15 files** (CLAUDE.md's "196" is stale; matches the `lessons.md` "217/217" note). No CI runs them (the existing `quality-gate.yml` runs sibling tooling — see `lessons.md` "Verify CI actually runs the product's tests"). Run: `cd supply-os-v1 && python -m pytest`.

**Engine unit tests** — [tests/test_suggestion.py](supply-os-v1/tests/test_suggestion.py) (18 tests). `_inp(**kwargs)` builder defaults `rounding_rule=FULL_ONLY` ([:8-19](supply-os-v1/tests/test_suggestion.py:8)). Covers `FULL_ONLY` ceil ([:24-33](supply-os-v1/tests/test_suggestion.py:24)), `HALF_ALLOWED` → asserts `suggested_qty_purchase == 2.5` ([:87-93](supply-os-v1/tests/test_suggestion.py:87)), over-max + packaging-overage suppression ([:54-64](supply-os-v1/tests/test_suggestion.py:54)), and a **directly relevant float-trap test for 0.1 units** ([:156-163](supply-os-v1/tests/test_suggestion.py:156) — `10 * 0.1 == 1.0`). **`UP_FOR_CRITICAL` is in the enum but untested.**

**Integration** — `/api/captain/suggest` in [test_main.py:153-169](supply-os-v1/tests/test_main.py:153); deviation/critical-underorder gates in [test_captain_submit.py](supply-os-v1/tests/test_captain_submit.py:31); sheet enum parse of `rounding_rule="full_only"` in [test_sheets_read.py:245-267](supply-os-v1/tests/test_sheets_read.py:245). The `_line` builders in `test_captain_orders.py`/`test_manager_queue.py`/`test_sheets_write.py` hardcode flat `suggested_*` values — no rule variation.

**P009/P010 are untested and the exact target case is sub-kg:**
- `WOLA__P009` / `WOLA__P010`: `min=0.2, target=0.5, max=0.5` ([location_product_settings.csv:10-11](docs/pita-supply-os-v1/seed/location_product_settings.csv:10)).
- `SP_BUKAT_P009`/`P010`: `kg, units_per_purchase_unit=1` ([supplier_products.csv:49-50](docs/pita-supply-os-v1/seed/supplier_products.csv:49)).
- Today: `FULL_ONLY` → `ceil(0.5/1)=1 kg` → `over_max = (0+1)−0.5 = 0.5` → cosmetic warning. **No test currently pins this behavior**, so a new rule won't break an existing assertion — but new tests should add P009/P010 cases.

**Test-env gap (must reconcile with `lessons.md`):** there is **NO `conftest.py`** anywhere in `supply-os-v1`. 8 test files set auth/backend env via per-file `os.environ.setdefault(...)` before importing the app — exactly the order-dependent pattern the lesson ["Tests must be order-independent"](context/foundation/lessons.md:40) says to replace with a session-scoped `tests/conftest.py`. New S-09 tests should follow the lesson (introduce/centralize conftest) rather than copy the per-file pattern, or at minimum not deepen the debt.

## Code References

- `supply-os-v1/app/suggestion.py:59-70` — `_round_per_rule`, the single place to add a sub-kg branch.
- `supply-os-v1/app/suggestion.py:86-93` — math chain; `suggested_base` derived backward; `over_max`.
- `supply-os-v1/app/models.py:39-42` — `RoundingRule` enum (add value here).
- `supply-os-v1/app/models.py:84` — `SupplierProduct.rounding_rule` default `FULL_ONLY`.
- `supply-os-v1/app/main.py:340-356` / `:973-988` — submit/edit build input + `delta_pct` floor `max(suggested, 1.0)`.
- `supply-os-v1/app/main.py:154-188` — `captain_suggest` preview (hardcodes FULL_ONLY).
- `supply-os-v1/app/sheets.py:219-244` — `_validate_headers` (defaulted field = optional column = schema-safe).
- `supply-os-v1/app/seed_loader.py:49-54` — absent column → model default; added column auto-picked-up.
- `docs/pita-supply-os-v1/DATA_MODEL.md:101` / `SHEETS_SCHEMA.md:54` — column already documented (drift vs seed).
- `docs/pita-supply-os-v1/seed/supplier_products.csv:49-50` / `location_product_settings.csv:10-11` — P009/P010 rows + sub-kg target.
- `frontend/src/pages/captain-mp/lib/compute.ts:11-12` — client `Math.ceil`, ignores `rounding_rule`.
- `frontend/src/pages/captain-mp/components/ProductCard.tsx:234-250` — captain qty input `step="1"`.
- `frontend/src/pages/manager/OrderLineTable.tsx:189-205` — manager qty `Math.floor()` + `step={1}`.
- `frontend/src/types.ts:22,60-74,217-240` — `RoundingRule`, `OrderableItem` (carries rule), `ManagerOrderLineDetail` (doesn't).
- `supply-os-v1/tests/test_suggestion.py:156-163` — existing 0.1-unit float-trap test (good precedent).
- (missing) `supply-os-v1/tests/conftest.py` — does not exist; 8 files use per-file env setdefault.

## Architecture Insights

- **One rounding chokepoint.** The engine's centralization (`_round_per_rule`) means the backend rule itself is genuinely small; the cost is in *assignment* (data) and *display parity* (frontend), not in the math.
- **Defaulted Pydantic fields = backward-compatible columns.** The `_validate_headers` "required = no-default" rule is the project's migration-safety mechanism: you can add an optional column to one backend (seed CSV) without breaking the other (live Sheet), and vice-versa. This is why an explicit `rounding_rule` column is low-risk.
- **Visible-math is computed in two places.** The Captain's on-screen suggestion is a *client-side* recompute (`compute.ts`), not the backend value — so "visible math" parity depends on the FE mirroring the engine's rule. It currently only mirrors `FULL_ONLY`. Any rule work must keep these in sync (or collapse to one source by using `/api/captain/suggest`).
- **`over_max` is informational, never a cap** (consistent with the F-01 lesson). The sub-kg rule is the proper fix for the cosmetic warning, not an `allow_over_max` data hack.

## Historical Context (from prior changes)

- `context/archive/2026-06-05-bukat-master-data-ready/audit.md:109-111` — "Spun-out engine improvement → NEW SLICE": the canonical S-09 framing (0.1-kg rounding; new rule + assignment + tests; do via full research→plan→implement→review).
- `context/archive/2026-06-05-bukat-master-data-ready/audit.md:148` — "Residual": P009/P010 cosmetic over-max warning is expected, not a regression; real fix is this slice.
- `context/foundation/roadmap.md:215` — F-01 Done-section lesson naming S-09; S-09 is **not yet a row** in the "At a glance" table or Slices (stops at S-08). Add it when planning.
- `context/foundation/lessons.md:40-45` — order-independence (conftest) rule, directly applicable to S-09's tests.
- `context/foundation/lessons.md:5-10` — "CI doesn't run product tests" — don't trust green; run pytest locally.

## Related Research

- None prior under `context/changes/**/research.md`. The F-01 `audit.md` (archived) is the closest precedent and the origin of this slice.

## Open Questions

1. **Assignment mechanism** — explicit `rounding_rule` column (auditable, per-SKU, doc-anticipated; ~16 Bukat+kg rows to set across seed CSV + live Sheet) vs. kg-default keyed strictly on `purchase_unit=="kg" AND units_per_purchase_unit==1` (no data entry, but a unit-string convention baked into the engine). **Recommendation to carry into `/10x-plan` or `/10x-frame`:** the explicit column — it's the path the schema docs already describe, keeps the engine data-driven, and gives a per-SKU override; a kg-default can be layered later as a fallback if desired.
2. **Rounding direction/granularity for the new rule** — ceil-to-0.1 (never under-supply, matches `FULL_ONLY`'s safety) vs. nearest-0.1 (matches `HALF_ALLOWED`'s style). The audit says "0.1-kg rounding"; pick a direction and justify against the suggest-only, never-under-critical contract.
3. **Deviation-gate floor** — should `max(suggested_qty_purchase, 1.0)` ([main.py:354](supply-os-v1/app/main.py:354)) be revisited for sub-1.0 kg suggestions? It changes the >20%-gate sensitivity. In or out of scope for S-09?
4. **Frontend scope** — minimum to honor sub-kg: fix `compute.ts` to respect `rounding_rule`, relax the two number inputs. Optional but valuable: surface the `over_max`/`explanation`/`warnings` the backend already produces (new i18n key + thread `rounding_rule` onto `ManagerOrderLineDetail`). Decide MVP vs. full.
5. **`captain_suggest` preview** — extend `SuggestRequest` + the call to pass `rounding_rule` so the stateless preview reflects the rule? (Low cost; closes a correctness gap.)
6. **conftest.py** — introduce the session-scoped conftest the lesson prescribes as part of S-09's test work, or keep scope tight and just match the existing per-file pattern (deepening known debt)?
