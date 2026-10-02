"""order-email-v2: the backend builder renders the shared golden fixtures
byte-for-byte (tests/fixtures/order_email/). The frontend twin
(frontend/src/pages/manager/lib/emailBody.golden.test.ts) renders the SAME
JSON against the SAME .txt, so the two builders cannot drift.

Also pins the Polish declension table to frontend/src/i18n/packUnits.ts."""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

import pytest

from app import gmail_url
from app.models import (
    Location,
    Order,
    OrderEmailSigner,
    OrderLine,
    OrderStatus,
    Product,
    SupplierProduct,
)

FIXTURES = Path(__file__).parent / "fixtures" / "order_email"
PACK_UNITS_TS = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "i18n" / "packUnits.ts"
)
SCENARIOS = sorted(p.stem for p in FIXTURES.glob("*.json"))


def _render(fx: dict) -> str:
    o = fx["order"]
    order = Order(
        order_id=o["order_id"],
        location_id="LOC",
        supplier_id="SUP_X",
        order_date=date(2026, 9, 28),
        requested_delivery_date=(
            date.fromisoformat(o["requested_delivery_date"])
            if o["requested_delivery_date"]
            else None
        ),
        status=OrderStatus.MANAGER_CLAIMED,
        extra_items=o["extra_items"],
        captain_note=o["captain_note"],
    )
    loc = fx["location"]
    location = Location(location_id="LOC", **loc)
    lines: list[OrderLine] = []
    products_by_id: dict = {}
    for ln in fx["lines"]:
        lines.append(
            OrderLine(
                order_line_id=ln["order_line_id"],
                order_id=order.order_id,
                product_id=ln["product_id"],
                supplier_product_id=ln["supplier_product_id"],
                captain_final_qty_purchase=ln["qty"],
            )
        )
        products_by_id[ln["product_id"]] = Product(
            product_id=ln["product_id"],
            product_name_pl=ln["product_name_pl"],
            product_category="X",
            inventory_unit=ln["inventory_unit"],
        )
        products_by_id[ln["supplier_product_id"]] = SupplierProduct(
            supplier_product_id=ln["supplier_product_id"],
            supplier_id="SUP_X",
            product_id=ln["product_id"],
            supplier_product_name=ln["supplier_product_name"],
            purchase_unit=ln["purchase_unit"],
            display_order=ln["display_order"],
            # Bulk pack (feedback-1001 D35); absent from the older fixtures.
            case_unit=ln.get("case_unit"),
            units_per_case=ln.get("units_per_case"),
        )
    signer = OrderEmailSigner(**fx["signer"]) if fx["signer"] else None
    include = fx["include_delivery_date"]
    subject = gmail_url._build_subject(order, location, include)
    body = gmail_url._build_body(
        order, None, lines, products_by_id, location, signer, include
    )
    return f"{subject}\n---\n{body}"


@pytest.mark.parametrize("name", SCENARIOS)
def test_golden_fixture(name: str):
    fx = json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))
    expected = (FIXTURES / f"{name}.txt").read_text(encoding="utf-8").rstrip("\n")
    assert _render(fx) == expected


def test_scenarios_present():
    assert {"bracka_bukat", "wola_intermlecz", "ken_edge_cases", "case_lines"} <= set(SCENARIOS)


def _parse_ts_pl_forms() -> dict[str, dict[str, str]]:
    src = PACK_UNITS_TS.read_text(encoding="utf-8")
    out: dict[str, dict[str, str]] = {}
    for key, pl in re.findall(r"^\s{2}(\w+):\s*\{\s*\n\s*pl:\s*\{([^}]*)\}", src, re.M):
        forms = dict(re.findall(r'(\w+):\s*"([^"]*)"', pl))
        out[key] = {k: forms[k] for k in ("one", "few", "many", "frac")}
    return out


def test_pl_pack_unit_forms_match_frontend_table():
    ts = _parse_ts_pl_forms()
    assert len(ts) >= 10  # the parser found the table
    assert ts == gmail_url._PL_PACK_UNIT_FORMS
