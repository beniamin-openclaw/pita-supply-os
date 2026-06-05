"""Suggestion engine — v0 simple, explainable.

Formula:
    suggested_qty_base = max(0, target - current)
    suggested_qty_purchase = round_per_rule(
        suggested_qty_base / units_per_purchase_unit,
        rounding_rule,
    )

No averages, no AI, no weekday logic in v0. Just stock-deficit and rounding.
Explainability is the value proposition.

Hardening:
- Rejects NaN / Infinity / negative inputs at the function boundary
  (Pydantic also rejects at the API boundary; this is defense-in-depth).
- Suppresses IEEE-754 multiplication artifacts via _clean (6-decimal round).
"""
import math
from dataclasses import dataclass

from .models import RoundingRule

_PRECISION = 6  # decimals to keep when cleaning float outputs


@dataclass
class SuggestionInput:
    current_stock_qty_base: float
    target_stock_qty_base: float
    max_stock_qty_base: float
    units_per_purchase_unit: float
    rounding_rule: RoundingRule = RoundingRule.FULL_ONLY
    is_critical: bool = False
    allow_over_max_due_to_packaging: bool = False


@dataclass
class SuggestionOutput:
    suggested_qty_base: float
    suggested_qty_purchase: float
    over_max_qty_base: float
    explanation: str


def _validate_finite_nonneg(name: str, value: float) -> None:
    if math.isnan(value):
        raise ValueError(f"{name} must not be NaN")
    if math.isinf(value):
        raise ValueError(f"{name} must be finite, got {value}")
    if value < 0:
        raise ValueError(f"{name} must be >= 0, got {value}")


def _clean(x: float) -> float:
    """Round to `_PRECISION` decimal places to suppress IEEE-754 artifacts."""
    return round(x, _PRECISION)


def _round_per_rule(raw: float, rule: RoundingRule, is_critical: bool) -> float:
    if raw <= 0:
        return 0.0
    if rule == RoundingRule.FULL_ONLY:
        return float(math.ceil(raw))
    if rule == RoundingRule.HALF_ALLOWED:
        return round(raw * 2) / 2
    if rule == RoundingRule.UP_FOR_CRITICAL:
        if is_critical:
            return float(math.ceil(raw))
        return float(round(raw))
    if rule == RoundingRule.TENTH_KG:
        # Ceil up to the next 0.1 (never under-order). Pre-clean the scaled
        # value before ceil: raw*10 can land a hair above an integer
        # (2.3 * 10 == 23.000000000000004) and ceil to the wrong tenth.
        return math.ceil(round(raw * 10, _PRECISION)) / 10
    return float(math.ceil(raw))


def rounding_step(rule: RoundingRule) -> float:
    """Smallest purchase-unit increment a rule can emit.

    Used as the deviation-gate denominator floor (`max(suggested, step)`) so the
    >20% gate stays meaningful for sub-1.0 suggestions. `FULL_ONLY` /
    `UP_FOR_CRITICAL` snap to whole units (1.0), keeping the gate byte-identical
    to the original hardcoded `max(suggested, 1.0)` for those rules.
    """
    if rule == RoundingRule.HALF_ALLOWED:
        return 0.5
    if rule == RoundingRule.TENTH_KG:
        return 0.1
    return 1.0


def compute_suggestion(inp: SuggestionInput) -> SuggestionOutput:
    _validate_finite_nonneg("current_stock_qty_base", inp.current_stock_qty_base)
    _validate_finite_nonneg("target_stock_qty_base", inp.target_stock_qty_base)
    _validate_finite_nonneg("max_stock_qty_base", inp.max_stock_qty_base)
    if math.isnan(inp.units_per_purchase_unit) or math.isinf(inp.units_per_purchase_unit):
        raise ValueError(
            f"units_per_purchase_unit must be finite, got {inp.units_per_purchase_unit}"
        )
    if inp.units_per_purchase_unit <= 0:
        raise ValueError(
            f"units_per_purchase_unit must be > 0, got {inp.units_per_purchase_unit}"
        )

    needed_base = max(0.0, inp.target_stock_qty_base - inp.current_stock_qty_base)
    raw_purchase = needed_base / inp.units_per_purchase_unit
    suggested_purchase = _round_per_rule(raw_purchase, inp.rounding_rule, inp.is_critical)
    suggested_base = _clean(suggested_purchase * inp.units_per_purchase_unit)

    over_max = _clean(
        max(0.0, (inp.current_stock_qty_base + suggested_base) - inp.max_stock_qty_base)
    )

    if suggested_purchase == 0:
        explanation = "stock at or above target — no order needed"
    else:
        explanation = (
            f"need {needed_base:g} → {suggested_purchase:g} purchase unit"
            f"{'s' if suggested_purchase != 1 else ''}"
        )
        if over_max > 0 and not inp.allow_over_max_due_to_packaging:
            explanation += f" (exceeds max by {over_max:g})"

    return SuggestionOutput(
        suggested_qty_base=suggested_base,
        suggested_qty_purchase=suggested_purchase,
        over_max_qty_base=over_max,
        explanation=explanation,
    )
