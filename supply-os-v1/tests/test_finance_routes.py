"""Finance routes — seed mode gates (503), and the overview/detail/review/alias
flow against a fake Supabase-like backend (no network, no DB)."""
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

import app.main as main_mod
from app import ebiuro
from app.main import app
from app.models import (
    FinanceDocument,
    FinanceDocumentLine,
    FinanceLineAlias,
    FinanceReceiptReview,
    Location,
    Product,
    Receipt,
    ReceiptLine,
    Supplier,
    SupplierProduct,
)

MANAGER = {"Authorization": "Bearer test_manager_token"}
client = TestClient(app)


def test_finance_routes_503_in_seed_mode():
    assert client.get("/api/manager/finance/overview", headers=MANAGER).status_code == 503
    assert client.get("/api/manager/finance/receipt/RCP-1", headers=MANAGER).status_code == 503
    assert client.post("/api/manager/finance/sync", headers=MANAGER).status_code == 503
    assert client.get("/api/manager/finance/document/1/pdf", headers=MANAGER).status_code == 503
    assert client.get("/api/manager/receipt/RCP-1/photos", headers=MANAGER).status_code == 503


def test_finance_routes_require_manager_token():
    assert client.get("/api/manager/finance/overview").status_code == 401


class FakeBackend:
    """Minimal Supabase-shaped backend: KEN Coca-Cola receipt + one eBiuro doc."""

    SUPPORTS_PERSISTENCE = True
    SUPPORTS_FINANCE = True
    __name__ = "fake"

    def __init__(self):
        self.reviews: dict[str, FinanceReceiptReview] = {}
        self.aliases: dict[tuple[str, str], FinanceLineAlias] = {}
        self.receipt = Receipt(
            receipt_id="RCP-20260904-KEN-dadd5b", order_id="ORD-20260902-KEN-COCA-210ea7",
            location_id="KEN", supplier_id="SUP_COCACOLA", receipt_date=date(2026, 9, 4),
            received_by="Khushi", received_submitted_at=datetime(2026, 9, 4, 10, tzinfo=timezone.utc),
            line_count=2, discrepancy_count=0, wz_photo_count=1,
        )
        self.lines = [
            ReceiptLine(receipt_line_id="RL-1", receipt_id=self.receipt.receipt_id,
                        order_id=self.receipt.order_id, order_line_id="OL-1", product_id="P069",
                        supplier_product_id="SP_COCACOLA_P069", ordered_qty_purchase=3,
                        received_qty_purchase=3),
            ReceiptLine(receipt_line_id="RL-2", receipt_id=self.receipt.receipt_id,
                        order_id=self.receipt.order_id, order_line_id="OL-2", product_id="P068",
                        supplier_product_id="SP_COCACOLA_P068", ordered_qty_purchase=2,
                        received_qty_purchase=2),
        ]
        self.doc = FinanceDocument(
            doc_id=77000001, company_id=7189181, company_nip="5223241275",
            contractor_nip="5242106963", contractor_name="Coca-Cola HBC Polska",
            doc_type="Faktura zakupu", invoice_number="2424267999",
            issue_date=date(2026, 9, 4), sell_date=date(2026, 9, 3), netto=311.0, brutto=382.5,
            pdf_url="https://apps.symfonia.pl/x.pdf", state=2,
            synced_at=datetime(2026, 9, 5, 7, tzinfo=timezone.utc),
            last_seen_at=datetime(2026, 9, 5, 7, tzinfo=timezone.utc),
        )
        self.doc_lines = [
            FinanceDocumentLine(doc_id=self.doc.doc_id, ordinal=1, name="0.25 RGB X24 COCA-COLA ZERO",
                                quantity=3, unit="CS", netto=176.62, unit_price_netto=58.87),
            FinanceDocumentLine(doc_id=self.doc.doc_id, ordinal=2, name="0.25 RGB X24 COCA-COLA",
                                quantity=2, unit="CS", netto=121.34, unit_price_netto=60.67),
            FinanceDocumentLine(doc_id=self.doc.doc_id, ordinal=3, name="KAUCJA SKRZYNKA",
                                quantity=5, unit="szt", netto=13.0, unit_price_netto=2.6),
        ]
        self.correction = FinanceDocument(
            doc_id=77000002, company_id=7189181, company_nip="5223241275",
            contractor_nip="5242106963", doc_type="Korekta zakupu", invoice_number="K-1",
            issue_date=date(2026, 9, 5), sell_date=date(2026, 9, 5), netto=-20.0,
        )

    # master data
    def load_products(self):
        return [Product(product_id="P069", product_name_pl="Coca Cola Zero", product_category="drinks",
                        inventory_unit="szt"),
                Product(product_id="P068", product_name_pl="Coca Cola", product_category="drinks",
                        inventory_unit="szt")]

    def load_supplier_products(self):
        return [SupplierProduct(supplier_product_id="SP_COCACOLA_P069", supplier_id="SUP_COCACOLA",
                                product_id="P069", supplier_product_name="Coca Cola Zero",
                                purchase_unit="zgrzewka", units_per_purchase_unit=24,
                                price_estimate_pln=62.4),
                SupplierProduct(supplier_product_id="SP_COCACOLA_P068", supplier_id="SUP_COCACOLA",
                                product_id="P068", supplier_product_name="Coca Cola",
                                purchase_unit="zgrzewka", units_per_purchase_unit=24,
                                price_estimate_pln=64.8)]

    def load_suppliers(self):
        return [Supplier(supplier_id="SUP_COCACOLA", supplier_name="Coca Cola Hub", nip="PL5242106963")]

    def load_locations(self):
        return [Location(location_id="KEN", location_name="KEN", company_nip="5223241275")]

    # receipts
    def load_receipts_since(self, since, location_id=None):
        return [self.receipt]

    def load_receipt_lines_for_receipts(self, ids):
        return self.lines

    def get_receipt(self, receipt_id):
        if receipt_id != self.receipt.receipt_id:
            return None
        return self.receipt.model_copy(update={"lines": self.lines})

    # finance
    def load_finance_documents(self, since, company_ids=None):
        return [self.doc, self.correction]

    def load_finance_document_lines(self, doc_ids):
        return [ln for ln in self.doc_lines if ln.doc_id in doc_ids]

    def get_finance_document(self, doc_id):
        if doc_id == self.doc.doc_id:
            return self.doc.model_copy(update={"lines": self.doc_lines})
        return None

    def load_finance_reviews(self, ids):
        return [r for k, r in self.reviews.items() if k in ids]

    def upsert_finance_review(self, review):
        self.reviews[review.receipt_id] = review

    def load_finance_aliases(self, nips):
        return [a for (nip, _), a in self.aliases.items() if nip in nips]

    def upsert_finance_alias(self, alias):
        self.aliases[(alias.contractor_nip, alias.invoice_name_norm)] = alias


@pytest.fixture
def fake(monkeypatch):
    fb = FakeBackend()
    monkeypatch.setattr(main_mod, "_choose_backend", lambda: fb)
    return fb


def test_overview_pairs_receipt_with_invoice_and_lists_corrections(fake):
    r = client.get("/api/manager/finance/overview?location_id=KEN&days=30", headers=MANAGER)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sync_configured"] is False
    assert len(body["receipts"]) == 1
    item = body["receipts"][0]
    assert item["supplier_nip"] == "5242106963"
    assert item["estimate_netto_pln"] == pytest.approx(3 * 62.4 + 2 * 64.8)
    assert item["best"]["doc_id"] == 77000001 and item["best"]["ok_lines"] == 2
    assert item["best"]["extra_lines"] == 1
    assert item["status"] == "diff"  # extra position (kaucja) → never auto-ok
    assert body["unmatched_documents"] == []  # the doc is used by the receipt
    assert [c["doc_id"] for c in body["corrections"]] == [77000002]


def test_detail_compares_lines_and_review_alias_roundtrip(fake):
    rid = fake.receipt.receipt_id
    r = client.get(f"/api/manager/finance/receipt/{rid}", headers=MANAGER)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["document"]["invoice_number"] == "2424267999"
    assert {ln["product_id"]: ln["status"] for ln in d["lines"]} == {"P069": "ok", "P068": "ok"}
    assert d["lines"][0]["invoice_name"].endswith("ZERO")
    assert [e["invoice_name"] for e in d["extra_lines"]] == ["KAUCJA SKRZYNKA"]
    assert d["photos"] == []  # Storage not configured in tests
    assert d["candidates"][0]["doc_id"] == 77000001

    # alias: teach that KAUCJA is P068 (nonsense, but exercises the loop)
    r = client.post(f"/api/manager/finance/receipt/{rid}/alias", headers=MANAGER,
                    json={"doc_id": 77000001, "invoice_ordinal": 3, "product_id": "P068"})
    assert r.status_code == 200, r.text
    assert ("5242106963", "kaucja skrzynka") in fake.aliases
    after = r.json()
    p068 = next(ln for ln in after["lines"] if ln["product_id"] == "P068")
    assert p068["via_alias"] is True and p068["invoice_name"] == "KAUCJA SKRZYNKA"
    assert [e["invoice_name"] for e in after["extra_lines"]] == ["0.25 RGB X24 COCA-COLA"]

    # review → status override on overview
    r = client.post(f"/api/manager/finance/receipt/{rid}/review", headers=MANAGER,
                    json={"doc_id": 77000001, "status": "confirmed", "note": "ok Beata"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "confirmed" and r.json()["actor"] == "manager"
    o = client.get("/api/manager/finance/overview", headers=MANAGER).json()
    assert o["receipts"][0]["status"] == "confirmed"
    assert o["receipts"][0]["review"]["note"] == "ok Beata"


def test_review_validation_and_404s(fake):
    rid = fake.receipt.receipt_id
    assert client.post(f"/api/manager/finance/receipt/{rid}/review", headers=MANAGER,
                       json={"status": "maybe"}).status_code == 422
    assert client.post("/api/manager/finance/receipt/RCP-nope/review", headers=MANAGER,
                       json={"status": "mismatch"}).status_code == 404
    assert client.post(f"/api/manager/finance/receipt/{rid}/review", headers=MANAGER,
                       json={"doc_id": 1, "status": "mismatch"}).status_code == 404
    assert client.get("/api/manager/finance/receipt/RCP-nope", headers=MANAGER).status_code == 404
    assert client.get(f"/api/manager/finance/receipt/{rid}?doc_id=5", headers=MANAGER).status_code == 404
    r = client.post(f"/api/manager/finance/receipt/{rid}/alias", headers=MANAGER,
                    json={"doc_id": 77000001, "invoice_ordinal": 3, "product_id": "P999"})
    assert r.status_code == 400


def test_review_of_document_outside_window_is_shown_as_best(fake):
    """A confirmed review must display THE reviewed document, not the auto-pick."""
    rid = fake.receipt.receipt_id
    old = fake.doc.model_copy(update={"doc_id": 77000009, "invoice_number": "OLD-1",
                                      "issue_date": date(2026, 8, 1), "sell_date": date(2026, 8, 1)})
    fake.load_finance_documents = lambda since, company_ids=None: [fake.doc, fake.correction, old]
    orig_get = fake.get_finance_document
    fake.get_finance_document = lambda d: old.model_copy(update={"lines": fake.doc_lines}) if d == 77000009 else orig_get(d)
    fake.load_finance_document_lines = lambda ids: [ln.model_copy(update={"doc_id": d}) for d in ids for ln in fake.doc_lines]
    r = client.post(f"/api/manager/finance/receipt/{rid}/review", headers=MANAGER,
                    json={"doc_id": 77000009, "status": "confirmed"})
    assert r.status_code == 200, r.text
    o = client.get("/api/manager/finance/overview", headers=MANAGER).json()
    assert o["receipts"][0]["status"] == "confirmed"
    assert o["receipts"][0]["best"]["doc_id"] == 77000009


def test_pdf_scope_and_unconfigured(fake, monkeypatch):
    # not configured → 503 even for a known document
    r = client.get("/api/manager/finance/document/77000001/pdf", headers=MANAGER)
    assert r.status_code == 503
    assert client.get("/api/manager/finance/document/1/pdf", headers=MANAGER).status_code == 404
    # configured but the document's company is outside the scope → 403
    monkeypatch.setattr(ebiuro.settings, "ebiuro_email", "x@y")
    monkeypatch.setattr(ebiuro.settings, "ebiuro_apikey", type(ebiuro.settings.ebiuro_apikey)("k"))
    monkeypatch.setattr(ebiuro.settings, "ebiuro_company_ids", "7189180")
    assert client.get("/api/manager/finance/document/77000001/pdf", headers=MANAGER).status_code == 403
    # in scope → streams what the client returns
    monkeypatch.setattr(ebiuro.settings, "ebiuro_company_ids", "7189181")
    monkeypatch.setattr(ebiuro.EbiuroClient, "download_pdf", lambda self, url: b"%PDF-1.4 fake")
    r = client.get("/api/manager/finance/document/77000001/pdf", headers=MANAGER)
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/pdf")
    assert r.headers["cache-control"] == "no-store" and r.content.startswith(b"%PDF")


def test_sync_unconfigured_503_and_reentry_guard(fake, monkeypatch):
    assert client.post("/api/manager/finance/sync", headers=MANAGER).status_code == 503
    monkeypatch.setattr(ebiuro.settings, "ebiuro_email", "x@y")
    monkeypatch.setattr(ebiuro.settings, "ebiuro_apikey", type(ebiuro.settings.ebiuro_apikey)("k"))
    monkeypatch.setattr(ebiuro.settings, "ebiuro_company_ids", "7189181")
    calls = {"upserts": 0, "seen": []}
    monkeypatch.setattr(ebiuro.EbiuroClient, "get_companies",
                        lambda self: [{"id": 7189181, "nip": "5223241275"}])
    monkeypatch.setattr(ebiuro, "sync_company",
                        lambda client, cid, nip, known, max_fetch=200: ([fake.doc], {
                            "fetched": 1, "unchanged": 0, "skipped": 0, "seen_ids": [fake.doc.doc_id]}))
    fake.load_finance_fingerprints = lambda cid: {}
    def _upsert(docs):
        calls["upserts"] += len(docs)
        return len(docs)
    fake.upsert_finance_documents = _upsert
    fake.touch_finance_documents_seen = lambda ids, at: calls["seen"].extend(ids)
    main_mod._finance_sync_last_run["at"] = 0.0
    r = client.post("/api/manager/finance/sync", headers=MANAGER)
    assert r.status_code == 200, r.text
    assert r.json() == {"companies": 1, "fetched": 1, "unchanged": 0, "skipped": 0, "upserted": 1}
    assert calls["seen"] == [fake.doc.doc_id]
    assert client.post("/api/manager/finance/sync", headers=MANAGER).status_code == 429
    main_mod._finance_sync_last_run["at"] = 0.0
