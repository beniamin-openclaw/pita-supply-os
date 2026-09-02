"""Tests for the Manager Transport backend (to-ordering-pago):

    GET  /api/manager/transport/eligible
    GET  /api/manager/transport/batches
    GET  /api/manager/transport/batch/{transport_id}
    POST /api/manager/transport/create   (Phase 2)

A Transport batch combines submitted per-location orders for one supplier
(Pago first) into one aggregated pickup: per-product totals (for the
supplier order) plus the per-product x per-location breakdown (the private
driver list / zużycie usage record). The GET routes are read-only — the
marker that groups orders into a batch (`supplier_order_reference` starting
with "TRN-") is created by POST create; the read-side tests exercise the
aggregation and listing logic against synthetic marker data, while the
create tests exercise the marker-writing transitions themselves.

Strategy mirrors test_manager_queue.py / test_suggestion_review.py:
monkey-patch the `sheets` module so these tests never touch real Google
credentials. Synthetic data only — no real supplier order is ever placed or
dispatched.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from app import errors, sheets
from app.config import DataBackend
from app.main import _aggregate_transport_lines, app
from app.models import (
    Location,
    LocationProductSetting,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    Receipt,
    Supplier,
    SupplierProduct,
    TransportBatch,
    TransportEvent,
)

TRANSPORT_ID_RE = re.compile(r"^TRN-\d{8}-[A-Z0-9]{1,4}-[0-9a-f]{6}$")

client = TestClient(app)

MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}
CAPTAIN_AUTH = {"Authorization": "Bearer test_wola_token"}


# ---------- Fixture builders ----------

def _order(
    order_id: str,
    location_id: str = "WOLA",
    supplier_id: str = "SUP_PAGO",
    status: OrderStatus = OrderStatus.CAPTAIN_SUBMITTED,
    total: float = 668.0,
    captain_submitted_at: datetime | None = None,
    manager_sent_at: datetime | None = None,
    ordered_by: str | None = "Jan Kowalski",
    supplier_order_reference: str | None = None,
    captain_user: str | None = None,
    extra_items: str = "",
    captain_note: str = "",
) -> Order:
    return Order(
        order_id=order_id,
        location_id=location_id,
        supplier_id=supplier_id,
        order_date=date(2026, 5, 20),
        status=status,
        captain_user=captain_user if captain_user is not None else location_id,
        captain_submitted_at=captain_submitted_at
        or datetime(2026, 5, 20, 8, 30, tzinfo=timezone.utc),
        manager_sent_at=manager_sent_at,
        ordered_by=ordered_by,
        total_value_estimate_pln=total,
        supplier_order_reference=supplier_order_reference,
        extra_items=extra_items,
        captain_note=captain_note,
    )


def _line(
    order_id: str,
    line_id: str,
    product_id: str = "P027",
    sp_id: str = "SP_PAGO_P027",
    captain_qty: float = 5.0,
    manager_qty: float = 0.0,
) -> OrderLine:
    return OrderLine(
        order_line_id=line_id,
        order_id=order_id,
        product_id=product_id,
        supplier_product_id=sp_id,
        captain_final_qty_purchase=captain_qty,
        manager_final_qty_purchase=manager_qty,
    )


def _supplier(supplier_id: str = "SUP_PAGO", name: str = "Pago") -> Supplier:
    return Supplier(
        supplier_id=supplier_id, supplier_name=name, email="zamowienia@pago.example"
    )


def _product(product_id: str = "P027", name: str = "Souvlaki Kurczak") -> Product:
    return Product(
        product_id=product_id,
        product_name_pl=name,
        product_category="Mięso",
        inventory_unit="kg",
    )


def _supplier_product(
    sp_id: str = "SP_PAGO_P027",
    supplier_id: str = "SUP_PAGO",
    product_id: str = "P027",
    name: str = "Souvlaki Kurczak karton",
    purchase_unit: str = "karton",
) -> SupplierProduct:
    return SupplierProduct(
        supplier_product_id=sp_id,
        supplier_id=supplier_id,
        product_id=product_id,
        supplier_product_name=name,
        purchase_unit=purchase_unit,
        units_per_purchase_unit=5.0,
    )


def _location(location_id: str = "WOLA", name: str = "Pita Bros Wola") -> Location:
    return Location(location_id=location_id, location_name=name)


def _enable_sheet_backend(
    mocker,
    orders: list[Order],
    lines: list[OrderLine] | None = None,
    suppliers: list[Supplier] | None = None,
    products: list[Product] | None = None,
    supplier_products: list[SupplierProduct] | None = None,
    locations: list[Location] | None = None,
    location_product_settings: list | None = None,
    transport_batches: list[TransportBatch] | None = None,
    transport_events: list["TransportEvent"] | None = None,
    receipts: list | None = None,
) -> None:
    """Switch backend selector to sheets and patch the load_* surface (mirrors
    `test_manager_queue.py::_enable_sheet_backend`).

    ``transport_batches`` defaults to ``[]`` (no header rows — every marker
    group reads as an implicit legacy ``status="sent"`` batch), NOT a
    ``WorksheetNotFound`` — tests that need the "missing worksheet" path patch
    ``load_transport_batches``/``get_transport_batch`` themselves.

    ``transport_events`` defaults to ``[]`` (no history) and is filtered by
    ``transport_id`` the same way ``sheets.load_transport_events_for`` does,
    so a test can pass events for several batches and each detail call still
    sees only its own. ``receipts`` defaults to ``[]`` (no deliveries yet).
    """
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)

    mocker.patch.object(sheets, "load_orders", return_value=orders)
    mocker.patch.object(sheets, "load_order_lines", return_value=lines or [])
    mocker.patch.object(
        sheets, "load_suppliers", return_value=suppliers or [_supplier()]
    )
    mocker.patch.object(
        sheets, "load_products", return_value=products or [_product()]
    )
    mocker.patch.object(
        sheets,
        "load_supplier_products",
        return_value=supplier_products or [_supplier_product()],
    )
    mocker.patch.object(
        sheets, "load_locations", return_value=locations or [_location()]
    )
    mocker.patch.object(
        sheets,
        "load_location_product_settings",
        return_value=location_product_settings or [],
    )
    batches = transport_batches if transport_batches is not None else []
    mocker.patch.object(sheets, "load_transport_batches", return_value=batches)

    def _get_transport_batch(transport_id: str):
        return next((b for b in batches if b.transport_id == transport_id), None)

    mocker.patch.object(
        sheets, "get_transport_batch", side_effect=_get_transport_batch
    )

    events = transport_events if transport_events is not None else []

    def _load_transport_events_for(transport_id: str):
        return [e for e in events if e.transport_id == transport_id]

    mocker.patch.object(
        sheets, "load_transport_events_for", side_effect=_load_transport_events_for
    )
    mocker.patch.object(
        sheets, "load_receipts_for_orders", return_value=receipts or []
    )


def _enable_sheet_backend_for_create(
    mocker,
    orders: list[Order],
    suppliers: list[Supplier] | None = None,
    transport_batches: list[TransportBatch] | None = None,
) -> dict:
    """`_enable_sheet_backend` plus the write-side mocks the create endpoint
    needs (`invalidate_cache` + `update_order` + `append_transport_batch` +
    `append_transport_event`). `update_order` defaults to a silent success;
    tests override `.side_effect` to simulate a guard conflict on a specific
    call."""
    _enable_sheet_backend(
        mocker, orders=orders, suppliers=suppliers, transport_batches=transport_batches
    )
    mocker.patch.object(sheets, "invalidate_cache", return_value=None)
    update_mock = mocker.patch.object(sheets, "update_order", return_value=None)
    append_batch_mock = mocker.patch.object(
        sheets, "append_transport_batch", return_value=None
    )
    append_event_mock = mocker.patch.object(
        sheets, "append_transport_event", return_value=None
    )
    return {
        "update_order": update_mock,
        "append_transport_batch": append_batch_mock,
        "append_transport_event": append_event_mock,
    }


def _enable_sheet_backend_for_write(
    mocker,
    orders: list[Order],
    **kwargs,
) -> dict:
    """`_enable_sheet_backend` plus every write-side mock the v2/v3 draft-lifecycle
    endpoints (finalize / add-location / remove-order / patch / cancel) need,
    all defaulting to silent success. Tests override `.side_effect` /
    `.return_value` on the returned mocks to simulate a specific outcome."""
    _enable_sheet_backend(mocker, orders=orders, **kwargs)
    mocker.patch.object(sheets, "invalidate_cache", return_value=None)
    return {
        "update_order": mocker.patch.object(sheets, "update_order", return_value=None),
        "append_order": mocker.patch.object(sheets, "append_order", return_value=None),
        "append_order_lines": mocker.patch.object(
            sheets, "append_order_lines", return_value=None
        ),
        "append_transport_batch": mocker.patch.object(
            sheets, "append_transport_batch", return_value=None
        ),
        "update_transport_batch": mocker.patch.object(
            sheets, "update_transport_batch", return_value=None
        ),
        "append_transport_event": mocker.patch.object(
            sheets, "append_transport_event", return_value=None
        ),
    }


# ---------- Pure aggregation helper: _aggregate_transport_lines ----------

def test_aggregate_effective_qty_prefers_manager_final():
    orders = [_order("ORD-1")]
    lines = [_line("ORD-1", "OL-1", captain_qty=5.0, manager_qty=8.0)]
    items = _aggregate_transport_lines(orders, lines, {}, {}, {})
    assert items[0].total_qty_purchase == 8.0


def test_aggregate_effective_qty_falls_back_to_captain_when_manager_zero():
    orders = [_order("ORD-1")]
    lines = [_line("ORD-1", "OL-1", captain_qty=5.0, manager_qty=0.0)]
    items = _aggregate_transport_lines(orders, lines, {}, {}, {})
    assert items[0].total_qty_purchase == 5.0


def test_aggregate_drops_zero_effective_qty_lines():
    orders = [_order("ORD-1")]
    lines = [_line("ORD-1", "OL-1", captain_qty=0.0, manager_qty=0.0)]
    items = _aggregate_transport_lines(orders, lines, {}, {}, {})
    assert items == []


def test_aggregate_multi_order_same_location_kept_separate_summed():
    orders = [
        _order("ORD-1", location_id="WOLA"),
        _order("ORD-2", location_id="WOLA"),
    ]
    lines = [
        _line("ORD-1", "OL-1", captain_qty=3.0),
        _line("ORD-2", "OL-2", captain_qty=4.0),
    ]
    items = _aggregate_transport_lines(orders, lines, {}, {}, {})
    assert len(items) == 1
    line = items[0]
    assert line.total_qty_purchase == 7.0
    assert len(line.per_location) == 2  # kept separate, not merged
    assert {pl.order_id for pl in line.per_location} == {"ORD-1", "ORD-2"}
    assert all(pl.location_id == "WOLA" for pl in line.per_location)


def test_aggregate_sorted_by_product_name():
    orders = [_order("ORD-1")]
    lines = [
        _line("ORD-1", "OL-1", product_id="P_ZZZ", sp_id="SP_ZZZ", captain_qty=1.0),
        _line("ORD-1", "OL-2", product_id="P_AAA", sp_id="SP_AAA", captain_qty=1.0),
    ]
    products = {
        "P_ZZZ": _product("P_ZZZ", "Żubrówka"),
        "P_AAA": _product("P_AAA", "Ananas"),
    }
    items = _aggregate_transport_lines(orders, lines, products, {}, {})
    assert [it.product_id for it in items] == ["P_AAA", "P_ZZZ"]


def test_aggregate_missing_master_data_falls_back_to_ids():
    orders = [_order("ORD-1", location_id="MISSING_LOC")]
    lines = [_line("ORD-1", "OL-1", product_id="P_MISSING", sp_id="SP_MISSING")]
    items = _aggregate_transport_lines(orders, lines, {}, {}, {})
    assert len(items) == 1
    line = items[0]
    assert line.product_name_pl == "P_MISSING"
    assert line.supplier_product_name == "SP_MISSING"
    assert line.purchase_unit == ""
    assert line.per_location[0].location_name == "MISSING_LOC"


def test_aggregate_line_with_no_matching_order_is_skipped():
    orders = [_order("ORD-1")]
    lines = [_line("ORD-ORPHAN", "OL-1")]
    items = _aggregate_transport_lines(orders, lines, {}, {}, {})
    assert items == []


def test_aggregate_empty_inputs():
    assert _aggregate_transport_lines([], [], {}, {}, {}) == []


def test_aggregate_joins_supplier_product_display():
    orders = [_order("ORD-1")]
    lines = [_line("ORD-1", "OL-1")]
    sps = {"SP_PAGO_P027": _supplier_product()}
    items = _aggregate_transport_lines(orders, lines, {}, sps, {})
    assert items[0].supplier_product_name == "Souvlaki Kurczak karton"
    assert items[0].purchase_unit == "karton"


def test_aggregate_supplier_sku_present_when_set():
    orders = [_order("ORD-1")]
    lines = [_line("ORD-1", "OL-1")]
    sp = _supplier_product()
    sp = sp.model_copy(update={"supplier_sku": "GYRSW15KG"})
    sps = {"SP_PAGO_P027": sp}
    items = _aggregate_transport_lines(orders, lines, {}, sps, {})
    assert items[0].supplier_sku == "GYRSW15KG"


def test_aggregate_supplier_sku_none_when_unset():
    orders = [_order("ORD-1")]
    lines = [_line("ORD-1", "OL-1")]
    sps = {"SP_PAGO_P027": _supplier_product()}
    items = _aggregate_transport_lines(orders, lines, {}, sps, {})
    assert items[0].supplier_sku is None


def test_aggregate_supplier_sku_none_when_supplier_product_missing():
    orders = [_order("ORD-1")]
    lines = [_line("ORD-1", "OL-1")]
    items = _aggregate_transport_lines(orders, lines, {}, {}, {})
    assert items[0].supplier_sku is None


# ---------- warehouse_pickup join (training-feedback-0901 Phase 4) ----------

def test_aggregate_warehouse_pickup_true_when_set():
    orders = [_order("ORD-1")]
    lines = [_line("ORD-1", "OL-1")]
    sp = _supplier_product().model_copy(update={"warehouse_pickup": True})
    sps = {"SP_PAGO_P027": sp}
    items = _aggregate_transport_lines(orders, lines, {}, sps, {})
    assert items[0].warehouse_pickup is True


def test_aggregate_warehouse_pickup_false_when_unset():
    orders = [_order("ORD-1")]
    lines = [_line("ORD-1", "OL-1")]
    sps = {"SP_PAGO_P027": _supplier_product()}
    items = _aggregate_transport_lines(orders, lines, {}, sps, {})
    assert items[0].warehouse_pickup is False


def test_aggregate_warehouse_pickup_false_when_supplier_product_missing():
    orders = [_order("ORD-1")]
    lines = [_line("ORD-1", "OL-1")]
    items = _aggregate_transport_lines(orders, lines, {}, {}, {})
    assert items[0].warehouse_pickup is False


# ---------- GET /api/manager/transport/eligible ----------

def test_eligible_filters_by_supplier_and_status(mocker):
    orders = [
        _order("ORD-A", supplier_id="SUP_PAGO", status=OrderStatus.CAPTAIN_SUBMITTED),
        _order("ORD-B", supplier_id="SUP_PAGO", status=OrderStatus.MANAGER_CLAIMED),
        _order("ORD-C", supplier_id="SUP_PAGO", status=OrderStatus.MANAGER_SENT),
        _order("ORD-D", supplier_id="SUP_PAGO", status=OrderStatus.CANCELLED),
        _order("ORD-E", supplier_id="SUP_BUKAT", status=OrderStatus.CAPTAIN_SUBMITTED),
    ]
    _enable_sheet_backend(mocker, orders=orders)
    r = client.get(
        "/api/manager/transport/eligible",
        params={"supplier_id": "SUP_PAGO"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    ids = {it["order_id"] for it in r.json()}
    assert ids == {"ORD-A", "ORD-B"}


def test_eligible_enrichment_fields(mocker):
    orders = [_order("ORD-A")]
    lines = [_line("ORD-A", "OL-1"), _line("ORD-A", "OL-2")]
    suppliers = [_supplier(name="Pago Sp. z o.o.")]
    locations = [_location(name="Pita Bros Wola")]
    _enable_sheet_backend(
        mocker, orders=orders, lines=lines, suppliers=suppliers, locations=locations
    )
    r = client.get(
        "/api/manager/transport/eligible",
        params={"supplier_id": "SUP_PAGO"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    item = r.json()[0]
    assert item["location_name"] == "Pita Bros Wola"
    assert item["supplier_name"] == "Pago Sp. z o.o."
    assert item["line_count"] == 2
    assert item["ordered_by"] == "Jan Kowalski"
    assert item["total_value_estimate_pln"] == 668.0


def test_eligible_newest_first(mocker):
    orders = [
        _order("ORD-OLD", captain_submitted_at=datetime(2026, 5, 1, tzinfo=timezone.utc)),
        _order("ORD-NEW", captain_submitted_at=datetime(2026, 5, 20, tzinfo=timezone.utc)),
    ]
    _enable_sheet_backend(mocker, orders=orders)
    r = client.get(
        "/api/manager/transport/eligible",
        params={"supplier_id": "SUP_PAGO"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    assert [it["order_id"] for it in r.json()] == ["ORD-NEW", "ORD-OLD"]


def test_eligible_empty_in_seed_mode():
    r = client.get(
        "/api/manager/transport/eligible",
        params={"supplier_id": "SUP_PAGO"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200
    assert r.json() == []


def test_eligible_rejects_captain_token(mocker):
    _enable_sheet_backend(mocker, orders=[])
    r = client.get(
        "/api/manager/transport/eligible",
        params={"supplier_id": "SUP_PAGO"},
        headers=CAPTAIN_AUTH,
    )
    assert r.status_code == 401


def test_eligible_unauthorized_no_token():
    r = client.get("/api/manager/transport/eligible", params={"supplier_id": "SUP_PAGO"})
    assert r.status_code == 401


# ---------- GET /api/manager/transport/batches ----------

def test_batches_groups_by_trn_marker(mocker):
    orders = [
        _order(
            "ORD-A",
            location_id="WOLA",
            status=OrderStatus.MANAGER_SENT,
            supplier_order_reference="TRN-20260520-PAGO-abc123",
            manager_sent_at=datetime(2026, 5, 20, 9, 0, tzinfo=timezone.utc),
        ),
        _order(
            "ORD-B",
            location_id="KEN",
            status=OrderStatus.MANAGER_SENT,
            supplier_order_reference="TRN-20260520-PAGO-abc123",
            manager_sent_at=datetime(2026, 5, 20, 9, 5, tzinfo=timezone.utc),
        ),
        _order("ORD-C", status=OrderStatus.CAPTAIN_SUBMITTED, supplier_order_reference=None),
    ]
    _enable_sheet_backend(mocker, orders=orders)
    r = client.get("/api/manager/transport/batches", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert len(payload) == 1
    batch = payload[0]
    assert batch["transport_id"] == "TRN-20260520-PAGO-abc123"
    assert batch["order_count"] == 2
    assert batch["location_ids"] == ["KEN", "WOLA"]
    assert batch["created"].startswith("2026-05-20T09:00:00")  # min(manager_sent_at)


def test_batches_and_detail_expose_friendly_name(mocker):
    """Feature 1 (v4 feedback): a batch header's ``name`` surfaces on both the
    list and detail responses; None when never set."""
    header = TransportBatch(
        transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft", name="Wtorkowy Pago"
    )
    orders = [
        _order(
            "ORD-A",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
        )
    ]
    _enable_sheet_backend(mocker, orders=orders, transport_batches=[header])

    r = client.get("/api/manager/transport/batches", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()[0]["name"] == "Wtorkowy Pago"

    r2 = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r2.status_code == 200, r2.text
    assert r2.json()["name"] == "Wtorkowy Pago"


def test_batches_filters_by_supplier(mocker):
    orders = [
        _order(
            "ORD-A",
            supplier_id="SUP_PAGO",
            status=OrderStatus.MANAGER_SENT,
            supplier_order_reference="TRN-20260520-PAGO-aaa111",
            manager_sent_at=datetime(2026, 5, 20, tzinfo=timezone.utc),
        ),
        _order(
            "ORD-B",
            supplier_id="SUP_BUKAT",
            status=OrderStatus.MANAGER_SENT,
            supplier_order_reference="TRN-20260520-BUKA-bbb222",
            manager_sent_at=datetime(2026, 5, 20, tzinfo=timezone.utc),
        ),
    ]
    _enable_sheet_backend(mocker, orders=orders)
    r = client.get(
        "/api/manager/transport/batches",
        params={"supplier_id": "SUP_PAGO"},
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    ids = [b["transport_id"] for b in r.json()]
    assert ids == ["TRN-20260520-PAGO-aaa111"]


def test_batches_newest_first(mocker):
    orders = [
        _order(
            "ORD-A",
            supplier_order_reference="TRN-OLD",
            status=OrderStatus.MANAGER_SENT,
            manager_sent_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        ),
        _order(
            "ORD-B",
            supplier_order_reference="TRN-NEW",
            status=OrderStatus.MANAGER_SENT,
            manager_sent_at=datetime(2026, 5, 20, tzinfo=timezone.utc),
        ),
    ]
    _enable_sheet_backend(mocker, orders=orders)
    r = client.get("/api/manager/transport/batches", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    ids = [b["transport_id"] for b in r.json()]
    assert ids == ["TRN-NEW", "TRN-OLD"]


def test_batches_ignores_non_trn_reference(mocker):
    orders = [
        _order(
            "ORD-A",
            status=OrderStatus.MANAGER_SENT,
            supplier_order_reference="something-else",
            manager_sent_at=datetime(2026, 5, 20, tzinfo=timezone.utc),
        )
    ]
    _enable_sheet_backend(mocker, orders=orders)
    r = client.get("/api/manager/transport/batches", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_batches_empty_in_seed_mode():
    r = client.get("/api/manager/transport/batches", headers=MANAGER_AUTH)
    assert r.status_code == 200
    assert r.json() == []


def test_batches_rejects_captain_token(mocker):
    _enable_sheet_backend(mocker, orders=[])
    r = client.get("/api/manager/transport/batches", headers=CAPTAIN_AUTH)
    assert r.status_code == 401


# ---------- GET /api/manager/transport/batch/{transport_id} ----------

def test_batch_detail_404_unknown(mocker):
    _enable_sheet_backend(mocker, orders=[])
    r = client.get("/api/manager/transport/batch/TRN-UNKNOWN", headers=MANAGER_AUTH)
    assert r.status_code == 404


def test_batch_detail_seed_mode_503():
    r = client.get(
        "/api/manager/transport/batch/TRN-20260520-PAGO-abc123", headers=MANAGER_AUTH
    )
    assert r.status_code == 503


def test_batch_detail_aggregate_math(mocker):
    orders = [
        _order(
            "ORD-A",
            location_id="WOLA",
            status=OrderStatus.MANAGER_SENT,
            supplier_order_reference="TRN-20260520-PAGO-abc123",
            manager_sent_at=datetime(2026, 5, 20, 9, 0, tzinfo=timezone.utc),
        ),
        _order(
            "ORD-B",
            location_id="KEN",
            status=OrderStatus.MANAGER_SENT,
            supplier_order_reference="TRN-20260520-PAGO-abc123",
            manager_sent_at=datetime(2026, 5, 20, 9, 5, tzinfo=timezone.utc),
        ),
    ]
    lines = [
        _line("ORD-A", "OL-1", captain_qty=3.0),
        _line("ORD-B", "OL-2", captain_qty=4.0, manager_qty=6.0),
    ]
    products = [_product()]
    sps = [_supplier_product()]
    locations = [
        _location("WOLA", "Pita Bros Wola"),
        _location("KEN", "Pita Bros KEN"),
    ]
    _enable_sheet_backend(
        mocker,
        orders=orders,
        lines=lines,
        products=products,
        supplier_products=sps,
        locations=locations,
    )
    r = client.get(
        "/api/manager/transport/batch/TRN-20260520-PAGO-abc123", headers=MANAGER_AUTH
    )
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["transport_id"] == "TRN-20260520-PAGO-abc123"
    assert detail["order_count"] == 2
    assert detail["location_ids"] == ["KEN", "WOLA"]
    assert {o["order_id"] for o in detail["orders"]} == {"ORD-A", "ORD-B"}
    assert len(detail["lines"]) == 1
    line = detail["lines"][0]
    assert line["product_name_pl"] == "Souvlaki Kurczak"
    assert line["total_qty_purchase"] == 9.0  # 3.0 (captain) + 6.0 (manager_final)
    assert len(line["per_location"]) == 2


# ---------- batch_supplier_id: header vs group[0] (training-feedback-0901 Phase 4) ----------

def test_batch_detail_supplier_id_from_header_when_present(mocker):
    """`batch_supplier_id` prefers the transport_batches header's supplier_id
    over group[0].supplier_id — group[0] has no defined order and the header
    is the batch's authoritative supplier (set once at create/append-to). The
    member order below is deliberately given a DIFFERENT supplier_id than the
    header to prove the header wins; research.md confirms real batches are
    single-supplier by construction, so this mismatch is synthetic — it only
    exercises the precedence, not a state that occurs in practice."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order(
            "ORD-A",
            location_id="WOLA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
            supplier_id="SUP_BUKAT",
        )
    ]
    suppliers = [_supplier("SUP_PAGO", "Pago"), _supplier("SUP_BUKAT", "Bukat")]
    _enable_sheet_backend(
        mocker,
        orders=orders,
        suppliers=suppliers,
        locations=[_location("WOLA")],
        transport_batches=[header],
    )

    r = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["supplier_id"] == "SUP_PAGO"
    assert detail["supplier_name"] == "Pago"


def test_batch_detail_supplier_id_from_member_order_when_no_header(mocker):
    """A headerless (legacy v1) batch has no header supplier_id to prefer, so
    it falls back to group[0].supplier_id — the only source available."""
    orders = [
        _order(
            "ORD-A",
            location_id="WOLA",
            status=OrderStatus.MANAGER_SENT,
            supplier_order_reference="TRN-LEGACY-SUP",
            supplier_id="SUP_BUKAT",
            manager_sent_at=datetime(2026, 5, 20, 9, 0, tzinfo=timezone.utc),
        )
    ]
    _enable_sheet_backend(
        mocker,
        orders=orders,
        suppliers=[_supplier("SUP_BUKAT", "Bukat")],
        locations=[_location("WOLA")],
        transport_batches=[],
    )

    r = client.get("/api/manager/transport/batch/TRN-LEGACY-SUP", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["supplier_id"] == "SUP_BUKAT"
    assert detail["supplier_name"] == "Bukat"


def test_batch_detail_rejects_captain_token(mocker):
    _enable_sheet_backend(mocker, orders=[])
    r = client.get(
        "/api/manager/transport/batch/TRN-20260520-PAGO-abc123", headers=CAPTAIN_AUTH
    )
    assert r.status_code == 401


# ---------- POST /api/manager/transport/create (Phase 2) ----------


def test_create_seed_mode_503():
    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-A"]},
    )
    assert r.status_code == 503


def test_create_unknown_supplier_400(mocker):
    _enable_sheet_backend_for_create(mocker, orders=[])
    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_GHOST", "order_ids": ["ORD-A"]},
    )
    assert r.status_code == 400
    assert "SUP_GHOST" in r.json()["detail"]


def test_create_rejects_captain_token(mocker):
    _enable_sheet_backend_for_create(mocker, orders=[])
    r = client.post(
        "/api/manager/transport/create",
        headers=CAPTAIN_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-A"]},
    )
    assert r.status_code == 401


def test_create_empty_order_ids_starts_empty_draft(mocker):
    """v2 empty-draft contract: order_ids=[] is VALID — the manager-driven flow
    starts from nothing (a supplier with zero submitted orders must not
    dead-end); a draft header is created and locations are added next."""
    patches = _enable_sheet_backend_for_create(mocker, orders=[])
    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": []},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == []
    assert payload["skipped"] == []
    assert payload["transport_id"].startswith("TRN-")
    patches["append_transport_batch"].assert_called_once()
    header = patches["append_transport_batch"].call_args[0][0]
    assert header.status == "draft"
    assert header.supplier_id == "SUP_PAGO"


def test_create_happy_path_from_captain_submitted(mocker):
    """v2: create claims + stamps the marker, and NEVER writes manager_sent —
    the order stays manager_claimed until a separate finalize call."""
    orders = [_order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED)]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-A"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == ["ORD-A"]
    assert payload["skipped"] == []
    assert TRANSPORT_ID_RE.match(payload["transport_id"])

    update_mock = patches["update_order"]
    assert update_mock.call_count == 2

    claim_args, claim_kwargs = update_mock.call_args_list[0]
    assert claim_args[0] == "ORD-A"
    assert claim_kwargs["status"] == "manager_claimed"
    assert claim_kwargs["expected_status"] == "captain_submitted"

    marker_args, marker_kwargs = update_mock.call_args_list[1]
    assert marker_args[0] == "ORD-A"
    assert marker_kwargs["supplier_order_reference"] == payload["transport_id"]
    assert marker_kwargs["expected_status"] == "manager_claimed"
    # No manager_sent write anywhere in create (v2 semantics).
    assert all(
        c.kwargs.get("status") != "manager_sent"
        for c in update_mock.call_args_list
    )
    assert not any(
        "manager_sent_at" in c.kwargs for c in update_mock.call_args_list
    )

    # A fresh draft header row is appended for the new batch.
    patches["append_transport_batch"].assert_called_once()
    header = patches["append_transport_batch"].call_args.args[0]
    assert header.transport_id == payload["transport_id"]
    assert header.supplier_id == "SUP_PAGO"
    assert header.status == "draft"


def test_create_happy_path_from_manager_claimed(mocker):
    """An already-claimed order skips the claim step and only gets the
    marker stamped — still no manager_sent write."""
    orders = [_order("ORD-B", status=OrderStatus.MANAGER_CLAIMED)]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-B"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == ["ORD-B"]
    assert payload["skipped"] == []

    update_mock = patches["update_order"]
    update_mock.assert_called_once()
    args, kwargs = update_mock.call_args
    assert args[0] == "ORD-B"
    assert kwargs["supplier_order_reference"] == payload["transport_id"]
    assert kwargs["expected_status"] == "manager_claimed"
    assert "status" not in kwargs

    patches["append_transport_batch"].assert_called_once()


def test_create_unknown_order_id_skipped(mocker):
    orders = [_order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED)]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-A", "ORD-GHOST"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == ["ORD-A"]
    assert payload["skipped"] == [{"order_id": "ORD-GHOST", "reason": "not found"}]
    # The unknown id never reached update_order.
    called_ids = {c.args[0] for c in patches["update_order"].call_args_list}
    assert "ORD-GHOST" not in called_ids


def test_create_wrong_supplier_skipped(mocker):
    orders = [
        _order("ORD-A", supplier_id="SUP_PAGO", status=OrderStatus.CAPTAIN_SUBMITTED),
        _order("ORD-X", supplier_id="SUP_BUKAT", status=OrderStatus.CAPTAIN_SUBMITTED),
    ]
    _enable_sheet_backend_for_create(mocker, orders=orders)

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-A", "ORD-X"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == ["ORD-A"]
    assert payload["skipped"] == [{"order_id": "ORD-X", "reason": "different supplier"}]


def test_create_status_not_eligible_skipped(mocker):
    orders = [_order("ORD-A", status=OrderStatus.MANAGER_SENT)]
    _enable_sheet_backend_for_create(mocker, orders=orders)

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-A"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == []
    assert payload["skipped"] == [
        {"order_id": "ORD-A", "reason": "status manager_sent not eligible"}
    ]


def test_create_duplicate_order_id_skipped(mocker):
    orders = [_order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED)]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-A", "ORD-A"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == ["ORD-A"]
    assert payload["skipped"] == [{"order_id": "ORD-A", "reason": "duplicate"}]
    # ORD-A is processed exactly once (claim + send), not twice.
    assert patches["update_order"].call_count == 2


def test_create_mixed_batch_conflict_on_claim_others_combined(mocker):
    orders = [
        _order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED),
        _order("ORD-B", status=OrderStatus.CAPTAIN_SUBMITTED),
    ]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)

    def _side_effect(order_id, **kwargs):
        if order_id == "ORD-B" and kwargs.get("status") == "manager_claimed":
            raise errors.OrderStatusConflictError("conflict")
        return None

    patches["update_order"].side_effect = _side_effect

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-A", "ORD-B"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == ["ORD-A"]
    assert len(payload["skipped"]) == 1
    assert payload["skipped"][0]["order_id"] == "ORD-B"

    # ORD-B's failed claim was NEVER followed by a release attempt (it never
    # claimed in the first place) — exactly one call for ORD-B.
    b_calls = [
        c for c in patches["update_order"].call_args_list if c.args[0] == "ORD-B"
    ]
    assert len(b_calls) == 1


def test_create_dispatched_conflict_also_skips(mocker):
    """Both guard exceptions (`OrderStatusConflictError` AND
    `OrderAlreadyDispatchedError`) map to skipped[] — the Sheets asymmetry
    documented in the plan."""
    orders = [_order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED)]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)

    def _side_effect(order_id, **kwargs):
        if kwargs.get("status") == "manager_claimed":
            raise errors.OrderAlreadyDispatchedError("already dispatched")
        return None

    patches["update_order"].side_effect = _side_effect

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-A"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == []
    assert len(payload["skipped"]) == 1
    assert payload["skipped"][0]["order_id"] == "ORD-A"


def test_create_claim_succeeds_marker_stamp_fails_releases_and_skips(mocker):
    """Claim succeeds, the marker-stamp write then conflicts -> best-effort
    release back to captain_submitted (v2: the second step is a marker stamp,
    not a send)."""
    orders = [_order("ORD-C", status=OrderStatus.CAPTAIN_SUBMITTED)]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)

    calls: list[tuple[str, str | None]] = []

    def _side_effect(order_id, **kwargs):
        calls.append((order_id, kwargs.get("status")))
        if "supplier_order_reference" in kwargs:
            raise errors.OrderStatusConflictError("boom")
        return None

    patches["update_order"].side_effect = _side_effect

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-C"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == []
    assert len(payload["skipped"]) == 1
    assert payload["skipped"][0]["order_id"] == "ORD-C"
    assert payload["skipped"][0]["reason"] == "marker conflict"

    # claim -> marker stamp (fails) -> best-effort release to captain_submitted.
    assert calls == [
        ("ORD-C", "manager_claimed"),
        ("ORD-C", None),  # the marker-stamp call carries no "status" kwarg
        ("ORD-C", "captain_submitted"),
    ]
    release_args, release_kwargs = patches["update_order"].call_args_list[2]
    assert release_kwargs["expected_status"] == "manager_claimed"

    # v2 empty-draft contract: a NEW batch always gets its draft header row,
    # even when every order ended up skipped — the manager can retry/append
    # or add locations into the (empty) draft instead of losing the id.
    patches["append_transport_batch"].assert_called_once()
    assert patches["append_transport_batch"].call_args[0][0].status == "draft"


def test_create_append_to_happy_path(mocker):
    """append_to reuses an existing DRAFT batch header — no new header row is
    appended, and the joining order is only marker-stamped (still no send)."""
    header = TransportBatch(
        transport_id="TRN-20260520-PAGO-abc123",
        supplier_id="SUP_PAGO",
        status="draft",
    )
    new_order = _order("ORD-NEW", status=OrderStatus.CAPTAIN_SUBMITTED)
    patches = _enable_sheet_backend_for_create(
        mocker, orders=[new_order], transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={
            "supplier_id": "SUP_PAGO",
            "order_ids": ["ORD-NEW"],
            "append_to": "TRN-20260520-PAGO-abc123",
        },
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["transport_id"] == "TRN-20260520-PAGO-abc123"
    assert payload["combined"] == ["ORD-NEW"]

    marker_kwargs = patches["update_order"].call_args_list[1].kwargs
    assert marker_kwargs["supplier_order_reference"] == "TRN-20260520-PAGO-abc123"
    assert "status" not in marker_kwargs

    # Reused an existing header — no new one appended.
    patches["append_transport_batch"].assert_not_called()


def test_create_append_to_not_draft_400(mocker):
    """append_to naming a SENT (already-finalized) batch is rejected —
    quantities are frozen once finalized."""
    header = TransportBatch(
        transport_id="TRN-20260520-PAGO-abc123",
        supplier_id="SUP_PAGO",
        status="sent",
    )
    new_order = _order("ORD-NEW", status=OrderStatus.CAPTAIN_SUBMITTED)
    _enable_sheet_backend_for_create(
        mocker, orders=[new_order], transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={
            "supplier_id": "SUP_PAGO",
            "order_ids": ["ORD-NEW"],
            "append_to": "TRN-20260520-PAGO-abc123",
        },
    )
    assert r.status_code == 400
    assert "draft" in r.json()["detail"]


def test_create_append_to_unknown_400(mocker):
    orders = [_order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED)]
    _enable_sheet_backend_for_create(mocker, orders=orders)

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={
            "supplier_id": "SUP_PAGO",
            "order_ids": ["ORD-A"],
            "append_to": "TRN-DOES-NOT-EXIST",
        },
    )
    assert r.status_code == 400
    assert "TRN-DOES-NOT-EXIST" in r.json()["detail"]


def test_create_append_to_supplier_mismatch_400(mocker):
    header = TransportBatch(
        transport_id="TRN-20260520-BUKA-abc123",
        supplier_id="SUP_BUKAT",
        status="draft",
    )
    new_order = _order("ORD-NEW", supplier_id="SUP_PAGO", status=OrderStatus.CAPTAIN_SUBMITTED)
    _enable_sheet_backend_for_create(
        mocker, orders=[new_order], transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={
            "supplier_id": "SUP_PAGO",
            "order_ids": ["ORD-NEW"],
            "append_to": "TRN-20260520-BUKA-abc123",
        },
    )
    assert r.status_code == 400
    assert "SUP_BUKAT" in r.json()["detail"] or "SUP_PAGO" in r.json()["detail"]


def test_create_all_orders_skipped_still_returns_transport_id(mocker):
    _enable_sheet_backend_for_create(mocker, orders=[])

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-GHOST"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == []
    assert payload["skipped"] == [{"order_id": "ORD-GHOST", "reason": "not found"}]
    assert TRANSPORT_ID_RE.match(payload["transport_id"])


def test_create_unexpected_error_degrades_to_skipped_backend_error(mocker):
    """A non-guard exception mid-loop (backend outage, vanished row) must not
    500 the request after earlier orders were durably combined — it degrades
    to a skipped[] "backend error" entry and the loop continues (F2)."""
    orders = [
        _order("ORD-OK", status=OrderStatus.MANAGER_CLAIMED),
        _order("ORD-BOOM", status=OrderStatus.CAPTAIN_SUBMITTED),
    ]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)

    calls: list[tuple[str, str | None]] = []

    def _side_effect(order_id, **kwargs):
        calls.append((order_id, kwargs.get("status")))
        if order_id == "ORD-BOOM" and "supplier_order_reference" in kwargs:
            raise RuntimeError("sheets API exploded")
        return None

    patches["update_order"].side_effect = _side_effect

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-OK", "ORD-BOOM"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == ["ORD-OK"]
    assert payload["skipped"] == [
        {"order_id": "ORD-BOOM", "reason": "backend error"}
    ]
    # ORD-OK marker-stamped (no status kwarg); ORD-BOOM claim -> marker stamp
    # (raises) -> best-effort release.
    assert calls == [
        ("ORD-OK", None),
        ("ORD-BOOM", "manager_claimed"),
        ("ORD-BOOM", None),
        ("ORD-BOOM", "captain_submitted"),
    ]

    # ORD-OK combined -> a header row IS appended (even though ORD-BOOM failed).
    patches["append_transport_batch"].assert_called_once()


# ---------- POST /api/manager/transport/finalize (v2) ----------


def test_finalize_seed_mode_503():
    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 503


def test_finalize_batch_not_found_404(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[])
    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-UNKNOWN"},
    )
    assert r.status_code == 404


def test_finalize_batch_not_draft_409(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="sent")
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[header])
    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 409


def test_finalize_happy_path(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X"),
        _order("ORD-B", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X"),
    ]
    lines = [
        _line("ORD-A", "OL-A-1", captain_qty=5.0),
        _line("ORD-B", "OL-B-1", captain_qty=3.0),
    ]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=lines, transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert set(payload["sent"]) == {"ORD-A", "ORD-B"}
    assert payload["skipped"] == []

    send_calls = {
        c.args[0]: c.kwargs for c in patches["update_order"].call_args_list
    }
    for order_id in ("ORD-A", "ORD-B"):
        assert send_calls[order_id]["status"] == "manager_sent"
        assert send_calls[order_id]["sent_method"] == "transport"
        assert send_calls[order_id]["expected_status"] == "manager_claimed"

    patches["update_transport_batch"].assert_called_once()
    tb_args, tb_kwargs = patches["update_transport_batch"].call_args
    assert tb_args[0] == "TRN-X"
    assert tb_kwargs["status"] == "sent"
    assert tb_kwargs["sent_at"] is not None


def test_finalize_skips_non_claimed_member(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X"),
        _order("ORD-C", status=OrderStatus.CANCELLED, supplier_order_reference="TRN-X"),
    ]
    lines = [_line("ORD-A", "OL-A-1", captain_qty=5.0)]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=lines, transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["sent"] == ["ORD-A"]
    assert payload["skipped"] == [
        {"order_id": "ORD-C", "reason": "status cancelled not eligible"}
    ]
    patches["update_transport_batch"].assert_called_once()  # ORD-A sent


def test_finalize_all_skipped_header_not_updated(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-C", status=OrderStatus.CANCELLED, supplier_order_reference="TRN-X"),
    ]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["sent"] == []
    patches["update_transport_batch"].assert_not_called()


def test_finalize_send_conflict_skips(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X"),
    ]
    lines = [_line("ORD-A", "OL-A-1", captain_qty=5.0)]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=lines, transport_batches=[header]
    )
    patches["update_order"].side_effect = errors.OrderStatusConflictError("boom")

    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["sent"] == []
    assert payload["skipped"] == [{"order_id": "ORD-A", "reason": "send conflict"}]


# ---------- Finalize: empty-column guard (v4 feedback) ----------


def test_finalize_all_empty_400_batch_stays_draft(mocker):
    """Every manager_claimed member has an all-zero effective total (no
    lines at all) -> 400, and NOTHING is written: no update_order, no
    update_transport_batch, batch stays draft."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X"),
        _order("ORD-B", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X"),
    ]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=[], transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 400
    assert "nothing to send" in r.json()["detail"]
    patches["update_order"].assert_not_called()
    patches["update_transport_batch"].assert_not_called()


def test_finalize_all_zero_qty_lines_400(mocker):
    """Lines exist but every line's effective qty is 0 (captain + manager
    both 0) -> same 400 as no lines at all."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X"),
    ]
    lines = [_line("ORD-A", "OL-A-1", captain_qty=0.0, manager_qty=0.0)]
    _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=lines, transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 400


def test_finalize_removes_empty_manager_created_order_cancelled(mocker):
    """Mixed batch: ORD-A has a real quantity and is sent; ORD-B is a
    manager-created (add-location) order that was never filled in — it is
    auto-removed via cancel, reported skipped, and never sent."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X"),
        _order(
            "ORD-B",
            location_id="BRACKA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
            captain_user="manager-default",
        ),
    ]
    lines = [_line("ORD-A", "OL-A-1", captain_qty=5.0)]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=lines, transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["sent"] == ["ORD-A"]
    assert payload["skipped"] == [{"order_id": "ORD-B", "reason": "empty — removed"}]

    remove_call = next(
        c for c in patches["update_order"].call_args_list if c.args[0] == "ORD-B"
    )
    assert remove_call.kwargs["status"] == "cancelled"
    assert remove_call.kwargs["cancel_reason"] == "empty — removed at send"

    event_calls = [c.args[0] for c in patches["append_transport_event"].call_args_list]
    assert any(
        ev.event_type == "order_removed" and ev.order_id == "ORD-B"
        for ev in event_calls
    )


def test_finalize_removes_empty_captain_origin_order_released(mocker):
    """A captain-origin member with an all-zero effective total is released
    back to captain_submitted (marker cleared), not cancelled."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X"),
        _order(
            "ORD-B",
            location_id="BRACKA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
            captain_user="BRACKA",
        ),
    ]
    lines = [
        _line("ORD-A", "OL-A-1", captain_qty=5.0),
        _line("ORD-B", "OL-B-1", captain_qty=0.0, manager_qty=0.0),
    ]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=lines, transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["sent"] == ["ORD-A"]
    assert payload["skipped"] == [{"order_id": "ORD-B", "reason": "empty — removed"}]

    remove_call = next(
        c for c in patches["update_order"].call_args_list if c.args[0] == "ORD-B"
    )
    assert remove_call.kwargs["status"] == "captain_submitted"
    assert remove_call.kwargs["supplier_order_reference"] is None


def test_finalize_remove_conflict_skips(mocker):
    """A guard conflict on the auto-remove write is reported skipped with
    its own reason, not silently swallowed nor mixed up with 'send conflict'."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X"),
        _order(
            "ORD-B",
            location_id="BRACKA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
            captain_user="manager-default",
        ),
    ]
    lines = [_line("ORD-A", "OL-A-1", captain_qty=5.0)]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=lines, transport_batches=[header]
    )

    def _update_order(order_id, **kwargs):
        if order_id == "ORD-B":
            raise errors.OrderStatusConflictError("boom")
        return None

    patches["update_order"].side_effect = _update_order

    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["sent"] == ["ORD-A"]
    assert payload["skipped"] == [{"order_id": "ORD-B", "reason": "remove conflict"}]


def test_finalize_rejects_captain_token(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[])
    r = client.post(
        "/api/manager/transport/finalize",
        headers=CAPTAIN_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 401


# ---------- POST /api/manager/transport/add-location (v2) ----------


def test_add_location_seed_mode_503():
    r = client.post(
        "/api/manager/transport/add-location",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "location_id": "WOLA"},
    )
    assert r.status_code == 503


def test_add_location_batch_not_found_404(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[])
    r = client.post(
        "/api/manager/transport/add-location",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-UNKNOWN", "location_id": "WOLA"},
    )
    assert r.status_code == 404


def test_add_location_batch_not_draft_409(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="sent")
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[header])
    r = client.post(
        "/api/manager/transport/add-location",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "location_id": "WOLA"},
    )
    assert r.status_code == 409


def test_add_location_unknown_location_400(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[header], locations=[_location("WOLA")]
    )
    r = client.post(
        "/api/manager/transport/add-location",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "location_id": "GHOST"},
    )
    assert r.status_code == 400
    assert "GHOST" in r.json()["detail"]


def test_add_location_duplicate_location_400(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", location_id="WOLA", supplier_order_reference="TRN-X"),
    ]
    _enable_sheet_backend_for_write(
        mocker,
        orders=orders,
        transport_batches=[header],
        locations=[_location("WOLA")],
    )
    r = client.post(
        "/api/manager/transport/add-location",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "location_id": "WOLA"},
    )
    assert r.status_code == 400
    assert "WOLA" in r.json()["detail"]


def test_add_location_happy_path(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    patches = _enable_sheet_backend_for_write(
        mocker,
        orders=[],
        transport_batches=[header],
        locations=[_location("BRACKA", "Bracka")],
    )
    r = client.post(
        "/api/manager/transport/add-location",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "location_id": "BRACKA"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["transport_id"] == "TRN-X"
    assert payload["order_id"]

    patches["append_order"].assert_called_once()
    new_order = patches["append_order"].call_args.args[0]
    assert new_order.location_id == "BRACKA"
    assert new_order.supplier_id == "SUP_PAGO"
    assert new_order.status == OrderStatus.MANAGER_CLAIMED
    assert new_order.captain_user == "manager-default"
    assert new_order.ordered_by == "manager"
    assert new_order.supplier_order_reference == "TRN-X"
    assert new_order.lines == []


def test_add_location_rejects_captain_token(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[])
    r = client.post(
        "/api/manager/transport/add-location",
        headers=CAPTAIN_AUTH,
        json={"transport_id": "TRN-X", "location_id": "WOLA"},
    )
    assert r.status_code == 401


# ---------- POST /api/manager/transport/remove-order (v2) ----------


def test_remove_order_seed_mode_503():
    r = client.post(
        "/api/manager/transport/remove-order",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "order_id": "ORD-A"},
    )
    assert r.status_code == 503


def test_remove_order_batch_not_found_404(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[])
    r = client.post(
        "/api/manager/transport/remove-order",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-UNKNOWN", "order_id": "ORD-A"},
    )
    assert r.status_code == 404


def test_remove_order_batch_not_draft_409(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="sent")
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[header])
    r = client.post(
        "/api/manager/transport/remove-order",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "order_id": "ORD-A"},
    )
    assert r.status_code == 409


def test_remove_order_not_in_batch_404(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [_order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference=None)]
    _enable_sheet_backend_for_write(mocker, orders=orders, transport_batches=[header])
    r = client.post(
        "/api/manager/transport/remove-order",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "order_id": "ORD-A"},
    )
    assert r.status_code == 404


def test_remove_order_not_manager_claimed_409(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", status=OrderStatus.MANAGER_SENT, supplier_order_reference="TRN-X")
    ]
    _enable_sheet_backend_for_write(mocker, orders=orders, transport_batches=[header])
    r = client.post(
        "/api/manager/transport/remove-order",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "order_id": "ORD-A"},
    )
    assert r.status_code == 409


def test_remove_order_release_path(mocker):
    """A regular (captain-originated) order is released, not cancelled."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order(
            "ORD-A",
            location_id="WOLA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
        )
    ]
    lines = [_line("ORD-A", "OL-1", captain_qty=3.0)]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=lines, transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/remove-order",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "order_id": "ORD-A"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["action"] == "released"

    args, kwargs = patches["update_order"].call_args
    assert args[0] == "ORD-A"
    assert kwargs["supplier_order_reference"] is None
    assert kwargs["status"] == "captain_submitted"
    assert kwargs["expected_status"] == "manager_claimed"


def test_remove_order_cancel_path_manager_created_empty(mocker):
    """A manager-created order (add-location, still no lines) is cancelled
    outright rather than released back to a captain that never submitted it."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order(
            "ORD-M",
            location_id="BRACKA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
        ).model_copy(update={"captain_user": "manager-default"})
    ]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=[], transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/remove-order",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "order_id": "ORD-M"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["action"] == "cancelled"

    args, kwargs = patches["update_order"].call_args
    assert args[0] == "ORD-M"
    assert kwargs["status"] == "cancelled"
    assert kwargs["cancel_reason"] == "removed from transport"
    assert kwargs["cancelled_by"] == "manager-default"
    assert kwargs["expected_status"] == "manager_claimed"


def test_remove_order_manager_created_with_lines_is_released_not_cancelled(mocker):
    """A manager-created order that already HAS lines (products were added)
    is released, not cancelled — only an empty manager-created skeleton is
    cancelled outright."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order(
            "ORD-M",
            location_id="BRACKA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
        ).model_copy(update={"captain_user": "manager-default"})
    ]
    lines = [_line("ORD-M", "OL-1", captain_qty=2.0)]
    _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=lines, transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/remove-order",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "order_id": "ORD-M"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["action"] == "released"


def test_remove_order_rejects_captain_token(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[])
    r = client.post(
        "/api/manager/transport/remove-order",
        headers=CAPTAIN_AUTH,
        json={"transport_id": "TRN-X", "order_id": "ORD-A"},
    )
    assert r.status_code == 401


# ---------- PATCH /api/manager/transport/batch/{transport_id} (v2) ----------


def test_batch_patch_seed_mode_503():
    r = client.patch(
        "/api/manager/transport/batch/TRN-X",
        headers=MANAGER_AUTH,
        json={"driver": "Jan"},
    )
    assert r.status_code == 503


def test_batch_patch_not_found_404(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[])
    r = client.patch(
        "/api/manager/transport/batch/TRN-UNKNOWN",
        headers=MANAGER_AUTH,
        json={"driver": "Jan"},
    )
    assert r.status_code == 404


def test_batch_patch_updates_only_provided_fields(mocker):
    header = TransportBatch(
        transport_id="TRN-X",
        supplier_id="SUP_PAGO",
        status="draft",
        driver="Old Driver",
        vehicle="Old Van",
    )
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[header]
    )

    r = client.patch(
        "/api/manager/transport/batch/TRN-X",
        headers=MANAGER_AUTH,
        json={"driver": "New Driver"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["driver"] == "New Driver"
    assert payload["vehicle"] == "Old Van"  # untouched
    assert payload["status"] == "draft"

    patches["update_transport_batch"].assert_called_once_with(
        "TRN-X", driver="New Driver"
    )


def test_batch_patch_sets_friendly_name(mocker):
    """Feature 1 (v4 feedback): the friendly ``name`` field is patchable like
    any other logistics field, and a change is recorded as a logistics_changed
    event diff (old → new)."""
    header = TransportBatch(
        transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft", name=None
    )
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[header]
    )

    r = client.patch(
        "/api/manager/transport/batch/TRN-X",
        headers=MANAGER_AUTH,
        json={"name": "Wtorkowy Pago"},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["name"] == "Wtorkowy Pago"

    patches["update_transport_batch"].assert_called_once_with(
        "TRN-X", name="Wtorkowy Pago"
    )
    event = patches["append_transport_event"].call_args_list[0].args[0]
    assert event.event_type == "logistics_changed"
    assert "name" in event.details
    assert "Wtorkowy Pago" in event.details


def test_batch_patch_allowed_when_sent(mocker):
    """Logistics fields can change after finalize — only quantities are
    frozen once sent."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="sent")
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[header])

    r = client.patch(
        "/api/manager/transport/batch/TRN-X",
        headers=MANAGER_AUTH,
        json={"pickup_time": "07:30"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["pickup_time"] == "07:30"
    assert r.json()["status"] == "sent"


def test_batch_patch_rejects_captain_token(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[])
    r = client.patch(
        "/api/manager/transport/batch/TRN-X",
        headers=CAPTAIN_AUTH,
        json={"driver": "Jan"},
    )
    assert r.status_code == 401


# ---------- Weight preview (v2) ----------


def test_batch_detail_weight_math_known_and_unknown(mocker):
    orders = [
        _order(
            "ORD-A",
            location_id="WOLA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
        )
    ]
    lines = [
        _line("ORD-A", "OL-1", product_id="P_KNOWN", sp_id="SP_KNOWN", captain_qty=4.0),
        _line("ORD-A", "OL-2", product_id="P_UNKNOWN", sp_id="SP_UNKNOWN", captain_qty=2.0),
    ]
    products = [
        _product("P_KNOWN", "Znana waga"),
        _product("P_UNKNOWN", "Nieznana waga"),
    ]
    sps = [
        _supplier_product(
            sp_id="SP_KNOWN", product_id="P_KNOWN", name="Znana", purchase_unit="karton"
        ).model_copy(update={"unit_weight_kg": 2.5}),
        _supplier_product(
            sp_id="SP_UNKNOWN", product_id="P_UNKNOWN", name="Nieznana", purchase_unit="karton"
        ),  # unit_weight_kg left None
    ]
    header = TransportBatch(
        transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft", limit_kg=700
    )
    _enable_sheet_backend(
        mocker,
        orders=orders,
        lines=lines,
        products=products,
        supplier_products=sps,
        locations=[_location("WOLA")],
        transport_batches=[header],
    )

    r = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["status"] == "draft"
    assert detail["limit_kg"] == 700
    assert detail["unknown_weight_count"] == 1
    # known line: 4.0 * 2.5 = 10.0 kg; unknown line contributes 0 to the total.
    assert detail["total_weight_kg"] == 10.0

    lines_by_pid = {ln["product_id"]: ln for ln in detail["lines"]}
    assert lines_by_pid["P_KNOWN"]["unit_weight_kg"] == 2.5
    assert lines_by_pid["P_KNOWN"]["line_weight_kg"] == 10.0
    assert lines_by_pid["P_UNKNOWN"]["unit_weight_kg"] is None
    assert lines_by_pid["P_UNKNOWN"]["line_weight_kg"] is None


# ---------- Legacy (v1) headerless batch read path (v2) ----------


def test_batch_detail_legacy_headerless_batch_reads_as_sent(mocker):
    """A marker group with NO transport_batches header row (a v1-created
    batch) reads as an implicit read-only status="sent" batch — v1 behavior
    preserved."""
    orders = [
        _order(
            "ORD-A",
            location_id="WOLA",
            status=OrderStatus.MANAGER_SENT,
            supplier_order_reference="TRN-LEGACY",
            manager_sent_at=datetime(2026, 5, 20, 9, 0, tzinfo=timezone.utc),
        )
    ]
    _enable_sheet_backend(
        mocker, orders=orders, locations=[_location("WOLA")], transport_batches=[]
    )

    r = client.get("/api/manager/transport/batch/TRN-LEGACY", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["status"] == "sent"
    assert detail["driver"] is None
    assert detail["created"].startswith("2026-05-20T09:00:00")


def test_batch_detail_missing_worksheet_degrades_to_legacy(mocker):
    """A 'transport_batches' worksheet that doesn't exist yet (not created
    by the operator) degrades to "no headers", not an error."""
    orders = [
        _order(
            "ORD-A",
            status=OrderStatus.MANAGER_SENT,
            supplier_order_reference="TRN-LEGACY",
            manager_sent_at=datetime(2026, 5, 20, 9, 0, tzinfo=timezone.utc),
        )
    ]
    _enable_sheet_backend(mocker, orders=orders)
    mocker.patch.object(
        sheets, "get_transport_batch", side_effect=sheets.WorksheetNotFound("no tab")
    )

    r = client.get("/api/manager/transport/batch/TRN-LEGACY", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "sent"


def test_batches_list_missing_worksheet_degrades_to_legacy(mocker):
    orders = [
        _order(
            "ORD-A",
            status=OrderStatus.MANAGER_SENT,
            supplier_order_reference="TRN-LEGACY",
            manager_sent_at=datetime(2026, 5, 20, 9, 0, tzinfo=timezone.utc),
        )
    ]
    _enable_sheet_backend(mocker, orders=orders)
    mocker.patch.object(
        sheets, "load_transport_batches", side_effect=sheets.WorksheetNotFound("no tab")
    )

    r = client.get("/api/manager/transport/batches", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert len(payload) == 1
    assert payload[0]["status"] == "sent"


def test_batch_detail_includes_full_enriched_lines_per_order(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order(
            "ORD-A",
            location_id="WOLA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
        )
    ]
    lines = [_line("ORD-A", "OL-1", captain_qty=5.0)]
    _enable_sheet_backend(
        mocker,
        orders=orders,
        lines=lines,
        locations=[_location("WOLA")],
        transport_batches=[header],
    )

    r = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    order_out = r.json()["orders"][0]
    assert order_out["order_id"] == "ORD-A"
    assert len(order_out["lines"]) == 1
    assert order_out["lines"][0]["order_line_id"] == "OL-1"
    assert order_out["lines"][0]["captain_final_qty_purchase"] == 5.0


def test_batch_detail_surfaces_extra_items_and_captain_note(mocker):
    """F1 (backend half, plan-r2): a member order's ad-hoc off-catalogue items
    and Captain note must reach the Manager on ``TransportBatchOrder`` — today
    they stop at the order and never surface on the Transport batch detail, so
    the frontend builders have no data to append a "Pozycje spoza katalogu"
    block from. An order that has neither must report "" (NOT NULL DEFAULT ''
    contract), never null/None.
    """
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order(
            "ORD-A",
            location_id="WOLA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
            extra_items="Feta - 5 kg",
            captain_note="Impreza w piątek, proszę o priorytet",
        ),
        _order(
            "ORD-B",
            location_id="BRACKA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
        ),
    ]
    _enable_sheet_backend(
        mocker,
        orders=orders,
        lines=[_line("ORD-A", "OL-1"), _line("ORD-B", "OL-2")],
        locations=[_location("WOLA"), _location("BRACKA", "Pita Bros Bracka")],
        transport_batches=[header],
    )

    r = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    by_id = {o["order_id"]: o for o in r.json()["orders"]}
    assert by_id["ORD-A"]["extra_items"] == "Feta - 5 kg"
    assert by_id["ORD-A"]["captain_note"] == "Impreza w piątek, proszę o priorytet"
    assert by_id["ORD-B"]["extra_items"] == ""
    assert by_id["ORD-B"]["captain_note"] == ""


def test_batch_detail_draft_includes_all_zero_orders(mocker):
    """A draft batch's member order with an all-zero line still shows up in
    ``orders`` (only the aggregate zero-drops)."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order(
            "ORD-ZERO",
            location_id="WOLA",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
        )
    ]
    lines = [_line("ORD-ZERO", "OL-1", captain_qty=0.0, manager_qty=0.0)]
    _enable_sheet_backend(
        mocker,
        orders=orders,
        lines=lines,
        locations=[_location("WOLA")],
        transport_batches=[header],
    )

    r = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert {o["order_id"] for o in detail["orders"]} == {"ORD-ZERO"}
    assert detail["lines"] == []  # aggregate still zero-drops


# ---------- v2 empty-draft: header-only batches in list + detail ----------

def test_batches_lists_header_only_empty_draft(mocker):
    """An empty draft (header row, zero member orders) must appear in the
    batches list — the marker grouping alone cannot see it."""
    header = TransportBatch(
        transport_id="TRN-20260822-PAGO-eee111",
        supplier_id="SUP_PAGO",
        status="draft",
        created_at=datetime(2026, 8, 22, 8, 0, tzinfo=timezone.utc),
    )
    _enable_sheet_backend(mocker, orders=[], transport_batches=[header])

    r = client.get(
        "/api/manager/transport/batches?supplier_id=SUP_PAGO", headers=MANAGER_AUTH
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert len(payload) == 1
    row = payload[0]
    assert row["transport_id"] == "TRN-20260822-PAGO-eee111"
    assert row["status"] == "draft"
    assert row["order_count"] == 0
    assert row["location_ids"] == []


def test_batch_detail_serves_header_only_empty_draft(mocker):
    """Detail of an empty draft: 200 with orders=[], lines=[], weights zeroed —
    404 is reserved for batches with NEITHER members NOR a header."""
    header = TransportBatch(
        transport_id="TRN-20260822-PAGO-eee222",
        supplier_id="SUP_PAGO",
        status="draft",
        limit_kg=700,
    )
    _enable_sheet_backend(mocker, orders=[], transport_batches=[header])

    r = client.get(
        "/api/manager/transport/batch/TRN-20260822-PAGO-eee222",
        headers=MANAGER_AUTH,
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["status"] == "draft"
    assert payload["orders"] == []
    assert payload["lines"] == []
    assert payload["order_count"] == 0
    assert payload["total_weight_kg"] == 0.0
    assert payload["supplier_id"] == "SUP_PAGO"


# ---------- F1 gate: draft members locked out of ordinary manager routes ----------

def _draft_member_setup(mocker):
    """One manager_claimed order marked into a DRAFT batch, with get_order and
    the write surface mocked so the ordinary manager routes can run."""
    order = _order(
        "ORD-DM",
        status=OrderStatus.MANAGER_CLAIMED,
        supplier_order_reference="TRN-20260822-PAGO-dddddd",
    )
    header = TransportBatch(
        transport_id="TRN-20260822-PAGO-dddddd",
        supplier_id="SUP_PAGO",
        status="draft",
    )
    _enable_sheet_backend(mocker, orders=[order], transport_batches=[header])
    mocker.patch.object(sheets, "invalidate_cache", return_value=None)
    mocker.patch.object(sheets, "get_order", return_value=order)
    update_mock = mocker.patch.object(sheets, "update_order", return_value=None)
    return update_mock


def test_release_locked_for_draft_transport_member(mocker):
    update_mock = _draft_member_setup(mocker)
    r = client.post(
        "/api/manager/release/ORD-DM",
        headers=MANAGER_AUTH,
        json={"reason": "test"},
    )
    assert r.status_code == 409, r.text
    assert "draft transport" in r.json()["detail"]
    update_mock.assert_not_called()


def test_cancel_locked_for_draft_transport_member(mocker):
    update_mock = _draft_member_setup(mocker)
    r = client.post(
        "/api/manager/cancel/ORD-DM",
        headers=MANAGER_AUTH,
        json={"reason": "test"},
    )
    assert r.status_code == 409, r.text
    assert "draft transport" in r.json()["detail"]
    update_mock.assert_not_called()


def test_dispatch_locked_for_draft_transport_member(mocker):
    update_mock = _draft_member_setup(mocker)
    r = client.post(
        "/api/manager/dispatch",
        headers=MANAGER_AUTH,
        json={
            "order_id": "ORD-DM",
            "manager_finals": [
                {"order_line_id": "OL-X", "manager_final_qty_purchase": 1.0}
            ],
        },
    )
    assert r.status_code == 409, r.text
    assert "draft transport" in r.json()["detail"]
    update_mock.assert_not_called()


def test_release_allowed_for_legacy_sent_marker_without_header(mocker):
    """A TRN- marker WITHOUT a draft header (legacy batch) must NOT lock the
    order — the gate only protects live drafts."""
    order = _order(
        "ORD-LG",
        status=OrderStatus.MANAGER_CLAIMED,
        supplier_order_reference="TRN-20260601-PAGO-legacy",
    )
    _enable_sheet_backend(mocker, orders=[order], transport_batches=[])
    mocker.patch.object(sheets, "invalidate_cache", return_value=None)
    mocker.patch.object(sheets, "get_order", return_value=order)
    update_mock = mocker.patch.object(sheets, "update_order", return_value=None)
    r = client.post(
        "/api/manager/release/ORD-LG",
        headers=MANAGER_AUTH,
        json={"reason": "test"},
    )
    assert r.status_code == 200, r.text
    update_mock.assert_called_once()


def test_eligible_excludes_orders_already_in_a_transport(mocker):
    """A draft member (manager_claimed + TRN- marker) must not be offered for
    combining again — a second create would re-stamp its marker."""
    orders = [
        _order("ORD-FREE", status=OrderStatus.MANAGER_CLAIMED),
        _order(
            "ORD-TAKEN",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-20260822-PAGO-aaaaaa",
        ),
    ]
    _enable_sheet_backend(mocker, orders=orders)
    r = client.get(
        "/api/manager/transport/eligible?supplier_id=SUP_PAGO", headers=MANAGER_AUTH
    )
    assert r.status_code == 200, r.text
    assert [o["order_id"] for o in r.json()] == ["ORD-FREE"]


def test_create_skips_order_already_in_another_transport(mocker):
    orders = [
        _order(
            "ORD-TAKEN",
            status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-20260822-PAGO-aaaaaa",
        ),
    ]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)
    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-TAKEN"]},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["combined"] == []
    assert payload["skipped"][0]["reason"] == "already in transport TRN-20260822-PAGO-aaaaaa"
    # No status/marker write happened for the stolen-candidate order.
    patches["update_order"].assert_not_called()


# ============================================================
# v3 ADDENDUM (to-ordering-pago): event history, cancel draft, delivery
# parity, manager-first grid creation with prefill
# ============================================================

def _receipt(
    receipt_id: str,
    order_id: str,
    discrepancy_count: int = 0,
) -> Receipt:
    return Receipt(
        receipt_id=receipt_id,
        order_id=order_id,
        location_id="WOLA",
        supplier_id="SUP_PAGO",
        receipt_date=date(2026, 5, 21),
        discrepancy_count=discrepancy_count,
    )


def _event(
    transport_id: str,
    event_type: str,
    order_id: str | None = None,
    at: datetime | None = None,
    details: str = "",
) -> TransportEvent:
    return TransportEvent(
        event_id=f"TEV-{event_type}-{order_id or 'batch'}",
        transport_id=transport_id,
        order_id=order_id,
        event_type=event_type,
        actor="manager-default",
        at=at or datetime(2026, 5, 21, 10, 0, tzinfo=timezone.utc),
        details=details,
    )


# ---------- Phase 6: event emission — create / add-location / remove-order / finalize / patch ----------

def test_create_emits_order_combined_event_per_combined_order(mocker):
    orders = [_order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED)]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-A"]},
    )
    assert r.status_code == 200, r.text
    transport_id = r.json()["transport_id"]

    # Two events now: one order_combined per combined order + one batch_created
    # for the fresh header (review OBS — history starts at birth).
    events = [c.args[0] for c in patches["append_transport_event"].call_args_list]
    types = [e.event_type for e in events]
    assert types.count("order_combined") == 1
    assert types.count("batch_created") == 1
    combined_event = next(e for e in events if e.event_type == "order_combined")
    assert combined_event.transport_id == transport_id
    assert combined_event.order_id == "ORD-A"


def test_create_skipped_order_emits_no_event(mocker):
    orders: list[Order] = []  # ORD-MISSING doesn't exist -> skipped "not found"
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)
    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-MISSING"]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["skipped"][0]["reason"] == "not found"
    # No order_combined for a skipped order — but the fresh (empty) draft header
    # still logs its batch_created birth event (review OBS).
    events = [c.args[0] for c in patches["append_transport_event"].call_args_list]
    assert [e.event_type for e in events] == ["batch_created"]


def test_create_event_emission_failure_does_not_break_create(mocker):
    """Best-effort: a broken 'transport_events' worksheet must not fail an
    otherwise-successful combine."""
    orders = [_order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED)]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)
    patches["append_transport_event"].side_effect = sheets.WorksheetNotFound("x")

    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": ["ORD-A"]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["combined"] == ["ORD-A"]


def test_add_location_emits_location_added_event(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[header],
        locations=[_location("BRACKA", "Bracka")],
    )
    r = client.post(
        "/api/manager/transport/add-location",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "location_id": "BRACKA"},
    )
    assert r.status_code == 200, r.text
    order_id = r.json()["order_id"]

    patches["append_transport_event"].assert_called_once()
    event = patches["append_transport_event"].call_args.args[0]
    assert event.transport_id == "TRN-X"
    assert event.event_type == "location_added"
    assert event.order_id == order_id
    assert "BRACKA" in event.details
    assert "prefilled" not in event.details


def test_remove_order_emits_order_removed_event_with_action(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order(
            "ORD-A", location_id="WOLA", status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
        )
    ]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=[_line("ORD-A", "OL-1")], transport_batches=[header],
    )
    r = client.post(
        "/api/manager/transport/remove-order",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "order_id": "ORD-A"},
    )
    assert r.status_code == 200, r.text

    patches["append_transport_event"].assert_called_once()
    event = patches["append_transport_event"].call_args.args[0]
    assert event.transport_id == "TRN-X"
    assert event.event_type == "order_removed"
    assert event.order_id == "ORD-A"
    assert event.details == "released"


def test_finalize_emits_order_sent_and_batch_sent_events(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order(
            "ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X",
        ),
        _order(
            "ORD-B", location_id="BRACKA", status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
        ),
    ]
    lines = [
        _line("ORD-A", "OL-A-1", captain_qty=5.0),
        _line("ORD-B", "OL-B-1", captain_qty=3.0),
    ]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=lines, transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 200, r.text
    assert set(r.json()["sent"]) == {"ORD-A", "ORD-B"}

    events = [c.args[0] for c in patches["append_transport_event"].call_args_list]
    order_sent_events = [e for e in events if e.event_type == "order_sent"]
    assert {e.order_id for e in order_sent_events} == {"ORD-A", "ORD-B"}
    batch_sent = [e for e in events if e.event_type == "batch_sent"]
    assert len(batch_sent) == 1
    assert batch_sent[0].order_id is None


def test_finalize_all_skipped_emits_no_batch_sent_event(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [_order("ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED, supplier_order_reference="TRN-X")]
    patches = _enable_sheet_backend_for_write(mocker, orders=orders, transport_batches=[header])

    r = client.post(
        "/api/manager/transport/finalize",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["sent"] == []
    patches["append_transport_event"].assert_not_called()


def test_batch_patch_emits_logistics_changed_with_diff(mocker):
    header = TransportBatch(
        transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft",
        driver="Old Driver", vehicle="Old Van",
    )
    patches = _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[header])

    r = client.patch(
        "/api/manager/transport/batch/TRN-X",
        headers=MANAGER_AUTH,
        json={"driver": "New Driver", "vehicle": "Old Van"},
    )
    assert r.status_code == 200, r.text

    patches["append_transport_event"].assert_called_once()
    event = patches["append_transport_event"].call_args.args[0]
    assert event.transport_id == "TRN-X"
    assert event.event_type == "logistics_changed"
    assert event.order_id is None
    assert "driver: Old Driver → New Driver" in event.details
    assert "vehicle" not in event.details  # unchanged, excluded from the diff


def test_batch_patch_no_actual_change_emits_no_event(mocker):
    header = TransportBatch(
        transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft", driver="Same",
    )
    patches = _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[header])

    r = client.patch(
        "/api/manager/transport/batch/TRN-X",
        headers=MANAGER_AUTH,
        json={"driver": "Same"},
    )
    assert r.status_code == 200, r.text
    patches["append_transport_event"].assert_not_called()


# ---------- Phase 6: batch detail returns events ----------

def test_batch_detail_returns_events_newest_first_capped(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="sent")
    orders = [_order("ORD-A", status=OrderStatus.MANAGER_SENT, supplier_order_reference="TRN-X")]
    events = [
        _event("TRN-X", "order_combined", order_id="ORD-A", at=datetime(2026, 5, 21, 8, tzinfo=timezone.utc)),
        _event("TRN-X", "batch_sent", at=datetime(2026, 5, 21, 9, tzinfo=timezone.utc)),
        # A different batch's event must never leak into this batch's detail.
        _event("TRN-OTHER", "order_combined", order_id="ORD-Z", at=datetime(2026, 5, 21, 12, tzinfo=timezone.utc)),
    ]
    _enable_sheet_backend(
        mocker, orders=orders, lines=[_line("ORD-A", "OL-1")],
        transport_batches=[header], transport_events=events,
    )
    r = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    out_events = r.json()["events"]
    assert [e["event_type"] for e in out_events] == ["batch_sent", "order_combined"]  # newest first


def test_batch_detail_missing_events_worksheet_degrades_to_empty(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [_order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X")]
    _enable_sheet_backend(
        mocker, orders=orders, lines=[_line("ORD-A", "OL-1")], transport_batches=[header],
    )
    mocker.patch.object(
        sheets, "load_transport_events_for", side_effect=sheets.WorksheetNotFound("x")
    )
    r = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["events"] == []


def test_batch_detail_events_backend_error_degrades_to_empty(mocker):
    """F6: on Supabase a missing 'transport_events' table raises something
    other than ``sheets.WorksheetNotFound`` (a SQLAlchemy ``ProgrammingError``
    in practice) — catching only ``WorksheetNotFound`` let that propagate and
    turn the whole batch detail route into a 500. ``_load_transport_events_safe``
    must degrade to [] on ANY failure, mirroring ``_load_inventory_events_safe``.
    A generic exception stands in here for the Supabase-specific one — the
    backend-agnostic route must not care which exception type it was.
    """
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X")
    ]
    _enable_sheet_backend(
        mocker, orders=orders, lines=[_line("ORD-A", "OL-1")], transport_batches=[header],
    )
    mocker.patch.object(
        sheets,
        "load_transport_events_for",
        side_effect=RuntimeError("relation \"transport_events\" does not exist"),
    )
    r = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["events"] == []


# ---------- Phase 7: POST /api/manager/transport/cancel ----------

def test_cancel_seed_mode_503():
    r = client.post(
        "/api/manager/transport/cancel", headers=MANAGER_AUTH, json={"transport_id": "TRN-X"}
    )
    assert r.status_code == 503


def test_cancel_batch_not_found_404(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[])
    r = client.post(
        "/api/manager/transport/cancel", headers=MANAGER_AUTH, json={"transport_id": "TRN-X"}
    )
    assert r.status_code == 404


def test_cancel_batch_not_draft_409(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="sent")
    _enable_sheet_backend_for_write(mocker, orders=[], transport_batches=[header])
    r = client.post(
        "/api/manager/transport/cancel", headers=MANAGER_AUTH, json={"transport_id": "TRN-X"}
    )
    assert r.status_code == 409


def test_cancel_happy_path_released_and_cancelled_split(mocker):
    """A regular (captain-originated) member is released; a manager-created
    empty skeleton is cancelled — mirrors remove-order's per-member split,
    applied to the whole batch."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order(
            "ORD-A", location_id="WOLA", status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X",
        ),
        _order(
            "ORD-M", location_id="BRACKA", status=OrderStatus.MANAGER_CLAIMED,
            supplier_order_reference="TRN-X", captain_user="manager-default",
        ),
    ]
    lines = [_line("ORD-A", "OL-1")]  # ORD-M has no lines -> manager-created-empty
    patches = _enable_sheet_backend_for_write(
        mocker, orders=orders, lines=lines, transport_batches=[header]
    )

    r = client.post(
        "/api/manager/transport/cancel", headers=MANAGER_AUTH, json={"transport_id": "TRN-X"}
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["released"] == ["ORD-A"]
    assert payload["cancelled"] == ["ORD-M"]
    assert payload["skipped"] == []

    calls = {c.args[0]: c.kwargs for c in patches["update_order"].call_args_list}
    assert calls["ORD-A"]["status"] == "captain_submitted"
    assert calls["ORD-A"]["supplier_order_reference"] is None
    assert calls["ORD-M"]["status"] == "cancelled"
    assert calls["ORD-M"]["cancel_reason"] == "transport cancelled"

    patches["update_transport_batch"].assert_called_once_with("TRN-X", status="cancelled")
    patches["append_transport_event"].assert_called_once()
    event = patches["append_transport_event"].call_args.args[0]
    assert event.transport_id == "TRN-X"
    assert event.event_type == "batch_cancelled"


def test_cancel_skips_non_claimed_member(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order(
            "ORD-A", status=OrderStatus.CAPTAIN_SUBMITTED, supplier_order_reference="TRN-X",
        ),
    ]
    patches = _enable_sheet_backend_for_write(mocker, orders=orders, transport_batches=[header])
    r = client.post(
        "/api/manager/transport/cancel", headers=MANAGER_AUTH, json={"transport_id": "TRN-X"}
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["skipped"][0]["order_id"] == "ORD-A"
    assert payload["released"] == []
    assert payload["cancelled"] == []
    patches["update_order"].assert_not_called()


def test_cancel_conflict_skipped(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [
        _order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X"),
    ]
    patches = _enable_sheet_backend_for_write(mocker, orders=orders, transport_batches=[header])
    patches["update_order"].side_effect = errors.OrderStatusConflictError("x")

    r = client.post(
        "/api/manager/transport/cancel", headers=MANAGER_AUTH, json={"transport_id": "TRN-X"}
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["released"] == []
    assert payload["skipped"][0]["order_id"] == "ORD-A"
    assert payload["skipped"][0]["reason"] == "cancel conflict"
    # The header still flips to cancelled even though the member failed.
    patches["update_transport_batch"].assert_called_once_with("TRN-X", status="cancelled")


def test_cancel_rejects_captain_token(mocker):
    _enable_sheet_backend_for_write(mocker, orders=[])
    r = client.post(
        "/api/manager/transport/cancel", headers=CAPTAIN_AUTH, json={"transport_id": "TRN-X"}
    )
    assert r.status_code == 401


def test_batches_list_excludes_cancelled_by_default(mocker):
    headers = [
        TransportBatch(transport_id="TRN-DRAFT", supplier_id="SUP_PAGO", status="draft"),
        TransportBatch(transport_id="TRN-CANCELLED", supplier_id="SUP_PAGO", status="cancelled"),
    ]
    _enable_sheet_backend(mocker, orders=[], transport_batches=headers)
    r = client.get("/api/manager/transport/batches", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    ids = {b["transport_id"] for b in r.json()}
    assert "TRN-DRAFT" in ids
    assert "TRN-CANCELLED" not in ids


def test_batches_list_include_cancelled_true_shows_it(mocker):
    headers = [
        TransportBatch(transport_id="TRN-CANCELLED", supplier_id="SUP_PAGO", status="cancelled"),
    ]
    _enable_sheet_backend(mocker, orders=[], transport_batches=headers)
    r = client.get(
        "/api/manager/transport/batches?include_cancelled=true", headers=MANAGER_AUTH
    )
    assert r.status_code == 200, r.text
    ids = {b["transport_id"] for b in r.json()}
    assert "TRN-CANCELLED" in ids


# ---------- Phase 8: delivery-acceptance parity ----------

def test_batch_detail_received_counts_populated_when_sent(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="sent")
    orders = [
        _order("ORD-A", status=OrderStatus.CLOSED, supplier_order_reference="TRN-X"),
        _order("ORD-B", location_id="BRACKA", status=OrderStatus.MANAGER_SENT, supplier_order_reference="TRN-X"),
    ]
    receipts = [_receipt("RCP-1", "ORD-A", discrepancy_count=2)]
    _enable_sheet_backend(
        mocker, orders=orders, lines=[_line("ORD-A", "OL-1"), _line("ORD-B", "OL-2")],
        transport_batches=[header], receipts=receipts,
    )
    r = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    by_id = {o["order_id"]: o for o in r.json()["orders"]}
    assert by_id["ORD-A"]["received_count"] == 1
    assert by_id["ORD-A"]["received_discrepancy_count"] == 1
    assert by_id["ORD-B"]["received_count"] == 0
    assert by_id["ORD-B"]["received_discrepancy_count"] == 0


def test_batch_detail_received_counts_zero_when_draft(mocker):
    """A draft batch's members are never dispatched yet — the receipt scan is
    skipped entirely (never even calls load_receipts_for_orders)."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    orders = [_order("ORD-A", status=OrderStatus.MANAGER_CLAIMED, supplier_order_reference="TRN-X")]
    _enable_sheet_backend(
        mocker, orders=orders, lines=[_line("ORD-A", "OL-1")], transport_batches=[header],
    )
    receipts_mock = mocker.patch.object(sheets, "load_receipts_for_orders", return_value=[])
    r = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["orders"][0]["received_count"] == 0
    receipts_mock.assert_not_called()


def test_batch_detail_received_counts_degrade_on_missing_worksheet(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="sent")
    orders = [_order("ORD-A", status=OrderStatus.CLOSED, supplier_order_reference="TRN-X")]
    _enable_sheet_backend(
        mocker, orders=orders, lines=[_line("ORD-A", "OL-1")], transport_batches=[header],
    )
    mocker.patch.object(
        sheets, "load_receipts_for_orders", side_effect=sheets.WorksheetNotFound("x")
    )
    r = client.get("/api/manager/transport/batch/TRN-X", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["orders"][0]["received_count"] == 0


def test_receiving_manager_created_skeleton_uses_manager_final_as_ordered(mocker):
    """A manager-created transport skeleton (captain_final=0, manager_final>0)
    must receive against the MANAGER quantity — the same `_effective_ordered_qty`
    rule every other order follows (v3 Phase 8 verification)."""
    from app.main import _effective_ordered_qty

    line = OrderLine(
        order_line_id="OL-1",
        order_id="ORD-M",
        product_id="P027",
        supplier_product_id="SP_PAGO_P027",
        captain_final_qty_purchase=0,
        manager_final_qty_purchase=8,
    )
    assert _effective_ordered_qty(line) == 8


def test_receiving_submit_against_transport_manager_created_order(mocker):
    """Full endpoint check: captain_receipt_submit against a manager_sent
    transport member whose only line is a manager-created skeleton
    (captain_final=0, manager_final=8) receives against 8, and (mirrors
    existing behavior) the first receipt still closes the order."""
    order = Order(
        order_id="ORD-M",
        location_id="WOLA",
        supplier_id="SUP_PAGO",
        order_date=date(2026, 5, 20),
        status=OrderStatus.MANAGER_SENT,
        captain_user="manager-default",
        ordered_by="manager",
        supplier_order_reference="TRN-X",
        lines=[
            OrderLine(
                order_line_id="OL-1",
                order_id="ORD-M",
                product_id="P027",
                supplier_product_id="SP_PAGO_P027",
                captain_final_qty_purchase=0,
                manager_final_qty_purchase=8,
            )
        ],
    )
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "get_order", return_value=order)
    mocker.patch.object(sheets, "append_receipt")
    mocker.patch.object(sheets, "append_receipt_lines")
    status_update = mocker.patch.object(sheets, "update_order")
    mocker.patch.object(sheets, "append_transport_event")

    r = client.post(
        "/api/captain/receipt/submit",
        headers=CAPTAIN_AUTH,
        json={
            "order_id": "ORD-M",
            "received_by": "Ola",
            "lines": [{"order_line_id": "OL-1", "received_qty_purchase": 8}],
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["discrepancy_count"] == 0  # received 8 == ordered (manager_final) 8

    status_update.assert_called_once()
    _, kwargs = status_update.call_args
    assert kwargs.get("status") == OrderStatus.CLOSED.value


# ---------- Phase 9: manager-first grid creation with prefill ----------

def test_add_location_prefill_creates_zero_qty_lines_for_orderable_products(mocker):
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    settings = [
        LocationProductSetting(
            setting_id="S1", location_id="BRACKA", product_id="P027",
            target_stock_qty_base=10, max_stock_qty_base=20,
        )
    ]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[header],
        locations=[_location("BRACKA", "Bracka")],
        location_product_settings=settings,
    )
    r = client.post(
        "/api/manager/transport/add-location",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "location_id": "BRACKA", "prefill_products": True},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["prefilled_count"] == 1

    patches["append_order_lines"].assert_called_once()
    lines_arg = patches["append_order_lines"].call_args.args[0]
    assert len(lines_arg) == 1
    line = lines_arg[0]
    assert line.product_id == "P027"
    assert line.supplier_product_id == "SP_PAGO_P027"
    assert line.captain_final_qty_purchase == 0
    assert line.manager_final_qty_purchase == 0
    assert line.target_stock_qty_base == 10

    event = patches["append_transport_event"].call_args.args[0]
    assert event.event_type == "location_added"
    assert "prefilled 1 products" in event.details


def test_add_location_prefill_false_leaves_no_lines(mocker):
    """Default behavior (prefill_products omitted) is unchanged: no lines,
    plain 'location_added' event."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    settings = [
        LocationProductSetting(
            setting_id="S1", location_id="BRACKA", product_id="P027",
            target_stock_qty_base=10, max_stock_qty_base=20,
        )
    ]
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[header],
        locations=[_location("BRACKA", "Bracka")],
        location_product_settings=settings,
    )
    r = client.post(
        "/api/manager/transport/add-location",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "location_id": "BRACKA"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["prefilled_count"] == 0
    patches["append_order_lines"].assert_not_called()
    event = patches["append_transport_event"].call_args.args[0]
    assert "prefilled" not in event.details


def test_add_location_prefill_no_orderable_products_zero_count(mocker):
    """prefill_products=True with no orderable products at the location is a
    no-op (no append_order_lines call), never an error."""
    header = TransportBatch(transport_id="TRN-X", supplier_id="SUP_PAGO", status="draft")
    patches = _enable_sheet_backend_for_write(
        mocker, orders=[], transport_batches=[header],
        locations=[_location("BRACKA", "Bracka")],
        location_product_settings=[],  # nothing configured for BRACKA
    )
    r = client.post(
        "/api/manager/transport/add-location",
        headers=MANAGER_AUTH,
        json={"transport_id": "TRN-X", "location_id": "BRACKA", "prefill_products": True},
    )
    assert r.status_code == 200, r.text
    assert r.json()["prefilled_count"] == 0
    patches["append_order_lines"].assert_not_called()


# ---------- draft-config (v4, Gmail draft) ----------


def test_draft_config_returns_value_from_backend(mocker):
    """Happy path: load_meta returns the configured driver_recipients string,
    plus the drivers/vehicles dictionaries read in the same call."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(
        sheets,
        "load_meta",
        return_value={
            "transport_driver_recipients": "driver@example.com, biuro@example.com",
            "transport_drivers": "Mateusz Miecznikowski, Grzegorz",
            "transport_vehicles": "Iveco WPR9345K",
        },
    )
    r = client.get("/api/manager/transport/draft-config", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == {
        "driver_recipients": "driver@example.com, biuro@example.com",
        "drivers": "Mateusz Miecznikowski, Grzegorz",
        "vehicles": "Iveco WPR9345K",
    }


def test_draft_config_degrades_to_empty_on_load_meta_error(mocker):
    """A missing '_meta' tab/table (or any other load_meta failure) degrades
    driver_recipients/drivers/vehicles ALL to "" — never a 500."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(
        sheets, "load_meta", side_effect=sheets.WorksheetNotFound("no _meta tab")
    )
    r = client.get("/api/manager/transport/draft-config", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == {"driver_recipients": "", "drivers": "", "vehicles": ""}


def test_draft_config_missing_key_returns_empty(mocker):
    """load_meta succeeds but has none of the three known keys -> all ""."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_meta", return_value={"other_key": "x"})
    r = client.get("/api/manager/transport/draft-config", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == {"driver_recipients": "", "drivers": "", "vehicles": ""}


def test_draft_config_seed_mode_returns_empty(mocker):
    """Seed backend has no load_meta at all -> AttributeError -> all "" (never 500)."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SEED)
    r = client.get("/api/manager/transport/draft-config", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == {"driver_recipients": "", "drivers": "", "vehicles": ""}


def test_draft_config_partial_keys_default_missing_ones_to_empty(mocker):
    """load_meta has only 'transport_drivers' set — driver_recipients and
    vehicles independently degrade to "" (not all-or-nothing)."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(
        sheets, "load_meta", return_value={"transport_drivers": "Grzegorz"}
    )
    r = client.get("/api/manager/transport/draft-config", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == {"driver_recipients": "", "drivers": "Grzegorz", "vehicles": ""}


def test_draft_config_requires_manager_auth(mocker):
    r = client.get("/api/manager/transport/draft-config")
    assert r.status_code == 401
