# S-10 — Sheets → Supabase Postgres Data Backend — Plan Brief

> Full plan: `context/changes/supabase-backend/plan.md`
> Frame brief: `context/changes/supabase-backend/frame.md`
> Research: `context/changes/supabase-backend/research.md`

## What & Why

Migrate Pita Supply OS's datastore from Google Sheets to Supabase Postgres behind the
existing `_choose_backend()` seam. Per the frame: **the `_choose_backend()` seam has leaked —
~20 routes hard-code `backend is not sheets` as a persistence proxy — so S-10 is first a
seam-contract repair, then a new backend.** The prize is **correctness** (real transactions +
row locks close the documented TOCTOU "v0 trade-offs") and **scale** (lifts the 60-write/min
Sheets ceiling); backend latency improves as a side effect.

## Starting Point

A synchronous FastAPI backend on Railway with Google Sheets as the datastore (gspread, TTL
cache, no transactions). 20 `is not sheets` guards would route a third backend through the
seed-mode degrade path; no Postgres driver is installed; the live Supabase project is
greenfield (0 tables). The repo already has the *right* selection pattern (`getattr`
capability probes in 3 `_persist_*` helpers) and a backfill precedent (`sync_master_data.py`).

## Desired End State

`SUPPLY_OS_DATA_BACKEND=supabase` selects a new `app/supabase_backend.py` serving every
read/write through a capability-based seam; the 5 status-transition 409 contracts are enforced
by atomic conditional updates (proven in CI against real Postgres); all live data is
backfilled with audit columns intact and parity-verified; RLS deny-all locks the public
PostgREST API; Sheets stays warm as a one-flip rollback.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Problem framing | Seam repair first, then backend | 20 identity guards would degrade a 3rd backend | Frame |
| Data scope | Everything (master + transactional) + backfill | Owner's future-CRUD goal; preserve learning history | Frame |
| Driver | psycopg2 + SQLAlchemy Core | Sync codebase; pooled; no prepared-stmt footgun | Research/Plan |
| Connection | Supavisor Session Pooler (5432, IPv4) | Long-lived process; dodges IPv6 + prepared-stmt footguns | Research |
| Capability check | `SUPPORTS_PERSISTENCE` flag + `app/errors.py` | Mirrors existing `is_configured()` style; flat modules | Research/Plan |
| Cutover | Staged with parity verify, one-flip rollback | Proves backfill fidelity before traffic | Plan |
| DDL mgmt | Repo-tracked migration, applied via CLI/MCP | Reproducible, reviewable, supports future CRUD | Plan |
| RLS | Enabled, deny-all policies | Closes public PostgREST/anon leak; backend bypasses RLS | Plan |
| CI depth | Mocked units + ephemeral Postgres integration job | Proves the 409 row-lock contracts on real SQL | Plan |
| Frontend speed | Out of scope (separate follow-up) | Don't stack two big changes; keep migration focused | Plan |

## Scope

**In scope:** capability-based seam repair; 12-table schema + RLS migration; `supabase_backend`
module (psycopg2 + SQLAlchemy, Session Pooler); atomic status-transition guards; CI integration
job; full backfill (master + transactional) + parity verify; staged cutover + rollback.

**Out of scope:** frontend caching/waterfall fix; Supabase Auth / app-level RLS policies;
multi-location scale-up; master-data CRUD admin UI; dropping the seed backend.

## Architecture / Approach

New `app/supabase_backend.py` implements the same function set as `sheets.py` via SQLAlchemy
Core on a lazy Session-Pooler engine; `_choose_backend()` returns it when
`SUPPLY_OS_DATA_BACKEND=supabase`. Routes select backends by the `SUPPORTS_PERSISTENCE`
capability flag, not module identity. The 5 status-transition cache guards become atomic
conditional `UPDATE … WHERE status=$expected` (→ `OrderStatusConflictError` → 409). Schema +
RLS ship as repo-tracked SQL migrations. Backfill reads the live Sheet and writes Postgres,
preserving the 5 learning columns.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Seam-contract repair | Capability-based selection + shared errors; 281 tests still green | Missing a guard site → silent degrade |
| 2. Schema migration | 12 tables + RLS deny-all on the live project | DDL/type or constraint mismatch vs models |
| 3. Backend module | `supabase_backend` + driver/config + mocked tests | Status-transition atomicity correctness |
| 4. CI integration | 409 row-lock contracts proven on real Postgres | Mock-only would miss real lock behavior |
| 5. Backfill + cutover | All data migrated, parity-verified, env flipped | Dropped audit column; backfill drift |

**Prerequisites:** owner supplies the Session-Pooler DSN (host/region, `postgres.<ref>`
username, DB password) — blocks Phase 3 live smoke + Phases 4–5.
**Estimated effort:** ~4–5 sessions across 5 phases (Phase 3 is the largest; Phase 5 needs an
operator-coordinated read-only window).

## Open Risks & Assumptions

- **Owner connection secrets** are a hard prerequisite for the live phases.
- **Backfill drift** if a write lands in Sheets after the snapshot — mitigated by a brief
  read-only window during final backfill.
- **Post-cutover rollback** loses Postgres-only writes — clean only before the first PG write;
  mitigated by a low-activity cutover window + a PG→Sheets reverse-sync escape hatch.
- **`expected_status` seam extension** must stay backward-compatible (Sheets ignores it).
- **RLS bypass assumption**: the backend connects as `postgres` (table owner) — verify in
  Phase 3 that reads succeed despite deny-all.

## Success Criteria (Summary)

- Production runs on Supabase (`/health/internal` shows `data_backend=supabase`); Manager
  queue + Captain submit work with no real orders placed.
- The 5 status-transition 409 contracts are enforced by real transactions (CI-proven).
- `suggestion-review` output matches Sheets-vs-Postgres (learning history preserved);
  rollback to Sheets is a one-line env flip (clean pre-write; reverse-sync after writes).
