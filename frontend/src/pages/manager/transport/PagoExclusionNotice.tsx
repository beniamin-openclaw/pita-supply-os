// Informational banner surfacing which of a Pago batch's positive-qty lines
// the "odbiór magazynowy" (warehouse pickup) self-pickup document silently
// drops (training-feedback-0901 F0/F7) — mirrors WeightStrip's small
// amber-text warning idiom (WeightStrip.tsx:53-57). All math/derivation lives
// in lib/transport.ts's computePagoWarehouseExclusion; this component is
// purely presentational.
//
// NAMES, never a count: warehouse_pickup=false is the NORMAL state for most
// of a mixed Pago batch (till rolls, napkins, trays purchased through Pago
// but never physically collected there), so a count would fire on nearly
// every batch and get tuned out — a list of names is actionable.
//
// Renders nothing for a non-Pago batch, or when there is nothing to say.

import { useT } from "../../../i18n";
import type { PagoWarehouseExclusion } from "../lib/transport";

interface PagoExclusionNoticeProps {
  exclusion: PagoWarehouseExclusion;
}

export function PagoExclusionNotice({ exclusion }: PagoExclusionNoticeProps) {
  const { t } = useT();

  if (!exclusion.isPago) return null;
  if (!exclusion.warehousePickupDataMissing && exclusion.excludedProducts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-amber-700">
      {exclusion.warehousePickupDataMissing
        ? t("manager.transport.pagoExclusion.dataMissing")
        : t("manager.transport.pagoExclusion.excluded", {
            products: exclusion.excludedProducts.join(", "),
          })}
    </div>
  );
}
