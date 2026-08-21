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
- Backend (`supply-os-v1/`): test `python -m pytest` (453 tests, plus 16 integration tests run via `pytest -m integration` against a real Postgres) · run `uvicorn app.main:app` · lint `ruff check .`
- Frontend (`frontend/`): `npm install`, then `npm run dev | build | lint`
- Verify before committing: `/verify` (Claude Code skill) or run the four checks above. A `PostToolUse` hook auto-runs `ruff check --fix` (`.py`) / `eslint --fix` (`frontend/`) on edits.

## Local setup & gotchas
- **Local dev needs no Google credentials**: set `SUPPLY_OS_DATA_BACKEND=seed` to read CSVs from `SUPPLY_OS_SEED_DIR` (default `../docs/pita-supply-os-v1/seed`). The `sheet` backend additionally needs `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON` (inline or file path) + `SUPPLY_OS_GOOGLE_SHEET_ID`.
- **The seed CSVs are a curated test fixture, NOT a production mirror** — nothing syncs them to prod and they diverge in both directions (see @docs/pita-supply-os-v1/seed/README.md). A green backend suite proves behavior against the fixture, never against production master data; verify prod claims with a prod query. Write tests that assert on behavior, not on facts about the real business.
- **API URL is env-driven — don't hardcode it.** Dev sets `VITE_API_URL=http://localhost:8901`; in prod `apiClient` uses `BASE_URL=""` and Vercel rewrites `/api/*` to the Railway backend (see @frontend/vercel.json).
- **Auth:** `SUPPLY_OS_CAPTAIN_TOKENS` (LOCATION:token pairs) + `SUPPLY_OS_MANAGER_TOKEN`; empty disables auth (dev only). Copy each app's `.env.example` → `.env`.

## Conventions & deploy
- **Solo repo — no enforced commit/branch/PR convention; don't impose one.**
- **Deploy is wired up from `main`** — backend on Railway (auto-deploy on push to `main`; @supply-os-v1/Procfile), frontend on Vercel, which rewrites `/api/*` to the Railway service (@frontend/vercel.json). A push to `main` ships to production; branch first if that is not what you want. Runbook: @docs/pita-supply-os-v1/RAILWAY_DEPLOY_RUNBOOK.md.
- **CI runs on push + PR** (@.github/workflows/ci.yml): backend `ruff` + `pytest`, a real-Postgres integration job (`pytest -m integration`), and frontend build + lint + vitest. Still run `/verify` before committing — CI is a backstop, not a substitute.
- Style differs from defaults: ruff `line-length = 100` (not 88); TS `strict` is **off** in `frontend/tsconfig.app.json` — annotate function params, return types, and component props explicitly; don't rely on inferred `any`.
- Frontend tests: Vitest + @testing-library/react + jsdom (`npm run test` → 89 tests / 10 files), covering pure helpers and some component rendering. No E2E harness.
- Other known gaps: backend has no lockfile. Detail + fixes: @context/foundation/health-check.md.

## Tooling & vendors
The user holds paid premium subscriptions on the platforms in @docs/tooling.md — informational only; no tool or host preference is set yet (decisions pending).

## Agent tooling
- `CLAUDE.md` is a **symlink to this file** — single source of truth, so Claude Code, Cursor, and Codex all read the same rules.
- After any `10x get`, keep the link intact: run `10x get --no-course-rules`, or re-link with `ln -sf AGENTS.md CLAUDE.md`.
- Per-area refinements live next to their code (`supply-os-v1/AGENTS.md`, `frontend/AGENTS.md`); this root file is the whole-project guide.
