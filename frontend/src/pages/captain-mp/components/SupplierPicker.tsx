// Horizontal scrollable supplier chip row.
// Fixes:
// - Field renames: supplier_id / supplier_name
// - Touch target: py-3 (≥44 px)
// - Focus ring on each chip
// - Contrast: gray-500 on gray-100 fail → gray-700
// - Semantic: <nav aria-label="Dostawcy"> + role="tab" for chips

import { Check } from "lucide-react";
import type { Supplier } from "../types";
import { useT } from "../../../i18n";

interface SupplierPickerProps {
  suppliers: Supplier[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Number of orderable lines per supplier — used for badge.
   * Empty record = unknown (don't show count). */
  lineCounts: Record<string, number>;
  /** Suppliers already submitted in this session. */
  sentSuppliers: Set<string>;
}

export function SupplierPicker({
  suppliers,
  activeId,
  onSelect,
  lineCounts,
  sentSuppliers,
}: SupplierPickerProps) {
  const { t } = useT();
  if (suppliers.length === 0) return null;

  return (
    <nav
      aria-label={t("supplier.navLabel")}
      className="bg-white border-b border-gray-200 overflow-x-auto hide-scrollbar"
    >
      <div className="flex gap-2 p-3 min-w-max" role="tablist">
        {suppliers.map((supplier) => {
          const isActive = supplier.supplier_id === activeId;
          const isSent = sentSuppliers.has(supplier.supplier_id);
          const count = lineCounts[supplier.supplier_id];

          return (
            <button
              key={supplier.supplier_id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(supplier.supplier_id)}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                ${
                  isActive
                    ? "bg-brand text-white"
                    : isSent
                      ? "bg-gray-100 text-gray-700 border border-gray-300"
                      : "bg-white text-gray-800 border border-gray-300 active:bg-gray-50"
                }
              `}
            >
              {isSent && (
                <Check size={16} className="text-green-700" aria-hidden="true" />
              )}
              <span>{supplier.supplier_name}</span>
              {!isActive && typeof count === "number" && count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                    isSent ? "bg-gray-200 text-gray-700" : "bg-gray-100 text-gray-700"
                  }`}
                  aria-label={t("supplier.lineCountLabel", { count })}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
