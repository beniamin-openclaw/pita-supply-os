// Pure helpers for the order post-send edit log (week2-feedback-quantities
// Phase 6) — label mapping + newest-first sort, kept out of the component file
// (react-refresh) and mirroring lib/transport.ts's event helpers.

import type { StringKey } from "../../../i18n";
import type { OrderEvent } from "../../../types";

type TFunc = (key: StringKey, vars?: Record<string, string | number>) => string;

const EVENT_TYPE_LABEL_KEYS: Record<string, StringKey> = {
  quantities_changed: "manager.events.type.quantitiesChanged",
  line_added: "manager.events.type.lineAdded",
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

