// Minimum-order indicator chip (training-feedback-0901 Phase 1c). Rendered
// next to the estimated total on three screens — Manager order detail,
// Manager queue card, Captain order detail. Purely informational: a neutral
// chip at/above the minimum, a warning chip below it. Renders nothing when
// there is no total to compare (checkMinimumOrder -> "unknown"). NEVER
// disables or gates any button, submit, or dispatch — see lib/minimumOrder.ts.

import { useT } from "../../i18n";
import { checkMinimumOrder } from "../../lib/minimumOrder";

interface MinimumOrderChipProps {
  /** Order's estimated total (total_value_estimate_pln). */
  total: number | null | undefined;
  /** Supplier's configured minimum (minimum_order_value_pln); missing falls
   *  back to the 400 PLN default inside checkMinimumOrder. */
  minimum: number | null | undefined;
}

export function MinimumOrderChip({ total, minimum }: MinimumOrderChipProps) {
  const { t } = useT();
  const { status, threshold } = checkMinimumOrder(total, minimum);
  if (status === "unknown") return null;

  const met = status === "met";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${
        met ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-900"
      }`}
    >
      {t(met ? "minOrder.met" : "minOrder.below", { minimum: threshold.toFixed(2) })}
    </span>
  );
}
