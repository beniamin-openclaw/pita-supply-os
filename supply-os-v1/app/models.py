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
    last_edited_at: Optional[datetime] = None  # set on captain edit; None = never edited
    notes: str = ""
    lines: list[OrderLine] = Field(default_factory=list)


# ---------- Captain submit request/response (Phase C3) ----------

class OrderLineSubmit(BaseModel):
    product_id: str
    supplier_product_id: str
    current_stock_qty_base: float = Field(ge=0)
    captain_final_qty_purchase: float = Field(ge=0)
    reason_code: Optional[ReasonCode] = None
    captain_comment: str = ""


class CaptainSubmitRequest(BaseModel):
    supplier_id: str
    requested_delivery_date: Optional[date] = None
    lines: list[OrderLineSubmit] = Field(min_length=1)
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
    line_count: int
    total_value_estimate_pln: Optional[float] = None
    deviation_count: int  # lines z delta_vs_suggestion_pct >= 0.20
    reason_count: int  # lines z non-null reason_code
    last_edited_at: Optional[datetime] = None  # set if captain edited after submit
    cutoff_iso: Optional[datetime] = None  # absolute cutoff datetime for ordering (Tue 14:00 dla Pago)


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
    price_estimate_pln: Optional[float] = None
    current_stock_qty_base: float
    target_stock_qty_base: float
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


class ManagerOrderDetail(BaseModel):
    """Full order with lines, suppliers, products — for the right detail pane."""
    order_id: str
    location_id: str
    location_name: str  # joined
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
    manager_user: Optional[str] = None
    manager_sent_at: Optional[datetime] = None
    total_value_estimate_pln: Optional[float] = None
    notes: str = ""
    lines: list[ManagerOrderLineDetail] = Field(default_factory=list)


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


# ---------- Inventory count (S-06) ----------

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
    included; an empty list is rejected (min_length=1)."""
    lines: list[InventoryCountLineSubmit] = Field(min_length=1)
    notes: str = ""


class InventoryCountSubmitResponse(BaseModel):
    count_id: str
    count_date: date
    line_count: int
    warnings: list[str] = Field(default_factory=list)
