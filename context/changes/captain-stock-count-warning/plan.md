# Captain stock-count warning (D6, WP12) — Implementation Plan

## Overview

A per-location flag `locations.require_stock_count` (ON everywhere except NORBLIN and
ELEKTROWNIA) makes the Captain's pre-submit dialog warn, without blocking, when the supplier's
cards carry no stock count or only zeros. Decisions and their reasons are in `change.md`.

## Current State Analysis

- `Location` (`supply-os-v1/app/models.py:119-151`) has no stock-count field. Supabase reads
  locations with `SELECT *` (`supabase_backend.py:329`) and binds `_LOCATION_COLUMNS`
  (`supabase_backend.py:105-110`) only on insert (`scripts/backfill_supabase.py:40`, the
  integration fixture). Seed reads `locations.csv` by header (`seed_loader.py:85`, TRUE/FALSE →
  bool in `_normalize`). Sheets reads by header (`sheets.py:270`). A missing column falls back to
  the model default in all three.
- `GET /api/captain/orderable` (`main.py:487-512`) returns a bare list of dicts built by
  `_build_orderable_items` / `_build_orderable_item` (`main.py:221-276, 279-382`). The location
  comes from the token (`require_captain`). Each item already carries a non-item flag,
  `suggestion_alerts_enabled`.
- The pre-submit dialog is `ConfirmSubmitDialog.tsx`, rendered at `CaptainMP.tsx:1176` and fed
  `criticalMissing` (`CaptainMP.tsx:824-836`) and, from WP6, `sentToday`. Either warning turns
  the send button into "Wyślij mimo to". (Line numbers are on the WP6 base, d990bb5.)
- Blank stock is "not counted" by design (`strings.ts:987`, `buildPayloadLines.ts`); the backend
  accepts it (`main.py` uncounted path). Nothing warns about it.

## Desired End State

- Migration 0030 adds `locations.require_stock_count boolean NOT NULL DEFAULT true`.
- Every `/api/captain/orderable` item carries `require_stock_count` for the token's location;
  seed NORBLIN reads `false`, WOLA `true`.
- On a location with the flag ON, the confirm dialog shows a stock block for `missing` /
  `allZero` (rule in `change.md` decision 3) and the button reads "Wyślij mimo to"; confirming
  still submits. With the flag OFF (Norblin, Elektrownia) the dialog is unchanged.
- `prod-sql.sql` sets NORBLIN and ELEKTROWNIA to `false` behind a guard, with before, audit and
  rollback.

### Key Discoveries:

- `_build_orderable_items` already loads locations for `effective_supplier_products`; the flag
  lookup reuses that list (`main.py:347`, helper `main.py:406`).
- The confirm dialog is shared with nothing else; WP6 added its first tests
  (`ConfirmSubmitDialog.test.tsx`).
- Vitest page tests for `CaptainMP` render fine on local Node 25; only their localStorage draft
  assertions fail there (`stickyBulkReason.test.tsx`). CI runs Node 20.

## What We're NOT Doing

- No server-side gate or 4xx: the backend submit is untouched.
- No warning on the edit screen (`OrderEditPage`), the inventory count, or the Manager screens.
- No admin UI for the flag; it is changed by SQL.
- No change to the blank-vs-0 rule or to what is sent.

## Implementation Approach

Backend first (migration, model, seed, endpoint, tests), then a pure frontend helper with its
tests and the i18n copy, then the smallest possible dialog edit. Before touching
`CaptainMP.tsx` or the dialog, check `origin/claude/captain-sent-today` (WP6) and stack on it if
it exists. Outcome: WP6 was pushed as PR #69 (d990bb5) during Phase 2; this branch was moved
onto it and the dialog conflict resolved (see `change.md`, Coordination).

## Phase 1: Backend flag

### Changes Required:

#### 1. Migration 0030
**File**: `supply-os-v1/migrations/0030_location_require_stock_count.sql` — header in the 0026
style (purpose, numbering, no percent sign, apply-before-backend, rollback), then
`ALTER TABLE locations ADD COLUMN IF NOT EXISTS require_stock_count boolean NOT NULL DEFAULT true;`

#### 2. Model, columns, seed
- `models.py` `Location.require_stock_count: bool = True` (not Optional: NOT NULL column bound
  on insert).
- `supabase_backend._LOCATION_COLUMNS` += `"require_stock_count"`.
- Seed `locations.csv`: new column, NORBLIN `FALSE`, others `TRUE`.
- `scripts/backfill_supabase.py` docstring: Sheet-only locations land with the default (ON).

#### 3. Endpoint
- `_build_orderable_item(..., require_stock_count: bool = True)` adds the key.
- `_build_orderable_items` resolves the location's flag once (`True` when the location is
  unknown) and passes it to every item.

#### 4. Tests
- New `tests/test_require_stock_count.py`: model default when the field is absent; seed loader
  (NORBLIN false, WOLA true); endpoint per location (WOLA true, NORBLIN false via a patched
  captain token, unknown location true); builder stub with no locations → true.
- `test_supabase_integration.py`: wire 0030 into `_schema`; round-trip (default true, explicit
  false); 0030 re-runnable and free of `%`.

### Success Criteria:

#### Automated Verification:
- `cd supply-os-v1 && python3 -m pytest -q`
- `cd supply-os-v1 && python3 -m ruff check .`
- Integration suite on a local Postgres 16: `python3 -m pytest -m integration -q`

## Phase 2: Frontend helper, copy, dialog

### Changes Required:

#### 1. Types
`src/types.ts` `OrderableItem.require_stock_count?: boolean` (optional: absent = ON; the edit
screen and Manager rebuild items without it).

#### 2. Helper
`src/pages/captain-mp/lib/stockCountWarning.ts`:
`requiresStockCount(items): boolean` and
`stockCountWarning(items, lines): "none" | "missing" | "allZero"`. Explicit types.
Tests in `stockCountWarning.test.ts`.

#### 3. Copy
`strings.ts`: `confirm.stockMissing`, `confirm.stockAllZero`, `confirm.stockMissingAsk`,
`confirm.stockAllZeroAsk` (pl + en).

#### 4. Dialog + page (after the WP6 check)
- `ConfirmSubmitDialog`: optional prop `stockWarning?: StockCountWarning` (default `"none"`);
  one amber block with its own id in `aria-describedby`; the button reads "Wyślij mimo to"
  when any warning shows.
- `CaptainMP`: `useMemo(() => stockCountWarning(orderableItems, lines))`, passed to the dialog.

#### 5. Tests
- `ConfirmSubmitDialog.test.tsx` (WP6's file, a separate `describe`): block shown per kind,
  absent for `"none"` or no prop, all three warnings described together, confirm still calls
  `onConfirm`, back cancels.
- `captainSentToday.test.tsx` (WP6): `fillOrder` types a real count (10 / 40) so its plain
  confirm is not an all-zero case.
- `stockCountWarning.page.test.tsx`: `CaptainMP` with a mocked `api`; empty stocks → warning,
  "Wyślij mimo to" → `captainSubmit` called once; flag OFF → no warning, submit called.

### Success Criteria:

#### Automated Verification:
- `cd frontend && npm run build`, `npm run lint`, `npx vitest run` (3 known local Node 25
  failures excepted).

## Phase 3: Prod SQL, PR

#### 1. `prod-sql.sql`
Sections A BEFORE (read-only), B migration 0030, C one guarded DO block (column exists; exactly
NORBLIN and ELEKTROWNIA present; both still `true`; no other row `false`; UPDATE with
ROW_COUNT = 2), D AUDIT (expected rows), E ROLLBACK. Dry-run A–D on a local Postgres with a
copy of the prod location ids.

#### 2. PR
Body: operator order (SQL → merge), stacking note (WP6), Polish live checklist that never sends
a real order.

### Success Criteria:

#### Automated Verification:
- CI green (backend, backend-integration, frontend).

#### Manual Verification:
- Operator applies `prod-sql.sql`, audit matches.
- Live: Wola shows the warning with empty stocks (cancel in the dialog); Norblin shows none.

## Testing Strategy

Unit: helper truth table (flag off, backups, blank vs 0, mixed). Component: dialog. Page:
CaptainMP submit path with a mocked `api` (no network, no real order). Backend: model, seed,
endpoint, real-Postgres round-trip.

## Migration Notes

Additive, re-runnable. Rollback: data `UPDATE locations SET require_stock_count = true WHERE
location_id IN ('NORBLIN','ELEKTROWNIA')`; schema `ALTER TABLE locations DROP COLUMN IF EXISTS
require_stock_count` (reads tolerate a missing column; only the backfill/fixture insert binds it).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backend flag

#### Automated

- [x] 1.1 Backend suite passes: `cd supply-os-v1 && python3 -m pytest -q` — 1136 passed (WP6 base), uncommitted
- [x] 1.2 Lint passes: `cd supply-os-v1 && python3 -m ruff check .` — uncommitted
- [x] 1.3 Integration suite passes on a local Postgres 16 with 0030 applied — 39 passed, uncommitted

### Phase 2: Frontend helper, copy, dialog

#### Automated

- [x] 2.1 Frontend tests pass: `cd frontend && npx vitest run` — 985 passed, 3 known Node 25 localStorage failures, uncommitted
- [x] 2.2 Frontend build passes: `cd frontend && npm run build` — uncommitted
- [x] 2.3 Frontend lint passes: `cd frontend && npm run lint` — uncommitted

### Phase 3: Prod SQL, PR

#### Automated

- [x] 3.1 prod-sql A–D dry-run clean on a local Postgres — 2 off / 11 on; re-run and missing-id guards fire
- [ ] 3.2 CI green on the PR (backend, backend-integration, frontend)

#### Manual

- [ ] 3.3 prod-sql.sql applied by the operator, audit matches (operator go)
- [ ] 3.4 Merged and live (operator go)
- [ ] 3.5 Live check: Wola warning shown and cancelled; Norblin no warning
