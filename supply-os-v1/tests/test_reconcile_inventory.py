"""Tests for `scripts/reconcile_inventory.py` — the Inwentaryzacja-sheet
reconciliation engine (Phase A1 of change `multi-location-master-data`).

Fixtures under `tests/fixtures/inventory_sheets/` are REAL snippets cut from
the downloaded per-location sheets (not synthetic), except `synthetic_sheet.json`
+ `synthetic_snapshot/`, which are hand-built specifically to exercise every
`reconcile()` finding type against a small, fully-known catalog.
"""
import json
import pathlib

import pytest

from scripts.reconcile_inventory import (
    MatchResult,
    PriceRow,
    Report,
    SheetData,
    Snapshot,
    _to_float,  # noqa: F401 -- internal helper, tested directly for one edge case
    match_catalog,
    normalize_name,
    parse_sheet,
    reconcile,
    render_report,
)

FIXTURES = pathlib.Path(__file__).parent / "fixtures" / "inventory_sheets"


def _load_json_sheet(name: str) -> str:
    data = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return data["fileContent"]


# ---------- normalize_name ----------


class TestNormalizeName:
    def test_strips_diacritics_and_casefolds(self):
        assert normalize_name("Liść Laurowy") == "lisc laurowy"

    def test_strips_digit_glued_to_last_word(self):
        assert normalize_name("Liść Laurowy2") == "lisc laurowy"
        assert normalize_name("Cappy Jabłko8") == "cappy jablko"

    def test_keeps_inner_numbers(self):
        assert normalize_name("Rolki do kasy 57 na 20") == "rolki do kasy 57 na 20"

    def test_collapses_whitespace(self):
        assert normalize_name("  Kasza   Pęczak  ") == "kasza peczak"

    def test_keeps_digit_letter_token_that_is_not_the_last_token(self):
        # "5g" is not the LAST token here, so it must survive untouched.
        assert normalize_name("Cukier w saszetkach 5g") == "cukier w saszetkach 5g"

    def test_empty_and_none_safe(self):
        assert normalize_name("") == ""


# ---------- parse_sheet: price-list rows ----------


class TestParsePriceRows:
    def test_price_rows_with_minmax_norblin(self):
        sheet = parse_sheet(_load_json_sheet("norblin_snippet.json"))
        by_product = {r.product: r for r in sheet.price_rows}
        row = by_product["Bowl opakowanie papierowe miska 1300 ml"]
        assert row.supplier == "Blue Service"
        assert row.category == "Opakowania"
        assert row.min_qty == 1
        assert row.max_qty == 2
        assert row.price == pytest.approx(22.20)
        assert row.vat == "23%"

        cytryna = by_product["Cytryna"]
        assert cytryna.supplier == "Bukat"
        assert cytryna.min_qty == pytest.approx(0.5)
        assert cytryna.max_qty == 2
        assert cytryna.price == pytest.approx(9.40)
        # Norblin's VAT column is blank for Chłodnia rows.
        assert cytryna.vat is None

    def test_price_rows_without_minmax_bracka(self):
        sheet = parse_sheet(_load_json_sheet("bracka_snippet.json"))
        by_product = {r.product: r for r in sheet.price_rows}
        row = by_product["Masło MR 500g"]
        assert row.supplier == "Intermlecz"
        assert row.min_qty is None
        assert row.max_qty is None
        assert row.price == pytest.approx(6.27)
        assert row.vat is None

    def test_tolerates_ref_and_merged_garbage(self):
        # bracka_snippet carries a literal `\#REF\!` product name and
        # `\[merged\]` stock-cell garbage; parsing must not raise.
        sheet = parse_sheet(_load_json_sheet("bracka_snippet.json"))
        garbage_products = [r.product for r in sheet.price_rows if "REF" in r.product]
        assert garbage_products  # the garbage row was parsed, not dropped/crashed
        row = next(r for r in sheet.price_rows if "REF" in r.product)
        assert row.supplier == "Blue Service"
        assert row.price == pytest.approx(11.60)
        assert row.vat == "23%"

    def test_price_header_with_blank_supplier_label_elektrownia(self):
        # elektrownia's price-list header has a genuinely BLANK cell where
        # every other sheet names "Dostawca" — the data rows still carry a
        # real supplier there. Discovered via a full-corpus smoke run
        # (elektrownia parsed to zero price rows before this fix).
        sheet = parse_sheet(_load_json_sheet("elektrownia_snippet.json"))
        by_product = {r.product: r for r in sheet.price_rows}
        assert by_product["Cytryna"].supplier == "Bukat"
        assert by_product["Masło MR 500g"].supplier == "Intermlecz"

    def test_to_float_tolerates_nonbreaking_space_thousands_separator(self):
        # Real "Wartość" cells use a non-breaking space (U+00A0) as thousands
        # separator, e.g. "2\xa0881,10 zł" (elektrownia) — a plain " ".replace
        # would not strip it and silently turn any price >= 1000 into None.
        assert _to_float("2\xa0881,10 zł") == pytest.approx(2881.10)

    def test_dedupe_keeps_first_occurrence(self):
        sheet = parse_sheet(_load_json_sheet("synthetic_sheet.json"))
        cytryna_rows = [
            r for r in sheet.price_rows if r.product == "Cytryna" and r.supplier == "Bukat"
        ]
        assert len(cytryna_rows) == 1
        assert cytryna_rows[0].price == pytest.approx(9.40)  # not the later 99.99


# ---------- parse_sheet: stock rows ----------


class TestParseStockRows:
    def test_two_column_stock_layout_both_sides_captured(self):
        sheet = parse_sheet(_load_json_sheet("norblin_snippet.json"))
        stock_pairs = {(r.supplier, r.product) for r in sheet.stock_rows}
        # left column of the two-column table
        assert ("Bukat", "Cytryna") in stock_pairs
        # right column of the SAME row
        assert ("Intermlecz", "Frytura Eppo 15L") in stock_pairs

    def test_stock_row_unit_captured(self):
        sheet = parse_sheet(_load_json_sheet("norblin_snippet.json"))
        row = next(r for r in sheet.stock_rows if r.product == "Cytryna")
        assert row.unit.casefold() == "kg"

    def test_category_first_stock_variant(self):
        sheet = parse_sheet(_load_json_sheet("bracka_snippet.json"))
        stock_pairs = {(r.supplier, r.product) for r in sheet.stock_rows}
        assert ("Blue Service", "Bowl opakowanie papierowe miska 1300 ml") in stock_pairs

    def test_merged_garbage_does_not_break_stock_parsing(self):
        sheet = parse_sheet(_load_json_sheet("bracka_snippet.json"))
        stock_pairs = {(r.supplier, r.product) for r in sheet.stock_rows}
        assert ("Pita Bros", "Ladolimono") in stock_pairs


# ---------- parse_sheet: westfield format ----------


class TestParseWestfield:
    def test_westfield_rows_parsed_with_supplier_annotation_stripped(self):
        text = (FIXTURES / "westfield_snippet.md").read_text(encoding="utf-8")
        sheet = parse_sheet(text)
        by_product = {r.product: r for r in sheet.price_rows}
        row = by_product["Tzatzyki"]
        # "Bukat (stock sheet: Pago)" -> supplier is just "Bukat"
        assert row.supplier == "Bukat"
        assert row.category == "Chłodnia"
        assert row.price == pytest.approx(40.00)

    def test_westfield_plain_supplier_row(self):
        text = (FIXTURES / "westfield_snippet.md").read_text(encoding="utf-8")
        sheet = parse_sheet(text)
        by_product = {r.product: r for r in sheet.price_rows}
        row = by_product["Cytryna"]
        assert row.supplier == "Selgros"
        assert row.price == pytest.approx(9.40)

    def test_westfield_auto_detected_without_explicit_format(self):
        # parse_sheet(text) with the default fmt="auto" must still route
        # westfield's non-pipe-table grammar to the secondary parser.
        text = (FIXTURES / "westfield_snippet.md").read_text(encoding="utf-8")
        sheet = parse_sheet(text, fmt="auto")
        assert len(sheet.price_rows) > 10
        assert sheet.stock_rows == []


# ---------- match_catalog ----------


class TestMatchCatalog:
    CATALOG = {
        "cytryna": "P001",
        "papryka zielona": "P002",
        "lisc laurowy": "P003",
    }

    def test_exact_match(self):
        result = match_catalog(["Cytryna"], self.CATALOG)
        assert result.matched["Cytryna"] == "P001"
        assert "Cytryna" not in result.near_miss
        assert "Cytryna" not in result.unmatched

    def test_near_miss_is_not_auto_linked(self):
        # "Sukier w saszetkach" isn't in our tiny catalog at all, but a
        # single-letter typo of "Papryka zielona" (a genuine one-edit typo)
        # must land as a NEAR MISS candidate, never in `matched`.
        result = match_catalog(["Papryka zielna"], self.CATALOG)
        assert "Papryka zielna" not in result.matched
        assert result.near_miss.get("Papryka zielna") == "P002"

    def test_unmatched_when_too_different(self):
        result = match_catalog(["Zupełnie inny produkt"], self.CATALOG)
        assert "Zupełnie inny produkt" not in result.matched
        assert "Zupełnie inny produkt" not in result.near_miss
        assert "Zupełnie inny produkt" in result.unmatched

    def test_result_is_matchresult_dataclass(self):
        result = match_catalog(["Cytryna"], self.CATALOG)
        assert isinstance(result, MatchResult)


# ---------- Snapshot ----------


class TestSnapshot:
    def test_loads_synthetic_snapshot(self):
        snapshot = Snapshot.load(str(FIXTURES / "synthetic_snapshot"))
        assert len(snapshot.products) == 8
        assert "cytryna" in snapshot.catalog
        assert snapshot.catalog["cytryna"] == "P001"

    def test_suppliers_for_product(self):
        snapshot = Snapshot.load(str(FIXTURES / "synthetic_snapshot"))
        assert snapshot.suppliers_for_product("P001") == {"Bukat"}


# ---------- reconcile() ----------


@pytest.fixture()
def synthetic_report() -> Report:
    sheet = parse_sheet(_load_json_sheet("synthetic_sheet.json"))
    snapshot = Snapshot.load(str(FIXTURES / "synthetic_snapshot"))
    return reconcile(sheet, snapshot)


class TestReconcile:
    def test_missing_products(self, synthetic_report: Report):
        names = {item["product"] for item in synthetic_report.missing_products}
        assert "Nowy Produkt XYZ" in names

    def test_missing_products_excludes_near_miss(self, synthetic_report: Report):
        # A near-miss name has a candidate and is reported separately via
        # `near_misses` — it must not ALSO inflate `missing_products` (a hard
        # gap with no candidate at all), else resolving a near-miss can never
        # be observed as the "Missing" count shrinking.
        names = {item["product"] for item in synthetic_report.missing_products}
        assert "Sukier w saszetkach 5g" not in names

    def test_supplier_conflict(self, synthetic_report: Report):
        conflicts = {c["product_id"]: c for c in synthetic_report.supplier_conflicts}
        assert "P002" in conflicts
        assert conflicts["P002"]["sheet_supplier"] == "Selgros"
        assert "Bukat" in conflicts["P002"]["snapshot_suppliers"]

    def test_no_conflict_when_supplier_matches(self, synthetic_report: Report):
        conflicts = {c["product_id"] for c in synthetic_report.supplier_conflicts}
        assert "P001" not in conflicts  # Cytryna/Bukat matches the catalog

    def test_dual_supplier_in_sheet(self, synthetic_report: Report):
        assert "Liść Laurowy" in synthetic_report.dual_supplier_in_sheet
        suppliers = set(synthetic_report.dual_supplier_in_sheet["Liść Laurowy"])
        assert suppliers == {"Intermlecz", "Selgros"}

    def test_stock_vs_pricelist_conflict(self, synthetic_report: Report):
        conflicting = {c["product"] for c in synthetic_report.stock_vs_pricelist_conflicts}
        assert "Coca Cola" in conflicting

    def test_stock_vs_pricelist_no_conflict_when_overlap(self, synthetic_report: Report):
        conflicting = {c["product"] for c in synthetic_report.stock_vs_pricelist_conflicts}
        assert "Cytryna" not in conflicting

    def test_unit_mismatch_detected(self, synthetic_report: Report):
        mismatches = {m["product_id"]: m for m in synthetic_report.unit_mismatches}
        assert "P006" in mismatches  # Worki na śmiecie: sheet "Kg" vs catalog "szt"

    def test_unit_equivalence_szt_dot_not_flagged(self, synthetic_report: Report):
        mismatches = {m["product_id"] for m in synthetic_report.unit_mismatches}
        assert "P008" not in mismatches  # sheet "szt." vs catalog "szt"

    def test_unit_equivalence_ltr_not_flagged(self, synthetic_report: Report):
        mismatches = {m["product_id"] for m in synthetic_report.unit_mismatches}
        assert "P007" not in mismatches  # sheet "Ltr" vs catalog "l"

    def test_minmax_coverage_counts(self, synthetic_report: Report):
        cov = synthetic_report.minmax_coverage
        assert cov["total_price_rows"] > 0
        assert cov["with_min_max"] >= 1
        assert cov["without_min_max"] >= 1
        assert cov["with_min_max"] + cov["without_min_max"] == cov["total_price_rows"]

    def test_near_miss_passthrough(self, synthetic_report: Report):
        # "Sukier w saszetkach 5g" is a 1-edit typo of catalog's
        # "Cukier w saszetkach 5g" (P005) and must surface as a near-miss,
        # never silently auto-linked into a match.
        assert "Sukier w saszetkach 5g" in synthetic_report.near_misses
        assert synthetic_report.near_misses["Sukier w saszetkach 5g"] == "P005"


# ---------- render_report ----------


class TestRenderReport:
    def test_smoke_sections_present(self, synthetic_report: Report):
        text = render_report("TESTLOC", synthetic_report)
        assert "# TESTLOC" in text or "TESTLOC" in text
        for heading in (
            "Missing products",
            "Supplier conflicts",
            "Dual supplier",
            "Stock vs price",
            "Unit mismatch",
            "Min/max coverage",
            "Gaps for the operator",
        ):
            assert heading in text, f"missing section heading: {heading!r}"


# ---------- F1: supplier alias false positives (coordinator review 2026-08-21) ----------


def _one_product_snapshot(
    product_id: str,
    product_name_pl: str,
    supplier_id: str,
    supplier_name: str,
    inventory_unit: str = "kg",
) -> Snapshot:
    """Minimal single-product/single-supplier Snapshot for a focused
    reconcile() test — avoids touching the shared `synthetic_snapshot`
    fixture (used by many other tests) just to exercise one alias pairing."""
    return Snapshot(
        products=[
            {
                "product_id": product_id,
                "product_name_pl": product_name_pl,
                "product_category": "Produkcja",
                "inventory_unit": inventory_unit,
                "is_critical": False,
                "active": True,
            }
        ],
        suppliers=[
            {
                "supplier_id": supplier_id,
                "supplier_name": supplier_name,
                "ordering_method": "manual",
                "active": True,
                "email_is_null": True,
            }
        ],
        locations=[],
        supplier_products=[
            {
                "supplier_product_id": f"SP_{supplier_id}_{product_id}",
                "supplier_id": supplier_id,
                "product_id": product_id,
                "purchase_unit": inventory_unit,
                "units_per_purchase_unit": 1,
                "rounding_rule": "full_only",
                "price_estimate_pln": 0.0,
                "active": True,
            }
        ],
        location_product_settings=[],
    )


class TestSupplierAlias:
    def test_pita_bros_alias_is_not_a_conflict(self):
        sheet = SheetData(
            price_rows=[
                PriceRow(
                    category="Produkcja",
                    supplier="Pita Bros",
                    product="Spicy Mayo",
                    unit="kg",
                    min_qty=None,
                    max_qty=None,
                    price=15.57,
                    vat=None,
                )
            ],
            stock_rows=[],
        )
        snapshot = _one_product_snapshot(
            "P200", "Spicy Mayo", "SUP_INTERNAL", "Pita Bros (internal production)"
        )
        report = reconcile(sheet, snapshot)
        assert report.supplier_conflicts == []

    def test_kuchnie_swiata_ascii_alias_is_not_a_conflict(self):
        sheet = SheetData(
            price_rows=[
                PriceRow(
                    category="Mrożonki",
                    supplier="Kuchnie Swiata",
                    product="Falafel",
                    unit="kg",
                    min_qty=None,
                    max_qty=None,
                    price=160.0,
                    vat=None,
                )
            ],
            stock_rows=[],
        )
        snapshot = _one_product_snapshot("P020", "Falafel", "SUP_KUCHNIE", "Kuchnie Świata")
        report = reconcile(sheet, snapshot)
        assert report.supplier_conflicts == []

    def test_genuinely_different_supplier_still_a_conflict(self):
        # Sanity check: aliasing must not swallow a REAL conflict.
        sheet = SheetData(
            price_rows=[
                PriceRow(
                    category="Chłodnia",
                    supplier="Selgros",
                    product="Cytryna",
                    unit="kg",
                    min_qty=None,
                    max_qty=None,
                    price=9.0,
                    vat=None,
                )
            ],
            stock_rows=[],
        )
        snapshot = _one_product_snapshot("P001", "Cytryna", "SUP_BUKAT", "Bukat")
        report = reconcile(sheet, snapshot)
        assert len(report.supplier_conflicts) == 1
        assert report.supplier_conflicts[0]["sheet_supplier"] == "Selgros"


# ---------- F2: token-subset near-miss (coordinator review 2026-08-21) ----------


class TestTokenSubsetNearMiss:
    """Real cases from westfield.md that must land in `near_miss` (never
    `matched`, never silently dropped to `unmatched`) once the parenthetical
    annotation on the catalog side is accounted for — plus negative cases
    that must NOT be dragged out of `unmatched` by the same mechanism."""

    _RAW_CATALOG_PRODUCTS = {
        "P021": "Frytki Aviko (opakowania)",
        "P026": "Pita (opakowania) szt 10",
        "P024": "Gyros 15 KG",
        "P025": "Gyros 25 KG",
        "P037": "Gyros (ścięty + nieścięty)",
        "P090": "Papier do Pita (PB)",
        "P023": "Fasolka Szparagowa (op.)",
        "P045": "Oliwa z Oliwek 1L",
        "P136": "Corfu Lager",
        "P137": "Corfu Weiss",
        "P138": "Corfu Free",
        "P128": "Rolki do kasy 57 na 20",
        "P129": "Rolki do kasy 80 na 80",
        "P130": "Rolki do kasy 57 na 30",
        "P142": "Rolki do kasy 57 na 50",
    }
    CATALOG = {normalize_name(name): pid for pid, name in _RAW_CATALOG_PRODUCTS.items()}

    @pytest.mark.parametrize(
        "sheet_name,expected_pid",
        [
            ("Frytki Aviko", "P021"),
            ("Pita", "P026"),
            ("Papier do Pita", "P090"),
            ("Fasolka Szparagowa", "P023"),
            ("Oliwa z Oliwek Extra Virgin 1L", "P045"),
        ],
    )
    def test_positive_cases_land_in_near_miss(self, sheet_name: str, expected_pid: str):
        result = match_catalog([sheet_name], self.CATALOG)
        assert sheet_name not in result.matched
        assert sheet_name not in result.unmatched
        assert result.near_miss.get(sheet_name) == expected_pid

    def test_gyros_lands_in_near_miss_some_candidate(self):
        # Three plausible catalog candidates (15 KG / 25 KG / ścięty +
        # nieścięty) — the coordinator's ask is only that "Gyros" surfaces as
        # a near-miss at all, not which one wins the tie.
        result = match_catalog(["Gyros"], self.CATALOG)
        assert "Gyros" not in result.matched
        assert "Gyros" not in result.unmatched
        assert "Gyros" in result.near_miss

    @pytest.mark.parametrize(
        "sheet_name",
        ["Corfu Radler", "Bifteki burgers", "Rolki do kasy 80 na 20"],
    )
    def test_negative_cases_stay_unmatched(self, sheet_name: str):
        result = match_catalog([sheet_name], self.CATALOG)
        assert sheet_name not in result.matched
        assert sheet_name not in result.near_miss
        assert sheet_name in result.unmatched
