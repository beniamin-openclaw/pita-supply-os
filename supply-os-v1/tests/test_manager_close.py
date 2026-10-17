"""Close without receipt (close-without-receipt, Ben's D5 of 17.10).

manager_sent with no receipt ──close(reason)──► closed, with an order_events
row ``closed_without_receipt`` as the trace. Fixtures mirror
test_manager_claim_release.py: monkeypatch the sheets surface.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app import errors, sheets
from app.config import DataBackend
from app.main import app
from app.models import Order, OrderStatus, Receipt

client = TestClient(app)
MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}
CAPTAIN_AUTH = {"Authorization": "Bearer test_wola_token"}
REASON = "Towar przyszedł poza aplikacją"


def _order(
    status: OrderStatus = OrderStatus.MANAGER_SENT, reference: str | None = None
) -> Order:
    return Order(
        order_id="ORD-A",
        location_id="WOLA",
        supplier_id="SUP_BUKAT",
        order_date=date(2026, 9, 20),
        status=status,
        captain_user="WOLA",
        captain_submitted_at=datetime(2026, 9, 20, 8, 30, tzinfo=timezone.utc),
        manager_sent_at=datetime(2026, 9, 20, 12, 0, tzinfo=timezone.utc),
        supplier_order_reference=reference,
        total_value_estimate_pln=500.0,
    )


def _enable_sheet(mocker, order: Order | None, receipts: list | None = None):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "get_order", return_value=order)
    mocker.patch.object(sheets, "invalidate_cache", return_value=None)
    mocker.patch.object(sheets, "load_receipts_for_orders", return_value=receipts or [])
    return {
        "update_order": mocker.patch.object(sheets, "update_order", return_value=None),
        "append_order_event": mocker.patch.object(
            sheets, "append_order_event", return_value=None
        ),
    }


def _close(reason: str = REASON, headers: dict | None = None):
    return client.post(
        "/api/manager/close/ORD-A",
        headers=MANAGER_AUTH if headers is None else headers,
        json={"reason": reason},
    )


def test_close_sent_order_without_receipt(mocker):
    patches = _enable_sheet(mocker, _order())
    r = _close(f"  {REASON}  ")
    assert r.status_code == 200, r.text
    assert r.json() == {"order_id": "ORD-A", "status": "closed"}

    kwargs = patches["update_order"].call_args.kwargs
    assert patches["update_order"].call_count == 1
    assert kwargs["status"] == "closed"
    assert kwargs["expected_status"] == "manager_sent"

    event = patches["append_order_event"].call_args.args[0]
    assert event.order_id == "ORD-A"
    assert event.event_type == "closed_without_receipt"
    assert event.details == REASON  # stripped
    assert event.actor
    assert event.at is not None


def test_close_keeps_the_transport_marker(mocker):
    patches = _enable_sheet(mocker, _order(reference="TRN-20261005-PAGO-ab12"))
    r = _close()
    assert r.status_code == 200, r.text
    kwargs = patches["update_order"].call_args.kwargs
    assert "supplier_order_reference" not in kwargs


@pytest.mark.parametrize(
    "status",
    [
        OrderStatus.CAPTAIN_SUBMITTED,
        OrderStatus.MANAGER_CLAIMED,
        OrderStatus.CLOSED,
        OrderStatus.CANCELLED,
    ],
)
def test_close_rejects_other_statuses(mocker, status):
    patches = _enable_sheet(mocker, _order(status=status))
    r = _close()
    assert r.status_code == 409
    assert "expected manager_sent" in r.json()["detail"]
    patches["update_order"].assert_not_called()
    patches["append_order_event"].assert_not_called()


def test_close_rejects_an_order_with_a_receipt(mocker):
    receipt = Receipt(
        receipt_id="RCP-1",
        order_id="ORD-A",
        location_id="WOLA",
        supplier_id="SUP_BUKAT",
        receipt_date=date(2026, 9, 22),
    )
    patches = _enable_sheet(mocker, _order(), receipts=[receipt])
    r = _close()
    assert r.status_code == 409
    assert "receipt" in r.json()["detail"]
    patches["update_order"].assert_not_called()


def test_close_requires_a_reason(mocker):
    patches = _enable_sheet(mocker, _order())
    assert _close("").status_code == 422  # Pydantic min_length=1
    r = _close("   ")
    assert r.status_code == 400
    patches["update_order"].assert_not_called()


def test_close_404_when_missing(mocker):
    _enable_sheet(mocker, None)
    assert _close().status_code == 404


def test_close_requires_manager_auth(mocker):
    patches = _enable_sheet(mocker, _order())
    assert _close(headers=CAPTAIN_AUTH).status_code == 401
    assert _close(headers={}).status_code == 401
    patches["update_order"].assert_not_called()


def test_close_404_when_the_order_vanishes_at_the_write(mocker):
    patches = _enable_sheet(mocker, _order())
    patches["update_order"].side_effect = errors.OrderNotFoundError("ORD-A")
    r = _close()
    assert r.status_code == 404
    patches["append_order_event"].assert_not_called()


def test_close_409_on_a_concurrent_change(mocker):
    patches = _enable_sheet(mocker, _order())
    patches["update_order"].side_effect = errors.OrderStatusConflictError("ORD-A")
    r = _close()
    assert r.status_code == 409
    assert "concurrently" in r.json()["detail"]
    patches["append_order_event"].assert_not_called()


def test_close_reverts_when_the_trace_cannot_be_written(mocker):
    patches = _enable_sheet(mocker, _order())
    closed = _order(status=OrderStatus.CLOSED)
    sheets.get_order.side_effect = [_order(), closed]  # route read, revert re-read
    # The close event fails; the compensating close_reverted event goes through.
    patches["append_order_event"].side_effect = [RuntimeError("order_events down"), None]
    r = _close()
    assert r.status_code == 503
    assert "was not closed" in r.json()["detail"]
    calls = patches["update_order"].call_args_list
    assert len(calls) == 2
    assert calls[0].kwargs["status"] == "closed"
    assert calls[1].kwargs == {"status": "manager_sent", "expected_status": "closed"}
    events = [c.args[0] for c in patches["append_order_event"].call_args_list]
    assert [e.event_type for e in events] == ["closed_without_receipt", "close_reverted"]


def test_close_revert_survives_a_failed_compensating_event(mocker):
    patches = _enable_sheet(mocker, _order())
    sheets.get_order.side_effect = [_order(), _order(status=OrderStatus.CLOSED)]
    patches["append_order_event"].side_effect = RuntimeError("order_events tab missing")
    r = _close()
    assert r.status_code == 503
    assert "was not closed" in r.json()["detail"]
    assert patches["update_order"].call_count == 2


def test_close_revert_skips_an_order_no_longer_closed(mocker):
    patches = _enable_sheet(mocker, _order())
    sheets.get_order.side_effect = [_order(), _order()]  # re-read: back on manager_sent
    patches["append_order_event"].side_effect = RuntimeError("down")
    r = _close()
    assert r.status_code == 503
    assert "was not closed" in r.json()["detail"]
    assert patches["update_order"].call_count == 1  # the close only, no revert write


def test_close_revert_leaves_an_order_a_receipt_closed_meanwhile(mocker):
    """Sheets has no atomic guard: if a captain receipt closed the order between
    the close and the failed trace write, the revert must not send it back to
    the sent lane."""
    patches = _enable_sheet(mocker, _order())
    closed = _order(status=OrderStatus.CLOSED)
    sheets.get_order.side_effect = [_order(), closed]
    sheets.load_receipts_for_orders.side_effect = [[], [object()]]  # route, revert
    patches["append_order_event"].side_effect = RuntimeError("down")
    r = _close()
    assert r.status_code == 503
    assert "a receipt closed the order" in r.json()["detail"]
    assert patches["update_order"].call_count == 1  # the close only, no revert


def test_close_says_so_when_the_revert_fails_too(mocker):
    patches = _enable_sheet(mocker, _order())
    sheets.get_order.side_effect = [_order(), _order(status=OrderStatus.CLOSED)]
    patches["append_order_event"].side_effect = RuntimeError("down")
    patches["update_order"].side_effect = [None, RuntimeError("down")]
    r = _close()
    assert r.status_code == 503
    assert "could not be reopened" in r.json()["detail"]


def test_close_503_on_the_seed_backend(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SEED)
    r = _close()
    assert r.status_code == 503
    assert "persistent backend" in r.json()["detail"]
