// Left pane of the Manager v2 two-pane shell (Phase G1). Three collapsible
// groups (captain_submitted / manager_claimed / manager_sent), each fed by a
// separate managerQueue call in the parent. Cards are selectable; the selected
// card is highlighted and selection survives the 60s refresh (the parent keeps
// selectedId in state independent of the queue data).

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { useT } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import type { ManagerQueueItem } from "../../types";

interface QueueGroup {
  key: string;
  titleKey: StringKey;
  accent: string;
  items: ManagerQueueItem[] | null;
}

interface ManagerQueueProps {
  submitted: ManagerQueueItem[] | null;
  claimed: ManagerQueueItem[] | null;
  sent: ManagerQueueItem[] | null;
  selectedId: string | null;
  onSelect: (orderId: string) => void;
}

export function ManagerQueue({
  submitted,
  claimed,
  sent,
  selectedId,
  onSelect,
}: ManagerQueueProps) {
  const groups: QueueGroup[] = [
    { key: "submitted", titleKey: "manager.tab.submitted", accent: "text-blue-800", items: submitted },
    { key: "claimed", titleKey: "manager.tab.claimed", accent: "text-orange-700", items: claimed },
    { key: "sent", titleKey: "manager.tab.sent", accent: "text-green-700", items: sent },
  ];

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <QueueGroupSection
          key={group.key}
          group={group}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function QueueGroupSection({
  group,
  selectedId,
  onSelect,
}: {
  group: QueueGroup;
  selectedId: string | null;
  onSelect: (orderId: string) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(true);
  const count = group.items?.length ?? 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-expanded={open}
      >
        <span className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${group.accent}`}>
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          {t(group.titleKey)}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 tabular-nums">
          {count}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-2">
          {group.items === null ? (
            <p className="px-2 py-3 text-xs text-slate-400">{t("manager.loading")}</p>
          ) : count === 0 ? (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
              {t("manager.queueEmptyGroup")}
            </div>
          ) : (
            <ul className="space-y-2">
              {group.items.map((q) => (
                <QueueCard
                  key={q.order_id}
                  item={q}
                  selected={q.order_id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function QueueCard({
  item,
  selected,
  onSelect,
}: {
  item: ManagerQueueItem;
  selected: boolean;
  onSelect: (orderId: string) => void;
}) {
  const { t, tPlural, formatDateTime } = useT();

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item.order_id)}
        aria-current={selected}
        className={`block w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          selected
            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-slate-900">
            {item.location_id} → {item.supplier_name}
          </span>
          {item.last_edited_at && (
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-purple-800">
              {t("orders.editedBadge")}
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
          <span>{tPlural("manager", "lines", item.line_count)}</span>
          <span aria-hidden="true">·</span>
          <span>{item.total_value_estimate_pln?.toFixed(2) ?? "?"} PLN</span>
          {item.deviation_count > 0 && (
            <span
              className="rounded bg-orange-100 px-1.5 py-0.5 font-semibold text-orange-900"
              title={t("manager.deviationsTooltip")}
            >
              {tPlural("manager", "deviations", item.deviation_count)}
            </span>
          )}
          {item.reason_count > 0 && item.deviation_count > 0 && (
            <span
              className={`rounded px-1.5 py-0.5 font-semibold ${
                item.reason_count >= item.deviation_count
                  ? "bg-green-100 text-green-900"
                  : "bg-amber-100 text-amber-900"
              }`}
              title={t("manager.reasonsTooltip")}
            >
              {t("manager.reasonsCovered", {
                reasonCount: item.reason_count,
                deviationCount: item.deviation_count,
              })}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
          {item.cutoff_iso && (
            <span>{t("manager.cutoff", { value: formatDateTime(item.cutoff_iso) })}</span>
          )}
          {item.captain_submitted_at && (
            <span>{t("manager.submitted", { value: formatDateTime(item.captain_submitted_at) })}</span>
          )}
        </div>
      </button>
    </li>
  );
}
