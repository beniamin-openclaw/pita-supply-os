"""FastAPI app — Captain Submit + Manager Dispatch backend."""
import logging
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from . import gmail_url, seed_loader, sheets
from .auth import require_any_auth, require_captain, require_manager
from .config import DataBackend, settings
from .models import (
    CaptainEditRequest,
    CaptainEditResponse,
    CaptainOrderDetail,
    CaptainOrderListItem,
    CaptainSubmitRequest,
    CaptainSubmitResponse,
    InventoryCount,
    InventoryCountLine,
    InventoryCountSubmitRequest,
    InventoryCountSubmitResponse,
    InventoryCountSummary,
    InventoryLatestLine,
    InventoryLatestResponse,
    InventoryProduct,
    LocationProductSetting,
    ManagerClaimResponse,
    ManagerDispatchRequest,
    ManagerDispatchResponse,
    ManagerOrderDetail,
    ManagerOrderLineDetail,
    ManagerQueueItem,
    ManagerReleaseRequest,
    ManagerReleaseResponse,
    ManagerSaveRequest,
    ManagerSaveResponse,
    Order,
    OrderLine,
    OrderingMethod,
    OrderStatus,
    Product,
    RoundingRule,
    Supplier,
    SupplierProduct,
)
from .suggestion import SuggestionInput, compute_suggestion, rounding_step

log = logging.getLogger(__name__)

app = FastAPI(
    title="Pita Bros Supply OS",
    version="0.1.0",
    description="Captain Submit + Manager Dispatch backend (v0).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Health ----------

@app.get("/health")
def health():
    """Public health check — minimal, leaks no internal config."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health/internal")
def health_internal(_: None = Depends(require_manager)):
    """Diagnostic health — env + data backend + version. Manager auth only."""
    return {
        "status": "ok",
        "env": settings.env,
        "data_backend": settings.data_backend.value,
        "version": app.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------- Master data (auth required — Captain or Manager) ----------

@app.get("/api/products")
def products(_actor: str = Depends(require_any_auth)):
    return seed_loader.load_products()


@app.get("/api/suppliers")
def suppliers(_actor: str = Depends(require_any_auth)):
    return seed_loader.load_suppliers()


@app.get("/api/locations")
def locations(_actor: str = Depends(require_any_auth)):
    return seed_loader.load_locations()


# ---------- Captain Submit (auth required) ----------

def _build_orderable_item(
    sp: SupplierProduct,
    products_by_id: dict[str, Product],
    settings_by_pid: dict[str, LocationProductSetting],
) -> dict:
    """Compose one line for the Captain Submit screen."""
    product = products_by_id[sp.product_id]
    setting = settings_by_pid[sp.product_id]
    return {
        "product_id": sp.product_id,
        "product_name_pl": product.product_name_pl,
        "inventory_unit": product.inventory_unit,
        "is_critical": setting.is_critical_for_location or product.is_critical,
        "purchase_unit": sp.purchase_unit,
        "units_per_purchase_unit": sp.units_per_purchase_unit,
        "rounding_rule": sp.rounding_rule.value,
        "min_stock_qty_base": setting.min_stock_qty_base,
        "max_stock_qty_base": setting.max_stock_qty_base,
        "target_stock_qty_base": setting.target_stock_qty_base,
        "allow_over_max_due_to_packaging": setting.allow_over_max_due_to_packaging,
        "supplier_product_id": sp.supplier_product_id,
        "supplier_product_name": sp.supplier_product_name,
    }


@app.get("/api/captain/orderable")
def captain_orderable(
    supplier_id: str,
    location_id: str = Depends(require_captain),
):
    """Products this Captain can order from `supplier_id`. The location is
    derived from the authenticated Captain's token; cross-location access
    is not permitted in v0."""
    products_by_id = {p.product_id: p for p in seed_loader.load_products()}
    settings_by_pid = {
        s.product_id: s
        for s in seed_loader.load_location_product_settings()
        if s.location_id == location_id
    }
    sps = [
        sp
        for sp in seed_loader.load_supplier_products()
        if sp.supplier_id == supplier_id and sp.product_id in settings_by_pid
    ]
    return [_build_orderable_item(sp, products_by_id, settings_by_pid) for sp in sps]


class SuggestRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    current_stock_qty_base: float = Field(ge=0, description="Current stock in inventory unit")
    target_stock_qty_base: float = Field(ge=0, description="Replenish-to-this level")
    max_stock_qty_base: float = Field(ge=0, description="Storage ceiling")
    units_per_purchase_unit: float = Field(gt=0, description="Inventory units in 1 purchase unit")
    is_critical: bool = False
    allow_over_max_due_to_packaging: bool = False
    rounding_rule: RoundingRule = RoundingRule.FULL_ONLY


@app.post("/api/captain/suggest")
def captain_suggest(
    req: SuggestRequest,
    _location_id: str = Depends(require_captain),
):
    try:
        inp = SuggestionInput(
            current_stock_qty_base=req.current_stock_qty_base,
            target_stock_qty_base=req.target_stock_qty_base,
            max_stock_qty_base=req.max_stock_qty_base,
            units_per_purchase_unit=req.units_per_purchase_unit,
            rounding_rule=req.rounding_rule,
            is_critical=req.is_critical,
            allow_over_max_due_to_packaging=req.allow_over_max_due_to_packaging,
        )
        out = compute_suggestion(inp)
    except ValueError as e:
        # Pydantic constraints catch most bad input; this is defense-in-depth.
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "suggested_qty_base": out.suggested_qty_base,
        "suggested_qty_purchase": out.suggested_qty_purchase,
        "over_max_qty_base": out.over_max_qty_base,
        "explanation": out.explanation,
    }


# ---------- Captain Submit endpoint (POST) ----------

def _choose_backend():
    """Return the data backend module to use for this request.

    Sheet backend only when configured AND selected via settings; otherwise
    fall back to the seed loader (keeps tests + local dev working without
    Google credentials).
    """
    if settings.data_backend == DataBackend.SHEET and sheets.is_configured():
        return sheets
    return seed_loader


class _MasterData:
    """Bundle of loaded master data for one captain submit call."""

    __slots__ = ("products_by_id", "supplier", "sps_by_id", "settings_by_pid")

    def __init__(
        self,
        products_by_id: dict[str, Product],
        supplier: Supplier,
        sps_by_id: dict[str, SupplierProduct],
        settings_by_pid: dict[str, LocationProductSetting],
    ) -> None:
        self.products_by_id = products_by_id
        self.supplier = supplier
        self.sps_by_id = sps_by_id
        self.settings_by_pid = settings_by_pid


def _resolve_master_data(backend, location_id: str, supplier_id: str) -> _MasterData:
    """Load and index master data needed to validate one captain submit."""
    products_by_id = {p.product_id: p for p in backend.load_products()}
    supplier = next(
        (s for s in backend.load_suppliers() if s.supplier_id == supplier_id),
        None,
    )
    if supplier is None:
        raise HTTPException(status_code=400, detail="Unknown supplier_id")
    sps_by_id = {
        sp.supplier_product_id: sp
        for sp in backend.load_supplier_products()
        if sp.supplier_id == supplier_id
    }
    settings_by_pid = {
        s.product_id: s
        for s in backend.load_location_product_settings()
        if s.location_id == location_id
    }
    return _MasterData(products_by_id, supplier, sps_by_id, settings_by_pid)


def _generate_order_id(location_id: str, supplier_id: str, today: date) -> str:
    """ORD-YYYYMMDD-<LOC3>-<SUP4>-<6hex>."""
    loc = (location_id or "XXX")[:3].upper()
    sup_core = supplier_id.replace("SUP_", "")[:4]
    sup = (sup_core or "XXXX").upper()
    rand = secrets.token_hex(3)
    return f"ORD-{today.strftime('%Y%m%d')}-{loc}-{sup}-{rand}"


def _persist_order(backend, order: Order, lines: list[OrderLine]) -> bool:
    """Write order + lines to backend. Returns True on persistent write,
    False on in-memory-only fallback (seed backend)."""
    appender = getattr(backend, "append_order", None)
    lines_appender = getattr(backend, "append_order_lines", None)
    if appender is None or lines_appender is None:
        log.warning(
            "Order %s submitted to read-only backend %s — not persisted",
            order.order_id,
            getattr(backend, "__name__", "?"),
        )
        return False
    try:
        appender(order)
        lines_appender(lines)
    except NotImplementedError:
        log.warning(
            "Order %s — backend %s raised NotImplementedError on write",
            order.order_id,
            getattr(backend, "__name__", "?"),
        )
        return False
    return True


@app.post("/api/captain/submit", response_model=CaptainSubmitResponse)
def captain_submit(
    req: CaptainSubmitRequest,
    location_id: str = Depends(require_captain),
):
    """Validate + persist a captain-submitted order.

    Validation gates (deterministic):
      - supplier_id must be known.
      - every line's supplier_product_id must be orderable for this supplier.
      - every line's product_id must have a location_product_setting row at
        this captain's location.
      - critical product under-ordered without reason_code -> 400.
      - any line deviating >20% from suggestion without reason_code -> 400.
        Deviations with a reason_code are surfaced as warnings on the response.
    """
    backend = _choose_backend()
    master = _resolve_master_data(backend, location_id, req.supplier_id)

    today = datetime.now(timezone.utc).date()
    order_id = _generate_order_id(location_id, req.supplier_id, today)

    order_lines: list[OrderLine] = []
    warnings: list[str] = []
    total_value = 0.0

    for idx, line in enumerate(req.lines, start=1):
        sp = master.sps_by_id.get(line.supplier_product_id)
        if sp is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"supplier_product '{line.supplier_product_id}' not orderable "
                    f"at this location"
                ),
            )
        product = master.products_by_id.get(line.product_id)
        if product is None:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown product_id '{line.product_id}'",
            )
        setting = master.settings_by_pid.get(line.product_id)
        if setting is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"product '{line.product_id}' has no location_product_setting "
                    f"at this location"
                ),
            )
        if sp.product_id != line.product_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"supplier_product '{line.supplier_product_id}' does not map "
                    f"to product '{line.product_id}'"
                ),
            )

        is_critical = setting.is_critical_for_location or product.is_critical
        suggestion = compute_suggestion(
            SuggestionInput(
                current_stock_qty_base=line.current_stock_qty_base,
                target_stock_qty_base=setting.target_stock_qty_base,
                max_stock_qty_base=setting.max_stock_qty_base,
                units_per_purchase_unit=sp.units_per_purchase_unit,
                rounding_rule=sp.rounding_rule,
                is_critical=is_critical,
                allow_over_max_due_to_packaging=setting.allow_over_max_due_to_packaging,
            )
        )
        suggested_qty_purchase = suggestion.suggested_qty_purchase
        suggested_qty_base = suggestion.suggested_qty_base

        delta_pct = abs(
            line.captain_final_qty_purchase - suggested_qty_purchase
        ) / max(suggested_qty_purchase, rounding_step(sp.rounding_rule))

        # Hard gates
        if (
            is_critical
            and line.captain_final_qty_purchase < suggested_qty_purchase
            and line.reason_code is None
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Critical product '{line.product_id}' under-ordered "
                    f"without reason_code"
                ),
            )
        if delta_pct > 0.20 and line.reason_code is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Line '{line.product_id}' deviates {delta_pct:.0%} "
                    f"from suggestion without reason_code"
                ),
            )

        if delta_pct > 0.20 and line.reason_code is not None:
            warnings.append(
                f"Line {line.product_id}: {delta_pct:.0%} deviation, "
                f"reason: {line.reason_code.value}"
            )

        captain_final_qty_base = (
            line.captain_final_qty_purchase * sp.units_per_purchase_unit
        )
        if sp.price_estimate_pln:
            total_value += line.captain_final_qty_purchase * sp.price_estimate_pln

        order_lines.append(
            OrderLine(
                order_line_id=f"OL-{order_id}-{idx:03d}",
                order_id=order_id,
                product_id=line.product_id,
                supplier_product_id=line.supplier_product_id,
                current_stock_qty_base=line.current_stock_qty_base,
                target_stock_qty_base=setting.target_stock_qty_base,
                suggested_qty_base=suggested_qty_base,
                suggested_qty_purchase=suggested_qty_purchase,
                captain_final_qty_purchase=line.captain_final_qty_purchase,
                captain_final_qty_base=captain_final_qty_base,
                delta_vs_suggestion_pct=delta_pct,
                reason_code=line.reason_code,
                captain_comment=line.captain_comment,
            )
        )

    order = Order(
        order_id=order_id,
        location_id=location_id,
        supplier_id=req.supplier_id,
        order_date=today,
        requested_delivery_date=req.requested_delivery_date,
        status=OrderStatus.CAPTAIN_SUBMITTED,
        captain_user=location_id,  # proxy — no individual identity in v0
        captain_submitted_at=datetime.now(timezone.utc),
        total_value_estimate_pln=round(total_value, 2),
        notes=req.notes,
    )

    persisted = _persist_order(backend, order, order_lines)
    if not persisted:
        warnings.append(
            "Order was not persisted (read-only backend) — data is in-memory only."
        )

    return CaptainSubmitResponse(
        order_id=order_id,
        status=order.status,
        line_count=len(order_lines),
        total_value_estimate_pln=round(total_value, 2),
        warnings=warnings,
    )


# ---------- Manager Dispatch (auth required) ----------

_DEVIATION_THRESHOLD = 0.20  # matches captain_submit validation


def _deviation_threshold() -> float:
    return _DEVIATION_THRESHOLD


# Weekday tokens we accept in supplier.delivery_days. English + Polish abbrev.
# Order matters for matching (case-insensitive); we keep map values as ints.
WEEKDAY_MAP: dict[str, int] = {
    "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
    "pon": 0, "wt": 1, "śr": 2, "sr": 2, "czw": 3, "pt": 4, "sob": 5, "nd": 6, "niedz": 6,
}

_WARSAW_TZ = ZoneInfo("Europe/Warsaw")


def _parse_cutoff_time(raw: Optional[str]) -> Optional[tuple[int, int]]:
    """Parse 'HH:MM' (or 'H:MM') -> (hour, minute). Returns None on bad input."""
    if not raw:
        return None
    raw = raw.strip()
    if ":" not in raw:
        return None
    try:
        hh, mm = raw.split(":", 1)
        h = int(hh)
        m = int(mm)
    except (ValueError, TypeError):
        return None
    if not (0 <= h <= 23 and 0 <= m <= 59):
        return None
    return h, m


def _parse_weekdays(raw: Optional[str]) -> Optional[list[int]]:
    """Parse supplier.delivery_days into a sorted list of weekday ints (0=Mon).

    Accepts 'Tue', 'Mon, Wed, Fri', 'daily', 'codziennie'. Returns None when
    unparseable (which makes the cutoff fall back to None).
    """
    if not raw:
        return None
    s = raw.strip().lower()
    if not s:
        return None
    if s in {"daily", "codziennie", "everyday", "every day"}:
        return [0, 1, 2, 3, 4, 5, 6]

    tokens = [t.strip() for t in s.replace(";", ",").split(",") if t.strip()]
    if not tokens:
        return None
    out: set[int] = set()
    for tok in tokens:
        # Try direct lookup, then short prefix (e.g. "tuesday" -> "tue").
        if tok in WEEKDAY_MAP:
            out.add(WEEKDAY_MAP[tok])
            continue
        if tok[:3] in WEEKDAY_MAP:
            out.add(WEEKDAY_MAP[tok[:3]])
            continue
        if tok[:2] in WEEKDAY_MAP:
            out.add(WEEKDAY_MAP[tok[:2]])
            continue
        # Unknown token — bail out; we don't want a partially-correct cutoff.
        return None
    return sorted(out)


def _compute_next_cutoff(supplier: Supplier, now_utc: datetime) -> Optional[datetime]:
    """Next delivery-day cutoff for ``supplier`` in Europe/Warsaw time.

    Returns a timezone-aware ``datetime`` in UTC, or ``None`` when either
    ``delivery_days`` or ``cutoff_time`` is missing/unparseable.
    """
    hm = _parse_cutoff_time(supplier.cutoff_time)
    weekdays = _parse_weekdays(supplier.delivery_days)
    if hm is None or not weekdays:
        return None
    hour, minute = hm

    now_local = now_utc.astimezone(_WARSAW_TZ)
    # Search the next 8 days (covers "daily" + any week pattern).
    for delta in range(0, 8):
        cand = (now_local + timedelta(days=delta)).replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )
        if cand.weekday() not in weekdays:
            continue
        if cand <= now_local:
            continue
        return cand.astimezone(timezone.utc)
    return None


@app.get("/api/manager/queue", response_model=list[ManagerQueueItem])
def manager_queue(
    location_id: Optional[str] = None,
    status: OrderStatus = OrderStatus.CAPTAIN_SUBMITTED,
    _: None = Depends(require_manager),
):
    """List orders matching ``status`` (default captain_submitted), optionally
    filtered by ``location_id``.

    Seed backend cannot serve this — orders live only in the Sheet. In that
    mode we return an empty list and log a warning so the Manager dashboard
    degrades gracefully instead of erroring out.
    """
    backend = _choose_backend()
    if backend is not sheets:
        log.warning(
            "manager_queue called against read-only seed backend — "
            "returning [] (orders are not persisted in seed mode)"
        )
        return []

    orders = backend.load_orders()
    filtered = [
        o for o in orders
        if o.status == status
        and (location_id is None or o.location_id == location_id)
    ]
    if not filtered:
        return []

    all_lines = backend.load_order_lines()
    lines_by_order: dict[str, list[OrderLine]] = {}
    for line in all_lines:
        lines_by_order.setdefault(line.order_id, []).append(line)

    suppliers_by_id = {s.supplier_id: s for s in backend.load_suppliers()}
    now_utc = datetime.now(timezone.utc)
    threshold = _deviation_threshold()

    items: list[ManagerQueueItem] = []
    for order in filtered:
        supplier = suppliers_by_id.get(order.supplier_id)
        supplier_name = supplier.supplier_name if supplier else order.supplier_id
        lines = lines_by_order.get(order.order_id, [])

        deviation_count = sum(
            1 for line in lines
            if abs(line.delta_vs_suggestion_pct or 0.0) >= threshold
        )
        reason_count = sum(1 for line in lines if line.reason_code is not None)

        cutoff_iso = _compute_next_cutoff(supplier, now_utc) if supplier else None

        items.append(
            ManagerQueueItem(
                order_id=order.order_id,
                location_id=order.location_id,
                supplier_id=order.supplier_id,
                supplier_name=supplier_name,
                order_date=order.order_date,
                requested_delivery_date=order.requested_delivery_date,
                status=order.status,
                captain_user=order.captain_user,
                captain_submitted_at=order.captain_submitted_at,
                line_count=len(lines),
                total_value_estimate_pln=order.total_value_estimate_pln,
                deviation_count=deviation_count,
                reason_count=reason_count,
                last_edited_at=order.last_edited_at,
                cutoff_iso=cutoff_iso,
            )
        )

    # Sort: pending queues by earliest deadline first; sent queues by most
    # recently dispatched first.
    _FAR_FUTURE = datetime.max.replace(tzinfo=timezone.utc)
    _EPOCH = datetime.min.replace(tzinfo=timezone.utc)
    if status == OrderStatus.CAPTAIN_SUBMITTED:
        items.sort(
            key=lambda it: (
                it.cutoff_iso or _FAR_FUTURE,
                -(it.captain_submitted_at.timestamp()
                  if it.captain_submitted_at else 0.0),
            )
        )
    elif status == OrderStatus.MANAGER_SENT:
        # Manager_sent ordering uses captain_submitted_at as proxy since the
        # queue model doesn't carry manager_sent_at; the dashboard pulls
        # full detail via /order/{id} when it needs the sent timestamp.
        items.sort(
            key=lambda it: -(it.captain_submitted_at.timestamp()
                             if it.captain_submitted_at else 0.0)
        )
    return items


@app.get("/api/manager/order/{order_id}", response_model=ManagerOrderDetail)
def manager_order_detail(
    order_id: str,
    _: None = Depends(require_manager),
):
    """Single order with all enriched line details. 404 if not found."""
    backend = _choose_backend()
    if backend is not sheets:
        raise HTTPException(
            status_code=503,
            detail="Order details require SUPPLY_OS_DATA_BACKEND=sheet",
        )

    order = backend.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")

    products_by_id = {p.product_id: p for p in backend.load_products()}
    sps_by_id = {sp.supplier_product_id: sp for sp in backend.load_supplier_products()}
    suppliers_by_id = {s.supplier_id: s for s in backend.load_suppliers()}
    locations_by_id = {loc.location_id: loc for loc in backend.load_locations()}

    supplier = suppliers_by_id.get(order.supplier_id)
    location = locations_by_id.get(order.location_id)

    enriched_lines: list[ManagerOrderLineDetail] = []
    for line in order.lines:
        product = products_by_id.get(line.product_id)
        sp = sps_by_id.get(line.supplier_product_id)
        enriched_lines.append(
            ManagerOrderLineDetail(
                order_line_id=line.order_line_id,
                product_id=line.product_id,
                product_name_pl=product.product_name_pl if product else line.product_id,
                inventory_unit=product.inventory_unit if product else "",
                is_critical=bool(product.is_critical) if product else False,
                supplier_product_id=line.supplier_product_id,
                supplier_product_name=(
                    sp.supplier_product_name if sp else line.supplier_product_id
                ),
                purchase_unit=sp.purchase_unit if sp else "",
                units_per_purchase_unit=sp.units_per_purchase_unit if sp else 1.0,
                rounding_rule=sp.rounding_rule if sp else RoundingRule.FULL_ONLY,
                price_estimate_pln=sp.price_estimate_pln if sp else None,
                current_stock_qty_base=line.current_stock_qty_base,
                target_stock_qty_base=line.target_stock_qty_base,
                suggested_qty_base=line.suggested_qty_base,
                suggested_qty_purchase=line.suggested_qty_purchase,
                captain_final_qty_purchase=line.captain_final_qty_purchase,
                captain_final_qty_base=line.captain_final_qty_base,
                manager_final_qty_purchase=line.manager_final_qty_purchase,
                manager_final_qty_base=line.manager_final_qty_base,
                delta_vs_suggestion_pct=line.delta_vs_suggestion_pct,
                reason_code=line.reason_code,
                captain_comment=line.captain_comment,
                manager_comment=line.manager_comment,
            )
        )

    return ManagerOrderDetail(
        order_id=order.order_id,
        location_id=order.location_id,
        location_name=location.location_name if location else order.location_id,
        supplier_id=order.supplier_id,
        supplier_name=supplier.supplier_name if supplier else order.supplier_id,
        supplier_email=supplier.email if supplier else None,
        ordering_method=supplier.ordering_method if supplier else OrderingMethod.EMAIL,
        supplier_notes=supplier.notes if supplier else "",
        order_date=order.order_date,
        requested_delivery_date=order.requested_delivery_date,
        status=order.status,
        captain_user=order.captain_user,
        captain_submitted_at=order.captain_submitted_at,
        manager_user=order.manager_user,
        manager_sent_at=order.manager_sent_at,
        total_value_estimate_pln=order.total_value_estimate_pln,
        notes=order.notes,
        lines=enriched_lines,
    )


# ---------- Captain own-orders view + edit (Phase E3) ----------


def _enrich_lines_for_detail(
    lines: list[OrderLine],
    products_by_id: dict[str, Product],
    sps_by_id: dict[str, SupplierProduct],
) -> list[ManagerOrderLineDetail]:
    """Shared helper — turn OrderLine rows into ManagerOrderLineDetail with joins."""
    enriched: list[ManagerOrderLineDetail] = []
    for line in lines:
        product = products_by_id.get(line.product_id)
        sp = sps_by_id.get(line.supplier_product_id)
        enriched.append(
            ManagerOrderLineDetail(
                order_line_id=line.order_line_id,
                product_id=line.product_id,
                product_name_pl=product.product_name_pl if product else line.product_id,
                inventory_unit=product.inventory_unit if product else "",
                is_critical=bool(product.is_critical) if product else False,
                supplier_product_id=line.supplier_product_id,
                supplier_product_name=(
                    sp.supplier_product_name if sp else line.supplier_product_id
                ),
                purchase_unit=sp.purchase_unit if sp else "",
                units_per_purchase_unit=sp.units_per_purchase_unit if sp else 1.0,
                rounding_rule=sp.rounding_rule if sp else RoundingRule.FULL_ONLY,
                price_estimate_pln=sp.price_estimate_pln if sp else None,
                current_stock_qty_base=line.current_stock_qty_base,
                target_stock_qty_base=line.target_stock_qty_base,
                suggested_qty_base=line.suggested_qty_base,
                suggested_qty_purchase=line.suggested_qty_purchase,
                captain_final_qty_purchase=line.captain_final_qty_purchase,
                captain_final_qty_base=line.captain_final_qty_base,
                manager_final_qty_purchase=line.manager_final_qty_purchase,
                manager_final_qty_base=line.manager_final_qty_base,
                delta_vs_suggestion_pct=line.delta_vs_suggestion_pct,
                reason_code=line.reason_code,
                manager_comment=line.manager_comment,
                captain_comment=line.captain_comment,
            )
        )
    return enriched


@app.get("/api/captain/orders", response_model=list[CaptainOrderListItem])
def captain_orders(
    status: Optional[OrderStatus] = None,
    limit: int = 20,
    location_id: str = Depends(require_captain),
):
    """Return the most-recent N orders for this Captain's location.

    Filtering:
      - `status` (optional) — narrow to captain_submitted / manager_sent / etc.
      - `limit` — capped at 100 to keep list view manageable.

    The Captain's location is derived from the bearer token; cross-location
    listing is not permitted in v0.
    """
    limit = max(1, min(limit, 100))
    backend = _choose_backend()
    if backend is not sheets:
        return []

    orders = backend.load_orders()
    filtered = [
        o for o in orders
        if o.location_id == location_id
        and (status is None or o.status == status)
    ]
    if not filtered:
        return []

    # Most-recently-submitted first.
    filtered.sort(
        key=lambda o: o.captain_submitted_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    filtered = filtered[:limit]

    all_lines = backend.load_order_lines()
    lines_by_order: dict[str, list[OrderLine]] = {}
    for line in all_lines:
        lines_by_order.setdefault(line.order_id, []).append(line)

    suppliers_by_id = {s.supplier_id: s for s in backend.load_suppliers()}
    threshold = _deviation_threshold()

    items: list[CaptainOrderListItem] = []
    for order in filtered:
        supplier = suppliers_by_id.get(order.supplier_id)
        supplier_name = supplier.supplier_name if supplier else order.supplier_id
        lines = lines_by_order.get(order.order_id, [])
        deviation_count = sum(
            1 for line in lines
            if abs(line.delta_vs_suggestion_pct or 0.0) >= threshold
        )
        reason_count = sum(1 for line in lines if line.reason_code is not None)
        items.append(
            CaptainOrderListItem(
                order_id=order.order_id,
                supplier_id=order.supplier_id,
                supplier_name=supplier_name,
                order_date=order.order_date,
                requested_delivery_date=order.requested_delivery_date,
                status=order.status,
                captain_submitted_at=order.captain_submitted_at,
                last_edited_at=order.last_edited_at,
                line_count=len(lines),
                deviation_count=deviation_count,
                reason_count=reason_count,
                total_value_estimate_pln=order.total_value_estimate_pln,
                editable=(order.status == OrderStatus.CAPTAIN_SUBMITTED),
            )
        )
    return items


@app.get("/api/captain/order/{order_id}", response_model=CaptainOrderDetail)
def captain_order_detail(
    order_id: str,
    location_id: str = Depends(require_captain),
):
    """Single order with enriched line details for the Captain.

    Strict location scope: returns 404 if the order doesn't exist OR belongs
    to a different location. We don't differentiate the two on purpose — the
    Captain has no business knowing whether other locations have order ids.
    """
    backend = _choose_backend()
    if backend is not sheets:
        raise HTTPException(
            status_code=503,
            detail="Order details require SUPPLY_OS_DATA_BACKEND=sheet",
        )
    order = backend.get_order(order_id)
    if order is None or order.location_id != location_id:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")

    products_by_id = {p.product_id: p for p in backend.load_products()}
    sps_by_id = {sp.supplier_product_id: sp for sp in backend.load_supplier_products()}
    suppliers_by_id = {s.supplier_id: s for s in backend.load_suppliers()}
    locations_by_id = {loc.location_id: loc for loc in backend.load_locations()}

    supplier = suppliers_by_id.get(order.supplier_id)
    location = locations_by_id.get(order.location_id)
    enriched_lines = _enrich_lines_for_detail(order.lines, products_by_id, sps_by_id)

    return CaptainOrderDetail(
        order_id=order.order_id,
        location_id=order.location_id,
        location_name=location.location_name if location else order.location_id,
        supplier_id=order.supplier_id,
        supplier_name=supplier.supplier_name if supplier else order.supplier_id,
        order_date=order.order_date,
        requested_delivery_date=order.requested_delivery_date,
        status=order.status,
        captain_user=order.captain_user,
        captain_submitted_at=order.captain_submitted_at,
        last_edited_at=order.last_edited_at,
        total_value_estimate_pln=order.total_value_estimate_pln,
        notes=order.notes,
        editable=(order.status == OrderStatus.CAPTAIN_SUBMITTED),
        lines=enriched_lines,
    )


@app.patch("/api/captain/order/{order_id}", response_model=CaptainEditResponse)
def captain_order_edit(
    order_id: str,
    req: CaptainEditRequest,
    location_id: str = Depends(require_captain),
):
    """Edit an existing captain_submitted order — replaces the full line set.

    Hard gates:
      - Order must exist AND belong to this Captain's location → 404 otherwise.
      - Order status MUST be captain_submitted (i.e., manager hasn't started).
        Any other status → 409 Conflict, message tells the user to contact the
        manager.
      - Same line-level validation as POST /api/captain/submit (critical zero
        requires reason, >20% deviation requires reason, supplier_product
        orderable here, etc.).

    On success:
      - Existing order_lines rows are deleted from the sheet.
      - New computed lines are appended.
      - The order row is updated (total_value_estimate_pln,
        requested_delivery_date, notes). `captain_submitted_at` is preserved —
        it represents the original submission moment, not the last edit.
      - Status stays captain_submitted.

    Race-window defense: the 409 check below forces a cache invalidation +
    re-read before the destructive write. Without it, the default 60s TTL
    on `load_orders` would let a captain edit overwrite an order the manager
    just dispatched.
    """
    backend = _choose_backend()
    if backend is not sheets:
        raise HTTPException(
            status_code=503,
            detail="Order edit requires SUPPLY_OS_DATA_BACKEND=sheet",
        )

    # Force a fresh read so we don't trust a stale TTL snapshot here. This
    # window is the only place where a captain can corrupt a manager-dispatched
    # order, so we pay one extra Sheets read to close it.
    backend.invalidate_cache("orders")
    existing = backend.get_order(order_id)
    if existing is None or existing.location_id != location_id:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    if existing.status != OrderStatus.CAPTAIN_SUBMITTED:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Order {order_id} is in status '{existing.status.value}' and "
                f"can no longer be edited by the captain. "
                f"Skontaktuj się z menedżerem."
            ),
        )

    master = _resolve_master_data(backend, location_id, existing.supplier_id)

    new_lines: list[OrderLine] = []
    warnings: list[str] = []
    total_value = 0.0

    for idx, line in enumerate(req.lines, start=1):
        sp = master.sps_by_id.get(line.supplier_product_id)
        if sp is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"supplier_product '{line.supplier_product_id}' not "
                    f"orderable at this location"
                ),
            )
        product = master.products_by_id.get(line.product_id)
        if product is None:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown product_id '{line.product_id}'",
            )
        setting = master.settings_by_pid.get(line.product_id)
        if setting is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"product '{line.product_id}' has no location_product_setting"
                    f" at this location"
                ),
            )
        if sp.product_id != line.product_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"supplier_product '{line.supplier_product_id}' does not "
                    f"map to product '{line.product_id}'"
                ),
            )

        is_critical = setting.is_critical_for_location or product.is_critical
        suggestion = compute_suggestion(
            SuggestionInput(
                current_stock_qty_base=line.current_stock_qty_base,
                target_stock_qty_base=setting.target_stock_qty_base,
                max_stock_qty_base=setting.max_stock_qty_base,
                units_per_purchase_unit=sp.units_per_purchase_unit,
                rounding_rule=sp.rounding_rule,
                is_critical=is_critical,
                allow_over_max_due_to_packaging=setting.allow_over_max_due_to_packaging,
            )
        )
        suggested_qty_purchase = suggestion.suggested_qty_purchase
        suggested_qty_base = suggestion.suggested_qty_base
        delta_pct = abs(
            line.captain_final_qty_purchase - suggested_qty_purchase
        ) / max(suggested_qty_purchase, rounding_step(sp.rounding_rule))

        if (
            is_critical
            and line.captain_final_qty_purchase < suggested_qty_purchase
            and line.reason_code is None
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Critical product '{line.product_id}' under-ordered "
                    f"without reason_code"
                ),
            )
        if delta_pct > 0.20 and line.reason_code is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Line '{line.product_id}' deviates {delta_pct:.0%} "
                    f"from suggestion without reason_code"
                ),
            )
        if delta_pct > 0.20 and line.reason_code is not None:
            warnings.append(
                f"Line {line.product_id}: {delta_pct:.0%} deviation, "
                f"reason: {line.reason_code.value}"
            )

        captain_final_qty_base = (
            line.captain_final_qty_purchase * sp.units_per_purchase_unit
        )
        if sp.price_estimate_pln:
            total_value += line.captain_final_qty_purchase * sp.price_estimate_pln

        new_lines.append(
            OrderLine(
                order_line_id=f"OL-{order_id}-{idx:03d}",
                order_id=order_id,
                product_id=line.product_id,
                supplier_product_id=line.supplier_product_id,
                current_stock_qty_base=line.current_stock_qty_base,
                target_stock_qty_base=setting.target_stock_qty_base,
                suggested_qty_base=suggested_qty_base,
                suggested_qty_purchase=suggested_qty_purchase,
                captain_final_qty_purchase=line.captain_final_qty_purchase,
                captain_final_qty_base=captain_final_qty_base,
                delta_vs_suggestion_pct=delta_pct,
                reason_code=line.reason_code,
                captain_comment=line.captain_comment,
            )
        )

    total_value_rounded = round(total_value, 2)

    # Sheets: replace the line set atomically-ish. We accept a brief window
    # where a concurrent manager queue read could see 0 lines; the cache
    # invalidation + status re-read above closes the longer race, but the
    # actual write sequence is still non-transactional. v0 trade-off.
    #
    # Preserve `captain_submitted_at` on edit — it represents the ORIGINAL
    # submission moment for sort + audit; resetting it on every edit was a
    # silent regression caught in code review (B-H3).
    backend.delete_order_lines(order_id)
    if new_lines:
        backend.append_order_lines(new_lines)
    backend.update_order(
        order_id,
        total_value_estimate_pln=total_value_rounded,
        requested_delivery_date=req.requested_delivery_date or existing.requested_delivery_date,
        notes=req.notes,
        # Stamp the edit time so captain + manager can see this order was
        # corrected and when (captain_submitted_at stays = original submit).
        last_edited_at=datetime.now(timezone.utc),
    )

    return CaptainEditResponse(
        order_id=order_id,
        status=OrderStatus.CAPTAIN_SUBMITTED,
        line_count=len(new_lines),
        total_value_estimate_pln=total_value_rounded,
        warnings=warnings,
    )


# ---------- Manager claim / release (Phase F1) ----------


@app.post("/api/manager/claim/{order_id}", response_model=ManagerClaimResponse)
def manager_claim(
    order_id: str,
    _: None = Depends(require_manager),
):
    """Manager takes over an order (manual cut-off).

    captain_submitted → manager_claimed. After this the captain can no longer
    edit (the PATCH gate requires captain_submitted); the manager reviews /
    adjusts, then either dispatches (Zamów) or releases back (Odrzuć do poprawy).

    Forces a fresh read before the transition so a stale TTL snapshot can't let
    two managers claim, or claim an already-dispatched order.
    """
    backend = _choose_backend()
    if backend is not sheets:
        raise HTTPException(
            status_code=503,
            detail="Claim requires SUPPLY_OS_DATA_BACKEND=sheet",
        )

    backend.invalidate_cache("orders")
    order = backend.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    if order.status != OrderStatus.CAPTAIN_SUBMITTED:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Order {order_id} status is {order.status.value}, "
                f"expected captain_submitted (cannot claim)"
            ),
        )

    backend.update_order(order_id, status=OrderStatus.MANAGER_CLAIMED.value)
    return ManagerClaimResponse(
        order_id=order_id, status=OrderStatus.MANAGER_CLAIMED
    )


@app.post("/api/manager/release/{order_id}", response_model=ManagerReleaseResponse)
def manager_release(
    order_id: str,
    req: ManagerReleaseRequest,
    _: None = Depends(require_manager),
):
    """Send a claimed order back to the captain for corrections (Odrzuć do poprawy).

    manager_claimed → captain_submitted. The `reason` is stored in the order's
    `notes` so the captain sees a 'send-back' banner; it is cleared when the
    captain resubmits (PATCH sets notes). Only valid from manager_claimed.
    """
    backend = _choose_backend()
    if backend is not sheets:
        raise HTTPException(
            status_code=503,
            detail="Release requires SUPPLY_OS_DATA_BACKEND=sheet",
        )

    backend.invalidate_cache("orders")
    order = backend.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    if order.status != OrderStatus.MANAGER_CLAIMED:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Order {order_id} status is {order.status.value}, "
                f"expected manager_claimed (cannot release)"
            ),
        )

    backend.update_order(
        order_id,
        status=OrderStatus.CAPTAIN_SUBMITTED.value,
        notes=req.reason.strip(),
    )
    return ManagerReleaseResponse(
        order_id=order_id, status=OrderStatus.CAPTAIN_SUBMITTED
    )


@app.post("/api/manager/dispatch", response_model=ManagerDispatchResponse)
def manager_dispatch(
    req: ManagerDispatchRequest,
    _: None = Depends(require_manager),
):
    """Apply manager_final quantities, mark the order manager_sent, and return
    a Gmail compose URL for the supplier.

    Sheet backend only — seed mode cannot persist the state transition. Writes
    are ordered: line updates first, then the order status row, so a crash
    mid-way leaves the order in captain_submitted (not in a torn state).
    """
    backend = _choose_backend()
    if backend is not sheets:
        raise HTTPException(
            status_code=503,
            detail="Dispatch requires SUPPLY_OS_DATA_BACKEND=sheet",
        )

    backend.invalidate_cache("orders")
    order = backend.get_order(req.order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order {req.order_id} not found")
    if order.status != OrderStatus.MANAGER_CLAIMED:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Order {req.order_id} status is {order.status.value}, "
                f"expected manager_claimed (claim it first via /api/manager/claim)"
            ),
        )

    suppliers_by_id = {s.supplier_id: s for s in backend.load_suppliers()}
    supplier = suppliers_by_id.get(order.supplier_id)
    if supplier is None:
        raise HTTPException(
            status_code=500,
            detail=f"Supplier {order.supplier_id} not in master data",
        )
    # Channel-aware: only the email channel requires/builds a Gmail URL. Portal,
    # phone and manual suppliers "mark ordered" — they record the transition +
    # sent_method but have no email artifact. Branch on the supplier's
    # ordering_method (source of truth), never on the request's sent_method.
    is_email_channel = supplier.ordering_method == OrderingMethod.EMAIL
    if is_email_channel and not supplier.email:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Supplier {supplier.supplier_id} has no email - "
                f"cannot dispatch via Gmail"
            ),
        )

    locations_by_id = {loc.location_id: loc for loc in backend.load_locations()}
    location = locations_by_id.get(order.location_id)

    products_by_id = {p.product_id: p for p in backend.load_products()}
    sps_by_id = {sp.supplier_product_id: sp for sp in backend.load_supplier_products()}

    # Map order_line_id -> manager_final payload from request.
    finals_by_line_id = {f.order_line_id: f for f in req.manager_finals}

    # Build line_updates dict + enriched lines + total in one pass.
    line_updates: dict[str, dict] = {}
    enriched_lines: list[OrderLine] = []
    total = 0.0

    for original_line in order.lines:
        final = finals_by_line_id.get(original_line.order_line_id)
        sp = sps_by_id.get(original_line.supplier_product_id)
        units_per_pu = sp.units_per_purchase_unit if sp else 1.0

        if final is not None:
            manager_qty_purchase = final.manager_final_qty_purchase
            manager_comment = final.manager_comment
        else:
            # No manager change for this line — keep captain's qty as final.
            manager_qty_purchase = original_line.captain_final_qty_purchase
            manager_comment = original_line.manager_comment

        manager_qty_base = manager_qty_purchase * units_per_pu

        if final is not None:
            line_updates[original_line.order_line_id] = {
                "manager_final_qty_purchase": manager_qty_purchase,
                "manager_final_qty_base": manager_qty_base,
                "manager_comment": manager_comment,
            }

        if sp and sp.price_estimate_pln:
            total += manager_qty_purchase * sp.price_estimate_pln

        enriched_lines.append(
            original_line.model_copy(
                update={
                    "manager_final_qty_purchase": manager_qty_purchase,
                    "manager_final_qty_base": manager_qty_base,
                    "manager_comment": manager_comment,
                }
            )
        )

    # Email channel: build the Gmail URL FIRST so we never persist manager_sent
    # without a usable URL. Non-email channels skip this entirely (url stays None).
    url: Optional[str] = None
    if is_email_channel:
        try:
            url = gmail_url.build_draft_url(
                order=order.model_copy(update={"total_value_estimate_pln": round(total, 2)}),
                supplier=supplier,
                lines=enriched_lines,
                products_by_id={**products_by_id, **sps_by_id},
                location=location,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Gmail URL build failed: {e}")

    # Persist: lines first, then order status. Order matters: if status write
    # fails after lines write, retry is safe (lines are idempotent overwrites).
    if line_updates:
        backend.update_order_lines(req.order_id, line_updates)

    try:
        backend.update_order(
            req.order_id,
            status=OrderStatus.MANAGER_SENT.value,
            manager_user="manager-default",  # proxy until real Manager auth
            manager_sent_at=datetime.now(timezone.utc).isoformat(),
            sent_method=req.sent_method,
            total_value_estimate_pln=round(total, 2),
        )
    except sheets.OrderAlreadyDispatchedError:
        raise HTTPException(
            status_code=409,
            detail=f"Order {req.order_id} was already dispatched concurrently",
        )

    return ManagerDispatchResponse(
        order_id=req.order_id,
        status=OrderStatus.MANAGER_SENT,
        gmail_compose_url=url,
        supplier_email=supplier.email,
        total_value_estimate_pln=round(total, 2),
    )


# ---------- Manager save-without-dispatch (Phase G2) ----------


@app.patch("/api/manager/order/{order_id}", response_model=ManagerSaveResponse)
def manager_order_save(
    order_id: str,
    req: ManagerSaveRequest,
    _: None = Depends(require_manager),
):
    """Persist manager edits (manager_final qty + comment) WITHOUT dispatching.

    The operator reviews/changes a claimed order and saves; the status STAYS
    manager_claimed so the order can be revisited and finally dispatched later.

    Read-modify-write contract (prevents comment data loss): the UI MUST send
    the full current `manager_final_qty_purchase` AND `manager_comment` for every
    touched line. The backend overwrites `manager_comment` with whatever the
    payload carries, so a qty-only payload would silently wipe a previously-saved
    comment — the frontend is the single read-modify-write owner.

    Concurrency: this endpoint does NOT inherit dispatch's guard
    (`update_order_lines` has no status check; `update_order`'s
    `OrderAlreadyDispatchedError` fires only on a manager_sent transition). So we
    run our own preflight: invalidate the cache, re-read, and 409 if the order is
    no longer `manager_claimed` (e.g. a concurrent dispatch already sent it, or it
    was released back to the captain). A narrow TOCTOU window remains — Sheets has
    no row lock — and is accepted in v0.

    Empty `manager_finals` = no-op: no write, returns the current stored total.
    """
    backend = _choose_backend()
    if backend is not sheets:
        raise HTTPException(
            status_code=503,
            detail="Save requires SUPPLY_OS_DATA_BACKEND=sheet",
        )

    # Own preflight (see docstring): fresh read + status gate before any write.
    backend.invalidate_cache("orders")
    order = backend.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    if order.status != OrderStatus.MANAGER_CLAIMED:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Order {order_id} status is {order.status.value}, "
                f"expected manager_claimed (it may have been dispatched or "
                f"released — refresh the queue)"
            ),
        )

    sps_by_id = {sp.supplier_product_id: sp for sp in backend.load_supplier_products()}
    finals_by_line_id = {f.order_line_id: f for f in req.manager_finals}

    # Build line updates for touched lines; recompute total over ALL lines using
    # the effective qty (this save's value if touched, else the saved
    # manager_final if >0, else captain_final — mirrors dispatch / _effective_qty).
    line_updates: dict[str, dict] = {}
    total = 0.0
    for original_line in order.lines:
        final = finals_by_line_id.get(original_line.order_line_id)
        sp = sps_by_id.get(original_line.supplier_product_id)
        units_per_pu = sp.units_per_purchase_unit if sp else 1.0

        if final is not None:
            qty_purchase = final.manager_final_qty_purchase
            line_updates[original_line.order_line_id] = {
                "manager_final_qty_purchase": qty_purchase,
                "manager_final_qty_base": qty_purchase * units_per_pu,
                "manager_comment": final.manager_comment,
            }
        elif original_line.manager_final_qty_purchase > 0:
            qty_purchase = original_line.manager_final_qty_purchase
        else:
            qty_purchase = original_line.captain_final_qty_purchase

        if sp and sp.price_estimate_pln:
            total += qty_purchase * sp.price_estimate_pln

    total_rounded = round(total, 2)

    # Empty payload → no write (pure no-op); status stays manager_claimed.
    if line_updates:
        backend.update_order_lines(order_id, line_updates)
        # Persist the recomputed total only; never pass `status`, so the order
        # stays manager_claimed (no dispatch).
        backend.update_order(order_id, total_value_estimate_pln=total_rounded)

    return ManagerSaveResponse(
        order_id=order_id,
        status=OrderStatus.MANAGER_CLAIMED,
        lines_updated=len(line_updates),
        total_value_estimate_pln=total_rounded,
    )


# ---------- Captain inventory count (S-06) ----------


def _generate_count_id(location_id: str, today: date) -> str:
    """INV-YYYYMMDD-<LOC3>-<6hex> (mirrors `_generate_order_id`)."""
    loc = (location_id or "XXX")[:3].upper()
    rand = secrets.token_hex(3)
    return f"INV-{today.strftime('%Y%m%d')}-{loc}-{rand}"


def _persist_inventory_count(
    backend,
    count: InventoryCount,
    lines: list[InventoryCountLine],
) -> bool:
    """Write count + lines to backend. Returns True on persistent write, False
    on in-memory-only fallback (seed backend). Mirrors `_persist_order`: the
    append is sheet-only; the read-only seed backend has no
    `append_inventory_count*`, so we degrade to a warning instead of erroring."""
    appender = getattr(backend, "append_inventory_count", None)
    lines_appender = getattr(backend, "append_inventory_count_lines", None)
    if appender is None or lines_appender is None:
        log.warning(
            "Inventory count %s submitted to read-only backend %s — not persisted",
            count.count_id,
            getattr(backend, "__name__", "?"),
        )
        return False
    try:
        appender(count)
        lines_appender(lines)
    except NotImplementedError:
        log.warning(
            "Inventory count %s — backend %s raised NotImplementedError on write",
            count.count_id,
            getattr(backend, "__name__", "?"),
        )
        return False
    return True


@app.get(
    "/api/captain/inventory/products",
    response_model=list[InventoryProduct],
)
def captain_inventory_products(
    location_id: str = Depends(require_captain),
):
    """Active products configured for this Captain's location — the one-pass
    inventory-count list (FR-015).

    Location-wide (not per-supplier); the location is derived from the
    authenticated Captain's token, so cross-location access is not permitted in
    v0. Mirrors `captain_orderable` but spans every supplier's products at the
    location. Discontinued SKUs (`active = False`) are skipped — a location-wide
    list would otherwise surface products the per-supplier order screen never
    showed.
    """
    products_by_id = {p.product_id: p for p in seed_loader.load_products()}
    items: list[InventoryProduct] = []
    for setting in seed_loader.load_location_product_settings():
        if setting.location_id != location_id:
            continue
        product = products_by_id.get(setting.product_id)
        if product is None or not product.active:
            continue
        items.append(
            InventoryProduct(
                product_id=product.product_id,
                product_name_pl=product.product_name_pl,
                product_category=product.product_category,
                inventory_unit=product.inventory_unit,
                is_critical=setting.is_critical_for_location or product.is_critical,
            )
        )
    return items


@app.post(
    "/api/captain/inventory/submit",
    response_model=InventoryCountSubmitResponse,
)
def captain_inventory_submit(
    req: InventoryCountSubmitRequest,
    location_id: str = Depends(require_captain),
):
    """Validate + persist a Captain location-wide inventory snapshot (FR-016).

    Append-only: every submit creates a new `count_id` (no upsert/edit). A line
    is created only for a product the Captain actually entered — blank = not
    counted (`0 ≠ unknown`); the frontend omits untouched products from the
    request. Persistence is sheet-only via `_persist_inventory_count`; seed mode
    keeps it in-memory and surfaces a warning, mirroring `captain_submit`.

    Validation (deterministic):
      - every line's product_id must exist in master data → 400 otherwise.
      - every line's product must have a `location_product_setting` at this
        Captain's location → 400 otherwise.
    """
    backend = _choose_backend()
    products_by_id = {p.product_id: p for p in backend.load_products()}
    settings_by_pid = {
        s.product_id: s
        for s in backend.load_location_product_settings()
        if s.location_id == location_id
    }

    # Resolve the count date in Warsaw local time (the operator's timezone), so a
    # legitimate "today" picked just after local midnight is not rejected as a
    # future date by a UTC comparison (F3). count_date defaults to today when the
    # client omits it (FR-020); a future date is a 400.
    today_warsaw = datetime.now(_WARSAW_TZ).date()
    count_date = req.count_date or today_warsaw
    if count_date > today_warsaw:
        raise HTTPException(
            status_code=400,
            detail=f"count_date {count_date.isoformat()} is in the future",
        )
    count_id = _generate_count_id(location_id, today_warsaw)

    count_lines: list[InventoryCountLine] = []
    for idx, line in enumerate(req.lines, start=1):
        if line.product_id not in products_by_id:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown product_id '{line.product_id}'",
            )
        if line.product_id not in settings_by_pid:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"product '{line.product_id}' has no location_product_setting "
                    f"at this location"
                ),
            )
        count_lines.append(
            InventoryCountLine(
                count_line_id=f"ICL-{count_id}-{idx:03d}",
                count_id=count_id,
                product_id=line.product_id,
                current_stock_qty_base=line.current_stock_qty_base,
                count_comment=line.count_comment,
            )
        )

    count = InventoryCount(
        count_id=count_id,
        location_id=location_id,
        count_date=count_date,
        count_user=req.count_user,  # required free-text attribution (FR-021)
        count_submitted_at=datetime.now(timezone.utc),
        line_count=len(count_lines),
        notes=req.notes,
    )

    warnings: list[str] = []
    try:
        persisted = _persist_inventory_count(backend, count, count_lines)
    except sheets.WorksheetNotFound:
        # Sheet mode but the operator hasn't created the inventory tabs yet.
        # Without this catch the append raises a raw 500; surface a clear,
        # actionable 503 instead (see plan Migration Notes / F2).
        raise HTTPException(
            status_code=503,
            detail=(
                "Inventory worksheets not configured — create the "
                "'inventory_counts' and 'inventory_count_lines' tabs "
                "(see Migration Notes) before submitting."
            ),
        )
    if not persisted:
        warnings.append(
            "Inventory count was not persisted (read-only backend) — "
            "data is in-memory only."
        )

    return InventoryCountSubmitResponse(
        count_id=count_id,
        count_date=count_date,
        line_count=len(count_lines),
        warnings=warnings,
    )


@app.get(
    "/api/captain/inventory/latest",
    response_model=Optional[InventoryLatestResponse],
)
def captain_inventory_latest(
    location_id: str = Depends(require_captain),
):
    """Latest inventory snapshot for this Captain's location, for opt-in order
    pre-fill (FR-017). Returns ``None`` (HTTP 200, null body) when there is no
    snapshot — including seed mode, where snapshots are not persisted (mirrors
    ``captain_orders`` / ``manager_queue`` degrading off-sheet).

    "Latest" = newest ``count_submitted_at`` (fallback ``count_date``). The
    location is derived from the token; cross-location reads are not permitted.
    The order screen NAMES the returned date/time in its confirmation so a stale
    count can't silently enter an order (the FR-017 double safeguard).
    """
    backend = _choose_backend()
    if backend is not sheets:
        return None

    counts = [
        c for c in backend.load_inventory_counts() if c.location_id == location_id
    ]
    if not counts:
        return None

    def _recency_key(c: InventoryCount) -> datetime:
        if c.count_submitted_at is not None:
            return c.count_submitted_at
        # No submit time → fall back to the count date at UTC midnight.
        return datetime.combine(c.count_date, datetime.min.time(), tzinfo=timezone.utc)

    latest = max(counts, key=_recency_key)
    full = backend.get_inventory_count(latest.count_id)
    snapshot_lines = full.lines if full is not None else []
    lines = [
        InventoryLatestLine(
            product_id=line.product_id,
            current_stock_qty_base=line.current_stock_qty_base,
            count_comment=line.count_comment,
        )
        for line in snapshot_lines
    ]
    return InventoryLatestResponse(
        count_id=latest.count_id,
        count_date=latest.count_date,
        count_submitted_at=latest.count_submitted_at,
        count_user=latest.count_user,
        line_count=len(lines),
        lines=lines,
    )


@app.get(
    "/api/captain/inventory/counts",
    response_model=list[InventoryCountSummary],
)
def captain_inventory_counts(
    location_id: str = Depends(require_captain),
):
    """List the most-recent inventory snapshots for this Captain's location, for
    the order-screen snapshot picker (FR-024). Returns up to 10 compact summaries
    (no lines), newest `count_date` first (ties broken by `count_submitted_at`).

    Sheet-only: seed mode degrades to ``[]`` — snapshots are not persisted there
    (mirrors ``captain_inventory_latest`` / ``manager_queue`` degrading
    off-sheet). The location is derived from the token; cross-location reads are
    not permitted. Each summary's ``line_count`` is the value persisted on the
    ``inventory_counts`` row, so listing never fetches per-snapshot lines.
    """
    backend = _choose_backend()
    if backend is not sheets:
        return []

    try:
        all_counts = backend.load_inventory_counts()
    except sheets.WorksheetNotFound:
        # The picker is optional — a missing inventory tab means there are no
        # snapshots to offer, the same degraded state as seed mode. Return []
        # (empty picker, control hidden) rather than a raw 500 (impl-review F2;
        # mirrors the detail/submit routes degrading instead of erroring).
        return []

    counts = [c for c in all_counts if c.location_id == location_id]
    if not counts:
        return []

    def _recency_key(c: InventoryCount) -> tuple[date, datetime]:
        submitted = c.count_submitted_at or datetime.min.replace(tzinfo=timezone.utc)
        return (c.count_date, submitted)

    counts.sort(key=_recency_key, reverse=True)
    return [
        InventoryCountSummary(
            count_id=c.count_id,
            location_id=c.location_id,
            count_date=c.count_date,
            count_submitted_at=c.count_submitted_at,
            count_user=c.count_user,
            line_count=c.line_count,
        )
        for c in counts[:10]
    ]


@app.get(
    "/api/captain/inventory/count/{count_id}",
    response_model=InventoryLatestResponse,
)
def captain_inventory_count_detail(
    count_id: str,
    location_id: str = Depends(require_captain),
):
    """Fetch one inventory snapshot (with lines) by id, so the order screen can
    pre-fill stock from a chosen snapshot — not only the latest (FR-024). Reuses
    ``InventoryLatestResponse`` (which now carries ``count_user``).

    Sheet-only: seed mode → 503 (mirrors ``manager_order_detail``); the picker
    that calls this is only shown once snapshots exist. Strict location scope:
    404 if the count is missing OR belongs to another location — we don't
    differentiate, since the Captain has no business knowing whether other
    locations hold a given count id. A missing inventory worksheet surfaces as
    503 (mirrors the submit endpoint), never a raw 500.
    """
    backend = _choose_backend()
    if backend is not sheets:
        raise HTTPException(
            status_code=503,
            detail="Inventory snapshot detail requires SUPPLY_OS_DATA_BACKEND=sheet",
        )

    try:
        count = backend.get_inventory_count(count_id)
    except sheets.WorksheetNotFound:
        raise HTTPException(
            status_code=503,
            detail=(
                "Inventory worksheets not configured — create the "
                "'inventory_counts' and 'inventory_count_lines' tabs "
                "(see Migration Notes)."
            ),
        )
    if count is None or count.location_id != location_id:
        raise HTTPException(
            status_code=404, detail=f"Inventory count {count_id} not found"
        )

    lines = [
        InventoryLatestLine(
            product_id=line.product_id,
            current_stock_qty_base=line.current_stock_qty_base,
            count_comment=line.count_comment,
        )
        for line in count.lines
    ]
    return InventoryLatestResponse(
        count_id=count.count_id,
        count_date=count.count_date,
        count_submitted_at=count.count_submitted_at,
        count_user=count.count_user,
        line_count=len(lines),
        lines=lines,
    )
