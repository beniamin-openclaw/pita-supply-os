# Implementation review — ci-cd-code-review (2026-09-13)

Reviewed as part of the independent review of branch `cert/builder-readiness`
(`context/changes/builder-certification-readiness/reviews/impl-review.md`, reviewer: Claude Fable 5.1 subagent, base `main`).

Scorecard for this change: correctness 8 · idiomaticity 8 · complexity 9 · test/risk coverage 8 · documentation 7 · security/safety 10.

Findings and outcome:

- **F4 (MED) — reasoning tokens shared the 4 000-token budget**, so a `high`-effort run could return truncated JSON → parse error → no comment, no label. Fixed in `bd72a5b`: `max_tokens` 16 000, `reasoning.exclude: true`, explicit error on `finish_reason == "length"`, unit test added (9 tests).
- **F5 (LOW) — comment lookup with `gh api --paginate --jq` emitted one id per page.** Fixed in `bd72a5b` with `--slurp`.
- Verified clean: fork guard, job `permissions`, `::add-mask::` on the key, `continue-on-error` on the model step, skip path without the secret (run 34744005524 green), `github.action_path` + `python3` after `setup-python`, no secret-shaped content.

Verdict: SHIP (after fixes). Live evidence (comment + label) still requires the operator's `OPENROUTER_API_KEY` — plan Phase 3.
