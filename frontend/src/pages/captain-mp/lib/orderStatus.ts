// Opcja 1 pipeline-stage badge config. The badge tells the captain WHERE the
// order is in the flow (color + dot); editability is a separate signal.

import type { OrderStatus } from "../../../types";
import type { StringKey } from "../../../i18n/strings";

export interface StatusVisual {
  /** Tailwind classes for the badge pill (bg + text + border). */
  pill: string;
  /** Tailwind class for the leading status dot. */
  dot: string;
  /** i18n key for the label. */
  labelKey: StringKey;
}

export const STATUS_VISUALS: Record<OrderStatus, StatusVisual> = {
  draft: {
    pill: "bg-gray-100 text-gray-700 border-gray-300",
    dot: "bg-gray-400",
    labelKey: "orders.status.draft",
  },
  captain_submitted: {
    pill: "bg-blue-100 text-blue-900 border-blue-300",
    dot: "bg-blue-600",
    labelKey: "orders.status.captain_submitted",
  },
  manager_claimed: {
    pill: "bg-orange-100 text-orange-900 border-orange-300",
    dot: "bg-orange-500",
    labelKey: "orders.status.manager_claimed",
  },
  manager_sent: {
    pill: "bg-green-100 text-green-900 border-green-300",
    dot: "bg-green-600",
    labelKey: "orders.status.manager_sent",
  },
  closed: {
    pill: "bg-slate-200 text-slate-700 border-slate-300",
    dot: "bg-slate-500",
    labelKey: "orders.status.closed",
  },
  cancelled: {
    pill: "bg-slate-200 text-slate-600 border-slate-300",
    dot: "bg-slate-400",
    labelKey: "orders.status.cancelled",
  },
};

export function statusVisual(status: OrderStatus): StatusVisual {
  return STATUS_VISUALS[status] ?? STATUS_VISUALS.draft;
}
