"""Unit tests for the seed CSV loader."""
import time
from pathlib import Path

import pytest

from app.models import Product
from app.seed_loader import _normalize, _read, _read_cached


# ---------- _normalize ----------

def test_normalize_empty_string_to_none():
    assert _normalize({"a": "val", "b": ""}) == {"a": "val", "b": None}


def test_normalize_strips_whitespace():
    assert _normalize({"a": "  val  ", "b": "   "}) == {"a": "val", "b": None}


def test_normalize_true_false_case_insensitive():
    assert _normalize({"f1": "TRUE", "f2": "FALSE", "f3": "true"}) == {
        "f1": True,
        "f2": False,
        "f3": True,
    }


def test_normalize_skips_none_keys():
    out = _normalize({"a": "val", None: "ignored"})
    assert "a" in out
    assert None not in out


# ---------- _read ----------

def test_read_product_csv(tmp_path: Path):
    csv_path = tmp_path / "products.csv"
    csv_path.write_text(
        "product_id,gostock_id,product_name_pl,product_category,inventory_unit,is_critical,active,notes\n"
        "P001,1,Halloumi,Chłodnia,kg,TRUE,TRUE,\n"
        "P002,,Sól,Spożywcze,kg,FALSE,TRUE,Standard salt\n",
        encoding="utf-8",
    )
    products = _read(csv_path, Product)
    assert len(products) == 2
    assert products[0].product_id == "P001"
    assert products[0].is_critical is True
    assert products[1].gostock_id is None
    assert products[1].notes == "Standard salt"


def test_read_polish_diacritics_preserved(tmp_path: Path):
    csv_path = tmp_path / "products.csv"
    csv_path.write_text(
        "product_id,gostock_id,product_name_pl,product_category,inventory_unit,is_critical,active,notes\n"
        "P003,3,Pomidor żółty,Chłodnia,kg,FALSE,TRUE,Żółty rodzaj\n",
        encoding="utf-8",
    )
    products = _read(csv_path, Product)
    assert products[0].product_name_pl == "Pomidor żółty"
    assert products[0].notes == "Żółty rodzaj"


def test_read_missing_file_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        _read(tmp_path / "missing.csv", Product)


# ---------- _read_cached ----------

def test_cache_hits_on_unchanged_file(tmp_path: Path):
    csv_path = tmp_path / "products.csv"
    csv_path.write_text(
        "product_id,gostock_id,product_name_pl,product_category,inventory_unit,is_critical,active,notes\n"
        "P001,1,Halloumi,Chłodnia,kg,TRUE,TRUE,\n",
        encoding="utf-8",
    )
    first = _read_cached(csv_path, Product)
    second = _read_cached(csv_path, Product)
    # Same list object reference proves cache hit (not a re-parse).
    assert first is second


def test_cache_invalidates_on_mtime_change(tmp_path: Path):
    csv_path = tmp_path / "products.csv"
    csv_path.write_text(
        "product_id,gostock_id,product_name_pl,product_category,inventory_unit,is_critical,active,notes\n"
        "P001,1,Halloumi,Chłodnia,kg,TRUE,TRUE,\n",
        encoding="utf-8",
    )
    first = _read_cached(csv_path, Product)
    assert len(first) == 1

    time.sleep(0.05)  # ensure mtime ticks
    csv_path.write_text(
        "product_id,gostock_id,product_name_pl,product_category,inventory_unit,is_critical,active,notes\n"
        "P001,1,Halloumi,Chłodnia,kg,TRUE,TRUE,\n"
        "P002,2,Feta,Chłodnia,kg,TRUE,TRUE,\n",
        encoding="utf-8",
    )
    second = _read_cached(csv_path, Product)
    assert len(second) == 2
    assert first is not second  # cache invalidated and re-parsed


# ---------- load_location_product_usage (dynamic-target-wola) ----------

def test_load_location_product_usage_missing_file_returns_empty(mocker, tmp_path: Path):
    """The usage CSV is OPTIONAL master data — a seed dir without it means "no
    dynamic targets", not an error."""
    from app import seed_loader
    mocker.patch.object(seed_loader.settings, "seed_dir", tmp_path)
    assert seed_loader.load_location_product_usage() == []


def test_load_location_product_usage_reads_rows(mocker, tmp_path: Path):
    from app import seed_loader
    (tmp_path / "location_product_usage.csv").write_text(
        "usage_id,location_id,product_id,usage_per_day_base,confidence,basis,source,"
        "as_of,safety_days,active,notes\n"
        "WOLA__P024,WOLA,P024,12.75,A,purch+teoret+real,gostock,2026-08-30,1,TRUE,\n",
        encoding="utf-8",
    )
    mocker.patch.object(seed_loader.settings, "seed_dir", tmp_path)
    rows = seed_loader.load_location_product_usage()
    assert len(rows) == 1
    assert rows[0].usage_per_day_base == 12.75
    assert rows[0].confidence == "A"
    assert rows[0].as_of.isoformat() == "2026-08-30"


def test_repo_seed_carries_the_wola_usage_rows():
    """The committed seed dir ships the 18 WOLA rows from the GoStock analysis."""
    from app import seed_loader
    rows = seed_loader.load_location_product_usage()
    assert len(rows) == 18
    assert {r.location_id for r in rows} == {"WOLA"}
    by_pid = {r.product_id: r for r in rows}
    assert by_pid["P024"].usage_per_day_base == 12.75 and by_pid["P024"].confidence == "A"
    assert by_pid["P079"].confidence == "C"


def test_load_location_product_usage_skips_a_bad_row_and_keeps_the_rest(mocker, tmp_path: Path):
    """One malformed cell must not empty the whole table (adversarial #1)."""
    from app import seed_loader
    (tmp_path / "location_product_usage.csv").write_text(
        "usage_id,location_id,product_id,usage_per_day_base,confidence,basis,source,"
        "as_of,safety_days,active,notes\n"
        "KEN__BAD,KEN,P024,-1,A,,,,1,TRUE,\n"
        "WOLA__P024,WOLA,P024,12.75,A,,,,1,TRUE,\n"
        "WOLA__TXT,WOLA,P026,abc,A,,,,1,TRUE,\n",
        encoding="utf-8",
    )
    mocker.patch.object(seed_loader.settings, "seed_dir", tmp_path)
    rows = seed_loader.load_location_product_usage()
    assert [r.usage_id for r in rows] == ["WOLA__P024"]
