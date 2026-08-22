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
    Order,
    OrderLine,
    OrderStatus,
    Product,
    Supplier,
    SupplierProduct,
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
) -> Order:
    return Order(
        order_id=order_id,
        location_id=location_id,
        supplier_id=supplier_id,
        order_date=date(2026, 5, 20),
        status=status,
        captain_user=location_id,
        captain_submitted_at=captain_submitted_at
        or datetime(2026, 5, 20, 8, 30, tzinfo=timezone.utc),
        manager_sent_at=manager_sent_at,
        ordered_by=ordered_by,
        total_value_estimate_pln=total,
        supplier_order_reference=supplier_order_reference,
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
) -> None:
    """Switch backend selector to sheets and patch the load_* surface (mirrors
    `test_manager_queue.py::_enable_sheet_backend`)."""
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


def _enable_sheet_backend_for_create(
    mocker,
    orders: list[Order],
    suppliers: list[Supplier] | None = None,
) -> dict:
    """`_enable_sheet_backend` plus the write-side mocks the create endpoint
    needs (`invalidate_cache` + `update_order`). `update_order` defaults to a
    silent success; tests override `.side_effect` to simulate a guard
    conflict on a specific call."""
    _enable_sheet_backend(mocker, orders=orders, suppliers=suppliers)
    mocker.patch.object(sheets, "invalidate_cache", return_value=None)
    update_mock = mocker.patch.object(sheets, "update_order", return_value=None)
    return {"update_order": update_mock}


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


def test_create_empty_order_ids_422(mocker):
    _enable_sheet_backend_for_create(mocker, orders=[])
    r = client.post(
        "/api/manager/transport/create",
        headers=MANAGER_AUTH,
        json={"supplier_id": "SUP_PAGO", "order_ids": []},
    )
    assert r.status_code == 422


def test_create_happy_path_from_captain_submitted(mocker):
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

    send_args, send_kwargs = update_mock.call_args_list[1]
    assert send_args[0] == "ORD-A"
    assert send_kwargs["status"] == "manager_sent"
    assert send_kwargs["sent_method"] == "transport"
    assert send_kwargs["supplier_order_reference"] == payload["transport_id"]
    assert send_kwargs["manager_user"] == "manager-default"
    assert send_kwargs["manager_sent_at"] is not None
    assert send_kwargs["expected_status"] == "manager_claimed"


def test_create_happy_path_from_manager_claimed(mocker):
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
    assert kwargs["status"] == "manager_sent"
    assert kwargs["sent_method"] == "transport"
    assert kwargs["expected_status"] == "manager_claimed"


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


def test_create_claim_succeeds_send_fails_releases_and_skips(mocker):
    orders = [_order("ORD-C", status=OrderStatus.CAPTAIN_SUBMITTED)]
    patches = _enable_sheet_backend_for_create(mocker, orders=orders)

    calls: list[tuple[str, str | None]] = []

    def _side_effect(order_id, **kwargs):
        calls.append((order_id, kwargs.get("status")))
        if kwargs.get("status") == "manager_sent":
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

    # claim -> send (fails) -> best-effort release back to captain_submitted.
    assert calls == [
        ("ORD-C", "manager_claimed"),
        ("ORD-C", "manager_sent"),
        ("ORD-C", "captain_submitted"),
    ]
    release_args, release_kwargs = patches["update_order"].call_args_list[2]
    assert release_kwargs["expected_status"] == "manager_claimed"


def test_create_append_to_happy_path(mocker):
    existing = _order(
        "ORD-OLD",
        status=OrderStatus.MANAGER_SENT,
        supplier_order_reference="TRN-20260520-PAGO-abc123",
    )
    new_order = _order("ORD-NEW", status=OrderStatus.CAPTAIN_SUBMITTED)
    patches = _enable_sheet_backend_for_create(mocker, orders=[existing, new_order])

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

    send_kwargs = patches["update_order"].call_args_list[1].kwargs
    assert send_kwargs["supplier_order_reference"] == "TRN-20260520-PAGO-abc123"


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
    existing = _order(
        "ORD-OLD",
        supplier_id="SUP_BUKAT",
        status=OrderStatus.MANAGER_SENT,
        supplier_order_reference="TRN-20260520-BUKA-abc123",
    )
    new_order = _order("ORD-NEW", supplier_id="SUP_PAGO", status=OrderStatus.CAPTAIN_SUBMITTED)
    _enable_sheet_backend_for_create(mocker, orders=[existing, new_order])

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
        if order_id == "ORD-BOOM" and kwargs.get("status") == "manager_sent":
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
    # ORD-OK sent; ORD-BOOM claim -> send (raises) -> best-effort release.
    assert calls == [
        ("ORD-OK", "manager_sent"),
        ("ORD-BOOM", "manager_claimed"),
        ("ORD-BOOM", "manager_sent"),
        ("ORD-BOOM", "captain_submitted"),
    ]
