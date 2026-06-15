"""Google Sheets adapter — read side (Phase C1).

Default backend is still the seed CSV loader. When
`SUPPLY_OS_DATA_BACKEND=sheet`, this module replaces seed_loader for
reads and (in Phase C2) will add write capabilities for orders +
order_lines.

Public read API mirrors `app.seed_loader`:
    load_products, load_suppliers, load_locations,
    load_supplier_products, load_location_product_settings,
    load_meta, invalidate_cache, is_configured, warn_if_unconfigured.

Write functions are placeholders that raise NotImplementedError; they
will be implemented in Phase C2.
"""
from __future__ import annotations

import logging
import time
from datetime import date, datetime
from enum import Enum
from typing import Type, TypeVar

import gspread
from gspread.exceptions import APIError, SpreadsheetNotFound, WorksheetNotFound
from gspread.utils import rowcol_to_a1
from google.oauth2.service_account import Credentials
from pydantic import BaseModel

from .config import has_service_account_creds, resolve_service_account_info, settings
from .models import (
    InventoryCount,
    InventoryCountLine,
    Location,
    LocationProductSetting,
    Order,
    OrderLine,
    OrderStatus,
    Product,
    Receipt,
    ReceiptLine,
    Supplier,
    SupplierProduct,
)

log = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

DEFAULT_TTL_SECONDS = 60

# Orders + order_lines change far more often than master data and drive the
# Manager queue's freshness, so they refresh on a shorter TTL — a newly submitted
# order then surfaces within ~20s instead of up to 60s. Master-data reads keep
# DEFAULT_TTL_SECONDS (they change rarely; no reason to add Sheet reads). At one
# manager this is ~6 reads/min (orders + order_lines, one cache-miss each per 20s
# TTL period), well under the Sheets ~60/min/user quota.
ORDERS_TTL_SECONDS = 20

# Module-level singletons. Cleared via invalidate_cache().
_client_instance: gspread.Client | None = None
_sheet_instance = None  # gspread.Spreadsheet
# TTL cache: { (sheet_id, worksheet_name): (fetched_at, list_of_models_or_dict) }
_ttl_cache: dict[tuple[str, str], tuple[float, object]] = {}


# ---------- Errors ----------

class ConfigDriftError(Exception):
    """Raised when a worksheet's headers don't match the expected schema."""

    pass


class OrderNotFoundError(Exception):
    """Raised when update_order or update_order_lines can't find the order_id."""

    pass


class OrderAlreadyDispatchedError(Exception):
    """Raised when an update would transition an already-dispatched order back."""

    pass


# ---------- Configuration helpers ----------

def is_configured() -> bool:
    return bool(settings.google_sheet_id and has_service_account_creds())


def warn_if_unconfigured() -> None:
    if not is_configured() and settings.data_backend == "sheet":
        log.warning(
            "SUPPLY_OS_DATA_BACKEND=sheet but Google Sheets is not configured. "
            "Falling back to seed CSVs."
        )


# ---------- gspread client / sheet ----------

def _client() -> gspread.Client:
    """Return a singleton authorized gspread client.

    Credentials are resolved by `config.resolve_service_account_info()`
    (file -> base64 -> inline), then scoped to `SCOPES`. Sharing that resolver
    is the single source of truth so every consumer (Sheets + Drive) honors the
    same credential sources — including the base64 form used on Railway.
    """
    global _client_instance
    if _client_instance is not None:
        return _client_instance

    creds = Credentials.from_service_account_info(
        resolve_service_account_info(), scopes=SCOPES
    )
    _client_instance = gspread.authorize(creds)
    log.info("gspread client created (singleton)")
    return _client_instance


def _sheet():
    """Return the singleton open Spreadsheet handle."""
    global _sheet_instance
    if _sheet_instance is not None:
        return _sheet_instance
    if not settings.google_sheet_id:
        raise RuntimeError("google_sheet_id is empty — cannot open spreadsheet")
    try:
        _sheet_instance = _client().open_by_key(settings.google_sheet_id)
    except SpreadsheetNotFound:
        raise SpreadsheetNotFound(
            f"Spreadsheet not found for sheet_id='{settings.google_sheet_id}'. "
            f"Check SUPPLY_OS_GOOGLE_SHEET_ID and that the service account has access."
        )
    return _sheet_instance


# ---------- Normalization ----------

def _normalize(raw: dict) -> dict:
    """Sheet strings → Python-friendly: empty → None, TRUE/FALSE → bool, strip ws.

    Mirrors `app.seed_loader._normalize`. Kept as a local copy to avoid a
    forced import dependency between adapters.
    """
    out: dict = {}
    for k, v in raw.items():
        if k is None:
            continue
        v_stripped = v.strip() if isinstance(v, str) else v
        if v_stripped == "":
            out[k] = None
        elif isinstance(v_stripped, str) and v_stripped.upper() in {"TRUE", "FALSE"}:
            out[k] = v_stripped.upper() == "TRUE"
        else:
            out[k] = v_stripped
    return out


# ---------- Worksheet fetch with retry + header validation ----------

def _open_worksheet(worksheet_name: str):
    """Open a worksheet by name with a helpful error message on miss."""
    sh = _sheet()
    try:
        return sh.worksheet(worksheet_name)
    except WorksheetNotFound:
        raise WorksheetNotFound(
            f"Worksheet '{worksheet_name}' not found in sheet_id="
            f"'{settings.google_sheet_id}'. Available tabs: "
            f"{[w.title for w in sh.worksheets()]}"
        )


def _fetch_rows_with_retry(ws) -> tuple[list[str], list[dict]]:
    """Fetch headers + records from a worksheet. Retry once on APIError 429."""
    attempt = 0
    while True:
        attempt += 1
        try:
            headers = ws.row_values(1)
            records = ws.get_all_records()
            return headers, records
        except APIError as e:
            code = getattr(e, "code", None)
            if code == 429 and attempt == 1:
                log.info(
                    "gspread APIError 429 on worksheet '%s' — retrying once after 2s",
                    getattr(ws, "title", "?"),
                )
                time.sleep(2)
                continue
            raise


def _validate_headers(
    worksheet_name: str, actual_headers: list[str], model_cls: Type[BaseModel]
) -> None:
    """Raise ConfigDriftError if any *required* model field is missing from headers.

    Pydantic fields with default values (e.g. `rounding_rule = RoundingRule.FULL_ONLY`)
    are treated as optional — operators can omit those columns in the sheet and the
    model default takes effect. Only fields without a default are mandatory.

    Extra columns are allowed (operators may add notes/scratch columns).
    """
    required = {
        name
        for name, field in model_cls.model_fields.items()
        if field.is_required()
    }
    actual = {h for h in actual_headers if h}  # ignore empty header cells
    missing = required - actual
    if missing:
        msg = (
            f"Worksheet '{worksheet_name}' missing required headers: "
            f"{sorted(missing)} (got: {sorted(actual)}; "
            f"required: {sorted(required)})"
        )
        log.warning(msg)
        raise ConfigDriftError(msg)


def _read_with_ttl(
    worksheet_name: str,
    model_cls: Type[T],
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> list[T]:
    """Fetch worksheet rows → list of Pydantic models with TTL caching."""
    sheet_id = settings.google_sheet_id
    key = (sheet_id, worksheet_name)
    now = time.time()
    cached = _ttl_cache.get(key)
    if cached is not None and (now - cached[0]) < ttl_seconds:
        log.info("cache hit for worksheet '%s'", worksheet_name)
        return cached[1]  # type: ignore[return-value]

    log.info("cache miss for worksheet '%s' — fetching", worksheet_name)
    ws = _open_worksheet(worksheet_name)
    headers, records = _fetch_rows_with_retry(ws)
    _validate_headers(worksheet_name, headers, model_cls)

    rows: list[T] = []
    for raw in records:
        cleaned = _normalize(raw)
        cleaned = {k: v for k, v in cleaned.items() if v is not None}
        rows.append(model_cls(**cleaned))
    _ttl_cache[key] = (now, rows)
    return rows


# ---------- Public read API ----------

def load_products() -> list[Product]:
    return _read_with_ttl("products", Product)


def load_suppliers() -> list[Supplier]:
    return _read_with_ttl("suppliers", Supplier)


def load_locations() -> list[Location]:
    return _read_with_ttl("locations", Location)


def load_supplier_products() -> list[SupplierProduct]:
    return _read_with_ttl("supplier_products", SupplierProduct)


def load_location_product_settings() -> list[LocationProductSetting]:
    return _read_with_ttl("location_product_settings", LocationProductSetting)


def load_meta(ttl_seconds: int = DEFAULT_TTL_SECONDS) -> dict:
    """Read the _meta worksheet (two columns: key, value) as a plain dict."""
    sheet_id = settings.google_sheet_id
    worksheet_name = "_meta"
    key = (sheet_id, worksheet_name)
    now = time.time()
    cached = _ttl_cache.get(key)
    if cached is not None and (now - cached[0]) < ttl_seconds:
        log.info("cache hit for worksheet '%s'", worksheet_name)
        return cached[1]  # type: ignore[return-value]

    log.info("cache miss for worksheet '%s' — fetching", worksheet_name)
    ws = _open_worksheet(worksheet_name)
    _, records = _fetch_rows_with_retry(ws)
    out: dict = {}
    for raw in records:
        normalized = _normalize(raw)
        k = normalized.get("key")
        v = normalized.get("value")
        if k is None:
            continue
        out[k] = v
    _ttl_cache[key] = (now, out)
    return out


def invalidate_cache(worksheet_name: str | None = None) -> None:
    """Drop TTL cache entries. None clears all; otherwise just the named one."""
    global _ttl_cache
    if worksheet_name is None:
        _ttl_cache.clear()
        log.info("TTL cache fully invalidated")
        return
    sheet_id = settings.google_sheet_id
    _ttl_cache.pop((sheet_id, worksheet_name), None)
    log.info("TTL cache invalidated for worksheet '%s'", worksheet_name)


# ---------- Read helpers for orders / order_lines (added in C2 for write closure) ----------

def load_orders() -> list[Order]:
    """Read 'orders' worksheet, return Order instances without lines populated."""
    return _read_with_ttl("orders", Order, ORDERS_TTL_SECONDS)


def load_order_lines() -> list[OrderLine]:
    """Read 'order_lines' worksheet, return OrderLine instances."""
    return _read_with_ttl("order_lines", OrderLine, ORDERS_TTL_SECONDS)


# ---------- Write-side helpers (Phase C2) ----------

# TTL cache for worksheet header order. Keyed by (sheet_id, worksheet_name) and
# storing (fetched_at, list_of_headers). We do not want to re-fetch row 1 on
# every write.
_COLUMN_ORDER_TTL_SECONDS = 300  # 5 min — write paths are infrequent
_column_order_cache: dict[tuple[str, str], tuple[float, list[str]]] = {}


def _model_to_row(model: BaseModel, column_order: list[str]) -> list:
    """Serialize a Pydantic model into a flat row laid out in ``column_order``.

    Conversion rules:
        - None        -> ""
        - bool        -> "TRUE" / "FALSE" (matches the seed CSV convention)
        - Enum        -> .value
        - date        -> ISO date string (YYYY-MM-DD)
        - datetime    -> ISO datetime string
        - float / int -> str(...) without locale
        - everything else -> str(...)

    Columns not present on the model are emitted as "" (lets operators add
    scratch columns without breaking writes).
    """
    data = model.model_dump()
    out: list = []
    for col in column_order:
        if col not in data:
            out.append("")
            continue
        value = data[col]
        out.append(_cell_value(value))
    return out


def _cell_value(value) -> str:
    """Convert a single Python value to its sheet-cell string representation."""
    if value is None:
        return ""
    # model_dump unwraps Enum->value already for str-Enums, but raw enums may
    # still slip in via update_order kwargs. Be defensive.
    if isinstance(value, Enum):
        return str(value.value)
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (int, float)):
        return str(value)
    return str(value)


def _get_column_order(worksheet) -> list[str]:
    """Return current header row (row 1) for ``worksheet``, with TTL caching.

    Cache key is (sheet_id, worksheet.title); TTL is 5 min. Cuts the header
    round-trip from one-per-write to one-per-burst.
    """
    sheet_id = settings.google_sheet_id
    title = getattr(worksheet, "title", None) or "?"
    key = (sheet_id, title)
    now = time.time()
    cached = _column_order_cache.get(key)
    if cached is not None and (now - cached[0]) < _COLUMN_ORDER_TTL_SECONDS:
        return cached[1]
    headers = worksheet.row_values(1)
    _column_order_cache[key] = (now, headers)
    return headers


def _invalidate_column_order_cache(worksheet_name: str | None = None) -> None:
    """Drop column-order cache entries. Used internally for tests."""
    global _column_order_cache
    if worksheet_name is None:
        _column_order_cache.clear()
        return
    sheet_id = settings.google_sheet_id
    _column_order_cache.pop((sheet_id, worksheet_name), None)


def _find_row_index(worksheet, key_column: str, key_value: str) -> int | None:
    """Find 1-indexed row number of the row whose ``key_column`` cell == ``key_value``.

    Row 1 is headers, so the first data row is 2. Returns None if not found.
    Uses worksheet.find() when the column index can be resolved from the
    cached header order; otherwise falls back to a manual column scan.
    """
    headers = _get_column_order(worksheet)
    try:
        col_idx = headers.index(key_column) + 1  # gspread is 1-indexed
    except ValueError:
        return None

    find_fn = getattr(worksheet, "find", None)
    if callable(find_fn):
        try:
            cell = find_fn(key_value, in_column=col_idx)
        except TypeError:
            # Older find() signature without in_column kwarg — fall back to scan.
            cell = None
        if cell is not None:
            return getattr(cell, "row", None)
        # find() returned None — confirm with manual scan to handle MagicMock
        # tests that stub find=None to force the fallback path.
        if find_fn is not None and cell is not None:
            return None

    # Manual fallback: scan the column.
    col_values = worksheet.col_values(col_idx)
    for idx, value in enumerate(col_values, start=1):
        if idx == 1:
            continue  # header
        if value == key_value:
            return idx
    return None


# ---------- Write-side public API (Phase C2) ----------

def append_order(order: Order) -> None:
    """Append one row to the 'orders' worksheet, then invalidate the read cache."""
    ws = _open_worksheet("orders")
    column_order = _get_column_order(ws)
    row = _model_to_row(order, column_order)
    ws.append_row(row, value_input_option="USER_ENTERED")
    invalidate_cache("orders")


def append_order_lines(lines: list[OrderLine]) -> None:
    """Batch-append OrderLine rows to 'order_lines' in a single API call.

    All lines must share the same ``order_id``. Raises ValueError otherwise.
    Calls ``invalidate_cache('order_lines')`` after a successful write.
    A no-op when ``lines`` is empty.
    """
    if not lines:
        return
    order_ids = {line.order_id for line in lines}
    if len(order_ids) > 1:
        raise ValueError(
            f"append_order_lines: all lines must share order_id; got {sorted(order_ids)}"
        )
    ws = _open_worksheet("order_lines")
    column_order = _get_column_order(ws)
    rows = [_model_to_row(line, column_order) for line in lines]
    ws.append_rows(rows, value_input_option="USER_ENTERED")
    invalidate_cache("order_lines")


def update_order(order_id: str, **kwargs) -> None:
    """Update only the specified fields on the 'orders' row matching ``order_id``.

    - Raises OrderNotFoundError if the order is not in the sheet.
    - Defense-in-depth concurrency check: if the current row status is already
      ``manager_sent`` and the caller is trying to transition to ``manager_sent``
      again, raises OrderAlreadyDispatchedError. Callers should still do their
      own preflight read.
    - Calls invalidate_cache('orders') after a successful write.
    """
    if not kwargs:
        return

    ws = _open_worksheet("orders")
    column_order = _get_column_order(ws)
    row_idx = _find_row_index(ws, "order_id", order_id)
    if row_idx is None:
        raise OrderNotFoundError(f"order_id={order_id!r} not found in 'orders' sheet")

    # Concurrency check — re-read current orders state with a forced refresh.
    new_status = kwargs.get("status")
    if new_status is not None:
        new_status_value = (
            new_status.value if isinstance(new_status, Enum) else new_status
        )
        if new_status_value == OrderStatus.MANAGER_SENT.value:
            invalidate_cache("orders")
            current_orders = load_orders()
            current = next(
                (o for o in current_orders if o.order_id == order_id), None
            )
            if (
                current is not None
                and current.status == OrderStatus.MANAGER_SENT
            ):
                raise OrderAlreadyDispatchedError(
                    f"order_id={order_id!r} is already in status 'manager_sent'"
                )

    # Build per-cell updates only for kwargs keys that are real columns.
    updates: list[dict] = []
    for field_name, raw_value in kwargs.items():
        if field_name not in column_order:
            # Silently skip unknown columns to stay forgiving of typos in
            # callers; if this ever bites, switch to a hard ValueError.
            continue
        col_idx = column_order.index(field_name) + 1
        a1 = rowcol_to_a1(row_idx, col_idx)
        updates.append({"range": a1, "values": [[_cell_value(raw_value)]]})

    if updates:
        ws.batch_update(updates, value_input_option="USER_ENTERED")
    invalidate_cache("orders")


def update_order_lines(order_id: str, line_updates: dict[str, dict]) -> None:
    """Update specific columns on existing 'order_lines' rows for one order.

    ``line_updates`` shape: ``{order_line_id: {field_name: new_value, ...}, ...}``.

    Uses ``worksheet.batch_update`` for a single API call. Raises
    OrderNotFoundError if no lines for ``order_id`` are present. Calls
    invalidate_cache('order_lines') after a successful write.
    """
    ws = _open_worksheet("order_lines")
    column_order = _get_column_order(ws)

    # Resolve order_line_id -> row_idx. We need the order_id column scan to
    # confirm there is at least one row for this order, and the order_line_id
    # column scan to map every update target.
    try:
        order_id_col = column_order.index("order_id") + 1
        line_id_col = column_order.index("order_line_id") + 1
    except ValueError as e:
        raise ConfigDriftError(
            f"'order_lines' sheet missing required column: {e}"
        )

    order_id_values = ws.col_values(order_id_col)
    line_id_values = ws.col_values(line_id_col)

    matching_rows = {
        idx for idx, value in enumerate(order_id_values, start=1)
        if idx > 1 and value == order_id
    }
    if not matching_rows:
        raise OrderNotFoundError(
            f"order_id={order_id!r} not found in 'order_lines' sheet"
        )

    line_id_to_row: dict[str, int] = {}
    for idx, value in enumerate(line_id_values, start=1):
        if idx == 1:
            continue
        if value and idx in matching_rows:
            line_id_to_row[value] = idx

    updates: list[dict] = []
    for line_id, fields in line_updates.items():
        row_idx = line_id_to_row.get(line_id)
        if row_idx is None:
            # Skip silently — caller asked to update a line that doesn't
            # belong to this order. Could escalate later if it causes bugs.
            continue
        for field_name, raw_value in fields.items():
            if field_name not in column_order:
                continue
            col_idx = column_order.index(field_name) + 1
            a1 = rowcol_to_a1(row_idx, col_idx)
            updates.append({"range": a1, "values": [[_cell_value(raw_value)]]})

    if updates:
        ws.batch_update(updates, value_input_option="USER_ENTERED")
    invalidate_cache("order_lines")


def get_order(order_id: str) -> Order | None:
    """Return the Order with ``order_id`` and its lines populated.

    Uses the cached read paths (load_orders + load_order_lines, both TTL).
    Returns None if the order_id is not present.
    """
    orders = load_orders()
    match = next((o for o in orders if o.order_id == order_id), None)
    if match is None:
        return None
    lines = [line for line in load_order_lines() if line.order_id == order_id]
    # Re-emit the Order with lines attached. Pydantic models are immutable by
    # default-ish; using model_copy keeps validation but lets us set lines.
    return match.model_copy(update={"lines": lines})


def delete_order_lines(order_id: str) -> int:
    """Delete every row in 'order_lines' whose order_id matches.

    Returns the number of rows deleted. Used by Captain edit (PATCH) to wipe
    the old line set before appending the new one.

    Implementation: groups target rows into contiguous ranges and deletes each
    range in ONE Sheets API call (gspread's ``delete_rows(start, end)``). For a
    typical order whose lines were appended together, this collapses an N-row
    deletion into a single API call — important because the sequential per-row
    variant would exhaust the per-user write quota on large orders (50 lines
    = 50 deletes vs the Sheets 60/min limit). Ranges are deleted in reverse
    order so earlier-range indices stay valid as the sheet shifts up.
    """
    ws = _open_worksheet("order_lines")
    column_order = _get_column_order(ws)
    try:
        order_id_col = column_order.index("order_id") + 1
    except ValueError:
        raise ConfigDriftError(
            "'order_lines' sheet missing required column: order_id"
        )
    order_id_values = ws.col_values(order_id_col)
    # Collect 1-based row indices to delete, skipping the header row.
    target_rows = sorted(
        idx for idx, value in enumerate(order_id_values, start=1)
        if idx > 1 and value == order_id
    )
    if not target_rows:
        invalidate_cache("order_lines")
        return 0

    # Group consecutive indices into ranges [lo, hi].
    ranges: list[tuple[int, int]] = []
    range_start = target_rows[0]
    range_end = target_rows[0]
    for r in target_rows[1:]:
        if r == range_end + 1:
            range_end = r
        else:
            ranges.append((range_start, range_end))
            range_start = r
            range_end = r
    ranges.append((range_start, range_end))

    # Delete in reverse order so unprocessed ranges keep their indices.
    for lo, hi in sorted(ranges, key=lambda rng: rng[0], reverse=True):
        # gspread delete_rows(start, end) deletes the inclusive range in ONE
        # API call. Falling back to delete_rows(start) for single rows would
        # require gspread >= 6.0, which we already have; explicit end is safe.
        ws.delete_rows(lo, hi)
    invalidate_cache("order_lines")
    return len(target_rows)


# ---------- Inventory count read + append-only write API (S-06) ----------

def load_inventory_counts() -> list[InventoryCount]:
    """Read 'inventory_counts' worksheet, return InventoryCount instances (no lines)."""
    return _read_with_ttl("inventory_counts", InventoryCount)


def load_inventory_count_lines() -> list[InventoryCountLine]:
    """Read 'inventory_count_lines' worksheet, return InventoryCountLine instances."""
    return _read_with_ttl("inventory_count_lines", InventoryCountLine)


def append_inventory_count(count: InventoryCount) -> None:
    """Append one row to 'inventory_counts', then invalidate the read cache.

    Mirrors ``append_order``. Append-only: inventory counts are immutable dated
    snapshots — there is no update/delete in S-06.
    """
    ws = _open_worksheet("inventory_counts")
    column_order = _get_column_order(ws)
    row = _model_to_row(count, column_order)
    ws.append_row(row, value_input_option="USER_ENTERED")
    invalidate_cache("inventory_counts")


def append_inventory_count_lines(lines: list[InventoryCountLine]) -> None:
    """Batch-append InventoryCountLine rows to 'inventory_count_lines' in one call.

    All lines must share the same ``count_id`` (mirrors ``append_order_lines``);
    raises ValueError otherwise. A no-op when ``lines`` is empty. Invalidates the
    'inventory_count_lines' read cache after a successful write.
    """
    if not lines:
        return
    count_ids = {line.count_id for line in lines}
    if len(count_ids) > 1:
        raise ValueError(
            f"append_inventory_count_lines: all lines must share count_id; "
            f"got {sorted(count_ids)}"
        )
    ws = _open_worksheet("inventory_count_lines")
    column_order = _get_column_order(ws)
    rows = [_model_to_row(line, column_order) for line in lines]
    ws.append_rows(rows, value_input_option="USER_ENTERED")
    invalidate_cache("inventory_count_lines")


def get_inventory_count(count_id: str) -> InventoryCount | None:
    """Return the InventoryCount with ``count_id`` and its lines populated.

    Uses the cached read paths (load_inventory_counts + load_inventory_count_lines).
    Returns None if the count_id is not present. Mirrors ``get_order``.
    """
    counts = load_inventory_counts()
    match = next((c for c in counts if c.count_id == count_id), None)
    if match is None:
        return None
    lines = [
        line for line in load_inventory_count_lines() if line.count_id == count_id
    ]
    return match.model_copy(update={"lines": lines})


# ---------- Goods-receipt read + append/update API (GR-01) ----------

def load_receipts() -> list[Receipt]:
    """Read 'receipts' worksheet, return Receipt instances (no lines populated)."""
    return _read_with_ttl("receipts", Receipt)


def load_receipt_lines() -> list[ReceiptLine]:
    """Read 'receipt_lines' worksheet, return ReceiptLine instances."""
    return _read_with_ttl("receipt_lines", ReceiptLine)


def append_receipt(receipt: Receipt) -> None:
    """Append one row to 'receipts', then invalidate the read cache.

    Mirrors ``append_inventory_count``. Receipts are append-only snapshots; the
    only post-write mutation is ``update_receipt`` attaching WZ photo refs.
    """
    ws = _open_worksheet("receipts")
    column_order = _get_column_order(ws)
    row = _model_to_row(receipt, column_order)
    ws.append_row(row, value_input_option="USER_ENTERED")
    invalidate_cache("receipts")


def append_receipt_lines(lines: list[ReceiptLine]) -> None:
    """Batch-append ReceiptLine rows to 'receipt_lines' in one call.

    All lines must share the same ``receipt_id`` (mirrors ``append_order_lines``);
    raises ValueError otherwise. A no-op when ``lines`` is empty. Invalidates the
    'receipt_lines' read cache after a successful write.
    """
    if not lines:
        return
    receipt_ids = {line.receipt_id for line in lines}
    if len(receipt_ids) > 1:
        raise ValueError(
            f"append_receipt_lines: all lines must share receipt_id; "
            f"got {sorted(receipt_ids)}"
        )
    ws = _open_worksheet("receipt_lines")
    column_order = _get_column_order(ws)
    rows = [_model_to_row(line, column_order) for line in lines]
    ws.append_rows(rows, value_input_option="USER_ENTERED")
    invalidate_cache("receipt_lines")


def get_receipt(receipt_id: str) -> Receipt | None:
    """Return the Receipt with ``receipt_id`` and its lines populated, or None.

    Uses the cached read paths (load_receipts + load_receipt_lines). Mirrors
    ``get_inventory_count`` / ``get_order``.
    """
    receipts = load_receipts()
    match = next((r for r in receipts if r.receipt_id == receipt_id), None)
    if match is None:
        return None
    lines = [line for line in load_receipt_lines() if line.receipt_id == receipt_id]
    return match.model_copy(update={"lines": lines})


def update_receipt(receipt_id: str, **kwargs) -> None:
    """Update specific fields on the 'receipts' row matching ``receipt_id``.

    Mirrors ``update_order`` minus the dispatch concurrency guard (receipts have
    no status transitions). Used by the photo-upload endpoint to attach the WZ
    Drive folder reference + photo count. Raises OrderNotFoundError if the
    receipt is absent. No-op when ``kwargs`` is empty.
    """
    if not kwargs:
        return
    ws = _open_worksheet("receipts")
    column_order = _get_column_order(ws)
    row_idx = _find_row_index(ws, "receipt_id", receipt_id)
    if row_idx is None:
        raise OrderNotFoundError(
            f"receipt_id={receipt_id!r} not found in 'receipts' sheet"
        )
    updates: list[dict] = []
    for field_name, raw_value in kwargs.items():
        if field_name not in column_order:
            continue
        col_idx = column_order.index(field_name) + 1
        a1 = rowcol_to_a1(row_idx, col_idx)
        updates.append({"range": a1, "values": [[_cell_value(raw_value)]]})
    if updates:
        ws.batch_update(updates, value_input_option="USER_ENTERED")
    invalidate_cache("receipts")
