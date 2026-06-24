"""Tests for the Manager receiving view (manager-receiving-view).

Weaves goods-receipt data into the existing Manager surfaces:
  - GET /api/manager/order/{id} gains a newest-first `receipts` block.
  - GET /api/manager/queue?status=manager_sent gains `received_count` /
    `received_discrepancy_count` per row.

Strategy mirrors test_manager_queue.py: monkey-patch the `sheets` module so we
never touch real Google credentials, then route reads through `_choose_backend()`
by flipping `sheets.is_configured` + `settings.data_backend`.
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
    Receipt,
    ReceiptLine,
    Supplier,
    SupplierProduct,
)

client = TestClient(app)

MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}


# ---------- Fixture builders ----------

def _order(order_id: str, status: OrderStatus = OrderStatus.MANAGER_SENT) -> Order:
    return Order(
        order_id=order_id,
        location_id="WOLA",
        supplier_id="SUP_PAGO",
        order_date=date(2026, 6, 20),
        status=status,
        captain_user="WOLA",
        captain_submitted_at=datetime(2026, 6, 20, 8, 30, tzinfo=timezone.utc),
        total_value_estimate_pln=668.0,
    )


def _line(order_id: str, line_id: str) -> OrderLine:
    return OrderLine(
        order_line_id=line_id,
        order_id=order_id,
        product_id="P027",
        supplier_product_id="SP_PAGO_P027",
        captain_final_qty_purchase=5.0,
        captain_final_qty_base=25.0,
    )


def _receipt(
    receipt_id: str,
    order_id: str,
    submitted_at: datetime,
    discrepancy_count: int = 0,
    received_with_missing_wz: bool = True,
) -> Receipt:
    return Receipt(
        receipt_id=receipt_id,
        order_id=order_id,
        location_id="WOLA",
        supplier_id="SUP_PAGO",
        receipt_date=submitted_at.date(),
        received_by="Anna",
        received_submitted_at=submitted_at,
        line_count=1,
        discrepancy_count=discrepancy_count,
        received_with_missing_wz=received_with_missing_wz,
    )


def _receipt_line(
    receipt_id: str,
    order_id: str,
    order_line_id: str = "OL-1",
    ordered: float = 5.0,
    received: float = 6.0,
) -> ReceiptLine:
    return ReceiptLine(
        receipt_line_id=f"RL-{receipt_id}-001",
        receipt_id=receipt_id,
        order_id=order_id,
        order_line_id=order_line_id,
        product_id="P027",
        supplier_product_id="SP_PAGO_P027",
        ordered_qty_purchase=ordered,
        received_qty_purchase=received,
        variance_qty_purchase=received - ordered,
    )


def _product() -> Product:
    return Product(
        product_id="P027",
        product_name_pl="Souvlaki Kurczak",
        product_category="Mięso",
        inventory_unit="kg",
    )


def _supplier_product() -> SupplierProduct:
    return SupplierProduct(
        supplier_product_id="SP_PAGO_P027",
        supplier_id="SUP_PAGO",
        product_id="P027",
        supplier_product_name="Souvlaki Karton",
        purchase_unit="karton",
        units_per_purchase_unit=5.0,
        price_estimate_pln=145.0,
    )


def _supplier() -> Supplier:
    return Supplier(supplier_id="SUP_PAGO", supplier_name="Pago", email="z@pago.example")


def _location() -> Location:
    return Location(location_id="WOLA", location_name="Pita Bros Wola")


def _enable(
    mocker,
    *,
    orders: list[Order],
    get_order_return: Order | None,
    order_lines: list[OrderLine] | None = None,
    receipts: list[Receipt] | None = None,
    receipt_lines: list[ReceiptLine] | None = None,
    receipts_side_effect: Exception | None = None,
) -> dict:
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_orders", return_value=orders)
    mocker.patch.object(sheets, "get_order", return_value=get_order_return)
    mocker.patch.object(
        sheets, "load_order_lines_for_orders", return_value=order_lines or []
    )
    mocker.patch.object(sheets, "load_products", return_value=[_product()])
    mocker.patch.object(
        sheets, "load_supplier_products", return_value=[_supplier_product()]
    )
    mocker.patch.object(sheets, "load_suppliers", return_value=[_supplier()])
    mocker.patch.object(sheets, "load_locations", return_value=[_location()])
    mocker.patch.object(sheets, "load_location_product_settings", return_value=[])

    if receipts_side_effect is not None:
        receipts_mock = mocker.patch.object(
            sheets, "load_receipts", side_effect=receipts_side_effect
        )
    else:
        receipts_mock = mocker.patch.object(
            sheets, "load_receipts", return_value=receipts or []
        )
    mocker.patch.object(
        sheets, "load_receipt_lines", return_value=receipt_lines or []
    )
    return {"load_receipts": receipts_mock}


# ---------- Detail: receipts block ----------

def test_detail_attaches_receipts_newest_first(mocker):
    order_id = "ORD-RCV-1"
    order = _order(order_id).model_copy(update={"lines": [_line(order_id, "OL-1")]})
    older = _receipt("RCP-OLD", order_id, datetime(2026, 6, 20, 10, 0, tzinfo=timezone.utc))
    newer = _receipt("RCP-NEW", order_id, datetime(2026, 6, 22, 10, 0, tzinfo=timezone.utc))
    rlines = [
        _receipt_line("RCP-OLD", order_id, ordered=5.0, received=5.0),
        _receipt_line("RCP-NEW", order_id, ordered=5.0, received=6.0),
    ]
    # Pass receipts deliberately out of order to prove the endpoint sorts them.
    _enable(
        mocker,
        orders=[order],
        get_order_return=order,
        receipts=[older, newer],
        receipt_lines=rlines,
    )

    r = client.get(f"/api/manager/order/{order_id}", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    receipts = r.json()["receipts"]
    assert [rc["receipt_id"] for rc in receipts] == ["RCP-NEW", "RCP-OLD"]
    # Per-line enrichment + variance on the newest receipt.
    newest_line = receipts[0]["lines"][0]
    assert newest_line["product_name_pl"] == "Souvlaki Kurczak"
    assert newest_line["purchase_unit"] == "karton"
    assert newest_line["received_qty_purchase"] == pytest.approx(6.0)
    assert newest_line["variance_qty_purchase"] == pytest.approx(1.0)


def test_detail_empty_receipts_when_none(mocker):
    order_id = "ORD-RCV-2"
    order = _order(order_id).model_copy(update={"lines": [_line(order_id, "OL-1")]})
    _enable(mocker, orders=[order], get_order_return=order, receipts=[])

    r = client.get(f"/api/manager/order/{order_id}", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["receipts"] == []


def test_detail_degrades_when_receipts_tab_missing(mocker):
    order_id = "ORD-RCV-3"
    order = _order(order_id).model_copy(update={"lines": [_line(order_id, "OL-1")]})
    _enable(
        mocker,
        orders=[order],
        get_order_return=order,
        receipts_side_effect=sheets.WorksheetNotFound("no receipts tab"),
    )

    r = client.get(f"/api/manager/order/{order_id}", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text  # must NOT 500
    assert r.json()["receipts"] == []


def test_detail_non_sent_order_skips_receipt_scan(mocker):
    """A captain_submitted order can't have receipts — the scan is skipped."""
    order_id = "ORD-RCV-4"
    order = _order(order_id, status=OrderStatus.CAPTAIN_SUBMITTED).model_copy(
        update={"lines": [_line(order_id, "OL-1")]}
    )
    handles = _enable(mocker, orders=[order], get_order_return=order, receipts=[])

    r = client.get(f"/api/manager/order/{order_id}", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["receipts"] == []
    handles["load_receipts"].assert_not_called()


def test_detail_closed_order_includes_receipts(mocker):
    """A closed order still surfaces its receipts (the gate includes CLOSED)."""
    order_id = "ORD-RCV-CLOSED"
    order = _order(order_id, status=OrderStatus.CLOSED).model_copy(
        update={"lines": [_line(order_id, "OL-1")]}
    )
    rcp = _receipt("RCP-C1", order_id, datetime(2026, 6, 22, 9, 0, tzinfo=timezone.utc))
    rlines = [_receipt_line("RCP-C1", order_id, ordered=5.0, received=5.0)]
    _enable(
        mocker,
        orders=[order],
        get_order_return=order,
        receipts=[rcp],
        receipt_lines=rlines,
    )

    r = client.get(f"/api/manager/order/{order_id}", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    receipts = r.json()["receipts"]
    assert len(receipts) == 1
    assert receipts[0]["receipt_id"] == "RCP-C1"


# ---------- Queue: receipt counters ----------

def test_queue_sent_lane_sets_received_counts(mocker):
    order_a = _order("ORD-A")  # 2 receipts, one with discrepancy
    order_b = _order("ORD-B")  # 1 clean receipt
    receipts = [
        _receipt("RCP-A1", "ORD-A", datetime(2026, 6, 21, 9, 0, tzinfo=timezone.utc)),
        _receipt(
            "RCP-A2", "ORD-A", datetime(2026, 6, 22, 9, 0, tzinfo=timezone.utc),
            discrepancy_count=2,
        ),
        _receipt("RCP-B1", "ORD-B", datetime(2026, 6, 22, 9, 0, tzinfo=timezone.utc)),
    ]
    _enable(
        mocker,
        orders=[order_a, order_b],
        get_order_return=None,
        order_lines=[_line("ORD-A", "OL-1"), _line("ORD-B", "OL-1")],
        receipts=receipts,
    )

    r = client.get(
        "/api/manager/queue", params={"status": "manager_sent"}, headers=MANAGER_AUTH
    )
    assert r.status_code == 200, r.text
    by_id = {row["order_id"]: row for row in r.json()}
    assert by_id["ORD-A"]["received_count"] == 2
    assert by_id["ORD-A"]["received_discrepancy_count"] == 1
    assert by_id["ORD-B"]["received_count"] == 1
    assert by_id["ORD-B"]["received_discrepancy_count"] == 0


def test_queue_submitted_lane_skips_receipt_scan(mocker):
    """Default lane (captain_submitted): counters stay 0 and receipts aren't read."""
    order = _order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED)
    handles = _enable(
        mocker,
        orders=[order],
        get_order_return=None,
        order_lines=[_line("ORD-A", "OL-1")],
        receipts=[_receipt("RCP-X", "ORD-A", datetime(2026, 6, 22, 9, 0, tzinfo=timezone.utc))],
    )

    r = client.get("/api/manager/queue", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    row = r.json()[0]
    assert row["received_count"] == 0
    assert row["received_discrepancy_count"] == 0
    handles["load_receipts"].assert_not_called()


def test_queue_sent_lane_degrades_when_receipts_tab_missing(mocker):
    order = _order("ORD-A")
    _enable(
        mocker,
        orders=[order],
        get_order_return=None,
        order_lines=[_line("ORD-A", "OL-1")],
        receipts_side_effect=sheets.WorksheetNotFound("no receipts tab"),
    )

    r = client.get(
        "/api/manager/queue", params={"status": "manager_sent"}, headers=MANAGER_AUTH
    )
    assert r.status_code == 200, r.text  # must NOT 500
    assert r.json()[0]["received_count"] == 0
