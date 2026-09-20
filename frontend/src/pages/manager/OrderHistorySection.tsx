// Collapsible "Historia zmian" for one order's post-send edit log
// (week2-feedback-quantities Phase 6) — the order-level twin of
// transport/HistorySection.tsx: time, event-type label, actor, verbatim
// server-computed details ("Name: old → new"). Omitted entirely by the caller
// when there are no events.

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { useT } from "../../i18n";
import type { OrderEvent } from "../../types";
import { orderEventTypeLabel, sortOrderEvents } from "./lib/orderEvents";

interface OrderHistorySectionProps {
  events: OrderEvent[];
}

export function OrderHistorySection({ events }: OrderHistorySectionProps) {
  const { t, formatDateTime } = useT();
  const [open, setOpen] = useState(false);
  const sorted = sortOrderEvents(events);

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span>
          {t("manager.events.title")}
          {sorted.length > 0 ? ` (${sorted.length})` : ""}
        </span>
        {open ? (
          <ChevronUp size={16} aria-hidden="true" />
        ) : (
          <ChevronDown size={16} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3 py-2">
          <ul className="space-y-2">
            {sorted.map((ev) => (
              <li key={ev.event_id} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {ev.at ? formatDateTime(ev.at) : ""}
                  </span>
                  <span className="font-medium text-slate-900">
                    {orderEventTypeLabel(t, ev.event_type)}
                  </span>
                  {ev.actor && <span className="text-xs text-slate-500">· {ev.actor}</span>}
                </div>
                {ev.details && <div className="text-slate-700">{ev.details}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
