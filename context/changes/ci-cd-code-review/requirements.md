# Requirements — ci-cd-code-review

Adapted from the m5l3 course prompt (`.claude/prompts/m5l3-requirements.md`) for this repository.

## Overall concept

- A GitHub Actions workflow runs for every pull request to `main` (opened / synchronize / reopened).
- The review itself lives in a composite action (`.github/actions/ai-code-review/`) so the workflow
  stays easy to read and the agent can guard other repos later.
- Provider: OpenRouter chat completions; model `deepseek/deepseek-v4.1-flash`; `reasoning.effort: high`.
- Advisory: the job never fails the PR. Product CI (`ci.yml`) remains the merge gate.

## Input parameters

- pull request title
- pull request description
- git diff `origin/<base>...HEAD` (head truncated at 60 000 characters; truncation is stated)

## Code review criteria (each scored 1–10; 1 = worst, 10 = best)

1. **implementation correctness** — does the code do what it claims, handling edge cases and error
   paths without regressions?
2. **idiomaticity** — does it follow the language, framework and project conventions a fluent
   reader expects (here: `_choose_backend()` seam, `apiClient.ts`, `i18n/`)?
3. **complexity** — is the solution as simple as the problem allows?
4. **test / risk coverage** — are risky paths exercised by tests proportional to their risk?
5. **documentation** — are non-obvious decisions explained where a reader needs them?
6. **security and safety** — no vulnerabilities, secret leaks or unsafe handling of untrusted input.

Verdict: `pass` when every criterion ≥ 6, otherwise `fail`.

## Expected side-effects

- One PR comment (created, then updated in place on later pushes) with the score table, a summary
  and findings.
- Labels `ai-cr:passed` (green) or `ai-cr:failed` (red); labels are created on first use.
- Review artifact (`review.json`, `review.md`) attached to the run.

## Expected behaviour

- On-demand retry when the label `ai-cr:review` is added (needed because the API key arrives after
  the first PR is opened).
- Without `OPENROUTER_API_KEY` the job logs a clear skip message and exits green.
- Fork PRs are skipped (no secrets available, no write permissions).
- The key is masked in logs and passed only via environment.

## Parked for later

- business alignment and architectural fit (need broader context than a diff)
- hard merge gate (branch protection on the verdict) — only after the scores prove stable
- promptfoo evaluation matrix across models (m5l3 optional exercise)
