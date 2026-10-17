// Stock-count warning for the Captain's confirm dialog (captain-stock-count-
// warning, owner decision D6 of 2026-10-17). Non-blocking: the dialog shows a
// warning and the Captain can still send.
//
// Which cards count: every card shown for the active supplier, except backup
// cards. Not only the lines with an order quantity > 0. The stock count is the
// first step on the screen and covers every card (the suggestion tile fills
// "Zamawiasz" only after a stock is typed, and the inventory prefill fills every
// card), and limiting it to ordered lines would cry "all zero" whenever the
// Captain orders only products that ran out — a correct order. Backup cards
// carry no suggestion; their stock is counted on the primary supplier's tab.
//
// Blank = not counted, 0 = counted and none on hand (the blank-vs-0 rule).

import type { OrderableItem, OrderLine } from "../types";

export type StockCountWarning = "none" | "missing" | "allZero";

/** The location's `require_stock_count` flag as it rides on the orderable
 *  items. Absent (older backend) = ON, like the column default; one item with
 *  an explicit `false` turns it off (the backend sends the same value on all). */
export function requiresStockCount(items: readonly OrderableItem[]): boolean {
  return !items.some((item) => item.require_stock_count === false);
}

/**
 * - `"missing"`: no stock was entered on any counted card;
 * - `"allZero"`: at least one stock was entered and every entered stock is 0;
 * - `"none"`: anything else, the flag is off, or there is no card to count.
 */
export function stockCountWarning(
  items: readonly OrderableItem[],
  lines: Readonly<Record<string, OrderLine | undefined>>,
): StockCountWarning {
  if (!requiresStockCount(items)) return "none";
  const counted: OrderableItem[] = items.filter((item) => item.is_backup !== true);
  if (counted.length === 0) return "none";
  const entered: number[] = [];
  for (const item of counted) {
    // null is defensive: a restored draft or an API value could carry it.
    const stock: number | "" | null | undefined = lines[item.product_id]?.current_stock_qty_base;
    if (stock === "" || stock === undefined || stock === null) continue;
    entered.push(Number(stock));
  }
  if (entered.length === 0) return "missing";
  return entered.every((value) => value === 0) ? "allZero" : "none";
}
