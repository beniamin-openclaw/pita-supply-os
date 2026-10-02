# 10xDevs 3.0 — course context

Course `10xdevs3`. Tool: **Claude Code** — skills live in `.claude/skills/`, installed per lesson via `npx @przeprogramowani/10x-cli@latest get <mXlY>`. `.claude/` is gitignored, but since 2026-10-01 the 10x skills, `.claude/agents/` and `.claude/settings.json` are force-added (`git add -f`) so Claude Code cloud sessions get them; re-run `git add -f` after a `10x get` that adds new files. `settings.local.json` and the rest of `.claude/` stay local.

Lesson artifacts (paths relative to `context/foundation/` unless noted): m1l1 shape/PRD → `shape-notes.md`, `prd.md` · m1l2 stack assessment → `stack-assessment.md` · m1l3 health check → `health-check.md` · m1l4 AGENTS.md + lessons → root/`frontend`/`supply-os-v1` `AGENTS.md`, `lessons.md` · m1l5 infrastructure + deploy → `infrastructure.md`, `docs/pita-supply-os-v1/RAILWAY_DEPLOY_RUNBOOK.md` · m2l1 roadmap → `roadmap.md` · m2l2–m2l4 change workflow → `context/changes/<id>/`, archived to `context/archive/<created>-<id>/` · m3l1 test plan → `test-plan.md` · m5l3 AI review workflow → `context/archive/2026-09-13-ci-cd-code-review/`.

`CLAUDE.md` is a symlink to `AGENTS.md` — one file, two entry points.

Workspace: `/Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS` (a separate workspace, outside `JARVIS-CODEX/`).
