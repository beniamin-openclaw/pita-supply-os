---
change_id: pago-transport-only-dispatch
title: Transport-only suppliers cannot be dispatched from the per-order queue
status: archived
created: 2026-09-21
updated: 2026-09-28
archived_at: 2026-09-28T13:08:29Z
---

## Notes

Hard guard: a supplier flagged as transport-only cannot be dispatched from the per-order
Manager queue, only through a Transport batch.

### Why now — prod evidence, 2026-09-21

`ORD-20260921-WOL-PAGO-bcdfe8` (WOLA x SUP_PAGO) was dispatched from the ordinary Manager
queue as a plain-text Gmail message. Prod row: `sent_method='email'`,
`supplier_order_reference IS NULL`, so it never belonged to a Transport batch. Submitted
09:39:39 UTC, sent 09:42:37 UTC.

`SUP_PAGO.ordering_method` was `email` and `SUP_PAGO.email` holds six addresses, three of
them real Lineage warehouse mailboxes. The generic per-supplier body carries per-location
quantities in clear text, a delivery address and a requested delivery date, so it reached a
warehouse whose arrangement is self-pickup. The correct Pago artifact is the Transport batch
document: subject `Zlecenie odbioru wlasnego - ...`, short body, PDF attachment built by
`buildTransportPagoPrintDoc` / `buildPagoPdfDocDefinition`, with no per-location quantities.

Not a regression from `week2-feedback-quantities` (merged 2026-09-20). The same route was
used twice before:

| Sent | Location | Order |
|---|---|---|
| 2026-09-07 | BROWARY | ORD-20260906-BRO-PAGO-078562 |
| 2026-09-08 | WOLA | ORD-20260907-WOL-PAGO-e92ac9 |
| 2026-09-21 | WOLA | ORD-20260921-WOL-PAGO-bcdfe8 |

### Root cause

Nothing requires a Pago order to go through Transport. The only existing transport guard,
`_reject_if_locked_in_draft_transport` in `supply-os-v1/app/main.py`, rejects an order that
is ALREADY stamped into a draft batch. An order never added to a batch dispatches freely
through every channel.

### Two-step repair — this change is step 2

Step 1, handled outside this change, is a master-data stopgap flipping
`SUP_PAGO.ordering_method` from `email` to `manual`, which removes the e-mail composer from
the per-order dispatch panel. It does NOT stop a Manager pressing "Oznacz jako zamowione" on
a Pago order outside a batch, which would silently leave that order out of the transport PDF.
This change closes that hole with a supplier-level flag plus a server-side guard.

### Constraints carried into planning

- Migration goes to `0021`; `0018` is reserved by the open PR #30 (dynamic-target-wola).
- New `NOT NULL DEFAULT false` boolean follows the `warehouse_pickup` precedent (migration
  0015), including the models.py rule that it must be `bool = False`, never `Optional`.
- The Transport flow must not be touched. It never reads `ordering_method`, and its Pago
  draft reads recipients from `suppliers.email`, which stays intact.
- Every prod statement lands in a ready-to-run `.sql` file for the operator with
  diff-before / apply / audit-after. The auto-mode classifier blocks agent writes to prod.

### Implementation, 2026-09-21

Phases 1 and 2 implemented; phase 3 is the operator package, not yet run on prod.

**Backend.** `OrderingMethod` gains `TRANSPORT`. `_reject_if_transport_only_supplier(order, supplier)`
sits in `app/main.py` next to the draft-transport lock and is called from `manager_dispatch`
immediately after the supplier None-guard, before the channel branch, the Gmail build and both
writes. It is unconditional: no `TRN-` exception, because a batch member never legitimately
reaches this route and the marker survives four states that would wave an order through.
Migration `0021_supplier_ordering_method_transport.sql` widens
`suppliers_ordering_method_check`; it is wired into the integration fixture.

**Frontend.** `DispatchPanel` gains a fifth `transport` branch that renders an amber notice and
a link to `/manager/transport` and no dispatch control at all. This is the half that protects
the mailbox: the e-mail action is an anchor that opens a prefilled Gmail window before the API
call, so the server 409 cannot stop a message. Three i18n keys, Polish and English. First
component test for this panel.

**Deviation from the plan, recorded.** The plan specified the data pass guarded on
`ordering_method = 'manual'`. The shipped statement guards on `IN ('manual', 'email')`. Guarding
on `manual` alone would silently match zero rows if the stopgap had not been run, leaving Pago
dispatchable and the incident unfixed. The wider guard is correct from either starting point and
still refuses to overwrite a deliberately different value.

**Prod master-data batch — NOT YET APPLIED** (as of 2026-09-21; applied 2026-09-28, see below). `prod-sql.sql` holds the before-diff, the guarded
data pass, the audit and the rollback. It must run only after migration 0021 is applied and both
deployed builds are confirmed live; a `transport` value read by a build without the enum member
raises a ValidationError and 500s every supplier-reading screen.

**The three orders already sent per-order** (`ORD-20260906-BRO-PAGO-078562`,
`ORD-20260907-WOL-PAGO-e92ac9`, `ORD-20260921-WOL-PAGO-bcdfe8`) keep their state and their
receiving path. Their disposition with Lineage is an operator decision, not a code change.

### Merge with main and business context, 2026-09-28

**Stopgap done.** Step 1 above (`SUP_PAGO.ordering_method` `email` -> `manual`) was applied
on prod on 2026-09-28, not 2026-09-21. Section B of `prod-sql.sql` therefore starts from
`manual`; its guard still accepts `email` so a reverted stopgap cannot make it a silent no-op.

**How Pago is ordered now (temporary).** Operator decision, 2026-09-28: for now Pago for every
Warsaw location is sent from the Google Sheet "Ordering PB v5 prod"; the Manager retypes the
app's quantities into it. This is temporary: once the remaining locations are in the app,
Pago goes through the app again. Nothing in the app is disconnected meanwhile; the Transport
screen keeps its Gmail draft (the "correct Pago artifact" paragraph above). The purpose of this
change is unchanged: no per-order Pago dispatch from the Manager queue.

**Merged origin/main (PR #34, pago-suggestion-no-alerts, migration 0022).** The only conflict
was the integration fixture; it now applies 0021 and 0022. The two migrations are independent
(a CHECK vs a new column), so 0021 running on prod after 0022 is safe. Scoped review:
`reviews/impl-review-merge-main.md`. Added tests pin the prod combination (`transport` channel
plus alerts off): Captain orderable + submit still work, per-order dispatch still 409s, and the
row round-trips on Postgres.

### Prod rollout, 2026-09-28 — steps (a)–(d) done

- **(a) Migration 0021 applied on prod** before the merge (MCP `apply_migration`, name
  `0021_supplier_ordering_method_transport`). Before: one CHECK
  `suppliers_ordering_method_check` with four values, SUP_PAGO `manual`, alerts `false`, six
  recipients. After: the same constraint name with five values incl. `transport`; no row
  changed (14 suppliers: email 7, manual 4, portal 2, phone 1).
- **(b) PR #33 merged** as `c2662b9` (2026-09-28 11:05 UTC). CI 9/9 green, including both
  `Backend integration (real Postgres)` runs.
- **(c) Build confirmed live.** Railway deployment for `c2662b9`: success at 11:06:54 UTC;
  `/health` ok; `/openapi.json` `OrderingMethod` = `email, portal, phone, manual, transport`.
  Vercel deployment: success; production bundle `index-CMK7fQGJ.js` on
  pita-supply-os.vercel.app contains `manager.transportOnlyNote`, `manager.transportOnlyLink`
  and `manager.dispatch.transport`.
- **(d) Data pass applied**, after the build for the docs commit `7fac925` was also confirmed
  (Railway success 11:11 UTC, `/health` ok).
  - Section A (before, the rollback reference): SUP_PAGO `ordering_method = 'manual'`,
    `suggestion_alerts_enabled = false`, 6 recipients, active.
  - Section B: `UPDATE ... SET ordering_method = 'transport' WHERE supplier_id = 'SUP_PAGO'
    AND ordering_method IN ('manual', 'email')` returned exactly one row (SUP_PAGO,
    `transport`).
  - Audit C1: `channel_ok = true`, `suggestion_alerts_enabled = false`,
    `email_intact = true`, `recipient_count = 6` (equal to section A).
  - Audit C2 (active suppliers): email 7, manual 2, phone 1, portal 1, transport 1; exactly
    one `transport` row.
  - Audit C3: 15 Pago orders waiting. One `captain_submitted`
    (`ORD-20260928-WOL-PAGO-e4ce78`, no marker) and 14 `manager_claimed`. Of those 14,
    eight carry a Transport marker: `TRN-20260925-PAGO-2d5342` (WESTFIELD, NORBLIN, KEN, ELEKTROWNIA, BROWARY) and
    `TRN-20260902-PAGO-aa283f` (ELEKTROWNIA, BROWARY, BRACKA); six have no marker:
    `ORD-20260927-KEN-PAGO-81f35f`, `ORD-20260914-KEN-PAGO-9ec6c9`,
    `ORD-20260914-WOL-PAGO-61280b`, `ORD-20260907-BRA-PAGO-ffdb4f`,
    `ORD-20260907-KEN-PAGO-63620f`, `ORD-20260904-KEN-PAGO-626d49`. None of these can be
    dispatched from the queue any more; their disposition (fold into a batch, or cancel the
    stale ones) is an operator decision.
  - Rollback, if ever needed: `UPDATE suppliers SET ordering_method = 'manual' WHERE
    supplier_id = 'SUP_PAGO';` (section D).
- **Still open:** plan Progress 3.6 / 3.7, the Manager-screen checks on prod (a Pago order
  shows the Transport notice instead of dispatch controls; a Bukat order still dispatches).
  Not run by the agent: they need the Manager token.

### Carried over to the operator at archive, 2026-09-28

Operator decision (relayed by the coordinator session, 2026-09-28): archive now, carry the two
manual prod checks over.

- **3.6** Pago order on the Manager screen shows the Transport notice instead of dispatch
  controls. Not run: it needs the Manager token. Read-only evidence: prod SUP_PAGO
  `ordering_method = 'transport'`; live Railway `/openapi.json` carries the value; the Vercel
  bundle carries the notice keys; `test_dispatch_transport_*` and `DispatchPanel.test.tsx`
  cover the guard and the panel.
- **3.7** A Bukat order still dispatches by e-mail. Not run (it would dispatch). Read-only
  evidence: SUP_BUKAT unchanged (`ordering_method = 'email'`, address present); the existing
  e-mail dispatch tests pass.
- No Pago or Bukat order was dispatched between the deploy (11:05 UTC) and the archive.
- The 15 waiting Pago orders listed above belong to the "Uporządkuj dane Pago" lane.

