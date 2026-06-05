# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Verify CI actually runs the product's tests

- **Context**: Judging "is this tested / safe to change?" on any brownfield or monorepo project.
- **Problem**: This repo's `quality-gate.yml` ran sibling monorepo tooling (telegram agent, validators), not `supply-os-v1`/`frontend` — a green check implied product coverage that didn't exist.
- **Rule**: Before trusting a green CI/test signal, read the workflow and confirm the gate actually runs the product's tests. Never assume green = covered.
- **Applies to**: research, plan-review, impl-review

## Never bypass the data-layer seam

- **Context**: Any backend persistence change in `supply-os-v1/` (including the Sheets→Supabase migration).
- **Problem**: Routes that import a backend module directly break the seed/sheets/Supabase swap and the concurrency guarantees built into the seam.
- **Rule**: All persistence goes through `_choose_backend()`; a new backend implements the same function set and registers there — never import a backend module from a route.
- **Applies to**: plan, implement, impl-review

## Hard-audit for secrets when copying code between repos

- **Context**: Any migration or copy of code out of a monorepo into a new repo.
- **Problem**: `sa.json` / `.env` and other secrets can ride along silently into a new repo or its git history.
- **Rule**: When copying code between repos, exclude secrets up front AND hard-audit the staging area (e.g. `git add -n | grep -iE 'secret|\.env$|sa\.json'`) before the first commit.
- **Applies to**: implement

## Roadmap is the source of truth; external trackers are a generated mirror

- **Context**: Exporting or syncing the roadmap/backlog to an external tracker (GitHub Issues, Linear, etc.), or whenever a slice's status changes.
- **Problem**: We exported `roadmap.md` → GitHub Issues ad-hoc; without a rule the two drift (e.g. S-06 was implemented but issue #3 still read "ready"), and an external tracker gets hand-edited as if it were the source.
- **Rule**: `context/foundation/roadmap.md` (+ the per-change `plan.md ## Progress`) is the canonical source of truth for slice status and progress; external trackers are a generated mirror — regenerate/sync from the roadmap on status changes, never hand-edit the mirror as the source. `/10x-archive` is the authority that flips a slice to `done`.
- **Applies to**: plan, implement, impl-review

## Keep skill-managed artifacts in English

- **Context**: Any artifact the 10x skills read or parse — `change.md`, `plan.md` (including `## Progress` and status values), commit subjects, `roadmap.md`, `lessons.md`, and generated tracker issues. The working conversation may run in another language (e.g. Polish).
- **Problem**: Mixing the conversation language into skill artifacts breaks the conventions the (English) skills rely on — status tokens (`implemented` / `ready` / `proposed` / `blocked`), section headers, and parseable fields.
- **Rule**: Keep all skill-managed artifacts and status values in English at all times, regardless of the conversation language. Translate nothing in change.md / plan.md / Progress / statuses / commit messages / roadmap / lessons / generated issues.
- **Applies to**: all

## Tests must be order-independent (set settings env in conftest, not per-file)

- **Context**: Backend pytest files under `supply-os-v1/tests/` that import `app.main`/`app.config` and depend on settings loaded from env (auth tokens, `SUPPLY_OS_DATA_BACKEND`).
- **Problem**: Pydantic settings load ONCE at the first `app.config` import. Files set env via `os.environ.setdefault(...)` before importing the app, but a sibling that imports `app.config` (e.g. via `app.sheets`) WITHOUT those vars can load settings first — so a later file's `setdefault` is too late. Result: an order-dependent suite (a 2-file subset fails auth tests while the full alphabetical run passes 217/217).
- **Rule**: Set test settings (auth tokens, data backend) once in a session-scoped `tests/conftest.py` BEFORE any app/config import — never rely on per-file `os.environ.setdefault` for settings that load once. The suite must pass regardless of file order or subset selection.
- **Applies to**: implement, impl-review
