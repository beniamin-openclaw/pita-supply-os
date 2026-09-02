"""Supabase Postgres data backend (S-10) — SQLAlchemy Core over psycopg2.

Selected by ``SUPPLY_OS_DATA_BACKEND=supabase`` via ``main._choose_backend()``;
implements the SAME function set as ``app.sheets`` so routes keep going through
the seam unchanged (never import this module from a route — L2). Connects over
the Supavisor **Session Pooler (port 5432, IPv4)** with a long-lived
``QueuePool``; psycopg2 uses the simple query protocol, so the transaction-pooler
prepared-statement footgun doesn't apply.

Two correctness wins over the Sheets adapter:

1. **Atomic status transitions.** ``update_order(order_id, *, expected_status=…)``
   compiles to a conditional ``UPDATE orders SET … WHERE order_id=:id AND
   status=:expected RETURNING order_id``; 0 rows → ``OrderStatusConflictError``
   (route → 409). This replaces the Sheets ``invalidate→reread→check`` cache
   dance with a real row-level guard — closing the documented TOCTOU windows on
   the 5 status-transition contracts (claim / release / dispatch / save / edit).
   Dispatch keeps its two-call shape (lines then status); the conditional status
   flip is the double-dispatch guard, and the line writes stay idempotent
   overwrites — no combined lines+status transaction is added, so the seam stays
   uniform.
2. **One query instead of N Sheets reads** for the join-heavy detail endpoints.

The Sheets TTL cache / column-order serialization / 429-retry have no analogue
here, so ``invalidate_cache`` is a no-op (routes still call it).

Security: the connection role is ``postgres`` (table owner) → bypasses RLS, so
the deny-all policies (migration 0002) lock only the public anon/PostgREST API,
not the app. The DSN (incl. password) is a secret — ``SUPPLY_OS_DATABASE_URL``
(SecretStr), server-side only.

Column names in every statement match the Pydantic ``model_dump()`` field names
exactly, so rows round-trip to the same models as ``sheets.py``.
"""
from __future__ import annotations

import logging
import threading
from enum import Enum
from typing import Optional, Type, TypeVar

from pydantic import BaseModel
from sqlalchemy import create_engine, text

from .config import DataBackend, settings
from .errors import OrderNotFoundError, OrderStatusConflictError
from .models import (
    InventoryCount,
    InventoryCountEvent,
    InventoryCountLine,
    Location,
    LocationProductSetting,
    Order,
    OrderLine,
    Product,
    Receipt,
    ReceiptLine,
    Supplier,
    SupplierProduct,
    TransportBatch,
    TransportEvent,
)

log = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Capability flag (see ``main._is_persistent``): this backend persists writes, so
# persistence-gated routes proceed instead of degrading like the seed loader.
SUPPORTS_PERSISTENCE = True

# Lazy singleton SQLAlchemy Engine (built on first data access, not at import —
# so seed/sheet modes never construct a pool or import psycopg2). Reset by tests.
_engine = None
# Guards lazy engine creation: sync routes run in Starlette's threadpool, so two
# concurrent first-requests can race in _get_engine; the lock makes init exactly-once
# (without it the loser leaks a connection pool). Matches the double-checked pattern.
_engine_lock = threading.Lock()


# ---------- Column maps (source of truth = migrations/0001_initial_schema.sql) ----------
# Match model_dump() field names exactly. The aggregate ``lines`` field on
# Order/InventoryCount/Receipt is intentionally absent (not a column).

_PRODUCT_COLUMNS = [
    "product_id", "gostock_id", "product_name_pl", "product_category",
    "inventory_unit", "is_critical", "active", "notes",
]
_SUPPLIER_COLUMNS = [
    "supplier_id", "supplier_name", "email", "ordering_method", "delivery_days",
    "cutoff_time", "minimum_order_value_pln", "active", "notes",
]
_LOCATION_COLUMNS = [
    "location_id", "location_name", "delivery_address", "city", "active", "notes",
    "company_name", "company_address", "company_nip",
]
_SUPPLIER_PRODUCT_COLUMNS = [
    "supplier_product_id", "supplier_id", "product_id", "supplier_product_name",
    "purchase_unit", "units_per_purchase_unit", "rounding_rule",
    "price_estimate_pln", "active", "notes", "order_note", "unit_weight_kg",
    "supplier_sku", "warehouse_pickup",
]
_LOCATION_PRODUCT_SETTING_COLUMNS = [
    "setting_id", "location_id", "product_id", "min_stock_qty_base",
    "max_stock_qty_base", "target_stock_qty_base", "is_critical_for_location",
    "allow_over_max_due_to_packaging", "notes",
]
_ORDER_COLUMNS = [
    "order_id", "location_id", "supplier_id", "order_date",
    "requested_delivery_date", "status", "captain_user", "captain_submitted_at",
    "manager_user", "manager_sent_at", "sent_method", "supplier_order_reference",
    "total_value_estimate_pln", "ordered_by", "last_edited_at",
    "cancelled_at", "cancelled_by", "cancel_reason", "notes",
    "extra_items", "captain_note",
]
_ORDER_LINE_COLUMNS = [
    "order_line_id", "order_id", "product_id", "supplier_product_id",
    "current_stock_qty_base", "target_stock_qty_base", "suggested_qty_base",
    "suggested_qty_purchase", "captain_final_qty_purchase", "captain_final_qty_base",
    "manager_final_qty_purchase", "manager_final_qty_base", "delta_vs_suggestion_pct",
    "reason_code", "captain_comment", "manager_comment",
]
_INVENTORY_COUNT_COLUMNS = [
    "count_id", "location_id", "count_date", "count_user", "count_submitted_at",
    "line_count", "notes", "last_edited_at",
]
_INVENTORY_COUNT_LINE_COLUMNS = [
    "count_line_id", "count_id", "product_id", "current_stock_qty_base",
    "count_comment",
]
_INVENTORY_COUNT_EVENT_COLUMNS = [
    "event_id", "count_id", "event_type", "actor", "at", "details",
]
_RECEIPT_COLUMNS = [
    "receipt_id", "order_id", "location_id", "supplier_id", "receipt_date",
    "received_by", "received_submitted_at", "line_count", "discrepancy_count",
    "received_with_missing_wz", "wz_photo_path_prefix", "wz_photo_count", "notes",
]
_RECEIPT_LINE_COLUMNS = [
    "receipt_line_id", "receipt_id", "order_id", "order_line_id", "product_id",
    "supplier_product_id", "ordered_qty_purchase", "received_qty_purchase",
    "variance_qty_purchase", "receipt_comment",
]
_TRANSPORT_BATCH_COLUMNS = [
    "transport_id", "supplier_id", "status", "driver", "vehicle", "pickup_date",
    "pickup_time", "limit_kg", "notes", "created_at", "created_by", "sent_at",
    "name",
]
_TRANSPORT_EVENT_COLUMNS = [
    "event_id", "transport_id", "order_id", "event_type", "actor", "at", "details",
]

# Temporal columns get an explicit cast in INSERT/UPDATE so a value bound as an
# ISO string (e.g. dispatch passes ``manager_sent_at`` as ``.isoformat()``) is
# parsed by Postgres, while a native date/datetime is a no-op cast. Names are
# unique across tables, so a single global set per type is unambiguous.
_DATE_COLS = frozenset(
    {
        "order_date", "requested_delivery_date", "count_date", "receipt_date",
        "pickup_date",
    }
)
# NOTE: these casting sets are GLOBAL across tables, keyed by bare column name
# (e.g. transport_events."at"). A future table reusing one of these names for a
# non-timestamptz/date column would be silently miscast — scope the sets per
# table before that happens (review OBS, 2026-08-22).
_TIMESTAMPTZ_COLS = frozenset(
    {
        "captain_submitted_at", "manager_sent_at", "last_edited_at", "cancelled_at",
        "count_submitted_at", "received_submitted_at", "created_at", "sent_at", "at",
    }
)


# ---------- Configuration ----------

def is_configured() -> bool:
    """True when the Postgres DSN is set (mirrors ``supabase_storage.is_configured``)."""
    return bool(settings.database_url.get_secret_value())


def warn_if_unconfigured() -> None:
    """Log a warning if supabase is selected but no DSN is set (mirrors sheets)."""
    if not is_configured() and settings.data_backend == DataBackend.SUPABASE:
        log.warning(
            "SUPPLY_OS_DATA_BACKEND=supabase but SUPPLY_OS_DATABASE_URL is empty. "
            "Falling back to sheet/seed."
        )


def reset_engine() -> None:
    """Dispose + drop the cached engine (used by tests + after a creds change)."""
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = None


def _get_engine():
    """Return the lazy singleton SQLAlchemy Engine on the Session Pooler.

    Normalizes a bare ``postgresql://`` DSN to ``postgresql+psycopg2://`` so the
    sync driver is always used regardless of what else is installed. Pool sized
    small for the single Railway worker at pilot scale; ``pool_pre_ping`` +
    ``pool_recycle`` survive Supavisor dropping idle connections.
    """
    global _engine
    if _engine is not None:
        return _engine
    with _engine_lock:
        if _engine is not None:  # re-check inside the lock (another thread won)
            return _engine
        url = settings.database_url.get_secret_value()
        if not url:
            raise RuntimeError(
                "SUPPLY_OS_DATABASE_URL is empty — supabase backend is not configured"
            )
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg2://" + url[len("postgresql://"):]
        _engine = create_engine(
            url,
            pool_size=3,
            max_overflow=5,
            pool_pre_ping=True,
            pool_recycle=1800,
            future=True,
        )
        log.info("SQLAlchemy engine created (singleton, Session Pooler)")
    return _engine


# ---------- Value <-> row helpers ----------

def _to_db(value):
    """One Python value → a psycopg2-bindable value. Enums collapse to ``.value``;
    everything else (date/datetime/bool/int/float/Decimal/None/str) is adapted by
    psycopg2 natively (temporal columns additionally carry an explicit cast)."""
    if isinstance(value, Enum):
        return value.value
    return value


def _bind(col: str) -> str:
    """SQL placeholder for one column — temporal columns get an explicit cast so
    both a native date/datetime and an ISO string bind correctly."""
    if col in _TIMESTAMPTZ_COLS:
        return f"CAST(:{col} AS timestamptz)"
    if col in _DATE_COLS:
        return f"CAST(:{col} AS date)"
    return f":{col}"


def _fetch_all(sql: str, model_cls: Type[T], params: Optional[dict] = None) -> list[T]:
    """Run a SELECT, map each row by column name onto ``model_cls``."""
    with _get_engine().connect() as conn:
        mappings = conn.execute(text(sql), params or {}).mappings().all()
    return [model_cls(**dict(m)) for m in mappings]


def _insert(table: str, columns: list[str], model: BaseModel) -> None:
    """INSERT one model row, picking only ``columns`` (drops aggregate ``lines``)."""
    data = model.model_dump()
    params = {c: _to_db(data.get(c)) for c in columns}
    cols_sql = ", ".join(columns)
    vals_sql = ", ".join(_bind(c) for c in columns)
    with _get_engine().begin() as conn:
        conn.execute(
            text(f"INSERT INTO {table} ({cols_sql}) VALUES ({vals_sql})"), params
        )


def _insert_many(table: str, columns: list[str], models: list[BaseModel]) -> None:
    """Batch-INSERT model rows in one executemany call."""
    if not models:
        return
    payload = [{c: _to_db(m.model_dump().get(c)) for c in columns} for m in models]
    cols_sql = ", ".join(columns)
    vals_sql = ", ".join(_bind(c) for c in columns)
    with _get_engine().begin() as conn:
        conn.execute(
            text(f"INSERT INTO {table} ({cols_sql}) VALUES ({vals_sql})"), payload
        )


# ---------- Cache no-op (parity with sheets) ----------

def invalidate_cache(worksheet_name: str | None = None) -> None:
    """No-op: Postgres has no TTL read cache. Routes still call it; harmless."""
    return None


# ---------- Master-data reads ----------

def load_products() -> list[Product]:
    return _fetch_all("SELECT * FROM products ORDER BY product_id", Product)


def load_suppliers() -> list[Supplier]:
    return _fetch_all("SELECT * FROM suppliers ORDER BY supplier_id", Supplier)


def load_locations() -> list[Location]:
    return _fetch_all("SELECT * FROM locations ORDER BY location_id", Location)


def load_supplier_products() -> list[SupplierProduct]:
    return _fetch_all(
        "SELECT * FROM supplier_products ORDER BY supplier_product_id",
        SupplierProduct,
    )


def load_location_product_settings() -> list[LocationProductSetting]:
    return _fetch_all(
        "SELECT * FROM location_product_settings ORDER BY setting_id",
        LocationProductSetting,
    )


def load_meta() -> dict:
    """Read the _meta table (key, value) as a plain dict (mirrors sheets.load_meta)."""
    with _get_engine().connect() as conn:
        rows = conn.execute(text("SELECT key, value FROM _meta")).mappings().all()
    return {row["key"]: row["value"] for row in rows}


# ---------- Orders: reads ----------

def load_orders() -> list[Order]:
    """All orders, lines NOT populated (mirrors sheets.load_orders)."""
    return _fetch_all("SELECT * FROM orders ORDER BY order_id", Order)


def load_order_lines() -> list[OrderLine]:
    return _fetch_all("SELECT * FROM order_lines ORDER BY order_line_id", OrderLine)


def load_order_lines_for_orders(order_ids: list[str]) -> list[OrderLine]:
    """Order lines for a specific set of orders — a targeted query, not a
    full-table scan (F-7). The queue / captain-list endpoints only need the lines
    for the orders they display. ``order_id`` is indexed; an empty id list
    short-circuits to ``[]`` (no query). psycopg2 adapts the Python list to a
    Postgres array for ``= ANY(:ids)``. (suggestion-review still uses
    ``load_order_lines`` — it aggregates the full history.)"""
    if not order_ids:
        return []
    return _fetch_all(
        "SELECT * FROM order_lines WHERE order_id = ANY(:ids) ORDER BY order_line_id",
        OrderLine,
        {"ids": list(order_ids)},
    )


def get_order(order_id: str) -> Order | None:
    """Return the Order with its lines populated, or None (mirrors sheets.get_order)."""
    orders = _fetch_all(
        "SELECT * FROM orders WHERE order_id = :oid", Order, {"oid": order_id}
    )
    if not orders:
        return None
    lines = _fetch_all(
        "SELECT * FROM order_lines WHERE order_id = :oid ORDER BY order_line_id",
        OrderLine,
        {"oid": order_id},
    )
    return orders[0].model_copy(update={"lines": lines})


# ---------- Orders: writes ----------

def append_order(order: Order) -> None:
    _insert("orders", _ORDER_COLUMNS, order)


def append_order_lines(lines: list[OrderLine]) -> None:
    """Batch-append order lines. All must share one order_id (mirrors sheets)."""
    if not lines:
        return
    order_ids = {line.order_id for line in lines}
    if len(order_ids) > 1:
        raise ValueError(
            f"append_order_lines: all lines must share order_id; got {sorted(order_ids)}"
        )
    _insert_many("order_lines", _ORDER_LINE_COLUMNS, lines)


def update_order(order_id: str, *, expected_status=None, **kwargs) -> None:
    """Update fields on the orders row matching ``order_id``.

    The atomicity contract (the S-10 correctness win): when ``expected_status``
    is given, the WHERE clause adds ``AND status = :expected`` so the update is a
    single conditional statement; 0 matched rows raises ``OrderStatusConflictError``
    (the order changed status concurrently). Without it, 0 rows raises
    ``OrderNotFoundError`` (no such order). Unknown kwargs that aren't real
    columns are ignored (forgiving of caller typos, mirrors sheets).
    """
    exp = expected_status.value if isinstance(expected_status, Enum) else expected_status
    set_cols = [c for c in kwargs if c in _ORDER_COLUMNS and c != "order_id"]
    params = {c: _to_db(kwargs[c]) for c in set_cols}
    params["_order_id"] = order_id
    where = "order_id = :_order_id"
    if exp is not None:
        where += " AND status = :_expected_status"
        params["_expected_status"] = exp

    if set_cols:
        set_sql = ", ".join(f"{c} = {_bind(c)}" for c in set_cols)
        sql = f"UPDATE orders SET {set_sql} WHERE {where} RETURNING order_id"
    elif exp is not None:
        # Guard-only call: verify the row is in the expected status without
        # mutating any data (no route hits this today; kept correct anyway).
        sql = f"UPDATE orders SET order_id = order_id WHERE {where} RETURNING order_id"
    else:
        return  # nothing to write and nothing to guard

    with _get_engine().begin() as conn:
        rows = conn.execute(text(sql), params).fetchall()
    if not rows:
        if exp is not None:
            raise OrderStatusConflictError(
                f"order_id={order_id!r} was not in expected status {exp!r} "
                f"(concurrent change)"
            )
        raise OrderNotFoundError(f"order_id={order_id!r} not found in 'orders'")


def update_order_lines(order_id: str, line_updates: dict[str, dict]) -> None:
    """Update specific columns on existing order_lines rows for one order.

    ``line_updates`` shape: ``{order_line_id: {field: value, ...}, ...}``. Each
    UPDATE is scoped by ``order_id`` too, so a line id that doesn't belong to the
    order simply matches 0 rows and is skipped (mirrors sheets' lenient skip).
    """
    if not line_updates:
        return
    with _get_engine().begin() as conn:
        for line_id, fields in line_updates.items():
            cols = [c for c in fields if c in _ORDER_LINE_COLUMNS]
            if not cols:
                continue
            set_sql = ", ".join(f"{c} = {_bind(c)}" for c in cols)
            params = {c: _to_db(fields[c]) for c in cols}
            params["_line_id"] = line_id
            params["_order_id"] = order_id
            conn.execute(
                text(
                    f"UPDATE order_lines SET {set_sql} "
                    f"WHERE order_line_id = :_line_id AND order_id = :_order_id"
                ),
                params,
            )


def delete_order_lines(order_id: str) -> int:
    """Delete every order_lines row for ``order_id`` in ONE statement; return count."""
    with _get_engine().begin() as conn:
        result = conn.execute(
            text("DELETE FROM order_lines WHERE order_id = :oid"), {"oid": order_id}
        )
        return result.rowcount or 0


def replace_order_lines_atomic(
    order_id: str,
    new_lines: list[OrderLine],
    *,
    order_updates: Optional[dict] = None,
    expected_status=None,
) -> None:
    """Atomically replace an order's full line set AND apply ``order_updates``,
    guarded by ``expected_status`` — all in ONE Postgres transaction (F1 fix).

    Sequence inside the single transaction:
      1. Conditional ``UPDATE orders SET <order_updates> WHERE order_id=:id
         [AND status=:expected] RETURNING order_id``. 0 matched rows raises
         ``OrderStatusConflictError`` (with ``expected_status``) or
         ``OrderNotFoundError`` (without) — and because we raise INSIDE the
         ``begin()`` block, the whole transaction rolls back, so the line set is
         NEVER touched when the guard fails. This closes the captain-edit window
         where a concurrent manager-claim could land the delete+insert under a
         now-claimed order.
      2. ``DELETE FROM order_lines WHERE order_id``.
      3. Batch-``INSERT`` ``new_lines`` (skipped when empty).

    ``new_lines`` must all share ``order_id`` (mirrors ``append_order_lines``).
    Field selection mirrors ``update_order`` (unknown order_updates keys ignored).
    """
    order_updates = order_updates or {}
    exp = expected_status.value if isinstance(expected_status, Enum) else expected_status
    if new_lines:
        ids = {line.order_id for line in new_lines}
        if ids != {order_id}:
            raise ValueError(
                f"replace_order_lines_atomic: all new_lines must share "
                f"order_id={order_id!r}; got {sorted(ids)}"
            )

    set_cols = [c for c in order_updates if c in _ORDER_COLUMNS and c != "order_id"]
    params = {c: _to_db(order_updates[c]) for c in set_cols}
    params["_order_id"] = order_id
    where = "order_id = :_order_id"
    if exp is not None:
        where += " AND status = :_expected_status"
        params["_expected_status"] = exp
    if set_cols:
        set_sql = ", ".join(f"{c} = {_bind(c)}" for c in set_cols)
        order_sql = f"UPDATE orders SET {set_sql} WHERE {where} RETURNING order_id"
    else:
        # Guard-only (no order-field updates): verify status without mutating.
        order_sql = f"UPDATE orders SET order_id = order_id WHERE {where} RETURNING order_id"

    line_payload = [
        {c: _to_db(line.model_dump().get(c)) for c in _ORDER_LINE_COLUMNS}
        for line in new_lines
    ]

    with _get_engine().begin() as conn:
        rows = conn.execute(text(order_sql), params).fetchall()
        if not rows:
            if exp is not None:
                raise OrderStatusConflictError(
                    f"order_id={order_id!r} was not in expected status {exp!r} "
                    f"(concurrent change)"
                )
            raise OrderNotFoundError(f"order_id={order_id!r} not found in 'orders'")
        conn.execute(
            text("DELETE FROM order_lines WHERE order_id = :oid"), {"oid": order_id}
        )
        if line_payload:
            cols_sql = ", ".join(_ORDER_LINE_COLUMNS)
            vals_sql = ", ".join(_bind(c) for c in _ORDER_LINE_COLUMNS)
            conn.execute(
                text(f"INSERT INTO order_lines ({cols_sql}) VALUES ({vals_sql})"),
                line_payload,
            )


# ---------- Inventory counts ----------

def load_inventory_counts() -> list[InventoryCount]:
    return _fetch_all(
        "SELECT * FROM inventory_counts ORDER BY count_id", InventoryCount
    )


def load_inventory_count_lines() -> list[InventoryCountLine]:
    return _fetch_all(
        "SELECT * FROM inventory_count_lines ORDER BY count_line_id",
        InventoryCountLine,
    )


def append_inventory_count(count: InventoryCount) -> None:
    _insert("inventory_counts", _INVENTORY_COUNT_COLUMNS, count)


def append_inventory_count_lines(lines: list[InventoryCountLine]) -> None:
    if not lines:
        return
    count_ids = {line.count_id for line in lines}
    if len(count_ids) > 1:
        raise ValueError(
            f"append_inventory_count_lines: all lines must share count_id; "
            f"got {sorted(count_ids)}"
        )
    _insert_many("inventory_count_lines", _INVENTORY_COUNT_LINE_COLUMNS, lines)


def get_inventory_count(count_id: str) -> InventoryCount | None:
    counts = _fetch_all(
        "SELECT * FROM inventory_counts WHERE count_id = :cid",
        InventoryCount,
        {"cid": count_id},
    )
    if not counts:
        return None
    lines = _fetch_all(
        "SELECT * FROM inventory_count_lines WHERE count_id = :cid "
        "ORDER BY count_line_id",
        InventoryCountLine,
        {"cid": count_id},
    )
    return counts[0].model_copy(update={"lines": lines})


# ---------- Inventory count edit + event history (Phase 2, training-feedback-0901) ----------

def delete_inventory_count_lines(count_id: str) -> int:
    """Delete every inventory_count_lines row for ``count_id`` in ONE
    statement; return count (mirrors ``delete_order_lines``)."""
    with _get_engine().begin() as conn:
        result = conn.execute(
            text("DELETE FROM inventory_count_lines WHERE count_id = :cid"),
            {"cid": count_id},
        )
        return result.rowcount or 0


def update_inventory_count(count_id: str, **kwargs) -> None:
    """Update fields on the inventory_counts row matching ``count_id``
    (mirrors ``update_receipt`` — no status guard; inventory counts have no
    status transitions). Used by the Captain edit route to persist the
    recomputed ``line_count`` and ``last_edited_at`` after a correction.
    Raises OrderNotFoundError if the count is absent. No-op when ``kwargs``
    is empty."""
    cols = [c for c in kwargs if c in _INVENTORY_COUNT_COLUMNS and c != "count_id"]
    if not cols:
        return
    set_sql = ", ".join(f"{c} = {_bind(c)}" for c in cols)
    params = {c: _to_db(kwargs[c]) for c in cols}
    params["_count_id"] = count_id
    sql = (
        f"UPDATE inventory_counts SET {set_sql} "
        f"WHERE count_id = :_count_id RETURNING count_id"
    )
    with _get_engine().begin() as conn:
        rows = conn.execute(text(sql), params).fetchall()
    if not rows:
        raise OrderNotFoundError(
            f"count_id={count_id!r} not found in 'inventory_counts'"
        )


def replace_inventory_count_lines_atomic(
    count_id: str,
    new_lines: list[InventoryCountLine],
    *,
    count_updates: Optional[dict] = None,
) -> None:
    """Atomically replace a snapshot's full line set AND apply ``count_updates``
    in ONE Postgres transaction (mirrors ``replace_order_lines_atomic``).

    Sequence inside the single transaction:
      1. ``UPDATE inventory_counts SET <count_updates> WHERE count_id RETURNING``
         — 0 matched rows raises ``OrderNotFoundError`` INSIDE the ``begin()``
         block, so the whole transaction rolls back and the line set is never
         touched for a count that does not exist.
      2. ``DELETE FROM inventory_count_lines WHERE count_id``.
      3. Batch-``INSERT`` ``new_lines`` (skipped when empty).

    Why this exists rather than three separate calls: a crash or pool timeout
    between the delete and the insert would otherwise leave a real snapshot with
    ZERO lines while ``line_count`` still advertised the old number, and
    ``captain_inventory_latest`` would then offer that empty snapshot for order
    pre-fill. There is no in-app recovery from that state, so the correction
    path must be all-or-nothing.

    ``new_lines`` must all share ``count_id`` (mirrors ``append_inventory_count_lines``).
    Unknown ``count_updates`` keys are ignored (mirrors ``update_inventory_count``).
    """
    count_updates = count_updates or {}
    if new_lines:
        ids = {line.count_id for line in new_lines}
        if ids != {count_id}:
            raise ValueError(
                f"replace_inventory_count_lines_atomic: all new_lines must share "
                f"count_id={count_id!r}; got {sorted(ids)}"
            )

    set_cols = [
        c for c in count_updates if c in _INVENTORY_COUNT_COLUMNS and c != "count_id"
    ]
    params = {c: _to_db(count_updates[c]) for c in set_cols}
    params["_count_id"] = count_id
    if set_cols:
        set_sql = ", ".join(f"{c} = {_bind(c)}" for c in set_cols)
        count_sql = (
            f"UPDATE inventory_counts SET {set_sql} "
            f"WHERE count_id = :_count_id RETURNING count_id"
        )
    else:
        # Existence check without mutating (mirrors the guard-only order branch).
        count_sql = (
            "UPDATE inventory_counts SET count_id = count_id "
            "WHERE count_id = :_count_id RETURNING count_id"
        )

    line_payload = [
        {c: _to_db(line.model_dump().get(c)) for c in _INVENTORY_COUNT_LINE_COLUMNS}
        for line in new_lines
    ]

    with _get_engine().begin() as conn:
        rows = conn.execute(text(count_sql), params).fetchall()
        if not rows:
            raise OrderNotFoundError(
                f"count_id={count_id!r} not found in 'inventory_counts'"
            )
        conn.execute(
            text("DELETE FROM inventory_count_lines WHERE count_id = :cid"),
            {"cid": count_id},
        )
        if line_payload:
            cols_sql = ", ".join(_INVENTORY_COUNT_LINE_COLUMNS)
            vals_sql = ", ".join(_bind(c) for c in _INVENTORY_COUNT_LINE_COLUMNS)
            conn.execute(
                text(
                    f"INSERT INTO inventory_count_lines ({cols_sql}) "
                    f"VALUES ({vals_sql})"
                ),
                line_payload,
            )


def load_inventory_count_events_for(count_id: str) -> list[InventoryCountEvent]:
    """Targeted read for one snapshot's event history — not a full-table scan
    (mirrors ``load_transport_events_for``)."""
    return _fetch_all(
        "SELECT * FROM inventory_count_events WHERE count_id = :cid ORDER BY at DESC",
        InventoryCountEvent,
        {"cid": count_id},
    )


def append_inventory_count_event(event: InventoryCountEvent) -> None:
    """Append-only — there is no update/delete for an audit-trail row.
    Callers (``main._log_inventory_event``) treat this as best-effort and
    never let a failure here break the correction that triggered it."""
    _insert("inventory_count_events", _INVENTORY_COUNT_EVENT_COLUMNS, event)


# ---------- Receipts ----------

def load_receipts() -> list[Receipt]:
    return _fetch_all("SELECT * FROM receipts ORDER BY receipt_id", Receipt)


def load_receipt_lines() -> list[ReceiptLine]:
    return _fetch_all(
        "SELECT * FROM receipt_lines ORDER BY receipt_line_id", ReceiptLine
    )


def load_receipts_for_orders(order_ids: list[str]) -> list[Receipt]:
    """Receipts for a specific set of orders — a targeted query, not a full-table
    scan (F5, mirrors ``load_order_lines_for_orders``). ``order_id`` is indexed;
    an empty id list short-circuits to ``[]`` (no query)."""
    if not order_ids:
        return []
    return _fetch_all(
        "SELECT * FROM receipts WHERE order_id = ANY(:ids) ORDER BY receipt_id",
        Receipt,
        {"ids": list(order_ids)},
    )


def append_receipt(receipt: Receipt) -> None:
    _insert("receipts", _RECEIPT_COLUMNS, receipt)


def append_receipt_lines(lines: list[ReceiptLine]) -> None:
    if not lines:
        return
    receipt_ids = {line.receipt_id for line in lines}
    if len(receipt_ids) > 1:
        raise ValueError(
            f"append_receipt_lines: all lines must share receipt_id; "
            f"got {sorted(receipt_ids)}"
        )
    _insert_many("receipt_lines", _RECEIPT_LINE_COLUMNS, lines)


def get_receipt(receipt_id: str) -> Receipt | None:
    receipts = _fetch_all(
        "SELECT * FROM receipts WHERE receipt_id = :rid", Receipt, {"rid": receipt_id}
    )
    if not receipts:
        return None
    lines = _fetch_all(
        "SELECT * FROM receipt_lines WHERE receipt_id = :rid ORDER BY receipt_line_id",
        ReceiptLine,
        {"rid": receipt_id},
    )
    return receipts[0].model_copy(update={"lines": lines})


def update_receipt(receipt_id: str, **kwargs) -> None:
    """Update fields on the receipts row matching ``receipt_id`` (mirrors
    sheets.update_receipt — no status guard; receipts have no transitions)."""
    cols = [c for c in kwargs if c in _RECEIPT_COLUMNS and c != "receipt_id"]
    if not cols:
        return
    set_sql = ", ".join(f"{c} = {_bind(c)}" for c in cols)
    params = {c: _to_db(kwargs[c]) for c in cols}
    params["_receipt_id"] = receipt_id
    sql = f"UPDATE receipts SET {set_sql} WHERE receipt_id = :_receipt_id RETURNING receipt_id"
    with _get_engine().begin() as conn:
        rows = conn.execute(text(sql), params).fetchall()
    if not rows:
        raise OrderNotFoundError(
            f"receipt_id={receipt_id!r} not found in 'receipts'"
        )


# ---------- Transport batches (v2, to-ordering-pago ADDENDUM v2) ----------

def load_transport_batches() -> list[TransportBatch]:
    return _fetch_all(
        "SELECT * FROM transport_batches ORDER BY transport_id", TransportBatch
    )


def get_transport_batch(transport_id: str) -> TransportBatch | None:
    """Return the TransportBatch with ``transport_id``, or None if no header
    row exists — a marker group with no header row is a v1-created legacy
    batch (mirrors ``sheets.get_transport_batch``, which returns the same
    None for the same reason, just via an empty ``load_transport_batches``)."""
    batches = _fetch_all(
        "SELECT * FROM transport_batches WHERE transport_id = :tid",
        TransportBatch,
        {"tid": transport_id},
    )
    return batches[0] if batches else None


def append_transport_batch(batch: TransportBatch) -> None:
    _insert("transport_batches", _TRANSPORT_BATCH_COLUMNS, batch)


def update_transport_batch(transport_id: str, **kwargs) -> None:
    """Update fields on the transport_batches row matching ``transport_id``
    (mirrors ``update_receipt`` — no status guard; the route layer preflights
    the draft/sent gate before calling this)."""
    cols = [c for c in kwargs if c in _TRANSPORT_BATCH_COLUMNS and c != "transport_id"]
    if not cols:
        return
    set_sql = ", ".join(f"{c} = {_bind(c)}" for c in cols)
    params = {c: _to_db(kwargs[c]) for c in cols}
    params["_transport_id"] = transport_id
    sql = (
        f"UPDATE transport_batches SET {set_sql} "
        f"WHERE transport_id = :_transport_id RETURNING transport_id"
    )
    with _get_engine().begin() as conn:
        rows = conn.execute(text(sql), params).fetchall()
    if not rows:
        raise OrderNotFoundError(
            f"transport_id={transport_id!r} not found in 'transport_batches'"
        )


# ---------- Transport event history (v3, to-ordering-pago ADDENDUM v3) ----------

def load_transport_events_for(transport_id: str) -> list[TransportEvent]:
    """Targeted read for one batch's event history — not a full-table scan
    (mirrors ``load_receipts_for_orders``)."""
    return _fetch_all(
        "SELECT * FROM transport_events WHERE transport_id = :tid ORDER BY at DESC",
        TransportEvent,
        {"tid": transport_id},
    )


def append_transport_event(event: TransportEvent) -> None:
    """Append-only — there is no update/delete for an audit-trail row.
    Callers (``main._log_transport_event``) treat this as best-effort and
    never let a failure here break the business action that triggered it."""
    _insert("transport_events", _TRANSPORT_EVENT_COLUMNS, event)
