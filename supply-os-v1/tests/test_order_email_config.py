"""order-email-v2 Phase 1: signer config parsing/resolution and the new
ManagerOrderDetail fields (sender alias, order mailbox, phone, date switch,
signers)."""
from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app import gmail_url, main, seed_loader, sheets
from app.config import settings as app_settings
from app.main import app
from app.models import OrderEmailSigner

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

MAREK = {"name": "Marek Złotopolski", "phone": "+48 662 184 258", "email": "marek@pitabros.pl"}
SLAWEK = {"name": "Sławomir Glanowski", "phone": "+48 692 840 194", "email": "slawek@pitabros.pl"}


# ---------- parse_order_email_signers ----------


def test_parse_signers_valid_in_order():
    signers = gmail_url.parse_order_email_signers(json.dumps([MAREK, SLAWEK]))
    assert [s.name for s in signers] == ["Marek Złotopolski", "Sławomir Glanowski"]
    assert signers[0].phone == "+48 662 184 258"
    assert signers[1].email == "slawek@pitabros.pl"


def test_parse_signers_invalid_json_and_empty():
    assert gmail_url.parse_order_email_signers("{not json") == []
    assert gmail_url.parse_order_email_signers("") == []
    assert gmail_url.parse_order_email_signers(None) == []


def test_parse_signers_non_list():
    assert gmail_url.parse_order_email_signers(json.dumps(MAREK)) == []


def test_parse_signers_drops_nameless_and_non_objects():
    raw = json.dumps([{"phone": "1"}, "Marek", {"name": "  "}, {"name": "Ola"}])
    signers = gmail_url.parse_order_email_signers(raw)
    assert signers == [OrderEmailSigner(name="Ola")]


# ---------- resolve_signer ----------


def _signers() -> list[OrderEmailSigner]:
    return gmail_url.parse_order_email_signers(json.dumps([MAREK, SLAWEK]))


def test_resolve_signer_match_case_insensitive():
    assert gmail_url.resolve_signer(_signers(), "SLAWEK@pitabros.pl").name == (
        "Sławomir Glanowski"
    )


def test_resolve_signer_unknown_or_none_falls_back_to_first():
    assert gmail_url.resolve_signer(_signers(), "x@y.pl").name == "Marek Złotopolski"
    assert gmail_url.resolve_signer(_signers(), None).name == "Marek Złotopolski"


def test_resolve_signer_empty_list():
    assert gmail_url.resolve_signer([], "marek@pitabros.pl") is None


# ---------- _load_email_signers degrade ----------


def test_load_email_signers_seed_backend_degrades():
    # seed_loader has no load_meta -> AttributeError -> []
    assert main._load_email_signers(seed_loader) == []


def test_load_email_signers_exception_degrades(mocker):
    mocker.patch.object(sheets, "load_meta", side_effect=RuntimeError("no sheet id"))
    assert main._load_email_signers(sheets) == []


# ---------- detail fields ----------


def _detail(mocker, location, meta=None) -> dict:
    order_id = "ORD-EMAILCFG"
    order = _order(order_id, location_id="WOLA", supplier_id="SUP_PAGO")
    order = order.model_copy(
        update={"lines": [_line(order_id, "OL-1", product_id="P027", sp_id="SP_PAGO_P027")]}
    )
    _enable_sheet_backend(
        mocker,
        orders=[order],
        get_order_return=order,
        products=[_product("P027", "Souvlaki Kurczak")],
        supplier_products=[
            _supplier_product("SP_PAGO_P027", "SUP_PAGO", "P027", "Souvlaki Karton 5kg")
        ],
        suppliers=[_supplier("SUP_PAGO", "Pago", email="zamowienia@pago.example")],
        locations=[location],
    )
    if meta is None:
        mocker.patch.object(sheets, "load_meta", side_effect=RuntimeError("no sheet"))
    else:
        mocker.patch.object(sheets, "load_meta", return_value=meta)
    r = client.get(f"/api/manager/order/{order_id}", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    return r.json()


def test_detail_exposes_alias_phone_signers(mocker):
    mocker.patch.object(app_settings, "order_mailbox", "biuro@pitabros.pl")
    mocker.patch.object(app_settings, "order_email_delivery_date_enabled", True)
    loc = _location("WOLA", "Pita Bros Bracka").model_copy(
        update={"sender_email": "bracka@pitabros.pl", "phone": "600 722 252"}
    )
    payload = _detail(mocker, loc, meta={"order_email_signers": json.dumps([MAREK, SLAWEK])})
    assert payload["sender_email"] == "bracka@pitabros.pl"
    assert payload["order_mailbox"] == "biuro@pitabros.pl"
    assert payload["location_phone"] == "600 722 252"
    assert payload["delivery_date_in_email"] is True
    assert [s["email"] for s in payload["email_signers"]] == [
        "marek@pitabros.pl",
        "slawek@pitabros.pl",
    ]


def test_detail_alias_falls_back_to_order_mailbox(mocker):
    mocker.patch.object(app_settings, "order_mailbox", "biuro@pitabros.pl")
    for alias in (None, "", "TBD"):
        loc = _location("WOLA", "Pita Bros Wola").model_copy(update={"sender_email": alias})
        payload = _detail(mocker, loc)
        assert payload["sender_email"] == "biuro@pitabros.pl"
        assert payload["location_phone"] is None
        assert payload["delivery_date_in_email"] is False
        assert payload["email_signers"] == []
