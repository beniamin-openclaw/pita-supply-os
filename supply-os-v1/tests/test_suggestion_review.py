"""Tests for the suggestion learning-loop review (S-03 / FR-012):

    GET /api/manager/suggestion-review -> list[SuggestionReviewItem]

A read-only per-product roll-up of the order-line history (suggested vs captain
vs manager finals, deviation, reason histogram), sorted worst-deviation first.
Sheet-only (order_lines persist only in sheet mode); seed → []. The pure
aggregate helper is unit-tested directly.

Synthetic data only — these tests never place or dispatch a real order.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app import sheets
from app.config import DataBackend
from app.main import _aggregate_suggestion_review, app
from app.models import OrderLine, Product, ReasonCode

client = TestClient(app)

MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}
CAPTAIN_AUTH = {"Authorization": "Bearer test_wola_token"}


def _ol(
    order_id: str,
    product_id: str,
    suggested: float,
    captain: float,
    manager: float = 0,
    delta: float | None = None,
    reason: ReasonCode | None = None,
    idx: int = 1,
) -> OrderLine:
    return OrderLine(
        order_line_id=f"OL-{order_id}-{product_id}-{idx:03d}",
        order_id=order_id,
        product_id=product_id,
        supplier_product_id=f"SP-{product_id}",
        suggested_qty_purchase=suggested,
        captain_final_qty_purchase=captain,
        manager_final_qty_purchase=manager,
        delta_vs_suggestion_pct=delta,
        reason_code=reason,
    )


def _activate_sheet(mocker, lines: list[OrderLine], products: list[Product]) -> None:
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_order_lines", return_value=lines)
    mocker.patch.object(sheets, "load_products", return_value=products)


# ---------- Pure aggregate helper ----------

def test_aggregate_basic_rollup():
    lines = [
        _ol("ORD-1", "P027", 10, 8, delta=0.2, reason=ReasonCode.LOW_STORAGE),
        _ol("ORD-2", "P027", 10, 12, delta=0.2, reason=ReasonCode.SYSTEM_SUGGESTION_WRONG),
        _ol("ORD-1", "P026", 5, 5, delta=0.0, idx=2),
    ]
    products = {
        "P027": Product(
            product_id="P027", product_name_pl="Pomidor",
            product_category="Warzywa", inventory_unit="kg",
        )
    }
    items = _aggregate_suggestion_review(lines, products)
    by_pid = {it.product_id: it for it in items}

    p027 = by_pid["P027"]
    assert p027.line_count == 2
    assert p027.order_count == 2  # ORD-1 + ORD-2
    assert p027.avg_suggested_qty_purchase == 10
    assert p027.avg_captain_final_qty_purchase == 10  # (8 + 12) / 2
    assert p027.avg_abs_deviation_pct == 0.2
    assert p027.reason_code_counts == {"LOW_STORAGE": 1, "SYSTEM_SUGGESTION_WRONG": 1}
    assert p027.product_name_pl == "Pomidor"

    # P026 has no product master row → id fallback, no reasons.
    assert by_pid["P026"].product_name_pl == "P026"
    assert by_pid["P026"].reason_code_counts == {}


def test_aggregate_sorts_worst_deviation_first():
    lines = [
        _ol("ORD-1", "P_LOW", 10, 10, delta=0.05),
        _ol("ORD-1", "P_HIGH", 10, 15, delta=0.5, idx=2),
    ]
    items = _aggregate_suggestion_review(lines, {})
    assert [it.product_id for it in items] == ["P_HIGH", "P_LOW"]


def test_aggregate_skips_none_deviation_in_mean():
    lines = [
        _ol("ORD-1", "P1", 10, 10, delta=None),
        _ol("ORD-2", "P1", 10, 14, delta=0.4),
    ]
    items = _aggregate_suggestion_review(lines, {})
    assert items[0].avg_abs_deviation_pct == 0.4  # only the line that has a delta


def test_aggregate_no_deviation_is_zero():
    lines = [_ol("ORD-1", "P1", 10, 10, delta=None)]
    items = _aggregate_suggestion_review(lines, {})
    assert items[0].avg_abs_deviation_pct == 0.0


def test_aggregate_empty():
    assert _aggregate_suggestion_review([], {}) == []


# ---------- Endpoint ----------

def test_review_endpoint_sorted(mocker):
    lines = [
        _ol("ORD-1", "P_LOW", 10, 10, delta=0.05),
        _ol("ORD-1", "P_HIGH", 10, 15, delta=0.5, idx=2),
    ]
    _activate_sheet(mocker, lines, [])
    r = client.get("/api/manager/suggestion-review", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert [it["product_id"] for it in r.json()] == ["P_HIGH", "P_LOW"]


def test_review_endpoint_product_name_join(mocker):
    lines = [_ol("ORD-1", "P027", 10, 8, delta=0.2)]
    products = [
        Product(
            product_id="P027", product_name_pl="Pomidor",
            product_category="Warzywa", inventory_unit="kg",
        )
    ]
    _activate_sheet(mocker, lines, products)
    r = client.get("/api/manager/suggestion-review", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()[0]["product_name_pl"] == "Pomidor"


def test_review_endpoint_empty_in_seed_mode():
    r = client.get("/api/manager/suggestion-review", headers=MANAGER_AUTH)
    assert r.status_code == 200
    assert r.json() == []


def test_review_endpoint_worksheet_not_found_empty(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(
        sheets, "load_order_lines", side_effect=sheets.WorksheetNotFound
    )
    r = client.get("/api/manager/suggestion-review", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_review_endpoint_rejects_captain_token(mocker):
    _activate_sheet(mocker, [], [])
    r = client.get("/api/manager/suggestion-review", headers=CAPTAIN_AUTH)
    assert r.status_code == 401, r.text


def test_review_endpoint_unauthorized_no_token():
    r = client.get("/api/manager/suggestion-review")
    assert r.status_code == 401
