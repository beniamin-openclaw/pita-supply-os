# Pago + Magazyn Mory on one Transport run — Implementation Plan

## Overview

The Pago Transport run also carries Magazyn własny Mory orders:

- A Pago batch accepts Mory orders as members. They are combined, edited, finalized and cancelled with the batch, exactly like Pago members.
- The Pago-facing documents carry Pago lines and Pago members' off-catalogue items only:
  - the pickup PDF;
  - the order e-mail;
  - the Pago Gmail draft.
- The driver documents carry everything, in supplier blocks Pago → Mory, each block in `display_order`. These are the driver text, the driver PDF and the driver Gmail draft.

This is follow-up 2 of `supplier-product-order-minimum`. The operator accepted option 2B on 2026-09-28. The change is built now and merged after the new locations start on 1.10. It needs no migration.

## Current State Analysis

See `research.md`. In short, a batch is single-supplier in five backend places:

- the eligible filter: `main.py:4219`;
- the create skip rule: `main.py:4770`;
- the batch-list filter: `main.py:4309`, which also reads its supplier from `group[0]` at 4347;
- aggregation, which groups by `product_id` alone: `main.py:4077`;
- add-location: `main.py:5173`, `5188`, `5203`.

Finalize, remove, cancel, patch, the draft-lock guard, the post-send freeze and events key on the `TRN-` marker and need no change.

The frontend builders read `detail.lines` / `detail.orders` unfiltered:

- `lib/transport.ts:148, 192, 740, 819, 891`;
- `lib/gmailDraft.ts:178`.

The draft matrix, the orderable fetch and add-location assume the header supplier (`TransportPage.tsx:295, 472, 519, 525, 1170`).

Prod data (read-only, 2026-09-28):

| Supplier | Name | `ordering_method` | Active products | `warehouse_pickup` | Weights | Orders |
|---|---|---|---|---|---|---|
| SUP_PAGO | "Pago" | `transport` | 6 | all 6 | all 6 | — |
| SUP_MORY | "Magazyn własny Mory" | `manual`, no e-mail | 18 | none | none | 10, none in a transport |

No active product is sold by both.

## Desired End State

- Transport screen, supplier Pago:
  - The "Do połączenia" list shows Pago orders, then Mory orders, each newest first. A Mory row carries its supplier name.
  - Creating a batch from a mix combines both; the header stays SUP_PAGO.
- Draft batch: one editable matrix per supplier, Pago first. Each section has:
  - a heading with the supplier name, shown when the batch can hold more than one supplier;
  - its own "Dodaj lokalizację" picker;
  - its own "+ Dodaj produkt" picker.

  The Mory section shows even with no Mory member yet, so a Mory column can be added.
- Add-location with `supplier_id = SUP_MORY` creates a Mory order for that location, prefilled from Mory's catalogue. Two rules apply:
  - A second Mory order for the same location is refused.
  - A location can hold one Pago and one Mory order in one batch.
- Finalize sends every claimed member, Pago and Mory, with `sent_method = "transport"`. Cancel releases or cancels both, and remove works on either.
- Pago-facing documents list Pago lines only:
  - the Pago pickup PDF ("ZLECENIE ODBIORU WŁASNEGO"), still filtered on `warehouse_pickup`;
  - the Pago order e-mail;
  - the Pago Gmail draft.

  The Pago extra-items block lists Pago members' items only.
- Driver documents list both suppliers in blocks: Pago (bar "Pago / LINEAGE") then "Magazyn własny Mory". Each block is in `display_order` and has the same location columns.
- The "excluded from the warehouse pickup" notice names only Pago lines.
- The sent view's totals and product × location tables group rows by supplier, with one header row per supplier when the batch holds more than one.
- A sent Pago-only batch, and any batch of a supplier without companions, looks and behaves as today. A Pago draft additionally shows the Mory section (empty until a Mory column is added), and "Dodaj lokalizację" moves from the action row to directly under each section's matrix.
- A frontend that does not opt in (an old bundle in an open tab) never sees or combines a Mory order: the backend only offers companions on `include_companions=true` / `allow_companions=true`.
- Finalize refuses (400) when no member of the lead supplier has a positive quantity, so a "Pago run" never ships with empty Pago documents.
- A prefilled skeleton with no positive quantity is cancelled, not released, on remove-order and cancel (every supplier).
- A `TRN-`-marked order cannot be dispatched from the queue (409); release and cancel from the queue clear the marker.
- The batch list shows a combined batch once, under Pago, with all its members and locations.

### Key Discoveries

- Batch membership is the `TRN-` marker. The status transitions need no supplier awareness (`main.py:1766, 1957, 4893, 5243, 5430`).
- `manager_add_line` checks orderability against `order.supplier_id`, which is already right for a Mory member.
- One batch can already hold two orders from one location (create has no per-location dedupe). Matrix columns therefore stay "one per member order", and the split is by supplier section.
- `buildTransportPagoPrintDoc` drops Mory lines today only because their `warehouse_pickup = false`. That is an accident; the lead-supplier filter makes it a rule.
- The existing single-supplier tests use SUP_BUKAT as the "other" supplier and stay valid.

## What We're NOT Doing

- No migration and no new supplier column. The companion relation is a code constant, the same way `_INTERNAL_SUPPLIER_ID` and the frontend's `isPago` / `PAGO_ENTITY` are. See the Notes for the rejected data-column option.
- No change to `SUP_MORY.ordering_method`. A Mory order outside a batch can still be marked ordered from the queue, as today.
- No change to the queue or the order detail pane:
  - A Mory draft member shows the same TO chip as a Pago member.
  - Its release, cancel and dispatch controls 409 through the existing draft guard, whose message points to the Transport screen.
- No Mory weights. Mory lines will count as "brak wagi" until the operator fills `unit_weight_kg`, which is a data step, recorded as a follow-up.
- No companion for any supplier other than Pago. A Mory batch stays Mory-only.
- Grid create ("Utwórz z lokalizacji") stays lead-supplier only. Mory columns are added inside the draft.
- No Mory-only Transport from the screen: companion suppliers (SUP_MORY) are hidden from the Transport supplier dropdown (frontend mirror of the constant, like `INTERNAL_SUPPLIER_ID`). The backend still accepts a SUP_MORY batch.
- No roadmap row now. It is added at `/10x-archive` (lessons.md).

## Implementation Approach

The backend decides which suppliers may ride on a batch, and every Transport payload names each member's and each line's supplier. The frontend then:

- renders one section per supplier;
- builds supplier-facing documents from a lead-supplier view of the batch (`leadSupplierView`);
- builds driver documents from supplier blocks.

All new response fields default on the backend and are optional in TypeScript (lessons.md: mirror Pydantic optionality). A frontend deployed ahead of the backend treats every line and member as the lead supplier's, which is today's behaviour.

## Critical Implementation Details

- **Companion constant.**

  ```python
  _TRANSPORT_COMPANION_SUPPLIERS: dict[str, tuple[str, ...]] = {"SUP_PAGO": ("SUP_MORY",)}
  ```

  `_transport_supplier_ids(lead)` returns `(lead, *companions)`, which is also the block order.
- **Opt-in (review A1).** Eligible and create honour companions only when the client asks: `GET eligible?include_companions=true`, `TransportCreateRequest.allow_companions = True`. Without the flag both behave exactly as today (companion orders are not listed; create skips them as "different supplier"). The new frontend always sends the flag; an old bundle never does, so it can never put a Mory line into a Pago document.
- **Aggregate grouping key.** It becomes `(order.supplier_id, line.product_id)`. Old Pago orders can carry the inactive `SP_PAGO_P0xx` rows for products that Mory now sells as `SP_MORY_P0xx`; the new key keeps the two apart instead of merging them under the first-seen row.
- **Aggregate sort key.**

  ```python
  (rank(supplier_id), supplier_id, *supplier_product_sort_key(display_order, sp_id))
  ```

  - `rank` is the index in `_transport_supplier_ids(lead)`, or `len(...)` for a supplier outside the list.
  - With no lead given, every rank is 0, so blocks fall into `supplier_id` order.
  - For a single-supplier batch the output order is unchanged.
- **Batch list.**
  - Group every `TRN-` order by marker first, then resolve the batch supplier: the header's `supplier_id`, else `group[0]` for a headerless legacy batch.
  - Then filter by `supplier_id`.
  - `order_count` and `location_ids` cover all members.
- **Add-location.**
  - Resolve `target = req.supplier_id or batch.supplier_id`.
  - If `target not in _transport_supplier_ids(batch.supplier_id)`, return 400.
  - The duplicate guard is per `(location_id, supplier_id)`.
  - Order id, supplier and prefill all use `target`.
- **Frontend lead view.**
  - `leadSupplierView(detail)` returns `{...detail, lines: lead lines, orders: lead orders}`.
  - A line or order without `supplier_id` counts as the lead's.
  - Supplier-facing builders call it internally, so no caller can forget.
- **Driver doc shape.**
  - `TransportDriverPrintDoc.supplierBarText` and `.products` are replaced by `sections: PrintDriverSection[]`, where a section is `{supplierId, supplierBarText, products}`.
  - Sections with no positive line are dropped. When no section is left, the lead section is kept with `products: []`, so the document still renders its bar, as today.
  - The "/ LINEAGE" suffix stays tied to SUP_PAGO.
- **One empty-block rule for all driver documents (review F2).** The driver text uses the same rule as the driver print doc: blocks with no positive line are omitted; when none is left, the lead block is printed with no lines.
- **Supplier fallback (review F3).** The frontend reads `line.supplier_id || detail.supplier_id` (falsy, not nullish), so a `""` from the backend default counts as the lead's.
- **Manager-created-empty (review A2).** remove-order and cancel treat an order as a manager-created empty skeleton when `captain_user == "manager-default"` and no line has a positive effective quantity — the same rule finalize already uses. Such an order is cancelled; any other order is released.

---

## Phase 1: Backend — companion suppliers on a Transport batch

### Overview

Pago batches accept Mory orders. Payloads name the supplier of each member and each line, lines come in supplier blocks, and add-location takes a supplier.

### Changes Required

#### 1. Models (`supply-os-v1/app/models.py`)

- `TransportAggregateLine` (1147) gains two fields, filled by the aggregate:

  ```python
  supplier_id: str = ""
  supplier_name: str = ""
  ```

- `TransportBatchOrder` (1201) gains the same two fields.
- New model:

  ```python
  class TransportSupplierRef(BaseModel):
      supplier_id: str
      supplier_name: str
  ```

- `TransportBatchDetail` (1263) gains `suppliers: list[TransportSupplierRef] = Field(default_factory=list)`. The list holds the suppliers this batch can carry, lead first, then companions, then any other member supplier as a defensive tail.
- `TransportAddLocationRequest` (1408) gains `supplier_id: str | None = None`. None means the batch's own supplier.
- Update the `warehouse_pickup` field comments that say the order e-mail/PDF cover the whole batch (models 1176-area, and 173 if it says so). They now cover the lead supplier's lines.

#### 2. Companion constant and ranking (`supply-os-v1/app/main.py`, Transport section before `_aggregate_transport_lines`)

- Add `_TRANSPORT_COMPANION_SUPPLIERS` and `_transport_supplier_ids(lead_supplier_id) -> tuple[str, ...]`.
- Each gets a docstring saying:
  - Magazyn własny Mory goods ride on the Pago run;
  - the relation is one-directional;
  - the tuple order is the driver-document block order.

#### 3. Aggregate (`_aggregate_transport_lines`, 4077)

- Add keyword parameters `suppliers_by_id: Optional[dict[str, Supplier]] = None` and `lead_supplier_id: Optional[str] = None`.
- Group by `(order.supplier_id, line.product_id)`. Each group records `supplier_id` and `supplier_name`, with the name falling back to the id.
- Sort with the key from Critical Implementation Details.
- Rewrite the "single-supplier by construction" and "Pago order email/PDF cover the whole batch" docstring paragraphs to match.
- The existing 5-positional-arg callers and tests keep working.

#### 4. Eligible (`manager_transport_eligible`, 4189)

- New query param `include_companions: bool = False`.
- Allowed suppliers = `_transport_supplier_ids(supplier_id)` when the flag is set, else `(supplier_id,)`. Filter `o.supplier_id in allowed`.
- Sort by `(rank, newest first)`.
- Update the docstring.

#### 5. Batch list (`manager_transport_batches`, 4269)

- Group every `TRN-` order by marker with no per-order supplier filter.
- Union the header-only batches without a filter.
- Per batch, set `batch_supplier_id = header.supplier_id if header else group[0].supplier_id`, then filter on it.
- Update the docstring.

#### 6. Batch detail (`manager_transport_batch_detail`, 4410)

- Each `TransportBatchOrder` gets `supplier_id` and `supplier_name` from `suppliers_by_id`, falling back to the id.
- Pass `suppliers_by_id` and `lead_supplier_id=batch_supplier_id` to the aggregate.
- Weights follow each line's own supplier_product. The weight loop needs no change beyond the new grouping.
- Build `suppliers`:
  1. the lead;
  2. each companion that exists in `suppliers_by_id` and is `active`;
  3. then any member supplier not yet listed, in first-seen order.

  Names come from `suppliers_by_id`, falling back to the id. The docstring says the `active` filter governs only the empty-section offer, not membership (review F7).

#### 7. Create (`manager_transport_create`, 4637)

- `TransportCreateRequest` gains `allow_companions: bool = False`.
- Skip as "different supplier" only when `order.supplier_id` is not in the allowed set (companions only with the flag).
- The `order_combined` event details gain ` ({order.supplier_id})` when it differs from `req.supplier_id` (review F8).
- The header, `append_to` and the SUP_INTERNAL gate stay unchanged.
- Update the docstring.

#### 8. Add-location (`manager_transport_add_location`, 5112)

- Resolve `target`. If it is not allowed, return 400:

  ```
  Supplier '{target}' cannot ride on transport {id} (supplier {batch.supplier_id})
  ```

- The duplicate guard becomes `o.location_id == req.location_id and o.supplier_id == target`. Its message names the supplier.
- `_generate_order_id(req.location_id, target, today)`, `supplier_id=target`, and prefill from `_build_orderable_items(backend, req.location_id, target)`.
- When `target != batch.supplier_id`, the event details gain ` for {target}`.
- Update the docstring.

#### 9a. Remove-order and cancel (`manager_transport_remove_order` 5243, `manager_transport_cancel` 5430)

- Use the manager-created-empty rule from Critical Implementation Details. remove-order computes it from `order.lines` (`get_order` populates them); cancel from its `lines_by_order`.
- Update both docstrings.

#### 9b. Finalize (`manager_transport_finalize`, 4893)

- After the existing all-empty guard, add: when no claimed member of the lead supplier (`batch.supplier_id`) has a positive total → 400 `Transport batch {id} has no positive-quantity lines for {lead} — nothing to send`. For a batch whose members are all the lead's this is the existing guard; it only adds a case when other suppliers' members carry the only quantities.
- Nothing is written on the 400.

#### 9c. Queue guards for `TRN-` members (`manager_dispatch`, `manager_release`, `manager_cancel`)

- `manager_dispatch`: after the draft guard, 409 when `order.supplier_order_reference` starts with `TRN-` ("belongs to transport {ref} — release it first or use the Transport screen").
- `manager_release` and `manager_cancel`: when the order carries a `TRN-` marker (the draft guard already let it through, so its batch is not draft), also write `supplier_order_reference=None`.

#### 9. Tests (`supply-os-v1/tests/test_transport.py`, new section "Pago + Mory on one run")

- **Fixtures.** `_supplier()` gains `ordering_method` and `active` parameters; the section builds SUP_PAGO (transport) and SUP_MORY (manual) explicitly.

- **Pure aggregate.**
  - A Pago line and a Mory line come out Pago block first, then Mory, each in `display_order`.
  - The same `product_id` under both suppliers makes two lines.
  - `supplier_id` and `supplier_name` are set.
  - With no lead given, blocks follow supplier_id order.
- **Eligible.**
  - SUP_PAGO with `include_companions=true` returns Pago orders, then Mory, each newest first, and excludes Bukat.
  - SUP_PAGO without the flag returns Pago only.
  - SUP_MORY returns Mory only.
- **Create.**
  - SUP_PAGO with `allow_companions` combines a Mory order: it is claimed, then stamped, the header is SUP_PAGO, and the `order_combined` details name SUP_MORY.
  - SUP_PAGO without the flag skips the Mory order as "different supplier".
  - SUP_MORY skips a Pago order as "different supplier".
  - `append_to` a Pago draft with a Mory order and the flag → combined.
- **Batch detail.**
  - Members carry their supplier.
  - Lines are grouped by supplier.
  - `suppliers` is `[Pago, Mory]`, and Mory is listed even with no Mory member while Mory is active.
  - An inactive Mory is not listed.
- **Batch list.**
  - A combined batch is listed once under SUP_PAGO, with `order_count` 2 and both locations.
  - It is absent under SUP_MORY.
  - A header-backed batch reports the header supplier.
- **Add-location.**
  - `supplier_id=SUP_MORY` at a location that already has a Pago member returns 200 and appends a Mory order prefilled from the Mory catalogue.
  - A second Mory order there returns 400.
  - `supplier_id=SUP_BUKAT` on a Pago batch returns 400.
  - Omitting `supplier_id` behaves as today.
- **Finalize.**
  - A batch with a positive Pago and a positive Mory member sends both.
  - Pago members all zero, a Mory member positive → 400, nothing written.
  - Pago positive, a prefilled Mory skeleton zero → Pago sent, the Mory skeleton cancelled.
- **Remove and cancel.**
  - remove-order on a captain-origin Mory member → released, marker cleared.
  - remove-order on a prefilled skeleton with no positive line → cancelled (any supplier).
  - cancel of a batch with a captain-origin Mory member and a prefilled skeleton → one released, one cancelled.
- **Queue guards.**
  - dispatch of a `manager_claimed` Mory order carrying the marker of a sent batch → 409.
  - release of that order → 200 and the marker is cleared.
- **Batch list.** Under SUP_MORY, a Mory-lead batch is listed and a Pago batch with a Mory member is not.
- **Add-location on a Mory-lead batch.** `supplier_id=SUP_MORY` equals the header → allowed.

### Success Criteria

#### Automated Verification

- Backend suite passes: `cd supply-os-v1 && python -m pytest -q`
- Lint passes: `cd supply-os-v1 && ruff check .`
- Integration suite passes on a local Postgres 16: `python -m pytest -m integration -q`

#### Manual Verification

- None for this phase (covered by the preview phase).

---

## Phase 2: Frontend — types and document builders

### Overview

The types mirror the new fields. The supplier-facing builders use the lead-supplier view, and the driver builders use supplier blocks.

### Changes Required

#### 1. Types and API client

- In `frontend/src/types.ts`:
  - `TransportAggregateLine` and `TransportBatchOrder` gain `supplier_id?: string` and `supplier_name?: string`.
  - Add `TransportSupplierRef`.
  - `TransportBatchDetail` gains `suppliers?: TransportSupplierRef[]`.
  - `TransportAddLocationRequest` gains `supplier_id?: string`.
  - Fix the `warehouse_pickup` comment (the order e-mail/PDF cover the lead supplier's lines).
- In `frontend/src/apiClient.ts`:
  - `transportAddLocation(transport_id, location_id, prefill_products?, supplier_id?)`;
  - `transportEligible(supplier_id)` sends `include_companions=true`;
  - `TransportCreateRequest` gains `allow_companions?: boolean`, and the page's create calls send `true`.

#### 2. `frontend/src/pages/manager/lib/transport.ts`

- **New helpers:**
  - `lineSupplierId(line, detail)` and `orderSupplierId(order, detail)`, both falling back to `detail.supplier_id`.
  - `transportSuppliers(detail)`: `detail.suppliers` when non-empty, else `[{detail.supplier_id, detail.supplier_name}]`, plus any member or line supplier not listed.
  - `transportOrdersFor(detail, supplierId)`.
  - `leadSupplierView(detail)`.
- **`buildTransportEmailBody`** builds from `leadSupplierView(detail)` (lines and extra items).
- **`buildTransportDriverText`** writes one block per supplier: the supplier line, then that supplier's lines. The lead block is always printed; other blocks only when they have lines. Extra items of all members follow at the end, as today.
- **`buildTransportDriverPrintDoc`** returns `sections`, per Critical Implementation Details:
  - `supplierBarText` is `"{name} / LINEAGE"` for SUP_PAGO, else the name;
  - location columns stay the union of all members;
  - each section's products carry `qtyByLocation` aligned to those columns.
- **`computePagoWarehouseExclusion`** runs on `leadSupplierView(detail)`.
- **`buildTransportPagoPrintDoc`** takes its products from `leadSupplierView(detail)`. The `warehouse_pickup` filter stays.
- **Label for Pago documents (review A4).** The Pago print doc number and the Pago draft subject use `transportDisplayLabel(leadSupplierView(detail))`, whose `location_ids` are the lead orders' locations. The driver documents keep the full label.
- **Comments.** Update the comment at 911-935 and the header comments to name the lead-supplier rule.

#### 3. `frontend/src/pages/manager/lib/gmailDraft.ts`

`buildDraftBody` gains an `orders` argument:

- the Pago draft passes `leadSupplierView(detail).orders`;
- the driver draft passes `detail.orders`.

#### 4. `frontend/src/pages/manager/lib/transportPdf.ts`

`buildDriverPdfDocDefinition` emits `sectionBar(section.supplierBarText)` plus one table per section. The columns and widths are the same as today, and each table numbers its rows from 1.

#### 5. Tests

- `lib/transport.test.ts`:
  - update the fixtures and asserts that read `supplierBarText` / `products`;
  - add mixed-batch cases:
    - the e-mail body has Pago lines only;
    - the Pago print doc has Pago lines only;
    - the exclusion notice names Pago lines only;
    - the driver text has Pago then Mory blocks;
    - the driver print doc has two sections, Pago "/ LINEAGE" first, with shared columns;
    - a batch without supplier fields behaves as today;
    - `transportSuppliers` adds its defensive tail.
    - the same `product_id` under two suppliers gives two rows in two sections (review A6);
    - a line with `supplier_id: ""` counts as the lead's (review F3);
    - the Pago print doc label lists only lead locations (review A4).
- `lib/transportPdf.test.ts`: two sections produce two bars and two tables.
- `lib/gmailDraft.test.ts`: the Pago draft's extra items come from Pago members only; the driver draft's come from all members.

### Success Criteria

#### Automated Verification

- Frontend tests pass: `cd frontend && npm run test`
- Frontend build passes: `cd frontend && npm run build`
- Frontend lint passes: `cd frontend && npm run lint`

#### Manual Verification

- None for this phase (covered by the preview phase).

---

## Phase 3: Frontend — Transport screen

### Overview

The Transport screen gets a draft section per supplier, a Mory add-location, supplier-aware orderables and grouped sent-view tables.

### Changes Required

#### 1. `frontend/src/pages/manager/TransportPage.tsx`

- **`fetchOrderable`** calls `api.managerOrderable(orderSupplierId(o, batchDetail), o.location_id)`.
- **`handleAddProductAll(productId, supplierId)`** targets only that supplier's orders.
- **`handleAddLocation(location, supplierId)`** calls `api.transportAddLocation(id, location_id, true, supplierId)`.
- **Draft view.** For each `transportSuppliers(detail)` entry, render a section when it has orders or the batch is a draft:
  - a heading, shown only when more than one section renders;
  - `TransportMatrix` with that supplier's orders, or an empty hint when it has none;
  - `AddLocationPicker` listing locations without a member of that supplier.

  The action row keeps save, cancel and finalize, and loses the picker.
- **Sent view.**
  - The totals and product × location tables group `detail.lines` by supplier, with a supplier header row when more than one supplier has lines.
  - Row keys become `${supplier}:${product_id}`.
- **Eligible list.** Show a small supplier label when `o.supplier_id !== supplierId`.
- **Supplier dropdown.** Companion suppliers are not offered (review F5): a small frontend constant `TRANSPORT_COMPANION_SUPPLIER_IDS = ["SUP_MORY"]` in `lib/transport.ts`, mirroring the backend.

#### 2. `frontend/src/pages/manager/transport/TransportMatrix.tsx`

Add an optional `title?: string` prop that overrides the default heading.

#### 3. i18n (`frontend/src/i18n/strings.ts`)

- `manager.transport.section.title`:
  - pl "Produkty × lokalizacje — {supplier}"
  - en "Products × locations — {supplier}"
- `manager.transport.section.empty`:
  - pl "Brak zamówień od tego dostawcy w tym transporcie. Dodaj lokalizację poniżej."
  - en "No orders from this supplier in this transport yet. Add a location below."

#### 4. Tests

- Component-level coverage is not added. TransportPage has no component tests, and the page logic sits in the tested lib helpers.
- Any `TransportMatrix` / `AddLocationPicker` usage change must keep the existing tests green.

### Success Criteria

#### Automated Verification

- Frontend tests pass: `cd frontend && npm run test`
- Frontend build passes: `cd frontend && npm run build`
- Frontend lint passes: `cd frontend && npm run lint`

#### Manual Verification

- Local auth-ON preview on a local Postgres copy (never prod; no e-mail, no Gmail): a Pago draft with Pago and Mory members shows two sections, and a Mory location can be added.
- Preview: after finalize, the sent view groups rows as Pago then Mory, and the e-mail link body lists Pago lines only.

---

## Phase 4: Verify and docs

### Overview

Run the full checks, record the preview, and update the docs this change makes false.

### Changes Required

- `verification/verify-output.md` and `verification/preview-notes.md` in the change folder.
- `AGENTS.md`: test counts.

  Change 1 (PR #44) edits the same line, so the PR merged second recomputes the counts.
- `supply-os-v1/AGENTS.md` if it states counts: same rule.

### Success Criteria

#### Automated Verification

- Backend and frontend suites, lint and build all green (`/verify` equivalent)

#### Manual Verification

- Preview notes recorded

---

## Phase 5: Release (operator-gated)

### Overview

Merge after 1.10 and check live. No migration and no data step.

### Changes Required

None in code.

### Success Criteria

#### Automated Verification

- CI green on the PR

#### Manual Verification

- Merged after 1.10 and live (operator go)
- Live check on prod, sending nothing:
  - hard-refresh the Transport screen;
  - build a Pago draft that includes a Mory order;
  - download the Pago PDF and the driver PDF;
  - confirm the Pago PDF has Pago lines only and the driver PDF has a Pago block, then a Mory block;
  - cancel the draft, or finalize it only if it is the real run.

---

## Testing Strategy

### Unit Tests

- Backend: the aggregate grouping and order, and the route contracts listed in Phase 1 §9.
- Frontend: the lead view, the driver sections, and the draft body orders (Phase 2 §5).

### Integration Tests

- The existing Postgres suite must stay green. No SQL changes.

### Manual Testing Steps

1. Local DB copy with real supplier names, three Pago orders and two Mory orders submitted with Captain tokens (local only).
2. Transport → Pago:
   1. combine all five;
   2. check both sections;
   3. add a Mory location;
   4. edit a Mory cell and save.
3. Download both PDFs and inspect their contents.
4. Finalize:
   1. the sent view is grouped;
   2. the e-mail link body has Pago lines only;
   3. the Mory orders are `manager_sent` with `sent_method` = transport.

## Performance Considerations

None. The same reads are used; grouping keys change only in memory.

## Migration Notes

None. Existing single-supplier batches read exactly as before. Headerless legacy batches keep the `group[0]` fallback.

## References

- `context/changes/transport-pago-mory-combined/research.md`
- `context/archive/2026-08-21-to-ordering-pago/` (Transport design)
- `context/changes/inventory-card-order/prod-sql-pago-mory.sql` on PR #44. It sets `display_order` for Pago and Mory; until it runs, both blocks fall back to `supplier_product_id` order.

## Notes

- **Companion relation: code constant or data column.** A `suppliers.transport_lead_supplier_id` column (migration 0028) would let the operator configure it. It would also cost another gated prod step and a deploy-order dependency for a single pair. The code constant follows the `_INTERNAL_SUPPLIER_ID` precedent. Revisit if a second pair appears.
- **Deploy window.**
  - Frontend first: the extra `supplier_id` on add-location is ignored for a moment, so a Mory add would create a Pago column, and the eligible / create flags are ignored (Pago only, as today). Accepted: both deploy from the same merge within minutes.
  - Backend first (review F4): an old bundle sends no opt-in flag, so the backend keeps offering and combining Pago orders only. No Mory line can reach a Pago document from an old tab.
  - The Phase 5 live check starts with a hard refresh of the Transport screen.
- **Follow-up (data, operator).** Fill `unit_weight_kg` for the 18 SP_MORY rows, so the weight strip stops counting them as "brak wagi".

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — companion suppliers on a Transport batch

#### Automated

- [x] 1.1 Backend suite passes: `cd supply-os-v1 && python -m pytest -q` — f72a429
- [x] 1.2 Lint passes: `cd supply-os-v1 && ruff check .` — f72a429
- [x] 1.3 Integration suite passes on a local Postgres 16: `python -m pytest -m integration -q` — f72a429

### Phase 2: Frontend — types and document builders

#### Automated

- [x] 2.1 Frontend tests pass: `cd frontend && npm run test`
- [x] 2.2 Frontend build passes: `cd frontend && npm run build`
- [x] 2.3 Frontend lint passes: `cd frontend && npm run lint`

### Phase 3: Frontend — Transport screen

#### Automated

- [ ] 3.1 Frontend tests pass: `cd frontend && npm run test`
- [ ] 3.2 Frontend build passes: `cd frontend && npm run build`
- [ ] 3.3 Frontend lint passes: `cd frontend && npm run lint`

#### Manual

- [ ] 3.4 Local auth-ON preview: two sections, Mory location added
- [ ] 3.5 Preview: sent view grouped, e-mail body Pago-only

### Phase 4: Verify and docs

#### Automated

- [ ] 4.1 Backend and frontend suites, lint and build all green

#### Manual

- [ ] 4.2 Preview notes recorded

### Phase 5: Release (operator-gated)

#### Automated

- [ ] 5.1 CI green on the PR

#### Manual

- [ ] 5.2 Merged after 1.10 and live (operator go)
- [ ] 5.3 Live check: Pago PDF Pago-only, driver PDF Pago then Mory blocks, nothing sent
