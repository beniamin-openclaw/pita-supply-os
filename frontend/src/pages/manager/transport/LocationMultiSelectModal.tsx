// Location multi-select for the manager-first grid creation flow (v3 Phase 9,
// to-ordering-pago ADDENDUM v3) — "Nowy transport z lokalizacjami": the
// manager picks several active locations up front, and the caller creates an
// empty draft + folds each picked location in (prefilled with zero-qty lines)
// sequentially. No city grouping in v1 (plan Open Questions) — locations are
// picked directly. Pure checkbox-list modal; no fetch here.

import { useState } from "react";

import { useT } from "../../../i18n";
import type { Location } from "../../../types";

interface LocationMultiSelectModalProps {
  locations: Location[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (locationIds: string[]) => void;
}

export function LocationMultiSelectModal({
  locations,
  busy,
  onCancel,
  onConfirm,
}: LocationMultiSelectModalProps) {
  const { t } = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("manager.transport.gridCreate.title")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">
          {t("manager.transport.gridCreate.title")}
        </h3>

        {locations.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
            {t("manager.transport.gridCreate.empty")}
          </div>
        ) : (
          <ul className="mb-3 max-h-72 space-y-1 overflow-y-auto">
            {locations.map((loc) => (
              <li key={loc.location_id}>
                <label className="flex items-center gap-2 rounded p-2 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.has(loc.location_id)}
                    onChange={() => toggle(loc.location_id)}
                  />
                  <span className="text-slate-900">{loc.location_name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="mb-3 text-xs text-slate-500">
          {t("manager.transport.gridCreate.selectedCount", { count: selected.size })}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {t("manager.transport.gridCreate.cancel")}
          </button>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => onConfirm(Array.from(selected))}
            className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          >
            {busy ? t("manager.transport.gridCreate.busy") : t("manager.transport.gridCreate.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
