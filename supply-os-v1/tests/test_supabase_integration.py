"""Integration tests for the Supabase Postgres backend against a REAL Postgres
(S-10, Phase 4) — proving what mocks can't: the 5 status-transition 409 contracts
as genuine row-level guards, incl. a concurrent double-claim that yields exactly
one winner + one conflict.

Opt-in: marked ``integration`` and excluded from the default run (see
pyproject ``addopts``). They require ``SUPPLY_OS_DATA_BACKEND=supabase`` +
``SUPPLY_OS_DATABASE_URL``; without them every test SKIPS (never fails), so the
default seed suite is unaffected. CI runs them against an ephemeral
``postgres:16`` service (``.github/workflows/ci.yml`` job ``backend-integration``).

Schema: the session fixture applies migrations 0001 + 0002 itself (drop +
recreate the 12 tables), so a run is self-contained and re-runnable. DESTRUCTIVE
to the 12 product tables — point ``SUPPLY_OS_DATABASE_URL`` at a throwaway DB only.
"""
from __future__ import annotations

import os
import threading
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from app import errors, supabase_backend
from app.config import DataBackend, settings
from app.models import (
    InventoryCount,
    InventoryCountLine,
    Location,
    LocationProductSetting,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    ReasonCode,
    Receipt,
    ReceiptLine,
    Supplier,
    SupplierProduct,
)

pytestmark = pytest.mark.integration

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

# FK-safe drop/truncate order (children before parents).
_ALL_TABLES = [
    "receipt_lines", "receipts", "inventory_count_lines", "inventory_counts",
    "order_lines", "orders", "location_product_settings", "supplier_products",
    "locations", "suppliers", "products", "_meta",
]
_TXN_TABLES = [
    "receipt_lines", "receipts", "inventory_count_lines", "inventory_counts",
    "order_lines", "orders",
]


@pytest.fixture(scope="session", autouse=True)
def _schema():
    """Apply migrations + seed minimal master data once per session, or skip the
    whole suite when no live DB is configured."""
    if settings.data_backend != DataBackend.SUPABASE or not supabase_backend.is_configured():
        pytest.skip(
            "integration tests need SUPPLY_OS_DATA_BACKEND=supabase + SUPPLY_OS_DATABASE_URL"
        )
    # DATA-SAFETY GUARD (impl-review F3): this fixture DROPs + recreates the 12
    # tables. Refuse unless the DSN clearly points at a local/throwaway DB OR the
    # operator has explicitly opted in — so a stray PROD DSN in
    # SUPPLY_OS_DATABASE_URL can never silently drop production tables.
    dsn = settings.database_url.get_secret_value()
    is_local = "@localhost" in dsn or "@127.0.0.1" in dsn
    confirmed = os.environ.get("SUPPLY_OS_INTEGRATION_DB_CONFIRMED") == "1"
    if not (is_local or confirmed):
        pytest.skip(
            "refusing to DROP/recreate tables on a non-local DB — point "
            "SUPPLY_OS_DATABASE_URL at localhost/127.0.0.1, or set "
            "SUPPLY_OS_INTEGRATION_DB_CONFIRMED=1 to confirm a throwaway DB"
        )
    eng = supabase_backend._get_engine()
    ddl = (MIGRATIONS_DIR / "0001_initial_schema.sql").read_text()
    rls = (MIGRATIONS_DIR / "0002_rls_deny_all.sql").read_text()
    widen = (MIGRATIONS_DIR / "0003_widen_delta_vs_suggestion_pct.sql").read_text()
    drop = "DROP TABLE IF EXISTS " + ", ".join(_ALL_TABLES) + " CASCADE;"
    with eng.begin() as conn:
        conn.exec_driver_sql(drop)
        conn.exec_driver_sql(ddl)
        conn.exec_driver_sql(rls)
        conn.exec_driver_sql(widen)

    # Minimal master data so orders/lines/receipts satisfy their FKs.
    supabase_backend._insert(
        "locations", supabase_backend._LOCATION_COLUMNS,
        Location(location_id="WOLA", location_name="Wola"),
    )
    supabase_backend._insert(
        "suppliers", supabase_backend._SUPPLIER_COLUMNS,
        Supplier(supplier_id="SUP_X", supplier_name="X", email="x@example.com"),
    )
    supabase_backend._insert(
        "products", supabase_backend._PRODUCT_COLUMNS,
        Product(product_id="P1", product_name_pl="Pita", product_category="B", inventory_unit="szt"),
    )
    supabase_backend._insert(
        "supplier_products", supabase_backend._SUPPLIER_PRODUCT_COLUMNS,
        SupplierProduct(
            supplier_product_id="SP1", supplier_id="SUP_X", product_id="P1",
            supplier_product_name="Pita", purchase_unit="szt", units_per_purchase_unit=1.0,
        ),
    )
    supabase_backend._insert(
        "location_product_settings", supabase_backend._LOCATION_PRODUCT_SETTING_COLUMNS,
        LocationProductSetting(
            setting_id="S1", location_id="WOLA", product_id="P1",
            target_stock_qty_base=10, max_stock_qty_base=20,
        ),
    )
    yield
    supabase_backend.reset_engine()


@pytest.fixture(autouse=True)
def _clean_txn(_schema):
    """Truncate the transactional tables before each test; master data persists."""
    with supabase_backend._get_engine().begin() as conn:
        conn.exec_driver_sql("TRUNCATE " + ", ".join(_TXN_TABLES) + " CASCADE")
    yield


def _make_order(status: OrderStatus = OrderStatus.CAPTAIN_SUBMITTED, order_id: str = "ORD-IT-1") -> str:
    """Create one order + one line in ``status`` and return its id."""
    supabase_backend.append_order(
        Order(
            order_id=order_id, location_id="WOLA", supplier_id="SUP_X",
            order_date=date(2026, 6, 16), status=status, captain_user="WOLA",
            captain_submitted_at=datetime(2026, 6, 16, 12, 0, tzinfo=timezone.utc),
        )
    )
    supabase_backend.append_order_lines(
        [
            OrderLine(
                order_line_id=f"{order_id}-OL-1", order_id=order_id, product_id="P1",
                supplier_product_id="SP1", current_stock_qty_base=2,
                suggested_qty_purchase=8, captain_final_qty_purchase=8,
                captain_final_qty_base=8, delta_vs_suggestion_pct=0.0,
                reason_code=ReasonCode.LOW_STORAGE,
            )
        ]
    )
    return order_id


# ---------- round-trips ----------

def test_master_data_roundtrip():
    products = supabase_backend.load_products()
    assert any(p.product_id == "P1" for p in products)
    sps = supabase_backend.load_supplier_products()
    assert sps[0].units_per_purchase_unit == 1.0
    # RLS deny-all is enabled on every table (migration 0002); a successful read
    # here proves the connection role (postgres) BYPASSES RLS.
    assert supabase_backend.load_locations()


def test_order_append_get_roundtrip():
    oid = _make_order()
    got = supabase_backend.get_order(oid)
    assert got is not None
    assert got.status is OrderStatus.CAPTAIN_SUBMITTED
    assert len(got.lines) == 1
    line = got.lines[0]
    assert line.captain_final_qty_purchase == 8           # numeric round-trip
    assert line.reason_code is ReasonCode.LOW_STORAGE      # enum round-trip
    assert line.delta_vs_suggestion_pct == 0.0             # numeric(12,6) round-trip


def test_update_order_lines_and_delete():
    oid = _make_order()
    supabase_backend.update_order_lines(
        oid,
        {f"{oid}-OL-1": {
            "manager_final_qty_purchase": 6,
            "manager_final_qty_base": 6,
            "manager_comment": "cut",
        }},
    )
    got = supabase_backend.get_order(oid)
    assert got.lines[0].manager_final_qty_purchase == 6
    assert got.lines[0].manager_comment == "cut"
    assert supabase_backend.delete_order_lines(oid) == 1
    assert supabase_backend.get_order(oid).lines == []


def test_inventory_count_roundtrip():
    cid = "INV-IT-1"
    supabase_backend.append_inventory_count(
        InventoryCount(
            count_id=cid, location_id="WOLA", count_date=date(2026, 6, 16),
            count_user="WOLA", line_count=1,
        )
    )
    supabase_backend.append_inventory_count_lines(
        [InventoryCountLine(count_line_id=f"{cid}-L1", count_id=cid, product_id="P1", current_stock_qty_base=5)]
    )
    got = supabase_backend.get_inventory_count(cid)
    assert got is not None and len(got.lines) == 1
    assert got.lines[0].current_stock_qty_base == 5


def test_receipt_roundtrip_and_update():
    oid = _make_order(OrderStatus.MANAGER_SENT)
    rid = "RCP-IT-1"
    supabase_backend.append_receipt(
        Receipt(
            receipt_id=rid, order_id=oid, location_id="WOLA", supplier_id="SUP_X",
            receipt_date=date(2026, 6, 16), received_by="WOLA", line_count=1,
        )
    )
    supabase_backend.append_receipt_lines(
        [
            ReceiptLine(
                receipt_line_id=f"{rid}-L1", receipt_id=rid, order_id=oid,
                order_line_id=f"{oid}-OL-1", product_id="P1", supplier_product_id="SP1",
                ordered_qty_purchase=8, received_qty_purchase=7, variance_qty_purchase=-1,
            )
        ]
    )
    got = supabase_backend.get_receipt(rid)
    assert got is not None and len(got.lines) == 1
    assert got.lines[0].variance_qty_purchase == -1
    supabase_backend.update_receipt(rid, wz_photo_count=2, received_with_missing_wz=False)
    assert supabase_backend.get_receipt(rid).wz_photo_count == 2


# ---------- the 5 status-transition 409 contracts (conditional UPDATE) ----------

def test_claim_contract_conditional():
    oid = _make_order(OrderStatus.CAPTAIN_SUBMITTED)
    supabase_backend.update_order(oid, status="manager_claimed", expected_status="captain_submitted")
    assert supabase_backend.get_order(oid).status is OrderStatus.MANAGER_CLAIMED
    # Second claim: row is no longer captain_submitted → conditional matches 0 rows.
    with pytest.raises(errors.OrderStatusConflictError):
        supabase_backend.update_order(oid, status="manager_claimed", expected_status="captain_submitted")


def test_dispatch_contract_conditional():
    oid = _make_order(OrderStatus.MANAGER_CLAIMED)
    supabase_backend.update_order(
        oid, status="manager_sent",
        manager_sent_at=datetime.now(timezone.utc).isoformat(),  # ISO str → cast
        expected_status="manager_claimed",
    )
    assert supabase_backend.get_order(oid).status is OrderStatus.MANAGER_SENT
    with pytest.raises(errors.OrderStatusConflictError):
        supabase_backend.update_order(oid, status="manager_sent", expected_status="manager_claimed")


def test_release_wrong_state_conflict():
    oid = _make_order(OrderStatus.CAPTAIN_SUBMITTED)  # not manager_claimed
    with pytest.raises(errors.OrderStatusConflictError):
        supabase_backend.update_order(
            oid, status="captain_submitted", notes="x", expected_status="manager_claimed"
        )


def test_save_wrong_state_conflict():
    oid = _make_order(OrderStatus.MANAGER_SENT)  # not manager_claimed
    with pytest.raises(errors.OrderStatusConflictError):
        supabase_backend.update_order(oid, total_value_estimate_pln=99.0, expected_status="manager_claimed")


def test_edit_wrong_state_conflict():
    oid = _make_order(OrderStatus.MANAGER_CLAIMED)  # not captain_submitted
    with pytest.raises(errors.OrderStatusConflictError):
        supabase_backend.update_order(
            oid, notes="x", last_edited_at=datetime.now(timezone.utc),
            expected_status="captain_submitted",
        )


def test_unconditional_update_missing_order_raises_not_found():
    with pytest.raises(errors.OrderNotFoundError):
        supabase_backend.update_order("ORD-DOES-NOT-EXIST", notes="x")


# ---------- the marquee proof: concurrent double-claim, exactly one 409 ----------

def test_concurrent_double_claim_exactly_one_409():
    """Two threads claim the same captain_submitted order at once. The conditional
    UPDATE + Postgres row lock guarantee exactly one winner and one 409 — the
    row-level proof a mock cannot give (Phase 4 success criterion 4.4)."""
    oid = _make_order(OrderStatus.CAPTAIN_SUBMITTED)
    results: list[str] = []
    lock = threading.Lock()
    barrier = threading.Barrier(2)

    def claim():
        barrier.wait()  # maximize the overlap
        try:
            supabase_backend.update_order(
                oid, status="manager_claimed", expected_status="captain_submitted"
            )
            outcome = "ok"
        except errors.OrderStatusConflictError:
            outcome = "conflict"
        with lock:
            results.append(outcome)

    threads = [threading.Thread(target=claim) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(results) == ["conflict", "ok"], results
    assert supabase_backend.get_order(oid).status is OrderStatus.MANAGER_CLAIMED
