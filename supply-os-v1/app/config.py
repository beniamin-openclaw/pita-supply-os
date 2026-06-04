"""Pydantic settings — env-driven config for the v0 backend."""
from enum import Enum
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


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
