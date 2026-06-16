"""Tests for the Supabase Postgres data backend (S-10, Phase 3).

The engine/connection is mocked — no live DB (that's Phase 4's integration job).
This mirrors test_manager_dispatch's ``_activate_sheet_backend`` pattern but for
the new backend. Coverage:

- ``is_configured`` + ``_choose_backend`` selection (supabase first, then fallback).
- The atomic status-transition guard (the S-10 correctness win): a conditional
  ``UPDATE … WHERE status=:expected`` raising ``OrderStatusConflictError`` on 0 rows.
- Row→model mapping, ``get_*`` parent+lines assembly, append column set, temporal
  casts, the single-statement delete.
- The seam-parity contract: ``supabase_backend`` exposes a superset of ``sheets``'
  public seam functions (a missing function fails here, not at runtime in prod).
- The 5 transition routes pass ``expected_status`` and map the conflict → 409.
"""
from __future__ import annotations

import inspect
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app import errors, seed_loader, sheets, supabase_backend
from app.config import DataBackend
from app.main import _choose_backend, _is_persistent, app
from app.models import (
    Location,
    LocationProductSetting,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    Supplier,
    SupplierProduct,
)

client = TestClient(app)
MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}
CAPTAIN_AUTH = {"Authorization": "Bearer test_wola_token"}


# ---------- engine mock helpers ----------

def _result(mocker, *, mappings=None, fetchall=None, rowcount=0):
    """Build a fake SQLAlchemy Result. ``mappings`` feeds ``.mappings().all()``
    (reads); ``fetchall`` feeds ``.fetchall()`` (RETURNING); ``rowcount`` is the
    DELETE count."""
    r = mocker.MagicMock(name="result")
    r.mappings.return_value.all.return_value = mappings or []
    r.fetchall.return_value = fetchall if fetchall is not None else []
    r.rowcount = rowcount
    return r


def _fake_engine(mocker, *, results=None, mappings=None, fetchall=None, rowcount=0):
    """Patch ``supabase_backend._get_engine`` with a fake whose single connection
    records every ``execute(stmt, params)``. ``results`` (a list) drives a
    per-call ``side_effect`` for multi-statement functions (e.g. get_order)."""
    conn = mocker.MagicMock(name="conn")
    if results is not None:
        conn.execute.side_effect = results
    else:
        conn.execute.return_value = _result(
            mocker, mappings=mappings, fetchall=fetchall, rowcount=rowcount
        )
    engine = mocker.MagicMock(name="engine")
    for ctx in (engine.connect, engine.begin):
        ctx.return_value.__enter__.return_value = conn
        ctx.return_value.__exit__.return_value = False
    mocker.patch.object(supabase_backend, "_get_engine", return_value=engine)
    return conn


def _executed(conn):
    """List of (sql_text, params) for each conn.execute call."""
    out = []
    for call in conn.execute.call_args_list:
        stmt = call.args[0]
        params = call.args[1] if len(call.args) > 1 else None
        out.append((str(stmt), params))
    return out


# ---------- is_configured + capability ----------

def test_is_configured_true_when_dsn_set(mocker):
    mocker.patch.object(
        supabase_backend.settings, "database_url", SecretStr("postgresql://x")
    )
    assert supabase_backend.is_configured() is True


def test_is_configured_false_when_blank(mocker):
    mocker.patch.object(supabase_backend.settings, "database_url", SecretStr(""))
    assert supabase_backend.is_configured() is False


def test_supports_persistence_flag():
    assert supabase_backend.SUPPORTS_PERSISTENCE is True
    assert _is_persistent(supabase_backend) is True


# ---------- _choose_backend selection ----------

def test_choose_backend_returns_supabase_when_selected_and_configured(mocker):
    mocker.patch.object(supabase_backend.settings, "data_backend", DataBackend.SUPABASE)
    mocker.patch.object(supabase_backend, "is_configured", return_value=True)
    assert _choose_backend() is supabase_backend


def test_choose_backend_falls_back_when_supabase_unconfigured(mocker):
    # Selected supabase but DSN missing → must not error; falls through to seed
    # (sheets is also unconfigured in the test env).
    mocker.patch.object(supabase_backend.settings, "data_backend", DataBackend.SUPABASE)
    mocker.patch.object(supabase_backend, "is_configured", return_value=False)
    assert _choose_backend() is seed_loader


# ---------- update_order: the atomic status-transition guard ----------

def test_update_order_conditional_conflict_raises(mocker):
    conn = _fake_engine(mocker, fetchall=[])  # 0 rows matched the conditional WHERE
    with pytest.raises(errors.OrderStatusConflictError):
        supabase_backend.update_order(
            "ORD-1", status="manager_claimed", expected_status="captain_submitted"
        )
    sql, params = _executed(conn)[0]
    assert "status = :_expected_status" in sql
    assert "RETURNING order_id" in sql
    assert params["_expected_status"] == "captain_submitted"
    assert params["status"] == "manager_claimed"


def test_update_order_conditional_success(mocker):
    conn = _fake_engine(mocker, fetchall=[("ORD-1",)])  # 1 row matched
    supabase_backend.update_order(
        "ORD-1", status="manager_sent", expected_status="manager_claimed"
    )
    sql, _ = _executed(conn)[0]
    assert sql.startswith("UPDATE orders SET ")


def test_update_order_unconditional_not_found_raises(mocker):
    _fake_engine(mocker, fetchall=[])  # no expected_status → 0 rows = not found
    with pytest.raises(errors.OrderNotFoundError):
        supabase_backend.update_order("ORD-MISSING", notes="x")


def test_update_order_ignores_unknown_columns(mocker):
    conn = _fake_engine(mocker, fetchall=[("ORD-1",)])
    supabase_backend.update_order("ORD-1", notes="hi", bogus_col="nope")
    _, params = _executed(conn)[0]
    assert "notes" in params
    assert "bogus_col" not in params


def test_update_order_casts_timestamptz_columns(mocker):
    conn = _fake_engine(mocker, fetchall=[("ORD-1",)])
    supabase_backend.update_order(
        "ORD-1",
        status="manager_sent",
        manager_sent_at="2026-06-16T10:00:00+00:00",  # ISO string from dispatch
        expected_status="manager_claimed",
    )
    sql, _ = _executed(conn)[0]
    assert "CAST(:manager_sent_at AS timestamptz)" in sql


# ---------- append / delete shape ----------

def test_append_order_inserts_only_real_columns(mocker):
    conn = _fake_engine(mocker)
    order = Order(
        order_id="ORD-1",
        location_id="WOLA",
        supplier_id="SUP_X",
        order_date=date(2026, 6, 16),
        status=OrderStatus.CAPTAIN_SUBMITTED,
        lines=[
            OrderLine(
                order_line_id="OL-1", order_id="ORD-1",
                product_id="P1", supplier_product_id="SP1",
            )
        ],
    )
    supabase_backend.append_order(order)
    sql, params = _executed(conn)[0]
    assert sql.startswith("INSERT INTO orders (")
    assert "lines" not in params  # the aggregate field is not a column
    assert params["order_id"] == "ORD-1"
    assert params["status"] == "captain_submitted"  # enum collapsed to .value
    assert "CAST(:order_date AS date)" in sql


def test_append_order_lines_rejects_mixed_order_ids(mocker):
    _fake_engine(mocker)
    lines = [
        OrderLine(order_line_id="OL-1", order_id="ORD-1", product_id="P1", supplier_product_id="SP1"),
        OrderLine(order_line_id="OL-2", order_id="ORD-2", product_id="P1", supplier_product_id="SP1"),
    ]
    with pytest.raises(ValueError):
        supabase_backend.append_order_lines(lines)


def test_append_order_lines_batch_is_one_executemany(mocker):
    conn = _fake_engine(mocker)
    lines = [
        OrderLine(order_line_id="OL-1", order_id="ORD-1", product_id="P1", supplier_product_id="SP1"),
        OrderLine(order_line_id="OL-2", order_id="ORD-1", product_id="P2", supplier_product_id="SP2"),
    ]
    supabase_backend.append_order_lines(lines)
    assert conn.execute.call_count == 1
    _, payload = conn.execute.call_args.args
    assert isinstance(payload, list)
    assert len(payload) == 2


def test_delete_order_lines_single_statement(mocker):
    conn = _fake_engine(mocker, rowcount=3)
    n = supabase_backend.delete_order_lines("ORD-1")
    assert n == 3
    assert conn.execute.call_count == 1
    sql, params = _executed(conn)[0]
    assert sql == "DELETE FROM order_lines WHERE order_id = :oid"
    assert params == {"oid": "ORD-1"}


# ---------- reads + get_* assembly ----------

def test_load_products_maps_rows_to_models(mocker):
    rows = [
        {
            "product_id": "P1", "gostock_id": None, "product_name_pl": "Pita",
            "product_category": "Bread", "inventory_unit": "szt",
            "is_critical": True, "active": True, "notes": "",
        }
    ]
    _fake_engine(mocker, mappings=rows)
    products = supabase_backend.load_products()
    assert len(products) == 1
    assert products[0].product_id == "P1"
    assert products[0].is_critical is True


def test_load_meta_returns_dict(mocker):
    _fake_engine(
        mocker,
        mappings=[{"key": "schema_version", "value": "1"}, {"key": "note", "value": "hi"}],
    )
    assert supabase_backend.load_meta() == {"schema_version": "1", "note": "hi"}


def test_get_order_assembles_parent_and_lines(mocker):
    order_row = {
        "order_id": "ORD-1", "location_id": "WOLA", "supplier_id": "SUP_X",
        "order_date": date(2026, 6, 16), "requested_delivery_date": None,
        "status": "captain_submitted", "captain_user": "WOLA",
        "captain_submitted_at": datetime(2026, 6, 16, tzinfo=timezone.utc),
        "manager_user": None, "manager_sent_at": None, "sent_method": None,
        "supplier_order_reference": None, "total_value_estimate_pln": 100.0,
        "last_edited_at": None, "notes": "",
    }
    line_row = {
        "order_line_id": "OL-1", "order_id": "ORD-1", "product_id": "P1",
        "supplier_product_id": "SP1", "current_stock_qty_base": 0,
        "target_stock_qty_base": 0, "suggested_qty_base": 0,
        "suggested_qty_purchase": 0, "captain_final_qty_purchase": 5,
        "captain_final_qty_base": 25, "manager_final_qty_purchase": 0,
        "manager_final_qty_base": 0, "delta_vs_suggestion_pct": None,
        "reason_code": None, "captain_comment": "", "manager_comment": "",
    }
    _fake_engine(
        mocker,
        results=[
            _result(mocker, mappings=[order_row]),
            _result(mocker, mappings=[line_row]),
        ],
    )
    order = supabase_backend.get_order("ORD-1")
    assert order is not None
    assert order.order_id == "ORD-1"
    assert order.status is OrderStatus.CAPTAIN_SUBMITTED
    assert len(order.lines) == 1
    assert order.lines[0].order_line_id == "OL-1"


def test_get_order_returns_none_when_absent(mocker):
    _fake_engine(mocker, results=[_result(mocker, mappings=[])])
    assert supabase_backend.get_order("ORD-MISSING") is None


def test_invalidate_cache_is_noop(mocker):
    spy = mocker.patch.object(supabase_backend, "_get_engine")
    assert supabase_backend.invalidate_cache("orders") is None
    assert supabase_backend.invalidate_cache() is None
    spy.assert_not_called()  # never touches the DB


# ---------- seam parity ----------

def test_seam_parity_supabase_is_superset_of_sheets():
    def public_funcs(mod):
        return {
            name
            for name, obj in inspect.getmembers(mod, inspect.isfunction)
            if obj.__module__ == mod.__name__ and not name.startswith("_")
        }

    missing = public_funcs(sheets) - public_funcs(supabase_backend)
    assert not missing, f"supabase_backend missing seam functions: {sorted(missing)}"


# ---------- route wiring: expected_status passed + conflict → 409 ----------

def _select_supabase(mocker):
    """Make _choose_backend() return supabase_backend for a route test."""
    mocker.patch.object(supabase_backend.settings, "data_backend", DataBackend.SUPABASE)
    mocker.patch.object(supabase_backend, "is_configured", return_value=True)


def _claimable_order(order_id="ORD-CLAIM-1", status=OrderStatus.CAPTAIN_SUBMITTED):
    return Order(
        order_id=order_id, location_id="WOLA", supplier_id="SUP_X",
        order_date=date(2026, 6, 16), status=status, captain_user="WOLA",
    )


def test_route_manager_claim_passes_expected_status(mocker):
    _select_supabase(mocker)
    order = _claimable_order()
    mocker.patch.object(supabase_backend, "get_order", return_value=order)
    upd = mocker.patch.object(supabase_backend, "update_order")
    r = client.post(f"/api/manager/claim/{order.order_id}", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    _, kwargs = upd.call_args
    assert kwargs.get("expected_status") == OrderStatus.CAPTAIN_SUBMITTED.value
    assert kwargs.get("status") == OrderStatus.MANAGER_CLAIMED.value


def test_route_manager_claim_status_conflict_returns_409(mocker):
    _select_supabase(mocker)
    order = _claimable_order()
    mocker.patch.object(supabase_backend, "get_order", return_value=order)
    mocker.patch.object(
        supabase_backend, "update_order",
        side_effect=errors.OrderStatusConflictError("boom"),
    )
    r = client.post(f"/api/manager/claim/{order.order_id}", headers=MANAGER_AUTH)
    assert r.status_code == 409
    assert "concurrently" in r.json()["detail"]


def test_route_manager_release_passes_expected_status(mocker):
    _select_supabase(mocker)
    order = _claimable_order(status=OrderStatus.MANAGER_CLAIMED)
    mocker.patch.object(supabase_backend, "get_order", return_value=order)
    upd = mocker.patch.object(supabase_backend, "update_order")
    r = client.post(
        f"/api/manager/release/{order.order_id}",
        json={"reason": "popraw ilości"}, headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    _, kwargs = upd.call_args
    assert kwargs.get("expected_status") == OrderStatus.MANAGER_CLAIMED.value


def _dispatch_fixtures(mocker, *, update_side_effect=None):
    order = Order(
        order_id="ORD-DISP-1", location_id="WOLA", supplier_id="SUP_X",
        order_date=date(2026, 6, 16), status=OrderStatus.MANAGER_CLAIMED,
        lines=[
            OrderLine(
                order_line_id="OL-1", order_id="ORD-DISP-1", product_id="P1",
                supplier_product_id="SP1", captain_final_qty_purchase=5,
            )
        ],
    )
    mocker.patch.object(supabase_backend, "get_order", return_value=order)
    mocker.patch.object(
        supabase_backend, "load_suppliers",
        return_value=[Supplier(supplier_id="SUP_X", supplier_name="X", email="x@example.com")],
    )
    mocker.patch.object(
        supabase_backend, "load_locations",
        return_value=[Location(location_id="WOLA", location_name="Wola")],
    )
    mocker.patch.object(
        supabase_backend, "load_products",
        return_value=[Product(product_id="P1", product_name_pl="Pita", product_category="B", inventory_unit="szt")],
    )
    mocker.patch.object(
        supabase_backend, "load_supplier_products",
        return_value=[
            SupplierProduct(
                supplier_product_id="SP1", supplier_id="SUP_X", product_id="P1",
                supplier_product_name="Pita", purchase_unit="szt", units_per_purchase_unit=1.0,
            )
        ],
    )
    mocker.patch.object(supabase_backend, "update_order_lines")
    return mocker.patch.object(
        supabase_backend, "update_order", side_effect=update_side_effect
    )


def test_route_manager_dispatch_passes_expected_status(mocker):
    _select_supabase(mocker)
    upd = _dispatch_fixtures(mocker)
    body = {"order_id": "ORD-DISP-1", "manager_finals": [{"order_line_id": "OL-1", "manager_final_qty_purchase": 5}]}
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    _, kwargs = upd.call_args
    assert kwargs.get("expected_status") == OrderStatus.MANAGER_CLAIMED.value


def test_route_manager_dispatch_status_conflict_returns_409(mocker):
    _select_supabase(mocker)
    _dispatch_fixtures(mocker, update_side_effect=errors.OrderStatusConflictError("boom"))
    body = {"order_id": "ORD-DISP-1", "manager_finals": [{"order_line_id": "OL-1", "manager_final_qty_purchase": 5}]}
    r = client.post("/api/manager/dispatch", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 409
    assert "concurrently" in r.json()["detail"]


def test_route_manager_save_passes_expected_status(mocker):
    _select_supabase(mocker)
    order = Order(
        order_id="ORD-SAVE-1", location_id="WOLA", supplier_id="SUP_X",
        order_date=date(2026, 6, 16), status=OrderStatus.MANAGER_CLAIMED,
        lines=[
            OrderLine(
                order_line_id="OL-1", order_id="ORD-SAVE-1", product_id="P1",
                supplier_product_id="SP1", captain_final_qty_purchase=5,
            )
        ],
    )
    mocker.patch.object(supabase_backend, "get_order", return_value=order)
    mocker.patch.object(
        supabase_backend, "load_supplier_products",
        return_value=[
            SupplierProduct(
                supplier_product_id="SP1", supplier_id="SUP_X", product_id="P1",
                supplier_product_name="Pita", purchase_unit="szt", units_per_purchase_unit=1.0,
            )
        ],
    )
    mocker.patch.object(supabase_backend, "update_order_lines")
    upd = mocker.patch.object(supabase_backend, "update_order")
    body = {"manager_finals": [{"order_line_id": "OL-1", "manager_final_qty_purchase": 3}]}
    r = client.patch("/api/manager/order/ORD-SAVE-1", json=body, headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    _, kwargs = upd.call_args
    assert kwargs.get("expected_status") == OrderStatus.MANAGER_CLAIMED.value


def test_route_captain_edit_passes_expected_status(mocker):
    _select_supabase(mocker)
    order = _claimable_order(order_id="ORD-EDIT-1")  # captain_submitted, WOLA
    mocker.patch.object(supabase_backend, "get_order", return_value=order)
    mocker.patch.object(
        supabase_backend, "load_products",
        return_value=[Product(product_id="P1", product_name_pl="Pita", product_category="B", inventory_unit="szt")],
    )
    mocker.patch.object(
        supabase_backend, "load_suppliers",
        return_value=[Supplier(supplier_id="SUP_X", supplier_name="X", email="x@example.com")],
    )
    mocker.patch.object(
        supabase_backend, "load_supplier_products",
        return_value=[
            SupplierProduct(
                supplier_product_id="SP1", supplier_id="SUP_X", product_id="P1",
                supplier_product_name="Pita", purchase_unit="szt", units_per_purchase_unit=1.0,
            )
        ],
    )
    mocker.patch.object(
        supabase_backend, "load_location_product_settings",
        return_value=[
            LocationProductSetting(
                setting_id="S1", location_id="WOLA", product_id="P1",
                target_stock_qty_base=0, max_stock_qty_base=0,
            )
        ],
    )
    mocker.patch.object(supabase_backend, "delete_order_lines")
    mocker.patch.object(supabase_backend, "append_order_lines")
    upd = mocker.patch.object(supabase_backend, "update_order")
    # qty == suggestion (0) → no deviation/critical gate fires.
    body = {
        "lines": [
            {"product_id": "P1", "supplier_product_id": "SP1",
             "current_stock_qty_base": 0, "captain_final_qty_purchase": 0}
        ]
    }
    r = client.patch("/api/captain/order/ORD-EDIT-1", json=body, headers=CAPTAIN_AUTH)
    assert r.status_code == 200, r.text
    _, kwargs = upd.call_args
    assert kwargs.get("expected_status") == OrderStatus.CAPTAIN_SUBMITTED.value
