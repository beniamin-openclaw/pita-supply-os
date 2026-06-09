"""Tests for the Captain WZ photo-upload endpoint (GR-01, Phase 2).

POST /api/captain/receipt/{id}/photos. Sheet backend + Drive are required; the
Drive adapter (app.drive) is mocked so no network/credentials are needed.
"""
import io
from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from app import drive, sheets
from app.config import DataBackend
from app.main import app
from app.models import Receipt

client = TestClient(app)
WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
RECEIPT_ID = "RCP-20260605-WOL-abc123"


def _fake_receipt(location_id="WOLA", wz_photo_count=0) -> Receipt:
    return Receipt(
        receipt_id=RECEIPT_ID,
        order_id="ORD-1",
        location_id=location_id,
        supplier_id="SUP_BUKAT",
        receipt_date=date(2026, 6, 5),
        received_submitted_at=datetime(2026, 6, 5, 18, 0, tzinfo=timezone.utc),
        line_count=1,
        received_with_missing_wz=True,
        wz_photo_count=wz_photo_count,
    )


def _sheet_and_drive(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(drive, "is_configured", return_value=True)


def _img(name="wz.jpg", content=b"\xff\xd8\xff\xe0jpegbytes", ctype="image/jpeg"):
    return (name, io.BytesIO(content), ctype)


def test_photos_seed_returns_503():
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files={"files": _img()},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 503, r.text
    assert "sheet" in r.json()["detail"].lower()


def test_photos_drive_unconfigured_503(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(drive, "is_configured", return_value=False)
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files={"files": _img()},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 503, r.text
    assert "Drive not configured" in r.json()["detail"]


def test_photos_happy_path(mocker):
    _sheet_and_drive(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=_fake_receipt(wz_photo_count=0))
    folder = mocker.patch.object(
        drive, "ensure_order_folder", return_value=("FOLDER1", "https://drive/FOLDER1")
    )
    up = mocker.patch.object(
        drive,
        "upload_photo",
        side_effect=[("P1", "https://drive/P1"), ("P2", "https://drive/P2")],
    )
    updated = mocker.patch.object(sheets, "update_receipt")

    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files=[("files", _img("a.jpg")), ("files", _img("b.jpg"))],
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["wz_photo_count"] == 2
    assert out["received_with_missing_wz"] is False
    assert out["wz_photo_folder_url"] == "https://drive/FOLDER1"
    assert len(out["uploaded"]) == 2

    folder.assert_called_once_with("ORD-1")
    assert up.call_count == 2
    updated.assert_called_once()
    kwargs = updated.call_args.kwargs
    assert kwargs["received_with_missing_wz"] is False
    assert kwargs["wz_photo_count"] == 2
    assert kwargs["wz_photo_folder_id"] == "FOLDER1"


def test_photos_increments_existing_count(mocker):
    """A second upload batch adds to the receipt's existing photo count."""
    _sheet_and_drive(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=_fake_receipt(wz_photo_count=2))
    mocker.patch.object(drive, "ensure_order_folder", return_value=("F", "u"))
    mocker.patch.object(drive, "upload_photo", return_value=("P3", "https://drive/P3"))
    updated = mocker.patch.object(sheets, "update_receipt")
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files={"files": _img("c.jpg")},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200, r.text
    assert r.json()["wz_photo_count"] == 3
    assert updated.call_args.kwargs["wz_photo_count"] == 3


def test_photos_rejects_non_image(mocker):
    _sheet_and_drive(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=_fake_receipt())
    mocker.patch.object(drive, "ensure_order_folder", return_value=("F", "u"))
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files=[("files", ("notes.txt", io.BytesIO(b"hello"), "text/plain"))],
        headers=WOLA_AUTH,
    )
    assert r.status_code == 400, r.text
    assert "not an image" in r.json()["detail"]


def test_photos_wrong_location_404(mocker):
    _sheet_and_drive(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=_fake_receipt(location_id="KEN"))
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files={"files": _img()},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 404, r.text


def test_photos_receipt_not_found_404(mocker):
    _sheet_and_drive(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=None)
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files={"files": _img()},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 404, r.text


def test_photos_worksheet_not_found_503(mocker):
    _sheet_and_drive(mocker)
    mocker.patch.object(sheets, "get_receipt", side_effect=sheets.WorksheetNotFound)
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files={"files": _img()},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 503, r.text
    assert "not configured" in r.json()["detail"]
