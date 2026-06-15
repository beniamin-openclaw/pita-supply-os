"""Pydantic settings — env-driven config for the v0 backend."""
import base64
import binascii
import json
import logging
from enum import Enum
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger(__name__)


class DataBackend(str, Enum):
    SEED = "seed"
    SHEET = "sheet"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="SUPPLY_OS_",
        extra="ignore",
    )

    env: str = "dev"
    data_backend: DataBackend = DataBackend.SEED
    seed_dir: Path = Path("../docs/pita-supply-os-v1/seed")

    # Google Sheets (Phase 1.5+) — SecretStr prevents accidental log leakage
    google_sheet_id: str = ""
    # Two ways to provide the service-account credentials, in order of preference:
    #  1) path to a JSON file on disk (cleaner for production — avoids
    #     escape-sequence pitfalls in systemd EnvironmentFile parsing)
    #  2) inline JSON string (fine for dev / docker / .env that handles
    #     long values correctly)
    google_service_account_json_file: str = ""
    google_service_account_json: SecretStr = SecretStr("")
    # base64-encoded inline JSON — a CLI-safe single-line form for platforms
    # whose env handling mangles multi-line values (e.g. `railway variables
    # --set`). Decoded by resolve_service_account_info(); preferred over the raw
    # inline var, after the file path.
    google_service_account_json_b64: SecretStr = SecretStr("")

    # Google Drive (WZ goods-receipt photos, GR-01) — id of the "WZ Photos"
    # parent folder shared with the service account. Empty => photo upload is
    # disabled (the receipt still persists, flagged received_with_missing_wz).
    # Reuses the service-account creds above with the drive.file scope.
    gdrive_wz_folder_id: str = ""

    # PostHog
    posthog_api_key: SecretStr = SecretStr("")
    posthog_host: str = "https://eu.i.posthog.com"

    # CORS — comma-separated origins (NEVER use "*" with allow_credentials=True)
    cors_allow_origins: str = "http://localhost:3000,http://localhost:5173"

    # Auth (Bearer-token model, v0 pilot)
    # captain_tokens format: "LOCATION:token,LOCATION:token,..."
    # Empty => Captain auth DISABLED; requests default to location_id=WOLA (dev).
    captain_tokens: SecretStr = SecretStr("")
    # Single shared token for the Manager/Office dispatcher.
    # Empty => Manager auth DISABLED (dev).
    manager_token: SecretStr = SecretStr("")


settings = Settings()


def has_service_account_creds() -> bool:
    """True when any service-account credential source is configured (file /
    base64 / inline). Single source of truth for the Sheets + Drive config
    gates, so a base64-only setup (Railway) satisfies both."""
    return bool(
        settings.google_service_account_json_file
        or settings.google_service_account_json_b64.get_secret_value()
        or settings.google_service_account_json.get_secret_value()
    )


def resolve_service_account_info() -> dict:
    """Parse the service-account credentials dict from the configured source.

    Preference order: file path -> base64 inline -> raw inline JSON. Raises
    RuntimeError when none is set. Scopes are NOT applied here — each caller
    (sheets -> SCOPES, drive -> DRIVE_SCOPES) wraps the result with
    Credentials.from_service_account_info, so this is the one place credential
    SOURCES are resolved for every consumer.
    """
    sa_file = settings.google_service_account_json_file
    sa_b64 = settings.google_service_account_json_b64.get_secret_value()
    sa_inline = settings.google_service_account_json.get_secret_value()
    if sa_file:
        path = Path(sa_file)
        if not path.is_file():
            raise RuntimeError(
                f"google_service_account_json_file points to a missing file: {sa_file}"
            )
        log.info("service-account credentials loaded from file: %s", sa_file)
        return json.loads(path.read_text(encoding="utf-8"))
    if sa_b64:
        try:
            decoded = base64.b64decode(sa_b64, validate=True)
        except binascii.Error as e:
            raise RuntimeError(
                "SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_B64 is not valid base64 "
                "(encode with `base64 -i sa.json | tr -d '\\n'`)"
            ) from e
        log.info("service-account credentials loaded from base64 env var")
        return json.loads(decoded)
    if sa_inline:
        log.info("service-account credentials loaded from inline JSON env var")
        return json.loads(sa_inline)
    raise RuntimeError(
        "no service-account credentials configured — set one of "
        "SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE, "
        "SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_B64, or "
        "SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON"
    )
