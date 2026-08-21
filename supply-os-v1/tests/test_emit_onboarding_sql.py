"""Tests for `scripts/emit_onboarding_sql.py` (Phase B1 of change
`multi-location-master-data`).

The golden-file scenario (`tests/fixtures/onboarding_sql/`) is a tiny,
hand-built snapshot + one onboarding sheet ("westfield", a real
LOCATION_MAP entry) covering, in one pass:

  - one new supplier (Selgros)                          -> batch 00
  - one new product ("Zupelnie Nowy Produkt")            -> batch 01
  - one new (supplier, product) pair with packaging
    COPIED from an existing catalog row (Selgros/Cytryna
    copies from SP_BUKAT_P001)                           -> batch 02
  - one new pair with packaging TBC (Selgros/the new
    product, no existing catalog row to copy from)       -> batch 02
  - settings WITH min/max (Cytryna) and WITHOUT (Papryka
    zielona, the new product)                            -> batch 10
  - one activation pin AT the onboarding location itself
    (Cytryna: sheet names only Selgros, but the catalog
    now has 2 carriers)                                  -> batch 20 (a)
  - one activation pin AT a live location (WOLA gets
    pinned to its pre-existing supplier, Bukat, the first
    time Cytryna gains a second carrier)                 -> batch 20 (b)
  - one substitute left NULL (Papryka zielona: the sheet
    names BOTH Bukat and Pago for it)                    -> batch 20 (substitutes)

Expected SQL text is captured once (`golden.json`), hand-reviewed for
correctness against the scenario above, then locked in as a regression
guard — a rerun over an unchanged fixture must be byte-identical
(determinism is itself a requirement of this module).
"""
import json
import pathlib

from scripts.emit_onboarding_sql import (
    ONBOARDING_SHEET_STEMS,
    build_activation_plans,
    build_supplier_id_map,
    collect_location_settings,
    collect_new_pairs,
    collect_new_products,
    discover_missing_suppliers,
    emit_batch_00,
    emit_batch_01,
    emit_batch_02,
    emit_batch_03,
    emit_batch_10,
    emit_batch_20,
)
from scripts.reconcile_inventory import SheetData, Snapshot, match_catalog, parse_sheet

FIXTURES = pathlib.Path(__file__).parent / "fixtures" / "onboarding_sql"
GOLDEN = json.loads((FIXTURES / "golden.json").read_text(encoding="utf-8"))


def _load_scenario():
    snapshot = Snapshot.load(str(FIXTURES / "onboarding_snapshot"))
    westfield_text = json.loads(
        (FIXTURES / "westfield_onboarding_snippet.json").read_text(encoding="utf-8")
    )["fileContent"]
    westfield_sheet = parse_sheet(westfield_text)
    empty = SheetData(price_rows=[], stock_rows=[])
    sheets = {stem: empty for stem in ONBOARDING_SHEET_STEMS if stem != "westfield"}
    sheets["westfield"] = westfield_sheet
    return snapshot, sheets, westfield_sheet


class TestGoldenBatches:
    def test_batch_00_shared_suppliers(self):
        snapshot, sheets, _ = _load_scenario()
        new_suppliers = discover_missing_suppliers(sheets, snapshot)
        assert new_suppliers == ["Selgros"]
        supplier_id_map = build_supplier_id_map(snapshot, new_suppliers)
        assert supplier_id_map["Selgros"] == "SUP_SELGROS"
        assert emit_batch_00(new_suppliers, supplier_id_map) == GOLDEN["BATCH_00"]

    def test_batch_01_new_products(self):
        snapshot, sheets, _ = _load_scenario()
        new_products, new_product_by_norm, _ = collect_new_products(sheets, snapshot)
        assert [p.product_id for p in new_products] == ["P003"]
        assert new_products[0].name == "Zupelnie Nowy Produkt"
        assert new_products[0].category == "Spożywcze"
        assert new_products[0].inventory_unit == "kg"
        assert new_product_by_norm["zupelnie nowy produkt"] == "P003"
        assert emit_batch_01(new_products) == GOLDEN["BATCH_01"]

    def test_batch_02_new_pairs(self):
        snapshot, sheets, _ = _load_scenario()
        new_suppliers = discover_missing_suppliers(sheets, snapshot)
        supplier_id_map = build_supplier_id_map(snapshot, new_suppliers)
        _, new_product_by_norm, _ = collect_new_products(sheets, snapshot)
        new_pairs = collect_new_pairs(sheets, snapshot, supplier_id_map, new_product_by_norm)

        by_id = {p.supplier_product_id: p for p in new_pairs}
        assert set(by_id) == {"SP_SELGROS_P001", "SP_SELGROS_P003"}
        assert by_id["SP_SELGROS_P001"].notes == "packaging copied from SP_BUKAT_P001"
        assert by_id["SP_SELGROS_P001"].units_per_purchase_unit == 1
        assert by_id["SP_SELGROS_P001"].rounding_rule == "tenth_kg"
        assert by_id["SP_SELGROS_P003"].notes == "packaging TBC"
        assert by_id["SP_SELGROS_P003"].units_per_purchase_unit == 1.0
        assert by_id["SP_SELGROS_P003"].rounding_rule == "full_only"

        text = emit_batch_02(new_pairs)
        assert text == GOLDEN["BATCH_02"]
        # Explicit F1 guard: this batch must NEVER emit an active row.
        assert "active = TRUE" not in text
        assert ", TRUE," not in text

    def test_batch_03_locations(self):
        text = emit_batch_03()
        assert text == GOLDEN["BATCH_03"]

    def test_batch_10_settings(self):
        snapshot, sheets, westfield_sheet = _load_scenario()
        _, new_product_by_norm, _ = collect_new_products(sheets, snapshot)
        rows = collect_location_settings(westfield_sheet, snapshot.catalog, new_product_by_norm)
        by_pid = {r.product_id: r for r in rows}
        assert set(by_pid) == {"P001", "P002", "P003"}
        assert by_pid["P001"].min_qty == 1 and by_pid["P001"].max_qty == 3
        assert by_pid["P001"].notes == ""
        assert by_pid["P002"].notes == "threshold TBC (sheet had no min/max)"
        assert by_pid["P003"].notes == "threshold TBC (sheet had no min/max)"
        assert emit_batch_10("WESTFIELD", rows) == GOLDEN["BATCH_10"]

    def test_batch_20_activation(self):
        snapshot, sheets, westfield_sheet = _load_scenario()
        new_suppliers = discover_missing_suppliers(sheets, snapshot)
        supplier_id_map = build_supplier_id_map(snapshot, new_suppliers)
        _, new_product_by_norm, _ = collect_new_products(sheets, snapshot)
        new_pairs = collect_new_pairs(sheets, snapshot, supplier_id_map, new_product_by_norm)
        plans = build_activation_plans(
            sheets, snapshot, supplier_id_map, new_product_by_norm, new_pairs
        )
        plan = plans["westfield"]

        assert plan.loc_id == "WESTFIELD"
        assert plan.own_pins == [("P001", "SUP_SELGROS")]
        assert plan.live_pins == [("WOLA", "P001", "SUP_BUKAT")]
        assert plan.substitutes == [("P002", ["Bukat", "Pago"])]
        assert set(plan.activate_supplier_product_ids) == {
            "SP_SELGROS_P001",
            "SP_SELGROS_P003",
        }

        text = emit_batch_20("westfield", plan)
        assert text == GOLDEN["BATCH_20"]


class TestBatch01NeverEmitsNearMiss:
    def test_near_miss_name_is_excluded_from_new_products(self):
        # A near-miss (not exact, not a hard gap) must never mint a new
        # product row — it needs a human decision (near_misses report),
        # not an auto-created catalog entry.
        snapshot = Snapshot.load(str(FIXTURES / "onboarding_snapshot"))
        # "Papryka zielna" is a genuine 1-edit typo of the snapshot's
        # "Papryka zielona" (P002) — confirm the assumption this test
        # relies on before asserting the exclusion.
        match = match_catalog(["Papryka zielna"], snapshot.catalog)
        assert match.near_miss.get("Papryka zielna") == "P002"

        near_miss_sheet_text = (
            "|  | Kategoria | Dostawca | Produkt | Ilość | Jedn. Miary | Cena | "
            "Cena za jednostkę miary | VAT | Wartość |\n"
            "| 1 | Chłodnia | Bukat | Papryka zielna |  | Kg | 20,00 zł | 20,00 zł |  | 0,00 zł |\n"
        )
        near_miss_sheet = parse_sheet(near_miss_sheet_text)
        empty = SheetData(price_rows=[], stock_rows=[])
        sheets = {stem: empty for stem in ONBOARDING_SHEET_STEMS if stem != "westfield"}
        sheets["westfield"] = near_miss_sheet

        new_products, new_product_by_norm, _ = collect_new_products(sheets, snapshot)
        names = {p.name for p in new_products}
        assert "Papryka zielna" not in names
        assert "papryka zielna" not in new_product_by_norm
        text = emit_batch_01(new_products)
        assert "Papryka zielna" not in text


class TestSpreadsheetErrorFiltered:
    def test_ref_error_literal_is_not_a_new_product(self):
        # A literal Excel/Sheets error artifact ("\#REF\!", found in bracka's
        # price list — a corrupted cell, not a product) must never be minted
        # as a new product row.
        snapshot = Snapshot.load(str(FIXTURES / "onboarding_snapshot"))
        error_sheet_text = (
            "|  | Kategoria | Dostawca | Produkt | Ilość | Jedn. Miary | Cena | "
            "Cena za jednostkę miary | VAT | Wartość |\n"
            "| 1 | Chemia | Bukat | \\#REF\\! |  | Szt | 11,60 zł | 11,60 zł | 23% | 58,00 zł |\n"
        )
        error_sheet = parse_sheet(error_sheet_text)
        empty = SheetData(price_rows=[], stock_rows=[])
        sheets = {stem: empty for stem in ONBOARDING_SHEET_STEMS if stem != "westfield"}
        sheets["westfield"] = error_sheet

        new_products, _, _ = collect_new_products(sheets, snapshot)
        assert new_products == []


class TestQuarantineCascade:
    def test_quarantined_product_produces_no_downstream_sql(self):
        # "milk" (a lowercase singleton — rule c) must produce NO product row
        # (batch 01), NO supplier_products pair (batch 02), NO settings row
        # (batch 10), and NO activation reference/pin (batch 20) — the whole
        # point of quarantine is that it never reaches prod at all.
        snapshot = Snapshot.load(str(FIXTURES / "onboarding_snapshot"))
        cascade_sheet_text = (
            "|  | Kategoria | Dostawca | Produkt | Ilość | Jedn. Miary | Minimalna ilość | "
            "Maksymalna ilość | jednostka miary | Cena | Cena za jednostkę miary | VAT | "
            "Wartość |\n"
            "| 1 | Chłodnia | Selgros | Cytryna |  | Kg | 1 | 3 | Kg | 8,00 zł | 8,00 zł | "
            "23% | 0,00 zł |\n"
            "| 2 | Spożywcze | Selgros | milk |  | Szt | 1 | 3 | Szt | 4,00 zł | 4,00 zł | "
            "23% | 0,00 zł |\n"
        )
        cascade_sheet = parse_sheet(cascade_sheet_text)
        empty = SheetData(price_rows=[], stock_rows=[])
        sheets = {stem: empty for stem in ONBOARDING_SHEET_STEMS if stem != "westfield"}
        sheets["westfield"] = cascade_sheet

        new_products, new_product_by_norm, quarantined_groups = collect_new_products(
            sheets, snapshot
        )
        # "milk" quarantined, not minted.
        assert "milk" not in {p.name for p in new_products}
        assert "milk" not in new_product_by_norm
        quarantined_names = {e.name for g in quarantined_groups for e in g.entries}
        assert "milk" in quarantined_names
        rules = {g.rule for g in quarantined_groups if any(e.name == "milk" for e in g.entries)}
        assert rules == {"c"}

        batch01_text = emit_batch_01(new_products)
        assert "milk" not in batch01_text

        new_suppliers = discover_missing_suppliers(sheets, snapshot)
        supplier_id_map = build_supplier_id_map(snapshot, new_suppliers)
        new_pairs = collect_new_pairs(sheets, snapshot, supplier_id_map, new_product_by_norm)
        assert all("milk" not in p.supplier_product_name for p in new_pairs)
        batch02_text = emit_batch_02(new_pairs)
        assert "milk" not in batch02_text

        settings_rows = collect_location_settings(
            cascade_sheet, snapshot.catalog, new_product_by_norm
        )
        # Only Cytryna (P001) gets a settings row — "milk" resolved to no pid.
        assert {r.product_id for r in settings_rows} == {"P001"}

        plans = build_activation_plans(
            sheets, snapshot, supplier_id_map, new_product_by_norm, new_pairs
        )
        plan = plans["westfield"]
        batch20_text = emit_batch_20("westfield", plan)
        assert "milk" not in batch20_text
        assert all("milk" not in pid for pid in plan.activate_supplier_product_ids)
