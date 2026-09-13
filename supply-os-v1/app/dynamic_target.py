"""Dynamic target engine (dynamic-target-wola).

Pure computation — no I/O, no clock. The route passes ``today`` (Warsaw date) in,
so every result is reproducible and every test can pin the calendar.

    days_until_delivery = delivery_date - today          (delivery_date >= today)
    horizon_days        = next_delivery_date - delivery_date
    safety_base         = ceil_unit(max(usage * safety_days,
                                        min(min_stock, usage * SAFETY_CAP_DAYS)))
    target_dynamic      = ceil_unit(usage * (days_until_delivery + horizon_days) + safety_base)
    effective_max       = max(max_stock_qty_base, target_dynamic)

The existing suggestion engine (``app/suggestion.py``) then receives
``target_dynamic`` exactly as it receives the static target today — the formula,
rounding rules and reason gates are untouched. ``ceil_unit`` rounds the BASE-unit
target only (0.1 for kg, whole units otherwise); the purchase-unit suggestion still
goes through ``_round_per_rule``.

Every fallback to the static target is named in ``TargetSource.reason`` so the
Captain's card, the logs and the tests can tell "not enabled" from "no usage row"
from "supplier has no calendar".
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from .models import LocationProductSetting, LocationProductUsage, Supplier, TargetSource

# Weekday tokens accepted in supplier.delivery_days. English + Polish abbrev.
# Lookup is case-insensitive; values are Python weekday ints (0 = Monday).
# NOT supported: a bare number ("3" = every 3 days), which the frontend's
# getRequestedDeliveryDate does accept — the engine treats it as "no calendar"
# and keeps the static target (documented in the plan, tested below).
WEEKDAY_MAP: dict[str, int] = {
    "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
    "pon": 0, "wt": 1, "śr": 2, "sr": 2, "czw": 3, "pt": 4, "sob": 5, "nd": 6, "niedz": 6,
}

# A stale ``min_stock_qty_base`` may add at most this many days of usage to the
# safety stock. The Wola beverage rows carry never-verified "ESTIM" mins of 12–24
# szt (2–7 weeks of usage); without the cap they would dominate the target.
SAFETY_CAP_DAYS = 3.0

# A client-supplied requested_delivery_date is trusted only inside this window
# (mirrors the frontend's own 1..14-day search); anything else falls back to the
# server's next delivery date.
MAX_REQUESTED_AHEAD_DAYS = 14

TRUSTED_CONFIDENCE = frozenset({"A", "B"})


def parse_delivery_weekdays(raw: Optional[str]) -> Optional[list[int]]:
    """Parse supplier.delivery_days into a sorted list of weekday ints (0=Mon).

    Accepts 'Tue', 'Mon, Wed, Fri', 'daily', 'codziennie'. Returns None when
    unparseable (any unknown token bails out — a partially-correct calendar is
    worse than none).
    """
    if not raw:
        return None
    s = raw.strip().lower()
    if not s:
        return None
    if s in {"daily", "codziennie", "everyday", "every day"}:
        return [0, 1, 2, 3, 4, 5, 6]

    tokens = [t.strip() for t in s.replace(";", ",").split(",") if t.strip()]
    if not tokens:
        return None
    out: set[int] = set()
    for tok in tokens:
        # Try direct lookup, then short prefix (e.g. "tuesday" -> "tue").
        if tok in WEEKDAY_MAP:
            out.add(WEEKDAY_MAP[tok])
            continue
        if tok[:3] in WEEKDAY_MAP:
            out.add(WEEKDAY_MAP[tok[:3]])
            continue
        if tok[:2] in WEEKDAY_MAP:
            out.add(WEEKDAY_MAP[tok[:2]])
            continue
        return None
    return sorted(out)


def next_delivery_date(weekdays: list[int], after: date) -> Optional[date]:
    """First date strictly after ``after`` (offset 1..14) whose weekday is in
    ``weekdays`` — the same rule the frontend uses for requested_delivery_date."""
    if not weekdays:
        return None
    for offset in range(1, 15):
        cand = after + timedelta(days=offset)
        if cand.weekday() in weekdays:
            return cand
    return None


def ceil_unit(value: float, inventory_unit: str) -> float:
    """Round a BASE-unit quantity up to the unit's natural grid: 0.1 for kg,
    a whole unit otherwise. Pre-rounds to 6 decimals so 76.5 * 10 does not ceil
    to 766 from an IEEE artifact. Raises ValueError on NaN / inf."""
    if math.isnan(value) or math.isinf(value):
        raise ValueError(f"ceil_unit: value must be finite, got {value}")
    if (inventory_unit or "").strip().lower() == "kg":
        return math.ceil(round(value * 10, 6)) / 10
    return float(math.ceil(round(value, 6)))


def resolve_delivery_window(
    weekdays: list[int], today: date, requested: Optional[date]
) -> tuple[Optional[date], Optional[date]]:
    """(delivery_date, next_delivery_date) for the horizon math.

    ``requested`` (the client's requested_delivery_date) is honoured only when it
    is STRICTLY after today (the same exclusive rule ``next_delivery_date`` uses,
    so a client cannot pick "today" and shrink the horizon below what the
    orderable screen computed), not more than MAX_REQUESTED_AHEAD_DAYS out, and
    falls on a delivery weekday; otherwise the server's own next delivery date is
    used. A stale tab across midnight therefore gets today's calendar, never a
    yesterday-anchored horizon.
    """
    delivery: Optional[date] = None
    if (
        requested is not None
        and today < requested <= today + timedelta(days=MAX_REQUESTED_AHEAD_DAYS)
        and requested.weekday() in weekdays
    ):
        delivery = requested
    else:
        delivery = next_delivery_date(weekdays, today)
    if delivery is None:
        return None, None
    return delivery, next_delivery_date(weekdays, delivery)


@dataclass(frozen=True)
class DynamicTargetMath:
    days_until_delivery: int
    horizon_days: int
    safety_base: float
    target_base: float


def compute_dynamic_target(
    usage_per_day: float,
    safety_days: float,
    min_stock: float,
    inventory_unit: str,
    today: date,
    delivery_date: date,
    next_delivery: date,
) -> DynamicTargetMath:
    """The formula from the module docstring. Two ceil_unit passes: the safety
    stock first (so the card shows it on the unit grid), then the total over the
    rounded safety. Worked example pinned in tests: Wola gyros, 12.75 kg/day,
    min 2, Mon -> Tue -> Sat = 1 + 4 days => safety 12.8, target 76.6 kg."""
    for name, value in (
        ("usage_per_day", usage_per_day),
        ("safety_days", safety_days),
        ("min_stock", min_stock),
    ):
        if math.isnan(value) or math.isinf(value) or value < 0:
            raise ValueError(f"{name} must be finite and >= 0, got {value}")
    days_until = (delivery_date - today).days
    horizon = (next_delivery - delivery_date).days
    if days_until < 0 or horizon <= 0:
        raise ValueError(
            f"invalid delivery window: today={today} delivery={delivery_date} "
            f"next={next_delivery}"
        )
    safety_raw = max(usage_per_day * safety_days, min(min_stock, usage_per_day * SAFETY_CAP_DAYS))
    safety = ceil_unit(safety_raw, inventory_unit)
    target = ceil_unit(usage_per_day * (days_until + horizon) + safety, inventory_unit)
    return DynamicTargetMath(
        days_until_delivery=days_until,
        horizon_days=horizon,
        safety_base=safety,
        target_base=target,
    )


def resolve_effective_target(
    setting: LocationProductSetting,
    usage: Optional[LocationProductUsage],
    supplier: Optional[Supplier],
    inventory_unit: str,
    today: date,
    requested_delivery_date: Optional[date],
    enabled: bool,
) -> tuple[float, float, TargetSource]:
    """(effective_target, effective_max, source).

    Static target (with a named reason) unless ALL of: enabled, an active usage
    row with confidence A/B and usage > 0, a parseable weekday calendar on the
    supplier, and a valid delivery window. Never raises: a bad input degrades to
    the static target with reason="invalid_input".
    """
    static_target = float(setting.target_stock_qty_base)
    static_max = float(setting.max_stock_qty_base)

    def static(reason: str) -> tuple[float, float, TargetSource]:
        return (
            static_target,
            static_max,
            TargetSource(mode="static", static_target_base=static_target, reason=reason),
        )

    if not enabled:
        return static("disabled")
    if usage is None:
        return static("no_usage")
    if not usage.active:
        return static("inactive")
    if (usage.confidence or "").strip().upper() not in TRUSTED_CONFIDENCE:
        return static("confidence_c")
    rate = float(usage.usage_per_day_base)
    if math.isnan(rate) or math.isinf(rate) or rate <= 0:
        return static("zero_usage")
    weekdays = parse_delivery_weekdays(supplier.delivery_days) if supplier is not None else None
    if not weekdays:
        return static("no_calendar")
    delivery, nxt = resolve_delivery_window(weekdays, today, requested_delivery_date)
    if delivery is None or nxt is None:
        return static("no_calendar")
    try:
        calc = compute_dynamic_target(
            usage_per_day=rate,
            safety_days=float(usage.safety_days),
            min_stock=max(0.0, float(setting.min_stock_qty_base)),
            inventory_unit=inventory_unit,
            today=today,
            delivery_date=delivery,
            next_delivery=nxt,
        )
    except (ValueError, OverflowError):
        return static("invalid_input")
    if math.isnan(calc.target_base) or math.isinf(calc.target_base) or calc.target_base < 0:
        return static("invalid_input")

    effective_max = max(static_max, calc.target_base)
    return (
        calc.target_base,
        effective_max,
        TargetSource(
            mode="dynamic",
            static_target_base=static_target,
            usage_per_day_base=rate,
            confidence=(usage.confidence or "").strip().upper(),
            delivery_date=delivery,
            next_delivery_date=nxt,
            days_until_delivery=calc.days_until_delivery,
            horizon_days=calc.horizon_days,
            safety_days=float(usage.safety_days),
            safety_base=calc.safety_base,
            max_raised_from=static_max if calc.target_base > static_max else None,
            reason="",
        ),
    )
