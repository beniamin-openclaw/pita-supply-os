// Cross-feature order-quantity derivations. Home for the "effective ordered qty"
// rule so it stops being copy-pasted across the Captain and Manager features
// (it previously lived in both pages/manager/lib/managerLine.ts and
// pages/captain-mp/ReceiveDeliveryPage.tsx, and the Captain order-detail card
// silently never got it — the demo round-2 Bug A).
//
// Backend twin: supply-os-v1/app/order_qty.py — keep the two rules identical.

import type { ManagerOrderLineDetail } from "../types";

/**
 * Has the Manager committed a quantity for this line (including 0)?
 * `manager_final_set` is the stored flag (order-line-zero-qty); a positive
 * manager_final also counts, so a line from a backend without the flag keeps
 * the old reading.
 */
export function isManagerFinalSet(line: ManagerOrderLineDetail): boolean {
  return line.manager_final_set === true || line.manager_final_qty_purchase > 0;
}

/**
 * Effective ordered quantity (purchase units): the Manager's final once set —
 * an explicit 0 included — else the Captain's final. Mirrors the backend
 * `order_qty.effective_ordered_qty` — the quantity actually ordered from the
 * supplier. This is what every Captain/Manager surface should display for a
 * dispatched order, so they all agree on "what was ordered".
 */
export function effectiveOrderedQtyPurchase(line: ManagerOrderLineDetail): number {
  return isManagerFinalSet(line)
    ? line.manager_final_qty_purchase
    : line.captain_final_qty_purchase;
}
