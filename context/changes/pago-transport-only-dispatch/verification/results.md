# Verification — pago-transport-only-dispatch

Run: 2026-09-21, working tree (nothing committed yet).
Re-run after the impl-review round-1 fixes (F1–F6, F8) were applied.

## Backend (`supply-os-v1/`)

| Check | Command | Result |
|---|---|---|
| Lint | `python3 -m ruff check .` | `All checks passed!` (exit 0) |
| Tests | `python3 -m pytest -q` | `718 passed, 23 deselected in 1.71s` |

718 = 715 on `main` + the 3 new dispatch tests. The 23 deselected are the
`integration` marker (no DSN locally — see below).

The three new tests (`tests/test_manager_dispatch.py:493-560`):

- a `transport` supplier is refused with 409 and neither `update_order` nor
  `update_order_lines` is called;
- the refusal also holds when the supplier has a perfectly valid e-mail (so it is the
  guard refusing it, not the placeholder-email check), and neither write runs;
  `gmail_url.build_draft_url` is additionally asserted never called. Round 2 checked
  that last assertion by counterfactual and it does NOT pin the guard's position — a
  TRANSPORT supplier can never enter the email branch anyway (`is_email_channel`
  compares against `EMAIL`). It is kept as a regression pin on that mutual
  exclusivity; the write assertions are what pin the guard ahead of persistence;
- an order already carrying a `TRN-` marker is refused by the same guard (the
  guard is unconditional — there is no exemption for batch members).

## Frontend (`frontend/`, Homebrew node)

| Check | Command | Result |
|---|---|---|
| Tests | `npm run test` | `34 files, 457 passed` (exit 0) |
| Build | `npm run build` | exit 0 (`✓ built in 2.21s`) |
| Lint | `npm run lint` | exit 0 |

457 = 454 on `main` + the 3 new `DispatchPanel.test.tsx` tests.

## Phase 3 automated criteria

| Criterion | Evidence |
|---|---|
| 3.1 no unguarded `UPDATE`, no `DELETE` | one `UPDATE` (`prod-sql.sql:36`), guarded at `:38-39`; zero occurrences of `delete` in the file |
| 3.2 data pass carries the value guard | `prod-sql.sql:39` — `AND ordering_method IN ('manual', 'email')` |

## Not verified here

- **1.5 `pytest -m integration`** — needs a real Postgres (`SUPPLY_OS_DATABASE_URL`);
  none is running on this machine, so the 23 integration tests are deselected. The
  migration-0021 wiring in `tests/test_supabase_integration.py:164-168` is exercised
  by the CI job `backend-integration`, which runs against a Postgres 16 container.
  This item stays unchecked until that job reports green on the PR.
- **The prod checks (3.3–3.7)** are the operator's, in the order the `prod-sql.sql`
  header states: migration → deploy → confirm live → data pass → screen check.
