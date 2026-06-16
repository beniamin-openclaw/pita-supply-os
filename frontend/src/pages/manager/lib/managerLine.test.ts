import { describe, it, expect } from "vitest";

import type { ManagerOrderLineDetail } from "../../../types";
import { isManagerEngaged, lineVisualState, managerSummary } from "./managerLine";

/** Minimal fixture — only the fields the visual/summary math reads matter. */
function line(
  captain: number,
  managerFinal: number,
  price = 10,
): ManagerOrderLineDetail {
  return {
    order_line_id: "OL-1",
    product_id: "P",
    product_name_pl: "P",
    inventory_unit: "kg",
    is_critical: false,
    supplier_product_id: "SP",
    supplier_product_name: "SP",
    purchase_unit: "karton",
    units_per_purchase_unit: 1,
    rounding_rule: "full_only",
    price_estimate_pln: price,
    current_stock_qty_base: 0,
    target_stock_qty_base: 0,
    suggested_qty_base: 0,
    suggested_qty_purchase: 0,
    captain_final_qty_purchase: captain,
    captain_final_qty_base: captain,
    manager_final_qty_purchase: managerFinal,
    manager_final_qty_base: managerFinal,
    delta_vs_suggestion_pct: null,
    reason_code: null,
    captain_comment: "",
    manager_comment: "",
  } as ManagerOrderLineDetail;
}

describe("lineVisualState — status-aware cancelled (Bug 2)", () => {
  it("undispatched: manager_final 0 with captain > 0 is neutral, NOT cancelled", () => {
    // The bug: a freshly-opened captain_submitted order showed every line struck.
    expect(lineVisualState(line(1, 0), false)).toBe("neutral");
  });

  it("dispatched: manager_final 0 with captain > 0 is cancelled (line dropped)", () => {
    expect(lineVisualState(line(1, 0), true)).toBe("cancelled");
  });

  it("manager_final differing and nonzero is 'changed' regardless of dispatch", () => {
    expect(lineVisualState(line(2, 5), false)).toBe("changed");
    expect(lineVisualState(line(2, 5), true)).toBe("changed");
  });

  it("manager agrees with captain is neutral", () => {
    expect(lineVisualState(line(3, 3), true)).toBe("neutral");
  });
});

describe("managerSummary — persisted, status-aware", () => {
  it("undispatched untouched order reports zero changes", () => {
    const lines = [line(1, 0), line(2, 0)];
    expect(managerSummary(lines, undefined, false).changeCount).toBe(0);
  });

  it("dispatched order with zeroed lines counts them as changes", () => {
    const lines = [line(1, 0), line(2, 0)];
    expect(managerSummary(lines, undefined, true).changeCount).toBe(2);
  });
});

describe("isManagerEngaged — Bug C summary status guard", () => {
  it("captain_submitted is NOT engaged (summary strip hidden pre-claim)", () => {
    expect(isManagerEngaged("captain_submitted")).toBe(false);
  });

  it("manager_claimed / manager_sent / closed are engaged", () => {
    expect(isManagerEngaged("manager_claimed")).toBe(true);
    expect(isManagerEngaged("manager_sent")).toBe(true);
    expect(isManagerEngaged("closed")).toBe(true);
  });
});
