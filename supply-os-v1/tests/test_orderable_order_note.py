"""Unit test: supplier_products.order_note flows through to the orderable item.

Pure call into ``main._build_orderable_item`` (no TestClient) — mirrors the
``_aggregate_suggestion_review`` pure-function test style.
"""
from app.main import _build_orderable_item
from app.models import LocationProductSetting, Product, SupplierProduct


def _product() -> Product:
    return Product(
        product_id="P011",
        product_name_pl="Tzatziki",
        product_category="Sosy",
        inventory_unit="kg",
    )


def _sp(order_note=None) -> SupplierProduct:
    return SupplierProduct(
        supplier_product_id="SP_BUKAT_P011",
        supplier_id="SUP_BUKAT",
        product_id="P011",
        supplier_product_name="Tzatzyki",
        purchase_unit="wiadro",
        units_per_purchase_unit=3.0,
        order_note=order_note,
    )


def _setting() -> LocationProductSetting:
    return LocationProductSetting(
        setting_id="WOLA__P011",
        location_id="WOLA",
        product_id="P011",
        min_stock_qty_base=18,
        max_stock_qty_base=30,
        target_stock_qty_base=30,
    )


def test_orderable_carries_order_note():
    item = _build_orderable_item(
        _sp(order_note="1 karton = 6 szt (18 kg)"),
        {"P011": _product()},
        {"P011": _setting()},
    )
    assert item["order_note"] == "1 karton = 6 szt (18 kg)"
    # min flows through unchanged (the FE renders the below-minimum signal off it).
    assert item["min_stock_qty_base"] == 18


def test_orderable_order_note_defaults_none():
    item = _build_orderable_item(
        _sp(),
        {"P011": _product()},
        {"P011": _setting()},
    )
    assert item["order_note"] is None
