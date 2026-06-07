<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Order screen pre-fills stock from latest inventory snapshot (S-07)

- **Plan**: context/changes/order-prefill-from-inventory/plan.md
- **Scope**: Phase 1–3 of 3
- **Date**: 2026-06-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Grounding

Backend pytest 235 passed (229 + 6 new); ruff clean. Frontend tsc clean; eslint 0; vite build OK. Commits df06c34 (p1 backend), 61c6948 (p2 frontend), c6e4c03 (p3 ledger + fill-empties safeguard), dc8c55d (epilogue). Hard rule held — all tests synthetic, no order submitted/dispatched.

## Findings

### F1 — Prefill banner can show with nothing left to fill

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: CaptainMP.tsx `showPrefillBanner` / `acceptPrefill`
- **Detail**: The banner shows whenever a snapshot product is orderable. After switching to fill-empties-only, if the captain already typed every matching field, accept fills 0 (toast "0 poz."). Harmless; the alternative (banner appears/disappears as you type) is more jarring.
- **Fix**: Leave as-is. Could gate the banner on "≥1 empty matching field" later if it reads oddly in the pilot.
- **Decision**: ACCEPTED

### F2 — Frontend prefill logic verified by reasoning, not a runner

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: frontend (no test runner — repo-wide known gap)
- **Detail**: Backend is unit-tested (6 cases). The FE banner/accept logic is proven by reasoning + `tsc`/`eslint(0)`/`build` + the simulation walkthrough in `notes/edge-cases.md`. A Vitest harness would let us assert acceptPrefill directly.
- **Fix**: None now; covered by the standing "add Vitest" backlog item.
- **Decision**: ACCEPTED

### F3 — Stale-snapshot signal is the named date only

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: CaptainMP.tsx prefill banner (`prefillTime`)
- **Detail**: FR-017's safeguard is "name the snapshot date/time" — satisfied. An explicit "X days ago / stale" hint (edge-case #6) is not built; flagged in the ledger as a future enhancement.
- **Fix**: None — meets FR-017. Revisit after pilot feedback.
- **Decision**: ACCEPTED

## Notes

The fill-empties-only safeguard (never clobber hand-typed `current_stock`, incl. a deliberate `0`) was adopted from the scout workflow `w0lafv5zc` cross-check — a stronger reading of "never overwrites without confirmation" than the original fill-all. **Candidate `/10x-lesson`**: "when pre-filling user-editable fields from a data source, fill only empty fields and name the source; never clobber typed input." Manual gates 2.6 (owner sim) + 3.3 (owner reviews edge-case ledger) remain pending by design — the real pilot test.
