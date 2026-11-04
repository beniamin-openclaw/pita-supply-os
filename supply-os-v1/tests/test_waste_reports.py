import pytest
import asyncio
import base64
import json
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.requests import ClientDisconnect

from app import main
from app.models import Location, WasteCreate, WasteLineInput, WasteReport
from app.waste_catalog import ITEMS


@pytest.mark.parametrize("member", [42, True, [], {}])
@pytest.mark.parametrize("position", [0, 1])
def test_waste_invalid_cursor_members_are_rejected_before_query(monkeypatch, member, position):
    class Backend:
        SUPPORTS_WASTE_REPORTS = True

        def load_waste_reports(self, *args):
            pytest.fail("invalid cursor reached storage")

    monkeypatch.setattr(main, "_choose_backend", lambda: Backend())
    parts = ["2026-01-01T00:00:00+00:00", str(uuid4())]
    parts[position] = member
    cursor = base64.urlsafe_b64encode(json.dumps(parts).encode()).decode()
    response = TestClient(main.app).get("/api/captain/waste/reports", params={"cursor": cursor},
                                        headers={"Authorization": "Bearer test_wola_token"})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "waste_invalid_cursor"


@pytest.mark.parametrize("lines", [[], [{"product_id": "pita", "quantity": "1", "unit": "szt",
                                          "reason": "burned"}] * 101])
def test_waste_batch_line_limits(lines):
    with pytest.raises(ValidationError):
        WasteCreate.model_validate({"batch_uuid": str(uuid4()), "business_date": "2026-01-01", "lines": lines})


@pytest.mark.parametrize("field,length", [("description", 121), ("reason_detail", 501)])
def test_waste_text_limits(field, length):
    line = {"product_id": None, "description": "other", "quantity": "1", "unit": "szt",
            "reason": "other", "reason_detail": "detail"}
    line[field] = "x" * length
    with pytest.raises(ValidationError):
        WasteLineInput.model_validate(line)
    line[field] = "x" * (length - 1)
    assert WasteLineInput.model_validate(line)


def test_waste_export_closes_file_on_client_disconnect():
    output = main.TemporaryFile(mode="w+", encoding="utf-8", newline="")
    output.write("sample")
    output.seek(0)
    response = main._WasteExportResponse(output)

    async def receive():
        return {"type": "http.disconnect"}

    async def send(message):
        if message["type"] == "http.response.body":
            raise OSError("disconnected")

    async def run():
        with pytest.raises(ClientDisconnect):
            await response({"type": "http", "asgi": {"spec_version": "2.4"}}, receive, send)

    asyncio.run(run())
    assert output.closed


def test_waste_date_ranges_and_storage_failure(monkeypatch):
    class Backend:
        SUPPORTS_WASTE_REPORTS = True

        def load_waste_reports(self, *args):
            raise RuntimeError("storage failed")

        def append_waste_report(self, *args):
            raise RuntimeError("storage failed")

    monkeypatch.setattr(main, "_choose_backend", lambda: Backend())
    client = TestClient(main.app)
    auth = {"Authorization": "Bearer test_wola_token"}
    today = datetime.now(main.ZoneInfo("Europe/Warsaw")).date()
    for start, end in [(today, today - timedelta(days=1)), (today, today + timedelta(days=1)),
                       (today - timedelta(days=366), today)]:
        response = client.get("/api/captain/waste/reports", headers=auth,
                              params={"date_from": start.isoformat(), "date_to": end.isoformat()})
        assert response.status_code == 422 and response.json()["detail"]["code"] == "waste_invalid_date"
    valid = client.get("/api/captain/waste/reports", headers=auth,
                       params={"date_from": (today - timedelta(days=365)).isoformat(),
                               "date_to": today.isoformat()})
    assert valid.status_code == 503 and valid.json()["detail"]["write_outcome"] == "unknown"
    body = {"batch_uuid": str(uuid4()), "business_date": today.isoformat(),
            "lines": [{"product_id": "pita", "quantity": "1", "unit": "szt", "reason": "burned"}]}
    future_body = {**body, "business_date": (today + timedelta(days=1)).isoformat()}
    future = client.post("/api/captain/waste/reports", headers=auth, json=future_body)
    assert future.status_code == 422 and future.json()["detail"]["code"] == "waste_invalid_date"
    response = client.post("/api/captain/waste/reports", headers=auth, json=body)
    assert response.status_code == 503 and response.json()["detail"]["write_outcome"] == "unknown"


def test_waste_quantity_is_exact_and_requires_valid_catalog_unit():
    line = WasteLineInput(product_id="tomato", quantity="100", unit="g", reason="dropped")
    assert str(line.quantity) == "100"
    for quantity, unit in [("1e2", "g"), ("0.1", "g"), ("1.0", "g"),
                           ("1000000000", "g"), ("1", "szt")]:
        with pytest.raises(ValidationError):
            WasteLineInput(product_id="tomato", quantity=quantity, unit=unit, reason="dropped")


def test_waste_validation_limits_and_other():
    assert len(ITEMS) == 17 and len({item["product_id"] for item in ITEMS}) == 17
    assert {item["product_id"] for item in ITEMS if item["unit"] == "szt"} == {
        "avocado", "halloumi_reha", "pita", "souvlaki_chicken", "souvlaki_pork"}
    assert all(item["unit"] == "kg" for item in ITEMS if item["product_id"] not in {
        "avocado", "halloumi_reha", "pita", "souvlaki_chicken", "souvlaki_pork"})
    assert WasteLineInput(product_id="tomato", quantity="999999999", unit="g",
                          reason="dropped").quantity == 999999999
    with pytest.raises(ValidationError):
        WasteLineInput(product_id=None, description=" ", quantity="1", unit="kg", reason="dropped")
    with pytest.raises(ValidationError):
        WasteLineInput(product_id="", description="other", quantity="1", unit="kg", reason="dropped")
    with pytest.raises(ValidationError):
        WasteLineInput(product_id="pita", quantity="1", unit="szt", reason="other")
    with pytest.raises(ValidationError):
        WasteCreate.model_validate({"batch_uuid": str(uuid4()), "business_date": 0,
                                    "lines": [{"product_id": "pita", "quantity": "1",
                                               "unit": "szt", "reason": "burned"}]})


def test_waste_auth_scope_and_feature_errors(monkeypatch):
    class Backend:
        SUPPORTS_WASTE_REPORTS = True

        def load_locations(self):
            return [Location(location_id="WOLA", location_name="Wola")]

        def get_waste_report(self, report_id, location_id):
            if location_id == "KEN":
                return None
            return WasteReport(report_id=report_id, location_id="WOLA", business_date=date.today(),
                               batch_uuid=uuid4(), created_at=datetime.now(timezone.utc), lines=[])

    monkeypatch.setattr(main, "_choose_backend", lambda: Backend())
    client = TestClient(main.app)
    path = f"/api/captain/waste/reports/{uuid4()}"
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer test_ken_token"}).status_code == 404
    assert client.get(path, headers={"Authorization": "Bearer test_wola_token"}).status_code == 200
    forged = {"batch_uuid": str(uuid4()), "business_date": date.today().isoformat(), "location_id": "KEN",
              "lines": [{"product_id": "pita", "quantity": "1", "unit": "szt", "reason": "burned"}]}
    assert client.post("/api/captain/waste/reports", json=forged,
                       headers={"Authorization": "Bearer test_wola_token"}).status_code == 422
    manager = {"Authorization": "Bearer test_manager_token"}
    assert client.get("/api/manager/waste/reports", headers=manager,
                      params={"location_id": "UNKNOWN"}).status_code == 404
    invalid = client.get("/api/manager/waste/reports", headers=manager,
                         params={"date_from": "bad"})
    assert invalid.json()["detail"]["code"] == "waste_invalid_date"
    monkeypatch.setattr(main, "_choose_backend", lambda: object())
    unavailable = client.get("/api/captain/waste/catalog",
                             headers={"Authorization": "Bearer test_wola_token"})
    assert unavailable.status_code == 503
    assert unavailable.json()["detail"]["write_outcome"] == "rejected"
