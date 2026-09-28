---
date: 2026-09-21T20:12:25+0200
researcher: Claude (10x-research)
git_commit: 3cf287dc44f1af3886becf7910521fdf4febd00c
branch: main
repository: pita-supply-os
topic: "Blocking per-order dispatch for suppliers that must go through a Transport batch"
tags: [research, codebase, dispatch, transport, suppliers, migration]
status: complete
last_updated: 2026-09-21
last_updated_by: Claude (10x-research)
---

# Research: blocking per-order dispatch for transport-only suppliers

**Date**: 2026-09-21T20:12:25+0200
**Researcher**: Claude (10x-research)
**Git Commit**: 3cf287dc44f1af3886becf7910521fdf4febd00c
**Branch**: main
**Repository**: pita-supply-os

## Research Question

A WOLA x SUP_PAGO order was dispatched from the ordinary Manager queue as a plain-text
e-mail to the Lineage warehouse instead of going through a Transport batch and its PDF.
Where must a guard live, what must change to carry a supplier-level flag, and what prior
decisions constrain the design?

## Summary

Five findings drive the plan.

1. **`manager_dispatch` is the only per-order dispatch entry point.** An exhaustive sweep of
   every `update_order(... status=...)` call in the backend found exactly two writers of
   `manager_sent`: `manager_dispatch` (`app/main.py:2017`) and `manager_transport_finalize`
   (`app/main.py:4742`). Guarding the first is therefore complete, and the second is the
   sanctioned path that must stay open.
2. **There is a precise insertion window for the guard**: `app/main.py:1924`, after the
   supplier None-guard (`:1919-1923`) and before the `is_email_channel` branch (`:1928`).
   That is before the Gmail URL build (`:1994`) and before both writes (`:2012`, `:2015`).
3. **The hole was never considered.** The entire `to-ordering-pago` archive contains no
   statement about a Pago order still being dispatchable from the normal queue. The design
   assumed the batch was the only path without ever enforcing it. Worse, the per-order path
   was *incidentally* blocked until v5.3 because `SUP_PAGO.email` was the placeholder `TBD`
   and the `@` gate rejected it; filling in the real Lineage distribution list removed that
   accidental protection, and nothing recorded the consequence.
4. **A supplier-level boolean is unprecedented.** `suppliers` has carried exactly one boolean
   since the initial schema (`active`), and it is a visibility flag. The closest shape
   precedent is one level down: `supplier_products.warehouse_pickup` (migration 0015).
5. **The riskiest step is the integration-test fixture**, not the code. It is the only step
   whose omission is silent to a normal `pytest` run and only detonates in the CI Postgres
   job.

## Detailed Findings

### The dispatch route and its existing guard

`manager_dispatch` is `app/main.py:1884-2036`. Ordered shape:

| Lines | Stage |
|---|---|
| 1896-1900 | persistence gate, 503 |
| 1902-1903 | cache bust + `get_order` |
| 1904-1913 | 404, then 409 unless `manager_claimed` |
| 1915 | `_reject_if_locked_in_draft_transport(backend, order, "dispatch")` |
| 1917-1923 | `load_suppliers`, resolve `supplier`, 500 if missing |
| 1928-1940 | `is_email_channel`, then the `@` gate 400 |
| 1942-1989 | further reads, in-memory line build |
| 1994-2007 | Gmail URL build |
| 2011-2023 | write lines, then guarded status write |

`_reject_if_locked_in_draft_transport` (`app/main.py:1570-1596`) is the precedent to mirror.
It takes `(backend, order, action: str)`, early-returns when `supplier_order_reference` is
absent or not `TRN-`-prefixed, invalidates the batch cache, reads the header, and raises 409
only when the header status is `draft`. Three call sites: `manager_release` (`:1801`),
`manager_cancel` (`:1861`), `manager_dispatch` (`:1915`). Its docstring states plainly that
non-transport orders "pass straight through" — an order never added to a batch is out of
scope by construction, which is exactly the hole.

The new guard differs in kind: it is **supplier-derived**, not order-derived, so it must sit
after `supplier` exists (`:1918`) rather than beside the existing lock.

### What a new `suppliers` boolean costs

Reads round-trip without an allowlist edit: `supabase_backend.load_suppliers` uses
`SELECT * FROM suppliers` into the Pydantic model, unlike `orders` / `supplier_products`
which use explicit column tuples. `sheets.load_suppliers` (`app/sheets.py:265-266`) is
header-driven through `_read_with_ttl`, and `_validate_headers` only requires fields with no
default, so a field with a default is optional in the sheet. `seed_loader` uses
`csv.DictReader` and drops `None` values before model construction, so an absent CSV column
behaves exactly like the Pydantic default. Precedent: `nip` (migration 0017) is in the model
but absent from both `_SUPPLIER_COLUMNS` and `suppliers.csv`, and everything loads.

Writes are the constraint. `supabase_backend._insert` (`:273-282`) names **every** column in
the passed list and binds `data.get(c)`, so two failure modes exist for a
`NOT NULL DEFAULT false` column: listing a column the model lacks binds SQL `NULL`, and
declaring the field `Optional[bool] = None` binds `NULL` too. Both raise `IntegrityError`.
The `warehouse_pickup` comment at `app/models.py:131-134` documents this, and the rule was
hardened in `context/archive/2026-09-01-training-feedback-0901/hardening.md:24-26`: match the
Pydantic default to the DDL default, `Optional` only for genuinely nullable columns.

### Frontend surfaces that can dispatch one order

Four trigger points, all funnelling through one handler:

| Trigger | File |
|---|---|
| e-mail link `onClick` | `DispatchPanel.tsx:309` |
| portal confirm-yes | `DispatchPanel.tsx:394` |
| phone mark-ordered | shared node `DispatchPanel.tsx:101`, placed `:470` |
| manual mark-ordered | same node, placed `:174` |

All reach `OrderDetailPane.tsx:350` then `ManagerPage.tsx:306-337` then
`apiClient.ts:460`. A panel-wide early return between `DispatchPanel.tsx:136` and `:138`
covers all four at once, which is far safer than gating three call sites separately.

`ResendPanel` does **not** dispatch. Its header comment and body confirm it only rebuilds a
Gmail message for an already-sent order.

Dispatch errors surface as a toast only (`ManagerPage.tsx:329-332`), never an inline banner,
so a 409 from the new guard would appear as a transient message. That argues for blocking in
the UI rather than relying on the server error being noticed.

Conventions to match: amber notice markup at `DispatchPanel.tsx:231-233`; the route is
hardcoded in TSX while the label comes from i18n, as in
`ManagerPage.tsx:485-490` (`<Link to="/manager/transport">`); no i18n key anywhere contains
a URL or markup. The nearest reusable-notice component is
`pages/manager/transport/PagoExclusionNotice.tsx`.

There is **no existing test** for `DispatchPanel`, `ResendPanel`, `OrderDetailPane` or
`ManagerPage`. A component test here would be the first, following the
`ManagerQueue.test.tsx` pattern: `MemoryRouter` + `LangProvider`, a `makeX(overrides)`
factory, assertions against Polish strings, `globals` off so every helper is imported.

### The queue join is already paid for

`manager_queue` builds `suppliers_by_id` at `app/main.py:862` and looks the supplier up per
row at `:898`, already feeding `supplier_name`, `cutoff_iso` and `minimum_order_value_pln`.
A supplier-derived boolean on `ManagerQueueItem` costs zero extra queries.

## Code References

- `supply-os-v1/app/main.py:1884-2036` — `manager_dispatch`; guard window at `:1924`
- `supply-os-v1/app/main.py:1570-1596` — `_reject_if_locked_in_draft_transport`, the precedent
- `supply-os-v1/app/main.py:4742` — the other `manager_sent` writer, transport finalize
- `supply-os-v1/app/main.py:1126-1160` — `ManagerOrderDetail` assembly; supplier block ends `:1141`
- `supply-os-v1/app/main.py:862, 898, 912-941` — queue supplier join and item construction
- `supply-os-v1/app/models.py:62-74` — `Supplier`; `:126-137` — the `warehouse_pickup` comment
- `supply-os-v1/app/supabase_backend.py:98-101` — `_SUPPLIER_COLUMNS`; `:273-282` — `_insert`
- `supply-os-v1/tests/test_supabase_integration.py:90-184` — migration wiring; `:191-194` — supplier insert
- `supply-os-v1/tests/test_transport.py:2236` — `test_dispatch_locked_for_draft_transport_member`, the test template
- `supply-os-v1/tests/test_manager_dispatch.py:467-560` — the non-email channel tests
- `frontend/src/pages/manager/DispatchPanel.tsx:134-177` — the channel branch and notice slot
- `frontend/src/pages/ManagerPage.tsx:306-337` — `handleDispatch` and its toast-only error path
- `frontend/src/types.ts:494-552` — `ManagerOrderDetail`; `:397-434` — `ManagerQueueItem`
- `frontend/src/App.tsx:146-153` — the `/manager/transport` route

## Architecture Insights

- **Guards are route-level, not backend-level.** Every transport guard is a small
  `_reject_if_*` helper called from the route with an `action` string interpolated into the
  message. The data layer stays ignorant. The new guard must follow that shape.
- **The source of truth for a channel decision is always master data, never the request.**
  `manager_dispatch` branches on `supplier.ordering_method`, explicitly commented as such at
  `:1927`. A supplier flag fits this grain exactly.
- **Master-data booleans ship in three steps**, learned the hard way on `warehouse_pickup`:
  migration, then a data pass with a saved SELECT-diff, then the code that reads it. Shipping
  the reader first yields a silently empty or silently permissive feature.
- **Read paths tolerate a missing column; write paths do not.** This asymmetry is why sheets
  and seed need no change while `_SUPPLIER_COLUMNS` and the integration fixture do.

## Historical Context (from prior changes)

- `context/archive/2026-08-21-to-ordering-pago/research.md:24` — the legacy process "is a
  warehouse pickup-and-distribution run, not an email order".
- `context/archive/2026-08-21-to-ordering-pago/plan.md:396` — `suppliers.email` for SUP_PAGO
  is "the legacy Lineage Logistics distribution list (Pago = 3PL self-pickup; no Pago mailbox
  exists)".
- `context/archive/2026-08-21-to-ordering-pago/plan.md:12` — at design time Pago had
  `ordering_method=email` but `email='TBD'`, so "the in-app email dispatch path has never
  worked for Pago". This is the accidental protection that v5.3 removed.
- `context/archive/2026-08-21-to-ordering-pago/plan.md:7, 221` — the two outputs and the
  no-location-leak invariant: the per-location breakdown is the private driver list and
  "never enters the email".
- `context/archive/2026-08-21-to-ordering-pago/reviews/impl-review.md:101` — the draft lock
  was itself a CRITICAL review finding, not a planned item; same class of hole, narrower.
- `context/archive/2026-09-01-training-feedback-0901/hardening.md:35-39` — B4, shipping a
  `warehouse_pickup` filter before its data pass would have blanked the pickup PDF. The same
  three-step order applies here.
- `context/foundation/lessons.md:72` — master-data batches need diff before, apply, audit
  after, plus a `change.md` entry.
- `context/foundation/lessons.md:51` — mirror Pydantic optionality in TypeScript; repo
  refinement is `field?: T | null` for a nullable column and `field?: T` for a defaulted one.

## Open Questions

1. **Should `ManagerQueueItem` carry the flag and render a chip?** Free in query terms. The
   argument for is that a 409 discovered after claiming and editing an order is a dead end,
   and the queue is where expectation should be set. The argument against is a second chip
   next to the existing `TRN` chip, and scope growth.
2. **Should `SUP_PAGO.ordering_method` revert from `manual` to `email` once the guard is
   live?** `ordering_method` describes how the supplier is contacted; the new flag describes
   that contact must be batched. Keeping `manual` after the guard ships would leave a
   falsehood in master data, but reverting removes a redundant second barrier.
3. **Should the seed CSV mark SUP_PAGO transport-only?** It would match prod, but seed rows
   are shared fixtures for the whole backend suite and a behaviour flip there could affect
   unrelated tests.

These three are the decisions the plan must settle; 1 and 2 are the adversary-pair candidates.
