// Supplier-level notices on the Captain order screen (captain-sent-today,
// WP6 + D10 A):
//  - amber "an order to this supplier already went out today (time)" — a
//    second order is still allowed, the confirm dialog asks once more;
//  - info "you already have an open order with this supplier (date, status)".
// Each links to that order, so the Captain can check — or, while it is still
// "U menedżera", edit — it instead of sending a duplicate. Never blocks submit.

import { AlertTriangle, Info } from "lucide-react";

import { useT } from "../../../i18n";
import { STRINGS, type StringKey } from "../../../i18n/strings";
import { formatDayMonth } from "../../../lib/dates";
import { SENT_TIME_FORMAT } from "../lib/sentToday";
import type { CaptainSupplierOrderRef } from "../types";

interface SupplierOrderNoticesProps {
  supplierName: string;
  /** Newest order to this supplier sent today (server + this session). */
  sentToday: CaptainSupplierOrderRef | null;
  /** Newest open order with this supplier from the days before today. */
  openOrder: CaptainSupplierOrderRef | null;
  onShowOrder: (orderId: string) => void;
}

export function SupplierOrderNotices({
  supplierName,
  sentToday,
  openOrder,
  onShowOrder,
}: SupplierOrderNoticesProps) {
  const { t, formatDateTime } = useT();
  if (!sentToday && !openOrder) return null;

  const linkClass =
    "shrink-0 self-start text-xs font-semibold underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

  let openOrderText = "";
  if (openOrder) {
    const statusKey = `orders.status.${openOrder.status}` as StringKey;
    openOrderText = t("captain.openOrder", {
      date: formatDayMonth(openOrder.submitted_on),
      status: statusKey in STRINGS ? t(statusKey) : openOrder.status,
    });
  }

  return (
    <div className="mb-4 space-y-2">
      {sentToday && (
        <div
          role="status"
          data-testid="sent-today-notice"
          className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700" />
            <span className="break-words">
              {sentToday.captain_submitted_at
                ? t("captain.sentToday", {
                    supplier: supplierName,
                    time: formatDateTime(sentToday.captain_submitted_at, SENT_TIME_FORMAT),
                  })
                : t("captain.sentTodayNoTime", { supplier: supplierName })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onShowOrder(sentToday.order_id)}
            className={`${linkClass} text-amber-900 focus-visible:ring-amber-500`}
          >
            {t("captain.showOrder")}
          </button>
        </div>
      )}
      {openOrder && (
        <div
          data-testid="open-order-notice"
          className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800"
        >
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-500" />
            <span className="break-words">{openOrderText}</span>
          </div>
          <button
            type="button"
            onClick={() => onShowOrder(openOrder.order_id)}
            className={`${linkClass} text-brand focus-visible:ring-blue-500`}
          >
            {t("captain.showOrder")}
          </button>
        </div>
      )}
    </div>
  );
}
