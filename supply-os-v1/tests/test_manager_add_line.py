"""Tests for the Manager add-ad-hoc-product flow (add-product-to-order):

    GET  /api/manager/orderable            — manager-auth twin of captain orderable
    POST /api/manager/order/{id}/add-line  — append one skeleton OrderLine

The add-line endpoint gates on `_is_persistent(backend)`; the seed backend returns
503 before any business logic. So these tests enable the sheet backend and stub its
read/write surface — the same pattern as test_manager_dispatch.py / test_manager_
claim_release.py. NO real supplier orders placed (writes are mocked).
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from app import sheets
from app.config import DataBackend
from app.main import app
from app.models import (
    LocationProductSetting,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    SupplierProduct,
)

client = TestClient(app)

MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}
CAPTAIN_AUTH = {"Authorization": "Bearer test_wola_token"}


# ---------- Fixtures ----------

def _products() -> list[Product]:
    return [
        Product(product_id="P027", product_name_pl="Souvlaki Kurczak", product_category="Mięso", inventory_unit="kg"),
        Product(product_id="P026", product_name_pl="Gyros Wieprz", product_category="Mięso", inventory_unit="kg"),
    ]


def _supplier_products() -> list[SupplierProduct]:
    return [
        SupplierProduct(
            supplier_product_id="SP_PAGO_P027",
            supplier_id="SUP_PAGO",
            product_id="P027",
            supplier_product_name="Souvlaki Kurczak karton",
            purchase_unit="karton",
            units_per_purchase_unit=5.0,
            price_estimate_pln=145.0,
        ),
        SupplierProduct(
            supplier_product_id="SP_PAGO_P026",
            supplier_id="SUP_PAGO",
            product_id="P026",
            supplier_product_name="Gyros karton",
            purchase_unit="karton",
            units_per_purchase_unit=5.0,
            price_estimate_pln=94.0,
        ),
    ]


def _settings() -> list[LocationProductSetting]:
    return [
        LocationProductSetting(
            setting_id="LPS-WOLA-P027",
            location_id="WOLA",
            product_id="P027",
            target_stock_qty_base=25,
            max_stock_qty_base=40,
        ),
        LocationProductSetting(
            setting_id="LPS-WOLA-P026",
            location_id="WOLA",
            product_id="P026",
            target_stock_qty_base=10,
            max_stock_qty_base=20,
        ),
    ]


def _order(
    order_id: str = "ORD-20260520-WOL-PAGO-abc123",
    status: OrderStatus = OrderStatus.MANAGER_CLAIMED,
    lines: list[OrderLine] | None = None,
) -> Order:
    return Order(
        order_id=order_id,
        location_id="WOLA",
        supplier_id="SUP_PAGO",
        order_date=date(2026, 5, 20),
        status=status,
        captain_user="WOLA",
        captain_submitted_at=datetime(2026, 5, 20, 8, 30, tzinfo=timezone.utc),
        total_value_estimate_pln=725.0,
        lines=lines
        or [
            OrderLine(
                order_line_id="OL-001",
                order_id=order_id,
                product_id="P027",
                supplier_product_id="SP_PAGO_P027",
                captain_final_qty_purchase=5,
                captain_final_qty_base=25,
            ),
        ],
    )


def _enable_sheet(mocker, order: Order | None = None):
    """Switch the backend selector to `sheets` and stub the reads + the single
    write the add-line path uses. Returns mocks so tests can assert on writes."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "invalidate_cache", return_value=None)
    mocker.patch.object(sheets, "get_order", return_value=order)
    mocker.patch.object(sheets, "load_products", return_value=_products())
    mocker.patch.object(sheets, "load_supplier_products", return_value=_supplier_products())
    mocker.patch.object(
        sheets, "load_location_product_settings", return_value=_settings()
    )
    append_mock = mocker.patch.object(sheets, "append_order_lines", return_value=None)
    return {"append_order_lines": append_mock}


# ---------- GET /api/manager/orderable ----------

def test_manager_orderable_happy(mocker):
    _enable_sheet(mocker)
    r = client.get(
        "/api/manager/orderable?supplier_id=SUP_PAGO&location_id=WOLA",
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    items = r.json()
    assert {it["product_id"] for it in items} == {"P027", "P026"}
    # Same enriched shape as captain orderable.
    p026 = next(it for it in items if it["product_id"] == "P026")
    assert p026["supplier_product_id"] == "SP_PAGO_P026"
    assert p026["purchase_unit"] == "karton"
    assert p026["target_stock_qty_base"] == 10


def test_manager_orderable_empty_for_unknown_supplier(mocker):
    _enable_sheet(mocker)
    r = client.get(
        "/api/manager/orderable?supplier_id=SUP_NONE&location_id=WOLA",
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_manager_orderable_requires_manager_auth(mocker):
    _enable_sheet(mocker)
    r = client.get(
        "/api/manager/orderable?supplier_id=SUP_PAGO&location_id=WOLA",
        headers=CAPTAIN_AUTH,
    )
    assert r.status_code == 401


def test_manager_orderable_missing_location_param(mocker):
    _enable_sheet(mocker)
    r = client.get("/api/manager/orderable?supplier_id=SUP_PAGO", headers=MANAGER_AUTH)
    assert r.status_code == 422  # FastAPI: required query param missing


# ---------- POST /api/manager/order/{id}/add-line ----------

def test_add_line_happy_path(mocker):
    order = _order()
    mocks = _enable_sheet(mocker, order=order)
    r = client.post(
        f"/api/manager/order/{order.order_id}/add-line",
        json={"product_id": "P026", "supplier_product_id": "SP_PAGO_P026"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["order_id"] == order.order_id
    assert out["status"] == "manager_claimed"
    assert out["order_line_id"].startswith(f"OL-{order.order_id}-M-")

    mocks["append_order_lines"].assert_called_once()
    appended = mocks["append_order_lines"].call_args.args[0]
    assert len(appended) == 1
    line = appended[0]
    assert isinstance(line, OrderLine)
    assert line.product_id == "P026"
    assert line.supplier_product_id == "SP_PAGO_P026"
    # Skeleton line: every quantity 0, no deviation, target carried from setting.
    assert line.captain_final_qty_purchase == 0
    assert line.manager_final_qty_purchase == 0
    assert line.current_stock_qty_base == 0
    assert line.suggested_qty_purchase == 0
    assert line.delta_vs_suggestion_pct is None
    assert line.target_stock_qty_base == 10
    assert line.order_id == order.order_id


def test_add_line_order_not_found(mocker):
    mocks = _enable_sheet(mocker, order=None)
    r = client.post(
        "/api/manager/order/ORD-MISSING/add-line",
        json={"product_id": "P026", "supplier_product_id": "SP_PAGO_P026"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 404
    mocks["append_order_lines"].assert_not_called()


def test_add_line_rejects_non_claimed_status(mocker):
    order = _order(status=OrderStatus.CAPTAIN_SUBMITTED)
    mocks = _enable_sheet(mocker, order=order)
    r = client.post(
        f"/api/manager/order/{order.order_id}/add-line",
        json={"product_id": "P026", "supplier_product_id": "SP_PAGO_P026"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 409
    assert "manager_claimed" in r.json()["detail"]
    mocks["append_order_lines"].assert_not_called()


def test_add_line_rejects_non_orderable_supplier_product(mocker):
    order = _order()
    mocks = _enable_sheet(mocker, order=order)
    r = client.post(
        f"/api/manager/order/{order.order_id}/add-line",
        json={"product_id": "P099", "supplier_product_id": "SP_NOPE"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 400
    assert "not orderable" in r.json()["detail"]
    mocks["append_order_lines"].assert_not_called()


def test_add_line_rejects_product_mismatch(mocker):
    order = _order()
    mocks = _enable_sheet(mocker, order=order)
    # SP_PAGO_P026 maps to P026, but the body claims P027 → mismatch.
    r = client.post(
        f"/api/manager/order/{order.order_id}/add-line",
        json={"product_id": "P027", "supplier_product_id": "SP_PAGO_P026"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 400
    assert "does not map" in r.json()["detail"]
    mocks["append_order_lines"].assert_not_called()


def test_add_line_rejects_duplicate_product(mocker):
    order = _order()  # already has P027
    mocks = _enable_sheet(mocker, order=order)
    r = client.post(
        f"/api/manager/order/{order.order_id}/add-line",
        json={"product_id": "P027", "supplier_product_id": "SP_PAGO_P027"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 400
    assert "already on order" in r.json()["detail"]
    mocks["append_order_lines"].assert_not_called()


def test_add_line_requires_manager_auth(mocker):
    order = _order()
    _enable_sheet(mocker, order=order)
    r = client.post(
        f"/api/manager/order/{order.order_id}/add-line",
        json={"product_id": "P026", "supplier_product_id": "SP_PAGO_P026"},
        headers=CAPTAIN_AUTH,
    )
    assert r.status_code == 401


def test_add_line_blank_ids_rejected_422(mocker):
    # Field(min_length=1) on the request model → a blank id is a clean 422 before
    # the business gates run (consistent with other ID fields in the codebase).
    order = _order()
    _enable_sheet(mocker, order=order)
    r = client.post(
        f"/api/manager/order/{order.order_id}/add-line",
        json={"product_id": "", "supplier_product_id": "SP_PAGO_P026"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 422


def test_add_line_seed_backend_returns_503():
    # No sheet patch → conftest's default seed backend → _is_persistent False.
    r = client.post(
        "/api/manager/order/ORD-X/add-line",
        json={"product_id": "P026", "supplier_product_id": "SP_PAGO_P026"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 503
    assert "persistent backend" in r.json()["detail"]
