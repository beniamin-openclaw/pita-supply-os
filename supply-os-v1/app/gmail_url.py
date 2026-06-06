"""Build a Gmail compose URL (https://mail.google.com/mail/?view=cm&fs=1&...)
that opens with prefilled to/subject/body.

URL format:
    https://mail.google.com/mail/?view=cm&fs=1&to={email}&su={subject}&body={body}

Subject (Polish):
    "Zamowienie {order_id} - {supplier_name} - dostawa {delivery_date_iso_or_TBD}"

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


def _format_pln(value: float) -> str:
    """Polish-locale decimal: 668.0 -> '668,00'."""
    return f"{value:.2f}".replace(".", ",")


def _effective_qty(line: OrderLine) -> float:
    """Use manager_final if > 0, otherwise captain_final."""
    if line.manager_final_qty_purchase and line.manager_final_qty_purchase > 0:
        return line.manager_final_qty_purchase
    return line.captain_final_qty_purchase


def _build_subject(order: Order, supplier: Supplier) -> str:
    """Polish subject. Falls back to 'do potwierdzenia' if no delivery date."""
    if order.requested_delivery_date is not None:
        delivery = order.requested_delivery_date.isoformat()
    else:
        delivery = "do potwierdzenia"
    return (
        f"Zamowienie {order.order_id} - {supplier.supplier_name} - dostawa {delivery}"
    )


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

    # Need purchase_unit for each line — read from supplier_product if present.
    # Caller passes products_by_id (product_id -> Product). We need the
    # purchase_unit which lives on supplier_products. The endpoint already has
    # those; we resolve unit via order line's supplier_product_id by looking up
    # in a sps lookup map passed via products_by_id? No — keep contract clean:
    # the endpoint enriches lines with manager_final_qty fields BEFORE passing,
    # but purchase_unit is on the SupplierProduct row, not on OrderLine. We
    # accept that and use the product's inventory_unit as a sensible fallback
    # for the message text. (The number is the purchase-unit count, the label
    # is the product's inventory unit if that's all we have.)
    #
    # In practice, callers pass a dict that includes both Product entries AND
    # SupplierProduct entries keyed by their respective ids. To stay strict,
    # we look up purchase_unit via a side-channel: products_by_id may also
    # carry the SupplierProduct under its supplier_product_id key. Check both.
    for idx, line in enumerate(visible, start=1):
        product = products_by_id.get(line.product_id)
        if product is None:
            product_name = line.product_id
            unit_label = ""
        else:
            product_name = product.product_name_pl
            unit_label = product.inventory_unit or ""

        # Try to find purchase_unit via supplier_product entry in same dict
        sp_entry = products_by_id.get(line.supplier_product_id)
        if sp_entry is not None and hasattr(sp_entry, "purchase_unit"):
            unit_label = sp_entry.purchase_unit

        qty = _effective_qty(line)
        # Show int qty without trailing .0 when whole
        qty_str = f"{qty:g}"
        body_lines.append(f"{idx}.  | {product_name} | {qty_str} {unit_label}".rstrip())

    body_lines.append("")
    if order.total_value_estimate_pln is not None:
        body_lines.append(
            f"Laczna wartosc szacunkowa: {_format_pln(order.total_value_estimate_pln)} zl"
        )
    if location is not None:
        address = location.delivery_address or location.location_name
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
# Any change to recipient / purchase units / Polish wording here must mirror there,
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

    subject = _build_subject(order, supplier)
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
