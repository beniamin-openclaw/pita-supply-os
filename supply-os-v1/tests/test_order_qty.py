"""Truth table for app.order_qty — the one effective-quantity rule
(order-line-zero-qty). The frontend twin is frontend/src/lib/orderQty.ts; its
test (orderQty.test.ts) walks the same rows."""
from __future__ import annotations

import pytest

from app.order_qty import effective_ordered_qty, is_manager_final_set
from app.models import OrderLine


def _line(captain: float, manager: float, flag: bool) -> OrderLine:
    return OrderLine(
        order_line_id="OL-001",
        order_id="ORD-1",
        product_id="P027",
        supplier_product_id="SP_PAGO_P027",
        captain_final_qty_purchase=captain,
        manager_final_qty_purchase=manager,
        manager_final_set=flag,
    )


@pytest.mark.parametrize(
    ("captain", "manager", "flag", "expected_set", "expected_qty"),
    [
        # Manager never touched the line -> the Captain's quantity.
        (5, 0, False, False, 5),
        # Manager zeroed it -> 0, the line is out of the order.
        (5, 0, True, True, 0),
        # Manager set a positive quantity (flag written by save/dispatch).
        (5, 2, True, True, 2),
        # Legacy row: positive manager_final written before migration 0024 —
        # still counts as set even if the backfill had not run.
        (5, 2, False, True, 2),
        # Manager-added skeleton line, nothing typed yet.
        (0, 0, False, False, 0),
        # Manager raised a line the Captain left at 0.
        (0, 3, True, True, 3),
    ],
)
def test_effective_ordered_qty_truth_table(
    captain: float, manager: float, flag: bool, expected_set: bool, expected_qty: float
) -> None:
    line = _line(captain, manager, flag)
    assert is_manager_final_set(line) is expected_set
    assert effective_ordered_qty(line) == expected_qty


def test_order_line_defaults_flag_false() -> None:
    """A row read from a backend without the column (seed CSV, Sheets) or built
    by a Captain writer parses with the flag off."""
    line = OrderLine(
        order_line_id="OL-001",
        order_id="ORD-1",
        product_id="P027",
        supplier_product_id="SP_PAGO_P027",
    )
    assert line.manager_final_set is False
