"""A supplier with ``suggestion_alerts_enabled = False`` (pago-suggestion-no-alerts).

The Captain still gets the suggestion, but no reason gate ever fires and no
warning is returned: the >25% deviation, critical under-order and uncounted
over-MAX gates are all skipped. The line still persists the suggestion and
``delta_vs_suggestion_pct`` (the learning record). A supplier with the flag on
keeps every gate — covered by test_captain_submit.py, which runs on the seed
suppliers where every flag defaults to True.

Master data = the seed CSVs served through a mocked sheet backend, with only
SUP_PAGO's flag flipped off.
"""
import pytest
from fastapi.testclient import TestClient

from app import seed_loader, sheets
from app.config import DataBackend
from app.main import app

from .test_captain_orders import _enable_sheet, _order, _supplier

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}


def _pago_without_alerts():
    return [
        s.model_copy(update={"suggestion_alerts_enabled": False})
        if s.supplier_id == "SUP_PAGO"
        else s
        for s in seed_loader.load_suppliers()
    ]


@pytest.fixture
def sheet_seed(mocker):
    """Sheet mode over the seed CSVs; SUP_PAGO has alerts off. Returns the
    ``append_order_lines`` mock so the persisted lines can be inspected."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "append_order")
    appended = mocker.patch.object(sheets, "append_order_lines")
    mocker.patch.object(sheets, "load_products", side_effect=seed_loader.load_products)
    mocker.patch.object(sheets, "load_suppliers", return_value=_pago_without_alerts())
    mocker.patch.object(
        sheets, "load_supplier_products", side_effect=seed_loader.load_supplier_products
    )
    mocker.patch.object(
        sheets,
        "load_location_product_settings",
        side_effect=seed_loader.load_location_product_settings,
    )
    return appended


def _body(**line) -> dict:
    base = {"product_id": "P027", "supplier_product_id": "SP_PAGO_P027"}
    base.update(line)
    return {"supplier_id": "SUP_PAGO", "ordered_by": "Jan Kowalski", "lines": [base]}


def test_deviation_over_25pct_without_reason_is_accepted(sheet_seed):
    """WOLA P027 target 12, stock 7 → suggestion 1 karton; ordering 4 is +300%.
    With alerts on this is a 400; with alerts off it is a plain 200."""
    r = client.post(
        "/api/captain/submit",
        json=_body(current_stock_qty_base=7, captain_final_qty_purchase=4),
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []
    line = sheet_seed.call_args[0][0][0]
    assert line.suggested_qty_purchase == 1
    assert line.captain_final_qty_purchase == 4
    assert line.delta_vs_suggestion_pct == pytest.approx(3.0)
    assert line.reason_code is None


def test_critical_underorder_without_reason_is_accepted(sheet_seed):
    """P027 is critical at WOLA; ordering 0 against suggestion 1 needs no reason."""
    r = client.post(
        "/api/captain/submit",
        json=_body(current_stock_qty_base=7, captain_final_qty_purchase=0),
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []


def test_uncounted_over_max_without_reason_is_accepted(sheet_seed):
    """No stock counted, 3 kartons = 15 kg > max 12 → no reason, no warning."""
    r = client.post(
        "/api/captain/submit",
        json=_body(captain_final_qty_purchase=3),
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []
    line = sheet_seed.call_args[0][0][0]
    assert line.current_stock_qty_base == 0
    assert line.delta_vs_suggestion_pct is None


def test_above_target_order_has_no_info_warning(sheet_seed):
    """Stock ≥ target with an order would return an "(info)" warning with
    alerts on; with alerts off the response carries no warning at all."""
    r = client.post(
        "/api/captain/submit",
        json=_body(current_stock_qty_base=20, captain_final_qty_purchase=2),
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []


def test_other_supplier_keeps_its_gates(sheet_seed):
    """Only SUP_PAGO is switched off — Bukat's deviation gate still fires."""
    body = {
        "supplier_id": "SUP_BUKAT",
        "ordered_by": "Jan Kowalski",
        "lines": [
            {
                "product_id": "P009",
                "supplier_product_id": "SP_BUKAT_P009",
                "current_stock_qty_base": 0,
                "captain_final_qty_purchase": 50,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 400
    assert "without reason_code" in r.json()["detail"]


def test_orderable_carries_the_flag(sheet_seed):
    r = client.get("/api/captain/orderable?supplier_id=SUP_PAGO", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    items = r.json()
    assert items
    assert all(it["suggestion_alerts_enabled"] is False for it in items)

    r = client.get("/api/captain/orderable?supplier_id=SUP_BUKAT", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert all(it["suggestion_alerts_enabled"] is True for it in r.json())


def test_captain_edit_skips_gates_and_detail_carries_flag(mocker):
    """The edit path shares _evaluate_submit_line: a +300% line with no reason
    is accepted, and the order detail tells the edit screen alerts are off."""
    order = _order("ORD-A")
    _enable_sheet(mocker, orders=[order], get_order_return=order, delete_lines_return=1)
    mocker.patch.object(
        sheets,
        "load_suppliers",
        return_value=[_supplier().model_copy(update={"suggestion_alerts_enabled": False})],
    )

    r = client.get("/api/captain/order/ORD-A", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["suggestion_alerts_enabled"] is False

    r = client.patch(
        "/api/captain/order/ORD-A",
        headers=WOLA_AUTH,
        json={
            "lines": [
                {
                    "product_id": "P027",
                    "supplier_product_id": "SP_PAGO_P027",
                    "current_stock_qty_base": 18.0,
                    "captain_final_qty_purchase": 5.0,
                }
            ]
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []
