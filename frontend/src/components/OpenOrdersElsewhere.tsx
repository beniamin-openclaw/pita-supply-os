// Amber info lines "already ordered at <other supplier>" for a product
// (krakow-katowice-rollout). Info only — never blocks input or submit. Shared
// by the Captain product card and the Manager order-line table.

import { Info } from "lucide-react";

import { useT } from "../i18n";
import { packUnitLabel } from "../i18n/packUnits";
import { STRINGS, type StringKey } from "../i18n/strings";
import { formatBaseQty } from "../lib/packStock";
import { formatDayMonth } from "../lib/dates";
import type { OpenOrderRef } from "../types";

interface OpenOrdersElsewhereProps {
  orders: OpenOrderRef[] | undefined;
  /** Which copy family to use: the Captain card or the Manager detail. */
  scope: "card" | "manager";
}

export function OpenOrdersElsewhere({ orders, scope }: OpenOrdersElsewhereProps) {
  const { t, lang } = useT();
  if (!orders || orders.length === 0) return null;

  const withDateKey: StringKey =
    scope === "card" ? "card.openOrderElsewhere" : "manager.detail.openElsewhere";
  const noDateKey: StringKey =
    scope === "card" ? "card.openOrderElsewhereNoDate" : "manager.detail.openElsewhereNoDate";

  return (
    <div className="space-y-1" data-testid="open-orders-elsewhere">
      {orders.map((o) => {
        const statusKey = `orders.status.${o.status}` as StringKey;
        const statusLabel = statusKey in STRINGS ? t(statusKey) : o.status;
        const unit = o.purchase_unit ? packUnitLabel(o.qty_purchase, o.purchase_unit, lang) : "";
        const hasDelivery = !!o.requested_delivery_date;
        const text = t(hasDelivery ? withDateKey : noDateKey, {
          supplier: o.supplier_name,
          qty: formatBaseQty(o.qty_purchase, lang),
          unit,
          status: statusLabel,
          date: formatDayMonth(hasDelivery ? o.requested_delivery_date! : o.order_date),
        });
        return (
          <div
            key={o.order_id}
            className="flex items-start gap-1 rounded bg-amber-50 px-1.5 py-1 text-xs text-amber-900"
          >
            <Info size={12} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
            <span className="break-words">{text}</span>
          </div>
        );
      })}
    </div>
  );
}
