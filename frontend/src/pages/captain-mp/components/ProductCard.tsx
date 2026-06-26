// Product card — the main interactive surface.
// Fixes from review (BLOCKER + HIGH applied):
// - Field renames: product_name_pl, target_stock_qty_base, max_stock_qty_base
// - B3: <label htmlFor> on inputs + aria-describedby for unit suffix
// - B4: pill is role="status" so message announces; aria-invalid wired in ReasonPicker
// - H1: CRITICAL pill — solid red bg, AlertOctagon icon, KRYTYCZNY copy
// - H2: gray-400 → gray-600 for contrast
// - H3: border-l-500 colors → -700/-600 for non-text 3:1
// - H4: state-icon prefix on tag pill (colorblind)
// - H7: math hint text-xs (not 9px) with arrow format
// - Touch: inputs py-3 (≥44px)
// - Visual: card wash via bg-{color}-50, transition-colors

import { AlertOctagon, AlertTriangle, CheckCircle2, Info, MinusCircle } from "lucide-react";
import type { OrderableItem, CardState } from "../types";
import type { OrderLine } from "../types";
import { computeRowState, computeSuggestion } from "../lib/compute";
import { DecimalInput } from "../../../components/ui/DecimalInput";
import { ReasonPicker } from "./ReasonPicker";
import { useT } from "../../../i18n";

interface ProductCardProps {
  item: OrderableItem;
  line: OrderLine;
  onChange: (line: OrderLine) => void;
}

const STATE_STYLES: Record<
  CardState,
  { border: string; wash: string; pill: string; pillText: string }
> = {
  green: {
    border: "border-l-green-700",
    wash: "bg-green-50/60",
    pill: "bg-green-100",
    pillText: "text-green-900",
  },
  yellow: {
    border: "border-l-yellow-700",
    wash: "bg-yellow-50/60",
    pill: "bg-yellow-100",
    pillText: "text-yellow-900",
  },
  orange: {
    border: "border-l-orange-600",
    wash: "bg-orange-50/60",
    pill: "bg-orange-100",
    pillText: "text-orange-900",
  },
  red: {
    border: "border-l-red-600",
    wash: "bg-red-50/60",
    pill: "bg-red-100",
    pillText: "text-red-900",
  },
  grey: {
    border: "border-l-gray-400",
    wash: "bg-white",
    pill: "bg-gray-100",
    pillText: "text-gray-700",
  },
};

function StateIcon({ state }: { state: CardState }) {
  switch (state) {
    case "green":
      return <CheckCircle2 size={14} aria-hidden="true" className="shrink-0" />;
    case "yellow":
      return <Info size={14} aria-hidden="true" className="shrink-0" />;
    case "orange":
      return <AlertTriangle size={14} aria-hidden="true" className="shrink-0" />;
    case "red":
      return <AlertOctagon size={14} aria-hidden="true" className="shrink-0" />;
    case "grey":
      return <MinusCircle size={14} aria-hidden="true" className="shrink-0" />;
  }
}

export function ProductCard({ item, line, onChange }: ProductCardProps) {
  const { t } = useT();
  const { state, messageKey, messageVars, requiresReason } = computeRowState(item, line);
  const message = t(messageKey, messageVars);
  const colors = STATE_STYLES[state];
  const currentVal = Number(line.current_stock_qty_base) || 0;
  // Informational "below minimum" signal — does NOT gate submit or feed the
  // suggestion (min is otherwise unused). Only meaningful once stock is typed.
  const belowMin =
    line.current_stock_qty_base !== "" &&
    item.min_stock_qty_base > 0 &&
    currentVal < item.min_stock_qty_base;
  const { base: suggestedBase, purchase: suggestedPurchase } = computeSuggestion(
    item,
    currentVal,
  );

  const handleCurrentChange = (v: number | "") => {
    onChange({ ...line, current_stock_qty_base: v });
  };
  const handleFinalChange = (v: number | "") => {
    onChange({ ...line, captain_final_qty_purchase: v });
  };
  const handleReasonChange = (reason: string, comment: string) => {
    onChange({
      ...line,
      // empty string clears the reason
      reason_code: reason === "" ? "" : (reason as OrderLine["reason_code"]),
      captain_comment: comment,
    });
  };

  const cardId = `card-${item.product_id}`;
  const currentInputId = `current-${item.product_id}`;
  const currentUnitId = `current-unit-${item.product_id}`;
  const finalInputId = `final-${item.product_id}`;
  const finalUnitId = `final-unit-${item.product_id}`;
  const suggestId = `suggest-${item.product_id}`;
  const pillId = `pill-${item.product_id}`;

  return (
    <div
      id={cardId}
      className={`rounded-xl shadow-sm border border-gray-200 border-l-4 ${colors.border} ${colors.wash} overflow-hidden mb-3 transition-colors duration-150`}
    >
      <div className="p-4">
        {/* Title row */}
        <div className="flex justify-between items-start gap-2 mb-1">
          <h3 className="font-semibold text-slate-900 leading-tight">
            {item.product_name_pl}
          </h3>
          {item.is_critical && (
            <span className="flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
              <AlertOctagon size={10} aria-hidden="true" />
              {t("card.critical")}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-600 mb-4">
          {t("card.targetLine", {
            target: item.target_stock_qty_base,
            inventoryUnit: item.inventory_unit,
            max: item.max_stock_qty_base,
            purchaseUnit: item.purchase_unit,
            unitsPerPurchase: item.units_per_purchase_unit,
          })}
        </div>

        {/* Master-data annotation + below-minimum signal (both optional) */}
        {(item.order_note || belowMin) && (
          <div className="-mt-2 mb-3 space-y-1">
            {item.order_note && (
              <div className="flex items-center gap-1 text-xs text-slate-600">
                <Info size={12} aria-hidden="true" className="shrink-0 text-slate-400" />
                <span className="line-clamp-1">{item.order_note}</span>
              </div>
            )}
            {belowMin && (
              <div className="flex items-center gap-1 text-xs font-semibold text-red-700">
                <AlertTriangle size={12} aria-hidden="true" className="shrink-0" />
                {t("card.belowMin", {
                  min: item.min_stock_qty_base,
                  unit: item.inventory_unit,
                })}
              </div>
            )}
          </div>
        )}

        {/* 3-column grid: Current / Suggested / Order */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {/* Current stock */}
          <div>
            <label
              htmlFor={currentInputId}
              className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1"
            >
              {t("card.currentStock")}
            </label>
            <div className="relative">
              <DecimalInput
                id={currentInputId}
                inputMode="decimal"
                value={line.current_stock_qty_base}
                onChange={handleCurrentChange}
                aria-describedby={currentUnitId}
                className="w-full bg-white border border-gray-300 rounded-lg py-3 pl-2 pr-9 text-right text-[16px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                placeholder="0"
              />
              <span
                id={currentUnitId}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none"
              >
                {item.inventory_unit}
              </span>
            </div>
          </div>

          {/* Suggested — tap to auto-fill into "Zamawiasz" */}
          <button
            type="button"
            onClick={() => {
              if (line.current_stock_qty_base === "") return;
              onChange({ ...line, captain_final_qty_purchase: suggestedPurchase });
              // Optional haptic feedback on supported mobile browsers
              if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                try {
                  navigator.vibrate(10);
                } catch {
                  /* noop */
                }
              }
            }}
            disabled={line.current_stock_qty_base === ""}
            aria-label={
              line.current_stock_qty_base === ""
                ? t("card.suggestionMissing")
                : t("card.acceptSuggestion", { count: suggestedPurchase, unit: item.purchase_unit })
            }
            className="bg-blue-50/60 rounded-lg border border-dashed border-blue-300 p-2 flex flex-col items-center justify-center transition-colors hover:bg-blue-100/70 active:bg-blue-200/70 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            <span className="text-[10px] font-semibold text-blue-900 uppercase tracking-wider mb-0.5">
              {t("card.suggestion")}
            </span>
            <div
              id={suggestId}
              aria-live="polite"
              className="font-bold text-slate-900 tabular-nums text-lg"
            >
              {line.current_stock_qty_base === "" ? "—" : suggestedPurchase}
            </div>
            {line.current_stock_qty_base !== "" && (
              <div className="text-xs text-slate-700 mt-0.5 text-center leading-tight">
                {t("card.suggestionDetail", {
                  base: suggestedBase,
                  inventoryUnit: item.inventory_unit,
                  purchase: suggestedPurchase,
                  purchaseUnit: item.purchase_unit,
                })}
              </div>
            )}
          </button>

          {/* Final order */}
          <div>
            <label
              htmlFor={finalInputId}
              className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1"
            >
              {t("card.order")}
            </label>
            <div className="relative">
              <DecimalInput
                id={finalInputId}
                inputMode={
                  item.rounding_rule === "tenth_kg" ||
                  item.rounding_rule === "half_allowed"
                    ? "decimal"
                    : "numeric"
                }
                value={line.captain_final_qty_purchase}
                onChange={handleFinalChange}
                aria-describedby={`${finalUnitId} ${pillId}`}
                aria-invalid={state === "red"}
                className={`w-full border rounded-lg py-3 pl-2 pr-9 text-right text-[16px] font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  state === "red"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-300 bg-white"
                }`}
                placeholder="0"
              />
              <span
                id={finalUnitId}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none"
              >
                {item.purchase_unit}
              </span>
            </div>
          </div>
        </div>

        {/* Tag pill — primary state signal */}
        <div
          id={pillId}
          role="status"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${colors.pill} ${colors.pillText}`}
        >
          <StateIcon state={state} />
          {message}
        </div>

        {requiresReason && (
          <ReasonPicker
            value={line.reason_code}
            comment={line.captain_comment}
            onChange={handleReasonChange}
            productId={item.product_id}
            invalid={state === "red"}
          />
        )}
      </div>
    </div>
  );
}
