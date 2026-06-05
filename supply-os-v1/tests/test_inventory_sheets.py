"""Unit tests for the inventory-count Sheets adapter (`app.sheets`, S-06).

Mirrors test_sheets_write.py: gspread is mocked at the `_open_worksheet` layer,
so no real network calls are made. Inventory persistence is append-only — there
is no update/delete to test.
"""
from __future__ import annotations

from datetime import date, datetime
from unittest.mock import MagicMock

import pytest

from app import sheets
from app.models import InventoryCount, InventoryCountLine


# ---------- Sheet column layouts (must match models.py field order) ----------

INVENTORY_COUNT_HEADERS = [
    "count_id",
    "location_id",
    "count_date",
    "count_user",
    "count_submitted_at",
    "line_count",
    "notes",
]
INVENTORY_COUNT_LINE_HEADERS = [
    "count_line_id",
    "count_id",
    "product_id",
    "current_stock_qty_base",
    "count_comment",
]


# ---------- Fixtures / helpers ----------

def _mk_count(**overrides) -> InventoryCount:
    base = dict(
        count_id="INV001",
        location_id="WOLA",
        count_date=date(2026, 6, 5),
        count_user="WOLA",
        count_submitted_at=None,
        line_count=0,
        notes="",
    )
    base.update(overrides)
    return InventoryCount(**base)


def _mk_count_line(**overrides) -> InventoryCountLine:
    base = dict(
        count_line_id="ICL001",
        count_id="INV001",
        product_id="P001",
        current_stock_qty_base=7.0,
        count_comment="",
    )
    base.update(overrides)
    return InventoryCountLine(**base)


def _mk_counts_ws(rows: list[dict] | None = None) -> MagicMock:
    ws = MagicMock()
    ws.title = "inventory_counts"
    ws.row_values.return_value = INVENTORY_COUNT_HEADERS
    ws.get_all_records.return_value = rows or []
    ws.find.return_value = None
    return ws


def _mk_count_lines_ws(rows: list[dict] | None = None) -> MagicMock:
    ws = MagicMock()
    ws.title = "inventory_count_lines"
    ws.row_values.return_value = INVENTORY_COUNT_LINE_HEADERS
    ws.get_all_records.return_value = rows or []
    ws.find.return_value = None
    return ws


@pytest.fixture(autouse=True)
def _reset_module_state(mocker):
    """Reset module-level singletons + caches before every test, and pin sheet_id."""
    sheets._client_instance = None
    sheets._sheet_instance = None
    sheets._ttl_cache.clear()
    sheets._column_order_cache.clear()
    mocker.patch.object(sheets.settings, "google_sheet_id", "TEST_SHEET_ID")
    yield
    sheets._client_instance = None
    sheets._sheet_instance = None
    sheets._ttl_cache.clear()
    sheets._column_order_cache.clear()


# ---------- append_inventory_count ----------

def test_append_inventory_count_writes_correct_row(mocker):
    ws = _mk_counts_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    count = _mk_count(
        count_user="WOLA",
        count_submitted_at=datetime(2026, 6, 5, 18, 30, 0),
        line_count=3,
        notes="evening count",
    )
    sheets.append_inventory_count(count)

    ws.append_row.assert_called_once()
    written = ws.append_row.call_args[0][0]
    assert len(written) == len(INVENTORY_COUNT_HEADERS)
    assert written[INVENTORY_COUNT_HEADERS.index("count_id")] == "INV001"
    assert written[INVENTORY_COUNT_HEADERS.index("location_id")] == "WOLA"
    # date -> ISO
    assert written[INVENTORY_COUNT_HEADERS.index("count_date")] == "2026-06-05"
    # datetime -> ISO
    assert "2026-06-05T18:30:00" in written[
        INVENTORY_COUNT_HEADERS.index("count_submitted_at")
    ]
    # int -> str
    assert written[INVENTORY_COUNT_HEADERS.index("line_count")] == "3"


def test_append_inventory_count_invalidates_cache(mocker):
    ws = _mk_counts_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    sheets._ttl_cache[("TEST_SHEET_ID", "inventory_counts")] = (0.0, ["stale"])
    sheets.append_inventory_count(_mk_count())
    assert ("TEST_SHEET_ID", "inventory_counts") not in sheets._ttl_cache


# ---------- append_inventory_count_lines ----------

def test_append_inventory_count_lines_batches_in_one_call(mocker):
    ws = _mk_count_lines_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    lines = [
        _mk_count_line(count_line_id="ICL001"),
        _mk_count_line(count_line_id="ICL002"),
        _mk_count_line(count_line_id="ICL003"),
    ]
    sheets.append_inventory_count_lines(lines)

    ws.append_rows.assert_called_once()
    rows_arg = ws.append_rows.call_args[0][0]
    assert len(rows_arg) == 3
    for row in rows_arg:
        assert len(row) == len(INVENTORY_COUNT_LINE_HEADERS)
    line_id_col = INVENTORY_COUNT_LINE_HEADERS.index("count_line_id")
    assert [r[line_id_col] for r in rows_arg] == ["ICL001", "ICL002", "ICL003"]


def test_append_inventory_count_lines_rejects_mixed_count_ids(mocker):
    ws = _mk_count_lines_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    lines = [
        _mk_count_line(count_line_id="ICL001", count_id="INV001"),
        _mk_count_line(count_line_id="ICL002", count_id="INV999"),
    ]
    with pytest.raises(ValueError) as exc:
        sheets.append_inventory_count_lines(lines)
    assert "count_id" in str(exc.value).lower()
    ws.append_rows.assert_not_called()


def test_append_inventory_count_lines_empty_is_noop(mocker):
    ws = _mk_count_lines_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sheets.append_inventory_count_lines([])
    ws.append_rows.assert_not_called()


def test_append_inventory_count_lines_invalidates_cache(mocker):
    ws = _mk_count_lines_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sheets._ttl_cache[("TEST_SHEET_ID", "inventory_count_lines")] = (0.0, ["stale"])
    sheets.append_inventory_count_lines([_mk_count_line()])
    assert ("TEST_SHEET_ID", "inventory_count_lines") not in sheets._ttl_cache


# ---------- get_inventory_count ----------

def test_get_inventory_count_returns_count_with_lines(mocker):
    counts_ws = _mk_counts_ws(rows=[
        {
            "count_id": "INV001",
            "location_id": "WOLA",
            "count_date": "2026-06-05",
            "count_user": "WOLA",
            "count_submitted_at": "",
            "line_count": 3,
            "notes": "",
        },
    ])
    lines_ws = _mk_count_lines_ws(rows=[
        {h: "" for h in INVENTORY_COUNT_LINE_HEADERS} | {
            "count_line_id": f"ICL00{i}",
            "count_id": "INV001",
            "product_id": "P001",
            "current_stock_qty_base": 7.0,
        }
        for i in range(1, 4)
    ])

    def open_ws(name):
        return {"inventory_counts": counts_ws, "inventory_count_lines": lines_ws}[name]

    mocker.patch.object(sheets, "_open_worksheet", side_effect=open_ws)

    count = sheets.get_inventory_count("INV001")
    assert count is not None
    assert count.count_id == "INV001"
    assert count.location_id == "WOLA"
    assert len(count.lines) == 3
    assert {ln.count_line_id for ln in count.lines} == {"ICL001", "ICL002", "ICL003"}


def test_get_inventory_count_returns_none_when_missing(mocker):
    counts_ws = _mk_counts_ws(rows=[])
    lines_ws = _mk_count_lines_ws(rows=[])
    mocker.patch.object(
        sheets,
        "_open_worksheet",
        side_effect=lambda name: {
            "inventory_counts": counts_ws,
            "inventory_count_lines": lines_ws,
        }[name],
    )
    assert sheets.get_inventory_count("DOES_NOT_EXIST") is None


# ---------- load_inventory_counts / load_inventory_count_lines ----------

def test_load_inventory_counts_happy_path(mocker):
    ws = _mk_counts_ws(rows=[
        {
            "count_id": "INV1",
            "location_id": "WOLA",
            "count_date": "2026-06-05",
            "count_user": "",
            "count_submitted_at": "",
            "line_count": 0,
            "notes": "",
        }
    ])
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    counts = sheets.load_inventory_counts()
    assert len(counts) == 1
    assert counts[0].count_id == "INV1"
    assert counts[0].count_date == date(2026, 6, 5)


def test_load_inventory_count_lines_happy_path(mocker):
    row = {h: "" for h in INVENTORY_COUNT_LINE_HEADERS} | {
        "count_line_id": "ICL1",
        "count_id": "INV1",
        "product_id": "P001",
        "current_stock_qty_base": 7,
    }
    ws = _mk_count_lines_ws(rows=[row])
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    lines = sheets.load_inventory_count_lines()
    assert len(lines) == 1
    assert lines[0].count_line_id == "ICL1"
    assert lines[0].current_stock_qty_base == 7
