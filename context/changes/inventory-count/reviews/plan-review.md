<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Inventory Count (S-06)

- **Plan**: context/changes/inventory-count/plan.md
- **Mode**: Deep
- **Date**: 2026-06-05
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 0 critical · 2 warnings · 1 observation — all addressed

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING (F1, fixed) |
| Architectural Fitness | PASS |
| Blind Spots | WARNING (F2, fixed) |
| Plan Completeness | PASS (F3 observation, fixed) |

## Grounding

7/7 existing paths ✓ (+ `i18n/strings.ts`, `pages/captain-mp/`), new files absent ✓, symbols ✓ (`_persist_order`, `append_order`, `captain_orderable:129`, `captain_submit:276`, `saveDraft/loadDraft`), brief↔plan ✓. Note: `grep .active` in `main.py` returned nothing — the existing order flow does not filter `active` (informed F3).

## Findings

### F1 — `latest` endpoint exceeds FR-015/016 (scope creep)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff (lean vs UX)
- **Dimension**: Lean Execution
- **Location**: Phase 2 §3 (+ Phase 3 hydration, a test, a success criterion)
- **Detail**: FR-015/016 = count → snapshot. The submit response already returns `count_id` (confirms persistence). `GET /api/captain/inventory/latest` is the READ path that S-07 (pre-fill) and S-08 (history) consume — building it in S-06 pulls forward another slice's work. The frontend marked its use "optional," confirming it is not load-bearing for the core flow.
- **Fix A ⭐ Recommended**: Drop `latest` from S-06 — remove the endpoint, its test, the success criterion, and the optional UI hydration; submit+toast confirms success. Defer the read path to S-07.
  - Strength: tightens the slice to its FRs; less to build under deadline.
  - Tradeoff: UI can't show "last counted / resume" until S-07.
  - Confidence: HIGH — not referenced by FR-015/016.
  - Blind spot: a post-submit confirmation screen would want a minimal read kept.
- **Fix B**: Keep `latest`, relabel "seeds S-07", make UI hydration non-optional.
  - Strength: nicer confirmation UX now.
  - Tradeoff: more S-06 scope; partial duplication of S-07.
  - Confidence: MED.
- **Decision**: FIXED via Fix A — `latest` endpoint, its test, success criteria, Progress item text, and UI hydration removed from plan.md + plan-brief.md (`products` + `submit` only; 2 captain endpoints).

### F2 — Missing-worksheet failure path (new tabs) → unhandled 500

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick fix (one try/except)
- **Dimension**: Blind Spots
- **Location**: Phase 2 §2 (submit) / `_persist_inventory_count`
- **Detail**: In sheet mode, `append_inventory_count` → `_open_worksheet` raises `WorksheetNotFound` if the operator hasn't created the new tabs. `_persist_inventory_count` mirrors `_persist_order`, which catches `NotImplementedError` but not `WorksheetNotFound` → submit returns a raw 500. The `inventory_counts` / `inventory_count_lines` tabs are NEW and easy to forget (unlike the orders tab already in prod).
- **Fix**: In the submit endpoint (sheet mode), catch `WorksheetNotFound` → 503 with a "configure the inventory worksheets" message; note the failure mode in the plan's error-path notes.
- **Decision**: FIXED — added the 503 error-path to Phase 2 §2 Contract and to Critical Implementation Details (worksheet-provisioning note).

### F3 — products-to-count `active` filter unspecified

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §1 (products endpoint)
- **Detail**: The endpoint returns all products with a `location_product_setting`. The existing order flow doesn't filter `.active` (grep empty) — so this is consistent — but a location-wide list can surface inactive/discontinued products the per-supplier order screen never showed.
- **Fix**: State the intended filter (active products with an active `location_product_setting`) in Phase 2 §1.
- **Decision**: FIXED — Phase 2 §1 now filters to `Product.active is True`.
