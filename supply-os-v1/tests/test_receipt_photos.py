"""Tests for the Captain WZ photo endpoints (GR-01).

POST /api/captain/receipt/{id}/photos  — upload to Supabase Storage
GET  /api/captain/receipt/{id}/photos  — list short-lived signed URLs

Sheet backend + Supabase Storage are required; the storage adapter
(app.supabase_storage) is mocked so no network/credentials are needed.
"""
import io
from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from app import sheets
from app import supabase_storage as ss
from app.config import DataBackend
from app.main import app
from app.models import Receipt

client = TestClient(app)
WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
RECEIPT_ID = "RCP-20260605-WOL-abc123"


def _fake_receipt(location_id="WOLA", wz_photo_count=0, prefix=None) -> Receipt:
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
        wz_photo_path_prefix=prefix,
    )


def _sheet_and_storage(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(ss, "is_configured", return_value=True)


def _img(name="wz.jpg", content=b"\xff\xd8\xff\xe0jpegbytes", ctype="image/jpeg"):
    return (name, io.BytesIO(content), ctype)


# ---------- POST: gates ----------

def test_photos_seed_returns_503():
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files={"files": _img()},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 503, r.text
    assert "sheet" in r.json()["detail"].lower()


def test_photos_storage_unconfigured_503(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(ss, "is_configured", return_value=False)
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files={"files": _img()},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 503, r.text
    assert "Supabase" in r.json()["detail"]


# ---------- POST: happy paths ----------

def test_photos_happy_path(mocker):
    _sheet_and_storage(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=_fake_receipt(wz_photo_count=0))
    up = mocker.patch.object(ss, "upload_photo")
    mocker.patch.object(
        ss, "create_signed_url", side_effect=["https://s/1", "https://s/2"]
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
    assert "wz_photo_folder_url" not in out  # Drive field is gone
    assert len(out["uploaded"]) == 2
    assert out["uploaded"][0]["name"] == f"{RECEIPT_ID}-01.jpg"
    assert out["uploaded"][0]["signed_url"] == "https://s/1"

    # Uploaded under the per-order prefix wz/<order_id>/<name>.
    assert up.call_count == 2
    first_path = up.call_args_list[0].args[0]
    assert first_path == f"wz/ORD-1/{RECEIPT_ID}-01.jpg"

    updated.assert_called_once()
    kwargs = updated.call_args.kwargs
    assert kwargs["received_with_missing_wz"] is False
    assert kwargs["wz_photo_count"] == 2
    assert kwargs["wz_photo_path_prefix"] == "wz/ORD-1"
    assert "wz_photo_folder_id" not in kwargs  # never persists a Drive folder id


def test_photos_increments_existing_count(mocker):
    """A second upload batch adds to the receipt's existing photo count."""
    _sheet_and_storage(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=_fake_receipt(wz_photo_count=2))
    mocker.patch.object(ss, "upload_photo")
    mocker.patch.object(ss, "create_signed_url", return_value="https://s/3")
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
    _sheet_and_storage(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=_fake_receipt())
    mocker.patch.object(ss, "upload_photo")
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files=[("files", ("notes.txt", io.BytesIO(b"hello"), "text/plain"))],
        headers=WOLA_AUTH,
    )
    assert r.status_code == 400, r.text
    assert "not an image" in r.json()["detail"]


def test_photos_wrong_location_404(mocker):
    _sheet_and_storage(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=_fake_receipt(location_id="KEN"))
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files={"files": _img()},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 404, r.text


def test_photos_receipt_not_found_404(mocker):
    _sheet_and_storage(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=None)
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files={"files": _img()},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 404, r.text


def test_photos_worksheet_not_found_503(mocker):
    _sheet_and_storage(mocker)
    mocker.patch.object(sheets, "get_receipt", side_effect=sheets.WorksheetNotFound)
    r = client.post(
        f"/api/captain/receipt/{RECEIPT_ID}/photos",
        files={"files": _img()},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 503, r.text
    assert "not configured" in r.json()["detail"]


# ---------- GET: signed-URL viewing ----------

def test_photo_urls_seed_503():
    r = client.get(f"/api/captain/receipt/{RECEIPT_ID}/photos", headers=WOLA_AUTH)
    assert r.status_code == 503, r.text


def test_photo_urls_storage_unconfigured_503(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(ss, "is_configured", return_value=False)
    r = client.get(f"/api/captain/receipt/{RECEIPT_ID}/photos", headers=WOLA_AUTH)
    assert r.status_code == 503, r.text
    assert "Supabase" in r.json()["detail"]


def test_photo_urls_happy(mocker):
    _sheet_and_storage(mocker)
    mocker.patch.object(
        sheets, "get_receipt", return_value=_fake_receipt(wz_photo_count=2, prefix="wz/ORD-1")
    )
    mocker.patch.object(
        ss,
        "list_photos",
        return_value=[f"wz/ORD-1/{RECEIPT_ID}-01.jpg", f"wz/ORD-1/{RECEIPT_ID}-02.jpg"],
    )
    signed = mocker.patch.object(
        ss, "create_signed_url", side_effect=["https://s/1", "https://s/2"]
    )
    r = client.get(f"/api/captain/receipt/{RECEIPT_ID}/photos", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert [it["name"] for it in out] == [f"{RECEIPT_ID}-01.jpg", f"{RECEIPT_ID}-02.jpg"]
    assert [it["signed_url"] for it in out] == ["https://s/1", "https://s/2"]
    assert signed.call_count == 2


def test_photo_urls_empty_when_no_photos(mocker):
    _sheet_and_storage(mocker)
    mocker.patch.object(
        sheets, "get_receipt", return_value=_fake_receipt(prefix="wz/ORD-1")
    )
    mocker.patch.object(ss, "list_photos", return_value=[])
    r = client.get(f"/api/captain/receipt/{RECEIPT_ID}/photos", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_photo_urls_wrong_location_404(mocker):
    _sheet_and_storage(mocker)
    mocker.patch.object(sheets, "get_receipt", return_value=_fake_receipt(location_id="KEN"))
    r = client.get(f"/api/captain/receipt/{RECEIPT_ID}/photos", headers=WOLA_AUTH)
    assert r.status_code == 404, r.text
