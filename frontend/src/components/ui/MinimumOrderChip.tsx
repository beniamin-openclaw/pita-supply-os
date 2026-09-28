// Minimum-order indicator chip (training-feedback-0901 Phase 1c). Rendered
// next to the estimated total on three screens — Manager order detail,
// Manager queue card, Captain order detail.
//
// Warns ONLY. An order at or above the minimum renders NOTHING: a badge
// announcing that everything is fine is noise on a queue the Manager scans
// dozens of times a day (operator feedback, 2026-09-02 — "musimy utrzymać
// czystość i przejrzystość"). The whole value of this indicator is the
// exception, so only the exception is drawn.
//
// Basis (supplier-product-order-minimum): some products ride on a supplier's
// delivery without counting toward its minimum (Bukat: Tzatzyki, Hot Feta,
// Feta). When the backend sends `minimum_basis_value_pln`, the chip compares
// THAT instead of the total and says how much counts; without it the chip
// behaves exactly as before.
//
// Renders nothing when there is no total to compare either
// (checkMinimumOrder -> "unknown"). NEVER disables or gates any button,
// submit, or dispatch — see lib/minimumOrder.ts.

import { useT } from "../../i18n";
import { checkMinimumOrder } from "../../lib/minimumOrder";

interface MinimumOrderChipProps {
  /** Order's estimated total (total_value_estimate_pln). */
  total: number | null | undefined;
  /** Supplier's configured minimum (minimum_order_value_pln); missing falls
   *  back to the 400 PLN default inside checkMinimumOrder. */
  minimum: number | null | undefined;
  /** Part of the total that counts toward the minimum
   *  (minimum_basis_value_pln); null/undefined = the whole total counts. */
  basis?: number | null;
}

export function MinimumOrderChip({ total, minimum, basis }: MinimumOrderChipProps) {
  const { t } = useT();
  const hasBasis = basis != null;
  const { status, threshold } = checkMinimumOrder(hasBasis ? basis : total, minimum);
  // "met" and "unknown" both render nothing — see the header comment.
  if (status !== "below") return null;

  return (
    <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
      {hasBasis
        ? t("minOrder.belowBasis", {
            minimum: threshold.toFixed(2),
            basis: basis.toFixed(2),
          })
        : t("minOrder.below", { minimum: threshold.toFixed(2) })}
    </span>
  );
}
