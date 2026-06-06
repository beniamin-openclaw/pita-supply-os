"""Tests for PATCH /api/manager/order/{order_id} — save manager edits WITHOUT
dispatch (Phase G2).

Mirrors the dispatch test harness: mock the `sheets` module's read+write API.
The save endpoint keeps status manager_claimed and must:
  - 409 if the order is no longer manager_claimed (its own preflight),
  - write the full read-modify-write payload (qty + comment) per touched line,
  - recompute total over the effective quantities,
  - treat an empty payload as a no-op (no write).
"""
from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app import sheets
from app.config import DataBackend
from app.main import app
from app.models import (
    Order,
    OrderLine,
    OrderStatus,
    SupplierProduct,
)

client = TestClient(app)

MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}
CAPTAIN_AUTH = {"Authorization": "Bearer test_wola_token"}

ORDER_ID = "ORD-20260520-WOL-PAGO-abc123"


# ---------- Fixtures ----------

def _claimed_order(
    status: OrderStatus = OrderStatus.MANAGER_CLAIMED,
    lines: list[OrderLine] | None = None,
) -> Order:
    return Order(
        order_id=ORDER_ID,
        location_id="WOLA",
        supplier_id="SUP_PAGO",
        order_date=date(2026, 5, 20),
        requested_delivery_date=date(2026, 5, 25),
        status=status,
        captain_user="WOLA",
        captain_submitted_at=datetime.now(timezone.utc),
        total_value_estimate_pln=1195.0,
        lines=lines
        or [
            OrderLine(
                order_line_id="OL-001",
                order_id=ORDER_ID,
                product_id="P027",
                supplier_product_id="SP_PAGO_P027",
                captain_final_qty_purchase=5,
                captain_final_qty_base=25,
            ),
            OrderLine(
                order_line_id="OL-002",
                order_id=ORDER_ID,
                product_id="P026",
                supplier_product_id="SP_PAGO_P026",
                captain_final_qty_purchase=5,
                captain_final_qty_base=25,
            ),
        ],
    )


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


def _activate(mocker, order: Order | None):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "get_order", return_value=order)
    mocker.patch.object(sheets, "load_supplier_products", return_value=_supplier_products())
    mock_update_lines = mocker.patch.object(sheets, "update_order_lines")
    mock_update_order = mocker.patch.object(sheets, "update_order")
    return {"update_order_lines": mock_update_lines, "update_order": mock_update_order}


def _patch(body: dict, headers=MANAGER_AUTH):
    return client.patch(f"/api/manager/order/{ORDER_ID}", json=body, headers=headers)


# ---------- Tests ----------

def test_save_happy_path(mocker):
    mocks = _activate(mocker, _claimed_order())
    body = {
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 3, "manager_comment": "cut"},
            {"order_line_id": "OL-002", "manager_final_qty_purchase": 5},
        ]
    }
    r = _patch(body)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["status"] == "manager_claimed"  # NOT manager_sent — this is save, not dispatch
    assert out["lines_updated"] == 2
    # 3 * 145 + 5 * 94 = 905
    assert out["total_value_estimate_pln"] == pytest.approx(905.0)
    mocks["update_order_lines"].assert_called_once()
    mocks["update_order"].assert_called_once()
    # update_order must NOT flip status (no status kwarg passed).
    _, kwargs = mocks["update_order"].call_args
    assert "status" not in kwargs
    assert kwargs.get("total_value_estimate_pln") == pytest.approx(905.0)


def test_save_writes_full_qty_and_comment(mocker):
    """Read-modify-write contract: both qty fields + comment land on the line."""
    mocks = _activate(mocker, _claimed_order())
    body = {
        "manager_finals": [
            {"order_line_id": "OL-001", "manager_final_qty_purchase": 3,
             "manager_comment": "Cut from 5 — leftover"},
        ]
    }
    r = _patch(body)
    assert r.status_code == 200, r.text
    args, _ = mocks["update_order_lines"].call_args
    order_id, updates = args
    assert order_id == ORDER_ID
    payload = updates["OL-001"]
    assert payload["manager_final_qty_purchase"] == 3
    assert payload["manager_final_qty_base"] == pytest.approx(15.0)  # 3 * 5
    assert payload["manager_comment"] == "Cut from 5 — leftover"


def test_save_409_when_already_dispatched(mocker):
    _activate(mocker, _claimed_order(status=OrderStatus.MANAGER_SENT))
    r = _patch({"manager_finals": [{"order_line_id": "OL-001", "manager_final_qty_purchase": 1}]})
    assert r.status_code == 409
    assert "manager_sent" in r.json()["detail"]


def test_save_409_when_back_with_captain(mocker):
    _activate(mocker, _claimed_order(status=OrderStatus.CAPTAIN_SUBMITTED))
    r = _patch({"manager_finals": [{"order_line_id": "OL-001", "manager_final_qty_purchase": 1}]})
    assert r.status_code == 409
    assert "captain_submitted" in r.json()["detail"]


def test_save_404_not_found(mocker):
    _activate(mocker, None)
    r = _patch({"manager_finals": [{"order_line_id": "OL-001", "manager_final_qty_purchase": 1}]})
    assert r.status_code == 404


def test_save_empty_payload_is_noop(mocker):
    """Empty manager_finals → 200, no writes, current stored total returned."""
    mocks = _activate(mocker, _claimed_order())
    r = _patch({"manager_finals": []})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["lines_updated"] == 0
    # Effective qty for untouched lines = captain 5 + 5 → 5*145 + 5*94 = 1195
    assert out["total_value_estimate_pln"] == pytest.approx(1195.0)
    mocks["update_order_lines"].assert_not_called()
    mocks["update_order"].assert_not_called()


def test_save_total_uses_effective_qty_for_untouched_lines(mocker):
    """One line edited, the other untouched → total mixes new + captain default."""
    _activate(mocker, _claimed_order())
    body = {"manager_finals": [{"order_line_id": "OL-001", "manager_final_qty_purchase": 2}]}
    r = _patch(body)
    assert r.status_code == 200, r.text
    # OL-001 edited to 2 (*145=290); OL-002 untouched → captain 5 (*94=470) = 760
    assert r.json()["total_value_estimate_pln"] == pytest.approx(760.0)
    assert r.json()["lines_updated"] == 1


def test_save_503_seed_mode(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SEED)
    r = _patch({"manager_finals": [{"order_line_id": "OL-001", "manager_final_qty_purchase": 1}]})
    assert r.status_code == 503
    assert "sheet" in r.json()["detail"]


def test_save_unauthorized():
    r = client.patch(f"/api/manager/order/{ORDER_ID}", json={"manager_finals": []})
    assert r.status_code == 401


def test_save_captain_token_rejected():
    r = client.patch(
        f"/api/manager/order/{ORDER_ID}", json={"manager_finals": []}, headers=CAPTAIN_AUTH
    )
    assert r.status_code == 401
