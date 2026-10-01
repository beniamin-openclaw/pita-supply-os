"""Unit tests for the suggestion engine."""
import pytest

from app.models import RoundingRule
from app.suggestion import (
    SuggestionInput,
    case_rounded_max,
    case_suggestion,
    compute_suggestion,
    deviation_reference,
    round_half_up,
    rounding_step,
)


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


# ---------- Half-up rounding (plan-review F4) ----------

@pytest.mark.parametrize(
    ("x", "expected"), [(0.5, 1), (1.5, 2), (2.5, 3), (0.49, 0), (2.4999999999999996, 3)]
)
def test_round_half_up_pins_halves(x: float, expected: int):
    """Halves go UP, unlike Python's banker's round() (0.5 -> 0, 2.5 -> 2) —
    the frontend's roundHalfUp pins the same numbers."""
    assert round_half_up(x) == expected


@pytest.mark.parametrize(("target", "expected"), [(12, 1), (36, 2), (60, 3)])
def test_up_for_critical_non_critical_rounds_halves_up(target: float, expected: float):
    """raw 0.5 / 1.5 / 2.5 zgrzewki (24 szt): 1 / 2 / 3. Before the F4 fix the
    backend said 0 / 2 / 2 while the Captain's screen said 1 / 2 / 3."""
    out = compute_suggestion(_inp(
        current_stock_qty_base=0, target_stock_qty_base=target,
        max_stock_qty_base=100, units_per_purchase_unit=24,
        rounding_rule=RoundingRule.UP_FOR_CRITICAL,
    ))
    assert out.suggested_qty_purchase == expected


# ---------- Bulk packs (feedback-1001 D33/D34) ----------
# The full example table lives in the shared fixture
# (test_case_suggestion_fixture.py); these pin the helpers and the explanation.

def test_no_case_need_equals_suggestion():
    out = compute_suggestion(_inp(current_stock_qty_base=3, target_stock_qty_base=10))
    assert out.need_qty_purchase == out.suggested_qty_purchase == 7


@pytest.mark.parametrize(
    ("need", "expected"), [(0, 0), (2, 0), (3, 6), (4, 6), (9, 12), (10, 12)]
)
def test_case_suggestion_nearest_whole_case(need: float, expected: float):
    assert case_suggestion(need, 6) == expected


@pytest.mark.parametrize("upc", [None, 1, 0.5])
def test_case_suggestion_without_a_real_case_is_the_need(upc):
    assert case_suggestion(4, upc) == 4


def test_deviation_reference_interval_rule():
    """D34: inside [min(need, case), max(need, case)] the order is its own
    reference (zero deviation); outside, the nearer end."""
    assert deviation_reference(5, 4, 6) == 5  # inside
    assert deviation_reference(0.5, 2, 0) == 0.5  # inside (case 0 below the need)
    assert deviation_reference(18, 2, 0) == 2  # above -> the need
    assert deviation_reference(1, 4, 6) == 4  # below -> the need
    assert deviation_reference(13, 10, 12) == 12  # above -> the case
    assert deviation_reference(5, 3, 3) == 3  # no case: the suggestion


@pytest.mark.parametrize(
    ("target", "expected"), [(0.25, 0.5), (0.75, 1.0), (1.25, 1.5), (2.5, 2.5)]
)
def test_half_allowed_rounds_halves_up(target: float, expected: float):
    """half_allowed parity: nearest half, halves up, as the Captain's screen
    shows (Python's round() gave 0.25 -> 0 and 1.25 -> 1.0)."""
    out = compute_suggestion(_inp(
        current_stock_qty_base=0, target_stock_qty_base=target,
        max_stock_qty_base=10, rounding_rule=RoundingRule.HALF_ALLOWED,
    ))
    assert out.suggested_qty_purchase == expected


def test_case_rounded_max():
    assert case_rounded_max(20, 1, 6) == 24
    assert case_rounded_max(24, 1, 6) == 24
    assert case_rounded_max(1, 1, 5) == 5  # cebula: max 1 kg, worek 5 kg
    assert case_rounded_max(20, 1, None) == 20
    assert case_rounded_max(0, 1, 6) == 0


def test_case_rounding_over_max_is_packaging_not_a_note():
    """Stock 7 kg, target 10, max 12: the need 3 kg fits (10 <= 12), but it
    rounds to a 6 kg crate -> 13 kg > 12. Over max ONLY because of the case,
    so no "exceeds max" note (D34)."""
    out = compute_suggestion(_inp(
        current_stock_qty_base=7, target_stock_qty_base=10, max_stock_qty_base=12,
        rounding_rule=RoundingRule.TENTH_KG, units_per_case=6,
    ))
    assert out.need_qty_purchase == 3
    assert out.suggested_qty_purchase == 6
    assert out.over_max_qty_base == 1
    assert "exceeds" not in out.explanation
    assert "whole cases of 6" in out.explanation


def test_need_over_max_keeps_the_note_with_a_case():
    out = compute_suggestion(_inp(
        current_stock_qty_base=0, target_stock_qty_base=10, max_stock_qty_base=8,
        rounding_rule=RoundingRule.TENTH_KG, units_per_case=6,
    ))
    assert out.suggested_qty_purchase == 12
    assert "exceeds max by 4" in out.explanation


def test_case_zero_with_a_need_does_not_claim_stock_at_target():
    out = compute_suggestion(_inp(
        current_stock_qty_base=8, target_stock_qty_base=10, units_per_case=6,
        rounding_rule=RoundingRule.TENTH_KG,
    ))
    assert out.need_qty_purchase == 2
    assert out.suggested_qty_purchase == 0
    assert "at or above target" not in out.explanation


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


# ---------- Sub-kg (tenth_kg) rule ----------

def test_tenth_kg_exact_tenth_no_over_max():
    """The P009 Natka / P010 Czosnek case: 0.5 kg target, 0 stock, 1 kg/unit →
    0.5 kg suggested, and NO cosmetic over-max (the whole point of S-09)."""
    out = compute_suggestion(_inp(
        current_stock_qty_base=0, target_stock_qty_base=0.5,
        max_stock_qty_base=0.5, units_per_purchase_unit=1,
        rounding_rule=RoundingRule.TENTH_KG,
    ))
    assert out.suggested_qty_purchase == 0.5
    assert out.suggested_qty_base == 0.5
    assert out.over_max_qty_base == 0


def test_tenth_kg_ceils_up_to_next_tenth():
    """0.74 kg need rounds UP to 0.8 (never under-order)."""
    out = compute_suggestion(_inp(
        current_stock_qty_base=0, target_stock_qty_base=0.74,
        max_stock_qty_base=10, units_per_purchase_unit=1,
        rounding_rule=RoundingRule.TENTH_KG,
    ))
    assert out.suggested_qty_purchase == 0.8


def test_tenth_kg_float_artifact_guarded():
    """2.3 kg need must yield 2.3, not 2.4: raw*10 == 23.000000000000004 would
    ceil to the wrong tenth without the pre-clean."""
    out = compute_suggestion(_inp(
        current_stock_qty_base=0, target_stock_qty_base=2.3,
        max_stock_qty_base=10, units_per_purchase_unit=1,
        rounding_rule=RoundingRule.TENTH_KG,
    ))
    assert out.suggested_qty_purchase == 2.3


def test_tenth_kg_no_order_at_target():
    out = compute_suggestion(_inp(
        current_stock_qty_base=0.5, target_stock_qty_base=0.5,
        max_stock_qty_base=0.5, units_per_purchase_unit=1,
        rounding_rule=RoundingRule.TENTH_KG,
    ))
    assert out.suggested_qty_purchase == 0


# ---------- Deviation-gate denominator step ----------

def test_rounding_step_per_rule():
    """full_only / up_for_critical keep the original 1.0 floor (zero regression);
    half_allowed and tenth_kg expose their finer step for the deviation gate."""
    assert rounding_step(RoundingRule.FULL_ONLY) == 1.0
    assert rounding_step(RoundingRule.UP_FOR_CRITICAL) == 1.0
    assert rounding_step(RoundingRule.HALF_ALLOWED) == 0.5
    assert rounding_step(RoundingRule.TENTH_KG) == 0.1


# ---------- target 0 → suggestion 0 (week2-feedback-quantities Phase 1) ----------

@pytest.mark.parametrize("rule", list(RoundingRule))
@pytest.mark.parametrize("is_critical", [False, True])
def test_target_zero_suggests_zero_every_rule(rule, is_critical):
    """A product whose location target is 0 (e.g. a bucket SKU, or a location
    that does not stock it) never yields a positive suggestion, whatever the
    rounding rule and critical flag — the engine's "suggestion 0" is
    information, not a gate (Phase 1 relies on this)."""
    out = compute_suggestion(_inp(
        current_stock_qty_base=0, target_stock_qty_base=0,
        max_stock_qty_base=0, units_per_purchase_unit=5,
        rounding_rule=rule, is_critical=is_critical,
    ))
    assert out.suggested_qty_purchase == 0
    assert out.suggested_qty_base == 0
    assert out.over_max_qty_base == 0
