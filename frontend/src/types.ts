// API response types — match supply-os-v1/app/models.py exactly.
// Keep in sync when backend schemas change.

export type OrderStatus =
  | "draft"
  | "captain_submitted"
  | "manager_claimed"
  | "manager_sent"
  | "closed"
  | "cancelled";

export type ReasonCode =
  | "EVENT_HIGH_TRAFFIC"
  | "WEEKEND_HIGH_TRAFFIC"
  | "LOW_STORAGE"
  | "PACKAGING_LIMITATION"
  | "SUPPLIER_UNDERDELIVERS"
  | "SYSTEM_SUGGESTION_WRONG"
  | "OTHER";

export type OrderingMethod = "email" | "portal" | "phone" | "manual";
export type RoundingRule = "full_only" | "half_allowed" | "up_for_critical" | "tenth_kg";

// Master data ----------------------------------------------------------------

export interface Product {
  product_id: string;
  gostock_id?: number;
  product_name_pl: string;
  product_category: string;
  inventory_unit: string;
  is_critical: boolean;
  active: boolean;
  notes: string;
}

export interface Supplier {
  supplier_id: string;
  supplier_name: string;
  email?: string;
  ordering_method: OrderingMethod;
  delivery_days?: string;
  cutoff_time?: string;
  minimum_order_value_pln?: number;
  active: boolean;
  notes: string;
}

export interface Location {
  location_id: string;
  location_name: string;
  delivery_address?: string;
  city?: string;
  active: boolean;
  notes: string;
}

// Captain orderable (computed view) ------------------------------------------

export interface OrderableItem {
  product_id: string;
  product_name_pl: string;
  inventory_unit: string;
  is_critical: boolean;
  purchase_unit: string;
  units_per_purchase_unit: number;
  rounding_rule: RoundingRule;
  min_stock_qty_base: number;
  max_stock_qty_base: number;
  target_stock_qty_base: number;
  allow_over_max_due_to_packaging: boolean;
  supplier_product_id: string;
  supplier_product_name: string;
  // Optional short packaging/ordering annotation from supplier_products master
  // data (e.g. "1 karton = 6 szt (18 kg)"), shown on the product card. Absent on
  // the edit screen (rebuilt from order lines, which don't carry it).
  order_note?: string | null;
}

// Captain Submit -------------------------------------------------------------

export interface OrderLineSubmit {
  product_id: string;
  supplier_product_id: string;
  // null = stock NOT counted (distinct from a counted 0). When null, the backend
  // skips the deviation/critical reason gate and forces a reason only on an
  // over-MAX order. A typed 0 is a real counted 0.
  current_stock_qty_base: number | null;
  captain_final_qty_purchase: number;
  reason_code?: ReasonCode | null;
  captain_comment?: string;
}

export interface CaptainSubmitRequest {
  supplier_id: string;
  requested_delivery_date?: string; // ISO date "YYYY-MM-DD"
  lines: OrderLineSubmit[];
  ordered_by: string; // required free-text "who orders" (mirrors received_by / count_user)
  notes?: string;
  // Ad-hoc off-catalogue items + order-level comment (training-feedback-0901
  // Phase 1b). Backend default `str = ""` → optional here (lessons.md).
  extra_items?: string;
  captain_note?: string;
}

export interface CaptainSubmitResponse {
  order_id: string;
  status: OrderStatus;
  line_count: number;
  total_value_estimate_pln: number;
  warnings: string[];
}

// Inventory count (S-06) — match supply-os-v1/app/models.py -------------------

export interface InventoryProduct {
  product_id: string;
  product_name_pl: string;
  product_category: string;
  inventory_unit: string;
  is_critical: boolean;
}

export interface InventoryLatestLine {
  product_id: string;
  current_stock_qty_base: number;
  count_comment: string;
}

export interface InventoryLatestResponse {
  count_id: string;
  count_date: string;
  count_submitted_at: string | null;
  count_user?: string | null;
  // Set once this snapshot has been corrected at least once via PATCH
  // /api/captain/inventory/count/{count_id} (Phase 2, training-feedback-0901).
  // Backend Optional[datetime] = None → optional here (lessons.md).
  last_edited_at?: string | null;
  line_count: number;
  lines: InventoryLatestLine[];
  // Correction history (Phase 2, training-feedback-0901) — populated only by
  // the snapshot-detail route (captain_inventory_count_detail, FR-024); the
  // plain FR-017 "latest" pre-fill path leaves it unset. Backend
  // Field(default_factory=list) → optional here (lessons.md).
  events?: InventoryCountEvent[];
}

// One append-only row of an inventory count's correction audit trail (Phase 2,
// training-feedback-0901, migration 0014) — mirrors TransportEvent. `details`
// is a human-readable per-product "Name: old -> new" / "dodano" / "usunięto"
// diff, computed server-side before the destructive replace write.
export interface InventoryCountEvent {
  event_id: string;
  count_id: string;
  event_type: string;
  actor?: string | null;
  at?: string | null; // ISO datetime
  details: string;
}

// Compact picker row (FR-024) — one available snapshot WITHOUT its lines. Lines
// are fetched lazily on select via GET /api/captain/inventory/count/{id}.
// `count_submitted_at` / `count_user` are Optional on the backend → optional here.
export interface InventoryCountSummary {
  count_id: string;
  location_id: string;
  count_date: string;
  count_submitted_at?: string | null;
  count_user?: string | null;
  // Set once corrected at least once (Phase 2, training-feedback-0901).
  last_edited_at?: string | null;
  line_count: number;
}

// Manager inventory view (S-08 / FR-018) — match supply-os-v1/app/models.py.
export interface InventoryCountManagerItem {
  count_id: string;
  location_id: string;
  location_name: string;
  count_date: string;
  count_submitted_at?: string | null;
  count_user?: string | null;
  // Set once corrected at least once (Phase 2, training-feedback-0901).
  last_edited_at?: string | null;
  line_count: number;
}

export interface InventoryCountDetailLine {
  product_id: string;
  product_name_pl: string;
  product_category: string;
  inventory_unit: string;
  is_critical: boolean;
  current_stock_qty_base: number;
  count_comment: string;
}

export interface InventoryCountDetail {
  count_id: string;
  location_id: string;
  location_name: string;
  count_date: string;
  count_submitted_at?: string | null;
  count_user?: string | null;
  // Set once corrected at least once (Phase 2, training-feedback-0901).
  last_edited_at?: string | null;
  line_count: number;
  notes: string;
  lines: InventoryCountDetailLine[];
  // Correction history, newest first, capped 100 by the backend. Backend
  // Field(default_factory=list) → optional here (lessons.md).
  events?: InventoryCountEvent[];
}

// Suggestion learning-loop review (S-03 / FR-012) — match supply-os-v1/app/models.py.
export interface SuggestionReviewItem {
  product_id: string;
  product_name_pl: string;
  product_category: string;
  inventory_unit: string;
  line_count: number;
  order_count: number;
  avg_suggested_qty_purchase: number;
  avg_captain_final_qty_purchase: number;
  avg_manager_final_qty_purchase: number;
  avg_abs_deviation_pct: number;
  reason_code_counts: Record<string, number>;
}

export interface InventoryCountLineSubmit {
  product_id: string;
  current_stock_qty_base: number;
  count_comment?: string;
}

export interface InventoryCountSubmitRequest {
  lines: InventoryCountLineSubmit[];
  count_user: string;
  count_date?: string;
  notes?: string;
}

export interface InventoryCountSubmitResponse {
  count_id: string;
  count_date: string; // ISO date "YYYY-MM-DD"
  line_count: number;
  warnings: string[];
}

// Correct a previously submitted snapshot (Phase 2, training-feedback-0901) —
// PATCH /api/captain/inventory/count/{count_id}. Replace semantics: `lines`
// is the FULL new authoritative set (mirrors InventoryCountSubmitRequest); a
// product on the prior snapshot but omitted here is treated as "blanked"
// (not counted = no line), never as "leave untouched".
export interface InventoryCountEditRequest {
  lines: InventoryCountLineSubmit[];
  edited_by: string;
  edit_reason?: string;
}

export interface InventoryCountEditResponse {
  count_id: string;
  count_date: string; // ISO date "YYYY-MM-DD"
  line_count: number;
  warnings: string[];
}

// Captain own-orders view + edit (Phase E3) ---------------------------------

export interface CaptainOrderListItem {
  order_id: string;
  supplier_id: string;
  supplier_name: string;
  order_date: string; // ISO date
  requested_delivery_date?: string | null;
  status: OrderStatus;
  captain_submitted_at?: string | null;
  last_edited_at?: string | null;
  line_count: number;
  deviation_count: number;
  reason_count: number;
  total_value_estimate_pln?: number | null;
  editable: boolean;
}

export interface CaptainOrderDetail {
  order_id: string;
  location_id: string;
  location_name: string;
  supplier_id: string;
  supplier_name: string;
  order_date: string;
  requested_delivery_date?: string | null;
  status: OrderStatus;
  captain_user?: string | null;
  captain_submitted_at?: string | null;
  ordered_by?: string | null; // free-text "who orders" (shown as "Zamówił: X")
  last_edited_at?: string | null;
  total_value_estimate_pln?: number | null;
  // Supplier's configured minimum order value (display-only; training-
  // feedback-0901 Phase 1c) — see ManagerQueueItem.minimum_order_value_pln.
  minimum_order_value_pln?: number;
  notes: string;
  // Ad-hoc off-catalogue items + order-level comment (training-feedback-0901
  // Phase 1b) — see Order.extra_items / Order.captain_note (backend) for why
  // captain_note is its own field and never `notes`.
  extra_items?: string;
  captain_note?: string;
  editable: boolean;
  lines: ManagerOrderLineDetail[];
}

export interface CaptainEditRequest {
  requested_delivery_date?: string;
  lines: OrderLineSubmit[];
  notes?: string;
  // Same ad-hoc items + comment as CaptainSubmitRequest — the Captain can
  // revise both when editing (training-feedback-0901 Phase 1b).
  extra_items?: string;
  captain_note?: string;
}

export interface CaptainEditResponse {
  order_id: string;
  status: OrderStatus;
  line_count: number;
  total_value_estimate_pln: number;
  warnings: string[];
}

// Manager claim / release (Phase F1) -----------------------------------------

export interface ManagerClaimResponse {
  order_id: string;
  status: OrderStatus;
}

export interface ManagerReleaseRequest {
  reason: string;
}

export interface ManagerReleaseResponse {
  order_id: string;
  status: OrderStatus;
}

export interface ManagerCancelRequest {
  reason: string;
}

export interface ManagerCancelResponse {
  order_id: string;
  status: OrderStatus; // "cancelled" on success
}

// Manager add ad-hoc product line (add-product-to-order) ----------------------

export interface ManagerAddLineRequest {
  product_id: string;
  supplier_product_id: string;
}

export interface ManagerAddLineResponse {
  order_id: string;
  order_line_id: string;
  status: OrderStatus; // "manager_claimed" on success
}

// Manager Queue --------------------------------------------------------------

export interface ManagerQueueItem {
  order_id: string;
  location_id: string;
  location_name: string; // joined from locations; falls back to location_id (F4)
  supplier_id: string;
  supplier_name: string;
  order_date: string;
  requested_delivery_date?: string;
  status: OrderStatus;
  captain_user?: string;
  captain_submitted_at?: string; // ISO datetime
  ordered_by?: string | null; // free-text "who orders" (shown as "Zamówił: X")
  line_count: number;
  total_value_estimate_pln?: number | null;
  // Supplier's configured minimum order value (display-only; training-
  // feedback-0901 Phase 1c) — joined server-side onto the queue item so the
  // frontend never needs a per-screen supplier fetch (hardening.md G4). No
  // server-side reader/gate consumes this — see lib/minimumOrder.ts.
  minimum_order_value_pln?: number;
  deviation_count: number;
  reason_count: number;
  last_edited_at?: string | null;
  cutoff_iso?: string; // ISO datetime
  // Goods-receipt signal (manager-receiving-view). Set only on the manager_sent
  // lane; 0 elsewhere. FE shows a ⚠ chip when discrepancy > 0, else a ✓ chip when
  // received_count > 0.
  received_count: number;
  received_discrepancy_count: number;
  // Reverse link to a Manager Transport batch (to-ordering-pago): set when this
  // order was combined via POST /api/manager/transport/create (a "TRN-…"
  // marker), absent for a normal per-order dispatch. Lets the queue show a
  // "TRN" chip instead of implying a real per-supplier email dispatch.
  supplier_order_reference?: string | null;
}

// Manager Order Detail -------------------------------------------------------

export interface ManagerOrderLineDetail {
  order_line_id: string;
  product_id: string;
  product_name_pl: string;
  inventory_unit: string;
  is_critical: boolean;
  supplier_product_id: string;
  supplier_product_name: string;
  purchase_unit: string;
  units_per_purchase_unit: number;
  rounding_rule?: RoundingRule;
  price_estimate_pln?: number;
  current_stock_qty_base: number;
  target_stock_qty_base: number;
  // Joined from location_product_settings so the edit screen can mirror the
  // backend over-MAX gate (uncounted-stock branch). Default 0/false on the wire.
  max_stock_qty_base: number;
  allow_over_max_due_to_packaging: boolean;
  suggested_qty_base: number;
  suggested_qty_purchase: number;
  captain_final_qty_purchase: number;
  captain_final_qty_base: number;
  manager_final_qty_purchase: number;
  manager_final_qty_base: number;
  delta_vs_suggestion_pct?: number;
  reason_code?: ReasonCode | null;
  captain_comment: string;
  manager_comment: string;
}

export interface ManagerOrderReceiptLine {
  order_line_id: string;
  product_id: string;
  product_name_pl: string;
  purchase_unit: string;
  ordered_qty_purchase: number;
  received_qty_purchase: number;
  variance_qty_purchase: number;
  receipt_comment: string;
}

export interface ManagerOrderReceipt {
  receipt_id: string;
  receipt_date: string; // ISO date "YYYY-MM-DD"
  received_by?: string | null;
  received_submitted_at?: string | null; // ISO datetime
  line_count: number;
  discrepancy_count: number;
  received_with_missing_wz: boolean;
  wz_photo_count: number;
  lines: ManagerOrderReceiptLine[];
}

export interface ManagerOrderDetail {
  order_id: string;
  location_id: string;
  location_name: string;
  // Delivery address joined from locations — the email address line is
  // location_name + delivery_address + city (empty parts skipped). Optional,
  // mirroring the backend ManagerOrderDetail / Location master-data.
  delivery_address?: string;
  city?: string;
  // Operating-company footer data (spółka + adres + NIP), joined from
  // locations (feedback r5) — consumed by emailBody.ts.
  company_name?: string;
  company_address?: string;
  company_nip?: string;
  supplier_id: string;
  supplier_name: string;
  supplier_email?: string;
  // Standing office copy (DW) for the supplier email, served by the backend from
  // settings.order_cc_email (feedback r7). Absent/empty => no DW row, no cc param.
  cc_email?: string | null;
  // G3: channel routing + phone/notes for the dispatch panel.
  ordering_method: OrderingMethod;
  supplier_notes: string;
  order_date: string;
  requested_delivery_date?: string;
  status: OrderStatus;
  captain_user?: string;
  captain_submitted_at?: string | null;
  ordered_by?: string | null; // free-text "who orders" (shown as "Zamówił: X")
  manager_user?: string;
  manager_sent_at?: string;
  total_value_estimate_pln?: number | null;
  // Supplier's configured minimum order value (display-only; training-
  // feedback-0901 Phase 1c) — see ManagerQueueItem.minimum_order_value_pln.
  minimum_order_value_pln?: number;
  notes: string;
  // Ad-hoc off-catalogue items + order-level comment (training-feedback-0901
  // Phase 1b), read-only here — see CaptainOrderDetail for the same fields.
  extra_items?: string;
  captain_note?: string;
  lines: ManagerOrderLineDetail[];
  // Goods-receipts against this order (0..N, newest-first), read-only — closes
  // the suggested→captain→manager→RECEIVED loop on the Manager screen.
  receipts: ManagerOrderReceipt[];
  // Reverse link to a Manager Transport batch — see ManagerQueueItem's field
  // of the same name for the full explanation.
  supplier_order_reference?: string | null;
}

// Manager Dispatch -----------------------------------------------------------

export interface OrderLineManagerFinal {
  order_line_id: string;
  manager_final_qty_purchase: number;
  // Read-modify-write contract (spec §4): always send the CURRENT comment for
  // every touched line so a qty-only payload never wipes a saved comment.
  manager_comment: string;
}

export interface ManagerDispatchRequest {
  order_id: string;
  manager_finals: OrderLineManagerFinal[];
  sent_method?: string;
}

export interface ManagerDispatchResponse {
  order_id: string;
  status: OrderStatus;
  // null for portal/phone/manual — the backend only builds a Gmail URL for email.
  gmail_compose_url: string | null;
  supplier_email: string | null;
  total_value_estimate_pln: number;
}

// Manager Save (PATCH, no dispatch) — Phase G2 -------------------------------

export interface ManagerSaveRequest {
  manager_finals: OrderLineManagerFinal[];
}

export interface ManagerSaveResponse {
  order_id: string;
  status: OrderStatus; // "manager_claimed"
  lines_updated: number;
  total_value_estimate_pln: number;
}

// API errors -----------------------------------------------------------------

export interface ApiError {
  detail: string;
  status: number;
}

// Goods receiving (GR-01) — match supply-os-v1/app/models.py -----------------

export interface ReceiptLineSubmit {
  order_line_id: string;
  received_qty_purchase: number;
  receipt_comment?: string;
}

export interface ReceiptSubmitRequest {
  order_id: string;
  received_by: string;
  receipt_date?: string; // ISO date "YYYY-MM-DD"
  lines: ReceiptLineSubmit[];
  notes?: string;
}

export interface ReceiptSubmitResponse {
  receipt_id: string;
  order_id: string;
  receipt_date: string;
  line_count: number;
  discrepancy_count: number;
  received_with_missing_wz: boolean;
  warnings: string[];
}

export interface ReceiptDetailLine {
  receipt_line_id: string;
  order_line_id: string;
  product_id: string;
  product_name_pl: string;
  inventory_unit: string;
  purchase_unit: string;
  is_critical: boolean;
  ordered_qty_purchase: number;
  received_qty_purchase: number;
  variance_qty_purchase: number;
  receipt_comment: string;
}

export interface ReceiptDetail {
  receipt_id: string;
  order_id: string;
  location_id: string;
  location_name: string;
  supplier_id: string;
  supplier_name: string;
  receipt_date: string;
  received_by?: string | null;
  received_submitted_at?: string | null;
  line_count: number;
  discrepancy_count: number;
  received_with_missing_wz: boolean;
  wz_photo_path_prefix?: string | null;
  wz_photo_count: number;
  notes: string;
  lines: ReceiptDetailLine[];
}

export interface ReceiptSummary {
  receipt_id: string;
  order_id: string;
  location_id: string;
  receipt_date: string;
  received_submitted_at?: string | null;
  received_by?: string | null;
  line_count: number;
  discrepancy_count: number;
  received_with_missing_wz: boolean;
  wz_photo_count: number;
}

export interface ReceiptPhotoItem {
  name: string;
  signed_url: string;
}

export interface ReceiptPhotoUploadResponse {
  receipt_id: string;
  wz_photo_count: number;
  received_with_missing_wz: boolean;
  uploaded: ReceiptPhotoItem[];
}

// Manager Transport (to-ordering-pago) — combine several locations' orders for
// one supplier into a single physical delivery run. Match
// supply-os-v1/app/models.py's Transport* models exactly. -------------------

/** One location's contribution to a product's total within a Transport
 * aggregate — the smallest audit unit of the per-location usage breakdown.
 * Two lines for the SAME product from the SAME location across two source
 * orders stay as two separate entries (one per order_id). */
export interface TransportLocationQty {
  location_id: string;
  location_name: string;
  order_id: string;
  qty_purchase: number;
}

/** One product's roll-up across a set of source orders: the per-product total
 * (for the supplier order / driver totals) plus the per-location breakdown
 * (per_location — the private driver list / usage record). */
export interface TransportAggregateLine {
  product_id: string;
  product_name_pl: string;
  supplier_product_id: string;
  supplier_product_name: string;
  purchase_unit: string;
  total_qty_purchase: number;
  per_location: TransportLocationQty[];
  // Weight preview (v2, to-ordering-pago ADDENDUM v2) — joined from the line's
  // supplier_product. null when unknown (not yet filled in master data); a
  // known unit_weight_kg always implies a known line_weight_kg (= total *
  // unit), and vice versa.
  unit_weight_kg?: number | null;
  line_weight_kg?: number | null;
  // Supplier catalog code (Nr katalogowy), joined from the line's
  // supplier_product (to-ordering-pago). null when unset — the Pago PDF
  // builder falls back to the friendly product name.
  supplier_sku?: string | null;
  // Whether this product is physically collected on the warehouse run, as
  // opposed to merely purchased through this supplier (migration 0015).
  // SUP_PAGO is a purchasing CHANNEL, not a warehouse: one batch mixes frozen
  // meat with till rolls and napkins. ONLY the self-pickup document filters on
  // this — the order email and order PDF still cover the whole batch.
  warehouse_pickup?: boolean;
}

/** One row on the Transport "orders to combine" picker. */
export interface TransportEligibleOrder {
  order_id: string;
  location_id: string;
  location_name: string;
  supplier_id: string;
  supplier_name: string;
  order_date: string; // ISO date
  status: OrderStatus;
  captain_submitted_at?: string | null;
  ordered_by?: string | null;
  line_count: number;
  total_value_estimate_pln?: number | null;
}

/** One member order of a Transport batch — compact row for the batch
 * detail's source-orders list. */
export interface TransportBatchOrder {
  order_id: string;
  location_id: string;
  location_name: string;
  status: OrderStatus;
  total_value_estimate_pln?: number | null;
  // Full enriched lines (v2, to-ordering-pago ADDENDUM v2) — reuses
  // ManagerOrderLineDetail so the FE can render the editable product x
  // location matrix. Empty for a newly-created skeleton order (add-location)
  // with no lines yet.
  lines: ManagerOrderLineDetail[];
  // Per-order delivery status (v3 Phase 8) — joined from receipts, only when
  // the batch status is "sent" (a draft batch's members are never dispatched
  // yet, so both stay 0 there). Mirrors ManagerQueueItem's receipt signal.
  received_count?: number;
  received_discrepancy_count?: number;
  // Ad-hoc off-catalogue items + order-level Captain comment
  // (training-feedback-0901 F1) — same fields as CaptainOrderDetail /
  // ManagerOrderDetail, now also read on each member order of a Transport
  // batch. Backend default `str = ""` -> optional here (lessons.md). EVERY
  // reader must use `?? ""` rather than assume presence: a frontend deployed
  // ahead of this backend field would otherwise get `undefined`, and e.g.
  // `undefined.trim()` inside TransportPage's `gmail` useMemo (which calls
  // into buildTransportEmailBody -> this field) would crash the whole
  // Transport page via the ErrorBoundary.
  extra_items?: string;
  captain_note?: string;
}

/** Draft/sent/cancelled lifecycle status of a Transport batch (v2 + v3 cancel
 * draft). A marker group with no `transport_batches` header row is a
 * v1-created legacy batch — always "sent" (read-only, exactly as v1
 * behaved). */
export type TransportBatchStatus = "draft" | "sent" | "cancelled";

/** One past Transport batch — the set of orders sharing a
 * supplier_order_reference marker that starts with "TRN-". */
export interface TransportBatchSummary {
  transport_id: string;
  supplier_id: string;
  supplier_name: string;
  created?: string | null; // ISO datetime — earliest member manager_sent_at
  order_count: number;
  location_ids: string[]; // sorted unique
  status: TransportBatchStatus;
  driver?: string | null;
  vehicle?: string | null;
  pickup_date?: string | null; // ISO date
  // Friendly operator-facing name (v4 feedback, migration 0011). null on a
  // headerless legacy batch or one never given a name — transportDisplayLabel
  // falls back to "Transport {supplier_name} · {created date}" in that case.
  name?: string | null;
}

/** Full Transport batch: the summary fields plus the member orders and the
 * aggregate lines (per-product totals AND the per-product x per-location
 * breakdown — the usage/zużycie record). */
export interface TransportBatchDetail {
  transport_id: string;
  supplier_id: string;
  supplier_name: string;
  created?: string | null;
  order_count: number;
  location_ids: string[];
  orders: TransportBatchOrder[];
  lines: TransportAggregateLine[];
  // Draft/sent lifecycle + logistics (v2) — joined from the batch header row
  // when present; a headerless (legacy v1) batch reports status="sent" and
  // every logistics field null/empty.
  status: TransportBatchStatus;
  driver?: string | null;
  vehicle?: string | null;
  pickup_date?: string | null; // ISO date
  pickup_time?: string | null;
  limit_kg?: number | null;
  notes: string;
  // Weight preview roll-up (v2): sum of the known per-line weights, and how
  // many lines with qty > 0 have no unit_weight_kg on their supplier_product
  // (surfaced as a "brak wagi dla N pozycji" warning by the FE).
  total_weight_kg: number;
  unknown_weight_count: number;
  // Event history (v3 Phase 6) — newest first, capped 100. Empty when the
  // 'transport_events' worksheet/table has no rows yet.
  events: TransportEvent[];
  // Friendly operator-facing name (v4 feedback) — see TransportBatchSummary.name.
  name?: string | null;
}

/** One append-only row of a Transport batch's audit trail (v3 Phase 6) — the
 * post-send history the operator required. `order_id` is null for a
 * batch-level event (batch_sent, batch_cancelled, logistics_changed) and set
 * for an order-level one (order_combined, location_added, order_removed,
 * order_sent, quantities_changed, delivery_confirmed). `details` is a
 * human-readable "field: old → new" summary computed server-side. */
export interface TransportEvent {
  event_id: string;
  transport_id: string;
  order_id?: string | null;
  event_type: string;
  actor?: string | null;
  at?: string | null; // ISO datetime
  details: string;
}

/** One order the create endpoint could not combine, with a short
 * human-readable reason. Never raises for a single bad order, so a partial
 * batch is always explicit rather than silently dropped. */
export interface TransportSkippedOrder {
  order_id: string;
  reason: string;
}

export interface TransportCreateRequest {
  supplier_id: string;
  order_ids: string[];
  append_to?: string;
  // v3 Phase 9: accepted for API symmetry with TransportAddLocationRequest,
  // but NOT implemented server-side for create — prefill only happens via
  // add-location (create only ever combines EXISTING orders).
  prefill_products?: boolean;
}

export interface TransportCreateResponse {
  transport_id: string;
  combined: string[];
  skipped: TransportSkippedOrder[];
}

// Manager Transport v2: draft lifecycle (to-ordering-pago ADDENDUM v2) -------

export interface TransportFinalizeRequest {
  transport_id: string;
}

/** Result of finalize. `sent` lists order_ids that transitioned to
 * manager_sent; `skipped` lists member orders that could not (wrong status,
 * guard conflict, backend error) — mirrors TransportCreateResponse's
 * never-silently-drop contract. */
export interface TransportFinalizeResponse {
  transport_id: string;
  sent: string[];
  skipped: TransportSkippedOrder[];
}

/** Payload for POST /api/manager/transport/add-location — create a skeleton
 * (no-lines) order for `location_id` and fold it into the draft batch. */
export interface TransportAddLocationRequest {
  transport_id: string;
  location_id: string;
  // v3 Phase 9 (manager-first grid creation): when true, the skeleton order
  // is populated with a zero-qty line for every product this location can
  // order from the batch's supplier — exactly the Captain's orderable set.
  prefill_products?: boolean;
}

export interface TransportAddLocationResponse {
  transport_id: string;
  order_id: string; // the newly-created skeleton order
  prefilled_count: number;
}

// Manager Transport v3: cancel draft (to-ordering-pago ADDENDUM v3) ---------

/** Payload for POST /api/manager/transport/cancel — cancel a DRAFT batch
 * outright (409 on a sent batch). */
export interface TransportCancelRequest {
  transport_id: string;
}

/** Result of cancel. Mirrors remove-order's released/cancelled split, applied
 * to every member order: `released` lists orders returned to
 * captain_submitted (marker cleared); `cancelled` lists manager-created empty
 * orders cancelled outright. `skipped` lists members that were not
 * manager_claimed or hit a guard conflict. */
export interface TransportCancelResponse {
  transport_id: string;
  released: string[];
  cancelled: string[];
  skipped: TransportSkippedOrder[];
}

/** Payload for POST /api/manager/transport/remove-order — drop one member
 * order from a draft batch. */
export interface TransportRemoveOrderRequest {
  transport_id: string;
  order_id: string;
}

export interface TransportRemoveOrderResponse {
  transport_id: string;
  order_id: string;
  action: "released" | "cancelled";
}

/** Payload for PATCH /api/manager/transport/batch/{transport_id} — logistics
 * fields only; only the ones provided are updated (undefined = leave
 * untouched). Allowed regardless of batch status. */
export interface TransportBatchPatchRequest {
  driver?: string | null;
  vehicle?: string | null;
  pickup_date?: string | null; // ISO date
  pickup_time?: string | null;
  limit_kg?: number | null;
  notes?: string | null;
  // Friendly operator-facing name (v4 feedback). The FE sends `undefined`
  // (field omitted) for a blank input — never an empty string — so "leave
  // unset" and "clear to empty" stay distinct on the wire.
  name?: string | null;
}

export interface TransportBatchPatchResponse {
  transport_id: string;
  status: TransportBatchStatus;
  driver?: string | null;
  vehicle?: string | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
  limit_kg?: number | null;
  notes: string;
  name?: string | null;
}

// v4: Gmail draft config ("Zrob draft w Gmailu") -----------------------------

export interface TransportDraftConfig {
  driver_recipients: string;
  // Operator-configured comma-separated driver/vehicle name dictionaries
  // (feeding the Logistics panel's dropdowns). "" = no dictionary configured
  // — the panel falls back to free-text entry.
  drivers: string;
  vehicles: string;
}
