"""Unit tests for the inventory-count Sheets adapter (`app.sheets`, S-06 +
Phase 2 / training-feedback-0901).

Mirrors test_sheets_write.py: gspread is mocked at the `_open_worksheet` layer,
so no real network calls are made. A submitted count is append-only, but
(Phase 2) it CAN be corrected afterward via the replace-semantics edit trio
(`delete_inventory_count_lines` + `append_inventory_count_lines` +
`update_inventory_count`) plus the best-effort `inventory_count_events` audit
log (`append_inventory_count_event` / `load_inventory_count_events_for`).
"""
from __future__ import annotations

from datetime import date, datetime
from unittest.mock import MagicMock

import pytest

from app import sheets
from app.models import InventoryCount, InventoryCountEvent, InventoryCountLine


# ---------- Sheet column layouts (must match models.py field order) ----------

INVENTORY_COUNT_HEADERS = [
    "count_id",
    "location_id",
    "count_date",
    "count_user",
    "count_submitted_at",
    "line_count",
    "notes",
    "last_edited_at",
]
INVENTORY_COUNT_LINE_HEADERS = [
    "count_line_id",
    "count_id",
    "product_id",
    "current_stock_qty_base",
    "count_comment",
]
INVENTORY_COUNT_EVENT_HEADERS = [
    "event_id",
    "count_id",
    "event_type",
    "actor",
    "at",
    "details",
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


def _mk_count_events_ws(rows: list[dict] | None = None) -> MagicMock:
    ws = MagicMock()
    ws.title = "inventory_count_events"
    ws.row_values.return_value = INVENTORY_COUNT_EVENT_HEADERS
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


# ---------- delete_inventory_count_lines (Phase 2, training-feedback-0901) ----------

def test_delete_inventory_count_lines_removes_contiguous_range(mocker):
    # header + 3 rows for INV001, then 1 row for INV002.
    col_values = ["count_id", "INV001", "INV001", "INV001", "INV002"]
    ws = _mk_count_lines_ws()
    ws.col_values.return_value = col_values
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    n = sheets.delete_inventory_count_lines("INV001")
    assert n == 3
    ws.delete_rows.assert_called_once_with(2, 4)


def test_delete_inventory_count_lines_no_match_returns_zero(mocker):
    col_values = ["count_id", "INV002"]
    ws = _mk_count_lines_ws()
    ws.col_values.return_value = col_values
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    n = sheets.delete_inventory_count_lines("INV001")
    assert n == 0
    ws.delete_rows.assert_not_called()


def test_delete_inventory_count_lines_invalidates_cache(mocker):
    col_values = ["count_id", "INV001"]
    ws = _mk_count_lines_ws()
    ws.col_values.return_value = col_values
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sheets._ttl_cache[("TEST_SHEET_ID", "inventory_count_lines")] = (0.0, ["stale"])

    sheets.delete_inventory_count_lines("INV001")
    assert ("TEST_SHEET_ID", "inventory_count_lines") not in sheets._ttl_cache


# ---------- update_inventory_count (Phase 2, training-feedback-0901) ----------

def test_update_inventory_count_writes_changed_cells(mocker):
    ws = _mk_counts_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    mocker.patch.object(sheets, "_find_row_index", return_value=2)

    sheets.update_inventory_count(
        "INV001",
        line_count=4,
        last_edited_at=datetime(2026, 6, 10, 12, 0, 0),
    )
    ws.batch_update.assert_called_once()
    updates = ws.batch_update.call_args[0][0]
    written_values = [u["values"][0][0] for u in updates]
    assert "4" in written_values
    assert any("2026-06-10T12:00:00" in v for v in written_values)


def test_update_inventory_count_missing_raises(mocker):
    ws = _mk_counts_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    mocker.patch.object(sheets, "_find_row_index", return_value=None)
    with pytest.raises(sheets.OrderNotFoundError):
        sheets.update_inventory_count("NOPE", line_count=1)


def test_update_inventory_count_empty_kwargs_noop(mocker):
    ws = _mk_counts_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sheets.update_inventory_count("INV001")
    ws.batch_update.assert_not_called()


# ---------- inventory_count_events (Phase 2, training-feedback-0901) ----------

def test_append_inventory_count_event_writes_correct_row(mocker):
    ws = _mk_count_events_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    event = InventoryCountEvent(
        event_id="ICE001",
        count_id="INV001",
        event_type="count_edited",
        actor="Jan",
        at=datetime(2026, 6, 10, 12, 0, 0),
        details="Souvlaki Kurczak: 5 → 8",
    )
    sheets.append_inventory_count_event(event)

    ws.append_row.assert_called_once()
    written = ws.append_row.call_args[0][0]
    assert len(written) == len(INVENTORY_COUNT_EVENT_HEADERS)
    assert written[INVENTORY_COUNT_EVENT_HEADERS.index("event_id")] == "ICE001"
    assert written[INVENTORY_COUNT_EVENT_HEADERS.index("count_id")] == "INV001"
    assert "2026-06-10T12:00:00" in written[
        INVENTORY_COUNT_EVENT_HEADERS.index("at")
    ]
    assert written[INVENTORY_COUNT_EVENT_HEADERS.index("details")] == (
        "Souvlaki Kurczak: 5 → 8"
    )


def test_append_inventory_count_event_invalidates_cache(mocker):
    ws = _mk_count_events_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sheets._ttl_cache[("TEST_SHEET_ID", "inventory_count_events")] = (0.0, ["stale"])

    sheets.append_inventory_count_event(
        InventoryCountEvent(event_id="ICE1", count_id="INV1", event_type="count_edited")
    )
    assert ("TEST_SHEET_ID", "inventory_count_events") not in sheets._ttl_cache


def test_load_inventory_count_events_for_filters_by_count_id(mocker):
    rows = [
        {h: "" for h in INVENTORY_COUNT_EVENT_HEADERS} | {
            "event_id": "ICE1", "count_id": "INV1", "event_type": "count_edited",
            "actor": "Jan",
        },
        {h: "" for h in INVENTORY_COUNT_EVENT_HEADERS} | {
            "event_id": "ICE2", "count_id": "INV2", "event_type": "count_edited",
            "actor": "Ola",
        },
    ]
    ws = _mk_count_events_ws(rows=rows)
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    events = sheets.load_inventory_count_events_for("INV1")
    assert len(events) == 1
    assert events[0].event_id == "ICE1"
    assert events[0].actor == "Jan"
