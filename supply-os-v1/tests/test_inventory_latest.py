"""Tests for GET /api/captain/inventory/latest (S-07 / FR-017).

Returns the latest inventory snapshot for the Captain's location so the order
screen can offer an opt-in pre-fill. Sheet-only: seed mode degrades to null
(no persisted snapshots), mirroring captain_orders / manager_queue.

Synthetic data only — these tests never place or dispatch a real order.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from app import sheets
from app.config import DataBackend
from app.main import app
from app.models import InventoryCount, InventoryCountLine

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}


# ---------- Fixtures ----------

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
    submitted_at: datetime | None,
    count_date: date,
    lines: list[InventoryCountLine] | None = None,
) -> InventoryCount:
    lines = lines or []
    return InventoryCount(
        count_id=count_id,
        location_id=location_id,
        count_date=count_date,
        count_submitted_at=submitted_at,
        line_count=len(lines),
        lines=lines,
    )


def _activate_sheet(mocker, counts: list[InventoryCount]) -> None:
    """Switch the backend selector to `sheets` and stub the inventory reads.

    `counts` carry their own lines; `get_inventory_count` returns the matching
    count (lines populated), mirroring the real sheet adapter's contract.
    """
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_inventory_counts", return_value=counts)
    by_id = {c.count_id: c for c in counts}
    mocker.patch.object(
        sheets, "get_inventory_count", side_effect=lambda cid: by_id.get(cid)
    )


# ---------- Tests ----------

def test_latest_returns_newest_snapshot(mocker):
    older = _count(
        "INV-OLD", "WOLA",
        datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc), date(2026, 6, 1),
        lines=[_line("INV-OLD", "P027", 3)],
    )
    newer = _count(
        "INV-NEW", "WOLA",
        datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc), date(2026, 6, 5),
        lines=[_line("INV-NEW", "P027", 7), _line("INV-NEW", "P026", 2, idx=2)],
    )
    _activate_sheet(mocker, [older, newer])

    r = client.get("/api/captain/inventory/latest", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body is not None
    assert body["count_id"] == "INV-NEW"
    assert body["line_count"] == 2
    by_pid = {ln["product_id"]: ln["current_stock_qty_base"] for ln in body["lines"]}
    assert by_pid["P027"] == 7
    assert by_pid["P026"] == 2


def test_latest_is_location_scoped(mocker):
    """A newer snapshot at another location must NOT leak to this Captain."""
    wola = _count(
        "INV-WOLA", "WOLA",
        datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc), date(2026, 6, 1),
        lines=[_line("INV-WOLA", "P027", 3)],
    )
    ken_newer = _count(
        "INV-KEN", "KEN",
        datetime(2026, 6, 9, 10, 0, tzinfo=timezone.utc), date(2026, 6, 9),
        lines=[_line("INV-KEN", "P027", 99)],
    )
    _activate_sheet(mocker, [wola, ken_newer])

    r = client.get("/api/captain/inventory/latest", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["count_id"] == "INV-WOLA"


def test_latest_null_when_no_snapshot(mocker):
    _activate_sheet(mocker, [])
    r = client.get("/api/captain/inventory/latest", headers=WOLA_AUTH)
    assert r.status_code == 200
    assert r.json() is None


def test_latest_null_in_seed_mode():
    """No sheet activation → seed backend → snapshots not persisted → null."""
    r = client.get("/api/captain/inventory/latest", headers=WOLA_AUTH)
    assert r.status_code == 200
    assert r.json() is None


def test_latest_unauthorized_no_token():
    r = client.get("/api/captain/inventory/latest")
    assert r.status_code == 401


def test_latest_handles_missing_submitted_at(mocker):
    """A count missing count_submitted_at falls back to count_date (UTC midnight)
    for recency, so a newer-dated snapshot still wins."""
    no_ts = _count(
        "INV-NOTS", "WOLA", None, date(2026, 6, 7),
        lines=[_line("INV-NOTS", "P027", 5)],
    )
    older_ts = _count(
        "INV-TS", "WOLA",
        datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc), date(2026, 6, 1),
        lines=[_line("INV-TS", "P027", 1)],
    )
    _activate_sheet(mocker, [no_ts, older_ts])

    r = client.get("/api/captain/inventory/latest", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["count_id"] == "INV-NOTS"
