"""Tests for the Manager inventory view endpoints (S-08 / FR-018):

    GET /api/manager/inventory/counts        -> list[InventoryCountManagerItem]
    GET /api/manager/inventory/count/{id}    -> InventoryCountDetail

The Manager spans locations (NOT token-scoped, mirroring manager_queue) and the
responses are server-enriched (location_name + product names). Sheet-only: list
degrades to [] off-sheet, detail to 503; never a 500.

Synthetic data only — these tests never place or dispatch a real order.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from app import sheets
from app.config import DataBackend
from app.main import app
from app.models import (
    InventoryCount,
    InventoryCountLine,
    Location,
    Product,
)

client = TestClient(app)

MANAGER_AUTH = {"Authorization": "Bearer test_manager_token"}
CAPTAIN_AUTH = {"Authorization": "Bearer test_wola_token"}

LOCATIONS = [
    Location(location_id="WOLA", location_name="Wola"),
    Location(location_id="KEN", location_name="Kensington"),
]
PRODUCTS = [
    Product(
        product_id="P027", product_name_pl="Pomidor",
        product_category="Warzywa", inventory_unit="kg", is_critical=True,
    ),
    Product(
        product_id="P026", product_name_pl="Feta blok",
        product_category="Nabiał", inventory_unit="kg",
    ),
]


# ---------- Fixtures ----------

def _line(count_id: str, pid: str, qty: float, idx: int = 1) -> InventoryCountLine:
    return InventoryCountLine(
        count_line_id=f"ICL-{count_id}-{idx:03d}",
        count_id=count_id,
        product_id=pid,
        current_stock_qty_base=qty,
    )


def _count(
    count_id: str,
    location_id: str,
    submitted_at: datetime | None,
    count_date: date,
    lines: list[InventoryCountLine] | None = None,
    count_user: str | None = None,
    line_count: int | None = None,
) -> InventoryCount:
    lines = lines or []
    return InventoryCount(
        count_id=count_id,
        location_id=location_id,
        count_date=count_date,
        count_submitted_at=submitted_at,
        count_user=count_user,
        line_count=line_count if line_count is not None else len(lines),
        lines=lines,
    )


def _activate_sheet(mocker, counts: list[InventoryCount]) -> None:
    """Switch the backend selector to `sheets` and stub the inventory + master
    reads (counts, get-by-id, locations, products)."""
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(sheets, "load_inventory_counts", return_value=counts)
    mocker.patch.object(sheets, "load_locations", return_value=LOCATIONS)
    mocker.patch.object(sheets, "load_products", return_value=PRODUCTS)
    by_id = {c.count_id: c for c in counts}
    mocker.patch.object(
        sheets, "get_inventory_count", side_effect=lambda cid: by_id.get(cid)
    )


# ---------- List: /api/manager/inventory/counts ----------

def test_manager_counts_lists_cross_location(mocker):
    wola = _count(
        "INV-WOLA", "WOLA",
        datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc), date(2026, 6, 5),
        count_user="Anna",
    )
    ken = _count(
        "INV-KEN", "KEN",
        datetime(2026, 6, 8, 9, 0, tzinfo=timezone.utc), date(2026, 6, 8),
        count_user="Jan",
    )
    _activate_sheet(mocker, [wola, ken])

    r = client.get("/api/manager/inventory/counts", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    # Both locations present, newest count_date first.
    assert [row["count_id"] for row in body] == ["INV-KEN", "INV-WOLA"]
    by_id = {row["count_id"]: row for row in body}
    assert by_id["INV-WOLA"]["location_name"] == "Wola"
    assert by_id["INV-KEN"]["location_name"] == "Kensington"
    assert "lines" not in body[0]  # compact list rows


def test_manager_counts_location_filter(mocker):
    wola = _count(
        "INV-WOLA", "WOLA",
        datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc), date(2026, 6, 5),
    )
    ken = _count(
        "INV-KEN", "KEN",
        datetime(2026, 6, 8, 9, 0, tzinfo=timezone.utc), date(2026, 6, 8),
    )
    _activate_sheet(mocker, [wola, ken])

    r = client.get(
        "/api/manager/inventory/counts?location_id=WOLA", headers=MANAGER_AUTH
    )
    assert r.status_code == 200, r.text
    assert [row["count_id"] for row in r.json()] == ["INV-WOLA"]


def test_manager_counts_cap_20(mocker):
    counts = [
        _count(
            f"INV-{day:02d}", "WOLA",
            datetime(2026, 6, day, 10, 0, tzinfo=timezone.utc), date(2026, 6, day),
        )
        for day in range(1, 23)  # 22 counts, 2026-06-01 .. 2026-06-22
    ]
    _activate_sheet(mocker, counts)

    r = client.get("/api/manager/inventory/counts", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) == 20
    assert body[0]["count_id"] == "INV-22"  # newest
    assert "INV-01" not in [row["count_id"] for row in body]


def test_manager_counts_empty_in_seed_mode():
    r = client.get("/api/manager/inventory/counts", headers=MANAGER_AUTH)
    assert r.status_code == 200
    assert r.json() == []


def test_manager_counts_worksheet_not_found_empty(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(
        sheets, "load_inventory_counts", side_effect=sheets.WorksheetNotFound
    )
    r = client.get("/api/manager/inventory/counts", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_manager_counts_rejects_captain_token(mocker):
    _activate_sheet(mocker, [])
    r = client.get("/api/manager/inventory/counts", headers=CAPTAIN_AUTH)
    assert r.status_code == 401, r.text


def test_manager_counts_unauthorized_no_token():
    r = client.get("/api/manager/inventory/counts")
    assert r.status_code == 401


# ---------- Detail: /api/manager/inventory/count/{count_id} ----------

def test_manager_count_detail_enriched(mocker):
    c = _count(
        "INV-DET", "WOLA",
        datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc), date(2026, 6, 5),
        lines=[_line("INV-DET", "P027", 14), _line("INV-DET", "P026", 6, idx=2)],
        count_user="Anna",
    )
    _activate_sheet(mocker, [c])

    r = client.get("/api/manager/inventory/count/INV-DET", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["location_name"] == "Wola"
    assert body["count_user"] == "Anna"
    by_pid = {ln["product_id"]: ln for ln in body["lines"]}
    assert by_pid["P027"]["product_name_pl"] == "Pomidor"
    assert by_pid["P027"]["inventory_unit"] == "kg"
    assert by_pid["P027"]["is_critical"] is True
    assert by_pid["P027"]["current_stock_qty_base"] == 14
    assert by_pid["P026"]["product_name_pl"] == "Feta blok"


def test_manager_count_detail_unknown_product_falls_back_to_id(mocker):
    """A counted product not in master data falls back to its id for the name."""
    c = _count(
        "INV-GHOST", "WOLA",
        datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc), date(2026, 6, 5),
        lines=[_line("INV-GHOST", "P999", 3)],
    )
    _activate_sheet(mocker, [c])
    r = client.get("/api/manager/inventory/count/INV-GHOST", headers=MANAGER_AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["lines"][0]["product_name_pl"] == "P999"


def test_manager_count_detail_missing_404(mocker):
    _activate_sheet(mocker, [])
    r = client.get("/api/manager/inventory/count/INV-NOPE", headers=MANAGER_AUTH)
    assert r.status_code == 404, r.text


def test_manager_count_detail_seed_503():
    r = client.get("/api/manager/inventory/count/INV-X", headers=MANAGER_AUTH)
    assert r.status_code == 503, r.text


def test_manager_count_detail_worksheet_not_found_503(mocker):
    mocker.patch.object(sheets.settings, "data_backend", DataBackend.SHEET)
    mocker.patch.object(sheets, "is_configured", return_value=True)
    mocker.patch.object(
        sheets, "get_inventory_count", side_effect=sheets.WorksheetNotFound
    )
    r = client.get("/api/manager/inventory/count/INV-X", headers=MANAGER_AUTH)
    assert r.status_code == 503, r.text


def test_manager_count_detail_rejects_captain_token(mocker):
    _activate_sheet(mocker, [])
    r = client.get("/api/manager/inventory/count/INV-X", headers=CAPTAIN_AUTH)
    assert r.status_code == 401, r.text


def test_manager_count_detail_unauthorized_no_token():
    r = client.get("/api/manager/inventory/count/INV-X")
    assert r.status_code == 401
