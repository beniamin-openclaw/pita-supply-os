"""Tests for the Captain goods-receipt submit endpoint (GR-01, Phase 1).

POST /api/captain/receipt/submit. Receiving is sheet-only (a receipt is built
FROM a real dispatched order), so seed mode returns 503; the sheet path is
exercised by patching `sheets` to be the active backend and stubbing
`sheets.get_order` with a fake manager_sent order (mirrors the
_patch_sheet_master_data pattern in test_inventory_submit.py).
"""
from datetime import date, datetime, timedelta

from fastapi.testclient import TestClient

from app import seed_loader, sheets
from app.config import DataBackend
from app.main import _WARSAW_TZ, app
from app.models import Order, OrderLine, OrderStatus

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
KEN_AUTH = {"Authorization": "Bearer test_ken_token"}

RECEIVED_BY = "Jan Kowalski"
ORDER_ID = "ORD-20260605-WOL-BUKA-aaa111"


def _fake_order(
    *,
    location_id: str = "WOLA",
    status: OrderStatus = OrderStatus.MANAGER_SENT,
) -> Order:
    """A dispatched Bukat order: OL-1 effective ordered = 10 (manager_final 0 →
    captain_final), OL-2 effective ordered = 6 (manager_final wins)."""
    return Order(
        order_id=ORDER_ID,
        location_id=location_id,
        supplier_id="SUP_BUKAT",
        order_date=date(2026, 6, 5),
        status=status,
        lines=[
            OrderLine(
                order_line_id="OL-1",
                order_id=ORDER_ID,
                product_id="P027",
                supplier_product_id="SP-P027",
                captain_final_qty_purchase=10,
                manager_final_qty_purchase=0,
            ),
            OrderLine(
                order_line_id="OL-2",
                order_id=ORDER_ID,
                product_id="P019",
                supplier_product_id="SP-P019",
                captain_final_qty_purchase=4,
                manager_final_qty_purchase=6,
            ),
        ],
    )


def _patch_sheet_backend(mocker):
    """Make `sheets` the active backend (master-data reads fall back to seed)."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_products", side_effect=seed_loader.load_products)


def _two_lines():
    # OL-2 received 5 vs ordered 6 → one discrepancy; OL-1 received 10 = ordered.
    return [
        {"order_line_id": "OL-1", "received_qty_purchase": 10},
        {"order_line_id": "OL-2", "received_qty_purchase": 5},
    ]


# ---------- seed mode: sheet-only endpoint ----------

def test_receipt_submit_seed_returns_503():
    body = {"order_id": ORDER_ID, "received_by": RECEIVED_BY, "lines": _two_lines()}
    r = client.post("/api/captain/receipt/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 503, r.text
    assert "sheet" in r.json()["detail"].lower()


# ---------- auth + body validation (before the backend check) ----------

def test_receipt_submit_unauthorized_no_token():
    body = {"order_id": ORDER_ID, "received_by": RECEIVED_BY, "lines": _two_lines()}
    r = client.post("/api/captain/receipt/submit", json=body)
    assert r.status_code == 401


def test_receipt_submit_missing_received_by_422():
    body = {"order_id": ORDER_ID, "lines": _two_lines()}
    r = client.post("/api/captain/receipt/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 422


def test_receipt_submit_empty_lines_422():
    body = {"order_id": ORDER_ID, "received_by": RECEIVED_BY, "lines": []}
    r = client.post("/api/captain/receipt/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 422


# ---------- sheet mode: happy path + gates ----------

def test_receipt_submit_happy_path(mocker):
    _patch_sheet_backend(mocker)
    mocker.patch.object(sheets, "get_order", return_value=_fake_order())
    appended = mocker.patch.object(sheets, "append_receipt")
    appended_lines = mocker.patch.object(sheets, "append_receipt_lines")

    body = {"order_id": ORDER_ID, "received_by": RECEIVED_BY, "lines": _two_lines()}
    r = client.post("/api/captain/receipt/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["receipt_id"].startswith("RCP-")
    assert out["line_count"] == 2
    assert out["discrepancy_count"] == 1  # OL-2: received 5 vs ordered 6
    assert out["received_with_missing_wz"] is True
    assert not out["warnings"]  # sheet persisted

    appended.assert_called_once()
    appended_lines.assert_called_once()
    receipt_arg = appended.call_args[0][0]
    assert receipt_arg.supplier_id == "SUP_BUKAT"
    assert receipt_arg.location_id == "WOLA"
    assert receipt_arg.received_by == RECEIVED_BY

    lines_arg = appended_lines.call_args[0][0]
    assert {ln.order_line_id for ln in lines_arg} == {"OL-1", "OL-2"}
    ol2 = next(ln for ln in lines_arg if ln.order_line_id == "OL-2")
    assert ol2.ordered_qty_purchase == 6
    assert ol2.received_qty_purchase == 5
    assert ol2.variance_qty_purchase == -1
    ol1 = next(ln for ln in lines_arg if ln.order_line_id == "OL-1")
    assert ol1.ordered_qty_purchase == 10
    assert ol1.variance_qty_purchase == 0


def test_receipt_submit_order_not_found_404(mocker):
    _patch_sheet_backend(mocker)
    mocker.patch.object(sheets, "get_order", return_value=None)
    body = {"order_id": "ORD-nope", "received_by": RECEIVED_BY, "lines": _two_lines()}
    r = client.post("/api/captain/receipt/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 404, r.text


def test_receipt_submit_wrong_location_404(mocker):
    _patch_sheet_backend(mocker)
    mocker.patch.object(sheets, "get_order", return_value=_fake_order(location_id="KEN"))
    body = {"order_id": ORDER_ID, "received_by": RECEIVED_BY, "lines": _two_lines()}
    # WOLA token, order belongs to KEN → 404 (no cross-location access).
    r = client.post("/api/captain/receipt/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 404, r.text


def test_receipt_submit_wrong_status_409(mocker):
    _patch_sheet_backend(mocker)
    mocker.patch.object(
        sheets, "get_order", return_value=_fake_order(status=OrderStatus.MANAGER_CLAIMED)
    )
    body = {"order_id": ORDER_ID, "received_by": RECEIVED_BY, "lines": _two_lines()}
    r = client.post("/api/captain/receipt/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 409, r.text
    assert "manager_sent" in r.json()["detail"]


def test_receipt_submit_unknown_order_line_400(mocker):
    _patch_sheet_backend(mocker)
    mocker.patch.object(sheets, "get_order", return_value=_fake_order())
    body = {
        "order_id": ORDER_ID,
        "received_by": RECEIVED_BY,
        "lines": [{"order_line_id": "OL-DOES-NOT-EXIST", "received_qty_purchase": 1}],
    }
    r = client.post("/api/captain/receipt/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 400, r.text
    assert "does not belong" in r.json()["detail"]


def test_receipt_submit_future_date_400(mocker):
    _patch_sheet_backend(mocker)
    mocker.patch.object(sheets, "get_order", return_value=_fake_order())
    future = (datetime.now(_WARSAW_TZ).date() + timedelta(days=2)).isoformat()
    body = {
        "order_id": ORDER_ID,
        "received_by": RECEIVED_BY,
        "receipt_date": future,
        "lines": _two_lines(),
    }
    r = client.post("/api/captain/receipt/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 400, r.text
    assert "future" in r.json()["detail"]


def test_receipt_submit_id_format(mocker):
    """RCP-YYYYMMDD-WOL-<6hex>; 5 calls all unique + correct shape."""
    _patch_sheet_backend(mocker)
    mocker.patch.object(sheets, "get_order", return_value=_fake_order())
    mocker.patch.object(sheets, "append_receipt")
    mocker.patch.object(sheets, "append_receipt_lines")
    body = {"order_id": ORDER_ID, "received_by": RECEIVED_BY, "lines": _two_lines()}
    seen: set[str] = set()
    for _ in range(5):
        r = client.post("/api/captain/receipt/submit", json=body, headers=WOLA_AUTH)
        assert r.status_code == 200, r.text
        rid = r.json()["receipt_id"]
        parts = rid.split("-")  # ['RCP', 'YYYYMMDD', 'WOL', 'hex']
        assert parts[0] == "RCP"
        assert len(parts[1]) == 8 and parts[1].isdigit()
        assert parts[2] == "WOL"
        assert len(parts[3]) == 6
        int(parts[3], 16)
        seen.add(rid)
    assert len(seen) == 5


def test_receipt_submit_worksheets_not_configured_503(mocker):
    """Sheet mode but the receipt tabs don't exist yet → actionable 503."""
    _patch_sheet_backend(mocker)
    mocker.patch.object(sheets, "get_order", return_value=_fake_order())
    mocker.patch.object(
        sheets, "append_receipt", side_effect=sheets.WorksheetNotFound
    )
    body = {"order_id": ORDER_ID, "received_by": RECEIVED_BY, "lines": _two_lines()}
    r = client.post("/api/captain/receipt/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 503, r.text
    assert "not configured" in r.json()["detail"]
