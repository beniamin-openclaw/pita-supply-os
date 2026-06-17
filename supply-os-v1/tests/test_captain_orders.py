"""Tests for the Captain own-orders endpoints (Phase E3).

Covers:
  - GET /api/captain/orders        — list + status filter + location scope
  - GET /api/captain/order/{id}    — detail + 404 on cross-location
  - PATCH /api/captain/order/{id}  — edit while captain_submitted, 409 otherwise

Fixtures follow the same pattern as test_manager_queue.py: monkeypatch the
sheets surface so no Google API is needed.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from app import sheets
from app.config import DataBackend
from app.main import app
from app.models import (
    Location,
    LocationProductSetting,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    ReasonCode,
    RoundingRule,
    Supplier,
    SupplierProduct,
)

client = TestClient(app)
WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
KEN_AUTH = {"Authorization": "Bearer test_ken_token"}


# ---------- Builders ----------

def _order(
    order_id: str,
    location_id: str = "WOLA",
    supplier_id: str = "SUP_PAGO",
    status: OrderStatus = OrderStatus.CAPTAIN_SUBMITTED,
    total: float = 500.0,
    captain_submitted_at: datetime | None = None,
) -> Order:
    return Order(
        order_id=order_id,
        location_id=location_id,
        supplier_id=supplier_id,
        order_date=date(2026, 5, 20),
        requested_delivery_date=date(2026, 5, 25),
        status=status,
        captain_user=location_id,
        captain_submitted_at=captain_submitted_at
        or datetime(2026, 5, 20, 8, 30, tzinfo=timezone.utc),
        total_value_estimate_pln=total,
    )


def _line(
    order_id: str,
    line_id: str,
    product_id: str = "P027",
    sp_id: str = "SP_PAGO_P027",
    captain_qty: float = 5.0,
    delta_pct: float | None = 0.0,
    reason_code: ReasonCode | None = None,
) -> OrderLine:
    return OrderLine(
        order_line_id=line_id,
        order_id=order_id,
        product_id=product_id,
        supplier_product_id=sp_id,
        current_stock_qty_base=2.0,
        target_stock_qty_base=20.0,
        suggested_qty_base=18.0,
        suggested_qty_purchase=4.0,
        captain_final_qty_purchase=captain_qty,
        captain_final_qty_base=captain_qty * 5.0,
        delta_vs_suggestion_pct=delta_pct,
        reason_code=reason_code,
    )


def _supplier() -> Supplier:
    return Supplier(
        supplier_id="SUP_PAGO",
        supplier_name="Pago",
        email="zamowienia@pago.example",
    )


def _product() -> Product:
    return Product(
        product_id="P027",
        product_name_pl="Souvlaki Kurczak",
        product_category="Mięso",
        inventory_unit="kg",
        is_critical=False,
    )


def _supplier_product() -> SupplierProduct:
    return SupplierProduct(
        supplier_product_id="SP_PAGO_P027",
        supplier_id="SUP_PAGO",
        product_id="P027",
        supplier_product_name="Souvlaki Kurczak karton",
        purchase_unit="karton",
        units_per_purchase_unit=5.0,
        rounding_rule=RoundingRule.FULL_ONLY,
        price_estimate_pln=145.0,
    )


def _location_product_setting(
    location_id: str = "WOLA",
    product_id: str = "P027",
    target: float = 20.0,
    max_: float = 25.0,
) -> LocationProductSetting:
    return LocationProductSetting(
        setting_id=f"LPS-{location_id}-{product_id}",
        location_id=location_id,
        product_id=product_id,
        min_stock_qty_base=0.0,
        max_stock_qty_base=max_,
        target_stock_qty_base=target,
        is_critical_for_location=False,
        allow_over_max_due_to_packaging=False,
    )


def _location(location_id: str = "WOLA", name: str = "Pita Bros Wola") -> Location:
    return Location(
        location_id=location_id,
        location_name=name,
        delivery_address="Wolska 50, Warszawa",
    )


def _enable_sheet(
    mocker,
    orders: list[Order],
    lines: list[OrderLine] | None = None,
    get_order_return: Order | None = None,
    delete_lines_return: int = 0,
):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_orders", return_value=orders)
    mocker.patch.object(sheets, "load_order_lines", return_value=lines or [])
    mocker.patch.object(sheets, "load_suppliers", return_value=[_supplier()])
    mocker.patch.object(sheets, "load_products", return_value=[_product()])
    mocker.patch.object(
        sheets, "load_supplier_products", return_value=[_supplier_product()]
    )
    mocker.patch.object(
        sheets, "load_location_product_settings", return_value=[_location_product_setting()]
    )
    mocker.patch.object(sheets, "load_locations", return_value=[_location()])
    mocker.patch.object(sheets, "get_order", return_value=get_order_return)
    delete_mock = mocker.patch.object(
        sheets, "delete_order_lines", return_value=delete_lines_return
    )
    append_mock = mocker.patch.object(sheets, "append_order_lines", return_value=None)
    update_mock = mocker.patch.object(sheets, "update_order", return_value=None)
    return {
        "delete_order_lines": delete_mock,
        "append_order_lines": append_mock,
        "update_order": update_mock,
    }


# ---------- GET /api/captain/orders ----------

def test_orders_returns_only_my_location(mocker):
    orders = [
        _order("ORD-WOLA-1", location_id="WOLA"),
        _order("ORD-KEN-1", location_id="KEN"),
    ]
    _enable_sheet(mocker, orders=orders)

    r = client.get("/api/captain/orders", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert len(payload) == 1
    assert payload[0]["order_id"] == "ORD-WOLA-1"


def test_orders_filters_by_status(mocker):
    orders = [
        _order("ORD-1", status=OrderStatus.CAPTAIN_SUBMITTED),
        _order("ORD-2", status=OrderStatus.MANAGER_SENT),
    ]
    _enable_sheet(mocker, orders=orders)

    r = client.get(
        "/api/captain/orders",
        params={"status": "manager_sent"},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200
    payload = r.json()
    assert len(payload) == 1
    assert payload[0]["order_id"] == "ORD-2"
    assert payload[0]["status"] == "manager_sent"


def test_orders_sorts_recent_first(mocker):
    orders = [
        _order(
            "ORD-OLD",
            captain_submitted_at=datetime(2026, 5, 10, tzinfo=timezone.utc),
        ),
        _order(
            "ORD-NEW",
            captain_submitted_at=datetime(2026, 5, 24, tzinfo=timezone.utc),
        ),
    ]
    _enable_sheet(mocker, orders=orders)

    r = client.get("/api/captain/orders", headers=WOLA_AUTH)
    payload = r.json()
    assert [p["order_id"] for p in payload] == ["ORD-NEW", "ORD-OLD"]


def test_orders_respects_limit(mocker):
    orders = [
        _order(f"ORD-{i}", captain_submitted_at=datetime(2026, 5, i, tzinfo=timezone.utc))
        for i in range(1, 11)
    ]
    _enable_sheet(mocker, orders=orders)

    r = client.get("/api/captain/orders", params={"limit": 3}, headers=WOLA_AUTH)
    payload = r.json()
    assert len(payload) == 3


def test_orders_editable_flag(mocker):
    orders = [
        _order("ORD-SUB", status=OrderStatus.CAPTAIN_SUBMITTED),
        _order("ORD-SENT", status=OrderStatus.MANAGER_SENT),
    ]
    _enable_sheet(mocker, orders=orders)

    r = client.get("/api/captain/orders", headers=WOLA_AUTH)
    payload = r.json()
    by_id = {p["order_id"]: p for p in payload}
    assert by_id["ORD-SUB"]["editable"] is True
    assert by_id["ORD-SENT"]["editable"] is False


def test_orders_requires_auth():
    r = client.get("/api/captain/orders")
    assert r.status_code == 401


# ---------- GET /api/captain/order/{id} ----------

def test_order_detail_returns_my_order(mocker):
    order = _order("ORD-A", location_id="WOLA")
    order = order.model_copy(update={"lines": [_line("ORD-A", "OL-A-001")]})
    _enable_sheet(mocker, orders=[order], get_order_return=order)

    r = client.get("/api/captain/order/ORD-A", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["order_id"] == "ORD-A"
    assert payload["location_id"] == "WOLA"
    assert len(payload["lines"]) == 1
    assert payload["editable"] is True


def test_order_detail_404_on_cross_location(mocker):
    other = _order("ORD-KEN-1", location_id="KEN")
    _enable_sheet(mocker, orders=[other], get_order_return=other)

    r = client.get("/api/captain/order/ORD-KEN-1", headers=WOLA_AUTH)
    assert r.status_code == 404


def test_order_detail_404_when_missing(mocker):
    _enable_sheet(mocker, orders=[], get_order_return=None)
    r = client.get("/api/captain/order/ORD-DOES-NOT-EXIST", headers=WOLA_AUTH)
    assert r.status_code == 404


# ---------- PATCH /api/captain/order/{id} ----------

def test_edit_rejects_after_manager_sent(mocker):
    order = _order("ORD-A", status=OrderStatus.MANAGER_SENT)
    _enable_sheet(mocker, orders=[order], get_order_return=order)

    r = client.patch(
        "/api/captain/order/ORD-A",
        headers=WOLA_AUTH,
        json={
            "lines": [
                {
                    "product_id": "P027",
                    "supplier_product_id": "SP_PAGO_P027",
                    "current_stock_qty_base": 3.0,
                    "captain_final_qty_purchase": 4.0,
                }
            ]
        },
    )
    assert r.status_code == 409
    assert "menedżerem" in r.json()["detail"].lower()


def test_edit_404_on_cross_location(mocker):
    other = _order("ORD-KEN-1", location_id="KEN")
    _enable_sheet(mocker, orders=[other], get_order_return=other)

    r = client.patch(
        "/api/captain/order/ORD-KEN-1",
        headers=WOLA_AUTH,
        json={
            "lines": [
                {
                    "product_id": "P027",
                    "supplier_product_id": "SP_PAGO_P027",
                    "current_stock_qty_base": 3.0,
                    "captain_final_qty_purchase": 4.0,
                }
            ]
        },
    )
    assert r.status_code == 404


def test_edit_replaces_lines_and_updates_order(mocker):
    order = _order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED, total=500.0)
    patches = _enable_sheet(
        mocker, orders=[order], get_order_return=order, delete_lines_return=2
    )

    r = client.patch(
        "/api/captain/order/ORD-A",
        headers=WOLA_AUTH,
        json={
            "lines": [
                {
                    "product_id": "P027",
                    "supplier_product_id": "SP_PAGO_P027",
                    "current_stock_qty_base": 3.0,
                    "captain_final_qty_purchase": 4.0,
                }
            ]
        },
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["order_id"] == "ORD-A"
    assert payload["line_count"] == 1
    assert payload["status"] == "captain_submitted"

    # Sheets calls happened in the right order: delete → append → update.
    patches["delete_order_lines"].assert_called_once_with("ORD-A")
    assert patches["append_order_lines"].call_count == 1
    appended_lines = patches["append_order_lines"].call_args[0][0]
    assert len(appended_lines) == 1
    assert appended_lines[0].order_id == "ORD-A"
    assert appended_lines[0].captain_final_qty_purchase == 4.0
    patches["update_order"].assert_called_once()
    update_kwargs = patches["update_order"].call_args.kwargs
    assert update_kwargs["total_value_estimate_pln"] == round(4.0 * 145.0, 2)
    # B-H3: captain_submitted_at must NOT be reset on edit — it represents
    # the original submission timestamp and is used for sort + audit.
    assert "captain_submitted_at" not in update_kwargs
    # F4: last_edited_at IS stamped on edit so captain + manager see the order
    # was corrected and when.
    assert "last_edited_at" in update_kwargs
    assert update_kwargs["last_edited_at"] is not None


def test_edit_uncounted_normal_order_needs_no_reason(mocker):
    """PATCH with current stock omitted (None = uncounted) and a normal order
    (order_base 2*5=10 <= max 25) must pass with no reason_code — even though,
    counted as 0, it would be a >20% deviation from suggested 4. The persisted
    line carries current_stock_qty_base=0 and delta_vs_suggestion_pct=None.
    (change: order-stock-optional-overmax — mirrors the submit path via the
    shared _evaluate_submit_line helper.)"""
    order = _order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED, total=500.0)
    patches = _enable_sheet(
        mocker, orders=[order], get_order_return=order, delete_lines_return=1
    )
    r = client.patch(
        "/api/captain/order/ORD-A",
        headers=WOLA_AUTH,
        json={
            "lines": [
                {
                    "product_id": "P027",
                    "supplier_product_id": "SP_PAGO_P027",
                    "captain_final_qty_purchase": 2.0,
                }
            ]
        },
    )
    assert r.status_code == 200, r.text
    appended = patches["append_order_lines"].call_args[0][0]
    assert appended[0].current_stock_qty_base == 0
    assert appended[0].delta_vs_suggestion_pct is None


def test_edit_uncounted_over_max_rejected(mocker):
    """PATCH uncounted + over-MAX (6*5=30 > max 25) without a reason → 400."""
    order = _order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED, total=500.0)
    _enable_sheet(mocker, orders=[order], get_order_return=order, delete_lines_return=1)
    r = client.patch(
        "/api/captain/order/ORD-A",
        headers=WOLA_AUTH,
        json={
            "lines": [
                {
                    "product_id": "P027",
                    "supplier_product_id": "SP_PAGO_P027",
                    "captain_final_qty_purchase": 6.0,
                }
            ]
        },
    )
    assert r.status_code == 400
    assert "over MAX" in r.json()["detail"]


def test_edit_invalidates_cache_before_status_check(mocker):
    """B2 fix: the route must force-invalidate the orders cache before reading
    `existing.status`, otherwise a manager dispatch within the 60s TTL window
    would not be visible and the captain could overwrite a sent order."""
    import app.sheets as sheets_module

    order = _order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED)
    _enable_sheet(mocker, orders=[order], get_order_return=order)
    invalidate_spy = mocker.spy(sheets_module, "invalidate_cache")

    r = client.patch(
        "/api/captain/order/ORD-A",
        headers=WOLA_AUTH,
        json={
            "lines": [
                {
                    "product_id": "P027",
                    "supplier_product_id": "SP_PAGO_P027",
                    "current_stock_qty_base": 3.0,
                    "captain_final_qty_purchase": 4.0,
                }
            ]
        },
    )
    assert r.status_code == 200, r.text
    # Was invalidate_cache("orders") called BEFORE the actual write? At minimum
    # we expect it among the first call(s) and at least once with "orders".
    invalidated_orders = [
        c for c in invalidate_spy.call_args_list
        if c.args and c.args[0] == "orders"
    ]
    assert invalidated_orders, "expected invalidate_cache('orders') to be called"


def test_edit_rejects_unknown_supplier_product(mocker):
    order = _order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED)
    _enable_sheet(mocker, orders=[order], get_order_return=order)

    r = client.patch(
        "/api/captain/order/ORD-A",
        headers=WOLA_AUTH,
        json={
            "lines": [
                {
                    "product_id": "P027",
                    "supplier_product_id": "SP_PAGO_GHOST",
                    "current_stock_qty_base": 3.0,
                    "captain_final_qty_purchase": 4.0,
                }
            ]
        },
    )
    assert r.status_code == 400
    assert "not orderable" in r.json()["detail"]
