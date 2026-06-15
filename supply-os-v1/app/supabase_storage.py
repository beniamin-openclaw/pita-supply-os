"""Supabase Storage adapter for WZ goods-receipt photos (GR-01).

Replaces the Google Drive adapter: a Google service account has no Drive storage
quota (``403 storageQuotaExceeded``), so WZ delivery-note photos go to a PRIVATE
Supabase Storage bucket instead — uploaded server-side with the ``service_role``
key and viewed via short-lived signed URLs that are minted on demand and NEVER
persisted.

Like the former Drive adapter, this is a SIDE service, not a data backend —
routes call it directly (after resolving persistence via ``_choose_backend()``),
and it degrades via ``is_configured()`` when no Supabase URL / key is set. The
``supabase`` client is imported LAZILY inside ``_get_client`` so this module (and
``app.main``) import
cleanly even where the SDK is not installed (seed/dev or the test environment,
which mocks the client).

Object layout: an order's photos live under the key prefix ``wz/<order_id>/``; the
per-receipt filename keeps them unique. Only that prefix is stored on the receipt
(``wz_photo_path_prefix``) — signed URLs are generated per object at view time.

Security: the ``service_role`` key bypasses RLS and is all-powerful — it lives in
backend env only, never in the SPA. Initialising the client with the anon key by
mistake makes private-bucket uploads fail silently under RLS.
"""
from __future__ import annotations

import logging

from .config import settings

log = logging.getLogger(__name__)

DEFAULT_SIGNED_URL_TTL_SECONDS = 3600  # 1h — re-signed on each view, never stored

_client = None  # cached supabase Client singleton


def is_configured() -> bool:
    """True when a Supabase URL, service-role key AND bucket name are all set."""
    return bool(
        settings.supabase_url
        and settings.supabase_service_role_key.get_secret_value()
        and settings.supabase_wz_bucket
    )


def reset_client() -> None:
    """Drop the cached client (used by tests + after a creds change)."""
    global _client
    _client = None


def _get_client():
    """Return a cached supabase ``Client``. Imports ``supabase`` lazily so the
    module imports without the SDK installed (same lazy pattern the Drive
    adapter used)."""
    global _client
    if _client is not None:
        return _client
    from supabase import create_client  # lazy import
    _client = create_client(
        settings.supabase_url,
        settings.supabase_service_role_key.get_secret_value(),
    )
    return _client


def _bucket():
    """Return the per-bucket storage accessor for the configured WZ bucket."""
    return _get_client().storage.from_(settings.supabase_wz_bucket)


def order_prefix(order_id: str) -> str:
    """Stable storage key prefix for one order's WZ photos: ``wz/<order_id>``."""
    return f"wz/{order_id}"


def upload_photo(object_path: str, content: bytes, mime_type: str) -> str:
    """Upload one photo to ``object_path`` in the WZ bucket; return that path.

    ``content-type`` MUST be explicit — Supabase otherwise serves the object as
    ``text/html`` and browsers refuse to render it. ``upsert='false'`` so a
    re-confirm never silently overwrites a prior receipt's photo.
    """
    _bucket().upload(
        path=object_path,
        file=content,
        file_options={
            "content-type": mime_type or "application/octet-stream",
            "upsert": "false",
        },
    )
    return object_path


def list_photos(prefix: str) -> list[str]:
    """Return full object paths for every photo under ``prefix`` (one order).

    ``list`` yields leaf names relative to ``prefix``; we re-join them so callers
    get full object paths ready to sign. Empty/placeholder names are skipped.
    """
    items = _bucket().list(prefix)
    names = [
        it.get("name")
        for it in items
        if isinstance(it, dict) and it.get("name") and not it["name"].startswith(".")
    ]
    return [f"{prefix}/{name}" for name in names]


def create_signed_url(
    object_path: str, expires_in: int = DEFAULT_SIGNED_URL_TTL_SECONDS
) -> str:
    """Mint a short-lived signed URL for one object. Sign on demand — NEVER
    persist the result (it expires). The SDK returns a dict carrying the URL
    under ``signedURL`` (with a ``signedUrl`` alias); we read it defensively."""
    result = _bucket().create_signed_url(object_path, expires_in)
    url = None
    if isinstance(result, dict):
        url = (
            result.get("signedURL")
            or result.get("signedUrl")
            or result.get("signed_url")
        )
    if not url:
        raise ValueError(
            f"Supabase returned no signed URL for {object_path!r}: {result!r}"
        )
    return url
