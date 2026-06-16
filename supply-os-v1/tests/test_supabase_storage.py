"""Unit tests for the Supabase Storage WZ-photo adapter (app.supabase_storage).

The supabase client is never created: tests patch ``_bucket`` with a MagicMock,
so no network, no credentials, and no ``supabase`` install is required (mirrors
test_drive.py's mocking of the Drive service). The lazy ``from supabase import
create_client`` inside ``_get_client`` is therefore never triggered.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from pydantic import SecretStr

from app import supabase_storage as ss


# ---------- is_configured ----------

def test_is_configured_false_without_url(mocker):
    mocker.patch.object(ss.settings, "supabase_url", "")
    mocker.patch.object(
        ss.settings, "supabase_service_role_key", SecretStr("sb_secret_x")
    )
    mocker.patch.object(ss.settings, "supabase_wz_bucket", "wz-photos")
    assert ss.is_configured() is False


def test_is_configured_false_without_key(mocker):
    mocker.patch.object(ss.settings, "supabase_url", "https://x.supabase.co")
    mocker.patch.object(ss.settings, "supabase_service_role_key", SecretStr(""))
    mocker.patch.object(ss.settings, "supabase_wz_bucket", "wz-photos")
    assert ss.is_configured() is False


def test_is_configured_true_with_all(mocker):
    mocker.patch.object(ss.settings, "supabase_url", "https://x.supabase.co")
    mocker.patch.object(
        ss.settings, "supabase_service_role_key", SecretStr("sb_secret_x")
    )
    mocker.patch.object(ss.settings, "supabase_wz_bucket", "wz-photos")
    assert ss.is_configured() is True


# ---------- reset_client ----------

def test_reset_client_drops_singleton():
    ss._client = object()
    ss.reset_client()
    assert ss._client is None


# ---------- order_prefix ----------

def test_order_prefix():
    assert ss.order_prefix("ORD-1") == "wz/ORD-1"


# ---------- upload_photo ----------

def test_upload_photo_sets_content_type_and_returns_path(mocker):
    bucket = MagicMock()
    mocker.patch.object(ss, "_bucket", return_value=bucket)
    path = ss.upload_photo("wz/ORD-1/RCP-01.jpg", b"jpegbytes", "image/jpeg")
    assert path == "wz/ORD-1/RCP-01.jpg"
    bucket.upload.assert_called_once()
    kwargs = bucket.upload.call_args.kwargs
    assert kwargs["path"] == "wz/ORD-1/RCP-01.jpg"
    assert kwargs["file"] == b"jpegbytes"
    assert kwargs["file_options"]["content-type"] == "image/jpeg"
    # upsert is the STRING "true", not a bool (SDK serialises it verbatim) — makes
    # the frontend retry-photos path idempotent (receipt-scoped keys, see module).
    assert kwargs["file_options"]["upsert"] == "true"


def test_upload_photo_falls_back_content_type(mocker):
    bucket = MagicMock()
    mocker.patch.object(ss, "_bucket", return_value=bucket)
    ss.upload_photo("wz/ORD-1/RCP-01", b"x", "")
    assert (
        bucket.upload.call_args.kwargs["file_options"]["content-type"]
        == "application/octet-stream"
    )


# ---------- list_photos ----------

def test_list_photos_builds_full_paths_and_skips_placeholders(mocker):
    bucket = MagicMock()
    bucket.list.return_value = [
        {"name": "RCP-01.jpg"},
        {"name": "RCP-02.jpg"},
        {"name": ""},  # placeholder row — skipped
        {"name": ".emptyFolderPlaceholder"},  # dot file — skipped
    ]
    mocker.patch.object(ss, "_bucket", return_value=bucket)
    out = ss.list_photos("wz/ORD-1")
    assert out == ["wz/ORD-1/RCP-01.jpg", "wz/ORD-1/RCP-02.jpg"]
    bucket.list.assert_called_once_with("wz/ORD-1")


# ---------- create_signed_url ----------

def test_create_signed_url_reads_signedURL(mocker):
    bucket = MagicMock()
    bucket.create_signed_url.return_value = {
        "signedURL": "https://x.supabase.co/signed/abc",
        "signedUrl": "https://x.supabase.co/signed/abc",
    }
    mocker.patch.object(ss, "_bucket", return_value=bucket)
    url = ss.create_signed_url("wz/ORD-1/RCP-01.jpg")
    assert url == "https://x.supabase.co/signed/abc"
    bucket.create_signed_url.assert_called_once_with("wz/ORD-1/RCP-01.jpg", 3600)


def test_create_signed_url_falls_back_to_signedUrl_alias(mocker):
    bucket = MagicMock()
    bucket.create_signed_url.return_value = {"signedUrl": "https://x/sb"}
    mocker.patch.object(ss, "_bucket", return_value=bucket)
    assert ss.create_signed_url("wz/ORD-1/a.jpg", expires_in=60) == "https://x/sb"
    bucket.create_signed_url.assert_called_once_with("wz/ORD-1/a.jpg", 60)


def test_create_signed_url_raises_when_missing(mocker):
    bucket = MagicMock()
    bucket.create_signed_url.return_value = {}
    mocker.patch.object(ss, "_bucket", return_value=bucket)
    with pytest.raises(ValueError, match="no signed URL"):
        ss.create_signed_url("wz/ORD-1/a.jpg")
