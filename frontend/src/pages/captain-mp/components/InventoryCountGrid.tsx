// Shared categorized product grid for counting inventory — collapsible
// category sections, each product a card with a stock DecimalInput + comment
// field. Used by BOTH InventoryCountPage (new count) and
// InventoryCountEditPage (correct a submitted count, training-feedback-0901
// Phase 2) so the two flows render byte-identical UI; only the caller's
// fetch/submit logic differs.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react";

import { DecimalInput } from "../../../components/ui/DecimalInput";
import { ProductListToolbar } from "../../../components/ui/ProductListToolbar";
import { useT } from "../../../i18n";
import { categoryLabel } from "../../../i18n/categoryLabels";
import { packUnitLabel } from "../../../i18n/packUnits";
import { isPackBased, packHint } from "../../../lib/packUnits";
import {
  DEFAULT_PRODUCT_LIST_VIEW,
  filterProductRows,
  type ProductListView,
} from "../../../lib/productListFilter";
import type { InventoryProduct } from "../../../types";
import { groupProductsByCategory, type InventoryProductGroup } from "../lib/inventoryGrouping";
import { blankInventoryLine, type InventoryLineInput } from "../lib/inventoryLines";

/** Typed stock above this multiple of the location max shows the yellow
 *  "sprawdź jednostkę" hint (week2-feedback-quantities Phase 3). Information
 *  only — nothing blocks submit. */
export const CHECK_UNIT_FACTOR = 3;

/** Previous count per product_id, from the latest snapshot's `lines`
 *  (week2-feedback-quantities Phase 3) — the count page builds it from the
 *  `api.inventoryLatest()` response it already fetches for the banner. */
export interface PreviousCount {
  qty: number;
  /** Pre-formatted date/time label of the snapshot (formatDateTime output). */
  date: string;
}

export interface InventoryCountGridProps {
  groupedProducts: InventoryProductGroup[];
  lines: Record<string, InventoryLineInput>;
  collapsedCategories: Set<string>;
  onToggleCategory: (category: string) => void;
  onStockChange: (productId: string, value: number | "") => void;
  onCommentChange: (productId: string, value: string) => void;
  /** Optional — the edit page reuses the grid without it (no "ostatnio" line). */
  previousByProduct?: Record<string, PreviousCount>;
}

export function InventoryCountGrid({
  groupedProducts,
  lines,
  collapsedCategories,
  onToggleCategory,
  onStockChange,
  onCommentChange,
  previousByProduct,
}: InventoryCountGridProps) {
  const { t, lang } = useT();

  // Search + "tylko nieliczone" / "tylko krytyczne" (week2-feedback-quantities
  // Phase 4). Ephemeral (no localStorage). Filtering runs over the flat
  // product list WITH the typed stock joined in (so "uncounted" reads the
  // live inputs), then re-groups — master-data order within a category is
  // preserved (filterProductRows never re-sorts; groupProductsByCategory keeps
  // first-seen order). No thresholds columns here — the Phase 3 hints stay.
  const [listView, setListView] = useState<ProductListView>(DEFAULT_PRODUCT_LIST_VIEW);
  // "Tylko nieliczone" membership is FROZEN at the moment the toggle turns on
  // (impl-review Phase 4 F1): filtering on the live inputs would unmount the
  // card the Captain is typing into after the first keystroke, persisting a
  // partial count. The set is rebuilt only when the toggle is switched on
  // again; a product counted while the filter is active stays visible.
  const [uncountedSnapshot, setUncountedSnapshot] = useState<Set<string> | null>(null);
  const linesRef = useRef(lines);
  // Mirror `lines` into the ref after commit (never during render —
  // react-hooks/refs); it is only read inside the click-driven callback below.
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  const patchListView = useCallback(
    (patch: Partial<ProductListView>): void => {
      if (patch.onlyUncounted === true) {
        const snap = new Set<string>();
        for (const g of groupedProducts) {
          for (const p of g.items) {
            const v = linesRef.current[p.product_id]?.current_stock_qty_base;
            if (v === "" || v === undefined) snap.add(p.product_id);
          }
        }
        setUncountedSnapshot(snap);
      } else if (patch.onlyUncounted === false) {
        setUncountedSnapshot(null);
      }
      setListView((prev) => ({ ...prev, ...patch }));
    },
    [groupedProducts],
  );
  const filterActive: boolean =
    listView.query.trim() !== "" || listView.onlyUncounted || listView.onlyCritical;

  const visibleGroups: InventoryProductGroup[] = useMemo(() => {
    if (!filterActive) return groupedProducts;
    type CountedRow = InventoryProduct & { current_stock_qty_base: number | null };
    const rows: CountedRow[] = groupedProducts.flatMap((g) =>
      g.items.map((p): CountedRow => {
        const v = lines[p.product_id]?.current_stock_qty_base;
        return { ...p, current_stock_qty_base: v === "" || v === undefined ? null : Number(v) };
      }),
    );
    // The uncounted rule is applied against the frozen snapshot, not the live
    // stock (see above); the other rules run through the shared helper.
    const preFiltered =
      listView.onlyUncounted && uncountedSnapshot
        ? rows.filter((r) => uncountedSnapshot.has(r.product_id))
        : rows;
    return groupProductsByCategory(
      filterProductRows(preFiltered, { ...listView, onlyUncounted: false }),
    );
  }, [filterActive, groupedProducts, lines, listView, uncountedSnapshot]);

  return (
    <div className="space-y-3">
      <ProductListToolbar
        idPrefix="inv-grid"
        view={listView}
        onChange={patchListView}
        toggles={["uncounted", "critical"]}
      />

      {filterActive && visibleGroups.length === 0 && (
        <div className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          {t("inventory.noResults")}
        </div>
      )}

      {visibleGroups.map((group) => {
        // A search / filter hit expands its category: while a filter is
        // active every remaining group contains at least one hit, so the
        // caller's collapse state is bypassed rather than mutated (it comes
        // back untouched once the filter is cleared).
        const collapsed = !filterActive && collapsedCategories.has(group.category);
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
                  const upp: number = p.units_per_purchase_unit ?? 1;
                  const packUnit: string = p.purchase_unit ?? "";
                  const showPack: boolean = packUnit !== "" && isPackBased(upp);
                  const stock: number | "" = line.current_stock_qty_base;
                  const stockNum: number | null =
                    stock === "" || stock === undefined ? null : Number(stock);
                  const packEquivalent: string | null =
                    showPack && stockNum !== null && stockNum > 0
                      ? packHint(stockNum, upp, packUnit, lang)
                      : null;
                  const maxBase: number = p.max_stock_qty_base ?? 0;
                  const checkUnit: boolean =
                    maxBase > 0 && stockNum !== null && stockNum > CHECK_UNIT_FACTOR * maxBase;
                  const previous: PreviousCount | undefined = previousByProduct?.[p.product_id];
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
                      {/* Information layer (Phase 3): pack hint, master-data note,
                          previous count, 3 x max unit warning. Never blocks. */}
                      {(showPack || p.order_note || previous || checkUnit) && (
                        <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                          {showPack && (
                            <div className="break-words" data-testid={`pack-${p.product_id}`}>
                              {t("inventory.packHint", {
                                packUnit: packUnitLabel(1, packUnit, lang),
                                upp,
                                unit: p.inventory_unit,
                              })}
                              {packEquivalent && (
                                <span className="ml-1 text-slate-400">
                                  {t("inventory.packEquivalent", { packs: packEquivalent })}
                                </span>
                              )}
                            </div>
                          )}
                          {p.order_note && (
                            <div className="flex items-center gap-1 text-slate-600">
                              <Info size={12} aria-hidden="true" className="shrink-0 text-slate-400" />
                              <span className="break-words">{p.order_note}</span>
                            </div>
                          )}
                          {previous && (
                            <div className="tabular-nums" data-testid={`prev-${p.product_id}`}>
                              {t("inventory.previousCount", {
                                qty: previous.qty,
                                date: previous.date,
                              })}
                            </div>
                          )}
                          {checkUnit && (
                            <div
                              role="status"
                              data-testid={`check-unit-${p.product_id}`}
                              className="flex items-center gap-1 font-semibold text-amber-700"
                            >
                              <AlertTriangle size={12} aria-hidden="true" className="shrink-0" />
                              <span className="break-words">
                                {t("inventory.checkUnitHint", {
                                  max: maxBase,
                                  unit: p.inventory_unit,
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
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
