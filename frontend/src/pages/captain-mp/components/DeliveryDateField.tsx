// Delivery date field (delivery-calendar). A native date input prefilled with
// the delivery-calendar proposal; the Captain may pick any other date — nothing
// blocks. The hint line names the proposal, offers "Przywróć" once the date was
// changed, or warns that the supplier has no calendar (fallback proposal).

import { CalendarDays } from "lucide-react";
import { useT } from "../../../i18n";
import { DELIVERY_DATE_FORMAT, warsawTodayIso } from "../../../lib/dates";
import type { DeliveryProposal } from "../../../types";

interface DeliveryDateFieldProps {
  /** Chosen date, "YYYY-MM-DD". */
  value: string;
  proposal: DeliveryProposal | null;
  onChange: (date: string) => void;
  onRestore: () => void;
}

export function DeliveryDateField({
  value,
  proposal,
  onChange,
  onRestore,
}: DeliveryDateFieldProps) {
  const { t, formatDateTime } = useT();
  const ruleBased = proposal !== null && proposal.source !== "fallback";
  const proposedLabel = proposal
    ? formatDateTime(proposal.proposed_delivery_date, DELIVERY_DATE_FORMAT)
    : "";
  const changed = ruleBased && value !== proposal.proposed_delivery_date;

  return (
    <div className="mb-4">
      <label
        htmlFor="order-delivery-date"
        className="block text-xs font-semibold text-slate-700 mb-1"
      >
        {t("deliveryCalendar.dateLabel")}
      </label>
      <input
        id="order-delivery-date"
        type="date"
        value={value}
        min={warsawTodayIso()}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div
        className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500"
        data-testid="delivery-date-hint"
      >
        <CalendarDays size={12} aria-hidden="true" className="shrink-0" />
        {!ruleBased && <span>{t("deliveryCalendar.fallback")}</span>}
        {ruleBased && !changed && (
          <span>{t("deliveryCalendar.proposed", { date: proposedLabel })}</span>
        )}
        {changed && (
          <>
            <span className="text-amber-700 font-semibold">
              {t("deliveryCalendar.changed", { date: proposedLabel })}
            </span>
            <button
              type="button"
              onClick={onRestore}
              className="font-semibold text-brand hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              {t("deliveryCalendar.restore")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
