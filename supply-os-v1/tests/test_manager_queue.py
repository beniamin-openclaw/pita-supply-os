"""Tests for GET /api/manager/queue and /api/manager/order/{id} (Phase D0).

Strategy mirrors test_manager_dispatch.py: monkey-patch the `sheets` module
so we never need real Google credentials. The endpoints select the backend
through `_choose_backend()`, so flipping `sheets.is_configured` + the
settings.data_backend is enough to route reads at it.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app import sheets
from app.config import DataBackend
from app.main import app
from app.models import (
    Location,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    ReasonCode,
    Supplier,
    SupplierProduct,
)

client = TestClient(app)

MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}
CAPTAIN_AUTH = {"Authorization": "Bearer test_wola_token"}


# ---------- Fixture builders ----------

def _order(
    order_id: str,
    location_id: str = "WOLA",
    supplier_id: str = "SUP_PAGO",
    status: OrderStatus = OrderStatus.CAPTAIN_SUBMITTED,
    total: float = 668.0,
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
        captain_comment="",
        manager_comment="",
    )


def _supplier(
    supplier_id: str = "SUP_PAGO",
    name: str = "Pago",
    email: str | None = "zamowienia@pago.example",
    delivery_days: str | None = None,
    cutoff_time: str | None = None,
) -> Supplier:
    return Supplier(
        supplier_id=supplier_id,
        supplier_name=name,
        email=email,
        delivery_days=delivery_days,
        cutoff_time=cutoff_time,
    )


def _product(product_id: str = "P027", name: str = "Souvlaki Kurczak") -> Product:
    return Product(
        product_id=product_id,
        product_name_pl=name,
        product_category="Mięso",
        inventory_unit="kg",
        is_critical=False,
    )


def _supplier_product(
    sp_id: str = "SP_PAGO_P027",
    supplier_id: str = "SUP_PAGO",
    product_id: str = "P027",
    name: str = "Souvlaki Kurczak karton",
    price: float | None = 145.0,
) -> SupplierProduct:
    return SupplierProduct(
        supplier_product_id=sp_id,
        supplier_id=supplier_id,
        product_id=product_id,
        supplier_product_name=name,
        purchase_unit="karton",
        units_per_purchase_unit=5.0,
        price_estimate_pln=price,
    )


def _location(location_id: str = "WOLA", name: str = "Pita Bros Wola") -> Location:
    return Location(
        location_id=location_id,
        location_name=name,
        delivery_address="Wolska 50, Warszawa",
    )


def _enable_sheet_backend(
    mocker,
    orders: list[Order],
    lines: list[OrderLine] | None = None,
    suppliers: list[Supplier] | None = None,
    products: list[Product] | None = None,
    supplier_products: list[SupplierProduct] | None = None,
    locations: list[Location] | None = None,
    get_order_return: Order | None = None,
) -> dict:
    """Switch backend selector to sheets and patch the load_* surface."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)

    mocker.patch.object(sheets, "load_orders", return_value=orders)
    mocker.patch.object(sheets, "load_order_lines", return_value=lines or [])
    mocker.patch.object(
        sheets, "load_suppliers", return_value=suppliers or [_supplier()]
    )
    mocker.patch.object(
        sheets, "load_products", return_value=products or [_product()]
    )
    mocker.patch.object(
        sheets,
        "load_supplier_products",
        return_value=supplier_products or [_supplier_product()],
    )
    mocker.patch.object(
        sheets, "load_locations", return_value=locations or [_location()]
    )
    # manager_order_detail / captain_order_detail join location_product_settings
    # for the over-MAX fields (S-12); these tests don't assert on them, so an
    # empty list (→ defaults 0/False) keeps them off the live-Sheet path.
    mocker.patch.object(
        sheets, "load_location_product_settings", return_value=[]
    )
    get_order_mock = mocker.patch.object(
        sheets, "get_order", return_value=get_order_return
    )
    return {"get_order": get_order_mock}


# ---------- /api/manager/queue ----------

def test_queue_returns_only_matching_status(mocker):
    orders = [
        _order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED),
        _order("ORD-B", status=OrderStatus.MANAGER_SENT),
        _order("ORD-C", status=OrderStatus.DRAFT),
    ]
    _enable_sheet_backend(mocker, orders=orders)

    r = client.get("/api/manager/queue", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert len(payload) == 1
    assert payload[0]["order_id"] == "ORD-A"
    assert payload[0]["status"] == "captain_submitted"


def test_queue_returns_only_matching_location(mocker):
    orders = [
        _order("ORD-WOLA", location_id="WOLA"),
        _order("ORD-KEN", location_id="KEN"),
    ]
    _enable_sheet_backend(mocker, orders=orders)

    r = client.get(
        "/api/manager/queue", params={"location_id": "WOLA"}, headers=MANAGER_AUTH
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert len(payload) == 1
    assert payload[0]["order_id"] == "ORD-WOLA"
    assert payload[0]["location_id"] == "WOLA"


def test_queue_joins_supplier_name(mocker):
    orders = [_order("ORD-A", supplier_id="SUP_PAGO")]
    suppliers = [_supplier(supplier_id="SUP_PAGO", name="Pago Sp. z o.o.")]
    _enable_sheet_backend(mocker, orders=orders, suppliers=suppliers)

    r = client.get("/api/manager/queue", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload[0]["supplier_name"] == "Pago Sp. z o.o."


def test_queue_computes_line_count_correctly(mocker):
    orders = [_order("ORD-A")]
    lines = [
        _line("ORD-A", "OL-1"),
        _line("ORD-A", "OL-2"),
        _line("ORD-A", "OL-3"),
        _line("ORD-OTHER", "OL-Z"),  # should be ignored
    ]
    _enable_sheet_backend(mocker, orders=orders, lines=lines)

    r = client.get("/api/manager/queue", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload[0]["line_count"] == 3


def test_queue_computes_deviation_count(mocker):
    orders = [_order("ORD-A")]
    lines = [
        _line("ORD-A", "OL-1", delta_pct=0.25, reason_code=ReasonCode.OTHER),
        _line("ORD-A", "OL-2", delta_pct=0.10),
        _line("ORD-A", "OL-3", delta_pct=0.05),
    ]
    _enable_sheet_backend(mocker, orders=orders, lines=lines)

    r = client.get("/api/manager/queue", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload[0]["deviation_count"] == 1
    assert payload[0]["line_count"] == 3


def test_queue_computes_reason_count(mocker):
    orders = [_order("ORD-A")]
    lines = [
        _line("ORD-A", "OL-1", reason_code=ReasonCode.LOW_STORAGE),
        _line("ORD-A", "OL-2", reason_code=ReasonCode.OTHER),
        _line("ORD-A", "OL-3", reason_code=None),
    ]
    _enable_sheet_backend(mocker, orders=orders, lines=lines)

    r = client.get("/api/manager/queue", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload[0]["reason_count"] == 2


def test_queue_seed_mode_returns_empty_list_with_warning(mocker, caplog):
    """Seed backend cannot serve queues — must short-circuit to []."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SEED)
    # Make absolutely sure we never read orders in seed mode.
    fail = mocker.patch.object(
        sheets, "load_orders", side_effect=AssertionError("must not be called")
    )

    import logging
    with caplog.at_level(logging.WARNING):
        r = client.get("/api/manager/queue", headers=MANAGER_AUTH)
    assert r.status_code == 200
    assert r.json() == []
    assert any("seed" in rec.message.lower() for rec in caplog.records)
    fail.assert_not_called()


def test_queue_unauthorized_no_manager_token():
    r = client.get("/api/manager/queue")
    assert r.status_code == 401


def test_queue_captain_token_rejected():
    r = client.get("/api/manager/queue", headers=CAPTAIN_AUTH)
    assert r.status_code == 401


def test_queue_cutoff_iso_for_known_supplier(mocker):
    """Pago: Tue 14:00 → cutoff is parseable and returned as ISO datetime."""
    orders = [_order("ORD-A")]
    suppliers = [
        _supplier(delivery_days="Tue", cutoff_time="14:00"),
    ]
    _enable_sheet_backend(mocker, orders=orders, suppliers=suppliers)

    r = client.get("/api/manager/queue", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload[0]["cutoff_iso"] is not None
    # Parse the returned ISO and confirm it's a Tuesday at 14:00 Europe/Warsaw.
    from zoneinfo import ZoneInfo
    parsed = datetime.fromisoformat(payload[0]["cutoff_iso"])
    local = parsed.astimezone(ZoneInfo("Europe/Warsaw"))
    assert local.weekday() == 1  # Tuesday
    assert (local.hour, local.minute) == (14, 0)


def test_queue_cutoff_iso_none_when_supplier_missing_fields(mocker):
    orders = [_order("ORD-A")]
    suppliers = [_supplier(delivery_days=None, cutoff_time=None)]
    _enable_sheet_backend(mocker, orders=orders, suppliers=suppliers)

    r = client.get("/api/manager/queue", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()[0]["cutoff_iso"] is None


# ---------- /api/manager/order/{id} ----------

def test_order_detail_happy_path(mocker):
    order_id = "ORD-DETAIL-1"
    order = _order(order_id)
    order = order.model_copy(
        update={
            "lines": [
                _line(order_id, "OL-1", product_id="P027", sp_id="SP_PAGO_P027"),
                _line(order_id, "OL-2", product_id="P027", sp_id="SP_PAGO_P027"),
            ]
        }
    )
    _enable_sheet_backend(mocker, orders=[order], get_order_return=order)

    r = client.get(f"/api/manager/order/{order_id}", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["order_id"] == order_id
    assert payload["status"] == "captain_submitted"
    assert len(payload["lines"]) == 2


def test_order_detail_not_found(mocker):
    _enable_sheet_backend(mocker, orders=[], get_order_return=None)

    r = client.get("/api/manager/order/ORD-DOES-NOT-EXIST", headers=MANAGER_AUTH)
    assert r.status_code == 404
    assert "not found" in r.json()["detail"].lower()


def test_order_detail_seed_mode_returns_503(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SEED)
    r = client.get("/api/manager/order/ORD-X", headers=MANAGER_AUTH)
    assert r.status_code == 503
    assert "sheet" in r.json()["detail"].lower()


def test_order_detail_joins_product_supplier_location(mocker):
    """Enrichment: product_name_pl, supplier_product_name, location_name, supplier_email."""
    order_id = "ORD-ENRICHED"
    order = _order(order_id, location_id="WOLA", supplier_id="SUP_PAGO")
    order = order.model_copy(
        update={
            "lines": [_line(order_id, "OL-1", product_id="P027", sp_id="SP_PAGO_P027")]
        }
    )
    _enable_sheet_backend(
        mocker,
        orders=[order],
        get_order_return=order,
        products=[_product("P027", "Souvlaki Kurczak")],
        supplier_products=[
            _supplier_product("SP_PAGO_P027", "SUP_PAGO", "P027", "Souvlaki Karton 5kg", price=145.0)
        ],
        suppliers=[_supplier("SUP_PAGO", "Pago", email="zamowienia@pago.example")],
        locations=[_location("WOLA", "Pita Bros Wola")],
    )

    r = client.get(f"/api/manager/order/{order_id}", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["location_name"] == "Pita Bros Wola"
    assert payload["supplier_name"] == "Pago"
    assert payload["supplier_email"] == "zamowienia@pago.example"
    line = payload["lines"][0]
    assert line["product_name_pl"] == "Souvlaki Kurczak"
    assert line["inventory_unit"] == "kg"
    assert line["supplier_product_name"] == "Souvlaki Karton 5kg"
    assert line["purchase_unit"] == "karton"
    assert line["price_estimate_pln"] == pytest.approx(145.0)


def test_order_detail_unauthorized():
    r = client.get("/api/manager/order/ORD-X")
    assert r.status_code == 401


def test_order_detail_captain_token_rejected():
    r = client.get("/api/manager/order/ORD-X", headers=CAPTAIN_AUTH)
    assert r.status_code == 401
