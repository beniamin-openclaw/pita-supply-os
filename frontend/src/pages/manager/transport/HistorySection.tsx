// Collapsible "Historia zmian" (change history) section for a Transport batch
// detail (v3 Phase 6, to-ordering-pago ADDENDUM v3) — renders the append-only
// event log (newest first): time, event-type label, actor, and the verbatim
// details string the backend already computed ("field: old → new" diffs).
// Shown on BOTH draft and sent batch detail. Pure presentational; sorting +
// label mapping live in lib/transport.ts.

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { useT } from "../../../i18n";
import type { TransportEvent } from "../../../types";
import { sortTransportEvents, transportEventTypeLabel } from "../lib/transport";

interface HistorySectionProps {
  events: TransportEvent[];
}

export function HistorySection({ events }: HistorySectionProps) {
  const { t, formatDateTime } = useT();
  const [open, setOpen] = useState(false);
  const sorted = sortTransportEvents(events);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span>
          {t("manager.transport.events.title")}
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
          {sorted.length === 0 ? (
            <div className="text-sm text-slate-500">{t("manager.transport.events.empty")}</div>
          ) : (
            <ul className="space-y-2">
              {sorted.map((ev) => (
                <li key={ev.event_id} className="text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs text-slate-500 tabular-nums">
                      {ev.at ? formatDateTime(ev.at) : ""}
                    </span>
                    <span className="font-medium text-slate-900">
                      {transportEventTypeLabel(t, ev.event_type)}
                    </span>
                    {ev.actor && <span className="text-xs text-slate-500">· {ev.actor}</span>}
                  </div>
                  {ev.details && <div className="text-slate-700">{ev.details}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
