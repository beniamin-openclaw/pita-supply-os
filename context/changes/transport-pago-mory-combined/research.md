---
date: 2026-09-28T20:30:00+02:00
researcher: Claude
git_commit: 3915bab
branch: claude/transport-pago-mory-combined
repository: pita-supply-os
topic: "One Pago Transport run that also carries Magazyn Mory orders"
tags: [research, transport, pago, mory, supplier]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude
---

# Research: One Pago Transport run that also carries Magazyn Mory orders

## Research Question

What stops a Transport batch from carrying SUP_PAGO and SUP_MORY orders together, and where does each Transport document decide which lines it shows? The operator's target, option 2B (2026-09-28):

- One run carries both suppliers.
- The Pago pickup document and the Pago order e-mail/PDF carry Pago lines only.
- The driver list, PDF and draft carry everything, in supplier blocks Pago → Mory, each block in `display_order`.
- Mory members join, leave the queue and are finalized with the batch.

## Summary

On the backend, a Transport batch is single-supplier in five places:

- the eligible filter;
- the create skip rule;
- the batch-list filter;
- the aggregation grouping key;
- add-location, which creates its order for the header supplier and blocks a second order per location.

Everything else is already supplier-agnostic because it keys on the `TRN-` marker: finalize, remove-order, cancel, the logistics patch, the draft-lock guard, the post-send freeze and events.

On the frontend:

- The matrix, the orderable fetch and add-location assume one supplier.
- Every Pago-facing builder reads `detail.lines` unfiltered. Mory lines would therefore leak into the Pago pickup PDF, the Pago e-mail and the Pago Gmail draft.
- The driver documents have one section bar and one table.

No schema change is needed.

## Detailed Findings

### Prod facts (read-only query, 2026-09-28)

- **`SUP_PAGO` "Pago"**
  - `ordering_method = transport`, so per-order dispatch 409s (R-20). Has an e-mail.
  - 6 active supplier_products, all `warehouse_pickup = true`, all with `unit_weight_kg`.
- **`SUP_MORY` "Magazyn własny Mory"**
  - `ordering_method = manual`, no e-mail.
  - 18 active supplier_products, none `warehouse_pickup`, none with `unit_weight_kg`.
  - Orders today: 2 captain_submitted, 2 manager_claimed, 4 manager_sent, 2 closed. None carries a `TRN-` marker.
- **Shared products.** No active product is sold by both suppliers. The old `SP_PAGO_*` rows for Mory goods are inactive (training-feedback-0901 `pago-catalogue-cleanup.md`). Historical Pago orders can still carry those lines.

### Backend: where "one supplier" is enforced

All line numbers are in `supply-os-v1/app/main.py`.

- **Eligible.** `manager_transport_eligible` (4189) keeps `o.supplier_id == supplier_id` (4219) and sorts newest first.
- **Batch list.** `manager_transport_batches` (4269) has two problems:
  - It filters each ORDER by supplier (4309) before grouping by marker. A mixed batch would therefore be split across two supplier lists, each with partial counts.
  - The summary supplier comes from `group[0]` even when a header exists (4347-4348).
- **Aggregation.** `_aggregate_transport_lines` (4077):
  - groups by `product_id` alone and takes the first-seen supplier_product;
  - sorts globally by `supplier_product_sort_key`.
  - Its docstring says the batch is "single-supplier by construction". It also claims the Pago order e-mail/PDF cover the whole batch, but the frontend Pago PDF already filters on `warehouse_pickup`.
- **Batch detail.** `manager_transport_batch_detail` (4410):
  - takes the supplier from the header (4476);
  - member orders (`TransportBatchOrder`) carry no supplier;
  - builds the aggregate at 4532, then joins weight per aggregate line.
- **Create.** `manager_transport_create` (4637):
  - skips `order.supplier_id != req.supplier_id` as "different supplier" (4770);
  - writes `req.supplier_id` into the header;
  - requires `append_to` to match the header supplier.
- **Add-location.** `manager_transport_add_location` (5112):
  - rejects a location already in the batch (5173);
  - creates the order for `batch.supplier_id` (5188);
  - prefills from `_build_orderable_items(..., batch.supplier_id)` (5203).
- **Supplier-agnostic (keyed on the marker):**
  - finalize (4893), remove-order (5243), batch patch (5355), cancel (5430);
  - `_reject_if_locked_in_draft_transport` (1766);
  - `_is_editable_after_send` (1957);
  - `manager_add_line`, whose orderable check uses `order.supplier_id`. That is correct for a Mory member.
- **Transport-only guard.** `_reject_if_transport_only_supplier` (1797) covers only `ordering_method == transport`:
  - A Mory order outside a batch stays markable per order.
  - Inside a draft batch, the draft guard returns 409 for dispatch, release and cancel.

### Models (`app/models.py`)

- `TransportAggregateLine` (1147) and `TransportBatchOrder` (1201) have no supplier field.
- `TransportBatchDetail` (1263) has a single `supplier_id` / `supplier_name`.
- `TransportAddLocationRequest` (1408) has no supplier field.

### Frontend (`frontend/src/pages/manager/`)

- **`lib/transport.ts`**
  - `buildTransportDriverText` (148): one supplier line.
  - `buildTransportEmailBody` (192): all lines, plus the extra items of all orders.
  - `buildTransportMatrix` (310): one row per product_id.
  - `buildTransportDriverPrintDoc` (740): one `supplierBarText` (hardcoded "/ LINEAGE" for SUP_PAGO) and one product list.
  - `computePagoWarehouseExclusion` (819): would list every Mory line as excluded.
  - `buildTransportPagoPrintDoc` (891): filters `qty > 0 && (!isPago || warehouse_pickup)`. Mory lines drop out today only because their `warehouse_pickup` is false, which is an accident, not a rule.
- **`lib/gmailDraft.ts`.** `buildPagoDraftEmail` (151) and `buildDriverDraftEmail` (168) share `buildDraftBody` (178), which appends the extra items of ALL member orders.
- **`lib/transportPdf.ts`.** `buildDriverPdfDocDefinition` (131) has one `sectionBar` and one table.
- **`TransportPage.tsx`**
  - `fetchOrderable` (295) uses `batchDetail.supplier_id` for every member.
  - `handleAddProductAll` (472) spans every order.
  - `locationsNotInBatch` (519) is keyed by location only; `handleAddLocation` is at 525.
  - One `TransportMatrix` (1170).
  - The sent-view totals and matrix are keyed by `product_id` (1335, 1366).
  - The e-mail button uses `buildTransportGmailUrl(detail, supplier)` (767).
  - `PagoExclusionNotice` is at 1157, `PrintViews` at 1159.
- **`transport/TransportMatrix.tsx`.** Columns are member orders, labelled `location_name`. One batch can already hold two orders from one location (create has no per-location dedupe), so a column cannot become "one per location".
- **`transport/PrintViews.tsx`**
  - "gmailOrder" builds the Pago draft plus the Pago PDF.
  - "gmailDriver" builds the driver draft plus the driver PDF.
  - The order draft's recipient is `suppliers[detail.supplier_id].email`.

### Tests that pin single-supplier behaviour (`supply-os-v1/tests/test_transport.py`)

These tests use SUP_BUKAT as the "other" supplier, so they stay valid when Mory is a companion of Pago only:

- `test_create_wrong_supplier_skipped` (~958);
- `test_batches_filters_by_supplier` (583);
- `test_batch_detail_supplier_id_from_header_when_present` (728): a Bukat member under a Pago header;
- `test_eligible_filters_by_supplier_and_status` (~446).

No test or frontend file mentions SUP_MORY.

## Architecture Insights

- The `TRN-` marker is the only batch-membership key. Status guards, finalize, cancel, remove and the post-send freeze need no supplier awareness.
- Supplier-facing and driver-facing documents already diverge on purpose (`lib/transport.ts` header comment):
  - the supplier gets totals only;
  - the driver gets per-location detail.

  This change adds a second axis: supplier-facing documents cover only the lead supplier's lines.
- Hardcoded supplier ids are an accepted pattern here:
  - backend `_INTERNAL_SUPPLIER_ID`;
  - frontend `isPago`, "/ LINEAGE" and `PAGO_ENTITY`.

## Historical Context

- `context/archive/2026-08-21-to-ordering-pago/plan.md:38` states the original rule: "one physical pickup with Pago AND Bukat = two batches". This change relaxes that rule for exactly one companion pair.
- The pago-data-unity proposal records the gap:
  - a Mory order cannot join a Pago transport;
  - yet Magazyn items travel with the driver on the Pago run.
- `pago-catalogue-cleanup.md` records the move of Mory goods from `SP_PAGO_*` to new `SP_MORY_*` rows that keep the same product_ids.

## Open Questions

- Mory has no `unit_weight_kg` on prod. Until the operator fills these weights, the weight strip will count every Mory line as "brak wagi". This is a data fix, outside this change.
