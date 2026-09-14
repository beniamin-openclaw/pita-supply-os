# Plan: builder-certification-readiness

> Status: implementing (revision 2 after two independent reviews, 2026-09-12; execution started 2026-09-13) · Owner: Ben (operator) + Claude (autonomous execution)
> Deadline: submission Sun 2026-09-13 22:00 target, hard stop Mon 2026-09-14 18:00 (window closes 23:59 Warsaw time).

## End state

1. `main` is green in GitHub Actions and has no uncommitted work (dynamic-target-wola parked on its own PR, raw GoStock exports excluded).
2. `context/foundation/` reflects the code as of 2026-09-13: `test-plan.md` exists per the m3l1 schema and maps 6 risks to delivered coverage; `roadmap.md` has a Horizon 3 table covering Jul–Sep work; `prd.md` Non-goals revised; `README.md` at root explains the product, stack, local run in seed mode, tests, deploy, and the certification map (incl. the soft-delete decision).
3. `AGENTS.md` (root, frontend, backend) contains no false claims (CI, deploy, test runner, Supabase, Railway).
4. `context/changes/` holds only genuinely in-flight work; shipped changes are archived under `<created>-<id>` with loose ends annotated or carried forward.
5. `context/changes/ci-cd-code-review/` follows the m5l3 path (requirements → research → plan → implement → impl-review) and ships `.github/workflows/ai-review.yml` + composite action posting a 6-criteria AI review on PRs via OpenRouter `deepseek/deepseek-v4.1-flash` (reasoning: high); non-blocking; skips cleanly without the secret; re-triggerable by label.
6. `mvp-check` reports 5/5; one impl-review of the branch is recorded in `reviews/`; the operator has a ready-to-paste submission package (`certyfikacja/FORMULARZ-*.md`) and screenshots.

Out of scope (explicitly): E2E/Playwright, hard DELETE endpoint, PRD rewrite, branch cleanup, merging `dynamic-target-wola` or PR #26/#27, any prod data or infra change (no Supabase/Vercel/Railway MCP or CLI writes in this run), finance module showcase, Architect badge.

## Phase 1: Safety net — park uncommitted work, then green `main`

- 1.1 **Park first** (the working tree modifies `supply-os-v1/app/main.py`, which the CI fix also touches): `git checkout -b feat/dynamic-target-wola`; `git add` by explicit path using the §Files list in `context/changes/dynamic-target-wola/plan.md` (lines 138–224) plus `docs/pita-supply-os-v1/DATA_MODEL.md`, `supply-os-v1/tests/conftest.py`, `docs/pita-supply-os-v1/seed/location_product_usage.csv`, `docs/pita-supply-os-v1/analysis/gostock-2026-09-06/` **excluding `analysis/**/raw/`** (700 KB of GoStock exports with purchase prices and stock values — repo is public; raw stays local, `.gitignore` gets `docs/pita-supply-os-v1/analysis/**/raw/`). `git diff --cached --name-only` reviewed; secret grep on the index; commit `feat(dynamic-target-wola): usage × days-to-delivery target for Wola (Pago, Coca-Cola)`; push; `gh pr create` with body from change.md and "prod SQL not applied — do not merge before operator approval". `git status --porcelain` on the branch must then show only `context/changes/builder-certification-readiness/`.
- 1.2 `git checkout main` (tree clean except this change folder). Fix: `_finance_sync_last_run = {"at": float("-inf")}` in `supply-os-v1/app/main.py:5520` and both test resets in `tests/test_finance_routes.py:271,277`. Root cause (confirmed from run 34104738522 log: pytest ran 17 s after runner boot): `time.monotonic()` < 60 on a fresh VM makes `now - 0.0 < 60` true → 429. Same latent bug on a freshly restarted Railway container. `git diff --cached --stat` = exactly 2 files; `pytest -q` (~668 on clean main); commit `fix(finance): re-entry guard sentinel independent of monotonic clock start`; push; Actions green. Cherry-pick the fix onto `feat/dynamic-target-wola` so its PR is green too.
- 1.3 `git checkout -b cert/builder-readiness main`; `git add context/changes/builder-certification-readiness/`; commit `docs(builder-certification-readiness): change + reviewed plan`.
- 1.4 Install course packs in the repo (gitignored `.claude/`): `npx @przeprogramowani/10x-cli@latest get m3l1`, `m5l2`, `m5l3`, `m0l0`; verify `ls -la CLAUDE.md` still shows the symlink; copy nothing into git.

## Phase 2: Module 3 artifact — test plan (m3l1)

**Files:** `context/foundation/test-plan.md` (new), `context/foundation/lessons.md` (append one entry).

- 2.1 Author `test-plan.md` **strictly per `.claude/skills/10x-test-plan/references/test-plan-schema.md`**: fixed header + "Last updated"; §1 strategy with hot-spot scope; §2 risk map (6 rows, Impact/Likelihood High/Medium/Low, Source = PRD/roadmap lines, archived slice plans, interview answers recorded as `interview Q<n>` = operator's 2026-09-12 answers, hot-spot directories with churn counts — **no file, function or module names in Source**); **Risk Response Guidance** table (one row per risk); §3 phased rollout using the literal status vocabulary, where `complete` rows point at real archived change folders whose Progress is fully `[x]` (verified by reading them) and at least one row stays `not started`; §4 stack table + grounding note; §5 gates = the three CI jobs + PostToolUse hook; §6 cookbook 6.1–6.4 as "how to add a test here" with **reference tests** named (files/functions belong here, not in §2); §7 ownership; §8 refresh.
  Risks (finance excluded; all covered on `main`):
  1. A pilot/test run places a real supplier order or sends a real e-mail — Source: PRD guardrails, AGENTS hard rule, `2026-06-06-manager-bukat-email-dispatch`.
  2. Wrong purchase units / rounding (kg vs carton, sub-kg) yield a wrong order quantity — Source: PRD "unit pain", `2026-06-05-subkg-rounding-rule`, `2026-09-06-pack-units-display-mobile-wrap`, hot-spot `frontend/src/pages/captain-mp/`.
  3. Entered stock lost or Captain/Manager edits collide (claim, save, send-back) — Source: PRD NFR, `2026-06-17-supabase-edit-atomic`, `2026-06-17-order-lines-targeted-load`.
  4. Abuse/IDOR: a Captain token reads or edits another location's order, or reaches Manager routes — Source: `lessons.md` "auth-disabled preview", PRD auth model, interview.
  5. Manager combines location orders into one supplier transport with wrong locations/quantities or a cancelled order — Source: `to-ordering-pago` (archived in Phase 3), hot-spot `supply-os-v1/app/`.
  6. Goods receipt records a quantity/photo that does not match the delivery (variance, missing WZ) — Source: `2026-06-09-gr-01`, `2026-06-24-manager-receiving-view`.
  Reference tests for §6 (existence verified with `ls`, functions quoted): `supply-os-v1/tests/test_manager_dispatch.py`, `test_captain_submit.py`, `test_suggestion.py`, `test_supabase_integration.py`, `test_manager_save.py`, `test_manager_claim_release.py`, `test_main.py`, `test_transport.py`, `test_receipt_submit.py`, `test_manager_receiving.py`; `frontend/src/lib/packUnits.test.ts`, `orderQty.test.ts`, `src/auth.test.ts`.
- 2.2 Append one lesson in the `/10x-lesson` shape (Context / Problem / Rule / Applies to): *"Reconcile `roadmap.md` and `AGENTS.md` in the same commit that archives a change"* — problem evidence: ~127 commits after the last roadmap update.
- Verification: schema headings present in order; `grep -c '^| [1-6] |' test-plan.md` = 6; every path in §6 exists; §3 `complete` folders have zero `- [ ]` in Progress.

## Phase 3: Documentation reconciliation (m1l4, m2l1, m2l2 hygiene)

- 3.1 `README.md` (English; short "Dla Captainów" paragraph): what/why/who; architecture; **Run locally in seed mode** with an explicit env override that never reads the operator's `.env` (`SUPPLY_OS_DATA_BACKEND=seed SUPPLY_OS_GOOGLE_SHEET_ID= SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON= SUPPLY_OS_CAPTAIN_TOKENS=WOLA:demo-captain SUPPLY_OS_MANAGER_TOKEN=demo-manager uvicorn app.main:app --port 8901`, frontend `npm ci && npm run dev`) — commands executed and the startup log checked for `backend=seed` before the README claims them; tests; CI badge; deploy summary; **Certification map**: CRUD routes (Create `POST /api/captain/submit`, Read queue/detail, Update `PATCH` Captain/Manager, Delete = soft-cancel with reason and trace `POST /api/manager/cancel/{id}` and `transport/cancel` — stated as a deliberate audit-trail decision), business-logic modules, auth model, `test-plan.md`, docs; 10x workflow pointer (`context/`, archive count); link to `AGENTS.md`.
- 3.2 AGENTS.md corrections — root lines 7, 24, 29, 30, 32; `frontend/AGENTS.md:19`; `supply-os-v1/AGENTS.md:7-8`. Keep ≤ 200 lines; no pasted config; keep the "backend has no lockfile" note (true on `main`).
- 3.3 `roadmap.md`: `status: active`, `updated: 2026-09-13`; new "Horizon 3 — Rollout & operations (Jul–Sep 2026)" At-a-glance table (change-id, outcome, refs, status, archive path using `<created>-<id>`) for feedback-r4/r5/r6/r7, bracka-rollout, norblin-rollout, three-missing-products, wolska-blueservice-master-data, ken-browary-master-data, to-ordering-pago, training-feedback-0901, rolki-minima-master-data, pack-units-display-mobile-wrap, inventory-confirm-and-history, week1-feedback-targets, finance-invoice-reconciliation (one line, done), dynamic-target-wola (implemented, PR open, prod SQL pending), supplier-per-location (in-flight, pin dropped), multi-location-master-data + H-01 (implemented on PR #27, unmerged; H-01 row updated). Revise Non-goal at `roadmap.md:294` and `prd.md:239` to "Horizon 1 non-goal; partially taken up in Horizon 3 (finance mirror, GoStock-seeded usage)". `prd.md` "Scope since v2 (2026-09-13)" note ≤ 10 lines. Fix `roadmap.md:204` path after the deployment archive.
- 3.4 Small notes (cut first if late): `health-check.md` "Re-check 2026-09-13"; `deployment-plan.md` superseded header; `10xdevs.md` ≤ 15 lines; `docs/pita-supply-os-v1/README.md` "Historical" banner.
- 3.5 Archive per `/10x-archive` semantics — folder `context/archive/<created>-<id>/`, `git mv`, `status: archived`, `archived_at`, one commit `chore(archive): close <id>` each, annotations committed **before** the move: to-ordering-pago (3.5/3.6 "superseded by v5"), wolska-blueservice-master-data (1.5, 3.2, 3.4–3.7 "verified by three weeks of Wolska ordering — operator 2026-09-12"; fix path at `plan.md:339`), week1-feedback-targets (fix path at `plan.md:172`), inventory-confirm-and-history, finance-invoice-reconciliation (note eBiuro env not set on Railway), product-order-note-and-min-flag (status → implemented; Tzatziki check "operator 2026-09-12"), feedback-r7-tushar (new change.md `created: 2026-07-25`; banner fixed → merged `d45840f`), ken-browary-master-data (new change.md `created: 2026-08-31`), deployment (new change.md `created: 2026-06-04`). Create `master-data-followups/change.md` (`new`) carrying the 10 open operator items. Annotate `supplier-per-location/change.md` ("Outcome 2026-08-21: pin dropped; open: enforce `supplier_products.active`; PR #26 parked").
- Verification: `ls context/changes` = README, builder-certification-readiness, supplier-per-location, master-data-followups, ci-cd-code-review; every archived folder has `status: archived` + `archived_at`; `grep -rn "context/changes/" context/foundation` resolves; README commands ran; `wc -l AGENTS.md` ≤ 200.

## Phase 4: Champion A — AI code review in GitHub Actions (m5l2 + m5l3, course path)

**Files:** `context/changes/ci-cd-code-review/{change.md,requirements.md,research.md,plan.md,reviews/impl-review.md}`, `.github/actions/ai-code-review/{action.yml,review.py,test_review.py}`, `.github/workflows/ai-review.yml`.

- 4.1 `/10x-new`-shaped change folder; `requirements.md` = m5l3 requirements adapted (inputs: PR title, body, diff; 6 criteria 1–10; verdict rule all ≥ 6); `research.md` short and grounded (GHA facts, OpenRouter chat-completions + `reasoning.effort`, this repo's CI, secret-in-`if` limitation, label permissions); `plan.md` with phases + Progress + SHAs.
- 4.2 Composite action: inputs `openrouter_api_key`, `model` (default `deepseek/deepseek-v4.1-flash`, override-able), `reasoning_effort` (default `high`), `pr_title`, `pr_body`, `diff_path`, `max_diff_chars` (60000). `review.py` stdlib-only: builds the 6-criteria prompt, `response_format: json_object`, `max_tokens: 4000`, one retry on 5xx/timeout, tail-truncation note, never prints the key, writes `review.json` + `review.md` (score table, verdict, findings). `test_review.py` (pytest, no network): JSON parsing incl. fenced JSON, verdict threshold, truncation, missing-key path returns a clear "skipped" result.
- 4.3 Workflow `ai-review.yml`: `on: pull_request: types [opened, synchronize, reopened, labeled]`; run when event ≠ labeled or label = `ai-cr:review` (retrigger after the secret exists); `permissions: contents: read, pull-requests: write, issues: write`; skip fork PRs; `fetch-depth: 0`; unit-test the reviewer (`python -m pytest .github/actions/ai-code-review -q`); step "Check secret" writes `has_key` to `$GITHUB_OUTPUT` from `env`; review step `if: has_key == 'true'`, `continue-on-error: true`; comment step `if: steps.review.outcome == 'success'` posts/updates one comment (marker `<!-- ai-code-review -->`) with `GH_TOKEN: ${{ github.token }}`; labels `ai-cr:passed|failed` created with `gh label create --force` in a `continue-on-error` step; job never fails the PR. Without the key the log states "AI review skipped: OPENROUTER_API_KEY not set".
- 4.4 **Manual (operator):** add repo secret `OPENROUTER_API_KEY`; then add label `ai-cr:review` on the cert PR (or push) to trigger.
- 4.5 Evidence: screenshots of the Actions run (job list), the review job log, the PR comment → `/Users/ben/Desktop/10xDEVS/certyfikacja/screenshots/champion/`.
- 4.6 One impl-review of this change → `reviews/impl-review.md`; findings fixed.
- Verification: `python -m pytest .github/actions/ai-code-review -q` green; `gh workflow list` shows the workflow; first PR run shows the skip path or the comment.

## Phase 5: Verification, mvp-check, review, PR

- 5.1 Gates: `ruff check .`, `pytest -q`, `cd frontend && npm run build && npm run lint && npm run test`; secret grep with baseline (known false positives: `frontend/public/favicon.svg` `mask-type`, `tests/test_config_creds.py` FAKEKEY, `tests/test_supabase_storage.py` fixtures).
- 5.2 `mvp-check` (prompt at `/Users/ben/Desktop/10xDEVS/.claude/prompts/mvp-check.md`) run by a subagent in the repo root; target 5/5; fix within scope.
- 5.3 One independent impl-review of the whole branch (m5l3 six criteria + drift vs this plan) → `reviews/impl-review.md`; findings fixed or dismissed in `reviews/triage.md`.
- 5.4 Push `cert/builder-readiness`; `gh pr create` "docs: 10xDevs Builder certification readiness (test plan, README, roadmap H3, AGENTS.md) + AI review CI". **Manual:** operator reviews and merges; CI green on `main`.

## Phase 6: Submission package

- 6.1 Screenshots (agent): backend started with the explicit seed override above (startup log must show the seed backend; `.env` untouched; no Sheets/Supabase traffic), frontend dev server; Browser pane: Captain `/captain-v2` (suggestion math), `/captain-v2/inventory-count`, `/captain-v2/orders` + detail, receive screen, Manager `/manager` queue + detail + dispatch panel, `/manager/transport`; one Actions green run. Mobile viewport for Captain screens, desktop for Manager. Finance excluded. Saved to `/Users/ben/Desktop/10xDEVS/certyfikacja/screenshots/builder/`. Fallback: operator retakes on prod.
- 6.2 `certyfikacja/FORMULARZ-BUILDER.md` + `FORMULARZ-CHAMPION.md`: every known field pre-filled; comment text states the token auth model, the soft-delete decision, local seed-mode instructions (reviewers get no prod tokens), "rozbudowa istniejącego projektu", pointer to `test-plan.md`.
- 6.3 **Manual:** operator submits both forms in the same window; checks the confirmation e-mail.
- 6.4 `/10x-archive builder-certification-readiness` and `ci-cd-code-review` after the merge, before submission.

## Cut list if late (in order)
3.4 notes → archive only folders that already have change.md → mobile viewport → labels in workflow → Champion A evidence (Builder alone is still submittable).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| CI fix commit swallows dynamic-target hunks in `main.py` | park first (1.1), then fix on a clean tree; `git diff --cached --stat` = 2 files |
| Raw GoStock exports (prices, stock values) land in the public repo | exclude `analysis/**/raw/` via `.gitignore` + explicit-path `git add` |
| Local run or screenshots hit the live Google Sheet / Supabase | never source `.env`; explicit env override; check startup log; no Supabase/Vercel MCP calls |
| Secret or `.env`/`sa.json` slips into a commit | explicit-path `git add`, index review, secret grep with baseline |
| `/10x-archive` refuses (no change.md, uncommitted files in folder) | add change.md first; commit annotations before moving |
| Archiving breaks path references | fix `roadmap.md:204`, `week1…/plan.md:172`, `wolska…/plan.md:339` in the same commits |
| Test-plan looks retrofitted / violates schema | Source column without code anchors; §3 `complete` only where a fully-ticked archived plan exists; one `not started` phase (IDOR tests) |
| AI review job fails first run (labels, permissions) | `issues: write`, `gh label create --force`, `continue-on-error`, unit tests on the script |
| README commands don't work on a clean machine | executed in a fresh shell during 3.1 |
| Operator unavailable for merge/secret | Builder-critical work done by Sun 15:00; Champion evidence optional |

## References

- `/Users/ben/Desktop/10xDEVS/certyfikacja/WYMAGANIA-z-platformy-2026-09-12.md`, `PLAN-ZALICZENIA-2026-09-12.md`
- `.claude/skills/10x-test-plan/references/test-plan-schema.md`, `.claude/skills/10x-archive/SKILL.md`, `.claude/skills/10x-impl-review-ci/`, `.claude/prompts/m5l3-requirements.md`, `.claude/prompts/mvp-check.md`
- Reviews of this plan: `reviews/plan-review-a.md` (course conformity), `reviews/plan-review-b.md` (engineering safety)
- OpenRouter model `deepseek/deepseek-v4.1-flash` (released 2026-09-10; `reasoning_effort` supported; $0.15/$0.60 per 1M)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Safety net

#### Automated

- [x] 1.1 Park dynamic-target-wola on its own branch + PR (raw exports excluded) — b581fce (PR #30)
- [x] 1.2 Fix finance sync re-entry sentinel on clean main; CI green; cherry-pick to DTW branch — e3d8059 (CI run 34743256514 green; cherry-pick 02c136e)
- [x] 1.3 Create cert/builder-readiness with this change folder — 8e0ed36
- [x] 1.4 Install course packs m3l1 m5l2 m5l3 m0l0; CLAUDE.md symlink intact (no commit — `.claude/` is gitignored)

### Phase 2: Test plan (m3l1)

#### Automated

- [x] 2.1 Author context/foundation/test-plan.md per schema (6 risks, response guidance, phases, cookbook) — 96950f0
- [x] 2.2 Append lesson: reconcile roadmap/AGENTS.md when archiving — 96950f0

### Phase 3: Documentation reconciliation

#### Automated

- [x] 3.1 Root README.md with verified seed-mode commands and certification map — 7b9c14e
- [x] 3.2 AGENTS.md ×3 corrections — 0bce8a9
- [x] 3.3 roadmap.md Horizon 3 + Non-goal revision; prd.md scope note — aab3059
- [x] 3.4 health-check / deployment-plan / 10xdevs.md / docs README notes — 5d4305c (deployment-plan header in 236802e)
- [x] 3.5 Archive shipped changes; create master-data-followups; annotate supplier-per-location — 236802e + c15bb10…93bc4f3 (nine archive commits)

### Phase 4: Champion A — AI review in CI

#### Automated

- [x] 4.1 ci-cd-code-review change folder (change, requirements, research, plan) — 6d98c2c
- [x] 4.2 Composite action + review.py + test_review.py — 6d98c2c
- [x] 4.3 ai-review.yml with skip path, label retrigger, non-blocking — 6d98c2c (dry runs: skip path + HTTP 401 path exit 0)
- [x] 4.6 impl-review of ci-cd-code-review recorded — bd72a5b (reviews/impl-review.md)

#### Manual

- [ ] 4.4 Operator adds OPENROUTER_API_KEY secret
- [ ] 4.5 Evidence screenshots captured (job view, logs, PR comment)

### Phase 5: Verification

#### Automated

- [x] 5.1 All gates green + secret grep clean — f4f711f (ruff, pytest 668, action tests 8, vite build, eslint, vitest 365; grep clean)
- [x] 5.2 mvp-check 5/5 — reviews/mvp-check.md
- [x] 5.3 Independent impl-review recorded and triaged — reviews/impl-review.md + reviews/triage.md; fixes in bd72a5b
- [x] 5.4 Cert PR opened — PR #31 (draft until impl-review triage; CI + AI Review skip path green)

#### Manual

- [ ] 5.5 Operator reviews and merges the cert PR; main green

### Phase 6: Submission package

#### Automated

- [x] 6.1 Builder screenshots captured from local seed run — 12 PNG in certyfikacja/screenshots/builder/ (local Postgres with prod migrations + seed master data, auth ON, demo orders via API; no prod traffic)
- [x] 6.2 FORMULARZ-BUILDER.md and FORMULARZ-CHAMPION.md written — certyfikacja/ (course workspace)

#### Manual

- [ ] 6.3 Operator submits both forms; confirmation e-mail received
- [ ] 6.4 Changes archived after merge
