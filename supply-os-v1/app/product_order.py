"""Canonical product orders.

1. **Per supplier** (supplier-product-order-minimum): ``supplier_product_sort_key``
   / ``line_sort_key`` below.
2. **Per location, inventory card** (inventory-card-order): ``inventory_sort_key``
   at the end of this module. It has no TypeScript twin on purpose: the backend
   returns inventory rows already sorted, and the frontend "card" sort is a
   stable sort on ``inventory_order`` that keeps this module's ``product_id``
   tie-break (``frontend/src/lib/productListFilter.ts``).

Canonical order of a supplier's products (supplier-product-order-minimum).

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


# ---------- Inventory card order (inventory-card-order, migration 0027) ----------
#
# Location-wide inventory lists (Captain count grid, its correction screen, the
# Captain count history, the Manager inventory detail and its CSV) follow the
# location's printed inventory card:
#
#     effective position = location_product_settings.inventory_order (override)
#                          else products.inventory_order (common template);
#     positioned rows first by effective position, then rows without one;
#     every tie by product_id.
#
# The card pipeline (context/changes/inventory-card-order/data/) proves its
# positions against this exact key, so SQL and code agree on equal values.


def effective_inventory_order(
    setting_order: Optional[int], product_order: Optional[int]
) -> Optional[int]:
    """The location's override when set, else the product's template position."""
    return setting_order if setting_order is not None else product_order


def inventory_sort_key(
    effective: Optional[int], product_id: str
) -> tuple[bool, int, str]:
    """Sort key: ``(no position, position, product_id)``."""
    return (effective is None, effective or 0, product_id or "")
