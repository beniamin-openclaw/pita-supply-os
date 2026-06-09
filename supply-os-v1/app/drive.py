"""Google Drive adapter for WZ goods-receipt photos (GR-01, Phase 2).

Uploads delivery-note (WZ) photos into a per-order subfolder under a parent
"WZ Photos" folder that the operator shares with the service account. Reuses the
same service-account credentials as ``app.sheets`` with the ``drive.file`` scope
(already declared in ``sheets.SCOPES``).

This is a SIDE service, not a data backend — routes call it directly (after
resolving persistence via ``_choose_backend()``), and it degrades via
``is_configured()`` when no WZ folder / creds are set. The Google API client is
imported LAZILY inside the functions that use it, so this module (and
``app.main``) import cleanly even where ``google-api-python-client`` is not
installed (seed/dev or the test environment, which mocks the service).
"""
from __future__ import annotations

import io
import json
import logging
from pathlib import Path

from google.oauth2.service_account import Credentials

from .config import settings

log = logging.getLogger(__name__)

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]
_FOLDER_MIME = "application/vnd.google-apps.folder"

_service = None  # cached Drive v3 service singleton


def is_configured() -> bool:
    """True when a WZ parent-folder id AND service-account creds are present."""
    has_creds = (
        bool(settings.google_service_account_json_file)
        or bool(settings.google_service_account_json.get_secret_value())
    )
    return bool(settings.gdrive_wz_folder_id and has_creds)


def reset_service() -> None:
    """Drop the cached Drive service (used by tests + after a creds change)."""
    global _service
    _service = None


def _credentials() -> Credentials:
    """Load the service-account credentials (file path preferred, else inline
    JSON) — mirrors ``app.sheets._client``'s source order, scoped to drive.file."""
    sa_file = settings.google_service_account_json_file
    sa_json_inline = settings.google_service_account_json.get_secret_value()
    if sa_file:
        path = Path(sa_file)
        if not path.is_file():
            raise RuntimeError(
                f"google_service_account_json_file points to a missing file: {sa_file}"
            )
        creds_info = json.loads(path.read_text(encoding="utf-8"))
    elif sa_json_inline:
        creds_info = json.loads(sa_json_inline)
    else:
        raise RuntimeError("no service-account credentials configured for Drive")
    return Credentials.from_service_account_info(creds_info, scopes=DRIVE_SCOPES)


def _drive_service():
    """Return a cached Drive v3 service. Imports googleapiclient lazily."""
    global _service
    if _service is not None:
        return _service
    from googleapiclient.discovery import build  # lazy import
    _service = build(
        "drive", "v3", credentials=_credentials(), cache_discovery=False
    )
    return _service


def ensure_order_folder(order_id: str) -> tuple[str, str]:
    """Find-or-create a subfolder named ``order_id`` under the WZ parent folder.

    Idempotent — re-confirms / multiple receipts for one order share a single
    folder. Returns ``(folder_id, web_view_link)``.
    """
    service = _drive_service()
    parent = settings.gdrive_wz_folder_id
    safe_name = order_id.replace("\\", "\\\\").replace("'", "\\'")
    query = (
        f"name = '{safe_name}' and '{parent}' in parents "
        f"and mimeType = '{_FOLDER_MIME}' and trashed = false"
    )
    found = (
        service.files()
        .list(q=query, fields="files(id, webViewLink)", pageSize=1)
        .execute()
    )
    files = found.get("files", [])
    if files:
        existing = files[0]
        return existing["id"], existing.get("webViewLink", "")
    created = (
        service.files()
        .create(
            body={"name": order_id, "mimeType": _FOLDER_MIME, "parents": [parent]},
            fields="id, webViewLink",
        )
        .execute()
    )
    return created["id"], created.get("webViewLink", "")


def upload_photo(
    folder_id: str, filename: str, content: bytes, mime_type: str
) -> tuple[str, str]:
    """Upload one photo into ``folder_id``; return ``(file_id, web_view_link)``."""
    from googleapiclient.http import MediaIoBaseUpload  # lazy import

    service = _drive_service()
    media = MediaIoBaseUpload(
        io.BytesIO(content),
        mimetype=mime_type or "application/octet-stream",
        resumable=False,
    )
    created = (
        service.files()
        .create(
            body={"name": filename, "parents": [folder_id]},
            media_body=media,
            fields="id, webViewLink",
        )
        .execute()
    )
    return created["id"], created.get("webViewLink", "")
