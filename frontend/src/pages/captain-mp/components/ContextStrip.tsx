// Sub-header strip — supplier name + delivery + cutoff banner.
// i18n-aware via useT().
//
// With a delivery-calendar proposal (delivery-calendar) the right side shows the
// Captain's 17:00 order deadline ("Zamów do dziś 17:00" / "Zamów do pon.
// 17:00") instead of the supplier cutoff, and a rule-based proposal names the
// delivery date on the left. Without one it keeps the legacy rendering.

import { Clock } from "lucide-react";
import type { Supplier } from "../types";
import type { DeliveryProposal } from "../../../types";
import { useT } from "../../../i18n";
import { DELIVERY_DATE_FORMAT, warsawTodayIso } from "../../../lib/dates";
import { getCutoffUrgency, getDeadlineUrgency, parseDeliveryDays } from "../lib/dates";

interface ContextStripProps {
  supplier: Supplier | null;
  proposal?: DeliveryProposal | null;
}

export function ContextStrip({ supplier, proposal = null }: ContextStripProps) {
  const { t, tPlural, formatDateTime } = useT();
  if (!supplier) return null;

  let urgency = getCutoffUrgency(supplier.cutoff_time);
  let cutoffText = supplier.cutoff_time
    ? t("dates.cutoff.value", { time: supplier.cutoff_time.trim() })
    : t("dates.cutoff.none");
  if (proposal) {
    const deadline = new Date(proposal.order_deadline);
    const time = formatDateTime(deadline, { hour: "2-digit", minute: "2-digit" });
    const sameDay = warsawTodayIso() === warsawTodayIso(deadline);
    cutoffText = sameDay
      ? t("deliveryCalendar.deadlineToday", { time })
      : t("deliveryCalendar.deadlineDay", {
          day: formatDateTime(deadline, { weekday: "short" }),
          time,
        });
    urgency = getDeadlineUrgency(proposal.order_deadline);
  }

  const parsed = parseDeliveryDays(supplier.delivery_days);
  let deliveryText: string;
  if (proposal && proposal.source !== "fallback") {
    deliveryText = t("deliveryCalendar.stripDelivery", {
      date: formatDateTime(proposal.proposed_delivery_date, DELIVERY_DATE_FORMAT),
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
