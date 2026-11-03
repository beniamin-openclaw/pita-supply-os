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
    assert "sent:2026-11-03T10:00:00+00:00" in keys and "Draft dla grupy" in ev[0][1]


def test_expected_today_fires_from_digest_hour_and_once():
    # 07:00 UTC = 08:00 Warsaw (CET) = digest hour
    morning = NOW.replace(hour=7)
    o = _order(status="manager_sent", requested_delivery_date="2026-11-03",
               manager_sent_at="2026-11-03T06:00:00+00:00")
    ev = events_for(o, {"status": "captain_submitted", "fired": ["submitted"]}, morning, 24, 3)
    keys = [k for k, _ in ev]
    assert "expected:2026-11-03" in keys
    # BEFORE the digest hour -> no digest (05:00 UTC = 06:00 Warsaw)
    early = NOW.replace(hour=5)
    ev_early = events_for(o, {"status": "captain_submitted", "fired": ["submitted"]}, early, 24, 3)
    assert all(not k.startswith("expected:") for k, _ in ev_early)
    # same day again after the first send -> suppressed by fired key
    prev = {"status": "manager_sent", "fired": ["sent:2026-11-03T06:00:00+00:00",
                                              "expected:2026-11-03"]}
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
                    {"status": "manager_sent", "fired": [f"sent:{old_sent}"]}, NOW, 24, 3)
    assert "stale-sent" in [k for k, _ in ev]
    ev2 = events_for(_order(status="manager_sent", manager_sent_at=old_sent, received_count=1,
                            requested_delivery_date="2026-10-29"),
                     {"status": "manager_sent", "fired": [f"sent:{old_sent}"]}, NOW, 24, 3)
    assert "stale-sent" not in [k for k, _ in ev2]


def test_trn_marker_detection():
    from order_watch import is_transport_draft
    assert is_transport_draft({"order_id": "o1", "status": "manager_claimed",
                             "supplier_order_reference": "TRN-2026-11-01"})
    assert is_transport_draft({"order_id": "TRN-77", "status": "manager_claimed"})
    assert not is_transport_draft({"order_id": "o2", "status": "manager_claimed",
                                  "supplier_order_reference": None})
    # sent transport leaves the claimed lane — must NOT stay excluded (codex review)
    assert not is_transport_draft({"order_id": "o3", "status": "manager_sent",
                                   "supplier_order_reference": "TRN-2026-11-01"})


def test_resend_after_revert_fires_new_sent_key():
    """Order reverted to claimed then sent again must alert again — the sent key
    carries manager_sent_at, so a new send timestamp = new event."""
    prev = {"status": "manager_claimed", "fired": ["sent:2026-11-01T09:00:00+00:00"]}
    o = _order(status="manager_sent", manager_sent_at="2026-11-03T10:00:00+00:00",
               requested_delivery_date="2026-11-04")
    keys = [k for k, _ in events_for(o, prev, NOW, 24, 3)]
    assert "sent:2026-11-03T10:00:00+00:00" in keys


def test_digest_fires_after_window_on_recovery():
    """If the 8:xx run crashed, a later same-day run still sends 'expected today'
    (>= digest hour, not ==)."""
    late = NOW.replace(hour=12)  # 13:00 Warsaw — past digest hour
    o = _order(status="manager_sent", requested_delivery_date="2026-11-03",
               manager_sent_at="2026-11-03T06:00:00+00:00")
    ev = events_for(o, {"status": "captain_submitted", "fired": ["submitted"]}, late, 24, 3)
    assert "expected:2026-11-03" in [k for k, _ in ev]
