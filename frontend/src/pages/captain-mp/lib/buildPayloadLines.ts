// Shared order-line payload builder for the Captain order screens.
//
// A row becomes a submitted line only when an order quantity (ZAMAWIASZ) was
// entered AND is > 0 — an explicit 0 or a blank order qty means "not ordering
// this product". Current stock (OBECNY STAN) is OPTIONAL: a blank stock sends
// `null` (= NOT counted, distinct from a counted 0), so the backend skips the
// deviation/critical reason gate and forces a reason only on an over-MAX order.
// Used by both the new-order submit (CaptainMP) and the edit path (OrderEditPage)
// so the rule lives in one place; NOT used by InventoryCountPage, whose
// stock-gated filter is correct for an inventory count (blank = not counted).

import type { OrderLine } from "../types";
import type { OrderLineSubmit } from "../../../types";

export function buildPayloadLines(
  lines: Record<string, OrderLine> | OrderLine[],
): OrderLineSubmit[] {
  const rows = Array.isArray(lines) ? lines : Object.values(lines);
  return rows
    .filter(
      (l) =>
        l.captain_final_qty_purchase !== "" &&
        Number(l.captain_final_qty_purchase) > 0,
    )
    .map((l) => ({
      product_id: l.product_id,
      supplier_product_id: l.supplier_product_id,
      // Blank stock → null (= NOT counted). A typed 0 is a real counted 0 and
      // stays 0 — the backend gate treats the two differently.
      current_stock_qty_base:
        l.current_stock_qty_base === "" ? null : Number(l.current_stock_qty_base),
      captain_final_qty_purchase: Number(l.captain_final_qty_purchase),
      reason_code: l.reason_code || null,
      captain_comment: l.captain_comment || undefined,
    }));
}
