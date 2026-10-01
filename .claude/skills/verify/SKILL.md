---
name: verify
description: Run full project verification — backend lint + tests and frontend build + lint. Use before committing, or to confirm a change didn't break anything. Project-specific; additive to any bundled /verify.
---

Run each check below in order and report PASS/FAIL per step. If any step fails, surface the exact failing command and its output — never claim success on a failure.

## Backend (`supply-os-v1/`)
1. `cd supply-os-v1 && ruff check .`
2. `cd supply-os-v1 && python -m pytest`   # 196 tests

## Frontend (`frontend/`)
3. `cd frontend && npm run build`   # runs `tsc -b && vite build` — also catches type errors
4. `cd frontend && npm run lint`    # ESLint

Notes:
- These commands are also recorded in `AGENTS.md` so Cursor/Codex agents can run them too; this skill is the one-keystroke trigger for Claude Code.
- This skill lives under `.claude/` (gitignored, local). If you want it to travel with the repo, un-ignore it or move the commands into a committed script.
