"""Unit tests for app.gmail_url — pure function, no I/O."""
from __future__ import annotations

import urllib.parse
from datetime import date

import pytest

from app.gmail_url import (
    GMAIL_COMPOSE_BASE,
    build_draft_url,
)
from app.models import (
    Location,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    Supplier,
    SupplierProduct,
)


# ---------- Fixtures ----------

def _make_order(
    order_id: str = "ORD-20260520-WOL-PAGO-abc123",
    delivery_date: date | None = date(2026, 5, 25),
    total: float | None = 668.0,
    lines: list[OrderLine] | None = None,
) -> Order:
    return Order(
        order_id=order_id,
        location_id="WOLA",
        supplier_id="SUP_PAGO",
        order_date=date(2026, 5, 20),
        requested_delivery_date=delivery_date,
        status=OrderStatus.CAPTAIN_SUBMITTED,
        total_value_estimate_pln=total,
        lines=lines or [],
    )


def _make_supplier(
    supplier_id: str = "SUP_PAGO",
    name: str = "Pago",
    email: str | None = "zamowienia@pago.example",
) -> Supplier:
    return Supplier(
        supplier_id=supplier_id,
        supplier_name=name,
        email=email,
    )


def _make_line(
    line_id: str,
    product_id: str,
    sp_id: str,
    captain_qty: float = 1.0,
    manager_qty: float = 0.0,
    units_per_pu: float = 1.0,
) -> OrderLine:
    return OrderLine(
        order_line_id=line_id,
        order_id="ORD-20260520-WOL-PAGO-abc123",
        product_id=product_id,
        supplier_product_id=sp_id,
        captain_final_qty_purchase=captain_qty,
        captain_final_qty_base=captain_qty * units_per_pu,
        manager_final_qty_purchase=manager_qty,
        manager_final_qty_base=manager_qty * units_per_pu,
    )


def _make_product(pid: str, name: str, unit: str = "kg") -> Product:
    return Product(
        product_id=pid,
        product_name_pl=name,
        product_category="Mięso",
        inventory_unit=unit,
    )


def _make_sp(
    sp_id: str,
    supplier_id: str,
    product_id: str,
    purchase_unit: str = "karton",
    name: str | None = None,
) -> SupplierProduct:
    return SupplierProduct(
        supplier_product_id=sp_id,
        supplier_id=supplier_id,
        product_id=product_id,
        supplier_product_name=name or f"{product_id} karton",
        purchase_unit=purchase_unit,
        units_per_purchase_unit=5.0,
        price_estimate_pln=145.0,
    )


# ---------- Tests ----------

def test_build_url_contains_supplier_email():
    line = _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=1)
    order = _make_order(lines=[line])
    supplier = _make_supplier(email="orders@pago.pl")
    products = {"P027": _make_product("P027", "Souvlaki Kurczak")}
    products["SP_PAGO_P027"] = _make_sp("SP_PAGO_P027", "SUP_PAGO", "P027")

    url = build_draft_url(order, supplier, [line], products, None)
    assert url.startswith(GMAIL_COMPOSE_BASE)
    # urlencode replaces @ with %40
    assert "to=orders%40pago.pl" in url


def test_build_url_subject_is_zamowienie_location():
    line = _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=1)
    order = _make_order(order_id="ORD-20260520-WOL-PAGO-deadbe", lines=[line])
    supplier = _make_supplier(name="Pago Sp. z o.o.")
    products = {"P027": _make_product("P027", "Souvlaki")}
    products["SP_PAGO_P027"] = _make_sp("SP_PAGO_P027", "SUP_PAGO", "P027")
    location = Location(location_id="WOLA", location_name="Pita Bros Wola")

    url = build_draft_url(order, supplier, [line], products, location)
    subject = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["su"][0]
    assert subject == "Zamówienie Pita Bros Wola"
    # New contract: order id + supplier name are NOT in the subject anymore.
    assert "ORD-20260520-WOL-PAGO-deadbe" not in subject
    assert "Pago Sp. z o.o." not in subject


def test_build_url_subject_falls_back_to_order_id_without_location():
    line = _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=1)
    order = _make_order(order_id="ORD-20260520-WOL-PAGO-deadbe", lines=[line])
    supplier = _make_supplier()
    products = {"P027": _make_product("P027", "Souvlaki")}
    products["SP_PAGO_P027"] = _make_sp("SP_PAGO_P027", "SUP_PAGO", "P027")

    url = build_draft_url(order, supplier, [line], products, None)
    subject = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["su"][0]
    assert subject == "Zamówienie ORD-20260520-WOL-PAGO-deadbe"


def test_build_url_body_lists_all_lines_with_qty_unit():
    lines = [
        _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=2),
        _make_line("OL-002", "P026", "SP_PAGO_P026", captain_qty=3),
        _make_line("OL-003", "P019", "SP_PAGO_P019", captain_qty=1),
    ]
    order = _make_order(lines=lines)
    supplier = _make_supplier()
    products = {
        "P027": _make_product("P027", "Souvlaki Kurczak (wewn.)"),
        "P026": _make_product("P026", "Gyros Wieprz (wewn.)"),
        "P019": _make_product("P019", "Przyprawa (wewn.)"),
    }
    products["SP_PAGO_P027"] = _make_sp(
        "SP_PAGO_P027", "SUP_PAGO", "P027", "karton", name="Souvlaki z kurczaka 5kg"
    )
    products["SP_PAGO_P026"] = _make_sp(
        "SP_PAGO_P026", "SUP_PAGO", "P026", "karton", name="Gyros wieprzowy 5kg"
    )
    products["SP_PAGO_P019"] = _make_sp(
        "SP_PAGO_P019", "SUP_PAGO", "P019", "szt", name="Przyprawa gyros 1kg"
    )

    url = build_draft_url(order, supplier, lines, products, None)
    body = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["body"][0]
    # Body lists the SUPPLIER-facing names, with qty + purchase unit.
    assert "Souvlaki z kurczaka 5kg" in body
    assert "Gyros wieprzowy 5kg" in body
    assert "Przyprawa gyros 1kg" in body
    assert "2 karton" in body
    assert "3 karton" in body
    assert "1 szt" in body
    # Internal product names must NOT leak to the supplier.
    assert "(wewn.)" not in body


def test_build_url_body_falls_back_to_internal_name_when_no_supplier_product():
    """No SupplierProduct entry in the dict → fall back to product_name_pl."""
    line = _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=1)
    order = _make_order(lines=[line])
    supplier = _make_supplier()
    # Only the Product is present; the SupplierProduct is missing from the dict.
    products = {"P027": _make_product("P027", "Souvlaki Kurczak")}

    url = build_draft_url(order, supplier, [line], products, None)
    body = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["body"][0]
    assert "Souvlaki Kurczak" in body


def test_build_url_body_includes_polish_diacritics_correctly():
    line = _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=1)
    order = _make_order(lines=[line])
    supplier = _make_supplier()
    products = {"P027": _make_product("P027", "Mąka")}
    products["SP_PAGO_P027"] = _make_sp(
        "SP_PAGO_P027", "SUP_PAGO", "P027", name="Mąka żytnia śląska"
    )
    location = Location(location_id="WOLA", location_name="Pita Bros Wólka ąęłłóźż")

    url = build_draft_url(order, supplier, [line], products, location)
    # URL must be ASCII-only after percent-encoding
    assert all(ord(c) < 128 for c in url)
    # Decode and verify diacritics survived round-trip (subject=location, body=sp name)
    parsed = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    assert "Pita Bros Wólka ąęłłóźż" in parsed["su"][0]
    assert "Mąka żytnia śląska" in parsed["body"][0]


def test_build_url_body_includes_total_with_polish_decimal_comma():
    line = _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=1)
    order = _make_order(lines=[line], total=668.0)
    supplier = _make_supplier()
    products = {"P027": _make_product("P027", "Souvlaki")}
    products["SP_PAGO_P027"] = _make_sp("SP_PAGO_P027", "SUP_PAGO", "P027")

    url = build_draft_url(order, supplier, [line], products, None)
    body = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["body"][0]
    assert "668,00 zl" in body
    # Make sure we did NOT emit US-style 668.00
    assert "668.00" not in body


def test_build_url_body_skips_zero_qty_lines():
    lines = [
        _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=2),
        _make_line("OL-002", "P026", "SP_PAGO_P026", captain_qty=0),  # skipped
        _make_line("OL-003", "P019", "SP_PAGO_P019", captain_qty=3),
    ]
    order = _make_order(lines=lines)
    supplier = _make_supplier()
    products = {
        "P027": _make_product("P027", "Souvlaki"),
        "P026": _make_product("P026", "Gyros"),
        "P019": _make_product("P019", "Przyprawa"),
    }
    products["SP_PAGO_P027"] = _make_sp("SP_PAGO_P027", "SUP_PAGO", "P027", name="Souvlaki dostawca")
    products["SP_PAGO_P026"] = _make_sp("SP_PAGO_P026", "SUP_PAGO", "P026", name="Gyros dostawca")
    products["SP_PAGO_P019"] = _make_sp("SP_PAGO_P019", "SUP_PAGO", "P019", name="Przyprawa dostawca")

    url = build_draft_url(order, supplier, lines, products, None)
    body = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["body"][0]
    assert "Souvlaki dostawca" in body
    assert "Przyprawa dostawca" in body
    assert "Gyros dostawca" not in body  # qty=0 → skipped


def test_build_url_raises_when_supplier_no_email():
    line = _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=1)
    order = _make_order(lines=[line])
    supplier = _make_supplier(email=None)
    products = {"P027": _make_product("P027", "Souvlaki")}

    with pytest.raises(ValueError, match="no email"):
        build_draft_url(order, supplier, [line], products, None)


def test_build_url_raises_when_no_lines():
    order = _make_order(lines=[])
    supplier = _make_supplier()
    products: dict = {}
    with pytest.raises(ValueError, match="Empty order"):
        build_draft_url(order, supplier, [], products, None)


def test_build_url_raises_when_all_lines_zero_qty():
    """All lines filtered out by zero-qty rule → effectively empty."""
    lines = [
        _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=0),
        _make_line("OL-002", "P026", "SP_PAGO_P026", captain_qty=0),
    ]
    order = _make_order(lines=lines)
    supplier = _make_supplier()
    products = {
        "P027": _make_product("P027", "Souvlaki"),
        "P026": _make_product("P026", "Gyros"),
    }
    with pytest.raises(ValueError, match="Empty order"):
        build_draft_url(order, supplier, lines, products, None)


def test_build_url_raises_when_too_long():
    # 200 lines with very long product names → URL > 8000 chars.
    lines: list[OrderLine] = []
    products: dict = {}
    for i in range(200):
        pid = f"P{i:03d}"
        spid = f"SP_PAGO_{pid}"
        long_name = "Bardzo Długi Produkt " * 5 + str(i)
        products[pid] = _make_product(pid, long_name)
        products[spid] = _make_sp(spid, "SUP_PAGO", pid, name=long_name)
        lines.append(_make_line(f"OL-{i:03d}", pid, spid, captain_qty=5))
    order = _make_order(lines=lines)
    supplier = _make_supplier()
    with pytest.raises(ValueError, match="too long"):
        build_draft_url(order, supplier, lines, products, None)


def test_build_url_uses_manager_final_if_present_else_captain_final():
    # Line 1: manager_final=2 wins over captain_final=5
    # Line 2: manager_final=0 → falls through to captain_final=3
    lines = [
        _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=5, manager_qty=2),
        _make_line("OL-002", "P026", "SP_PAGO_P026", captain_qty=3, manager_qty=0),
    ]
    order = _make_order(lines=lines)
    supplier = _make_supplier()
    products = {
        "P027": _make_product("P027", "Souvlaki"),
        "P026": _make_product("P026", "Gyros"),
    }
    products["SP_PAGO_P027"] = _make_sp("SP_PAGO_P027", "SUP_PAGO", "P027", "karton", name="Souvlaki")
    products["SP_PAGO_P026"] = _make_sp("SP_PAGO_P026", "SUP_PAGO", "P026", "karton", name="Gyros")

    url = build_draft_url(order, supplier, lines, products, None)
    body = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["body"][0]
    # Line 1 shows 2 (manager override), not 5 (captain)
    assert "Souvlaki | 2 karton" in body
    # Line 2 shows 3 (captain, manager=0 ignored)
    assert "Gyros | 3 karton" in body


def test_build_url_includes_delivery_date_or_TBD():
    line = _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=1)
    products = {"P027": _make_product("P027", "Souvlaki")}
    products["SP_PAGO_P027"] = _make_sp("SP_PAGO_P027", "SUP_PAGO", "P027")
    supplier = _make_supplier()

    # With delivery date — date appears in the BODY (subject no longer carries it).
    order_with = _make_order(delivery_date=date(2026, 5, 25), lines=[line])
    url_with = build_draft_url(order_with, supplier, [line], products, None)
    body_with = urllib.parse.parse_qs(urllib.parse.urlparse(url_with).query)["body"][0]
    assert "2026-05-25" in body_with

    # Without delivery date
    order_without = _make_order(delivery_date=None, lines=[line])
    url_without = build_draft_url(order_without, supplier, [line], products, None)
    body_without = urllib.parse.parse_qs(urllib.parse.urlparse(url_without).query)["body"][0]
    assert "do potwierdzenia" in body_without


def test_build_url_includes_location_address_or_name():
    line = _make_line("OL-001", "P027", "SP_PAGO_P027", captain_qty=1)
    products = {"P027": _make_product("P027", "Souvlaki")}
    products["SP_PAGO_P027"] = _make_sp("SP_PAGO_P027", "SUP_PAGO", "P027")
    supplier = _make_supplier()
    order = _make_order(lines=[line])

    # With explicit address
    loc_with_addr = Location(
        location_id="WOLA",
        location_name="Pita Bros Wola",
        delivery_address="Wolska 50, 01-001 Warszawa",
    )
    url_a = build_draft_url(order, supplier, [line], products, loc_with_addr)
    body_a = urllib.parse.parse_qs(urllib.parse.urlparse(url_a).query)["body"][0]
    assert "Wolska 50, 01-001 Warszawa" in body_a

    # With only name (no address)
    loc_name_only = Location(
        location_id="WOLA",
        location_name="Pita Bros Wola",
        delivery_address=None,
    )
    url_n = build_draft_url(order, supplier, [line], products, loc_name_only)
    body_n = urllib.parse.parse_qs(urllib.parse.urlparse(url_n).query)["body"][0]
    assert "Pita Bros Wola" in body_n
