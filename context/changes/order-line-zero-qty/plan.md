# Durable Manager zero on order lines — Implementation Plan

## Overview

A Manager who sets a captain-ordered line to 0 loses that decision on the next
reload: `order_lines.manager_final_qty_purchase = 0` also means "Manager has not
set this line", so every reader restores `captain_final`. On the single-order
screen this puts the zeroed line back into the supplier e-mail at the captain
quantity after **Zapisz → Wyślij**. This plan adds an explicit per-line
"Manager has set this" flag, writes it wherever the Manager commits a quantity,
and routes every effective-quantity reader (backend and frontend) through one
rule that honours it.

## Current State Analysis

From `frame.md` (confidence HIGH) and `research.md`:

- Storage cannot express the fact: `manager_final_qty_purchase numeric(12,4) NOT
  NULL DEFAULT 0` (`supply-os-v1/migrations/0001_initial_schema.sql:122`),
  `OrderLine.manager_final_qty_purchase: float = 0` (`supply-os-v1/app/models.py:173`).
- The reported bug: `ManagerPage.handleSave` → `refreshAll` → `loadDetail` →
  `setDrafts(seedDrafts(d))` (`frontend/src/pages/ManagerPage.tsx:127,291`);
  `seedDrafts`/`baselineFor`/`draftQty` read `effectiveOrderedQtyPurchase`
  (`frontend/src/lib/orderQty.ts:16-19`, `manager_final > 0 ? … : captain_final`),
  so the saved 0 reseeds as the captain qty. `dispatchPayload` then sends it
  (`frontend/src/pages/manager/lib/draftState.ts:91-100`) and `DispatchPanel`
  builds the e-mail from the same draft (`DispatchPanel.tsx:68,208`).
- Same rule, other readers: `gmail_url._effective_qty` (`gmail_url.py:26-30`, the
  "Otwórz email" URL), `main._effective_ordered_qty` (`main.py:3403-3409` →
  receipts `:3478`, transport aggregate `:3885`, finalize guard `:4704`),
  `manager_order_save` untouched branch (`main.py:2166-2169`), `_effective_qty_changes`
  (`main.py:1805-1809`), dispatch's in-memory fallback (`main.py:2011-2014`),
  Transport draft seeding (`frontend/src/pages/manager/lib/transport.ts:362-375`),
  receiving pre-fill (`ReceiveDeliveryPage.tsx:79,268`), Captain headline qty and
  `managerChangedLine` (`OrderDetailPage.tsx:44-53,330`).
- Writers: only `manager_order_save` (payload/dirty lines) and `manager_dispatch`
  (payload lines; the Manager UI sends every line) write `manager_final_*`
  (`main.py:2159-2164`, `:2020-2028`). Skeleton lines (add-line, transport prefill)
  and captain submit/edit write 0 with nothing set.
- Production (read-only, 2026-09-28): all 1,214 lines on dispatched non-transport
  orders have `manager_final > 0`; every stored `0 with captain > 0` sits on a
  `captain_submitted`, `manager_claimed`, transport-sent or cancelled order and
  means "unset". There is no existing explicit zero to migrate.
- The Captain path is fine (`buildPayloadLines.ts:20-24` drops qty-0 rows; replace
  semantics delete them).

## Desired End State

- A Manager sets a captain-ordered line to 0 and saves: after the reload the row
  still shows 0, amber, "Anulowane przez managera"; the order total excludes it and
  stays excluded after later saves; the e-mail preview and the sent e-mail do not
  contain it; dispatch persists 0.
- The same holds on the Transport matrix (cell stays 0, aggregate/driver list/PDF
  drop it). A captain-origin member whose every line the Manager zeroed now hits
  the existing empty-column guard at finalize: it is released back to the queue
  (`captain_submitted`, marker cleared, zeros and flags kept — `main.py:4747-4753`),
  not cancelled; the Manager cancels it there if needed.
- After dispatch: the "Otwórz email" link, the receiving pre-fill (ordered 0) and
  the Captain's order detail (headline 0, "zmienione (było X)") all agree.
- Lines the Manager never touched behave exactly as today (captain qty), including
  transport-sent orders whose lines finalize never writes.

Verification: backend + frontend unit tests for the rule and each reader, the
Postgres integration test for the new column, `/verify` green, then the operator's
prod check (no dispatch) after migration + deploy.

### Key Discoveries:

- Every consumer is a pure function of the line object, so a per-line flag needs
  no signature changes in `orderQty.ts`, `draftState.ts`, `transport.ts` or
  `emailBody.ts` (research "Architecture Insights").
- `buildEmailBody` has no rule of its own; it filters on the caller's
  `effectiveQtyFor` (`emailBody.ts:66-83`). The backend twin decides lines via
  `_effective_qty`; both builders' text stays byte-identical — only which lines
  qualify changes, and both sides get the same rule.
- Supabase `_insert_many`/`replace_order_lines_atomic` bind every
  `_ORDER_LINE_COLUMNS` entry from `model_dump()` (`supabase_backend.py:286-296,527`)
  — the new field must be a non-Optional `bool = False`, and the column must exist
  in prod before this code runs.
- Sheets rows are header-driven (`sheets.py:351-372,553-611`): a missing column is
  silently skipped and reads back as the default. Sheet mode (legacy) keeps today's
  behaviour for explicit zeros.
- The integration fixture applies migrations from an explicit list
  (`supply-os-v1/tests/test_supabase_integration.py:90-169`).
- The 14.09 Pago orders analysed in week2 as "manager zeroed every line" were in
  fact untouched (research, Historical Context) — the new flag removes that
  ambiguity for future analysis.

## What We're NOT Doing

- Deleting zeroed lines. A zeroed line stays as a row (history for the learning
  loop, audit of what the Captain asked for); it reads as cancelled.
- Hiding zeroed lines from the Captain's receiving screen. They show "0 ordered"
  like add-line skeletons do today, so an unexpected delivery can still be recorded.
- A live draft total in the order header. The persisted total becomes correct on
  Zapisz; the live Δ PLN strip already moves while editing.
- Changing `_aggregate_suggestion_review` (raw average, documented intent) or any
  `order_lines` history column's values.
- Making `manager_final_qty_purchase` nullable or copying captain quantities at
  claim (rejected designs, see Implementation Approach).
- Adding the column to the legacy Google Sheet.
- Changing post-send editability rules or the Transport finalize flow itself.

## Implementation Approach

Additive flag, one rule, both sides:

- New column `order_lines.manager_final_set boolean NOT NULL DEFAULT false`
  (migration **0024**, confirmed by the coordinator on 2026-09-28: 0021 applied
  via merged PR #33, 0022 applied, 0023 display order, 0025 delivery calendar,
  0026 order e-mail v2). The migration backfills `true` where the Manager
  demonstrably committed a value: `manager_final_qty_purchase > 0`, or any line of
  a `manager_sent`/`closed` order with `sent_method <> 'transport'` (the Manager UI
  dispatch writes every line).
- The rule, identical on both sides:
  `set = manager_final_set OR manager_final_qty_purchase > 0`;
  `effective = set ? manager_final_qty_purchase : captain_final_qty_purchase`.
  The `OR > 0` clause keeps every pre-flag row, sheet mode and the deploy window
  (frontend live before backend, or backend before a re-read) on today's behaviour;
  the flag only changes the meaning of a stored 0.
- Writers set the flag to `true` exactly where they write a Manager quantity (save,
  dispatch). Skeleton and captain writers leave the default `false`.
- Backend: one new module `app/order_qty.py` (mirrors `frontend/src/lib/orderQty.ts`)
  owns the rule; `main.py` and `gmail_url.py` call it; the two hand-rolled copies
  are replaced. The API exposes the normalized flag on `ManagerOrderLineDetail`.
- Frontend: `lib/orderQty.ts` owns the rule; `lineVisualState` and the Captain's
  `managerChangedLine` are rewritten on top of it (their status/transport special
  cases become unnecessary).

Rejected: nullable `manager_final` (touches every `> 0` comparison on both sides
and the learning-loop aggregate; Python `None > 0` raises), and "copy captain qty
at claim + status-based rule" (rewrites history values, and any claimed order not
backfilled at the exact deploy moment would read all its untouched lines as 0).

## Critical Implementation Details

**Deploy ordering.** The Supabase writers bind every `_ORDER_LINE_COLUMNS` entry,
so once `manager_final_set` is in that list every captain submit fails until the
column exists. Migration 0024 must be applied on prod by the operator **before**
the PR is merged; the implementer stops at the open PR.

**Dispatch builds the server e-mail from in-memory copies.** In `manager_dispatch`
the Gmail URL is built from `enriched_lines`, which today carry
`manager_final_qty_purchase = 0` for a zeroed payload line — `_effective_qty` then
falls back to the captain qty. The copies must carry `manager_final_set=True`
(their `manager_final` *is* the committed value), and the non-payload branch must
start from the original line's effective qty, not `captain_final`, so a line saved
as 0 earlier and omitted from a partial payload stays 0.

## Phase 1: Schema and backend rule

### Overview

Add the column and model field, make save/dispatch record it, and route every
backend reader through one helper. Exposes the flag to the frontend.

### Changes Required:

#### 1. Migration 0024

**File**: `supply-os-v1/migrations/0024_order_line_manager_final_set.sql`

**Intent**: Add the flag and backfill it for rows where the Manager already
committed a value, following the 0019/0022 conventions (additive, idempotent,
rationale + numbering-gap note, "no `%` sign" reminder, "applied on prod … before
the backend deploy" line, `-- Rollback:` statement).

**Contract**: `ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS manager_final_set
boolean NOT NULL DEFAULT false;` then an idempotent `UPDATE … SET
manager_final_set = true` for (a) `manager_final_qty_purchase > 0`, (b) lines whose
order is `manager_sent`/`closed` with `coalesce(sent_method, '') <> 'transport'`.
Rollback: `ALTER TABLE order_lines DROP COLUMN IF EXISTS manager_final_set;`.

#### 2. Integration fixture

**File**: `supply-os-v1/tests/test_supabase_integration.py`

**Intent**: Apply 0024 in `_schema` after 0022 (with the same kind of comment the
0022 entry has), and add a round-trip test: an appended line reads back
`manager_final_set=False`; `update_order_lines` with `manager_final_set: True` and
qty 0 reads back set and 0.

**Contract**: migration list order 0001…0022, 0024.

#### 3. Model and column list

**Files**: `supply-os-v1/app/models.py`, `supply-os-v1/app/supabase_backend.py`

**Intent**: `OrderLine.manager_final_set: bool = False` (documented like
`warehouse_pickup`: non-Optional because the insert binds every column);
`ManagerOrderLineDetail.manager_final_set: bool = False` (normalized: true when the
Manager has set the line, including a legacy positive value); add the column to
`_ORDER_LINE_COLUMNS`.

**Contract**: `_ORDER_LINE_COLUMNS` gains `"manager_final_set"`; no entry in the
temporal cast sets.

#### 4. Shared rule module

**File**: `supply-os-v1/app/order_qty.py` (new)

**Intent**: Single backend home for the rule, mirroring `frontend/src/lib/orderQty.ts`,
with a docstring explaining why 0 alone is ambiguous.

**Contract**: `is_manager_final_set(line: OrderLine) -> bool` and
`effective_ordered_qty(line: OrderLine) -> float` implementing
`set = manager_final_set or manager_final_qty_purchase > 0`.

#### 5. Readers switch to the helper

**Files**: `supply-os-v1/app/gmail_url.py`, `supply-os-v1/app/main.py`

**Intent**: `gmail_url._effective_qty` delegates to `effective_ordered_qty` (keep the
private name so call sites stay put); `main._effective_ordered_qty` likewise (it is
imported by `test_transport.py:2804`); `_effective_qty_changes` old qty,
`manager_order_save`'s untouched-line total branch, and dispatch's non-payload
branch use the helper. Update the docstrings/comments that restate the old rule
(`main.py:1796-1797,2151,3404-3406,3849-3851,4655`; `gmail_url.py:26,193-194`).

**Contract**: no public signature changes; behaviour differs only for a line with
`manager_final_set=True` and `manager_final_qty_purchase == 0`.

#### 6. Writers set the flag

**File**: `supply-os-v1/app/main.py`

**Intent**: `manager_order_save` and `manager_dispatch` add
`"manager_final_set": True` to each payload line's `line_updates`; dispatch's
`enriched_lines` copies carry `manager_final_set=True` (see Critical
Implementation Details). No other writer changes.

**Contract**: `line_updates[order_line_id]` keys become
`{manager_final_qty_purchase, manager_final_qty_base, manager_comment,
manager_final_set}` — update the dispatch test that asserts the exact key set.

#### 7. API exposure

**File**: `supply-os-v1/app/main.py`

**Intent**: Both `ManagerOrderLineDetail` construction sites —
`manager_order_detail` (`main.py:1114`) and `_enrich_lines_for_detail`
(`main.py:1230`, which also serves the Captain detail and Transport batch
detail) — set `manager_final_set=is_manager_final_set(line)`. There is no third
site.

**Contract**: `ManagerOrderLineDetail.manager_final_set` present on
`GET /api/manager/order/{id}`, `GET /api/captain/order/{id}`,
`GET /api/manager/transport/batch/{id}`.

#### 8. Backend tests

**Files**: `supply-os-v1/tests/test_order_qty.py` (new), `test_manager_save.py`,
`test_manager_dispatch.py`, `test_gmail_url.py`, `test_transport.py`,
`test_receipt_submit.py`

**Intent**: Truth table for the helper (unset 0 → captain; set 0 → 0; legacy
positive unset → manager; set positive → manager). Save: touched lines get the
flag; a later save touching another line keeps the explicitly zeroed line out of
the total. Dispatch: payload lines get the flag; the returned Gmail URL omits a line
dispatched as 0; a previously saved explicit 0 omitted from the payload stays out
of URL and total. Gmail builder: keep the unset-0 fallback case, add set-0 skipped.
Transport: aggregate drops an explicitly zeroed captain line; finalize releases a
captain-origin member whose lines (captain qty > 0) are all explicitly zeroed —
assert `status=captain_submitted`, marker cleared, "empty — removed" in `skipped`
(the existing `test_finalize_removes_empty_captain_origin_order_released` only
covers captain qty 0). Receipt: an explicitly zeroed line
records ordered 0. Detail: the flag is exposed normalized. Follow `_activate()` in
`test_manager_save.py:99-118` for the persistent fake backend.

**Contract**: existing fallback tests keep passing unchanged except where they
assert the exact dispatch `line_updates` key set.

### Success Criteria:

#### Automated Verification:

- Backend lint passes: `cd supply-os-v1 && ruff check .`
- Backend unit tests pass: `cd supply-os-v1 && python -m pytest`
- Integration tests pass on a local Postgres with 0024 applied: `cd supply-os-v1 && SUPPLY_OS_DATA_BACKEND=supabase SUPPLY_OS_DATABASE_URL=<local> python -m pytest -m integration`
- `grep -n "manager_final_qty_purchase > 0" supply-os-v1/app` returns only `order_qty.py`

#### Manual Verification:

- Migration 0024 SQL reviewed by the operator (idempotent, additive, rollback line present)

**Implementation Note**: After this phase's automated checks pass, continue to
Phase 2 in the same session (the phases ship as one PR); Phase 3 is where the
human gates are.

---

## Phase 2: Frontend rule

### Overview

Teach the frontend helper the flag and simplify the two places that reinvented the
rule. Draft seeding, dispatch payload, e-mail builder, Transport seeding and
receiving follow automatically.

### Changes Required:

#### 1. Type

**File**: `frontend/src/types.ts`

**Intent**: `ManagerOrderLineDetail.manager_final_set?: boolean` — optional per the
"mirror Pydantic optionality" lesson (backend default False) and so a frontend
deployed before the backend degrades to today's behaviour.

**Contract**: one optional field.

#### 2. Shared helper

**File**: `frontend/src/lib/orderQty.ts`

**Intent**: Add `isManagerFinalSet(line)` and base `effectiveOrderedQtyPurchase` on
it, with the same rule and a comment naming the backend twin `app/order_qty.py`.

**Contract**: `isManagerFinalSet(line: ManagerOrderLineDetail): boolean`;
`effectiveOrderedQtyPurchase` signature unchanged.

#### 3. Manager row state

**Files**: `frontend/src/pages/manager/lib/managerLine.ts`,
`frontend/src/pages/manager/OrderLineTable.tsx`,
`frontend/src/pages/manager/OrderDetailPane.tsx`

**Intent**: `lineVisualState` becomes purely effective-qty based (cancelled when the
effective qty is 0 and the captain ordered > 0); the `dispatched` parameter and its
threading are removed (`managerSummary`, `OrderLineTable` prop,
`OrderDetailPane.tsx:117-121,197`). This also stops untouched lines on
transport-sent orders from reading as cancelled.

**Contract**: `lineVisualState(line: ManagerOrderLineDetail): LineVisualState`;
`managerSummary(lines, effectiveQtyFor?)`.

#### 4. Captain order detail

**File**: `frontend/src/pages/captain-mp/OrderDetailPage.tsx`

**Intent**: `managerChangedLine` becomes "the Manager has set the line and its
effective qty differs from the captain's", using the shared helper; the
`sent_method === "transport"` and status special cases go (the flag already
distinguishes them). Update the explanatory comment.

**Contract**: `managerChangedLine(line)`; the headline qty keeps using
`effectiveOrderedQtyPurchase`.

#### 5. Frontend tests

**Files**: `frontend/src/lib/orderQty.test.ts`,
`frontend/src/pages/manager/lib/draftState.test.ts` (new),
`frontend/src/pages/manager/lib/managerLine.test.ts`,
`frontend/src/pages/manager/lib/transport.test.ts`,
`frontend/src/pages/manager/OrderLineTable.test.tsx`,
`frontend/src/pages/captain-mp/OrderDetailPage.test.tsx`

**Intent**: Rule truth table (incl. missing flag = legacy behaviour). Draft state:
a line saved as explicit 0 reseeds as 0, is not dirty, and `dispatchPayload` sends
0; an untouched line seeds the captain qty. Row state: explicit 0 is cancelled on
claimed and sent orders; an untouched line on a transport-sent order is neutral.
Transport: `seedTransportDrafts` keeps an explicit 0. Captain detail: explicit 0 on
a sent order shows the change hint and headline 0; untouched transport line shows
nothing. Adjust existing cases whose fixtures relied on the old gates.

**Contract**: fixtures add `manager_final_set` only where the case needs it.

### Success Criteria:

#### Automated Verification:

- Frontend build passes (includes `tsc -b`): `cd frontend && npm run build`
- Frontend lint passes: `cd frontend && npm run lint`
- Frontend tests pass: `cd frontend && npm run test`
- `/verify` passes end to end (Homebrew node if the default node cannot load rollup)

#### Manual Verification:

- Local E2E on the demo Postgres 16 (`supply_os_demo`, reseeded, 0024 applied; backend `SUPPLY_OS_DATA_BACKEND=supabase` with auth ON and only a manager token): on a claimed order zero a captain line → Zapisz → reload → row still 0, amber "Anulowane przez managera", total down, line absent from the e-mail preview; restore it → Zapisz. No dispatch needed.
- Local E2E Transport: a draft batch with a captain-origin member (create a captain order locally, combine it) — zero a cell → save → reload → still 0 and gone from the aggregate list.

**Implementation Note**: The local environment recipe is in the auto-memory
note "Demo env = local Postgres" (start with `LC_ALL=C pg_ctl …`; the fixture
refuses non-localhost DSNs). Use the Browser pane via `.claude/launch.json` and
a Vite dev server pointed at the local backend. The implementer runs these
checks itself; the human gates are in Phase 3.

---

## Phase 3: Rollout (operator-gated)

### Overview

Package the change, stop for the operator, then verify on prod without placing an
order.

### Changes Required:

#### 1. Prod SQL companion

**File**: `context/changes/order-line-zero-qty/prod-sql.sql`

**Intent**: Operator script in the house style (diff before / apply / audit
after): pre-check counts (lines that the backfill will flag, and confirmation that
no dispatched non-transport line has `manager_final = 0` with `captain_final > 0`
that the rule would misread), the 0024 statements, and an audit query (column
exists, `NOT NULL`, flagged counts match the pre-check, no transport-sent untouched
line flagged).

**Contract**: read-only sections clearly separated from the one DDL/UPDATE section.

#### 2. PR

**Intent**: Commit phases 1–2 + change artifacts, open a PR against `main` with the
migration-first deploy order spelled out, bind it with the ccd_pr tools, then STOP
before merge.

**Contract**: PR body lists: migration 0024 must be applied before merge; manual
prod checks below.

#### 3. Operator note for Marek

**File**: `context/changes/order-line-zero-qty/change.md` (Notes)

**Intent**: Two Polish sentences the operator can forward: zero on a line now sticks
after Zapisz, the line stays visible as "Anulowane przez managera" and is not sent
to the supplier.

#### 4. Archive reminder

**Intent**: When the change is archived (not in this PR): add a Horizon 3 row to
`context/foundation/roadmap.md` and refresh the test counts quoted in `AGENTS.md`,
`supply-os-v1/AGENTS.md` and `frontend/AGENTS.md`, in the archive commit (lesson
"Reconcile roadmap.md and AGENTS.md in the same commit that archives a change").

### Success Criteria:

#### Automated Verification:

- `prod-sql.sql` dry-run on the local demo Postgres succeeds with `COMMIT` swapped for `ROLLBACK`
- CI green on the PR (backend, backend-integration, frontend jobs)

#### Manual Verification:

- Operator applied 0024 on prod before merge; `prod-sql.sql` audit matches the pre-check
- After merge: new Vercel bundle and Railway commit confirmed live before any live check
- Prod smoke on a throwaway order (Captain submits a small order for an e-mail supplier → claim) or on a stale claimed order the operator nominates — never an order someone is working on: zero one captain line → Zapisz → after reload the row stays 0, amber, "Anulowane przez managera"; order total dropped; the dispatch e-mail preview no longer lists the line. Then cancel the throwaway order (Anuluj, reason "test") or restore the stale order's quantity. Never click Wyślij.
- Transport prod smoke only if a draft with a captain-origin member exists (none on 2026-09-28); otherwise the Phase 2 local E2E stands.
- An untouched claimed order and an already-sent order look exactly as before.

---

## Testing Strategy

### Unit Tests:

- Rule truth table on both sides (unset/set × 0/positive, plus missing flag on the frontend).
- Each writer sets the flag only for payload lines; skeleton and captain writers never do.
- Each reader: save total across two saves, dispatch URL + total (payload and non-payload explicit zero), receipt ordered qty, transport aggregate + finalize guard, detail exposure, draft seeding/dirty/dispatch payload, row state, captain hint.

### Integration Tests:

- 0024 applied in the Postgres fixture; append/update round-trip of the flag.

### Manual Testing Steps:

1. Before the PR: local E2E on the demo Postgres (claimed order and Transport draft), and a `prod-sql.sql` dry-run with ROLLBACK.
2. Apply 0024 on prod (operator), run the `prod-sql.sql` audit.
3. Merge; confirm the new frontend bundle and backend commit are live.
4. Throwaway or nominated stale claimed order: zero → Zapisz → reload → still 0 / cancelled / total down / not in e-mail preview → cancel the throwaway or restore (never Wyślij).
5. Spot-check an untouched claimed order and a sent order for unchanged display.

## Performance Considerations

None: one boolean column read with rows already fetched; no new queries.

## Migration Notes

- 0024 is additive; existing columns keep their values. The backfill only sets the
  new flag where the Manager demonstrably committed a value.
- Behaviour for existing rows is unchanged by construction (`OR > 0` plus the fact
  that no stored 0 on a dispatched non-transport order exists today; the pre-check
  confirms it at apply time).
- Rollback: revert the code first, then `DROP COLUMN IF EXISTS manager_final_set`.
  Reverting code while the column stays is safe (the default covers inserts).
- Numbering: 0024 is confirmed for this lane (coordinator, 2026-09-28). Rebase on
  `main` before implementing — PR #33 (0021, `SUP_PAGO.ordering_method =
  'transport'`) is merged, so Pago orders now leave only through Transport and the
  aggregate/finalize readers in Phase 1 carry Pago's supplier documents.
- The order e-mail lane (0026) will rebuild `emailBody.ts` / `gmail_url.py` on top
  of this rule, so the rule must live in exactly one helper per side
  (`app/order_qty.py`, `lib/orderQty.ts`); the builders only call it.

## References

- Frame: `context/changes/order-line-zero-qty/frame.md`
- Research: `context/changes/order-line-zero-qty/research.md`
- Prior decision: `context/archive/2026-06-16-manager-queue-ux/plan.md:30-41`
- Migration style: `supply-os-v1/migrations/0022_supplier_suggestion_alerts.sql`
- Persistent fake backend in tests: `supply-os-v1/tests/test_manager_save.py:99-118`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and backend rule

#### Automated

- [x] 1.1 Backend lint passes — 434dfc6
- [x] 1.2 Backend unit tests pass — 434dfc6
- [x] 1.3 Integration tests pass on a local Postgres with 0024 applied — 434dfc6
- [x] 1.4 Old rule remains only in order_qty.py — 434dfc6

#### Manual

- [ ] 1.5 Migration 0024 SQL reviewed by the operator

### Phase 2: Frontend rule

#### Automated

- [x] 2.1 Frontend build passes — f9dc080
- [x] 2.2 Frontend lint passes — f9dc080
- [x] 2.3 Frontend tests pass — f9dc080
- [x] 2.4 /verify passes end to end

#### Manual

- [x] 2.5 Local E2E: claimed order zero sticks after Zapisz and reload, not in e-mail preview — f9dc080
- [x] 2.6 Local E2E: Transport captain-origin cell zero sticks after save and reload — f9dc080

### Phase 3: Rollout (operator-gated)

#### Automated

- [x] 3.1 prod-sql.sql dry-run on local demo Postgres with ROLLBACK
- [ ] 3.2 CI green on the PR

#### Manual

- [ ] 3.3 Operator applied 0024 on prod before merge; audit matches the pre-check
- [ ] 3.4 New Vercel bundle and Railway commit confirmed live
- [ ] 3.5 Prod smoke on a throwaway or nominated stale order: zero sticks, not in e-mail preview, never Wyślij
- [ ] 3.6 Transport prod smoke only if a captain-origin draft exists
- [ ] 3.7 Untouched claimed and sent orders unchanged
