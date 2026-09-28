"""Minimum basis — the part of an order's total that counts toward the
supplier's logistic minimum (supplier-product-order-minimum, Phase 3).

Unit tests for ``main._minimum_basis_value`` plus a flow test proving the
basis never gates anything: an order entirely below it still submits, is
claimed and dispatches. Route-level exposure is covered next to the existing
minimum tests in test_manager_queue.py and test_captain_orders.py.

No test here sends anything: submit runs on the seed backend (in-memory),
claim and dispatch on a mocked sheets backend, and dispatch only builds a
Gmail compose URL.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app import seed_loader, sheets
from app.config import DataBackend
from app.main import _minimum_basis_value, app
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
WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}


def _sp(sp_id: str, price: float | None, counts: bool = True) -> SupplierProduct:
    return SupplierProduct(
        supplier_product_id=sp_id,
        supplier_id="SUP_BUKAT",
        product_id=sp_id.rsplit("_", 1)[-1],
        supplier_product_name=sp_id,
        purchase_unit="szt",
        price_estimate_pln=price,
        counts_toward_minimum=counts,
    )


def _line(
    sp_id: str, captain: float, manager: float = 0.0, manager_set: bool = False
) -> OrderLine:
    return OrderLine(
        order_line_id=f"OL-{sp_id}",
        order_id="ORD-1",
        product_id=sp_id.rsplit("_", 1)[-1],
        supplier_product_id=sp_id,
        captain_final_qty_purchase=captain,
        manager_final_qty_purchase=manager,
        manager_final_set=manager_set,
    )


SPS = {
    sp.supplier_product_id: sp
    for sp in [
        _sp("SP_BUKAT_P006", 10.0),
        _sp("SP_BUKAT_P011", 30.0, counts=False),
        _sp("SP_BUKAT_P014", 95.0, counts=False),
        _sp("SP_BUKAT_P012", None, counts=False),
    ]
}


# ---------- _minimum_basis_value ----------


def test_basis_none_when_no_line_is_excluded():
    assert _minimum_basis_value(200.0, [_line("SP_BUKAT_P006", 5)], SPS) is None


def test_basis_none_when_total_is_none():
    assert _minimum_basis_value(None, [_line("SP_BUKAT_P014", 1)], SPS) is None


def test_basis_subtracts_excluded_lines():
    lines = [
        _line("SP_BUKAT_P006", 20),  # 200, counts
        _line("SP_BUKAT_P011", 2),  # 60, excluded
        _line("SP_BUKAT_P014", 1),  # 95, excluded
    ]
    assert _minimum_basis_value(355.0, lines, SPS) == 200.0


def test_basis_uses_manager_final_when_positive():
    lines = [_line("SP_BUKAT_P011", 2, manager=5)]  # 5 × 30 = 150
    assert _minimum_basis_value(400.0, lines, SPS) == 250.0


def test_basis_values_an_untouched_line_at_captain_final():
    # manager_final 0 with the flag off = the Manager never touched the line.
    lines = [_line("SP_BUKAT_P011", 2, manager=0)]
    assert _minimum_basis_value(400.0, lines, SPS) == 340.0


def test_basis_values_a_line_the_manager_zeroed_at_zero():
    # order-line-zero-qty: an explicit Manager 0 is out of the order, so an
    # excluded zeroed line no longer lowers the basis.
    lines = [_line("SP_BUKAT_P011", 2, manager=0, manager_set=True)]
    assert _minimum_basis_value(400.0, lines, SPS) == 400.0


def test_basis_missing_price_contributes_zero():
    lines = [_line("SP_BUKAT_P012", 3)]  # excluded, but no price
    assert _minimum_basis_value(120.0, lines, SPS) == 120.0


def test_basis_floors_at_zero():
    lines = [_line("SP_BUKAT_P014", 3)]  # 285 against a stale total of 100
    assert _minimum_basis_value(100.0, lines, SPS) == 0.0


def test_basis_ignores_lines_without_supplier_product():
    lines = [_line("SP_GONE_P999", 3), _line("SP_BUKAT_P014", 1)]
    assert _minimum_basis_value(300.0, lines, SPS) == 205.0


def test_basis_rounds_to_grosze():
    sps = {"SP_X_P1": _sp("SP_X_P1", 0.333, counts=False)}
    assert _minimum_basis_value(10.0, [_line("SP_X_P1", 1)], sps) == 9.67


# ---------- The basis never gates ----------


def _bukat_with_minimum() -> Supplier:
    return Supplier(
        supplier_id="SUP_BUKAT",
        supplier_name="Bukat",
        email="zamowienia@bukat.example",
        minimum_order_value_pln=500.0,
    )


def test_submit_below_basis_is_accepted(mocker):
    """Seed backend (in-memory, nothing persisted): a Bukat order of only Feta
    blok — excluded, so its basis is 0 against a 500 PLN minimum — submits."""
    suppliers = [
        _bukat_with_minimum() if s.supplier_id == "SUP_BUKAT" else s
        for s in seed_loader.load_suppliers()
    ]
    mocker.patch.object(seed_loader, "load_suppliers", return_value=suppliers)
    body = {
        "supplier_id": "SUP_BUKAT",
        "ordered_by": "Test",
        "lines": [
            {
                "product_id": "P014",
                "supplier_product_id": "SP_BUKAT_P014",
                "captain_final_qty_purchase": 1,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["total_value_estimate_pln"] == 95.0
    assert not any("minim" in w.lower() for w in r.json()["warnings"])


def _feta_only_order(status: OrderStatus) -> Order:
    return Order(
        order_id="ORD-20260928-WOL-BUKA-feta01",
        location_id="WOLA",
        supplier_id="SUP_BUKAT",
        order_date=date(2026, 9, 28),
        status=status,
        captain_user="WOLA",
        captain_submitted_at=datetime(2026, 9, 28, 8, 0, tzinfo=timezone.utc),
        total_value_estimate_pln=95.0,
        lines=[
            OrderLine(
                order_line_id="OL-feta-001",
                order_id="ORD-20260928-WOL-BUKA-feta01",
                product_id="P014",
                supplier_product_id="SP_BUKAT_P014",
                captain_final_qty_purchase=1,
                captain_final_qty_base=2,
            )
        ],
    )


def _mock_sheets(mocker, order: Order) -> dict:
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "get_order", return_value=order)
    mocker.patch.object(sheets, "load_suppliers", return_value=[_bukat_with_minimum()])
    mocker.patch.object(
        sheets,
        "load_locations",
        return_value=[Location(location_id="WOLA", location_name="Pita Bros Wola")],
    )
    mocker.patch.object(
        sheets,
        "load_products",
        return_value=[
            Product(
                product_id="P014",
                product_name_pl="Feta blok",
                product_category="Chłodnia",
                inventory_unit="kg",
            )
        ],
    )
    mocker.patch.object(
        sheets,
        "load_supplier_products",
        return_value=[_sp("SP_BUKAT_P014", 95.0, counts=False)],
    )
    return {
        "update_order": mocker.patch.object(sheets, "update_order"),
        "update_order_lines": mocker.patch.object(sheets, "update_order_lines"),
    }


@pytest.mark.parametrize("step", ["claim", "dispatch"])
def test_claim_and_dispatch_below_basis_are_accepted(mocker, step):
    if step == "claim":
        mocks = _mock_sheets(mocker, _feta_only_order(OrderStatus.CAPTAIN_SUBMITTED))
        r = client.post(
            "/api/manager/claim/ORD-20260928-WOL-BUKA-feta01", headers=MANAGER_AUTH
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "manager_claimed"
    else:
        mocks = _mock_sheets(mocker, _feta_only_order(OrderStatus.MANAGER_CLAIMED))
        r = client.post(
            "/api/manager/dispatch",
            json={
                "order_id": "ORD-20260928-WOL-BUKA-feta01",
                "manager_finals": [
                    {"order_line_id": "OL-feta-001", "manager_final_qty_purchase": 1}
                ],
                "sent_method": "email",
            },
            headers=MANAGER_AUTH,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "manager_sent"
        # A compose link only — the Manager still sends it by hand.
        assert r.json()["gmail_compose_url"].startswith("https://mail.google.com/")
    mocks["update_order"].assert_called_once()
