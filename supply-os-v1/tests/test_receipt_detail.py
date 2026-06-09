"""Tests for the Captain goods-receipt read endpoints (GR-01, Phase 1).

GET /api/captain/receipts (list) and GET /api/captain/receipt/{id} (detail).
Both are sheet-only: seed mode → [] (list) / 503 (detail); the detail is
location-scoped (404 on a foreign location). The sheet path is exercised by
patching `sheets` as the active backend and stubbing its read functions.
"""
from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from app import seed_loader, sheets
from app.config import DataBackend
from app.main import app
from app.models import Receipt, ReceiptLine

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}


def _fake_receipt(*, receipt_id="RCP-20260605-WOL-abc123", order_id="ORD-1",
                  location_id="WOLA", submitted=None) -> Receipt:
    return Receipt(
        receipt_id=receipt_id,
        order_id=order_id,
        location_id=location_id,
        supplier_id="SUP_BUKAT",
        receipt_date=date(2026, 6, 5),
        received_by="Jan Kowalski",
        received_submitted_at=submitted or datetime(2026, 6, 5, 18, 0, tzinfo=timezone.utc),
        line_count=1,
        discrepancy_count=1,
        received_with_missing_wz=False,
        wz_photo_folder_url="https://drive.google.com/drive/folders/FAKE",
        wz_photo_count=2,
        lines=[
            ReceiptLine(
                receipt_line_id=f"RL-{receipt_id}-001",
                receipt_id=receipt_id,
                order_id=order_id,
                order_line_id="OL-1",
                product_id="P027",
                supplier_product_id="SP-P027",
                ordered_qty_purchase=10,
                received_qty_purchase=8,
                variance_qty_purchase=-2,
            )
        ],
    )


def _sheet_mode(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)


def _patch_detail_reads(mocker):
    _sheet_mode(mocker)
    mocker.patch.object(sheets, "load_products", side_effect=seed_loader.load_products)
    mocker.patch.object(
        sheets, "load_supplier_products", side_effect=seed_loader.load_supplier_products
    )
    mocker.patch.object(sheets, "load_suppliers", side_effect=seed_loader.load_suppliers)
    mocker.patch.object(sheets, "load_locations", side_effect=seed_loader.load_locations)


# ---------- list: seed degradation ----------

def test_receipts_list_seed_empty():
    r = client.get("/api/captain/receipts", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_receipts_list_worksheet_not_found_empty(mocker):
    _sheet_mode(mocker)
    mocker.patch.object(sheets, "load_receipts", side_effect=sheets.WorksheetNotFound)
    r = client.get("/api/captain/receipts", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_receipts_list_filters_and_scopes(mocker):
    _sheet_mode(mocker)
    older = _fake_receipt(receipt_id="RCP-A", order_id="ORD-1",
                          submitted=datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc))
    newer = _fake_receipt(receipt_id="RCP-B", order_id="ORD-2",
                          submitted=datetime(2026, 6, 5, 17, 0, tzinfo=timezone.utc))
    foreign = _fake_receipt(receipt_id="RCP-C", order_id="ORD-3", location_id="KEN")
    mocker.patch.object(sheets, "load_receipts", return_value=[older, newer, foreign])

    # No filter: WOLA-scoped, newest first; KEN receipt excluded.
    r = client.get("/api/captain/receipts", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    ids = [it["receipt_id"] for it in r.json()]
    assert ids == ["RCP-B", "RCP-A"]

    # order_id filter narrows to one.
    r2 = client.get("/api/captain/receipts?order_id=ORD-1", headers=WOLA_AUTH)
    assert [it["receipt_id"] for it in r2.json()] == ["RCP-A"]


# ---------- detail: seed + gates ----------

def test_receipt_detail_seed_503():
    r = client.get("/api/captain/receipt/RCP-x", headers=WOLA_AUTH)
    assert r.status_code == 503, r.text


def test_receipt_detail_happy(mocker):
    _patch_detail_reads(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=_fake_receipt())
    r = client.get("/api/captain/receipt/RCP-20260605-WOL-abc123", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["receipt_id"] == "RCP-20260605-WOL-abc123"
    assert out["location_name"]  # WOLA resolved to a human name
    assert out["received_with_missing_wz"] is False
    assert out["wz_photo_count"] == 2
    assert out["wz_photo_folder_url"].startswith("https://drive.google.com")
    assert len(out["lines"]) == 1
    line = out["lines"][0]
    assert line["product_name_pl"]  # P027 resolved from seed master data
    assert line["ordered_qty_purchase"] == 10
    assert line["received_qty_purchase"] == 8
    assert line["variance_qty_purchase"] == -2


def test_receipt_detail_not_found_404(mocker):
    _patch_detail_reads(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=None)
    r = client.get("/api/captain/receipt/RCP-missing", headers=WOLA_AUTH)
    assert r.status_code == 404, r.text


def test_receipt_detail_wrong_location_404(mocker):
    _patch_detail_reads(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=_fake_receipt(location_id="KEN"))
    r = client.get("/api/captain/receipt/RCP-20260605-WOL-abc123", headers=WOLA_AUTH)
    assert r.status_code == 404, r.text


def test_receipt_detail_worksheet_not_found_503(mocker):
    _sheet_mode(mocker)
    mocker.patch.object(sheets, "get_receipt", side_effect=sheets.WorksheetNotFound)
    r = client.get("/api/captain/receipt/RCP-x", headers=WOLA_AUTH)
    assert r.status_code == 503, r.text
    assert "not configured" in r.json()["detail"]
