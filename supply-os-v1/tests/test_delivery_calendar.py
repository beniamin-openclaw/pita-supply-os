"""Delivery calendar engine (delivery-calendar, Phase 2) — pure functions.

Calendar used below (2026): Mon 28.09, Tue 29.09, Wed 30.09, Thu 01.10,
Fri 02.10, Sat 03.10, Sun 04.10, Mon 05.10, Wed 07.10. DST ends Sun 25.10.2026
(CEST = UTC+2 before, CET = UTC+1 after).
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import pytest

from app import delivery_calendar as dc
from app.models import SupplierDeliveryRule

WAW = ZoneInfo("Europe/Warsaw")
EVERY_DAY = "Mon,Tue,Wed,Thu,Fri,Sat,Sun"


def _waw(y: int, m: int, d: int, hh: int, mm: int = 0, ss: int = 0) -> datetime:
    return datetime(y, m, d, hh, mm, ss, tzinfo=WAW)


def _rule(
    rule_id: str,
    supplier_id: str,
    location_id: str | None,
    order_weekdays: str,
    lead_days: int,
    delivery_weekdays: str,
    **kw,
) -> SupplierDeliveryRule:
    return SupplierDeliveryRule(
        rule_id=rule_id, supplier_id=supplier_id, location_id=location_id,
        order_weekdays=order_weekdays, lead_days=lead_days,
        delivery_weekdays=delivery_weekdays, **kw,
    )


RULES = [
    _rule("DR-PAGO-WOLA", "SUP_PAGO", "WOLA", "Mon", 2, "Wed"),
    _rule("DR-PAGO-NORBLIN", "SUP_PAGO", "NORBLIN", "Sun,Thu", 2, "Tue,Sat"),
    _rule("DR-BUKAT-ALL", "SUP_BUKAT", None, EVERY_DAY, 1, "Mon,Tue,Wed,Thu,Fri,Sat"),
    _rule("DR-COLA-WESTFIELD", "SUP_COCACOLA", "WESTFIELD", EVERY_DAY, 2, "Mon,Tue,Thu,Fri"),
    _rule("DR-FILBER-ALL", "SUP_FILBER", None, "Wed", 1, "Thu"),
]


def _win(supplier_id: str, location_id: str, now: datetime, rules=RULES) -> dc.DeliveryWindow:
    return dc.delivery_window(rules, supplier_id, location_id, now)


# ---------- weekday parsing ----------

def test_parse_rule_weekdays_strict():
    assert dc.parse_rule_weekdays("Mon") == frozenset({0})
    assert dc.parse_rule_weekdays("Sun,Thu") == frozenset({6, 3})
    for bad in ["", "Mon, Tue", "mon", "Pon", "Mon,,Tue"]:
        with pytest.raises(ValueError):
            dc.parse_rule_weekdays(bad)


# ---------- Pago: WOLA Mon -> Wed ----------

def test_wola_pago_monday_before_deadline_same_week():
    w = _win("SUP_PAGO", "WOLA", _waw(2026, 9, 28, 16, 59))
    assert w.next_delivery == date(2026, 9, 30)
    assert w.order_deadline == _waw(2026, 9, 28, 17, 0)
    assert w.source == "location"


def test_wola_pago_monday_after_deadline_next_week():
    w = _win("SUP_PAGO", "WOLA", _waw(2026, 9, 28, 17, 1))
    assert w.next_delivery == date(2026, 10, 7)
    assert w.order_deadline == _waw(2026, 10, 5, 17, 0)


def test_wola_pago_tuesday_next_week_and_following_plus_7():
    w = _win("SUP_PAGO", "WOLA", _waw(2026, 9, 29, 10, 0))
    assert w.next_delivery == date(2026, 10, 7)
    assert w.following_delivery == date(2026, 10, 14)


def test_deadline_boundary_is_strict():
    on_time = _win("SUP_PAGO", "WOLA", _waw(2026, 9, 28, 17, 0, 0))
    late = _win("SUP_PAGO", "WOLA", _waw(2026, 9, 28, 17, 0, 1))
    assert on_time.next_delivery == date(2026, 9, 30)
    assert late.next_delivery == date(2026, 10, 7)


# ---------- Pago: NORBLIN Sun -> Tue, Thu -> Sat ----------

def test_norblin_pago_sunday_to_tuesday():
    w = _win("SUP_PAGO", "NORBLIN", _waw(2026, 10, 4, 12, 0))
    assert w.next_delivery == date(2026, 10, 6)
    assert w.following_delivery == date(2026, 10, 10)


def test_norblin_pago_thursday_to_saturday():
    w = _win("SUP_PAGO", "NORBLIN", _waw(2026, 10, 1, 12, 0))
    assert w.next_delivery == date(2026, 10, 3)
    assert w.order_deadline == _waw(2026, 10, 1, 17, 0)


def test_norblin_pago_friday_waits_for_sunday_order():
    w = _win("SUP_PAGO", "NORBLIN", _waw(2026, 10, 2, 9, 0))
    assert w.next_delivery == date(2026, 10, 6)
    assert w.order_deadline == _waw(2026, 10, 4, 17, 0)


# ---------- Bukat: every day, next day, no Sunday deliveries ----------

def test_bukat_friday_afternoon_saturday():
    w = _win("SUP_BUKAT", "KEN", _waw(2026, 10, 2, 16, 0))
    assert w.next_delivery == date(2026, 10, 3)
    assert w.source == "supplier"
    assert w.following_delivery == date(2026, 10, 5)


def test_bukat_friday_evening_monday():
    w = _win("SUP_BUKAT", "KEN", _waw(2026, 10, 2, 18, 0))
    assert w.next_delivery == date(2026, 10, 5)
    assert w.order_deadline == _waw(2026, 10, 3, 17, 0)


def test_bukat_saturday_morning_monday():
    w = _win("SUP_BUKAT", "WOLA", _waw(2026, 10, 3, 10, 0))
    assert w.next_delivery == date(2026, 10, 5)


# ---------- Coca-Cola WESTFIELD: 2 days, Mon/Tue/Thu/Fri ----------

def test_cocacola_westfield_saturday_monday():
    w = _win("SUP_COCACOLA", "WESTFIELD", _waw(2026, 10, 3, 10, 0))
    assert w.next_delivery == date(2026, 10, 5)


def test_cocacola_westfield_wednesday_evening_monday():
    w = _win("SUP_COCACOLA", "WESTFIELD", _waw(2026, 9, 30, 18, 0))
    assert w.next_delivery == date(2026, 10, 5)


def test_cocacola_other_location_falls_back():
    w = _win("SUP_COCACOLA", "WOLA", _waw(2026, 9, 30, 10, 0))
    assert w.source == "fallback"
    assert w.next_delivery == date(2026, 10, 1)


# ---------- Filber Wed -> Thu ----------

def test_filber_tuesday_thursday():
    w = _win("SUP_FILBER", "WOLA", _waw(2026, 9, 29, 10, 0))
    assert w.next_delivery == date(2026, 10, 1)
    assert w.order_deadline == _waw(2026, 9, 30, 17, 0)


# ---------- DST (Sun 25.10.2026) ----------

def test_dst_week_keeps_17_warsaw_deadline():
    before = _win("SUP_BUKAT", "WOLA", _waw(2026, 10, 24, 12, 0))  # Sat, CEST
    assert before.order_deadline.astimezone(timezone.utc) == datetime(
        2026, 10, 24, 15, 0, tzinfo=timezone.utc
    )
    after = _win("SUP_PAGO", "NORBLIN", _waw(2026, 10, 25, 16, 59))  # Sun, CET
    assert after.next_delivery == date(2026, 10, 27)
    assert after.order_deadline.astimezone(timezone.utc) == datetime(
        2026, 10, 25, 16, 0, tzinfo=timezone.utc
    )


def test_utc_now_is_read_in_warsaw_time():
    # 22:30 UTC on Wed 30.09 is already Thu 01.10 00:30 in Warsaw.
    w = _win("SUP_FILBER", "WOLA", datetime(2026, 9, 30, 22, 30, tzinfo=timezone.utc))
    assert w.next_delivery == date(2026, 10, 8)


# ---------- rule resolution ----------

def test_location_rule_beats_shared_rule():
    rules = [
        _rule("DR-X-ALL", "SUP_X", None, EVERY_DAY, 1, EVERY_DAY),
        _rule("DR-X-KEN", "SUP_X", "KEN", "Mon", 2, "Wed"),
    ]
    assert _win("SUP_X", "KEN", _waw(2026, 9, 28, 10), rules).source == "location"
    assert _win("SUP_X", "KEN", _waw(2026, 9, 28, 10), rules).next_delivery == date(2026, 9, 30)
    assert _win("SUP_X", "WOLA", _waw(2026, 9, 28, 10), rules).source == "supplier"


def test_inactive_rule_ignored():
    rules = [_rule("DR-X-KEN", "SUP_X", "KEN", "Mon", 2, "Wed", active=False)]
    assert _win("SUP_X", "KEN", _waw(2026, 9, 28, 10), rules).source == "fallback"


def test_malformed_rule_falls_back_to_shared_then_fallback():
    rules = [
        _rule("DR-X-KEN", "SUP_X", "KEN", "Mon, Tue", 2, "Wed"),
        _rule("DR-X-ALL", "SUP_X", None, "Mon", 1, "Tue"),
    ]
    assert _win("SUP_X", "KEN", _waw(2026, 9, 28, 10), rules).source == "supplier"
    bad_only = [_rule("DR-X-KEN", "SUP_X", "KEN", "Mon", 2, "Wed", order_deadline="5pm")]
    assert _win("SUP_X", "KEN", _waw(2026, 9, 28, 10), bad_only).source == "fallback"


def test_fallback_parameters():
    now = _waw(2026, 9, 28, 10)  # Monday
    w = dc.delivery_window([], "SUP_X", "WOLA", now)
    assert (w.next_delivery, w.source) == (date(2026, 9, 29), "fallback")
    w = dc.delivery_window([], "SUP_X", "WOLA", now, fallback_lead_days=3)
    assert w.next_delivery == date(2026, 10, 1)
    w = dc.delivery_window(
        [], "SUP_X", "WOLA", now, fallback_delivery_weekdays=frozenset({1})
    )
    assert w.next_delivery == date(2026, 9, 29)
    after = dc.delivery_window([], "SUP_X", "WOLA", _waw(2026, 9, 28, 18))
    assert after.next_delivery == date(2026, 9, 30)


def test_naive_now_rejected():
    with pytest.raises(ValueError):
        dc.compute_window(
            frozenset({0}), 1, frozenset({1}), dc.DEFAULT_ORDER_DEADLINE,
            datetime(2026, 9, 28, 10), "fallback",
        )


# ---------- Thursday prompt ----------

def test_coverage_prompt_day_is_warsaw_thursday():
    assert dc.is_coverage_prompt_day(_waw(2026, 10, 1, 23, 30)) is True
    assert dc.is_coverage_prompt_day(_waw(2026, 10, 2, 0, 30)) is False
    assert dc.is_coverage_prompt_day(_waw(2026, 10, 1, 0, 0)) is True
    # 22:30 UTC Wed = 00:30 Thu Warsaw.
    assert dc.is_coverage_prompt_day(datetime(2026, 9, 30, 22, 30, tzinfo=timezone.utc))
