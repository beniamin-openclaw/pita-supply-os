// Card-state logic — returns translation keys + vars so the UI layer can
// translate to the active language. Pure functions, no React context.

import type { OrderableItem, OrderLine, CardState } from "../types";
import type { StringKey } from "../../../i18n/strings";

/**
 * Mirror of the backend `_round_per_rule` (supply-os-v1/app/suggestion.py) so the
 * Captain's on-screen suggestion matches what submit will compute. Keep in sync.
 */
function roundPerRule(
  raw: number,
  rule: OrderableItem["rounding_rule"],
  isCritical: boolean,
): number {
  if (raw <= 0) return 0;
  switch (rule) {
    case "half_allowed":
      return Math.round(raw * 2) / 2;
    case "up_for_critical":
      return isCritical ? Math.ceil(raw) : Math.round(raw);
    case "tenth_kg":
      // Ceil to the next 0.1. Pre-clean to dodge float artifacts
      // (2.3 * 10 === 23.000000000000004 would ceil to the wrong tenth).
      return Math.ceil(Number((raw * 10).toFixed(6))) / 10;
    case "full_only":
    default:
      return Math.ceil(raw);
  }
}

export function computeSuggestion(
  item: OrderableItem,
  currentStock: number,
): { base: number; purchase: number } {
  const suggestedBase = Math.max(0, item.target_stock_qty_base - currentStock);
  const raw = suggestedBase / item.units_per_purchase_unit;
  const suggestedPurchase = roundPerRule(raw, item.rounding_rule, item.is_critical);
  return { base: suggestedBase, purchase: suggestedPurchase };
}

export function computeDeviation(suggestedPurchase: number, finalPurchase: number): number {
  if (suggestedPurchase === 0) {
    return finalPurchase > 0 ? Infinity : 0;
  }
  return ((finalPurchase - suggestedPurchase) / suggestedPurchase) * 100;
}

export interface RowState {
  state: CardState;
  /** i18n key for the pill message. */
  messageKey: StringKey;
  /** Interpolation vars for the pill message, if any. */
  messageVars?: Record<string, string | number>;
  requiresReason: boolean;
  /** Signed % deviation, or null if not enough input to compute. */
  deviationPct: number | null;
}

function formatPctSigned(deviation: number): string {
  if (deviation === Infinity) return "+∞%";
  return `${deviation > 0 ? "+" : ""}${Math.round(deviation)}%`;
}

export function computeRowState(item: OrderableItem, line: OrderLine): RowState {
  // The order quantity is what makes a row evaluable. A blank CURRENT STOCK is
  // optional — treat it as 0 (the Captain may order without counting). Because
  // the UI then shows the suggestion as "—", blank-stock messages carry no "%".
  // Only a blank ORDER qty short-circuits to the empty/grey state.
  if (line.captain_final_qty_purchase === "") {
    return {
      state: "grey",
      messageKey: "state.empty",
      requiresReason: false,
      deviationPct: null,
    };
  }

  const stockBlank = line.current_stock_qty_base === "";
  const current = stockBlank ? 0 : Number(line.current_stock_qty_base);
  const final = Number(line.captain_final_qty_purchase);
  const { purchase: suggested } = computeSuggestion(item, current);

  const deviation = computeDeviation(suggested, final);
  const absDeviation = Math.abs(deviation);
  const hasReason =
    !!line.reason_code && (line.reason_code !== "OTHER" || !!line.captain_comment);

  // Reason-required result (>20% deviation, or a critical under-order). With a
  // blank stock we swap to no-"%" message keys and omit the pct var (the
  // suggestion is shown as "—"); the red/orange + requiresReason gate is
  // identical, mirroring the backend's deviation gate on stock=0.
  const reasonResult = (): RowState => ({
    state: hasReason ? "orange" : "red",
    messageKey: hasReason
      ? stockBlank
        ? "state.devReasonNoStock"
        : "state.devReason"
      : stockBlank
        ? "state.devNoReasonNoStock"
        : "state.devNoReason",
    messageVars: stockBlank ? undefined : { pct: formatPctSigned(deviation) },
    requiresReason: true,
    deviationPct: deviation,
  });

  if (absDeviation > 20) {
    return reasonResult();
  }

  // Critical products: any under-order (even ≤20%) requires a reason —
  // mirrors the backend gate in captain_submit / captain_order_edit.
  // Exception: suggested === 0 means nothing to order, no reason needed.
  if (item.is_critical && final < suggested && suggested > 0) {
    return reasonResult();
  }

  // Exact match → green; but with blank stock we never claim a "match" (the
  // suggestion renders as "—"), so fall through to the neutral no-stock label.
  if (final === suggested && !stockBlank) {
    return {
      state: "green",
      messageKey: "state.match",
      requiresReason: false,
      deviationPct: 0,
    };
  }

  // Small deviation (≤20%) — show the % normally; neutral no-"%" label when the
  // stock is blank.
  return {
    state: "yellow",
    messageKey: stockBlank ? "state.smallAdjNoStock" : "state.smallAdj",
    messageVars: stockBlank ? undefined : { pct: formatPctSigned(deviation) },
    requiresReason: false,
    deviationPct: deviation,
  };
}
