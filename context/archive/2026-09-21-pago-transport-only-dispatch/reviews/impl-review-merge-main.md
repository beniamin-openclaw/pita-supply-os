<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Transport-only supplier channel — merge of origin/main

- **Plan**: context/changes/pago-transport-only-dispatch/plan.md
- **Scope**: Merge commit d4f6ba6 (origin/main, PR #34 pago-suggestion-no-alerts, migration 0022, into feat/pago-transport-only-dispatch). Conflict resolution and the interaction of both features only; the change itself was reviewed in `impl-review.md`.
- **Date**: 2026-09-28
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Every Phase 1 and Phase 2 item survived the auto-merge (MATCH): migration 0021, the enum
member, `_reject_if_transport_only_supplier` and its single call site (after the supplier
None-guard, before `is_email_channel` and both writes), the fixture wiring, the dispatch tests,
both docs, `types.ts`, the `DispatchPanel` branch, the i18n keys and the component test. The
only textual conflict (integration `_schema()` fixture) resolves to 0020 -> 0021 -> 0022.
0021 (drop/re-add a CHECK) and 0022 (add a column) touch different objects, so 0021 running
on prod after 0022 is safe. The two features never read each other's field:
`suggestion_alerts_enabled` is Captain-side only, `ordering_method` is read by the Manager
detail and the dispatch guard only.

Automated: `ruff check .` clean; `pytest` 727 passed; `pytest -m integration` 24 passed on a
throwaway local Postgres 16 (`supply_os_it_pr33`, dropped after); `npm run build`, `npm run
lint` clean; `npm run test` 464 passed.

## Findings

### F1 — prod-sql.sql misleads the operator on the starting state and the audit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/pago-transport-only-dispatch/prod-sql.sql:30-31, :52-61, :71-72
- **Detail**: Section A dated the `manual` stopgap 2026-09-21 (it ran 2026-09-28). Audit C1
  justified the intact `email` column with "the Transport Gmail draft reads its recipients
  from this column" and hardcoded `recipient_count = 6`; since 2026-09-28 Pago is ordered from
  the "Ordering PB v5 prod" sheet and the app sends no Pago e-mail, and a different count would
  read as a false audit failure. C3 said waiting orders "go through the Transport screen",
  implying the app sends them.
- **Fix**: Section A now also selects `suggestion_alerts_enabled` and `recipient_count` with the
  correct date; C1 checks the channel, the alerts flag and an intact email against section A's
  count; C1/C3 describe the sheet as the temporary sending path. (Wording softened 2026-09-28
  after the operator said the Transport draft stays.)
- **Decision**: FIXED

### F2 — change.md does not record the stopgap date or the new sending path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/pago-transport-only-dispatch/change.md:24-27, :47-51
- **Detail**: The Notes present the app's Transport e-mail as "the correct Pago artifact" and
  describe the stopgap as pending. Both were overtaken on 2026-09-28.
- **Fix**: Dated addendum under `## Notes` (stopgap done 2026-09-28, Pago sent from the sheet,
  app batch is a record, merge with PR #34); `updated:` bumped.
- **Decision**: FIXED

### F3 — plan.md says `_SUPPLIER_COLUMNS` is untouched

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/pago-transport-only-dispatch/plan.md:60-62
- **Detail**: True for this change's own diff, false after the merge: PR #34 added
  `suggestion_alerts_enabled`, so the fixture's `suppliers` insert depends on 0022 again.
- **Fix**: Merge note appended to the Key Discoveries bullet.
- **Decision**: FIXED

### F4 — plan.md overstates the backfill-script caveat

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/pago-transport-only-dispatch/plan.md (Migration Notes)
- **Detail**: The plan said re-running `scripts/backfill_supabase.py` would overwrite
  `transport` with the Sheet value. The script is insert-only (`ON CONFLICT DO NOTHING`, skips
  existing primary keys), so it cannot revert `SUP_PAGO`. Pre-existing, not merge-induced; the
  merge does not widen it (a Sheet without `suggestion_alerts_enabled` binds the model default).
- **Fix**: Caveat corrected in place with a dated note.
- **Decision**: FIXED

### F5 — the prod combination (transport + alerts off) is not pinned by any test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supply-os-v1/tests/test_supabase_integration.py, test_suggestion_alerts_disabled.py, test_manager_dispatch.py
- **Detail**: Each feature is tested alone. Nothing asserted the shape prod will have after
  section B, and no integration test wrote a `transport` row, so CI never proved the widened
  CHECK on Postgres (the round-trip was checked ad hoc).
- **Fix**: Three tests: Captain orderable + a +300% submit with no reason for a transport
  supplier with alerts off (200, no warnings); dispatch of the same supplier (409, no writes);
  integration round-trip of a `transport` + alerts-off row, plus the CHECK still refusing an
  unknown value.
- **Decision**: FIXED

## Noted, not findings (outside this merge's scope)

- **Transport screen still offers a Gmail draft for a Pago batch**
  (`frontend/src/pages/manager/TransportPage.tsx`, `lib/transport.ts`). Pre-existing on main;
  the plan's "Not touching the Transport flow" covers it. It only creates a draft, never sends.
  Raised to the operator, who decided (2026-09-28) it stays: the sheet path is temporary and
  nothing is disconnected.
- **ResendPanel** renders the copy-list "dosyłka" panel for a Pago order dispatched per-order
  before the flip. No e-mail; recorded in the plan's "Not changing ResendPanel".
- **`frontend/src/types.ts` `Supplier`** does not mirror `suggestion_alerts_enabled` / `nip`
  (lesson "Mirror Pydantic optionality"). Came in with PR #34; no frontend consumer reads
  them off `Supplier`.
