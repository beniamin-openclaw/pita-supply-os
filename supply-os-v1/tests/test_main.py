"""TestClient integration tests for FastAPI routes."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
KEN_AUTH = {"Authorization": "Bearer test_ken_token"}
MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}


# ---------- Health (public) ----------

def test_health_public_minimal():
    """Public /health must NOT leak env or data_backend."""
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "timestamp" in body
    assert "env" not in body
    assert "data_backend" not in body
    assert "version" not in body


# ---------- Health internal (Manager auth) ----------

def test_health_internal_requires_bearer():
    r = client.get("/health/internal")
    assert r.status_code == 401


def test_health_internal_rejects_captain_token():
    r = client.get("/health/internal", headers=WOLA_AUTH)
    assert r.status_code == 401


def test_health_internal_with_manager():
    r = client.get("/health/internal", headers=MANAGER_AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["env"] == "dev"
    assert body["data_backend"] == "seed"
    assert body["version"] == "0.1.0"


# ---------- Master data (require any auth) ----------

def test_products_requires_auth():
    r = client.get("/api/products")
    assert r.status_code == 401


def test_products_with_captain_token():
    r = client.get("/api/products", headers=WOLA_AUTH)
    assert r.status_code == 200
    assert len(r.json()) == 134


def test_products_with_manager_token():
    r = client.get("/api/products", headers=MANAGER_AUTH)
    assert r.status_code == 200
    assert len(r.json()) == 134


def test_products_rejects_bad_token():
    r = client.get("/api/products", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401


def test_suppliers_requires_auth():
    r = client.get("/api/suppliers")
    assert r.status_code == 401


def test_suppliers_with_captain_token():
    r = client.get("/api/suppliers", headers=WOLA_AUTH)
    assert r.status_code == 200
    assert len(r.json()) == 10


def test_locations_requires_auth():
    r = client.get("/api/locations")
    assert r.status_code == 401


def test_locations_with_manager_token():
    r = client.get("/api/locations", headers=MANAGER_AUTH)
    assert r.status_code == 200
    assert len(r.json()) == 6


# ---------- Captain auth ----------

def test_captain_orderable_requires_bearer():
    r = client.get("/api/captain/orderable", params={"supplier_id": "SUP_PAGO"})
    assert r.status_code == 401


def test_captain_orderable_rejects_bad_token():
    r = client.get(
        "/api/captain/orderable",
        params={"supplier_id": "SUP_PAGO"},
        headers={"Authorization": "Bearer wrong_token"},
    )
    assert r.status_code == 401


def test_captain_orderable_rejects_manager_token():
    """Manager token must not satisfy Captain auth."""
    r = client.get(
        "/api/captain/orderable",
        params={"supplier_id": "SUP_PAGO"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 401


def test_captain_orderable_wola_pago_returns_18_items():
    # F-02: added Wola par-levels for 12 Pago packaging+office SKUs — now 18 orderable.
    # Core food items (P019, P024–P028) must still be present.
    r = client.get(
        "/api/captain/orderable",
        params={"supplier_id": "SUP_PAGO"},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 18
    pids = {item["product_id"] for item in items}
    # Core food items still present
    assert {"P019", "P024", "P025", "P026", "P027", "P028"}.issubset(pids)
    # Packaging + office items now also orderable
    assert {"P089", "P090", "P091", "P092", "P098", "P127", "P128",
            "P129", "P130", "P131", "P132", "P133"}.issubset(pids)


def test_captain_orderable_bukat_exposes_tenth_kg_rule():
    """The seed's tenth_kg assignment must reach the Captain order screen;
    a discrete-pack Bukat SKU stays full_only."""
    r = client.get(
        "/api/captain/orderable",
        params={"supplier_id": "SUP_BUKAT"},
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200, r.text
    items = {i["supplier_product_id"]: i for i in r.json()}
    assert items["SP_BUKAT_P009"]["rounding_rule"] == "tenth_kg"
    assert items["SP_BUKAT_P011"]["rounding_rule"] == "full_only"


def test_captain_orderable_ken_returns_empty():
    """KEN has no location_product_settings rows in v0."""
    r = client.get(
        "/api/captain/orderable",
        params={"supplier_id": "SUP_PAGO"},
        headers=KEN_AUTH,
    )
    assert r.status_code == 200
    assert r.json() == []


# ---------- Captain suggest ----------

def test_captain_suggest_souvlaki_kurczak():
    r = client.post(
        "/api/captain/suggest",
        json={
            "current_stock_qty_base": 8,
            "target_stock_qty_base": 12,
            "max_stock_qty_base": 12,
            "units_per_purchase_unit": 5,
            "is_critical": True,
        },
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200
    out = r.json()
    assert out["suggested_qty_purchase"] == 1
    assert out["suggested_qty_base"] == 5
    assert out["over_max_qty_base"] == 1


def test_captain_suggest_tenth_kg_subkg():
    """Sub-kg target on a per-kg SKU suggests 0.5 kg (no whole-kg ceil) and no
    over-max — the P009/P010 fix, exercised through the HTTP preview."""
    r = client.post(
        "/api/captain/suggest",
        json={
            "current_stock_qty_base": 0,
            "target_stock_qty_base": 0.5,
            "max_stock_qty_base": 0.5,
            "units_per_purchase_unit": 1,
            "rounding_rule": "tenth_kg",
        },
        headers=WOLA_AUTH,
    )
    assert r.status_code == 200
    out = r.json()
    assert out["suggested_qty_purchase"] == 0.5
    assert out["over_max_qty_base"] == 0


def test_captain_suggest_rejects_negative_stock():
    r = client.post(
        "/api/captain/suggest",
        json={
            "current_stock_qty_base": -5,
            "target_stock_qty_base": 12,
            "max_stock_qty_base": 12,
            "units_per_purchase_unit": 5,
        },
        headers=WOLA_AUTH,
    )
    assert r.status_code == 422


def test_captain_suggest_rejects_zero_units_per_purchase_unit():
    r = client.post(
        "/api/captain/suggest",
        json={
            "current_stock_qty_base": 5,
            "target_stock_qty_base": 12,
            "max_stock_qty_base": 12,
            "units_per_purchase_unit": 0,
        },
        headers=WOLA_AUTH,
    )
    assert r.status_code == 422


def test_captain_suggest_requires_auth():
    r = client.post(
        "/api/captain/suggest",
        json={
            "current_stock_qty_base": 5,
            "target_stock_qty_base": 12,
            "max_stock_qty_base": 12,
            "units_per_purchase_unit": 5,
        },
    )
    assert r.status_code == 401


# ---------- Manager queue ----------

def test_manager_queue_requires_bearer():
    r = client.get("/api/manager/queue")
    assert r.status_code == 401


def test_manager_queue_rejects_captain_token():
    r = client.get("/api/manager/queue", headers=WOLA_AUTH)
    assert r.status_code == 401


def test_manager_queue_empty_in_v0():
    r = client.get("/api/manager/queue", headers=MANAGER_AUTH)
    assert r.status_code == 200
    assert r.json() == []


def test_manager_queue_rejects_invalid_status_enum():
    r = client.get(
        "/api/manager/queue",
        params={"status": "not_a_real_status"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 422
