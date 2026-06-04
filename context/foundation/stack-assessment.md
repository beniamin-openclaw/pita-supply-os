---
project: "Pita Supply OS"
assessed_at: 2026-06-04T11:03:06Z
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: "Python 3.10+ (backend) + TypeScript (frontend)"
  framework: "FastAPI (backend) + React/Vite (frontend)"
  build_tool: "setuptools/pip (backend) + Vite (frontend)"
  test_runner: "pytest (backend) + none (frontend)"
  package_manager: "pip (backend) + npm (frontend)"
  ci_provider: "GitHub Actions (does NOT cover the product — see gaps)"
  deployment_target: "droplet via Procfile/uvicorn (backend) + Vercel (frontend)"
gates_passed: 7
gates_failed: 2
---

> Scope note: the code lives outside this workspace (the `pita-supply-os` worktree in `jarvis-codex`). Assessment is scoped to the two product folders the PRD defines — `supply-os-v1/` (backend) and `frontend/` — not the larger monorepo. Evidence citations are paths within that worktree.

## Stack Components

**Backend — `supply-os-v1/`.** A Python (≥3.10; CI runs 3.13) FastAPI service. Data access is abstracted behind a pluggable backend seam (`app/main.py:_choose_backend()`) with two implementations exposing the same function set: `app/seed_loader.py` (CSV) and `app/sheets.py` (Google Sheets via `gspread` + `google-auth`). Domain types are Pydantic v2 models (`app/models.py`); config is `pydantic-settings`. Analytics via PostHog. Packaged with setuptools (`pyproject.toml`); dependencies via `requirements.txt`. Deployed as `web: uvicorn app.main:app` (`Procfile`) on a droplet.

**Frontend — `frontend/`.** A TypeScript single-page app: React + `react-router-dom`, built with Vite, styled with Tailwind. Project-specific structure exists in `src/` (`pages/`, `apiClient.ts`, `auth.ts` + `AuthGate.tsx`, `i18n/`, `types.ts`, `ErrorBoundary.tsx`) even though Vite imposes none. Linted with ESLint + typescript-eslint. Package manager npm (`package-lock.json`). Deployed to Vercel (`vercel.json`). **No test runner** (no vitest/jest/playwright).

**Cross-cutting.** Instruction files already exist at the code root (`CLAUDE.md`, `AGENTS.md`, `.cursor/`). CI is GitHub Actions (`.github/workflows/quality-gate.yml`) — but see the gap below.

## Quality Gate Assessment

**Backend — Python / FastAPI / Pydantic**

| Component | Typed | Convention | Training data | Documented | Verdict |
|-----------|-------|------------|---------------|------------|---------|
| Language (Python) | ~ | — | — | — | pass-with-note |
| Framework (FastAPI) | — | ~ | ✓ | ✓ | pass-with-note |
| Build tool (setuptools/pip) | — | ✓ | ✓ | ✓ | pass |
| Test runner (pytest) | — | — | ✓ | ✓ | pass |

**Frontend — TypeScript / React / Vite**

| Component | Typed | Convention | Training data | Documented | Verdict |
|-----------|-------|------------|---------------|------------|---------|
| Language (TypeScript) | ✓ | — | — | — | pass-with-note |
| Framework (React + Vite) | — | ✗ | ✓ | ✓ | fail (convention) |
| Build tool (Vite) | — | ✓ | ✓ | ✓ | pass |
| Test runner (none) | — | — | ✗ | ✗ | fail (absent) |

Legend: ✓ = pass, ✗ = fail, ~ = partial/with-note, — = not applicable

### Gate Details (evidence)

**Type safety.**
- *Backend — pass with note.* FastAPI + Pydantic v2 give typed contracts at every boundary (`app/models.py`: `Order`, `OrderLine`, `Product`, etc.; `pydantic-settings` for config). This is an explicit pass case for the typed criterion. **Note:** no static type-checker is configured — no `mypy`/`pyright` in `pyproject.toml`, `requirements-dev.txt` (only `ruff`), or any config. Boundaries are typed; internal function bodies are unverified.
- *Frontend — pass with note.* End-to-end TypeScript (`tsconfig.json`, `tsconfig.app.json`, `@types/*`, `typescript-eslint`). **Note:** `strict` was not found in the tsconfig files I grepped — confirm strict mode is actually on, or typing is weaker than it looks.

**Convention.**
- *Backend — partial.* FastAPI carries moderate conventions (decorator routing, dependency injection, Pydantic validation), and the project has a clean `app/` module layout plus existing instruction files — enough to score pass-with-note, not a clean fail.
- *Frontend — fail.* Vite + React + `react-router-dom` is the canonical unopinionated case: no file-based routing, no framework-enforced folder layout. The criterion lists exactly this as a fail. A real per-project structure *does* exist in `src/` — it's just not enforced or documented for agents. This is the primary gap; compensation below.

**Popularity in training data (assessed per language family).**
- *Backend — pass.* FastAPI is top-tier mainstream in Python.
- *Frontend — pass.* React, Vite, react-router, Tailwind are all top-tier in the JS ecosystem.

**Documentation.**
- *Both — pass.* FastAPI (auto OpenAPI + guide), React, Vite, Tailwind, react-router all have current, versioned official docs.

**Test runner.**
- *Backend — pass.* pytest + pytest-mock, ~4,000 lines including `test_sheets_read.py`/`test_sheets_write.py`.
- *Frontend — fail (absent).* No runner installed; `package.json` scripts are `dev/build/lint/preview` only.

## Gaps & Compensation

**1. Frontend has no framework-enforced conventions (gate fail).** An agent generating frontend code has no layout to pattern-match against, so it will invent structure that drifts from the existing one. *Compensation:* document the real `src/` structure in the instruction files (below) so the convention lives in text even though the framework doesn't carry it.

**2. Backend internals aren't statically type-checked (pass-with-note).** Pydantic protects boundaries, but refactors inside `app/` can introduce type errors no tool catches. *Compensation:* a typing convention rule now; add `mypy`/`pyright` to dev deps + CI when convenient.

**3. Frontend TypeScript `strict` unconfirmed.** If strict mode is off, the typed gate is softer than the matrix implies. *Compensation:* verify/enable `strict` in `tsconfig.app.json`.

**4. The product is not covered by CI (maintenance gap).** `.github/workflows/quality-gate.yml` runs `scripts/quality_gate.sh`, which unit-tests **sibling monorepo tooling** (telegram agent, warsaw catalog, repo-contract validators) and `py_compile`s unrelated scripts — it does **not** run `supply-os-v1` pytest, ruff on `supply-os-v1`, or any frontend check. The strong backend suite and the frontend only run locally / on prod smoke (TesterArmy), not in CI. *Compensation:* add product-scoped CI jobs (below). This is mostly **`/10x-health-check` territory** — flagged here, resolved there.

**5. Lint coverage is thin.** Root `ruff.toml` selects only error-level rules (`E9,F63,F7,F82`). *Compensation:* widen the ruleset for `supply-os-v1`.

### Recommended Instruction File Additions

Ready to paste into the code root's `CLAUDE.md` / `AGENTS.md`.

```markdown
## Frontend conventions (frontend/ — Vite + React + react-router; no framework-enforced layout)

- Entry: `src/main.tsx` mounts `src/App.tsx`; routes are declared with react-router in `App.tsx`.
- One page component per route in `src/pages/` (`CaptainPage.tsx`, `ManagerPage.tsx`, `DebugPage.tsx`); sub-flows in `src/pages/manager/`, `src/pages/captain-mp/`.
- All API calls go through `src/apiClient.ts` — never call `fetch` directly from a component.
- Auth: token gate in `src/auth.ts` + `src/AuthGate.tsx`. Shared types in `src/types.ts`.
- All user-facing copy goes through `src/i18n/` — no hardcoded strings in components.
- Wrap route trees in `src/ErrorBoundary.tsx`.
- Naming: component files PascalCase; hooks/utilities camelCase.
```

```markdown
## Backend typing (supply-os-v1/ — FastAPI + Pydantic, no static type-checker)

- Every endpoint and data-layer boundary uses Pydantic models (see `app/models.py`); accept/return models, never raw dicts.
- Add type annotations at every function boundary in `app/`.
- Treat boundary types as the contract until `mypy`/`pyright` is wired into dev deps + CI.
```

```markdown
## Backend data layer (supply-os-v1/app/)

- All persistence goes through the backend module returned by `_choose_backend()` in `app/main.py` — `seed_loader` (CSV) or `sheets` (Google Sheets). Both expose the same functions (`load_*`, `append_order`, `update_order_lines`, `get_order`, `delete_order_lines`, …).
- A new backend (e.g. Postgres/Supabase) MUST implement the same signatures and be registered in `_choose_backend()`. Routes never import a backend module directly.
- Catch data-layer errors by their shared names (`OrderAlreadyDispatchedError`, `ConfigDriftError`, `OrderNotFoundError`) at the route layer — do not couple routes to one backend.
```

```markdown
## Quality gates to add (maintenance — mostly health-check follow-up)

- Widen ruff for supply-os-v1: `select = ["E","F","I","UP","B"]` (currently error-level only).
- CI (`.github/workflows/quality-gate.yml`) does NOT cover the product. Add jobs: (a) pytest for supply-os-v1, (b) ruff for supply-os-v1, (c) frontend `tsc --noEmit` + eslint + build, (d) a frontend test runner (vitest).
- Verify TypeScript `strict` is enabled in `frontend/tsconfig.app.json`.
```

## Summary

**Overall: ready-with-compensation.** Both halves of the stack are mainstream, well-documented, and (at their boundaries) typed — an agent already knows FastAPI/Pydantic and React/Vite/Tailwind idioms cold, so most code generation will land close to convention. Nothing here argues for changing the stack.

**Strengths:** boundary type safety via Pydantic and TypeScript; top-tier training-data familiarity across the whole stack; excellent official docs; a clean, pluggable backend data seam; existing `CLAUDE.md`/`AGENTS.md` to host conventions; a strong backend test suite.

**Gaps (all compensable, none stack-changing):** the frontend's framework imposes no conventions (document the real `src/` layout — the single highest-value fix); backend internals aren't statically type-checked; the frontend has no test runner and unconfirmed `strict` mode; and — most consequential for maintenance — **the product code is not covered by CI** (the existing gate tests sibling tooling instead).

**Note on the datastore question (out of scope for this skill):** this assessment deliberately does not evaluate Google Sheets vs Supabase — agent-friendliness scoring never recommends replacing a component. That decision lives in the separate datastore analysis (keep Sheets for the pilot; migrate to Supabase as the rollout enabler, behind the existing `_choose_backend()` seam).

**Next step:** `/10x-health-check` — it consumes this file to focus on the gaps flagged above, especially the missing product CI coverage and the absent frontend tests.
