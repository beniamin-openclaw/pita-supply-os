"""Tests for transport-v2 Phase 1 (backend):

    GET  /api/manager/transport/batches        -> TransportBatchSummary.supplier_ids
    GET  /api/manager/transport/draft-config   -> TransportDraftConfig.order_mailbox
    POST /api/manager/transport/reopen         ("Cofnij wysłanie", sent -> draft)
    POST /api/manager/transport/draft-created  (Gmail draft trace event)

Same strategy as test_transport.py (whose private fixture builders are reused):
the `sheets` module is monkey-patched, so nothing touches Google, Supabase or
any network. Synthetic data only — no real supplier order is ever placed or
dispatched, and no e-mail or Gmail draft is created (draft-created only
records an id the frontend reports).
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app import errors, sheets, supabase_backend
from app.config import DataBackend
from app.config import settings as app_settings
from app.models import (
    Order,
    OrderStatus,
    TransportBatch,
)

from .test_supabase_backend import _executed, _fake_engine
from .test_transport import (
    CAPTAIN_AUTH,
    MANAGER_AUTH,
    _enable_sheet_backend,
    _enable_sheet_backend_for_write,
    _line,
    _location,
    _order,
    _receipt,
    _supplier,
    client,
)

TRN = "TRN-20261005-PAGO-7b64e0"
SENT_AT = datetime(2026, 10, 5, 9, 0, tzinfo=timezone.utc)


def _header(status: str = "sent", supplier_id: str = "SUP_PAGO") -> TransportBatch:
    return TransportBatch(
        transport_id=TRN,
        supplier_id=supplier_id,
        status=status,
        created_at=datetime(2026, 10, 5, 8, 0, tzinfo=timezone.utc),
        sent_at=SENT_AT if status == "sent" else None,
    )


def _member(
    order_id: str,
    location_id: str = "WOLA",
    supplier_id: str = "SUP_PAGO",
    status: OrderStatus = OrderStatus.MANAGER_SENT,
) -> Order:
    order = _order(
        order_id,
        location_id=location_id,
        supplier_id=supplier_id,
        status=status,
        supplier_order_reference=TRN,
        manager_sent_at=SENT_AT if status == OrderStatus.MANAGER_SENT else None,
    )
    if status == OrderStatus.MANAGER_SENT:
        order.sent_method = "transport"
    return order


def _locations() -> list:
    return [
        _location("WOLA", "Pita Bros Wola"),
        _location("BRACKA", "Pita Bros Bracka"),
        _location("KEN", "Pita Bros KEN"),
    ]


def _suppliers() -> list:
    return [_supplier("SUP_PAGO", "Pago"), _supplier("SUP_MORY", "Magazyn własny Mory")]


def _patch_receipts(mocker, store: list) -> MagicMock:
    """Replace the fixture's catch-all receipts mock with one that filters by
    the requested order ids (like both real backends), reading ``store`` on
    every call so a test can add a receipt mid-request."""

    def _for_orders(order_ids: list[str]) -> list:
        wanted = set(order_ids)
        return [r for r in store if r.order_id in wanted]

    return mocker.patch.object(
        sheets, "load_receipts_for_orders", side_effect=_for_orders
    )


def _stateful(
    mocker,
    header: TransportBatch,
    orders: list[Order],
    lines: list | None = None,
    on_update: Callable[[str, dict], None] | None = None,
) -> tuple[dict, list]:
    """`_enable_sheet_backend_for_write` whose writes really change the
    in-memory header/orders (guarded by ``expected_status`` like Supabase),
    so a test can chain requests. ``on_update(order_id, kwargs)`` runs before
    each order write — to inject a receipt or a failure. Returns the patches
    (plus ``load_receipts_for_orders``) and the mutable receipts store."""
    patches = _enable_sheet_backend_for_write(
        mocker,
        orders=orders,
        lines=lines or [],
        suppliers=_suppliers(),
        locations=_locations(),
        transport_batches=[header],
    )
    by_id = {o.order_id: o for o in orders}
    mocker.patch.object(sheets, "get_order", side_effect=lambda oid: by_id.get(oid))

    def _apply_order(order_id: str, **kwargs) -> None:
        if on_update is not None:
            on_update(order_id, kwargs)
        expected = kwargs.pop("expected_status", None)
        order = by_id[order_id]
        if expected is not None and order.status.value != expected:
            raise errors.OrderStatusConflictError(order_id)
        for field, value in kwargs.items():
            if field == "status":
                value = OrderStatus(value)
            elif field == "manager_sent_at" and isinstance(value, str):
                value = datetime.fromisoformat(value)
            setattr(order, field, value)

    def _apply_header(transport_id: str, **kwargs) -> None:
        assert transport_id == header.transport_id
        for field, value in kwargs.items():
            setattr(header, field, value)

    patches["update_order"].side_effect = _apply_order
    patches["update_transport_batch"].side_effect = _apply_header
    store: list = []
    patches["load_receipts_for_orders"] = _patch_receipts(mocker, store)
    return patches, store


def _reopen(transport_id: str = TRN, headers: dict | None = None):
    return client.post(
        "/api/manager/transport/reopen",
        headers=MANAGER_AUTH if headers is None else headers,
        json={"transport_id": transport_id},
    )


def _draft_created(body: dict, headers: dict | None = None):
    return client.post(
        "/api/manager/transport/draft-created",
        headers=MANAGER_AUTH if headers is None else headers,
        json=body,
    )


def _summary(transport_id: str = TRN) -> dict:
    r = client.get(
        "/api/manager/transport/batches?include_cancelled=true", headers=MANAGER_AUTH
    )
    assert r.status_code == 200, r.text
    return next(b for b in r.json() if b["transport_id"] == transport_id)


# ---------- GET /batches: supplier_ids ----------


def test_batches_supplier_ids_pago_and_mory_combined(mocker):
    orders = [
        _member("ORD-A", "WOLA", "SUP_PAGO"),
        _member("ORD-B", "BRACKA", "SUP_MORY"),
        _member("ORD-C", "KEN", "SUP_PAGO"),
        _member("ORD-D", "KEN", "SUP_MORY"),
    ]
    _enable_sheet_backend(
        mocker, orders=orders, suppliers=_suppliers(), transport_batches=[_header()]
    )
    summary = _summary()
    assert summary["supplier_ids"] == ["SUP_PAGO", "SUP_MORY"]
    assert summary["supplier_id"] == "SUP_PAGO"


def test_batches_supplier_ids_pago_only(mocker):
    orders = [_member("ORD-A", "WOLA"), _member("ORD-B", "BRACKA")]
    _enable_sheet_backend(mocker, orders=orders, transport_batches=[_header()])
    assert _summary()["supplier_ids"] == ["SUP_PAGO"]


def test_batches_supplier_ids_empty_draft_is_header_supplier(mocker):
    _enable_sheet_backend(mocker, orders=[], transport_batches=[_header("draft")])
    summary = _summary()
    assert summary["order_count"] == 0
    assert summary["supplier_ids"] == ["SUP_PAGO"]


def test_batches_supplier_ids_lead_first_even_without_lead_members(mocker):
    """A Pago-led draft holding only Magazyn Mory orders still lists Pago
    first — the lead is the batch's own supplier, not a member count."""
    orders = [_member("ORD-B", "BRACKA", "SUP_MORY", OrderStatus.MANAGER_CLAIMED)]
    _enable_sheet_backend(
        mocker, orders=orders, suppliers=_suppliers(), transport_batches=[_header("draft")]
    )
    assert _summary()["supplier_ids"] == ["SUP_PAGO", "SUP_MORY"]


def test_batches_supplier_ids_others_sorted_after_lead(mocker):
    orders = [
        _member("ORD-Z", "WOLA", "SUP_ZETA"),
        _member("ORD-B", "BRACKA", "SUP_MORY"),
        _member("ORD-A", "KEN", "SUP_PAGO"),
    ]
    _enable_sheet_backend(mocker, orders=orders, transport_batches=[_header()])
    assert _summary()["supplier_ids"] == ["SUP_PAGO", "SUP_MORY", "SUP_ZETA"]


def test_batches_supplier_ids_headerless_legacy(mocker):
    """No header row: the group's (first member's) supplier leads, exactly as
    the summary's own supplier_id does."""
    orders = [_member("ORD-A", "WOLA", "SUP_PAGO"), _member("ORD-B", "BRACKA", "SUP_MORY")]
    _enable_sheet_backend(mocker, orders=orders, transport_batches=[])
    summary = _summary()
    assert summary["status"] == "sent"
    assert summary["supplier_id"] == "SUP_PAGO"
    assert summary["supplier_ids"] == ["SUP_PAGO", "SUP_MORY"]


def test_batches_supplier_ids_ignore_cancelled_members(mocker):
    """Finalize cancels an empty manager-made Magazyn Mory skeleton but keeps
    its marker — Mory is not on that run, so no Mory badge."""
    orders = [
        _member("ORD-A", "WOLA", "SUP_PAGO"),
        _member("ORD-M", "BRACKA", "SUP_MORY", OrderStatus.CANCELLED),
    ]
    _enable_sheet_backend(
        mocker, orders=orders, suppliers=_suppliers(), transport_batches=[_header()]
    )
    summary = _summary()
    assert summary["supplier_ids"] == ["SUP_PAGO"]
    assert summary["order_count"] == 2  # the count itself is unchanged


# ---------- GET /draft-config: order_mailbox ----------


def test_draft_config_exposes_order_mailbox(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(app_settings, "order_mailbox", "biuro@pitabros.pl")
    mocker.patch.object(
        sheets, "load_meta", return_value={"transport_driver_recipients": "kierowca@x.pl"}
    )
    r = client.get("/api/manager/transport/draft-config", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["order_mailbox"] == "biuro@pitabros.pl"
    assert r.json()["driver_recipients"] == "kierowca@x.pl"


def test_draft_config_order_mailbox_survives_meta_failure(mocker):
    """The mailbox comes from settings, so a broken `_meta` read still
    carries it (only the `_meta`-sourced fields degrade to "")."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(app_settings, "order_mailbox", "biuro@pitabros.pl")
    mocker.patch.object(sheets, "load_meta", side_effect=RuntimeError("boom"))
    r = client.get("/api/manager/transport/draft-config", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == {
        "driver_recipients": "",
        "drivers": "",
        "vehicles": "",
        "order_mailbox": "biuro@pitabros.pl",
    }


# ---------- POST /reopen: gates ----------


def test_reopen_seed_mode_503():
    r = _reopen()
    assert r.status_code == 503


def test_reopen_missing_worksheet_503(mocker):
    patches = _enable_sheet_backend_for_write(mocker, orders=[])
    mocker.patch.object(
        sheets, "get_transport_batch", side_effect=sheets.WorksheetNotFound("x")
    )
    r = _reopen()
    assert r.status_code == 503
    patches["update_order"].assert_not_called()


def test_reopen_rejects_captain_token(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[_header()])
    r = _reopen(headers=CAPTAIN_AUTH)
    assert r.status_code == 401


def test_reopen_unknown_batch_404(mocker):
    patches = _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[])
    r = _reopen("TRN-UNKNOWN")
    assert r.status_code == 404
    patches["update_order"].assert_not_called()


def test_reopen_headerless_legacy_batch_404(mocker):
    orders = [_member("ORD-A"), _member("ORD-B", "BRACKA")]
    patches = _enable_sheet_backend_for_write(mocker, orders=orders, transport_batches=[])
    r = _reopen()
    assert r.status_code == 404
    patches["update_order"].assert_not_called()
    patches["update_transport_batch"].assert_not_called()
    patches["append_transport_event"].assert_not_called()


@pytest.mark.parametrize("status", ["draft", "cancelled"])
def test_reopen_not_sent_409(mocker, status):
    orders = [_member("ORD-A", status=OrderStatus.MANAGER_CLAIMED)]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, transport_batches=[_header(status)]
    )
    r = _reopen()
    assert r.status_code == 409
    assert "not sent" in r.json()["detail"]
    patches["update_order"].assert_not_called()
    patches["update_transport_batch"].assert_not_called()


def test_reopen_409_when_a_member_has_a_receipt_nothing_written(mocker):
    orders = [
        _member("ORD-A", "WOLA"),
        _member("ORD-B", "BRACKA", "SUP_MORY"),
        _member("ORD-C", "KEN"),
    ]
    patches = _enable_sheet_backend_for_write(
        mocker,
        orders=orders,
        suppliers=_suppliers(),
        locations=_locations(),
        transport_batches=[_header()],
    )
    # A receipt of an order OUTSIDE the batch must not count — the store is
    # filtered by the ids the route asks for, like both real backends.
    receipts = _patch_receipts(
        mocker, [_receipt("RCP-1", "ORD-B"), _receipt("RCP-X", "ORD-ELSEWHERE")]
    )
    r = _reopen()
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert "Pita Bros Bracka" in detail
    assert "Pita Bros Wola" not in detail
    # One fresh read, for exactly the batch's members.
    sheets.invalidate_cache.assert_any_call("receipts")
    receipts.assert_called_once_with(["ORD-A", "ORD-B", "ORD-C"])
    patches["update_order"].assert_not_called()
    patches["update_transport_batch"].assert_not_called()
    patches["append_transport_event"].assert_not_called()


def test_reopen_receipt_of_another_order_does_not_block(mocker):
    orders = [_member("ORD-A", "WOLA")]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, transport_batches=[_header()]
    )
    _patch_receipts(mocker, [_receipt("RCP-X", "ORD-ELSEWHERE")])
    r = _reopen()
    assert r.status_code == 200, r.text
    assert r.json()["reopened"] == ["ORD-A"]
    patches["update_transport_batch"].assert_called_once()


def test_reopen_409_when_a_member_is_closed_nothing_written(mocker):
    orders = [
        _member("ORD-A", "WOLA"),
        _member("ORD-K", "KEN", status=OrderStatus.CLOSED),
        _member("ORD-B", "BRACKA", status=OrderStatus.CLOSED),
    ]
    patches = _enable_sheet_backend_for_write(
        mocker,
        orders=orders,
        locations=_locations(),
        transport_batches=[_header()],
    )
    _patch_receipts(mocker, [])
    r = _reopen()
    assert r.status_code == 409
    detail = r.json()["detail"]
    # Every blocking location is named (sorted), the reopenable one is not.
    assert "Pita Bros Bracka, Pita Bros KEN" in detail
    assert "Pita Bros Wola" not in detail
    patches["update_order"].assert_not_called()
    patches["update_transport_batch"].assert_not_called()


def test_reopen_missing_receipts_worksheet_reads_as_no_receipts(mocker):
    """Mirrors `_has_receipts`: a missing 'receipts' worksheet is "no
    receipts", not an error (also for the post-write re-read)."""
    orders = [_member("ORD-A")]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, transport_batches=[_header()]
    )
    mocker.patch.object(
        sheets, "load_receipts_for_orders", side_effect=sheets.WorksheetNotFound("x")
    )
    r = _reopen()
    assert r.status_code == 200, r.text
    assert r.json()["reopened"] == ["ORD-A"]
    patches["update_order"].assert_called_once()


def test_reopen_sent_batch_without_members_409_header_stays_sent(mocker):
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[_header()]
    )
    r = _reopen()
    assert r.status_code == 409
    assert "no eligible members" in r.json()["detail"]
    patches["update_transport_batch"].assert_not_called()


def test_reopen_only_cancelled_members_409_without_noise(mocker):
    orders = [_member("ORD-E", "KEN", status=OrderStatus.CANCELLED)]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, transport_batches=[_header()]
    )
    r = _reopen()
    assert r.status_code == 409
    assert "no eligible members" in r.json()["detail"]
    assert "ORD-E" not in r.json()["detail"]
    patches["update_order"].assert_not_called()
    patches["update_transport_batch"].assert_not_called()


# ---------- POST /reopen: writes ----------


def test_reopen_happy_path(mocker):
    orders = [
        _member("ORD-A", "WOLA", "SUP_PAGO"),
        _member("ORD-B", "BRACKA", "SUP_MORY"),
        # Auto-removed at send (empty skeleton) — keeps the marker, cancelled.
        _member("ORD-E", "KEN", status=OrderStatus.CANCELLED),
    ]
    patches = _enable_sheet_backend_for_write(
        mocker,
        orders=orders,
        suppliers=_suppliers(),
        locations=_locations(),
        transport_batches=[_header()],
    )
    receipts = _patch_receipts(mocker, [])
    update_lines = mocker.patch.object(sheets, "update_order_lines", return_value=None)

    r = _reopen()
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload == {
        "transport_id": TRN,
        "reopened": ["ORD-A", "ORD-B"],
        # The auto-cancelled member is left out of `skipped` (no noise).
        "skipped": [],
    }

    calls = patches["update_order"].call_args_list
    assert [c.args[0] for c in calls] == ["ORD-A", "ORD-B"]
    for c in calls:
        assert c.kwargs == {
            "status": "manager_claimed",
            "sent_method": None,
            "manager_sent_at": None,
            "expected_status": "manager_sent",
        }
        # The TRN marker and every line stay untouched.
        assert "supplier_order_reference" not in c.kwargs
    update_lines.assert_not_called()
    patches["append_order_lines"].assert_not_called()

    # Gate read for every member, then the race re-read for the reopened
    # ones — each after a receipts cache invalidation.
    assert [c.args[0] for c in receipts.call_args_list] == [
        ["ORD-A", "ORD-B", "ORD-E"],
        ["ORD-A", "ORD-B"],
    ]
    receipt_invalidations = [
        c for c in sheets.invalidate_cache.call_args_list if c.args == ("receipts",)
    ]
    assert len(receipt_invalidations) == 2

    patches["update_transport_batch"].assert_called_once_with(
        TRN, status="draft", sent_at=None
    )

    events = [c.args[0] for c in patches["append_transport_event"].call_args_list]
    assert [e.event_type for e in events] == ["batch_reopened"]
    assert events[0].transport_id == TRN
    assert events[0].order_id is None
    assert events[0].details == "2 order(s) reopened: ORD-A, ORD-B"


def test_reopen_leaves_a_claimed_member_alone_and_reports_it(mocker):
    """A member finalize skipped (still manager_claimed in a sent batch) is
    left as is — it already matches the draft state the batch returns to."""
    orders = [
        _member("ORD-A", "WOLA"),
        _member("ORD-C", "KEN", status=OrderStatus.MANAGER_CLAIMED),
    ]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, transport_batches=[_header()]
    )
    r = _reopen()
    assert r.status_code == 200, r.text
    assert r.json()["reopened"] == ["ORD-A"]
    assert r.json()["skipped"] == [
        {"order_id": "ORD-C", "reason": "status manager_claimed not eligible"}
    ]
    assert [c.args[0] for c in patches["update_order"].call_args_list] == ["ORD-A"]


def test_reopen_conflict_goes_to_skipped_rest_still_reopened(mocker):
    orders = [_member("ORD-A", "WOLA"), _member("ORD-B", "BRACKA")]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, transport_batches=[_header()]
    )

    def _update(order_id: str, **kwargs) -> None:
        if order_id == "ORD-A":
            raise errors.OrderStatusConflictError("changed concurrently")

    patches["update_order"].side_effect = _update

    r = _reopen()
    assert r.status_code == 200, r.text
    assert r.json()["reopened"] == ["ORD-B"]
    assert r.json()["skipped"] == [{"order_id": "ORD-A", "reason": "reopen conflict"}]
    patches["update_transport_batch"].assert_called_once_with(
        TRN, status="draft", sent_at=None
    )
    event = patches["append_transport_event"].call_args.args[0]
    assert event.details == "1 order(s) reopened: ORD-B"


def test_reopen_all_conflicts_409_header_stays_sent(mocker):
    """Nothing reopened and nothing already claimed: flipping the header
    would strand a draft batch with no editable member."""
    orders = [_member("ORD-A", "WOLA"), _member("ORD-B", "BRACKA")]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, transport_batches=[_header()]
    )
    patches["update_order"].side_effect = errors.OrderStatusConflictError("x")
    r = _reopen()
    assert r.status_code == 409
    assert "stays sent" in r.json()["detail"]
    assert "ORD-A: reopen conflict" in r.json()["detail"]
    patches["update_transport_batch"].assert_not_called()
    patches["append_transport_event"].assert_not_called()


def test_reopen_member_backend_error_is_503_header_stays_sent(mocker):
    """An unexpected member failure keeps the header `sent` and asks for a
    retry; the event records it (the restore itself is covered below)."""
    orders = [_member("ORD-A", "WOLA"), _member("ORD-B", "BRACKA")]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, transport_batches=[_header()]
    )

    def _update(order_id: str, **kwargs) -> None:
        if order_id == "ORD-B":
            raise RuntimeError("backend down")

    patches["update_order"].side_effect = _update
    r = _reopen()
    assert r.status_code == 503
    patches["update_transport_batch"].assert_not_called()
    # ORD-A reopened, ORD-B failed, then ORD-A restored.
    calls = patches["update_order"].call_args_list
    assert [c.args[0] for c in calls] == ["ORD-A", "ORD-B", "ORD-A"]
    assert calls[-1].kwargs == {
        "status": "manager_sent",
        "sent_method": "transport",
        "manager_sent_at": SENT_AT,
        "expected_status": "manager_claimed",
    }
    event = patches["append_transport_event"].call_args.args[0]
    assert event.event_type == "batch_reopen_aborted"
    assert event.details == (
        "reopen aborted — backend error: ORD-B; restored to sent: ORD-A"
        " — header still sent, retry"
    )


def test_reopen_all_members_backend_error_503_header_stays_sent(mocker):
    orders = [_member("ORD-A", "WOLA"), _member("ORD-B", "BRACKA")]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, transport_batches=[_header()]
    )
    patches["update_order"].side_effect = RuntimeError("backend down")
    r = _reopen()
    assert r.status_code == 503
    patches["update_transport_batch"].assert_not_called()
    # Nothing was reopened, so nothing to restore.
    assert patches["update_order"].call_count == 2
    event = patches["append_transport_event"].call_args.args[0]
    assert event.event_type == "batch_reopen_aborted"
    assert event.details == (
        "reopen aborted — backend error: ORD-A, ORD-B — header still sent, retry"
    )


def _three_member_batch(
    mocker, on_update: Callable[[str, dict], None] | None = None
) -> tuple[TransportBatch, list[Order], dict, list]:
    header = _header()
    orders = [
        _member("ORD-A", "WOLA"),
        _member("ORD-B", "BRACKA", "SUP_MORY"),
        _member("ORD-C", "KEN"),
    ]
    patches, store = _stateful(mocker, header, orders, on_update=on_update)
    return header, orders, patches, store


def test_reopen_backend_error_restores_reopened_members_to_sent(mocker):
    """The 503 means "nothing changed": members flipped before the failing
    one go back to manager_sent with their original sent fields."""
    fail = {"ORD-C": True}

    def _flaky(order_id: str, kwargs: dict) -> None:
        if fail.get(order_id):
            raise RuntimeError("transient")

    header, orders, patches, _ = _three_member_batch(mocker, on_update=_flaky)
    r = _reopen()
    assert r.status_code == 503
    assert header.status == "sent" and header.sent_at == SENT_AT
    for o in orders:
        assert o.status == OrderStatus.MANAGER_SENT
        assert o.sent_method == "transport"
        assert o.manager_sent_at == SENT_AT
    patches["update_transport_batch"].assert_not_called()


def test_reopen_backend_error_then_receipt_then_retry_strands_nothing(mocker):
    """The stranding scenario: after the aborted call a captain confirms
    delivery of the still-sent member; the retry then 409s at the delivery
    gate — and the other members are still plain manager_sent, not
    manager_claimed under a sent header."""
    fail = {"ORD-C": True}

    def _flaky(order_id: str, kwargs: dict) -> None:
        if fail.get(order_id):
            raise RuntimeError("transient")

    header, orders, patches, store = _three_member_batch(mocker, on_update=_flaky)
    assert _reopen().status_code == 503

    # Captain at KEN records the delivery of ORD-C (manager_sent -> closed).
    store.append(_receipt("RCP-C", "ORD-C"))
    orders[2].status = OrderStatus.CLOSED
    fail["ORD-C"] = False
    writes_before = patches["update_order"].call_count

    r = _reopen()
    assert r.status_code == 409
    assert "Pita Bros KEN" in r.json()["detail"]
    assert patches["update_order"].call_count == writes_before
    assert header.status == "sent"
    assert orders[0].status == OrderStatus.MANAGER_SENT
    assert orders[1].status == OrderStatus.MANAGER_SENT
    assert orders[0].sent_method == "transport" and orders[0].manager_sent_at == SENT_AT


def test_reopen_backend_error_restore_failure_still_503_and_logged(mocker):
    def _flaky(order_id: str, kwargs: dict) -> None:
        if order_id == "ORD-C":
            raise RuntimeError("transient")
        if order_id == "ORD-B" and kwargs.get("status") == "manager_sent":
            raise RuntimeError("restore failed too")

    header, orders, patches, _ = _three_member_batch(mocker, on_update=_flaky)
    r = _reopen()
    assert r.status_code == 503
    assert header.status == "sent"
    assert orders[0].status == OrderStatus.MANAGER_SENT
    assert orders[1].status == OrderStatus.MANAGER_CLAIMED
    event = patches["append_transport_event"].call_args.args[0]
    assert event.details == (
        "reopen aborted — backend error: ORD-C; restored to sent: ORD-A;"
        " restore failed: ORD-B — header still sent, retry"
    )


def test_reopen_member_error_then_retry_completes(mocker):
    """After an aborted call (everything restored to manager_sent) the retry
    reopens every member and flips the header."""
    header = _header()
    orders = [_member("ORD-A", "WOLA"), _member("ORD-B", "BRACKA")]
    fail = {"ORD-B": True}

    def _flaky(order_id: str, kwargs: dict) -> None:
        if fail.get(order_id):
            raise RuntimeError("backend down")

    _stateful(mocker, header, orders, on_update=_flaky)
    assert _reopen().status_code == 503
    assert header.status == "sent"
    assert {o.status for o in orders} == {OrderStatus.MANAGER_SENT}

    fail["ORD-B"] = False
    r = _reopen()
    assert r.status_code == 200, r.text
    assert r.json() == {"transport_id": TRN, "reopened": ["ORD-A", "ORD-B"], "skipped": []}
    assert header.status == "draft" and header.sent_at is None
    assert {o.status for o in orders} == {OrderStatus.MANAGER_CLAIMED}


def test_reopen_header_write_failure_503_then_retry_flips_header(mocker):
    """Members are durably reopened before the header write; a failed header
    write must not read as success. The retry finds the members already
    manager_claimed (reopened=[]) and still flips the header."""
    header = _header()
    orders = [_member("ORD-A", "WOLA"), _member("ORD-B", "BRACKA")]
    patches, _ = _stateful(mocker, header, orders)
    apply_header = patches["update_transport_batch"].side_effect
    patches["update_transport_batch"].side_effect = RuntimeError("header write failed")

    r = _reopen()
    assert r.status_code == 503
    assert header.status == "sent"
    assert {o.status for o in orders} == {OrderStatus.MANAGER_CLAIMED}
    event = patches["append_transport_event"].call_args.args[0]
    assert event.event_type == "batch_reopened"
    assert "ORD-A, ORD-B" in event.details

    patches["update_transport_batch"].side_effect = apply_header
    r = _reopen()
    assert r.status_code == 200, r.text
    assert r.json()["reopened"] == []
    assert {s["reason"] for s in r.json()["skipped"]} == {
        "status manager_claimed not eligible"
    }
    assert header.status == "draft" and header.sent_at is None


def test_reopen_event_failure_does_not_break_reopen(mocker):
    orders = [_member("ORD-A", "WOLA")]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, transport_batches=[_header()]
    )
    patches["append_transport_event"].side_effect = sheets.WorksheetNotFound("x")
    r = _reopen()
    assert r.status_code == 200, r.text
    assert r.json()["reopened"] == ["ORD-A"]


# ---------- POST /reopen: a receipt landing during the reopen (race) ----------


def test_reopen_receipt_during_reopen_reverts_that_order(mocker):
    header = _header()
    orders = [_member("ORD-A", "WOLA"), _member("ORD-B", "BRACKA", "SUP_MORY")]
    holder: dict = {}

    def _captain_receives_b(order_id: str, kwargs: dict) -> None:
        # The captain's receipt for ORD-B is stored right as we reopen it.
        if order_id == "ORD-B" and kwargs.get("status") == "manager_claimed":
            holder["store"].append(_receipt("RCP-B", "ORD-B"))

    patches, holder["store"] = _stateful(
        mocker, header, orders, on_update=_captain_receives_b
    )

    r = _reopen()
    assert r.status_code == 200, r.text
    assert r.json() == {
        "transport_id": TRN,
        "reopened": ["ORD-A"],
        "skipped": [{"order_id": "ORD-B", "reason": "delivery recorded during reopen"}],
    }
    order_b = orders[1]
    assert order_b.status == OrderStatus.CLOSED
    assert order_b.sent_method == "transport"
    assert order_b.manager_sent_at == SENT_AT
    revert = patches["update_order"].call_args_list[-1]
    assert revert.args[0] == "ORD-B"
    assert revert.kwargs == {
        "status": "closed",
        "sent_method": "transport",
        "manager_sent_at": SENT_AT,
        "expected_status": "manager_claimed",
    }
    assert header.status == "draft"
    event = patches["append_transport_event"].call_args.args[0]
    assert event.details == (
        "1 order(s) reopened: ORD-A; delivery recorded during reopen: ORD-B"
    )


def test_reopen_receipt_during_reopen_of_only_member_409_header_stays_sent(mocker):
    header = _header()
    orders = [_member("ORD-A", "WOLA")]
    holder: dict = {}

    def _captain_receives(order_id: str, kwargs: dict) -> None:
        if kwargs.get("status") == "manager_claimed":
            holder["store"].append(_receipt("RCP-A", "ORD-A"))

    patches, holder["store"] = _stateful(mocker, header, orders, on_update=_captain_receives)
    r = _reopen()
    assert r.status_code == 409
    assert "delivery recorded during reopen" in r.json()["detail"]
    assert header.status == "sent" and header.sent_at == SENT_AT
    assert orders[0].status == OrderStatus.CLOSED
    assert orders[0].sent_method == "transport"
    event = patches["append_transport_event"].call_args.args[0]
    assert event.event_type == "batch_reopen_aborted"
    assert "delivery recorded during reopen: ORD-A" in event.details


def test_reopen_receipt_during_reopen_revert_failure_is_reported(mocker):
    header = _header()
    orders = [_member("ORD-A", "WOLA"), _member("ORD-B", "BRACKA")]
    holder: dict = {}

    def _receives_b_then_revert_fails(order_id: str, kwargs: dict) -> None:
        if order_id != "ORD-B":
            return
        if kwargs.get("status") == "manager_claimed":
            holder["store"].append(_receipt("RCP-B", "ORD-B"))
        elif kwargs.get("status") == "closed":
            raise RuntimeError("revert failed")

    _, holder["store"] = _stateful(
        mocker, header, orders, on_update=_receives_b_then_revert_fails
    )
    r = _reopen()
    assert r.status_code == 200, r.text
    assert r.json()["skipped"] == [
        {"order_id": "ORD-B", "reason": "delivery recorded during reopen (revert failed)"}
    ]


# ---------- POST /reopen: round trip and locks ----------


def _draft_round_trip_setup(mocker) -> tuple[TransportBatch, list[Order], dict]:
    header = _header("draft")
    orders = [
        _member("ORD-A", "WOLA", "SUP_PAGO", OrderStatus.MANAGER_CLAIMED),
        _member("ORD-B", "BRACKA", "SUP_MORY", OrderStatus.MANAGER_CLAIMED),
    ]
    lines = [
        _line("ORD-A", "OL-A-1", captain_qty=5.0),
        _line("ORD-B", "OL-B-1", product_id="P050", sp_id="SP_MORY_P050", captain_qty=2.0),
    ]
    patches, _ = _stateful(mocker, header, orders, lines=lines)
    return header, orders, patches


def _finalize():
    return client.post(
        "/api/manager/transport/finalize", headers=MANAGER_AUTH, json={"transport_id": TRN}
    )


def test_finalize_reopen_finalize_round_trip(mocker):
    """Stateful fake: send -> undo-send -> fix -> send again. After reopen
    the batch reads as an ordinary draft (members manager_claimed, sent
    fields cleared, marker kept) and finalize accepts it again."""
    header, orders, _ = _draft_round_trip_setup(mocker)

    r = _finalize()
    assert r.status_code == 200, r.text
    assert set(r.json()["sent"]) == {"ORD-A", "ORD-B"}
    assert header.status == "sent" and header.sent_at is not None
    assert all(o.status == OrderStatus.MANAGER_SENT for o in orders)
    assert all(o.sent_method == "transport" and o.manager_sent_at for o in orders)

    r = _reopen()
    assert r.status_code == 200, r.text
    assert r.json()["reopened"] == ["ORD-A", "ORD-B"]
    assert header.status == "draft" and header.sent_at is None
    for o in orders:
        assert o.status == OrderStatus.MANAGER_CLAIMED
        assert o.sent_method is None
        assert o.manager_sent_at is None
        assert o.supplier_order_reference == TRN

    r = client.get(f"/api/manager/transport/batch/{TRN}", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["status"] == "draft"
    assert {o["status"] for o in detail["orders"]} == {"manager_claimed"}

    # Reopening twice is a 409 (the batch is draft now), finalize works again.
    assert _reopen().status_code == 409
    r = _finalize()
    assert r.status_code == 200, r.text
    assert set(r.json()["sent"]) == {"ORD-A", "ORD-B"}
    assert header.status == "sent"


def test_reopened_batch_members_are_locked_like_any_draft(mocker):
    """After reopen the members sit in a DRAFT batch again: the queue's
    release/cancel hit the draft-transport lock, and a captain can no longer
    confirm delivery (the order is not manager_sent)."""
    header, orders, patches = _draft_round_trip_setup(mocker)
    assert _finalize().status_code == 200
    assert _reopen().status_code == 200
    assert header.status == "draft"
    writes_before = patches["update_order"].call_count

    for action in ("release", "cancel"):
        r = client.post(
            f"/api/manager/{action}/ORD-A", headers=MANAGER_AUTH, json={"reason": "test"}
        )
        assert r.status_code == 409, r.text
        assert "draft transport" in r.json()["detail"]

    receipt_append = mocker.patch.object(sheets, "append_receipt", return_value=None)
    r = client.post(
        "/api/captain/receipt/submit",
        headers=CAPTAIN_AUTH,
        json={
            "order_id": "ORD-A",
            "received_by": "Ola",
            "lines": [{"order_line_id": "OL-A-1", "received_qty_purchase": 5}],
        },
    )
    assert r.status_code == 409, r.text
    assert "manager_claimed" in r.json()["detail"]
    receipt_append.assert_not_called()

    assert patches["update_order"].call_count == writes_before
    assert {o.status for o in orders} == {OrderStatus.MANAGER_CLAIMED}


# ---------- Supabase binding: the reopen writes really clear the columns ----------


def test_supabase_reopen_order_write_binds_nulls(mocker):
    conn = _fake_engine(mocker, fetchall=[("ORD-A",)])
    supabase_backend.update_order(
        "ORD-A",
        status=OrderStatus.MANAGER_CLAIMED.value,
        sent_method=None,
        manager_sent_at=None,
        expected_status=OrderStatus.MANAGER_SENT.value,
    )
    sql, params = _executed(conn)[0]
    assert "sent_method = :sent_method" in sql
    assert "manager_sent_at = CAST(:manager_sent_at AS timestamptz)" in sql
    assert "AND status = :_expected_status" in sql
    assert params["sent_method"] is None
    assert params["manager_sent_at"] is None
    assert params["status"] == "manager_claimed"
    assert params["_expected_status"] == "manager_sent"
    assert "supplier_order_reference" not in params


def test_supabase_reopen_header_write_binds_null_sent_at(mocker):
    conn = _fake_engine(mocker, fetchall=[(TRN,)])
    supabase_backend.update_transport_batch(TRN, status="draft", sent_at=None)
    sql, params = _executed(conn)[0]
    assert "sent_at = CAST(:sent_at AS timestamptz)" in sql
    assert params["sent_at"] is None
    assert params["status"] == "draft"


# ---------- POST /draft-created ----------


def _body(**overrides) -> dict:
    body = {
        "transport_id": TRN,
        "kind": "order",
        "gmail_draft_id": "r-5104721234567890123",
        "mailbox": "biuro@pitabros.pl",
    }
    body.update(overrides)
    return body


def test_draft_created_order_kind_records_event(mocker):
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[_header("sent")]
    )
    r = _draft_created(_body())
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["transport_id"] == TRN
    assert payload["event_type"] == "order_draft_created"
    assert payload["order_id"] is None
    assert payload["actor"] == "manager-default"
    assert payload["at"]
    assert payload["event_id"].startswith("TEV-")
    assert payload["details"] == "draft_id=r-5104721234567890123; mailbox=biuro@pitabros.pl"

    patches["append_transport_event"].assert_called_once()
    stored = patches["append_transport_event"].call_args.args[0]
    assert stored.model_dump(mode="json") == payload
    # Recording a draft never changes the batch or its orders.
    patches["update_transport_batch"].assert_not_called()
    patches["update_order"].assert_not_called()


def test_draft_created_driver_kind_on_draft_batch_with_replaced(mocker):
    """The driver list may go out before finalize, so a draft batch is fine."""
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[_header("draft")]
    )
    r = _draft_created(
        _body(kind="driver", gmail_draft_id="r-2", replaced_draft_id="r-1")
    )
    assert r.status_code == 200, r.text
    assert r.json()["event_type"] == "driver_draft_created"
    assert r.json()["details"] == "draft_id=r-2; mailbox=biuro@pitabros.pl; replaced=r-1"
    patches["append_transport_event"].assert_called_once()


def test_draft_created_details_with_replaced_and_extras(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[_header()])
    r = _draft_created(
        _body(
            gmail_draft_id="r-9",
            replaced_draft_id="r-8",
            approved_extras=[
                "Tacki bez logo - 2 opak",
                "Przyprawa do souvlaków\n(z Magazynu) - 1 kg ",
                "   ",
                "  Box beżowy\r\n\r\nbez logo - 3 szt\n",
            ],
        )
    )
    assert r.status_code == 200, r.text
    assert r.json()["details"] == (
        "draft_id=r-9; mailbox=biuro@pitabros.pl; replaced=r-8; extras="
        "Tacki bez logo - 2 opak | Przyprawa do souvlaków (z Magazynu) - 1 kg"
        " | Box beżowy bez logo - 3 szt"
    )


def test_draft_created_only_blank_extras_adds_no_extras_segment(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[_header()])
    r = _draft_created(_body(gmail_draft_id="r-3", approved_extras=["", " \n "]))
    assert r.status_code == 200, r.text
    assert r.json()["details"] == "draft_id=r-3; mailbox=biuro@pitabros.pl"


def test_draft_created_empty_mailbox_is_kept_explicit(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[_header()])
    body = _body(gmail_draft_id="r-4")
    del body["mailbox"]
    r = _draft_created(body)
    assert r.status_code == 200, r.text
    assert r.json()["details"] == "draft_id=r-4; mailbox="


@pytest.mark.parametrize(
    "overrides",
    [
        {"kind": "pago"},
        {"kind": ""},
        {"gmail_draft_id": ""},
        {"gmail_draft_id": "r 1"},
        {"gmail_draft_id": "r-1; mailbox=evil"},
        {"gmail_draft_id": "r-1\n"},
        {"gmail_draft_id": "x" * 201},
        {"replaced_draft_id": "bad id"},
        {"replaced_draft_id": "x" * 201},
        {"mailbox": "m" * 201},
        {"mailbox": "a@b.pl; replaced=r-0"},
        {"mailbox": "a@b.pl | x"},
        {"mailbox": "a@b.pl\nextras=x"},
        {"mailbox": "a@b.pl\rx"},
        {"approved_extras": ["x"] * 51},
        {"approved_extras": ["x" * 301]},
    ],
    ids=[
        "kind-unknown",
        "kind-empty",
        "id-empty",
        "id-space",
        "id-injection",
        "id-newline",
        "id-too-long",
        "replaced-bad",
        "replaced-too-long",
        "mailbox-too-long",
        "mailbox-semicolon",
        "mailbox-pipe",
        "mailbox-lf",
        "mailbox-cr",
        "extras-too-many",
        "extra-too-long",
    ],
)
def test_draft_created_validation_422(mocker, overrides):
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[_header()]
    )
    r = _draft_created(_body(**overrides))
    assert r.status_code == 422, r.text
    patches["append_transport_event"].assert_not_called()


def test_draft_created_accepts_limits(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[_header()])
    r = _draft_created(
        _body(
            gmail_draft_id="A" * 200,
            replaced_draft_id="z_" * 100,
            mailbox="m" * 200,
            approved_extras=["e" * 300] * 50,
        )
    )
    assert r.status_code == 200, r.text


def test_draft_created_missing_kind_422(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[_header()])
    body = _body()
    del body["kind"]
    assert _draft_created(body).status_code == 422


def test_draft_created_cancelled_batch_409(mocker):
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[_header("cancelled")]
    )
    r = _draft_created(_body())
    assert r.status_code == 409
    patches["append_transport_event"].assert_not_called()


def test_draft_created_order_kind_on_draft_batch_409(mocker):
    """The order e-mail is the finalized batch's — a draft batch can still
    change, so its order draft would record a stale list."""
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[_header("draft")]
    )
    r = _draft_created(_body())
    assert r.status_code == 409
    assert "finalize" in r.json()["detail"]
    patches["append_transport_event"].assert_not_called()


def test_draft_created_driver_kind_on_sent_batch(mocker):
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[_header("sent")]
    )
    r = _draft_created(_body(kind="driver"))
    assert r.status_code == 200, r.text
    assert r.json()["event_type"] == "driver_draft_created"
    patches["append_transport_event"].assert_called_once()


@pytest.mark.parametrize("kind", ["order", "driver"])
def test_draft_created_cancelled_batch_409_for_both_kinds(mocker, kind):
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[_header("cancelled")]
    )
    assert _draft_created(_body(kind=kind)).status_code == 409
    patches["append_transport_event"].assert_not_called()


def test_draft_created_unknown_batch_404(mocker):
    patches = _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[])
    r = _draft_created(_body(transport_id="TRN-UNKNOWN"))
    assert r.status_code == 404
    patches["append_transport_event"].assert_not_called()


def test_draft_created_headerless_legacy_batch_404(mocker):
    orders = [_member("ORD-A")]
    patches = _enable_sheet_backend_for_write(mocker, orders=orders, transport_batches=[])
    r = _draft_created(_body())
    assert r.status_code == 404
    patches["append_transport_event"].assert_not_called()


def test_draft_created_event_write_failure_is_503(mocker):
    """Unlike the best-effort events, the frontend relies on this record:
    a failed write must surface, never read as success."""
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[_header()]
    )
    patches["append_transport_event"].side_effect = RuntimeError("table missing")
    r = _draft_created(_body())
    assert r.status_code == 503
    patches["append_transport_event"].assert_called_once()


def test_draft_created_missing_worksheet_503(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[])
    mocker.patch.object(
        sheets, "get_transport_batch", side_effect=sheets.WorksheetNotFound("x")
    )
    assert _draft_created(_body()).status_code == 503


def test_draft_created_seed_mode_503():
    assert _draft_created(_body()).status_code == 503


def test_draft_created_rejects_captain_token(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[_header()])
    assert _draft_created(_body(), headers=CAPTAIN_AUTH).status_code == 401
