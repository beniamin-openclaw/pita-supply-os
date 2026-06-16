---
date: 2026-06-16T14:40:21+0300
researcher: Claude (Opus 4.8)
git_commit: 606d857c5160c1cd4ad4b04b9e8300dbc60500ba
branch: claude/nervous-visvesvaraya-8c58ca
repository: pita-supply-os
topic: "S-10 — Sheets → Supabase Postgres data backend behind _choose_backend()"
tags: [research, codebase, supabase, postgres, data-layer-seam, migration, backfill, connection-pooling]
status: complete
last_updated: 2026-06-16
last_updated_by: Claude (Opus 4.8)
---

# Research: S-10 — Sheets → Supabase Postgres data backend

**Date**: 2026-06-16T14:40:21+0300
**Researcher**: Claude (Opus 4.8)
**Git Commit**: 606d857
**Branch**: claude/nervous-visvesvaraya-8c58ca
**Repository**: pita-supply-os (github.com/beniamin-openclaw/pita-supply-os)

## Research Question

Migrate the Pita Supply OS datastore from Google Sheets to Supabase Postgres
behind `_choose_backend()`. Scope (confirmed in `frame.md`): **everything** —
master data + transactional data — with **backfill** of existing live rows
(preserving the per-line audit history) and a **future CRUD admin UI** in mind.
This research grounds the plan: the full seam contract + capability-check design,
a Postgres schema with draft DDL, the Sheets scar tissue to drop vs the behavioral
contracts to keep, a resolved connection/driver recommendation, and the
backfill + test/CI harness.

## Summary

Six findings, all file:line-grounded; the connection unknown is now resolved and
the live Supabase project inspected.

1. **The seam has leaked — and the fix is small + idiomatic.** 20 routes hard-code
   `if backend is not sheets:` (12 degrade to `[]/None`, 8 raise 503). The codebase
   already contains the *correct* pattern (`getattr(backend, "append_order")` in the
   3 `_persist_*` helpers). Recommended repair: a module-level `SUPPORTS_PERSISTENCE`
   flag per backend + lift the 3 error classes into `app/errors.py` (14 `except
   sheets.*` sites couple to the module name). Plus `DataBackend.SUPABASE` enum value
   + a `_choose_backend()` branch.
2. **Schema = 12 tables, full DDL drafted.** 5 master + 6 transactional + `_meta`.
   `numeric` (not float) for quantities/prices; `text + CHECK` (not native ENUM) for
   the 4 enums; text PKs (existing IDs are meaningful). The 5 `order_lines` learning
   columns are backfill-critical and unreconstructable.
3. **Most Sheets machinery dies; the status-transition 409 contracts must survive.**
   TTL cache / column-order serialization / 429-retry are all OBSOLETE. The 5
   `invalidate→reread→409` race guards become a single transaction + `SELECT FOR
   UPDATE` / conditional `UPDATE … WHERE status=$expected` — same behavior, real
   atomicity.
4. **Connection RESOLVED — Session Pooler 5432, psycopg2 + SQLAlchemy.** Not the
   roadmap's "direct 5432" (IPv6-only; Railway egress is IPv6-unreliable) and not the
   frame's guessed "6543 transaction pooler." The **Supavisor Session Pooler (port
   5432, IPv4)** fits a long-lived sync uvicorn, needs no Railway IPv6 flag, no paid
   IPv4 add-on, and sidesteps the prepared-statement footgun entirely (psycopg2 uses
   the simple query protocol).
5. **Backfill is asymmetric.** Master data has seed CSVs + an additive sync
   precedent (`scripts/sync_master_data.py`); the 6 transactional entities exist
   **only in the live Sheet** → one-pass read-Sheet→write-Postgres preserving audit
   columns. Rollback = flip `SUPPLY_OS_DATA_BACKEND` back to `sheet` (keep it warm).
6. **Live project is greenfield + a security gap to design for.** Project
   `lpzhphufjwrndfogkfub`, Postgres 17.6, `eu-west-1` (Ireland), **0 public tables**.
   `uuid-ossp`/`pgcrypto`/`pg_stat_statements` installed; `moddatetime` available.
   **RLS must be enabled (deny-all) on every table** — Supabase auto-exposes the
   public schema via PostgREST/anon; the backend uses a privileged Postgres role that
   bypasses RLS, so deny-all locks the public REST API without breaking the app.

## Detailed Findings

### 1. Seam contract & capability model

**The function-set contract** — both backends implement only the 5 master-data
readers; every transactional read + all 10 writes are sheets-only:

- READ (both): `load_products`, `load_suppliers`, `load_locations`,
  `load_supplier_products`, `load_location_product_settings`
  ([seed_loader.py:72-92](supply-os-v1/app/seed_loader.py:72), [sheets.py:261-277](supply-os-v1/app/sheets.py:261))
- READ (sheets-only): `load_meta`, `load_orders`, `load_order_lines`, `get_order`,
  `load_inventory_counts`, `load_inventory_count_lines`, `get_inventory_count`,
  `load_receipts`, `load_receipt_lines`, `get_receipt`, `invalidate_cache`,
  `is_configured`
- WRITE (sheets-only, 10): `append_order`, `append_order_lines`, `update_order`,
  `update_order_lines`, `delete_order_lines`, `append_inventory_count`,
  `append_inventory_count_lines`, `append_receipt`, `append_receipt_lines`,
  `update_receipt` ([sheets.py:452-793](supply-os-v1/app/sheets.py:452))
- ERRORS in the contract: `OrderAlreadyDispatchedError`, `OrderNotFoundError`,
  `WorksheetNotFound`, `ConfigDriftError` ([sheets.py:74-86](supply-os-v1/app/sheets.py:74))

**The 20 `is not sheets` guard sites** (in `main.py`), by capability:

- **Bucket A — needs persisted reads (12):** degrade to `[]`/`None`/503 — `manager_queue` (577), `captain_orders` (795), `captain_inventory_latest` (1626), `captain_inventory_counts` (1683), `manager_inventory_counts` (1832), `manager_suggestion_review` (1990), `captain_receipts` (2176), `captain_order_detail` (864), `captain_inventory_count_detail` (1737), `manager_inventory_count_detail` (1887), `captain_receipt_detail` (2220), `captain_receipt_photo_urls` (2391).
- **Bucket B — needs writes (6):** raise 503 — `captain_order_edit` (932), `manager_claim` (1113), `manager_release` (1151), `manager_dispatch` (1193), `manager_order_save` (1357), `captain_receipt_photos` (2306).
- **Bucket C — reads + writes (2):** `manager_order_detail` (659), `captain_receipt_submit` (2066).

**The fix is already in the repo.** The 3 `_persist_*` helpers select on *capability*,
not identity: `getattr(backend, "append_order", None)` →
[main.py:282-304](supply-os-v1/app/main.py:282) (`_persist_order`),
~1433 (`_persist_inventory_count`), ~2010 (`_persist_receipt`). The 20 guards were
added later and tightened to identity checks.

**Recommended capability-check (Option A — module flag + shared errors):**
- Add `SUPPORTS_PERSISTENCE = True` to `sheets.py` + the new `supabase_backend.py`;
  absent/`False` on `seed_loader`. Replace each guard with
  `if not getattr(backend, "SUPPORTS_PERSISTENCE", False):`. Mechanical, mirrors the
  existing `is_configured()` style, no classes (the codebase is flat-module — a
  Protocol/ABC was rejected as a paradigm shift with no static checker to benefit).
- Lift `ConfigDriftError` / `OrderNotFoundError` / `OrderAlreadyDispatchedError`
  (and a backend-agnostic "entity not found") into a new `app/errors.py`; rewrite the
  14 `except sheets.*` clauses to import from there. **This is required for any third
  backend regardless of the capability-check choice** — it's the one hard coupling the
  flag alone doesn't remove.

**Config wiring** ([config.py:15-17](supply-os-v1/app/config.py:15),
[main.py:221-230](supply-os-v1/app/main.py:221)):
```python
# config.py — add to DataBackend
SUPABASE = "supabase"
# main.py — _choose_backend(), Supabase branch first
def _choose_backend():
    if settings.data_backend == DataBackend.SUPABASE and supabase_backend.is_configured():
        return supabase_backend
    if settings.data_backend == DataBackend.SHEET and sheets.is_configured():
        return sheets
    return seed_loader
```
(Naming: `SUPABASE` recommended over `POSTGRES` to match the change-id + infra doc;
minor — settle in the plan.)

### 2. Data model → Postgres schema + DDL

**Enums → `text + CHECK`, not native Postgres ENUM.** Supabase Table Editor renders
ENUM cells as plain text anyway (no CRUD-UI gain); adding a value to a native ENUM is
awkward DDL, whereas a CHECK is a transactional `DROP/ADD CONSTRAINT`. Values from
[models.py:13-43](supply-os-v1/app/models.py:13).

**Types:** `numeric` (not float8) for all quantity/price columns — the
suggestion-review endpoint does `SUM`/`AVG` and float drift would corrupt the learning
signal. `timestamptz` for datetimes, `date` for dates, `boolean` for bools. **Text
PKs** — existing IDs (`ORD-20260615-WOL-BUKA-a1b2c3`, `OL-…-001`) are meaningful and
URL-transparent; uuid would force a data migration.

**The 5 backfill-critical learning columns on `order_lines`** (★) feed
`/api/manager/suggestion-review` via `_aggregate_suggestion_review`
([models.py:105-121](supply-os-v1/app/models.py:105)): `suggested_qty_purchase`,
`captain_final_qty_purchase`, `manager_final_qty_purchase`, `delta_vs_suggestion_pct`,
`reason_code`. Master data (targets/units) may have changed since the order, so these
**cannot be recomputed** — migrate verbatim.

**Draft DDL** (column names match `model_dump()` field names exactly, so the existing
`_normalize`/serialization round-trips):

```sql
-- ===== MASTER DATA =====
CREATE TABLE products (
    product_id        text PRIMARY KEY,
    gostock_id        integer,
    product_name_pl   text NOT NULL,
    product_category  text NOT NULL,
    inventory_unit    text NOT NULL,
    is_critical       boolean NOT NULL DEFAULT false,
    active            boolean NOT NULL DEFAULT true,
    notes             text NOT NULL DEFAULT ''
);
CREATE TABLE suppliers (
    supplier_id              text PRIMARY KEY,
    supplier_name            text NOT NULL,
    email                    text,
    ordering_method          text NOT NULL DEFAULT 'email'
        CHECK (ordering_method IN ('email','portal','phone','manual')),
    delivery_days            text,
    cutoff_time              text,
    minimum_order_value_pln  numeric(10,2),
    active                   boolean NOT NULL DEFAULT true,
    notes                    text NOT NULL DEFAULT ''
);
CREATE TABLE locations (
    location_id       text PRIMARY KEY,
    location_name     text NOT NULL,
    delivery_address  text,
    city              text,
    active            boolean NOT NULL DEFAULT true,
    notes             text NOT NULL DEFAULT ''
);
CREATE TABLE supplier_products (
    supplier_product_id      text PRIMARY KEY,
    supplier_id              text NOT NULL REFERENCES suppliers(supplier_id),
    product_id               text NOT NULL REFERENCES products(product_id),
    supplier_product_name    text NOT NULL,
    purchase_unit            text NOT NULL,
    units_per_purchase_unit  numeric(12,4) NOT NULL DEFAULT 1.0,
    rounding_rule            text NOT NULL DEFAULT 'full_only'
        CHECK (rounding_rule IN ('full_only','half_allowed','up_for_critical','tenth_kg')),
    price_estimate_pln       numeric(10,2),
    active                   boolean NOT NULL DEFAULT true,
    notes                    text NOT NULL DEFAULT ''
);
CREATE TABLE location_product_settings (
    setting_id                       text PRIMARY KEY,
    location_id                      text NOT NULL REFERENCES locations(location_id),
    product_id                       text NOT NULL REFERENCES products(product_id),
    min_stock_qty_base               numeric(12,4) NOT NULL DEFAULT 0,
    max_stock_qty_base               numeric(12,4) NOT NULL DEFAULT 0,
    target_stock_qty_base            numeric(12,4) NOT NULL DEFAULT 0,
    is_critical_for_location         boolean NOT NULL DEFAULT false,
    allow_over_max_due_to_packaging  boolean NOT NULL DEFAULT false,
    notes                            text NOT NULL DEFAULT '',
    CONSTRAINT location_product_settings_unique UNIQUE (location_id, product_id)
);
-- ===== TRANSACTIONAL =====
CREATE TABLE orders (
    order_id                  text PRIMARY KEY,
    location_id               text NOT NULL REFERENCES locations(location_id),
    supplier_id               text NOT NULL REFERENCES suppliers(supplier_id),
    order_date                date NOT NULL,
    requested_delivery_date   date,
    status                    text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','captain_submitted','manager_claimed',
                          'manager_sent','closed','cancelled')),
    captain_user              text,
    captain_submitted_at      timestamptz,
    manager_user              text,
    manager_sent_at           timestamptz,
    sent_method               text,
    supplier_order_reference  text,
    total_value_estimate_pln  numeric(10,2),
    last_edited_at            timestamptz,
    notes                     text NOT NULL DEFAULT ''
);
CREATE INDEX orders_location_status_idx ON orders (location_id, status);
CREATE INDEX orders_submitted_idx ON orders (captain_submitted_at DESC NULLS LAST);

CREATE TABLE order_lines (
    order_line_id               text PRIMARY KEY,
    order_id                    text NOT NULL REFERENCES orders(order_id),
    product_id                  text NOT NULL REFERENCES products(product_id),
    supplier_product_id         text NOT NULL REFERENCES supplier_products(supplier_product_id),
    current_stock_qty_base      numeric(12,4) NOT NULL DEFAULT 0,
    target_stock_qty_base       numeric(12,4) NOT NULL DEFAULT 0,
    suggested_qty_base          numeric(12,4) NOT NULL DEFAULT 0,
    suggested_qty_purchase      numeric(12,4) NOT NULL DEFAULT 0,  -- ★ learning
    captain_final_qty_purchase  numeric(12,4) NOT NULL DEFAULT 0,  -- ★ learning
    captain_final_qty_base      numeric(12,4) NOT NULL DEFAULT 0,
    manager_final_qty_purchase  numeric(12,4) NOT NULL DEFAULT 0,  -- ★ learning
    manager_final_qty_base      numeric(12,4) NOT NULL DEFAULT 0,
    delta_vs_suggestion_pct     numeric(8,6),                      -- ★ learning
    reason_code                 text                               -- ★ learning
        CHECK (reason_code IS NULL OR reason_code IN (
            'EVENT_HIGH_TRAFFIC','WEEKEND_HIGH_TRAFFIC','LOW_STORAGE',
            'PACKAGING_LIMITATION','SUPPLIER_UNDERDELIVERS','SYSTEM_SUGGESTION_WRONG','OTHER')),
    captain_comment             text NOT NULL DEFAULT '',
    manager_comment             text NOT NULL DEFAULT ''
);
CREATE INDEX order_lines_order_id_idx ON order_lines (order_id);
CREATE INDEX order_lines_product_id_idx ON order_lines (product_id);  -- suggestion-review scan

CREATE TABLE inventory_counts (
    count_id            text PRIMARY KEY,
    location_id         text NOT NULL REFERENCES locations(location_id),
    count_date          date NOT NULL,
    count_user          text,
    count_submitted_at  timestamptz,
    line_count          integer NOT NULL DEFAULT 0,   -- denormalised
    notes               text NOT NULL DEFAULT ''
);
CREATE INDEX inventory_counts_loc_date_idx ON inventory_counts (location_id, count_date DESC);
CREATE TABLE inventory_count_lines (
    count_line_id           text PRIMARY KEY,
    count_id                text NOT NULL REFERENCES inventory_counts(count_id),
    product_id              text NOT NULL REFERENCES products(product_id),
    current_stock_qty_base  numeric(12,4) NOT NULL DEFAULT 0,
    count_comment           text NOT NULL DEFAULT ''
);
CREATE INDEX inventory_count_lines_count_id_idx ON inventory_count_lines (count_id);

CREATE TABLE receipts (
    receipt_id                text PRIMARY KEY,
    order_id                  text NOT NULL REFERENCES orders(order_id),
    location_id               text NOT NULL REFERENCES locations(location_id),
    supplier_id               text NOT NULL REFERENCES suppliers(supplier_id),
    receipt_date              date NOT NULL,
    received_by               text,
    received_submitted_at     timestamptz,
    line_count                integer NOT NULL DEFAULT 0,
    discrepancy_count         integer NOT NULL DEFAULT 0,
    received_with_missing_wz  boolean NOT NULL DEFAULT true,
    wz_photo_path_prefix      text,
    wz_photo_count            integer NOT NULL DEFAULT 0,
    notes                     text NOT NULL DEFAULT ''
);
CREATE INDEX receipts_order_id_idx ON receipts (order_id);
CREATE TABLE receipt_lines (
    receipt_line_id        text PRIMARY KEY,
    receipt_id             text NOT NULL REFERENCES receipts(receipt_id),
    order_id               text NOT NULL REFERENCES orders(order_id),
    order_line_id          text NOT NULL REFERENCES order_lines(order_line_id),
    product_id             text NOT NULL REFERENCES products(product_id),
    supplier_product_id    text NOT NULL REFERENCES supplier_products(supplier_product_id),
    ordered_qty_purchase   numeric(12,4) NOT NULL DEFAULT 0,
    received_qty_purchase  numeric(12,4) NOT NULL DEFAULT 0,
    variance_qty_purchase  numeric(12,4) NOT NULL DEFAULT 0,
    receipt_comment        text NOT NULL DEFAULT ''
);
CREATE INDEX receipt_lines_receipt_id_idx ON receipt_lines (receipt_id);
-- ===== CONFIG =====
CREATE TABLE _meta (key text PRIMARY KEY, value text);
```
Safe insert order (no circular FKs): products → suppliers → locations →
supplier_products → location_product_settings → orders → order_lines →
inventory_counts → inventory_count_lines → receipts → receipt_lines → _meta.

### 3. Sheets-era scar tissue — drop vs preserve

**OBSOLETE (delete; no Postgres analogue needed):** the entire TTL read cache
(`_ttl_cache`, `_read_with_ttl`, `DEFAULT_TTL_SECONDS=60`, `ORDERS_TTL_SECONDS=20`,
[sheets.py:55-255](supply-os-v1/app/sheets.py:55)); column-order machinery
(`_model_to_row`, `_cell_value`, `_get_column_order`, `_find_row_index`, `_normalize`,
`_validate_headers`/`ConfigDriftError`); the 429 retry `_fetch_rows_with_retry` (2 s
sleep); gspread client/scope singletons; `delete_order_lines` contiguous-range grouper
([sheets.py:614](supply-os-v1/app/sheets.py:614)) → one `DELETE WHERE order_id=`.

**REPLACE with a DB equivalent:** `OrderNotFoundError` → 0-rows-affected on
`UPDATE/SELECT … WHERE id=$1`; `OrderAlreadyDispatchedError` → conditional UPDATE
(below); `WorksheetNotFound`→503 degrade → table-missing is caught at migration/startup,
not per-request (the helpful "create the tab" 503 becomes largely moot once migrated).

**PRESERVE as behavior — the 5 status-transition 409 contracts.** These are the heart
of what must not regress. Today they're enforced via `invalidate_cache("orders")` +
re-read + status check; under Postgres each becomes a transaction + `SELECT … FOR
UPDATE` or a conditional `UPDATE … WHERE status=$expected` (0 rows → 409):

| Contract | Route | Rule | file:line |
|---|---|---|---|
| Captain edit | `PATCH /api/captain/order/{id}` | status MUST be `captain_submitted` | [main.py:932](supply-os-v1/app/main.py:932) |
| Manager claim | `POST /api/manager/claim/{id}` | MUST be `captain_submitted` → `manager_claimed` | [main.py:1113](supply-os-v1/app/main.py:1113) |
| Manager release | `POST /api/manager/release/{id}` | MUST be `manager_claimed` → `captain_submitted` | [main.py:1151](supply-os-v1/app/main.py:1151) |
| Manager dispatch | `POST /api/manager/dispatch` | MUST be `manager_claimed` → `manager_sent` (double-layer guard; [sheets.py:482](supply-os-v1/app/sheets.py:482)) | [main.py:1193](supply-os-v1/app/main.py:1193) |
| Manager save | `PATCH /api/manager/order/{id}` | MUST be `manager_claimed` (docstring notes the Sheets TOCTOU) | [main.py:1357](supply-os-v1/app/main.py:1357) |

The `manager_dispatch` write-ordering ("lines first, then status",
[main.py:1297](supply-os-v1/app/main.py:1297)) collapses into one transaction — atomicity
replaces the ordering workaround. **The migration's correctness win is exactly here:**
these become real row locks instead of cache tricks (closes the documented TOCTOU
windows — the "correctness" leg of the success bar).

**Seed-mode regression rule preserved:** `seed` stays the third tier; `_persist_*`
still degrades to in-memory + warning so "never place a real order from a test" holds
regardless of which persistent backend is active.

### 4. Connection / driver / deploy — RESOLVED

Repo facts: backend is a long-lived **sync** uvicorn on Railway
([Procfile](supply-os-v1/Procfile), [railway.toml](supply-os-v1/railway.toml), builder
RAILPACK, healthcheck `/health`); **no Postgres driver installed**; existing Supabase
config is Storage-only via `SecretStr` + lazy singleton
([config.py:51-53](supply-os-v1/app/config.py:51),
[supabase_storage.py:38-65](supply-os-v1/app/supabase_storage.py:38)).

**Recommendation (resolves the frame's LOW-confidence item):**

| Decision | Choice | Why |
|---|---|---|
| Driver | `psycopg2-binary` + SQLAlchemy Core | Sync codebase; psycopg2 uses the simple query protocol → **no prepared-statement footgun**; SQLAlchemy QueuePool reuses connections across requests for a long-lived process |
| Connection | **Supavisor Session Pooler, port 5432** | Long-lived-process semantics (1 slot = 1 backend conn); resolves to **IPv4** so no Railway IPv6 flag / no paid Supabase IPv4 add-on; NOT direct-5432 (IPv6-only) and NOT 6543 transaction pooler (serverless-oriented) |
| Pool | `pool_size=3, max_overflow=5, pool_pre_ping=True` | Single Railway worker, pilot scale; pre_ping handles idle-connection staleness |
| SSL | `sslmode=require` | Mandatory per Supabase docs |
| Secret | `SUPPLY_OS_DATABASE_URL` (`SecretStr`) | `postgresql://postgres.<ref>:<PWD>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require` — note the `postgres.<project-ref>` username convention |

This corrects two stale assumptions: the roadmap's "direct 5432" (that endpoint is
IPv6-only) and the frame's guessed "6543 transaction pooler." New deps:
`psycopg2-binary>=2.9`, `SQLAlchemy>=2.0,<3`. New config field + `is_db_configured()`
mirror the existing Storage pattern. **Owner must supply from the dashboard Connect →
Session pooler tab:** the exact pooler hostname/region, the `postgres.<ref>` username,
and the current DB password (these can't be inferred).

### 5. Backfill & cutover

**Precedent:** [scripts/sync_master_data.py](supply-os-v1/scripts/sync_master_data.py)
— additive-only (never updates/deletes), idempotent, dry-run by default + `--apply`,
covers the 4 master tabs, reuses `sheets._get_column_order`/`append_rows`. The Postgres
master-data backfill is a near-copy with `INSERT … ON CONFLICT DO NOTHING`.

**Asymmetry:** master data has local seed CSVs
([docs/pita-supply-os-v1/seed/](docs/pita-supply-os-v1/seed/) — products/suppliers/
locations/supplier_products/location_product_settings, ~134 rows each). The **6
transactional entities have NO local snapshot** — they live only in the live Sheet, so
their backfill must authenticate to Sheets, `sheets.load_orders()` + `load_order_lines()`
+ … , and write to Postgres in one pass, **preserving the audit columns**
([models.py:105-150](supply-os-v1/app/models.py:105)).

**Rollback:** `_choose_backend()` gates on `SUPPLY_OS_DATA_BACKEND`
([main.py:226](supply-os-v1/app/main.py:226)); keep the Sheets backend warm and flip the
env var + redeploy to revert — no data teardown. Mirrors the host-migration pattern.

### 6. Test / CI harness + live project state

**L6 conftest pattern** ([tests/conftest.py:25-38](supply-os-v1/tests/conftest.py:25)):
env set via `os.environ.setdefault` **before** any `app.*` import (settings load once).
Adding Supabase needs: `DataBackend.SUPABASE`, a `SUPPLY_OS_DATABASE_URL` settings
field, and one blanking line in conftest (mirrors the Storage lines 34-38).

**Mocking** (two layers, both reusable for the new backend): low-level worksheet mocks
in [test_sheets_write.py:107-145](supply-os-v1/tests/test_sheets_write.py:107); route-level
`mocker.patch.object(sheets, …)` in
[test_captain_submit.py:302-342](supply-os-v1/tests/test_captain_submit.py:302) and the
`_activate_sheet_backend` helper in
[test_manager_dispatch.py:117-140](supply-os-v1/tests/test_manager_dispatch.py:117). The
seam means no route imports the backend directly, so a `supabase_backend` is mockable the
same way.

**CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)): backend = ruff + pytest
(seed mode, no secrets); frontend = build + lint + vitest. **Gap (L1):** the Supabase path
won't be exercised by default. Two options, mirroring how Sheets is handled (its live path
is also never run in CI): (a) **mocked** `supabase_backend` function-contract tests (no new
infra, preferred for unit coverage); (b) an **ephemeral Postgres `services:` container** +
a `@pytest.mark.integration` job for real SQL behavior (transactions, the 409 conditional
updates). Recommend both — (a) for breadth, (b) to actually prove the row-lock contracts.

**Live project** (`lpzhphufjwrndfogkfub`, [https://lpzhphufjwrndfogkfub.supabase.co](https://lpzhphufjwrndfogkfub.supabase.co)):
Postgres **17.6**, `eu-west-1` (Ireland), status ACTIVE_HEALTHY, created 2026-06-05.
**0 public tables** (greenfield — DDL starts clean). Installed extensions:
`uuid-ossp`, `pgcrypto`, `pg_stat_statements`, `supabase_vault`, `plpgsql`. Available
(not installed) and potentially useful: `moddatetime` (auto `updated_at` for the future
CRUD), `pg_cron`, `pgmq`, `index_advisor`. Security advisors: none yet (expected at 0
tables).

## Code References

- `supply-os-v1/app/main.py:221-230` — `_choose_backend()` (the seam; rollback switch)
- `supply-os-v1/app/main.py:282-304` — `_persist_order` `getattr` capability probe (the idiom to generalize)
- `supply-os-v1/app/main.py` — 20 `is not sheets` guards (lines 577,659,795,864,932,1113,1151,1193,1357,1626,1683,1737,1832,1887,1990,2066,2176,2220,2306,2391)
- `supply-os-v1/app/sheets.py:55-316` — TTL cache + invalidate (OBSOLETE)
- `supply-os-v1/app/sheets.py:340-447` — column-order serialization (OBSOLETE)
- `supply-os-v1/app/sheets.py:482-534` — `update_order` double-layer dispatch guard (PRESERVE behavior)
- `supply-os-v1/app/models.py:13-43` — the 4 enums; `:105-150` — Order/OrderLine (★ learning cols)
- `supply-os-v1/app/config.py:15-17` — `DataBackend`; `:51-53` — Supabase Storage `SecretStr` pattern
- `supply-os-v1/app/supabase_storage.py:38-65` — `is_configured()` + lazy singleton to reuse
- `supply-os-v1/scripts/sync_master_data.py:1-75` — additive backfill precedent
- `supply-os-v1/tests/conftest.py:25-38` — L6 env-first pattern
- `supply-os-v1/tests/test_manager_dispatch.py:117-140` — `_activate_sheet_backend` mock helper
- `.github/workflows/ci.yml:13-53` — backend + frontend jobs

## Architecture Insights

- **The seam was built for a two-backend binary** (`sheets`=persistent, else=degrade);
  `not sheets` is a load-bearing convention (lessons.md + 5 archived changes). A third
  *persistent* backend breaks that proxy — so the migration is **first a seam-contract
  repair, then a new module**. This is the frame's reframe, now confirmed at code level.
- **The migration's real prize is correctness, not just speed.** The 5 status-transition
  409 contracts become genuine transactions + row locks — the documented TOCTOU "v0
  trade-offs" close. Speed improves on the backend (6 serial Sheets reads → 1 query) but
  the cacheless frontend remains a co-bottleneck (flagged follow-up, boundary deferred).
- **Security: enable RLS deny-all on every table.** Supabase auto-exposes the public
  schema via PostgREST with the anon key. The backend connects with a privileged Postgres
  role (bypasses RLS), so a deny-all policy on every table locks the public REST API
  *without* breaking the app — and silences the security advisor that will fire once tables
  exist. Design this into the DDL migration, not after.
- **Keep it plain Postgres behind the seam** (no Supabase Auth/RLS-as-app-logic coupling)
  to preserve Neon/RDS portability — per `infrastructure.md`'s lock-in caution.

## Historical Context (from prior changes)

- [context/changes/supabase-backend/frame.md](context/changes/supabase-backend/frame.md) — the reframe this research grounds (seam-leak is the crux; pooler/asyncpg mis-aimed).
- `context/foundation/infrastructure.md:223-244` — datastore decision (Supabase, runner-up Neon), the pooler footgun text (now shown to be droplet-era), "~1–2 day port" estimate (contradicted — it counts the module, not the 20-guard refactor + 12-entity schema + backfill).
- `context/archive/2026-06-16-wz-photos-supabase-storage/` — first Supabase use (Storage); established the `SecretStr` + lazy-client config pattern this backend reuses.
- `context/archive/2026-06-09-bukat-suggestion-learning-loop/plan.md`, `context/archive/2026-06-09-inventory-manager-view/plan.md` — codified the `if backend is not sheets: return []` degrade idiom now being generalized.
- `context/foundation/lessons.md` — L1 (CI must run the product), L2 (never bypass the seam), L3 (secrets off-repo), L6 (conftest env), and "verify prod actually runs" (seed-green ≠ sheet/Supabase-correct).

## Related Research

- None prior for S-10. This is the first research artifact; pairs with `frame.md` in the same change folder.

## Open Questions

1. **Owner-supplied connection secrets** — exact Session-Pooler hostname/region, the
   `postgres.<ref>` username, and current DB password (dashboard → Connect → Session
   pooler). Needed before any connectivity test. *(Owner; blocking implementation.)*
2. **RLS policy shape** — deny-all on all tables (recommended) vs leave RLS off + accept
   advisor warnings. Decide in `/10x-plan`; affects the DDL migration. *(Recommend deny-all.)*
3. **Enum value name** — `DataBackend.SUPABASE` (recommended) vs `POSTGRES`. Trivial; settle in plan.
4. **Backfill verification** — how to prove the transactional backfill preserved the 5
   learning columns (e.g. row-count + checksum of `suggestion-review` output Sheets-vs-PG).
5. **Frontend speed boundary** — in S-10 or a separate change (you chose "flag for
   planning"). `/10x-plan` decides.
6. **CI integration depth** — mocked-only vs add an ephemeral Postgres service to actually
   exercise the row-lock 409 contracts. *(Recommend both.)*
