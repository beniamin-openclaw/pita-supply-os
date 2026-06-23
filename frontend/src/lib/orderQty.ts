// Cross-feature order-quantity derivations. Home for the "effective ordered qty"
// rule so it stops being copy-pasted across the Captain and Manager features
// (it previously lived in both pages/manager/lib/managerLine.ts and
// pages/captain-mp/ReceiveDeliveryPage.tsx, and the Captain order-detail card
// silently never got it — the demo round-2 Bug A).

import type { ManagerOrderLineDetail } from "../types";

/**
 * Effective ordered quantity (purchase units): the manager's final when set,
 * else the captain's final. Mirrors the backend `gmail_url._effective_qty`
 * (manager_final if > 0 else captain_final) — the quantity actually ordered from
 * the supplier. This is what every Captain/Manager surface should display for a
 * dispatched order, so they all agree on "what was ordered".
 */
export function effectiveOrderedQtyPurchase(line: ManagerOrderLineDetail): number {
  return line.manager_final_qty_purchase > 0
    ? line.manager_final_qty_purchase
    : line.captain_final_qty_purchase;
}
