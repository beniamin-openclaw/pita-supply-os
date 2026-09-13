---
change_id: builder-certification-readiness
title: 10xDevs 3.0 Builder (+ Champion A) certification readiness — reconcile docs with code, add test plan, AI review in CI
status: plan_reviewed
created: 2026-09-12
updated: 2026-09-12
archived_at: null
---

## Notes

Operator ask (2026-09-12): submit this repo for the 10xDevs 3.0 **Builder** badge (final window
2026-09-14 23:59) plus the optional **Champion A** badge (AI code review in CI, OpenRouter +
`deepseek/deepseek-v4.1-flash`, reasoning high). Scope rule from the operator: *nothing beyond
what passing needs plus good project documentation and course-conformant artifacts*. The
finance module (`finance-invoice-reconciliation`) stays **out of the certification story**
(not showcased, not in the test plan's risk map), but CI must be green, so its flaky test gets
fixed.

Certification inputs (external, verified 2026-09-12):
- Builder minimum = access control + CRUD on a persisted core item + business logic + tests
  mapped to a risk in `context/foundation/test-plan.md` + docs (README, PRD, roadmap,
  infrastructure). Public URL optional. E2E not required. Source: Circle posts
  "Certyfikacja 10xBuilder" (2026-06-05) and "mvp-check" (2026-06-28), lesson m3l5.
- Champion A evidence = screenshot of a pipeline with ≥1 review job, job logs, PR with the
  agent's review comment. Review + tests suffice; auto-deploy not required.
- One submission per person, both forms in the same window.

Rules in force (from `AGENTS.md`, `lessons.md`): no prod writes of any kind (no SQL, no
Railway/Vercel/Supabase changes); never place a real supplier order; secrets never in git —
`git add` by explicit path only and grep the index before every commit; skill artifacts in
English; `context/foundation/roadmap.md` is canonical, `/10x-archive` flips `done`.

Hard stops: the operator submits the forms (never the agent); the operator adds the
`OPENROUTER_API_KEY` repo secret (the agent never handles keys); nothing is merged to `main`
without the operator's PR review except the one-line CI test fix (authorized 2026-09-12).
