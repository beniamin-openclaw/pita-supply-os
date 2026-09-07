"""eBiuro parser + sync orchestration — pure, fixture-driven (no network)."""
import json
from pathlib import Path

from app import ebiuro

FIXTURE = Path(__file__).parent / "fixtures" / "ebiuro_doc_purchase.json"


def _doc() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_parse_document_header_and_lines():
    d = ebiuro.parse_document(_doc(), company_nip="PL 5223241275")
    assert d.doc_id == 76091157
    assert d.company_id == 7189181
    assert d.company_nip == "5223241275"
    assert d.contractor_nip == "5242106963"
    assert d.contractor_name.startswith("Coca-Cola")
    assert d.doc_type == "Faktura zakupu"
    assert d.invoice_number == "2424267367"
    assert d.ksef_number == "5242106963-20260820-4DE368800003-EB"
    assert d.issue_date.isoformat() == "2026-08-20"
    assert d.sell_date.isoformat() == "2026-08-19"
    assert d.netto == 464.66 and d.brutto == 571.53
    assert d.pdf_url.startswith("https://apps.symfonia.pl/")
    assert len(d.lines) == 5
    first = d.lines[0]
    assert first.ordinal == 1
    assert first.name == "0.25 RGB X24 COCA-COLA ZERO"
    assert first.quantity == 3.0 and first.unit == "CS"
    assert first.netto == 176.62 and first.unit_price_netto == 153.62


def test_normalize_nip_strips_prefix_and_separators():
    assert ebiuro.normalize_nip("PL5242106963") == "5242106963"
    assert ebiuro.normalize_nip("524-210-69-63") == "5242106963"
    assert ebiuro.normalize_nip("") is None
    assert ebiuro.normalize_nip(None) is None


def test_listing_fingerprint_unwraps_ocr_attribute_objects():
    item = {"state": 2, "attributes": {"RazemBrutto": {"value": "571.53"},
            "DataWystawienia": [{"value": "2026-08-20"}], "NrFaktury": {"value": "2424267367"}}}
    assert ebiuro.listing_fingerprint(item) == "2|571.53|2026-08-20|2424267367"


class _FakeClient:
    """Listing with one purchase doc (known + unchanged), one purchase doc (new),
    one sales invoice (must be skipped without a fetch)."""

    def __init__(self):
        self.fetched: list[int] = []

    def iter_documents(self, company_id):
        base = _doc()
        known = dict(base, id=1, state=2)
        new = dict(base, id=2, state=2)
        sales = dict(base, id=3, app_document_type="DOCUMENT_TYPE_SALE")
        return iter([known, new, sales])

    def get_document(self, company_id, doc_id):
        self.fetched.append(doc_id)
        return dict(_doc(), id=doc_id)


def test_sync_company_fetches_only_new_or_changed_purchase_docs():
    client = _FakeClient()
    known_fp = ebiuro.listing_fingerprint(dict(_doc(), id=1, state=2))
    docs, counts = ebiuro.sync_company(client, 7189181, "5223241275", {1: known_fp})
    assert client.fetched == [2]
    assert [d.doc_id for d in docs] == [2]
    assert docs[0].listing_fp == known_fp  # same listing content as doc 1
    assert docs[0].last_seen_at is not None
    assert counts["seen_ids"] == [1, 2]  # sales doc never enters the mirror
    assert {k: counts[k] for k in ("listed", "purchase", "fetched", "unchanged", "skipped")} == {
        "listed": 3, "purchase": 2, "fetched": 1, "unchanged": 1, "skipped": 1}


def test_sync_company_caps_fetches_and_survives_a_bad_document():
    class Client(_FakeClient):
        def iter_documents(self, company_id):
            base = _doc()
            return iter([dict(base, id=i) for i in (1, 2, 3)])

        def get_document(self, company_id, doc_id):
            self.fetched.append(doc_id)
            if doc_id == 2:
                raise RuntimeError("boom")
            return dict(_doc(), id=doc_id)

    client = Client()
    docs, counts = ebiuro.sync_company(client, 7189181, None, {}, max_fetch=2)
    assert [d.doc_id for d in docs] == [1]  # 2 failed, 3 hit the cap
    assert counts["fetched"] == 1 and counts["skipped"] == 2 and counts["seen_ids"] == [1, 2, 3]


def test_company_ids_parses_comma_list(monkeypatch):
    monkeypatch.setattr(ebiuro.settings, "ebiuro_company_ids", "7189181, 7189180,x")
    assert ebiuro.company_ids() == [7189181, 7189180]


def test_ebiuro_not_configured_under_suite_env():
    assert ebiuro.is_configured() is False


def test_download_pdf_refuses_foreign_host():
    import pytest as _pytest

    c = ebiuro.EbiuroClient("e", "k", http=lambda *a, **k: (200, b"%PDF"))
    c._token = "t"
    with _pytest.raises(ebiuro.EbiuroApiError):
        c.download_pdf("https://evil.example/x.pdf")
    with _pytest.raises(ebiuro.EbiuroApiError):
        c.download_pdf("http://apps.symfonia.pl/x.pdf")
    assert c.download_pdf("https://apps.symfonia.pl/v2/company/1/document/2/pdf") == b"%PDF"
