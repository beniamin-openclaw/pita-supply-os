"""Route tests for the dynamic target (dynamic-target-wola).

The suite runs with SUPPLY_OS_DYNAMIC_TARGET_ENABLED=false (conftest). Every
test here that needs the feature flips the settings attribute with
mocker.patch.object (never os.environ — settings load once) and pins
``main._today_warsaw`` to Monday 2026-09-07, so nothing depends on the real
calendar. The seed dir ships the 18 WOLA usage rows; the seed suppliers.csv
keeps Coca-Cola at "TBD", so the calendar is patched per test.
"""
from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import main, seed_loader, sheets
from app.config import DataBackend, settings
from app.main import app
from app.models import (
    Location,
    LocationProductSetting,
    LocationProductUsage,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    Supplier,
    SupplierProduct,
)

client = TestClient(app)
WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}
MON = date(2026, 9, 7)


_ORIGINAL_LOAD_SUPPLIERS = seed_loader.load_suppliers


def _suppliers_with_calendars() -> list[Supplier]:
    out = []
    for s in _ORIGINAL_LOAD_SUPPLIERS():
        if s.supplier_id == "SUP_COCACOLA":
            s = s.model_copy(update={"delivery_days": "Thu"})
        if s.supplier_id == "SUP_PAGO":
            s = s.model_copy(update={"delivery_days": "Tue, Sat"})
        out.append(s)
    return out


@pytest.fixture
def dynamic_on(mocker):
    mocker.patch.object(settings, "dynamic_target_enabled", True)
    mocker.patch.object(main, "_today_warsaw", return_value=MON)
    mocker.patch.object(seed_loader, "load_suppliers", side_effect=_suppliers_with_calendars)
    return mocker


def _item(items: list[dict], pid: str) -> dict:
    return next(i for i in items if i["product_id"] == pid)


# ---------- orderable ----------

def test_orderable_cola_dynamic_and_kinley_static(dynamic_on):
    r = client.get("/api/captain/orderable?supplier_id=SUP_COCACOLA", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    items = r.json()
    cola = _item(items, "P068")  # 4.53/day, min 24, target 96, Thu → 3 + 7 days
    src = cola["target_source"]
    assert src["mode"] == "dynamic"
    assert (src["delivery_date"], src["next_delivery_date"]) == ("2026-09-10", "2026-09-17")
    assert (src["days_until_delivery"], src["horizon_days"]) == (3, 7)
    # safety = ceil(max(4.53, min(24, 13.59))) = 14; target = ceil(45.3 + 14) = 60
    assert src["safety_base"] == 14
    assert cola["target_stock_qty_base"] == 60
    assert cola["max_stock_qty_base"] == 120  # seed ceiling above the target: untouched
    assert src["max_raised_from"] is None
    assert src["static_target_base"] == 96

    kinley = _item(items, "P079")  # confidence C → static
    assert kinley["target_source"] == {
        **kinley["target_source"], "mode": "static", "reason": "confidence_c",
    }
    assert kinley["target_stock_qty_base"] == 24


def test_orderable_pago_gyros_raises_max_to_target(dynamic_on):
    r = client.get("/api/captain/orderable?supplier_id=SUP_PAGO", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    gyros = _item(r.json(), "P024")  # 12.75/day, min 2, static 10/10, Tue → Sat
    assert gyros["target_stock_qty_base"] == 76.6
    assert gyros["max_stock_qty_base"] == 76.6
    assert gyros["target_source"]["max_raised_from"] == 10
    assert gyros["target_source"]["confidence"] == "A"


def test_orderable_ken_has_no_usage_rows_and_stays_static(dynamic_on):
    r = client.get(
        "/api/captain/orderable?supplier_id=SUP_PAGO",
        headers={"Authorization": "Bearer test_ken_token"},
    )
    assert r.status_code == 200, r.text
    for item in r.json():
        assert item["target_source"]["mode"] == "static"
        assert item["target_source"]["reason"] == "no_usage"


def test_orderable_flag_off_never_loads_usage(mocker):
    spy = mocker.spy(seed_loader, "load_location_product_usage")
    r = client.get("/api/captain/orderable?supplier_id=SUP_COCACOLA", headers=WOLA_AUTH)
    assert r.status_code == 200
    assert spy.call_count == 0
    assert "target_source" not in r.json()[0]


def test_orderable_degrades_to_static_when_usage_loader_raises(dynamic_on):
    dynamic_on.patch.object(
        seed_loader, "load_location_product_usage", side_effect=RuntimeError("table missing")
    )
    r = client.get("/api/captain/orderable?supplier_id=SUP_COCACOLA", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    cola = _item(r.json(), "P068")
    assert cola["target_stock_qty_base"] == 96
    assert cola["target_source"]["mode"] == "static"
    assert cola["target_source"]["reason"] == "no_usage"


def test_orderable_no_calendar_stays_static(mocker):
    """Flag on but the seed Coca-Cola calendar is still 'TBD' → no_calendar."""
    mocker.patch.object(settings, "dynamic_target_enabled", True)
    mocker.patch.object(main, "_today_warsaw", return_value=MON)
    r = client.get("/api/captain/orderable?supplier_id=SUP_COCACOLA", headers=WOLA_AUTH)
    cola = _item(r.json(), "P068")
    assert cola["target_stock_qty_base"] == 96
    assert cola["target_source"]["reason"] == "no_calendar"


def test_manager_orderable_carries_the_same_dynamic_target(dynamic_on):
    r = client.get(
        "/api/manager/orderable?supplier_id=SUP_COCACOLA&location_id=WOLA",
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    assert _item(r.json(), "P068")["target_stock_qty_base"] == 60


def test_orderable_duplicate_usage_row_first_wins(dynamic_on):
    """Seed/Sheets cannot enforce the (location, product) uniqueness Supabase has:
    the FIRST row wins and the duplicate is ignored (adversarial #5)."""
    real = seed_loader.load_location_product_usage()
    dup = next(u for u in real if u.product_id == "P068").model_copy(
        update={"usage_id": "WOLA__P068_DUP", "usage_per_day_base": 1.0}
    )
    dynamic_on.patch.object(
        seed_loader, "load_location_product_usage", return_value=list(real) + [dup]
    )
    r = client.get("/api/captain/orderable?supplier_id=SUP_COCACOLA", headers=WOLA_AUTH)
    assert _item(r.json(), "P068")["target_stock_qty_base"] == 60


# ---------- submit ----------

def _capture_persist(mocker) -> list[list[OrderLine]]:
    captured: list[list[OrderLine]] = []

    def _fake(backend, order, lines):
        captured.append(lines)
        return True

    mocker.patch.object(main, "_persist_order", side_effect=_fake)
    return captured


def _cola_line(current, final, **extra):
    return {
        "product_id": "P068",
        "supplier_product_id": "SP_COCACOLA_P068",
        "current_stock_qty_base": current,
        "captain_final_qty_purchase": final,
        **extra,
    }


def test_submit_accepting_dynamic_suggestion_passes_without_warning(dynamic_on):
    """Cola (seed SP is sold per szt): dynamic target 60, stock 10 → need 50 →
    suggestion 50. Ordering 50 = the on-screen suggestion → 200, no deviation
    warning, and the persisted line snapshots the DYNAMIC target (60), not 96."""
    captured = _capture_persist(dynamic_on)
    r = client.post(
        "/api/captain/submit",
        headers=WOLA_AUTH,
        json={
            "supplier_id": "SUP_COCACOLA",
            "ordered_by": "Test",
            "requested_delivery_date": "2026-09-10",
            "lines": [_cola_line(10, 50)],
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []
    line = captured[0][0]
    assert line.target_stock_qty_base == 60
    assert line.suggested_qty_purchase == 50
    assert line.delta_vs_suggestion_pct == 0


def test_submit_static_suggestion_now_deviates_and_needs_a_reason(dynamic_on):
    """The old static target (96) would have suggested 86 szt; against the
    dynamic 60 (suggestion 50) that is a +72% deviation → 400 without a reason."""
    r = client.post(
        "/api/captain/submit",
        headers=WOLA_AUTH,
        json={
            "supplier_id": "SUP_COCACOLA",
            "ordered_by": "Test",
            "requested_delivery_date": "2026-09-10",
            "lines": [_cola_line(10, 86)],
        },
    )
    assert r.status_code == 400
    assert "deviates" in r.json()["detail"]


@pytest.mark.parametrize(
    "requested",
    # too far / Wednesday / past / absent / today itself (even on a delivery day
    # the screen anchored on the NEXT delivery, so "today" must not shrink it)
    ["2026-10-30", "2026-09-09", "2026-09-06", None, "2026-09-07"],
)
def test_submit_invalid_requested_date_uses_server_calendar(dynamic_on, requested):
    captured = _capture_persist(dynamic_on)
    body = {
        "supplier_id": "SUP_COCACOLA",
        "ordered_by": "Test",
        "lines": [_cola_line(10, 50)],
    }
    if requested is not None:
        body["requested_delivery_date"] = requested
    r = client.post("/api/captain/submit", headers=WOLA_AUTH, json=body)
    assert r.status_code == 200, r.text
    assert captured[0][0].target_stock_qty_base == 60


def test_submit_flag_off_is_byte_identical(mocker):
    """No flag → static 96: stock 10 → need 86 → suggestion 86, snapshot 96."""
    captured = _capture_persist(mocker)
    r = client.post(
        "/api/captain/submit",
        headers=WOLA_AUTH,
        json={
            "supplier_id": "SUP_COCACOLA",
            "ordered_by": "Test",
            "lines": [_cola_line(10, 86)],
        },
    )
    assert r.status_code == 200, r.text
    assert captured[0][0].target_stock_qty_base == 96


def test_submit_uncounted_pago_gyros_uses_raised_max(dynamic_on):
    """Uncounted stock + 5 bloków (75 kg) against static max 10 would be over-MAX;
    with the dynamic target 76.6 the effective max is 76.6 → no reason needed."""
    captured = _capture_persist(dynamic_on)
    r = client.post(
        "/api/captain/submit",
        headers=WOLA_AUTH,
        json={
            "supplier_id": "SUP_PAGO",
            "ordered_by": "Test",
            "lines": [
                {
                    "product_id": "P024",
                    "supplier_product_id": "SP_PAGO_P024",
                    "captain_final_qty_purchase": 5,
                }
            ],
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []
    assert captured[0][0].target_stock_qty_base == 76.6


def test_submit_degrades_a_corrupt_dynamic_target_to_static(dynamic_on):
    """A NaN slipping out of the engine must not 500 the order: the line falls
    back to the static target (96 → suggestion 86) and the submit succeeds."""
    from app.models import TargetSource

    dynamic_on.patch.object(
        main.dynamic_target,
        "resolve_effective_target",
        return_value=(float("nan"), 96.0, TargetSource(mode="dynamic", static_target_base=96)),
    )
    captured = _capture_persist(dynamic_on)
    r = client.post(
        "/api/captain/submit",
        headers=WOLA_AUTH,
        json={
            "supplier_id": "SUP_COCACOLA",
            "ordered_by": "Test",
            "lines": [_cola_line(10, 86)],
        },
    )
    assert r.status_code == 200, r.text
    assert captured[0][0].target_stock_qty_base == 96


# ---------- edit: snapshot target wins for products already on the order ----------

def _sheet_order_with_snapshot(mocker, *, snapshot_target: float):
    """Sheet-backed WOLA × SUP_PAGO order with one P024 line whose snapshot
    target differs from both the static setting (10) and today's dynamic value."""
    order = Order(
        order_id="ORD-DYN", location_id="WOLA", supplier_id="SUP_PAGO",
        order_date=date(2026, 9, 5), requested_delivery_date=date(2026, 9, 8),
        status=OrderStatus.CAPTAIN_SUBMITTED, captain_user="WOLA",
    )
    line = OrderLine(
        order_line_id="OL-1", order_id="ORD-DYN", product_id="P024",
        supplier_product_id="SP_PAGO_P024", current_stock_qty_base=20,
        target_stock_qty_base=snapshot_target, suggested_qty_base=40,
        suggested_qty_purchase=3, captain_final_qty_purchase=3, captain_final_qty_base=45,
    )
    order = order.model_copy(update={"lines": [line]})
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_orders", return_value=[order])
    mocker.patch.object(sheets, "load_order_lines", return_value=[line])
    mocker.patch.object(sheets, "get_order", return_value=order)
    mocker.patch.object(
        sheets, "load_suppliers",
        return_value=[Supplier(supplier_id="SUP_PAGO", supplier_name="Pago", delivery_days="Tue, Sat")],
    )
    mocker.patch.object(
        sheets, "load_products",
        return_value=[
            Product(product_id="P024", product_name_pl="Gyros", product_category="M", inventory_unit="kg"),
            Product(product_id="P027", product_name_pl="Souvlaki", product_category="M", inventory_unit="kg"),
        ],
    )
    mocker.patch.object(
        sheets, "load_supplier_products",
        return_value=[
            SupplierProduct(supplier_product_id="SP_PAGO_P024", supplier_id="SUP_PAGO", product_id="P024",
                            supplier_product_name="Gyros", purchase_unit="blok", units_per_purchase_unit=15),
            SupplierProduct(supplier_product_id="SP_PAGO_P027", supplier_id="SUP_PAGO", product_id="P027",
                            supplier_product_name="Souvlaki", purchase_unit="karton", units_per_purchase_unit=5),
        ],
    )
    mocker.patch.object(
        sheets, "load_location_product_settings",
        return_value=[
            LocationProductSetting(setting_id="WOLA__P024", location_id="WOLA", product_id="P024",
                                   min_stock_qty_base=2, max_stock_qty_base=10, target_stock_qty_base=10),
            LocationProductSetting(setting_id="WOLA__P027", location_id="WOLA", product_id="P027",
                                   min_stock_qty_base=4, max_stock_qty_base=12, target_stock_qty_base=12),
        ],
    )
    mocker.patch.object(
        sheets, "load_location_product_usage",
        return_value=[
            LocationProductUsage(usage_id="WOLA__P024", location_id="WOLA", product_id="P024",
                                 usage_per_day_base=12.75, confidence="A"),
            LocationProductUsage(usage_id="WOLA__P027", location_id="WOLA", product_id="P027",
                                 usage_per_day_base=12.5, confidence="A"),
        ],
    )
    mocker.patch.object(sheets, "load_locations", return_value=[Location(location_id="WOLA", location_name="Wola")])
    mocker.patch.object(sheets, "delete_order_lines", return_value=1)
    append = mocker.patch.object(sheets, "append_order_lines", return_value=None)
    mocker.patch.object(sheets, "update_order", return_value=None)
    return append


def test_edit_reuses_snapshot_target_and_resolves_new_products_fresh(mocker):
    mocker.patch.object(settings, "dynamic_target_enabled", True)
    mocker.patch.object(main, "_today_warsaw", return_value=MON)
    append = _sheet_order_with_snapshot(mocker, snapshot_target=65.0)
    # P024 stays on the order: snapshot 65, stock 20 → need 45 → 3 bloki (matches).
    # P027 is NEW on edit: fresh dynamic target = ceil(12.5×5 + 12.5) = 75, stock 25
    # → need 50 → 10 kartonów.
    r = client.patch(
        "/api/captain/order/ORD-DYN",
        headers=WOLA_AUTH,
        json={
            "lines": [
                {"product_id": "P024", "supplier_product_id": "SP_PAGO_P024",
                 "current_stock_qty_base": 20, "captain_final_qty_purchase": 3},
                {"product_id": "P027", "supplier_product_id": "SP_PAGO_P027",
                 "current_stock_qty_base": 25, "captain_final_qty_purchase": 10},
            ]
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["warnings"] == []
    appended = append.call_args[0][0]
    by_pid = {ln.product_id: ln for ln in appended}
    assert by_pid["P024"].target_stock_qty_base == 65.0
    assert by_pid["P027"].target_stock_qty_base == 75.0


def test_edit_flag_off_ignores_snapshot_and_uses_static_setting(mocker):
    append = _sheet_order_with_snapshot(mocker, snapshot_target=65.0)
    # Static setting 10, stock 20 → suggestion 0; ordering 3 needs a reason → 400.
    r = client.patch(
        "/api/captain/order/ORD-DYN",
        headers=WOLA_AUTH,
        json={
            "lines": [
                {"product_id": "P024", "supplier_product_id": "SP_PAGO_P024",
                 "current_stock_qty_base": 20, "captain_final_qty_purchase": 3},
            ]
        },
    )
    assert r.status_code == 400
    assert append.call_count == 0


def test_order_detail_max_is_raised_to_the_snapshot_target(mocker):
    """A persisted dynamic line re-displayed for edit must not read max < target
    (adversarial #4): the detail join raises max to the snapshot when the flag is on."""
    mocker.patch.object(settings, "dynamic_target_enabled", True)
    _sheet_order_with_snapshot(mocker, snapshot_target=65.0)
    r = client.get("/api/captain/order/ORD-DYN", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    line = r.json()["lines"][0]
    assert line["target_stock_qty_base"] == 65.0
    assert line["max_stock_qty_base"] == 65.0
    r2 = client.get("/api/manager/order/ORD-DYN", headers=MANAGER_AUTH)
    assert r2.status_code == 200, r2.text
    assert r2.json()["lines"][0]["max_stock_qty_base"] == 65.0


def test_order_detail_flag_off_keeps_static_max(mocker):
    _sheet_order_with_snapshot(mocker, snapshot_target=65.0)
    r = client.get("/api/captain/order/ORD-DYN", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["lines"][0]["max_stock_qty_base"] == 10.0
