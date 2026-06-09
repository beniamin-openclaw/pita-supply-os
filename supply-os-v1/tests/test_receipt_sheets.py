"""Unit tests for the goods-receipt Sheets adapter (`app.sheets`, GR-01).

Mirrors test_inventory_sheets.py: gspread is mocked at the `_open_worksheet`
layer, so no real network calls are made. Receipts are append-only; the only
mutation is `update_receipt` attaching WZ photo refs.
"""
from __future__ import annotations

from datetime import date, datetime
from unittest.mock import MagicMock

import pytest

from app import sheets
from app.models import Receipt, ReceiptLine


# ---------- Sheet column layouts (must cover every required model field) ----------

RECEIPT_HEADERS = [
    "receipt_id",
    "order_id",
    "location_id",
    "supplier_id",
    "receipt_date",
    "received_by",
    "received_submitted_at",
    "line_count",
    "discrepancy_count",
    "received_with_missing_wz",
    "wz_photo_folder_id",
    "wz_photo_folder_url",
    "wz_photo_count",
    "notes",
]
RECEIPT_LINE_HEADERS = [
    "receipt_line_id",
    "receipt_id",
    "order_id",
    "order_line_id",
    "product_id",
    "supplier_product_id",
    "ordered_qty_purchase",
    "received_qty_purchase",
    "variance_qty_purchase",
    "receipt_comment",
]


# ---------- Fixtures / helpers ----------

def _mk_receipt(**overrides) -> Receipt:
    base = dict(
        receipt_id="RCP001",
        order_id="ORD001",
        location_id="WOLA",
        supplier_id="SUP_BUKAT",
        receipt_date=date(2026, 6, 5),
        received_by="Jan",
        received_submitted_at=None,
        line_count=0,
        discrepancy_count=0,
        received_with_missing_wz=True,
        notes="",
    )
    base.update(overrides)
    return Receipt(**base)


def _mk_receipt_line(**overrides) -> ReceiptLine:
    base = dict(
        receipt_line_id="RL001",
        receipt_id="RCP001",
        order_id="ORD001",
        order_line_id="OL-1",
        product_id="P001",
        supplier_product_id="SP-P001",
        ordered_qty_purchase=10.0,
        received_qty_purchase=9.0,
        variance_qty_purchase=-1.0,
        receipt_comment="",
    )
    base.update(overrides)
    return ReceiptLine(**base)


def _mk_receipts_ws(rows: list[dict] | None = None) -> MagicMock:
    ws = MagicMock()
    ws.title = "receipts"
    ws.row_values.return_value = RECEIPT_HEADERS
    ws.get_all_records.return_value = rows or []
    ws.find.return_value = None
    return ws


def _mk_receipt_lines_ws(rows: list[dict] | None = None) -> MagicMock:
    ws = MagicMock()
    ws.title = "receipt_lines"
    ws.row_values.return_value = RECEIPT_LINE_HEADERS
    ws.get_all_records.return_value = rows or []
    ws.find.return_value = None
    return ws


@pytest.fixture(autouse=True)
def _reset_module_state(mocker):
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


# ---------- append_receipt ----------

def test_append_receipt_writes_correct_row(mocker):
    ws = _mk_receipts_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    receipt = _mk_receipt(
        received_submitted_at=datetime(2026, 6, 5, 18, 30, 0),
        line_count=2,
        discrepancy_count=1,
        received_with_missing_wz=False,
        wz_photo_count=2,
    )
    sheets.append_receipt(receipt)

    ws.append_row.assert_called_once()
    written = ws.append_row.call_args[0][0]
    assert len(written) == len(RECEIPT_HEADERS)
    assert written[RECEIPT_HEADERS.index("receipt_id")] == "RCP001"
    assert written[RECEIPT_HEADERS.index("supplier_id")] == "SUP_BUKAT"
    assert written[RECEIPT_HEADERS.index("receipt_date")] == "2026-06-05"
    assert "2026-06-05T18:30:00" in written[RECEIPT_HEADERS.index("received_submitted_at")]
    assert written[RECEIPT_HEADERS.index("line_count")] == "2"
    # bool -> TRUE/FALSE
    assert written[RECEIPT_HEADERS.index("received_with_missing_wz")] == "FALSE"


def test_append_receipt_invalidates_cache(mocker):
    ws = _mk_receipts_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sheets._ttl_cache[("TEST_SHEET_ID", "receipts")] = (0.0, ["stale"])
    sheets.append_receipt(_mk_receipt())
    assert ("TEST_SHEET_ID", "receipts") not in sheets._ttl_cache


# ---------- append_receipt_lines ----------

def test_append_receipt_lines_batches_in_one_call(mocker):
    ws = _mk_receipt_lines_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    lines = [
        _mk_receipt_line(receipt_line_id="RL001"),
        _mk_receipt_line(receipt_line_id="RL002"),
    ]
    sheets.append_receipt_lines(lines)
    ws.append_rows.assert_called_once()
    rows_arg = ws.append_rows.call_args[0][0]
    assert len(rows_arg) == 2
    for row in rows_arg:
        assert len(row) == len(RECEIPT_LINE_HEADERS)


def test_append_receipt_lines_rejects_mixed_receipt_ids(mocker):
    ws = _mk_receipt_lines_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    lines = [
        _mk_receipt_line(receipt_line_id="RL001", receipt_id="RCP001"),
        _mk_receipt_line(receipt_line_id="RL002", receipt_id="RCP999"),
    ]
    with pytest.raises(ValueError) as exc:
        sheets.append_receipt_lines(lines)
    assert "receipt_id" in str(exc.value).lower()
    ws.append_rows.assert_not_called()


def test_append_receipt_lines_empty_is_noop(mocker):
    ws = _mk_receipt_lines_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sheets.append_receipt_lines([])
    ws.append_rows.assert_not_called()


# ---------- get_receipt ----------

def test_get_receipt_returns_receipt_with_lines(mocker):
    receipts_ws = _mk_receipts_ws(rows=[
        {h: "" for h in RECEIPT_HEADERS} | {
            "receipt_id": "RCP001",
            "order_id": "ORD001",
            "location_id": "WOLA",
            "supplier_id": "SUP_BUKAT",
            "receipt_date": "2026-06-05",
            "line_count": 2,
        },
    ])
    lines_ws = _mk_receipt_lines_ws(rows=[
        {h: "" for h in RECEIPT_LINE_HEADERS} | {
            "receipt_line_id": f"RL00{i}",
            "receipt_id": "RCP001",
            "order_id": "ORD001",
            "order_line_id": f"OL-{i}",
            "product_id": "P001",
            "supplier_product_id": "SP-P001",
            "ordered_qty_purchase": 10,
            "received_qty_purchase": 9,
            "variance_qty_purchase": -1,
        }
        for i in range(1, 3)
    ])

    mocker.patch.object(
        sheets,
        "_open_worksheet",
        side_effect=lambda name: {"receipts": receipts_ws, "receipt_lines": lines_ws}[name],
    )

    receipt = sheets.get_receipt("RCP001")
    assert receipt is not None
    assert receipt.receipt_id == "RCP001"
    assert receipt.location_id == "WOLA"
    assert len(receipt.lines) == 2
    assert {ln.receipt_line_id for ln in receipt.lines} == {"RL001", "RL002"}


def test_get_receipt_returns_none_when_missing(mocker):
    receipts_ws = _mk_receipts_ws(rows=[])
    lines_ws = _mk_receipt_lines_ws(rows=[])
    mocker.patch.object(
        sheets,
        "_open_worksheet",
        side_effect=lambda name: {"receipts": receipts_ws, "receipt_lines": lines_ws}[name],
    )
    assert sheets.get_receipt("NOPE") is None


# ---------- load_receipts / load_receipt_lines ----------

def test_load_receipts_happy_path(mocker):
    ws = _mk_receipts_ws(rows=[
        {h: "" for h in RECEIPT_HEADERS} | {
            "receipt_id": "RCP1",
            "order_id": "ORD1",
            "location_id": "WOLA",
            "supplier_id": "SUP_BUKAT",
            "receipt_date": "2026-06-05",
        }
    ])
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    receipts = sheets.load_receipts()
    assert len(receipts) == 1
    assert receipts[0].receipt_id == "RCP1"
    assert receipts[0].receipt_date == date(2026, 6, 5)


def test_load_receipt_lines_happy_path(mocker):
    row = {h: "" for h in RECEIPT_LINE_HEADERS} | {
        "receipt_line_id": "RL1",
        "receipt_id": "RCP1",
        "order_id": "ORD1",
        "order_line_id": "OL-1",
        "product_id": "P001",
        "supplier_product_id": "SP-P001",
        "ordered_qty_purchase": 10,
        "received_qty_purchase": 8,
        "variance_qty_purchase": -2,
    }
    ws = _mk_receipt_lines_ws(rows=[row])
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    lines = sheets.load_receipt_lines()
    assert len(lines) == 1
    assert lines[0].receipt_line_id == "RL1"
    assert lines[0].variance_qty_purchase == -2


# ---------- update_receipt ----------

def test_update_receipt_writes_changed_cells(mocker):
    ws = _mk_receipts_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    mocker.patch.object(sheets, "_find_row_index", return_value=2)

    sheets.update_receipt(
        "RCP001",
        wz_photo_folder_id="FOLDER1",
        wz_photo_folder_url="https://drive/FOLDER1",
        wz_photo_count=3,
        received_with_missing_wz=False,
    )
    ws.batch_update.assert_called_once()
    updates = ws.batch_update.call_args[0][0]
    written_values = [u["values"][0][0] for u in updates]
    assert "FOLDER1" in written_values
    assert "3" in written_values
    assert "FALSE" in written_values  # bool serialized


def test_update_receipt_missing_raises(mocker):
    ws = _mk_receipts_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    mocker.patch.object(sheets, "_find_row_index", return_value=None)
    with pytest.raises(sheets.OrderNotFoundError):
        sheets.update_receipt("NOPE", wz_photo_count=1)


def test_update_receipt_empty_kwargs_noop(mocker):
    ws = _mk_receipts_ws()
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sheets.update_receipt("RCP001")
    ws.batch_update.assert_not_called()
