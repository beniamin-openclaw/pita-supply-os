"""Build a Gmail compose URL (https://mail.google.com/mail/?view=cm&fs=1&...)
that opens with prefilled to/subject/body.

URL format:
    https://mail.google.com/mail/?view=cm&fs=1&to={email}&su={subject}&body={body}

Subject (Polish):
    "Zamówienie {location_name}" [+ " – dostawa {wt} {dd.MM}" when the date switch
    is on] (falls back to order_id if location unknown)

Body (Polish, plaintext, URL-encoded). Pure function — no I/O, easy to
unit-test. Raises ValueError for caller-recoverable problems; the HTTP layer
turns those into 4xx.
"""
from __future__ import annotations

import json
import urllib.parse
from datetime import date
from typing import Optional

from .models import Location, Order, OrderEmailSigner, OrderLine, Product, Supplier
from .order_qty import effective_ordered_qty
from .product_order import line_sort_key


GMAIL_COMPOSE_BASE = "https://mail.google.com/mail/"
MAX_GMAIL_URL_LENGTH = 8000


def parse_order_email_signers(raw: Optional[str]) -> list[OrderEmailSigner]:
    """Parse ``_meta.order_email_signers`` (a JSON list of ``{name, phone,
    email}``) into signers, in configured order. Never raises: invalid JSON, a
    non-list value, a non-object entry or one without a name is dropped."""
    if not raw or not raw.strip():
        return []
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return []
    if not isinstance(data, list):
        return []
    out: list[OrderEmailSigner] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        out.append(
            OrderEmailSigner(
                name=name,
                phone=str(item.get("phone") or "").strip(),
                email=str(item.get("email") or "").strip(),
            )
        )
    return out


def resolve_signer(
    signers: list[OrderEmailSigner], email: Optional[str]
) -> Optional[OrderEmailSigner]:
    """The signer whose e-mail matches ``email`` (case-insensitive); the first
    signer when ``email`` is None or unknown; None when none is configured.
    Twin of the frontend ``resolveSigner`` (useOrderEmailSigner)."""
    if not signers:
        return None
    wanted = (email or "").strip().lower()
    if wanted:
        for signer in signers:
            if signer.email.strip().lower() == wanted:
                return signer
    return signers[0]


def _effective_qty(line: OrderLine) -> float:
    """The Manager's final once set (incl. an explicit 0), else the Captain's —
    the shared rule in ``app/order_qty.py``. The TS twin (emailBody.ts) takes
    the same rule from ``lib/orderQty.ts`` via its caller."""
    return effective_ordered_qty(line)


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


# ---------- order-email-v2: Polish wording helpers (twins in emailBody.ts) ----------

# Polish declension of purchase units — MUST equal the `pl` forms of
# frontend/src/i18n/packUnits.ts PACK_UNIT_FORMS (test_order_email_golden.py
# parses that file and compares). Keyed by the lower-cased purchase_unit; an
# unmapped unit is printed unchanged.
_PL_PACK_UNIT_FORMS: dict[str, dict[str, str]] = {
    "zgrzewka": {"one": "zgrzewka", "few": "zgrzewki", "many": "zgrzewek", "frac": "zgrzewki"},
    "karton": {"one": "karton", "few": "kartony", "many": "kartonów", "frac": "kartonu"},
    "blok": {"one": "blok", "few": "bloki", "many": "bloków", "frac": "bloku"},
    "wiadro": {"one": "wiadro", "few": "wiadra", "many": "wiader", "frac": "wiadra"},
    "opak": {"one": "opak", "few": "opak", "many": "opak", "frac": "opak"},
    "worek": {"one": "worek", "few": "worki", "many": "worków", "frac": "worka"},
    "skrzynka": {"one": "skrzynka", "few": "skrzynki", "many": "skrzynek", "frac": "skrzynki"},
    "butla": {"one": "butla", "few": "butle", "many": "butli", "frac": "butli"},
    "paleta": {"one": "paleta", "few": "palety", "many": "palet", "frac": "palety"},
    "szt": {"one": "szt", "few": "szt", "many": "szt", "frac": "szt"},
    "kg": {"one": "kg", "few": "kg", "many": "kg", "frac": "kg"},
    "box": {"one": "box", "few": "box", "many": "box", "frac": "box"},
    "pojemnik": {"one": "pojemnik", "few": "pojemniki", "many": "pojemników", "frac": "pojemnika"},
    "paczka": {"one": "paczka", "few": "paczki", "many": "paczek", "frac": "paczki"},
}

# date.weekday(): 0 = Monday. Short forms match main.WEEKDAY_MAP's Polish keys.
_PL_WEEKDAY_LONG = (
    "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela",
)
_PL_WEEKDAY_SHORT = ("pon", "wt", "śr", "czw", "pt", "sob", "nd")

# Printed instead of a date while the date switch is off / no date is known.
BLANK_DELIVERY_DATE = "__________"


def _pl_plural_form(n: int) -> str:
    """one / few / many — twin of i18n ``pluralForm(n, "pl")``."""
    if n == 1:
        return "one"
    mod10 = abs(n) % 10
    mod100 = abs(n) % 100
    if 2 <= mod10 <= 4 and not 12 <= mod100 <= 14:
        return "few"
    return "many"


def _pl_unit_label(qty: float, unit: str) -> str:
    """Declined unit for ``qty`` — twin of ``packUnitLabel(qty, unit, "pl")``:
    a fractional quantity takes the ``frac`` form, an unmapped unit is kept."""
    forms = _PL_PACK_UNIT_FORMS.get(unit.lower())
    if forms is None:
        return unit
    if not float(qty).is_integer():
        return forms["frac"]
    return forms[_pl_plural_form(int(qty))]


def _format_qty(qty: float) -> str:
    """``f"{qty:g}"`` with a decimal comma (1.5 -> "1,5") — twin of
    ``formatEmailQty`` in emailBody.ts."""
    return f"{qty:g}".replace(".", ",")


def _delivery_day_long(day: date) -> str:
    """"wtorek 29.09.2026"."""
    return f"{_PL_WEEKDAY_LONG[day.weekday()]} {day.strftime('%d.%m.%Y')}"


def _delivery_day_short(day: date) -> str:
    """"wt 29.09"."""
    return f"{_PL_WEEKDAY_SHORT[day.weekday()]} {day.strftime('%d.%m')}"


def _email_delivery_date(order: Order, include_delivery_date: bool) -> Optional[date]:
    """The date printed in the e-mail, or None (blank line, no date in the
    subject). Only when the switch is on — see settings
    order_email_delivery_date_enabled for why it defaults off."""
    if not include_delivery_date:
        return None
    return order.requested_delivery_date


def _visible_lines(
    lines: list[OrderLine], products_by_id: dict
) -> list[OrderLine]:
    """Lines that reach the supplier, in supplier order: effective quantity
    > 0 (``app/order_qty.py`` — a Manager's explicit 0 drops the line), sorted
    by ``app/product_order.py``. Twin of ``visibleLines`` in emailBody.ts."""
    visible = [ln for ln in lines if _effective_qty(ln) > 0]
    visible.sort(key=line_sort_key(products_by_id))
    return visible


def _build_subject(
    order: Order,
    location: Optional[Location],
    include_delivery_date: bool = False,
) -> str:
    """Supplier-facing subject: ``Zamówienie {location_name}``, plus
    `` – dostawa {wt} {dd.MM}`` when the delivery date is printed.

    Falls back to the order id when the location is unknown (``location`` is
    Optional at the call boundary).
    """
    if location is not None and location.location_name:
        subject = f"Zamówienie {location.location_name}"
    else:
        subject = f"Zamówienie {order.order_id}"
    day = _email_delivery_date(order, include_delivery_date)
    if day is not None:
        subject += f" – dostawa {_delivery_day_short(day)}"
    return subject


def _build_body(
    order: Order,
    supplier: Supplier,
    lines: list[OrderLine],
    products_by_id: dict[str, Product],
    location: Optional[Location],
    signer: Optional[OrderEmailSigner] = None,
    include_delivery_date: bool = False,
) -> str:
    """Plaintext Polish body (order-email-v2 layout, approved 2026-09-28).
    Lines with effective qty 0 are skipped. Byte-identical to the TS twin
    ``buildEmailBody`` — both are pinned by tests/fixtures/order_email/."""
    body_lines: list[str] = []
    body_lines.append("Dzień dobry,")
    body_lines.append("")
    body_lines.append("proszę o przygotowanie zamówienia:")
    body_lines.append("")
    body_lines.append("Lp. | Produkt | Ilość")

    # Canonical supplier order (supplier-product-order-minimum): position, then
    # supplier_product_id — app/product_order.py. `products_by_id` carries the
    # SupplierProduct entries keyed by supplier_product_id, which is where
    # display_order comes from.
    # NOTE (training-feedback-0901 Phase 4, hardening G7): this order-dispatch
    # email covers the WHOLE order regardless of supplier_products.warehouse_pickup.
    # ONLY the frontend pickup document (buildTransportPagoPrintDoc in
    # transport.ts) filters on warehouse_pickup; never add that filter to this
    # builder or its TS twin (emailBody.ts) — the asymmetry is deliberate.
    visible = _visible_lines(lines, products_by_id)

    # `products_by_id` carries BOTH Product entries (keyed by product_id) and
    # SupplierProduct entries (keyed by supplier_product_id) — the dispatch
    # endpoint merges them. We prefer the supplier-facing name + purchase_unit
    # from the SupplierProduct so the supplier reads names they recognise.
    for idx, line in enumerate(visible, start=1):
        product = products_by_id.get(line.product_id)
        sp_entry = products_by_id.get(line.supplier_product_id)

        supplier_name = getattr(sp_entry, "supplier_product_name", None)
        if supplier_name:
            product_name = supplier_name
        elif product is not None:
            product_name = product.product_name_pl
        else:
            product_name = line.product_id

        # Unit: supplier purchase_unit, else product inventory_unit.
        purchase_unit = getattr(sp_entry, "purchase_unit", None)
        if purchase_unit:
            unit = purchase_unit
        elif product is not None:
            unit = product.inventory_unit or ""
        else:
            unit = ""

        qty = _effective_qty(line)
        unit_label = _pl_unit_label(qty, unit) if unit else ""
        body_lines.append(
            f"{idx}.  | {product_name} | {_format_qty(qty)} {unit_label}".rstrip()
        )

    body_lines.append("")
    # Ad-hoc off-catalogue items (training-feedback-0901 Phase 1b), own section,
    # skipped when empty.
    if order.extra_items.strip():
        body_lines.append("Pozycje spoza katalogu:")
        body_lines.append(order.extra_items.strip())
        body_lines.append("")
    # Order-level Captain comment — NOT the manager send-back `notes` field.
    if order.captain_note.strip():
        body_lines.append("Komentarz:")
        body_lines.append(order.captain_note.strip())
        body_lines.append("")
    # The estimated total is internal (Manager-panel only) and is deliberately
    # NOT included in the supplier email body (DEMO_FEEDBACK #7).

    # Delivery line: the date only while the switch is on (delivery-calendar);
    # otherwise a blank the manager may fill in by hand. The 11:00 window is
    # fixed for all locations (owner request).
    day = _email_delivery_date(order, include_delivery_date)
    day_text = _delivery_day_long(day) if day is not None else BLANK_DELIVERY_DATE
    body_lines.append(f"Dostawa: {day_text}, od godziny 11:00")
    address = _format_delivery_address(location)
    if address:
        # Uppercased label — the strongest emphasis available in plaintext.
        body_lines.append(f"ADRES DOSTAWY: {address}")
    phone = (location.phone or "").strip() if location is not None else ""
    if phone:
        body_lines.append(f"Telefon lokalu: {phone}")
    body_lines.append("")
    body_lines.append("Pozdrawiam,")
    # Signature = the sending manager (a per-browser choice, _meta signers);
    # "Pita Bros" when no signer is configured.
    if signer is not None:
        body_lines.append(signer.name)
        contact = []
        if signer.phone.strip():
            contact.append(f"tel. {signer.phone.strip()}")
        if signer.email.strip():
            contact.append(signer.email.strip())
        if contact:
            body_lines.append(" · ".join(contact))
    else:
        body_lines.append("Pita Bros")
    # Operating-company footer (feedback r5): each location orders under its own
    # spółka; suppliers need the invoicing entity + NIP in every order email.
    if location is not None and location.company_name:
        body_lines.append(location.company_name)
        if location.company_address:
            body_lines.append(location.company_address)
        if location.company_nip:
            body_lines.append(f"NIP: {location.company_nip}")
    body_lines.append(f"(zamówienie #{order.order_id})")

    return "\n".join(body_lines)


class GmailUrlTooLongError(ValueError):
    """The compose URL exceeds MAX_GMAIL_URL_LENGTH. A ValueError subclass so
    older callers keep catching it; ``manager_dispatch`` treats it as non-fatal
    (the re-open link is just absent — the draft path has no URL limit)."""


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
    cc_email: Optional[str] = None,
    signer: Optional[OrderEmailSigner] = None,
    include_delivery_date: bool = False,
) -> str:
    """Return a https://mail.google.com/mail/?... URL with prefilled to/cc/subject/body.

    Lines with zero effective qty are skipped (no point ordering 0).
    Effective qty = manager_final once the Manager set it (a positive value or
    ``manager_final_set``, so an explicit 0 drops the line), else captain_final
    — see ``app/order_qty.py``.

    ``cc_email`` is the standing office copy (settings.order_cc_email). It is
    added as the Gmail ``cc`` parameter only when it carries an "@" — the same
    placeholder gate the recipient uses, so a value like 'TBD' can never become a
    silent dead CC. None/empty simply omits the parameter. Multiple addresses may
    be comma-joined, exactly like ``supplier.email``.

    Raises:
        ValueError if supplier has no email.
        ValueError if `lines` is empty (after filtering, no orderable lines).
        GmailUrlTooLongError (a ValueError) if the URL exceeds MAX_GMAIL_URL_LENGTH.

    ``signer`` / ``include_delivery_date`` shape the signature and the date
    line exactly as the client-side builder does (order-email-v2).
    """
    # "@" check mirrors the dispatch route's gate: placeholder values like
    # 'TBD' must not become a Gmail recipient (silent non-delivery).
    if not supplier.email or "@" not in supplier.email:
        raise ValueError(f"Supplier {supplier.supplier_id} has no email")
    if not lines:
        raise ValueError("Empty order - no lines to send")

    visible = _visible_lines(lines, products_by_id)
    if not visible:
        raise ValueError("Empty order - no lines to send (all qty are zero)")

    subject = _build_subject(order, location, include_delivery_date)
    body = _build_body(
        order, supplier, lines, products_by_id, location, signer, include_delivery_date
    )

    # urlencode handles UTF-8 + Polish diacritics and quotes \n as %0A.
    params: list[tuple[str, str]] = [
        ("view", "cm"),
        ("fs", "1"),
        ("to", supplier.email),
    ]
    if cc_email and "@" in cc_email:
        params.append(("cc", cc_email))
    params.extend([("su", subject), ("body", body)])
    query = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    url = f"{GMAIL_COMPOSE_BASE}?{query}"
    if len(url) > MAX_GMAIL_URL_LENGTH:
        raise GmailUrlTooLongError(
            f"Order body too long for Gmail URL ({len(url)} chars > "
            f"{MAX_GMAIL_URL_LENGTH}) - try fewer lines or different transport"
        )
    return url
