"""Stock value of a submitted inventory count (Manager view, inventory-value).

Pure helpers, no I/O. A count line is in the product's INVENTORY unit, while a
price lives on a supplier_product per PURCHASE unit, so the value of one line
is ``qty × price_estimate_pln / units_per_purchase_unit``.

There is no VAT rate in master data yet, so the gross value uses an ESTIMATED
rate per product: by category, with a few name-based exceptions taken from the
rates printed on the purchase invoices (eBiuro mirror). The screen labels gross
as an estimate. Moving VAT into master data is the follow-up that removes the
guess.
"""
from __future__ import annotations

from typing import Optional

from .models import Product, Supplier, SupplierProduct

_INTERNAL_SUPPLIER_ID = "SUP_INTERNAL"

# Category → rate. Food categories are 5%; everything else 23%.
_VAT_BY_CATEGORY: dict[str, float] = {
    "spożywcze": 0.05,
    "chłodnia": 0.05,
    "mrożonki": 0.05,
    "produkcja": 0.05,
    "napoje": 0.23,
    "wino": 0.23,
    "chemia": 0.23,
    "opakowania": 0.23,
    "biurowe": 0.23,
    "gaz": 0.23,
}
# Name keyword → rate, checked before the category (first match wins).
_VAT_BY_NAME: tuple[tuple[str, float], ...] = (
    ("cappy", 0.05),  # fruit juice
    ("kawa", 0.23),
    ("woda", 0.23),
    ("ketchup", 0.08),
    ("majonez", 0.08),
    ("sriracha", 0.08),
    ("papryka słodka", 0.08),
    ("musztard", 0.08),
    ("domestos", 0.08),
    ("rękawiczk", 0.08),
)
_DEFAULT_VAT = 0.23


def estimated_vat_rate(product: Optional[Product]) -> float:
    """Estimated VAT rate (0.05 / 0.08 / 0.23) for ``product``; 23% when unknown."""
    if product is None:
        return _DEFAULT_VAT
    name = product.product_name_pl.lower()
    for keyword, rate in _VAT_BY_NAME:
        if keyword in name:
            return rate
    return _VAT_BY_CATEGORY.get(product.product_category.strip().lower(), _DEFAULT_VAT)


def inventory_unit_price(
    product_id: str,
    sps: list[SupplierProduct],
    suppliers_by_id: dict[str, Supplier],
) -> Optional[float]:
    """Net price of ONE inventory unit of ``product_id``, or None when no
    priced supplier_product exists.

    Candidates: active supplier_products of an active supplier with a positive
    ``price_estimate_pln``. An external supplier beats ``SUP_INTERNAL``; then
    the lowest ``supplier_product_id`` (stable, same tie-break as
    ``main._primary_supplier_product``)."""
    candidates = [
        sp
        for sp in sps
        if sp.product_id == product_id
        and sp.active
        and getattr(suppliers_by_id.get(sp.supplier_id), "active", False)
        and sp.price_estimate_pln
        and sp.price_estimate_pln > 0
        and sp.units_per_purchase_unit > 0
    ]
    if not candidates:
        return None
    external = [sp for sp in candidates if sp.supplier_id != _INTERNAL_SUPPLIER_ID]
    sp = min(external or candidates, key=lambda c: c.supplier_product_id)
    return sp.price_estimate_pln / sp.units_per_purchase_unit
