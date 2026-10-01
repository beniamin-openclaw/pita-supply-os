---
date: 2026-09-28T14:13:06+02:00
researcher: Claude (Opus 5.5)
git_commit: 7dced7e
branch: claude/sharp-tharp-b7ea7d
repository: pita-supply-os
topic: "Delivery calendar — where a proposed delivery date, the 17:00 deadline and a Thursday coverage prompt plug into Supply OS"
tags: [research, codebase, captain-order-screen, manager-queue, data-layer, delivery-date]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude (Opus 5.5)
---

# Research: Delivery calendar

**Date**: 2026-09-28T14:13:06+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 7dced7e (local; `origin/main` is 07443c7, two docs-only commits ahead)
**Branch**: claude/sharp-tharp-b7ea7d
**Repository**: pita-supply-os

## Research Question

Where do a server-computed proposed delivery date (supplier rules + per-location override +
17:00 Europe/Warsaw deadline), a persisted `suggested_delivery_date`, a Thursday
`coverage_days` prompt with a per-supplier scope flag, and the Manager deviation marker plug
into the current code? See `change.md` for the operator decisions and `frame.md` for the
framing refinements.

## Summary

- The Captain never sees the delivery date today. `CaptainMP.tsx:516-519` computes it once at
  submit with `getRequestedDeliveryDate(supplier.delivery_days)`: browser clock, falls back to
  tomorrow, serialised through `toISOString()`, so it is one day early between 00:00 and 02:00
  Warsaw. There is no state, input, draft field or confirm-dialog line for it.
- The Captain screen does not know its location (`CaptainMP.tsx:5-7`, `Header locationName=""`
  at `:685`). The backend derives it from the token in `require_captain` (`app/auth.py`). A
  per-location proposal therefore has to be computed server-side.
- `/api/captain/orderable` returns a bare list shared with `manager_orderable`,
  `manager_add_line` and transport prefill (`main.py:223-324`, `:2355`, `:4973`). A new
  endpoint (`GET /api/captain/delivery-proposal?supplier_id=`) is the clean fit.
- The Captain strip (`ContextStrip.tsx`) is the only place the cutoff shows on the order screen.
  It prints `supplier.cutoff_time` as "Wyślij do dziś {time}" with local-time urgency. The
  Manager `cutoff_iso` (`main.py:827-850`, `:955`) is a separate, supplier-side value.
- The Manager order screens have no over-max marker. The subtle Manager over-max flag is on the
  inventory page: `inline-flex items-center gap-1 text-xs font-semibold text-amber-700` +
  `AlertTriangle size={12}` (`ManagerInventoryPage.tsx:302-325`).
- Data layer: nullable `orders` columns follow 0005; supplier flags follow 0022; a new
  master-data table follows 0020 (RLS, fixture wiring) and PR #30's `location_product_usage`
  (tolerant loaders, `_load_*_safe` helper). Migration number 0024 is free (0023 is reserved by
  another lane per the operator).
- The e-mail builders deliberately do not use `requested_delivery_date`
  (`gmail_url.py:143-153`, `emailBody.ts:120-125`). This change leaves them untouched.

## Detailed Findings

### Captain order screen (`frontend/src/pages/captain-mp/`)

- **Submit payload** at `CaptainMP.tsx:516-524`: `supplier_id`, `requested_delivery_date`
  (computed inline), `lines`, `ordered_by`, `notes: ""`, `extra_items`, `captain_note`.
- **Supplier switch effect** at `CaptainMP.tsx:210-284`: resets items, lines, draft banner,
  extra items and comment, then fetches `api.orderable` and auto-restores the draft. The
  proposal fetch belongs in the same lifecycle (per `activeSupplierId`).
- **Default supplier** `PILOT_SUPPLIER_ID = "SUP_BUKAT"` (`:46`, `:198-207`).
- **Drafts**: `DraftState` (`captain-mp/types.ts:32-37`) = lines, timestamp, extraItems?,
  captainNote?. Four write sites (`:289-312`, `:320-351`, `:398-407`, resets `:383`, `:535`).
  `draftHasValues()` (`:55-70`) gates saving and the restore banner. Drafts never expire
  (`auth.ts:102-113`), so persisting a chosen date in the draft risks restoring a stale date.
- **"Kto zamawia" field** at `:720-749` (label + input + datalist + hint). This is the natural
  neighbour for a "Data dostawy" field: same form section, same styling.
- **ContextStrip** (`components/ContextStrip.tsx:13-49`): left = supplier name + delivery text
  from `parseDeliveryDays`; right = `Clock` + cutoff text with `getCutoffUrgency` colour.
  i18n keys `dates.cutoff.value` "Wyślij do dziś {time}", `dates.cutoff.none`,
  `dates.delivery.*` (`i18n/strings.ts:340-346`).
- **ConfirmSubmitDialog** (`components/ConfirmSubmitDialog.tsx:18-28`) shows no date.
- **Edit flow** `OrderEditPage.tsx:206-215` echoes `order.requested_delivery_date`; the backend
  keeps the old value when the field is omitted (`main.py:1533-1542`). No date UI.
- **Captain detail** `OrderDetailPage.tsx:225-231` prints the raw ISO date (key
  `orders.detail.requestedDelivery`).
- **Supplier-scoped UI precedent**: `lib/supplierPrompts.ts:18-27`
  (`SUPPLIER_NOTE_PROMPTS = { SUP_COCACOLA: "crates" }`) — code, not data. The operator wants
  the Thursday scope as data, so a supplier flag is the better precedent (0022).
- **Warsaw helpers**: `src/lib/dates.ts` has `WARSAW_TZ`, an `en-CA` Warsaw Y-M-D formatter
  and `daysSince` (tested with CET/CEST instants in `src/lib/dates.test.ts`). No exported
  "Warsaw today" helper. `useT().formatDateTime` is pinned to Europe/Warsaw
  (`i18n/index.ts:138-155`).
- **Tests**: no tests for `CaptainMP`, `ContextStrip`, `ConfirmSubmitDialog` or
  `captain-mp/lib/dates.ts`. Patterns: `src/lib/dates.test.ts` (pure, injected `now`),
  `OrderDetailPage.test.tsx` (`vi.mock("../../apiClient")`, LangProvider + MemoryRouter),
  `ProductCard.test.tsx` (controlled wrapper).

### Manager views (`frontend/src/pages/manager/`)

- **Queue row** `QueueCard` (`ManagerQueue.tsx:193-308`): title row `:209` (edited, in-queue,
  TO chips), meta row `:236` (lines, value, `MinimumOrderChip`, deviation, reason, received
  chips), stamp row `:286` (cutoff, submitted, ordered_by). `requested_delivery_date` is not
  shown in the queue row at all.
- **Detail header** `OrderDetailPane.tsx:144-166`: meta row with submitted, ordered_by, cutoff,
  and `manager.detail.delivery` "Dostawa: {value}" (raw ISO) at `:162-166`.
- **Archive** reuses `QueueCard` and `OrderDetailPane` (`ManagerArchivePage.tsx:20`,
  `:296-329`), so markers added there appear in the archive too.
- **Style vocabulary**: amber attention flag (inventory), `MinimumOrderChip`
  (`bg-amber-100 text-amber-900`, renders nothing when OK), deviation chip
  (`bg-orange-100 text-orange-900`), reason chip, edited chip (`bg-purple-100`), TO chip
  (`bg-indigo-100`). Tooltips via `title`, keys `manager.queue.*Tooltip`.
- **Tests**: `ManagerQueue.test.tsx` (`makeItem`, `renderQueue` with MemoryRouter +
  LangProvider; sent/closed lanes are collapsed by default). No `OrderDetailPane` test;
  `DispatchPanel.test.tsx` has a reusable `makeDetail` fixture.
- **i18n**: single file `i18n/strings.ts`, `{ pl, en }` entries, `satisfies Record<...>`
  (`:1851`) so a missing language fails `tsc`. `tPlural` keys are checked by
  `i18n/pluralKeys.test.ts`.

### Backend (`supply-os-v1/app/`)

- **Order flow**: `CaptainSubmitRequest.requested_delivery_date` (`models.py:263`) persisted at
  `main.py:718`; `CaptainEditRequest` (`:579`) → `order_updates` (`main.py:1533-1542`). Read
  out in `ManagerQueueItem` (`main.py:965`), `ManagerOrderDetail` (`:1188`),
  `CaptainOrderListItem` (`:1326`), `CaptainOrderDetail` (`:1385`). `order_date` is the UTC
  date (`:658`).
- **Calendar helpers**: `WEEKDAY_MAP` (`:767-770`), `_WARSAW_TZ` (`:772`),
  `_parse_cutoff_time` (`:775-790`), `_parse_weekdays` (`:793-824`, accepts EN/PL tokens and
  `daily`/`codziennie`), `_compute_next_cutoff` (`:827-850`, pure, takes `now_utc`). Only
  caller: `manager_queue` (`:955`). No unit tests of the parsers on main.
- **Supplier flag precedent (0022)**: migration adds `suggestion_alerts_enabled boolean NOT
  NULL DEFAULT true`; `Supplier` field `bool = True` (`models.py:78-85`); `_SUPPLIER_COLUMNS`
  (`supabase_backend.py:98-102`); `/api/suppliers` returns raw `Supplier` rows
  (`main.py:179-181`), so a new flag reaches the frontend for free. Sheets and seed build from
  the header row and use Pydantic defaults, so no loader change was needed.
- **Nullable order columns precedent (0005, 0013)**: `Optional[...] = None` binds NULL safely;
  `_ORDER_COLUMNS` (`supabase_backend.py:118-125`) must list the column or `update_order` /
  `replace_order_lines_atomic` silently drop it; `_DATE_COLS` (`:170-175`) must list a new DATE
  column so an ISO string binds with an explicit cast. A CHECK constraint pattern is in
  `0001_initial_schema.sql:32-34`.
- **New table precedent**: `0020_order_events.sql` (CREATE TABLE IF NOT EXISTS, index, RLS
  enabled, no-percent-sign rule, wire into the fixture). Seed stubs at `seed_loader.py:101-111`.
  Sheets reads via `_read_with_ttl` (`sheets.py:231-258`), which raises `WorksheetNotFound`
  for a missing tab and `ConfigDriftError` for missing required headers.
- **Seam parity**: `test_supabase_backend.py:414-424` fails if `sheets.py` has a public
  function that `supabase_backend.py` lacks.
- **Degrade rule**: `test_main.py:276-349` swaps in a `FakeBackend` with only five loaders,
  and sheet-mode tests mock specific loaders; an unguarded call to a new loader raises. Use
  `getattr(backend, "load_x", None)` + `except Exception` → `[]` (precedents
  `main.py:1751-1770`, `:5367-5381`).
- **Integration fixture** (`tests/test_supabase_integration.py:52-229`): reads every migration
  by name (0008 and 0018 deliberately skipped), drops `_ALL_TABLES` children-first, executes
  in one transaction, then inserts minimal master data with the column lists. A new master
  table goes into `_ALL_TABLES` (before `locations` / `suppliers`), not `_TXN_TABLES`. Adding a
  column to `_SUPPLIER_COLUMNS` makes the fixture's supplier insert depend on 0024.
- **Time in tests**: no freezegun. PR #30 pattern: pure functions take `today`/`now`; routes
  call a module-level clock; tests `mocker.patch.object(...)` it.
- **Auth/test constants**: `WOLA_AUTH` / `KEN_AUTH` / `MANAGER_AUTH`; conftest defines only the
  WOLA and KEN captain tokens (`conftest.py:25-28`); seed backend by default.

### Seed data (`docs/pita-supply-os-v1/seed/`)

- `suppliers.csv`: 10 rows (asserted in `test_main.py:81`). SUP_PAGO `Tue` / `14:00`,
  SUP_BUKAT `Mon, Tue, Wed, Thu, Fri, Sat` / `16:00`, SUP_INTERNAL `daily`, the rest `TBD`.
  SUP_MORY is not in the seed.
- `locations.csv`: 7 rows (asserted in `test_main.py:92`).
- Prod `locations` (read 2026-09-28): WOLA, BRACKA, NORBLIN, KEN, BROWARY active; ELEKTROWNIA,
  WESTFIELD, FORUM, KAMIENICA, KULINARNA, SLONY, STARY_BROWAR, SUPERSAM inactive. All seven
  locations named in Marek's Pago/Mory rules exist, so FK references are safe.
- Prod `suppliers` rows could not be read in this session (permission classifier). The
  prod-sql step must start with a diff-before SELECT and insert rules only for suppliers that
  exist (`INSERT ... SELECT ... WHERE EXISTS`).

## Code References

- `frontend/src/pages/captain-mp/CaptainMP.tsx:516-524` — submit payload, inline date
- `frontend/src/pages/captain-mp/CaptainMP.tsx:210-284` — supplier-switch lifecycle
- `frontend/src/pages/captain-mp/CaptainMP.tsx:720-749` — "Kto zamawia" field (layout anchor)
- `frontend/src/pages/captain-mp/lib/dates.ts:17-69` — current date + urgency helpers
- `frontend/src/pages/captain-mp/components/ContextStrip.tsx:13-49` — cutoff display
- `frontend/src/pages/manager/ManagerQueue.tsx:193-308` — queue row
- `frontend/src/pages/manager/OrderDetailPane.tsx:144-166` — detail meta row
- `frontend/src/pages/manager/ManagerInventoryPage.tsx:302-325` — amber attention flag
- `frontend/src/lib/dates.ts:5-38` — Warsaw formatter + `daysSince`
- `frontend/src/types.ts:38-48, 99-109, 404-441, 501-559` — Supplier, submit request, queue item, detail
- `supply-os-v1/app/main.py:179-181, 284-308, 718, 767-850, 955-978, 1188, 1533-1542`
- `supply-os-v1/app/models.py:78-85, 184-227, 263, 347, 480, 579`
- `supply-os-v1/app/supabase_backend.py:98-125, 170-175`
- `supply-os-v1/app/sheets.py:231-258`; `supply-os-v1/app/seed_loader.py:76-111`
- `supply-os-v1/tests/test_supabase_integration.py:52-229`
- `supply-os-v1/tests/test_supabase_backend.py:414-424`

## Architecture Insights

- The Captain/Manager contract for per-order fields is: Pydantic request model → route builds
  `Order` → `_ORDER_COLUMNS` insert → read back in four response models → mirrored in
  `frontend/src/types.ts` (optional fields as `field?: T`, lessons.md).
- Server-side "suggest, never block" is the governing rule: the engine proposes, the human
  commits. The delivery proposal follows the same rule (soft default, stored for learning).
- Supplier-scoped behaviour moved from code maps (`supplierPrompts.ts`) to data flags
  (0021, 0022). The Thursday scope follows the data path.

## Historical Context (from prior changes)

- `context/changes/pago-suggestion-no-alerts/` — the supplier boolean flag pattern and its
  `prod-sql.sql` (diff before / apply / audit after / rollback).
- `context/changes/pago-transport-only-dispatch/plan.md` — Pago is transport-only
  (`ordering_method='transport'`, migration 0021); the Captain still records Pago orders.
- `context/archive/2026-06-26-email-delivery-time/` and `2026-06-25-email-delivery-address/` —
  why the e-mail carries an empty "Proszę o dostawę w dniu:" line and a fixed 11:00 window.
- PR #30 (`feat/dynamic-target-wola`, open): `dynamic_target.resolve_delivery_window` trusts
  `requested_delivery_date` when it is 1..14 days ahead on a delivery weekday; it moves
  `WEEKDAY_MAP` / `_parse_weekdays` into `app/dynamic_target.py` and adds `_today_warsaw()` to
  `main.py`. Its prod SQL sets `suppliers.delivery_days` for Pago (`Tue, Sat`) and Coca-Cola
  (`Thu`). Expect conflicts in `main.py:765-850` and the `_schema` fixture if both touch them.

## Related Research

- `context/changes/pago-transport-only-dispatch/research.md`

## Open Questions

1. Blue Service delivery weekdays are unknown: seed "2 days lead, any weekday" (literal TBD) or
   assume business days?
2. Coca-Cola "2 days lead": calendar days or business days (order Friday → Monday or Tuesday)?
3. Kuchnie Świata / Go Gastro: may a Saturday/Sunday order count (next business day after the
   weekend), or only Mon–Fri orders?
4. Should the Thursday choice be required before submit, or optional (no choice = not stored)?
5. SUP_MORY and SUP_FILBER existence in prod could not be verified in this session.
