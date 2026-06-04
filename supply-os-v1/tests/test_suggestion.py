"""Unit tests for the suggestion engine."""
import pytest

from app.models import RoundingRule
from app.suggestion import SuggestionInput, compute_suggestion


def _inp(**kwargs) -> SuggestionInput:
    defaults = dict(
        current_stock_qty_base=0,
        target_stock_qty_base=10,
        max_stock_qty_base=10,
        units_per_purchase_unit=1,
        rounding_rule=RoundingRule.FULL_ONLY,
        is_critical=False,
        allow_over_max_due_to_packaging=False,
    )
    defaults.update(kwargs)
    return SuggestionInput(**defaults)


# ---------- Happy paths ----------

def test_souvlaki_kurczak_low_stock():
    """8 kg current, 12 kg target, 5 kg/karton → 1 karton, exceeds max by 1."""
    out = compute_suggestion(_inp(
        current_stock_qty_base=8, target_stock_qty_base=12,
        max_stock_qty_base=12, units_per_purchase_unit=5,
    ))
    assert out.suggested_qty_purchase == 1
    assert out.suggested_qty_base == 5
    assert out.over_max_qty_base == 1
    assert "1 purchase unit" in out.explanation


def test_at_target_no_order():
    out = compute_suggestion(_inp(
        current_stock_qty_base=12, target_stock_qty_base=12,
        max_stock_qty_base=12, units_per_purchase_unit=5,
    ))
    assert out.suggested_qty_purchase == 0
    assert out.suggested_qty_base == 0
    assert "no order needed" in out.explanation


def test_over_target_no_order():
    out = compute_suggestion(_inp(
        current_stock_qty_base=15, target_stock_qty_base=12,
        max_stock_qty_base=12, units_per_purchase_unit=5,
    ))
    assert out.suggested_qty_purchase == 0


def test_souvlaki_wieprz_packaging_overage_allowed():
    """1 kg current, 4 kg max, 5 kg/karton — 1 karton always overshoots."""
    out = compute_suggestion(_inp(
        current_stock_qty_base=1, target_stock_qty_base=4,
        max_stock_qty_base=4, units_per_purchase_unit=5,
        allow_over_max_due_to_packaging=True,
    ))
    assert out.suggested_qty_purchase == 1
    assert out.over_max_qty_base == 2
    # When packaging-overage is allowed, explanation does not warn.
    assert "exceeds" not in out.explanation


def test_halloumi_pieces():
    """1 kg current, 9 kg target, 0.2 kg/piece → 40 pieces, clean 8.0 kg base."""
    out = compute_suggestion(_inp(
        current_stock_qty_base=1, target_stock_qty_base=9,
        max_stock_qty_base=9, units_per_purchase_unit=0.2,
    ))
    assert out.suggested_qty_purchase == 40
    assert out.suggested_qty_base == 8.0


def test_critical_zero_stock_orders_full_unit():
    out = compute_suggestion(_inp(
        current_stock_qty_base=0, target_stock_qty_base=2,
        max_stock_qty_base=10, units_per_purchase_unit=5,
        is_critical=True,
    ))
    assert out.suggested_qty_purchase == 1
    assert out.suggested_qty_base == 5


def test_half_allowed_rule():
    out = compute_suggestion(_inp(
        current_stock_qty_base=0, target_stock_qty_base=2.5,
        max_stock_qty_base=10, units_per_purchase_unit=1,
        rounding_rule=RoundingRule.HALF_ALLOWED,
    ))
    assert out.suggested_qty_purchase == 2.5


# ---------- Input validation ----------

def test_rejects_zero_units_per_purchase_unit():
    with pytest.raises(ValueError, match="units_per_purchase_unit"):
        compute_suggestion(_inp(units_per_purchase_unit=0))


def test_rejects_negative_units_per_purchase_unit():
    with pytest.raises(ValueError, match="units_per_purchase_unit"):
        compute_suggestion(_inp(units_per_purchase_unit=-1))


def test_rejects_negative_current_stock():
    with pytest.raises(ValueError, match="current_stock_qty_base"):
        compute_suggestion(_inp(current_stock_qty_base=-5))


def test_rejects_negative_target():
    with pytest.raises(ValueError, match="target_stock_qty_base"):
        compute_suggestion(_inp(target_stock_qty_base=-1))


def test_rejects_negative_max():
    with pytest.raises(ValueError, match="max_stock_qty_base"):
        compute_suggestion(_inp(max_stock_qty_base=-1))


def test_rejects_nan_current_stock():
    with pytest.raises(ValueError, match="NaN"):
        compute_suggestion(_inp(current_stock_qty_base=float("nan")))


def test_rejects_inf_target():
    with pytest.raises(ValueError, match="finite"):
        compute_suggestion(_inp(target_stock_qty_base=float("inf")))


def test_rejects_inf_units_per_purchase_unit():
    with pytest.raises(ValueError, match="finite"):
        compute_suggestion(_inp(units_per_purchase_unit=float("inf")))


def test_rejects_nan_units_per_purchase_unit():
    with pytest.raises(ValueError, match="finite"):
        compute_suggestion(_inp(units_per_purchase_unit=float("nan")))


# ---------- Float cleanliness ----------

def test_float_artifacts_cleaned_for_03_units():
    """Verify _clean() suppresses IEEE-754 surprises with 0.3 kg/unit."""
    # 6 / 0.3 ≈ 19.9999..., ceil = 20, 20 * 0.3 → cleaned to 6.0
    out = compute_suggestion(_inp(
        current_stock_qty_base=4, target_stock_qty_base=10,
        max_stock_qty_base=10, units_per_purchase_unit=0.3,
    ))
    assert out.suggested_qty_purchase == 20
    assert out.suggested_qty_base == 6.0


def test_float_artifacts_cleaned_for_01_units():
    """0.1 kg/unit is the classic float trap. 10 * 0.1 should be 1.0."""
    out = compute_suggestion(_inp(
        current_stock_qty_base=0, target_stock_qty_base=1,
        max_stock_qty_base=10, units_per_purchase_unit=0.1,
    ))
    assert out.suggested_qty_purchase == 10
    assert out.suggested_qty_base == 1.0
