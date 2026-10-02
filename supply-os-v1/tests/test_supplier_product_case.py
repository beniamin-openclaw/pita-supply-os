"""Bulk packs on supplier_products (migration 0028, feedback-1001-names-units
D22/D33-D36) — threading of ``case_unit`` / ``units_per_case`` from master data
into every route that prints or inputs quantities.

The engine (D33) and the submit gates (D34) are pinned in test_suggestion.py /
test_captain_submit.py; the e-mail wording (D35) in test_gmail_url.py and the
golden fixtures.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from app import seed_loader, sheets
from app.config import DataBackend
from app.main import app
from app.models import (
    Location,
    LocationProductSetting,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    RoundingRule,
    Supplier,
    SupplierProduct,
)

client = TestClient(app)
WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}


# ---------- seed ----------


def test_seed_bukat_pomidor_has_a_crate_of_six():
    """The seed mirrors the D23 shape on one row so seed-mode tests exercise
    the case path; every other row stays case-less."""
    sps = {sp.supplier_product_id: sp for sp in seed_loader.load_supplier_products()}
    assert sps["SP_BUKAT_P006"].case_unit == "skrzynka"
    assert sps["SP_BUKAT_P006"].units_per_case == 6.0
    others = [sp for sid, sp in sps.items() if sid != "SP_BUKAT_P006"]
    assert all(sp.case_unit is None and sp.units_per_case is None for sp in others)


def test_seed_frytki_is_one_paczka_per_purchase_unit():
    """Seed P021 matches prod (plan-review F6): counted in szt, bought per
    paczka, upp 1."""
    sps = {sp.supplier_product_id: sp for sp in seed_loader.load_supplier_products()}
    products = {p.product_id: p for p in seed_loader.load_products()}
    assert sps["SP_INTERMLECZ_P021"].purchase_unit == "paczka"
    assert sps["SP_INTERMLECZ_P021"].units_per_purchase_unit == 1.0
    assert products["P021"].inventory_unit == "szt"


# ---------- Captain orderable + inventory list ----------


def test_captain_orderable_carries_the_case():
    r = client.get(
        "/api/captain/orderable", params={"supplier_id": "SUP_BUKAT"}, headers=WOLA_AUTH
    )
    assert r.status_code == 200, r.text
    items = {i["supplier_product_id"]: i for i in r.json()}
    assert items["SP_BUKAT_P006"]["case_unit"] == "skrzynka"
    assert items["SP_BUKAT_P006"]["units_per_case"] == 6.0
    assert items["SP_BUKAT_P009"]["case_unit"] is None
    assert items["SP_BUKAT_P009"]["units_per_case"] is None


def test_captain_inventory_products_carry_the_case_of_the_primary_supplier_product():
    r = client.get("/api/captain/inventory/products", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    by_id = {it["product_id"]: it for it in r.json()}
    assert by_id["P006"]["case_unit"] == "skrzynka"
    assert by_id["P006"]["units_per_case"] == 6.0


# ---------- Order detail (Manager + Captain) ----------


def _order(order_id: str) -> Order:
    return Order(
        order_id=order_id,
        location_id="WOLA",
        supplier_id="SUP_BUKAT",
        order_date=date(2026, 10, 1),
        status=OrderStatus.MANAGER_CLAIMED,
        captain_user="WOLA",
        captain_submitted_at=datetime(2026, 10, 1, 8, 0, tzinfo=timezone.utc),
        total_value_estimate_pln=100.0,
    )


def _line(order_id: str, line_id: str, pid: str, sp_id: str) -> OrderLine:
    return OrderLine(
        order_line_id=line_id,
        order_id=order_id,
        product_id=pid,
        supplier_product_id=sp_id,
        current_stock_qty_base=8,
        target_stock_qty_base=30,
        suggested_qty_base=24,
        suggested_qty_purchase=24,
        captain_final_qty_purchase=24,
        captain_final_qty_base=24,
    )


def _enable_sheet(mocker, order: Order) -> None:
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_orders", return_value=[order])
    mocker.patch.object(sheets, "get_order", return_value=order)
    mocker.patch.object(
        sheets,
        "load_suppliers",
        return_value=[Supplier(supplier_id="SUP_BUKAT", supplier_name="Bukat")],
    )
    mocker.patch.object(
        sheets,
        "load_products",
        return_value=[
            Product(
                product_id="P006", product_name_pl="Pomidor",
                product_category="Chłodnia", inventory_unit="kg",
            ),
            Product(
                product_id="P009", product_name_pl="Ogórek",
                product_category="Chłodnia", inventory_unit="kg",
            ),
        ],
    )
    mocker.patch.object(
        sheets,
        "load_supplier_products",
        return_value=[
            SupplierProduct(
                supplier_product_id="SP_BUKAT_P006", supplier_id="SUP_BUKAT",
                product_id="P006", supplier_product_name="Pomidor", purchase_unit="kg",
                rounding_rule=RoundingRule.TENTH_KG, case_unit="skrzynka",
                units_per_case=6,
            ),
            SupplierProduct(
                supplier_product_id="SP_BUKAT_P009", supplier_id="SUP_BUKAT",
                product_id="P009", supplier_product_name="Ogórek", purchase_unit="kg",
                rounding_rule=RoundingRule.TENTH_KG,
            ),
        ],
    )
    mocker.patch.object(
        sheets,
        "load_location_product_settings",
        return_value=[
            LocationProductSetting(
                setting_id="S6", location_id="WOLA", product_id="P006",
                target_stock_qty_base=30, max_stock_qty_base=30,
            )
        ],
    )
    mocker.patch.object(
        sheets,
        "load_locations",
        return_value=[Location(location_id="WOLA", location_name="Pita Bros Wola")],
    )
    mocker.patch.object(sheets, "load_meta", return_value={})


def _order_with_lines(order_id: str) -> Order:
    return _order(order_id).model_copy(
        update={
            "lines": [
                _line(order_id, "OL-1", "P006", "SP_BUKAT_P006"),
                _line(order_id, "OL-2", "P009", "SP_BUKAT_P009"),
            ]
        }
    )


def test_manager_order_detail_lines_carry_the_case(mocker):
    order = _order_with_lines("ORD-CASE-M")
    _enable_sheet(mocker, order)
    r = client.get("/api/manager/order/ORD-CASE-M", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    lines = {ln["product_id"]: ln for ln in r.json()["lines"]}
    assert lines["P006"]["case_unit"] == "skrzynka"
    assert lines["P006"]["units_per_case"] == 6.0
    assert lines["P009"]["case_unit"] is None
    assert lines["P009"]["units_per_case"] is None


def test_captain_order_detail_lines_carry_the_case(mocker):
    order = _order_with_lines("ORD-CASE-C").model_copy(
        update={"status": OrderStatus.CAPTAIN_SUBMITTED}
    )
    _enable_sheet(mocker, order)
    r = client.get("/api/captain/order/ORD-CASE-C", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    lines = {ln["product_id"]: ln for ln in r.json()["lines"]}
    assert lines["P006"]["case_unit"] == "skrzynka"
    assert lines["P006"]["units_per_case"] == 6.0
    assert lines["P009"]["units_per_case"] is None
