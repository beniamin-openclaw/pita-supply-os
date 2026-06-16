# S-10 — Sheets → Supabase Postgres Data Backend Implementation Plan

## Overview

Migrate Pita Supply OS's datastore from Google Sheets to Supabase Postgres behind
`_choose_backend()`, for **all** entities (master + transactional), with a backfill of
the live rows. The migration's primary prize is **correctness** (real transactions +
row locks close the documented TOCTOU "v0 trade-offs") and **scale** (lifts the
60-write/min Sheets ceiling); backend latency improves as a side effect. Per the frame,
this is **first a seam-contract repair, then a new backend** — the `_choose_backend()`
seam leaked into ~20 routes that branch on the concrete `backend is not sheets` identity.

## Current State Analysis

- **The seam leaked.** 20 `if backend is not sheets:` guards in `main.py` use module
  identity as a persistence-capability proxy (12 degrade to `[]/None`, 8 raise 503). A
  registered Supabase backend would be treated like the read-only seed loader — 17/20
  persistent endpoints would silently return empty or 503. The repo already has the
  *correct* pattern: `getattr(backend, "append_order")` capability probes in the 3
  `_persist_*` helpers ([main.py:282](supply-os-v1/app/main.py:282)).
- **Backend is synchronous on Railway.** All routes are `def`; gspread is sync; no
  Postgres driver installed. The roadmap's "asyncpg prepared-statement" risk is mis-aimed
  (research) — a sync driver on the **Session Pooler** sidesteps it entirely.
- **12 entities, no schema exists.** Live project `lpzhphufjwrndfogkfub` (PG 17.6,
  eu-west-1) has **0 public tables**; `uuid-ossp`/`pgcrypto`/`pg_stat_statements`
  installed. Full DDL drafted in [research.md](context/changes/supabase-backend/research.md).
- **5 `order_lines` learning columns are backfill-critical + unreconstructable**
  ([models.py:105](supply-os-v1/app/models.py:105)): they feed `/api/manager/suggestion-review`.
- **Backfill precedent exists** — [scripts/sync_master_data.py](supply-os-v1/scripts/sync_master_data.py)
  (additive, dry-run/`--apply`) covers 4 master tabs but **skips `locations`**; the 6
  transactional entities live only in the live Sheet.
- **Config + CI shape**: `Settings` uses `env_prefix="SUPPLY_OS_"` with `SecretStr`
  fields ([config.py:20](supply-os-v1/app/config.py:20)); deps in
  `[project.optional-dependencies] dev` ([pyproject.toml:19](supply-os-v1/pyproject.toml:19));
  CI backend job = Python 3.12 + `pip install -e ".[dev]"` + ruff + pytest, seed-mode only
  ([.github/workflows/ci.yml:13](.github/workflows/ci.yml:13)).

## Desired End State

`SUPPLY_OS_DATA_BACKEND=supabase` selects a new `app/supabase_backend.py` (psycopg2 +
SQLAlchemy Core, Session Pooler) that serves every read/write through the seam; the 20
guards are capability-based (`SUPPORTS_PERSISTENCE`); the 5 status-transition 409 contracts
are enforced by atomic conditional updates / row locks (proven in CI against real Postgres);
all live data is backfilled with audit columns intact and parity-verified against Sheets;
RLS deny-all locks the public PostgREST API. Sheets stays warm as a one-flip rollback.

### Key Discoveries

- The seam was built for a **two-backend binary** (`sheets`=persistent, else=degrade) —
  `not sheets` is a load-bearing convention across 5 archived changes + `lessons.md` (L2).
- The 5 status-transition 409 contracts (claim/release/dispatch/save/edit,
  [research.md](context/changes/supabase-backend/research.md) §3) are the correctness win —
  cache tricks → real transactions.
- Supabase auto-exposes the public schema via the anon PostgREST API → **RLS deny-all is a
  security requirement**, not optional (the backend's `postgres` role bypasses RLS).

## What We're NOT Doing

- **No frontend changes.** The cacheless-frontend co-bottleneck (no React Query/SWR, the
  3-hop captain waterfall) is a **separate follow-up change** — S-10 is backend-only.
- **No Supabase Auth / app-level RLS policies.** Two-token auth stays (v0 non-goal); RLS is
  deny-all only. Keep plain Postgres behind the seam for Neon/RDS portability.
- **No multi-location scale-up** in this change (roadmap "don't stack two big changes").
- **No dropping the seed backend.** It stays the third tier for the "never place a real
  order from a test" regression rule.
- **No master-data CRUD admin UI** (future work; the schema is built to support it later).

## Implementation Approach

Five sequenced phases, each independently verifiable, with no production impact until
Phase 5. Phase 1 ships a cleaner seam even before any DB work. Phases 2–4 build and *prove*
the backend against real Postgres (the 409 row-lock contracts) with zero prod risk. Phase 5
backfills + parity-verifies + cuts over with a one-flip rollback.

## Critical Implementation Details

- **Status-transition atomicity (the correctness contract).** Today routes do
  `invalidate_cache → get_order → check status → update_order` (cache-based). Under Supabase
  this must become atomic: a conditional `UPDATE orders SET … WHERE order_id=$1 AND
  status=$expected RETURNING …` (or `SELECT … FOR UPDATE` in a transaction); 0 rows → raise
  `errors.OrderStatusConflictError` → route maps to 409. The 5 transition routes pass
  `expected_status` to `update_order`. **Sheets IGNORES `expected_status`** — it is popped
  from kwargs and never written as a column; sheet mode stays covered by the route preflight +
  the existing dispatch guard. **Only Supabase enforces it.** The seam signature stays uniform.
- **Dispatch is guarded by a conditional status UPDATE — not a single lines+status
  transaction.** `manager_dispatch` makes two backend calls, `update_order_lines` then
  `update_order` ([main.py:1297-1303](supply-os-v1/app/main.py:1297)). The double-dispatch
  guard is the conditional `UPDATE … WHERE status='manager_claimed'` on the status flip; the
  line writes stay idempotent overwrites, preserving today's documented retry-safety. No
  combined transactional method is added — the seam stays uniform.
- **`invalidate_cache` becomes a no-op** on the Supabase backend (routes still call it).
- **RLS bypass:** the backend connects as `postgres` (table owner) → bypasses RLS, so
  deny-all blocks only the anon/PostgREST path. Verify the connection role during Phase 3.
- **Backfill drift:** transactional rows are read live from the Sheet; a brief **read-only
  window** during the final backfill prevents a write landing in Sheets after the snapshot.

## Phase 1: Seam-contract repair

### Overview

Make backend selection capability-based and decouple error handling from the `sheets`
module — a pure refactor with **zero behavior change** (Sheets remains the only persistent
backend; all 281 tests stay green). De-risks every later phase. Note: the
`SUPPORTS_PERSISTENCE` flag (persistence capability) coexists deliberately with the existing
`getattr(backend, "append_*")` write-probes in the 3 `_persist_*` helpers (write capability) —
they gate different capabilities, so the split is intentional, not drift.

### Changes Required:

#### 1. Shared error module

**File**: `supply-os-v1/app/errors.py` (new)

**Intent**: Lift the 3 backend-agnostic error classes out of `sheets.py` so routes and any
backend can raise/catch them without coupling to one module.

**Contract**: Defines `ConfigDriftError`, `OrderNotFoundError`, `OrderAlreadyDispatchedError`.
`sheets.py` re-imports and re-exports them (back-compat for existing `sheets.X` references).
`WorksheetNotFound` stays gspread-specific in `sheets.py` (Sheets-only degrade; Supabase
never raises it).

#### 2. Route error catches

**File**: `supply-os-v1/app/main.py`

**Intent**: Catch the lifted errors from the shared module, not the `sheets` namespace.

**Contract**: The 1 `except sheets.OrderAlreadyDispatchedError` ([main.py:1311](supply-os-v1/app/main.py:1311))
→ `except errors.OrderAlreadyDispatchedError`. The 13 `except sheets.WorksheetNotFound` sites
stay as-is (Sheets-specific). Add `from . import errors`.

#### 3. Capability flag on backends

**File**: `supply-os-v1/app/sheets.py`, `supply-os-v1/app/seed_loader.py`

**Intent**: Declare persistence capability explicitly instead of inferring it from module
identity.

**Contract**: `sheets.py` gains `SUPPORTS_PERSISTENCE = True` (module-level). `seed_loader.py`
gains `SUPPORTS_PERSISTENCE = False` (explicit, not absent).

#### 4. Replace the 20 identity guards

**File**: `supply-os-v1/app/main.py`

**Intent**: Swap every `if backend is not sheets:` for the capability check so a future
persistent backend is not treated like the read-only seed loader.

**Contract**: All 20 sites (577, 659, 795, 864, 932, 1113, 1151, 1193, 1357, 1626, 1683,
1737, 1832, 1887, 1990, 2066, 2176, 2220, 2306, 2391) become `if not _is_persistent(backend):`,
where `_is_persistent(backend)` returns `getattr(backend, "SUPPORTS_PERSISTENCE", False) is True`
— the explicit `is True` (not bare truthiness) so a stray Mock's auto-attribute can't read as
persistent. Behavior identical in seed + sheet modes.

### Success Criteria:

#### Automated Verification:

- Linting passes: `cd supply-os-v1 && ruff check .`
- Full suite green (no behavior change): `cd supply-os-v1 && pytest` (281 tests)
- Zero identity guards remain: `cd supply-os-v1 && ! grep -rn "is not sheets" app/`
- Shared errors importable: `cd supply-os-v1 && python -c "from app import errors; errors.OrderAlreadyDispatchedError"`

#### Manual Verification:

- In sheet mode, the Manager queue + a Captain submit-and-back-out behave exactly as before.

**Implementation Note**: After completing this phase and all automated verification passes,
pause for human confirmation before proceeding.

---

## Phase 2: Schema migration (repo-tracked DDL + RLS)

### Overview

Create the 12-table Postgres schema as a version-controlled migration and apply it to the
live project, with RLS deny-all on every table. No app code changes.

### Changes Required:

#### 1. Initial schema migration

**File**: `supply-os-v1/migrations/0001_initial_schema.sql` (new)

**Intent**: The full schema, reviewable in PRs and reproducible, from the research DDL.

**Contract**: 12 `CREATE TABLE` statements (5 master + 6 transactional + `_meta`) with
`text` PKs, `numeric` quantity/price columns, `text + CHECK` for the 4 enums, FK
constraints, the `location_product_settings` unique `(location_id, product_id)`, and the
indexes from research. Column names match `model_dump()` field names exactly. Full DDL is in
[research.md](context/changes/supabase-backend/research.md) §2.

#### 2. RLS deny-all

**File**: `supply-os-v1/migrations/0002_rls_deny_all.sql` (new)

**Intent**: Lock the public PostgREST/anon API; the backend's `postgres` role bypasses RLS.

**Contract**: `ALTER TABLE <each table> ENABLE ROW LEVEL SECURITY;` with **no policies**
(deny-all for non-owner roles). Applies to all 12 tables.

#### 3. Apply to the live project

**Intent**: Materialize the schema on `lpzhphufjwrndfogkfub`.

**Contract**: Apply via Supabase MCP `apply_migration` (records name + SQL in migration
history) or `supabase db push`. Human-approved (schema change = production-affecting).

### Success Criteria:

#### Automated Verification:

- Migration files exist: `ls supply-os-v1/migrations/0001_initial_schema.sql supply-os-v1/migrations/0002_rls_deny_all.sql`
- All 12 tables present (MCP `list_tables` public schema returns 12)
- Security advisor clear of "RLS disabled" lints (MCP `get_advisors security`)

#### Manual Verification:

- Human approves the migration apply (irreversible-ish DDL).
- Spot-check ~2 tables in the Supabase Table Editor: columns, types, CHECK + FK constraints render correctly.

**Implementation Note**: Pause for human confirmation before proceeding.

---

## Phase 3: Supabase backend module + config + driver

### Overview

Add the driver + config, then implement `app/supabase_backend.py` covering the full seam
function set (with atomic status-transition guards), and register it in `_choose_backend()`.
Mocked unit tests mirror the existing sheets test pattern. Default (seed) behavior unchanged.

### Changes Required:

#### 1. Dependencies

**File**: `supply-os-v1/pyproject.toml`, `supply-os-v1/requirements.txt`

**Intent**: Add the sync Postgres driver + query/pool layer.

**Contract**: Add `psycopg2-binary>=2.9` and `SQLAlchemy>=2.0,<3` to `[project]
dependencies` and `requirements.txt`.

#### 2. Config

**File**: `supply-os-v1/app/config.py`

**Intent**: New backend selector value + connection secret, following the existing
`SecretStr` pattern.

**Contract**: `DataBackend.SUPABASE = "supabase"` ([config.py:15](supply-os-v1/app/config.py:15));
`database_url: SecretStr = SecretStr("")` field (env `SUPPLY_OS_DATABASE_URL`). DSN shape:
`postgresql://postgres.<ref>:<PWD>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require`.

#### 3. Shared status-conflict error

**File**: `supply-os-v1/app/errors.py`

**Intent**: A backend-agnostic error for a failed atomic status transition.

**Contract**: Add `OrderStatusConflictError`. Routes map it to 409.

#### 4. Supabase backend module

**File**: `supply-os-v1/app/supabase_backend.py` (new)

**Intent**: Implement the full data-layer seam against Postgres via SQLAlchemy Core.

**Contract**: Module-level `SUPPORTS_PERSISTENCE = True`; `is_configured()` (mirrors
`supabase_storage.is_configured`); a lazy singleton SQLAlchemy engine on the Session Pooler
(`pool_size=3, max_overflow=5, pool_pre_ping=True`). Implements every seam function:
`load_products/suppliers/locations/supplier_products/location_product_settings/meta`,
`load_orders/order_lines`, `get_order`, `append_order`, `append_order_lines`,
`update_order(order_id, *, expected_status=None, **kwargs)`, `update_order_lines`,
`delete_order_lines` (one `DELETE WHERE order_id=`), the inventory-count set
(`load_/get_/append_*`), the receipt set (`load_/get_/append_/update_receipt`), and a no-op
`invalidate_cache`. `get_*` assemble parent+lines (mirror `sheets.get_order`). **Status
transitions are atomic:** `update_order` with `expected_status` does a conditional
`UPDATE … WHERE order_id=$1 AND status=$expected RETURNING …`; 0 rows →
`OrderStatusConflictError`. For dispatch, the status flip is the conditional guard
(`WHERE status='manager_claimed'`); line writes stay idempotent overwrites — no combined
lines+status transaction is added. Rows map to the same Pydantic models as `sheets.py`.

#### 5. Register the backend + pass expected_status

**File**: `supply-os-v1/app/main.py`

**Intent**: Make `_choose_backend()` able to return Supabase; make the 5 status-mutating
routes atomic.

**Contract**: `from . import supabase_backend`; `_choose_backend()` gains a Supabase branch
*first* ([main.py:221](supply-os-v1/app/main.py:221)). The 5 transition routes
(`captain_order_edit`, `manager_claim`, `manager_release`, `manager_dispatch`,
`manager_order_save`) pass `expected_status=` to `update_order` and catch
`errors.OrderStatusConflictError` → 409. (Sheets ignores `expected_status`; its existing
preflight + dispatch guard are unchanged.)

#### 6. Conftest + mocked unit tests

**File**: `supply-os-v1/tests/conftest.py`, `supply-os-v1/tests/test_supabase_backend.py` (new)

**Intent**: Keep settings load-order safe (L6); cover the backend's function contracts
without a live DB.

**Contract**: Add `os.environ.setdefault("SUPPLY_OS_DATABASE_URL", "")` to conftest
([conftest.py:25](supply-os-v1/tests/conftest.py:25)). New tests mock the engine/connection
(mirror `test_manager_dispatch.py`'s `_activate_sheet_backend`) and assert the function set
+ that `_choose_backend()` returns `supabase_backend` when configured. Add a **seam-parity
test**: introspect the public seam callables of `sheets` and assert `supabase_backend` exposes
a superset, so a missing function is caught at test time, not at runtime in prod.

### Success Criteria:

#### Automated Verification:

- Deps install: `cd supply-os-v1 && pip install -e ".[dev]"`
- Linting passes: `cd supply-os-v1 && ruff check .`
- Mocked backend tests + seam-parity check pass: `cd supply-os-v1 && pytest tests/test_supabase_backend.py`
- Full suite green (seed default unaffected): `cd supply-os-v1 && pytest`

#### Manual Verification:

- With the real DSN in a local `.env`, `is_db_configured()` is true and a live read smoke
  (e.g. `load_products()` against the freshly-migrated DB) connects via the Session Pooler.
- Confirm the connection role bypasses RLS (a read succeeds despite deny-all).

**Implementation Note**: Pause for human confirmation before proceeding.

---

## Phase 4: CI integration coverage (real Postgres)

### Overview

Prove the backend — especially the 5 status-transition 409 row-lock contracts — against a
real Postgres in CI, before trusting it with prod data.

### Changes Required:

#### 1. Integration test marker + tests

**File**: `supply-os-v1/pyproject.toml`, `supply-os-v1/tests/test_supabase_integration.py` (new)

**Intent**: Real-SQL tests for the function set + the atomic transitions, opt-in so the
default seed suite is unchanged.

**Contract**: Register a `markers = ["integration"]` config; default `pytest` excludes it.
Tests run the schema migration into the ephemeral DB, then exercise each seam function and
**the 5 conditional-update contracts** — including a concurrent double-dispatch / double-claim
that must yield exactly one success + one 409.

#### 2. CI integration job

**File**: `.github/workflows/ci.yml`

**Intent**: A separate job with an ephemeral Postgres service that runs the integration
marker.

**Contract**: New `backend-integration` job (`services: postgres: postgres:16`, port 5432),
sets `SUPPLY_OS_DATA_BACKEND=supabase` + `SUPPLY_OS_DATABASE_URL` to the service container,
applies the migrations, runs `pytest -m integration`. The existing seed-mode `backend` job
is unchanged.

### Success Criteria:

#### Automated Verification:

- Default suite still excludes integration tests: `cd supply-os-v1 && pytest` (green, seed mode)
- Integration tests pass against real PG: `cd supply-os-v1 && pytest -m integration` (with a local/CI Postgres)
- CI `backend-integration` job is green on the branch.

#### Manual Verification:

- Review the CI run: the integration job exercises a concurrent transition and shows exactly
  one 409 (proves the row-lock contract, not a mock).

**Implementation Note**: Pause for human confirmation before proceeding.

---

## Phase 5: Backfill + parity verify + cutover

### Overview

Backfill all live data into Postgres, verify parity against Sheets (especially the learning
columns), then cut over with a one-flip rollback.

### Changes Required:

#### 1. Backfill script

**File**: `supply-os-v1/scripts/backfill_supabase.py` (new)

**Intent**: Move every entity from the live Sheet into Postgres, idempotently, preserving
audit columns.

**Contract**: Mirrors `sync_master_data.py` (dry-run default, `--apply`). Reads via the
`sheets` backend (`load_*` / `get_*`) and writes via `supabase_backend` (or direct SQL) with
`INSERT … ON CONFLICT DO NOTHING`. Covers **all 5 master entities (incl. `locations`)** + the
6 transactional entities, in FK-safe order (products → suppliers → locations →
supplier_products → location_product_settings → orders → order_lines → inventory_counts →
inventory_count_lines → receipts → receipt_lines → `_meta`). Preserves every `order_lines`
audit/learning column verbatim.

#### 2. Parity verification

**File**: `supply-os-v1/scripts/verify_parity.py` (new)

**Intent**: Prove the backfill is faithful before cutover.

**Contract**: Asserts per-table row counts match Sheets-vs-PG, and that
`_aggregate_suggestion_review(load_order_lines(), …)` matches under both backends (proves the
5 learning columns survived). Compares at the endpoint's rounding (3–4 dp) / a small float
tolerance — not raw float equality — so a `numeric(8,6)` round-trip can't trip a false
mismatch. Non-zero exit on any real mismatch.

#### 3. Cutover + rollback

**File**: Railway env (`SUPPLY_OS_DATA_BACKEND`), `supply-os-v1/.env.example`

**Intent**: Switch production to Supabase with Sheets kept warm.

**Contract**: After parity is green, cut over in a low-activity window: set
`SUPPLY_OS_DATA_BACKEND=supabase` + `SUPPLY_OS_DATABASE_URL` on Railway and redeploy.
**Rollback is clean only until the first write lands in Postgres** — flipping back to `sheet`
then touches no data. After PG has accepted writes, rollback additionally requires the
reverse-sync (change #4) or an explicit accept-loss decision, because post-cutover
orders/counts/receipts live only in PG. Document the DSN in `.env.example` (placeholder only —
never the real secret).

#### 4. Reverse-sync escape hatch (post-write rollback)

**File**: `supply-os-v1/scripts/reverse_sync_supabase.py` (new)

**Intent**: Make rollback non-destructive after Postgres has accepted writes — copy PG-only
transactional rows back to Sheets so a flip to `sheet` mode loses nothing.

**Contract**: Mirrors `backfill_supabase.py` in reverse — reads via `supabase_backend`, writes
via the `sheets` append path, skips rows already present (idempotent), preserving all audit
columns. Dry-run default + `--apply`. Run only when rolling back after writes exist.

### Success Criteria:

#### Automated Verification:

- Backfill dry-run + apply succeed: `cd supply-os-v1 && python scripts/backfill_supabase.py` then `--apply`
- Parity passes: `cd supply-os-v1 && python scripts/verify_parity.py` (exit 0)

#### Manual Verification:

- Human approves the cutover (production-affecting); a read-only window is coordinated with
  the operator during the final backfill.
- Post-cutover smoke: `/health/internal` shows `data_backend=supabase`; Manager queue loads;
  a Captain submit-and-back-out places **no real order**; `/api/manager/suggestion-review`
  renders the same top deviations as before.
- Rollback rehearsed both ways: a pre-write env flip to `sheet` restores Sheets cleanly, AND
  the reverse-sync (`reverse_sync_supabase.py`) dry-run copies post-cutover PG rows back to
  Sheets (proves the after-writes recovery path).
- Sheets kept warm for ≥1 full pilot cycle before decommissioning.

**Implementation Note**: This is the production cutover — pause for explicit human approval
before applying and before flipping the env var.

---

## Testing Strategy

### Unit Tests:

- `supabase_backend` function-set contracts, mocked engine (Phase 3) — mirror
  `test_manager_dispatch.py` / `test_sheets_write.py`.
- `_choose_backend()` returns `supabase_backend` when configured.

### Integration Tests (Phase 4, `@pytest.mark.integration`, ephemeral Postgres):

- Round-trip every entity (append → get → update → delete).
- The 5 status-transition 409 contracts as conditional updates, incl. a concurrent
  double-dispatch / double-claim → exactly one 409.

### Manual Testing Steps:

1. Local read smoke against the migrated DB via the Session Pooler (Phase 3).
2. Post-cutover prod smoke: queue + submit-and-back-out + suggestion-review (Phase 5).
3. Rollback rehearsal: env flip back to `sheet` (Phase 5).

## Performance Considerations

`manager_order_detail`'s 6 serial Sheets reads collapse to one query; the 2 s blocking 429
retry and the cold-cache penalty disappear. The cacheless **frontend** remains a co-bottleneck
(out of scope — separate follow-up). Pool sized small (`pool_size=3`) for the single Railway
worker at pilot scale.

## Migration Notes

- **New secret**: `SUPPLY_OS_DATABASE_URL` (Session Pooler DSN, `postgres.<ref>` username,
  `sslmode=require`) — Railway env, off-repo; `.env.example` carries a placeholder only.
- **Owner prerequisite** (blocks Phase 3 live smoke + Phases 4–5): supply the Session-Pooler
  connection string from the Supabase dashboard → Connect → Session pooler.
- **Read-only window** during the final backfill to avoid Sheet writes landing after the
  snapshot (coordinate with the single operator; pilot scale makes this trivial).
- **Rollback**: `SUPPLY_OS_DATA_BACKEND=sheet` + redeploy. **Clean only before the first
  Postgres write**; after that, run the reverse-sync (PG→Sheets, `reverse_sync_supabase.py`)
  first or accept loss of post-cutover rows. Keep Sheets warm for ≥1 pilot cycle.
- **RLS**: backend connects as `postgres` (bypasses RLS); deny-all blocks only the public
  anon/PostgREST path.

## References

- Frame brief: `context/changes/supabase-backend/frame.md`
- Research (full DDL, connection recommendation, scar-tissue classification): `context/changes/supabase-backend/research.md`
- Seam + capability precedent: `supply-os-v1/app/main.py:282` (`_persist_order` getattr probe)
- Backfill precedent: `supply-os-v1/scripts/sync_master_data.py`
- Lessons: `context/foundation/lessons.md` (L1 CI-covers-product, L2 seam, L3 secrets, L6 conftest)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Seam-contract repair

#### Automated

- [x] 1.1 Linting passes (ruff) — b163d76
- [x] 1.2 Full suite green, no behavior change (281 tests) — b163d76
- [x] 1.3 Zero `is not sheets` guards remain in app/ — b163d76
- [x] 1.4 Shared errors importable from app.errors — b163d76

#### Manual

- [ ] 1.5 Sheet-mode queue + submit-and-back-out behave as before

### Phase 2: Schema migration

#### Automated

- [x] 2.1 Migration files exist (0001_initial_schema.sql, 0002_rls_deny_all.sql) — cc75084
- [x] 2.2 All 12 tables present in public schema (list_tables) — cc75084
- [x] 2.3 Security advisor clear of RLS-disabled lints — cc75084

#### Manual

- [x] 2.4 Human approves the migration apply — cc75084
- [x] 2.5 Spot-check 2 tables in Table Editor (columns/types/constraints) — cc75084

### Phase 3: Supabase backend module + config + driver

#### Automated

- [x] 3.1 Deps install (pip install -e ".[dev]") — 70d2a74
- [x] 3.2 Linting passes (ruff) — 70d2a74
- [x] 3.3 Mocked backend tests + seam-parity check pass — 70d2a74
- [x] 3.4 Full suite green (seed default unaffected) — 70d2a74

#### Manual

- [ ] 3.5 Live read smoke via Session Pooler with real DSN
- [ ] 3.6 Connection role bypasses RLS (read succeeds despite deny-all)

### Phase 4: CI integration coverage

#### Automated

- [x] 4.1 Default suite still excludes integration tests (green, seed mode) — d8b0d4b
- [ ] 4.2 Integration tests pass against real Postgres
- [ ] 4.3 CI backend-integration job green on the branch

#### Manual

- [ ] 4.4 CI run shows a concurrent transition yielding exactly one 409

### Phase 5: Backfill + parity verify + cutover

#### Automated

- [ ] 5.1 Backfill dry-run + apply succeed (row counts match)
- [ ] 5.2 Parity check passes (suggestion-review identical Sheets-vs-PG)

#### Manual

- [ ] 5.3 Human approves cutover; read-only window coordinated
- [ ] 5.4 Post-cutover smoke (health=supabase, queue, submit-and-back-out, suggestion-review)
- [ ] 5.5 Rollback rehearsed both ways (pre-write env flip + reverse-sync dry-run)
- [ ] 5.6 Sheets kept warm ≥1 pilot cycle
