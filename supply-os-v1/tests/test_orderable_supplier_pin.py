"""supplier-per-location: `location_product_settings.source_supplier_id`.

Covers both chokepoints, because they are separate functions and the whole point
of the plan-review F1 fix is that they cannot drift:

- READ  — `_build_orderable_items`, behind `/api/captain/orderable`
- WRITE — `_resolve_master_data`, behind `POST /api/captain/submit`

Fixture shape (location WOLA, suppliers Alpha and Beta):

    P001 Frytki      carried by BOTH, unpinned      -> visible at both
    P002 Dlugopisy   carried by BOTH, pinned Beta   -> visible at Beta only
    P003 Zszywki     carried by Alpha, catalog row inactive
    P004 Markery     carried by Alpha, PRODUCT inactive
    P005 Sos         carried by Alpha, pinned Beta  -> orphan pin, nowhere

`_enable_sheet` stubs the sheet backend the same way `test_manager_add_line`
does; the suite never touches a live sheet (see conftest).
"""
from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from app import sheets
from app.config import DataBackend
from app.main import _supplier_allowed, app
from app.models import (
    LocationProductSetting,
    Product,
    Supplier,
    SupplierProduct,
)

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}


def _products() -> list[Product]:
    def mk(pid: str, name: str, active: bool = True) -> Product:
        return Product(
            product_id=pid,
            product_name_pl=name,
            product_category="Test",
            inventory_unit="szt",
            active=active,
        )

    return [
        mk("P001", "Frytki"),
        mk("P002", "Dlugopisy"),
        mk("P003", "Zszywki"),
        mk("P004", "Markery", active=False),
        mk("P005", "Sos"),
    ]


def _suppliers() -> list[Supplier]:
    return [
        Supplier(supplier_id="SUP_A", supplier_name="Alpha"),
        Supplier(supplier_id="SUP_B", supplier_name="Beta"),
    ]


def _supplier_products() -> list[SupplierProduct]:
    def mk(sup: str, pid: str, active: bool = True) -> SupplierProduct:
        return SupplierProduct(
            supplier_product_id=f"SP_{sup}_{pid}",
            supplier_id=f"SUP_{sup}",
            product_id=pid,
            supplier_product_name=f"{pid} @ {sup}",
            purchase_unit="karton",
            units_per_purchase_unit=1.0,
            active=active,
        )

    return [
        mk("A", "P001"), mk("B", "P001"),          # both carry it
        mk("A", "P002"), mk("B", "P002"),          # both carry it, pinned to B
        mk("A", "P003", active=False),             # inactive catalog row
        mk("A", "P004"),                           # inactive product
        mk("A", "P005"),                           # pinned to B, which has no row
    ]


def _settings() -> list[LocationProductSetting]:
    def mk(pid: str, pin: str | None = None) -> LocationProductSetting:
        return LocationProductSetting(
            setting_id=f"LPS_WOLA_{pid}",
            location_id="WOLA",
            product_id=pid,
            target_stock_qty_base=10,
            max_stock_qty_base=20,
            source_supplier_id=pin,
        )

    return [
        mk("P001"),
        mk("P002", "SUP_B"),
        mk("P003"),
        mk("P004"),
        mk("P005", "SUP_B"),
    ]


def _enable_sheet(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_products", return_value=_products())
    mocker.patch.object(sheets, "load_suppliers", return_value=_suppliers())
    mocker.patch.object(
        sheets, "load_supplier_products", return_value=_supplier_products()
    )
    mocker.patch.object(
        sheets, "load_location_product_settings", return_value=_settings()
    )


def _orderable(supplier_id: str) -> dict[str, dict]:
    r = client.get(
        "/api/captain/orderable",
        params={"supplier_id": supplier_id},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200, r.text
    return {item["product_id"]: item for item in r.json()}


# ---------- pure helper ----------

@pytest.mark.parametrize(
    "pin,supplier_id,expected",
    [
        (None, "SUP_A", True),      # unpinned -> any carrier (default behavior)
        ("SUP_A", "SUP_A", True),   # pinned to the supplier being asked about
        ("SUP_B", "SUP_A", False),  # pinned elsewhere -> narrowed out
    ],
)
def test_supplier_allowed_matrix(pin, supplier_id, expected):
    setting = LocationProductSetting(
        setting_id="S1", location_id="WOLA", product_id="P001", source_supplier_id=pin
    )
    assert _supplier_allowed(setting, supplier_id) is expected


def test_supplier_allowed_missing_setting_defers():
    """No setting -> True on purpose: the caller raises a more specific 400
    ("has no location_product_setting at this location"). Swallowing it here
    would degrade that message to the vaguer "not orderable"."""
    assert _supplier_allowed(None, "SUP_A") is True


# ---------- READ path: /api/captain/orderable ----------

def test_unpinned_product_visible_at_every_carrier(mocker):
    _enable_sheet(mocker)
    assert "P001" in _orderable("SUP_A")
    assert "P001" in _orderable("SUP_B")


def test_pinned_product_visible_only_at_the_pinned_supplier(mocker):
    _enable_sheet(mocker)
    assert "P002" not in _orderable("SUP_A")
    assert "P002" in _orderable("SUP_B")


def test_also_supplied_by_names_the_other_carrier(mocker):
    _enable_sheet(mocker)
    assert _orderable("SUP_A")["P001"]["also_supplied_by"] == ["Beta"]
    assert _orderable("SUP_B")["P001"]["also_supplied_by"] == ["Alpha"]


def test_pinned_product_has_no_alternatives(mocker):
    """A pin narrows to one supplier, so there is no 'also available from'."""
    _enable_sheet(mocker)
    assert _orderable("SUP_B")["P002"]["also_supplied_by"] == []


def test_inactive_catalog_row_is_not_orderable(mocker):
    """FR-029 — supplier_products.active used to be read by no code at all."""
    _enable_sheet(mocker)
    assert "P003" not in _orderable("SUP_A")


def test_inactive_product_is_not_orderable(mocker):
    """Consistency with the inventory screen, which already filters product.active."""
    _enable_sheet(mocker)
    assert "P004" not in _orderable("SUP_A")


def test_orphan_pin_makes_product_orderable_nowhere_and_warns(mocker, caplog):
    _enable_sheet(mocker)
    caplog.set_level(logging.WARNING)
    assert "P005" not in _orderable("SUP_A")
    assert "P005" not in _orderable("SUP_B")
    assert "Orphaned supplier pin" in caplog.text
    assert "P005" in caplog.text and "SUP_B" in caplog.text


def test_wola_alpha_returns_only_the_unpinned_product(mocker):
    """Whole-fixture assertion: four of five products are excluded, each for a
    different reason, so a regression in any single filter shows up here."""
    _enable_sheet(mocker)
    assert set(_orderable("SUP_A")) == {"P001"}
    assert set(_orderable("SUP_B")) == {"P001", "P002"}


# ---------- WRITE path: POST /api/captain/submit (plan-review F1) ----------

def _submit(supplier_id: str, supplier_product_id: str, product_id: str, qty: float = 10):
    return client.post(
        "/api/captain/submit",
        json={
            "supplier_id": supplier_id,
            "ordered_by": "test",
            "lines": [
                {
                    "product_id": product_id,
                    "supplier_product_id": supplier_product_id,
                    "current_stock_qty_base": 0,
                    # target 10, stock 0 -> suggestion 10; match it so the
                    # deviation gate does not fire and mask the pin gate.
                    "captain_final_qty_purchase": qty,
                }
            ],
        },
        headers=WOLA_AUTH,
    )


def test_submit_rejects_a_line_pinned_to_another_supplier(mocker):
    """The regression test for the stale-draft path: a draft persists in local
    storage with no expiry, so a line built before a pin can be POSTed after it.
    The screen would never offer it; the server must refuse it too."""
    _enable_sheet(mocker)
    r = _submit("SUP_A", "SP_A_P002", "P002")
    assert r.status_code == 400, r.text
    assert "not orderable at this location" in r.json()["detail"]


def test_submit_rejects_a_line_for_an_inactive_catalog_row(mocker):
    _enable_sheet(mocker)
    r = _submit("SUP_A", "SP_A_P003", "P003")
    assert r.status_code == 400, r.text
    assert "not orderable at this location" in r.json()["detail"]


def test_submit_accepts_an_unpinned_line(mocker):
    """The negative controls above must not be passing for the wrong reason."""
    _enable_sheet(mocker)
    mocker.patch.object(sheets, "append_order", return_value=None)
    mocker.patch.object(sheets, "append_order_lines", return_value=None)
    r = _submit("SUP_A", "SP_A_P001", "P001")
    assert r.status_code == 200, r.text
    assert r.json()["line_count"] == 1
