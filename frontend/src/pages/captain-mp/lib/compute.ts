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

// Backend-parity note: suggested=0 returns Infinity for a positive order so a
// caller can never divide by zero. Since week2-feedback-quantities Phase 1 the
// suggestion-0 case is handled BEFORE this is consulted in computeRowState
// (the backend `_evaluate_submit_line` likewise skips its deviation gate and
// stores delta=None there), so the ∞ never reaches a gate or a pill. Keep them
// in sync if the backend formula changes.
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
  // The order quantity is what makes a row evaluable. Only a blank ORDER qty
  // short-circuits to the empty/grey state.
  if (line.captain_final_qty_purchase === "") {
    return {
      state: "grey",
      messageKey: "state.empty",
      requiresReason: false,
      deviationPct: null,
    };
  }

  const final = Number(line.captain_final_qty_purchase);
  const hasReason =
    !!line.reason_code && (line.reason_code !== "OTHER" || !!line.captain_comment);

  // Blank CURRENT STOCK = not counted. There is no real suggestion to deviate
  // from (the UI shows "—"), so the deviation + critical gates are skipped. A
  // reason is forced only on an over-MAX order — the storage ceiling, the one
  // stock-independent concern. Mirrors the backend `_evaluate_submit_line`
  // uncounted branch; no "%" (nothing to compare against).
  if (line.current_stock_qty_base === "") {
    const orderBase = final * item.units_per_purchase_unit;
    const overMax =
      item.max_stock_qty_base > 0 &&
      !item.allow_over_max_due_to_packaging &&
      orderBase > item.max_stock_qty_base;
    if (overMax) {
      return {
        state: hasReason ? "orange" : "red",
        messageKey: hasReason ? "state.overMaxNoStockReason" : "state.overMaxNoStock",
        requiresReason: true,
        deviationPct: null,
      };
    }
    return {
      state: "yellow",
      messageKey: "state.smallAdjNoStock",
      requiresReason: false,
      deviationPct: null,
    };
  }

  // Counted path.
  const current = Number(line.current_stock_qty_base);
  const { purchase: suggested } = computeSuggestion(item, current);

  // Counted stock at/above target → suggestion 0 is INFORMATION, not a gate
  // (week2-feedback-quantities Phase 1; mirrors the backend
  // `_evaluate_submit_line` third branch). There is no baseline to express a
  // % against, so no reason is ever required here: nothing ordered → green
  // match as before; something ordered → a yellow informational pill naming
  // the stock vs target, no % and no ReasonPicker.
  if (suggested === 0) {
    if (final === 0) {
      return {
        state: "green",
        messageKey: "state.match",
        requiresReason: false,
        deviationPct: 0,
      };
    }
    // `half_allowed` / non-critical `up_for_critical` round a raw gap < 0.5 to
    // 0, so suggestion 0 can occur with stock still below target — then the
    // pill must not claim "stan ≥ cel"; a neutral variant is used instead.
    return {
      state: "yellow",
      messageKey:
        current >= item.target_stock_qty_base
          ? "state.aboveTargetInfo"
          : "state.suggestionZeroInfo",
      messageVars: {
        stock: current,
        target: item.target_stock_qty_base,
        unit: item.inventory_unit,
      },
      requiresReason: false,
      deviationPct: null,
    };
  }

  const deviation = computeDeviation(suggested, final);
  const absDeviation = Math.abs(deviation);

  // Reason-required result (>25% deviation, or a critical under-order).
  const reasonResult = (): RowState => ({
    state: hasReason ? "orange" : "red",
    messageKey: hasReason ? "state.devReason" : "state.devNoReason",
    messageVars: { pct: formatPctSigned(deviation) },
    requiresReason: true,
    deviationPct: deviation,
  });

  if (absDeviation > 25) {
    return reasonResult();
  }

  // Critical products: any under-order (even ≤25%) requires a reason —
  // mirrors the backend gate in captain_submit / captain_order_edit.
  // (suggested === 0 already returned above.)
  if (item.is_critical && final < suggested) {
    return reasonResult();
  }

  if (final === suggested) {
    return {
      state: "green",
      messageKey: "state.match",
      requiresReason: false,
      deviationPct: 0,
    };
  }

  // Small deviation (≤25%).
  return {
    state: "yellow",
    messageKey: "state.smallAdj",
    messageVars: { pct: formatPctSigned(deviation) },
    requiresReason: false,
    deviationPct: deviation,
  };
}
