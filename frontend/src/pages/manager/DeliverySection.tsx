// Read-only "Dostawa / Delivery" section for the Manager order detail
// (manager-receiving-view). Renders an order's goods-receipts (0..N, already
// sorted newest-first by the backend) so the Manager closes the
// suggested→captain→manager→RECEIVED loop on their own screen.
//
// Mirrors the Captain receipt overlay (captain-mp/OrderDetailPage.tsx): delivered
// is the headline, ordered is secondary, and the variance pill uses the same hue
// family — sky for over-delivery, indigo for under — distinct from the queue's
// amber/red deviation signal.

import { roundQty } from "../../components/ui/number";
import { useT } from "../../i18n";
import type { ManagerOrderReceipt } from "../../types";

interface DeliverySectionProps {
  receipts: ManagerOrderReceipt[];
}

export function DeliverySection({ receipts }: DeliverySectionProps) {
  const { t, formatDateTime } = useT();
  if (receipts.length === 0) return null;

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">
        {t("manager.delivery.section")}
      </h3>
      <div className="space-y-3">
        {receipts.map((rc) => (
          <div
            key={rc.receipt_id}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            {/* Receipt header: when / who / discrepancy / missing WZ */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span>
                {t("delivery.confirmedAt", {
                  value: rc.received_submitted_at
                    ? formatDateTime(rc.received_submitted_at)
                    : rc.receipt_date,
                })}
              </span>
              {rc.received_by && (
                <span>{t("manager.delivery.receivedBy", { value: rc.received_by })}</span>
              )}
              {rc.discrepancy_count > 0 && (
                <span className="font-semibold text-amber-700">
                  {t("delivery.discrepancies", { count: rc.discrepancy_count })}
                </span>
              )}
              {rc.received_with_missing_wz && (
                <span className="text-slate-500">{t("delivery.missingWz")}</span>
              )}
            </div>

            {/* Per-line delivered vs ordered + variance pill */}
            <ul className="mt-2 space-y-1.5">
              {rc.lines.map((ln) => {
                const variance = roundQty(ln.variance_qty_purchase);
                return (
                  <li
                    key={ln.order_line_id}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-slate-200 pt-1.5 first:border-t-0 first:pt-0"
                  >
                    <span className="text-sm text-slate-800">{ln.product_name_pl}</span>
                    <span className="text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        {t("orders.detail.receivedLabel")}{" "}
                      </span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        {roundQty(ln.received_qty_purchase)} {ln.purchase_unit}
                      </span>
                      <span className="ml-2 text-[11px] text-slate-500">
                        {t("orders.detail.orderedSecondary", {
                          value: roundQty(ln.ordered_qty_purchase),
                          unit: ln.purchase_unit,
                        })}
                      </span>
                      {variance !== 0 && (
                        <span
                          className={`ml-2 text-xs font-semibold ${
                            variance > 0 ? "text-sky-700" : "text-indigo-700"
                          }`}
                        >
                          {t("delivery.variance", {
                            value: `${variance > 0 ? "+" : ""}${variance} ${ln.purchase_unit}`,
                          })}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
