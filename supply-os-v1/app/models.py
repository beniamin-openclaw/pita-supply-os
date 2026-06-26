"""Pydantic models matching docs/pita-supply-os-v1/DATA_MODEL.md."""
from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------- Enums ----------

class OrderingMethod(str, Enum):
    EMAIL = "email"
    PORTAL = "portal"
    PHONE = "phone"
    MANUAL = "manual"


class OrderStatus(str, Enum):
    DRAFT = "draft"
    CAPTAIN_SUBMITTED = "captain_submitted"
    MANAGER_CLAIMED = "manager_claimed"  # manager took over (manual cut-off); locked for captain, not yet ordered
    MANAGER_SENT = "manager_sent"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ReasonCode(str, Enum):
    EVENT_HIGH_TRAFFIC = "EVENT_HIGH_TRAFFIC"
    WEEKEND_HIGH_TRAFFIC = "WEEKEND_HIGH_TRAFFIC"
    LOW_STORAGE = "LOW_STORAGE"
    PACKAGING_LIMITATION = "PACKAGING_LIMITATION"
    SUPPLIER_UNDERDELIVERS = "SUPPLIER_UNDERDELIVERS"
    SYSTEM_SUGGESTION_WRONG = "SYSTEM_SUGGESTION_WRONG"
    OTHER = "OTHER"


class RoundingRule(str, Enum):
    FULL_ONLY = "full_only"
    HALF_ALLOWED = "half_allowed"
    UP_FOR_CRITICAL = "up_for_critical"
    TENTH_KG = "tenth_kg"  # weight goods: round up to the next 0.1 (kg)


# ---------- Master data ----------

class Product(BaseModel):
    product_id: str
    gostock_id: Optional[int] = None
    product_name_pl: str
    product_category: str
    inventory_unit: str
    is_critical: bool = False
    active: bool = True
    notes: str = ""


class Supplier(BaseModel):
    supplier_id: str
    supplier_name: str
    email: Optional[str] = None
    ordering_method: OrderingMethod = OrderingMethod.EMAIL
    delivery_days: Optional[str] = None
    cutoff_time: Optional[str] = None
    minimum_order_value_pln: Optional[float] = None
    active: bool = True
    notes: str = ""


class Location(BaseModel):
    location_id: str
    location_name: str
    delivery_address: Optional[str] = None
    city: Optional[str] = None
    active: bool = True
    notes: str = ""


class SupplierProduct(BaseModel):
    supplier_product_id: str
    supplier_id: str
    product_id: str
    supplier_product_name: str
    purchase_unit: str
    units_per_purchase_unit: float = 1.0
    rounding_rule: RoundingRule = RoundingRule.FULL_ONLY
    price_estimate_pln: Optional[float] = None
    active: bool = True
    notes: str = ""
    # Short per-line packaging/ordering annotation shown on the Captain product
    # card (e.g. "1 karton = 6 szt (18 kg)"). Read-only master data — never
    # written via the app — so we deliberately DON'T set max_length here: a
    # >60-char hand edit would then fail model construction on READ and 500 the
    # orderable screen. The 60-char "few words" cap is enforced at the DB
    # (varchar(60), migration 0006), where the value is actually entered.
    order_note: Optional[str] = None


class LocationProductSetting(BaseModel):
    setting_id: str
    location_id: str
    product_id: str
    min_stock_qty_base: float = 0
    max_stock_qty_base: float = 0
    target_stock_qty_base: float = 0
    is_critical_for_location: bool = False
    allow_over_max_due_to_packaging: bool = False
    notes: str = ""


# ---------- Orders ----------

class OrderLine(BaseModel):
    order_line_id: str
    order_id: str
    product_id: str
    supplier_product_id: str
    current_stock_qty_base: float = 0
    target_stock_qty_base: float = 0
    suggested_qty_base: float = 0
    suggested_qty_purchase: float = 0
    captain_final_qty_purchase: float = 0
    captain_final_qty_base: float = 0
    manager_final_qty_purchase: float = 0
    manager_final_qty_base: float = 0
    delta_vs_suggestion_pct: Optional[float] = None
    reason_code: Optional[ReasonCode] = None
    captain_comment: str = ""
    manager_comment: str = ""


class Order(BaseModel):
    order_id: str
    location_id: str
    supplier_id: str
    order_date: date
    requested_delivery_date: Optional[date] = None
    status: OrderStatus = OrderStatus.DRAFT
    captain_user: Optional[str] = None
    captain_submitted_at: Optional[datetime] = None
    manager_user: Optional[str] = None
    manager_sent_at: Optional[datetime] = None
    sent_method: Optional[str] = None
    supplier_order_reference: Optional[str] = None
    total_value_estimate_pln: Optional[float] = None
    # Free-text "who orders" attribution captured at submit. Required on input
    # (CaptainSubmitRequest), Optional here so legacy rows with no value stay
    # valid. Mirrors Receipt.received_by / InventoryCount.count_user; not a
    # person-identity (the v0 per-user Non-Goal stands), never overwritten by the
    # captain edit.
    ordered_by: Optional[str] = None
    last_edited_at: Optional[datetime] = None  # set on captain edit; None = never edited
    # Soft-delete trace (Manager cancel): all None/"" until cancelled. Status goes
    # to CANCELLED; the order is never hard-deleted.
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[str] = None
    cancel_reason: str = ""
    notes: str = ""
    lines: list[OrderLine] = Field(default_factory=list)


# ---------- Captain submit request/response (Phase C3) ----------

class OrderLineSubmit(BaseModel):
    product_id: str
    supplier_product_id: str
    # None = stock NOT counted (distinct from a counted 0). When None, the submit
    # gate skips the deviation/critical reason check (there is no real suggestion
    # to deviate from) and forces a reason only on an over-MAX order; the line is
    # persisted with current_stock_qty_base=0 (the column stays NOT NULL).
    current_stock_qty_base: Optional[float] = Field(default=None, ge=0)
    captain_final_qty_purchase: float = Field(ge=0)
    reason_code: Optional[ReasonCode] = None
    captain_comment: str = ""


class CaptainSubmitRequest(BaseModel):
    supplier_id: str
    requested_delivery_date: Optional[date] = None
    lines: list[OrderLineSubmit] = Field(min_length=1)
    # Required free-text "who orders" attribution (FR/spec) — mirrors
    # ReceiptSubmitRequest.received_by / InventoryCountSubmitRequest.count_user.
    # min_length=1 → omitting or blanking it is a 422 before the business gate.
    ordered_by: str = Field(min_length=1)
    notes: str = ""


class CaptainSubmitResponse(BaseModel):
    order_id: str
    status: OrderStatus
    line_count: int
    total_value_estimate_pln: float
    warnings: list[str] = Field(default_factory=list)


# ---------- Manager dispatch request/response (Phase C4) ----------

class OrderLineManagerFinal(BaseModel):
    order_line_id: str
    manager_final_qty_purchase: float = Field(ge=0)
    manager_comment: str = ""


class ManagerDispatchRequest(BaseModel):
    order_id: str
    manager_finals: list[OrderLineManagerFinal] = Field(min_length=1)
    # Transport actually used; mapped from supplier.ordering_method by the UI
    # (email|portal|phone|manual). Default "email" matches the enum — the legacy
    # "gmail" default was inconsistent with OrderingMethod.
    sent_method: str = "email"


class ManagerDispatchResponse(BaseModel):
    order_id: str
    status: OrderStatus
    # Only present for email dispatch; None for portal/phone/manual channels.
    gmail_compose_url: Optional[str] = None
    supplier_email: Optional[str] = None
    total_value_estimate_pln: float


# ---------- Manager save-without-dispatch (Phase G2) ----------

class ManagerSaveRequest(BaseModel):
    """Payload for PATCH /api/manager/order/{order_id} — persist manager edits
    WITHOUT dispatching. Empty list = no-op.

    Read-modify-write contract: the UI MUST send the full current
    manager_final_qty_purchase AND manager_comment for every touched line. The
    backend overwrites manager_comment with whatever the payload carries, so a
    qty-only payload would wipe a previously-saved comment — the frontend is the
    single read-modify-write owner.
    """
    manager_finals: list[OrderLineManagerFinal] = Field(default_factory=list)


class ManagerSaveResponse(BaseModel):
    order_id: str
    status: OrderStatus  # stays manager_claimed
    lines_updated: int
    total_value_estimate_pln: float


# ---------- Manager queue + order detail (Phase D0) ----------

class ManagerQueueItem(BaseModel):
    """One row in the Manager dashboard's queue pane (compact list)."""
    order_id: str
    location_id: str
    supplier_id: str
    supplier_name: str  # joined from suppliers tab
    order_date: date
    requested_delivery_date: Optional[date] = None
    status: OrderStatus
    captain_user: Optional[str] = None
    captain_submitted_at: Optional[datetime] = None
    ordered_by: Optional[str] = None  # free-text "who orders" (shown as "Zamówił: X")
    line_count: int
    total_value_estimate_pln: Optional[float] = None
    deviation_count: int  # lines z delta_vs_suggestion_pct >= 0.25
    reason_count: int  # lines z non-null reason_code
    last_edited_at: Optional[datetime] = None  # set if captain edited after submit
    cutoff_iso: Optional[datetime] = None  # absolute cutoff datetime for ordering (Tue 14:00 dla Pago)
    # Goods-receipt signal (manager-receiving-view). Set only on the manager_sent
    # lane; 0 on every other lane / legacy row. received_count = receipts for this
    # order; received_discrepancy_count = receipts with discrepancy_count > 0. The
    # FE renders a ⚠ chip when discrepancy > 0, else a neutral ✓ chip when count > 0.
    received_count: int = 0
    received_discrepancy_count: int = 0


class ManagerOrderLineDetail(BaseModel):
    """One line in the detail table — enriched with product + supplier_product info."""
    order_line_id: str
    product_id: str
    product_name_pl: str  # joined from products
    inventory_unit: str
    is_critical: bool
    supplier_product_id: str
    supplier_product_name: str  # joined
    purchase_unit: str
    units_per_purchase_unit: float
    rounding_rule: RoundingRule = RoundingRule.FULL_ONLY  # SKU snap rule, for FE parity
    price_estimate_pln: Optional[float] = None
    current_stock_qty_base: float
    target_stock_qty_base: float
    # Storage ceiling + packaging override, joined from location_product_settings.
    # The Captain edit screen needs these to mirror the backend over-MAX gate
    # (uncounted-stock branch) so a cleared stock + over-MAX order shows the red
    # pill instead of a surprise 400. Default 0/False when no setting row exists.
    max_stock_qty_base: float = 0
    allow_over_max_due_to_packaging: bool = False
    suggested_qty_base: float
    suggested_qty_purchase: float
    captain_final_qty_purchase: float
    captain_final_qty_base: float
    manager_final_qty_purchase: float
    manager_final_qty_base: float
    delta_vs_suggestion_pct: Optional[float] = None
    reason_code: Optional[ReasonCode] = None
    captain_comment: str = ""
    manager_comment: str = ""


class ManagerOrderReceiptLine(BaseModel):
    """One delivered line within a receipt, enriched for the Manager read-only
    delivery section (manager-receiving-view). Product name + purchase unit are
    joined server-side so the section is self-contained (no FE line-mapping).
    ``variance_qty_purchase`` = received − ordered, pre-computed at confirm."""
    order_line_id: str
    product_id: str
    product_name_pl: str  # joined from products (id fallback)
    purchase_unit: str  # joined from supplier_products
    ordered_qty_purchase: float = 0
    received_qty_purchase: float = 0
    variance_qty_purchase: float = 0
    receipt_comment: str = ""


class ManagerOrderReceipt(BaseModel):
    """A goods-receipt against an order, for the Manager delivery section. An
    order can have 0..N receipts (append-only); the detail endpoint returns them
    newest-first. Mirrors the Captain receipt overlay, read-only."""
    receipt_id: str
    receipt_date: date
    received_by: Optional[str] = None
    received_submitted_at: Optional[datetime] = None
    line_count: int = 0
    discrepancy_count: int = 0  # lines with variance_qty_purchase != 0
    received_with_missing_wz: bool = True
    wz_photo_count: int = 0
    lines: list[ManagerOrderReceiptLine] = Field(default_factory=list)


class ManagerOrderDetail(BaseModel):
    """Full order with lines, suppliers, products — for the right detail pane."""
    order_id: str
    location_id: str
    location_name: str  # joined
    # Delivery address, joined from locations — the supplier email address line
    # is location_name + delivery_address + city (empty parts skipped). Optional
    # so legacy/absent locations stay valid (mirrors the Location master-data).
    delivery_address: Optional[str] = None
    city: Optional[str] = None
    supplier_id: str
    supplier_name: str  # joined
    supplier_email: Optional[str] = None  # for the Gmail draft preview
    # Channel the dispatch panel must branch on (email|portal|phone|manual).
    ordering_method: OrderingMethod = OrderingMethod.EMAIL
    supplier_notes: str = ""  # fallback source for a phone number etc.
    order_date: date
    requested_delivery_date: Optional[date] = None
    status: OrderStatus
    captain_user: Optional[str] = None
    captain_submitted_at: Optional[datetime] = None
    ordered_by: Optional[str] = None  # free-text "who orders" (shown as "Zamówił: X")
    manager_user: Optional[str] = None
    manager_sent_at: Optional[datetime] = None
    total_value_estimate_pln: Optional[float] = None
    notes: str = ""
    lines: list[ManagerOrderLineDetail] = Field(default_factory=list)
    # Goods-receipts against this order (0..N, newest-first), read-only — closes
    # the suggested→captain→manager→RECEIVED loop on the Manager screen. Empty
    # when none / receipts tab absent (manager-receiving-view).
    receipts: list[ManagerOrderReceipt] = Field(default_factory=list)


# ---------- Captain own-orders view + edit (Phase E3) ----------

class CaptainOrderListItem(BaseModel):
    """Compact row shown to a Captain browsing 'My orders' list."""
    order_id: str
    supplier_id: str
    supplier_name: str  # joined
    order_date: date
    requested_delivery_date: Optional[date] = None
    status: OrderStatus
    captain_submitted_at: Optional[datetime] = None
    last_edited_at: Optional[datetime] = None
    line_count: int
    deviation_count: int
    reason_count: int
    total_value_estimate_pln: Optional[float] = None
    # Editable only while captain_submitted (manager hasn't started yet).
    editable: bool


class CaptainOrderDetail(BaseModel):
    """Full order with enriched lines — what the Captain sees clicking into a row.

    Same shape as ManagerOrderDetail minus the manager-only fields, plus an
    `editable` flag the UI uses to show/hide the Edit button.
    """
    order_id: str
    location_id: str
    location_name: str
    supplier_id: str
    supplier_name: str
    order_date: date
    requested_delivery_date: Optional[date] = None
    status: OrderStatus
    captain_user: Optional[str] = None
    captain_submitted_at: Optional[datetime] = None
    ordered_by: Optional[str] = None  # free-text "who orders" (shown as "Zamówił: X")
    last_edited_at: Optional[datetime] = None
    total_value_estimate_pln: Optional[float] = None
    notes: str = ""
    editable: bool
    lines: list[ManagerOrderLineDetail] = Field(default_factory=list)


class CaptainEditRequest(BaseModel):
    """Payload for PATCH /api/captain/order/{order_id}. Same shape as
    CaptainSubmitRequest, minus supplier_id (it cannot be changed)."""
    requested_delivery_date: Optional[date] = None
    lines: list[OrderLineSubmit] = Field(min_length=1)
    notes: str = ""


class CaptainEditResponse(BaseModel):
    order_id: str
    status: OrderStatus
    line_count: int
    total_value_estimate_pln: float
    warnings: list[str] = Field(default_factory=list)


# ---------- Manager claim / release (Phase F1) ----------

class ManagerClaimResponse(BaseModel):
    """Result of POST /api/manager/claim/{order_id} — manager takes over
    (manual cut-off). Order goes captain_submitted → manager_claimed, locked
    for the captain but not yet ordered from the supplier."""
    order_id: str
    status: OrderStatus  # manager_claimed on success


class ManagerReleaseRequest(BaseModel):
    """Payload for POST /api/manager/release/{order_id}. The manager sends the
    order back to the captain for corrections with a required reason that the
    captain will see."""
    reason: str = Field(min_length=1, max_length=500)


class ManagerReleaseResponse(BaseModel):
    """Result of release — order goes manager_claimed → captain_submitted with
    the reason stored in the order's `notes` (shown to the captain as a
    'send-back' banner; cleared when the captain resubmits)."""
    order_id: str
    status: OrderStatus  # captain_submitted on success


class ManagerCancelRequest(BaseModel):
    """Payload for POST /api/manager/cancel/{order_id}. The Manager cancels a
    pre-dispatch order with a required reason that is stored as a durable trace
    (cancel_reason + cancelled_by + cancelled_at on the order)."""
    reason: str = Field(min_length=1, max_length=500)


class ManagerCancelResponse(BaseModel):
    """Result of cancel — order goes captain_submitted|manager_claimed →
    cancelled (soft-delete; never hard-deleted)."""
    order_id: str
    status: OrderStatus  # cancelled on success


# ---------- Manager add ad-hoc product line (add-product-to-order) ----------

class ManagerAddLineRequest(BaseModel):
    """Payload for POST /api/manager/order/{id}/add-line — append one ad-hoc
    product line to a manager_claimed order. The product must be orderable for the
    order's supplier+location and not already on the order. Orderable membership is
    the only gate (the Manager has qty override authority — no captain
    deviation/critical/over-MAX reason gate applies to a manager-added line)."""
    product_id: str = Field(min_length=1)
    supplier_product_id: str = Field(min_length=1)


class ManagerAddLineResponse(BaseModel):
    """Result of add-line — a skeleton OrderLine (all quantities 0) was appended;
    the Manager then sets manager_final via the existing save/dispatch flow. The
    order status is unchanged (stays manager_claimed)."""
    order_id: str
    order_line_id: str
    status: OrderStatus  # manager_claimed on success


# ---------- Inventory count (S-06) ----------

class InventoryProduct(BaseModel):
    """One row on the Captain's location-wide inventory-count screen — a product
    configured for the location, to be counted in one pass. Enriched join of
    `products` + `location_product_settings` (mirrors the orderable item shape,
    but spans every supplier at the location rather than one supplier)."""
    product_id: str
    product_name_pl: str
    product_category: str
    inventory_unit: str
    is_critical: bool


class InventoryCountLine(BaseModel):
    """One counted product within an inventory snapshot. A line exists only for
    a product the Captain actually entered (blank = not counted, no line)."""
    count_line_id: str
    count_id: str
    product_id: str
    current_stock_qty_base: float = 0
    count_comment: str = ""


class InventoryCount(BaseModel):
    """A dated, append-only location-wide stock snapshot (FR-016). Immutable:
    a re-count produces a new count_id, never an edit."""
    count_id: str
    location_id: str
    count_date: date
    count_user: Optional[str] = None  # proxy = location_id in v0 (no per-user identity)
    count_submitted_at: Optional[datetime] = None
    line_count: int = 0
    notes: str = ""
    lines: list[InventoryCountLine] = Field(default_factory=list)


class InventoryCountLineSubmit(BaseModel):
    product_id: str
    current_stock_qty_base: float = Field(ge=0)
    count_comment: str = ""


class InventoryCountSubmitRequest(BaseModel):
    """Payload for POST /api/captain/inventory/submit. Only entered products are
    included; an empty list is rejected (min_length=1).

    `count_user` (who counted) is REQUIRED free-text attribution (FR-021) — it
    lands in the existing `count_user` field and does NOT authenticate or gate
    anything (the per-user-identity v0 Non-Goal still holds). `count_date`
    (FR-020) is optional; when omitted the endpoint defaults it to today in
    Warsaw local time. A future date is rejected by the endpoint."""
    lines: list[InventoryCountLineSubmit] = Field(min_length=1)
    count_user: str = Field(min_length=1)
    count_date: Optional[date] = None
    notes: str = ""


class InventoryCountSubmitResponse(BaseModel):
    count_id: str
    count_date: date
    line_count: int
    warnings: list[str] = Field(default_factory=list)


class InventoryLatestLine(BaseModel):
    """One counted product from the latest snapshot, for order pre-fill (FR-017)."""
    product_id: str
    current_stock_qty_base: float = 0
    count_comment: str = ""


class InventoryLatestResponse(BaseModel):
    """Latest location inventory snapshot offered as an opt-in order pre-fill
    source (FR-017). The order screen NAMES this `count_submitted_at` / `count_date`
    in its confirmation so a stale count can't silently enter an order."""
    count_id: str
    count_date: date
    count_submitted_at: Optional[datetime] = None
    count_user: Optional[str] = None  # who counted (FR-022 banner); may be absent on legacy rows
    line_count: int = 0
    lines: list[InventoryLatestLine] = Field(default_factory=list)


class InventoryCountSummary(BaseModel):
    """A compact row in the order-screen snapshot picker (FR-024) — lists an
    available inventory snapshot WITHOUT its lines (the picker shows date +
    submitted time + who counted; lines are fetched lazily on select via the
    detail route). `count_submitted_at` / `count_user` may be absent on legacy
    rows, so both are optional."""
    count_id: str
    location_id: str
    count_date: date
    count_submitted_at: Optional[datetime] = None
    count_user: Optional[str] = None
    line_count: int = 0


# ---------- Manager inventory view (S-08 / FR-018) ----------

class InventoryCountManagerItem(BaseModel):
    """One row in the Manager's cross-location inventory list (FR-018). Mirrors
    `InventoryCountSummary` plus the joined `location_name` (the Manager spans
    locations, so the name must be resolved server-side like `ManagerQueueItem`)."""
    count_id: str
    location_id: str
    location_name: str  # joined from locations
    count_date: date
    count_submitted_at: Optional[datetime] = None
    count_user: Optional[str] = None
    line_count: int = 0


class InventoryCountDetailLine(BaseModel):
    """One counted product in the Manager/owner inventory detail — enriched with
    product master-data joins so a human reads names, not opaque ids."""
    product_id: str
    product_name_pl: str  # joined from products
    product_category: str
    inventory_unit: str
    is_critical: bool
    current_stock_qty_base: float = 0
    count_comment: str = ""


class InventoryCountDetail(BaseModel):
    """A full submitted inventory snapshot for the Manager/owner read view
    (FR-018/FR-019) — location_name + product-enriched lines. Distinct from the
    lean `InventoryLatestResponse` (which the Captain order pre-fill picker
    consumes by product_id and must not change)."""
    count_id: str
    location_id: str
    location_name: str  # joined
    count_date: date
    count_submitted_at: Optional[datetime] = None
    count_user: Optional[str] = None
    line_count: int = 0
    notes: str = ""
    lines: list[InventoryCountDetailLine] = Field(default_factory=list)


# ---------- Suggestion learning-loop review (S-03 / FR-012) ----------

class SuggestionReviewItem(BaseModel):
    """One product's roll-up across the order-line history for the suggestion
    learning loop (FR-012): how the engine's suggestion compared to the captain/
    manager finals, and why it was overridden. The endpoint sorts these
    worst-deviation first so the owner sees the strongest master-data correction
    candidates. `manager_final` averages include not-yet-dispatched lines (0),
    surfaced honestly rather than filtered."""
    product_id: str
    product_name_pl: str  # joined from products (id fallback)
    product_category: str
    inventory_unit: str
    line_count: int
    order_count: int  # distinct orders this product appeared in
    avg_suggested_qty_purchase: float
    avg_captain_final_qty_purchase: float
    avg_manager_final_qty_purchase: float
    avg_abs_deviation_pct: float  # mean |delta_vs_suggestion_pct| over lines that have one
    reason_code_counts: dict[str, int] = Field(default_factory=dict)


# ---------- Goods receiving (GR-01) ----------

class ReceiptLine(BaseModel):
    """One delivered line within a goods-receipt — delivered vs. ordered for a
    single order line. ``ordered_qty_purchase`` is the effective ordered qty
    snapshotted at confirm (manager_final if > 0 else captain_final);
    ``variance_qty_purchase`` = received − ordered."""
    receipt_line_id: str
    receipt_id: str
    order_id: str
    order_line_id: str
    product_id: str
    supplier_product_id: str
    ordered_qty_purchase: float = 0
    received_qty_purchase: float = 0
    variance_qty_purchase: float = 0
    receipt_comment: str = ""


class Receipt(BaseModel):
    """A Captain's confirmation that a dispatched order was delivered (GR-01).
    Append-only, standalone child of an order — it never changes the order's
    status. WZ delivery-note photos live under a per-order Supabase Storage key
    prefix (``wz_photo_path_prefix``); ``received_with_missing_wz`` starts True
    and is flipped False once at least one photo is attached."""
    receipt_id: str
    order_id: str
    location_id: str
    supplier_id: str
    receipt_date: date
    received_by: Optional[str] = None  # free-text attribution (no per-user identity in v0)
    received_submitted_at: Optional[datetime] = None
    line_count: int = 0
    discrepancy_count: int = 0  # lines with variance_qty_purchase != 0
    received_with_missing_wz: bool = True
    wz_photo_path_prefix: Optional[str] = None  # Supabase Storage prefix: wz/<order_id>
    wz_photo_count: int = 0
    notes: str = ""
    lines: list[ReceiptLine] = Field(default_factory=list)


class ReceiptLineSubmit(BaseModel):
    order_line_id: str
    received_qty_purchase: float = Field(ge=0)
    receipt_comment: str = ""


class ReceiptSubmitRequest(BaseModel):
    """Payload for POST /api/captain/receipt/submit. ``received_by`` is required
    free-text attribution (mirrors inventory ``count_user``); ``receipt_date``
    defaults to Warsaw-today when omitted (a future date is rejected)."""
    order_id: str
    received_by: str = Field(min_length=1)
    receipt_date: Optional[date] = None
    lines: list[ReceiptLineSubmit] = Field(min_length=1)
    notes: str = ""


class ReceiptSubmitResponse(BaseModel):
    receipt_id: str
    order_id: str
    receipt_date: date
    line_count: int
    discrepancy_count: int
    received_with_missing_wz: bool
    warnings: list[str] = Field(default_factory=list)


class ReceiptDetailLine(BaseModel):
    """One enriched receipt line for the Captain detail view (product joins)."""
    receipt_line_id: str
    order_line_id: str
    product_id: str
    product_name_pl: str  # joined from products (id fallback)
    inventory_unit: str
    purchase_unit: str  # joined from supplier_products
    is_critical: bool
    ordered_qty_purchase: float
    received_qty_purchase: float
    variance_qty_purchase: float
    receipt_comment: str = ""


class ReceiptDetail(BaseModel):
    """A full goods-receipt for the Captain detail view — location/supplier names
    joined, product-enriched lines, and the WZ photo storage prefix."""
    receipt_id: str
    order_id: str
    location_id: str
    location_name: str  # joined
    supplier_id: str
    supplier_name: str  # joined
    receipt_date: date
    received_by: Optional[str] = None
    received_submitted_at: Optional[datetime] = None
    line_count: int = 0
    discrepancy_count: int = 0
    received_with_missing_wz: bool = True
    wz_photo_path_prefix: Optional[str] = None
    wz_photo_count: int = 0
    notes: str = ""
    lines: list[ReceiptDetailLine] = Field(default_factory=list)


class ReceiptSummary(BaseModel):
    """Compact list row for GET /api/captain/receipts?order_id= (no lines)."""
    receipt_id: str
    order_id: str
    location_id: str
    receipt_date: date
    received_submitted_at: Optional[datetime] = None
    received_by: Optional[str] = None
    line_count: int = 0
    discrepancy_count: int = 0
    received_with_missing_wz: bool = True
    wz_photo_count: int = 0


class ReceiptPhotoItem(BaseModel):
    """One WZ photo with a freshly-minted, short-lived signed URL. NEVER
    persisted — re-signed on every read."""
    name: str
    signed_url: str


class ReceiptPhotoUploadResponse(BaseModel):
    """Result of POST /api/captain/receipt/{id}/photos — the just-uploaded WZ
    photos (each with a fresh signed URL for immediate display) + the new count."""
    receipt_id: str
    wz_photo_count: int
    received_with_missing_wz: bool
    uploaded: list[ReceiptPhotoItem] = Field(default_factory=list)
