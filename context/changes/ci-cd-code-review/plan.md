# Plan: ci-cd-code-review

> Status: implementing · Created 2026-09-13 · Parent: `builder-certification-readiness` Phase 4

## End state

Every PR to `main` gets one advisory AI review comment (six 1–10 scores, summary, findings) from
`deepseek/deepseek-v4.1-flash` via OpenRouter, a `ai-cr:passed|failed` label, and an artifact; the
job never blocks a merge; without the secret it skips visibly; `ai-cr:review` re-runs it.

## Phase 1: Reviewer script + unit tests

- `.github/actions/ai-code-review/review.py` — stdlib only; prompt from the six criteria; JSON
  parsing tolerant of fences; verdict threshold; Markdown render; skip / auth-error paths exit 0.
- `.github/actions/ai-code-review/test_review.py` — 8 tests, no network (urlopen monkeypatched).
- Verification: `python3 -m pytest -q .github/actions/ai-code-review`; dry run without key prints
  the skip line; dry run with an invalid key records HTTP 401 and exits 0.

## Phase 2: Composite action + workflow

- `.github/actions/ai-code-review/action.yml` — inputs (key, model, effort, threshold, title, body,
  diff path, caps), outputs (`status`, `verdict`, `review_md`).
- `.github/workflows/ai-review.yml` — triggers, fork guard, unit tests, diff build, key check,
  review (`continue-on-error`), comment create-or-update by marker, labels, artifact.
- Verification: workflow appears in `gh workflow list` after push; first run on the cert PR shows
  the skip path (no key yet) with all steps green.

## Phase 3: Live run + evidence (needs the operator's secret)

- Operator adds `OPENROUTER_API_KEY`; add label `ai-cr:review` to the cert PR.
- Capture: Actions run (job list), review job log, PR comment → certification screenshots.

## References

- `requirements.md`, `research.md` (this folder); parent plan
  `context/changes/builder-certification-readiness/plan.md` Phase 4.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Reviewer script + unit tests

#### Automated

- [x] 1.1 review.py with skip / error / happy paths — 6d98c2c
- [x] 1.2 test_review.py green (8 tests) and ruff clean — 6d98c2c

### Phase 2: Composite action + workflow

#### Automated

- [x] 2.1 action.yml with inputs/outputs and key masking — 6d98c2c
- [x] 2.2 ai-review.yml with fork guard, key check, non-blocking review, comment, labels, artifact — 6d98c2c
- [x] 2.3 Workflow visible on GitHub and first run green on the skip path — run 34744005524 (PR #31)

### Phase 3: Live run + evidence

#### Manual

- [ ] 3.1 Operator adds OPENROUTER_API_KEY and labels the PR ai-cr:review
- [ ] 3.2 Evidence screenshots captured (run, log, comment)
