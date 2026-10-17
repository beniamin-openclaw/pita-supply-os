"""Per-location ``require_stock_count`` flag (captain-stock-count-warning, D6).

The flag turns on a non-blocking warning in the Captain's confirm dialog when
the supplier's cards carry no stock count, or only zeros. It is ON everywhere
except NORBLIN and ELEKTROWNIA. These tests cover the backend half: the model
default when the column is absent, the seed CSV, and the flag on every item of
``GET /api/captain/orderable`` for the token's location. The warning itself is
frontend (``pages/captain-mp/lib/stockCountWarning.ts``). Nothing here submits
an order.
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app import seed_loader
from app.config import settings
from app.main import _build_orderable_items, app
from app.models import Location, LocationProductSetting, Product, SupplierProduct

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
NORBLIN_AUTH = {"Authorization": "Bearer test_norblin_token"}
MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}


# ---------- model + loaders ----------

def test_model_defaults_on_when_the_field_is_absent():
    """Seed, Sheets and a pre-0030 Postgres all omit the field: the model
    default must read as ON (the owner's rule for every location)."""
    assert Location(location_id="X", location_name="X").require_stock_count is True
    assert (
        Location(location_id="X", location_name="X", require_stock_count=False)
        .require_stock_count
        is False
    )


def test_seed_csv_has_norblin_off_and_every_other_location_on():
    flags = {loc.location_id: loc.require_stock_count for loc in seed_loader.load_locations()}
    assert flags["NORBLIN"] is False
    assert flags["WOLA"] is True
    assert {lid for lid, on in flags.items() if not on} == {"NORBLIN"}


def test_seed_csv_without_the_column_reads_on(tmp_path: Path):
    """An older locations.csv (no require_stock_count header) loads with the
    model default, and an empty cell does too (empty -> None -> dropped)."""
    old = tmp_path / "locations.csv"
    old.write_text(
        "location_id,location_name,active\nWOLA,Pita Bros Wola,TRUE\n", encoding="utf-8"
    )
    assert seed_loader._read(old, Location)[0].require_stock_count is True
    blank = tmp_path / "blank.csv"
    blank.write_text(
        "location_id,location_name,require_stock_count\nWOLA,Pita Bros Wola,\n",
        encoding="utf-8",
    )
    assert seed_loader._read(blank, Location)[0].require_stock_count is True


# ---------- endpoint (seed backend, real routes) ----------

@pytest.fixture
def norblin_token(mocker):
    """Add a NORBLIN captain token next to the conftest ones."""
    mocker.patch.object(
        settings,
        "captain_tokens",
        SecretStr("WOLA:test_wola_token,KEN:test_ken_token,NORBLIN:test_norblin_token"),
    )


def _orderable(auth: dict, supplier_id: str = "SUP_BUKAT") -> list[dict]:
    r = client.get(f"/api/captain/orderable?supplier_id={supplier_id}", headers=auth)
    assert r.status_code == 200, r.text
    items = r.json()
    assert items, "the seed should give this location orderable items"
    return items


def test_captain_orderable_carries_the_flag_on_for_wola():
    items = _orderable(WOLA_AUTH)
    assert all(item["require_stock_count"] is True for item in items)


def test_captain_orderable_carries_the_flag_off_for_norblin(norblin_token):
    items = _orderable(NORBLIN_AUTH)
    assert all(item["require_stock_count"] is False for item in items)
    # Same location flag on every supplier tab.
    assert all(
        item["require_stock_count"] is False for item in _orderable(NORBLIN_AUTH, "SUP_PAGO")
    )


def test_manager_orderable_twin_carries_the_location_flag():
    """The Manager twin shares the builder; the key is there (and ignored by
    the Manager screens)."""
    r = client.get(
        "/api/manager/orderable?supplier_id=SUP_BUKAT&location_id=NORBLIN",
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    assert r.json()
    assert all(item["require_stock_count"] is False for item in r.json())


# ---------- builder (stub backend) ----------

class _Backend:
    """Minimal stand-in for the `_choose_backend()` surface the builder reads."""

    def __init__(self, locations: list[Location]):
        self._locations = locations

    def load_products(self) -> list[Product]:
        return [
            Product(
                product_id="P1", product_name_pl="Pita", product_category="Chłodnia",
                inventory_unit="szt",
            )
        ]

    def load_supplier_products(self) -> list[SupplierProduct]:
        return [
            SupplierProduct(
                supplier_product_id="SP1", supplier_id="SUP_X", product_id="P1",
                supplier_product_name="Pita", purchase_unit="szt",
            )
        ]

    def load_location_product_settings(self) -> list[LocationProductSetting]:
        return [
            LocationProductSetting(
                setting_id=f"{loc}__P1", location_id=loc, product_id="P1",
                min_stock_qty_base=1, target_stock_qty_base=5, max_stock_qty_base=5,
            )
            for loc in ("WOLA", "NORBLIN", "NOWHERE")
        ]

    def load_suppliers(self) -> list:
        return []

    def load_locations(self) -> list[Location]:
        return self._locations


def test_builder_unknown_location_reads_on():
    """A location missing from the locations table (or no table rows at all)
    keeps the warning on — the column default."""
    items = _build_orderable_items(_Backend([]), "NOWHERE", "SUP_X")
    assert [i["require_stock_count"] for i in items] == [True]


def test_builder_uses_the_requested_location_only():
    backend = _Backend([
        Location(location_id="WOLA", location_name="Wola"),
        Location(location_id="NORBLIN", location_name="Norblin", require_stock_count=False),
    ])
    assert [i["require_stock_count"] for i in _build_orderable_items(
        backend, "WOLA", "SUP_X"
    )] == [True]
    assert [i["require_stock_count"] for i in _build_orderable_items(
        backend, "NORBLIN", "SUP_X"
    )] == [False]
