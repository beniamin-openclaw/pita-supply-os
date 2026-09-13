# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-13

> Retrofit note (2026-09-13): this plan was written after most coverage already
> existed. §3 statuses describe the coverage that shipped inside feature slices
> (the cited change folders); they do not claim the slices were test-rollout
> phases at the time. One phase (§3 #5) is genuinely not started.

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   operator is worried about X, and the failure would surface in the Captain
   or Manager flow" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting (commits on `main`, 30 days to
2026-09-13): `frontend/src/pages/manager/` — 25, `supply-os-v1/app/` — 15,
`frontend/src/pages/captain-mp/` — 8. Floor: the suite never touches the live
Sheet, Supabase or a supplier mailbox (conftest forces seed + blank credentials).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | A test, demo or duplicate click dispatches a real order or e-mail to a supplier | High | Medium | PRD line 78 (no accidental live orders); roadmap line 111 (S-02 hard rule); archive `2026-06-06-manager-bukat-email-dispatch`; hot-spot `frontend/src/pages/manager/` 25/30d |
| 2 | Purchase quantity is wrong because units or rounding were converted wrongly (kg vs carton vs piece, sub-kg, pack equivalents) | High | High | PRD line 44 (unit pain); archive `2026-06-05-subkg-rounding-rule`, `2026-09-06-pack-units-display-mobile-wrap` (6 of 7 KEN deviations display-induced) |
| 3 | Entered stock or a Manager edit is lost when two roles touch one order (claim / save / send-back / cancel race) | High | Medium | PRD line 82 (no entered stock lost); archive `2026-06-17-supabase-edit-atomic`, `2026-06-17-order-lines-targeted-load`, `2026-06-16-supabase-backend` |
| 4 | Abuse/IDOR: a Captain token reaches another location's order or a Manager action; a Manager screen sends the wrong role's token | High | Medium | PRD line 205 (two-token auth is Tier-1); lessons.md "Preview with auth DISABLED…" (bug shipped 2026-08-22) |
| 5 | A supplier transport combines location orders with wrong locations, stale quantities or a cancelled order | Medium | High | archive `2026-08-21-to-ordering-pago` (v1–v5.6, three post-deploy fix rounds); hot-spot `supply-os-v1/app/` 15/30d |
| 6 | A goods receipt records the wrong quantity, order or status, so variance and the WZ trail are wrong | Medium | Medium | PRD line 84 (lines stay inspectable); archive `2026-06-09-gr-01`, `2026-06-24-manager-receiving-view` |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Seed/test dispatch never sends; a second dispatch is rejected; placeholder supplier e-mails refused | "the two-step confirm is enough" | dispatch entry point, status transitions, channel boundary | unit + route | happy path only |
| #2 | Engine returns what the supplier can ship for every rounding rule; UI shows the stored number | "rounding is a display concern" | engine contract, master-data unit fields, UI formatting | unit + component | copying the production formula |
| #3 | Concurrent claim/save/cancel yields one winner and a 409; a failed multi-row write rolls back | "single worker means no races" | persisted state per backend, row-lock contract | integration on Postgres | over-mocking the backend |
| #4 | Every route rejects the other role; location A's Captain gets 404 for location B; each screen sends its own role's token | "require_any_auth covers it" | token per screen, ownership check per route | route tests, both headers | testing with auth disabled |
| #5 | Aggregation sums per location, drops cancelled and zero lines; finalize refuses an empty column | "the manager will notice" | aggregation inputs, lifecycle events, finalize guard | unit + route | brittle list-order asserts |
| #6 | One receipt per sent order of the same location; variance = received − effective ordered; missing photo flagged, not fatal | "photo failure should fail the receipt" | status guard, effective-quantity rule, photo degradation | route + integration | whole-payload snapshots |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Critical-path coverage | Defend Risk #1 and #2 at the cheapest layer | #1, #2 | unit + route | complete | `context/archive/2026-06-06-manager-bukat-email-dispatch/` (with `2026-06-05-captain-bukat-submit/`) |
| 2 | Data integrity on Postgres | Prove row-lock and atomic-edit contracts on a real database in CI | #3 | integration | complete | `context/archive/2026-06-16-supabase-backend/` |
| 3 | Transport aggregation | Catch regressions in the churn-heavy Manager transport flow | #5 | unit + route | complete | `context/archive/2026-08-21-to-ordering-pago/` |
| 4 | Receiving variance | Guard receipt status, location scoping and variance math | #6 | route + integration | implementing | `context/archive/2026-06-09-gr-01/` |
| 5 | Abuse / IDOR sweep | One table-driven test per route: wrong role, wrong location, no token | #4 | route | not started | — |

Phase 4 reads `implementing` because the slice's manual live-check rows were
never ticked before archiving; its automated coverage exists (§6.4). Phase 5 is
the open gap: role checks exist per route ad hoc, not as a systematic sweep.

## 4. Stack

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| backend unit + route | pytest + FastAPI TestClient | pytest 9.0.3, FastAPI 0.136 | 668 tests on `main`; seed backend forced by conftest |
| backend integration | pytest `-m integration` on PostgreSQL 16 | psycopg2, SQLAlchemy 2 | 21 tests; skip without `SUPPLY_OS_DATABASE_URL`; CI supplies a container |
| frontend unit + component | Vitest + jsdom + Testing Library | vitest 4.1, RTL 16.3, jsdom 29 | 365 tests; `*.test.ts(x)` next to the module |
| lint / types | ruff; eslint + `tsc -b` | ruff 0.15.16, eslint 10 | `tsc` runs in `npm run build`; TS `strict` off (H-01) |
| e2e | none — not planned | — | see §7 |
| accessibility | none | — | audit doc 2026-05-24 only |
| (optional) AI-native | PostToolUse hook (ruff / eslint --fix) — checked: 2026-09-13; AI review comment on PRs — checked: 2026-09-13 | n/a | never replaces the deterministic gates |

**Stack grounding tools (current session):**
- Docs: none — versions read from manifests and the installed environment; checked: 2026-09-13
- Search: Parallel web search — only to confirm the OpenRouter model id for the AI review gate; checked: 2026-09-13
- Runtime/browser: browser pane — screenshots only, not tests; checked: 2026-09-13
- Provider/platform: GitHub Actions (`ci.yml`, three jobs) — gate host; checked: 2026-09-13

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint (ruff, eslint) + types (`tsc -b`) | local + CI | required | syntactic / type drift |
| backend unit + route (pytest) | local + CI job `backend` | required | logic and contract regressions |
| backend integration on Postgres | CI job `backend-integration` | required | row-lock / atomic-write regressions (Risk #3) |
| frontend build + lint + Vitest | local + CI job `frontend` | required | UI math and component regressions (Risk #2) |
| post-edit hook (ruff / eslint --fix) | local (agent loop) | recommended | style drift at edit time |
| AI code review comment on PR | CI on PR | optional, non-blocking | drift vs plan — `context/changes/ci-cd-code-review/` |
| pre-prod smoke | between merge and live test | required by convention | env mismatches (lessons.md "Verify what production actually runs") |

## 6. Cookbook Patterns

How to add new tests in this project.

### 6.1 Adding a backend unit or route test

- **Location**: `supply-os-v1/tests/test_<area>.py`; one file per route family or engine.
- **Fixtures**: `tests/conftest.py` sets the seed backend and the test tokens once per session; use `headers=MANAGER` / captain headers from the module-level constants in the reference tests. Never set env per file.
- **Reference tests**: Risk #1 — `tests/test_manager_dispatch.py::test_dispatch_already_manager_sent`, `::test_dispatch_email_channel_rejects_placeholder_email`, `::test_dispatch_concurrent_dispatch_raises`; `tests/test_captain_submit.py::test_submit_critical_underorder_no_reason`. Risk #2 — `tests/test_suggestion.py::test_half_allowed_rule`, `::test_critical_zero_stock_orders_full_unit`, `tests/test_captain_submit.py::test_submit_bukat_p009_subkg_tenth_kg_from_seed`.
- **Run locally**: `cd supply-os-v1 && python -m pytest -q`.

### 6.2 Adding a frontend unit or component test

- **Location**: next to the module, `<module>.test.ts` / `<Component>.test.tsx`; jsdom + Testing Library for components.
- **Reference tests**: Risk #2 — `frontend/src/lib/packUnits.test.ts` ("120 szt / 24 -> 5"), `frontend/src/lib/orderQty.test.ts` (manager-final vs captain fallback), `frontend/src/pages/captain-mp/lib/compute.test.ts` (deviation colour + reason gate). Risk #4 — `frontend/src/auth.test.ts` (token prefix stripping).
- **Run locally**: `cd frontend && npm run test`.

### 6.3 Adding an integration test on real Postgres

- **Location**: `supply-os-v1/tests/test_supabase_integration.py` (marker `integration`; excluded by default via `addopts`).
- **Mocking policy**: none — the fixture applies the migrations to a throwaway database named by `SUPPLY_OS_DATABASE_URL` and seeds minimal master data; tests skip (never fail) without the DSN.
- **Reference tests**: Risk #3 — `::test_claim_contract_conditional`, `::test_cancel_contract_conditional`, `::test_inventory_count_edit_atomic_rolls_back_on_insert_failure`, `::test_update_order_lines_and_delete`.
- **Run locally**: `SUPPLY_OS_DATA_BACKEND=supabase SUPPLY_OS_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres python -m pytest -m integration -q` (never point it at prod).

### 6.4 Adding a test for a new API endpoint

- **Test type**: route test with TestClient (preferred); integration only when the contract depends on Postgres locking.
- **Pattern**: assert status codes for no token, wrong role, wrong location, wrong order status, then the happy path and its side-effects on the seed backend.
- **Reference tests**: Risk #4 — `tests/test_main.py::test_health_internal_rejects_captain_token`, `tests/test_manager_save.py::test_save_captain_token_rejected`; Risk #6 — `tests/test_receipt_submit.py::test_receipt_submit_wrong_location_404`, `::test_receipt_submit_wrong_status_409`, `::test_receipt_submit_on_closed_order_no_second_transition`, `tests/test_manager_receiving.py::test_queue_sent_lane_sets_received_counts`.
- **When to add integration instead**: when two roles can act on the same row at once (Risk #3).

### 6.5 Adding a transport (aggregation) test

- **Location**: `supply-os-v1/tests/test_transport.py` (138 tests; pure aggregation functions first, routes second).
- **Reference tests**: Risk #5 — `::test_aggregate_effective_qty_prefers_manager_final`, `::test_aggregate_drops_zero_effective_qty_lines`, `::test_aggregate_multi_order_same_location_kept_separate_summed`, `::test_aggregate_line_with_no_matching_order_is_skipped`.
- **Run locally**: `cd supply-os-v1 && python -m pytest -q tests/test_transport.py`.

### 6.6 Per-rollout-phase notes

- Phase 2 taught that the suite must be order-independent (settings load once) — see lessons.md; every new test file inherits conftest and sets nothing itself.
- Phase 3 taught that an auth-disabled preview proves rendering, never authorization — run role-scoped screens against a backend with tokens set (lessons.md).

## 7. What We Deliberately Don't Test

Exclusions agreed with the operator (2026-09-12). Future contributors should
respect these unless the underlying assumption changes.

- **Browser e2e** — internal tool with two roles and a handful of screens; deterministic route/component tests plus a manual smoke on prod give more signal per hour. Re-evaluate if a third role or a public surface is added.
- **Finance mirror (invoice vs receipt matching)** — outside this plan's scope by operator decision; its own tests run in CI but it carries no risk row here. Re-evaluate when the module leaves the KEN pilot.
- **Google Sheets backend paths against the live sheet** — the sheet is a legacy backend; tests patch the client and never touch the live document.
- **Pixel-level visual regression** — copy and layout change weekly with operator feedback; a visual diff would be red every sprint.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-13
- Stack versions last verified: 2026-09-13
- AI-native tool references last verified: 2026-09-13

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
