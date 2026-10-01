"""Bulk packs (feedback-1001-names-units D33/D34) — the backend half of the
shared engine + gate fixture docs/pita-supply-os-v1/fixtures/
case_suggestion_cases.json. The frontend twin
(frontend/src/pages/captain-mp/lib/caseSuggestionFixture.test.ts) reads the SAME
file through computeSuggestion / computeRowState, so the two engines cannot
drift without both suites failing (plan-review F9)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.main import _evaluate_submit_line
from app.models import (
    LocationProductSetting,
    OrderLineSubmit,
    Product,
    ReasonCode,
    RoundingRule,
    SupplierProduct,
)
from app.suggestion import SuggestionInput, compute_suggestion

FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "pita-supply-os-v1"
    / "fixtures"
    / "case_suggestion_cases.json"
)
DATA = json.loads(FIXTURE.read_text(encoding="utf-8"))

# Substring of the 400 detail each gate raises (main._evaluate_submit_line).
_KIND_DETAIL = {
    "critical": "under-ordered",
    "deviation": "deviates",
    "over_max": "over MAX",
}


def _item(row: dict) -> dict:
    return {**DATA["items"][row["item"]], **row.get("item_overrides", {})}


def _inp(item: dict, current: float) -> SuggestionInput:
    return SuggestionInput(
        current_stock_qty_base=current,
        target_stock_qty_base=item["target_stock_qty_base"],
        max_stock_qty_base=item["max_stock_qty_base"],
        units_per_purchase_unit=item["units_per_purchase_unit"],
        rounding_rule=RoundingRule(item["rounding_rule"]),
        is_critical=item["is_critical"],
        allow_over_max_due_to_packaging=item["allow_over_max_due_to_packaging"],
        units_per_case=item["units_per_case"],
    )


@pytest.mark.parametrize("row", DATA["suggestion"], ids=lambda r: r["name"])
def test_engine_matches_shared_fixture(row: dict):
    out = compute_suggestion(_inp(_item(row), row["current"]))
    assert out.need_qty_purchase == pytest.approx(row["need"])
    assert out.suggested_qty_purchase == pytest.approx(row["suggested"])


def _evaluate(row: dict, reason: ReasonCode | None = None):
    item = _item(row)
    sp = SupplierProduct(
        supplier_product_id="SP_X",
        supplier_id="SUP_X",
        product_id="P_X",
        supplier_product_name="X",
        purchase_unit=item["purchase_unit"],
        units_per_purchase_unit=item["units_per_purchase_unit"],
        rounding_rule=RoundingRule(item["rounding_rule"]),
        case_unit=item["case_unit"],
        units_per_case=item["units_per_case"],
    )
    setting = LocationProductSetting(
        setting_id="S_X",
        location_id="WOLA",
        product_id="P_X",
        target_stock_qty_base=item["target_stock_qty_base"],
        max_stock_qty_base=item["max_stock_qty_base"],
        allow_over_max_due_to_packaging=item["allow_over_max_due_to_packaging"],
    )
    product = Product(
        product_id="P_X",
        product_name_pl="X",
        product_category="C",
        inventory_unit=item["inventory_unit"],
        is_critical=item["is_critical"],
    )
    line = OrderLineSubmit(
        product_id="P_X",
        supplier_product_id="SP_X",
        current_stock_qty_base=row["current"],
        captain_final_qty_purchase=row["ordered"],
        reason_code=reason,
    )
    return _evaluate_submit_line(
        line,
        sp,
        setting,
        product,
        order_line_id="OL-X-001",
        order_id="ORD-X",
        alerts_enabled=item["suggestion_alerts_enabled"],
    )


@pytest.mark.parametrize("row", DATA["gates"], ids=lambda r: r["name"])
def test_gates_match_shared_fixture(row: dict):
    if row["reason_required"]:
        with pytest.raises(HTTPException) as exc:
            _evaluate(row)
        assert exc.value.status_code == 400
        assert _KIND_DETAIL[row["kind"]] in exc.value.detail
        # The same order with a reason is accepted.
        order_line, _warning, _value = _evaluate(row, ReasonCode.OTHER)
    else:
        order_line, _warning, _value = _evaluate(row)
    if row["delta"] is None:
        assert order_line.delta_vs_suggestion_pct is None
    else:
        assert order_line.delta_vs_suggestion_pct == pytest.approx(row["delta"])
