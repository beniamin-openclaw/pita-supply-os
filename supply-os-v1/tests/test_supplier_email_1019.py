"""supplier-email-1019 (owner decisions of 2026-10-19): per-location delivery
hours on the "Dostawa:" line, a fixed staff/signature/no-keys line in every
supplier e-mail, and the Intermlecz-only pack-suffix strip. The byte-for-byte
layout is pinned by the golden fixtures (test_order_email_golden.py); this
file covers the rules, the detail fields and the seed/migration plumbing."""
from __future__ import annotations

import json
import urllib.parse
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import gmail_url, seed_loader, sheets
from app.main import app
from app.models import (
    Location,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    Supplier,
    SupplierProduct,
)
from tests.test_manager_queue import (
    MANAGER_AUTH,
    _enable_sheet_backend,
    _line,
    _location,
    _order,
    _product,
    _supplier,
    _supplier_product,
)

client = TestClient(app)

STRIP_FIXTURE = Path(__file__).parent / "fixtures" / "strip_bulk_suffix.json"
MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "migrations"
    / "0031_delivery_window_and_pack_suffix.sql"
)


# ---------- delivery window (WP2) ----------


@pytest.mark.parametrize(
    "start,end,expected",
    [
        ("9:00", "10:00", "w godzinach 9:00–10:00"),
        ("10:00", None, "od godziny 10:00"),
        (None, "10:00", "do godziny 10:00"),
        (None, None, "od godziny 11:00"),
        ("", "  ", "od godziny 11:00"),
        (" 9:00 ", " 10:00 ", "w godzinach 9:00–10:00"),
    ],
)
def test_delivery_window_text(start, end, expected):
    loc = Location(
        location_id="X", location_name="X",
        delivery_window_from=start, delivery_window_to=end,
    )
    assert gmail_url.delivery_window_text(loc) == expected


def test_delivery_window_text_without_location_is_the_old_fixed_line():
    assert gmail_url.delivery_window_text(None) == "od godziny 11:00"


# ---------- bulk pack suffix (shared with the Captain view) ----------

_STRIP = json.loads(STRIP_FIXTURE.read_text(encoding="utf-8"))


@pytest.mark.parametrize("name,expected", _STRIP["strip"])
def test_strip_bulk_suffix_strips(name, expected):
    assert gmail_url.strip_bulk_suffix(name) == expected


@pytest.mark.parametrize("name", _STRIP["keep"])
def test_strip_bulk_suffix_keeps(name):
    assert gmail_url.strip_bulk_suffix(name) == name


def test_strip_bulk_suffix_is_idempotent():
    once = gmail_url.strip_bulk_suffix("MELVIT KASZA 900g/10")
    assert gmail_url.strip_bulk_suffix(once) == once


# ---------- the e-mail body ----------


def _body(
    supplier: Supplier,
    location: Location | None = None,
    extra_items: str = "",
) -> str:
    order = Order(
        order_id="ORD-1019",
        location_id="WESTFIELD",
        supplier_id=supplier.supplier_id,
        order_date=date(2026, 10, 20),
        requested_delivery_date=date(2026, 10, 21),
        status=OrderStatus.MANAGER_CLAIMED,
        extra_items=extra_items,
    )
    line = OrderLine(
        order_line_id="OL-1",
        order_id=order.order_id,
        product_id="P139",
        supplier_product_id="SP_INTE_P139",
        captain_final_qty_purchase=2,
    )
    products = {
        "P139": Product(
            product_id="P139", product_name_pl="Miód porcja",
            product_category="X", inventory_unit="szt",
        ),
        "SP_INTE_P139": SupplierProduct(
            supplier_product_id="SP_INTE_P139",
            supplier_id=supplier.supplier_id,
            product_id="P139",
            supplier_product_name="AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30",
            purchase_unit="karton",
        ),
    }
    url = gmail_url.build_draft_url(order, supplier, [line], products, location)
    return urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["body"][0]


def _intermlecz(strip: bool) -> Supplier:
    return Supplier(
        supplier_id="SUP_INTERMLECZ", supplier_name="Intermlecz",
        email="handel@intermlecz.example", email_strip_pack_suffix=strip,
    )


def test_switch_on_strips_the_suffix_from_product_names():
    body = _body(_intermlecz(True))
    assert "1.  | AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g | 2 kartony" in body
    assert "25g/30" not in body


def test_switch_off_keeps_the_full_name():
    body = _body(_intermlecz(False))
    assert "1.  | AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30 | 2 kartony" in body


def test_switch_leaves_off_catalogue_items_as_typed():
    body = _body(_intermlecz(True), extra_items="Miód 25g/30 - 1 karton")
    assert "2.  | Miód 25g/30 (spoza katalogu) | 1 karton" in body


def test_body_prints_the_location_window():
    loc = Location(
        location_id="WESTFIELD", location_name="Pita Bros Westfield",
        delivery_window_from="9:00", delivery_window_to="10:00",
    )
    body = _body(_intermlecz(False), loc)
    assert "Dostawa: __________, w godzinach 9:00–10:00" in body
    assert "od godziny 11:00" not in body


def test_body_without_a_window_keeps_11():
    loc = Location(location_id="WOLA", location_name="Pita Bros Wola")
    body = _body(_intermlecz(False), loc)
    assert "Dostawa: __________, od godziny 11:00" in body


@pytest.mark.parametrize("location", [None, Location(location_id="W", location_name="W")])
def test_rules_line_in_every_body(location):
    body = _body(_intermlecz(False), location)
    assert gmail_url.DELIVERY_RULES_LINE in body
    # Inside the delivery block: after the "Dostawa:" line, before the sign-off.
    assert body.index("Dostawa:") < body.index(gmail_url.DELIVERY_RULES_LINE)
    assert body.index(gmail_url.DELIVERY_RULES_LINE) < body.index("Pozdrawiam,")


def test_rules_line_wording():
    """Ben's decision of 19.10 — staff on site, checked and signed, no keys."""
    line = gmail_url.DELIVERY_RULES_LINE
    assert "pracowniku" in line
    assert "sprawdzamy i podpisujemy" in line
    assert "kluczy" in line


# ---------- manager order detail fields ----------


def _detail(mocker, location: Location, supplier: Supplier) -> dict:
    order_id = "ORD-1019-DETAIL"
    order = _order(order_id, location_id=location.location_id, supplier_id=supplier.supplier_id)
    order = order.model_copy(
        update={"lines": [_line(order_id, "OL-1", product_id="P139", sp_id="SP_INTE_P139")]}
    )
    _enable_sheet_backend(
        mocker,
        orders=[order],
        get_order_return=order,
        products=[_product("P139", "Miód porcja")],
        supplier_products=[
            _supplier_product(
                "SP_INTE_P139", supplier.supplier_id, "P139", "MIÓD 25g/30"
            )
        ],
        suppliers=[supplier],
        locations=[location],
    )
    mocker.patch.object(sheets, "load_meta", side_effect=RuntimeError("no sheet"))
    r = client.get(f"/api/manager/order/{order_id}", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    return r.json()


def test_detail_exposes_window_and_switch(mocker):
    loc = _location("WESTFIELD", "Pita Bros Westfield").model_copy(
        update={"delivery_window_from": "9:00", "delivery_window_to": "10:00"}
    )
    sup = _supplier("SUP_INTERMLECZ", "Intermlecz", email="h@intermlecz.example").model_copy(
        update={"email_strip_pack_suffix": True}
    )
    payload = _detail(mocker, loc, sup)
    assert payload["delivery_window_from"] == "9:00"
    assert payload["delivery_window_to"] == "10:00"
    assert payload["email_strip_pack_suffix"] is True


def test_detail_defaults_when_unset(mocker):
    loc = _location("WOLA", "Pita Bros Wola")
    sup = _supplier("SUP_BUKAT", "Bukat", email="b@bukat.example")
    payload = _detail(mocker, loc, sup)
    assert payload["delivery_window_from"] is None
    assert payload["delivery_window_to"] is None
    assert payload["email_strip_pack_suffix"] is False


# ---------- models, seed, migration ----------


def test_model_defaults_when_columns_absent():
    """Sheets and a pre-0031 Postgres omit the fields: unset window, switch off."""
    loc = Location(location_id="X", location_name="X")
    sup = Supplier(supplier_id="S", supplier_name="S")
    assert loc.delivery_window_from is None and loc.delivery_window_to is None
    assert sup.email_strip_pack_suffix is False


def test_seed_switch_only_for_intermlecz():
    sups = {s.supplier_id: s for s in seed_loader.load_suppliers()}
    assert sups["SUP_INTERMLECZ"].email_strip_pack_suffix is True
    assert [sid for sid, s in sups.items() if s.email_strip_pack_suffix] == ["SUP_INTERMLECZ"]


def test_seed_locations_have_no_window():
    for loc in seed_loader.load_locations():
        assert gmail_url.delivery_window_text(loc) == "od godziny 11:00"


def test_migration_0031_is_additive_and_placeholder_free():
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "%" not in sql  # the integration fixture applies it via exec_driver_sql
    assert "ADD COLUMN IF NOT EXISTS delivery_window_from text" in sql
    assert "ADD COLUMN IF NOT EXISTS delivery_window_to text" in sql
    assert (
        "ADD COLUMN IF NOT EXISTS email_strip_pack_suffix boolean NOT NULL DEFAULT false"
        in sql
    )
    for word in ("DROP TABLE", "DELETE", "UPDATE", "TRUNCATE"):
        assert word not in sql.split("-- ====")[-1]  # no destructive statement
