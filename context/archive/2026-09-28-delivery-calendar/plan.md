# Delivery Calendar Implementation Plan

## Overview

Give the Captain a visible, editable delivery date on the order screen. It defaults to a
server-computed proposal from Marek's ordering rules (per supplier, optionally per location,
17:00 Europe/Warsaw order deadline). The app records both the proposal and the Captain's
choice so the Manager sees a subtle marker when they differ. On Thursdays, Captains of
suppliers flagged as in scope get an informational "na 1 dzień / na 3 dni" choice, which is
stored on the order for the Manager. The 17:00 deadline replaces the supplier cutoff on the
Captain's context strip. Nothing blocks the Captain; the suggestion math is untouched.

## Current State Analysis

(Lifted from `frame.md` and `research.md`.)

- The Captain never sees the delivery date. `CaptainMP.tsx:516-519` computes it at submit
  with `getRequestedDeliveryDate(supplier.delivery_days)`. That function uses the browser clock,
  falls back to tomorrow, and serialises through `toISOString()`, so it is a day early between
  00:00 and 02:00 Warsaw. No state, input, draft field or confirm-dialog line exists.
- The screen does not know its location (`CaptainMP.tsx:5-7`, `:685`). The backend derives it
  from the token (`require_captain`, `app/auth.py`).
- `ContextStrip.tsx:13-49` shows `supplier.cutoff_time` as "Wyślij do dziś {time}" with a
  local-time urgency colour. The Manager `cutoff_iso` (`main.py:827-850`, `:955`) is a separate
  supplier-side value and stays as is.
- Manager order screens have no over-max marker. The subtle Manager over-max flag lives on the
  inventory page: amber-700 text + `AlertTriangle size={12}` (`ManagerInventoryPage.tsx:302-325`).
- `requested_delivery_date` flows `CaptainSubmitRequest` → `Order` → `ManagerQueueItem`,
  `ManagerOrderDetail`, `CaptainOrderListItem`, `CaptainOrderDetail`. Both e-mail builders
  deliberately ignore it (`gmail_url.py:143-153`, `emailBody.ts:120-125`).
- `suppliers.delivery_days` / `cutoff_time` are mostly `TBD` in prod and cannot express
  per-location windows or lead times.

## Desired End State

- A Captain opening an order for WOLA × Pago on a Tuesday sees "Data dostawy: śr. <next week>"
  prefilled, a hint "Proponowana wg kalendarza dostaw", and the strip "Zamów do pon. 17:00".
  They can pick any other date; submitting stores `requested_delivery_date` (their choice) and
  `suggested_delivery_date` (the rule-based proposal).
- A supplier without a rule keeps today's default ("jutro" or `delivery_days`), labelled
  "Brak kalendarza dostaw — sprawdź datę", and stores no proposal.
- On a Thursday (Warsaw calendar day), Bukat or Intermlecz orders show the choice banner with
  "Pamiętaj o ilościach na 3 dni!". Picking a value stores `coverage_days`, and not picking
  one is fine.
- The Manager queue row and order detail show an amber "⚠ inna niż proponowana (<date>)"
  only when both dates exist and differ, plus "na 1 dzień / na 3 dni" when set. Archive views
  inherit both.
- Rules live in `supplier_delivery_rules` (one shared row per supplier or per-location rows),
  seeded by an operator-run `prod-sql.sql`. A pure `delivery_window(...)` function returns
  (next delivery, following delivery, order deadline) for a later dynamic-target lane.

Verified by backend pytest (engine, route, persistence, integration on Postgres), frontend
Vitest (helpers and components), and a prod check after the operator applies the migration and
seed.

### Key Discoveries:

- `_ORDER_COLUMNS` (`supabase_backend.py:118-125`) silently drops unknown keys in
  `update_order` / `replace_order_lines_atomic`; `_DATE_COLS` (`:170-175`) must list a new DATE
  column for the ISO-string cast.
- The integration fixture reads every migration by name and drops `_ALL_TABLES`
  children-first (`test_supabase_integration.py:52-229`); adding a column to
  `_SUPPLIER_COLUMNS` makes the fixture's supplier insert depend on the new migration.
- `test_supabase_backend.py:414-424` requires every public `sheets` function to exist in
  `supabase_backend`.
- `test_main.py:276-349` uses a `FakeBackend` with only five loaders; new loader calls must go
  through a `getattr` + `except Exception` → `[]` helper (precedents `main.py:1751-1770`,
  `:5367-5381`).
- `useT().formatDateTime` must never receive `dateStyle` together with `weekday`
  (`i18n/index.ts:142-144`); a date-only ISO string parses as UTC midnight, which is the same
  calendar day in Warsaw.
- PR #30 (`feat/dynamic-target-wola`) moves `WEEKDAY_MAP` / `_parse_weekdays` and edits the
  fixture; this plan leaves those helpers in `main.py` and keeps new logic in a new module.

## What We're NOT Doing

- No change to the supplier e-mail builders (`gmail_url.py`, `emailBody.ts`), the Transport
  flow, Pago sending, or the Manager `cutoff_iso` badge.
- No reminders or notifications. A later Telegram bot (anti-spam design, its own change) will
  read the rule's order weekdays + deadline; this change only keeps that data ready.
- No per-day quantity calculation for the 3-day choice; the suggestion math is unchanged.
- No delivery-date or coverage editing on `OrderEditPage`; the edit keeps both new fields as
  submitted. No change to the Captain order detail/list pages.
- No blocking: no server validation of `requested_delivery_date` against the rules, and the
  Thursday choice is optional.
- No Coca-Cola rows beyond WESTFIELD until Marek sends the other locations' days; no
  Pago `'Tue, Sat'` copy from PR #30's prod SQL.
- No migration of the legacy Sheets `orders` tab headers (legacy backend; new columns are
  simply not written there until an operator adds them).
- Persisting the chosen date or coverage in the localStorage draft: they live in session
  state only, so a restored draft can never carry a stale date.

## Implementation Approach

Data first, then logic, then UI:

1. Migration 0025 adds two nullable `orders` columns, one supplier flag and a
   `supplier_delivery_rules` table, wired through all three backends and the test fixture.
2. A pure `app/delivery_calendar.py` engine computes delivery windows from a rule and an
   instant. `main.py` resolves the rule (location row > supplier row > fallback built from
   `supplier.delivery_days`) and serves `GET /api/captain/delivery-proposal`. Submit accepts
   and persists the two new fields; the Manager responses expose them.
3. The Captain screen fetches the proposal per supplier, shows a date field, the Thursday
   banner and the deadline strip, and sends the fields on submit.
4. The Manager queue row and detail render the marker and coverage.
5. The operator runs `prod-sql.sql` (diff before → migration → seed rules and flags → audit
   after) before the backend deploy.

### Rule model and algorithm (the contract every phase relies on)

A rule row = `order_weekdays` (when an order counts), `lead_days` (minimum calendar days from
order day to delivery), `delivery_weekdays` (allowed delivery days), `order_deadline`
("HH:MM", Warsaw). For an instant `now`:

1. Walk Warsaw calendar days `d = today, today+1, … today+14`. Skip `d` unless its weekday is
   in `order_weekdays`, and skip it when `now` is strictly later than `d` at
   `order_deadline:00.000` (17:00:00 still counts; 17:00:01 is late).
2. The first surviving `d` is the order day. Delivery = first day `≥ d + lead_days` whose
   weekday is in `delivery_weekdays` (search up to 14 days).
3. The following delivery repeats step 1–2 from the next order day after `d` whose delivery
   is later than the first delivery.
4. `order_deadline` returned = `d` at the deadline, Warsaw-aware.

Seeded rules (operator-run, see Phase 5):

| Supplier | Location | order_weekdays | lead | delivery_weekdays | notes |
|---|---|---|---|---|---|
| SUP_PAGO, SUP_MORY | WOLA, BRACKA | Mon | 2 | Wed | Marek 28.09 |
| SUP_PAGO, SUP_MORY | NORBLIN, BROWARY, ELEKTROWNIA, WESTFIELD, KEN | Sun,Thu | 2 | Tue,Sat | Marek 28.09 |
| SUP_FILBER | all | Wed | 1 | Thu | Marek 28.09 |
| SUP_BUKAT, SUP_INTERMLECZ | all | every day | 1 | Mon–Sat | Marek 28.09 |
| SUP_COCACOLA | WESTFIELD | every day | 2 | Mon,Tue,Thu,Fri | Marek 28.09; other locations TBD |
| SUP_KUCHNIE | all | every day | 1 | Mon–Sat | operator 28.09 |
| SUP_EUROFOOD (Go Gastro) | all | every day | 1 | Mon–Fri | operator 28.09 |
| SUP_SPEC (Spec Food), SUP_KAMINO | all | every day | 1 | Mon–Fri | operator 28.09 (days); lead 1 assumed, to confirm |
| SUP_BLUESERV | all | every day | 2 | Mon–Fri | operator 28.09 |

`coverage_prompt_enabled = true` for SUP_BUKAT and SUP_INTERMLECZ only (Marek, 28.09).
SUP_SPEC is not in the seed CSV; the prod seed skips it if it is absent (`WHERE EXISTS`).
Renaming SUP_EUROFOOD to Go Gastro is out of scope.

## Critical Implementation Details

- **Timing & lifecycle** — the proposal can go stale while the screen is open (a Captain opens
  Bukat at 16:55 and submits at 17:05). The Captain screen refetches the proposal when the
  returned `order_deadline` passes. If the Captain has not touched the date, the field follows
  the new proposal; if they have, their date stays and only the stored proposal updates. The
  value sent as `suggested_delivery_date` is always the proposal currently on screen. The
  timer fires at `order_deadline + 1 s`, which the backend treats as late (strict `>`), so the
  refetch always returns a later deadline; never re-arm on a deadline that is not in the future.
  When an untouched date moves, show a toast naming the new date.
- **Trust boundary** — the backend stores the client's `suggested_delivery_date` as sent and
  does not recompute it (internal, informational; recomputing would disagree with what the
  Captain saw around 17:00).
- **State sequencing** — `suggested_delivery_date` is sent only when the proposal's `source` is
  `location` or `supplier`; a `fallback` proposal is shown but never stored (operator decision),
  so the Manager marker cannot fire on a guess.

## Phase 1: Data model (migration 0025 + backends + fixture)

### Overview

Add the columns, the flag and the rules table, and make every backend and test harness aware of
them. No behaviour change yet.

### Changes Required:

#### 1. Migration

**File**: `supply-os-v1/migrations/0025_delivery_calendar.sql`

**Intent**: Additive DDL for the delivery calendar, following the 0020/0022 header style
(number rationale, apply-before-backend note, no percent sign, rollback block).

**Contract**:
- `orders.suggested_delivery_date date NULL`; `orders.coverage_days smallint NULL` with
  `CHECK (coverage_days IS NULL OR coverage_days IN (1, 3))` (drop-if-exists + add, so the
  file is re-runnable).
- `suppliers.coverage_prompt_enabled boolean NOT NULL DEFAULT false`.
- `supplier_delivery_rules(rule_id text PK, supplier_id text NOT NULL REFERENCES
  suppliers, location_id text NULL REFERENCES locations, order_weekdays text NOT NULL,
  lead_days smallint NOT NULL CHECK 0..14, delivery_weekdays text NOT NULL, order_deadline
  text NOT NULL DEFAULT '17:00' CHECK HH:MM, active boolean NOT NULL DEFAULT true, notes text
  NOT NULL DEFAULT '')`, `UNIQUE NULLS NOT DISTINCT (supplier_id, location_id)`, and a CHECK
  that both weekday columns match `^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(,(Mon|Tue|Wed|Thu|Fri|Sat|Sun))*$`.
  RLS enabled (0002 rationale). `location_id NULL` = the shared rule for all locations.

#### 2. Models

**File**: `supply-os-v1/app/models.py`

**Intent**: Mirror the schema in Pydantic.

**Contract**:
- `Order.suggested_delivery_date: Optional[date] = None`, `Order.coverage_days: Optional[int] = None`.
- `Supplier.coverage_prompt_enabled: bool = False` (NOT Optional; comment mirrors
  `suggestion_alerts_enabled`).
- New `SupplierDeliveryRule` model with the table's columns (`location_id: Optional[str]`,
  `order_deadline: str = "17:00"`, `active: bool = True`, `notes: str = ""`).
- `CaptainSubmitRequest.suggested_delivery_date: Optional[date] = None`,
  `CaptainSubmitRequest.coverage_days: Optional[Literal[1, 3]] = None`.
- `ManagerQueueItem` and `ManagerOrderDetail` gain `suggested_delivery_date: Optional[date] = None`
  and `coverage_days: Optional[int] = None`.
- New `DeliveryProposal` response model: `supplier_id`, `location_id`,
  `proposed_delivery_date: date`, `following_delivery_date: Optional[date]`,
  `order_deadline: datetime` (UTC-aware), `source: Literal["location", "supplier", "fallback"]`,
  `coverage_prompt: bool`.

#### 3. Supabase backend

**File**: `supply-os-v1/app/supabase_backend.py`

**Intent**: Persist and read the new data.

**Contract**: append `suggested_delivery_date`, `coverage_days` to `_ORDER_COLUMNS`; add
`suggested_delivery_date` to `_DATE_COLS`; append `coverage_prompt_enabled` to
`_SUPPLIER_COLUMNS`; new `_SUPPLIER_DELIVERY_RULE_COLUMNS` and
`load_supplier_delivery_rules() -> list[SupplierDeliveryRule]` (`SELECT *` ordered by
`rule_id`).

#### 4. Sheets and seed backends

**Files**: `supply-os-v1/app/sheets.py`, `supply-os-v1/app/seed_loader.py`,
`docs/pita-supply-os-v1/seed/supplier_delivery_rules.csv` (new),
`docs/pita-supply-os-v1/seed/suppliers.csv`

**Intent**: Keep the seam complete.

**Contract**:
- `sheets.load_supplier_delivery_rules()` via `_read_with_ttl("supplier_delivery_rules", ...)`
  (raises `WorksheetNotFound` on a missing tab; the route degrades).
- `seed_loader.load_supplier_delivery_rules()` reads the optional CSV and returns `[]` when the
  file is absent.
- Seed CSV mirrors the prod rules for suppliers and locations present in the seed (no SUP_MORY,
  SUP_SPEC or WESTFIELD rows).
- `suppliers.csv` gains a `coverage_prompt_enabled` column: TRUE for SUP_BUKAT and
  SUP_INTERMLECZ, FALSE elsewhere (still 10 rows).

#### 5. Test harness and docs

**Files**: `supply-os-v1/tests/test_supabase_integration.py`,
`docs/pita-supply-os-v1/DATA_MODEL.md`

**Intent**: Wire the migration into the fixture (lessons.md) and document the schema.

**Contract**: read and execute `0025_delivery_calendar.sql` after 0022; add
`supplier_delivery_rules` to `_ALL_TABLES` before `location_product_settings` (it references
`suppliers` and `locations`), not to `_TXN_TABLES`. DATA_MODEL.md gets the three columns and a
new `supplier_delivery_rules` section.

### Success Criteria:

#### Automated Verification:

- Backend lint passes: `cd supply-os-v1 && ruff check .`
- Backend unit tests pass, including new backend unit tests for the column lists, `_DATE_COLS`, the rules loaders (seed CSV present/absent) and seam parity: `cd supply-os-v1 && python -m pytest -q`
- Integration tests pass on local Postgres, including round-trips for a rule row, an order with `suggested_delivery_date` + `coverage_days`, the `coverage_days = 2` CHECK rejection and the duplicate shared-rule UNIQUE rejection: `python -m pytest -m integration -q`

#### Manual Verification:

- Operator reviews `0025_delivery_calendar.sql` before applying it on prod (Phase 5)

**Implementation Note**: pause after this phase if any manual check fails.

---

## Phase 2: Engine, proposal endpoint, persistence

### Overview

Compute proposals, serve them to the Captain, and persist and expose the new order fields.

### Changes Required:

#### 1. Pure engine

**File**: `supply-os-v1/app/delivery_calendar.py` (new)

**Intent**: One pure, well-tested place for delivery-window arithmetic that a later
dynamic-target lane can call without touching routes.

**Contract**:
- `now_utc() -> datetime` — the only clock (tests patch it).
- `parse_rule_weekdays(text) -> frozenset[int]` — strict `Mon..Sun` comma list; raises
  `ValueError` otherwise. Deliberately separate from `main._parse_weekdays` (PR #30 moves that).
- `DeliveryWindow` (frozen dataclass): `next_delivery: date`, `following_delivery:
  Optional[date]`, `order_deadline: datetime` (Warsaw-aware), `source: str`.
- `compute_window(order_weekdays, lead_days, delivery_weekdays, order_deadline: time, now:
  datetime, source: str) -> DeliveryWindow` — the algorithm in "Rule model and algorithm".
- `resolve_rule(rules, supplier_id, location_id) -> tuple[Optional[SupplierDeliveryRule], str]`
  — active location row, else active shared row, else `(None, "fallback")`.
- `delivery_window(rules, supplier_id, location_id, now, *, fallback_lead_days=1,
  fallback_delivery_weekdays=None) -> DeliveryWindow` — resolves, parses, computes; a rule
  whose weekday text fails to parse is logged and treated as absent. Fallback = every day
  orderable, `fallback_lead_days`, `fallback_delivery_weekdays` (None = every day), 17:00.
- `is_coverage_prompt_day(now) -> bool` — Warsaw calendar weekday is Thursday.

#### 2. Proposal route

**File**: `supply-os-v1/app/main.py`

**Intent**: `GET /api/captain/delivery-proposal?supplier_id=` for the token's location.

**Contract**:
- `require_captain` → `location_id`; unknown `supplier_id` → 404.
- `_load_delivery_rules_safe(backend) -> list[SupplierDeliveryRule]` — `getattr` +
  `except Exception` → `[]` with a warning (mirrors `_load_order_events_safe`).
- Fallback parameters from `supplier.delivery_days`: a positive integer string → that many
  lead days on any weekday; else `_parse_weekdays(...)` → lead 1 on those weekdays; else lead 1
  on any day. `WEEKDAY_MAP` / `_parse_weekdays` stay where they are.
- Response `DeliveryProposal`; `coverage_prompt = supplier.coverage_prompt_enabled and
  delivery_calendar.is_coverage_prompt_day(now)`.

#### 3. Submit and Manager responses

**File**: `supply-os-v1/app/main.py`

**Intent**: Persist what the Captain saw and chose; expose it to the Manager.

**Contract**: `captain_submit` passes `req.suggested_delivery_date` and `req.coverage_days`
into `Order`. `captain_order_edit` is unchanged (its `order_updates` never names the new
fields, so they survive an edit). `manager_queue` and `manager_order_detail` copy both fields
into their responses.

### Success Criteria:

#### Automated Verification:

- Backend lint passes: `cd supply-os-v1 && ruff check .`
- New `tests/test_delivery_calendar.py` passes: WOLA×Pago Mon 16:59 → Wed same week and Mon 17:01 → Wed next week; NORBLIN×Pago Sun → Tue, Thu → Sat, Fri → Tue; Bukat Fri 16:00 → Sat, Fri 18:00 → Mon, Sat 10:00 → Mon; Coca-Cola WESTFIELD Sat → Mon, Wed 18:00 → Mon; Filber Tue → Thu; following delivery for WOLA×Pago = +7 days; DST week (Sun 25.10.2026) keeps the 17:00 Warsaw deadline; location rule beats shared rule; inactive rule ignored; malformed weekday text → fallback; Thursday 23:30 Warsaw is a prompt day, Friday 00:30 Warsaw is not
- New `tests/test_delivery_proposal.py` passes: seed-mode proposal for WOLA and KEN with a patched clock; unknown supplier 404; no token and manager token 401; 17:00:00 still on time and 17:00:01 late; a rules loader that raises still returns a fallback proposal (200); `coverage_prompt` true only on Thursday for a flagged supplier
- Submit tests pass: sheet-mode `append_order` receives an `Order` carrying both fields; `coverage_days: 2` → 422; omitted fields → `None`; a captain edit leaves both fields untouched
- Manager queue and detail tests pass: both fields are present in the response
- Full backend suite passes: `cd supply-os-v1 && python -m pytest -q`

No manual checks in this phase; the prod check lives in Phase 5.

---

## Phase 3: Captain order screen

### Overview

Show and send the date, the Thursday choice and the 17:00 deadline.

### Changes Required:

#### 1. Types, API, date helpers

**Files**: `frontend/src/types.ts`, `frontend/src/apiClient.ts`, `frontend/src/lib/dates.ts`,
`frontend/src/pages/captain-mp/lib/dates.ts`

**Intent**: Mirror the backend contract and fix the Warsaw-day arithmetic the screen needs.

**Contract**:
- `DeliveryProposal` type; `Supplier.coverage_prompt_enabled?: boolean`;
  `CaptainSubmitRequest.suggested_delivery_date?: string` and `coverage_days?: 1 | 3`;
  `ManagerQueueItem` / `ManagerOrderDetail` gain `suggested_delivery_date?: string | null`
  and `coverage_days?: 1 | 3 | null` (optional, per lessons.md).
- `api.captainDeliveryProposal(supplier_id)` → GET with the captain role.
- `warsawTodayIso(now?: Date): string` exported from `src/lib/dates.ts`.
- `getRequestedDeliveryDate` counts days from the Warsaw date instead of the browser-local
  date + UTC conversion (it remains the fallback when the proposal request fails).
- `getDeadlineUrgency(deadlineIso, now?)` replaces the local-time cutoff maths for the strip:
  under 1 h → danger, under 6 h → warn, else ok.

#### 2. Delivery date field

**File**: `frontend/src/pages/captain-mp/components/DeliveryDateField.tsx` (new)

**Intent**: A labelled native date input under "Kto zamawia", mirroring its styling.

**Contract**: props `value`, `proposal: DeliveryProposal | null`, `fallbackDate`,
`onChange(date)`, `onRestore()`. `min` = Warsaw today. Hint line: rule-based proposal and
value equal → "Proponowana wg kalendarza dostaw: {date}"; value differs → "Zmieniono —
kalendarz proponuje {date}" + a "Przywróć" button; fallback → "Brak kalendarza dostaw dla tego
dostawcy — sprawdź datę". Dates render with weekday via `formatDateTime({ weekday: "short",
day: "2-digit", month: "2-digit" })`.

#### 3. Thursday coverage banner

**File**: `frontend/src/pages/captain-mp/components/CoveragePrompt.tsx` (new)

**Intent**: The informational choice, shown only when `proposal.coverage_prompt` is true.

**Contract**: props `value: 1 | 3 | null`, `onChange`. Text "Pamiętaj o ilościach na 3 dni!",
two toggle buttons "na 1 dzień" / "na 3 dni (do końca tygodnia)" with `aria-pressed`; when 3 is
selected, an extra line "Czy ilości wystarczą do końca weekendu?". Never disables submit.

#### 4. Context strip and confirm dialog

**Files**: `frontend/src/pages/captain-mp/components/ContextStrip.tsx`,
`frontend/src/pages/captain-mp/components/ConfirmSubmitDialog.tsx`

**Intent**: Show the 17:00 deadline where the cutoff is shown today; show the chosen date
before sending.

**Contract**: `ContextStrip` gains an optional `proposal` prop. With a proposal, the right side
reads "Zamów do dziś 17:00" or "Zamów do {weekday} 17:00" coloured by `getDeadlineUrgency`, and
the left side shows "dostawa {date}" for rule-based proposals. Without a proposal it keeps
today's rendering. `ConfirmSubmitDialog` gains optional `deliveryDate` and `coverageDays`
props rendered as one summary line.

#### 5. Wiring

**File**: `frontend/src/pages/captain-mp/CaptainMP.tsx`

**Intent**: Own the proposal lifecycle and the per-supplier session choices.

**Contract**:
- State: `proposal` for the active supplier; a session map `supplierId → { date?, coverage? }`
  (not in the localStorage draft, survives supplier switching, cleared for that supplier on a
  successful submit).
- Fetch the proposal when `activeSupplierId` changes, with the same `cancelled` guard as the
  orderable effect so a slow response for a previous supplier never lands on the current one;
  on failure use `null` and the legacy fallback date.
- Refetch when `proposal.order_deadline` passes (a timer, cleared on unmount and on supplier
  change); the field follows the new proposal only if the Captain has not set a date.
- Submit sends `requested_delivery_date` = chosen or displayed date, `suggested_delivery_date`
  = proposal date only for `location`/`supplier` sources, `coverage_days` only when chosen.
- i18n: all new copy in `i18n/strings.ts` with `pl` and `en`.

### Success Criteria:

#### Automated Verification:

- Frontend build passes (includes `tsc -b`): `cd frontend && npm run build`
- Frontend lint passes: `cd frontend && npm run lint`
- New tests pass: `captain-mp/lib/dates.test.ts` (Warsaw fallback date across 00:00–02:00, deadline urgency thresholds), `src/lib/dates.test.ts` (`warsawTodayIso` across CET/CEST), `DeliveryDateField.test.tsx` (proposed, changed + restore, fallback copy), `CoveragePrompt.test.tsx` (two buttons, `aria-pressed`, follow-up line only for 3), `ContextStrip.test.tsx` ("Zamów do dziś 17:00" and fallback rendering)
- Full frontend suite passes: `cd frontend && npm run test`

#### Manual Verification:

- Local preview with auth ON (captain token only) and the seed backend: WOLA × Pago shows the rule-based date and "Zamów do pon. 17:00"; changing the date shows "Zmieniono" + "Przywróć"; a TBD supplier shows the fallback note
- Mobile width (375 px): the date field and the banner wrap without clipping

---

## Phase 4: Manager views

### Overview

Show the deviation marker and the coverage choice, subtly.

### Changes Required:

#### 1. Shared marker

**File**: `frontend/src/pages/manager/DeliveryDateMarker.tsx` (new)

**Intent**: One component for queue and detail, styled like the inventory attention flag.

**Contract**: props `requested?: string | null`, `suggested?: string | null`, `variant:
"queue" | "detail"`. Renders nothing unless both exist and differ. Markup:
`inline-flex items-center gap-1 text-xs font-semibold text-amber-700` + `AlertTriangle
size={12}`; `title` "Kapitan wybrał {chosen}, kalendarz dostaw proponował {proposed}";
`data-testid="delivery-date-marker"`. Queue text: "dostawa {chosen} (propozycja {proposed})";
detail text: "inna niż proponowana ({proposed})".

#### 2. Queue row and detail header

**Files**: `frontend/src/pages/manager/ManagerQueue.tsx`,
`frontend/src/pages/manager/OrderDetailPane.tsx`

**Intent**: Place the marker and coverage where the Manager already reads order metadata.

**Contract**: `QueueCard` meta row (`:236`) renders the marker and, when set, a slate
`text-slate-600` "na 1 dzień" / "na 3 dni". `OrderDetailPane` meta row renders the delivery
date with weekday formatting, the marker right after it, and "Zamówione na: 1 dzień / 3 dni"
when set. The archive inherits both through the shared components.

### Success Criteria:

#### Automated Verification:

- Frontend build and lint pass: `cd frontend && npm run build && npm run lint`
- New/extended tests pass: `DeliveryDateMarker.test.tsx` (hidden when equal, when either date is null; visible with tooltip when different), `ManagerQueue.test.tsx` (marker and coverage text in the submitted lane; absent for a legacy item)
- Full frontend suite passes: `cd frontend && npm run test`

#### Manual Verification:

- Local preview with auth ON (manager token only): an order with differing dates shows one amber line in the queue and the detail; an order with equal or missing proposal shows nothing extra

---

## Phase 5: Prod rollout artifacts and docs

### Overview

Everything the operator needs to apply the change safely, plus repo documentation.

### Changes Required:

#### 1. Operator SQL

**File**: `context/changes/delivery-calendar/prod-sql.sql`

**Intent**: Diff before → apply → audit after → rollback (lessons.md "Master-data ops").

**Contract**:
1. Diff before: `SELECT supplier_id, supplier_name, active FROM suppliers`, `SELECT
   location_id, active FROM locations`, and existence checks for the migration's objects.
2. Migration: apply `0025_delivery_calendar.sql` (MCP `apply_migration` or SQL editor) BEFORE
   the backend deploy.
3. Seed: `INSERT ... SELECT ... WHERE EXISTS` per rule row (so a missing supplier such as
   SUP_MORY is skipped, not failed), `ON CONFLICT DO NOTHING`; `UPDATE suppliers SET
   coverage_prompt_enabled = true WHERE supplier_id IN ('SUP_BUKAT', 'SUP_INTERMLECZ')`.
4. Audit after: every rule's supplier and location exist; no duplicate shared rule; exactly
   the two flagged suppliers; a listing of seeded rules with notes.
5. Rollback: `DELETE FROM supplier_delivery_rules`, flag reset, and the migration's rollback
   block.

#### 2. Repo docs

**Files**: `context/foundation/roadmap.md` (Horizon 3 row `R-21 delivery-calendar`,
status implemented), `AGENTS.md` / `supply-os-v1/AGENTS.md` / `frontend/AGENTS.md` test counts,
`context/foundation/test-plan.md` only if a new risk row is warranted (Risk #2 covers dates:
no change expected).

**Intent**: Keep docs true in the same change (lessons.md).

### Success Criteria:

#### Automated Verification:

- `/verify` passes (backend ruff + pytest, frontend build + lint + test)

#### Manual Verification:

- Operator runs `prod-sql.sql` steps 1–4 on prod and the audit output matches the table in "Rule model and algorithm"
- After merge and deploy (new Vercel bundle + Railway commit confirmed): WOLA Captain sees the Pago proposal and "Zamów do … 17:00"; a Thursday Bukat order shows the banner; a Manager sees the marker on a test order whose date was changed — the test order is cancelled, never dispatched

---

## Testing Strategy

### Unit Tests:

- Engine: every seeded rule shape, the 17:00 boundary, DST, following delivery, rule
  resolution, malformed rules, Thursday detection in Warsaw time.
- Route: auth, 404, degrade on loader failure, clock-patched proposals.
- Persistence: column lists, date casts, submit/edit/queue/detail fields.
- Frontend: Warsaw date helpers, deadline urgency, the three new components, queue marker.

### Integration Tests:

- Postgres round-trips for the rules table and the new order columns; CHECK and UNIQUE
  rejections.

### Manual Testing Steps:

1. Captain WOLA, Pago on a Tuesday: date prefilled to next week's Wednesday, strip "Zamów do
   pon. 17:00".
2. Change the date, submit: Manager queue shows the amber marker; cancel the test order.
3. Thursday, Bukat: banner visible; pick "na 3 dni", submit; Manager detail shows "na 3 dni".
4. A supplier without rules: fallback note, no marker after submit even if the date changes.

## Performance Considerations

One extra indexed-size read (`supplier_delivery_rules`, tens of rows) per proposal request;
the proposal is fetched once per supplier switch plus one refetch at the deadline.

## Migration Notes

- Deploy order: migration 0025 on prod → merge (backend + frontend auto-deploy) → seed rules
  and flags (can also run right after the migration). Old frontend + new backend and new
  frontend + old backend are both safe: unknown request fields are ignored, and a missing
  proposal endpoint falls back to the legacy date.
- New backend code against an unmigrated DB fails every order insert (`_ORDER_COLUMNS`), hence
  migration first.
- Existing orders keep `suggested_delivery_date = NULL` → no marker.

## References

- Frame: `context/changes/delivery-calendar/frame.md`
- Research: `context/changes/delivery-calendar/research.md`
- Supplier flag precedent: `context/changes/pago-suggestion-no-alerts/prod-sql.sql`,
  `supply-os-v1/migrations/0022_supplier_suggestion_alerts.sql`
- New table precedent: `supply-os-v1/migrations/0020_order_events.sql`
- Marker style: `frontend/src/pages/manager/ManagerInventoryPage.tsx:302-325`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model (migration 0025 + backends + fixture)

#### Automated

- [x] 1.1 Backend lint passes — 45a42e9
- [x] 1.2 Backend unit tests pass incl. column lists, date cast, rules loaders, seam parity — 45a42e9
- [x] 1.3 Integration tests pass incl. rule and order round-trips, CHECK and UNIQUE rejections — 45a42e9

#### Manual

- [x] 1.4 Operator reviews 0025_delivery_calendar.sql before applying it on prod — applied on prod 2026-09-28 at the operator's request (see prod-sql-audit.md)

### Phase 2: Engine, proposal endpoint, persistence

#### Automated

- [x] 2.1 Backend lint passes — 200c321
- [x] 2.2 test_delivery_calendar.py passes (all rule shapes, boundary, DST, resolution, Thursday) — 200c321
- [x] 2.3 test_delivery_proposal.py passes (auth, 404, degrade, clock-patched proposals) — 200c321
- [x] 2.4 Submit tests pass (fields persisted, coverage 2 → 422, edit preserves) — 200c321
- [x] 2.5 Manager queue and detail tests pass (fields exposed) — 200c321
- [x] 2.6 Full backend suite passes — 200c321

### Phase 3: Captain order screen

#### Automated

- [x] 3.1 Frontend build passes — e7b4b01
- [x] 3.2 Frontend lint passes — e7b4b01
- [x] 3.3 New helper and component tests pass — e7b4b01
- [x] 3.4 Full frontend suite passes — e7b4b01

#### Manual

- [ ] 3.5 Local preview with captain auth: rule-based date, deadline strip, change + restore, fallback note
- [ ] 3.6 Mobile width: date field and banner wrap without clipping

### Phase 4: Manager views

#### Automated

- [x] 4.1 Frontend build and lint pass — 63adab1
- [x] 4.2 DeliveryDateMarker and ManagerQueue tests pass — 63adab1
- [x] 4.3 Full frontend suite passes — 63adab1

#### Manual

- [ ] 4.4 Local preview with manager auth: marker only when dates differ

### Phase 5: Prod rollout artifacts and docs

#### Automated

- [x] 5.1 /verify passes — 58ab763

#### Manual

- [x] 5.2 Operator runs prod-sql.sql steps 1–4 and the audit matches the seeded rules — run 2026-09-28 at the operator's request; audit in prod-sql-audit.md
- [ ] 5.3 Post-deploy prod check on live bundle and backend, test order cancelled
