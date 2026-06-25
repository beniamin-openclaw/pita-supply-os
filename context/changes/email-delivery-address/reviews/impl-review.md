<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Email delivery address

- **Plan**: context/changes/email-delivery-address/plan.md
- **Scope**: Phase 1 + Phase 2 (full plan)
- **Date**: 2026-06-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations
- **Commits**: 1078240 (backend), dbcffca (frontend)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Summary

Both email builders now emit the same `Adres dostawy:` line —
`location_name, delivery_address, city` joined by `", "` with empty parts
skipped — and `ManagerOrderDetail` carries the two new fields (populated from the
location the route already loads, so no new I/O). Backend `_format_delivery_address`
and the TS inline logic are byte-identical; the prior `delivery_address or
location_name` fallback (which dropped the name and city whenever a street was
set) is gone. Suites green: backend 402 passed; frontend build + lint + 82 tests
passed (5 new `emailBody` tests).

## Findings

### F1 — "TBD" master-data placeholder renders literally until the owner fills it

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; out-of-band master-data edit
- **Dimension**: Success Criteria
- **Location**: docs/pita-supply-os-v1/seed/locations.csv:2 (WOLA `delivery_address=TBD`, prod = Supabase)
- **Detail**: The code joins whatever master data holds. Wola's seed
  `delivery_address` is the literal `TBD`, so on unfixed data the line reads
  `Adres dostawy: Pita Bros Wola, TBD, Warsaw`. This is the documented caveat,
  not a code defect — deliberately NOT special-cased ("TBD" sentinel detection
  would be brittle). It is the gating item for the owner live run (plan 2.2).
- **Fix**: Owner sets Wola's real street in production master data before the
  live verify. Tracked in verification/preview-notes.md; out of scope for this change.
- **Decision**: ACCEPTED (master-data action, owner-owned)

### F2 — Two builders kept in sync by convention, not enforcement

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — pre-existing condition, no new risk introduced
- **Dimension**: Architecture
- **Location**: supply-os-v1/app/gmail_url.py:33 ↔ frontend/src/pages/manager/lib/emailBody.ts:76
- **Detail**: The Python and TS address formats must stay byte-identical but are
  two separate implementations linked only by cross-referencing comments — the
  same split the existing S-02/S-09 notes already accept for the whole body. This
  change adds identical logic + a lockstep comment on both sides and a unit test
  pinning the exact string on the TS side (the one that actually sends), so it
  does not worsen the condition.
- **Fix**: None now — matches the established dual-builder convention. If these
  ever drift in practice, extract a shared contract test; not warranted at pilot scope.
- **Decision**: ACCEPTED (matches existing pattern)

## Success Criteria

- **1.1 backend pytest** — PASS: `402 passed, 16 deselected` (incl. rewritten
  `test_build_url_combines_name_address_city`).
- **2.1 frontend build/lint/test** — PASS: `tsc -b && vite build` ✓, `eslint .`
  clean, `vitest` `82 passed (10 files)`.
- **2.2 owner live-run** — PENDING (deferred-by-design; gated on Wola master-data, F1).
