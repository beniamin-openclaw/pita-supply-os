// Shared categorized product grid for counting inventory — collapsible
// category sections, each product a card with a stock DecimalInput + comment
// field. Used by BOTH InventoryCountPage (new count) and
// InventoryCountEditPage (correct a submitted count, training-feedback-0901
// Phase 2) so the two flows render byte-identical UI; only the caller's
// fetch/submit logic differs.

import { ChevronDown, ChevronRight } from "lucide-react";

import { DecimalInput } from "../../../components/ui/DecimalInput";
import { useT } from "../../../i18n";
import { categoryLabel } from "../../../i18n/categoryLabels";
import type { InventoryProductGroup } from "../lib/inventoryGrouping";
import { blankInventoryLine, type InventoryLineInput } from "../lib/inventoryLines";

export interface InventoryCountGridProps {
  groupedProducts: InventoryProductGroup[];
  lines: Record<string, InventoryLineInput>;
  collapsedCategories: Set<string>;
  onToggleCategory: (category: string) => void;
  onStockChange: (productId: string, value: number | "") => void;
  onCommentChange: (productId: string, value: string) => void;
}

export function InventoryCountGrid({
  groupedProducts,
  lines,
  collapsedCategories,
  onToggleCategory,
  onStockChange,
  onCommentChange,
}: InventoryCountGridProps) {
  const { t, lang } = useT();

  return (
    <div className="space-y-3">
      {groupedProducts.map((group) => {
        const collapsed = collapsedCategories.has(group.category);
        const countedInGroup = group.items.filter((p) => {
          const v = lines[p.product_id]?.current_stock_qty_base;
          return v !== "" && v !== undefined;
        }).length;
        const label = group.category
          ? categoryLabel(group.category, lang)
          : t("inventory.uncategorized");
        return (
          <section
            key={group.category}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            <button
              type="button"
              onClick={() => onToggleCategory(group.category)}
              aria-expanded={!collapsed}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                {collapsed ? (
                  <ChevronRight size={16} aria-hidden="true" />
                ) : (
                  <ChevronDown size={16} aria-hidden="true" />
                )}
                {label}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 tabular-nums">
                {t("inventory.categoryCount", {
                  counted: countedInGroup,
                  total: group.items.length,
                })}
              </span>
            </button>

            {!collapsed && (
              <ul className="space-y-2 border-t border-gray-100 p-2">
                {group.items.map((p) => {
                  const line = lines[p.product_id] || blankInventoryLine();
                  return (
                    <li
                      key={p.product_id}
                      className="bg-white border border-gray-200 rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 break-words">
                              {p.product_name_pl}
                            </span>
                            {p.is_critical && (
                              <span className="shrink-0 rounded bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5">
                                {t("card.critical")}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{p.inventory_unit}</div>
                        </div>
                        <div className="shrink-0">
                          <label className="sr-only" htmlFor={`stock-${p.product_id}`}>
                            {t("inventory.qtyLabel")}
                          </label>
                          <DecimalInput
                            id={`stock-${p.product_id}`}
                            inputMode="decimal"
                            value={line.current_stock_qty_base}
                            onChange={(v) => onStockChange(p.product_id, v)}
                            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-right text-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <label htmlFor={`comment-${p.product_id}`} className="sr-only">
                        {t("inventory.commentPlaceholder")}
                      </label>
                      <input
                        type="text"
                        id={`comment-${p.product_id}`}
                        value={line.count_comment}
                        onChange={(e) => onCommentChange(p.product_id, e.target.value)}
                        placeholder={t("inventory.commentPlaceholder")}
                        className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
