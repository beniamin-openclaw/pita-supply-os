"""``_build_orderable_items`` must hide retired catalogue rows.

Regression guard for a bug that lived in production: the orderable list filtered
on supplier + location setting but IGNORED both ``active`` flags, so a
supplier_product retired with ``active = false`` kept showing on the Captain's
order screen. On prod, Feta blok / Tirokafteri / Tzatzyki were deactivated on
SUP_PAGO (they are Bukat's goods) and were still orderable from Pago — 7 order
lines each inside 60 days — plus ~30 further retired rows across four other
active suppliers.

Uses a stub backend rather than the TestClient: the function reads the whole of
its master data through the backend seam, so a stub is the honest unit boundary.
"""
from app.main import _build_orderable_items
from app.models import LocationProductSetting, Product, SupplierProduct


class _Backend:
    """Minimal stand-in for the `_choose_backend()` module surface used here."""

    def __init__(self, products, supplier_products, settings):
        self._products = products
        self._sps = supplier_products
        self._settings = settings

    def load_products(self):
        return self._products

    def load_supplier_products(self):
        return self._sps

    def load_location_product_settings(self):
        return self._settings


def _product(pid: str, *, active: bool = True) -> Product:
    return Product(
        product_id=pid,
        product_name_pl=f"Produkt {pid}",
        product_category="Chłodnia",
        inventory_unit="kg",
        active=active,
    )


def _sp(pid: str, *, supplier: str = "SUP_PAGO", active: bool = True) -> SupplierProduct:
    return SupplierProduct(
        supplier_product_id=f"SP_{supplier.replace('SUP_', '')}_{pid}",
        supplier_id=supplier,
        product_id=pid,
        supplier_product_name=f"Produkt {pid}",
        purchase_unit="kg",
        active=active,
    )


def _setting(pid: str, location: str = "WOLA") -> LocationProductSetting:
    return LocationProductSetting(
        setting_id=f"{location}__{pid}",
        location_id=location,
        product_id=pid,
        min_stock_qty_base=1,
        max_stock_qty_base=5,
        target_stock_qty_base=5,
    )


def _ids(items) -> list[str]:
    return [i["product_id"] for i in items]


def test_retired_supplier_product_is_not_orderable():
    """The production bug: sp.active = False was ignored."""
    backend = _Backend(
        products=[_product("P011"), _product("P024")],
        supplier_products=[_sp("P011", active=False), _sp("P024")],
        settings=[_setting("P011"), _setting("P024")],
    )
    assert _ids(_build_orderable_items(backend, "WOLA", "SUP_PAGO")) == ["P024"]


def test_discontinued_product_is_not_orderable():
    """Same class of bug on the product side. `captain_inventory_products`
    already filtered on `product.active`; this path did not."""
    backend = _Backend(
        products=[_product("P011", active=False), _product("P024")],
        supplier_products=[_sp("P011"), _sp("P024")],
        settings=[_setting("P011"), _setting("P024")],
    )
    assert _ids(_build_orderable_items(backend, "WOLA", "SUP_PAGO")) == ["P024"]


def test_retiring_one_supplier_leaves_the_other_orderable():
    """The exact prod shape: Tzatzyki retired on Pago, still live on Bukat.
    Hiding it from Pago must NOT hide it from Bukat."""
    backend = _Backend(
        products=[_product("P011")],
        supplier_products=[
            _sp("P011", supplier="SUP_PAGO", active=False),
            _sp("P011", supplier="SUP_BUKAT", active=True),
        ],
        settings=[_setting("P011")],
    )
    assert _ids(_build_orderable_items(backend, "WOLA", "SUP_PAGO")) == []
    assert _ids(_build_orderable_items(backend, "WOLA", "SUP_BUKAT")) == ["P011"]


def test_product_without_a_location_setting_stays_excluded():
    """The pre-existing location filter must survive the new ones."""
    backend = _Backend(
        products=[_product("P011"), _product("P024")],
        supplier_products=[_sp("P011"), _sp("P024")],
        settings=[_setting("P024")],
    )
    assert _ids(_build_orderable_items(backend, "WOLA", "SUP_PAGO")) == ["P024"]
