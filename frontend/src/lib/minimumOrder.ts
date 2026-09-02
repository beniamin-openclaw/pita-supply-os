// Minimum-order threshold check (training-feedback-0901 Phase 1c). Cross-
// feature: used by the Manager order detail, the Manager queue, and the
// Captain order detail (three separate screens), all comparing the same
// `total_value_estimate_pln` against the same joined
// `minimum_order_value_pln`. Purely informational — this helper only
// classifies a number for a chip; nothing server-side reads it and nothing
// here may gate submit/dispatch (the operator was explicit: "to nie jest
// twarda kontrola, tylko informacja").

/** Frontend-only fallback when a supplier has no configured minimum. The
 *  backend deliberately carries no default (`Supplier.minimum_order_value_pln:
 *  Optional[float] = None`), so this constant lives ONLY here. */
export const DEFAULT_MINIMUM_ORDER_VALUE_PLN = 400;

export type MinimumOrderStatus = "met" | "below" | "unknown";

export interface MinimumOrderCheck {
  status: MinimumOrderStatus;
  /** The threshold actually used for the comparison — the supplier's
   *  configured minimum, or the 400 PLN fallback when it is missing. */
  threshold: number;
}

/**
 * Compare an order's estimated total against its supplier's minimum order
 * value.
 *  - `minimum` null/undefined -> falls back to `DEFAULT_MINIMUM_ORDER_VALUE_PLN`.
 *    `0` is a real, explicit minimum and is never treated as "missing"
 *    (nullish coalescing, not `||`).
 *  - `total` null/undefined -> status "unknown" (nothing to compare — the
 *    caller should render no chip rather than claim "below" against a blank
 *    total).
 *  - otherwise -> "met" when `total >= threshold`, else "below".
 */
export function checkMinimumOrder(
  total: number | null | undefined,
  minimum: number | null | undefined,
): MinimumOrderCheck {
  const threshold = minimum ?? DEFAULT_MINIMUM_ORDER_VALUE_PLN;
  if (total == null) return { status: "unknown", threshold };
  return { status: total >= threshold ? "met" : "below", threshold };
}
