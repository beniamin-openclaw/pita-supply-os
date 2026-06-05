// Card-state logic — returns translation keys + vars so the UI layer can
// translate to the active language. Pure functions, no React context.

import type { OrderableItem, OrderLine, CardState } from "../types";
import type { StringKey } from "../../../i18n/strings";

// NOTE (S-09): this preview ALWAYS ceils to whole purchase units (full_only).
// The backend (app/suggestion.py) is the source of truth and honors each SKU's
// rounding_rule. They agree for Bukat today (all SKUs default full_only), but
// will diverge once S-09 adds sub-unit (0.1 kg) rounding for weight goods — at
// which point this preview must match the backend (e.g. call /api/captain/suggest).
export function computeSuggestion(
  item: OrderableItem,
  currentStock: number,
): { base: number; purchase: number } {
  const suggestedBase = Math.max(0, item.target_stock_qty_base - currentStock);
  const suggestedPurchase = Math.ceil(suggestedBase / item.units_per_purchase_unit);
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
  if (line.current_stock_qty_base === "" || line.captain_final_qty_purchase === "") {
    return {
      state: "grey",
      messageKey: "state.empty",
      requiresReason: false,
      deviationPct: null,
    };
  }

  const current = Number(line.current_stock_qty_base);
  const final = Number(line.captain_final_qty_purchase);
  const { purchase: suggested } = computeSuggestion(item, current);

  // Critical product, zero ordered — always requires reason.
  if (final === 0 && item.is_critical) {
    const hasReason =
      !!line.reason_code && (line.reason_code !== "OTHER" || !!line.captain_comment);
    if (!hasReason) {
      return {
        state: "red",
        messageKey: "state.criticalZeroNoReason",
        requiresReason: true,
        deviationPct: -100,
      };
    }
    return {
      state: "orange",
      messageKey: "state.criticalZeroReason",
      requiresReason: true,
      deviationPct: -100,
    };
  }

  const deviation = computeDeviation(suggested, final);
  const absDeviation = Math.abs(deviation);

  if (absDeviation > 20) {
    const hasReason =
      !!line.reason_code && (line.reason_code !== "OTHER" || !!line.captain_comment);
    const pct = formatPctSigned(deviation);

    if (!hasReason) {
      return {
        state: "red",
        messageKey: "state.devNoReason",
        messageVars: { pct },
        requiresReason: true,
        deviationPct: deviation,
      };
    }
    return {
      state: "orange",
      messageKey: "state.devReason",
      messageVars: { pct },
      requiresReason: true,
      deviationPct: deviation,
    };
  }

  if (final === suggested) {
    return {
      state: "green",
      messageKey: "state.match",
      requiresReason: false,
      deviationPct: 0,
    };
  }

  // Small deviation (≤20%) — show the % so captain sees how close to suggestion.
  const pct = formatPctSigned(deviation);
  return {
    state: "yellow",
    messageKey: "state.smallAdj",
    messageVars: { pct },
    requiresReason: false,
    deviationPct: deviation,
  };
}
