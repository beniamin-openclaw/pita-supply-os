// Weight preview strip for the Transport batch detail (v2, to-ordering-pago
// ADDENDUM v2): Łączna waga / Limit / Do limitu / Ponad limit, plus a "brak
// wagi dla N pozycji" warning when some lines have no unit_weight_kg on their
// supplier_product yet (master data not filled in). Pure presentational —
// all math lives in lib/transport.ts's computeWeightStrip.

import { useT } from "../../../i18n";
import type { TransportBatchDetail } from "../../../types";
import { computeWeightStrip } from "../lib/transport";

interface WeightStripProps {
  detail: Pick<TransportBatchDetail, "total_weight_kg" | "limit_kg" | "unknown_weight_count">;
}

export function WeightStrip({ detail }: WeightStripProps) {
  const { t } = useT();
  const strip = computeWeightStrip(detail);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("manager.transport.weight.totalLabel")}
          </span>{" "}
          <span className="font-semibold text-slate-900">{strip.totalKg} kg</span>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("manager.transport.weight.limitLabel")}
          </span>{" "}
          <span className="text-slate-800">
            {strip.limitKg != null ? `${strip.limitKg} kg` : t("manager.transport.weight.noLimit")}
          </span>
        </div>
        {strip.limitKg != null && !strip.isOver && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("manager.transport.weight.remainingLabel")}
            </span>{" "}
            <span className="font-semibold text-green-700">{strip.remainingKg} kg</span>
          </div>
        )}
        {strip.isOver && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-red-600">
              {t("manager.transport.weight.overLabel")}
            </span>{" "}
            <span className="font-semibold text-red-700">{strip.overKg} kg</span>
          </div>
        )}
      </div>
      {strip.unknownCount > 0 && (
        <div className="mt-2 text-xs font-medium text-amber-700">
          {t("manager.transport.weight.unknownWarning", { count: strip.unknownCount })}
        </div>
      )}
    </div>
  );
}
