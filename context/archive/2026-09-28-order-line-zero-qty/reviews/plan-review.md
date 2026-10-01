<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Durable Manager zero on order lines

- **Plan**: context/changes/order-line-zero-qty/plan.md
- **Mode**: Deep
- **Date**: 2026-09-28
- **Verdict**: REVISE (before fixes) → SOUND (after fixes)
- **Findings**: 1 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

19/19 paths to modify exist, new files (`app/order_qty.py`, `0024_*.sql`,
`draftState.test.ts`) absent as expected; 4/4 backend rule sites match
(`gmail_url.py:28`, `main.py:1807,2166,3407`); brief↔plan ✓. Deep verification
(one sub-agent) CONFIRMED all 8 riskiest claims: Sheets skips unknown keys
(`sheets.py:602-605`), exactly two `ManagerOrderLineDetail(` sites
(`main.py:1114,1230`), complete `dispatched` blast radius
(`OrderLineTable.tsx:105`, `OrderDetailPane.tsx:117-121,197`, `managerLine.ts:121`),
no unlisted rule copies, dispatch URL built from `enriched_lines`
(`main.py:2028-2035,2044`), dispatch key-set assertion at
`test_manager_dispatch.py:450-454`, transport seeding/dirty via the shared helper,
finalize releases a captain-origin empty member (`main.py:4747-4753`, existing test
`test_transport.py:1456` covers only captain qty 0).

## Findings

### F1 — Phase 2 Manual Verification bullet has no Progress item

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Success Criteria / `## Progress`
- **Detail**: Phase 2 has a `#### Manual Verification:` subsection with the bullet "None beyond Phase 3…", but `### Phase 2` in Progress has no Manual subsection. `/10x-implement` expects every Success Criteria bullet to map to a `N.M` item.
- **Fix**: Replace the placeholder with the real local E2E checks from F2 and add matching Progress items.
- **Decision**: FIXED (applied under the operator's delegation for the chain up to plan-review)

### F2 — No end-to-end check before merge; prod check mutates real orders

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 / Phase 3 — Manual Verification
- **Detail**: The only behavioural check of the whole zero → save → reload → e-mail loop is on prod after merge, on a live `manager_claimed` order. Unit tests cover each function, but not the reload wiring in `ManagerPage` against a real Postgres with the new column bound. The lessons "Deploy end-to-end before asking the user to live-test" and "Preview with auth DISABLED cannot verify a screen's auth/role wiring", plus the documented local demo Postgres 16 environment, point to a pre-merge E2E. Editing an order Marek may be working on is also a side effect.
- **Fix A ⭐ Recommended**: Add a local E2E to Phase 2 on the demo Postgres 16 (0024 applied, auth on with only a manager token): zero → Zapisz → reload → e-mail preview, plus a Transport draft with a captain-origin member; dry-run `prod-sql.sql` there with ROLLBACK in Phase 3; run the prod check on a throwaway Captain order that is cancelled afterwards (or a stale claimed order the operator nominates), never Wyślij.
  - Strength: Catches wiring and NOT NULL binding bugs before prod; the prod check becomes a smoke test, not the first real test.
  - Tradeoff: ~20 minutes of local setup (Postgres start, reseed).
  - Confidence: HIGH — the same environment was used for training-feedback-0901.
  - Blind spot: The demo DB was found empty on 2026-09-06; it must be reseeded.
- **Decision**: FIXED via Fix A

### F3 — Transport prod check has no data to run on

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Manual Verification 3.5
- **Detail**: Prod has no Transport draft with a captain-origin member today (`TRN-20260925-PAGO-2d5342` and `TRN-20260902-PAGO-aa283f` hold manager-created/prefill orders with captain qty 0), and `SUP_PAGO.ordering_method = manual`. Step 3.5 cannot be executed as written.
- **Fix**: Cover the Transport case in the local E2E (F2) and make the prod step conditional on such a draft existing.
- **Decision**: FIXED

### F4 — Newly reachable finalize outcome not spelled out

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Desired End State; Phase 1 tests
- **Detail**: A captain-origin Transport member whose lines the Manager zeroed now hits the empty-column guard, which releases it to `captain_submitted` with the marker cleared (`main.py:4747-4753`) — not cancelled. The existing test covers only a captain-qty-0 member. The plan says "auto-removed" without the outcome.
- **Fix**: State the outcome (released to the queue, zeros and flags kept; the Manager cancels it there if needed) and assert it in the new finalize test.
- **Decision**: FIXED

### F5 — Line references drifted

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §7
- **Detail**: `ManagerOrderLineDetail(` is at `main.py:1114` and `:1230`, not `~1138`/`~1254`.
- **Fix**: Correct the references.
- **Decision**: FIXED

### F6 — Archive-time doc drift not mentioned

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3
- **Detail**: New tests change the counts quoted in `AGENTS.md`, `supply-os-v1/AGENTS.md` and `frontend/AGENTS.md` (668 / 365), and the change has no roadmap row. Lesson "Reconcile roadmap.md and AGENTS.md in the same commit that archives a change".
- **Fix**: Add an archive reminder to Phase 3 (Horizon 3 roadmap row + test counts).
- **Decision**: FIXED
