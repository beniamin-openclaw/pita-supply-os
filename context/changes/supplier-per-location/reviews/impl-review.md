<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: supplier-per-location

- **Plan**: `context/changes/supplier-per-location/plan.md`
- **Scope**: Phases 1–3 of 5 (Phase 4 gated on operator consent; Phase 5 deferred)
- **Date**: 2026-08-20
- **Mode**: drift + safety/pattern passes run inline (this session does not spawn sub-agents unprompted)
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Drift pass

Every file in the diff appears in the plan, and every planned Phase 1–3 item
appears in the diff. No MISSING, no EXTRA.

| Planned | Actual | Verdict |
|---|---|---|
| `LocationProductSetting.source_supplier_id` | `app/models.py` | MATCH |
| migration 0008 + rollback in header | `migrations/0008_…sql` | MATCH |
| `_LOCATION_PRODUCT_SETTING_COLUMNS` += column | `app/supabase_backend.py:99` | MATCH |
| integration `_schema` applies 0008 | `tests/test_supabase_integration.py` | MATCH |
| `_supplier_allowed` helper | `app/main.py:145` | MATCH |
| read path filters + `also_supplied_by` | `app/main.py:_build_orderable_items` | MATCH |
| **write path** filter (plan-review F1) | `app/main.py:_resolve_master_data` | MATCH |
| orphan-pin warning | `_build_orderable_items` | MATCH |
| FE type / card / i18n | `types.ts`, `ProductCard.tsx`, `strings.ts` | MATCH |
| new pin test suite | `tests/test_orderable_supplier_pin.py` (15 tests) | MATCH |

`tests/test_manager_add_line.py` gained a `load_suppliers` stub — not named in
the plan, but a direct consequence of the planned name-join, not scope creep.

## Success criteria

| Check | Result |
|---|---|
| `python -m pytest` | **453 passed**, 16 deselected |
| `ruff check .` | All checks passed |
| `npm run build` | built in 2.71s |
| `npm run lint` | clean |
| `npm run test` (vitest) | **89 passed** (10 files) |

`test_captain_orderable_wola_pago_returns_18_items` still asserts 18 — as the
plan predicted, phases 1–3 do not move it.

## Findings

### F1 — Pinning a product that sits on an in-flight order confuses the Captain edit screen

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `supply-os-v1/app/main.py` (`_resolve_master_data`), reached via `captain_order_edit`
- **Detail**: The write-path filter is correct and deliberate, but it also applies
  to `captain_order_edit`, which re-validates the **full** line set on every PATCH.
  If a pin lands while a `captain_submitted` order still carries the pinned-away
  product, the Captain's next edit 400s with "not orderable at this location" —
  a message about a line they did not touch.

  It is recoverable rather than a hard lock: `buildPayloadLines`
  (`frontend/src/pages/captain-mp/lib/buildPayloadLines.ts:20`) drops zero-quantity
  lines, so setting the moved line to 0 lets the edit through. But the Captain has
  no way to know that from the error.

  Likelihood is low and entirely under the operator's control — it needs a
  master-data batch to land inside the window between a submit and an edit on the
  same day. Grandfathering existing order lines would need the stored order to be
  diffed against the payload, which is real code for a window the operator can
  simply avoid.
- **Fix ⭐**: Add a precondition to the Phase 4 runbook — before pinning, confirm
  no open (`captain_submitted` / `manager_claimed`) order carries the affected
  products; if one does, dispatch or cancel it first.
  - Strength: Removes the window entirely at zero code cost, and fits the batch
    protocol the repo already runs (diff before → apply → audit after).
  - Tradeoff: Procedural, not enforced — it relies on the runbook being followed.
  - Confidence: HIGH — the check is one query, and pins are rare, scheduled batches.
  - Blind spot: Does not help if a Captain submits *during* the batch. Pilot
    volume makes that negligible.
- **Decision**: FIXED (precondition added to `prod-sql.sql` section 1)

### F2 — Seed CSVs do not yet carry the new column

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `docs/pita-supply-os-v1/seed/location_product_settings.csv`
- **Detail**: The seed loader drops blank keys and falls back to model defaults,
  so a CSV without the column loads fine — verified by the 453 green tests, which
  run on seed. Adding an all-empty column now would be churn with no signal. The
  plan puts it in Phase 4, alongside the rows that actually get pinned.
- **Fix**: None. Confirmed intentional; Phase 4 section 5 of `prod-sql.sql` owns it.
- **Decision**: ACCEPTED

### F3 — `_build_orderable_items` now performs four master-data reads instead of three

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `supply-os-v1/app/main.py:_build_orderable_items`
- **Detail**: `load_suppliers()` was added to join supplier *names* for
  `also_supplied_by`, and the catalog is iterated twice (once to build the carrier
  map, once to emit items). All reads are TTL-cached in both persistent backends,
  and the catalog is 154 rows, so the cost is immaterial. Recorded because it is
  the reason `test_manager_add_line` needed a new stub — a future test fixture
  will need the same.
- **Fix**: None.
- **Decision**: ACCEPTED
