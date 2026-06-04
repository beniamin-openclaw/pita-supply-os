"""Auth helpers — Bearer-token verification for Captain + Manager endpoints.

v0 model: shared per-location codes for Captains, one shared code for the
Manager/Office dispatcher. Three FastAPI dependencies:

- `require_captain` — Captain endpoints; returns location_id from token.
- `require_manager` — Manager endpoints; verifies shared Manager token.
- `require_any_auth` — endpoints readable by either Captain or Manager
  (master data: products, suppliers, locations).

Phase 1.5: magic-link via Resend OR Google-domain-restricted sign-in.

When tokens are unset in env (local dev), auth is disabled and a warning is
logged on first use. Captain endpoints default to the WOLA location in
dev mode. Never leave tokens empty in production.
"""
import logging
import secrets
from typing import Optional

from fastapi import Header, HTTPException, status

from .config import settings

log = logging.getLogger(__name__)

_DEV_WARNED = {"captain": False, "manager": False, "any": False}


def _strip_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(maxsplit=1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


def _parse_captain_tokens(raw: str) -> dict[str, str]:
    """Parse 'LOCATION:token,LOCATION:token,...' into {location_id: token}."""
    out: dict[str, str] = {}
    for pair in raw.split(","):
        if ":" not in pair:
            continue
        loc, tok = pair.split(":", 1)
        loc, tok = loc.strip(), tok.strip()
        if loc and tok:
            out[loc] = tok
    return out


def require_captain(authorization: Optional[str] = Header(None)) -> str:
    """FastAPI dependency. Returns the Captain's location_id from Bearer token.

    Dev mode (no captain_tokens configured): warns once, returns "WOLA".
    """
    raw = settings.captain_tokens.get_secret_value()
    if not raw:
        if not _DEV_WARNED["captain"]:
            log.warning(
                "Captain auth DISABLED — SUPPLY_OS_CAPTAIN_TOKENS is empty. "
                "Defaulting all Captain requests to location_id=WOLA. "
                "DO NOT run this configuration in production."
            )
            _DEV_WARNED["captain"] = True
        return "WOLA"

    presented = _strip_bearer(authorization)
    if not presented:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    tokens = _parse_captain_tokens(raw)
    for location_id, valid_token in tokens.items():
        if secrets.compare_digest(presented, valid_token):
            return location_id

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_manager(authorization: Optional[str] = Header(None)) -> None:
    """FastAPI dependency. Verifies the shared Manager Bearer token.

    Dev mode (no manager_token configured): warns once, allows access.
    """
    raw = settings.manager_token.get_secret_value()
    if not raw:
        if not _DEV_WARNED["manager"]:
            log.warning(
                "Manager auth DISABLED — SUPPLY_OS_MANAGER_TOKEN is empty. "
                "DO NOT run this configuration in production."
            )
            _DEV_WARNED["manager"] = True
        return

    presented = _strip_bearer(authorization)
    if not presented or not secrets.compare_digest(presented, raw):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid manager token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_any_auth(authorization: Optional[str] = Header(None)) -> str:
    """FastAPI dependency. Accepts EITHER a Captain token (any location)
    OR the Manager token. Returns:

    - "captain:<location_id>" when matched a Captain token.
    - "manager" when matched the Manager token.
    - "dev:open" when BOTH token env vars are empty (dev mode only).

    Used for master-data read endpoints (products, suppliers, locations)
    that any authenticated user can fetch.
    """
    captain_raw = settings.captain_tokens.get_secret_value()
    manager_raw = settings.manager_token.get_secret_value()

    if not captain_raw and not manager_raw:
        if not _DEV_WARNED["any"]:
            log.warning(
                "require_any_auth — both Captain and Manager auth DISABLED. "
                "Allowing in dev mode. DO NOT run this configuration in production."
            )
            _DEV_WARNED["any"] = True
        return "dev:open"

    presented = _strip_bearer(authorization)
    if not presented:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required (Captain or Manager)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if captain_raw:
        for location_id, valid_token in _parse_captain_tokens(captain_raw).items():
            if secrets.compare_digest(presented, valid_token):
                return f"captain:{location_id}"

    if manager_raw and secrets.compare_digest(presented, manager_raw):
        return "manager"

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token",
        headers={"WWW-Authenticate": "Bearer"},
    )
