<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Transport-only supplier channel

- **Plan**: `context/changes/pago-transport-only-dispatch/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-21
- **Verdict**: SOUND after round 2 (REVISE at round 1, all 5 findings fixed)
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING at round 1, PASS after fixes |
| Architectural Fitness | PASS |
| Blind Spots | WARNING at round 1, PASS after fixes |
| Plan Completeness | FAIL at round 1, PASS after fixes |

## Grounding

9/9 existing paths OK, 2/2 new paths correctly absent, brief matches plan, one `## Progress`
heading, 18 Progress items matching 18 Success Criteria bullets, zero checkbox leakage outside
Progress.

Deep verification confirmed every load-bearing claim: the guard window at `main.py:1918-1928`
with no write or URL build between the supplier binding and `is_email_channel`; the constraint
name `suppliers_ordering_method_check` defined inline at `migrations/0001_initial_schema.sql:32-34`;
the deliberate absence of `preventDefault` on the Gmail anchor at `DispatchPanel.tsx:300-315`;
the four-key `as const` `titleKey` map at `DispatchPanel.tsx:125-132` that will fail `tsc`
once the union widens; and the fixture wiring point after
`test_supabase_integration.py:184`. No exhaustive test asserts the allowed value set.

## Findings

### F1 — Progress phase name does not match the phase heading

- **Severity**: CRITICAL
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `## Phase 1` heading vs `### Phase 1` in Progress
- **Detail**: The body heading is ``## Phase 1: Backend — the `transport` channel and its guard`` with backticks around `transport`; the Progress heading is `### Phase 1: Backend — the transport channel and its guard` without them. The Progress contract requires the names to match exactly, and `/10x-implement` parses Progress by phase name.
- **Fix**: Drop the backticks from the body heading so both read `Backend — the transport channel and its guard`.
- **Decision**: FIXED

### F2 — Doc drift: the spec's ordering_method mapping table is not in scope

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change 6
- **Detail**: The plan updates only `docs/pita-supply-os-v1/DATA_MODEL.md`. Verification found `docs/pita-supply-os-v1/MANAGER_V2_SPEC.md:219-236` carries an explicit `ordering_method` to `sent_method` mapping table with exactly four rows, plus prose naming the four values. Leaving it stale repeats the drift the repo already has on `suppliers.nip` and the lesson about reconciling docs in the same commit.
- **Fix**: Extend Phase 1 change 6 to cover the `MANAGER_V2_SPEC.md` mapping table as well as the `DATA_MODEL.md` row.
- **Decision**: FIXED

### F3 — The guard fails open on a non-Supabase backend, and one write path is unmentioned

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Migration Notes
- **Detail**: The flag lives in whichever backend `_choose_backend()` resolves. If prod ever degrades to the Sheets or seed backend, the supplier row there still reads `email` and the guard silently stops firing, which is the same class of silent-permissiveness the plan already calls out for a missing column. Separately, `supply-os-v1/scripts/backfill_supabase.py:33` writes the `suppliers` table from the Sheet through `_SUPPLIER_COLUMNS`, so re-running it after the data pass would overwrite `transport` with whatever the Sheet holds. Neither is in the plan.
- **Fix**: Add both to Migration Notes: state that the guard is only as good as the active backend, and that the backfill script must not be re-run against suppliers after the data pass without first mirroring the value in the Sheet.
- **Decision**: FIXED

### F4 — Duplicate tracking of the migration step

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress 1.5 and 3.3
- **Detail**: "Migration 0021 applied on prod before any code deploy" and "Operator applied migration 0021 on prod" are the same action with two checkboxes, which can be ticked inconsistently.
- **Fix**: Keep it in Phase 3 where the operator package lives and drop the Phase 1 duplicate, leaving Phase 1 with the CI integration item only.
- **Decision**: FIXED

### F5 — Unused generality in the guard helper

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1, change 3
- **Detail**: The helper is specified with an `action: str` parameter mirroring `_reject_if_locked_in_draft_transport`, but that sibling has three call sites and this one has exactly one. The parameter is generality with no current consumer.
- **Fix**: Drop the `action` parameter and word the message for dispatch directly; reintroduce it only if release or cancel ever need the same guard.
- **Decision**: FIXED


## Round 2 — 2026-09-21

All five findings applied to `plan.md`. Re-checks:

- One `## Progress` heading; phase names now match the body headings exactly; zero checkbox
  leakage; 17 Progress items against 17 Success Criteria bullets.
- The only new claim the fixes introduced was verified: the mapping table is at
  `docs/pita-supply-os-v1/MANAGER_V2_SPEC.md:228-235` with four rows, and the prose naming the
  four values sits at `:219-221`. `DATA_MODEL.md:58` carries the value list.
- No contradiction introduced against "What We're NOT Doing"; Phase 1 manual criteria now hold
  the CI integration item only.

No substantive findings remain. Verdict: SOUND — safe to implement.
