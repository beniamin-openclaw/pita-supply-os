// Sub-header strip — supplier name + delivery + cutoff banner.
// i18n-aware via useT().

import { Clock } from "lucide-react";
import type { Supplier } from "../types";
import { useT } from "../../../i18n";
import { getCutoffUrgency, parseDeliveryDays } from "../lib/dates";

interface ContextStripProps {
  supplier: Supplier | null;
  // Concrete delivery window (ISO dates) when the screen carries a dynamic
  // target (dynamic-target-wola): "dostawa wt 08.09 · następna sb 12.09"
  // replaces the literal delivery_days text. Null/undefined = today's strip.
  deliveryWindow?: { delivery: string; next: string } | null;
}

export function ContextStrip({ supplier, deliveryWindow }: ContextStripProps) {
  const { t, tPlural, formatDateTime } = useT();
  if (!supplier) return null;

  const urgency = getCutoffUrgency(supplier.cutoff_time);
  const cutoffText = supplier.cutoff_time
    ? t("dates.cutoff.value", { time: supplier.cutoff_time.trim() })
    : t("dates.cutoff.none");

  const parsed = parseDeliveryDays(supplier.delivery_days);
  const fmtDay = (iso: string) =>
    formatDateTime(`${iso}T12:00:00`, { weekday: "short", day: "2-digit", month: "2-digit" });
  let deliveryText: string;
  if (deliveryWindow) {
    deliveryText = t("dates.delivery.window", {
      delivery: fmtDay(deliveryWindow.delivery),
      next: fmtDay(deliveryWindow.next),
    });
  } else if (!parsed) {
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
    <div className="bg-brand-subtle px-4 py-2 flex justify-between items-center gap-3 text-xs">
      <div className="text-slate-800 font-medium break-words min-w-0 pr-4">
        {supplier.supplier_name} · {deliveryText}
      </div>
      <div className={`${urgencyColor} font-semibold flex items-center gap-1 shrink-0`}>
        <Clock size={12} aria-hidden="true" />
        {cutoffText}
      </div>
    </div>
  );
}
