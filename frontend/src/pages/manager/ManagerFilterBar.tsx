// Manager queue filters (S-05) — presentational supplier <select> + status
// chips + clear. All filter state lives in the parent (ManagerPage); this only
// renders props and reports changes. No data fetching, no app state.

import { useT } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import type { QueueLane } from "./ManagerQueue";

export interface SupplierOption {
  id: string;
  name: string;
}

interface ManagerFilterBarProps {
  supplierOptions: SupplierOption[];
  selectedSupplierId: string | null;
  onSupplierChange: (id: string | null) => void;
  visibleLanes: Set<QueueLane>;
  onToggleLane: (lane: QueueLane) => void;
  onClear: () => void;
  anyActive: boolean;
}

// Status chips reuse the queue-group labels (manager.tab.*).
const LANES: { lane: QueueLane; labelKey: StringKey }[] = [
  { lane: "submitted", labelKey: "manager.tab.submitted" },
  { lane: "claimed", labelKey: "manager.tab.claimed" },
  { lane: "sent", labelKey: "manager.tab.sent" },
];

export function ManagerFilterBar({
  supplierOptions,
  selectedSupplierId,
  onSupplierChange,
  visibleLanes,
  onToggleLane,
  onClear,
  anyActive,
}: ManagerFilterBarProps) {
  const { t } = useT();

  return (
    <div className="mb-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div>
        <label
          htmlFor="mgr-filter-supplier"
          className="mb-1 block text-xs font-semibold text-slate-800"
        >
          {t("manager.filter.supplierLabel")}
        </label>
        <select
          id="mgr-filter-supplier"
          value={selectedSupplierId ?? ""}
          onChange={(e) => onSupplierChange(e.target.value === "" ? null : e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:text-sm"
        >
          <option value="">{t("manager.filter.allSuppliers")}</option>
          {supplierOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="mb-1 block text-xs font-semibold text-slate-800">
          {t("manager.filter.statusLabel")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {LANES.map(({ lane, labelKey }) => {
            const active = visibleLanes.has(lane);
            return (
              <button
                key={lane}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleLane(lane)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active
                    ? "border-blue-400 bg-blue-50 text-blue-800"
                    : "border-slate-300 bg-white text-slate-400"
                }`}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {anyActive && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-blue-700 underline hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {t("manager.filter.clear")}
        </button>
      )}
    </div>
  );
}
