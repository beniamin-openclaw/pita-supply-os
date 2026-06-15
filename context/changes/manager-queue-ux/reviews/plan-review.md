<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Manager/Captain Queue UX Fixes

- **Plan**: context/changes/manager-queue-ux/plan.md
- **Mode**: Deep
- **Date**: 2026-06-16
- **Verdict**: REVISE → SOUND (after F1 applied)
- **Findings**: 0 critical · 1 warning · 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING → PASS (F1 fixed) |

## Grounding

7/7 paths ✓, symbols ✓ (`DEFAULT_TTL_SECONDS`, `load_orders`, `load_order_lines`), brief↔plan ✓.
Sub-agent verification: Claim1 no sort-test to break ✓ · Claim2 `.detail` display-only across all consumers ✓ · Claim3 blast-radius = OrderLineTable + OrderDetailPane only ✓ · Claim4 vitest slots in cleanly (jsdom, compute.test.ts pattern) ✓ · Claim5 default 422 handler → array detail ✓.

## Findings

### F1 — Plan assumed "no test runner" but Vitest is wired

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy + Phase 1/2 Success Criteria
- **Detail**: Plan cited `frontend/AGENTS.md` "no test runner" (stale). `package.json` has `"test": "vitest run"`, `vite.config.ts` has a test block, and 3 test files exist. `formatErrorDetail` (Bug 1) and status-aware `lineVisualState` (Bug 2) are pure functions — ideal unit-test targets for exactly the two subtle logic bugs.
- **Fix**: Add `apiClient.test.ts` (Phase 1) + `managerLine.test.ts` (Phase 2) following `compute.test.ts`; add `npm run test` to both phases' Automated Verification.
- **Decision**: FIXED (applied to plan — Phase 1 item #2, Phase 2 item #3, Testing Strategy rewrite, Progress 1.3/2.3 added)

### F2 — Recency sort drops deadline-urgency ordering at scale

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3 — queue sort
- **Detail**: Newest-first replaces cutoff-ascending; at higher volume a near-cutoff order could sit lower. Already a deliberate, documented owner decision (cutoff stays as a badge; pilot scale).
- **Decision**: ACCEPTED (documented tradeoff, no action)

## Triage summary

Fixed: F1 (applied to plan). Accepted: F2. Verdict after fixes: **SOUND**.
