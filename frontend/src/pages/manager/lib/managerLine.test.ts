import { describe, it, expect } from "vitest";

import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../../types";
import { isManagerEngaged, isOrderEditable, lineVisualState, managerSummary } from "./managerLine";

/** Minimal fixture — only the fields the visual/summary math reads matter. */
function line(
  captain: number,
  managerFinal: number,
  price = 10,
  managerSet = false,
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
    manager_final_set: managerSet,
  } as ManagerOrderLineDetail;
}

describe("lineVisualState — effective-qty based (order-line-zero-qty)", () => {
  it("untouched line (manager_final 0, flag off) is neutral, NOT cancelled", () => {
    // Bug 2: a freshly-opened order showed every line struck. The same holds
    // for an untouched line of a Transport-sent order (finalize never writes
    // manager_final).
    expect(lineVisualState(line(1, 0))).toBe("neutral");
  });

  it("a line the Manager explicitly zeroed is cancelled, whatever the status", () => {
    expect(lineVisualState(line(1, 0, 10, true))).toBe("cancelled");
  });

  it("manager_final differing and nonzero is 'changed'", () => {
    expect(lineVisualState(line(2, 5))).toBe("changed");
  });

  it("manager agrees with captain is neutral", () => {
    expect(lineVisualState(line(3, 3, 10, true))).toBe("neutral");
  });
});

describe("managerSummary — persisted lines", () => {
  it("untouched order reports zero changes", () => {
    const lines = [line(1, 0), line(2, 0)];
    expect(managerSummary(lines).changeCount).toBe(0);
  });

  it("explicitly zeroed lines count as changes with a negative PLN swing", () => {
    const lines = [line(1, 0, 10, true), line(2, 0, 10, true), line(3, 0)];
    const summary = managerSummary(lines);
    expect(summary.changeCount).toBe(2);
    expect(summary.valueDeltaPln).toBe(-30);
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

describe("isOrderEditable — edit after send (week2-feedback-quantities Phase 6)", () => {
  const base = { status: "manager_sent" } as ManagerOrderDetail;
  it("claimed is always editable", () => {
    expect(isOrderEditable({ ...base, status: "manager_claimed" })).toBe(true);
  });
  it("sent is editable only when the backend says editable_after_send", () => {
    expect(isOrderEditable({ ...base, editable_after_send: true })).toBe(true);
    expect(isOrderEditable({ ...base, editable_after_send: false })).toBe(false);
    expect(isOrderEditable(base)).toBe(false); // field absent → false
  });
  it("closed / captain_submitted are never editable", () => {
    expect(isOrderEditable({ ...base, status: "closed", editable_after_send: false })).toBe(false);
    expect(isOrderEditable({ ...base, status: "captain_submitted" })).toBe(false);
  });
});
