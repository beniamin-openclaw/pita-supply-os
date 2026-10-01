---
change_id: ci-cd-code-review
title: AI code review in GitHub Actions — OpenRouter (DeepSeek V4.1 Flash) scores every PR on six criteria
status: archived
created: 2026-09-13
updated: 2026-10-01
archived_at: 2026-10-01T10:58:45Z
---

## Notes

Course lesson m5l3 ("Code Review in the Age of AI"), Champion path A: an agent in the pipeline.
Operator decision 2026-09-12: use the OpenRouter API with `deepseek/deepseek-v4.1-flash` at
reasoning effort `high` (not Claude Code Action). Advisory only — the product CI (`ci.yml`) stays the
merge gate. Requirements adapted from the course prompt in `requirements.md`; grounding in
`research.md`; execution in `plan.md`.

Manual prerequisite (operator): repository secret `OPENROUTER_API_KEY`. Until it exists the
workflow runs, unit-tests the reviewer, and logs "AI review skipped" — the wiring is visible either way.

Archived 2026-10-01 (WIP cleanup).
- Merged with the cert PR #31 on 2026-09-14. The `OPENROUTER_API_KEY` secret was added the same day.
- The reviewer has run live on every PR since then, e.g. PR #42 got the comment "AI code review — PASS".
- Evidence for 3.1/3.2 is in the course workspace `~/Desktop/10xDEVS/certyfikacja/screenshots/champion/`.
