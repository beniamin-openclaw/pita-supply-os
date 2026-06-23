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

// Backend-parity note: the backend deviation gate (captain_submit) floors the
// denominator at rounding_step(rule), so suggested=0 → denom=step and any
// positive order trips the >25% reason gate. Here we use Infinity for
// suggested=0 instead — the observable outcome is identical (any positive order
// against a 0 suggestion requires a reason on both sides), so the gates never
// disagree. Keep them in sync if the backend formula changes.
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

  // Counted path — unchanged.
  const current = Number(line.current_stock_qty_base);
  const { purchase: suggested } = computeSuggestion(item, current);

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
  // Exception: suggested === 0 means nothing to order, no reason needed.
  if (item.is_critical && final < suggested && suggested > 0) {
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
