<!-- PLAN-REVIEW-REPORT -->
# Plan Review: S-10 — Sheets → Supabase Postgres Data Backend

- **Plan**: context/changes/supabase-backend/plan.md
- **Mode**: Deep
- **Date**: 2026-06-16
- **Verdict**: REVISE → SOUND (all 7 findings fixed in plan)
- **Findings**: 1 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict (initial) | After fixes |
|-----------|-------------------|-------------|
| End-State Alignment | PASS | PASS |
| Lean Execution | PASS | PASS |
| Architectural Fitness | WARNING | PASS |
| Blind Spots | FAIL | PASS |
| Plan Completeness | WARNING | PASS |

## Grounding
8/8 existing paths ✓, 3 new paths correctly absent, `SUPPORTS_PERSISTENCE` absent ✓, 20 guards ✓, `contract-surfaces.md` absent (check skipped), brief↔plan ✓. Sub-agent verified: no test substitutes a bare MagicMock backend (test_main.py:334 uses a hand-written class → safe); manager_dispatch confirmed two separate calls (main.py:1300, 1303); error-class move covered by back-compat re-export across 29 sites; `_choose_backend` called only in main.py.

## Findings

### F1 — Post-cutover rollback silently loses Postgres-only writes

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 5 — Cutover + rollback; Migration Notes
- **Detail**: "One-flip rollback, no data teardown" is only clean before any write hits Postgres. Post-cutover, flipping back to `sheet` drops orders/counts/receipts written to PG only — silent data loss on the documented recovery path.
- **Fix A ⭐ Recommended**: Bound the rollback-safe window + add a PG→Sheets reverse-sync escape hatch (mirrors the forward backfill).
  - Strength: Honest recovery story; pilot volume keeps the at-risk set tiny; symmetric to the planned backfill.
  - Tradeoff: Adds a reverse-sync script (or explicit accept-loss note).
  - Confidence: HIGH. Blind spot: reverse-sync must handle status/audit columns.
- **Fix B**: One-way cutover in a zero-activity window; rollback pre-write-only.
  - Strength: No reverse-sync. Tradeoff: rollback unavailable once orders flow.
- **Decision**: FIXED via Fix A — Phase 5 change #3 reworded (rollback clean only pre-write), new Phase 5 change #4 (`reverse_sync_supabase.py`), Migration Notes + manual criterion 5.5 + Progress updated; brief Open Risks + Success Criteria updated.

### F2 — `expected_status` seam contract contradicts itself

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details vs Phase 3 change #5
- **Detail**: Critical Impl Details said Sheets honors `expected_status` "via its existing reread"; Phase 3 said Sheets ignores it. Contradiction; implementer would guess.
- **Fix**: Sheets IGNORES `expected_status` (popped from kwargs, never a column; route preflight + dispatch guard cover sheet mode); only Supabase enforces it.
- **Decision**: FIXED — Critical Implementation Details bullet 1 rewritten to match Phase 3.

### F3 — Capability check is MagicMock-fragile (bare truthiness)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 change #4
- **Detail**: `if not getattr(backend, "SUPPORTS_PERSISTENCE", False):` mis-classifies a MagicMock backend as persistent. No current test breaks (verified), but latent.
- **Fix**: Use `getattr(...) is True` via an `_is_persistent(backend)` helper.
- **Decision**: FIXED — Phase 1 change #4 contract updated to `_is_persistent(backend)` (explicit `is True`).

### F4 — Dispatch "one transaction" claim contradicted by the code

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — Critical Implementation Details / change #4
- **Detail**: Plan claimed dispatch "runs in one transaction," but the route makes two separate backend calls (main.py:1300, 1303) and relies on idempotent line writes.
- **Fix A ⭐ Recommended**: Downgrade the claim — conditional status UPDATE is the double-dispatch guard; idempotent line writes preserve today's retry-safety. No new seam method.
  - Strength: Lean, faithful to existing semantics. Tradeoff: lines+status not strictly atomic (acceptable). Confidence: HIGH.
- **Fix B**: Add a combined transactional `dispatch_order()` method (sheets must implement too).
- **Decision**: FIXED via Fix A — Critical Implementation Details bullet 2 + Phase 3 change #4 reworded.

### F5 — No automated seam-completeness check for the new backend

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Success Criteria
- **Detail**: Nothing asserts supabase_backend implements every sheets seam function; a gap surfaces only at runtime in prod.
- **Fix**: Add a seam-parity test (introspect sheets public callables; assert supabase_backend ⊇).
- **Decision**: FIXED — Phase 3 change #6 + success criterion 3.3 + Progress 3.3 updated.

### F6 — numeric(8,6) on delta may cause false parity mismatches

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 DDL / Phase 5 verify_parity.py
- **Detail**: Exact-equality parity on suggestion-review could trip on a 6-decimal numeric round-trip.
- **Fix**: Compare at the endpoint's rounding (3–4 dp) / a small tolerance, not raw float equality.
- **Decision**: FIXED — Phase 5 change #2 (verify_parity) contract updated.

### F7 — Two capability-check styles coexist after Phase 1

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 — capability model
- **Detail**: The `getattr("append_*")` write-probe in `_persist_*` + the new `SUPPORTS_PERSISTENCE` flag for the 20 guards. They check distinct capabilities — defensible, worth a deliberate note.
- **Fix**: Note the intentional split in the plan (persistence vs write capability).
- **Decision**: FIXED — Phase 1 Overview note added.
