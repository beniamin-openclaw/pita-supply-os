# Sub-kg (0.1 kg) Rounding Rule for Weight SKUs — Plan Brief

> Full plan: `context/changes/subkg-rounding-rule/plan.md`
> Research: `context/changes/subkg-rounding-rule/research.md`

## What & Why

Weight-based (kg) SKUs ceil to whole kilograms because the suggestion engine's `RoundingRule` has no sub-unit granularity — so it can't suggest 0.7 / 1.5 kg, and a sub-kg target on a per-kg SKU (P009 Natka, P010 Czosnek at Wola×Bukat) trips a cosmetic over-max warning. This adds a `tenth_kg` rule (ceil to the next 0.1 kg) — the proper engine fix the F-01 audit spun out as S-09, not a master-data hack.

## Starting Point

All rounding lives in one function, `_round_per_rule` ([suggestion.py:59-70](supply-os-v1/app/suggestion.py:59)), with three rules. `SupplierProduct.rounding_rule` already exists (defaults `full_only`) but **no seed CSV carries the column**, so every SKU ceils to whole kg. P009/P010 have `target=0.5, max=0.5, upu=1`, so today they ceil 0.5→1 kg and raise the over-max warning. The frontend computes the Captain suggestion client-side and hardcodes `Math.ceil`, and its qty inputs assume whole units.

## Desired End State

The 8 Bukat continuous-kg produce SKUs carry `rounding_rule = tenth_kg`; a P009 order with stock 0 / target 0.5 suggests **0.5 kg** with no over-max warning; the Captain and Manager screens show the same number the backend computes and accept fractional (0.1 kg) input; the supplier email carries decimals. Engine stays suggest-only; existing `full_only` SKUs behave identically.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Assign the rule | Explicit `rounding_rule` column (seed + live Sheet), 8 Bukat kg rows | Data-driven, per-SKU override, schema-safe, already documented; kg-default is unsafe on `inventory_unit` | Plan (Research flagged) |
| Rounding behaviour | Ceil to 0.1 kg | Never under-orders (matches `full_only`/critical safety); 0.5 stays 0.5 and the noise vanishes | Plan |
| Deviation `>20%` gate | Fix in this slice: `max(suggested, rounding_step(rule))` | Restores true % for sub-1.0 suggestions; identical for `full_only` (step 1.0) → zero regression | Plan |
| Frontend scope | Honor rule everywhere a suggestion is computed + fractional input | Restores Tier-1 visible-math parity and makes sub-kg enterable end-to-end; skips over-max UI | Plan |
| `/api/captain/suggest` | Extend to pass `rounding_rule` | Closes a latent footgun (preview hardcodes `full_only`) for ~3 lines | Plan |
| New-test env setup | Add session `tests/conftest.py`; don't refactor 8 legacy files | Applies the order-independence lesson where it counts without churn | Plan (lessons.md) |

## Scope

**In scope:** `tenth_kg` enum + engine branch + `rounding_step` helper; deviation-gate fix; `/suggest` preview; seed column + 8 Bukat rows; schema-doc sync; `conftest.py` + unit/integration tests; frontend rule-aware compute + fractional Captain/Manager input + edit-path fix.

**Out of scope:** kg-default derivation; non-Bukat kg SKUs; over-max/warnings UI; refactoring legacy test files; configurable step; live-Sheet write from this worktree.

## Architecture / Approach

Vertical-ish slice in three landable phases: **(1)** pure-code engine + gate + preview + test harness (testable in seed mode); **(2)** the explicit-column data assignment that makes P009/P010 use the rule, proven by integration tests, with the live Sheet as an owner migration step; **(3)** frontend parity — expose `rounding_rule` on the order-line detail, mirror the engine in `compute.ts`, and relax the two number inputs. The keystone is generalizing the gate's `max(suggested, 1.0)` to `max(suggested, rounding_step(rule))`, which fixes sub-kg without changing `full_only`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend engine + gate | `tenth_kg` rule, `rounding_step`, gate fix, preview, conftest + unit tests | Float artifact in ceil (`2.3*10`); must pre-clean |
| 2. Data + schema assignment | Seed column + 8 Bukat rows, doc sync, P009/P010 integration tests | A header-pinned test breaking on the new column |
| 3. Frontend parity + input | Rule-aware `compute.ts`, fractional Captain/Manager input, detail-line rule field | Edit path silently re-ceiling if `rounding_rule` isn't threaded |

**Prerequisites:** none (F-01 done; P009/P010 master data already corrected). Live-Sheet edit needs owner access (Phase 2 manual step).
**Estimated effort:** ~2-3 sessions across the 3 phases.

## Open Risks & Assumptions

- Assumes a sub-kg final the Captain types is a deliberate, valid quantity — the engine stays suggest-only and the Manager still commits.
- Allowing fractional Manager input means a carton SKU could theoretically be set to 1.5; accepted (Manager is the human authority).
- Live-Sheet column add is owner-performed out of band; until then prod stays `full_only` for those rows (safe — just the old cosmetic warning).

## Success Criteria (Summary)

- P009/P010 suggest sub-kg (e.g. 0.5 kg) with no over-max warning; Captain & Manager can enter 0.7 / 1.5 kg end-to-end.
- `python -m pytest` + `ruff check .` + `npm run build` + `npm run lint` all green; existing `full_only` behavior unchanged.
