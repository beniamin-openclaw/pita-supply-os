"""GET /api/captain/delivery-proposal + submit persistence (delivery-calendar,
Phase 2).

Seed backend (conftest) with the seed CSV rules: WOLA×Pago Mon→Wed,
KEN×Pago Sun/Thu→Tue/Sat, Bukat shared every day→Mon–Sat. The clock is
patched through ``delivery_calendar.now_utc``. Calendar: Mon 28.09.2026,
Thu 01.10, Mon 05.10, Wed 07.10.
"""
from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app import delivery_calendar, seed_loader, sheets
from app.config import DataBackend
from app.main import app

client = TestClient(app)
WAW = ZoneInfo("Europe/Warsaw")
WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
KEN_AUTH = {"Authorization": "Bearer test_ken_token"}
MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}


@pytest.fixture
def clock(monkeypatch):
    """Set the delivery-calendar clock to a Warsaw wall time."""

    def _set(y: int, m: int, d: int, hh: int, mm: int = 0, ss: int = 0) -> None:
        now = datetime(y, m, d, hh, mm, ss, tzinfo=WAW)
        monkeypatch.setattr(delivery_calendar, "now_utc", lambda: now)

    return _set


def _proposal(supplier_id: str, headers: dict = WOLA_AUTH):
    return client.get(
        f"/api/captain/delivery-proposal?supplier_id={supplier_id}", headers=headers
    )


# ---------- proposal route ----------

def test_wola_pago_proposal_from_location_rule(clock):
    clock(2026, 9, 29, 10)  # Tuesday
    r = _proposal("SUP_PAGO")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["location_id"] == "WOLA"
    assert body["proposed_delivery_date"] == "2026-10-07"
    assert body["following_delivery_date"] == "2026-10-14"
    assert body["source"] == "location"
    # Mon 05.10 17:00 Warsaw (CEST) = 15:00 UTC.
    assert datetime.fromisoformat(body["order_deadline"]) == datetime(
        2026, 10, 5, 17, 0, tzinfo=WAW
    )
    assert body["coverage_prompt"] is False


def test_ken_pago_proposal_uses_ken_rule(clock):
    clock(2026, 10, 1, 12)  # Thursday
    r = _proposal("SUP_PAGO", KEN_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["location_id"] == "KEN"
    assert r.json()["proposed_delivery_date"] == "2026-10-03"
    # Pago is not flagged for the Thursday prompt.
    assert r.json()["coverage_prompt"] is False


def test_deadline_boundary_17_00_00_on_time_17_00_01_late(clock):
    clock(2026, 9, 28, 17, 0, 0)
    assert _proposal("SUP_PAGO").json()["proposed_delivery_date"] == "2026-09-30"
    clock(2026, 9, 28, 17, 0, 1)
    assert _proposal("SUP_PAGO").json()["proposed_delivery_date"] == "2026-10-07"


def test_bukat_shared_rule_and_thursday_prompt(clock):
    clock(2026, 10, 1, 9)  # Thursday
    body = _proposal("SUP_BUKAT").json()
    assert body["source"] == "supplier"
    assert body["proposed_delivery_date"] == "2026-10-02"
    assert body["coverage_prompt"] is True
    clock(2026, 10, 2, 9)  # Friday
    assert _proposal("SUP_BUKAT").json()["coverage_prompt"] is False


def test_supplier_without_rule_falls_back(clock):
    clock(2026, 9, 28, 10)  # Monday; Coca-Cola has no seed rule
    body = _proposal("SUP_COCACOLA").json()
    assert body["source"] == "fallback"
    assert body["proposed_delivery_date"] == "2026-09-29"


def test_fallback_respects_supplier_delivery_days(clock, mocker):
    clock(2026, 9, 28, 10)  # Monday
    suppliers = [
        s.model_copy(update={"delivery_days": "Fri"}) if s.supplier_id == "SUP_COCACOLA" else s
        for s in seed_loader.load_suppliers()
    ]
    mocker.patch.object(seed_loader, "load_suppliers", return_value=suppliers)
    assert _proposal("SUP_COCACOLA").json()["proposed_delivery_date"] == "2026-10-02"


def test_unknown_supplier_404(clock):
    clock(2026, 9, 28, 10)
    assert _proposal("SUP_NOPE").status_code == 404


def test_auth_required_and_manager_token_rejected():
    r = client.get("/api/captain/delivery-proposal?supplier_id=SUP_PAGO")
    assert r.status_code == 401
    assert _proposal("SUP_PAGO", MANAGER_AUTH).status_code == 401


def test_rules_loader_failure_degrades_to_fallback(clock, mocker):
    clock(2026, 9, 29, 10)
    mocker.patch.object(
        seed_loader, "load_supplier_delivery_rules", side_effect=RuntimeError("boom")
    )
    r = _proposal("SUP_PAGO")
    assert r.status_code == 200, r.text
    assert r.json()["source"] == "fallback"


# ---------- submit persistence ----------

def _enable_sheet_submit(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    append_order = mocker.patch.object(sheets, "append_order")
    mocker.patch.object(sheets, "append_order_lines")
    mocker.patch.object(sheets, "load_products", side_effect=seed_loader.load_products)
    mocker.patch.object(sheets, "load_locations", side_effect=seed_loader.load_locations)
    mocker.patch.object(sheets, "load_suppliers", side_effect=seed_loader.load_suppliers)
    mocker.patch.object(
        sheets, "load_supplier_products", side_effect=seed_loader.load_supplier_products
    )
    mocker.patch.object(
        sheets,
        "load_location_product_settings",
        side_effect=seed_loader.load_location_product_settings,
    )
    return append_order


def _submit_body(**extra) -> dict:
    return {
        "supplier_id": "SUP_PAGO",
        "ordered_by": "Jan Kowalski",
        "requested_delivery_date": "2026-10-08",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 7,
                "captain_final_qty_purchase": 1,
            }
        ],
        **extra,
    }


def test_submit_persists_suggested_date_and_coverage(mocker):
    append_order = _enable_sheet_submit(mocker)
    r = client.post(
        "/api/captain/submit",
        json=_submit_body(suggested_delivery_date="2026-10-07", coverage_days=3),
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200, r.text
    order = append_order.call_args[0][0]
    assert order.requested_delivery_date == date(2026, 10, 8)
    assert order.suggested_delivery_date == date(2026, 10, 7)
    assert order.coverage_days == 3


def test_submit_without_new_fields_stores_none(mocker):
    append_order = _enable_sheet_submit(mocker)
    r = client.post("/api/captain/submit", json=_submit_body(), headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    order = append_order.call_args[0][0]
    assert order.suggested_delivery_date is None
    assert order.coverage_days is None


def test_submit_rejects_coverage_days_2():
    r = client.post(
        "/api/captain/submit", json=_submit_body(coverage_days=2), headers=WOLA_AUTH
    )
    assert r.status_code == 422
