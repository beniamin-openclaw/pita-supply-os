# Frame Brief: S-10 — Sheets → Supabase Postgres data backend

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

"We're doing the *whole* S-10 slice." The observables behind S-10: Supply OS is
*"sometimes slow to load"*; the code documents TOCTOU race windows it calls "v0
trade-offs" (captain-edit vs manager-dispatch, the non-transactional
`append_order`→`append_order_lines` torn write, double-claim/double-dispatch);
and there is a shared **60-read / 60-write per-minute** Google Sheets quota
ceiling. The roadmap pre-names **"Supavisor pooler / port (5432 vs 6543) +
asyncpg prepared-statement caching"** as *the* design risk to frame.

## Initial Framing (preserved)

- **User's stated cause or approach**: Google Sheets-as-datastore is the root
  cause (serial per-request Sheets reads ~200–800 ms each, no transactions/row
  locks, shared 60/min quota, a 60 s in-process TTL cache that dies cold). Fix =
  migrate to Supabase Postgres.
- **User's proposed direction**: A new `app/supabase_backend.py` implementing
  `sheets.py`'s full function set, registered in `_choose_backend()`. Roadmap +
  `infrastructure.md` frame it as *"the seam was designed for exactly this swap …
  ~1–2 day port"* with **pooler/port** as the headline risk.
- **Pre-dispatch narrowing** (Step 1.5): Success bar = **all three** (correctness
  + scale + speed), unranked. Data scope = **everything incl. master data** (the
  owner's north star is *"a CRUD so data is managed without touching code"* — so
  do **not** architect around Sheets-grid editing). Existing data = **backfill**
  the live rows, preserving the per-line audit history.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Performance justification** — is Sheets the felt-latency bottleneck, or is a cacheless frontend a co-bottleneck Postgres won't fix?
2. **Seam-identity leak** — routes branch on the concrete identity `backend is not sheets` as a proxy for "is persistent." ← *the risk the roadmap's framing skips*
3. **Connection topology (pooler/port + IPv4/IPv6)** — the roadmap's named risk; test whether it still holds post-Railway. ← initial framing's headline
4. **Driver / concurrency model (sync vs async)** — the asyncpg footgun only bites if we go async; the codebase is synchronous.
5. **Seam semantics that must *change*, not port** — TTL cache + `invalidate→reread→409` guards become obsolete under real transactions.
6. **Backfill + master-data-everything scope** — 12 entities, audit-column preservation, future-CRUD schema discipline.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| **2. Seam-identity leak (dominant risk)** | **20** `if backend is not sheets:` sites in `main.py` (lines 577, 659, 795, 864, 932, 1113, 1151, 1193, 1357, 1626, 1683, 1737, 1832, 1887, 1990, 2066, 2176, 2220, 2306, 2391) — **17 of 20** raise 503 / return `[]`/`None` for any non-sheets backend. `config.DataBackend` has only `SEED`/`SHEET` (no `SUPABASE`); `_choose_backend()` (`main.py:221`) has no Supabase branch. Pattern is a **documented convention** across 5 archived changes + reinforced as the seam idiom. 3 POST helpers already use the *correct* capability probe (`getattr(backend,"append_order")`). | **STRONG** |
| **3. Pooler/port (initial framing)** | Roadmap's "direct 5432" is the **droplet-era** half of the `infrastructure.md:242` sentence; backend confirmed on **Railway** long-lived uvicorn (`Procfile`, `railway.toml`, `RAILWAY_DEPLOY_RUNBOOK.md`). Real live sub-risk = **Railway→Supabase IPv4/IPv6 egress** (Railway private net is IPv6-only; unverified). | **MEDIUM — real but secondary + stale answer** |
| **4. asyncpg prepared-statement footgun** | Backend is **100% synchronous** (`def` routes; gspread sync). **Zero** Postgres drivers wired (`requirements.txt`/`pyproject.toml`); existing Supabase use is Storage-over-HTTPS only (`supabase_storage.py`). asyncpg is neither present nor the natural pick. | **NONE — named risk mis-aimed** |
| **6. Backfill + everything scope** | **12 worksheets** = 5 master + 6 transactional + `_meta` (2× a transactional-only port). 5 `order_lines` learning columns (`suggested_qty_purchase`, `captain_final_qty_purchase`, `manager_final_qty_purchase`, `delta_vs_suggestion_pct`, `reason_code`) are unreconstructable and feed `/api/manager/suggestion-review`. **No SQL schema exists**; future CRUD needs real PK/FK/constraints. | **STRONG** |
| **1. Performance (speed goal)** | Sheets is the dominant *backend* latency (`manager_order_detail` = 6 serial reads; `manager_queue`/`captain_orderable` = 3 each; cold cache; 2 s blocking 429 retry). BUT frontend co-bottleneck Postgres can't fix: no React Query/SWR, 3-hop captain waterfall, no code-splitting, refetch every mount. | **STRONG — necessary, not sufficient for "speed"** |

## Narrowing Signals

- **Success bar = all three, unranked** → the frame must state that S-10 cleanly delivers **correctness + scale**, but **speed only partially** (backend win, frontend co-bottleneck remains).
- **Scope = everything + future CRUD** → master data moves too; tables need real PK/FK/constraints, not just a data dump.
- **Backfill in scope** → the 5 learning columns are load-bearing; transactional rows live *only* in the live Sheet (no local snapshot) so backfill = read-Sheet→write-Postgres in one pass.
- **Speed boundary = undecided** → frontend caching/waterfall fix recorded as a flagged follow-up; `/10x-plan` decides whether it's in or out.

## Cross-System Convention

This codebase encodes a **two-backend binary**: `sheets` = persistent, everything
else (`seed_loader`, read-only) = degrade. `not sheets` is the convention's
"degrade" proxy — codified in `lessons.md` and repeated across `gr-01`,
`inventory-manager-view`, `suggestion-learning-loop`, `inventory-count-followups`.
A **third persistent backend breaks that proxy everywhere it appears.** The
idiomatic fix already exists in-repo: the `_persist_*` helpers select on
*capability* (`getattr`), not identity — generalize that.

## Reframed Problem Statement

> **The actual problem to plan around is**: the `_choose_backend()` seam has
> *leaked* — ~20 routes hard-code `backend is not sheets` as a persistence
> proxy built on a two-backend binary — so S-10 is **first a seam-contract repair
> (capability/persistence-based selection + a `DataBackend.SUPABASE` path) that
> must precede** the new Supabase module, the connection/pooler config, and the
> 12-entity backfill. The roadmap's pre-named "pooler/port + asyncpg" risk is
> **secondary and partly mis-aimed** (sync codebase on Railway).

If only the new module is written and registered (the original framing), 17 of 20
persistent endpoints would silently 503 or return empty data — a "complete,
all-tests-green" migration that serves nothing. Repairing the seam contract is the
prerequisite that makes the rest of S-10 safe; the connection detail is solvable
deployment config, not the architectural crux.

## Confidence

**HIGH** — strong file:line evidence (20 guard sites, sync codebase, no PG driver,
12 entities, no schema), matches the in-repo capability-check convention, and the
leading hypothesis got *stronger* under pressure-testing.

One residual **LOW-confidence** item to verify during /10x-plan (not blocking the
reframe): **Railway → Supabase IPv4/IPv6 egress** and the consequent pooler-port
choice (likely 6543 transaction pooler on Railway, not the roadmap's stale 5432).

## What Changes for /10x-plan

Plan S-10 as **two sequenced workstreams**, not one module: (1) **seam-contract
repair** — add `DataBackend.SUPABASE`, branch `_choose_backend()`, and replace the
20 identity guards with a capability/persistence check (generalize the existing
`getattr` probe); (2) the **Supabase backend module + sync driver
(psycopg, not asyncpg) + pooler/IPv6 verification + 12-entity schema (PK/FK/
constraints) + audit-preserving backfill**. Treat "feels fast" as partially out of
scope (frontend caching = flagged follow-up); drop — don't port — the Sheets-era
TTL/`invalidate→reread→409` scar tissue once real transactions exist.

## References

- Source: `supply-os-v1/app/main.py` (`_choose_backend()` :221; 20 guard sites listed above), `supply-os-v1/app/sheets.py` (full seam API + write fns), `supply-os-v1/app/models.py:105` (`OrderLine` audit columns), `supply-os-v1/app/config.py` (`DataBackend` enum), `supply-os-v1/app/supabase_storage.py` (existing Storage-only Supabase use), `supply-os-v1/Procfile` + `railway.toml`.
- Foundation: `context/foundation/infrastructure.md:223-244` (datastore decision + pooler footgun), `context/foundation/roadmap.md:210-216` (S-10), `context/foundation/lessons.md` (seam rule).
- Prior precedent: `context/archive/2026-06-09-bukat-suggestion-learning-loop/`, `context/archive/2026-06-09-inventory-manager-view/`, `context/changes/gr-01/`.
- Investigation: 4 read-only sub-agents (seam-leak, connection/driver, performance, backfill-scope).
