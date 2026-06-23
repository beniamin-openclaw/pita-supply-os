<!-- PLAN-REVIEW-REPORT -->
# Plan Review: H-01 Quality Hardening (parallel-safe subset)

- **Plan**: `context/changes/h-01-quality-hardening/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-23
- **Verdict**: REVISE → SOUND (all findings fixed)
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING → fixed |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING → fixed |
| Plan Completeness | WARNING → fixed |

## Grounding

5/5 paths ✓ (pyproject.toml, requirements.txt, ci.yml, AGENTS.md, CLAUDE.md→AGENTS.md symlink) ·
"backend has no lockfile" at AGENTS.md:32 ✓ · ci.yml install lines @27/67 (`pip install -e ".[dev]"`,
`cache: pip`) ✓ · railway.toml uses RAILPACK auto-detect → pinning requirements.txt is transparent to
deploy ✓ · only docs/archive reference requirements.txt, no tooling ✓ · `app.main:13` imports
`supabase_backend` → `sqlalchemy` at module level (`supabase_backend.py:43`); psycopg2 is lazy ·
brief↔plan consistent ✓

## Findings

### F1 — "Prove CI green" relies on a local proxy, not a real CI run

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 (success criteria 2.2/2.6), DoD
- **Detail**: DoD is "CI gate green and PROVEN that it runs." Phase 2 proved it via local command runs + an `ci.yml` read-through and deferred the actual Actions confirmation vaguely to "owner push". Local runs don't exercise the Actions runner, pip cache keys, or the Postgres service job. The true proof is a real workflow run — `on: push:` fires for ANY branch, so pushing the feature branch (`claude/jolly-mestorf-a20182`) gets it without touching `main` (the only gated target).
- **Fix**: Made the proof mechanism explicit — local runs are the pre-push gate; the DoD evidence is a permission-gated feature-branch push that turns Actions green (capture run URL), never `main`. Updated the Phase 2 manual bullet, Implementation Note, and Progress 2.6.
- **Decision**: FIXED

### F2 — Lock/CI target Python (3.12) ≠ local verification Python (3.14)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details + Phase 1/2 verification commands
- **Detail**: Plan said generate locks on 3.12 but ran verification on Homebrew 3.14, and drift-guard determinism depends on more than Python version: pip-compile stamps an autogen header (exact command + Python) and orders output deterministically only given the same pip-tools version + identical invocation. A 3.14 lock or differing command makes the CI drift `git diff` fail on a no-op.
- **Fix**: Designated ONE Python 3.12 venv as canonical for both lock-gen and local backend verification (`python -m ruff/pytest`), with Homebrew 3.14 as a test-only fallback (never for lock-gen). Added a Critical Implementation Detail requiring the exact `pip-compile` invocation (pinned pip-tools, same flags) be documented in root AGENTS.md so CI mirrors it byte-for-byte. Updated Phase 1.3 and Phase 2.1 commands.
- **Decision**: FIXED

### F3 — Phase 4 (deferred) has an Automated bullet with no Progress entry

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — Success Criteria / Automated; ## Progress
- **Detail**: Phase 4's `#### Automated Verification:` carried a `- (Deferred) Not run…` bullet with no matching Progress entry (Progress → Phase 4 lists only Manual 4.1), violating the mechanical Progress↔Phase contract (strict reading: CRITICAL for parsing). Low real risk — Phase 4 doesn't execute and Progress is well-formed — but a loose end.
- **Fix**: Converted Phase 4's "no automated verification" to a prose line (dropped the `- ` bullet), so the deferred phase is Manual-only and the Progress contract is clean.
- **Decision**: FIXED
