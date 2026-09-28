// Delivery-date deviation marker (delivery-calendar). Subtle amber line, styled
// like the inventory "Uwaga" flag (ManagerInventoryPage): rendered ONLY when the
// Captain's chosen date and the stored calendar proposal both exist and differ.
// Legacy orders and fallback proposals (no `suggested_delivery_date`) render
// nothing.

import { AlertTriangle } from "lucide-react";
import { useT } from "../../i18n";
import { DELIVERY_DATE_FORMAT } from "../../lib/dates";

interface DeliveryDateMarkerProps {
  requested?: string | null;
  suggested?: string | null;
  variant: "queue" | "detail";
}

export function DeliveryDateMarker({ requested, suggested, variant }: DeliveryDateMarkerProps) {
  const { t, formatDateTime } = useT();
  if (!requested || !suggested || requested === suggested) return null;
  const chosen = formatDateTime(requested, DELIVERY_DATE_FORMAT);
  const proposed = formatDateTime(suggested, DELIVERY_DATE_FORMAT);
  return (
    <span
      data-testid="delivery-date-marker"
      title={t("manager.deliveryMarker.title", { chosen, proposed })}
      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"
    >
      <AlertTriangle size={12} aria-hidden="true" />
      {variant === "queue"
        ? t("manager.deliveryMarker.queue", { chosen, proposed })
        : t("manager.deliveryMarker.detail", { proposed })}
    </span>
  );
}
