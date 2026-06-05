"""Tests for the inventory-count endpoints (S-06, Phase 2).

GET /api/captain/inventory/products and POST /api/captain/inventory/submit.
Auth uses the same env-token model as test_captain_submit.py. Persistence is
sheet-only (seed = no-op + warning; sheet = append called); the submit endpoint
maps a missing inventory worksheet to a 503 (F2).
"""
import os

# Configure auth env BEFORE importing the app (settings reads at import time).
os.environ.setdefault(
    "SUPPLY_OS_CAPTAIN_TOKENS", "WOLA:test_wola_token,KEN:test_ken_token"
)
os.environ.setdefault("SUPPLY_OS_MANAGER_TOKEN", "test_manager_token")

from fastapi.testclient import TestClient  # noqa: E402

from app import seed_loader, sheets  # noqa: E402
from app.config import DataBackend  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
KEN_AUTH = {"Authorization": "Bearer test_ken_token"}


# ---------- GET /api/captain/inventory/products ----------

def test_inventory_products_lists_location_products():
    """WOLA has location_product_settings → the list is non-empty and enriched."""
    r = client.get("/api/captain/inventory/products", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) > 0
    by_id = {it["product_id"]: it for it in items}
    # P027 Souvlaki Kurczak — active, critical, configured at WOLA.
    assert "P027" in by_id
    p027 = by_id["P027"]
    assert set(p027.keys()) == {
        "product_id",
        "product_name_pl",
        "inventory_unit",
        "is_critical",
    }
    assert p027["is_critical"] is True
    assert p027["inventory_unit"] == "kg"


def test_inventory_products_empty_for_location_without_settings():
    """KEN has no location_product_settings rows → empty list, not an error."""
    r = client.get("/api/captain/inventory/products", headers=KEN_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_inventory_products_unauthorized_no_token():
    r = client.get("/api/captain/inventory/products")
    assert r.status_code == 401


# ---------- POST /api/captain/inventory/submit (seed backend) ----------

def test_inventory_submit_happy_path_seed_backend():
    """Valid WOLA submit → 200; seed backend cannot persist → warning present."""
    body = {
        "lines": [
            {"product_id": "P027", "current_stock_qty_base": 5},
            {
                "product_id": "P019",
                "current_stock_qty_base": 2.5,
                "count_comment": "half bag",
            },
        ],
        "notes": "evening count",
    }
    r = client.post("/api/captain/inventory/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["count_id"].startswith("INV-")
    assert out["line_count"] == 2
    assert out["count_date"]  # ISO date present
    # Seed mode → the non-persistence warning is surfaced.
    assert any("not persisted" in w for w in out["warnings"])


def test_inventory_submit_unauthorized_no_token():
    r = client.post(
        "/api/captain/inventory/submit",
        json={"lines": [{"product_id": "P027", "current_stock_qty_base": 5}]},
    )
    assert r.status_code == 401


def test_inventory_submit_empty_lines():
    r = client.post(
        "/api/captain/inventory/submit", json={"lines": []}, headers=WOLA_AUTH
    )
    assert r.status_code == 422  # Pydantic min_length=1


def test_inventory_submit_unknown_product():
    body = {"lines": [{"product_id": "P999", "current_stock_qty_base": 5}]}
    r = client.post("/api/captain/inventory/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 400
    assert "Unknown product_id" in r.json()["detail"]


def test_inventory_submit_no_setting_for_location():
    # P027 exists in master data but KEN has no setting → 400.
    body = {"lines": [{"product_id": "P027", "current_stock_qty_base": 5}]}
    r = client.post("/api/captain/inventory/submit", json=body, headers=KEN_AUTH)
    assert r.status_code == 400
    assert "no location_product_setting" in r.json()["detail"]


def test_inventory_submit_count_id_format():
    """INV-YYYYMMDD-WOL-<6hex>; 5 calls all unique + correct shape."""
    body = {"lines": [{"product_id": "P027", "current_stock_qty_base": 5}]}
    seen: set[str] = set()
    for _ in range(5):
        r = client.post(
            "/api/captain/inventory/submit", json=body, headers=WOLA_AUTH
        )
        assert r.status_code == 200, r.text
        cid = r.json()["count_id"]
        assert cid.startswith("INV-")
        parts = cid.split("-")
        # ['INV', 'YYYYMMDD', 'LOC', 'hex']
        assert len(parts) == 4
        assert len(parts[1]) == 8 and parts[1].isdigit()
        assert parts[2] == "WOL"
        assert len(parts[3]) == 6
        int(parts[3], 16)  # raises if not hex
        seen.add(cid)
    assert len(seen) == 5  # all unique


# ---------- POST /api/captain/inventory/submit (sheet backend) ----------

def _patch_sheet_master_data(mocker):
    """Point sheet-mode reads at the seed loader so master-data validation works."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(
        sheets, "load_products", side_effect=seed_loader.load_products
    )
    mocker.patch.object(
        sheets,
        "load_location_product_settings",
        side_effect=seed_loader.load_location_product_settings,
    )


def test_inventory_submit_persists_to_sheet(mocker):
    """Sheet backend → append_inventory_count + ...lines called; only entered
    products become lines (blank = not counted)."""
    _patch_sheet_master_data(mocker)
    appended = mocker.patch.object(sheets, "append_inventory_count")
    appended_lines = mocker.patch.object(sheets, "append_inventory_count_lines")

    body = {
        "lines": [
            {"product_id": "P027", "current_stock_qty_base": 5},
            {"product_id": "P019", "current_stock_qty_base": 2},
        ]
    }
    r = client.post("/api/captain/inventory/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    appended.assert_called_once()
    appended_lines.assert_called_once()

    # The persisted lines reflect exactly the two entered products.
    lines_arg = appended_lines.call_args[0][0]
    assert {ln.product_id for ln in lines_arg} == {"P027", "P019"}
    assert all(ln.count_id == r.json()["count_id"] for ln in lines_arg)
    # The count row carries the matching line_count + location.
    count_arg = appended.call_args[0][0]
    assert count_arg.line_count == 2
    assert count_arg.location_id == "WOLA"
    # No read-only warning when the sheet backend persisted.
    assert all("not persisted" not in w for w in r.json()["warnings"])


def test_inventory_submit_worksheets_not_configured_returns_503(mocker):
    """Sheet mode but the inventory tabs don't exist yet → actionable 503 (F2)."""
    _patch_sheet_master_data(mocker)
    mocker.patch.object(
        sheets,
        "append_inventory_count",
        side_effect=sheets.WorksheetNotFound,
    )
    body = {"lines": [{"product_id": "P027", "current_stock_qty_base": 5}]}
    r = client.post("/api/captain/inventory/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 503, r.text
    assert "not configured" in r.json()["detail"]
