// Sub-header strip — supplier name + delivery + cutoff banner.
// i18n-aware via useT().

import { Clock } from "lucide-react";
import type { Supplier } from "../types";
import { useT } from "../../../i18n";
import { getCutoffUrgency, parseDeliveryDays } from "../lib/dates";

interface ContextStripProps {
  supplier: Supplier | null;
}

export function ContextStrip({ supplier }: ContextStripProps) {
  const { t, tPlural } = useT();
  if (!supplier) return null;

  const urgency = getCutoffUrgency(supplier.cutoff_time);
  const cutoffText = supplier.cutoff_time
    ? t("dates.cutoff.value", { time: supplier.cutoff_time.trim() })
    : t("dates.cutoff.none");

  const parsed = parseDeliveryDays(supplier.delivery_days);
  let deliveryText: string;
  if (!parsed) {
    deliveryText = t("dates.delivery.unsetText");
  } else if (parsed.kind === "days") {
    deliveryText = tPlural("dates.delivery", "days", parsed.n);
  } else {
    deliveryText = t("dates.delivery.weekdayPrefix", { days: parsed.literal });
  }

  const urgencyColor =
    urgency === "danger"
      ? "text-red-700"
      : urgency === "warn"
        ? "text-orange-700"
        : "text-slate-700";

  return (
    <div className="bg-brand-subtle px-4 py-2 flex justify-between items-center text-xs">
      <div className="text-slate-800 font-medium truncate pr-4">
        {supplier.supplier_name} · {deliveryText}
      </div>
      <div className={`${urgencyColor} font-semibold flex items-center gap-1 shrink-0`}>
        <Clock size={12} aria-hidden="true" />
        {cutoffText}
      </div>
    </div>
  );
}
