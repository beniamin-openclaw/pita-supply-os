"""Tests for scripts/order_watch.py — event logic and state idempotency."""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from order_watch import events_for  # noqa: E402

NOW = datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)


def _order(**kw):
    base = {
        "order_id": "o1",
        "location_name": "Wola",
        "supplier_name": "Bukat",
        "status": "captain_submitted",
        "line_count": 5,
        "requested_delivery_date": "2026-11-05",
        "captain_user": "tushar",
        "ordered_by": None,
    }
    base.update(kw)
    return base


def test_new_submit_fires_once():
    ev = events_for(_order(), None, NOW, 24, 3)
    assert [k for k, _ in ev] == ["submitted"]
    assert "Wola" in ev[0][1] and "Bukat" in ev[0][1]
    # second scan with fired key -> nothing
    prev = {"status": "captain_submitted", "fired": ["submitted"]}
    assert events_for(_order(), prev, NOW, 24, 3) == []


def test_sent_transition_fires():
    prev = {"status": "captain_submitted", "fired": ["submitted"]}
    ev = events_for(_order(status="manager_sent", manager_sent_at="2026-11-03T10:00:00+00:00"),
                    prev, NOW, 24, 3)
    keys = [k for k, _ in ev]
    assert "sent" in keys and "Draft dla grupy" in ev[0][1]


def test_expected_today_fires_only_in_digest_hour_and_once():
    # 07:00 UTC = 08:00 Warsaw (CET) = digest hour
    morning = NOW.replace(hour=7)
    o = _order(status="manager_sent", requested_delivery_date="2026-11-03",
               manager_sent_at="2026-11-03T06:00:00+00:00")
    ev = events_for(o, {"status": "captain_submitted", "fired": ["submitted"]}, morning, 24, 3)
    keys = [k for k, _ in ev]
    assert "expected:2026-11-03" in keys
    # 13:00 Warsaw — outside the digest hour -> no digest repeat
    ev_late = events_for(o, {"status": "captain_submitted", "fired": ["submitted"]}, NOW, 24, 3)
    assert all(not k.startswith("expected:") for k, _ in ev_late)
    # same day again in the digest hour -> suppressed by fired key
    prev = {"status": "manager_sent", "fired": ["sent", "expected:2026-11-03"]}
    assert all(not k.startswith("expected:") for k, _ in events_for(o, prev, morning, 24, 3))


def test_stale_claimed_reports_age_without_person_blame():
    old = (NOW - timedelta(hours=30)).isoformat()
    ev = events_for(_order(status="manager_claimed", captain_submitted_at=old,
                           ordered_by="marek"),
                    {"status": "captain_submitted", "fired": ["submitted"]}, NOW, 24, 3)
    keys = [k for k, _ in ev]
    assert "stale-claimed" in keys
    text = dict(ev)["stale-claimed"]
    assert "30h" in text and "marek" not in text


def test_fresh_claimed_no_alert():
    recent = (NOW - timedelta(hours=5)).isoformat()
    ev = events_for(_order(status="manager_claimed", captain_submitted_at=recent),
                    {"status": "captain_submitted", "fired": ["submitted"]}, NOW, 24, 3)
    assert "stale-claimed" not in [k for k, _ in ev]


def test_stale_sent_requires_no_receipt():
    old_sent = (NOW - timedelta(days=5)).isoformat()
    ev = events_for(_order(status="manager_sent", manager_sent_at=old_sent, received_count=0,
                           requested_delivery_date="2026-10-29"),
                    {"status": "manager_sent", "fired": ["sent"]}, NOW, 24, 3)
    assert "stale-sent" in [k for k, _ in ev]
    ev2 = events_for(_order(status="manager_sent", manager_sent_at=old_sent, received_count=1,
                            requested_delivery_date="2026-10-29"),
                     {"status": "manager_sent", "fired": ["sent"]}, NOW, 24, 3)
    assert "stale-sent" not in [k for k, _ in ev2]


def test_trn_marker_detection():
    from order_watch import is_transport_draft
    assert is_transport_draft({"order_id": "o1", "supplier_order_reference": "TRN-2026-11-01"})
    assert is_transport_draft({"order_id": "TRN-77"})
    assert not is_transport_draft({"order_id": "o2", "supplier_order_reference": None})
