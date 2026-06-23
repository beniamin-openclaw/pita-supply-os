// One line on the goods-receipt screen (GR-01): shows the ordered quantity and
// takes the delivered quantity, surfacing a variance badge when they differ.

import { AlertOctagon } from "lucide-react";
import { useT } from "../../../i18n";
import type { ManagerOrderLineDetail } from "../../../types";
import { DecimalInput } from "./DecimalInput";

interface ReceiptLineCardProps {
  line: ManagerOrderLineDetail;
  ordered: number;
  delivered: number | "";
  onChange: (orderLineId: string, value: number | "") => void;
}

export function ReceiptLineCard({ line, ordered, delivered, onChange }: ReceiptLineCardProps) {
  const { t } = useT();
  const variance = delivered === "" ? 0 : Number(delivered) - ordered;
  const showVariance = delivered !== "" && variance !== 0;
  const varianceText = `${variance > 0 ? "+" : ""}${variance} ${line.purchase_unit}`;

  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1 font-medium text-slate-900">
        {line.is_critical && (
          <AlertOctagon size={14} className="shrink-0 text-red-600" aria-hidden="true" />
        )}
        <span className="truncate">{line.product_name_pl}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-sm text-slate-600">
          {t("delivery.ordered")}:{" "}
          <span className="font-bold text-slate-900 tabular-nums text-base">
            {ordered} {line.purchase_unit}
          </span>
        </div>
        <label className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            {t("delivery.delivered")}
          </span>
          <DecimalInput
            inputMode="decimal"
            value={delivered}
            onChange={(v) => onChange(line.order_line_id, v)}
            className="mt-0.5 w-28 rounded-lg border border-slate-300 px-3 py-2 text-right text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={`${t("delivery.delivered")} — ${line.product_name_pl}`}
          />
        </label>
      </div>
      {showVariance && (
        <div
          className={`mt-1 text-right text-xs font-semibold ${
            variance > 0 ? "text-orange-700" : "text-red-700"
          }`}
        >
          {t("delivery.variance", { value: varianceText })}
        </div>
      )}
    </div>
  );
}
