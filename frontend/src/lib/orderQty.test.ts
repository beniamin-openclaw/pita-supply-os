import { describe, it, expect } from "vitest";

import { effectiveOrderedQtyPurchase, isManagerFinalSet } from "./orderQty";
import type { ManagerOrderLineDetail } from "../types";

// Minimal line factory — only the fields the rule reads matter here.
// `set` undefined = the field is absent (a backend without migration 0024).
function line(
  captain_final_qty_purchase: number,
  manager_final_qty_purchase: number,
  set?: boolean,
): ManagerOrderLineDetail {
  const l = {
    captain_final_qty_purchase,
    manager_final_qty_purchase,
  } as ManagerOrderLineDetail;
  if (set !== undefined) l.manager_final_set = set;
  return l;
}

// Same rows as the backend truth table (supply-os-v1/tests/test_order_qty.py).
describe("effectiveOrderedQtyPurchase / isManagerFinalSet", () => {
  it.each([
    // captain, manager, flag, set?, effective
    [5, 0, false, false, 5], // untouched → captain
    [5, 0, true, true, 0], // Manager zeroed → 0 (order-line-zero-qty)
    [5, 2, true, true, 2], // Manager set a positive qty
    [5, 2, false, true, 2], // legacy positive, flag off → still set
    [0, 0, false, false, 0], // skeleton line, nothing typed
    [0, 3, true, true, 3], // Manager raised a captain-0 line
  ])("captain %d, manager %d, flag %s → set %s, qty %d", (c, m, flag, set, qty) => {
    const l = line(c, m, flag);
    expect(isManagerFinalSet(l)).toBe(set);
    expect(effectiveOrderedQtyPurchase(l)).toBe(qty);
  });

  it("uses the manager's final when set (> 0) — the Bug A case", () => {
    // captain ordered 1.4, manager changed to 1.8 → card must show 1.8
    expect(effectiveOrderedQtyPurchase(line(1.4, 1.8))).toBe(1.8);
  });

  it("missing flag (older backend) keeps the old reading: 0 falls back to the captain", () => {
    expect(isManagerFinalSet(line(3, 0))).toBe(false);
    expect(effectiveOrderedQtyPurchase(line(3, 0))).toBe(3);
  });
});
