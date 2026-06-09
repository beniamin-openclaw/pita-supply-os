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

  // Critical products are NOT special-cased here. Ordering 0 when the suggestion
  // is also 0 is "matches suggestion" (green) — not a forced-reason case
  // (operator decision 2026-06-09: a critical at 0 vs a 0 suggestion was pure
  // friction). Real under-orders are still caught by the >20% deviation rule
  // below, and the confirm-submit dialog separately surfaces any critical left
  // at 0 as a soft, non-blocking warning (CaptainMP `criticalMissing`).

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
