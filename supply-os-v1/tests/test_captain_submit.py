"""Tests for POST /api/captain/submit (Phase C3).

Auth uses the same env-token model as test_main.py. Tests cover validation
gates (unknown supplier/product, missing settings, critical under-order,
deviation > 25%), happy paths, response shape, and the persist contract
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
    (full_only would suggest 1.0 kg and reject 0.5 as a >25% under-order
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
    # Underorder is itself a >25% deviation from suggested=1 → captures warning.
    assert any("deviation" in w for w in out["warnings"])


def test_submit_deviation_over_25pct_no_reason():
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


def test_submit_deviation_over_25pct_with_reason_returns_warning():
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


# ---------- Uncounted stock — over-MAX is the only reason gate ----------
# (change: order-stock-optional-overmax) When current_stock_qty_base is omitted
# (None = not counted), the deviation + critical-under reason gates are skipped;
# only an over-MAX order forces a reason. P027 @ WOLA: max=12, units_per_pu=5,
# critical, target=12 → suggestion-at-0 = ceil(12/5) = 3.

def test_submit_uncounted_normal_order_needs_no_reason():
    """Omit current stock, order 2 kartons (order_base 10 <= max 12). Today this
    would 400 (critical under-order of 2 < suggested 3, ~33% deviation); with
    stock uncounted there is no suggestion to deviate from, so it must pass with
    no reason_code."""
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                # current_stock_qty_base intentionally omitted → None (uncounted)
                "captain_final_qty_purchase": 2,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["status"] == "captain_submitted"
    assert out["line_count"] == 1
    # No deviation/critical/over-MAX complaint — only the seed non-persist note.
    assert not any("deviation" in w or "MAX" in w for w in out["warnings"])
    assert out["total_value_estimate_pln"] == pytest.approx(2 * 145.0)


def test_submit_uncounted_over_max_no_reason_rejected():
    """Omit current stock, order 3 kartons (order_base 15 > max 12) → over-MAX
    without a reason_code → 400."""
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "captain_final_qty_purchase": 3,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 400
    assert "over MAX" in r.json()["detail"]


def test_submit_uncounted_over_max_with_reason_warns():
    """Same over-MAX order WITH a reason_code → 200 + an over-MAX warning."""
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "captain_final_qty_purchase": 3,
                "reason_code": "PACKAGING_LIMITATION",
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    out = r.json()
    assert any("over MAX" in w for w in out["warnings"])


def test_submit_uncounted_persists_zero_stock_and_null_delta(mocker):
    """An uncounted line persists current_stock_qty_base=0 (column stays NOT
    NULL) and delta_vs_suggestion_pct=None (so it never inflates deviation
    roll-ups)."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "append_order")
    mocked_append_lines = mocker.patch.object(sheets, "append_order_lines")

    from app import seed_loader

    mocker.patch.object(sheets, "load_products", side_effect=seed_loader.load_products)
    mocker.patch.object(sheets, "load_suppliers", side_effect=seed_loader.load_suppliers)
    mocker.patch.object(
        sheets, "load_supplier_products", side_effect=seed_loader.load_supplier_products
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
                "captain_final_qty_purchase": 2,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    appended = mocked_append_lines.call_args[0][0]
    assert len(appended) == 1
    assert appended[0].current_stock_qty_base == 0
    assert appended[0].delta_vs_suggestion_pct is None


def test_submit_counted_zero_still_gates_as_before():
    """Regression guard: a counted 0 (not omitted) is distinct from uncounted —
    P027 stock=0 → suggested 3, ordering 0 is a critical under-order → 400. This
    must NOT be loosened by the uncounted branch."""
    body = {
        "supplier_id": "SUP_PAGO",
        "lines": [
            {
                "product_id": "P027",
                "supplier_product_id": "SP_PAGO_P027",
                "current_stock_qty_base": 0,
                "captain_final_qty_purchase": 0,
            }
        ],
    }
    r = client.post("/api/captain/submit", json=body, headers=WOLA_AUTH)
    assert r.status_code == 400
    assert "Critical product" in r.json()["detail"]


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
