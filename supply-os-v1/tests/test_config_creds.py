"""Unit tests for the shared service-account credential resolver (`app.config`).

Guards the F1 regression caught in plan-review: base64-only credentials must
satisfy BOTH the Sheets backend gate and the Drive (GR-01) gate, and the
resolver must honor the file -> base64 -> inline preference order. Before the
resolver was centralized, drive.py duplicated sheets.py's loader and neither knew
about the base64 source — so a Railway (b64-only) deploy would silently fall back
to seed and disable WZ photo upload.
"""
from __future__ import annotations

import base64
import json

import pytest
from pydantic import SecretStr

from app import config, drive, sheets

_FAKE_SA = {
    "type": "service_account",
    "project_id": "pita-test",
    "private_key_id": "abc123",
    "private_key": "-----BEGIN PRIVATE KEY-----\nFAKEKEY\n-----END PRIVATE KEY-----\n",
    "client_email": "sa@pita-test.iam.gserviceaccount.com",
    "token_uri": "https://oauth2.googleapis.com/token",
}


def _b64(d: dict) -> str:
    return base64.b64encode(json.dumps(d).encode("utf-8")).decode("ascii")


@pytest.fixture
def _clear_creds(mocker):
    """Blank every credential source so each test sets exactly what it needs."""
    mocker.patch.object(config.settings, "google_service_account_json_file", "")
    mocker.patch.object(
        config.settings, "google_service_account_json_b64", SecretStr("")
    )
    mocker.patch.object(config.settings, "google_service_account_json", SecretStr(""))
    yield


# ---------- resolve_service_account_info ----------

def test_resolve_from_base64_round_trips(_clear_creds, mocker):
    mocker.patch.object(
        config.settings, "google_service_account_json_b64", SecretStr(_b64(_FAKE_SA))
    )
    assert config.resolve_service_account_info() == _FAKE_SA


def test_resolve_prefers_file_then_b64_then_inline(_clear_creds, mocker, tmp_path):
    file_sa = {**_FAKE_SA, "project_id": "from-file"}
    b64_sa = {**_FAKE_SA, "project_id": "from-b64"}
    inline_sa = {**_FAKE_SA, "project_id": "from-inline"}
    p = tmp_path / "sa.json"
    p.write_text(json.dumps(file_sa), encoding="utf-8")

    # All three set -> file wins.
    mocker.patch.object(config.settings, "google_service_account_json_file", str(p))
    mocker.patch.object(
        config.settings, "google_service_account_json_b64", SecretStr(_b64(b64_sa))
    )
    mocker.patch.object(
        config.settings,
        "google_service_account_json",
        SecretStr(json.dumps(inline_sa)),
    )
    assert config.resolve_service_account_info()["project_id"] == "from-file"

    # File removed -> b64 wins over inline.
    mocker.patch.object(config.settings, "google_service_account_json_file", "")
    assert config.resolve_service_account_info()["project_id"] == "from-b64"

    # b64 removed -> inline.
    mocker.patch.object(
        config.settings, "google_service_account_json_b64", SecretStr("")
    )
    assert config.resolve_service_account_info()["project_id"] == "from-inline"


def test_resolve_raises_when_none_set(_clear_creds):
    with pytest.raises(RuntimeError):
        config.resolve_service_account_info()


def test_resolve_missing_file_raises(_clear_creds, mocker, tmp_path):
    mocker.patch.object(
        config.settings,
        "google_service_account_json_file",
        str(tmp_path / "nope.json"),
    )
    with pytest.raises(RuntimeError):
        config.resolve_service_account_info()


# ---------- has_service_account_creds ----------

def test_has_creds_true_for_b64_only(_clear_creds, mocker):
    mocker.patch.object(
        config.settings, "google_service_account_json_b64", SecretStr(_b64(_FAKE_SA))
    )
    assert config.has_service_account_creds() is True


def test_has_creds_false_when_all_blank(_clear_creds):
    assert config.has_service_account_creds() is False


# ---------- F1 guard: b64-only satisfies BOTH gates ----------

def test_b64_only_satisfies_sheets_and_drive_gates(_clear_creds, mocker):
    """The exact F1 failure mode: with creds supplied ONLY via base64, both the
    Sheets backend gate (drives _choose_backend) and the Drive gate (drives
    GR-01 WZ upload) must report configured."""
    mocker.patch.object(
        config.settings, "google_service_account_json_b64", SecretStr(_b64(_FAKE_SA))
    )
    mocker.patch.object(config.settings, "google_sheet_id", "SHEET123")
    mocker.patch.object(config.settings, "gdrive_wz_folder_id", "FOLDER123")
    assert sheets.is_configured() is True
    assert drive.is_configured() is True
