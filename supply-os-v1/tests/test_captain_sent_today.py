"""Captain tab state from the database (captain-sent-today, WP6 + D10 A).

``GET /api/captain/suppliers`` rows carry the Captain location's own orders
with each supplier: ``sent_today`` (newest non-cancelled order submitted today,
Europe/Warsaw) and ``open_order`` (newest open order from the 7 days before
today). Information only — never raising, empty on the seed backend.

The pure ``_captain_supplier_orders`` is tested with a fixed ``today`` (the
Warsaw-midnight boundary); the endpoint over a mocked sheet backend with dates
relative to the real Warsaw today.
"""
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import app.main as main_mod
from app import sheets
from app.config import DataBackend
from app.main import app
from app.models import (
    Location,
    LocationProductSetting,
    Order,
    OrderStatus,
    Product,
    Supplier,
    SupplierProduct,
)

client = TestClient(app)

WOLA_AUTH = {"Authorization": "Bearer test_wola_token"}
KEN_AUTH = {"Authorization": "Bearer test_ken_token"}

# Saturday 17.10.2026 — CEST (UTC+2) until 25.10.
TODAY = date(2026, 10, 17)


def _order(
    order_id: str,
    supplier_id: str,
    status: OrderStatus,
    *,
    submitted_at: datetime | None,
    order_date: date | None = None,
    location_id: str = "WOLA",
) -> Order:
    return Order(
        order_id=order_id,
        location_id=location_id,
        supplier_id=supplier_id,
        order_date=order_date or (submitted_at.date() if submitted_at else TODAY),
        requested_delivery_date=(order_date or TODAY) + timedelta(days=2),
        status=status,
        captain_submitted_at=submitted_at,
    )


def _utc(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=timezone.utc)


# ---------- pure helper ----------


def test_warsaw_midnight_boundary_decides_today():
    yesterday = TODAY - timedelta(days=1)
    orders = [
        # 22:30 UTC on 16.10 = 00:30 Warsaw on 17.10 → today, although the
        # stored order_date (UTC) still says 16.10.
        _order("O_AFTER_MIDNIGHT", "SUP_A", OrderStatus.CAPTAIN_SUBMITTED,
               submitted_at=_utc(yesterday, 22, 30)),
        # 21:30 UTC on 16.10 = 23:30 Warsaw on 16.10 → yesterday.
        _order("O_BEFORE_MIDNIGHT", "SUP_B", OrderStatus.CAPTAIN_SUBMITTED,
               submitted_at=_utc(yesterday, 21, 30)),
    ]
    sent, open_ = main_mod._captain_supplier_orders(orders, "WOLA", TODAY)
    assert sent["SUP_A"].order_id == "O_AFTER_MIDNIGHT"
    assert sent["SUP_A"].submitted_on == TODAY
    assert sent["SUP_A"].order_date == yesterday
    assert "SUP_B" not in sent
    # Yesterday's still-open order is the open-order hint instead.
    assert open_["SUP_B"].order_id == "O_BEFORE_MIDNIGHT"
    assert open_["SUP_B"].submitted_on == yesterday
    assert "SUP_A" not in open_


def test_order_date_is_the_fallback_without_a_timestamp():
    orders = [
        _order("O_LEGACY_TODAY", "SUP_A", OrderStatus.MANAGER_SENT,
               submitted_at=None, order_date=TODAY),
        _order("O_LEGACY_OLD", "SUP_B", OrderStatus.MANAGER_SENT,
               submitted_at=None, order_date=TODAY - timedelta(days=2)),
    ]
    sent, open_ = main_mod._captain_supplier_orders(orders, "WOLA", TODAY)
    assert sent["SUP_A"].order_id == "O_LEGACY_TODAY"
    assert sent["SUP_A"].captain_submitted_at is None
    assert open_["SUP_B"].order_id == "O_LEGACY_OLD"


def test_cancelled_and_draft_never_count_as_sent_today():
    orders = [
        _order("O_CANCELLED", "SUP_A", OrderStatus.CANCELLED, submitted_at=_utc(TODAY, 8)),
        _order("O_DRAFT", "SUP_B", OrderStatus.DRAFT, submitted_at=_utc(TODAY, 8)),
    ]
    sent, open_ = main_mod._captain_supplier_orders(orders, "WOLA", TODAY)
    assert sent == {}
    assert open_ == {}


@pytest.mark.parametrize(
    "status", [OrderStatus.CAPTAIN_SUBMITTED, OrderStatus.MANAGER_CLAIMED,
               OrderStatus.MANAGER_SENT, OrderStatus.CLOSED],
)
def test_every_non_cancelled_status_counts_as_sent_today(status):
    orders = [_order("O1", "SUP_A", status, submitted_at=_utc(TODAY, 8))]
    sent, _ = main_mod._captain_supplier_orders(orders, "WOLA", TODAY)
    assert sent["SUP_A"].status == status


def test_newest_order_today_wins():
    orders = [
        _order("O_LATE", "SUP_A", OrderStatus.MANAGER_SENT, submitted_at=_utc(TODAY, 12, 5)),
        _order("O_EARLY", "SUP_A", OrderStatus.CAPTAIN_SUBMITTED, submitted_at=_utc(TODAY, 7)),
    ]
    sent, _ = main_mod._captain_supplier_orders(orders, "WOLA", TODAY)
    assert sent["SUP_A"].order_id == "O_LATE"
    assert sent["SUP_A"].captain_submitted_at == _utc(TODAY, 12, 5)


def test_transport_add_location_order_is_never_sent_today():
    # Manager "add location" in Transport: manager_claimed, captain_user
    # "manager-default", captain_submitted_at = the Manager's click — possibly
    # still empty. It must not tell the Captain "already sent today".
    manager_added = _order(
        "O_TRANSPORT", "SUP_A", OrderStatus.MANAGER_CLAIMED, submitted_at=_utc(TODAY, 9)
    )
    manager_added.captain_user = "manager-default"
    captain_own = _order(
        "O_CAPTAIN", "SUP_A", OrderStatus.CAPTAIN_SUBMITTED, submitted_at=_utc(TODAY, 7)
    )
    captain_own.captain_user = "WOLA"
    assert main_mod._captain_supplier_orders([manager_added], "WOLA", TODAY) == ({}, {})
    # The Captain's own earlier order still counts, the newer Transport one does not.
    sent, _ = main_mod._captain_supplier_orders([manager_added, captain_own], "WOLA", TODAY)
    assert sent["SUP_A"].order_id == "O_CAPTAIN"
    # On a later day it is an ordinary open order (information only).
    _, open_ = main_mod._captain_supplier_orders(
        [manager_added], "WOLA", TODAY + timedelta(days=1)
    )
    assert open_["SUP_A"].order_id == "O_TRANSPORT"


def test_other_location_is_ignored():
    orders = [
        _order("O_KEN", "SUP_A", OrderStatus.CAPTAIN_SUBMITTED,
               submitted_at=_utc(TODAY, 8), location_id="KEN"),
        _order("O_KEN_OPEN", "SUP_B", OrderStatus.MANAGER_SENT,
               submitted_at=_utc(TODAY - timedelta(days=1), 8), location_id="KEN"),
    ]
    assert main_mod._captain_supplier_orders(orders, "WOLA", TODAY) == ({}, {})
    sent, open_ = main_mod._captain_supplier_orders(orders, "KEN", TODAY)
    assert sent["SUP_A"].order_id == "O_KEN"
    assert open_["SUP_B"].order_id == "O_KEN_OPEN"


def test_open_order_statuses_and_window():
    d = lambda n: _utc(TODAY - timedelta(days=n), 9)  # noqa: E731
    orders = [
        _order("O_SUBMITTED", "SUP_A", OrderStatus.CAPTAIN_SUBMITTED, submitted_at=d(1)),
        _order("O_CLAIMED", "SUP_B", OrderStatus.MANAGER_CLAIMED, submitted_at=d(3)),
        _order("O_SENT_7", "SUP_C", OrderStatus.MANAGER_SENT, submitted_at=d(7)),
        _order("O_SENT_8", "SUP_D", OrderStatus.MANAGER_SENT, submitted_at=d(8)),
        _order("O_CLOSED", "SUP_E", OrderStatus.CLOSED, submitted_at=d(1)),
        _order("O_CANCELLED", "SUP_F", OrderStatus.CANCELLED, submitted_at=d(1)),
        _order("O_DRAFT", "SUP_G", OrderStatus.DRAFT, submitted_at=d(1)),
    ]
    _, open_ = main_mod._captain_supplier_orders(orders, "WOLA", TODAY)
    assert {sid: ref.order_id for sid, ref in open_.items()} == {
        "SUP_A": "O_SUBMITTED",
        "SUP_B": "O_CLAIMED",
        "SUP_C": "O_SENT_7",  # today − 7 is inside the window, like the product hint
    }


def test_newest_open_order_wins_and_today_is_not_repeated():
    orders = [
        _order("O_OLDER", "SUP_A", OrderStatus.MANAGER_SENT,
               submitted_at=_utc(TODAY - timedelta(days=4), 9)),
        _order("O_NEWER", "SUP_A", OrderStatus.CAPTAIN_SUBMITTED,
               submitted_at=_utc(TODAY - timedelta(days=1), 9)),
        _order("O_TODAY", "SUP_A", OrderStatus.CAPTAIN_SUBMITTED, submitted_at=_utc(TODAY, 9)),
    ]
    sent, open_ = main_mod._captain_supplier_orders(orders, "WOLA", TODAY)
    assert sent["SUP_A"].order_id == "O_TODAY"
    assert open_["SUP_A"].order_id == "O_NEWER"


def test_non_persistent_backend_returns_nothing(mocker):
    loader = mocker.patch.object(main_mod.seed_loader, "load_orders", create=True)
    assert main_mod._captain_supplier_orders_safe(main_mod.seed_loader, "WOLA") == ({}, {})
    loader.assert_not_called()


def test_read_error_never_raises(mocker):
    backend = mocker.Mock()
    backend.SUPPORTS_PERSISTENCE = True
    backend.load_orders.side_effect = RuntimeError("db down")
    assert main_mod._captain_supplier_orders_safe(backend, "WOLA") == ({}, {})


# ---------- endpoint ----------


def _warsaw_today() -> date:
    return datetime.now(main_mod._WARSAW_TZ).date()


def _locations() -> list[Location]:
    return [
        Location(location_id="WOLA", location_name="Wola"),
        Location(location_id="KEN", location_name="Ken"),
    ]


def _products() -> list[Product]:
    return [
        Product(product_id="P1", product_name_pl="Frytki", product_category="Mrożone",
                inventory_unit="szt"),
        Product(product_id="P2", product_name_pl="Sól", product_category="Suche",
                inventory_unit="kg"),
    ]


def _suppliers() -> list[Supplier]:
    return [
        Supplier(supplier_id="SUP_A", supplier_name="Bukat"),
        Supplier(supplier_id="SUP_B", supplier_name="Intermlecz"),
        Supplier(supplier_id="SUP_C", supplier_name="Coca-Cola"),
    ]


def _sp(sp_id: str, supplier_id: str, product_id: str) -> SupplierProduct:
    return SupplierProduct(
        supplier_product_id=sp_id, supplier_id=supplier_id, product_id=product_id,
        supplier_product_name=f"{product_id} @ {supplier_id}", purchase_unit="szt",
        units_per_purchase_unit=1.0,
    )


def _settings() -> list[LocationProductSetting]:
    return [
        LocationProductSetting(
            setting_id=f"LPS-{loc}-{pid}", location_id=loc, product_id=pid,
            min_stock_qty_base=1, target_stock_qty_base=5, max_stock_qty_base=10,
        )
        for loc in ("WOLA", "KEN")
        for pid in ("P1", "P2")
    ]


def _endpoint_orders() -> list[Order]:
    today = _warsaw_today()

    def at(days_ago: int, hour: int, minute: int = 0) -> datetime:
        return _utc(today - timedelta(days=days_ago), hour, minute)

    def order(order_id, supplier_id, status, submitted_at, location_id="WOLA"):
        return Order(
            order_id=order_id, location_id=location_id, supplier_id=supplier_id,
            order_date=submitted_at.date(), status=status,
            captain_submitted_at=submitted_at,
        )

    return [
        order("O_A_EARLY", "SUP_A", OrderStatus.CAPTAIN_SUBMITTED, at(0, 6)),
        order("O_A_LATE", "SUP_A", OrderStatus.MANAGER_SENT, at(0, 9, 15)),
        order("O_B_CANCELLED", "SUP_B", OrderStatus.CANCELLED, at(0, 8)),
        order("O_B_OPEN", "SUP_B", OrderStatus.MANAGER_CLAIMED, at(3, 9)),
        order("O_B_CLOSED", "SUP_B", OrderStatus.CLOSED, at(1, 9)),
        order("O_C_KEN", "SUP_C", OrderStatus.CAPTAIN_SUBMITTED, at(0, 8), "KEN"),
        order("O_C_OLD", "SUP_C", OrderStatus.MANAGER_SENT, at(8, 9)),
    ]


@pytest.fixture
def sheet_backend(mocker):
    """Sheet mode over a small synthetic catalog where every supplier has goods
    at WOLA and KEN. Returns the ``load_orders`` mock."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_products", return_value=_products())
    mocker.patch.object(sheets, "load_locations", return_value=_locations())
    mocker.patch.object(sheets, "load_suppliers", return_value=_suppliers())
    mocker.patch.object(
        sheets, "load_supplier_products",
        return_value=[
            _sp("SP_A_P1", "SUP_A", "P1"),
            _sp("SP_B_P2", "SUP_B", "P2"),
            _sp("SP_C_P1", "SUP_C", "P1"),
        ],
    )
    mocker.patch.object(sheets, "load_location_product_settings", return_value=_settings())
    return mocker.patch.object(sheets, "load_orders", return_value=_endpoint_orders())


def _rows(auth: dict[str, str]) -> dict[str, dict]:
    r = client.get("/api/captain/suppliers", headers=auth)
    assert r.status_code == 200, r.text
    return {row["supplier_id"]: row for row in r.json()}


def test_endpoint_reports_sent_today_and_open_order(sheet_backend):
    rows = _rows(WOLA_AUTH)
    assert list(rows) == ["SUP_A", "SUP_B", "SUP_C"]  # tab list unchanged

    a = rows["SUP_A"]
    assert a["supplier_name"] == "Bukat"
    assert a["sent_today"]["order_id"] == "O_A_LATE"
    assert a["sent_today"]["status"] == "manager_sent"
    assert a["sent_today"]["submitted_on"] == _warsaw_today().isoformat()
    assert a["sent_today"]["captain_submitted_at"].startswith(
        (_warsaw_today()).isoformat() + "T09:15"
    )
    assert a["open_order"] is None  # today's orders are not repeated

    b = rows["SUP_B"]
    assert b["sent_today"] is None  # cancelled today
    assert b["open_order"]["order_id"] == "O_B_OPEN"  # closed one is not open
    assert b["open_order"]["status"] == "manager_claimed"

    c = rows["SUP_C"]
    assert c["sent_today"] is None  # KEN's order is not WOLA's
    assert c["open_order"] is None  # 8 days ago: outside the window


def test_endpoint_is_scoped_to_the_token_location(sheet_backend):
    rows = _rows(KEN_AUTH)
    assert rows["SUP_C"]["sent_today"]["order_id"] == "O_C_KEN"
    assert rows["SUP_A"]["sent_today"] is None
    assert rows["SUP_B"]["open_order"] is None


def test_endpoint_survives_an_order_read_error(sheet_backend):
    sheet_backend.side_effect = RuntimeError("sheet quota")
    rows = _rows(WOLA_AUTH)
    assert list(rows) == ["SUP_A", "SUP_B", "SUP_C"]
    assert all(row["sent_today"] is None and row["open_order"] is None for row in rows.values())


def test_endpoint_on_the_seed_backend_reports_nothing():
    """Default test backend = seed: orders are not stored, so no row carries
    order state (and nothing is read)."""
    r = client.get("/api/captain/suppliers", headers=WOLA_AUTH)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert rows  # the seed catalog has tabs for WOLA
    assert all(row["sent_today"] is None and row["open_order"] is None for row in rows)


def test_endpoint_still_needs_a_captain_token(sheet_backend):
    assert client.get("/api/captain/suppliers").status_code == 401
