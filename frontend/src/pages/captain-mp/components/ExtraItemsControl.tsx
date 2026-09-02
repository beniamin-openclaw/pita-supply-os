// "+ dodaj produkt" ad-hoc off-catalogue item control (training-feedback-0901
// Phase 1b) — lets the Captain add products that are NOT in the supplier
// catalogue ("mamy event, potrzebujemy czegoś, czego nie mamy"). Renders as a
// bordered card below the product list, mirroring the OverruleAllControl /
// PrefillControl visual idiom. Rows collect nazwa / ilość / jednostka; the
// exact serialisation into the backend's `extra_items` free-text field lives
// in the pure, unit-tested lib/extraItems.ts, so this component only manages
// row add/remove/edit and calls `onChange` with the full row list.

import { Plus, X } from "lucide-react";
import { useT } from "../../../i18n";
import type { ExtraItemRow } from "../lib/extraItems";
import { blankExtraItemRow } from "../lib/extraItems";

interface ExtraItemsControlProps {
  rows: ExtraItemRow[];
  onChange: (rows: ExtraItemRow[]) => void;
}

export function ExtraItemsControl({ rows, onChange }: ExtraItemsControlProps) {
  const { t } = useT();

  const updateRow = (index: number, patch: Partial<ExtraItemRow>): void => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const removeRow = (index: number): void => {
    onChange(rows.filter((_, i) => i !== index));
  };
  const addRow = (): void => {
    onChange([...rows, blankExtraItemRow()]);
  };

  return (
    <section
      className="mb-4 rounded-xl border border-teal-300 bg-teal-50 p-3"
      aria-label={t("captain.extraItems.title")}
    >
      <div className="text-teal-900 text-sm font-semibold mb-1">
        {t("captain.extraItems.title")}
      </div>
      <p className="text-xs text-teal-800 mb-2">{t("captain.extraItems.hint")}</p>

      {rows.length > 0 && (
        <div className="space-y-2 mb-2">
          {rows.map((row, index) => (
            // Index as key: rows have no stable identity of their own (plain
            // name/qty/unit strings) and are only appended/removed, never
            // reordered — every input stays controlled via value+onChange.
            <div key={index} className="flex gap-2 items-start">
              <div className="min-w-0 flex-1">
                <label htmlFor={`extra-item-name-${index}`} className="sr-only">
                  {t("captain.extraItems.nameLabel")}
                </label>
                <input
                  id={`extra-item-name-${index}`}
                  type="text"
                  value={row.name}
                  onChange={(e) => updateRow(index, { name: e.target.value })}
                  placeholder={t("captain.extraItems.namePlaceholder")}
                  className="w-full rounded-lg border border-teal-300 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="w-16 shrink-0">
                <label htmlFor={`extra-item-qty-${index}`} className="sr-only">
                  {t("captain.extraItems.qtyLabel")}
                </label>
                <input
                  id={`extra-item-qty-${index}`}
                  type="text"
                  inputMode="decimal"
                  value={row.qty}
                  onChange={(e) => updateRow(index, { qty: e.target.value })}
                  placeholder={t("captain.extraItems.qtyLabel")}
                  className="w-full rounded-lg border border-teal-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="w-24 shrink-0">
                <label htmlFor={`extra-item-unit-${index}`} className="sr-only">
                  {t("captain.extraItems.unitLabel")}
                </label>
                <input
                  id={`extra-item-unit-${index}`}
                  type="text"
                  value={row.unit}
                  onChange={(e) => updateRow(index, { unit: e.target.value })}
                  placeholder={t("captain.extraItems.unitPlaceholder")}
                  className="w-full rounded-lg border border-teal-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                aria-label={t("captain.extraItems.removeRow")}
                className="mt-1.5 shrink-0 rounded-md p-1.5 text-teal-700 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
      >
        <Plus size={14} aria-hidden="true" />
        {t("captain.extraItems.addRow")}
      </button>
    </section>
  );
}
