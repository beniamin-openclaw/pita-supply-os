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
