// Pure helpers for the order post-send edit log (week2-feedback-quantities
// Phase 6) — label mapping + newest-first sort, kept out of the component file
// (react-refresh) and mirroring lib/transport.ts's event helpers.

import type { StringKey } from "../../../i18n";
import type { OrderEvent } from "../../../types";

type TFunc = (key: StringKey, vars?: Record<string, string | number>) => string;

/** order_events type of a Manager close without receipt (backend
 *  `_CLOSED_WITHOUT_RECEIPT_EVENT`, close-without-receipt D5). */
export const CLOSED_WITHOUT_RECEIPT_EVENT = "closed_without_receipt";

const EVENT_TYPE_LABEL_KEYS: Record<string, StringKey> = {
  quantities_changed: "manager.events.type.quantitiesChanged",
  line_added: "manager.events.type.lineAdded",
  [CLOSED_WITHOUT_RECEIPT_EVENT]: "manager.events.type.closedWithoutReceipt",
  close_reverted: "manager.events.type.closeReverted",
};

export function orderEventTypeLabel(t: TFunc, eventType: string): string {
  const key = EVENT_TYPE_LABEL_KEYS[eventType];
  return key ? t(key) : eventType;
}

/** Newest first; a null `at` sorts last rather than crashing the sort. */
export function sortOrderEvents(events: OrderEvent[]): OrderEvent[] {
  return [...events].sort((a, b) => {
    const at = a.at ? Date.parse(a.at) : 0;
    const bt = b.at ? Date.parse(b.at) : 0;
    return bt - at;
  });
}

