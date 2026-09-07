"""Pure matching of goods receipts against eBiuro purchase documents.

No I/O — the route layer loads receipts, master data, documents and aliases and
hands them here. Suggest-only: nothing here decides anything for finance, it
ranks candidates and compares quantities so a human can confirm.

Two levels:

- **Documents** (`candidate_documents`): same supplier NIP (+ same company NIP
  when both are known), purchase type, and a date window around the receipt
  date. Scored by date proximity, amount proximity vs the receipt's price
  estimate, and how many received lines the document explains.
- **Lines** (`compare_lines`): each received line is paired with the invoice
  position whose name best covers ours (learned aliases win outright), then
  quantities are compared in purchase units — or, when that fails, in base
  units (``received × units_per_purchase_unit``, e.g. 2 wiadra × 3 kg = 6 kg).
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from .models import (
    FinanceCandidate,
    FinanceDocument,
    FinanceDocumentLine,
    FinanceExtraLine,
    FinanceLineCompare,
)

# Tokens that carry no product identity on Polish wholesale invoices.
_STOP = {
    "kraj", "poch", "pochodzenia", "polska", "klasa", "i", "ii", "waga", "sztuka",
    "szt", "kg", "opak", "odmiana", "kaliber", "x", "cs", "tacka", "myta",
}
# Tiny spelling bridge between our catalogue and common invoice wording.
_SYNONYMS = {"awokado": "avocado", "cocacola": "coca cola", "salatka": "salata"}
# Unit labels collapsed to a family so "szt." / "sztuka" / "pcs" compare equal and
# "CS" / "karton" / "zgrzewka" compare equal. Unknown labels map to themselves.
_UNIT_FAMILY = {
    "szt": "szt", "sztuka": "szt", "sztuk": "szt", "pcs": "szt", "pc": "szt",
    "opak": "opak", "opakowanie": "opak", "op.": "opak", "op": "opak",
    "kg": "kg", "g": "g", "gram": "g",
    "l": "l", "ml": "ml", "litr": "l",
    "cs": "karton", "karton": "karton", "kart": "karton", "zgrzewka": "karton", "zgrz": "karton",
    "skrzynka": "karton", "case": "karton",
    "wiadro": "wiadro", "wiaderko": "wiadro",
}

NAME_MATCH_THRESHOLD = 0.5
QTY_ABS_TOL = 0.051
QTY_REL_TOL = 0.02
SELL_WINDOW_BEFORE = 4
SELL_WINDOW_AFTER = 1
ISSUE_WINDOW_BEFORE = 1
ISSUE_WINDOW_AFTER = 14


def strip_diacritics(s: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", s) if not unicodedata.combining(ch)
    ).replace("ł", "l").replace("Ł", "L")


def normalize_name(s: Optional[str]) -> str:
    """Lowercase, no diacritics, punctuation → space, single-spaced."""
    if not s:
        return ""
    s = strip_diacritics(s).lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = " ".join(s.split())
    for k, v in _SYNONYMS.items():
        s = re.sub(rf"\b{k}\b", v, s)
    return s


def tokens(s: Optional[str]) -> set[str]:
    return {t for t in normalize_name(s).split() if t not in _STOP}


def name_score(our_names: list[str], invoice_name: str) -> float:
    """Best over our names of: coverage (our tokens found on the invoice) with a
    small Jaccard tie-breaker so 'Coca Cola Zero' beats 'Coca Cola' for the
    ZERO position."""
    inv = tokens(invoice_name)
    if not inv:
        return 0.0
    best = 0.0
    for name in our_names:
        ours = tokens(name)
        if not ours:
            continue
        hit = len(ours & inv)
        coverage = hit / len(ours)
        jaccard = hit / len(ours | inv)
        best = max(best, coverage + 0.1 * jaccard)
    return best


@dataclass
class ReceiptLineView:
    """What the matcher needs about one received line (built by the route)."""
    order_line_id: str
    product_id: str
    product_name_pl: str
    supplier_product_name: str
    purchase_unit: str
    units_per_purchase_unit: float
    received_qty_purchase: float
    price_estimate_pln: Optional[float] = None
    extra_names: list[str] = field(default_factory=list)

    @property
    def names(self) -> list[str]:
        out = [self.supplier_product_name, self.product_name_pl, *self.extra_names]
        return [n for n in out if n]


def is_correction(doc: FinanceDocument) -> bool:
    t = (doc.doc_type or "").lower()
    return "korekt" in t or (doc.netto is not None and doc.netto < 0)


def is_purchase_doc(doc: FinanceDocument) -> bool:
    return "zakup" in (doc.doc_type or "").lower()


def unit_family(label: Optional[str]) -> str:
    key = normalize_name(label).replace(" ", "")
    return _UNIT_FAMILY.get(key, key)


def _qty_status(received: float, invoice_qty: Optional[float]) -> tuple[str, Optional[float]]:
    if invoice_qty is None:
        return "qty_diff", None
    delta = round(invoice_qty - received, 3)
    tol = max(QTY_ABS_TOL, QTY_REL_TOL * max(abs(received), abs(invoice_qty)))
    return ("ok" if abs(delta) <= tol else "qty_diff"), delta


def compare_lines(
    receipt_lines: list[ReceiptLineView],
    doc_lines: list[FinanceDocumentLine],
    aliases: Optional[dict[str, str]] = None,
) -> tuple[list[FinanceLineCompare], list[FinanceExtraLine]]:
    """Pair received lines with invoice positions and compare quantities.

    ``aliases`` maps a normalized invoice name → product_id (learned). Greedy:
    alias pairs first (score 2.0), then best name score ≥ threshold, one
    invoice position per received line and vice versa.
    """
    aliases = aliases or {}
    pairs: list[tuple[float, int, int, bool]] = []  # (score, ri, di, via_alias)
    for ri, rl in enumerate(receipt_lines):
        for di, dl in enumerate(doc_lines):
            norm = normalize_name(dl.name)
            if aliases.get(norm) == rl.product_id:
                pairs.append((2.0, ri, di, True))
                continue
            s = name_score(rl.names, dl.name)
            if s >= NAME_MATCH_THRESHOLD:
                pairs.append((s, ri, di, False))
    pairs.sort(key=lambda p: (-p[0], p[1], p[2]))

    used_r: set[int] = set()
    used_d: set[int] = set()
    chosen: dict[int, tuple[int, float, bool]] = {}
    for score, ri, di, via in pairs:
        if ri in used_r or di in used_d:
            continue
        used_r.add(ri)
        used_d.add(di)
        chosen[ri] = (di, score, via)

    out: list[FinanceLineCompare] = []
    for ri, rl in enumerate(receipt_lines):
        base = dict(
            order_line_id=rl.order_line_id,
            product_id=rl.product_id,
            product_name_pl=rl.product_name_pl,
            purchase_unit=rl.purchase_unit,
            received_qty_purchase=rl.received_qty_purchase,
        )
        if ri not in chosen:
            out.append(FinanceLineCompare(status="not_on_invoice", **base))
            continue
        di, score, via = chosen[ri]
        dl = doc_lines[di]
        status, delta = _qty_status(rl.received_qty_purchase, dl.quantity)
        unit_note: Optional[str] = None
        upp = rl.units_per_purchase_unit or 1.0
        # The base-unit conversion is tried ONLY when the invoice unit is a different
        # family than our purchase unit (review blocker 2: 48 CS vs 2 zgrzewki × 24
        # must NOT read as ok). A converted agreement is `ok_converted`, never `ok`.
        units_differ = unit_family(dl.unit) != unit_family(rl.purchase_unit)
        if status != "ok" and dl.quantity is not None and upp != 1.0 and units_differ:
            alt_status, alt_delta = _qty_status(rl.received_qty_purchase * upp, dl.quantity)
            if alt_status == "ok":
                status, delta = "ok_converted", alt_delta
                unit_note = (
                    f"{rl.received_qty_purchase:g} {rl.purchase_unit} × {upp:g} = "
                    f"{rl.received_qty_purchase * upp:g} {dl.unit or ''}".strip()
                )
        out.append(
            FinanceLineCompare(
                invoice_ordinal=dl.ordinal,
                invoice_name=dl.name,
                invoice_qty=dl.quantity,
                invoice_unit=dl.unit,
                invoice_unit_price_netto=dl.unit_price_netto,
                invoice_netto=dl.netto,
                delta_qty=delta,
                status=status,
                via_alias=via,
                unit_note=unit_note,
                match_score=round(score, 3),
                **base,
            )
        )
    extras = [
        FinanceExtraLine(
            invoice_ordinal=dl.ordinal,
            invoice_name=dl.name,
            invoice_qty=dl.quantity,
            invoice_unit=dl.unit,
            invoice_netto=dl.netto,
        )
        for di, dl in enumerate(doc_lines)
        if di not in used_d
    ]
    return out, extras


def in_window(doc: FinanceDocument, receipt_date: date) -> bool:
    if doc.sell_date is not None:
        lo = receipt_date - timedelta(days=SELL_WINDOW_BEFORE)
        hi = receipt_date + timedelta(days=SELL_WINDOW_AFTER)
        if lo <= doc.sell_date <= hi:
            return True
    if doc.issue_date is not None:
        lo = receipt_date - timedelta(days=ISSUE_WINDOW_BEFORE)
        hi = receipt_date + timedelta(days=ISSUE_WINDOW_AFTER)
        if lo <= doc.issue_date <= hi:
            return True
    return False


def candidate_documents(
    receipt_date: date,
    supplier_nip: Optional[str],
    company_nip: Optional[str],
    receipt_lines: list[ReceiptLineView],
    docs: list[FinanceDocument],
    aliases: Optional[dict[str, str]] = None,
    estimate_netto: Optional[float] = None,
    ignore_window: bool = False,
) -> list[FinanceCandidate]:
    """Rank documents that could be THIS receipt's invoice. Empty when the
    supplier has no NIP configured (nothing to key on). ``ignore_window`` is
    used to score a Manager-chosen document that sits outside the date window."""
    if not supplier_nip:
        return []
    ranked: list[tuple[tuple, FinanceCandidate]] = []
    for doc in docs:
        if doc.contractor_nip != supplier_nip or not is_purchase_doc(doc):
            continue
        if is_correction(doc):
            continue  # korekty are listed in their own section, never matched
        # A document that knows its buyer must be OUR buyer; when our side has no
        # company NIP (location not configured) such a document is excluded rather
        # than paired across spółki (impl-review F1).
        if doc.company_nip and doc.company_nip != company_nip:
            continue
        if not ignore_window and not in_window(doc, receipt_date):
            continue
        lines, extras = compare_lines(receipt_lines, doc.lines, aliases)
        ok = sum(1 for ln in lines if ln.status == "ok")
        diff = sum(1 for ln in lines if ln.status == "qty_diff")
        missing = sum(1 for ln in lines if ln.status == "not_on_invoice")
        ok_conv = sum(1 for ln in lines if ln.status == "ok_converted")
        anchor = doc.sell_date or doc.issue_date or receipt_date
        days = abs((anchor - receipt_date).days)
        matched_ratio = (ok + ok_conv + diff) / len(lines) if lines else 0.0
        amount_gap = (
            abs(doc.netto - estimate_netto)
            if (estimate_netto is not None and doc.netto is not None)
            else None
        )
        # Rank tuple (no tuned constants): explains more lines > closer date > closer amount.
        rank = (-round(matched_ratio, 3), days, amount_gap if amount_gap is not None else 1e12)
        ranked.append((rank,
            FinanceCandidate(
                doc_id=doc.doc_id,
                doc_type=doc.doc_type,
                invoice_number=doc.invoice_number,
                ksef_number=doc.ksef_number,
                issue_date=doc.issue_date,
                sell_date=doc.sell_date,
                netto=doc.netto,
                brutto=doc.brutto,
                is_correction=False,
                score=round(matched_ratio, 3),
                matched_ratio=round(matched_ratio, 3),
                days_off=days,
                amount_gap=round(amount_gap, 2) if amount_gap is not None else None,
                ok_lines=ok,
                ok_converted_lines=ok_conv,
                diff_lines=diff,
                missing_lines=missing,
                extra_lines=len(extras),
            ),
        ))
    ranked.sort(key=lambda rc: (rc[0], rc[1].doc_id))
    return [c for _, c in ranked]


def receipt_status(best: Optional[FinanceCandidate], estimate_netto: Optional[float]) -> str:
    """Advisory roll-up (review blocker 3 / major 7):

    - ``no_invoice``: no candidate.
    - ``unsure``: the candidate explains < 30 % of our lines and (when an estimate
      exists) the amount is > 25 % off — shown grey, never as a verdict.
    - ``possible_collective``: invoice has positions we did not receive AND its
      netto exceeds 1.5 × our estimate — a collective invoice (Blue Service,
      Coca-Cola per address) rather than a real discrepancy.
    - ``ok``: every line ok, no extra positions, amount within 10 % when known.
    - ``diff``: anything else (qty_diff / not_on_invoice / ok_converted / extras).
    The UI renders green "Zgodne" ONLY for a confirmed review.
    """
    if best is None:
        return "no_invoice"
    gap_ratio: Optional[float] = None
    if estimate_netto and best.netto is not None and estimate_netto > 0:
        gap_ratio = abs(best.netto - estimate_netto) / estimate_netto
    if best.matched_ratio < 0.3 and (gap_ratio is None or gap_ratio > 0.25):
        return "unsure"
    if best.extra_lines > 0 and estimate_netto and best.netto is not None:
        if best.netto > 1.5 * estimate_netto:
            return "possible_collective"
    all_ok = (
        best.ok_lines > 0
        and best.diff_lines == 0
        and best.missing_lines == 0
        and best.ok_converted_lines == 0
        and best.extra_lines == 0
    )
    if all_ok and (gap_ratio is None or gap_ratio <= 0.10):
        return "ok"
    return "diff"
