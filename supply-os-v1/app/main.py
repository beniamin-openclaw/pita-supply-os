"""FastAPI app — Captain Submit + Manager Dispatch backend."""
import logging
import secrets
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from . import errors, gmail_url, seed_loader, sheets, supabase_backend, supabase_storage
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
    InventoryCountDetail,
    InventoryCountDetailLine,
    InventoryCountLine,
    InventoryCountManagerItem,
    InventoryCountSubmitRequest,
    InventoryCountSubmitResponse,
    InventoryCountSummary,
    InventoryLatestLine,
    InventoryLatestResponse,
    InventoryProduct,
    Location,
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
    OrderLineSubmit,
    OrderingMethod,
    OrderStatus,
    Product,
    Receipt,
    ReceiptDetail,
    ReceiptDetailLine,
    ReceiptLine,
    ReceiptPhotoItem,
    ReceiptPhotoUploadResponse,
    ReceiptSubmitRequest,
    ReceiptSubmitResponse,
    ReceiptSummary,
    RoundingRule,
    SuggestionReviewItem,
    Supplier,
    SupplierProduct,
)
from .suggestion import SuggestionInput, compute_suggestion, rounding_step

log = logging.getLogger(__name__)

@asynccontextmanager
async def _lifespan(_app: FastAPI):
    # At boot, warn if the SELECTED data backend can't be used and the app will
    # silently fall back (seed = nothing persisted). Cheap insurance against a
    # misconfigured DSN/credentials going unnoticed — notably at the S-10 cutover,
    # where a bad SUPPLY_OS_DATABASE_URL would otherwise quietly serve seed data.
    sheets.warn_if_unconfigured()
    supabase_backend.warn_if_unconfigured()
    yield


app = FastAPI(
    title="Pita Bros Supply OS",
    version="0.1.0",
    description="Captain Submit + Manager Dispatch backend (v0).",
    lifespan=_lifespan,
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
    return _choose_backend().load_products()


@app.get("/api/suppliers")
def suppliers(_actor: str = Depends(require_any_auth)):
    return _choose_backend().load_suppliers()


@app.get("/api/locations")
def locations(_actor: str = Depends(require_any_auth)):
    return _choose_backend().load_locations()


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
    is not permitted in v0.

    Reads through `_choose_backend()` so production (sheet mode) serves live
    master data. Reading `seed_loader` directly here was a production bug: the
    droplet's seed CSVs are a stale fallback, so the order screen silently
    dropped any product missing from the old `location_product_settings` snapshot
    (e.g. whole suppliers showed zero products) while sheet-backed screens were
    complete."""
    backend = _choose_backend()
    products_by_id = {p.product_id: p for p in backend.load_products()}
    settings_by_pid = {
        s.product_id: s
        for s in backend.load_location_product_settings()
        if s.location_id == location_id
    }
    sps = [
        sp
        for sp in backend.load_supplier_products()
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

    Resolution order (first selected AND configured wins): Supabase, then Sheets,
    then the seed loader as the always-available fallback (keeps tests + local dev
    working without any cloud credentials). The Supabase branch is checked first
    so a misconfigured DSN cleanly falls through to sheet/seed rather than erroring.
    """
    if settings.data_backend == DataBackend.SUPABASE and supabase_backend.is_configured():
        return supabase_backend
    if settings.data_backend == DataBackend.SHEET and sheets.is_configured():
        return sheets
    return seed_loader


def _is_persistent(backend) -> bool:
    """True when ``backend`` persists writes (sheets, or a future Supabase backend).

    Capability check that replaces the older ``backend is not sheets`` identity
    guard: a backend opts in via a module-level ``SUPPORTS_PERSISTENCE = True``.
    The explicit ``is True`` (not bare truthiness) keeps a stray Mock's
    auto-attribute from reading as persistent. ``seed_loader`` sets it False, so
    persistence-gated routes degrade exactly as they did under the identity check.
    """
    return getattr(backend, "SUPPORTS_PERSISTENCE", False) is True


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


def _evaluate_submit_line(
    line: OrderLineSubmit,
    sp: SupplierProduct,
    setting: LocationProductSetting,
    product: Product,
    order_line_id: str,
    order_id: str,
) -> tuple[OrderLine, Optional[str], float]:
    """Validate one captain-submitted line and build its persisted OrderLine.

    Shared by ``captain_submit`` and ``captain_order_edit`` so their per-line
    gates cannot drift. Returns ``(order_line, warning_or_None, line_value_pln)``
    and raises ``HTTPException`` on a hard gate.

    Two branches on whether the Captain counted stock:

    - **Uncounted** (``line.current_stock_qty_base is None``): there is no real
      suggestion to deviate from (SUGESTIA renders "—"), so the deviation and
      critical-under reason gates are skipped. A reason is forced only when the
      order exceeds MAX — the storage ceiling, the one stock-independent concern
      (``order_base > max`` and not ``allow_over_max_due_to_packaging``). The line
      persists with ``current_stock_qty_base=0`` (column stays NOT NULL) and
      ``delta_vs_suggestion_pct=None`` (so it never inflates deviation roll-ups).
    - **Counted** (a value was given): the existing critical-under and >20%
      deviation gates apply byte-identically.
    """
    is_critical = setting.is_critical_for_location or product.is_critical
    stock = line.current_stock_qty_base
    current_for_math = stock if stock is not None else 0.0
    suggestion = compute_suggestion(
        SuggestionInput(
            current_stock_qty_base=current_for_math,
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

    warning: Optional[str] = None
    order_base = line.captain_final_qty_purchase * sp.units_per_purchase_unit

    if stock is None:
        # Uncounted — over-MAX is the only reason gate.
        over_max = (
            setting.max_stock_qty_base > 0
            and not setting.allow_over_max_due_to_packaging
            and order_base > setting.max_stock_qty_base
        )
        if over_max and line.reason_code is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Line '{line.product_id}' ordered over MAX "
                    f"({order_base:g} > {setting.max_stock_qty_base:g}) "
                    f"without reason_code"
                ),
            )
        if over_max and line.reason_code is not None:
            warning = (
                f"Line {line.product_id}: over MAX "
                f"({order_base:g} > {setting.max_stock_qty_base:g}), "
                f"reason: {line.reason_code.value}"
            )
        stored_stock = 0.0
        delta_pct: Optional[float] = None
    else:
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
            warning = (
                f"Line {line.product_id}: {delta_pct:.0%} deviation, "
                f"reason: {line.reason_code.value}"
            )
        stored_stock = stock

    line_value = (
        line.captain_final_qty_purchase * sp.price_estimate_pln
        if sp.price_estimate_pln
        else 0.0
    )

    order_line = OrderLine(
        order_line_id=order_line_id,
        order_id=order_id,
        product_id=line.product_id,
        supplier_product_id=line.supplier_product_id,
        current_stock_qty_base=stored_stock,
        target_stock_qty_base=setting.target_stock_qty_base,
        suggested_qty_base=suggested_qty_base,
        suggested_qty_purchase=suggested_qty_purchase,
        captain_final_qty_purchase=line.captain_final_qty_purchase,
        captain_final_qty_base=order_base,
        delta_vs_suggestion_pct=delta_pct,
        reason_code=line.reason_code,
        captain_comment=line.captain_comment,
    )
    return order_line, warning, line_value


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
      - uncounted line (current_stock_qty_base omitted/null) ordered over MAX
        without reason_code -> 400. When stock is uncounted the deviation +
        critical gates are skipped (no real suggestion); only over-MAX forces a
        reason. See `_evaluate_submit_line`.
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

        order_line, warning, line_value = _evaluate_submit_line(
            line,
            sp,
            setting,
            product,
            order_line_id=f"OL-{order_id}-{idx:03d}",
            order_id=order_id,
        )
        if warning is not None:
            warnings.append(warning)
        total_value += line_value
        order_lines.append(order_line)

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
    if not _is_persistent(backend):
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

    # F-7: load only the lines for the orders we're displaying — a targeted
    # `WHERE order_id = ANY(...)` on Supabase (one cached read on Sheets), not a
    # full order_lines table scan that grows with every order ever placed.
    order_ids = [o.order_id for o in filtered]
    lines_by_order: dict[str, list[OrderLine]] = {}
    for line in backend.load_order_lines_for_orders(order_ids):
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

    # Sort newest-first: the most recently submitted order sits at the TOP of the
    # queue (an "inbox"). cutoff_iso still rides on each item as a badge but is no
    # longer the primary sort key — a supplier without a parseable cutoff must not
    # sink a fresh order to the bottom. manager_sent uses captain_submitted_at as
    # a proxy (the queue model doesn't carry manager_sent_at; the dashboard pulls
    # full detail via /order/{id} when it needs the sent timestamp). Other statuses
    # (e.g. manager_claimed) are intentionally left in sheet/append order — fine at
    # pilot volume; revisit if the claimed lane grows.
    if status in (OrderStatus.CAPTAIN_SUBMITTED, OrderStatus.MANAGER_SENT):
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
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Order details require a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
        )

    order = backend.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")

    products_by_id = {p.product_id: p for p in backend.load_products()}
    sps_by_id = {sp.supplier_product_id: sp for sp in backend.load_supplier_products()}
    suppliers_by_id = {s.supplier_id: s for s in backend.load_suppliers()}
    locations_by_id = {loc.location_id: loc for loc in backend.load_locations()}
    settings_by_pid = {
        s.product_id: s
        for s in backend.load_location_product_settings()
        if s.location_id == order.location_id
    }

    supplier = suppliers_by_id.get(order.supplier_id)
    location = locations_by_id.get(order.location_id)

    enriched_lines: list[ManagerOrderLineDetail] = []
    for line in order.lines:
        product = products_by_id.get(line.product_id)
        sp = sps_by_id.get(line.supplier_product_id)
        setting = settings_by_pid.get(line.product_id)
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
                max_stock_qty_base=setting.max_stock_qty_base if setting else 0,
                allow_over_max_due_to_packaging=(
                    setting.allow_over_max_due_to_packaging if setting else False
                ),
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
    settings_by_pid: Optional[dict[str, LocationProductSetting]] = None,
) -> list[ManagerOrderLineDetail]:
    """Shared helper — turn OrderLine rows into ManagerOrderLineDetail with joins.

    ``settings_by_pid`` (location_product_settings keyed by product_id) supplies
    ``max_stock_qty_base`` + ``allow_over_max_due_to_packaging`` so the Captain
    edit screen can mirror the backend over-MAX gate. None/absent → 0/False.
    """
    settings_by_pid = settings_by_pid or {}
    enriched: list[ManagerOrderLineDetail] = []
    for line in lines:
        product = products_by_id.get(line.product_id)
        sp = sps_by_id.get(line.supplier_product_id)
        setting = settings_by_pid.get(line.product_id)
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
                max_stock_qty_base=setting.max_stock_qty_base if setting else 0,
                allow_over_max_due_to_packaging=(
                    setting.allow_over_max_due_to_packaging if setting else False
                ),
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
    if not _is_persistent(backend):
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

    # F-7: targeted load for just these orders (see manager_queue).
    order_ids = [o.order_id for o in filtered]
    lines_by_order: dict[str, list[OrderLine]] = {}
    for line in backend.load_order_lines_for_orders(order_ids):
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
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Order details require a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
        )
    order = backend.get_order(order_id)
    if order is None or order.location_id != location_id:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")

    products_by_id = {p.product_id: p for p in backend.load_products()}
    sps_by_id = {sp.supplier_product_id: sp for sp in backend.load_supplier_products()}
    suppliers_by_id = {s.supplier_id: s for s in backend.load_suppliers()}
    locations_by_id = {loc.location_id: loc for loc in backend.load_locations()}

    settings_by_pid = {
        s.product_id: s
        for s in backend.load_location_product_settings()
        if s.location_id == order.location_id
    }

    supplier = suppliers_by_id.get(order.supplier_id)
    location = locations_by_id.get(order.location_id)
    enriched_lines = _enrich_lines_for_detail(
        order.lines, products_by_id, sps_by_id, settings_by_pid
    )

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
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Order edit requires a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
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

        order_line, warning, line_value = _evaluate_submit_line(
            line,
            sp,
            setting,
            product,
            order_line_id=f"OL-{order_id}-{idx:03d}",
            order_id=order_id,
        )
        if warning is not None:
            warnings.append(warning)
        total_value += line_value
        new_lines.append(order_line)

    total_value_rounded = round(total_value, 2)

    # F1: the full captain edit — status guard + line-set replacement + order-field
    # updates — is ONE atomic unit. On Supabase, `replace_order_lines_atomic` wraps
    # the conditional `UPDATE orders … WHERE status='captain_submitted' RETURNING`
    # + `DELETE order_lines` + `INSERT new_lines` in a single transaction: a guard
    # miss (manager claimed/changed it concurrently) rolls the WHOLE thing back, so
    # the line set is never replaced under a now-claimed order. Sheets keeps the
    # prior non-transactional delete→append→guarded-update sequence (it has no
    # cross-call transaction) — the two backends deliberately diverge here, and the
    # brief 0-lines window stays an accepted Sheets-only v0 trade-off.
    #
    # `captain_submitted_at` is preserved (the ORIGINAL submit moment is the
    # sort/audit key); only `last_edited_at` is stamped so captain + manager can see
    # the order was corrected and when.
    try:
        backend.replace_order_lines_atomic(
            order_id,
            new_lines,
            order_updates={
                "total_value_estimate_pln": total_value_rounded,
                "requested_delivery_date": (
                    req.requested_delivery_date or existing.requested_delivery_date
                ),
                "notes": req.notes,
                "last_edited_at": datetime.now(timezone.utc),
            },
            expected_status=OrderStatus.CAPTAIN_SUBMITTED.value,
        )
    except errors.OrderStatusConflictError:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Order {order_id} is no longer editable (it was claimed or "
                f"changed concurrently). Skontaktuj się z menedżerem."
            ),
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
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Claim requires a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
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

    try:
        backend.update_order(
            order_id,
            status=OrderStatus.MANAGER_CLAIMED.value,
            expected_status=OrderStatus.CAPTAIN_SUBMITTED.value,
        )
    except errors.OrderStatusConflictError:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Order {order_id} was claimed or changed concurrently "
                f"(expected captain_submitted)"
            ),
        )
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
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Release requires a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
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

    try:
        backend.update_order(
            order_id,
            status=OrderStatus.CAPTAIN_SUBMITTED.value,
            notes=req.reason.strip(),
            expected_status=OrderStatus.MANAGER_CLAIMED.value,
        )
    except errors.OrderStatusConflictError:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Order {order_id} was changed concurrently "
                f"(expected manager_claimed)"
            ),
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
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Dispatch requires a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
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
            expected_status=OrderStatus.MANAGER_CLAIMED.value,
        )
    except (errors.OrderAlreadyDispatchedError, errors.OrderStatusConflictError):
        raise HTTPException(
            status_code=409,
            detail=f"Order {req.order_id} was already dispatched or changed concurrently",
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
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Save requires a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
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
        # stays manager_claimed (no dispatch). `expected_status` makes the write
        # atomic on Supabase — a concurrent dispatch/release that already moved
        # the order off manager_claimed yields 0 rows → 409 (Sheets ignores it).
        try:
            backend.update_order(
                order_id,
                total_value_estimate_pln=total_rounded,
                expected_status=OrderStatus.MANAGER_CLAIMED.value,
            )
        except errors.OrderStatusConflictError:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Order {order_id} is no longer manager_claimed (it may have "
                    f"been dispatched or released — refresh the queue)"
                ),
            )

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
    backend = _choose_backend()
    products_by_id = {p.product_id: p for p in backend.load_products()}
    items: list[InventoryProduct] = []
    for setting in backend.load_location_product_settings():
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
    if not _is_persistent(backend):
        return None

    try:
        all_counts = backend.load_inventory_counts()
    except sheets.WorksheetNotFound:
        # Inventory tabs not yet created — no snapshot to offer.
        return None
    counts = [c for c in all_counts if c.location_id == location_id]
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
    if not _is_persistent(backend):
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
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Inventory snapshot detail requires a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
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


# ---------- Manager inventory view (S-08 / FR-018, FR-019) ----------


def _enrich_inventory_count_detail(
    count: InventoryCount,
    products_by_id: dict[str, Product],
    location: Optional[Location],
) -> InventoryCountDetail:
    """Join product master-data + location_name onto a snapshot for the
    Manager/owner read view (S-08). Mirrors `manager_order_detail`'s line
    enrichment; a since-removed product falls back to its id for the name."""
    enriched: list[InventoryCountDetailLine] = []
    for line in count.lines:
        product = products_by_id.get(line.product_id)
        enriched.append(
            InventoryCountDetailLine(
                product_id=line.product_id,
                product_name_pl=product.product_name_pl if product else line.product_id,
                product_category=product.product_category if product else "",
                inventory_unit=product.inventory_unit if product else "",
                is_critical=bool(product.is_critical) if product else False,
                current_stock_qty_base=line.current_stock_qty_base,
                count_comment=line.count_comment,
            )
        )
    return InventoryCountDetail(
        count_id=count.count_id,
        location_id=count.location_id,
        location_name=location.location_name if location else count.location_id,
        count_date=count.count_date,
        count_submitted_at=count.count_submitted_at,
        count_user=count.count_user,
        line_count=len(enriched),
        notes=count.notes,
        lines=enriched,
    )


@app.get(
    "/api/manager/inventory/counts",
    response_model=list[InventoryCountManagerItem],
)
def manager_inventory_counts(
    location_id: Optional[str] = None,
    _: None = Depends(require_manager),
):
    """List submitted inventory snapshots across locations for the Manager view
    (FR-018). Optional `location_id` narrows to one location — NOT token-scoped;
    the Manager spans locations, mirroring `manager_queue`. Up to 20, newest
    `count_date` first (tie-broken by `count_submitted_at`).

    Sheet-only: seed mode and a missing inventory tab both degrade to `[]`
    (mirrors `manager_queue` / the Captain counts route), never a 500.
    """
    backend = _choose_backend()
    if not _is_persistent(backend):
        return []
    try:
        all_counts = backend.load_inventory_counts()
    except sheets.WorksheetNotFound:
        return []

    counts = [
        c for c in all_counts
        if location_id is None or c.location_id == location_id
    ]
    if not counts:
        return []

    locations_by_id = {loc.location_id: loc for loc in backend.load_locations()}

    def _recency_key(c: InventoryCount) -> tuple[date, datetime]:
        submitted = c.count_submitted_at or datetime.min.replace(tzinfo=timezone.utc)
        return (c.count_date, submitted)

    counts.sort(key=_recency_key, reverse=True)
    items: list[InventoryCountManagerItem] = []
    for c in counts[:20]:
        location = locations_by_id.get(c.location_id)
        items.append(
            InventoryCountManagerItem(
                count_id=c.count_id,
                location_id=c.location_id,
                location_name=location.location_name if location else c.location_id,
                count_date=c.count_date,
                count_submitted_at=c.count_submitted_at,
                count_user=c.count_user,
                line_count=c.line_count,
            )
        )
    return items


@app.get(
    "/api/manager/inventory/count/{count_id}",
    response_model=InventoryCountDetail,
)
def manager_inventory_count_detail(
    count_id: str,
    _: None = Depends(require_manager),
):
    """One submitted inventory snapshot, product-enriched, for the Manager/owner
    read view (FR-018/FR-019). No location scope — the Manager reads any
    location's count (mirrors `manager_order_detail`).

    Sheet-only: seed mode → 503; a missing inventory tab → 503 (stricter than
    the legacy `manager_order_detail`, which can 500 on a missing tab); unknown
    count_id → 404.
    """
    backend = _choose_backend()
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Inventory detail requires a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
        )
    try:
        count = backend.get_inventory_count(count_id)
    except sheets.WorksheetNotFound:
        raise HTTPException(
            status_code=503,
            detail=(
                "Inventory worksheets not configured — create the "
                "'inventory_counts' and 'inventory_count_lines' tabs."
            ),
        )
    if count is None:
        raise HTTPException(
            status_code=404, detail=f"Inventory count {count_id} not found"
        )

    products_by_id = {p.product_id: p for p in backend.load_products()}
    locations_by_id = {loc.location_id: loc for loc in backend.load_locations()}
    location = locations_by_id.get(count.location_id)
    return _enrich_inventory_count_detail(count, products_by_id, location)


# ---------- Suggestion learning-loop review (S-03 / FR-012) ----------


def _aggregate_suggestion_review(
    lines: list[OrderLine],
    products_by_id: dict[str, Product],
) -> list[SuggestionReviewItem]:
    """Roll up order_lines per product for the learning-loop review (S-03).

    Pure function (no I/O) so it can be unit-tested directly. Averages are taken
    over ALL lines in the group; ``avg_abs_deviation_pct`` is the mean of
    ``|delta_vs_suggestion_pct|`` over only the lines that carry one (0.0 if
    none). Result is sorted worst-deviation first (tie-break: more lines first).
    """
    by_pid: dict[str, list[OrderLine]] = {}
    for line in lines:
        by_pid.setdefault(line.product_id, []).append(line)

    items: list[SuggestionReviewItem] = []
    for pid, group in by_pid.items():
        n = len(group)
        product = products_by_id.get(pid)
        order_ids = {line.order_id for line in group}
        deviations = [
            abs(line.delta_vs_suggestion_pct)
            for line in group
            if line.delta_vs_suggestion_pct is not None
        ]
        reason_counts: dict[str, int] = {}
        for line in group:
            if line.reason_code is not None:
                key = line.reason_code.value
                reason_counts[key] = reason_counts.get(key, 0) + 1
        items.append(
            SuggestionReviewItem(
                product_id=pid,
                product_name_pl=product.product_name_pl if product else pid,
                product_category=product.product_category if product else "",
                inventory_unit=product.inventory_unit if product else "",
                line_count=n,
                order_count=len(order_ids),
                avg_suggested_qty_purchase=round(
                    sum(line.suggested_qty_purchase for line in group) / n, 3
                ),
                avg_captain_final_qty_purchase=round(
                    sum(line.captain_final_qty_purchase for line in group) / n, 3
                ),
                avg_manager_final_qty_purchase=round(
                    sum(line.manager_final_qty_purchase for line in group) / n, 3
                ),
                avg_abs_deviation_pct=(
                    round(sum(deviations) / len(deviations), 4) if deviations else 0.0
                ),
                reason_code_counts=reason_counts,
            )
        )
    items.sort(key=lambda it: (it.avg_abs_deviation_pct, it.line_count), reverse=True)
    return items


@app.get(
    "/api/manager/suggestion-review",
    response_model=list[SuggestionReviewItem],
)
def manager_suggestion_review(
    _: None = Depends(require_manager),
):
    """Per-product roll-up of the order-line history for the suggestion learning
    loop (FR-012): suggested vs captain-final vs manager-final averages, average
    absolute deviation, and a reason-code histogram — sorted worst-deviation
    first so the owner sees which master-data rows are the strongest correction
    candidates. Read-only; never auto-corrects (suggest-only governing rule).

    Sheet-only: order_lines persist only in sheet mode; seed mode and a missing
    tab both degrade to [] (mirrors manager_queue), never a 500.
    """
    backend = _choose_backend()
    if not _is_persistent(backend):
        return []
    try:
        lines = backend.load_order_lines()
    except sheets.WorksheetNotFound:
        return []
    products_by_id = {p.product_id: p for p in backend.load_products()}
    return _aggregate_suggestion_review(lines, products_by_id)


# ---------- Captain goods receiving (GR-01) ----------


def _generate_receipt_id(location_id: str, today: date) -> str:
    """RCP-YYYYMMDD-<LOC3>-<6hex> (mirrors `_generate_count_id`)."""
    loc = (location_id or "XXX")[:3].upper()
    rand = secrets.token_hex(3)
    return f"RCP-{today.strftime('%Y%m%d')}-{loc}-{rand}"


def _persist_receipt(backend, receipt: Receipt, lines: list[ReceiptLine]) -> bool:
    """Write receipt + lines to backend. Returns True on persistent write, False
    on in-memory-only fallback (seed backend). Mirrors `_persist_inventory_count`."""
    appender = getattr(backend, "append_receipt", None)
    lines_appender = getattr(backend, "append_receipt_lines", None)
    if appender is None or lines_appender is None:
        log.warning(
            "Receipt %s submitted to read-only backend %s — not persisted",
            receipt.receipt_id,
            getattr(backend, "__name__", "?"),
        )
        return False
    try:
        appender(receipt)
        lines_appender(lines)
    except NotImplementedError:
        log.warning(
            "Receipt %s — backend %s raised NotImplementedError on write",
            receipt.receipt_id,
            getattr(backend, "__name__", "?"),
        )
        return False
    return True


def _effective_ordered_qty(line: OrderLine) -> float:
    """Effective ordered purchase qty for receiving: manager_final if > 0 else
    captain_final — the quantity actually ordered (mirrors
    `gmail_url._effective_qty`, the same rule the dispatch email uses)."""
    if line.manager_final_qty_purchase and line.manager_final_qty_purchase > 0:
        return line.manager_final_qty_purchase
    return line.captain_final_qty_purchase


@app.post("/api/captain/receipt/submit", response_model=ReceiptSubmitResponse)
def captain_receipt_submit(
    req: ReceiptSubmitRequest,
    location_id: str = Depends(require_captain),
):
    """Validate + persist a Captain goods-receipt against a dispatched order (GR-01).

    Sheet-only: a receipt is built FROM a real dispatched order, which lives only
    in the sheet backend — seed mode returns 503 (mirrors `captain_order_detail`).

    Gates (deterministic):
      - order must exist AND belong to this Captain's location -> 404.
      - order status must be manager_sent -> 409.
      - every line's order_line_id must belong to the order -> 400.
      - receipt_date defaults to Warsaw-today; a future date -> 400.

    Append-only: every submit creates a new receipt_id (no edit/upsert) and does
    NOT change the order's status. Photos are attached later via
    POST /api/captain/receipt/{id}/photos, so the receipt starts
    `received_with_missing_wz=True`.
    """
    backend = _choose_backend()
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Goods receiving requires a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
        )

    order = backend.get_order(req.order_id)
    if order is None or order.location_id != location_id:
        raise HTTPException(status_code=404, detail=f"Order {req.order_id} not found")
    if order.status != OrderStatus.MANAGER_SENT:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Order {req.order_id} status is {order.status.value}, "
                f"expected manager_sent (cannot confirm delivery)"
            ),
        )

    today_warsaw = datetime.now(_WARSAW_TZ).date()
    receipt_date = req.receipt_date or today_warsaw
    if receipt_date > today_warsaw:
        raise HTTPException(
            status_code=400,
            detail=f"receipt_date {receipt_date.isoformat()} is in the future",
        )
    receipt_id = _generate_receipt_id(location_id, today_warsaw)

    lines_by_id = {ln.order_line_id: ln for ln in order.lines}
    receipt_lines: list[ReceiptLine] = []
    discrepancy_count = 0
    for idx, line in enumerate(req.lines, start=1):
        order_line = lines_by_id.get(line.order_line_id)
        if order_line is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"order_line '{line.order_line_id}' does not belong to "
                    f"order {req.order_id}"
                ),
            )
        ordered = _effective_ordered_qty(order_line)
        variance = line.received_qty_purchase - ordered
        if variance != 0:
            discrepancy_count += 1
        receipt_lines.append(
            ReceiptLine(
                receipt_line_id=f"RL-{receipt_id}-{idx:03d}",
                receipt_id=receipt_id,
                order_id=req.order_id,
                order_line_id=line.order_line_id,
                product_id=order_line.product_id,
                supplier_product_id=order_line.supplier_product_id,
                ordered_qty_purchase=ordered,
                received_qty_purchase=line.received_qty_purchase,
                variance_qty_purchase=variance,
                receipt_comment=line.receipt_comment,
            )
        )

    receipt = Receipt(
        receipt_id=receipt_id,
        order_id=req.order_id,
        location_id=location_id,
        supplier_id=order.supplier_id,
        receipt_date=receipt_date,
        received_by=req.received_by,
        received_submitted_at=datetime.now(timezone.utc),
        line_count=len(receipt_lines),
        discrepancy_count=discrepancy_count,
        received_with_missing_wz=True,
        notes=req.notes,
    )

    warnings: list[str] = []
    try:
        persisted = _persist_receipt(backend, receipt, receipt_lines)
    except sheets.WorksheetNotFound:
        raise HTTPException(
            status_code=503,
            detail=(
                "Goods-receipt worksheets not configured — create the "
                "'receipts' and 'receipt_lines' tabs (see Migration Notes) "
                "before confirming a delivery."
            ),
        )
    if not persisted:
        warnings.append(
            "Receipt was not persisted (read-only backend) — data is in-memory only."
        )

    return ReceiptSubmitResponse(
        receipt_id=receipt_id,
        order_id=req.order_id,
        receipt_date=receipt_date,
        line_count=len(receipt_lines),
        discrepancy_count=discrepancy_count,
        received_with_missing_wz=True,
        warnings=warnings,
    )


@app.get("/api/captain/receipts", response_model=list[ReceiptSummary])
def captain_receipts(
    order_id: Optional[str] = None,
    location_id: str = Depends(require_captain),
):
    """List goods-receipts for this Captain's location, optionally narrowed to one
    ``order_id``, newest `received_submitted_at` first. Sheet-only: seed mode and
    a missing tab both degrade to `[]` (mirrors `captain_inventory_counts`)."""
    backend = _choose_backend()
    if not _is_persistent(backend):
        return []
    try:
        all_receipts = backend.load_receipts()
    except sheets.WorksheetNotFound:
        return []
    receipts = [
        r for r in all_receipts
        if r.location_id == location_id
        and (order_id is None or r.order_id == order_id)
    ]
    if not receipts:
        return []

    def _recency_key(r: Receipt) -> datetime:
        return r.received_submitted_at or datetime.min.replace(tzinfo=timezone.utc)

    receipts.sort(key=_recency_key, reverse=True)
    return [
        ReceiptSummary(
            receipt_id=r.receipt_id,
            order_id=r.order_id,
            location_id=r.location_id,
            receipt_date=r.receipt_date,
            received_submitted_at=r.received_submitted_at,
            received_by=r.received_by,
            line_count=r.line_count,
            discrepancy_count=r.discrepancy_count,
            received_with_missing_wz=r.received_with_missing_wz,
            wz_photo_count=r.wz_photo_count,
        )
        for r in receipts
    ]


@app.get("/api/captain/receipt/{receipt_id}", response_model=ReceiptDetail)
def captain_receipt_detail(
    receipt_id: str,
    location_id: str = Depends(require_captain),
):
    """One goods-receipt with product-enriched lines, location-scoped. Sheet-only:
    seed mode -> 503; missing tab -> 503; missing/wrong-location -> 404 (we don't
    differentiate — the Captain has no business knowing other locations' ids)."""
    backend = _choose_backend()
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Goods-receipt detail requires a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
        )
    try:
        receipt = backend.get_receipt(receipt_id)
    except sheets.WorksheetNotFound:
        raise HTTPException(
            status_code=503,
            detail=(
                "Goods-receipt worksheets not configured — create the "
                "'receipts' and 'receipt_lines' tabs (see Migration Notes)."
            ),
        )
    if receipt is None or receipt.location_id != location_id:
        raise HTTPException(status_code=404, detail=f"Receipt {receipt_id} not found")

    products_by_id = {p.product_id: p for p in backend.load_products()}
    sps_by_id = {sp.supplier_product_id: sp for sp in backend.load_supplier_products()}
    suppliers_by_id = {s.supplier_id: s for s in backend.load_suppliers()}
    locations_by_id = {loc.location_id: loc for loc in backend.load_locations()}
    supplier = suppliers_by_id.get(receipt.supplier_id)
    location = locations_by_id.get(receipt.location_id)

    enriched: list[ReceiptDetailLine] = []
    for line in receipt.lines:
        product = products_by_id.get(line.product_id)
        sp = sps_by_id.get(line.supplier_product_id)
        enriched.append(
            ReceiptDetailLine(
                receipt_line_id=line.receipt_line_id,
                order_line_id=line.order_line_id,
                product_id=line.product_id,
                product_name_pl=product.product_name_pl if product else line.product_id,
                inventory_unit=product.inventory_unit if product else "",
                purchase_unit=sp.purchase_unit if sp else "",
                is_critical=bool(product.is_critical) if product else False,
                ordered_qty_purchase=line.ordered_qty_purchase,
                received_qty_purchase=line.received_qty_purchase,
                variance_qty_purchase=line.variance_qty_purchase,
                receipt_comment=line.receipt_comment,
            )
        )

    return ReceiptDetail(
        receipt_id=receipt.receipt_id,
        order_id=receipt.order_id,
        location_id=receipt.location_id,
        location_name=location.location_name if location else receipt.location_id,
        supplier_id=receipt.supplier_id,
        supplier_name=supplier.supplier_name if supplier else receipt.supplier_id,
        receipt_date=receipt.receipt_date,
        received_by=receipt.received_by,
        received_submitted_at=receipt.received_submitted_at,
        line_count=receipt.line_count,
        discrepancy_count=receipt.discrepancy_count,
        received_with_missing_wz=receipt.received_with_missing_wz,
        wz_photo_path_prefix=receipt.wz_photo_path_prefix,
        wz_photo_count=receipt.wz_photo_count,
        notes=receipt.notes,
        lines=enriched,
    )


@app.post(
    "/api/captain/receipt/{receipt_id}/photos",
    response_model=ReceiptPhotoUploadResponse,
)
def captain_receipt_photos(
    receipt_id: str,
    files: list[UploadFile] = File(...),
    location_id: str = Depends(require_captain),
):
    """Upload one or more WZ delivery-note photos for a receipt to its order's
    Supabase Storage prefix ``wz/<order_id>/`` (GR-01).

    Persist-first contract: the receipt already exists (created by submit); this
    endpoint only ATTACHES photos, so a photo failure never loses the confirmed
    delivery. Requires sheet backend AND Supabase Storage configured (else 503).
    Location-scoped via the receipt's location. On success, flips
    ``received_with_missing_wz`` off and records the per-order path prefix +
    cumulative photo count. Non-image files are rejected (400). The response
    carries fresh signed URLs for immediate display; URLs are never persisted.
    """
    backend = _choose_backend()
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Photo upload requires a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
        )
    if not supabase_storage.is_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Supabase Storage not configured — set SUPPLY_OS_SUPABASE_URL "
                "and SUPPLY_OS_SUPABASE_SERVICE_ROLE_KEY."
            ),
        )
    try:
        receipt = backend.get_receipt(receipt_id)
    except sheets.WorksheetNotFound:
        raise HTTPException(
            status_code=503,
            detail=(
                "Goods-receipt worksheets not configured — create the "
                "'receipts' and 'receipt_lines' tabs (see Migration Notes)."
            ),
        )
    if receipt is None or receipt.location_id != location_id:
        raise HTTPException(status_code=404, detail=f"Receipt {receipt_id} not found")
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    prefix = supabase_storage.order_prefix(receipt.order_id)
    uploaded: list[ReceiptPhotoItem] = []
    for idx, f in enumerate(files, start=1):
        content = f.file.read()
        if not content:
            continue
        ctype = f.content_type or ""
        if not ctype.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' is not an image ({ctype or 'unknown'})",
            )
        ext = ""
        if f.filename and "." in f.filename:
            ext = "." + f.filename.rsplit(".", 1)[1]
        name = f"{receipt.receipt_id}-{idx:02d}{ext}"
        object_path = f"{prefix}/{name}"
        supabase_storage.upload_photo(object_path, content, ctype)
        uploaded.append(
            ReceiptPhotoItem(
                name=name,
                signed_url=supabase_storage.create_signed_url(object_path),
            )
        )

    if not uploaded:
        raise HTTPException(status_code=400, detail="No valid image files uploaded")

    new_count = (receipt.wz_photo_count or 0) + len(uploaded)
    backend.update_receipt(
        receipt_id,
        wz_photo_path_prefix=prefix,
        wz_photo_count=new_count,
        received_with_missing_wz=False,
    )
    return ReceiptPhotoUploadResponse(
        receipt_id=receipt_id,
        wz_photo_count=new_count,
        received_with_missing_wz=False,
        uploaded=uploaded,
    )


@app.get(
    "/api/captain/receipt/{receipt_id}/photos",
    response_model=list[ReceiptPhotoItem],
)
def captain_receipt_photo_urls(
    receipt_id: str,
    location_id: str = Depends(require_captain),
):
    """List short-lived signed URLs for a receipt's WZ photos (GR-01), minted on
    demand. Sheet-only (503 in seed mode); Supabase Storage must be configured
    (503); location-scoped (404 on missing/foreign). URLs are never persisted —
    every call re-signs. Empty list when the receipt has no photos.
    """
    backend = _choose_backend()
    if not _is_persistent(backend):
        raise HTTPException(
            status_code=503,
            detail="Photo viewing requires a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or supabase)",
        )
    if not supabase_storage.is_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Supabase Storage not configured — set SUPPLY_OS_SUPABASE_URL "
                "and SUPPLY_OS_SUPABASE_SERVICE_ROLE_KEY."
            ),
        )
    try:
        receipt = backend.get_receipt(receipt_id)
    except sheets.WorksheetNotFound:
        raise HTTPException(
            status_code=503,
            detail=(
                "Goods-receipt worksheets not configured — create the "
                "'receipts' and 'receipt_lines' tabs (see Migration Notes)."
            ),
        )
    if receipt is None or receipt.location_id != location_id:
        raise HTTPException(status_code=404, detail=f"Receipt {receipt_id} not found")

    prefix = receipt.wz_photo_path_prefix or supabase_storage.order_prefix(
        receipt.order_id
    )
    return [
        ReceiptPhotoItem(
            name=path.rsplit("/", 1)[-1],
            signed_url=supabase_storage.create_signed_url(path),
        )
        for path in supabase_storage.list_photos(prefix)
    ]
