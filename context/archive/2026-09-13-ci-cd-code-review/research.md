# Research — ci-cd-code-review

Grounding for the plan; facts checked on 2026-09-13.

## This repository

- CI today: `.github/workflows/ci.yml` — three jobs (backend ruff + pytest, backend integration on
  Postgres 16, frontend build + lint + vitest) on every push and PR. Green on `main` since `e3d8059`.
- No existing AI/LLM tooling in the repo; Python 3.12 on the runner via `actions/setup-python@v5`;
  `gh` CLI is preinstalled on `ubuntu-latest`.
- Repo is public; PRs come from the same repository (solo repo). Existing labels use the
  `status:*` prefix (`gh label list`), none of the `ai-cr:*` labels exist yet.

## GitHub Actions constraints that shape the design

- `secrets.*` cannot be referenced in a step `if:`; the presence check is a step that reads the
  secret from `env` and writes `has_key` to `$GITHUB_OUTPUT`.
- A composite action receives inputs, not secrets, so the key is passed as an input from the
  workflow and masked with `::add-mask::` before use.
- Creating labels needs `issues: write`; commenting on a PR needs `pull-requests: write`; both are
  granted at job level with `permissions: {}` at the top.
- `pull_request` from a fork gets a read-only token and no secrets → skip via
  `head.repo.full_name == github.repository`.
- `continue-on-error: true` keeps the job green when the model call fails; the comment/label steps
  are gated on `steps.review.outcome == 'success'` and `status == 'ok'`.
- Re-trigger: `types: [labeled]` plus `github.event.label.name == 'ai-cr:review'`.

## OpenRouter

- Endpoint `POST https://openrouter.ai/api/v1/chat/completions`, OpenAI-compatible; header
  `Authorization: Bearer $OPENROUTER_API_KEY`.
- Model `deepseek/deepseek-v4.1-flash` (released 2026-09-10; 1M context; $0.15 / $0.60 per 1M
  tokens; `reasoning` / `reasoning_effort` accepted) — model page and llms.txt on openrouter.ai.
- `response_format: {type: json_object}` is accepted; the parser still tolerates fenced JSON.
- Cost guard: one call per push, `max_tokens 4000`, diff cap 60 000 chars → cents per review.

## Course references

- m5l3 lesson (`lekcje/23-…`): workflow → composite action → inputs (title, body, diff) → soft
  score → labels; Claude Code Action shown as the off-the-shelf alternative.
- `.claude/skills/10x-impl-review-ci/` is the Claude-Code-Action variant of the same idea (plan
  drift / safety / test coverage); this change implements the hand-built path with a different
  provider, as the operator asked.
