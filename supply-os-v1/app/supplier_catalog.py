"""Which supplier_products rows a location orders from (krakow-katowice-rollout).

Two catalogs live in one table since migration 0029:

- shared rows (``location_id`` NULL) — the Warsaw catalog, used by every
  location whose ``own_catalog`` is False, exactly as before;
- scoped rows (``location_id`` = a location) — used ONLY by that location,
  which has ``own_catalog`` True (Kraków FORUM, Katowice SUPERSAM buy from
  their own city suppliers, so they must not inherit Blue Service, Intermlecz…).

A location never mixes the two: an own-catalog location sees none of the
shared rows, and every other location sees none of the scoped rows. A product
the own-catalog location carries with no scoped row is count-only there (on
the inventory list, in no order tab).

The scope is decided over ALL suppliers' rows; filter by supplier afterwards.

Pure functions — no backend imports, no I/O.
"""

from __future__ import annotations

from typing import Iterable, Optional

from .models import Location, Product, Supplier, SupplierProduct

_INTERNAL_SUPPLIER_ID = "SUP_INTERNAL"


def location_scope(
    location_id: Optional[str], locations: Iterable[Location]
) -> Optional[str]:
    """The ``location_id`` value of the rows ``location_id`` orders from:
    the location itself when it has ``own_catalog``, else None (shared rows).
    An unknown location reads the shared catalog (today's behaviour)."""
    if location_id is None:
        return None
    for loc in locations:
        if loc.location_id == location_id:
            return loc.location_id if loc.own_catalog else None
    return None


def rows_in_scope(
    sps: Iterable[SupplierProduct], scope: Optional[str]
) -> list[SupplierProduct]:
    """Every row (active or not) of the catalog ``scope`` names — see
    ``location_scope``. Inactive rows are kept: callers that resolve an
    existing order line by ``supplier_product_id`` (the Captain edit) still
    find a row that was retired after the order was placed."""
    return [sp for sp in sps if sp.location_id == scope]


def effective_supplier_products(
    sps: Iterable[SupplierProduct],
    location_id: Optional[str],
    locations: Iterable[Location],
) -> list[SupplierProduct]:
    """ACTIVE rows of the catalog ``location_id`` orders from. ``location_id``
    None (a location-agnostic caller) → the shared catalog."""
    scope = location_scope(location_id, locations)
    return [sp for sp in rows_in_scope(sps, scope) if sp.active]


def is_orderable_supplier(supplier: Optional[Supplier]) -> bool:
    """An active supplier a Captain can order from (not on-site production)."""
    return (
        supplier is not None
        and supplier.active
        and supplier.supplier_id != _INTERNAL_SUPPLIER_ID
    )


def suppliers_by_product(
    effective_sps: Iterable[SupplierProduct],
    suppliers_by_id: dict[str, Supplier],
    products_by_id: dict[str, Product],
    settings_pids: set[str],
) -> dict[str, list[SupplierProduct]]:
    """Orderable rows per product at one location: rows of an orderable
    supplier whose product is active and has a setting at the location. A
    product's list holds one row per supplier (the lowest
    ``supplier_product_id`` when a supplier has two), primary (non-backup)
    rows first, then by supplier name."""
    by_pid: dict[str, dict[str, SupplierProduct]] = {}
    for sp in effective_sps:
        if not sp.active or sp.product_id not in settings_pids:
            continue
        if not is_orderable_supplier(suppliers_by_id.get(sp.supplier_id)):
            continue
        if not getattr(products_by_id.get(sp.product_id), "active", False):
            continue
        per_supplier = by_pid.setdefault(sp.product_id, {})
        current = per_supplier.get(sp.supplier_id)
        if current is None or sp.supplier_product_id < current.supplier_product_id:
            per_supplier[sp.supplier_id] = sp

    def _key(sp: SupplierProduct) -> tuple[bool, str, str]:
        supplier = suppliers_by_id.get(sp.supplier_id)
        name = supplier.supplier_name if supplier else sp.supplier_id
        return (sp.is_backup, name.lower(), sp.supplier_id)

    return {
        pid: sorted(rows.values(), key=_key) for pid, rows in by_pid.items()
    }


def multi_supplier_products(
    rows_by_pid: dict[str, list[SupplierProduct]],
) -> dict[str, list[SupplierProduct]]:
    """The products of ``suppliers_by_product`` offered by two or more
    suppliers at the location — the only ones that carry the "already ordered
    elsewhere" hint."""
    return {pid: rows for pid, rows in rows_by_pid.items() if len(rows) > 1}
