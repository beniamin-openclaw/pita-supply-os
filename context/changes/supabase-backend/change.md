---
change_id: supabase-backend
title: Supabase Postgres data backend behind _choose_backend() (roadmap slice S-10)
status: implemented
created: 2026-06-16
updated: 2026-06-17
archived_at: null
---

## Notes

> cały slice s-10 robimy ok ? pamietaj o higienie git

Roadmap slice **S-10** (Horizon 2 — Rollout Enablement). Move transactional order + inventory data off Google Sheets onto Supabase (managed Postgres) via a new backend module (`app/supabase_backend.py`) implementing the same function set as `app/sheets.py` and registering in `_choose_backend()` — gaining real transactions / row locks (closes documented TOCTOU "v0 trade-offs") and lifting the 60-write/min Sheets ceiling. Refs: `context/foundation/roadmap.md` §S-10, `infrastructure.md`, `stack-assessment.md`, PRD Open Question 3.

**Roadmap execution mandate** — run as its own session (highest-stakes change left; don't stack with a scale-up). Full chain, **starting with `/10x-frame`** because of the Supavisor pooler / port (5432 vs 6543) + asyncpg prepared-statement design risk:
`/10x-frame` → `/10x-research` → `/10x-plan` → `/10x-plan-review` → `/10x-implement` → `/10x-impl-review` → `/10x-archive`.

Load-bearing lessons: **L2** (never bypass `_choose_backend()`; the new backend registers there, routes never import it), **L3** (secrets — connection string / service key off-repo), **L6** (new-backend env in `conftest.py`, not per-file), **L1** (CI must actually exercise the Supabase path).

**Scope boundary (confirmed 2026-06-16):** migration only — port the data layer to Supabase and prove it on the single-location pilot. F-02 multi-supplier data load and any new-location scale-up are deliberately deferred to separate later sessions (roadmap "don't stack two big changes" rule).

**Git hygiene (per request):** work stays on worktree branch `claude/nervous-visvesvaraya-8c58ca`; never commit secrets (`.env`, `sa.json`, Supabase keys) — only `.env.example`; no commits/pushes until explicitly asked.
