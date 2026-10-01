"""Suggestion engine — v0 simple, explainable.

Formula:
    suggested_qty_base = max(0, target - current)
    suggested_qty_purchase = round_per_rule(
        suggested_qty_base / units_per_purchase_unit,
        rounding_rule,
    )

No averages, no AI, no weekday logic in v0. Just stock-deficit and rounding.
Explainability is the value proposition.

Bulk packs (feedback-1001-names-units D33, migration 0028): when the supplier
product carries a case (``units_per_case`` purchase units per karton /
skrzynka / worek), the per-rule rounded need is rounded again to the NEAREST
whole case, half up:

    need_qty_purchase      = round_per_rule(...)            (as above)
    suggested_qty_purchase = round_half_up(need / units_per_case) × units_per_case

Without a case the suggestion IS the need, byte-for-byte as before. The reason
gates measure the order against the nearer of the two (``deviation_reference``,
D34). Twin: frontend/src/pages/captain-mp/lib/compute.ts; the shared examples
live in docs/pita-supply-os-v1/fixtures/case_suggestion_cases.json.

Hardening:
- Rejects NaN / Infinity / negative inputs at the function boundary
  (Pydantic also rejects at the API boundary; this is defense-in-depth).
- Suppresses IEEE-754 multiplication artifacts via _clean (6-decimal round).
"""
import math
from dataclasses import dataclass
from typing import Optional

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
    # Purchase units per bulk pack (migration 0028); None = no case.
    units_per_case: Optional[float] = None


@dataclass
class SuggestionOutput:
    suggested_qty_base: float
    # The case suggestion (the nearest whole case); equals the need without one.
    suggested_qty_purchase: float
    over_max_qty_base: float
    explanation: str
    # The per-rule rounded need before case rounding (D34's other reference).
    # Not persisted — order_lines keeps only the case suggestion.
    need_qty_purchase: float


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


def round_half_up(x: float) -> int:
    """Nearest integer, halves UP: 0.5 → 1, 1.5 → 2, 2.5 → 3.

    Python's ``round()`` is banker's rounding (0.5 → 0, 2.5 → 2) and drifted
    from the frontend's ``Math.round`` (plan-review F4). Pre-cleaned to 6
    decimals so a float artefact (2.4999999999999996) lands on the half it
    means. Twin: ``roundHalfUp`` in compute.ts."""
    return math.floor(_clean(x) + 0.5)


def has_case(units_per_case: Optional[float]) -> bool:
    """True when a bulk pack is configured (> 1 purchase unit per case)."""
    return (
        units_per_case is not None
        and math.isfinite(units_per_case)
        and units_per_case > 1
    )


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
        return float(round_half_up(raw))
    if rule == RoundingRule.TENTH_KG:
        # Ceil up to the next 0.1 (never under-order). Pre-clean the scaled
        # value before ceil: raw*10 can land a hair above an integer
        # (2.3 * 10 == 23.000000000000004) and ceil to the wrong tenth.
        return math.ceil(round(raw * 10, _PRECISION)) / 10
    return float(math.ceil(raw))


def rounding_step(rule: RoundingRule) -> float:
    """Smallest purchase-unit increment a rule can emit.

    Used as the deviation-gate denominator floor (`max(suggested, step)`) so the
    >25% gate stays meaningful for sub-1.0 suggestions. `FULL_ONLY` /
    `UP_FOR_CRITICAL` snap to whole units (1.0), keeping the gate byte-identical
    to the original hardcoded `max(suggested, 1.0)` for those rules.
    """
    if rule == RoundingRule.HALF_ALLOWED:
        return 0.5
    if rule == RoundingRule.TENTH_KG:
        return 0.1
    return 1.0


def case_suggestion(need_purchase: float, units_per_case: Optional[float]) -> float:
    """D33: the need rounded to the nearest whole case, half up (need 2 kg of a
    6 kg crate → 0, 3 → 6, 4 → 6, 10 → 12). The need itself without a case."""
    if not has_case(units_per_case) or need_purchase <= 0:
        return need_purchase
    assert units_per_case is not None  # narrowed by has_case
    return _clean(round_half_up(need_purchase / units_per_case) * units_per_case)


def deviation_reference(final: float, need: float, suggested: float) -> float:
    """D34: the reference the Captain's order is measured against — the nearer
    of the need and the case suggestion, ties going to the need. Without a case
    both are equal, so this is the suggestion as before."""
    return need if abs(final - need) <= abs(final - suggested) else suggested


def case_rounded_max(
    max_base: float, units_per_purchase_unit: float, units_per_case: Optional[float]
) -> float:
    """D34: the storage ceiling the uncounted over-MAX gate allows — max rounded
    UP to a whole case, ``ceil(max / (upc·upp)) · upc·upp``; max itself
    without a case."""
    if not has_case(units_per_case) or max_base <= 0:
        return max_base
    assert units_per_case is not None  # narrowed by has_case
    pack_base = units_per_case * units_per_purchase_unit
    return _clean(math.ceil(_clean(max_base / pack_base)) * pack_base)


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

    # A units_per_case of 1 or less (impossible on Postgres, CHECK in 0028) reads
    # as "no case" via has_case — never an error on the submit path.
    needed_base = max(0.0, inp.target_stock_qty_base - inp.current_stock_qty_base)
    raw_purchase = needed_base / inp.units_per_purchase_unit
    need_purchase = _round_per_rule(raw_purchase, inp.rounding_rule, inp.is_critical)
    suggested_purchase = case_suggestion(need_purchase, inp.units_per_case)
    suggested_base = _clean(suggested_purchase * inp.units_per_purchase_unit)

    over_max = _clean(
        max(0.0, (inp.current_stock_qty_base + suggested_base) - inp.max_stock_qty_base)
    )
    # Over max only because the need was rounded up to a whole case counts as
    # packaging (D34): no "exceeds max" note then.
    need_over_max = _clean(
        max(
            0.0,
            inp.current_stock_qty_base
            + need_purchase * inp.units_per_purchase_unit
            - inp.max_stock_qty_base,
        )
    )

    if need_purchase == 0:
        explanation = "stock at or above target — no order needed"
    else:
        explanation = (
            f"need {needed_base:g} → {need_purchase:g} purchase unit"
            f"{'s' if need_purchase != 1 else ''}"
        )
        if suggested_purchase != need_purchase:
            explanation += (
                f" → {suggested_purchase:g} in whole cases of {inp.units_per_case:g}"
            )
        if (
            over_max > 0
            and not inp.allow_over_max_due_to_packaging
            and need_over_max > 0
        ):
            explanation += f" (exceeds max by {over_max:g})"

    return SuggestionOutput(
        suggested_qty_base=suggested_base,
        suggested_qty_purchase=suggested_purchase,
        over_max_qty_base=over_max,
        explanation=explanation,
        need_qty_purchase=need_purchase,
    )
