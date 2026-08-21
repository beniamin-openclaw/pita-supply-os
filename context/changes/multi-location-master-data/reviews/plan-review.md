<!-- PLAN-REVIEW-REPORT -->
# Plan Review: multi-location-master-data

- **Plan**: `context/changes/multi-location-master-data/plan.md`
- **Mode**: Deep, reviewer = orchestrator (Fable 5 high), per the operator's
  execution-model instruction
- **Date**: 2026-08-21
- **Verdict**: REVISE → SOUND after fixes (all applied before implementation)
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING → PASS after F1 |
| Blind Spots | FAIL → PASS after F1–F3 |
| Plan Completeness | WARNING → PASS after F2/F4 |

## Findings

### F1 — Onboarding catalog rows leak visibility into the four live locations

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Plan "What" §2 (generator) + Phase B1
- **Detail**: New locations need e.g. `SP_SELGROS_P001` (Masło MR at Selgros for
  Westfield). But `supplier_products` is GLOBAL and the four live locations are
  UNPINNED, so the moment such a row lands active, every Warsaw location's Masło
  line grows an "also supplied by: Selgros" badge — and once Selgros the supplier
  is activated, a full Selgros tab with dozens of products appears in every
  Captain's picker. The plan as written would quietly widen visibility at live
  locations as a side effect of onboarding inactive ones — exactly the failure
  mode FR-026's Socratic round warned about, from a new direction.
- **Fix ⭐ (applied)**: Batch-order the rollout so nothing leaks:
  1. shared suppliers (inactive), 2. new products, 3. new `supplier_products` rows
  **`active = FALSE`**, 4. new locations' settings (locations inactive).
  Then a **per-location ACTIVATION batch** (operator-run, post-0008/PR#26): flip
  the location active + flip its supplier_products rows active + in the SAME batch
  apply pins at the four live locations for every product that thereby gains a
  second carrier (their sheets already tell us their supplier). Inactive rows are
  excluded from the orderable carrier map (`sp.active` filter, PR #26), so until
  activation there is zero visibility change anywhere — provable in the audit.
- **Decision**: FIXED (plan amended)

### F2 — `units_per_purchase_unit` / `rounding_rule` are not in the sheets

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: "What" §2, supplier_products emission
- **Detail**: Sheets carry unit + price but never units-per-purchase or rounding.
  Defaulting silently to 1.0/full_only would bake wrong packaging math into
  suggestion output for Opak-type SKUs.
- **Fix (applied)**: default 1.0 / `full_only` **plus** a per-row note
  `packaging TBC` and a gap-list entry per location for every `Opak` row; where the
  same product already has a catalog row at another supplier, copy ITS packaging and
  note the source.
- **Decision**: FIXED

### F3 — New-product id collisions across locations

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: "What" §2 (P155+ sequence)
- **Detail**: The same new product (e.g. "Bifteki burgers", "Corfu Pilsner") appears
  in several sheets; per-location id assignment would mint duplicates.
- **Fix (applied)**: dedupe new products ACROSS all sheets by normalized name before
  assigning ids; one product row, many supplier/location references.
- **Decision**: FIXED

### F4 — Prod snapshot must be captured first, while access works

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase A2 ("a prod snapshot")
- **Detail**: The permission classifier intermittently blocks prod queries; leaving
  the snapshot for mid-run risks stranding reconciliation. Seed is not a substitute
  (fixture, diverges — documented).
- **Fix (applied)**: new Phase A0 — dump products / suppliers / supplier_products /
  location_product_settings / locations to `snapshot/` JSON **before** anything
  else, retry-once policy, and fail loudly to a gap note if blocked.
- **Decision**: FIXED

### F5 — TS strict may not be finishable in one night

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Lean Execution
- **Detail**: Already staged in the plan with an explicit revert-and-inventory path;
  recorded here so the reviewer's acceptance is auditable.
- **Decision**: ACCEPTED (as planned)
