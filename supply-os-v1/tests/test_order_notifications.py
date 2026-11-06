"""Dedicated, read/ingestion-only submission source; never a send receipt."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app import auth, main, seed_loader
from app.config import Settings, settings

client = TestClient(main.app)
PATH = "/api/integrations/order-submissions"
AUTH = {"Authorization": "Bearer integration-test-only"}
START = datetime(2026, 11, 5, tzinfo=timezone.utc)
BODY = {"supplier_id": "SUP_PAGO", "ordered_by": "Test Captain", "lines": [
    {"product_id": "P027", "supplier_product_id": "SP_PAGO_P027",
     "current_stock_qty_base": 7, "captain_final_qty_purchase": 1}]}


@pytest.fixture
def source(monkeypatch):
    config = SimpleNamespace(**settings.model_dump())
    config.order_notifications_enabled = True
    config.order_notifications_token = SecretStr("integration-test-only")
    config.order_notifications_started_at = START
    monkeypatch.setattr(main, "settings", config)
    monkeypatch.setattr(auth, "settings", config)
    backend = SimpleNamespace(SUPPORTS_ORDER_SUBMISSIONS=True, SUPPORTS_PERSISTENCE=True,
        load_order_submissions=Mock(return_value=[]), ack_order_submissions=Mock(return_value=1),
        append_order_submission=Mock(), append_order=Mock(), append_order_lines=Mock())
    for name in ("load_products", "load_suppliers", "load_locations", "load_supplier_products",
                 "load_location_product_settings"):
        setattr(backend, name, getattr(seed_loader, name))
    monkeypatch.setattr(main, "_choose_backend", lambda: backend)
    return backend


def test_capture_defaults_off_and_secret_is_redacted():
    config = Settings(_env_file=None)
    assert config.order_notifications_enabled is False
    assert "hidden-test-value" not in repr(Settings(_env_file=None,
        order_notifications_token="hidden-test-value"))


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer wrong"},
    {"Authorization": "Bearer test_manager_token"},
    {"Authorization": "Bearer test_wola_token"}, {"Authorization": "Basic integration-test-only"}])
@pytest.mark.parametrize("method", ["get", "post"])
def test_integration_requires_own_bearer_token(source, headers, method):
    response = (client.get(PATH, headers=headers) if method == "get" else
                client.post(PATH + "/ack", json={"order_ids": ["ORD-1"]}, headers=headers))
    assert response.status_code == 401
    source.load_order_submissions.assert_not_called()
    source.ack_order_submissions.assert_not_called()


@pytest.mark.parametrize("field,value", [("order_notifications_enabled", False),
    ("order_notifications_token", SecretStr("")), ("order_notifications_started_at", None),
    ("order_notifications_started_at", datetime(2026, 11, 5))])
def test_bad_configuration_fails_closed(source, monkeypatch, field, value):
    monkeypatch.setattr(main.settings, field, value)
    assert client.get(PATH, headers=AUTH).status_code == 503
    assert client.post(PATH + "/ack", json={"order_ids": ["ORD-1"]},
                       headers=AUTH).status_code == 503
    if field != "order_notifications_enabled":
        assert client.post("/api/captain/submit", json=BODY,
            headers={"Authorization": "Bearer test_wola_token"}).status_code == 503
        source.append_order.assert_not_called()


def test_unsupported_backend_fails_closed(source, monkeypatch):
    monkeypatch.setattr(source, "SUPPORTS_ORDER_SUBMISSIONS", False)
    assert client.get(PATH, headers=AUTH).status_code == 503
    assert client.post("/api/captain/submit", json=BODY,
        headers={"Authorization": "Bearer test_wola_token"}).status_code == 503
    source.append_order.assert_not_called()


@pytest.mark.parametrize("business_auth_enabled", [True, False])
def test_integration_token_never_grants_business_access(source, monkeypatch, business_auth_enabled):
    if not business_auth_enabled:
        monkeypatch.setattr(main.settings, "captain_tokens", SecretStr(""))
        monkeypatch.setattr(main.settings, "manager_token", SecretStr(""))
    assert client.get("/api/locations", headers=AUTH).status_code == 401
    assert client.get("/health/internal", headers=AUTH).status_code == 401
    assert client.post("/api/captain/submit", json=BODY, headers=AUTH).status_code == 401


def test_capture_uses_atomic_backend_and_exact_immutable_snapshot(source):
    response = client.post("/api/captain/submit", json=BODY,
        headers={"Authorization": "Bearer test_wola_token"})
    assert response.status_code == 200, response.text
    order, lines, event = source.append_order_submission.call_args.args
    assert event.model_dump(mode="json") == {
        "order_id": order.order_id, "location_id": "WOLA", "location_name": "Pita Bros Wola",
        "supplier_id": "SUP_PAGO", "supplier_name": "Pago", "submitted_at":
        order.captain_submitted_at.isoformat().replace("+00:00", "Z"),
        "requested_delivery_date": None, "line_count": 1}
    assert len(lines) == 1
    with pytest.raises(ValueError):
        event.location_name = "changed"
    source.append_order.assert_not_called()
    source.append_order_lines.assert_not_called()


def test_capture_off_or_not_started_preserves_legacy_submit(source, monkeypatch):
    monkeypatch.setattr(main.settings, "order_notifications_enabled", False)
    response = client.post("/api/captain/submit", json=BODY,
        headers={"Authorization": "Bearer test_wola_token"})
    assert response.status_code == 200
    source.append_order.assert_called_once()
    source.append_order_submission.assert_not_called()
    monkeypatch.setattr(main.settings, "order_notifications_enabled", True)
    monkeypatch.setattr(main.settings, "order_notifications_started_at",
                        datetime.now(timezone.utc) + timedelta(days=1))
    assert client.post("/api/captain/submit", json=BODY,
        headers={"Authorization": "Bearer test_wola_token"}).status_code == 200
    source.append_order_submission.assert_not_called()


def test_failed_atomic_capture_never_falls_back_to_legacy_success(source):
    source.append_order_submission.side_effect = RuntimeError("local simulated write failure")
    response = TestClient(main.app, raise_server_exceptions=False).post(
        "/api/captain/submit", json=BODY,
        headers={"Authorization": "Bearer test_wola_token"})
    assert response.status_code == 500
    source.append_order.assert_not_called()
    source.append_order_lines.assert_not_called()


def test_pending_reads_and_ack_are_ingestion_only(source):
    assert client.get(PATH, headers=AUTH).json() == {
        "items": [], "truncated": False, "capture_started_at": "2026-11-05T00:00:00Z"}
    source.load_order_submissions.assert_called_once_with(since=None, until=None, limit=101)
    response = client.post(PATH + "/ack", json={"order_ids": ["ORD-1"]}, headers=AUTH)
    assert response.json() == {"acknowledged": 1}
    source.ack_order_submissions.assert_called_once_with(["ORD-1"])
    source.append_order.assert_not_called()


@pytest.mark.parametrize("ids", [[], ["a", "a"], [str(i) for i in range(101)], [""], [1]])
def test_ack_requires_one_to_100_unique_nonempty_strings(source, ids):
    assert client.post(PATH + "/ack", json={"order_ids": ids}, headers=AUTH).status_code == 422
    source.ack_order_submissions.assert_not_called()


def test_unknown_ack_rejects_whole_request(source):
    source.ack_order_submissions.side_effect = ValueError("Unknown order_ids")
    assert client.post(PATH + "/ack", json={"order_ids": ["missing"]},
                       headers=AUTH).status_code == 400


@pytest.mark.parametrize("query", ["?since=2026-11-05T00:00:00Z", "?until=2026-11-05T00:00:00Z",
    "?since=2026-11-05T00:00:00&until=2026-11-06T00:00:00Z",
    "?since=2026-11-05T00:00:00Z&until=2026-11-04T00:00:00Z",
    "?since=2026-11-05T00:00:00Z&until=2026-11-08T00:00:00Z"])
def test_invalid_window_rejected_before_read(source, query):
    assert client.get(PATH + query, headers=AUTH).status_code == 422
    source.load_order_submissions.assert_not_called()


def test_window_uses_1000_limit_and_all_events(source):
    response = client.get(PATH, params={"since": START.isoformat(),
        "until": (START + timedelta(hours=48)).isoformat()}, headers=AUTH)
    assert response.status_code == 200
    source.load_order_submissions.assert_called_once_with(since=START,
        until=START + timedelta(hours=48), limit=1001)
