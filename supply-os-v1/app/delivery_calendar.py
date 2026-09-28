"""Delivery calendar engine (delivery-calendar) — pure, no I/O.

Given a supplier's delivery rule (``supplier_delivery_rules``, migration 0025)
and an instant, compute the next possible delivery date, the one after it, and
the moment by which the Captain must send the order. Every calendar decision is
made in Europe/Warsaw time.

Rule model: ``order_weekdays`` (days an order counts), ``lead_days`` (minimum
calendar days from the order day to the delivery), ``delivery_weekdays``
(allowed delivery days) and ``order_deadline`` ("HH:MM" on the order day).

Algorithm for ``now``:

1. Walk Warsaw calendar days ``d = today .. today+14``. Skip ``d`` unless its
   weekday is an order weekday, and skip it when ``now`` is strictly later than
   ``d`` at the deadline (17:00:00 still counts; 17:00:01 is late).
2. The first surviving ``d`` is the order day. Delivery = the first day
   ``>= d + lead_days`` whose weekday is a delivery weekday.
3. The following delivery repeats 1-2 from the next order day after ``d``
   whose delivery is later than the first delivery.

Deliberately separate from ``main._parse_weekdays`` (free-text supplier
``delivery_days``): rule weekday text is a strict ``Mon..Sun`` comma list.
A later dynamic-target lane can call ``delivery_window`` without touching routes.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable, Optional
from zoneinfo import ZoneInfo

from .models import SupplierDeliveryRule

log = logging.getLogger(__name__)

WARSAW_TZ = ZoneInfo("Europe/Warsaw")
DEFAULT_ORDER_DEADLINE = time(17, 0)
ALL_WEEKDAYS: frozenset[int] = frozenset(range(7))

_WEEKDAY_TOKENS = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}
_SEARCH_DAYS = 14


def now_utc() -> datetime:
    """The only clock the delivery calendar reads (tests patch it)."""
    return datetime.now(timezone.utc)


def parse_rule_weekdays(text: str) -> frozenset[int]:
    """Strict ``Mon,Tue,...`` list → weekday ints (0 = Monday). Raises
    ``ValueError`` on an empty list, spaces, lowercase or an unknown token —
    the same shape the migration's CHECK accepts."""
    if not text:
        raise ValueError("empty weekday list")
    out: set[int] = set()
    for tok in text.split(","):
        if tok not in _WEEKDAY_TOKENS:
            raise ValueError(f"unknown weekday token {tok!r} in {text!r}")
        out.add(_WEEKDAY_TOKENS[tok])
    return frozenset(out)


def parse_deadline(text: str) -> time:
    """``"HH:MM"`` → ``time``; raises ``ValueError`` otherwise."""
    hh, sep, mm = (text or "").partition(":")
    if not sep or len(hh) != 2 or len(mm) != 2:
        raise ValueError(f"bad order_deadline {text!r}")
    return time(int(hh), int(mm))


@dataclass(frozen=True)
class DeliveryWindow:
    """``next_delivery`` is the earliest delivery the Captain can still get;
    ``order_deadline`` (Warsaw-aware) is when that chance closes;
    ``following_delivery`` is the delivery after that (None if none within
    the search horizon). ``source``: "location" | "supplier" | "fallback"."""

    next_delivery: date
    following_delivery: Optional[date]
    order_deadline: datetime
    source: str


def _delivery_for(
    order_day: date, lead_days: int, delivery_weekdays: frozenset[int]
) -> Optional[date]:
    start = order_day + timedelta(days=lead_days)
    for i in range(_SEARCH_DAYS + 1):
        cand = start + timedelta(days=i)
        if cand.weekday() in delivery_weekdays:
            return cand
    return None


def compute_window(
    order_weekdays: frozenset[int],
    lead_days: int,
    delivery_weekdays: frozenset[int],
    order_deadline: time,
    now: datetime,
    source: str,
) -> DeliveryWindow:
    """The algorithm in the module docstring. ``now`` must be timezone-aware.
    Raises ``ValueError`` when no order day within the horizon yields a
    delivery (only possible with empty weekday sets)."""
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    today = now.astimezone(WARSAW_TZ).date()

    first: Optional[tuple[date, datetime, date]] = None
    for i in range(_SEARCH_DAYS + 1):
        d = today + timedelta(days=i)
        if d.weekday() not in order_weekdays:
            continue
        deadline = datetime.combine(d, order_deadline, tzinfo=WARSAW_TZ)
        if now > deadline:
            continue
        delivery = _delivery_for(d, lead_days, delivery_weekdays)
        if delivery is None:
            continue
        first = (d, deadline, delivery)
        break
    if first is None:
        raise ValueError("no order day with a delivery within the search horizon")

    order_day, deadline, delivery = first
    following: Optional[date] = None
    for i in range(1, _SEARCH_DAYS * 2 + 1):
        d = order_day + timedelta(days=i)
        if d.weekday() not in order_weekdays:
            continue
        cand = _delivery_for(d, lead_days, delivery_weekdays)
        if cand is not None and cand > delivery:
            following = cand
            break

    return DeliveryWindow(
        next_delivery=delivery,
        following_delivery=following,
        order_deadline=deadline,
        source=source,
    )


def resolve_rule(
    rules: Iterable[SupplierDeliveryRule], supplier_id: str, location_id: str
) -> tuple[Optional[SupplierDeliveryRule], str]:
    """Active location row, else active shared row, else ``(None, "fallback")``."""
    shared: Optional[SupplierDeliveryRule] = None
    for r in rules:
        if not r.active or r.supplier_id != supplier_id:
            continue
        if r.location_id == location_id:
            return r, "location"
        if r.location_id is None and shared is None:
            shared = r
    if shared is not None:
        return shared, "supplier"
    return None, "fallback"


def _rule_is_valid(rule: SupplierDeliveryRule) -> bool:
    try:
        parse_rule_weekdays(rule.order_weekdays)
        parse_rule_weekdays(rule.delivery_weekdays)
        parse_deadline(rule.order_deadline)
    except ValueError:
        log.warning(
            "delivery rule %s has malformed weekday/deadline text — ignored",
            rule.rule_id,
        )
        return False
    return 0 <= rule.lead_days <= _SEARCH_DAYS


def delivery_window(
    rules: Iterable[SupplierDeliveryRule],
    supplier_id: str,
    location_id: str,
    now: datetime,
    *,
    fallback_lead_days: int = 1,
    fallback_delivery_weekdays: Optional[frozenset[int]] = None,
) -> DeliveryWindow:
    """Resolve the rule for ``supplier_id`` at ``location_id`` and compute its
    window. A malformed rule is logged and treated as absent (a malformed
    location row falls back to the shared row). Without a rule: every day is
    an order day, ``fallback_lead_days``, ``fallback_delivery_weekdays`` (None =
    every day), 17:00 — source "fallback"."""
    valid = [r for r in rules if _rule_is_valid(r)]
    rule, source = resolve_rule(valid, supplier_id, location_id)
    if rule is not None:
        return compute_window(
            parse_rule_weekdays(rule.order_weekdays),
            rule.lead_days,
            parse_rule_weekdays(rule.delivery_weekdays),
            parse_deadline(rule.order_deadline),
            now,
            source,
        )
    return compute_window(
        ALL_WEEKDAYS,
        max(0, min(fallback_lead_days, _SEARCH_DAYS)),
        fallback_delivery_weekdays or ALL_WEEKDAYS,
        DEFAULT_ORDER_DEADLINE,
        now,
        "fallback",
    )


def is_coverage_prompt_day(now: datetime) -> bool:
    """True on a Europe/Warsaw calendar Thursday (the whole day)."""
    return now.astimezone(WARSAW_TZ).weekday() == 3
