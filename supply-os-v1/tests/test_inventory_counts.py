"""Tests for the inventory snapshot picker routes (FR-024):

    GET /api/captain/inventory/counts        -> list[InventoryCountSummary]
    GET /api/captain/inventory/count/{id}    -> InventoryLatestResponse

The list powers the order-screen snapshot picker; the detail route fetches one
chosen snapshot (with lines) for pre-fill. Both are sheet-only and scoped to the
token's location. Seed mode degrades gracefully — list → ``[]``, detail → 503 —
never a 500.

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
    count_user: str | None = None,
    line_count: int | None = None,
) -> InventoryCount:
    lines = lines or []
    return InventoryCount(
        count_id=count_id,
        location_id=location_id,
        count_date=count_date,
        count_submitted_at=submitted_at,
        count_user=count_user,
        # Persisted line_count is independent of the lines list (lines live on a
        # separate tab); let a test pin it explicitly to prove the list route
        # reads the persisted value, not len(lines).
        line_count=line_count if line_count is not None else len(lines),
        lines=lines,
    )


def _activate_sheet(mocker, counts: list[InventoryCount]) -> None:
    """Switch the backend selector to `sheets` and stub the inventory reads.

    Mirrors test_inventory_latest._activate_sheet: `load_inventory_counts`
    returns the summaries; `get_inventory_count` returns the matching count with
    its lines populated.
    """
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_inventory_counts", return_value=counts)
    by_id = {c.count_id: c for c in counts}
    mocker.patch.object(
        sheets, "get_inventory_count", side_effect=lambda cid: by_id.get(cid)
    )


# ---------- List: /api/captain/inventory/counts ----------

def test_counts_lists_summaries_sorted_desc(mocker):
    older = _count(
        "INV-OLD", "WOLA",
        datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc), date(2026, 6, 1),
        count_user="Anna",
    )
    newer = _count(
        "INV-NEW", "WOLA",
        datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc), date(2026, 6, 5),
        count_user="Jan",
    )
    mid = _count(
        "INV-MID", "WOLA",
        datetime(2026, 6, 3, 8, 0, tzinfo=timezone.utc), date(2026, 6, 3),
    )
    _activate_sheet(mocker, [older, newer, mid])

    r = client.get("/api/captain/inventory/counts", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    assert [row["count_id"] for row in body] == ["INV-NEW", "INV-MID", "INV-OLD"]
    # No lines in the summary payload — compact rows only.
    assert "lines" not in body[0]
    assert body[0]["count_user"] == "Jan"


def test_counts_tie_break_by_submitted_at(mocker):
    """Two counts share a count_date → newer count_submitted_at sorts first."""
    earlier = _count(
        "INV-AM", "WOLA",
        datetime(2026, 6, 5, 8, 0, tzinfo=timezone.utc), date(2026, 6, 5),
    )
    later = _count(
        "INV-PM", "WOLA",
        datetime(2026, 6, 5, 17, 0, tzinfo=timezone.utc), date(2026, 6, 5),
    )
    _activate_sheet(mocker, [earlier, later])

    r = client.get("/api/captain/inventory/counts", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert [row["count_id"] for row in r.json()] == ["INV-PM", "INV-AM"]


def test_counts_caps_at_10(mocker):
    """12 snapshots → only the 10 newest by count_date are returned."""
    counts = [
        _count(
            f"INV-{day:02d}", "WOLA",
            datetime(2026, 6, day, 10, 0, tzinfo=timezone.utc), date(2026, 6, day),
        )
        for day in range(1, 13)  # 2026-06-01 .. 2026-06-12
    ]
    _activate_sheet(mocker, counts)

    r = client.get("/api/captain/inventory/counts", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) == 10
    ids = [row["count_id"] for row in body]
    assert ids[0] == "INV-12"  # newest first
    assert ids[-1] == "INV-03"  # 10th newest
    assert "INV-01" not in ids and "INV-02" not in ids  # oldest two dropped


def test_counts_location_scoped(mocker):
    """A snapshot at another location must NOT appear in this Captain's list."""
    wola = _count(
        "INV-WOLA", "WOLA",
        datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc), date(2026, 6, 1),
    )
    ken = _count(
        "INV-KEN", "KEN",
        datetime(2026, 6, 9, 10, 0, tzinfo=timezone.utc), date(2026, 6, 9),
    )
    _activate_sheet(mocker, [wola, ken])

    r = client.get("/api/captain/inventory/counts", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert [row["count_id"] for row in r.json()] == ["INV-WOLA"]


def test_counts_reads_persisted_line_count(mocker):
    """The summary's line_count is the persisted value (lines live on another
    tab) — the list route never fetches per-snapshot lines."""
    c = _count(
        "INV-LC", "WOLA",
        datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc), date(2026, 6, 5),
        lines=[],  # no lines loaded for the summary
        line_count=17,  # but the row records 17
    )
    _activate_sheet(mocker, [c])

    r = client.get("/api/captain/inventory/counts", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()[0]["line_count"] == 17


def test_counts_empty_when_no_snapshot(mocker):
    _activate_sheet(mocker, [])
    r = client.get("/api/captain/inventory/counts", headers=WOLA_AUTH)
    assert r.status_code == 200
    assert r.json() == []


def test_counts_empty_in_seed_mode():
    """No sheet activation → seed backend → snapshots not persisted → []."""
    r = client.get("/api/captain/inventory/counts", headers=WOLA_AUTH)
    assert r.status_code == 200
    assert r.json() == []


def test_counts_unauthorized_no_token():
    r = client.get("/api/captain/inventory/counts")
    assert r.status_code == 401


# ---------- Detail: /api/captain/inventory/count/{count_id} ----------

def test_count_detail_returns_lines(mocker):
    c = _count(
        "INV-DET", "WOLA",
        datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc), date(2026, 6, 5),
        lines=[_line("INV-DET", "P027", 7), _line("INV-DET", "P026", 2, idx=2)],
        count_user="Jan Kowalski",
    )
    _activate_sheet(mocker, [c])

    r = client.get("/api/captain/inventory/count/INV-DET", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["count_id"] == "INV-DET"
    assert body["count_user"] == "Jan Kowalski"
    assert body["line_count"] == 2
    by_pid = {ln["product_id"]: ln["current_stock_qty_base"] for ln in body["lines"]}
    assert by_pid == {"P027": 7, "P026": 2}


def test_count_detail_cross_location_404(mocker):
    """A count owned by another location → 404 (don't reveal it exists)."""
    ken = _count(
        "INV-KEN", "KEN",
        datetime(2026, 6, 9, 10, 0, tzinfo=timezone.utc), date(2026, 6, 9),
        lines=[_line("INV-KEN", "P027", 99)],
    )
    _activate_sheet(mocker, [ken])

    r = client.get("/api/captain/inventory/count/INV-KEN", headers=WOLA_AUTH)
    assert r.status_code == 404, r.text


def test_count_detail_missing_404(mocker):
    _activate_sheet(mocker, [])
    r = client.get("/api/captain/inventory/count/INV-NOPE", headers=WOLA_AUTH)
    assert r.status_code == 404, r.text


def test_count_detail_seed_mode_503():
    """Seed backend cannot serve snapshot detail → 503 (mirrors order detail)."""
    r = client.get("/api/captain/inventory/count/INV-X", headers=WOLA_AUTH)
    assert r.status_code == 503, r.text


def test_count_detail_worksheet_not_found_503(mocker):
    """Sheet mode but the inventory tabs don't exist → 503, not a raw 500."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(
        sheets, "get_inventory_count", side_effect=sheets.WorksheetNotFound
    )

    r = client.get("/api/captain/inventory/count/INV-X", headers=WOLA_AUTH)
    assert r.status_code == 503, r.text


def test_count_detail_unauthorized_no_token():
    r = client.get("/api/captain/inventory/count/INV-X")
    assert r.status_code == 401
