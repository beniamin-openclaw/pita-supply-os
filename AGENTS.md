# Repository Guidelines

Pita Supply OS — internal supplier ordering: a location Captain submits stock-based orders; a Manager reviews and dispatches them to suppliers. Polyglot — Python/FastAPI backend in `supply-os-v1/`, TypeScript/React (Vite) frontend in `frontend/`. Brownfield, built through the 10xDevs course: see @10xdevs.md for course context and @context/foundation/prd.md for the product spec.

## Hard rules
- Never place a real supplier order from a test. Submit/dispatch tests back out or use safe test data.
- Backend persistence goes only through `_choose_backend()` (`seed` CSV | `sheet` legacy | `supabase` Postgres — production since 2026-06-16). A new backend implements the same function set and registers there — see @supply-os-v1/AGENTS.md.
- Frontend: API calls only via `src/apiClient.ts`; user-facing copy only via `src/i18n/` — see @frontend/AGENTS.md.
- Never commit secrets (`.env`, `sa.json`, keys) — only `.env.example`.

## Project structure
- `supply-os-v1/` — FastAPI + Pydantic backend (data-layer seam, suggestion engine, two-token auth). Local rules: @supply-os-v1/AGENTS.md
- `frontend/` — React + Vite + Tailwind SPA (Captain & Manager screens). Local rules: @frontend/AGENTS.md
- `context/foundation/` — product docs: @context/foundation/prd.md, @context/foundation/roadmap.md (canonical status), @context/foundation/test-plan.md (risk → test map), infrastructure, stack-assessment, health-check, @context/foundation/lessons.md (standing rules). Work happens in `context/changes/<id>/` and is closed into `context/archive/` with `/10x-archive`.
- `docs/pita-supply-os-v1/` — product docs incl. `RESUME_STATE`.

## Build, test, run
- Backend (`supply-os-v1/`): test `python -m pytest` (668 tests; `pytest -m integration` runs 21 more on a real Postgres) · run `uvicorn app.main:app` · lint `ruff check .`
- Frontend (`frontend/`): `npm install`, then `npm run dev | build | lint | test` (Vitest, 365 tests)
- Verify before committing: `/verify` (Claude Code skill) or run the four checks above. A `PostToolUse` hook auto-runs `ruff check --fix` (`.py`) / `eslint --fix` (`frontend/`) on edits.

## Local setup & gotchas
- **Local dev needs no Google credentials**: set `SUPPLY_OS_DATA_BACKEND=seed` to read CSVs from `SUPPLY_OS_SEED_DIR` (default `../docs/pita-supply-os-v1/seed`). The `sheet` backend additionally needs `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON` (inline or file path) + `SUPPLY_OS_GOOGLE_SHEET_ID`.
- **API URL is env-driven — don't hardcode it.** Dev sets `VITE_API_URL=http://localhost:<backend port>` (8901 in `frontend/.env.example`; the README walkthrough uses 8931); in prod `apiClient` uses `BASE_URL=""` and Vercel rewrites `/api/*` to the Railway backend (see @frontend/vercel.json).
- **Auth:** `SUPPLY_OS_CAPTAIN_TOKENS` (LOCATION:token pairs) + `SUPPLY_OS_MANAGER_TOKEN`; empty disables auth (dev only). Copy each app's `.env.example` → `.env`.

## Conventions & deploy
- **Solo repo — no enforced commit/branch/PR convention; don't impose one.**
- **Deploy:** `main` auto-deploys — backend to Railway (`supply-os-v1/railway.toml`, healthcheck `/health`; runbook @docs/pita-supply-os-v1/RAILWAY_DEPLOY_RUNBOOK.md), frontend to Vercel. DB migrations in `supply-os-v1/migrations/` are applied by the operator **before** the code that needs them; never assume "merged" means "live" (lessons.md).
- **CI** (`.github/workflows/ci.yml`) runs on every push/PR: backend ruff + pytest, backend integration on Postgres 16, frontend build + lint + vitest. Still run `/verify` before committing.
- Style differs from defaults: ruff `line-length = 100` (not 88); TS `strict` is **off** in `frontend/tsconfig.app.json` — annotate function params, return types, and component props explicitly; don't rely on inferred `any`.
- Known gaps on `main`: backend has no lockfile and no type-checker; TS `strict` is off. All three are implemented on PR #27 (H-01), unmerged. Detail: @context/foundation/health-check.md.

## Tooling & vendors
Hosting is decided: Railway (backend), Vercel (frontend), Supabase (Postgres + Storage) — rationale and triggers in @context/foundation/infrastructure.md. @docs/tooling.md lists the paid platforms available to the operator (informational).

## Agent tooling
- `CLAUDE.md` is a **symlink to this file** — single source of truth, so Claude Code, Cursor, and Codex all read the same rules.
- After any `10x get`, keep the link intact: run `10x get --no-course-rules`, or re-link with `ln -sf AGENTS.md CLAUDE.md`.
- Per-area refinements live next to their code (`supply-os-v1/AGENTS.md`, `frontend/AGENTS.md`); this root file is the whole-project guide.
