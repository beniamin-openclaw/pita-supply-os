// Sticky bottom action bar. i18n via useT() — Polish plural forms handled by tPlural().

import { AlertTriangle, Loader2 } from "lucide-react";
import { useT } from "../../../i18n";

interface StickyActionBarProps {
  lineCount: number;
  deviationCount: number;
  reasonCount: number;
  hasRedCards: boolean;
  onScrollToRed: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isEmpty?: boolean;
}

export function StickyActionBar({
  lineCount,
  deviationCount,
  reasonCount,
  hasRedCards,
  onScrollToRed,
  onSaveDraft,
  onSubmit,
  isSubmitting,
  isEmpty,
}: StickyActionBarProps) {
  const { t, tPlural } = useT();

  const linesText = tPlural("sticky.summary", "lines", lineCount);
  const devsText = tPlural("sticky.summary", "deviations", deviationCount);
  const reasonsText = tPlural("sticky.summary", "reasons", reasonCount);

  const summary = `${linesText} · ${devsText} · ${reasonsText}`;
  const submitDisabled = hasRedCards || isSubmitting || isEmpty;

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30">
      <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-700 font-medium mb-1 truncate" aria-label={summary}>
            {summary}
          </div>
          {hasRedCards ? (
            <button
              type="button"
              onClick={onScrollToRed}
              className="flex items-center gap-1 text-xs text-red-700 font-semibold active:text-red-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 rounded"
            >
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{t("sticky.fixRedCards")}</span>
            </button>
          ) : isEmpty ? (
            <div className="text-xs text-slate-600 font-medium">{t("sticky.fillStockFirst")}</div>
          ) : (
            <div className="text-xs text-green-700 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-600" aria-hidden="true" />
              {t("sticky.readyToSubmit")}
            </div>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isSubmitting}
            className="px-4 py-3 text-sm font-medium text-slate-800 bg-gray-100 rounded-lg active:bg-gray-200 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {t("sticky.draftBtn")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-lg active:bg-blue-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              submitDisabled ? "bg-gray-500 cursor-not-allowed" : "bg-[#1a4480]"
            }`}
          >
            {isSubmitting && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
            {isSubmitting ? t("sticky.submittingBtn") : t("sticky.submitBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
