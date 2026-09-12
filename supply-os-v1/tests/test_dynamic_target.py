"""Unit tests for the dynamic-target engine (dynamic-target-wola). Pure — every
test pins ``today``; no clock, no I/O."""
from datetime import date

import pytest

from app.dynamic_target import (
    MAX_REQUESTED_AHEAD_DAYS,
    SAFETY_CAP_DAYS,
    ceil_unit,
    compute_dynamic_target,
    next_delivery_date,
    parse_delivery_weekdays,
    resolve_delivery_window,
    resolve_effective_target,
)
from app.models import LocationProductSetting, LocationProductUsage, Supplier

MON = date(2026, 9, 7)  # Monday


def _setting(target=10.0, max_=10.0, min_=2.0) -> LocationProductSetting:
    return LocationProductSetting(
        setting_id="WOLA__P024", location_id="WOLA", product_id="P024",
        min_stock_qty_base=min_, max_stock_qty_base=max_, target_stock_qty_base=target,
    )


def _usage(rate=12.75, conf="A", active=True, safety_days=1.0) -> LocationProductUsage:
    return LocationProductUsage(
        usage_id="WOLA__P024", location_id="WOLA", product_id="P024",
        usage_per_day_base=rate, confidence=conf, active=active, safety_days=safety_days,
    )


def _supplier(days="Tue, Sat") -> Supplier:
    return Supplier(supplier_id="SUP_PAGO", supplier_name="Pago", delivery_days=days)


# ---------- calendar parsing (parity with the frontend weekday branch) ----------

@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Tue", [1]),
        ("Tue, Sat", [1, 5]),
        ("mon;wed;fri", [0, 2, 4]),
        ("wt, sob", [1, 5]),
        ("Thursday", [3]),
        ("daily", [0, 1, 2, 3, 4, 5, 6]),
        ("codziennie", [0, 1, 2, 3, 4, 5, 6]),
        ("TBD", None),
        ("", None),
        (None, None),
        ("3", None),  # numeric "every N days" is a frontend-only convention
        ("Tue, Blursday", None),  # any unknown token bails out entirely
    ],
)
def test_parse_delivery_weekdays(raw, expected):
    assert parse_delivery_weekdays(raw) == expected


def test_next_delivery_date_offsets_from_one_never_today():
    assert next_delivery_date([1, 5], MON) == date(2026, 9, 8)  # Tue
    assert next_delivery_date([1, 5], date(2026, 9, 8)) == date(2026, 9, 12)  # Sat
    # A Monday-only calendar asked on Monday → next Monday, not today.
    assert next_delivery_date([0], MON) == date(2026, 9, 14)
    assert next_delivery_date([], MON) is None


# ---------- rounding ----------

def test_ceil_unit_kg_tenth_and_pieces_whole():
    assert ceil_unit(76.5, "kg") == 76.5
    assert ceil_unit(76.51, "kg") == 76.6
    assert ceil_unit(12.75, "kg") == 12.8
    assert ceil_unit(101.01, "szt") == 102.0
    assert ceil_unit(57.0, "opak") == 57.0
    assert ceil_unit(0.0, "szt") == 0.0
    with pytest.raises(ValueError):
        ceil_unit(float("nan"), "kg")


# ---------- the two worked examples from the plan ----------

def test_worked_example_wola_gyros_monday():
    """12.75 kg/day, min 2, Mon → Tue (1 d) → Sat (4 d): safety 12.8, target 76.6."""
    calc = compute_dynamic_target(
        usage_per_day=12.75, safety_days=1.0, min_stock=2.0, inventory_unit="kg",
        today=MON, delivery_date=date(2026, 9, 8), next_delivery=date(2026, 9, 12),
    )
    assert (calc.days_until_delivery, calc.horizon_days) == (1, 4)
    assert calc.safety_base == 12.8
    assert calc.target_base == 76.6


def test_worked_example_wola_cola_zero_thursday():
    """7.77/day, min 24, Mon → Thu (3 d) → Thu (7 d): safety = min capped at 3 days
    of usage = 23.31 → 24; target = ceil(77.7 + 24) = 102."""
    calc = compute_dynamic_target(
        usage_per_day=7.77, safety_days=1.0, min_stock=24.0, inventory_unit="szt",
        today=MON, delivery_date=date(2026, 9, 10), next_delivery=date(2026, 9, 17),
    )
    assert (calc.days_until_delivery, calc.horizon_days) == (3, 7)
    assert calc.safety_base == 24.0
    assert calc.target_base == 102.0


def test_safety_cap_limits_a_stale_min():
    """Cappy: 0.33/day with an unverified min of 12 → the min contributes at most
    SAFETY_CAP_DAYS of usage (0.99 → 1 szt), not 12."""
    calc = compute_dynamic_target(
        usage_per_day=0.33, safety_days=1.0, min_stock=12.0, inventory_unit="szt",
        today=MON, delivery_date=date(2026, 9, 10), next_delivery=date(2026, 9, 17),
    )
    assert SAFETY_CAP_DAYS == 3.0
    assert calc.safety_base == 1.0
    assert calc.target_base == 5.0  # ceil(3.3 + 1)


def test_safety_floor_from_min_when_below_cap():
    """min 2 kg, usage 1 kg/day, safety_days 1 → min (2) wins over usage×1 (1)
    because it is under the 3-day cap."""
    calc = compute_dynamic_target(
        usage_per_day=1.0, safety_days=1.0, min_stock=2.0, inventory_unit="kg",
        today=MON, delivery_date=date(2026, 9, 8), next_delivery=date(2026, 9, 12),
    )
    assert calc.safety_base == 2.0
    assert calc.target_base == 7.0


@pytest.mark.parametrize("bad", [-1.0, float("nan"), float("inf")])
def test_compute_rejects_bad_inputs(bad):
    with pytest.raises(ValueError):
        compute_dynamic_target(
            usage_per_day=bad, safety_days=1.0, min_stock=0.0, inventory_unit="kg",
            today=MON, delivery_date=date(2026, 9, 8), next_delivery=date(2026, 9, 12),
        )


def test_compute_rejects_inverted_window():
    with pytest.raises(ValueError):
        compute_dynamic_target(
            usage_per_day=1.0, safety_days=1.0, min_stock=0.0, inventory_unit="kg",
            today=MON, delivery_date=date(2026, 9, 6), next_delivery=date(2026, 9, 12),
        )


# ---------- delivery window (H5: the client date is validated, never trusted) ----------

def test_window_honours_a_valid_requested_date():
    assert resolve_delivery_window([1, 5], MON, date(2026, 9, 12)) == (
        date(2026, 9, 12), date(2026, 9, 15),
    )


@pytest.mark.parametrize(
    "requested",
    [
        None,
        date(2026, 9, 6),  # yesterday (stale tab)
        date(2026, 9, 9),  # Wednesday — not a delivery weekday
        MON + __import__("datetime").timedelta(days=MAX_REQUESTED_AHEAD_DAYS + 1),  # too far out
    ],
)
def test_window_falls_back_to_server_calendar(requested):
    assert resolve_delivery_window([1, 5], MON, requested) == (
        date(2026, 9, 8), date(2026, 9, 12),
    )


def test_window_rejects_today_even_on_a_delivery_day():
    """Tuesday, requested Tuesday (today): the orderable screen computed its
    target from the NEXT delivery (Sat), so accepting "today" here would shrink
    the horizon below what the Captain saw and 400 an accepted suggestion
    (adversarial finding #2). Strictly after today, like next_delivery_date."""
    tue = date(2026, 9, 8)
    assert resolve_delivery_window([1, 5], tue, tue) == (date(2026, 9, 12), date(2026, 9, 15))


# ---------- resolve_effective_target: dynamic + every static reason ----------

def test_resolve_dynamic_pago_gyros_raises_max():
    target, eff_max, src = resolve_effective_target(
        _setting(target=10, max_=10, min_=2), _usage(), _supplier(), "kg", MON, None, True
    )
    assert target == 76.6
    assert eff_max == 76.6
    assert src.mode == "dynamic"
    assert src.max_raised_from == 10.0
    assert (src.delivery_date, src.next_delivery_date) == (date(2026, 9, 8), date(2026, 9, 12))
    assert (src.days_until_delivery, src.horizon_days) == (1, 4)
    assert src.safety_base == 12.8
    assert src.confidence == "A"
    assert src.static_target_base == 10.0


def test_resolve_dynamic_keeps_max_when_target_below_it():
    target, eff_max, src = resolve_effective_target(
        _setting(target=120, max_=120, min_=24), _usage(rate=7.77), _supplier("Thu"), "szt",
        MON, None, True,
    )
    assert target == 102.0
    assert eff_max == 120.0
    assert src.max_raised_from is None


def test_resolve_uses_requested_date_inside_window():
    _, _, src = resolve_effective_target(
        _setting(), _usage(), _supplier(), "kg", MON, date(2026, 9, 12), True
    )
    assert src.delivery_date == date(2026, 9, 12)
    assert src.days_until_delivery == 5
    assert src.horizon_days == 3


@pytest.mark.parametrize(
    "kwargs, reason",
    [
        (dict(enabled=False), "disabled"),
        (dict(usage=None), "no_usage"),
        (dict(usage=_usage(active=False)), "inactive"),
        (dict(usage=_usage(conf="C")), "confidence_c"),
        (dict(usage=_usage(rate=0.0)), "zero_usage"),
        (dict(supplier=_supplier("TBD")), "no_calendar"),
        (dict(supplier=_supplier("3")), "no_calendar"),
        (dict(supplier=None), "no_calendar"),
    ],
)
def test_resolve_static_reasons(kwargs, reason):
    params = dict(
        setting=_setting(target=10, max_=10), usage=_usage(), supplier=_supplier(),
        inventory_unit="kg", today=MON, requested_delivery_date=None, enabled=True,
    )
    params.update(kwargs)
    target, eff_max, src = resolve_effective_target(**params)
    assert (target, eff_max) == (10.0, 10.0)
    assert src.mode == "static"
    assert src.reason == reason
    assert src.static_target_base == 10.0


def test_resolve_confidence_is_case_insensitive():
    _, _, src = resolve_effective_target(
        _setting(), _usage(conf=" b "), _supplier(), "kg", MON, None, True
    )
    assert src.mode == "dynamic" and src.confidence == "B"


def test_resolve_daily_calendar_gives_one_day_horizon():
    target, _, src = resolve_effective_target(
        _setting(min_=0), _usage(rate=1.0), _supplier("daily"), "kg", MON, None, True
    )
    assert (src.days_until_delivery, src.horizon_days) == (1, 1)
    assert target == 3.0  # 1×2 + safety 1
