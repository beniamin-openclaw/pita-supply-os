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
  notes?: string;
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
  line_count: number;
  lines: InventoryLatestLine[];
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
  line_count: number;
  notes: string;
  lines: InventoryCountDetailLine[];
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
  last_edited_at?: string | null;
  total_value_estimate_pln?: number | null;
  notes: string;
  editable: boolean;
  lines: ManagerOrderLineDetail[];
}

export interface CaptainEditRequest {
  requested_delivery_date?: string;
  lines: OrderLineSubmit[];
  notes?: string;
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

// Manager Queue --------------------------------------------------------------

export interface ManagerQueueItem {
  order_id: string;
  location_id: string;
  supplier_id: string;
  supplier_name: string;
  order_date: string;
  requested_delivery_date?: string;
  status: OrderStatus;
  captain_user?: string;
  captain_submitted_at?: string; // ISO datetime
  line_count: number;
  total_value_estimate_pln?: number;
  deviation_count: number;
  reason_count: number;
  last_edited_at?: string | null;
  cutoff_iso?: string; // ISO datetime
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

export interface ManagerOrderDetail {
  order_id: string;
  location_id: string;
  location_name: string;
  supplier_id: string;
  supplier_name: string;
  supplier_email?: string;
  // G3: channel routing + phone/notes for the dispatch panel.
  ordering_method: OrderingMethod;
  supplier_notes: string;
  order_date: string;
  requested_delivery_date?: string;
  status: OrderStatus;
  captain_user?: string;
  captain_submitted_at?: string;
  manager_user?: string;
  manager_sent_at?: string;
  total_value_estimate_pln?: number;
  notes: string;
  lines: ManagerOrderLineDetail[];
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
