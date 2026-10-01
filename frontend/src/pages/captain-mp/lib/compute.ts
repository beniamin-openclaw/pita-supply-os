// Card-state logic — returns translation keys + vars so the UI layer can
// translate to the active language. Pure functions, no React context.

import type { OrderableItem, OrderLine, CardState } from "../types";
import type { StringKey } from "../../../i18n/strings";

/** Round to 6 decimals to suppress IEEE-754 artefacts — twin of `_clean`. */
function clean(x: number): number {
  return Number(x.toFixed(6));
}

/**
 * Nearest integer, halves UP (0.5 → 1, 1.5 → 2, 2.5 → 3), pre-cleaned to 6
 * decimals — twin of `round_half_up` in suggestion.py (plan-review F4: the
 * backend used banker's rounding before).
 */
export function roundHalfUp(x: number): number {
  return Math.floor(clean(x) + 0.5);
}

/**
 * Smallest purchase-unit increment a rule can emit — twin of `rounding_step`;
 * the deviation denominator floor (`max(reference, step)`).
 */
export function roundingStep(rule: OrderableItem["rounding_rule"]): number {
  if (rule === "half_allowed") return 0.5;
  if (rule === "tenth_kg") return 0.1;
  return 1;
}

/** Purchase units per bulk pack, or null when the item has no (valid) case —
 *  twin of `has_case` (migration 0028). */
export function caseSize(item: Pick<OrderableItem, "units_per_case">): number | null {
  const upc = item.units_per_case;
  return typeof upc === "number" && Number.isFinite(upc) && upc > 1 ? upc : null;
}

/** D33: the need rounded to the nearest whole case, half up (need 2 kg of a
 *  6 kg crate → 0, 3 → 6, 4 → 6, 10 → 12); the need itself without a case.
 *  Twin of `case_suggestion`. */
export function caseSuggestion(needPurchase: number, unitsPerCase: number | null): number {
  if (unitsPerCase === null || needPurchase <= 0) return needPurchase;
  return clean(roundHalfUp(needPurchase / unitsPerCase) * unitsPerCase);
}

/** D34: the nearer of need and case suggestion, ties to the need — twin of
 *  `deviation_reference`. Without a case both are equal. */
export function deviationReference(final: number, need: number, suggested: number): number {
  return Math.abs(final - need) <= Math.abs(final - suggested) ? need : suggested;
}

/** D34: the uncounted over-MAX ceiling — max rounded UP to a whole case
 *  (`ceil(max / (upc·upp)) · upc·upp`); max itself without a case. Twin of
 *  `case_rounded_max`. */
export function caseRoundedMax(maxBase: number, upp: number, unitsPerCase: number | null): number {
  if (unitsPerCase === null || maxBase <= 0) return maxBase;
  const packBase = unitsPerCase * upp;
  return clean(Math.ceil(clean(maxBase / packBase)) * packBase);
}

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
      return isCritical ? Math.ceil(raw) : roundHalfUp(raw);
    case "tenth_kg":
      // Ceil to the next 0.1. Pre-clean to dodge float artifacts
      // (2.3 * 10 === 23.000000000000004 would ceil to the wrong tenth).
      return Math.ceil(Number((raw * 10).toFixed(6))) / 10;
    case "full_only":
    default:
      return Math.ceil(raw);
  }
}

/**
 * `base` — the raw need in inventory units (target − stock, the "brakuje" the
 * card shows); `need` — that need in purchase units, rounded per rule;
 * `purchase` — the suggestion: `need` rounded to the nearest whole case when
 * the item has one (D33), else `need` itself (byte-identical to before).
 */
export function computeSuggestion(
  item: OrderableItem,
  currentStock: number,
): { base: number; purchase: number; need: number } {
  const suggestedBase = Math.max(0, item.target_stock_qty_base - currentStock);
  const raw = suggestedBase / item.units_per_purchase_unit;
  const need = roundPerRule(raw, item.rounding_rule, item.is_critical);
  const suggestedPurchase = caseSuggestion(need, caseSize(item));
  return { base: suggestedBase, purchase: suggestedPurchase, need };
}

/**
 * Signed % deviation of `finalPurchase` from `reference`. With `step` (the
 * rule's rounding step) the denominator is `max(reference, step)` — the
 * backend's stored delta (F9), so a reference of 0 gives a finite %. Without
 * `step` the legacy form: a reference of 0 returns Infinity for a positive
 * order (computeRowState always passes the step).
 */
export function computeDeviation(
  reference: number,
  finalPurchase: number,
  step?: number,
): number {
  const denominator = step === undefined ? reference : Math.max(reference, step);
  if (denominator === 0) {
    return finalPurchase > 0 ? Infinity : 0;
  }
  return ((finalPurchase - reference) / denominator) * 100;
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

  // Supplier with suggestion alerts off (Pago, pago-suggestion-no-alerts):
  // the suggestion stays on the card, but no deviation / critical / over-MAX
  // alert and never a reason — mirrors the backend `_evaluate_submit_line`
  // with alerts_enabled=False. Green when the order equals the suggestion,
  // otherwise a neutral grey pill.
  if (item.suggestion_alerts_enabled === false) {
    const s =
      line.current_stock_qty_base !== ""
        ? computeSuggestion(item, Number(line.current_stock_qty_base))
        : null;
    // With a case, ordering the need is as "matching" as ordering the case.
    if (s !== null && (final === s.purchase || final === s.need)) {
      return { state: "green", messageKey: "state.match", requiresReason: false, deviationPct: 0 };
    }
    return {
      state: "grey",
      messageKey: "state.orderEntered",
      requiresReason: false,
      deviationPct: null,
    };
  }

  const hasReason =
    !!line.reason_code && (line.reason_code !== "OTHER" || !!line.captain_comment);

  // Blank CURRENT STOCK = not counted. There is no real suggestion to deviate
  // from (the UI shows "—"), so the deviation + critical gates are skipped. A
  // reason is forced only on an over-MAX order — the storage ceiling, the one
  // stock-independent concern. Mirrors the backend `_evaluate_submit_line`
  // uncounted branch; no "%" (nothing to compare against).
  if (line.current_stock_qty_base === "") {
    const orderBase = final * item.units_per_purchase_unit;
    // With a case the ceiling is max rounded up to a whole case (D34).
    const maxAllowed = caseRoundedMax(
      item.max_stock_qty_base,
      item.units_per_purchase_unit,
      caseSize(item),
    );
    const overMax =
      item.max_stock_qty_base > 0 &&
      !item.allow_over_max_due_to_packaging &&
      orderBase > maxAllowed;
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
  const { purchase: suggested, need } = computeSuggestion(item, current);

  // Counted stock at/above target → suggestion 0 is INFORMATION, not a gate
  // (week2-feedback-quantities Phase 1; mirrors the backend
  // `_evaluate_submit_line` third branch). There is no baseline to express a
  // % against, so no reason is ever required here: nothing ordered → green
  // match as before; something ordered → a yellow informational pill naming
  // the stock vs target, no % and no ReasonPicker. Keyed on the NEED
  // (plan-review F1): a case suggestion of 0 with a need above 0 still gates.
  if (need === 0) {
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

  // D34: measured against the nearer of need and case suggestion (the same
  // number without a case), with the backend's step floor.
  const reference = deviationReference(final, need, suggested);
  const deviation = computeDeviation(reference, final, roundingStep(item.rounding_rule));
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
  // mirrors the backend gate in captain_submit / captain_order_edit. With a
  // case only below the smaller of need and case suggestion (D34).
  if (item.is_critical && final < Math.min(need, suggested)) {
    return reasonResult();
  }

  // Green when the order equals the reference: the suggestion, or (with a
  // case) the need — both "match" (plan-review F1).
  if (final === reference) {
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
