import { describe, it, expect } from "vitest";

import { lineToItem } from "./lineToItem";
import type { ManagerOrderLineDetail } from "../../../types";

function makeDetail(overrides: Partial<ManagerOrderLineDetail> = {}): ManagerOrderLineDetail {
  return {
    order_line_id: "OL-1",
    product_id: "P1",
    product_name_pl: "Cola",
    inventory_unit: "szt",
    is_critical: false,
    supplier_product_id: "SP1",
    supplier_product_name: "Cola",
    purchase_unit: "zgrzewka",
    units_per_purchase_unit: 24,
    current_stock_qty_base: 0,
    target_stock_qty_base: 48,
    max_stock_qty_base: 96,
    allow_over_max_due_to_packaging: false,
    suggested_qty_base: 48,
    suggested_qty_purchase: 2,
    captain_final_qty_purchase: 2,
    captain_final_qty_base: 48,
    manager_final_qty_purchase: 0,
    manager_final_qty_base: 0,
    captain_comment: "",
    manager_comment: "",
    ...overrides,
  };
}

describe("OrderEditPage lineToItem — alerts gate", () => {
  it("supplier alerts on + normal line => alerts on", () => {
    expect(lineToItem(makeDetail(), true).suggestion_alerts_enabled).toBe(true);
  });
  it("supplier alerts on + backup line => alerts off", () => {
    const item = lineToItem(makeDetail({ is_backup: true }), true);
    expect(item.suggestion_alerts_enabled).toBe(false);
    expect(item.is_backup).toBe(true);
  });
  it("supplier alerts off stays off", () => {
    expect(lineToItem(makeDetail(), false).suggestion_alerts_enabled).toBe(false);
  });
});
