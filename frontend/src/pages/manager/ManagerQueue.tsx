// Left pane of the Manager v2 two-pane shell (Phase G1). Four collapsible
// groups (captain_submitted / manager_claimed / manager_sent / closed), each
// fed by a separate managerQueue call in the parent. Week2-feedback Phase 5:
// the two working lanes open by default, sent/closed start collapsed; a
// claimed order waiting ≥3 days gets an age chip; closed orders received more
// than 3 days ago leave the lane for /manager/archive. Cards are selectable; the selected
// card is highlighted and selection survives the 60s refresh (the parent keeps
// selectedId in state independent of the queue data).

import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";

import { useT } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import type { ManagerQueueItem } from "../../types";
import { MinimumOrderChip } from "../../components/ui/MinimumOrderChip";
import { inQueueDays, splitClosedLane } from "./lib/queueAge";

/** The queue lanes (one status group each). `cancelled` exists only for the
 *  archive page's filter bar — the live queue never renders it. */
export type QueueLane = "submitted" | "claimed" | "sent" | "closed" | "cancelled";

/** Day + month + time, NO year, for the queue card's cutoff / submitted stamps.
 * The Manager scans this lane many times a day and every order in it is from
 * the current season — the year is four characters of pure noise on a card
 * whose job is to be skimmed (operator feedback, 2026-09-02). Screens that
 * show a single order in depth keep the full date via the formatDateTime
 * default. */
const QUEUE_STAMP_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

interface QueueGroup {
  key: QueueLane;
  titleKey: StringKey;
  accent: string;
  items: ManagerQueueItem[] | null;
  /** Whether the section starts expanded. The two working lanes open; sent
   *  and closed start collapsed with their counts (Phase 5). */
  defaultOpen: boolean;
  /** Closed lane only: rows hidden from the lane because their last receipt is
   *  older than QUEUE_AGE_DAYS — rendered as a "w archiwum: N" link. */
  archivedCount?: number;
}

interface ManagerQueueProps {
  submitted: ManagerQueueItem[] | null;
  claimed: ManagerQueueItem[] | null;
  sent: ManagerQueueItem[] | null;
  closed: ManagerQueueItem[] | null;
  selectedId: string | null;
  onSelect: (orderId: string) => void;
  /** Which lanes to render. Omitted = all visible (backward compatible). */
  visibleLanes?: Set<QueueLane>;
}

export function ManagerQueue({
  submitted,
  claimed,
  sent,
  closed,
  selectedId,
  onSelect,
  visibleLanes,
}: ManagerQueueProps) {
  const closedSplit = splitClosedLane(closed);
  const groups: QueueGroup[] = [
    {
      key: "submitted",
      titleKey: "manager.tab.submitted",
      accent: "text-blue-800",
      items: submitted,
      defaultOpen: true,
    },
    {
      key: "claimed",
      titleKey: "manager.tab.claimed",
      accent: "text-orange-700",
      items: claimed,
      defaultOpen: true,
    },
    {
      key: "sent",
      titleKey: "manager.tab.sent",
      accent: "text-green-700",
      items: sent,
      defaultOpen: false,
    },
    {
      key: "closed",
      titleKey: "manager.tab.closed",
      accent: "text-slate-600",
      items: closedSplit.recent,
      defaultOpen: false,
      archivedCount: closedSplit.archived,
    },
  ];
  const shown = visibleLanes ? groups.filter((g) => visibleLanes.has(g.key)) : groups;

  return (
    <div className="space-y-3">
      {shown.map((group) => (
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
  const [open, setOpen] = useState(group.defaultOpen);
  const count = group.items?.length ?? 0;
  const archived = group.archivedCount ?? 0;

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
                  showQueueAge={group.key === "claimed"}
                />
              ))}
            </ul>
          )}
          {archived > 0 && (
            <Link
              to="/manager/archive"
              className="mt-2 block px-2 text-xs font-medium text-blue-700 underline hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {t("manager.queue.archiveCount", { n: archived })}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

export interface QueueCardProps {
  item: ManagerQueueItem;
  selected: boolean;
  onSelect: (orderId: string) => void;
  /** Claimed lane only: render the amber "w kolejce od N dni" chip once the
   *  order has waited QUEUE_AGE_DAYS since the captain submitted it. */
  showQueueAge?: boolean;
}

export function QueueCard({ item, selected, onSelect, showQueueAge = false }: QueueCardProps) {
  const { t, tPlural, formatDateTime } = useT();
  const queueAge = showQueueAge ? inQueueDays(item) : null;

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
          <span className="min-w-0 break-words text-sm font-medium text-slate-900">
            {item.location_name} → {item.supplier_name}
          </span>
          {item.last_edited_at && (
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-purple-800">
              {t("orders.editedBadge")}
            </span>
          )}
          {queueAge !== null && (
            <span
              className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
              title={t("manager.queue.inQueueDaysTooltip")}
            >
              {tPlural("manager.queue", "inQueueDays", queueAge)}
            </span>
          )}
          {item.supplier_order_reference?.startsWith("TRN-") && (
            <span
              className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-indigo-800"
              title={t("manager.queue.transportChipTooltip")}
            >
              {t("manager.queue.transportChip")}
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
          <span>{tPlural("manager", "lines", item.line_count)}</span>
          <span aria-hidden="true">·</span>
          <span>{item.total_value_estimate_pln?.toFixed(2) ?? "?"} PLN</span>
          {/* Purely informational (training-feedback-0901 Phase 1c) — never
              gates claim/save/dispatch. */}
          <MinimumOrderChip
            total={item.total_value_estimate_pln}
            minimum={item.minimum_order_value_pln}
          />
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
          {/* Receipt signal (manager-receiving-view): ⚠ when a delivery has a
              discrepancy, else neutral ✓ when delivered clean. Both only appear
              on the manager_sent lane (counts are 0 elsewhere). */}
          {item.received_discrepancy_count > 0 ? (
            <span
              className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-800"
              title={t("manager.queue.discrepancy")}
            >
              <span aria-hidden="true">⚠</span> {t("manager.queue.discrepancy")}
            </span>
          ) : item.received_count > 0 ? (
            <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-900">
              <span aria-hidden="true">✓</span> {t("manager.queue.delivered")}
            </span>
          ) : null}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
          {item.cutoff_iso && (
            <span>
              {t("manager.cutoff", {
                value: formatDateTime(item.cutoff_iso, QUEUE_STAMP_OPTS),
              })}
            </span>
          )}
          {item.captain_submitted_at && (
            <span>
              {t("manager.submitted", {
                value: formatDateTime(item.captain_submitted_at, QUEUE_STAMP_OPTS),
              })}
            </span>
          )}
          {item.ordered_by && (
            <span>{t("manager.orderedBy", { value: item.ordered_by })}</span>
          )}
        </div>
      </button>
    </li>
  );
}
