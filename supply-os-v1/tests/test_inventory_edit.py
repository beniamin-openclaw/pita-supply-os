"""Tests for the inventory-count EDIT endpoint (Phase 2, training-feedback-0901):

    PATCH /api/captain/inventory/count/{count_id}

Replace semantics: the route deletes the count's existing lines and appends
the submitted set, mirroring the tested `replace_order_lines_atomic` path.
`count_submitted_at` is preserved; `last_edited_at` is stamped. Exactly one
best-effort audit event (`_log_inventory_event`) is emitted per successful
edit — a logging failure must never fail the edit that already succeeded.

Synthetic data only — no real supplier order is ever placed or dispatched.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from app import seed_loader, sheets
from app.config import DataBackend
from app.main import app
from app.models import InventoryCount, InventoryCountLine

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
KEN_AUTH = {"Authorization": "Bearer test_ken_token"}

EDITED_BY = "Test Captain"

# P027 Souvlaki Kurczak / P019 Przyprawa do souvlakow are both configured at
# WOLA (see test_inventory_submit.py); P027 has no location_product_setting
# at KEN.
_PRODUCTS_BY_ID = {p.product_id: p for p in seed_loader.load_products()}


def _line(count_id: str, pid: str, qty: float, idx: int = 1) -> InventoryCountLine:
    return InventoryCountLine(
        count_line_id=f"ICL-{count_id}-{idx:03d}",
        count_id=count_id,
        product_id=pid,
        current_stock_qty_base=qty,
    )


def _count(
    count_id: str,
    location_id: str,
    lines: list[InventoryCountLine],
    submitted_at: datetime | None = None,
    count_date: date | None = None,
) -> InventoryCount:
    return InventoryCount(
        count_id=count_id,
        location_id=location_id,
        count_date=count_date or date(2026, 6, 5),
        count_submitted_at=submitted_at
        or datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc),
        count_user="Jan",
        line_count=len(lines),
        lines=lines,
    )


def _activate_sheet(mocker, count: InventoryCount | None) -> dict:
    """Point the sheet backend at real seed master data + a stubbed
    get_inventory_count, and spy every write call. Mirrors
    test_inventory_counts._activate_sheet / test_inventory_submit's
    _patch_sheet_master_data."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(
        sheets, "load_products", side_effect=seed_loader.load_products
    )
    mocker.patch.object(
        sheets,
        "load_location_product_settings",
        side_effect=seed_loader.load_location_product_settings,
    )
    mocker.patch.object(sheets, "get_inventory_count", return_value=count)
    delete_lines = mocker.patch.object(
        sheets,
        "delete_inventory_count_lines",
        return_value=len(count.lines) if count else 0,
    )
    append_lines = mocker.patch.object(sheets, "append_inventory_count_lines")
    update_count = mocker.patch.object(sheets, "update_inventory_count")
    append_event = mocker.patch.object(sheets, "append_inventory_count_event")
    return {
        "delete_lines": delete_lines,
        "append_lines": append_lines,
        "update_count": update_count,
        "append_event": append_event,
    }


# ---------- happy paths ----------

def test_edit_adds_previously_uncounted_product(mocker):
    """D1 guard: the persisted line_count reflects the new set, not the old —
    both list endpoints read line_count off the row, never len(lines)."""
    existing = _count("INV-EDIT-1", "WOLA", [_line("INV-EDIT-1", "P027", 5)])
    spies = _activate_sheet(mocker, existing)

    body = {
        "lines": [
            {"product_id": "P027", "current_stock_qty_base": 5},
            {"product_id": "P019", "current_stock_qty_base": 3},
        ],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-1", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["line_count"] == 2
    assert out["count_id"] == "INV-EDIT-1"
    assert out["count_date"] == "2026-06-05"

    spies["delete_lines"].assert_called_once_with("INV-EDIT-1")
    spies["append_lines"].assert_called_once()
    appended = spies["append_lines"].call_args[0][0]
    assert {ln.product_id for ln in appended} == {"P027", "P019"}
    assert all(ln.count_id == "INV-EDIT-1" for ln in appended)

    update_args, update_kwargs = spies["update_count"].call_args
    assert update_args[0] == "INV-EDIT-1"
    assert update_kwargs["line_count"] == 2


def test_edit_corrects_quantity_event_details_show_old_to_new_with_name(mocker):
    existing = _count("INV-EDIT-2", "WOLA", [_line("INV-EDIT-2", "P027", 5)])
    spies = _activate_sheet(mocker, existing)

    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 9}],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-2", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 200, r.text

    spies["append_event"].assert_called_once()
    event = spies["append_event"].call_args[0][0]
    assert event.count_id == "INV-EDIT-2"
    assert event.actor == EDITED_BY
    assert event.event_id.startswith("ICE-")
    product_name = _PRODUCTS_BY_ID["P027"].product_name_pl
    assert product_name in event.details
    assert "5" in event.details
    assert "9" in event.details
    assert "→" in event.details


def test_edit_removes_product_blank_line_gone(mocker):
    existing = _count(
        "INV-EDIT-3", "WOLA",
        [_line("INV-EDIT-3", "P027", 5), _line("INV-EDIT-3", "P019", 2, idx=2)],
    )
    spies = _activate_sheet(mocker, existing)

    # Blank P019 by omitting it entirely — only P027 remains counted.
    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 5}],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-3", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 200, r.text
    assert r.json()["line_count"] == 1

    appended = spies["append_lines"].call_args[0][0]
    assert {ln.product_id for ln in appended} == {"P027"}

    event = spies["append_event"].call_args[0][0]
    assert "usunięto" in event.details
    assert _PRODUCTS_BY_ID["P019"].product_name_pl in event.details


def test_edit_preserves_count_submitted_at_sets_last_edited_at(mocker):
    """G3 guard: count_submitted_at is never written by this route (it stays
    the original submit moment); last_edited_at is stamped fresh."""
    original_submit = datetime(2026, 6, 1, 8, 0, tzinfo=timezone.utc)
    existing = _count(
        "INV-EDIT-4", "WOLA", [_line("INV-EDIT-4", "P027", 5)],
        submitted_at=original_submit,
    )
    spies = _activate_sheet(mocker, existing)

    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 6}],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-4", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 200, r.text

    _, update_kwargs = spies["update_count"].call_args
    assert "count_submitted_at" not in update_kwargs
    assert "last_edited_at" in update_kwargs
    assert update_kwargs["last_edited_at"] is not None
    # Freshly stamped "now", not the original submit moment.
    assert update_kwargs["last_edited_at"] != original_submit


def test_edit_no_duplicate_line_after_edit(mocker):
    """G2 guard: replace semantics means a re-edited product yields exactly
    ONE persisted line — never the old value alongside the new one."""
    existing = _count("INV-EDIT-5", "WOLA", [_line("INV-EDIT-5", "P027", 5)])
    spies = _activate_sheet(mocker, existing)

    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 8}],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-5", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 200, r.text

    spies["delete_lines"].assert_called_once_with("INV-EDIT-5")
    appended = spies["append_lines"].call_args[0][0]
    assert len(appended) == 1
    assert appended[0].current_stock_qty_base == 8
    # A brand-new line id (edit-scoped), never reusing the old count_line_id.
    assert appended[0].count_line_id != "ICL-INV-EDIT-5-001"
    assert "-E-" in appended[0].count_line_id


def test_edit_optional_reason_folded_into_event_details(mocker):
    existing = _count("INV-EDIT-6", "WOLA", [_line("INV-EDIT-6", "P027", 5)])
    spies = _activate_sheet(mocker, existing)

    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 7}],
        "edited_by": EDITED_BY,
        "edit_reason": "poprawka po przerwanym liczeniu",
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-6", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 200, r.text
    event = spies["append_event"].call_args[0][0]
    assert "poprawka po przerwanym liczeniu" in event.details


# ---------- best-effort event contract ----------

def test_edit_event_append_failure_does_not_fail_edit(mocker):
    """Best-effort contract mirrored from _log_transport_event: a logging
    failure must never fail the correction that already succeeded."""
    existing = _count("INV-EDIT-7", "WOLA", [_line("INV-EDIT-7", "P027", 5)])
    spies = _activate_sheet(mocker, existing)
    spies["append_event"].side_effect = RuntimeError("boom")

    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 9}],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-7", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 200, r.text
    assert r.json()["line_count"] == 1
    # The destructive write still went through despite the event failure.
    spies["delete_lines"].assert_called_once_with("INV-EDIT-7")
    spies["append_lines"].assert_called_once()


# ---------- gates ----------

def test_edit_foreign_location_404(mocker):
    ken_count = _count("INV-KEN-1", "KEN", [_line("INV-KEN-1", "P027", 5)])
    _activate_sheet(mocker, ken_count)
    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 5}],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-KEN-1", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 404, r.text


def test_edit_unknown_count_404(mocker):
    _activate_sheet(mocker, None)
    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 5}],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-NOPE", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 404, r.text


def test_edit_seed_mode_503():
    """No sheet activation → seed backend → not persistent → 503."""
    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 5}],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-X", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 503, r.text


def test_edit_worksheet_not_found_503(mocker):
    """Sheet mode but the inventory tabs don't exist → 503, never a raw 500."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(
        sheets, "get_inventory_count", side_effect=sheets.WorksheetNotFound
    )
    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 5}],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-X", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 503, r.text


def test_edit_unknown_product_400(mocker):
    existing = _count("INV-EDIT-8", "WOLA", [_line("INV-EDIT-8", "P027", 5)])
    _activate_sheet(mocker, existing)
    body = {
        "lines": [{"product_id": "P999", "current_stock_qty_base": 5}],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-8", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 400, r.text
    assert "Unknown product_id" in r.json()["detail"]


def test_edit_no_setting_for_location_400(mocker):
    """P027 exists in master data but has no location_product_setting at KEN."""
    existing = _count("INV-EDIT-9", "KEN", [_line("INV-EDIT-9", "P027", 5)])
    _activate_sheet(mocker, existing)
    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 5}],
        "edited_by": EDITED_BY,
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-9", json=body, headers=KEN_AUTH
    )
    assert r.status_code == 400, r.text
    assert "no location_product_setting" in r.json()["detail"]


def test_edit_missing_edited_by_422(mocker):
    existing = _count("INV-EDIT-10", "WOLA", [_line("INV-EDIT-10", "P027", 5)])
    _activate_sheet(mocker, existing)
    body = {"lines": [{"product_id": "P027", "current_stock_qty_base": 5}]}
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-10", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 422


def test_edit_blank_edited_by_422(mocker):
    existing = _count("INV-EDIT-11", "WOLA", [_line("INV-EDIT-11", "P027", 5)])
    _activate_sheet(mocker, existing)
    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 5}],
        "edited_by": "",
    }
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-11", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 422


def test_edit_empty_lines_422(mocker):
    existing = _count("INV-EDIT-12", "WOLA", [_line("INV-EDIT-12", "P027", 5)])
    _activate_sheet(mocker, existing)
    body = {"lines": [], "edited_by": EDITED_BY}
    r = client.patch(
        "/api/captain/inventory/count/INV-EDIT-12", json=body, headers=WOLA_AUTH
    )
    assert r.status_code == 422


def test_edit_unauthorized_no_token():
    body = {
        "lines": [{"product_id": "P027", "current_stock_qty_base": 5}],
        "edited_by": EDITED_BY,
    }
    r = client.patch("/api/captain/inventory/count/INV-X", json=body)
    assert r.status_code == 401


# ---------- detail routes also carry last_edited_at + events ----------

def test_captain_detail_by_id_returns_last_edited_at_and_events(mocker):
    edited_at = datetime(2026, 6, 6, 10, 0, tzinfo=timezone.utc)
    existing = InventoryCount(
        count_id="INV-DET-EV",
        location_id="WOLA",
        count_date=date(2026, 6, 5),
        count_submitted_at=datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc),
        last_edited_at=edited_at,
        line_count=1,
        lines=[_line("INV-DET-EV", "P027", 5)],
    )
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "get_inventory_count", return_value=existing)
    from app.models import InventoryCountEvent

    mocker.patch.object(
        sheets,
        "load_inventory_count_events_for",
        return_value=[
            InventoryCountEvent(
                event_id="ICE-1", count_id="INV-DET-EV", event_type="count_edited",
                actor="Jan", at=edited_at, details="Souvlaki Kurczak: 3 → 5",
            )
        ],
    )

    r = client.get(
        "/api/captain/inventory/count/INV-DET-EV", headers=WOLA_AUTH
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["last_edited_at"] is not None
    assert len(body["events"]) == 1
    assert body["events"][0]["details"] == "Souvlaki Kurczak: 3 → 5"


def test_captain_detail_by_id_events_missing_worksheet_degrades_to_empty(mocker):
    existing = _count("INV-DET-NOEV", "WOLA", [_line("INV-DET-NOEV", "P027", 5)])
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "get_inventory_count", return_value=existing)
    mocker.patch.object(
        sheets, "load_inventory_count_events_for", side_effect=sheets.WorksheetNotFound
    )

    r = client.get(
        "/api/captain/inventory/count/INV-DET-NOEV", headers=WOLA_AUTH
    )
    assert r.status_code == 200, r.text
    assert r.json()["events"] == []
