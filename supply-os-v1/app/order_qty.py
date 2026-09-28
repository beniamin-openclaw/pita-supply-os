"""The effective ordered quantity of an order line — the one backend rule.

Backend twin of ``frontend/src/lib/orderQty.ts``; keep the two identical.

An order line carries the Captain's final (``captain_final_qty_purchase``) and
the Manager's final (``manager_final_qty_purchase``). The Manager's value wins
once the Manager has set it — but ``manager_final_qty_purchase`` alone cannot
say whether that happened: the column is NOT NULL DEFAULT 0, so a stored 0
means both "not set yet" and "the Manager set it to 0". Until migration 0024
every reader took the first meaning, so a line the Manager zeroed came back at
the Captain's quantity after the next reload and into the supplier e-mail
(order-line-zero-qty). ``OrderLine.manager_final_set`` records the decision.

A positive ``manager_final`` also counts as set: only the Manager writes one,
and rows written before the flag existed (or by a backend without the column,
e.g. the legacy Sheets mode) must keep today's behaviour.

Every effective-quantity reader — dispatch e-mail URL, order totals, receipts,
the Transport aggregate and its finalize guard, the post-send edit log — goes
through these two functions. Do not re-derive the rule inline.
"""
from __future__ import annotations

from .models import OrderLine


def is_manager_final_set(line: OrderLine) -> bool:
    """True when the Manager has committed a quantity for ``line`` (incl. 0)."""
    return line.manager_final_set or line.manager_final_qty_purchase > 0


def effective_ordered_qty(line: OrderLine) -> float:
    """Purchase quantity actually ordered: the Manager's final once set, else
    the Captain's final."""
    if is_manager_final_set(line):
        return line.manager_final_qty_purchase
    return line.captain_final_qty_purchase
