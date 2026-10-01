"""Canonical supplier-product order (supplier-product-order-minimum).

The same fixture is asserted by the TS twin in
frontend/src/lib/productOrder.test.ts — keep both in sync.
"""
from types import SimpleNamespace

from app.models import Product, SupplierProduct
from app.product_order import (
    effective_inventory_order,
    inventory_sort_key,
    line_sort_key,
    supplier_product_sort_key,
)

# (display_order, supplier_product_id) — shared with productOrder.test.ts.
FIXTURE = [
    (None, "SP_BUKAT_P002"),
    (30, "SP_BUKAT_P004"),
    (None, "SP_BUKAT_P135"),
    (10, "SP_BUKAT_P006"),
    (30, "SP_BUKAT_P003"),  # equal position -> tie by id
    (20, "SP_BUKAT_P016"),
    (None, "SP_BUKAT_P001"),
]
EXPECTED = [
    "SP_BUKAT_P006",
    "SP_BUKAT_P016",
    "SP_BUKAT_P003",
    "SP_BUKAT_P004",
    "SP_BUKAT_P001",
    "SP_BUKAT_P002",
    "SP_BUKAT_P135",
]


def test_positions_first_then_id_ties_and_unpositioned():
    ordered = sorted(FIXTURE, key=lambda row: supplier_product_sort_key(*row))
    assert [sp_id for _, sp_id in ordered] == EXPECTED


def test_zero_and_negative_positions_are_real_positions():
    ordered = sorted(
        [(None, "A"), (0, "C"), (-5, "B")],
        key=lambda row: supplier_product_sort_key(*row),
    )
    assert [sp_id for _, sp_id in ordered] == ["B", "C", "A"]


def _sp(sp_id: str, display_order):
    return SupplierProduct(
        supplier_product_id=sp_id, supplier_id="SUP_BUKAT", product_id="P" + sp_id[-3:],
        supplier_product_name=sp_id, purchase_unit="kg", display_order=display_order,
    )


def test_line_sort_key_resolves_position_through_sps_and_tolerates_unknown():
    sps_by_id = {
        "SP_BUKAT_P006": _sp("SP_BUKAT_P006", 10),
        "SP_BUKAT_P002": _sp("SP_BUKAT_P002", 40),
        # A Product entry in the same dict (gmail_url's merged map) has no
        # display_order and must read as position-less.
        "P999": Product(
            product_id="P999", product_name_pl="X", product_category="C",
            inventory_unit="szt",
        ),
    }
    lines = [
        SimpleNamespace(supplier_product_id="SP_UNKNOWN"),
        SimpleNamespace(supplier_product_id="SP_BUKAT_P002"),
        SimpleNamespace(supplier_product_id="P999"),
        SimpleNamespace(supplier_product_id="SP_BUKAT_P006"),
    ]
    lines.sort(key=line_sort_key(sps_by_id))
    assert [ln.supplier_product_id for ln in lines] == [
        "SP_BUKAT_P006",
        "SP_BUKAT_P002",
        "P999",
        "SP_UNKNOWN",
    ]


# ---------- Inventory card order (inventory-card-order) ----------


def test_effective_inventory_order_prefers_the_location_override():
    assert effective_inventory_order(15, 40) == 15
    assert effective_inventory_order(None, 40) == 40
    assert effective_inventory_order(None, None) is None
    # 0 is a real override, not "unset".
    assert effective_inventory_order(0, 40) == 0


def test_inventory_sort_key_positions_first_then_product_id():
    rows = [
        (None, "P010"),
        (40, "P005"),
        (10, "P009"),
        (40, "P003"),  # equal position -> tie by product_id
        (None, "P002"),
        (0, "P100"),
    ]
    ordered = sorted(rows, key=lambda r: inventory_sort_key(*r))
    assert ordered == [
        (0, "P100"),
        (10, "P009"),
        (40, "P003"),
        (40, "P005"),
        (None, "P002"),
        (None, "P010"),
    ]
