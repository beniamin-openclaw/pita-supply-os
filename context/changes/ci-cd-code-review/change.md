---
change_id: ci-cd-code-review
title: AI code review in GitHub Actions — OpenRouter (DeepSeek V4.1 Flash) scores every PR on six criteria
status: implementing
created: 2026-09-13
updated: 2026-09-13
archived_at: null
---

## Notes

Course lesson m5l3 ("Code Review in the Age of AI"), Champion path A: an agent in the pipeline.
Operator decision 2026-09-12: use the OpenRouter API with `deepseek/deepseek-v4.1-flash` at
reasoning effort `high` (not Claude Code Action). Advisory only — the product CI (`ci.yml`) stays the
merge gate. Requirements adapted from the course prompt in `requirements.md`; grounding in
`research.md`; execution in `plan.md`.

Manual prerequisite (operator): repository secret `OPENROUTER_API_KEY`. Until it exists the
workflow runs, unit-tests the reviewer, and logs "AI review skipped" — the wiring is visible either way.
