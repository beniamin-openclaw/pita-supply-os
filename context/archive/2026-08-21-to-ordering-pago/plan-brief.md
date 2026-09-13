# Manager Transport (Pago) — Plan Brief

> Full plan: `context/changes/to-ordering-pago/plan.md`
> Research: `context/changes/to-ordering-pago/research.md` (+ `research-spreadsheet.md`, full legacy-sheet analysis)

## What & Why

Pago ordering today lives entirely outside the app, in the legacy "Ordering PB v5 prod" Google Sheet: one operator fills a per-product × per-location grid, generates a Pago self-pickup order and a driver plan, and the transport draft's stock decrements are the de-facto usage (zużycie) record. The app has never dispatched a Pago order (email = `TBD` since v0). This change gives the Manager an in-app "Transport" workspace: collect submitted location orders for Pago, combine a selected set into one aggregated batch, and keep the per-location quantities as the durable usage record.

## Starting Point

The app is strictly one-order-per-(location, supplier): captains submit, the Manager claims and dispatches each order individually. Nothing aggregates across orders or locations; `Order.supplier_order_reference` is an idle nullable column on every order row; order lines freeze permanently once an order reaches `manager_sent`.

## Desired End State

Manager opens `/manager/transport`, ticks eligible Pago orders across locations, sees a live aggregate preview, and creates a Transport batch. Source orders atomically leave the queue (`manager_sent`, `sent_method="transport"`, marker = TRN- id); guard conflicts are reported per order as skipped, never half-applied. Past batches are listable; a batch detail shows per-product totals + the per-location matrix (the zużycie record) and a copy-to-clipboard text the Manager pastes to Pago until a real dispatch channel lands.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Transport data model | NO new tables — batch = orders sharing a `TRN-…` marker in the idle `supplier_order_reference` column | Removes the N-order atomicity problem structurally, zero migration, suggestion-review-sized test surface, trivially reversible while 6 operator questions are open | Adversary pair |
| Combine semantics | Claim-first two-step guarded transition per order; explicit `combined[]`/`skipped[]` response; `append_to` as the recovery path | Closes the captain-edit race and replaces false cross-order atomicity with safe, visible partial success | Adversary pair |
| Source-order status | Reuse `manager_sent` + `sent_method="transport"`; no new `OrderStatus` value | Status workflow is a production contract; FE never renders `sent_method` (verified) | Plan |
| Order→Transport visibility | Expose `supplier_order_reference` on queue/detail + "TRN" chip in the sent lane | The marker itself is the reverse link; without a chip a Transport-consumed order is indistinguishable from a real email dispatch | Adversary pair |
| Aggregation | Read-time pure function over frozen `order_lines` (effective qty = manager_final>0 else captain_final), shaped like `_aggregate_suggestion_review` | Lines are immutable after `manager_sent`, so a snapshot copy would be a second source of truth for the same fact | Research |
| Usage (zużycie) | = the per-location breakdown of each Transport batch; no stock ledger | The legacy sheet's own "usage" is exactly the issued-per-location quantities; its stock formula was never actually operating | Research (spreadsheet) |
| v1 outputs (two, distinct) | (a) PRIVATE driver list = per-location matrix, in-app + clipboard, never sent; (b) supplier-order EMAIL = per-product totals only, Gmail draft to the supplier's master-data address | Operator clarification 2026-08-21: driver list is private, the order mails to the proper supplier address; matches the legacy split (driver doc vs ODB doc, which also shows totals only) | Operator |
| Pago email prerequisite | Email button disabled-with-hint while supplier email lacks "@" (Pago = `TBD`); real address lands via a gated master-data batch, outside this code lane | Mirrors the backend dispatch "@" gate; Bukat works immediately | Plan |
| Supplier scope | Logic supplier-generic; UI has a supplier picker (Pago default, Bukat for outside-Warsaw pickup runs); one physical run with both = two Transport batches | Bukat doesn't deliver outside WAW (operator); orders/emails are per-supplier in the app; no MEZE/MORY (not modeled) | Operator + Plan |

## Scope

**In scope:** 4 backend endpoints (eligible / create+append / list / detail), pure aggregation helper + models, `supplier_order_reference` exposed on queue/detail, new FE route `/manager/transport` (supplier picker → select → preview → create; batch list/detail with totals table, private driver matrix + copy, totals-only supplier email button with "@" gate), TRN chip in sent lane, i18n (pl+en), TDD throughout.

**Out of scope:** any migration or new table, PDF generation, merged multi-supplier driver doc (one run with Pago+Bukat = two batches), weight limits, Greek Gourmet letterhead, dual recipient lists, stock ledger / Import PB, new OrderStatus, receipts changes, Manager-creates-order-on-behalf, any prod master-data writes (incl. Pago's real email — separate gated batch), the legacy `PROD=2×Razem` column.

## Architecture / Approach

Marker-column aggregation: "combine" = N per-order guarded `update_order` transitions stamping a shared `TRN-` id; everything else derives at read time from frozen `order_lines` via existing targeted loaders. No new seam functions, both backends already support every write used.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend read side | Aggregation helper + eligible/list/detail endpoints, test-first | Aggregate math correctness (mitigated by pure-function tests) |
| 2. Backend create | Guarded combine with skipped[] + append recovery; marker on queue/detail | Guard-conflict handling paths (each branch tested) |
| 3. Frontend workspace | `/manager/transport` screen + copy text + TRN chip | UX of partial success (skipped toast) |

**Prerequisites:** none technical; first real use needs locations actually submitting Pago orders through the app (only WOLA ever has — expected during rollout, not a defect).
**Estimated effort:** ~2-3 implementation sessions across 3 phases (subagent-driven, TDD).

## Open Risks & Assumptions

- Prod may hold zero eligible Pago orders at launch — the screen is legitimately empty until the multi-location rollout produces submissions (verify with a prod count before the first real run).
- Pago email dispatch stays blocked until the operator supplies the real Pago order address (single address vs the legacy distribution list — finanse@/biuro@/Lineage?) and it lands via a gated master-data batch; Bukat Transport emails work from day one. Catalog codes (`PAGO NrKat`) on the email are an open operator question.
- Sheets backend silently drops the marker if its `orders` tab lacks the column — documented divergence; prod is Supabase.
- Operator questions still open (PROD×2 column, product scope beyond Pago, catalog codes, driver docs) — the reversible design deliberately doesn't bet on their answers.

## Success Criteria (Summary)

- Manager can combine N locations' Pago orders into one batch in-app, with a trustworthy per-location usage record kept forever.
- Combined orders visibly leave the queue and are distinguishable (TRN chip) from real dispatches; failures surface as explicit skips, never corruption.
- `/verify` fully green (backend ruff+pytest, FE build+lint+vitest) + preview screenshot of the new screen.
