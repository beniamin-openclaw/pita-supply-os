"""Canonical supplier order on every per-supplier surface
(supplier-product-order-minimum, Phase 2).

Order = supplier_products.display_order, then supplier_product_id
(app/product_order.py). Seed-mode routes read the seed CSV, which carries the
Bukat positions; sheet-mocked routes build their own master data.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app import main as main_module
from app import seed_loader, sheets
from app.config import DataBackend
from app.gmail_url import _build_body
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
WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}

# Operator order (Marek, 2026-09-28) as positioned in the seed CSV.
BUKAT_OPERATOR_ORDER = [
    "SP_BUKAT_P006",
    "SP_BUKAT_P016",
    "SP_BUKAT_P004",
    "SP_BUKAT_P002",
    "SP_BUKAT_P005",
    "SP_BUKAT_P003",
    "SP_BUKAT_P008",
    "SP_BUKAT_P007",
    "SP_BUKAT_P009",
    "SP_BUKAT_P010",
    "SP_BUKAT_P018",
    "SP_BUKAT_P011",
    "SP_BUKAT_P012",
    "SP_BUKAT_P014",
]


# ---------- Orderable list (Captain order/edit, add-line picker, prefill) ----------


def test_captain_orderable_bukat_follows_operator_order_then_unpositioned():
    resp = client.get("/api/captain/orderable?supplier_id=SUP_BUKAT", headers=WOLA_AUTH)
    assert resp.status_code == 200
    items = resp.json()
    ids = [it["supplier_product_id"] for it in items]
    assert ids[: len(BUKAT_OPERATOR_ORDER)] == BUKAT_OPERATOR_ORDER
    # Anything after the positioned rows has no position and is in id order.
    rest = items[len(BUKAT_OPERATOR_ORDER):]
    assert all(it["display_order"] is None for it in rest)
    assert [it["supplier_product_id"] for it in rest] == sorted(
        it["supplier_product_id"] for it in rest
    )
    assert [it["display_order"] for it in items[:3]] == [10, 20, 30]


def test_captain_orderable_supplier_without_positions_keeps_id_order():
    resp = client.get(
        "/api/captain/orderable?supplier_id=SUP_BLUESERV", headers=WOLA_AUTH
    )
    assert resp.status_code == 200
    ids = [it["supplier_product_id"] for it in resp.json()]
    assert len(ids) > 5
    assert ids == sorted(ids)


def test_seed_positions_and_exclusions_parse():
    sps = {sp.supplier_product_id: sp for sp in seed_loader.load_supplier_products()}
    assert sps["SP_BUKAT_P006"].display_order == 10
    assert sps["SP_BUKAT_P014"].display_order == 140
    assert sps["SP_BUKAT_P011"].counts_toward_minimum is False
    assert sps["SP_BUKAT_P006"].counts_toward_minimum is True
    assert sps["SP_PAGO_P024"].display_order is None
    # The quoted note (it contains a comma) survives as ONE field.
    assert "cena_jm=25.20" in sps["SP_PAGO_P024"].notes


# ---------- Order detail (Manager + Captain), sheet-mocked ----------


def _sp(sp_id: str, product_id: str, name: str, display_order, unit: str = "kg"):
    return SupplierProduct(
        supplier_product_id=sp_id,
        supplier_id="SUP_BUKAT",
        product_id=product_id,
        supplier_product_name=name,
        purchase_unit=unit,
        price_estimate_pln=10.0,
        display_order=display_order,
    )


def _product(pid: str, name: str, unit: str = "kg") -> Product:
    return Product(
        product_id=pid, product_name_pl=name, product_category="Chłodnia",
        inventory_unit=unit,
    )


# Shared with frontend/src/pages/manager/lib/emailBody.test.ts
# ("orders catalogue lines canonically"): stored line ids run Ogórek, Pomidor,
# Bombilla, then a manager-added Cebula — positions say Pomidor, Cebula, Ogórek,
# then the position-less Bombilla.
SPS = [
    _sp("SP_BUKAT_P005", "P005", "Ogórek", 50),
    _sp("SP_BUKAT_P006", "P006", "Pomidor", 10),
    _sp("SP_BUKAT_P135", "P135", "Bombilla", None, unit="szt"),
    _sp("SP_BUKAT_P016", "P016", "Cebula czerwona", 20),
]
PRODUCTS = [
    _product("P005", "Ogórek"),
    _product("P006", "Pomidor"),
    _product("P135", "Bombilla", unit="szt"),
    _product("P016", "Cebula czerwona"),
]
ORDER_ID = "ORD-20260928-WOL-BUKA-abc123"


def _line(line_id: str, pid: str, sp_id: str, captain: float, manager: float = 0.0):
    return OrderLine(
        order_line_id=line_id,
        order_id=ORDER_ID,
        product_id=pid,
        supplier_product_id=sp_id,
        captain_final_qty_purchase=captain,
        captain_final_qty_base=captain,
        manager_final_qty_purchase=manager,
        manager_final_qty_base=manager,
    )


LINES = [
    _line(f"OL-{ORDER_ID}-001", "P005", "SP_BUKAT_P005", 2),
    _line(f"OL-{ORDER_ID}-002", "P006", "SP_BUKAT_P006", 3),
    _line(f"OL-{ORDER_ID}-003", "P135", "SP_BUKAT_P135", 1),
    _line(f"OL-{ORDER_ID}-M-a1b2c3", "P016", "SP_BUKAT_P016", 0, manager=4),
]
EXPECTED_PRODUCT_ORDER = ["P006", "P016", "P005", "P135"]


def _order(status: OrderStatus = OrderStatus.MANAGER_CLAIMED) -> Order:
    return Order(
        order_id=ORDER_ID,
        location_id="WOLA",
        supplier_id="SUP_BUKAT",
        order_date=date(2026, 9, 28),
        status=status,
        captain_user="WOLA",
        captain_submitted_at=datetime(2026, 9, 28, 8, 0, tzinfo=timezone.utc),
        total_value_estimate_pln=100.0,
        lines=LINES,
    )


def _enable_sheet(mocker, order: Order) -> None:
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "get_order", return_value=order)
    mocker.patch.object(sheets, "load_products", return_value=PRODUCTS)
    mocker.patch.object(sheets, "load_supplier_products", return_value=SPS)
    mocker.patch.object(
        sheets, "load_suppliers",
        return_value=[Supplier(supplier_id="SUP_BUKAT", supplier_name="Bukat",
                               email="b@example.com")],
    )
    mocker.patch.object(
        sheets, "load_locations",
        return_value=[Location(location_id="WOLA", location_name="Wola")],
    )
    mocker.patch.object(sheets, "load_location_product_settings", return_value=[])


def test_manager_order_detail_lines_in_canonical_order(mocker):
    _enable_sheet(mocker, _order())
    resp = client.get(f"/api/manager/order/{ORDER_ID}", headers=MANAGER_AUTH)
    assert resp.status_code == 200
    lines = resp.json()["lines"]
    assert [ln["product_id"] for ln in lines] == EXPECTED_PRODUCT_ORDER
    assert [ln["display_order"] for ln in lines] == [10, 20, 50, None]


def test_captain_order_detail_lines_in_canonical_order(mocker):
    _enable_sheet(mocker, _order(OrderStatus.CAPTAIN_SUBMITTED))
    resp = client.get(f"/api/captain/order/{ORDER_ID}", headers=WOLA_AUTH)
    assert resp.status_code == 200
    assert [ln["product_id"] for ln in resp.json()["lines"]] == EXPECTED_PRODUCT_ORDER


# ---------- Receipt lines ----------


def _receipt_line(idx: int, line: OrderLine) -> ReceiptLine:
    return ReceiptLine(
        receipt_line_id=f"RL-RCP-1-{idx:03d}",
        receipt_id="RCP-1",
        order_id=ORDER_ID,
        order_line_id=line.order_line_id,
        product_id=line.product_id,
        supplier_product_id=line.supplier_product_id,
    )


RECEIPT_LINES = [_receipt_line(i, ln) for i, ln in enumerate(LINES, start=1)]
RECEIPT = Receipt(
    receipt_id="RCP-1",
    order_id=ORDER_ID,
    location_id="WOLA",
    supplier_id="SUP_BUKAT",
    receipt_date=date(2026, 9, 29),
    lines=RECEIPT_LINES,
)


def test_order_receipts_lines_in_canonical_order():
    backend = SimpleNamespace(
        load_receipts=lambda: [RECEIPT],
        load_receipt_lines=lambda: RECEIPT_LINES,
    )
    out = main_module._load_order_receipts(
        backend,
        ORDER_ID,
        {p.product_id: p for p in PRODUCTS},
        {sp.supplier_product_id: sp for sp in SPS},
    )
    assert [ln.product_id for ln in out[0].lines] == EXPECTED_PRODUCT_ORDER


def test_captain_receipt_detail_lines_in_canonical_order(mocker):
    _enable_sheet(mocker, _order(OrderStatus.CLOSED))
    mocker.patch.object(sheets, "get_receipt", return_value=RECEIPT)
    resp = client.get("/api/captain/receipt/RCP-1", headers=WOLA_AUTH)
    assert resp.status_code == 200
    assert [ln["product_id"] for ln in resp.json()["lines"]] == EXPECTED_PRODUCT_ORDER


# ---------- Dispatch e-mail (backend twin) ----------


def test_email_body_numbers_lines_by_position_not_line_id():
    products_by_id = {
        **{p.product_id: p for p in PRODUCTS},
        **{sp.supplier_product_id: sp for sp in SPS},
    }
    body = _build_body(
        _order(),
        Supplier(supplier_id="SUP_BUKAT", supplier_name="Bukat", email="b@example.com"),
        LINES,
        products_by_id,
        Location(location_id="WOLA", location_name="Wola"),
    )
    table = [ln for ln in body.split("\n") if ln[:1].isdigit()]
    # Same four rows as the TS twin test (emailBody.test.ts).
    assert table == [
        "1.  | Pomidor | 3 kg",
        "2.  | Cebula czerwona | 4 kg",
        "3.  | Ogórek | 2 kg",
        "4.  | Bombilla | 1 szt",
    ]
