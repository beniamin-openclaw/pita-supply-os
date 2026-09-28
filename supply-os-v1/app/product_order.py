"""Canonical order of a supplier's products (supplier-product-order-minimum).

One rule for every per-supplier list and document — Captain order/edit/detail/
receiving, Manager order detail, dispatch e-mail, copy lists, Transport:

    positioned rows first, by ``display_order`` ascending,
    then rows without a position, and every tie, by ``supplier_product_id``.

The tie-break is the ASCII ``supplier_product_id`` (compared by code point), not
the product name: it keeps each supplier's current order for rows without a
position, and it compares identically in Python and TypeScript, so the two
dispatch e-mail builders stay byte-identical. The TS twin is
``frontend/src/lib/productOrder.ts`` (``compareProductOrder``) — change both
together.
"""
from __future__ import annotations

from typing import Any, Callable, Mapping, Optional


def supplier_product_sort_key(
    display_order: Optional[int], supplier_product_id: str
) -> tuple[bool, int, str]:
    """Sort key: ``(no position, position, supplier_product_id)``."""
    return (display_order is None, display_order or 0, supplier_product_id or "")


def line_sort_key(sps_by_id: Mapping[str, Any]) -> Callable[[Any], tuple[bool, int, str]]:
    """Key function for anything carrying ``.supplier_product_id`` (order lines,
    receipt lines, enriched line details), resolving ``display_order`` through
    ``sps_by_id``. A line whose supplier product is unknown sorts as a row
    without a position.

    ``sps_by_id`` may be the merged dict ``gmail_url`` receives, which holds
    ``Product`` entries (``P…`` ids) next to ``SupplierProduct`` entries
    (``SP_…`` ids); the two id namespaces never collide, and a ``Product``
    carries no ``display_order`` (read as None).
    """

    def key(line: Any) -> tuple[bool, int, str]:
        sp_id = line.supplier_product_id
        sp = sps_by_id.get(sp_id)
        return supplier_product_sort_key(getattr(sp, "display_order", None), sp_id)

    return key
