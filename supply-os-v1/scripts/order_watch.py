#!/usr/bin/env python3
"""Order status watchdog — polls /api/manager/queue and notifies on state events.

External watcher (no backend changes, no new deps). Events:
  - order submitted        -> notify Ben
  - order sent             -> notify Ben + group-draft for the location
  - delivery expected today-> morning digest (once per day per order)
  - claimed stale >24h     -> escalate (manager did not mark sent)
  - sent stale >3d         -> escalate (delivery not confirmed by captain)

Telegram degrades to log-only when WATCH_TELEGRAM_BOT_TOKEN/_CHAT_ID unset.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

WARSAW = ZoneInfo("Europe/Warsaw")
ACTIVE = {"captain_submitted", "manager_claimed", "manager_sent"}


def is_transport_draft(order: dict) -> bool:
    """Transport drafts intentionally wait in manager_claimed; the TRN- marker
    lives in supplier_order_reference. Once the transport is SENT the order
    leaves the claimed lane and SHOULD alert normally — exclude only while
    still claimed."""
    if order.get("status") != "manager_claimed":
        return False
    ref = str(order.get("supplier_order_reference") or "")
    return ref.startswith("TRN-") or str(order.get("order_id", "")).startswith("TRN-")


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def _get_queue(api_url: str, token: str) -> list[dict]:
    """Fetch all three active lanes — the endpoint serves ONE status per call
    (default captain_submitted, limit clamped to 200, no offset). A lane at the
    200 cap may hide older rows; the caller logs that as a truncation warning.
    Transport draft orders (TRN-*) intentionally wait in manager_claimed and
    are excluded by the caller."""
    out: list[dict] = []
    for lane in ACTIVE:
        req = urllib.request.Request(
            f"{api_url.rstrip('/')}/api/manager/queue?status={lane}&limit=200",
            headers={"Authorization": f"Bearer {token}"} if token else {},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310 (operator URL)
            rows = json.loads(resp.read().decode())
        if len(rows) >= 200:
            print(f"[watch] WARN lane {lane} at 200-row cap — oldest orders invisible", file=sys.stderr)
        out.extend(rows)
    return out


def _send_telegram(text: str, bot_token: str, chat_id: str, dry_run: bool) -> bool:
    """Return True only when the message was actually delivered to Telegram.
    dry-run and missing creds print to stdout and return False — the caller must
    not mark such events as fired (they would never reach Ben)."""
    if dry_run or not (bot_token and chat_id):
        print(f"[watch]{' (dry)' if dry_run else ' (no-telegram)'} {text}")
        return False
    payload = json.dumps({"chat_id": chat_id, "text": text}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310
        resp.read()
    return True


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def events_for(
    order: dict, prev: dict | None, now: datetime, stale_claimed_h: int, stale_sent_d: int,
    digest_hour: int = 8,
) -> list[tuple[str, str]]:
    """Return (event_key, message) pairs for one queue row vs its previous state."""
    loc = order.get("location_name") or order.get("location_id", "?")
    sup = order.get("supplier_name") or order.get("supplier_id", "?")
    status = order.get("status")
    prev_keys = set((prev or {}).get("fired", []))
    lines = order.get("line_count", "?")
    delivery = order.get("requested_delivery_date") or order.get("suggested_delivery_date")
    out: list[tuple[str, str]] = []

    def add(key: str, text: str) -> None:
        if key not in prev_keys:
            out.append((key, text))

    # Timestamped keys, no prev-status gate: dedupe by the key alone. A revert +
    # re-send produces a NEW timestamp → NEW alert; an undelivered event (no
    # telegram, dry-run) stays unfired and is re-offered on the next run.
    if status == "captain_submitted":
        add(f"submitted:{order.get('captain_submitted_at') or '?'}",
            f"NOWE ZAMÓWIENIE: {loc} -> {sup}, {lines} poz., dostawa {delivery or '?'}")
    if status == "manager_sent":
        add(f"sent:{order.get('manager_sent_at') or '?'}",
            f"WYSŁANE: {loc} -> {sup}, dostawa {delivery or '?'}. "
            f"Draft dla grupy: „Zamówienie do {sup} poszło, dostawa {delivery or '?'} — "
            f"proszę odebrać i potwierdzić w aplikacji.”")
    warsaw_now = now.astimezone(WARSAW)
    today = warsaw_now.date().isoformat()
    # "expected today" fires at/after the digest hour (Warsaw). Once-per-day key;
    # >= instead of == so a crashed 8:xx window still sends on recovery and a
    # same-day order submitted later still gets its notice.
    if (status in ("manager_claimed", "manager_sent") and delivery == today
            and warsaw_now.hour >= digest_hour):
        add(f"expected:{today}", f"DOSTAWA DZIŚ: {loc} <- {sup} (status {status}). "
                              f"Draft dla grupy: „Dziś spodziewana dostawa {sup} do {loc} — "
                              f"odebrać przy pracowniku i potwierdzić.”")
    claimed_age_h = None
    if status == "manager_claimed":
        # No manager_claimed_at/manager_user exists: the UI measures "claimed >24h"
        # from captain_submitted_at, so we do the same and stay neutral about
        # who is responsible (a TRN- transport draft also sits in this lane).
        base = _parse_dt(order.get("captain_submitted_at") or order.get("last_edited_at"))
        if base:
            claimed_age_h = (now - base).total_seconds() / 3600
        if claimed_age_h is not None and claimed_age_h > stale_claimed_h:
            add("stale-claimed", f"ZATOR: {loc} -> {sup} claimed {claimed_age_h:.0f}h "
                                 f"(>{stale_claimed_h}h od submit) — bez statusu „wysłane”.")
    if status == "manager_sent":
        sent_at = _parse_dt(order.get("manager_sent_at"))
        age_d = (now - sent_at).total_seconds() / 86400 if sent_at else None
        if age_d is not None and age_d > stale_sent_d and not order.get("received_count"):
            add("stale-sent", f"ZATOR: {loc} -> {sup} wysłane {age_d:.0f}d "
                              f"(>{stale_sent_d}d) — dostawa niepotwierdzona w {loc}.")
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--once", action="store_true", help="single scan (cron mode)")
    p.add_argument("--dry-run", action="store_true", help="print events, do not send")
    p.add_argument("--baseline", action="store_true",
                   help="record current state and send NOTHING (run once after deploy)")
    args = p.parse_args()

    api_url = env("SUPPLY_OS_WATCH_API_URL", "https://pita-supply-os-production.up.railway.app")
    token = env("SUPPLY_OS_MANAGER_TOKEN")
    state_file = env("WATCH_STATE_FILE",
                     os.path.expanduser("~/.config/supplyos/order_watch_state.json"))
    bot_token = env("WATCH_TELEGRAM_BOT_TOKEN")
    chat_id = env("WATCH_TELEGRAM_CHAT_ID")
    stale_claimed_h = int(env("WATCH_CLAIMED_STALE_H", "24"))
    stale_sent_d = int(env("WATCH_SENT_STALE_D", "3"))

    try:
        state = json.loads(open(state_file).read()) if os.path.exists(state_file) else {}
    except (OSError, json.JSONDecodeError):
        state = {}
    orders_state = state.get("orders", {})

    queue = _get_queue(api_url, token)
    now = datetime.now(timezone.utc)
    digest_hour = int(env("WATCH_DIGEST_HOUR", "8"))
    fired_any = False
    for order in queue:
        if order.get("status") not in ACTIVE:
            continue
        oid = order["order_id"]
        if is_transport_draft(order):
            continue
        prev = orders_state.get(oid, {})
        for key, text in events_for(order, prev, now, stale_claimed_h, stale_sent_d,
                                    digest_hour):
            # Mark as fired only on real delivery or in --baseline (its whole
            # point is to consume the pre-existing backlog silently). dry-run
            # and no-telegram runs leave events unfired so a later configured
            # run still sends them.
            if args.baseline:
                prev.setdefault("fired", []).append(key)
            elif not args.dry_run and _send_telegram(text, bot_token, chat_id, False):
                prev.setdefault("fired", []).append(key)
            elif args.dry_run:
                _send_telegram(text, bot_token, chat_id, True)
            fired_any = True
        orders_state[oid] = {"status": order.get("status"), "fired": prev.get("fired", [])}

    if args.dry_run:
        print(f"[watch] dry-run — state file untouched ({len(orders_state)} active scanned)")
        return 0
    state["orders"] = orders_state
    state["last_run"] = now.isoformat()
    os.makedirs(os.path.dirname(os.path.abspath(state_file)), exist_ok=True)
    tmp = state_file + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, state_file)
    if not fired_any:
        print(f"[watch] {now.isoformat()} — {len(orders_state)} active, no new events")
    return 0


if __name__ == "__main__":
    sys.exit(main())
