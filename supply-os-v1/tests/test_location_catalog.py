"""Per-location supplier catalog (krakow-katowice-rollout, migration 0029).

A location with ``own_catalog`` orders only from supplier_products rows scoped
to it; every other location only from the shared rows. A scoped row can be a
backup source (no suggestion, no reason gates). A product offered by two
suppliers at a location carries the other suppliers and their open orders.

Master data is a small synthetic set served through a mocked sheet backend:
WOLA uses the shared catalog; KEN plays a city location with ``own_catalog``
(the test tokens cover WOLA and KEN only).
"""
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import app.main as main_mod
from app import sheets
from app.config import DataBackend
from app.main import app
from app.models import (
    InventoryCount,
    InventoryCountLine,
    Location,
    LocationProductSetting,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    Supplier,
    SupplierProduct,
)
from app.supplier_catalog import (
    effective_supplier_products,
    location_scope,
    multi_supplier_products,
    suppliers_by_product,
)

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
KEN_AUTH = {"Authorization": "Bearer test_ken_token"}
MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}


def _locations() -> list[Location]:
    return [
        Location(location_id="WOLA", location_name="Wola"),
        Location(location_id="KEN", location_name="Ken (city)", own_catalog=True),
    ]


def _products() -> list[Product]:
    return [
        Product(product_id="P1", product_name_pl="Frytki", product_category="Mrożone",
                inventory_unit="szt"),
        Product(product_id="P2", product_name_pl="Rękawiczki", product_category="Chemia",
                inventory_unit="opak"),
        Product(product_id="P3", product_name_pl="Sól", product_category="Suche",
                inventory_unit="kg"),
    ]


def _suppliers() -> list[Supplier]:
    return [
        Supplier(supplier_id="SUP_A", supplier_name="Warszawa A"),
        Supplier(supplier_id="SUP_EMPTY", supplier_name="Pusty"),
        Supplier(supplier_id="SUP_INTERNAL", supplier_name="Produkcja"),
        Supplier(supplier_id="SUP_KS", supplier_name="Kuchnie Miasto"),
        Supplier(supplier_id="SUP_SEL", supplier_name="Selgros Miasto"),
    ]


def _sp(sp_id, supplier_id, product_id, location_id=None, is_backup=False, active=True):
    return SupplierProduct(
        supplier_product_id=sp_id, supplier_id=supplier_id, product_id=product_id,
        supplier_product_name=f"{product_id} @ {supplier_id}", purchase_unit="szt",
        units_per_purchase_unit=1.0, price_estimate_pln=10.0, location_id=location_id,
        is_backup=is_backup, active=active,
    )


def _supplier_products() -> list[SupplierProduct]:
    return [
        _sp("SP_A_P1", "SUP_A", "P1"),
        _sp("SP_A_P2", "SUP_A", "P2"),
        _sp("SP_A_P3", "SUP_A", "P3"),
        _sp("SP_INT_P3", "SUP_INTERNAL", "P3"),
        _sp("SP_KS_KEN_P1", "SUP_KS", "P1", location_id="KEN"),
        _sp("SP_SEL_KEN_P1", "SUP_SEL", "P1", location_id="KEN", is_backup=True),
        _sp("SP_SEL_KEN_P3", "SUP_SEL", "P3", location_id="KEN"),
        _sp("SP_SEL_KEN_P2", "SUP_SEL", "P2", location_id="KEN", active=False),
    ]


def _setting(location_id, product_id, min_=2.0, target=10.0, max_=20.0):
    return LocationProductSetting(
        setting_id=f"LPS-{location_id}-{product_id}", location_id=location_id,
        product_id=product_id, min_stock_qty_base=min_, target_stock_qty_base=target,
        max_stock_qty_base=max_,
    )


def _settings() -> list[LocationProductSetting]:
    return [
        _setting("WOLA", "P1"), _setting("WOLA", "P2"),
        _setting("KEN", "P1"), _setting("KEN", "P2"), _setting("KEN", "P3"),
    ]


@pytest.fixture
def city(mocker):
    """Sheet mode over the synthetic catalog. Returns the append_order_lines
    mock; no open orders unless a test patches ``sheets.load_orders``."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "append_order")
    appended = mocker.patch.object(sheets, "append_order_lines")
    mocker.patch.object(sheets, "load_products", return_value=_products())
    mocker.patch.object(sheets, "load_locations", return_value=_locations())
    mocker.patch.object(sheets, "load_suppliers", return_value=_suppliers())
    mocker.patch.object(sheets, "load_supplier_products", return_value=_supplier_products())
    mocker.patch.object(sheets, "load_location_product_settings", return_value=_settings())
    mocker.patch.object(sheets, "load_orders", return_value=[])
    mocker.patch.object(sheets, "load_order_lines_for_orders", return_value=[])
    return appended


def _orderable(auth, supplier_id):
    r = client.get(f"/api/captain/orderable?supplier_id={supplier_id}", headers=auth)
    assert r.status_code == 200, r.text
    return {item["product_id"]: item for item in r.json()}


# ---------- pure helpers ----------

def test_scope_is_the_location_only_with_own_catalog():
    locs = _locations()
    assert location_scope("KEN", locs) == "KEN"
    assert location_scope("WOLA", locs) is None
    assert location_scope("NOWHERE", locs) is None
    assert location_scope(None, locs) is None


def test_effective_rows_never_mix_catalogs():
    sps = _supplier_products()
    wola = {sp.supplier_product_id for sp in effective_supplier_products(sps, "WOLA", _locations())}
    ken = {sp.supplier_product_id for sp in effective_supplier_products(sps, "KEN", _locations())}
    assert wola == {"SP_A_P1", "SP_A_P2", "SP_A_P3", "SP_INT_P3"}
    # Inactive scoped row dropped; no shared row leaks into the city.
    assert ken == {"SP_KS_KEN_P1", "SP_SEL_KEN_P1", "SP_SEL_KEN_P3"}


def test_suppliers_by_product_puts_the_primary_first():
    eff = effective_supplier_products(_supplier_products(), "KEN", _locations())
    rows = suppliers_by_product(
        eff, {s.supplier_id: s for s in _suppliers()},
        {p.product_id: p for p in _products()}, {"P1", "P2", "P3"},
    )
    assert [sp.supplier_id for sp in rows["P1"]] == ["SUP_KS", "SUP_SEL"]
    assert list(multi_supplier_products(rows)) == ["P1"]


# ---------- orderable + tabs ----------

def test_warsaw_does_not_see_scoped_rows(city):
    assert _orderable(WOLA_AUTH, "SUP_SEL") == {}
    assert set(_orderable(WOLA_AUTH, "SUP_A")) == {"P1", "P2"}


def test_own_catalog_location_does_not_see_shared_rows(city):
    assert _orderable(KEN_AUTH, "SUP_A") == {}


def test_backup_item_has_no_alerts_and_names_the_primary(city):
    items = _orderable(KEN_AUTH, "SUP_SEL")
    assert set(items) == {"P1", "P3"}
    p1 = items["P1"]
    assert p1["is_backup"] is True
    assert p1["suggestion_alerts_enabled"] is False
    assert p1["primary_supplier_names"] == ["Kuchnie Miasto"]
    assert p1["other_suppliers"] == [{"supplier_id": "SUP_KS", "supplier_name": "Kuchnie Miasto"}]
    p3 = items["P3"]
    assert p3["is_backup"] is False
    assert p3["suggestion_alerts_enabled"] is True
    assert p3["other_suppliers"] == []
    assert p3["open_orders_elsewhere"] == []


def test_primary_item_lists_the_backup_supplier(city):
    p1 = _orderable(KEN_AUTH, "SUP_KS")["P1"]
    assert p1["is_backup"] is False
    assert p1["suggestion_alerts_enabled"] is True
    assert p1["primary_supplier_names"] == []
    assert p1["other_suppliers"] == [{"supplier_id": "SUP_SEL", "supplier_name": "Selgros Miasto"}]


def test_captain_suppliers_lists_only_suppliers_with_goods(city):
    r = client.get("/api/captain/suppliers", headers=KEN_AUTH)
    assert r.status_code == 200, r.text
    assert [s["supplier_id"] for s in r.json()] == ["SUP_KS", "SUP_SEL"]
    r = client.get("/api/captain/suppliers", headers=WOLA_AUTH)
    assert [s["supplier_id"] for s in r.json()] == ["SUP_A"]


def test_captain_suppliers_needs_a_captain_token(city):
    assert client.get("/api/captain/suppliers").status_code == 401


# ---------- submit gates ----------

def _submit(auth, supplier_id, product_id, sp_id, stock, qty):
    return client.post(
        "/api/captain/submit",
        json={
            "supplier_id": supplier_id,
            "ordered_by": "Test",
            "lines": [{
                "product_id": product_id, "supplier_product_id": sp_id,
                "current_stock_qty_base": stock, "captain_final_qty_purchase": qty,
            }],
        },
        headers=auth,
    )


def test_backup_line_needs_no_reason(city):
    """KEN P1 target 10, stock 0 → suggestion 10. Ordering 1 at the backup
    supplier is -90% but needs no reason; the same line at the primary does."""
    r = _submit(KEN_AUTH, "SUP_SEL", "P1", "SP_SEL_KEN_P1", 0, 1)
    assert r.status_code == 200, r.text
    line = city.call_args[0][0][0]
    assert line.reason_code is None
    assert line.suggested_qty_purchase == 10
    r = _submit(KEN_AUTH, "SUP_KS", "P1", "SP_KS_KEN_P1", 0, 1)
    assert r.status_code == 400, r.text


def test_warsaw_submit_rejects_a_scoped_row(city):
    r = _submit(WOLA_AUTH, "SUP_SEL", "P1", "SP_SEL_KEN_P1", 0, 1)
    assert r.status_code == 400
    assert "not orderable" in r.text


def test_city_submit_rejects_a_shared_row(city):
    r = _submit(KEN_AUTH, "SUP_A", "P1", "SP_A_P1", 0, 10)
    assert r.status_code == 400
    assert "not orderable" in r.text


# ---------- inventory ----------

def test_inventory_uses_the_city_catalog(city):
    r = client.get("/api/captain/inventory/products", headers=KEN_AUTH)
    assert r.status_code == 200, r.text
    by_pid = {row["product_id"]: row for row in r.json()}
    assert by_pid["P1"]["supplier_id"] == "SUP_KS"  # primary beats backup
    assert by_pid["P2"]["supplier_id"] is None  # count-only: shared row ignored
    assert by_pid["P3"]["supplier_id"] == "SUP_SEL"


def test_primary_pick_prefers_a_non_backup_row():
    sps = [
        _sp("SP_AAA", "SUP_SEL", "P1", location_id="KEN", is_backup=True),
        _sp("SP_ZZZ", "SUP_KS", "P1", location_id="KEN"),
    ]
    picked = main_mod._primary_supplier_product(
        "P1", sps, {s.supplier_id: s for s in _suppliers()}
    )
    assert picked.supplier_product_id == "SP_ZZZ"


# ---------- open orders elsewhere ----------

def _today() -> date:
    return datetime.now(main_mod._WARSAW_TZ).date()


def _order(order_id, supplier_id, status, location_id="KEN", days_ago=0):
    day = _today() - timedelta(days=days_ago)
    return Order(
        order_id=order_id, location_id=location_id, supplier_id=supplier_id,
        order_date=day, requested_delivery_date=day + timedelta(days=2), status=status,
        captain_submitted_at=datetime(day.year, day.month, day.day, 9, tzinfo=timezone.utc),
    )


def _line(order_id, sp_id, qty, product_id="P1", manager_zero=False):
    return OrderLine(
        order_line_id=f"OL-{order_id}", order_id=order_id, product_id=product_id,
        supplier_product_id=sp_id, captain_final_qty_purchase=qty,
        manager_final_set=manager_zero,
    )


def _open_order_fixture(mocker):
    orders = [
        _order("O_OPEN", "SUP_KS", OrderStatus.CAPTAIN_SUBMITTED),
        _order("O_CLOSED", "SUP_KS", OrderStatus.CLOSED),
        _order("O_CANCELLED", "SUP_KS", OrderStatus.CANCELLED),
        _order("O_OLD", "SUP_KS", OrderStatus.MANAGER_SENT, days_ago=8),
        _order("O_WOLA", "SUP_A", OrderStatus.CAPTAIN_SUBMITTED, location_id="WOLA"),
        _order("O_SAME", "SUP_SEL", OrderStatus.CAPTAIN_SUBMITTED),
        _order("O_ZEROED", "SUP_KS", OrderStatus.MANAGER_CLAIMED),
        _order("O_SENT", "SUP_KS", OrderStatus.MANAGER_SENT, days_ago=7),
    ]
    lines = [
        _line("O_OPEN", "SP_KS_KEN_P1", 3),
        _line("O_CLOSED", "SP_KS_KEN_P1", 3),
        _line("O_CANCELLED", "SP_KS_KEN_P1", 3),
        _line("O_OLD", "SP_KS_KEN_P1", 3),
        _line("O_WOLA", "SP_A_P1", 3),
        _line("O_SAME", "SP_SEL_KEN_P1", 3),
        _line("O_ZEROED", "SP_KS_KEN_P1", 3, manager_zero=True),
        _line("O_SENT", "SP_KS_KEN_P1", 2),
    ]
    mocker.patch.object(sheets, "load_orders", return_value=orders)
    mocker.patch.object(
        sheets, "load_order_lines_for_orders",
        side_effect=lambda ids: [ln for ln in lines if ln.order_id in set(ids)],
    )
    return orders, lines


def test_backup_tab_shows_open_orders_at_the_primary(city, mocker):
    _open_order_fixture(mocker)
    refs = _orderable(KEN_AUTH, "SUP_SEL")["P1"]["open_orders_elsewhere"]
    # Closed, cancelled, older than 7 days, other location, same supplier and
    # a line the Manager zeroed are all left out.
    assert {r["order_id"] for r in refs} == {"O_OPEN", "O_SENT"}
    open_ref = next(r for r in refs if r["order_id"] == "O_OPEN")
    assert open_ref["supplier_name"] == "Kuchnie Miasto"
    assert open_ref["status"] == "captain_submitted"
    assert open_ref["qty_purchase"] == 3
    assert open_ref["purchase_unit"] == "szt"
    # Single-supplier products never pay the lookup.
    assert _orderable(KEN_AUTH, "SUP_SEL")["P3"]["open_orders_elsewhere"] == []


def test_primary_tab_shows_open_orders_at_the_backup(city, mocker):
    _open_order_fixture(mocker)
    refs = _orderable(KEN_AUTH, "SUP_KS")["P1"]["open_orders_elsewhere"]
    assert [r["order_id"] for r in refs] == ["O_SAME"]


def test_open_orders_failure_never_breaks_the_screen(city, mocker):
    mocker.patch.object(sheets, "load_orders", side_effect=RuntimeError("boom"))
    p1 = _orderable(KEN_AUTH, "SUP_SEL")["P1"]
    assert p1["open_orders_elsewhere"] == []


def test_open_orders_off_on_a_non_persistent_backend():
    assert main_mod._open_orders_elsewhere(main_mod.seed_loader, "KEN", ["P1"]) == {}


def test_manager_detail_lists_open_orders_at_the_other_supplier(city, mocker):
    orders, lines = _open_order_fixture(mocker)
    same = next(o for o in orders if o.order_id == "O_SAME")
    same_lines = [ln for ln in lines if ln.order_id == "O_SAME"]
    mocker.patch.object(
        sheets, "get_order", return_value=same.model_copy(update={"lines": same_lines})
    )
    r = client.get("/api/manager/order/O_SAME", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    (line,) = r.json()["lines"]
    assert line["is_backup"] is True
    assert {ref["order_id"] for ref in line["open_orders_elsewhere"]} == {"O_OPEN", "O_SENT"}


# ---------- other location-scoped paths ----------

def test_manager_orderable_with_unconfigured_stays_scoped(city):
    """R-35's include_unconfigured drops only the settings filter, never the
    catalog scope."""
    r = client.get(
        "/api/manager/orderable?supplier_id=SUP_A&location_id=KEN&include_unconfigured=true",
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    assert r.json() == []
    r = client.get(
        "/api/manager/orderable?supplier_id=SUP_SEL&location_id=WOLA&include_unconfigured=true",
        headers=MANAGER_AUTH,
    )
    assert r.json() == []


def test_manager_add_line_rejects_a_shared_row_at_a_city(city, mocker):
    order = _order("O_KEN_A", "SUP_A", OrderStatus.MANAGER_CLAIMED)
    mocker.patch.object(sheets, "get_order", return_value=order.model_copy(update={"lines": []}))
    mocker.patch.object(sheets, "invalidate_cache")
    r = client.post(
        "/api/manager/order/O_KEN_A/add-line",
        json={"product_id": "P2", "supplier_product_id": "SP_A_P2", "allow_unconfigured": True},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 400, r.text


def _edit_order(mocker, order_id, supplier_id, sp_id):
    order = _order(order_id, supplier_id, OrderStatus.CAPTAIN_SUBMITTED)
    line = OrderLine(
        order_line_id=f"OL-{order_id}-001", order_id=order_id, product_id="P1",
        supplier_product_id=sp_id, captain_final_qty_purchase=1,
        current_stock_qty_base=0, target_stock_qty_base=10, suggested_qty_purchase=10,
        suggested_qty_base=10, captain_final_qty_base=1,
    )
    mocker.patch.object(sheets, "get_order", return_value=order.model_copy(update={"lines": [line]}))
    mocker.patch.object(sheets, "invalidate_cache")
    mocker.patch.object(sheets, "replace_order_lines_atomic", create=True)
    mocker.patch.object(sheets, "update_order", create=True)
    mocker.patch.object(sheets, "delete_order_lines", create=True)
    body = {"lines": [{
        "product_id": "P1", "supplier_product_id": sp_id,
        "current_stock_qty_base": 0, "captain_final_qty_purchase": 1,
    }]}
    return client.patch(f"/api/captain/order/{order_id}", json=body, headers=KEN_AUTH)


def test_captain_edit_of_a_backup_line_needs_no_reason(city, mocker):
    """Same gate as submit: -90% at the backup supplier passes, at the primary
    it needs a reason."""
    assert _edit_order(mocker, "O_EDIT_SEL", "SUP_SEL", "SP_SEL_KEN_P1").status_code == 200
    assert _edit_order(mocker, "O_EDIT_KS", "SUP_KS", "SP_KS_KEN_P1").status_code == 400


def test_queue_counts_no_deviation_on_a_backup_line(city, mocker):
    order = _order("O_Q", "SUP_SEL", OrderStatus.CAPTAIN_SUBMITTED)
    line = OrderLine(
        order_line_id="OL-O_Q-001", order_id="O_Q", product_id="P1",
        supplier_product_id="SP_SEL_KEN_P1", captain_final_qty_purchase=1,
        delta_vs_suggestion_pct=0.9,
    )
    mocker.patch.object(sheets, "load_orders", return_value=[order])
    mocker.patch.object(sheets, "load_order_lines_for_orders", return_value=[line])
    mocker.patch.object(sheets, "invalidate_cache")
    r = client.get("/api/manager/queue", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    item = next(i for i in r.json() if i["order_id"] == "O_Q")
    assert item["deviation_count"] == 0


def _count(count_id, location_id):
    return InventoryCount(
        count_id=count_id, location_id=location_id, count_date=_today(), line_count=3,
        lines=[
            InventoryCountLine(count_line_id=f"{count_id}-{pid}", count_id=count_id,
                               product_id=pid, current_stock_qty_base=2)
            for pid in ("P1", "P2", "P3")
        ],
    )


def test_manager_count_detail_uses_the_location_catalog(city, mocker):
    counts = {c.count_id: c for c in (_count("INV-KEN", "KEN"), _count("INV-WOLA", "WOLA"))}
    mocker.patch.object(sheets, "get_inventory_count", side_effect=counts.get)
    mocker.patch.object(sheets, "load_inventory_count_events_for", return_value=[])

    r = client.get("/api/manager/inventory/count/INV-KEN", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    ken = {ln["product_id"]: ln for ln in r.json()["lines"]}
    assert ken["P1"]["supplier_id"] == "SUP_KS"  # primary beats backup
    assert ken["P2"]["supplier_id"] is None  # count-only: no shared row
    assert ken["P2"]["unit_price_netto_pln"] is None
    assert ken["P3"]["supplier_id"] == "SUP_SEL"

    r = client.get("/api/manager/inventory/count/INV-WOLA", headers=MANAGER_AUTH)
    wola = {ln["product_id"]: ln for ln in r.json()["lines"]}
    assert wola["P1"]["supplier_id"] == "SUP_A"
    assert wola["P1"]["unit_price_netto_pln"] == 10.0


def test_seed_tab_is_hidden_only_when_it_has_no_items():
    """Seed data (the Warsaw catalog, WOLA): the captain tab list hides a
    supplier exactly when its order tab would be empty. SUP_INTERNAL is never
    a tab (on-site production; the client filtered it out before too)."""
    all_ids = [
        s["supplier_id"] for s in client.get("/api/suppliers", headers=WOLA_AUTH).json()
        if s["supplier_id"] != "SUP_INTERNAL"
    ]
    shown = {
        s["supplier_id"]
        for s in client.get("/api/captain/suppliers", headers=WOLA_AUTH).json()
    }
    assert shown and "SUP_INTERNAL" not in shown
    for supplier_id in all_ids:
        items = client.get(
            f"/api/captain/orderable?supplier_id={supplier_id}", headers=WOLA_AUTH
        ).json()
        assert (supplier_id in shown) == bool(items), supplier_id
