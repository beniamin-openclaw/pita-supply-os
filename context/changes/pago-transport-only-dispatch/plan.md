# Transport-only supplier channel — implementation plan

## Overview

Give `suppliers.ordering_method` a fifth value, `transport`, and make `manager_dispatch`
refuse every order whose supplier carries it. A transport-only supplier can then only leave
the building through a Manager Transport batch, which is the flow that produces the correct
artifact: a short e-mail with a PDF attachment and no per-location quantities.

## Current State Analysis

`manager_dispatch` (`supply-os-v1/app/main.py:1884-2036`) is the only per-order path that
writes `manager_sent`; the other writer is `manager_transport_finalize`
(`app/main.py:4742`), which is the sanctioned batch exit. Nothing requires a Pago order to
use the batch. The only transport guard, `_reject_if_locked_in_draft_transport`
(`app/main.py:1570-1596`), rejects an order that is *already* stamped into a draft batch and
documents that non-transport orders "pass straight through".

Until v5.3 of `to-ordering-pago`, Pago was accidentally protected: `suppliers.email` was the
placeholder `TBD` and the `@` gate at `app/main.py:1933-1940` blocked the Gmail build. Filling
in the real Lineage distribution list removed that protection and nothing recorded the
consequence. Three orders have since gone out per-order: 2026-09-07 (BROWARY), 2026-09-08
(WOLA) and 2026-09-21 (WOLA).

The channel vocabulary already exists everywhere except on the supplier row.
`manager_transport_finalize` writes `sent_method="transport"` (`app/main.py:4743`) and the
Captain order detail already branches on it (`pages/captain-mp/OrderDetailPage.tsx:51`).

## Desired End State

`SUP_PAGO.ordering_method = 'transport'`. A Manager opening a Pago order sees an amber notice
and a link to the Transport screen where the dispatch controls used to be, with no e-mail
composer, no copy-body button and no "Oznacz jako zamówione". A crafted request straight to
`POST /api/manager/dispatch` for that order returns 409 without writing anything. Orders for
every other supplier behave exactly as before.

Verified by: the new backend tests, the new `DispatchPanel` component test, and a prod check
that `/api/manager/order/{id}` for a Pago order reports `ordering_method: "transport"`.

### Key Discoveries

- Guard insertion window is `app/main.py:1924` — after the supplier None-guard
  (`:1919-1923`), before the `is_email_channel` branch (`:1928`), the Gmail build (`:1994`)
  and both writes (`:2012`, `:2015`).
- The `TRN-` marker is not a safe exception. A batch member never legitimately reaches
  `manager_dispatch`, and the marker survives at least four states that a naive check would
  wave through (sent batch with a skipped member, cancelled batch, legacy marker with no
  header, `WorksheetNotFound` degrade). See `decision-note.md`.
- The server 409 cannot protect the mailbox. `DispatchPanel.tsx:300-315` is a real
  `<a href>` whose click opens a prefilled Gmail compose window **before** the POST is sent,
  and the comment at `:300-302` says the missing `preventDefault` is deliberate. Only the
  channel branch never rendering an e-mail composer stops the mail.
- A stale frontend fails closed. `t()` returns the key name for an unknown key
  (`i18n/index.ts:107-113`) and the four channel branches are equality checks
  (`DispatchPanel.tsx:138-177`), so an old bundle served `transport` renders no dispatch
  control at all.
- Enum consumers are a closed set of six: `app/models.py:66`, `:463`, `app/main.py:1140`,
  `:1928`, `frontend/src/types.ts:22`, `DispatchPanel.tsx:64`, plus
  `ResendPanel.tsx:47` reading `=== "email"`. No exhaustive switch anywhere.
- `supabase_backend.load_suppliers` is `SELECT *` and both `sheets` and `seed_loader` are
  header-driven, so no column list changes. `_SUPPLIER_COLUMNS` is untouched, which also
  removes the integration-fixture insert hazard.
- Migration `0016_reason_code_stock_until_next_delivery.sql` is the exact CHECK-widening
  template, including its ORDER OF OPERATIONS header.

## What We're NOT Doing

- **Not blocking release or cancel.** `manager_release` and `manager_cancel` stay open for a
  transport-only supplier. Cancel is the only exit for an order stranded outside a batch, and
  removing it would trap orders with no in-app recovery.
- **Not blocking edits.** `manager_order_save` and `manager_add_line` stay open; a Manager
  routinely adjusts quantities before folding an order into a batch.
- **Not touching the Transport flow.** It never reads `ordering_method`, and its Pago draft
  reads recipients from `suppliers.email`, which stays exactly as it is.
- **Not adding a queue chip.** A `manager_claimed` order can still be folded into a batch, so
  the panel notice is reached before any irreversible step. `ManagerQueueItem` is untouched.
- **Not changing `ResendPanel`.** It does not dispatch. Once Pago is `transport` its
  `isEmail` check is false and it degrades to the copy-list variant on its own, which is the
  right outcome for the three orders already sent per-order.
- **Not marking the seed CSV.** Seed is the shared fixture for the whole backend suite and
  `CaptainPage` defaults to Pago.
- **Not retro-fixing the three sent orders.** Their disposition with Lineage is an operator
  decision recorded in `change.md`, not a code change.

## Implementation Approach

Three phases, strictly ordered: backend guard, then the frontend branch, then the operator
rollout package. The code is inert until the data pass flips `SUP_PAGO`, so backend and
frontend can land together and the switch is thrown last, by the operator, once both are
verified live.

## Critical Implementation Details

**Deploy ordering is inverted relative to the usual rule, and getting it wrong takes the app
down.** A `transport` value read by a build whose `OrderingMethod` lacks the member raises a
Pydantic `ValidationError` inside `load_suppliers`, which 500s every screen that reads
suppliers. This repo has already had this exact failure once, when `rounding_rule = tenth_kg`
in the live sheet crashed `main`'s enum. The sequence is: apply migration 0021 (safe at any
time, it only widens a CHECK), deploy backend and frontend, confirm the live build, and only
then run the data pass. The migration header and the prod SQL file must both carry this.

## Phase 1: Backend — the transport channel and its guard

### Overview

Add the enum member, the migration that lets the column hold it, and the route guard, with
tests that pin the guard as unconditional.

### Changes Required

#### 1. Migration

**File**: `supply-os-v1/migrations/0021_supplier_ordering_method_transport.sql`

**Intent**: Widen the `suppliers_ordering_method_check` CHECK so the column can hold
`transport`. Additive only; no data is changed here.

**Contract**: `DROP CONSTRAINT IF EXISTS` then `ADD CONSTRAINT` listing
`'email','portal','phone','manual','transport'`, modelled on
`0016_reason_code_stock_until_next_delivery.sql`. The header must state the ORDER OF
OPERATIONS described in Critical Implementation Details and a rollback that is only valid
while no supplier row carries the new value. No `%` character anywhere in the file, because
the integration fixture feeds it to `exec_driver_sql`.

#### 2. Enum member

**File**: `supply-os-v1/app/models.py`

**Intent**: Add `TRANSPORT = "transport"` to `OrderingMethod` with a comment saying it means
"orders leave only through a Manager Transport batch", and that `manager_dispatch` refuses it.

**Contract**: `OrderingMethod` gains a fifth member. `Supplier.ordering_method` and
`ManagerOrderDetail.ordering_method` keep their `= OrderingMethod.EMAIL` defaults.

#### 3. Route guard

**File**: `supply-os-v1/app/main.py`

**Intent**: Add `_reject_if_transport_only_supplier` next to the existing transport guard and
call it from `manager_dispatch` at the insertion window, so no channel can dispatch a
transport-only supplier's order and no write happens first.

**Contract**: `def _reject_if_transport_only_supplier(order: Order, supplier: Supplier) -> None`
— pure, no backend argument and no I/O, unlike `_reject_if_locked_in_draft_transport` which
must read the batch header. No `action` parameter: that sibling carries one because it has
three call sites, this guard has exactly one. Raises `HTTPException(409)` whenever
`supplier.ordering_method == OrderingMethod.TRANSPORT`, unconditionally, with a detail naming
the order, the supplier and the Transport screen. Called from `manager_dispatch` immediately
after the `supplier is None` guard, so it runs before `is_email_channel`. The existing draft
lock at `:1915` stays first, so a live draft member keeps its more specific message.

#### 4. Integration fixture

**File**: `supply-os-v1/tests/test_supabase_integration.py`

**Intent**: Apply migration 0021 in the schema fixture so the CI Postgres schema matches prod.

**Contract**: One `read_text()` of the new migration and one `exec_driver_sql` call inside the
existing `with eng.begin()` block, placed with the other post-0016 migrations and before the
`suppliers` insert. `_ALL_TABLES`, `_TXN_TABLES` and `_SUPPLIER_COLUMNS` are all unchanged.

#### 5. Tests

**File**: `supply-os-v1/tests/test_manager_dispatch.py`

**Intent**: Pin the guard's two load-bearing properties: it fires for a transport supplier,
and it fires *unconditionally*, including for an order that carries a `TRN-` marker. Also pin
that the four existing channels still dispatch.

**Contract**: A `_transport_supplier()` fixture mirroring `_portal_supplier()` at `:472-487`.
Tests assert status 409, that the detail names the Transport screen, and
`update_order.assert_not_called()` plus `update_order_lines.assert_not_called()` — the shape
of `test_transport.py:2236`. One test sets `supplier_order_reference="TRN-…"` on the order and
still expects 409. The existing portal, phone and e-mail tests are the regression guard and
must keep passing untouched.

#### 6. Docs

**File**: `docs/pita-supply-os-v1/DATA_MODEL.md`, `docs/pita-supply-os-v1/MANAGER_V2_SPEC.md`

**Intent**: Keep both documents that enumerate the channel values honest. `DATA_MODEL.md`
lists the allowed values for the column; `MANAGER_V2_SPEC.md` carries an explicit
`ordering_method` to `sent_method` mapping table with one row per channel.

**Contract**: One table row edited in `DATA_MODEL.md` section `## 2. suppliers`, with a
`(0021)` citation matching how `locations.email` cites `(0019)`. One row added to the mapping
table at `MANAGER_V2_SPEC.md:219-236` recording that `transport` has no per-order
`sent_method` because the channel never dispatches per order; the surrounding prose that
names the four values is updated with it.

### Success Criteria

#### Automated Verification

- `python3 -m ruff check .` clean in `supply-os-v1/`
- `python3 -m pytest` green, including the new dispatch tests
- The new 409 fires for every channel value and for an order carrying a `TRN-` marker
- Existing portal, phone, manual and e-mail dispatch tests still pass

#### Manual Verification

- `pytest -m integration` green in CI with the new migration wired

---

## Phase 2: Frontend — the transport branch

### Overview

Render a blocking notice instead of dispatch controls, so the e-mail composer never exists
for a transport-only supplier.

### Changes Required

#### 1. Channel union

**File**: `frontend/src/types.ts`

**Intent**: Add `"transport"` to `OrderingMethod` so the new branch type-checks.

**Contract**: `export type OrderingMethod = "email" | "portal" | "phone" | "manual" | "transport";`
at `:22`. `ManagerOrderDetail.ordering_method` and `Supplier.ordering_method` keep their
current shape.

#### 2. Dispatch panel branch

**File**: `frontend/src/pages/manager/DispatchPanel.tsx`

**Intent**: Add a fifth `method === "transport"` branch that renders an amber notice plus a
link to the Transport screen and no action control, and add the matching `titleKey` entry.
Update the file header comment, which documents the channel contract.

**Contract**: A new branch beside the existing four at `:138-177`, following the `manual`
branch's inline shape rather than a sub-component. The amber notice reuses the markup of the
`noEmail` banner at `:231-233`. The route is hardcoded in the TSX as
`<Link to="/manager/transport">` with the label from i18n, matching
`ManagerPage.tsx:485-490`; no i18n key may contain a URL. The `titleKey` map at `:125-132`
gains a `transport` entry. Nothing else in the file changes, so `markOrderedButton`,
`EmailDispatch`, `PortalDispatch` and `PhoneDispatch` are untouched and the block is
automatically scoped to the dispatch branch of `OrderDetailPane`.

#### 3. Copy

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Add the notice text, the link label and the panel title for the new channel, in
Polish and English, in the existing G3 dispatch block.

**Contract**: Three keys alongside `manager.dispatch.manual` at `:543`:
`manager.dispatch.transport` (panel title), `manager.transportOnlyNote` (why this order
cannot be sent from here), `manager.transportOnlyLink` (the link label). Polish is the
operator-facing text and must name the Transport screen.

#### 4. Component test

**File**: `frontend/src/pages/manager/DispatchPanel.test.tsx`

**Intent**: First component test for this panel. Assert that a `transport` detail renders the
notice and the link and renders none of the dispatch affordances, and that an `email` detail
still renders the Gmail link.

**Contract**: Follows `ManagerQueue.test.tsx:1-51` — `MemoryRouter` plus `LangProvider`, a
`makeDetail(overrides)` factory typed `Partial<ManagerOrderDetail>`, explicit imports because
`globals` is off, assertions against Polish strings. The negative assertions matter more than
the positive one: no element with the Gmail label, no "Oznacz jako zamówione", no copy-body
button.

### Success Criteria

#### Automated Verification

- `npm run test` green including the new `DispatchPanel.test.tsx`
- `npm run build` succeeds
- `npm run lint` exits 0

#### Manual Verification

None. A local preview cannot reach this screen: Manager order detail requires a persistent
backend (seed mode answers 503), and the seed CSV deliberately keeps `SUP_PAGO` on `email`,
so no locally reachable order would exercise the branch. The component test above covers the
rendering; visual confirmation is Phase 3's prod check (3.6 / 3.7), not a duplicate here.

---

## Phase 3: Operator rollout package

### Overview

The prod statements, gated so the data pass cannot run before the code is live.

### Changes Required

#### 1. Prod SQL

**File**: `context/changes/pago-transport-only-dispatch/prod-sql.sql`

**Intent**: One runnable file with the ordering baked in: the migration reference, a
SELECT-diff before, the guarded data pass, and audit assertions after.

**Contract**: Four sections mirroring `week2-feedback-quantities/prod-sql.sql`. The data pass
is `UPDATE suppliers SET ordering_method = 'transport' WHERE supplier_id = 'SUP_PAGO' AND
ordering_method IN ('manual', 'email')`, guarded on the current value so a re-run is a no-op.
The guard accepts `email` as well as `manual` because the `manual` stopgap is a separate
operator step that may never have been run: a guard on `manual` alone would then match zero
rows, report success, and leave Pago dispatchable from the per-order screen — the exact
failure this change exists to close. Both accepted values are pre-fix states, so the pass
cannot overwrite a deliberate later change. The audit asserts the value,
that `email` still holds six recipients for the Transport draft, and that no other supplier
changed channel. A commented rollback to `manual` closes the file. The header states in
capitals that the data pass runs only after the deployed build is confirmed live.

#### 2. Change log

**File**: `context/changes/pago-transport-only-dispatch/change.md`

**Intent**: Record the master-data batch per the repo rule: what changed, the before-diff, the
audit result, and the disposition of the three orders already sent.

**Contract**: A dated section appended under `## Notes`.

### Success Criteria

#### Automated Verification

- `prod-sql.sql` contains no unguarded `UPDATE` and no `DELETE`
- The data pass carries `AND ordering_method IN ('manual', 'email')`

#### Manual Verification

- Operator applied migration 0021 on prod
- Operator confirmed the new Railway and Vercel builds are live
- Operator ran the data pass and the audit returned no violations
- Prod check: a Pago order's detail reports `ordering_method: "transport"` and the Manager
  screen shows the notice instead of the composer
- Prod check: a Bukat order still dispatches normally

---

## Testing Strategy

### Unit and route tests

- Guard fires for a transport supplier on a bare order
- Guard fires for a transport supplier on an order carrying a `TRN-` marker, proving it is
  unconditional
- No write happens on rejection, asserted on both `update_order` and `update_order_lines`
- E-mail, portal and phone channels still dispatch, as regression

### Component tests

- `transport` renders the notice and the Transport link
- `transport` renders no Gmail link, no mark-ordered button, no copy-body button
- `email` still renders the Gmail link

### Manual testing steps

Prod only — a local preview cannot reach this screen (seed mode 503s on Manager order
detail, and the seed CSV keeps `SUP_PAGO` on `email`); see `verification/preview-notes.md`.

1. On prod with auth on, after the data pass: open a Pago order as Manager and confirm
   the notice replaces the panel.
2. Confirm the Transport link navigates to `/manager/transport`.
3. Open a Bukat order and confirm the e-mail composer is unchanged.

## Migration Notes

Migration 0021 only widens a CHECK and is safe to apply at any time. The data pass is the real
switch and must run last. If the data pass runs before the code is live, `load_suppliers`
raises `ValidationError` and every supplier-reading screen returns 500; recovery is the
one-line rollback to `manual` in the prod SQL file.

Two caveats the guard cannot cover on its own. First, it is only as good as the active
backend: the flag lives in whichever store `_choose_backend()` resolves, so if prod ever
degrades to Sheets or seed, that supplier row still reads `email` and the guard silently stops
firing. Second, `supply-os-v1/scripts/backfill_supabase.py:33` writes the `suppliers` table
from the Sheet through `_SUPPLIER_COLUMNS`, so re-running it after the data pass would
overwrite `transport` with whatever the Sheet holds. Mirror the value in the Sheet, or do not
re-run that script against suppliers.

## References

- Research: `context/changes/pago-transport-only-dispatch/research.md`
- Adversary-pair decision: `context/changes/pago-transport-only-dispatch/decision-note.md`
- Guard precedent: `supply-os-v1/app/main.py:1570-1596`
- Migration precedent: `supply-os-v1/migrations/0016_reason_code_stock_until_next_delivery.sql`
- Test precedent: `supply-os-v1/tests/test_transport.py:2236`
- Component-test precedent: `frontend/src/pages/manager/ManagerQueue.test.tsx:1-51`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — the transport channel and its guard

#### Automated

- [x] 1.1 ruff clean in supply-os-v1 — 5ce76eb
- [x] 1.2 pytest green including the new dispatch tests — 5ce76eb
- [x] 1.3 409 fires for a transport supplier and for an order carrying a TRN- marker — 5ce76eb
- [x] 1.4 Existing portal, phone, manual and e-mail dispatch tests still pass — 5ce76eb

#### Manual

- [ ] 1.5 pytest -m integration green in CI with the new migration wired

### Phase 2: Frontend — the transport branch

#### Automated

- [x] 2.1 npm run test green including DispatchPanel.test.tsx — 5ce76eb
- [x] 2.2 npm run build succeeds — 5ce76eb
- [x] 2.3 npm run lint exits 0 — 5ce76eb

### Phase 3: Operator rollout package

#### Automated

- [x] 3.1 prod-sql.sql has no unguarded UPDATE and no DELETE — 5ce76eb
- [x] 3.2 The data pass carries AND ordering_method IN ('manual', 'email') — 5ce76eb

#### Manual

- [ ] 3.3 Operator applied migration 0021 on prod
- [ ] 3.4 Operator confirmed the new Railway and Vercel builds are live
- [ ] 3.5 Operator ran the data pass and the audit returned no violations
- [ ] 3.6 Prod: Pago order reports ordering_method transport and shows the notice
- [ ] 3.7 Prod: Bukat order still dispatches normally
