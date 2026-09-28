"""Tests for the manager claim / release state machine (Phase F1).

Flow: captain_submitted ──claim──► manager_claimed ──dispatch──► manager_sent
                                         │
                                         └──release(reason)──► captain_submitted

Fixtures mirror test_manager_queue.py: monkeypatch the sheets surface.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from app import sheets
from app.config import DataBackend
from app.main import app
from app.models import Order, OrderLine, OrderStatus

client = TestClient(app)
MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}
CAPTAIN_AUTH = {"Authorization": "Bearer test_wola_token"}


def _order(order_id: str = "ORD-A", status: OrderStatus = OrderStatus.CAPTAIN_SUBMITTED) -> Order:
    return Order(
        order_id=order_id,
        location_id="WOLA",
        supplier_id="SUP_PAGO",
        order_date=date(2026, 5, 20),
        status=status,
        captain_user="WOLA",
        captain_submitted_at=datetime(2026, 5, 20, 8, 30, tzinfo=timezone.utc),
        total_value_estimate_pln=500.0,
    )


def _enable_sheet(mocker, order: Order):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "get_order", return_value=order)
    mocker.patch.object(sheets, "invalidate_cache", return_value=None)
    update_mock = mocker.patch.object(sheets, "update_order", return_value=None)
    return {"update_order": update_mock}


# ---------- claim ----------

def test_claim_happy_path(mocker):
    patches = _enable_sheet(mocker, _order(status=OrderStatus.CAPTAIN_SUBMITTED))
    r = client.post("/api/manager/claim/ORD-A", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "manager_claimed"
    patches["update_order"].assert_called_once()
    assert patches["update_order"].call_args.kwargs["status"] == "manager_claimed"


def test_claim_rejects_non_submitted(mocker):
    _enable_sheet(mocker, _order(status=OrderStatus.MANAGER_SENT))
    r = client.post("/api/manager/claim/ORD-A", headers=MANAGER_AUTH)
    assert r.status_code == 409
    assert "captain_submitted" in r.json()["detail"]


def test_claim_404_when_missing(mocker):
    _enable_sheet(mocker, None)
    r = client.post("/api/manager/claim/ORD-GONE", headers=MANAGER_AUTH)
    assert r.status_code == 404


def test_claim_requires_manager_auth(mocker):
    _enable_sheet(mocker, _order())
    r = client.post("/api/manager/claim/ORD-A", headers=CAPTAIN_AUTH)
    assert r.status_code == 401


# ---------- release ----------

def test_release_happy_path(mocker):
    patches = _enable_sheet(mocker, _order(status=OrderStatus.MANAGER_CLAIMED))
    r = client.post(
        "/api/manager/release/ORD-A",
        headers=MANAGER_AUTH,
        json={"reason": "Za dużo gyrosa — popraw na 2 kartony"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "captain_submitted"
    kwargs = patches["update_order"].call_args.kwargs
    assert kwargs["status"] == "captain_submitted"
    assert kwargs["notes"] == "Za dużo gyrosa — popraw na 2 kartony"


def _line(line_id: str, captain: float, manager: float, manager_set: bool) -> OrderLine:
    return OrderLine(
        order_line_id=line_id,
        order_id="ORD-A",
        product_id="P027",
        supplier_product_id="SP_PAGO_P027",
        captain_final_qty_purchase=captain,
        manager_final_qty_purchase=manager,
        manager_final_set=manager_set,
    )


def test_release_clears_manager_zeros(mocker):
    """order-line-zero-qty: a released order is the Captain's again — a line the
    Manager zeroed reads at the Captain's quantity, as before the flag existed.
    Positive Manager values and untouched lines are not written."""
    order = _order(status=OrderStatus.MANAGER_CLAIMED).model_copy(
        update={
            "lines": [
                _line("OL-1", 5, 0, True),
                _line("OL-2", 5, 3, True),
                _line("OL-3", 5, 0, False),
            ]
        }
    )
    _enable_sheet(mocker, order)
    lines_mock = mocker.patch.object(sheets, "update_order_lines", return_value=None)
    r = client.post(
        "/api/manager/release/ORD-A", headers=MANAGER_AUTH, json={"reason": "popraw"}
    )
    assert r.status_code == 200, r.text
    lines_mock.assert_called_once_with("ORD-A", {"OL-1": {"manager_final_set": False}})


def test_release_survives_zero_clearing_failure(mocker):
    """The status write already happened — a failure clearing the flags only logs."""
    order = _order(status=OrderStatus.MANAGER_CLAIMED).model_copy(
        update={"lines": [_line("OL-1", 5, 0, True)]}
    )
    _enable_sheet(mocker, order)
    mocker.patch.object(sheets, "update_order_lines", side_effect=RuntimeError("down"))
    r = client.post(
        "/api/manager/release/ORD-A", headers=MANAGER_AUTH, json={"reason": "popraw"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "captain_submitted"


def test_release_rejects_non_claimed(mocker):
    _enable_sheet(mocker, _order(status=OrderStatus.CAPTAIN_SUBMITTED))
    r = client.post(
        "/api/manager/release/ORD-A",
        headers=MANAGER_AUTH,
        json={"reason": "test"},
    )
    assert r.status_code == 409
    assert "manager_claimed" in r.json()["detail"]


def test_release_requires_reason(mocker):
    _enable_sheet(mocker, _order(status=OrderStatus.MANAGER_CLAIMED))
    r = client.post(
        "/api/manager/release/ORD-A",
        headers=MANAGER_AUTH,
        json={"reason": ""},
    )
    assert r.status_code == 422  # Pydantic min_length=1


def test_release_404_when_missing(mocker):
    _enable_sheet(mocker, None)
    r = client.post(
        "/api/manager/release/ORD-GONE",
        headers=MANAGER_AUTH,
        json={"reason": "test"},
    )
    assert r.status_code == 404


# ---------- cancel (soft-delete with trace) ----------

def test_cancel_from_captain_submitted(mocker):
    patches = _enable_sheet(mocker, _order(status=OrderStatus.CAPTAIN_SUBMITTED))
    r = client.post(
        "/api/manager/cancel/ORD-A",
        headers=MANAGER_AUTH,
        json={"reason": "Pomyłka — testowe zamówienie"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "cancelled"
    kwargs = patches["update_order"].call_args.kwargs
    assert kwargs["status"] == "cancelled"
    assert kwargs["cancel_reason"] == "Pomyłka — testowe zamówienie"
    assert kwargs["cancelled_by"]  # actor proxy stamped
    assert kwargs["cancelled_at"]  # timestamp stamped
    # atomic guard uses the order's current status
    assert kwargs["expected_status"] == "captain_submitted"


def test_cancel_from_manager_claimed(mocker):
    patches = _enable_sheet(mocker, _order(status=OrderStatus.MANAGER_CLAIMED))
    r = client.post(
        "/api/manager/cancel/ORD-A",
        headers=MANAGER_AUTH,
        json={"reason": "Dostawca zamknięty"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "cancelled"
    assert patches["update_order"].call_args.kwargs["expected_status"] == "manager_claimed"


def test_cancel_rejects_manager_sent(mocker):
    _enable_sheet(mocker, _order(status=OrderStatus.MANAGER_SENT))
    r = client.post(
        "/api/manager/cancel/ORD-A",
        headers=MANAGER_AUTH,
        json={"reason": "za późno"},
    )
    assert r.status_code == 409
    assert "cannot cancel" in r.json()["detail"]


def test_cancel_requires_reason(mocker):
    _enable_sheet(mocker, _order(status=OrderStatus.CAPTAIN_SUBMITTED))
    r = client.post(
        "/api/manager/cancel/ORD-A",
        headers=MANAGER_AUTH,
        json={"reason": ""},
    )
    assert r.status_code == 422  # Pydantic min_length=1


def test_cancel_404_when_missing(mocker):
    _enable_sheet(mocker, None)
    r = client.post(
        "/api/manager/cancel/ORD-GONE",
        headers=MANAGER_AUTH,
        json={"reason": "test"},
    )
    assert r.status_code == 404


def test_cancel_requires_manager_auth(mocker):
    _enable_sheet(mocker, _order())
    r = client.post(
        "/api/manager/cancel/ORD-A",
        headers=CAPTAIN_AUTH,
        json={"reason": "test"},
    )
    assert r.status_code == 401


# ---------- captain edit gate interaction ----------

def test_captain_cannot_edit_claimed_order(mocker):
    """After claim (manager_claimed), the captain PATCH must 409."""
    _enable_sheet(mocker, _order(status=OrderStatus.MANAGER_CLAIMED))
    r = client.patch(
        "/api/captain/order/ORD-A",
        headers=CAPTAIN_AUTH,
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
