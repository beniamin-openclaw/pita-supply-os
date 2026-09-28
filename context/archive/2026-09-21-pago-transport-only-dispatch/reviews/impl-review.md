<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Transport-only supplier channel

- **Plan**: `context/changes/pago-transport-only-dispatch/plan.md`
- **Scope**: Phases 1-3 (all)
- **Date**: 2026-09-21
- **Verdict**: APPROVED after fixes (NEEDS ATTENTION at round 1)
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING at round 1, PASS after fixes |

Two independent reviewers verified the guard is correctly placed and unbypassable: it sits at
`app/main.py:1950`, after the supplier None-guard and before `is_email_channel`, the Gmail build
and both writes. The counterfactual was traced — without the guard a `TRANSPORT` supplier is
non-email, skips the `"@"` 400 gate and reaches `update_order_lines`, so all three new tests
genuinely fail without it. All 12 planned items MATCH. No scope creep: `.gitignore` and `.devin/`
predate this work and stay out of it.

## Findings

### F1 — Progress 3.2 contradicts the shipped SQL

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `plan.md` Phase 3 Contract and Progress 3.2
- **Detail**: The criterion reads "The data pass carries `AND ordering_method = 'manual'`" but the shipped statement guards on `IN ('manual', 'email')`. The deviation is justified in `change.md`, but `plan.md ## Progress` is the canonical status, so ticking 3.2 literally would tick a false statement.
- **Fix**: Reword the Phase 3 Contract and Progress 3.2 to match the shipped guard. Safe to rename now because nothing is committed and no SHA is attached to the row.
- **Decision**: FIXED

### F2 — Progress 2.4 and 2.5 are unachievable as written

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `plan.md` Phase 2 Manual Verification, Progress 2.4 and 2.5
- **Detail**: They ask for a preview check that a Pago order shows the notice. That cannot be done on the seed backend: `manager_order_detail` returns 503 without a persistent backend, and the seed CSV deliberately keeps SUP_PAGO on `email`. As written the boxes could only ever be ticked without evidence, which is the rubber-stamping this review exists to catch. They also duplicate the prod checks at 3.6 and 3.7.
- **Fix**: Drop both, leaving Phase 2 with automated criteria only, and state in the phase that the visual confirmation is the prod check in Phase 3. The component test covers the rendering; the operator's auth-on prod check is the real gate, consistent with the lesson that an auth-off preview proves rendering but never authorization.
- **Decision**: FIXED

### F3 — A backend test docstring claims more than the test proves

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `supply-os-v1/tests/test_manager_dispatch.py`, the valid-email transport test
- **Detail**: The docstring says the guard "runs BEFORE the email-channel branch", but with a TRANSPORT supplier the e-mail branch never engages anyway, so the test cannot distinguish placement. It is also a near-duplicate of the plain 409 test.
- **Fix**: Patch `app.main.gmail_url.build_draft_url` and assert it was never called. That turns the docstring into a claim the test actually proves and makes the two tests distinct.
- **Decision**: FIXED

### F4 — Frontend negative test could pass vacuously

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `frontend/src/pages/manager/DispatchPanel.test.tsx`
- **Detail**: The "no dispatch affordances" test contains only negative assertions. A branch that silently rendered nothing would pass it.
- **Fix**: Add one positive anchor inside that test, so the absence assertions are made against a panel that demonstrably rendered.
- **Decision**: FIXED

### F5 — Test matchers diverge from the sibling component test

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `frontend/src/pages/manager/DispatchPanel.test.tsx`
- **Detail**: Uses `toBeTruthy()` / `toBeNull()` where `ManagerQueue.test.tsx` uses jest-dom matchers, which are registered globally in the test setup.
- **Fix**: Use `toBeInTheDocument()` and `toHaveAttribute()` to match the sibling.
- **Decision**: FIXED

### F6 — Doc drift inside the code

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `supply-os-v1/app/models.py` `ManagerDispatchRequest.sent_method` comment, the `manager_dispatch` docstring, and `frontend/src/pages/manager/DispatchPanel.tsx` header
- **Detail**: Three comments still describe four channels or claim `sent_method` maps 1:1 from `ordering_method`. The external docs were updated but these were not. The DispatchPanel header was explicitly in scope.
- **Fix**: Update all three to name the fifth channel and its 409.
- **Decision**: FIXED

### F7 — Integration fixture not exercised locally

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `supply-os-v1/tests/test_supabase_integration.py`
- **Detail**: No Postgres on this machine, so the 0021 wiring was verified statically only. The constraint name was checked against its definition in `0001_initial_schema.sql:33` and the file follows the 0016 template.
- **Fix**: None needed. Progress 1.5 already names the CI integration job as the gate; treat that green job as the evidence.
- **Decision**: ACCEPTED

### F8 — Imprecise wording in the decision note

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/changes/pago-transport-only-dispatch/decision-note.md`
- **Detail**: It says `t()` returns "the key name" for an unknown key. It returns `String(key)`, which for an undefined lookup is the literal text "undefined". The fail-closed conclusion is unaffected but the stated mechanism is wrong.
- **Fix**: Correct the wording.
- **Decision**: FIXED

## Round 1 fixes applied — 2026-09-21

Every finding was acted on, observations included. F7 stands ACCEPTED (needs a real
Postgres; CI's `backend-integration` job is the gate).

| # | What changed |
|---|---|
| F1 | `plan.md:302-307` Phase 3 contract + criterion + Progress 3.2 now read `IN ('manual','email')`, with the reason the wider guard is the safe one spelled out. |
| F2 | `plan.md` Phase 2 Manual criteria and Progress 2.4 / 2.5 removed; replaced with an explicit "None, and here is why" paragraph pointing at Progress 3.6 / 3.7. |
| F3 | `tests/test_manager_dispatch.py:542-560` — test renamed, patches `gmail_url.build_draft_url` and asserts `assert_not_called()`. **Round 2 corrected the rationale**: that assertion does not pin the guard's position (a TRANSPORT supplier never enters the email branch, so the builder is unreachable either way — verified by moving the guard below the branch and watching all three tests still pass). The docstring now says so plainly: the builder assertion is a regression pin on `is_email_channel`'s mutual exclusivity, and the two write assertions are what pin the guard ahead of persistence. |
| F4 | `DispatchPanel.test.tsx` — the negative-only test now opens with a positive assertion on the Transport link, so it cannot pass against a branch that rendered nothing. |
| F5 | `DispatchPanel.test.tsx` — `toBeTruthy()` / `getAttribute()` replaced with `toBeInTheDocument()` / `toHaveAttribute()`, matching `ManagerQueue.test.tsx`. |
| F6 | Three stale comments corrected: `models.py` `ManagerDispatchRequest.sent_method` (now says why `transport` is deliberately absent), the `manager_dispatch` docstring (now names the 409), `DispatchPanel.tsx` header (the 1:1 mapping now scoped to the four dispatchable channels). |
| F8 | `decision-note.md` — `t()` returns `String(key)`, not "the key name". |

Re-verification after the fixes: backend ruff clean, 718 pytest passed; frontend 457
tests passed, build exit 0, lint exit 0. Evidence: `../verification/results.md`.

## Round 2 — convergence check, 2026-09-21

Verdict on entry: **NOT CONVERGED** — two gaps, both now closed.

1. **F3's rationale was wrong, and the reviewer proved it by counterfactual.** Moving the
   guard below the e-mail branch on a scratch copy left all three transport tests green:
   `is_email_channel` compares against `OrderingMethod.EMAIL`, so for a TRANSPORT supplier
   `build_draft_url` is unreachable wherever the guard sits. `assert_not_called()` therefore
   pins mutual exclusivity, not ordering — the two write assertions are what pin the guard
   ahead of persistence. The test is kept (it still proves a valid `@` address does not
   reopen the route, and it fails loudly if the e-mail branch is ever made to fire for a
   non-EMAIL channel), but renamed
   `test_dispatch_transport_supplier_with_valid_email_refused_without_writes` and its
   docstring rewritten to claim only what it demonstrates. The same overclaim was corrected
   in `verification/results.md` and in the F3 row above.
2. **Orphan from F2**: `plan.md` "Manual testing steps" still opened with "On the preview…",
   contradicting the Phase 2 rationale two hundred lines earlier. Rewritten as prod-only with
   a pointer to `verification/preview-notes.md`.

Confirmed real and unregressed by round 2: F4 (positive anchor at `DispatchPanel.test.tsx:88`
precedes the negatives), F5 (jest-dom registered at `frontend/src/test/setup.ts:7`), F6 (all
three comments accurate against the code they sit on), F1 (`plan.md` 3.2 matches
`prod-sql.sql:39`), F2 (Progress parses: rows match Success Criteria one-to-one, no checkbox
bullets inside Phase blocks). F7 remains ACCEPTED.

Re-verification after the round-2 fixes: ruff clean, 718 pytest passed. The round-2 edits
touched one test docstring/name and three markdown files — no frontend source changed, so the
457-test / build / lint results above still stand.

**Status: CONVERGED.**
