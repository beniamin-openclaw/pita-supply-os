---
project: "Pita Supply OS"
checked_at: 2026-06-04T12:09:46Z
health_status: needs-attention
context_type: brownfield
language_family: multi
stack_assessment_available: true
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 0
  moderate: 0
  low: 0
test_runner_detected: true
ci_provider: GitHub Actions
recommended_fixes: 8
---

> Scope note: code lives outside this workspace (the `pita-supply-os` worktree in `jarvis-codex`). Checks ran against the two product folders the PRD defines — `supply-os-v1/` (Python backend) and `frontend/` (TypeScript SPA). Companion artifact: `context/foundation/stack-assessment.md`.

## Dependency Health

### Lockfile

```
Status (frontend): present (package-lock.json)
Status (backend):  missing — deps declared in supply-os-v1/pyproject.toml, no poetry.lock / uv.lock / pip-tools lock
Package manager:   npm (frontend) + pip (backend)
```

The frontend is reproducibly pinned. The backend product folder has **no true lockfile** — `pyproject.toml` declares ranges (`fastapi>=0.110`, …) and the repo-root `requirements.txt` is the monorepo's, not the product's. Builds are not byte-reproducible and an agent can't reason about exact installed versions. Fix inline below (Category A).

### Security Audit

```
Frontend tool: npm audit
Summary:       0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW  (clean; registry reachable, so this is a real result)
Direct vs transitive: not distinguished (no findings)

Backend tool: pip-audit 2.10.0 (run in an isolated venv against supply-os-v1's 12 declared deps)
Summary:      0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW — "No known vulnerabilities found"
Caveat:       audited deps resolved to LATEST (no lockfile pins versions) — i.e. "what a fresh install gets today", not specific deployed pins
```

Both halves are clean — no known vulnerabilities. The backend scan covered all 12 declared dependencies (runtime + dev: fastapi, uvicorn, pydantic, pydantic-settings, python-dotenv, gspread, google-auth, posthog, pytest, pytest-mock, ruff, httpx) and their transitive tree.

### Outdated Dependencies

```
Frontend packages with major version gaps: none detected
Backend: not enumerated (no lockfile / pip not resolved in this env)
```

No major frontend version gaps surfaced. Backend staleness wasn't enumerable without a resolved environment — re-check when adding the lockfile.

## Test Suite

```
Test runner (backend):  pytest
Tests found:            196 (collected in 0.73s)
Test execution:         collection passing
Configuration:          supply-os-v1/pyproject.toml ([project.optional-dependencies] dev → pytest, pytest-mock)

Test runner (frontend): not detected
```

The backend test infrastructure is **healthy** — 196 tests collect cleanly, including the Sheets read/write suites. This is the project's strongest agent-readiness signal: an agent can verify backend changes.

```
⚠ No test runner detected for the frontend. The agent cannot verify its own UI changes.
Recommended: cd frontend && npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom
             then add "test": "vitest" to package.json scripts.
```

## CI/CD

```
Provider:      GitHub Actions
Configuration: .github/workflows/quality-gate.yml  →  scripts/quality_gate.sh
```

Stage coverage **for the product** (`supply-os-v1/` + `frontend/`):

| Stage      | Status | Notes                                                                                  |
|------------|--------|----------------------------------------------------------------------------------------|
| Lint       | ✗      | `quality_gate.sh` runs ruff, but over sibling monorepo tooling — not supply-os-v1/frontend |
| Test       | ✗      | runs `unittest` for sibling tools (telegram agent, warsaw catalog, validators); not the 196 product tests, not the frontend |
| Build      | ✗      | no frontend build/compile step                                                          |
| Type check | ✗      | no mypy/pyright (backend) and no `tsc --noEmit` (frontend)                               |
| Security   | ✗      | no audit/scan step                                                                      |

ℹ A CI pipeline exists, but it covers **sibling tooling, not this product** — so the green check gives false assurance about Supply OS. Extending it is the highest-leverage maintenance fix (Category A below); broader CI/CD maturity is the infrastructure lesson's job (Category B).

## Configuration

### High severity

- **`frontend/tsconfig.app.json` — `strict` is not enabled** (only `noUnusedLocals`/`noUnusedParameters` are set). Without `strict`, TypeScript's safety is much weaker and an agent generates less reliable types. Fix: add `"strict": true` to `compilerOptions`.

### Medium severity

- **No frontend formatter** (Prettier/Biome) — ESLint is present but isn't an autoformatter, so agent output style will drift. Fix: `npm i -D prettier` + a `.prettierrc` (or adopt Biome).

### Low severity

- **`.editorconfig` missing** at the code root — minor cross-editor consistency gap. Fix: add a small `.editorconfig`.

Present and good: `.gitignore`, `.env.example` (both backend and root), `eslint.config.js`, and `CLAUDE.md` + `AGENTS.md`.

## Stack Assessment Cross-Reference

```
Stack assessment: context/foundation/stack-assessment.md
Agent readiness (from stack-assess): ready-with-compensation
```

| Quality Gate Gap (stack-assess)           | Health-Check Finding                                                  | Status     |
|-------------------------------------------|-----------------------------------------------------------------------|------------|
| Frontend convention: fail                 | `CLAUDE.md`/`AGENTS.md` exist but do **not** yet contain the recommended frontend-structure conventions | Reinforced |
| Frontend `strict` unconfirmed             | `tsconfig.app.json` has **no `strict`** — confirmed off                | Reinforced |
| Backend internals untyped (no mypy)       | No type-check stage in CI                                              | Reinforced |
| Frontend no test runner                   | Confirmed — no vitest/jest/playwright                                  | Reinforced |
| Product not covered by CI                 | Confirmed — CI tests sibling tooling, not the product                 | Reinforced |
| Thin ruff ruleset                         | Confirmed (`E9,F63,F7,F82` only)                                       | Reinforced |

Net: health-check **reinforces every gap** stack-assess flagged, and adds two of its own (no backend lockfile; missing frontend formatter). The good news — the stack-assess compensation blocks are written and ready to paste; they just haven't landed in the code's instruction files yet (that's agent onboarding's job).

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Keep dependency auditing ongoing  ✓ initial scan done (clean)
**Impact**: the one-time scan found zero vulnerabilities, but new advisories land continuously — make it repeatable rather than a one-off.
**Severity**: low (initial scan clean) · **Effort**: quick (< 5 min)
**Fix**: add `pip-audit` to `requirements-dev.txt` + a CI step (and keep `npm audit` for the frontend) so every PR re-checks. Ad-hoc: `pipx install pip-audit && cd supply-os-v1 && pip-audit`.

### 2. Add a frontend test runner
**Impact**: an agent cannot verify its own UI changes without tests — the biggest single agent-readiness gap on the frontend.
**Severity**: high · **Effort**: moderate (15–30 min)
**Fix**:
```
cd frontend
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom
# add to package.json scripts:  "test": "vitest"
```

### 3. Add a backend lockfile
**Impact**: non-reproducible installs; the agent can't reason about exact dependency state.
**Severity**: high · **Effort**: moderate (15–30 min)
**Fix**: adopt `uv` (`uv lock` in `supply-os-v1/`) or pip-tools (`pip-compile pyproject.toml -o requirements.lock`). Commit the lockfile.

### 4. Enable TypeScript strict mode
**Impact**: weak typing undercuts the frontend's main agent-friendliness advantage.
**Severity**: high · **Effort**: quick (< 5 min)
**Fix**: add `"strict": true` to `compilerOptions` in `frontend/tsconfig.app.json` (then fix the errors it surfaces).

### 5. Extend CI to cover the product
**Impact**: the existing green check tests sibling tooling, not Supply OS — it gives false confidence. Wiring the real product into CI turns the strong local test suite into an enforced gate.
**Severity**: high · **Effort**: significant (> 1 hour)
**Fix**: add jobs to (or alongside) `.github/workflows/quality-gate.yml`: (a) `pytest` in `supply-os-v1/`, (b) `ruff check supply-os-v1/`, (c) frontend `tsc --noEmit && npm run lint && npm run build`, (d) frontend `vitest` once #2 lands.

### 6. Widen the backend lint ruleset
**Impact**: current ruff config catches only syntax-level errors; agent style/imports go unchecked.
**Severity**: medium · **Effort**: quick (< 5 min)
**Fix**: in `supply-os-v1`'s ruff config, `select = ["E","F","I","UP","B"]`.

### 7. Add a frontend formatter
**Impact**: without an autoformatter, agent-generated UI code drifts in style.
**Severity**: medium · **Effort**: moderate (15–30 min)
**Fix**: `cd frontend && npm i -D prettier` + a `.prettierrc`, or adopt Biome for lint+format in one.

### 8. Add `.editorconfig`
**Impact**: minor cross-editor consistency.
**Severity**: low · **Effort**: quick (< 5 min)
**Fix**: add a root `.editorconfig` (indent, charset, final-newline).

### Addressed in upcoming lessons (Category B)

### Enrich the agent instruction files
**Lesson**: [Agent Onboarding: AGENTS.md, AI Rules i feedback loops (M1L4)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l4)
**What you'll do there**: `CLAUDE.md`/`AGENTS.md` already exist but don't yet carry the stack-assess compensation blocks (frontend structure, backend typing, data-layer seam). Agent onboarding walks you through building these with the right content — paste those blocks then, rather than stubbing now.

### Mature the CI/CD pipeline & deployment
**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: beyond fix #5's product coverage, the infrastructure lesson covers full pipeline shape, environment/secrets handling, and deploy — the right place to harden the droplet + Vercel split.

## Summary

```
Health status: needs-attention
```

The product is fundamentally sound for agent-assisted work: a mainstream, well-documented stack; clean frontend dependencies; and a genuinely healthy backend test suite (196 tests collecting in under a second). The gaps are all addressable and none are emergencies — the standouts are that **CI tests sibling tooling instead of the product** (false-green), the **frontend has no tests** and **`strict` is off**, and the **backend has no lockfile**. Dependency security is clean on both halves — frontend `npm audit` and backend `pip-audit` both found zero vulnerabilities.

Next step: knock out the Category A high-severity fixes — extend CI to the product (#5), add frontend tests (#2), enable TS strict (#4), and add a backend lockfile (#3) — then proceed to **agent onboarding (M1L4)**, where you'll fold the stack-assess compensation blocks into `CLAUDE.md`/`AGENTS.md`.
