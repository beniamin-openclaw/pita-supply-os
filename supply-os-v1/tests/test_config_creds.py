"""Unit tests for the shared service-account credential resolver (`app.config`).

Guards the F1 regression caught in plan-review: base64-only credentials must
satisfy the Sheets backend gate, and the resolver must honor the
file -> base64 -> inline preference order. (Historically a second consumer, the
Drive WZ-photo adapter, shared these creds; WZ photos have since moved to
Supabase Storage with its own service-role key, so only Sheets consumes this
resolver now.)
"""
from __future__ import annotations

import base64
import json

import pytest
from pydantic import SecretStr

from app import config, sheets

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


def test_resolve_invalid_base64_raises_clear_error(_clear_creds, mocker):
    """A malformed base64 blob (e.g. pasted with stray newlines) must fail at
    startup with an actionable message, not a cryptic downstream google.auth
    error (impl-review F1)."""
    mocker.patch.object(
        config.settings,
        "google_service_account_json_b64",
        SecretStr("!!! not base64 !!!"),
    )
    with pytest.raises(RuntimeError, match="not valid base64"):
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


# ---------- F1 guard: b64-only satisfies the Sheets gate ----------

def test_b64_only_satisfies_sheets_gate(_clear_creds, mocker):
    """The F1 failure mode: with creds supplied ONLY via base64, the Sheets
    backend gate (which drives _choose_backend) must report configured. The
    former Drive gate was removed when WZ photos moved to Supabase Storage
    (which authenticates with its own service-role key, not these creds)."""
    mocker.patch.object(
        config.settings, "google_service_account_json_b64", SecretStr(_b64(_FAKE_SA))
    )
    mocker.patch.object(config.settings, "google_sheet_id", "SHEET123")
    assert sheets.is_configured() is True
