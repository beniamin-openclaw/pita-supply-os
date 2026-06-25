"""Build a Gmail compose URL (https://mail.google.com/mail/?view=cm&fs=1&...)
that opens with prefilled to/subject/body.

URL format:
    https://mail.google.com/mail/?view=cm&fs=1&to={email}&su={subject}&body={body}

Subject (Polish):
    "Zamówienie {location_name}"  (falls back to order_id if location unknown)

Body (Polish, plaintext, URL-encoded). Pure function — no I/O, easy to
unit-test. Raises ValueError for caller-recoverable problems; the HTTP layer
turns those into 4xx.
"""
from __future__ import annotations

import urllib.parse
from typing import Optional

from .models import Location, Order, OrderLine, Product, Supplier


GMAIL_COMPOSE_BASE = "https://mail.google.com/mail/"
MAX_GMAIL_URL_LENGTH = 8000


def _effective_qty(line: OrderLine) -> float:
    """Use manager_final if > 0, otherwise captain_final."""
    if line.manager_final_qty_purchase and line.manager_final_qty_purchase > 0:
        return line.manager_final_qty_purchase
    return line.captain_final_qty_purchase


def _format_delivery_address(location: Optional[Location]) -> str:
    """Supplier-facing delivery address: ``location_name, delivery_address, city``
    joined by ``", "`` with empty/missing parts skipped.

    Kept byte-identical to the TS twin
    (frontend/src/pages/manager/lib/emailBody.ts) so the preview the manager
    edits and this re-open URL never diverge. Replaces the older
    ``delivery_address or location_name`` fallback, which dropped both the
    location name and the city whenever a street address was present.
    """
    if location is None:
        return ""
    parts = [location.location_name, location.delivery_address, location.city]
    return ", ".join(p.strip() for p in parts if p and p.strip())


def _build_subject(order: Order, location: Optional[Location]) -> str:
    """Supplier-facing subject: ``Zamówienie {location_name}``.

    Falls back to the order id when the location is unknown (``location`` is
    Optional at the call boundary). Order id + delivery date live in the body.
    """
    if location is not None and location.location_name:
        return f"Zamówienie {location.location_name}"
    return f"Zamówienie {order.order_id}"


def _build_body(
    order: Order,
    supplier: Supplier,
    lines: list[OrderLine],
    products_by_id: dict[str, Product],
    location: Optional[Location],
) -> str:
    """Plaintext Polish body. Lines with effective qty 0 are skipped."""
    body_lines: list[str] = []
    body_lines.append("Dzien dobry,")
    body_lines.append("")
    body_lines.append("Prosze o przygotowanie zamowienia:")
    body_lines.append("")
    body_lines.append("Lp. | Produkt | Ilosc")

    # Sort by order_line_id for stable output
    visible = [ln for ln in lines if _effective_qty(ln) > 0]
    visible.sort(key=lambda ln: ln.order_line_id)

    # `products_by_id` carries BOTH Product entries (keyed by product_id) and
    # SupplierProduct entries (keyed by supplier_product_id) — the dispatch
    # endpoint merges them. We prefer the supplier-facing name + purchase_unit
    # from the SupplierProduct so the supplier reads names they recognise.
    for idx, line in enumerate(visible, start=1):
        product = products_by_id.get(line.product_id)
        sp_entry = products_by_id.get(line.supplier_product_id)

        # Supplier-facing name first — the supplier can't read our internal
        # product_name_pl / product_id. Fall back to the internal name, then id.
        supplier_name = getattr(sp_entry, "supplier_product_name", None)
        if supplier_name:
            product_name = supplier_name
        elif product is not None:
            product_name = product.product_name_pl
        else:
            product_name = line.product_id

        # Unit label: supplier purchase_unit, else product inventory_unit.
        purchase_unit = getattr(sp_entry, "purchase_unit", None)
        if purchase_unit:
            unit_label = purchase_unit
        elif product is not None:
            unit_label = product.inventory_unit or ""
        else:
            unit_label = ""

        qty = _effective_qty(line)
        # Show int qty without trailing .0 when whole
        qty_str = f"{qty:g}"
        body_lines.append(f"{idx}.  | {product_name} | {qty_str} {unit_label}".rstrip())

    body_lines.append("")
    # The estimated total is internal (Manager-panel only) and is deliberately
    # NOT included in the supplier email body (DEMO_FEEDBACK #7). Keep this in
    # sync with the TS twin (frontend/src/pages/manager/lib/emailBody.ts).
    address = _format_delivery_address(location)
    if address:
        body_lines.append(f"Adres dostawy: {address}")
    if order.requested_delivery_date is not None:
        body_lines.append(
            f"Data dostawy: {order.requested_delivery_date.isoformat()}"
        )
    else:
        body_lines.append("Data dostawy: do potwierdzenia")
    body_lines.append("")
    body_lines.append("Pozdrawiam,")
    body_lines.append("Pita Bros")
    body_lines.append(f"(zamowienie #{order.order_id})")

    return "\n".join(body_lines)


# NOTE (S-02): the dispatch email body is built in TWO parallel places that must
# change together. THIS builder populates ManagerDispatchResponse.gmail_compose_url,
# which the frontend uses ONLY for a session-only "re-open" link. The draft the
# operator actually sends is built CLIENT-SIDE by
# frontend/src/pages/manager/lib/emailBody.ts (from the editable subject/body).
# Any change to recipient / purchase units / product names / subject / Polish
# wording here must mirror there,
# or the two diverge. (Same split as the S-09 compute.ts vs suggestion.py note.)
def build_draft_url(
    order: Order,
    supplier: Supplier,
    lines: list[OrderLine],
    products_by_id: dict[str, Product],
    location: Optional[Location] = None,
) -> str:
    """Return a https://mail.google.com/mail/?... URL with prefilled to/subject/body.

    Lines with zero effective qty are skipped (no point ordering 0).
    Effective qty = manager_final if > 0, else captain_final.

    Raises:
        ValueError if supplier has no email.
        ValueError if `lines` is empty (after filtering, no orderable lines).
        ValueError if the resulting URL exceeds MAX_GMAIL_URL_LENGTH.
    """
    if not supplier.email:
        raise ValueError(f"Supplier {supplier.supplier_id} has no email")
    if not lines:
        raise ValueError("Empty order - no lines to send")

    visible = [ln for ln in lines if _effective_qty(ln) > 0]
    if not visible:
        raise ValueError("Empty order - no lines to send (all qty are zero)")

    subject = _build_subject(order, location)
    body = _build_body(order, supplier, lines, products_by_id, location)

    # urlencode handles UTF-8 + Polish diacritics and quotes \n as %0A.
    query = urllib.parse.urlencode(
        [
            ("view", "cm"),
            ("fs", "1"),
            ("to", supplier.email),
            ("su", subject),
            ("body", body),
        ],
        quote_via=urllib.parse.quote,
    )
    url = f"{GMAIL_COMPOSE_BASE}?{query}"
    if len(url) > MAX_GMAIL_URL_LENGTH:
        raise ValueError(
            f"Order body too long for Gmail URL ({len(url)} chars > "
            f"{MAX_GMAIL_URL_LENGTH}) - try fewer lines or different transport"
        )
    return url
