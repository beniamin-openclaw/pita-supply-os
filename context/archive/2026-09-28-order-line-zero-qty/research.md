---
date: 2026-09-28T11:02:01Z
researcher: Claude (Opus 5.5)
git_commit: 122a9c87ae2d975234cfeab03aa21bc225a80280
branch: claude/wonderful-albattani-d25a04
repository: pita-supply-os
topic: "What does it take to make a Manager's explicit 0 on an order line durable?"
tags: [research, codebase, order_lines, manager_final, draftState, gmail_url, transport, receipts, migration]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude (Opus 5.5)
---

# Research: making a Manager's explicit 0 on an order line durable

**Date**: 2026-09-28T11:02:01Z
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 122a9c8
**Branch**: claude/wonderful-albattani-d25a04
**Repository**: pita-supply-os

## Research Question

Given `frame.md` (a Manager's explicit 0 is read back as "unset" and replaced by
`captain_final`), what does every writer, reader, test and the production data
look like, so a plan can make "Manager explicitly set this line" representable
and honoured everywhere, with a safe migration story for existing rows?

## Summary

- `manager_final_qty_purchase` is `numeric(12,4) NOT NULL DEFAULT 0`
  (`migrations/0001_initial_schema.sql:122`) and `float = 0` in the model
  (`models.py:173`). Nothing records whether the Manager touched a line.
- Writers: only `manager_order_save` and `manager_dispatch` write
  `manager_final_*`, and only for lines in the request payload
  (`main.py:2159-2164`, `:2020-2028`). Skeleton writers (`manager_add_line`,
  transport prefill) write explicit 0; captain submit/edit take the default 0.
  Claim, transport create/finalize/remove/cancel and receipts never write lines.
- The frontend decides what reaches those writers: save sends only dirty lines
  (`draftState.ts:72-83`); single-order dispatch sends every line with its draft
  qty (`draftState.ts:91-100`, unchanged since the first commit). The Transport
  matrix saves dirty cells only (`transport.ts:399-415`).
- Readers: ~10 backend + ~10 frontend sites use the "`manager_final > 0` else
  `captain_final`" rule, all funnelling through two helpers —
  `main._effective_ordered_qty` (`main.py:3403`) / `gmail_url._effective_qty`
  (`gmail_url.py:26`) and `lib/orderQty.ts::effectiveOrderedQtyPurchase`
  (`orderQty.ts:16`) — plus two hand-rolled copies (`manager_order_save`'s
  untouched branch `main.py:2166-2169`, Captain `managerChangedLine`
  `OrderDetailPage.tsx:44-53`). `buildEmailBody` has no rule of its own; it takes
  `effectiveQtyFor` from the caller (`emailBody.ts:66-83`).
- **Production data (read-only, 2026-09-28)**: all 1,214 lines on dispatched
  non-transport orders (`email`/`gmail`/`portal`/`phone`/`manual`,
  `manager_sent`+`closed`) have `manager_final > 0`. Every stored
  `manager_final = 0 AND captain_final > 0` row sits on a `captain_submitted`
  (29), `manager_claimed` (30), transport-sent (7) or cancelled order — i.e. it
  means "unset" today. **There is no existing row where 0 means "explicitly
  zeroed".**
- Consequence for the design: a per-line flag with the rule
  *effective = (flag OR manager_final > 0) ? manager_final : captain_final*
  reproduces today's behaviour for every existing row with no backfill, changes
  behaviour only for new explicit zeros, and needs one additive migration.

## Detailed Findings

### Schema and model

- `order_lines.manager_final_qty_purchase` / `_qty_base`: `numeric(12,4) NOT NULL
  DEFAULT 0` (`supply-os-v1/migrations/0001_initial_schema.sql:122-123`); no later
  migration touches them.
- `OrderLine.manager_final_qty_purchase: float = 0` (`models.py:173`);
  `OrderLineManagerFinal.manager_final_qty_purchase: float = Field(ge=0)`
  (`models.py:287`); `ManagerOrderLineDetail.manager_final_qty_purchase: float`
  (required).
- Frontend mirror: `types.ts:467-468` (`ManagerOrderLineDetail`, both required),
  `types.ts:577` (`OrderLineManagerFinal`).
- Sheets backend: blank cell → `None` → key dropped → Pydantic default 0
  (`sheets.py:147-163,231-256`), so "blank vs 0" was lost from day one and the
  2026-06-16 backfill carried it into Postgres unchanged
  (`context/archive/2026-06-16-supabase-backend/plan.md:394-405`).

### Writers of order_lines

| Writer | Location | manager_final written |
| --- | --- | --- |
| `captain_submit` | `main.py:610-624` via `_evaluate_submit_line`, persisted `:474` | default 0 |
| `captain_order_edit` | same builder, `replace_order_lines_atomic` `main.py:1530` | default 0 (captain-only while `captain_submitted`; any earlier manager finals on a released order are reset — existing behaviour) |
| `manager_claim` | `main.py:1567` | none (status only) |
| `manager_order_save` | `main.py:2155-2169`, write `:2212/2214` | payload lines only: qty, base, comment |
| `manager_dispatch` | `main.py:2003-2028` | payload lines only (untouched → in-memory copy for URL/total only) |
| `manager_add_line` | `main.py:2346-2366` | explicit 0 (skeleton) |
| transport add-location prefill | `main.py:4941-4963` | explicit 0 (skeleton) |
| transport create / finalize / remove / cancel | `main.py:~4400-4600`, `4636-4800`, `4982`, `5168` | none |
| receipts | `main.py:3413-3560` | none (`receipts`/`receipt_lines` only) |

Supabase specifics (`supabase_backend.py`): `_ORDER_LINE_COLUMNS` (`:126-133`) is
bound in full from `model_dump()` by `_insert_many` (`:286-296`) and
`replace_order_lines_atomic` (`:527,544-545`) — a new NOT NULL column needs a
non-Optional Pydantic default (same trap as `warehouse_pickup`, `models.py:130-145`).
`update_order_lines` (`:441-475`) only SETs keys present in `_ORDER_LINE_COLUMNS`.
A boolean needs no entry in `_TIMESTAMPTZ_COLS`/`_DATE_COLS`.

Sheets specifics: row serialization is header-driven (`sheets.py:351-372,396-410`);
a model field missing from the sheet header is silently not written and reads back
as the model default; `update_order_lines` skips unknown fields
(`sheets.py:553-611`). `sheet` mode is still selectable (`config.py`), legacy only.
`seed_loader` has no order_lines support (`seed_loader.py:14-26`).

### Readers of the "0 = unset" rule

Backend:

- `gmail_url._effective_qty` (`gmail_url.py:26-30`) → body filter (`:83`), line qty
  (`:113`), empty-order check (`:209`). Feeds `ManagerDispatchResponse.gmail_compose_url`
  ("Otwórz email" re-open link) only.
- `main._effective_ordered_qty` (`main.py:3403-3409`) → receipt `ordered_qty_purchase`
  and variance (`:3478`), transport aggregate (`:3885`), finalize empty-column guard
  (`:4704`).
- `manager_order_save` total, untouched branch (`main.py:2166-2169`) — hand-rolled copy.
- `_effective_qty_changes` old-qty (`main.py:1791-1815`) — post-send / transport event text.
- `_aggregate_suggestion_review` (`main.py:3284-3340`) averages the **raw** column
  ("0 = manager hasn't changed it, surfaced honestly",
  `context/archive/2026-06-09-bukat-suggestion-learning-loop/plan.md:17`).
- Not readers: `manager_queue`, `finance_match.py`.

Frontend:

- `lib/orderQty.ts:16-19` `effectiveOrderedQtyPurchase` — root helper. Importers:
  `managerLine.ts:22` (`effectiveManagerQtyPurchase`), `OrderDetailPage.tsx:330`,
  `ReceiveDeliveryPage.tsx:79,268`.
- `managerLine.ts`: `deltaVsCaptain` (`:34-38`), `lineVisualState` with the
  `dispatched` gate (`:79-84`), `managerSummary` (`:115-124`).
- `draftState.ts`: `seedDrafts` (`:23-30`), `baselineFor` (`:35-40`), `draftQty`
  (`:43-46`) — **the reported bug**: `ManagerPage.handleSave` → `refreshAll` →
  `loadDetail` → `setDrafts(seedDrafts(d))` (`ManagerPage.tsx:127,291`).
  `dirtySavePayload`/`dispatchPayload`/`isOrderEmpty` read only the draft map.
- `transport.ts:362-375` `seedTransportDrafts` (same helper; reseeded after every
  matrix save, `TransportPage.tsx:411,446-457`).
- `DispatchPanel.tsx:66-68,208`, `ResendPanel.tsx:33-50` — use `draftQty`; fixed
  transitively once seeding is right.
- `OrderDetailPage.tsx:44-53` `managerChangedLine` — own heuristic
  (`manager === 0` counts as changed only on sent/closed non-transport orders).
- `ReceiveDeliveryPage.tsx:79,268` — pre-fills delivered = effective qty and
  renders **every** line (no qty filter), so a zeroed line would show "0 ordered".
- Not readers: `DeliverySection.tsx` (receipt snapshot), `ManagerArchivePage.tsx`,
  `orderEvents.ts`, `inventoryCsv.ts`.
- `OrderDetailPane.tsx:252-257` shows the **persisted** `total_value_estimate_pln`;
  it does not follow the live draft. The live Δ PLN is in the summary strip
  (`:119-121,226`).

### Tests that encode the fallback

Backend: `test_gmail_url.py:308`
(`test_build_url_uses_manager_final_if_present_else_captain_final`);
`test_transport.py:275-292` (effective-qty aggregate tests);
`test_manager_save.py:320-329` (`test_save_total_uses_effective_qty_for_untouched_lines`);
`test_manager_dispatch.py:~400-456` (untouched line not written);
`test_receipt_submit.py:27-58` shared `_fake_order()` (manager 0 → ordered 10);
`test_supabase_integration.py:333-345` (raw round-trip).
Reference pattern for a persistent backend in unit tests: `_activate()` in
`test_manager_save.py:99-118` (patch `DataBackend.SHEET` + `sheets.is_configured`
+ per-function mocks).

Frontend: `lib/orderQty.test.ts:22-25` (two cases asserting 0 → captain);
`managerLine.test.ts:40-49`; `OrderLineTable.test.tsx:28-29`;
`transport.test.ts:402-403,509,550`; `emailBody.test.ts:75-80` (pass-through only);
`captain-mp/OrderDetailPage.test.tsx:53-54,108-145` (intended semantics for the
banner). **No `draftState.test.ts` exists** — the buggy seeding has no direct test.

### Integration test schema

`test_supabase_integration.py::_schema` applies migrations from an explicit list
(`:90-169`); a new migration must be added by hand (archive lesson from
`order-cancel-with-trace`).

### Migration conventions and numbering

- Recent migrations (0019, 0020, 0022) are additive (`ADD COLUMN IF NOT EXISTS …
  NOT NULL DEFAULT …`), carry a rationale comment, the numbering-gap note, the
  "no `%` sign" reminder, an "applied on prod … before the backend deploy" line and
  a `-- Rollback:` statement. Prod data batches use `prod-sql.sql` with
  diff-before / apply / audit-after (`context/changes/pago-suggestion-no-alerts/prod-sql.sql`).
- On `origin/main`: 0001–0007, 0009–0017, 0019, 0020, 0022. Open PRs: #33 → 0021,
  #30 → 0018, #26/#27 → 0008. No branch has 0023; the operator reserved 0023 for
  the display-order lane (2026-09-28 plan). **Next free: 0024.**

### Production data (read-only queries, 2026-09-28)

| Status / channel | Lines | mgr 0 & capt > 0 | mgr > 0 | both 0 |
| --- | --- | --- | --- | --- |
| captain_submitted | 29 | 29 | 0 | 0 |
| manager_claimed (no TRN) | 31 | 30 | 1 | 0 |
| manager_claimed (TRN draft) | 33 | 0 | 8 | 25 (prefill skeletons) |
| manager_sent + closed, email/gmail/portal/phone/manual | 1,214 | **0** | 1,214 | 0 |
| manager_sent, transport | 7 | 7 (one order, untouched) | 0 | 0 |
| cancelled (all channels) | 353 | 129 | 119 | 105 |

- Zero sent orders were edited after send; `order_events` is empty.
- `SUP_PAGO.ordering_method = manual` (no Pago e-mail from the app); Bukat, Filber
  e-mail; Mory manual.

## Code References

- `supply-os-v1/migrations/0001_initial_schema.sql:122-123` — the column definition.
- `supply-os-v1/app/models.py:162-178,287` — `OrderLine`, `OrderLineManagerFinal`.
- `supply-os-v1/app/main.py:1079-1160` — `manager_order_detail` builds `ManagerOrderLineDetail`.
- `supply-os-v1/app/main.py:1211-1270` — `_enrich_lines_for_detail` (captain detail, transport batch detail).
- `supply-os-v1/app/main.py:1791-1815` — `_effective_qty_changes`.
- `supply-os-v1/app/main.py:1933-2069` — `manager_dispatch`.
- `supply-os-v1/app/main.py:2092-2225` — `manager_order_save` (untouched branch `:2166`).
- `supply-os-v1/app/main.py:3403-3409` — `_effective_ordered_qty`.
- `supply-os-v1/app/gmail_url.py:26-30` — `_effective_qty`.
- `supply-os-v1/app/supabase_backend.py:126-133,286-296,441-475,477-546` — column list and writers.
- `supply-os-v1/app/sheets.py:351-372,553-611` — header-driven rows.
- `supply-os-v1/tests/test_supabase_integration.py:90-169` — migration list.
- `frontend/src/lib/orderQty.ts:16-19` — root helper.
- `frontend/src/pages/manager/lib/draftState.ts:23-100` — draft seeding and payloads.
- `frontend/src/pages/manager/lib/managerLine.ts:22-124` — display derivations.
- `frontend/src/pages/manager/lib/transport.ts:362-415` — transport seeding/save.
- `frontend/src/pages/ManagerPage.tsx:118-130,282-337` — load/save/dispatch.
- `frontend/src/pages/captain-mp/OrderDetailPage.tsx:44-53,330` — captain reading.
- `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx:79,268` — receiving pre-fill.
- `frontend/src/types.ts:467-468,577` — TS mirrors.

## Architecture Insights

- The effective-qty rule is conceptually one function with two implementations
  per side (backend `_effective_ordered_qty` + `gmail_url._effective_qty`; frontend
  `effectiveOrderedQtyPurchase`) plus two hand-rolled copies. Any fix should
  collapse the copies onto the helpers, otherwise they drift again.
- Every consumer is a pure function of the line object, so a per-line field rides
  along without signature changes; a status-based rule would need the order status
  threaded into `baselineFor`/`draftQty`/`seedTransportDrafts` (the transport batch
  does not carry a per-order status).
- Deploy ordering: the Supabase writers bind every `_ORDER_LINE_COLUMNS` entry, so
  a new column must exist in prod before the code that lists it is deployed
  (lesson "Verify what production actually runs"; migrations applied by the
  operator first).

## Historical Context (from prior changes)

- `context/archive/2026-06-16-manager-queue-ux/plan.md:30-41,157-206` — recognised
  "pre-dispatch 0 = not set", added the display-only `dispatched` gate, and stated
  that an actively typed 0 SHOULD read as cancelled.
- `context/archive/2026-06-23-order-qty-display/plan.md:104-105,247` — codified the
  FE rule `manager_final > 0 ? manager_final : captain_final`.
- `context/archive/2026-06-26-add-product-to-order/plan.md:93-94,193-197` —
  skeleton lines start at 0 = "not yet quantified"; compatible with a flag that
  starts false.
- `context/changes/week2-feedback-quantities/plan.md:602-683,711-740` — post-send
  edit (Transport members excluded) and the Captain "menedżer zmienił ilości"
  banner, which already treats a dispatched 0 as intentional (the Pago 14.09 case)
  and special-cases `sent_method = transport`.
- `context/archive/2026-06-09-bukat-suggestion-learning-loop/plan.md:17` — the
  learning-loop average reads the raw column on purpose.
- `context/changes/week2-feedback-quantities/analysis.md:44,213` read the WOLA/KEN
  Pago orders of 14.09 (`manager_claimed`, every line `manager_final = 0`) as
  "manager zeroed every line". Prod shows their stored totals still equal the
  captain value (e.g. `ORD-20260914-WOL-PAGO-61280b`: 5,913.00), which a save of
  zeros would have set to 0 — so those lines were never touched. The sentinel
  already misled one analysis; the Phase 7 banner's sent/closed gate kept it
  harmless.

## Related Research

- `context/changes/order-line-zero-qty/frame.md`
- `context/archive/2026-06-16-manager-queue-ux/plan.md`
- `context/archive/2026-06-23-order-qty-display/plan.md`

## Open Questions

1. Should a zeroed line stay visible (amber "Anulowane przez managera", as today
   while editing) or be hidden from the Manager table / receiving list? Marek's
   "rekord się nie kasuje" may mean he expects it to disappear. The history
   argument (learning loop) favours keeping the row.
2. Should the order total in the detail header follow the live draft (Marek's
   "wartość się nie poprawia" may also describe the pre-save state), or is the
   Δ PLN strip enough?
3. Should the learning-loop average (`_aggregate_suggestion_review`) switch to the
   effective qty, or stay raw as documented? Out of scope unless the flag makes it
   trivially better.
4. The 0023 reservation for the display-order lane is not visible in any branch —
   re-check `origin/main` and open PRs immediately before creating the migration.
