# Repository Guidelines

Pita Supply OS — internal supplier ordering: a location Captain submits stock-based orders; a Manager reviews and dispatches them to suppliers. Polyglot — Python/FastAPI backend in `supply-os-v1/`, TypeScript/React (Vite) frontend in `frontend/`. Brownfield, built through the 10xDevs course: see @10xdevs.md for course context and @context/foundation/prd.md for the product spec.

## Hard rules
- Never place a real supplier order from a test. Submit/dispatch tests back out or use safe test data.
- Backend persistence goes only through `_choose_backend()` (`seed` | `sheets`). A new backend (e.g. Supabase/Postgres) implements the same function set and registers there — see @supply-os-v1/AGENTS.md.
- Frontend: API calls only via `src/apiClient.ts`; user-facing copy only via `src/i18n/` — see @frontend/AGENTS.md.
- Never commit secrets (`.env`, `sa.json`, keys) — only `.env.example`.

## Project structure
- `supply-os-v1/` — FastAPI + Pydantic backend (data-layer seam, suggestion engine, two-token auth). Local rules: @supply-os-v1/AGENTS.md
- `frontend/` — React + Vite + Tailwind SPA (Captain & Manager screens). Local rules: @frontend/AGENTS.md
- `context/foundation/` — product docs: @context/foundation/prd.md plus shape-notes, stack-assessment, health-check.
- `docs/pita-supply-os-v1/` — product docs incl. `RESUME_STATE`.

## Build, test, run
- Backend (`supply-os-v1/`): test `python -m pytest` (196 tests) · run `uvicorn app.main:app` · lint `ruff check .`
- Frontend (`frontend/`): `npm install`, then `npm run dev | build | lint`
- Verify before committing: `/verify` (Claude Code skill) or run the four checks above. A `PostToolUse` hook auto-runs `ruff check --fix` (`.py`) / `eslint --fix` (`frontend/`) on edits.

## Local setup & gotchas
- **Local dev needs no Google credentials**: set `SUPPLY_OS_DATA_BACKEND=seed` to read CSVs from `SUPPLY_OS_SEED_DIR` (default `../docs/pita-supply-os-v1/seed`). The `sheet` backend additionally needs `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON` (inline or file path) + `SUPPLY_OS_GOOGLE_SHEET_ID`.
- **API URL is env-driven — don't hardcode it.** Dev sets `VITE_API_URL=http://localhost:8901`; in prod `apiClient` uses `BASE_URL=""` and Vercel rewrites `/api/*` to the droplet (see @frontend/vercel.json).
- **Auth:** `SUPPLY_OS_CAPTAIN_TOKENS` (LOCATION:token pairs) + `SUPPLY_OS_MANAGER_TOKEN`; empty disables auth (dev only). Copy each app's `.env.example` → `.env`.

## Conventions & deploy
- **Solo repo — no enforced commit/branch/PR convention; don't impose one.**
- **Deploy from this repo is NOT wired up yet (migration in progress)** — don't assume `push` auto-deploys; re-pointing Vercel/droplet is a pending step.
- **No CI yet** — `push` runs no tests; run `/verify` before committing.
- Style differs from defaults: ruff `line-length = 100` (not 88); TS `strict` is **off** in `frontend/tsconfig.app.json` — annotate function params, return types, and component props explicitly; don't rely on inferred `any`.
- Other known gaps: frontend has no test runner; backend has no lockfile. Detail + fixes: @context/foundation/health-check.md.

## Agent tooling
- `CLAUDE.md` is a **symlink to this file** — single source of truth, so Claude Code, Cursor, and Codex all read the same rules.
- After any `10x get`, keep the link intact: run `10x get --no-course-rules`, or re-link with `ln -sf AGENTS.md CLAUDE.md`.
- Per-area refinements live next to their code (`supply-os-v1/AGENTS.md`, `frontend/AGENTS.md`); this root file is the whole-project guide.
