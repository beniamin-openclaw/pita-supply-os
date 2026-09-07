"""Symfonia eBiuro — read-only client + purchase-document parser.

Finance reconciliation MVP (change `finance-invoice-reconciliation`): the app
mirrors the accountant's VERIFIED purchase invoices from eBiuro into
``finance_documents`` so a Manager can compare a goods receipt (what the
Captain confirmed arrived, with WZ photos) against the invoice positions.

Read-only by design: only ``POST /api/auth`` (session token), ``POST /api/user``
(company list), ``GET /api/document/mode/all`` (listing), ``GET
/api/document/mode/one-xt/id/{id}`` (positions) and the PDF download are used.
The API key is the accountant's connector key — it must never be regenerated
from here and nothing is ever written to eBiuro.

The listing endpoint ignores its documented ``params`` JSON; plain
``page``/``count`` paging works (verified 2026-08-06 in JARVIS-CODEX). One-xt
returns OCR attribute objects (``{"value": ..., "is_valid": ...}``), sometimes
wrapped in a list — ``_scalar`` unwraps them. Positions use Polish keys
(``Nazwa``, ``Ilosc``, ``Jednostka``, ``Netto``, ``Brutto``, ``Cena``,
``StawkaVAT``).
"""
from __future__ import annotations

import json
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterator
from datetime import date, datetime, timezone
from typing import Any, Optional

from .config import settings
from .models import FinanceDocument, FinanceDocumentLine

log = logging.getLogger(__name__)

BASE_URL = "https://apps.symfonia.pl"
PURCHASE_APP_TYPE = "DOCUMENT_TYPE_PURCHASE"


class EbiuroError(RuntimeError):
    """Base client error (never embeds secrets)."""


class EbiuroAuthError(EbiuroError):
    """Authentication failed / token missing."""


class EbiuroApiError(EbiuroError):
    """Non-success API response after retries."""


HttpFn = Callable[..., tuple[int, bytes]]


def _json(body: bytes) -> Any:
    """Decode an API body; a non-JSON reply is an API error, never a 500."""
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise EbiuroApiError("response is not JSON") from exc


# ---------- Configuration ----------

def is_configured() -> bool:
    return bool(
        settings.ebiuro_email
        and settings.ebiuro_apikey.get_secret_value()
        and company_ids()
    )


def company_ids() -> list[int]:
    """Configured eBiuro company ids (``SUPPLY_OS_EBIURO_COMPANY_IDS``, comma list)."""
    out: list[int] = []
    for tok in settings.ebiuro_company_ids.split(","):
        tok = tok.strip()
        if tok.isdigit():
            out.append(int(tok))
    return out


# ---------- HTTP ----------

def _urllib_http(
    method: str,
    url: str,
    headers: Optional[dict[str, str]] = None,
    data: Optional[dict[str, Any]] = None,
) -> tuple[int, bytes]:
    body: Optional[bytes] = None
    req_headers = dict(headers or {})
    if data is not None and method.upper() == "POST":
        body = urllib.parse.urlencode(data).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/x-www-form-urlencoded")
    request = urllib.request.Request(url, data=body, headers=req_headers, method=method.upper())
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return int(response.status), response.read()
    except urllib.error.HTTPError as exc:
        payload = exc.read() if hasattr(exc, "read") else b""
        return int(exc.code), payload


class EbiuroClient:
    """Session-token client. Only GET plus the auth/user POSTs."""

    def __init__(
        self,
        email: str,
        apikey: str,
        http: Optional[HttpFn] = None,
        base_url: str = BASE_URL,
    ) -> None:
        self.email = email
        self.apikey = apikey
        self.base_url = base_url.rstrip("/")
        self._http: HttpFn = http or _urllib_http
        self._token: Optional[str] = None
        self._retry_sleep: Callable[[], None] = lambda: time.sleep(2)

    @classmethod
    def from_settings(cls) -> "EbiuroClient":
        return cls(settings.ebiuro_email, settings.ebiuro_apikey.get_secret_value())

    def _request(
        self,
        method: str,
        url: str,
        headers: Optional[dict[str, str]] = None,
        data: Optional[dict[str, Any]] = None,
    ) -> tuple[int, bytes]:
        status, body = 0, b""
        for attempt in range(2):
            try:
                status, body = self._http(method, url, headers=headers, data=data)
            except Exception as exc:  # transport failure
                if attempt == 0:
                    self._retry_sleep()
                    continue
                raise EbiuroApiError(f"transport error: {type(exc).__name__}") from None
            if status >= 500 and attempt == 0:
                self._retry_sleep()
                continue
            break
        if status >= 400:
            raise EbiuroApiError(f"HTTP {status}")
        return status, body

    def auth(self) -> str:
        _status, body = self._request(
            "POST", f"{self.base_url}/api/auth",
            data={"email": self.email, "apikey": self.apikey},
        )
        try:
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise EbiuroAuthError("auth response is not JSON") from exc
        if payload.get("code") == 10 and payload.get("token"):
            self._token = str(payload["token"])
            return self._token
        raise EbiuroAuthError(f"auth failed (code={payload.get('code')})")

    def _token_or_auth(self) -> str:
        if not self._token:
            self.auth()
        assert self._token is not None
        return self._token

    def get_companies(self) -> list[dict[str, Any]]:
        token = self._token_or_auth()
        _status, body = self._request(
            "POST", f"{self.base_url}/api/user",
            headers={"token": token}, data={"mode": "get-user-company"},
        )
        payload = _json(body)
        if isinstance(payload, list):
            return [c for c in payload if isinstance(c, dict)]
        if isinstance(payload, dict) and isinstance(payload.get("data"), list):
            return [c for c in payload["data"] if isinstance(c, dict)]
        raise EbiuroApiError("unexpected companies payload shape")

    def iter_documents(self, company_id: int, count: int = 100) -> Iterator[dict[str, Any]]:
        token = self._token_or_auth()
        page = 1
        seen_first_ids: set[object] = set()
        while True:
            query = urllib.parse.urlencode({"page": str(page), "count": str(count)})
            _status, body = self._request(
                "GET", f"{self.base_url}/api/document/mode/all?{query}",
                headers={"token": token, "company_id": str(company_id)},
            )
            payload = _json(body)
            if isinstance(payload, list):
                items = payload
            elif isinstance(payload, dict) and isinstance(payload.get("data"), list):
                items = payload["data"]
            else:
                raise EbiuroApiError("unexpected document list payload shape")
            items = [it for it in items if isinstance(it, dict)]
            if not items:
                return
            first_id = items[0].get("id")
            if first_id is not None:
                if first_id in seen_first_ids:
                    return  # server repeated a page — stop instead of looping
                seen_first_ids.add(first_id)
            yield from items
            page += 1

    def get_document(self, company_id: int, doc_id: int) -> dict[str, Any]:
        token = self._token_or_auth()
        _status, body = self._request(
            "GET", f"{self.base_url}/api/document/mode/one-xt/id/{doc_id}",
            headers={"token": token, "company_id": str(company_id)},
        )
        payload = _json(body)
        if isinstance(payload, dict):
            return payload
        raise EbiuroApiError("unexpected document payload shape")

    def download_pdf(self, url: str) -> bytes:
        """Fetch a document PDF. The session token is only ever sent to eBiuro's
        own host — a stray/foreign ``pdf_url`` row must not leak it (impl-review F3)."""
        parts = urllib.parse.urlsplit(url)
        host = parts.netloc.lower()
        if parts.scheme != "https" or not (host == "apps.symfonia.pl" or host.endswith(".symfonia.pl")):
            raise EbiuroApiError("pdf url outside eBiuro host")
        token = self._token_or_auth()
        _status, body = self._request("GET", url, headers={"token": token})
        return body


# ---------- Parsing (pure) ----------

def _scalar(v: Any) -> Any:
    if isinstance(v, (list, tuple)):
        return _scalar(v[0]) if v else None
    if isinstance(v, dict):
        return _scalar(v["value"]) if "value" in v else None
    return v


def _as_float(v: Any) -> Optional[float]:
    v = _scalar(v)
    if v is None or v == "":
        return None
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _as_str(v: Any) -> Optional[str]:
    v = _scalar(v)
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _as_date(v: Any) -> Optional[date]:
    s = _as_str(v)
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def _attrs(doc: dict[str, Any]) -> dict[str, Any]:
    raw = doc.get("attributes") or {}
    return raw if isinstance(raw, dict) else {}


def _contractor(doc: dict[str, Any]) -> dict[str, Any]:
    raw = doc.get("contractor")
    if isinstance(raw, list) and raw:
        return raw[0] if isinstance(raw[0], dict) else {}
    return raw if isinstance(raw, dict) else {}


def normalize_nip(raw: Optional[str]) -> Optional[str]:
    """Digits only: 'PL 524-210-69-63' -> '5242106963'; None/empty -> None."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw))
    return digits or None


def is_purchase(doc: dict[str, Any]) -> bool:
    return str(doc.get("app_document_type") or "") == PURCHASE_APP_TYPE


def listing_fingerprint(doc: dict[str, Any]) -> str:
    """Cheap change detector from the LISTING item only (no one-xt fetch)."""
    a = _attrs(doc)
    return "|".join(
        str(x)
        for x in (
            _scalar(doc.get("state")), _as_str(a.get("RazemBrutto")),
            _as_str(a.get("DataWystawienia")), _as_str(a.get("NrFaktury")),
        )
    )


def parse_document(
    doc: dict[str, Any],
    company_nip: Optional[str],
    listing: Optional[dict[str, Any]] = None,
    synced_at: Optional[datetime] = None,
) -> FinanceDocument:
    """Map one eBiuro one-xt payload (+ optional listing item for attrs missing on
    one-xt) onto ``FinanceDocument`` with its lines. Pure; unit-tested on
    ``tests/fixtures/ebiuro_doc_purchase.json``."""
    attrs = _attrs(doc)
    if listing is not None:
        for k, v in _attrs(listing).items():
            if k not in attrs or _scalar(attrs.get(k)) in (None, ""):
                attrs[k] = v
    contractor = _contractor(doc) or (_contractor(listing) if listing else {})
    contractor_nip = normalize_nip(contractor.get("nip")) or normalize_nip(
        _as_str(attrs.get("SprzedawcaNip"))
    )
    doc_id = int(_scalar(doc.get("id")))
    lines: list[FinanceDocumentLine] = []
    for ordinal, pos in enumerate(doc.get("positions") or [], start=1):
        if not isinstance(pos, dict):
            continue
        lines.append(
            FinanceDocumentLine(
                doc_id=doc_id,
                ordinal=ordinal,
                name=_as_str(pos.get("Nazwa")) or "",
                quantity=_as_float(pos.get("Ilosc")),
                unit=_as_str(pos.get("Jednostka")),
                netto=_as_float(pos.get("Netto")),
                brutto=_as_float(pos.get("Brutto")),
                unit_price_netto=_as_float(pos.get("Cena")),
                vat_rate=_as_float(pos.get("StawkaVAT")),
            )
        )
    return FinanceDocument(
        doc_id=doc_id,
        company_id=int(_scalar(doc.get("company_id")) or 0),
        company_nip=normalize_nip(company_nip) or normalize_nip(_as_str(attrs.get("NabywcaNip"))),
        contractor_nip=contractor_nip,
        contractor_name=_as_str(contractor.get("name")) or _as_str(attrs.get("SprzedawcaNazwa")),
        doc_type=_as_str(doc.get("type_dict")),
        invoice_number=_as_str(attrs.get("NrFaktury")),
        ksef_number=_as_str(attrs.get("KsefNumer")),
        issue_date=_as_date(attrs.get("DataWystawienia")),
        sell_date=_as_date(attrs.get("DataSprzedazy")),
        payment_deadline=_as_date(attrs.get("TerminPlatnosci")),
        netto=_as_float(attrs.get("RazemNetto")),
        brutto=_as_float(attrs.get("RazemBrutto")),
        vat=_as_float(attrs.get("RazemVAT")),
        pdf_url=_as_str(doc.get("file_path")),
        state=int(_scalar(doc.get("state")) or 0) or None,
        synced_at=synced_at or datetime.now(timezone.utc),
        lines=lines,
    )


# ---------- Sync orchestration ----------

def sync_company(
    client: EbiuroClient,
    company_id: int,
    company_nip: Optional[str],
    known_fingerprints: dict[int, str],
    max_fetch: int = 200,
) -> tuple[list[FinanceDocument], dict]:
    """Pull every PURCHASE document for ``company_id``; fetch one-xt only for
    documents that are new or whose listing fingerprint changed. Returns the
    parsed documents to upsert plus counters. Sales invoices (paragony) and
    non-purchase types are skipped without a fetch."""
    counts: dict = {"listed": 0, "purchase": 0, "fetched": 0, "unchanged": 0, "skipped": 0}
    seen_ids: list[int] = []
    out: list[FinanceDocument] = []
    attempts = 0
    now = datetime.now(timezone.utc)
    for item in client.iter_documents(company_id):
        counts["listed"] += 1
        if not is_purchase(item):
            counts["skipped"] += 1
            continue
        counts["purchase"] += 1
        raw_id = _scalar(item.get("id"))
        if raw_id is None:
            counts["skipped"] += 1
            continue
        doc_id = int(raw_id)
        seen_ids.append(doc_id)
        fp = listing_fingerprint(item)
        if known_fingerprints.get(doc_id) == fp:
            counts["unchanged"] += 1
            continue
        if attempts >= max_fetch:
            counts["skipped"] += 1  # cap per run; the next run picks it up
            continue
        attempts += 1
        try:
            full = client.get_document(company_id, doc_id)
            parsed = parse_document(full, company_nip, listing=item, synced_at=now)
        except Exception:  # one bad document never aborts the run (review F5)
            log.warning("eBiuro doc %s fetch/parse failed — skipped this run", doc_id, exc_info=True)
            counts["skipped"] += 1
            continue
        counts["fetched"] += 1
        parsed = parsed.model_copy(update={"listing_fp": fp, "last_seen_at": now})
        out.append(parsed)
    counts["seen_ids"] = seen_ids
    return out, counts
