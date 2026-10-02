"""Pure helpers behind the Manager inventory stock value (inventory-value)."""
from __future__ import annotations

from app.inventory_value import estimated_vat_rate, inventory_unit_price
from app.models import Product, Supplier, SupplierProduct


def _p(name: str, category: str) -> Product:
    return Product(
        product_id="P1", product_name_pl=name, product_category=category, inventory_unit="szt"
    )


def test_vat_by_category():
    assert estimated_vat_rate(_p("Pomidor", "Chłodnia")) == 0.05
    assert estimated_vat_rate(_p("Frytki", "Mrożonki")) == 0.05
    assert estimated_vat_rate(_p("Sprite", "Napoje")) == 0.23
    assert estimated_vat_rate(_p("Folia", "Opakowania")) == 0.23


def test_vat_name_exceptions_win_over_category():
    assert estimated_vat_rate(_p("Cappy Jabłko", "Napoje")) == 0.05
    assert estimated_vat_rate(_p("Fanex Majonez 4kg", "Spożywcze")) == 0.08
    assert estimated_vat_rate(_p("Woda 5L", "Spożywcze")) == 0.23
    assert estimated_vat_rate(_p("Rękawiczki jednorazowe L", "Chemia")) == 0.08


def test_vat_unknown_defaults_to_23():
    assert estimated_vat_rate(None) == 0.23
    assert estimated_vat_rate(_p("X", "Inne")) == 0.23


SUPPLIERS = {
    "SUP_A": Supplier(supplier_id="SUP_A", supplier_name="A"),
    "SUP_B": Supplier(supplier_id="SUP_B", supplier_name="B", active=False),
    "SUP_INTERNAL": Supplier(supplier_id="SUP_INTERNAL", supplier_name="Internal"),
}


def _sp(spid: str, sup: str, price: float | None, upu: float = 1, active: bool = True):
    return SupplierProduct(
        supplier_product_id=spid, supplier_id=sup, product_id="P1",
        supplier_product_name=spid, purchase_unit="op", units_per_purchase_unit=upu,
        price_estimate_pln=price, active=active,
    )


def test_unit_price_divides_by_units_per_purchase_unit():
    assert inventory_unit_price("P1", [_sp("SP1", "SUP_A", 60, upu=6)], SUPPLIERS) == 10


def test_unit_price_skips_unpriced_inactive_and_prefers_external():
    sps = [
        _sp("SP0", "SUP_A", None),            # no price
        _sp("SP1", "SUP_A", 50, active=False),  # inactive row
        _sp("SP2", "SUP_B", 40),              # inactive supplier
        _sp("SP3", "SUP_INTERNAL", 5),        # internal loses to external
        _sp("SP4", "SUP_A", 20),
    ]
    assert inventory_unit_price("P1", sps, SUPPLIERS) == 20


def test_unit_price_none_without_candidates():
    assert inventory_unit_price("P1", [], SUPPLIERS) is None
    assert inventory_unit_price("P1", [_sp("SP3", "SUP_INTERNAL", None)], SUPPLIERS) is None
