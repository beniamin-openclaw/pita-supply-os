"""Tests for POST /api/manager/dispatch (Phase C4).

Auth uses the same env-token model as test_main.py / test_captain_submit.py.
Tests mock the `sheets` module's read+write API to avoid hitting Google.
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
    Supplier,
    SupplierProduct,
)

client = TestClient(app)

MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}
CAPTAIN_AUTH = {"Authorization": "Bearer test_wola_token"}


# ---------- Fixtures ----------

def _captain_submitted_order(
    order_id: str = "ORD-20260520-WOL-PAGO-abc123",
    lines: list[OrderLine] | None = None,
    status: OrderStatus = OrderStatus.MANAGER_CLAIMED,
) -> Order:
    # Default status is MANAGER_CLAIMED: dispatch now requires the manager to
    # have claimed the order first (Phase F1 two-step flow). Rejection tests
    # override `status` to draft / manager_sent to exercise the 409 gate.
    return Order(
        order_id=order_id,
        location_id="WOLA",
        supplier_id="SUP_PAGO",
        order_date=date(2026, 5, 20),
        requested_delivery_date=date(2026, 5, 25),
        status=status,
        captain_user="WOLA",
        captain_submitted_at=datetime.now(timezone.utc),
        total_value_estimate_pln=668.0,
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
            OrderLine(
                order_line_id="OL-002",
                order_id=order_id,
                product_id="P026",
                supplier_product_id="SP_PAGO_P026",
                captain_final_qty_purchase=5,
                captain_final_qty_base=25,
            ),
        ],
    )


def _supplier(email: str | None = "zamowienia@pago.example") -> Supplier:
    return Supplier(supplier_id="SUP_PAGO", supplier_name="Pago", email=email)


def _location() -> Location:
    return Location(
        location_id="WOLA",
        location_name="Pita Bros Wola",
        delivery_address="Wolska 50, Warszawa",
    )


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


def _activate_sheet_backend(mocker, order: Order | None = None, supplier: Supplier | None = None):
    """Switch the backend selector to `sheets`, and stub all reads.

    `supplier` overrides the default email-channel Pago supplier (used by the
    channel-aware tests to inject a portal/phone supplier).

    Returns a dict of mocks so tests can assert on writes.
    """
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)

    mocker.patch.object(sheets, "get_order", return_value=order)
    mocker.patch.object(sheets, "load_suppliers", return_value=[supplier or _supplier()])
    mocker.patch.object(sheets, "load_locations", return_value=[_location()])
    mocker.patch.object(sheets, "load_products", return_value=_products())
    mocker.patch.object(sheets, "load_supplier_products", return_value=_supplier_products())

    mock_update_lines = mocker.patch.object(sheets, "update_order_lines")
    mock_update_order = mocker.patch.object(sheets, "update_order")

    return {
        "update_order_lines": mock_update_lines,
        "update_order": mock_update_order,
    }


# ---------- Tests ----------

def test_dispatch_happy_path(mocker):
    order = _captain_submitted_order()
    mocks = _activate_sheet_backend(mocker, order=order)

    body = {
        "order_id": order.order_id,
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 5},
            {"order_line_id": "OL-002", "manager_final_qty_purchase": 5},
        ],
        "sent_method": "gmail",
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["order_id"] == order.order_id
    assert out["status"] == "manager_sent"
    assert out["gmail_compose_url"].startswith("https://mail.google.com/mail/")
    assert out["supplier_email"] == "zamowienia@pago.example"
    # 5 * 145 + 5 * 94 = 1195
    assert out["total_value_estimate_pln"] == pytest.approx(1195.0)

    mocks["update_order_lines"].assert_called_once()
    mocks["update_order"].assert_called_once()


def test_dispatch_order_not_found(mocker):
    _activate_sheet_backend(mocker, order=None)
    body = {
        "order_id": "ORD-MISSING",
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 1}
        ],
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 404
    assert "not found" in r.json()["detail"]


def test_dispatch_wrong_status_draft(mocker):
    order = _captain_submitted_order()
    order = order.model_copy(update={"status": OrderStatus.DRAFT})
    _activate_sheet_backend(mocker, order=order)
    body = {
        "order_id": order.order_id,
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 1}
        ],
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 409
    assert "draft" in r.json()["detail"]


def test_dispatch_already_manager_sent(mocker):
    order = _captain_submitted_order()
    order = order.model_copy(update={"status": OrderStatus.MANAGER_SENT})
    _activate_sheet_backend(mocker, order=order)
    body = {
        "order_id": order.order_id,
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 1}
        ],
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 409
    assert "manager_sent" in r.json()["detail"]


def test_dispatch_unauthorized():
    body = {
        "order_id": "ORD-X",
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 1}
        ],
    }
    r = client.post("/api/manager/dispatch", json=body)
    assert r.status_code == 401


def test_dispatch_captain_token_rejected():
    body = {
        "order_id": "ORD-X",
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 1}
        ],
    }
    r = client.post("/api/manager/dispatch", json=body, headers=CAPTAIN_AUTH)
    assert r.status_code == 401


def test_dispatch_supplier_no_email(mocker):
    order = _captain_submitted_order()
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "get_order", return_value=order)
    mocker.patch.object(sheets, "load_suppliers", return_value=[_supplier(email=None)])
    mocker.patch.object(sheets, "load_locations", return_value=[_location()])
    mocker.patch.object(sheets, "load_products", return_value=_products())
    mocker.patch.object(sheets, "load_supplier_products", return_value=_supplier_products())

    body = {
        "order_id": order.order_id,
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 5}
        ],
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 400
    assert "no email" in r.json()["detail"]


def test_dispatch_concurrent_dispatch_raises(mocker):
    order = _captain_submitted_order()
    mocks = _activate_sheet_backend(mocker, order=order)
    mocks["update_order"].side_effect = sheets.OrderAlreadyDispatchedError(
        f"order_id={order.order_id!r} is already in status 'manager_sent'"
    )

    body = {
        "order_id": order.order_id,
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 5}
        ],
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 409
    assert "concurrently" in r.json()["detail"]


def test_dispatch_seed_mode_not_supported(mocker):
    """Default DataBackend=SEED → 503."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SEED)
    body = {
        "order_id": "ORD-X",
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 1}
        ],
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 503
    assert "sheet" in r.json()["detail"]


def test_dispatch_writes_lines_before_status(mocker):
    """Persistence order matters: lines first, then order status row.

    If status flips to manager_sent before lines have the manager_final qty,
    a crash mid-way leaves the sheet in an inconsistent state.
    """
    order = _captain_submitted_order()
    mocks = _activate_sheet_backend(mocker, order=order)

    call_order: list[str] = []
    mocks["update_order_lines"].side_effect = lambda *a, **k: call_order.append("lines")
    mocks["update_order"].side_effect = lambda *a, **k: call_order.append("order")

    body = {
        "order_id": order.order_id,
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 5},
            {"order_line_id": "OL-002", "manager_final_qty_purchase": 5},
        ],
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert call_order == ["lines", "order"]


def test_dispatch_total_recomputed_with_manager_finals(mocker):
    """Captain submitted 5+5 (= 1195 PLN). Manager changes to 2+2 → 478 PLN."""
    order = _captain_submitted_order()
    mocks = _activate_sheet_backend(mocker, order=order)

    body = {
        "order_id": order.order_id,
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 2},
            {"order_line_id": "OL-002", "manager_final_qty_purchase": 2},
        ],
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    # 2 * 145 + 2 * 94 = 478
    assert r.json()["total_value_estimate_pln"] == pytest.approx(478.0)

    # And update_order was called with the new total
    _, kwargs = mocks["update_order"].call_args
    assert kwargs.get("total_value_estimate_pln") == pytest.approx(478.0)
    assert kwargs.get("status") == OrderStatus.MANAGER_SENT.value


def test_dispatch_update_order_lines_called_with_correct_payload(mocker):
    """Verify the field-name keys we pass to update_order_lines match sheets API."""
    order = _captain_submitted_order()
    mocks = _activate_sheet_backend(mocker, order=order)

    body = {
        "order_id": order.order_id,
        "manager_finals": [
            {
                "order_line_id": "OL-001",
                "manager_final_qty_purchase": 3,
                "manager_comment": "Cut from 5 — leftover from last week",
            }
        ],
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text

    args, _ = mocks["update_order_lines"].call_args
    passed_order_id, passed_updates = args
    assert passed_order_id == order.order_id
    assert "OL-001" in passed_updates
    payload = passed_updates["OL-001"]
    assert payload["manager_final_qty_purchase"] == 3
    # 3 * 5 (units_per_pu) = 15
    assert payload["manager_final_qty_base"] == pytest.approx(15.0)
    assert payload["manager_comment"] == "Cut from 5 — leftover from last week"


def test_dispatch_empty_manager_finals():
    """Pydantic min_length=1 → 422."""
    body = {"order_id": "ORD-X", "manager_finals": []}
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 422


# ---------- Channel-aware dispatch (Phase G3) ----------

from app.models import OrderingMethod  # noqa: E402


def _portal_supplier() -> Supplier:
    # Same supplier_id as the order fixture so the lookup matches; portal channel,
    # no email (Coca-Cola is email=TBD in the real seed).
    return Supplier(
        supplier_id="SUP_PAGO",
        supplier_name="Coca-Cola",
        email=None,
        ordering_method=OrderingMethod.PORTAL,
    )


def _phone_supplier() -> Supplier:
    return Supplier(
        supplier_id="SUP_PAGO",
        supplier_name="Kamino",
        email=None,
        ordering_method=OrderingMethod.PHONE,
        notes="tel: +48 600 000 000",
    )


def test_dispatch_portal_no_email_no_url(mocker):
    """Portal supplier (no email) → 200, manager_sent, gmail_compose_url=None."""
    order = _captain_submitted_order()
    mocks = _activate_sheet_backend(mocker, order=order, supplier=_portal_supplier())

    body = {
        "order_id": order.order_id,
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 5},
            {"order_line_id": "OL-002", "manager_final_qty_purchase": 5},
        ],
        "sent_method": "portal",
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["status"] == "manager_sent"
    assert out["gmail_compose_url"] is None
    # Still persists the transition with the portal sent_method.
    _, kwargs = mocks["update_order"].call_args
    assert kwargs.get("status") == OrderStatus.MANAGER_SENT.value
    assert kwargs.get("sent_method") == "portal"


def test_dispatch_phone_marks_ordered(mocker):
    """Phone supplier → 200, no URL, sent_method persisted as phone."""
    order = _captain_submitted_order()
    mocks = _activate_sheet_backend(mocker, order=order, supplier=_phone_supplier())

    body = {
        "order_id": order.order_id,
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 5},
            {"order_line_id": "OL-002", "manager_final_qty_purchase": 5},
        ],
        "sent_method": "phone",
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["gmail_compose_url"] is None
    _, kwargs = mocks["update_order"].call_args
    assert kwargs.get("sent_method") == "phone"


def test_dispatch_portal_does_not_require_email(mocker):
    """A portal supplier with no email must NOT 400 (that's the v0 footgun)."""
    order = _captain_submitted_order()
    _activate_sheet_backend(mocker, order=order, supplier=_portal_supplier())
    body = {
        "order_id": order.order_id,
        "manager_finals": [{"order_line_id": "OL-001", "manager_final_qty_purchase": 1}],
        "sent_method": "portal",
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text


def test_dispatch_email_channel_still_requires_email(mocker):
    """Email-channel supplier with no email still 400s (regression guard)."""
    order = _captain_submitted_order()
    no_email_email_supplier = Supplier(
        supplier_id="SUP_PAGO", supplier_name="Pago", email=None,
        ordering_method=OrderingMethod.EMAIL,
    )
    _activate_sheet_backend(mocker, order=order, supplier=no_email_email_supplier)
    body = {
        "order_id": order.order_id,
        "manager_finals": [{"order_line_id": "OL-001", "manager_final_qty_purchase": 1}],
    }
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 400
    assert "no email" in r.json()["detail"]
