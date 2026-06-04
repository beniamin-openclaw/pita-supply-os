"""Unit tests for the Google Sheets read-side adapter (`app.sheets`).

All tests mock gspread at the `_open_worksheet` layer so no real network
calls are made. Tests should run in <1s total.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from gspread.exceptions import APIError, SpreadsheetNotFound

from app import sheets
from app.models import (
    Location,
    LocationProductSetting,
    Product,
    Supplier,
    SupplierProduct,
)


# ---------- Fixtures / helpers ----------

PRODUCT_HEADERS = [
    "product_id",
    "gostock_id",
    "product_name_pl",
    "product_category",
    "inventory_unit",
    "is_critical",
    "active",
    "notes",
]
SUPPLIER_HEADERS = [
    "supplier_id",
    "supplier_name",
    "email",
    "ordering_method",
    "delivery_days",
    "cutoff_time",
    "minimum_order_value_pln",
    "active",
    "notes",
]
LOCATION_HEADERS = [
    "location_id",
    "location_name",
    "delivery_address",
    "city",
    "active",
    "notes",
]
SUPPLIER_PRODUCT_HEADERS = [
    "supplier_product_id",
    "supplier_id",
    "product_id",
    "supplier_product_name",
    "purchase_unit",
    "units_per_purchase_unit",
    "rounding_rule",
    "price_estimate_pln",
    "active",
    "notes",
]
LOCATION_PRODUCT_SETTING_HEADERS = [
    "setting_id",
    "location_id",
    "product_id",
    "min_stock_qty_base",
    "max_stock_qty_base",
    "target_stock_qty_base",
    "is_critical_for_location",
    "allow_over_max_due_to_packaging",
    "notes",
]


def _mk_worksheet(headers: list[str], records: list[dict]) -> MagicMock:
    ws = MagicMock()
    ws.row_values.return_value = headers
    ws.get_all_records.return_value = records
    return ws


def _mk_api_error(code: int) -> APIError:
    """Build an APIError without going through a real requests.Response."""
    err = APIError.__new__(APIError)
    err.response = None  # type: ignore[attr-defined]
    err.error = {"code": code, "message": f"mock {code}", "status": "MOCK"}
    err.code = code
    Exception.__init__(err, err.error)
    return err


@pytest.fixture(autouse=True)
def _reset_module_state(mocker):
    """Reset module-level singletons + caches before every test, and pin sheet_id."""
    sheets._client_instance = None
    sheets._sheet_instance = None
    sheets._ttl_cache.clear()
    # Ensure cache keys are stable across tests regardless of env.
    mocker.patch.object(sheets.settings, "google_sheet_id", "TEST_SHEET_ID")
    yield
    sheets._client_instance = None
    sheets._sheet_instance = None
    sheets._ttl_cache.clear()


# ---------- load_products ----------

def test_load_products_happy_path(mocker):
    rows = [
        {
            "product_id": "P001",
            "gostock_id": 1,
            "product_name_pl": "Halloumi",
            "product_category": "Chłodnia",
            "inventory_unit": "kg",
            "is_critical": "TRUE",
            "active": "TRUE",
            "notes": "",
        },
        {
            "product_id": "P002",
            "gostock_id": "",
            "product_name_pl": "Sól",
            "product_category": "Spożywcze",
            "inventory_unit": "kg",
            "is_critical": "FALSE",
            "active": "TRUE",
            "notes": "Standard salt",
        },
        {
            "product_id": "P003",
            "gostock_id": 3,
            "product_name_pl": "Pomidor żółty",
            "product_category": "Chłodnia",
            "inventory_unit": "kg",
            "is_critical": "FALSE",
            "active": "TRUE",
            "notes": "",
        },
    ]
    ws = _mk_worksheet(PRODUCT_HEADERS, rows)
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    products = sheets.load_products()

    assert len(products) == 3
    assert all(isinstance(p, Product) for p in products)
    assert products[0].product_id == "P001"
    assert products[0].is_critical is True
    assert products[1].gostock_id is None
    assert products[1].notes == "Standard salt"
    assert products[2].product_name_pl == "Pomidor żółty"


def test_load_products_empty(mocker):
    ws = _mk_worksheet(PRODUCT_HEADERS, [])
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    assert sheets.load_products() == []


def test_load_products_header_mismatch(mocker):
    bad_headers = ["product_id", "product_name_pl"]  # missing several required fields
    ws = _mk_worksheet(bad_headers, [])
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    with pytest.raises(sheets.ConfigDriftError) as exc:
        sheets.load_products()
    assert "products" in str(exc.value)
    assert "missing" in str(exc.value)


def test_load_products_allows_extra_columns(mocker):
    """Operators may add notes/scratch columns — extras must not break the read."""
    extra_headers = PRODUCT_HEADERS + ["operator_scratch"]
    rows = [
        {
            "product_id": "P001",
            "gostock_id": 1,
            "product_name_pl": "Halloumi",
            "product_category": "Chłodnia",
            "inventory_unit": "kg",
            "is_critical": "TRUE",
            "active": "TRUE",
            "notes": "",
            "operator_scratch": "ignored",
        },
    ]
    ws = _mk_worksheet(extra_headers, rows)
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    products = sheets.load_products()
    assert len(products) == 1
    assert products[0].product_id == "P001"


# ---------- load_suppliers / load_locations / load_supplier_products / load_location_product_settings ----------

def test_load_suppliers_happy_path(mocker):
    rows = [
        {
            "supplier_id": "S001",
            "supplier_name": "Sernik Sp. z o.o.",
            "email": "orders@sernik.pl",
            "ordering_method": "email",
            "delivery_days": "Mon,Wed,Fri",
            "cutoff_time": "14:00",
            "minimum_order_value_pln": 200.0,
            "active": "TRUE",
            "notes": "",
        }
    ]
    ws = _mk_worksheet(SUPPLIER_HEADERS, rows)
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    suppliers = sheets.load_suppliers()
    assert len(suppliers) == 1
    assert isinstance(suppliers[0], Supplier)
    assert suppliers[0].supplier_id == "S001"
    assert suppliers[0].active is True
    assert suppliers[0].minimum_order_value_pln == 200.0


def test_load_locations_happy_path(mocker):
    rows = [
        {
            "location_id": "WOLA",
            "location_name": "Pita Bros Wola",
            "delivery_address": "ul. Wolska 1",
            "city": "Warszawa",
            "active": "TRUE",
            "notes": "",
        }
    ]
    ws = _mk_worksheet(LOCATION_HEADERS, rows)
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    locations = sheets.load_locations()
    assert len(locations) == 1
    assert isinstance(locations[0], Location)
    assert locations[0].location_id == "WOLA"
    # Boolean coercion (not the string "TRUE")
    assert locations[0].active is True


def test_load_supplier_products_happy_path(mocker):
    rows = [
        {
            "supplier_product_id": "SP001",
            "supplier_id": "S001",
            "product_id": "P001",
            "supplier_product_name": "Halloumi 200g",
            "purchase_unit": "szt",
            "units_per_purchase_unit": 0.2,
            "rounding_rule": "full_only",
            "price_estimate_pln": 12.5,
            "active": "TRUE",
            "notes": "",
        }
    ]
    ws = _mk_worksheet(SUPPLIER_PRODUCT_HEADERS, rows)
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sp = sheets.load_supplier_products()
    assert len(sp) == 1
    assert isinstance(sp[0], SupplierProduct)
    assert sp[0].supplier_product_id == "SP001"
    assert sp[0].units_per_purchase_unit == 0.2


def test_load_location_product_settings_happy_path(mocker):
    rows = [
        {
            "setting_id": "LS001",
            "location_id": "WOLA",
            "product_id": "P001",
            "min_stock_qty_base": 2.0,
            "max_stock_qty_base": 10.0,
            "target_stock_qty_base": 6.0,
            "is_critical_for_location": "TRUE",
            "allow_over_max_due_to_packaging": "FALSE",
            "notes": "",
        }
    ]
    ws = _mk_worksheet(LOCATION_PRODUCT_SETTING_HEADERS, rows)
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    settings_list = sheets.load_location_product_settings()
    assert len(settings_list) == 1
    assert isinstance(settings_list[0], LocationProductSetting)
    assert settings_list[0].is_critical_for_location is True
    assert settings_list[0].allow_over_max_due_to_packaging is False


# ---------- load_meta ----------

def test_load_meta_returns_dict(mocker):
    rows = [
        {"key": "pilot_location", "value": "WOLA"},
        {"key": "last_seed_load", "value": "2026-05-23"},
        {"key": "schema_version", "value": "v1"},
    ]
    # _meta tab has two columns: key, value
    ws = _mk_worksheet(["key", "value"], rows)
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    meta = sheets.load_meta()
    assert isinstance(meta, dict)
    assert meta["pilot_location"] == "WOLA"
    assert meta["last_seed_load"] == "2026-05-23"
    assert meta["schema_version"] == "v1"


# ---------- TTL cache ----------

def test_ttl_cache_hits_within_window(mocker):
    rows = [
        {
            "product_id": "P001",
            "gostock_id": 1,
            "product_name_pl": "Halloumi",
            "product_category": "Chłodnia",
            "inventory_unit": "kg",
            "is_critical": "TRUE",
            "active": "TRUE",
            "notes": "",
        }
    ]
    ws = _mk_worksheet(PRODUCT_HEADERS, rows)
    open_ws = mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    first = sheets.load_products()
    second = sheets.load_products()

    assert first is second  # cached object reference returned on hit
    assert open_ws.call_count == 1
    assert ws.get_all_records.call_count == 1


def test_ttl_cache_expires_after_ttl(mocker):
    rows = [
        {
            "product_id": "P001",
            "gostock_id": 1,
            "product_name_pl": "Halloumi",
            "product_category": "Chłodnia",
            "inventory_unit": "kg",
            "is_critical": "TRUE",
            "active": "TRUE",
            "notes": "",
        }
    ]
    ws = _mk_worksheet(PRODUCT_HEADERS, rows)
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    # Freeze clock at t=1000, then jump past TTL.
    fake_now = {"t": 1000.0}
    mocker.patch.object(sheets.time, "time", side_effect=lambda: fake_now["t"])

    sheets.load_products()
    assert ws.get_all_records.call_count == 1

    # Within TTL window
    fake_now["t"] = 1000.0 + sheets.DEFAULT_TTL_SECONDS - 1
    sheets.load_products()
    assert ws.get_all_records.call_count == 1  # still cached

    # Past TTL window
    fake_now["t"] = 1000.0 + sheets.DEFAULT_TTL_SECONDS + 1
    sheets.load_products()
    assert ws.get_all_records.call_count == 2  # re-fetched


def test_invalidate_cache_specific_worksheet(mocker):
    rows = [
        {
            "product_id": "P001",
            "gostock_id": 1,
            "product_name_pl": "Halloumi",
            "product_category": "Chłodnia",
            "inventory_unit": "kg",
            "is_critical": "TRUE",
            "active": "TRUE",
            "notes": "",
        }
    ]
    ws = _mk_worksheet(PRODUCT_HEADERS, rows)
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)

    sheets.load_products()
    sheets.invalidate_cache("products")
    sheets.load_products()

    assert ws.get_all_records.call_count == 2


def test_invalidate_cache_all(mocker):
    p_rows = [
        {
            "product_id": "P001",
            "gostock_id": 1,
            "product_name_pl": "Halloumi",
            "product_category": "Chłodnia",
            "inventory_unit": "kg",
            "is_critical": "TRUE",
            "active": "TRUE",
            "notes": "",
        }
    ]
    s_rows = [
        {
            "supplier_id": "S001",
            "supplier_name": "Sernik",
            "email": "x@y.pl",
            "ordering_method": "email",
            "delivery_days": "Mon",
            "cutoff_time": "14:00",
            "minimum_order_value_pln": 100.0,
            "active": "TRUE",
            "notes": "",
        }
    ]
    p_ws = _mk_worksheet(PRODUCT_HEADERS, p_rows)
    s_ws = _mk_worksheet(SUPPLIER_HEADERS, s_rows)

    def fake_open(name):
        return {"products": p_ws, "suppliers": s_ws}[name]

    mocker.patch.object(sheets, "_open_worksheet", side_effect=fake_open)

    sheets.load_products()
    sheets.load_suppliers()
    assert p_ws.get_all_records.call_count == 1
    assert s_ws.get_all_records.call_count == 1

    sheets.invalidate_cache()  # no arg → clear ALL

    sheets.load_products()
    sheets.load_suppliers()
    assert p_ws.get_all_records.call_count == 2
    assert s_ws.get_all_records.call_count == 2


# ---------- _normalize ----------

def test_normalize_empty_string_to_none():
    assert sheets._normalize({"a": "val", "b": ""}) == {"a": "val", "b": None}


def test_normalize_true_false_to_bool():
    assert sheets._normalize({"f1": "TRUE", "f2": "FALSE", "f3": "true", "f4": "False"}) == {
        "f1": True,
        "f2": False,
        "f3": True,
        "f4": False,
    }


def test_normalize_strips_whitespace():
    assert sheets._normalize({"a": "  val  ", "b": "   "}) == {"a": "val", "b": None}


def test_normalize_skips_none_keys():
    out = sheets._normalize({"a": "val", None: "ignored"})
    assert "a" in out
    assert None not in out


# ---------- APIError 429 retry ----------

def test_api_error_429_retries_once_then_succeeds(mocker):
    rows = [
        {
            "product_id": "P001",
            "gostock_id": 1,
            "product_name_pl": "Halloumi",
            "product_category": "Chłodnia",
            "inventory_unit": "kg",
            "is_critical": "TRUE",
            "active": "TRUE",
            "notes": "",
        }
    ]
    ws = MagicMock()
    ws.row_values.return_value = PRODUCT_HEADERS
    # First call raises 429, second succeeds.
    ws.get_all_records.side_effect = [_mk_api_error(429), rows]
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    # Don't actually sleep in tests.
    sleep_mock = mocker.patch.object(sheets.time, "sleep")

    products = sheets.load_products()
    assert len(products) == 1
    assert products[0].product_id == "P001"
    assert ws.get_all_records.call_count == 2
    sleep_mock.assert_called_once_with(2)


def test_api_error_429_retries_once_then_fails(mocker):
    ws = MagicMock()
    ws.row_values.return_value = PRODUCT_HEADERS
    ws.get_all_records.side_effect = [_mk_api_error(429), _mk_api_error(429)]
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    mocker.patch.object(sheets.time, "sleep")  # don't sleep

    with pytest.raises(APIError) as exc:
        sheets.load_products()
    assert exc.value.code == 429
    assert ws.get_all_records.call_count == 2


def test_api_error_non_429_does_not_retry(mocker):
    ws = MagicMock()
    ws.row_values.return_value = PRODUCT_HEADERS
    ws.get_all_records.side_effect = _mk_api_error(500)
    mocker.patch.object(sheets, "_open_worksheet", return_value=ws)
    sleep_mock = mocker.patch.object(sheets.time, "sleep")

    with pytest.raises(APIError) as exc:
        sheets.load_products()
    assert exc.value.code == 500
    assert ws.get_all_records.call_count == 1
    sleep_mock.assert_not_called()


# ---------- SpreadsheetNotFound ----------

def test_spreadsheet_not_found_raises_with_helpful_message(mocker):
    # Force _sheet() to hit the open_by_key path and raise.
    fake_client = MagicMock()
    fake_client.open_by_key.side_effect = SpreadsheetNotFound("not found")
    mocker.patch.object(sheets, "_client", return_value=fake_client)
    sheets._sheet_instance = None  # force re-open

    with pytest.raises(SpreadsheetNotFound) as exc:
        sheets._sheet()
    msg = str(exc.value)
    assert "TEST_SHEET_ID" in msg
    assert "service account" in msg.lower() or "access" in msg.lower()


# ---------- is_configured / warn_if_unconfigured ----------

def test_is_configured_false_when_secret_empty(mocker):
    mocker.patch.object(sheets.settings, "google_sheet_id", "TEST_SHEET_ID")
    from pydantic import SecretStr
    mocker.patch.object(sheets.settings, "google_service_account_json", SecretStr(""))
    assert sheets.is_configured() is False


def test_is_configured_true_when_both_set(mocker):
    mocker.patch.object(sheets.settings, "google_sheet_id", "TEST_SHEET_ID")
    from pydantic import SecretStr
    mocker.patch.object(
        sheets.settings,
        "google_service_account_json",
        SecretStr('{"type":"service_account"}'),
    )
    assert sheets.is_configured() is True
