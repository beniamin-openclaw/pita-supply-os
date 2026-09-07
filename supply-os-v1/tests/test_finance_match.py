"""Pure matching rules — names, quantities, aliases, candidate ranking."""
from datetime import date

from app import finance_match as fm
from app.models import FinanceDocument, FinanceDocumentLine


def _rl(oid, pid, name, unit="zgrzewka", upp=24.0, qty=1.0, spn=None, price=None):
    return fm.ReceiptLineView(
        order_line_id=oid, product_id=pid, product_name_pl=name,
        supplier_product_name=spn or name, purchase_unit=unit,
        units_per_purchase_unit=upp, received_qty_purchase=qty, price_estimate_pln=price,
    )


def _dl(doc_id, ordinal, name, qty, unit="CS", netto=None, price=None):
    return FinanceDocumentLine(doc_id=doc_id, ordinal=ordinal, name=name, quantity=qty,
                               unit=unit, netto=netto, unit_price_netto=price)


COCA_DOC_LINES = [
    _dl(1, 1, "0.25 RGB X24 COCA-COLA ZERO", 3.0),
    _dl(1, 2, "0.25 RGB X24 COCA-COLA", 2.0),
    _dl(1, 3, "0.33 CAN X24 FUZETEA BRZOSKWINIA", 1.0),
    _dl(1, 4, "KAUCJA SKRZYNKA", 5.0, unit="szt"),
]


def test_normalize_and_tokens():
    assert fm.normalize_name("Sałata Rucola Myta tacka 100g") == "salata rucola myta tacka 100g"
    assert fm.tokens("Cytryna (waga), klasa: I, Kraj poch: RPA") == {"cytryna", "rpa"}
    assert fm.tokens("Awokado") == {"avocado"}


def test_compare_lines_coca_cola_zero_beats_plain_cola():
    ours = [
        _rl("OL-1", "P068", "Coca Cola", qty=2.0),
        _rl("OL-2", "P069", "Coca Cola Zero", qty=3.0),
        _rl("OL-3", "P081", "Fuzetea", unit="zgrzewka", upp=12.0, qty=1.0),
        _rl("OL-4", "P080", "Corona 0%", qty=1.0),
    ]
    lines, extras = fm.compare_lines(ours, COCA_DOC_LINES)
    by = {ln.product_id: ln for ln in lines}
    assert by["P069"].invoice_name.endswith("ZERO") and by["P069"].status == "ok"
    assert by["P068"].invoice_name == "0.25 RGB X24 COCA-COLA" and by["P068"].status == "ok"
    assert by["P081"].status == "ok"
    assert by["P080"].status == "not_on_invoice"
    assert [e.invoice_name for e in extras] == ["KAUCJA SKRZYNKA"]


def test_qty_diff_and_tolerance():
    ours = [_rl("OL-1", "P069", "Coca Cola Zero", qty=2.0)]
    lines, _ = fm.compare_lines(ours, [_dl(1, 1, "0.25 RGB X24 COCA-COLA ZERO", 3.0)])
    assert lines[0].status == "qty_diff" and lines[0].delta_qty == 1.0
    lines, _ = fm.compare_lines(
        [_rl("OL-1", "P006", "Pomidor", unit="kg", upp=1.0, qty=18.0)],
        [_dl(1, 1, "Pomidor (waga) Okrągły Czerwony Kraj poch: Polska", 18.2, unit="kg")],
    )
    assert lines[0].status == "ok"  # 1.1 % within the 2 % tolerance


def test_unit_conversion_only_when_units_differ_and_is_amber():
    ours = [_rl("OL-1", "P011", "Tzatzyki", unit="wiadro", upp=3.0, qty=2.0)]
    lines, _ = fm.compare_lines(ours, [_dl(1, 1, "Tzatzyki sos 1kg", 6.0, unit="kg")])
    assert lines[0].status == "ok_converted"
    assert lines[0].unit_note == "2 wiadro × 3 = 6 kg"
    # Same unit family (CS == zgrzewka): 48 CS vs 2 zgrzewki × 24 must stay a difference.
    ours = [_rl("OL-1", "P069", "Coca Cola Zero", unit="zgrzewka", upp=24.0, qty=2.0)]
    lines, _ = fm.compare_lines(ours, [_dl(1, 1, "0.25 RGB X24 COCA-COLA ZERO", 48.0, unit="CS")])
    assert lines[0].status == "qty_diff" and lines[0].unit_note is None
    assert fm.unit_family("szt.") == fm.unit_family("sztuka") == "szt"


def test_alias_wins_over_name_score():
    ours = [_rl("OL-1", "P004", "Awokado", unit="szt", upp=1.0, qty=3.0),
            _rl("OL-2", "P008", "Sałata bolero mix 150gr", unit="opak", upp=1.0, qty=5.0)]
    doc = [_dl(1, 1, "Avocado (sztuka) Kraj poch: Rpa/Guatemala", 3.0, unit="szt."),
           _dl(1, 2, "Mioorto Sałatka Fantasia 150g (sztuka) Kraj poch: Włochy", 5.0, unit="szt.")]
    lines, extras = fm.compare_lines(ours, doc)
    assert lines[0].status == "ok" and not lines[0].via_alias  # synonym bridge
    assert lines[1].status == "not_on_invoice" and len(extras) == 1
    aliases = {fm.normalize_name(doc[1].name): "P008"}
    lines, extras = fm.compare_lines(ours, doc, aliases)
    assert lines[1].status == "ok" and lines[1].via_alias and extras == []


def _doc(doc_id, nip, sell, issue, netto, lines, doc_type="Faktura zakupu", company="5223241275"):
    return FinanceDocument(doc_id=doc_id, company_id=7189181, company_nip=company,
                           contractor_nip=nip, doc_type=doc_type, sell_date=sell,
                           issue_date=issue, netto=netto, lines=lines)


def test_candidate_documents_window_nip_company_and_ranking():
    ours = [_rl("OL-1", "P069", "Coca Cola Zero", qty=3.0), _rl("OL-2", "P068", "Coca Cola", qty=2.0)]
    docs = [
        _doc(10, "5242106963", date(2026, 9, 3), date(2026, 9, 4), 300.0, COCA_DOC_LINES),
        _doc(11, "5242106963", date(2026, 8, 19), date(2026, 8, 20), 464.66, COCA_DOC_LINES),  # too old
        _doc(12, "1182242889", date(2026, 9, 3), date(2026, 9, 4), 300.0, COCA_DOC_LINES),  # Bukat
        _doc(13, "5242106963", date(2026, 9, 3), date(2026, 9, 4), 300.0, COCA_DOC_LINES,
             company="9522100633"),  # other spółka
        _doc(14, "5242106963", date(2026, 9, 4), date(2026, 9, 4), -50.0, [],
             doc_type="Korekta zakupu"),
        _doc(15, "5242106963", date(2026, 9, 2), date(2026, 9, 2), 2000.0, [], doc_type="Faktura sprzedaży"),
    ]
    cands = fm.candidate_documents(date(2026, 9, 4), "5242106963", "5223241275", ours, docs,
                                   estimate_netto=310.0)
    assert [c.doc_id for c in cands] == [10]  # korekta 14 excluded, others filtered
    assert cands[0].ok_lines == 2 and cands[0].extra_lines == 2 and cands[0].matched_ratio == 1.0
    assert cands[0].days_off == 1 and cands[0].amount_gap == 10.0
    # extras present but amount close → diff (not collective)
    assert fm.receipt_status(cands[0], 310.0) == "diff"
    assert fm.receipt_status(None, None) == "no_invoice"
    assert fm.candidate_documents(date(2026, 9, 4), None, None, ours, docs) == []


def test_ranking_prefers_lines_over_date():
    ours = [_rl("OL-1", "P069", "Coca Cola Zero", qty=3.0)]
    near_wrong = _doc(20, "5242106963", date(2026, 9, 4), date(2026, 9, 4), 100.0,
                      [_dl(20, 1, "KAUCJA SKRZYNKA", 5.0)])
    far_right = _doc(21, "5242106963", date(2026, 9, 2), date(2026, 9, 2), 100.0, COCA_DOC_LINES)
    cands = fm.candidate_documents(date(2026, 9, 4), "5242106963", "5223241275", ours, [near_wrong, far_right])
    assert [c.doc_id for c in cands] == [21, 20]
    # our side has no company NIP → a document that names a buyer is never paired (F1)
    assert fm.candidate_documents(date(2026, 9, 4), "5242106963", None, ours, [near_wrong]) == []
    # a document without buyer NIP is still allowed
    nobuyer = _doc(22, "5242106963", date(2026, 9, 4), date(2026, 9, 4), 100.0, COCA_DOC_LINES, company=None)
    assert [c.doc_id for c in fm.candidate_documents(date(2026, 9, 4), "5242106963", None, ours, [nobuyer])] == [22]
    # ignore_window scores a manager-chosen document outside the window
    old = _doc(23, "5242106963", date(2026, 8, 1), date(2026, 8, 1), 100.0, COCA_DOC_LINES)
    assert fm.candidate_documents(date(2026, 9, 4), "5242106963", "5223241275", ours, [old]) == []
    assert [c.doc_id for c in fm.candidate_documents(date(2026, 9, 4), "5242106963", "5223241275", ours, [old], ignore_window=True)] == [23]


def test_receipt_status_rollup_rules():
    c = fm.FinanceCandidate(doc_id=1, matched_ratio=1.0, ok_lines=3, netto=100.0)
    assert fm.receipt_status(c, 95.0) == "ok"
    assert fm.receipt_status(c, None) == "ok"  # no estimate → amount term dropped
    assert fm.receipt_status(c, 60.0) == "diff"  # amount 66 % off
    c = fm.FinanceCandidate(doc_id=1, matched_ratio=1.0, ok_lines=3, missing_lines=1)
    assert fm.receipt_status(c, None) == "diff"
    c = fm.FinanceCandidate(doc_id=1, matched_ratio=1.0, ok_lines=2, ok_converted_lines=1)
    assert fm.receipt_status(c, None) == "diff"
    c = fm.FinanceCandidate(doc_id=1, matched_ratio=1.0, ok_lines=4, extra_lines=12, netto=1000.0)
    assert fm.receipt_status(c, 300.0) == "possible_collective"
    c = fm.FinanceCandidate(doc_id=1, matched_ratio=0.1, ok_lines=1, missing_lines=9, netto=900.0)
    assert fm.receipt_status(c, 300.0) == "unsure"
    assert fm.receipt_status(c, None) == "unsure"
