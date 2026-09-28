"""Seed backend for the delivery calendar (delivery-calendar, Phase 1).

The seed CSV is optional: present → parsed into ``SupplierDeliveryRule``;
absent → ``[]`` (every proposal falls back). The seed suppliers carry the
Thursday-prompt flag for Bukat and Intermlecz only.
"""
from __future__ import annotations

from pathlib import Path

from app import seed_loader
from app.config import settings


def test_seed_rules_load_from_csv():
    rules = seed_loader.load_supplier_delivery_rules()
    by_id = {r.rule_id: r for r in rules}
    wola = by_id["DR-PAGO-WOLA"]
    assert (wola.supplier_id, wola.location_id) == ("SUP_PAGO", "WOLA")
    assert (wola.order_weekdays, wola.lead_days, wola.delivery_weekdays) == ("Mon", 2, "Wed")
    assert wola.order_deadline == "17:00"
    bukat = by_id["DR-BUKAT-ALL"]
    assert bukat.location_id is None
    assert bukat.delivery_weekdays == "Mon,Tue,Wed,Thu,Fri,Sat"
    # Every seeded rule points at a supplier and location present in the seed.
    supplier_ids = {s.supplier_id for s in seed_loader.load_suppliers()}
    location_ids = {loc.location_id for loc in seed_loader.load_locations()}
    for r in rules:
        assert r.supplier_id in supplier_ids
        assert r.location_id is None or r.location_id in location_ids
    # At most one shared rule per supplier (mirrors the DB UNIQUE constraint).
    keys = [(r.supplier_id, r.location_id) for r in rules]
    assert len(keys) == len(set(keys))


def test_seed_rules_absent_csv_returns_empty(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(settings, "seed_dir", tmp_path)
    assert seed_loader.load_supplier_delivery_rules() == []


def test_seed_suppliers_coverage_prompt_flag():
    flags = {s.supplier_id: s.coverage_prompt_enabled for s in seed_loader.load_suppliers()}
    assert {sid for sid, on in flags.items() if on} == {"SUP_BUKAT", "SUP_INTERMLECZ"}
    assert len(flags) == 10
