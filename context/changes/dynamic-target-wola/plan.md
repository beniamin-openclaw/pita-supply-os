# Dynamic target for Wola — implementation plan

Change: `dynamic-target-wola` · Date: 2026-09-07 · Upstream: `change.md`, `research.md`,
`docs/pita-supply-os-v1/analysis/gostock-2026-09-06/target_seed.csv`.
Revision 2 (2026-09-07): after the independent plan review and the adversarial hardening
review — see `reviews/plan-review.md` and `reviews/hardening.md`; the decisions taken are
listed in "Hardening decisions" below and folded into the phases.

## Overview

Replace the static `target_stock_qty_base` with a computed one wherever a location × product
has a trusted daily-usage estimate and the supplier has a parseable weekday delivery calendar:

```
days_until_delivery = delivery_date − today                       (delivery_date = max(requested, today))
horizon_days        = next_delivery_date − delivery_date
safety_base         = ceil_unit(max(usage × safety_days, min(min_stock_qty_base, usage × SAFETY_CAP_DAYS)))
target_dynamic      = ceil_unit(usage × (days_until_delivery + horizon_days) + safety_base)
effective_max       = max(max_stock_qty_base, target_dynamic)
suggestion          = existing engine: max(0, target_dynamic − current) → purchase units
```

`ceil_unit` rounds up to 0.1 for `kg` and to a whole unit otherwise; it rounds the base-unit
target only — the purchase-unit suggestion still goes through `_round_per_rule`. Two `ceil_unit`
calls: safety first (so the card shows a value on the same grid), then the total.
`SAFETY_CAP_DAYS = 3`: `min_stock_qty_base` acts as the safety floor, but a stale `min` can add at
most three days of usage (the Wola beverage rows carry "ESTIM" mins of 12–24 szt = 2–7 weeks).
Worked example, Wola gyros on Monday 2026-09-07 (usage 12.75 kg/day, min 2 kg, Pago Tue+Sat):
safety = ceil_unit(max(12.75, min(2, 38.25))) = 12.8; target = ceil_unit(12.75 × 5 + 12.8) = 76.6 kg.
Coca-Cola Zero (7.77/day, min 24, Thu): safety = max(7.77, min(24, 23.31)) → 24 (ceil of 23.31 = 24);
target = ceil(77.7 + 24) = 102 szt.

Everything else in the suggestion engine, the reason gates and the order-line snapshot stays as it
is; the engine just receives a different `target` (and, for the uncounted over-MAX gate, a max that
is never below the target). The Captain sees the math on the card.

## Hardening decisions (from the two reviews)

| # | Finding | Decision |
|---|---|---|
| H1 | Dynamic target above static `max` trips the uncounted over-MAX gate and shows "Cel 76 · Max 10" | `effective_max = max(max, target_dynamic)` in the orderable item and in `_evaluate_submit_line`'s uncounted branch when the target is dynamic; `TargetSource.max_raised_from` records the static max. `prod-sql.sql` section D (max = 7-day cover) is **mandatory** together with B. |
| H2 | Unaudited `min` becomes the safety floor | `SAFETY_CAP_DAYS = 3` (formula above); section E in `prod-sql.sql` proposes lowered mins for the slow beverage rows (operator decision, optional). |
| H3 | Calendars "optional" contradicts Desired End State | Section C (Pago `Tue, Sat`, Coca-Cola `Thu`) is **mandatory** and ordered BEFORE B in `prod-sql.sql`; with a single-weekday Pago calendar the engine would compute a 7-day horizon. |
| H4 | `OrderEditPage` replaces items with the fresh orderable list (feedback r6), so the snapshot-target gate would diverge | Frontend overlays `line.target_stock_qty_base` (and `max = max(item.max, line.target)`, `target_source = undefined`) onto any orderable item whose product is on the order. Backend edit uses the snapshot for those lines. |
| H5 | `requested_delivery_date` from the client steers the gate | Backend accepts it only when `today ≤ date ≤ today + 14` AND its weekday is in the supplier calendar; otherwise it uses its own `next_delivery_date(weekdays, today)`. `today` for the math is always `_today_warsaw()`. |
| H6 | Negative/NaN usage → `ValueError` 500 on the whole submit | `LocationProductUsage.usage_per_day_base` / `safety_days` are `Field(ge=0)`; the engine returns static for non-finite or ≤ 0 inputs; `_evaluate_submit_line` catches `ValueError` from `compute_suggestion` on a dynamic target and degrades that line to the static target (logged). |
| H7 | Degrade helper must catch any exception (Supabase raises `ProgrammingError`, not `WorksheetNotFound`) | `_load_usage_safe` catches `Exception`. |
| H8 | `test_orderable_active_filter` stub has no `load_suppliers` | `_build_orderable_item` keeps its 3-arg signature (no change to `test_orderable_order_note.py`); the dynamic overlay is a separate step in `_build_orderable_items` that runs only when the flag is on, and loads suppliers/usage via `getattr` best-effort. |
| H10 | Usage loaded even with the flag off | Flag checked before any backend call; test asserts the loader is never called when disabled. |
| H11 / review H2 | Numeric `delivery_days` ("3") parsed by FE, not BE | Backend keeps weekday-token calendars only → static with `reason=no_calendar`; documented and tested. |
| H13 / H14 | No persisted `target_mode`; Manager sees a bare number | Accepted for v1 and recorded in `change.md` as a known limitation (an `order_lines` column needs a migration-before-code deploy the operator gates). Follow-up change. |
| H15 | "Poniżej minimum" compares against raw `min` while safety derives from it | When dynamic, the below-minimum signal compares against `target_source.safety_base`. |
| H17 | Newly added product on edit used the stale stored date | Newly added products resolve with `requested_delivery_date=None` (fresh lookup). |
| H19 | UTC `today` vs Warsaw `today` in the same function | New local variable `today_warsaw` from `_today_warsaw()`; never the UTC `today` used for order ids. |
| C1 | `_build_orderable_item` signature | unchanged (see H8). |
| C2 | New table not in `tests/test_supabase_integration.py` | Migration 0018 wired into `_schema`, table added to `_ALL_TABLES`, one insert-and-read smoke test. |
| C3 | Worked example vs formula | Two-stage rounding pinned above and in a named unit test. |
| Review H1 | DDL not written anywhere | DDL inline in Phase 1. |
| Review W1 | Clamp semantics | `delivery_date = max(requested, today)` before any arithmetic (covered by H5). |
| Review LOW | `_DATE_COLS` / column list dead for a read-only table | Column list kept (the integration smoke test inserts through `_insert`); `as_of` added to `_DATE_COLS` for the same reason. `seed_loader` loader wraps `FileNotFoundError` explicitly. |

## Current State Analysis

- `main._build_orderable_item` emits `target_stock_qty_base` straight from
  `LocationProductSetting`; the frontend (`captain-mp/lib/compute.ts`) derives the suggestion
  from that field; `main._evaluate_submit_line` recomputes from `setting.target_stock_qty_base`
  (two uses: the suggestion input and the line snapshot) and gates the uncounted over-MAX case on
  `setting.max_stock_qty_base`.
- `main._parse_weekdays` / `WEEKDAY_MAP` parse `Supplier.delivery_days` for the cutoff badge
  (English + Polish tokens, `daily`; no numeric form). The frontend copy
  (`captain-mp/lib/dates.ts`) additionally accepts a numeric "N days" form.
- `requested_delivery_date` is computed by the frontend at submit time (browser-local date, no
  cutoff) and stored on the order; the backend only stores it today.
- `OrderEditPage` builds items from line snapshots, then (feedback r6) replaces them with the
  fresh orderable list for every product still orderable.
- Master data reads: `seed_loader` (CSV, raises `FileNotFoundError`), `sheets` (`_read_with_ttl`,
  raises `WorksheetNotFound`), `supabase_backend` (`_fetch_all`, raises SQLAlchemy errors on a
  missing table). Seam parity test requires every public `sheets` function on `supabase_backend`.
  `tests/test_supabase_integration.py::_schema` applies every migration in order (CI job
  `backend-integration` runs it against a real Postgres).
- Tests run in seed mode (`SUPPLY_OS_DATA_BACKEND=seed` in `tests/conftest.py`), 658 collected.
- Prod: Pago `delivery_days='Tue'`, Coca-Cola `'TBD'`; Wola targets for Pago cover 0.5–1.8 days,
  for Coca-Cola 15–180 days; 12 of the 18 Wola rows carry `notes = 'ESTIM - verify…'`.

## Desired End State

- Wola Captain (and the Manager Transport grid / add-line for Wola) sees a dynamic target for the
  Pago and Coca-Cola SKUs that have an A/B usage row once the operator has run `prod-sql.sql`
  sections A–D (migration, calendars, usage rows, max ceilings).
- Every other location × product keeps the static target, byte-identically.
- Submit/edit gates use the same target the Captain saw; the order line snapshots it.
- A kill switch (`SUPPLY_OS_DYNAMIC_TARGET_ENABLED=false`) restores today's behaviour.

### Success Criteria

#### Automated Verification
- `cd supply-os-v1 && ruff check . && python -m pytest` green (658 existing + new).
- `cd frontend && npm run build && npm run lint && npm run test` green.
- Seam parity test passes with `load_location_product_usage` on all three backends.

#### Manual Verification
- Local seed run with the flag on and a scratch Coca-Cola calendar: Coca-Cola / Zero cards show
  the dynamic badge + math, Kinley shows the static header; submit accepting the suggestion → 200.

## What We're NOT Doing

- No weekday weights, no seasonality, no live usage computation from Supply OS counts.
- No Captain-selectable delivery date; no minimum-order assistant.
- No prod writes from this change (SQL delivered as a file).
- No `order_lines` column for the target mode (known limitation, see change.md).
- No numeric "N days" calendar support in the backend engine.

## Phase 1: Engine, model, seam, migration, seed

### Overview
Pure computation module + master-data plumbing. No route changes yet.

### Changes Required

- `supply-os-v1/app/models.py`
  - `LocationProductUsage`: `usage_id`, `location_id`, `product_id`,
    `usage_per_day_base: float = Field(ge=0)`, `confidence: str` (A/B/C), `basis: str = ""`,
    `source: str = ""`, `as_of: Optional[date] = None`, `safety_days: float = Field(default=1.0, ge=0)`,
    `active: bool = True`, `notes: str = ""`.
  - `TargetSource`: `mode: Literal["static","dynamic"]`, `static_target_base: float`,
    `usage_per_day_base`, `confidence`, `delivery_date`, `next_delivery_date`,
    `days_until_delivery`, `horizon_days`, `safety_days`, `safety_base`, `max_raised_from`
    (all Optional, default None), `reason: str = ""` (`disabled` / `no_usage` / `inactive` /
    `confidence_c` / `zero_usage` / `no_calendar` / `invalid_input`).
- `supply-os-v1/app/dynamic_target.py` (new, pure, no I/O, no `date.today()`)
  - `WEEKDAY_MAP`, `parse_delivery_weekdays(raw)` (moved from `main.py`; `main` re-exports both
    under the old names), `next_delivery_date(weekdays, after)` (offsets 1..14, mirrors the FE
    weekday branch), `ceil_unit(value, inventory_unit)`, `SAFETY_CAP_DAYS = 3`,
    `compute_dynamic_target(...)`, `resolve_delivery_window(weekdays, today, requested)` (H5
    validation), `resolve_effective_target(setting, usage, supplier, inventory_unit, today,
    requested_delivery_date, enabled) -> tuple[float, float, TargetSource]` (target, effective
    max, source).
- `supply-os-v1/app/config.py`: `dynamic_target_enabled: bool = True`.
- `supply-os-v1/tests/conftest.py`: `SUPPLY_OS_DYNAMIC_TARGET_ENABLED=false` via `setdefault`.
- `supply-os-v1/app/seed_loader.py`: `load_location_product_usage()` → `[]` on `FileNotFoundError`.
- `supply-os-v1/app/sheets.py`: `load_location_product_usage()` via `_read_with_ttl`.
- `supply-os-v1/app/supabase_backend.py`: `_LOCATION_PRODUCT_USAGE_COLUMNS`, `as_of` in
  `_DATE_COLS`, `load_location_product_usage()`.
- `supply-os-v1/migrations/0018_location_product_usage.sql`:
  ```sql
  CREATE TABLE location_product_usage (
      usage_id            text            PRIMARY KEY,
      location_id         text            NOT NULL REFERENCES locations(location_id),
      product_id          text            NOT NULL REFERENCES products(product_id),
      usage_per_day_base  numeric(12,4)   NOT NULL CHECK (usage_per_day_base >= 0),
      confidence          text            NOT NULL
          CONSTRAINT location_product_usage_confidence_check CHECK (confidence IN ('A','B','C')),
      basis               text            NOT NULL DEFAULT '',
      source              text            NOT NULL DEFAULT '',
      as_of               date,
      safety_days         numeric(6,2)    NOT NULL DEFAULT 1 CHECK (safety_days >= 0),
      active              boolean         NOT NULL DEFAULT true,
      notes               text            NOT NULL DEFAULT '',
      CONSTRAINT location_product_usage_unique UNIQUE (location_id, product_id)
  );
  ALTER TABLE location_product_usage ENABLE ROW LEVEL SECURITY;
  -- Rollback: DROP TABLE IF EXISTS location_product_usage;
  ```
- `supply-os-v1/tests/test_supabase_integration.py`: apply 0018 in `_schema`, add the table to
  `_ALL_TABLES`, one insert-and-read smoke test.
- `docs/pita-supply-os-v1/seed/location_product_usage.csv`: the 18 WOLA rows.
- `docs/pita-supply-os-v1/DATA_MODEL.md`: new section + note on the order-line snapshot.
- Tests: `tests/test_dynamic_target.py` (calendar parsing parity incl. `daily`, Polish tokens,
  numeric → None; `next_delivery_date` Mon + `Tue, Sat`; Pago 1+4 and Coca-Cola 3+7 horizons;
  the two named worked examples; safety cap; kg vs szt rounding; every static reason; disabled;
  H5 window validation incl. past date, far-future date, wrong weekday; effective max);
  `test_seed_loader.py` missing file → `[]`; `test_sheets_read.py` + `test_supabase_backend.py`
  one read test each.

### Success Criteria

#### Automated Verification
- `python -m pytest tests/test_dynamic_target.py tests/test_seed_loader.py tests/test_sheets_read.py tests/test_supabase_backend.py` green; `ruff check .` green.

## Phase 2: Route wiring

### Changes Required

- `supply-os-v1/app/main.py`
  - `_today_warsaw()`; `_load_usage_safe(backend)` (flag off → `{}` without touching the backend;
    any exception → log + `{}`); `_supplier_safe(backend, supplier_id)` best-effort for the
    display path only (the submit path keeps its hard 400).
  - `_build_orderable_items`: after building the static dicts, when the flag is on, overlay
    `target_stock_qty_base`, `max_stock_qty_base` and `target_source` from
    `resolve_effective_target(..., requested_delivery_date=None)`.
  - `_MasterData` gains `usage_by_pid`; `_resolve_master_data` loads it via `_load_usage_safe`.
  - `_evaluate_submit_line(..., effective_target, effective_max)`; `ValueError` from
    `compute_suggestion` on a dynamic line → static fallback + log.
  - `captain_submit`: per line `resolve_effective_target(..., req.requested_delivery_date)`.
  - `captain_order_edit`: lines whose product was on the original order → snapshot target and
    `max(setting.max, snapshot)`; new products → fresh resolve with `None`.
- Tests: `tests/test_dynamic_target_routes.py` — flag patched on via `mocker.patch.object`,
  `main._today_warsaw` patched to Monday 2026-09-07, suppliers patched to `Thu` for Coca-Cola:
  orderable dynamic for P068 / static `confidence_c` for P079; submit accepting the suggestion →
  200 without deviation warning and snapshot = dynamic target; submit with a far-future / wrong
  weekday `requested_delivery_date` uses the server window; edit reuses the snapshot; a backend
  whose loader raises → 200 static; flag off → loader never called; `test_orderable_active_filter`
  and `test_orderable_order_note` unchanged and green.

### Success Criteria

#### Automated Verification
- Full backend suite green; `ruff check .` green.

## Phase 3: Frontend

### Changes Required

- `frontend/src/types.ts`: `TargetSource` (all optional fields `?:`), `OrderableItem.target_source?`.
- `frontend/src/i18n/strings.ts`: `card.dynamicBadge`, `card.dynamicMath`, `card.dynamicDates`,
  `dates.delivery.window`.
- `ProductCard.tsx`: badge + math line when `target_source?.mode === "dynamic"`; below-minimum
  compares against `safety_base` when dynamic. Static items unchanged.
- `ContextStrip.tsx`: optional `deliveryWindow` prop; `CaptainMP.tsx` derives it from the first
  dynamic item.
- `OrderEditPage.tsx`: overlay snapshot target/max onto fresh orderable items for products on the
  order (H4).
- Tests: `ProductCard.test.tsx` (dynamic badge + math, static unchanged), `ContextStrip.test.tsx`
  (window text), `OrderEditPage` overlay covered by a pure helper `overlaySnapshotTargets` +
  unit test in `captain-mp/lib/`.

### Success Criteria

#### Automated Verification
- `npm run build`, `npm run lint`, `npm run test` green.

#### Manual Verification
- Local seed click-through as described in Success Criteria.

## Phase 4: Prod SQL package, docs, verification

### Changes Required

- `context/changes/dynamic-target-wola/prod-sql.sql`: A migration 0018; C supplier calendars
  (BEFORE values, before B); B INSERT 18 usage rows (BEFORE count = 0, DELETE rollback); D max
  ceilings = 7-day cover for the 18 rows (BEFORE values); E optional lowered mins; AFTER audit.
- `docs/pita-supply-os-v1/analysis/gostock-2026-09-06/README.md`: pointer to this change.
- `/verify` full run; record in `change.md`.

### Success Criteria

#### Automated Verification
- `/verify` green: ruff, pytest, vite build, eslint.

#### Manual Verification
- `git status` shows no secrets; `prod-sql.sql` reviewed for BEFORE/AFTER.

## Testing Strategy

- Engine tests pin `today`; route tests patch `settings.dynamic_target_enabled` and
  `main._today_warsaw` with `mocker.patch.object` (never `os.environ[...]`).
- Frontend tests are rendering-only plus one pure overlay helper.

## Migration Notes

Prod order: A (0018) → C (calendars) → B (usage rows) → D (max) → deploy code. Code deployed
first degrades to static targets (helper catches the missing table). Kill switch optional.

## References

- `research.md`, `change.md`, `reviews/plan-review.md`, `reviews/hardening.md`.
- `docs/pita-supply-os-v1/analysis/gostock-2026-09-06/README.md`, `target_seed.csv`.
- `context/changes/week1-feedback-targets/plan.md`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Engine, model, seam, migration, seed

#### Automated

- [x] 1.1 Models LocationProductUsage + TargetSource
- [x] 1.2 dynamic_target.py engine with unit tests
- [x] 1.3 Config flag + conftest default off
- [x] 1.4 Seam loaders (seed / sheets / supabase) + parity + integration fixture
- [x] 1.5 Migration 0018 + seed CSV + DATA_MODEL.md

### Phase 2: Route wiring

#### Automated

- [x] 2.1 Orderable items carry effective target + target_source
- [x] 2.2 Submit gate uses effective target (requested_delivery_date)
- [x] 2.3 Edit reuses snapshot target
- [x] 2.4 Route tests incl. degraded backend

### Phase 3: Frontend

#### Automated

- [x] 3.1 Types + i18n
- [x] 3.2 ProductCard dynamic badge + math line + tests
- [x] 3.3 ContextStrip delivery window + CaptainMP wiring
- [x] 3.4 OrderEditPage snapshot overlay + test

#### Manual

- [x] 3.5 Local seed click-through (Coca-Cola dynamic, Kinley static)

### Phase 4: Prod SQL package, docs, verification

#### Automated

- [x] 4.1 /verify green

#### Manual

- [x] 4.2 prod-sql.sql with BEFORE/AFTER reviewed
