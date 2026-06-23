<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: H-01 Quality Hardening (parallel-safe subset)

- **Plan**: `context/changes/h-01-quality-hardening/plan.md`
- **Scope**: Phases 1–3 of 4 (Phase 4 is deferred / not executed)
- **Date**: 2026-06-23
- **Verdict**: NEEDS ATTENTION → APPROVED (3 warnings fixed; 2 observations accepted; real-CI green @7594611)
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING (benign, disclosed extras) |
| Safety & Quality | WARNING → fixed |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (2.6 push + 4.1 deferred pending) |

## Scope (git)

Branch diff vs common ancestor `83432c9`: 9 files — `.github/workflows/ci.yml`, `AGENTS.md`,
`supply-os-v1/pyproject.toml`, `supply-os-v1/requirements.txt`, `supply-os-v1/requirements-dev.txt`,
+ 4 change-folder docs. **Zero files under `supply-os-v1/app/`, `supply-os-v1/tests/`, or
`frontend/src/`** — the parallel-safe boundary held. Commits: `0f287e9` (p1), `4e7bc1e` (p2),
`8f81348` (p3).

## Success criteria (re-verified live, locked venv = CI fidelity)

- Backend: `ruff check .` exit 0 (ruff 0.15.18, the locked CI version); `pytest` 391 passed / 16 deselected.
- Frontend: `npm ci && npm run build && npm run lint && npm run test` all exit 0 (vitest 57 passed).
- Lockfile-drift: recompile on Python 3.12 with pinned pip-tools 7.5.3 → empty `git diff` (no-op).
- `ci.yml` valid YAML, 4 jobs (`backend`, `backend-integration`, `frontend`, `lockfile-drift`); no `-e ".[dev]"` remains.
- Locks fully pinned (58 runtime / 68 dev `==`); secrets audit clean.
- Manual: **2.6** satisfied — feature-branch push; real-CI run `28057653402` green @`7594611` (after fixing F5); **4.1** confirmed (Phase 4 deferred, gating merge named).

## Findings

### F1 — lockfile-drift: committed header flag-order differs from the CI invocation order

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: `.github/workflows/ci.yml` (lockfile-drift "Recompile locks" step)
- **Detail**: The committed lock headers record flags in pip-compile's normalized alphabetical
  order (`--output-file … --strip-extras`); the CI step invokes `--strip-extras --output-file …`.
  pip-compile normalizes the recorded header (alphabetical long-opts, `--extra=dev`), so the
  recompiled header is byte-identical and the guard does NOT false-positive — proven locally
  (recompile → no diff). The risk is only future-dev confusion.
- **Fix**: Added a comment to the CI step noting pip-compile normalizes flag order, so only the
  flag SET + pinned pip-tools + Python version matter for a byte-stable diff.
- **Decision**: FIXED

### F2 — `ISC` selected without ignoring `ISC001` (conflicts with `ruff format`, Phase 4)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability / forward-compat)
- **Location**: `supply-os-v1/pyproject.toml` `[tool.ruff.lint].select`
- **Detail**: `ISC001` (single-line implicit string concat) is a documented conflict with
  `ruff format`. The config is clean today (0 ISC001 violations, formatter not run), but Phase 4's
  `ruff format` adoption would hit spurious failures unless ISC001 is ignored.
- **Fix**: Added `"ISC001"` to `ignore` now with a Phase-4 note; `ISC002`/`ISC003` stay active and
  pass clean. Phase 4 now needs no config surgery for this.
- **Decision**: FIXED

### F3 — plan's Phase 1 example commands omit `--strip-extras`

- **Severity**: 🟢 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: `plan.md` Phase 1 §2 contract
- **Detail**: The plan's example `pip-compile` lines don't show `--strip-extras`, but the actual
  implementation, AGENTS.md regen doc, CI drift job, and committed headers all use it consistently.
  The plan's Critical Implementation Detail F2 anticipated "same flags, e.g. any `--strip-extras`".
  AGENTS.md is the authoritative live regen procedure and is correct.
- **Decision**: ACCEPTED (no action — don't retro-edit the frozen plan block; the live doc is correct)

### F4 — unplanned (EXTRA) doc-truthfulness edits

- **Severity**: 🟢 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Scope Discipline
- **Location**: `AGENTS.md` ("No CI yet" line; dropped stale "frontend has no test runner"), `ci.yml` header comment
- **Detail**: Beyond the literal plan, the implementation corrected stale doc claims directly tied
  to each phase's subject (Phase 2 = CI, so "No CI yet" was false; the known-gaps sentence being
  rewritten for the lockfile also contained the stale FE-test-runner clause). Disclosed at implement
  time. Tooling/doc only, no product code, no demo-blocker files.
- **Decision**: ACCEPTED (within phase intent; improves doc truthfulness)

### F5 — lockfiles generated on macOS arm64 omitted a Linux-only dep (`greenlet`)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (reproducibility / data-safety)
- **Location**: `supply-os-v1/requirements.txt`, `supply-os-v1/requirements-dev.txt`
- **Detail**: Caught by the real-CI proof (2.6), NOT by any local check. The locks were generated on
  macOS arm64, whose `platform_machine == "arm64"` is excluded from SQLAlchemy's `greenlet` marker
  (which covers `x86_64 / aarch64 / amd64 / win32`). CI + Railway are Linux x86_64 where `greenlet`
  IS required, so the committed lock was missing it — a non-reproducible lock the Linux
  `lockfile-drift` job flagged. Local recompiles all agreed (same host), so local proof was
  structurally blind to this. Vindicates plan-review F1 (real-CI = the DoD evidence) and F2 (determinism).
- **Fix**: Added `greenlet==3.5.2` (via sqlalchemy) to both locks — the Linux resolution; the CI drift
  job now recompiles byte-identical = green. Rewrote the AGENTS.md regen procedure to mandate Linux
  x86_64 generation (`docker --platform linux/amd64 python:3.12`), never macOS. Recorded as a lesson
  ("pip-compile locks are platform-specific"). Commit `7594611`; CI run `28057653402` green.
- **Decision**: FIXED
