"""Tests for the manager claim / release state machine (Phase F1).

Flow: captain_submitted ──claim──► manager_claimed ──dispatch──► manager_sent
                                         │
                                         └──release(reason)──► captain_submitted

Fixtures mirror test_manager_queue.py: monkeypatch the sheets surface.
"""
from __future__ import annotations

import os
from datetime import date, datetime, timezone

os.environ.setdefault(
    "SUPPLY_OS_CAPTAIN_TOKENS", "WOLA:test_wola_token,KEN:test_ken_token"
)
os.environ.setdefault("SUPPLY_OS_MANAGER_TOKEN", "test_manager_token")

from fastapi.testclient import TestClient  # noqa: E402

from app import sheets  # noqa: E402
from app.config import DataBackend  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Order, OrderStatus  # noqa: E402

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
