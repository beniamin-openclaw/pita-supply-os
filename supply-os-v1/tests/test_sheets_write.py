"""Unit tests for the Google Sheets write-side adapter (`app.sheets`, Phase C2).

All tests mock gspread at the `_open_worksheet` layer so no real network
calls are made. C1 read-path tests live in test_sheets_read.py and must
remain untouched.
"""
from __future__ import annotations

from datetime import date, datetime
from unittest.mock import MagicMock

import pytest

from app import sheets
from app.models import (
    Order,
    OrderLine,
    OrderStatus,
    ReasonCode,
)


# ---------- Sheet column layouts (must match models.py field order) ----------

ORDER_HEADERS = [
    "order_id",
    "location_id",
    "supplier_id",
    "order_date",
    "requested_delivery_date",
    "status",
    "captain_user",
    "captain_submitted_at",
    "manager_user",
    "manager_sent_at",
    "sent_method",
    "supplier_order_reference",
    "total_value_estimate_pln",
    "notes",
]
ORDER_LINE_HEADERS = [
    "order_line_id",
    "order_id",
    "product_id",
    "supplier_product_id",
    "current_stock_qty_base",
    "target_stock_qty_base",
    "suggested_qty_base",
    "suggested_qty_purchase",
    "captain_final_qty_purchase",
    "captain_final_qty_base",
    "manager_final_qty_purchase",
    "manager_final_qty_base",
    "delta_vs_suggestion_pct",
    "reason_code",
    "captain_comment",
    "manager_comment",
]


# ---------- Fixtures / helpers ----------

def _mk_order(**overrides) -> Order:
    base = dict(
        order_id="O123",
        location_id="WOLA",
        supplier_id="S001",
        order_date=date(2026, 5, 23),
        requested_delivery_date=date(2026, 5, 24),
        status=OrderStatus.DRAFT,
        captain_user=None,
        captain_submitted_at=None,
        manager_user=None,
        manager_sent_at=None,
        sent_method=None,
        supplier_order_reference=None,
        total_value_estimate_pln=None,
        notes="",
    )
    base.update(overrides)
    return Order(**base)


def _mk_order_line(**overrides) -> OrderLine:
    base = dict(
        order_line_id="OL001",
        order_id="O123",
        product_id="P001",
        supplier_product_id="SP001",
        current_stock_qty_base=2.0,
        target_stock_qty_base=6.0,
        suggested_qty_base=4.0,
        suggested_qty_purchase=4.0,
        captain_final_qty_purchase=4.0,
        captain_final_qty_base=4.0,
        manager_final_qty_purchase=4.0,
        manager_final_qty_base=4.0,
        delta_vs_suggestion_pct=None,
        reason_code=None,
        captain_comment="",
        manager_comment="",
    )
    base.update(overrides)
    return OrderLine(**base)


def _mk_orders_ws(rows: list[dict] | None = None) -> MagicMock:
    ws = MagicMock()
    ws.title = "orders"
    ws.row_values.return_value = ORDER_HEADERS
    ws.get_all_records.return_value = rows or []
    # Default: order O123 is in row 2 if we ever scan; tests override as needed.
    ws.find.return_value = None
    return ws


def _mk_order_lines_ws(rows: list[dict] | None = None) -> MagicMock:
    ws = MagicMock()
    ws.title = "order_lines"
    ws.row_values.return_value = ORDER_LINE_HEADERS
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


# ---------- append_order ----------

def test_append_order_writes_correct_row(mocker):
    ws = _mk_orders_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    order = _mk_order(
        status=OrderStatus.DRAFT,
        captain_user="ben",
        total_value_estimate_pln=123.45,
        notes="first order",
    )
    sheets.append_order(order)

    ws.append_row.assert_called_once()
    written_row = ws.append_row.call_args[0][0]
    # Row layout matches ORDER_HEADERS.
    assert len(written_row) == len(ORDER_HEADERS)
    # order_id at position 0, status at index of 'status'
    assert written_row[ORDER_HEADERS.index("order_id")] == "O123"
    # Enum unwrapped to .value ("draft", not "OrderStatus.DRAFT")
    assert written_row[ORDER_HEADERS.index("status")] == "draft"
    # date -> ISO
    assert written_row[ORDER_HEADERS.index("order_date")] == "2026-05-23"
    assert written_row[ORDER_HEADERS.index("requested_delivery_date")] == "2026-05-24"
    # None -> ""
    assert written_row[ORDER_HEADERS.index("manager_user")] == ""
    # float -> str
    assert written_row[ORDER_HEADERS.index("total_value_estimate_pln")] == "123.45"
    assert written_row[ORDER_HEADERS.index("captain_user")] == "ben"


def test_append_order_invalidates_orders_cache(mocker):
    ws = _mk_orders_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    # Pre-populate cache for 'orders'
    sheets._ttl_cache[("TEST_SHEET_ID", "orders")] = (0.0, ["stale"])
    assert ("TEST_SHEET_ID", "orders") in sheets._ttl_cache

    sheets.append_order(_mk_order())

    assert ("TEST_SHEET_ID", "orders") not in sheets._ttl_cache


# ---------- append_order_lines ----------

def test_append_order_lines_batches_in_one_call(mocker):
    ws = _mk_order_lines_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    lines = [
        _mk_order_line(order_line_id="OL001"),
        _mk_order_line(order_line_id="OL002"),
        _mk_order_line(order_line_id="OL003"),
    ]
    sheets.append_order_lines(lines)

    ws.append_rows.assert_called_once()
    rows_arg = ws.append_rows.call_args[0][0]
    assert len(rows_arg) == 3
    # Every row laid out per ORDER_LINE_HEADERS
    for row in rows_arg:
        assert len(row) == len(ORDER_LINE_HEADERS)
    # order_line_id column matches input order
    line_id_col = ORDER_LINE_HEADERS.index("order_line_id")
    assert [r[line_id_col] for r in rows_arg] == ["OL001", "OL002", "OL003"]


def test_append_order_lines_rejects_mixed_order_ids(mocker):
    ws = _mk_order_lines_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    lines = [
        _mk_order_line(order_line_id="OL001", order_id="O123"),
        _mk_order_line(order_line_id="OL002", order_id="O999"),
    ]
    with pytest.raises(ValueError) as exc:
        sheets.append_order_lines(lines)
    assert "order_id" in str(exc.value).lower()
    ws.append_rows.assert_not_called()


def test_append_order_lines_empty_is_noop(mocker):
    ws = _mk_order_lines_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sheets.append_order_lines([])
    ws.append_rows.assert_not_called()


def test_append_order_lines_invalidates_cache(mocker):
    ws = _mk_order_lines_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sheets._ttl_cache[("TEST_SHEET_ID", "order_lines")] = (0.0, ["stale"])
    sheets.append_order_lines([_mk_order_line()])
    assert ("TEST_SHEET_ID", "order_lines") not in sheets._ttl_cache


# ---------- update_order ----------

def test_update_order_found_updates_only_specified_fields(mocker):
    ws = _mk_orders_ws()
    # Order O123 lives at row 2; col_values used by manual fallback.
    ws.col_values.return_value = ["order_id", "O123", "O999"]
    # Make find succeed at row 2.
    found_cell = MagicMock()
    found_cell.row = 2
    ws.find.return_value = found_cell
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    sheets.update_order("O123", status="manager_sent", manager_user="ben")

    ws.batch_update.assert_called_once()
    updates = ws.batch_update.call_args[0][0]
    # Only 2 cells, not 14.
    assert len(updates) == 2
    ranges = {u["range"] for u in updates}
    values = {u["range"]: u["values"][0][0] for u in updates}
    # column F = status (6); just sanity check both ranges are on row 2.
    for rng in ranges:
        assert rng.endswith("2"), f"expected row 2 in {rng}"
    # Find cells by checking values
    assert "manager_sent" in values.values()
    assert "ben" in values.values()


def test_update_order_not_found_raises_OrderNotFoundError(mocker):
    ws = _mk_orders_ws()
    ws.find.return_value = None
    ws.col_values.return_value = ["order_id", "O999"]  # only O999 present
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    with pytest.raises(sheets.OrderNotFoundError) as exc:
        sheets.update_order("O123", status="manager_sent")
    assert "O123" in str(exc.value)
    ws.batch_update.assert_not_called()


def test_update_order_concurrent_dispatch_raises(mocker):
    # Row 2 is O123 in 'orders'; its current status is 'manager_sent'.
    ws = _mk_orders_ws(rows=[
        {
            "order_id": "O123",
            "location_id": "WOLA",
            "supplier_id": "S001",
            "order_date": "2026-05-23",
            "requested_delivery_date": "2026-05-24",
            "status": "manager_sent",
            "captain_user": "ben",
            "captain_submitted_at": "",
            "manager_user": "ben",
            "manager_sent_at": "",
            "sent_method": "email",
            "supplier_order_reference": "",
            "total_value_estimate_pln": "",
            "notes": "",
        }
    ])
    found_cell = MagicMock()
    found_cell.row = 2
    ws.find.return_value = found_cell
    ws.col_values.return_value = ["order_id", "O123"]
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    with pytest.raises(sheets.OrderAlreadyDispatchedError):
        sheets.update_order("O123", status="manager_sent")
    ws.batch_update.assert_not_called()


def test_update_order_invalidates_cache(mocker):
    ws = _mk_orders_ws()
    found_cell = MagicMock()
    found_cell.row = 2
    ws.find.return_value = found_cell
    ws.col_values.return_value = ["order_id", "O123"]
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    sheets._ttl_cache[("TEST_SHEET_ID", "orders")] = (0.0, ["stale"])
    sheets.update_order("O123", captain_user="ben")
    assert ("TEST_SHEET_ID", "orders") not in sheets._ttl_cache


# ---------- update_order_lines ----------

def test_update_order_lines_batch_update_called_once(mocker):
    ws = _mk_order_lines_ws()
    # Simulate: row 2 = OL001/O123, row 3 = OL002/O123, row 4 = OL003/O999.
    def col_values(col_idx):
        if col_idx == ORDER_LINE_HEADERS.index("order_id") + 1:
            return ["order_id", "O123", "O123", "O999"]
        if col_idx == ORDER_LINE_HEADERS.index("order_line_id") + 1:
            return ["order_line_id", "OL001", "OL002", "OL003"]
        return []
    ws.col_values.side_effect = col_values
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    line_updates = {
        "OL001": {
            "manager_final_qty_purchase": 5.0,
            "manager_final_qty_base": 5.0,
            "manager_comment": "ok",
        },
        "OL002": {
            "manager_final_qty_purchase": 3.0,
            "manager_final_qty_base": 3.0,
            "manager_comment": "less",
        },
    }
    sheets.update_order_lines("O123", line_updates)

    ws.batch_update.assert_called_once()
    updates = ws.batch_update.call_args[0][0]
    # 2 lines × 3 fields = 6 cell updates.
    assert len(updates) == 6
    ranges = [u["range"] for u in updates]
    # Two distinct rows (2 and 3), neither row 4.
    row_suffixes = {"".join(c for c in r if c.isdigit()) for r in ranges}
    assert row_suffixes == {"2", "3"}


def test_update_order_lines_not_found_raises(mocker):
    ws = _mk_order_lines_ws()
    def col_values(col_idx):
        if col_idx == ORDER_LINE_HEADERS.index("order_id") + 1:
            return ["order_id", "O999"]
        if col_idx == ORDER_LINE_HEADERS.index("order_line_id") + 1:
            return ["order_line_id", "OLZ"]
        return []
    ws.col_values.side_effect = col_values
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    with pytest.raises(sheets.OrderNotFoundError):
        sheets.update_order_lines("O123", {"OL001": {"manager_comment": "x"}})
    ws.batch_update.assert_not_called()


def test_update_order_lines_invalidates_cache(mocker):
    ws = _mk_order_lines_ws()
    def col_values(col_idx):
        if col_idx == ORDER_LINE_HEADERS.index("order_id") + 1:
            return ["order_id", "O123"]
        if col_idx == ORDER_LINE_HEADERS.index("order_line_id") + 1:
            return ["order_line_id", "OL001"]
        return []
    ws.col_values.side_effect = col_values
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    sheets._ttl_cache[("TEST_SHEET_ID", "order_lines")] = (0.0, ["stale"])
    sheets.update_order_lines("O123", {"OL001": {"manager_comment": "hi"}})
    assert ("TEST_SHEET_ID", "order_lines") not in sheets._ttl_cache


# ---------- get_order ----------

def test_get_order_returns_order_with_lines(mocker):
    orders_ws = _mk_orders_ws(rows=[
        {
            "order_id": "O123",
            "location_id": "WOLA",
            "supplier_id": "S001",
            "order_date": "2026-05-23",
            "requested_delivery_date": "2026-05-24",
            "status": "draft",
            "captain_user": "ben",
            "captain_submitted_at": "",
            "manager_user": "",
            "manager_sent_at": "",
            "sent_method": "",
            "supplier_order_reference": "",
            "total_value_estimate_pln": "",
            "notes": "",
        },
    ])
    lines_ws = _mk_order_lines_ws(rows=[
        {h: "" for h in ORDER_LINE_HEADERS} | {
            "order_line_id": f"OL00{i}",
            "order_id": "O123",
            "product_id": "P001",
            "supplier_product_id": "SP001",
            "current_stock_qty_base": 2.0,
            "target_stock_qty_base": 6.0,
            "suggested_qty_base": 4.0,
            "suggested_qty_purchase": 4.0,
            "captain_final_qty_purchase": 4.0,
            "captain_final_qty_base": 4.0,
            "manager_final_qty_purchase": 4.0,
            "manager_final_qty_base": 4.0,
        }
        for i in range(1, 4)
    ])

    def open_ws(name):
        return {"orders": orders_ws, "order_lines": lines_ws}[name]

    mocker.patch.object(sheets, "_open_worksheet", side_effect=open_ws)

    order = sheets.get_order("O123")
    assert order is not None
    assert order.order_id == "O123"
    assert order.status == OrderStatus.DRAFT
    assert len(order.lines) == 3
    assert {ln.order_line_id for ln in order.lines} == {"OL001", "OL002", "OL003"}


def test_get_order_returns_none_when_missing(mocker):
    orders_ws = _mk_orders_ws(rows=[])
    lines_ws = _mk_order_lines_ws(rows=[])
    mocker.patch.object(
        sheets,
        "_open_worksheet",
        side_effect=lambda name: {"orders": orders_ws, "order_lines": lines_ws}[name],
    )
    assert sheets.get_order("DOES_NOT_EXIST") is None


# ---------- _model_to_row ----------

def test_model_to_row_handles_none_to_empty_string():
    order = _mk_order(captain_user=None, manager_user=None)
    row = sheets._model_to_row(order, ORDER_HEADERS)
    assert row[ORDER_HEADERS.index("captain_user")] == ""
    assert row[ORDER_HEADERS.index("manager_user")] == ""


def test_model_to_row_unwraps_enum_to_value():
    line = _mk_order_line(reason_code=ReasonCode.LOW_STORAGE)
    row = sheets._model_to_row(line, ORDER_LINE_HEADERS)
    assert row[ORDER_LINE_HEADERS.index("reason_code")] == "LOW_STORAGE"

    order = _mk_order(status=OrderStatus.CAPTAIN_SUBMITTED)
    row = sheets._model_to_row(order, ORDER_HEADERS)
    assert row[ORDER_HEADERS.index("status")] == "captain_submitted"


def test_model_to_row_bool_to_uppercase_string():
    # Use _cell_value directly since neither Order nor OrderLine has a bool field.
    assert sheets._cell_value(True) == "TRUE"
    assert sheets._cell_value(False) == "FALSE"


def test_model_to_row_date_to_isoformat():
    order = _mk_order(order_date=date(2026, 1, 15))
    row = sheets._model_to_row(order, ORDER_HEADERS)
    assert row[ORDER_HEADERS.index("order_date")] == "2026-01-15"


def test_model_to_row_datetime_to_isoformat():
    order = _mk_order(captain_submitted_at=datetime(2026, 5, 23, 14, 30, 0))
    row = sheets._model_to_row(order, ORDER_HEADERS)
    assert "2026-05-23T14:30:00" in row[ORDER_HEADERS.index("captain_submitted_at")]


def test_model_to_row_column_order_respected():
    shuffled = [
        "notes",
        "order_id",
        "status",
        "supplier_id",
        "location_id",
        "order_date",
    ]
    order = _mk_order(notes="hello")
    row = sheets._model_to_row(order, shuffled)
    assert row == [
        "hello",  # notes
        "O123",   # order_id
        "draft",  # status (enum unwrapped)
        "S001",   # supplier_id
        "WOLA",   # location_id
        "2026-05-23",  # order_date
    ]


def test_model_to_row_unknown_column_is_blank():
    order = _mk_order()
    row = sheets._model_to_row(order, ["order_id", "operator_scratch"])
    assert row == ["O123", ""]


# ---------- _get_column_order cache ----------

def test_column_order_cache_hit(mocker):
    ws = _mk_orders_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    sheets.append_order(_mk_order(order_id="O1"))
    sheets.append_order(_mk_order(order_id="O2"))

    # row_values used only to fetch the header row — should be cached after 1 call.
    assert ws.row_values.call_count == 1
    assert ws.append_row.call_count == 2


# ---------- load_orders / load_order_lines (added in C2 for write closure) ----------

def test_load_orders_happy_path(mocker):
    ws = _mk_orders_ws(rows=[
        {
            "order_id": "O1",
            "location_id": "WOLA",
            "supplier_id": "S001",
            "order_date": "2026-05-23",
            "requested_delivery_date": "2026-05-24",
            "status": "draft",
            "captain_user": "",
            "captain_submitted_at": "",
            "manager_user": "",
            "manager_sent_at": "",
            "sent_method": "",
            "supplier_order_reference": "",
            "total_value_estimate_pln": "",
            "notes": "",
        }
    ])
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    orders = sheets.load_orders()
    assert len(orders) == 1
    assert orders[0].order_id == "O1"
    assert orders[0].status == OrderStatus.DRAFT


def test_load_order_lines_happy_path(mocker):
    row = {h: "" for h in ORDER_LINE_HEADERS} | {
        "order_line_id": "OL1",
        "order_id": "O1",
        "product_id": "P001",
        "supplier_product_id": "SP001",
        "current_stock_qty_base": 2,
        "target_stock_qty_base": 6,
        "suggested_qty_base": 4,
        "suggested_qty_purchase": 4,
        "captain_final_qty_purchase": 4,
        "captain_final_qty_base": 4,
        "manager_final_qty_purchase": 4,
        "manager_final_qty_base": 4,
    }
    ws = _mk_order_lines_ws(rows=[row])
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    lines = sheets.load_order_lines()
    assert len(lines) == 1
    assert lines[0].order_line_id == "OL1"
    assert lines[0].order_id == "O1"
