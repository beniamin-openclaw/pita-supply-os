"""Unit tests for the Google Drive WZ-photo adapter (app.drive, GR-01 Phase 2).

The Drive v3 service is mocked at app.drive._drive_service, so no network and no
google-api-python-client install is required. upload_photo's lazy
`from googleapiclient.http import MediaIoBaseUpload` is satisfied by injecting a
stub module into sys.modules.
"""
from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock

from app import drive


def _mk_service(list_files=None, created=None) -> MagicMock:
    svc = MagicMock()
    svc.files.return_value.list.return_value.execute.return_value = {
        "files": list_files or []
    }
    svc.files.return_value.create.return_value.execute.return_value = (
        created or {"id": "NEW", "webViewLink": "https://drive/NEW"}
    )
    return svc


def test_is_configured_false_without_folder(mocker):
    mocker.patch.object(drive.settings, "gdrive_wz_folder_id", "")
    assert drive.is_configured() is False


def test_is_configured_true_with_folder_and_creds(mocker):
    mocker.patch.object(drive.settings, "gdrive_wz_folder_id", "PARENT")
    mocker.patch.object(drive.settings, "google_service_account_json_file", "/x/sa.json")
    assert drive.is_configured() is True


def test_ensure_order_folder_reuses_existing(mocker):
    svc = _mk_service(list_files=[{"id": "F1", "webViewLink": "https://drive/F1"}])
    mocker.patch.object(drive, "_drive_service", return_value=svc)
    mocker.patch.object(drive.settings, "gdrive_wz_folder_id", "PARENT")
    fid, url = drive.ensure_order_folder("ORD-1")
    assert fid == "F1"
    assert url == "https://drive/F1"
    svc.files.return_value.create.assert_not_called()


def test_ensure_order_folder_creates_when_absent(mocker):
    svc = _mk_service(
        list_files=[], created={"id": "NEW", "webViewLink": "https://drive/NEW"}
    )
    mocker.patch.object(drive, "_drive_service", return_value=svc)
    mocker.patch.object(drive.settings, "gdrive_wz_folder_id", "PARENT")
    fid, url = drive.ensure_order_folder("ORD-1")
    assert fid == "NEW"
    assert url == "https://drive/NEW"
    svc.files.return_value.create.assert_called_once()


def test_upload_photo_returns_file_ref(mocker):
    svc = _mk_service(created={"id": "P1", "webViewLink": "https://drive/P1"})
    mocker.patch.object(drive, "_drive_service", return_value=svc)
    # Stub the lazily-imported MediaIoBaseUpload (google-api-python-client is not
    # installed in the test env).
    fake_http = types.ModuleType("googleapiclient.http")
    fake_http.MediaIoBaseUpload = lambda *a, **k: MagicMock()
    fake_pkg = types.ModuleType("googleapiclient")
    fake_pkg.http = fake_http
    mocker.patch.dict(
        sys.modules,
        {"googleapiclient": fake_pkg, "googleapiclient.http": fake_http},
    )
    fid, url = drive.upload_photo("F1", "wz.jpg", b"bytes", "image/jpeg")
    assert fid == "P1"
    assert url == "https://drive/P1"
