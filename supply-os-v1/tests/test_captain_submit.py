"""Tests for POST /api/captain/submit (Phase C3).

Auth uses the same env-token model as test_main.py. Tests cover validation
gates (unknown supplier/product, missing settings, critical under-order,
deviation > 20%), happy paths, response shape, and the persist contract
in both backends (seed = no-op + warning; sheet = append called).
"""
import pytest
from fastapi.testclient import TestClient

from app import sheets
from app.config import DataBackend
from app.main import app

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
KEN_AUTH = {"Authorization": "Bearer test_ken_token"}


# ---------- Happy path ----------

def test_submit_happy_path_seed_backend():
    """Valid request matching WOLA + SUP_PAGO seed data → 200 with order_id."""
    # P027 Souvlaki Kurczak — critical, target=12, units_per_pu=5, current=7
    # → suggested 1 karton. Captain matches → no deviation, no reason needed.
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 7,
                "captain_final_qty_purchase": 1,
            }
        ],
        "notes": "happy path",
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["order_id"].startswith("ORD-")
    assert out["status"] == "captain_submitted"
    assert out["line_count"] == 1
    # 1 karton * 145 PLN = 145
    assert out["total_value_estimate_pln"] == 145.0


def test_submit_bukat_p009_subkg_tenth_kg_from_seed():
    """P009 carries rounding_rule=tenth_kg in seed: target 0.5, stock 0 →
    suggestion 0.5 kg. Ordering exactly 0.5 is accepted with no deviation
    warning — which only holds if the seed's tenth_kg rule is applied
    (full_only would suggest 1.0 kg and reject 0.5 as a >20% under-order
    without a reason)."""
    body = {
        "supplier_id": "SUP_BUKAT",
        "lines": [
            {
                "product_id": "P009",
                "supplier_product_id": "SP_BUKAT_P009",
                "current_stock_qty_base": 0,
                "captain_final_qty_purchase": 0.5,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["line_count"] == 1
    assert not any("deviation" in w for w in out["warnings"])
    # 0.5 kg * 18.00 zł/kg = 9.0
    assert out["total_value_estimate_pln"] == 9.0


def test_submit_unauthorized_no_token():
    r = client.post(
        "/api/captain/submit",
        json={
            "supplier_id": "SUP_PAGO",
            "lines": [
                {
                    "product_id": "P027",
                    "supplier_product_id": "SP_PAGO_P027",
                    "current_stock_qty_base": 5,
                    "captain_final_qty_purchase": 1,
                }
            ],
        },
    )
    assert r.status_code == 401


def test_submit_unknown_supplier_id():
    body = {
        "supplier_id": "SUP_DOESNOTEXIST",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 5,
                "captain_final_qty_purchase": 1,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 400
    assert "Unknown supplier_id" in r.json()["detail"]


def test_submit_unknown_supplier_product():
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_NOT_REAL_X",
                "current_stock_qty_base": 5,
                "captain_final_qty_purchase": 1,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 400
    assert "not orderable" in r.json()["detail"]


def test_submit_unknown_product():
    # supplier_product exists at PAGO but use mismatched product_id
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P999",  # not in products.csv
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 5,
                "captain_final_qty_purchase": 1,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 400


def test_submit_no_setting_for_location():
    # KEN has no location_product_settings rows at all → P027 missing.
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 5,
                "captain_final_qty_purchase": 1,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=KEN_AUTH)
    assert r.status_code == 400
    assert "no location_product_setting" in r.json()["detail"]


def test_submit_critical_underorder_no_reason():
    # P027 is critical at WOLA. Current=7, suggested=1, captain submits 0 → underorder.
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 7,
                "captain_final_qty_purchase": 0,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 400
    assert "Critical product" in r.json()["detail"]
    assert "under-ordered" in r.json()["detail"]


def test_submit_critical_underorder_with_reason():
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 7,
                "captain_final_qty_purchase": 0,
                "reason_code": "SUPPLIER_UNDERDELIVERS",
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["status"] == "captain_submitted"
    # Underorder is itself a >20% deviation from suggested=1 → captures warning.
    assert any("deviation" in w for w in out["warnings"])


def test_submit_deviation_over_20pct_no_reason():
    # P019 Przyprawa: non-critical, suggested=1 (target=1, units_per_pu=1, stock=0).
    # Captain submits 2 → delta = 100%, no reason → 400.
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P019",
                "supplier_product_id": "SP_PAGO_P019",
                "current_stock_qty_base": 0,
                "captain_final_qty_purchase": 2,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 400
    assert "deviates" in r.json()["detail"]


def test_submit_deviation_over_20pct_with_reason_returns_warning():
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P019",
                "supplier_product_id": "SP_PAGO_P019",
                "current_stock_qty_base": 0,
                "captain_final_qty_purchase": 2,
                "reason_code": "EVENT_HIGH_TRAFFIC",
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert len(out["warnings"]) >= 1
    assert any("EVENT_HIGH_TRAFFIC" in w for w in out["warnings"])


def test_submit_empty_lines():
    body = {"supplier_id": "SUP_PAGO", "lines": []}
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 422  # Pydantic min_length=1


def test_submit_order_id_format():
    """ORD-YYYYMMDD-WOL-PAGO-<6hex>; 5 calls all unique + correct shape."""
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 7,
                "captain_final_qty_purchase": 1,
            }
        ],
    }
    seen: set[str] = set()
    for _ in range(5):
        r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]
        assert oid.startswith("ORD-")
        parts = oid.split("-")
        # ['ORD', 'YYYYMMDD', 'LOC', 'SUP', 'hex']
        assert len(parts) == 5
        assert len(parts[1]) == 8 and parts[1].isdigit()
        assert parts[2] == "WOL"
        assert parts[3] == "PAGO"
        assert len(parts[4]) == 6
        int(parts[4], 16)  # raises if not hex
        seen.add(oid)
    assert len(seen) == 5  # all unique


def test_submit_total_value_computed():
    """Two known PAGO lines: P027 (145 PLN) + P026 (94 PLN) = 239."""
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 7,
                "captain_final_qty_purchase": 1,
            },
            {
                "product_id": "P026",
                "supplier_product_id": "SP_PAGO_P026",
                "current_stock_qty_base": 0,
                "captain_final_qty_purchase": 1,
            },
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["total_value_estimate_pln"] == pytest.approx(145.0 + 94.0)


def test_submit_persists_to_sheet_when_backend_is_sheet(mocker):
    """When data_backend=sheet AND configured, sheets.append_* must be called."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocked_append_order = mocker.patch.object(sheets, "append_order")
    mocked_append_lines = mocker.patch.object(sheets, "append_order_lines")

    # We still need master data; reuse seed loader for reads by overriding
    # the relevant `sheets.load_*` callables with seed-backed lists.
    from app import seed_loader

    mocker.patch.object(sheets, "load_products", side_effect=seed_loader.load_products)
    mocker.patch.object(sheets, "load_suppliers", side_effect=seed_loader.load_suppliers)
    mocker.patch.object(
        sheets,
        "load_supplier_products",
        side_effect=seed_loader.load_supplier_products,
    )
    mocker.patch.object(
        sheets,
        "load_location_product_settings",
        side_effect=seed_loader.load_location_product_settings,
    )

    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 7,
                "captain_final_qty_purchase": 1,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    mocked_append_order.assert_called_once()
    mocked_append_lines.assert_called_once()
    # No warnings about read-only backend.
    assert all("not persisted" not in w for w in r.json()["warnings"])


def test_submit_in_seed_mode_does_not_raise():
    """Seed backend has no writes — submit should still 200 + warn."""
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 7,
                "captain_final_qty_purchase": 1,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    # Seed mode should surface the non-persistence warning.
    assert any("not persisted" in w for w in r.json()["warnings"])


def test_submit_location_derived_from_auth_not_request():
    """Body has no location_id — auth provides it. KEN gets KEN's settings."""
    # KEN has no settings → P027 fails location-setting check.
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 7,
                "captain_final_qty_purchase": 1,
            }
        ],
    }
    r_ken = client.post("/api/captain/submit", json=body, headers=KEN_AUTH)
    assert r_ken.status_code == 400  # no settings at KEN
    r_wola = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r_wola.status_code == 200, r_wola.text
