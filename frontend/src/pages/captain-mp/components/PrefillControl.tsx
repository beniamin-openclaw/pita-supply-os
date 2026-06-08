// Always-available "fill stock from a count" control (Phase 4 / FR-022/023/024).
// Renders as a sibling above the order lines (NOT inside ContextStrip, which is
// supplier-context only). Lets the Captain pick any of the recent snapshots and
// fill in two safe-by-default modes plus a clear:
//   • Wypełnij puste  — empties-only fill (never clobbers a typed value)
//   • Nadpisz wszystko — overwrite all matched lines (confirm-gated by the parent)
//   • Wyczyść          — clear every stock field back to blank (confirm-gated)
// The picker names each snapshot's date/time + who counted, preserving the
// FR-017 "name the source" safeguard.

import type { InventoryCountSummary } from "../../../types";
import { useT } from "../../../i18n";

interface PrefillControlProps {
  snapshots: InventoryCountSummary[];
  selectedId: string | null;
  onSelect: (countId: string) => void;
  // While the selected snapshot's lines are still loading, the two fill actions
  // are disabled (clear needs no snapshot, so it stays enabled).
  isDetailLoading: boolean;
  onFillEmpties: () => void;
  onOverwrite: () => void;
  onClear: () => void;
}

export function PrefillControl({
  snapshots,
  selectedId,
  onSelect,
  isDetailLoading,
  onFillEmpties,
  onOverwrite,
  onClear,
}: PrefillControlProps) {
  const { t, formatDateTime } = useT();

  if (snapshots.length === 0) return null;

  const selected = snapshots.find((s) => s.count_id === selectedId) ?? null;
  const selectedWho = selected?.count_user ?? null;

  const optionLabel = (s: InventoryCountSummary): string => {
    const time = formatDateTime(s.count_submitted_at ?? s.count_date);
    return s.count_user
      ? t("captain.snapshotOption", { time, who: s.count_user, count: s.line_count })
      : t("captain.snapshotOptionNoWho", { time, count: s.line_count });
  };

  const fillDisabled = isDetailLoading || !selected;

  return (
    <section
      className="mb-4 rounded-xl border border-sky-300 bg-sky-50 p-3"
      aria-label={t("captain.prefillControlTitle")}
    >
      <div className="text-sky-900 text-sm font-semibold mb-2">
        📋 {t("captain.prefillControlTitle")}
      </div>

      <label htmlFor="prefill-snapshot" className="sr-only">
        {t("captain.snapshotPickerLabel")}
      </label>
      <select
        id="prefill-snapshot"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 mb-2"
      >
        {snapshots.map((s) => (
          <option key={s.count_id} value={s.count_id}>
            {optionLabel(s)}
          </option>
        ))}
      </select>

      {selectedWho && (
        <p className="text-xs text-sky-800 mb-3">
          {t("captain.prefillBannerBy", { who: selectedWho })}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onFillEmpties}
          disabled={fillDisabled}
          className="flex-1 px-3 py-2.5 rounded-lg bg-sky-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        >
          {isDetailLoading ? t("captain.prefillLoading") : t("captain.prefillFillEmpties")}
        </button>
        <button
          type="button"
          onClick={onOverwrite}
          disabled={fillDisabled}
          className="flex-1 px-3 py-2.5 rounded-lg bg-white text-sky-900 border border-sky-300 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        >
          {t("captain.prefillOverwrite")}
        </button>
      </div>

      <div className="mt-2 pt-2 border-t border-sky-200 flex justify-end">
        <button
          type="button"
          onClick={onClear}
          className="px-3 py-1.5 rounded-md text-slate-600 hover:text-red-600 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          ⨯ {t("captain.prefillClear")}
        </button>
      </div>
    </section>
  );
}
