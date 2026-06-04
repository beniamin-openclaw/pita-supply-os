// Client-side derivations for the Manager v2 per-line table.
// Single source of truth for the "Manager zamawia" display value, the
// Δ vs punkt (manager-vs-captain) axis, and the per-row visual state — so the
// table and the summary strip never disagree.
//
// G2 makes the manager qty EDITABLE. The math therefore operates on an
// *effective* quantity that callers can override with the live draft value
// (instead of always reading the persisted line). The G1 read-only callers pass
// no override and get the persisted-line behavior unchanged.

import type { ManagerOrderLineDetail } from "../../../types";

/**
 * Effective "Manager zamawia" quantity (purchase units) FROM THE PERSISTED LINE.
 * Mirrors the backend `gmail_url._effective_qty`: manager_final if > 0, else
 * fall back to captain_final. Use this only when there is no live draft; the
 * edit table passes the draft value into the `*WithQty` helpers below.
 */
export function effectiveManagerQtyPurchase(line: ManagerOrderLineDetail): number {
  return line.manager_final_qty_purchase > 0
    ? line.manager_final_qty_purchase
    : line.captain_final_qty_purchase;
}

/**
 * Δ vs punkt — manager override of what the point asked for, as a signed
 * fraction (multiply by 100 for %). Spec §2 / §4 formula:
 *   (effectiveQty - captain_final) / max(captain_final, 1)
 */
export function deltaVsCaptainWithQty(captainQty: number, effectiveQty: number): number {
  return (effectiveQty - captainQty) / Math.max(captainQty, 1);
}

/** Persisted-line convenience wrapper (G1 read-only callers). */
export function deltaVsCaptain(line: ManagerOrderLineDetail): number {
  return deltaVsCaptainWithQty(
    line.captain_final_qty_purchase,
    effectiveManagerQtyPurchase(line),
  );
}

export type LineVisualState = "neutral" | "changed" | "cancelled";

/**
 * Per-row visual state (spec §4 row color coding), driven by the effective
 * manager qty vs the captain qty:
 *   - cancelled: effective qty is 0 while the captain wanted > 0 (line dropped)
 *                → amber + strike
 *   - changed:   effective manager qty differs from captain → blue tint
 *   - neutral:   manager agrees with the point → white
 *
 * `effectiveQty` is the live draft value when editing, else the persisted
 * effective qty. NOTE the difference from the persisted-only G1 rule: a draft
 * qty of 0 (manager just zeroed the cell) is "cancelled" even before save,
 * which is the intent the operator sees while editing.
 */
export function lineVisualStateWithQty(
  captainQty: number,
  effectiveQty: number,
): LineVisualState {
  if (effectiveQty === 0 && captainQty > 0) return "cancelled";
  return effectiveQty !== captainQty ? "changed" : "neutral";
}

/** Persisted-line convenience wrapper (G1 read-only callers). */
export function lineVisualState(line: ManagerOrderLineDetail): LineVisualState {
  // Preserve the G1 persisted semantics exactly: explicit manager_final == 0
  // is the only "cancelled" trigger (effectiveManagerQtyPurchase would fall
  // back to captain_final for a 0, so cancellation is keyed off the raw value).
  if (line.manager_final_qty_purchase === 0 && line.captain_final_qty_purchase > 0) {
    return "cancelled";
  }
  return lineVisualStateWithQty(
    line.captain_final_qty_purchase,
    effectiveManagerQtyPurchase(line),
  );
}

export interface ManagerSummary {
  /** Lines the manager changed vs the captain (incl. cancellations). */
  changeCount: number;
  /** Signed PLN delta of manager-effective vs captain quantities. */
  valueDeltaPln: number;
}

/**
 * Aggregate "Manager summary" strip (spec §4): how many lines the manager
 * changed vs the captain and the net PLN swing. `effectiveQtyFor` lets the edit
 * table feed live draft quantities; omit it for persisted-line behavior.
 * price_estimate_pln is per purchase unit (same basis as the order total).
 */
export function managerSummary(
  lines: ManagerOrderLineDetail[],
  effectiveQtyFor?: (line: ManagerOrderLineDetail) => number,
): ManagerSummary {
  let changeCount = 0;
  let valueDeltaPln = 0;
  for (const line of lines) {
    const effectiveQty = effectiveQtyFor
      ? effectiveQtyFor(line)
      : effectiveManagerQtyPurchase(line);
    const captainQty = line.captain_final_qty_purchase;
    const visual = effectiveQtyFor
      ? lineVisualStateWithQty(captainQty, effectiveQty)
      : lineVisualState(line);
    if (visual !== "neutral") changeCount += 1;
    const price = line.price_estimate_pln ?? 0;
    valueDeltaPln += (effectiveQty - captainQty) * price;
  }
  return { changeCount, valueDeltaPln };
}
