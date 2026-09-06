// Confirmation card shown after a successful inventory-count submit
// (inventory-confirm-and-history, Track A). Replaces the old pattern of an
// off-screen toast + a silently-emptied form: the Captain sees an explicit
// "saved" state with the snapshot's date/who/line-count and a clear next step
// (view it in history, or start a new count).

import { CheckCircle2 } from "lucide-react";
import { useT } from "../../../i18n";

export interface InventorySubmittedCardProps {
  /** Epoch ms of the successful submit — shown as date + time, exactly like
   *  the row this snapshot gets in the history list (count_submitted_at). A
   *  date-only ISO string would render as "02:00" via the default formatter. */
  submittedAt: number;
  who: string;
  lineCount: number;
  onViewHistory: () => void;
  onNewCount: () => void;
}

export function InventorySubmittedCard({
  submittedAt,
  who,
  lineCount,
  onViewHistory,
  onNewCount,
}: InventorySubmittedCardProps) {
  const { t, tPlural, formatDateTime } = useT();

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-gray-200 bg-white p-6 text-center max-w-md mx-auto mt-6"
    >
      <CheckCircle2 size={40} className="mx-auto text-green-600" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-bold text-slate-900">{t("inventory.submitted.title")}</h2>
      <p className="mt-1 text-sm text-slate-600">
        {formatDateTime(submittedAt)} · {who} ·{" "}
        {tPlural("inventory.history.lineCount", "items", lineCount)}
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={onViewHistory}
          className="w-full sm:flex-1 px-6 py-3 text-sm font-semibold text-white rounded-lg bg-brand active:bg-brand-active transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {t("inventory.submitted.viewHistory")}
        </button>
        <button
          type="button"
          onClick={onNewCount}
          className="w-full sm:flex-1 px-4 py-3 text-sm font-medium text-slate-800 bg-gray-100 rounded-lg active:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {t("inventory.submitted.newCount")}
        </button>
      </div>
    </div>
  );
}
