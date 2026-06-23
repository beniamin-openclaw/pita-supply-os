import { describe, it, expect } from "vitest";

import { effectiveOrderedQtyPurchase } from "./orderQty";
import type { ManagerOrderLineDetail } from "../types";

// Minimal line factory — only the two fields the rule reads matter here.
function line(
  captain_final_qty_purchase: number,
  manager_final_qty_purchase: number,
): ManagerOrderLineDetail {
  return {
    captain_final_qty_purchase,
    manager_final_qty_purchase,
  } as ManagerOrderLineDetail;
}

describe("effectiveOrderedQtyPurchase", () => {
  it("uses the manager's final when set (> 0) — the Bug A case", () => {
    // captain ordered 1.4, manager changed to 1.8 → card must show 1.8
    expect(effectiveOrderedQtyPurchase(line(1.4, 1.8))).toBe(1.8);
  });

  it("falls back to the captain's final when manager is 0 (not set)", () => {
    expect(effectiveOrderedQtyPurchase(line(1.4, 0))).toBe(1.4);
  });

  it("treats a manager drop-to-zero as captain fallback (0 means not-set here)", () => {
    // The 'cancelled line' semantics live in managerLine.lineVisualState, not here.
    expect(effectiveOrderedQtyPurchase(line(3, 0))).toBe(3);
  });
});
