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

import { useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, MinusCircle } from "lucide-react";
import type { OrderableItem, CardState } from "../types";
import type { OrderLine } from "../types";
import { computeRowState, computeSuggestion } from "../lib/compute";
import { DecimalInput } from "../../../components/ui/DecimalInput";
import { ReasonPicker } from "./ReasonPicker";
import { useT } from "../../../i18n";
import { packUnitLocative } from "../../../i18n/packUnits";
import { baseToPacks, formatPacks, isPackBased, packsToBase } from "../../../lib/packUnits";
import { roundQty } from "../../../components/ui/number";

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
  const { t, lang } = useT();
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

  // Pack-unit display (pack-units-display-mobile-wrap Track A) — only when the
  // purchase unit actually packs multiple inventory units (e.g. a "zgrzewka"
  // of 24 szt). A ×1 SKU renders exactly as before this change.
  const packBased = isPackBased(item.units_per_purchase_unit);
  const [inPacks, setInPacks] = useState(false);
  const upp = item.units_per_purchase_unit;

  const handleCurrentChange = (v: number | "") => {
    onChange({ ...line, current_stock_qty_base: v });
  };
  // Stock input while the "wpisz w …" toggle is on: the field shows/accepts
  // pack (purchase-unit) values, but `onChange` still stores base units —
  // state and the API contract never leave inventory units.
  const handlePacksChange = (v: number | "") => {
    onChange({ ...line, current_stock_qty_base: v === "" ? "" : packsToBase(v, upp) });
  };
  // Pack-unit hint under the stock input — same underlying quantity
  // (`currentVal`, base units) whichever mode the toggle is in; only the
  // template (base=packs vs packs=base) differs.
  const currentPacksLabel =
    packBased && line.current_stock_qty_base !== ""
      ? formatPacks(baseToPacks(currentVal, upp), item.purchase_unit, lang)
      : null;
  // Suggestion-tile pack detail: when the exact quotient already lands on the
  // rounded suggestion (e.g. 72 szt / 24 = 3 zgrzewki exactly), showing
  // "= 3 zgrzewki → 3 zgrzewki" would be redundant — use the "Exact" template.
  const packsExactRaw = packBased ? suggestedBase / upp : 0;
  const isExactPacks = packBased && Math.abs(packsExactRaw - suggestedPurchase) < 1e-9;
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
          {packBased ? (
            <>
              <span className="inline-block whitespace-nowrap">
                {t("card.targetPart", {
                  target: item.target_stock_qty_base,
                  inventoryUnit: item.inventory_unit,
                  packs: formatPacks(
                    baseToPacks(item.target_stock_qty_base, upp),
                    item.purchase_unit,
                    lang,
                  ),
                })}
              </span>
              {" · "}
              <span className="inline-block whitespace-nowrap">
                {t("card.maxPart", {
                  max: item.max_stock_qty_base,
                  inventoryUnit: item.inventory_unit,
                  packs: formatPacks(
                    baseToPacks(item.max_stock_qty_base, upp),
                    item.purchase_unit,
                    lang,
                  ),
                })}
              </span>
              {" · "}
              <span className="inline-block whitespace-nowrap">
                {t("card.ratioPart", {
                  purchaseUnit: item.purchase_unit,
                  unitsPerPurchase: upp,
                  inventoryUnit: item.inventory_unit,
                })}
              </span>
            </>
          ) : (
            t("card.targetLine", {
                target: item.target_stock_qty_base,
                inventoryUnit: item.inventory_unit,
                max: item.max_stock_qty_base,
                purchaseUnit: item.purchase_unit,
                unitsPerPurchase: upp,
            })
          )}
        </div>

        {/* Master-data annotation + below-minimum signal (both optional) */}
        {(item.order_note || belowMin) && (
          <div className="-mt-2 mb-3 space-y-1">
            {item.order_note && (
              <div className="flex items-center gap-1 text-xs text-slate-600">
                <Info size={12} aria-hidden="true" className="shrink-0 text-slate-400" />
                <span className="break-words">{item.order_note}</span>
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
                value={
                  packBased && inPacks
                    ? line.current_stock_qty_base === ""
                      ? ""
                      : roundQty(line.current_stock_qty_base / upp)
                    : line.current_stock_qty_base
                }
                onChange={packBased && inPacks ? handlePacksChange : handleCurrentChange}
                aria-describedby={currentUnitId}
                className="w-full bg-white border border-gray-300 rounded-lg py-3 px-2 text-right text-[16px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                placeholder="0"
              />
            </div>
            {/* Unit caption UNDER the field (not an absolute suffix inside it):
                a long unit word ("zgrzewka", "wiadro") sat on top of the typed
                number on a 375 px phone (mobile-wrap review). */}
            <div
              id={currentUnitId}
              className="mt-0.5 text-[10px] leading-tight text-right text-slate-500"
            >
              {packBased && inPacks ? item.purchase_unit : item.inventory_unit}
            </div>
            {currentPacksLabel && (
              <div className="mt-1 text-[11px] leading-tight text-slate-600" aria-live="polite">
                {inPacks
                  ? t("card.packsToStock", {
                      packs: currentPacksLabel,
                      base: line.current_stock_qty_base,
                      inventoryUnit: item.inventory_unit,
                    })
                  : t("card.stockPacks", {
                      base: line.current_stock_qty_base,
                      inventoryUnit: item.inventory_unit,
                      packs: currentPacksLabel,
                    })}
              </div>
            )}
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
                {packBased ? (
                  <>
                    <span className="inline-block whitespace-nowrap">
                      {t("card.suggestionNeed", {
                        base: suggestedBase,
                        inventoryUnit: item.inventory_unit,
                      })}
                    </span>{" "}
                    <span className="inline-block whitespace-nowrap">
                      {`= ${formatPacks(baseToPacks(suggestedBase, upp), item.purchase_unit, lang)}`}
                    </span>
                    {!isExactPacks && (
                      <>
                        {" "}
                        <span className="inline-block whitespace-nowrap">
                          {`→ ${formatPacks(suggestedPurchase, item.purchase_unit, lang)}`}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  t("card.suggestionDetail", {
                      base: suggestedBase,
                      inventoryUnit: item.inventory_unit,
                      purchase: suggestedPurchase,
                      purchaseUnit: item.purchase_unit,
                    })
                )}
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
                className={`w-full border rounded-lg py-3 px-2 text-right text-[16px] font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  state === "red"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-300 bg-white"
                }`}
                placeholder="0"
              />
            </div>
            <div
              id={finalUnitId}
              className="mt-0.5 text-[10px] leading-tight text-right text-slate-500"
            >
              {item.purchase_unit}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tag pill — primary state signal (stays first / left) */}
          <div
            id={pillId}
            role="status"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${colors.pill} ${colors.pillText}`}
          >
            <StateIcon state={state} />
            {message}
          </div>

          {/* "wpisz w …" toggle — switch the stock input between inventory and
              purchase (pack) units. Session-local only; not persisted in the draft.
              Right-aligned on the pill row so the state pill keeps its place. */}
          {packBased && (
            <button
              type="button"
              aria-pressed={inPacks}
              onClick={() => setInPacks((v) => !v)}
              className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                inPacks
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              {t("card.packInputToggle", { unitLoc: packUnitLocative(item.purchase_unit, lang) })}
            </button>
          )}
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
