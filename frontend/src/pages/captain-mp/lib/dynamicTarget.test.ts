import { describe, it, expect } from "vitest";

import { deliveryWindowOf, dynamicSource, overlaySnapshotTargets } from "./dynamicTarget";
import type { ManagerOrderLineDetail, OrderableItem, TargetSource } from "../../../types";

function item(pid: string, overrides: Partial<OrderableItem> = {}): OrderableItem {
  return {
    product_id: pid,
    product_name_pl: pid,
    inventory_unit: "kg",
    is_critical: false,
    purchase_unit: "blok",
    units_per_purchase_unit: 15,
    rounding_rule: "full_only",
    min_stock_qty_base: 2,
    max_stock_qty_base: 10,
    target_stock_qty_base: 10,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: `SP_${pid}`,
    supplier_product_name: pid,
    ...overrides,
  };
}

const dyn: TargetSource = {
  mode: "dynamic",
  static_target_base: 10,
  usage_per_day_base: 12.75,
  confidence: "A",
  delivery_date: "2026-09-08",
  next_delivery_date: "2026-09-12",
  days_until_delivery: 1,
  horizon_days: 4,
  safety_base: 12.8,
  max_raised_from: 10,
};

function line(pid: string, target: number): ManagerOrderLineDetail {
  return {
    order_line_id: `OL-${pid}`,
    product_id: pid,
    product_name_pl: pid,
    inventory_unit: "kg",
    is_critical: false,
    supplier_product_id: `SP_${pid}`,
    supplier_product_name: pid,
    purchase_unit: "blok",
    units_per_purchase_unit: 15,
    rounding_rule: "full_only",
    price_estimate_pln: null,
    current_stock_qty_base: 20,
    target_stock_qty_base: target,
    max_stock_qty_base: 10,
    allow_over_max_due_to_packaging: false,
    suggested_qty_base: 0,
    suggested_qty_purchase: 0,
    captain_final_qty_purchase: 3,
    captain_final_qty_base: 45,
    manager_final_qty_purchase: 0,
    manager_final_qty_base: 0,
    delta_vs_suggestion_pct: null,
    reason_code: null,
    captain_comment: "",
    manager_comment: "",
  } as ManagerOrderLineDetail;
}

describe("dynamicSource / deliveryWindowOf", () => {
  it("returns the source only for dynamic items", () => {
    expect(dynamicSource(item("P024", { target_source: dyn }))).toBe(dyn);
    expect(dynamicSource(item("P079", { target_source: { mode: "static", reason: "confidence_c" } }))).toBeNull();
    expect(dynamicSource(item("P001"))).toBeNull();
  });

  it("picks the window from the first dynamic item, null when none", () => {
    expect(deliveryWindowOf([item("P079", { target_source: { mode: "static" } }), item("P024", { target_source: dyn })]))
      .toEqual({ delivery: "2026-09-08", next: "2026-09-12" });
    expect(deliveryWindowOf([item("P079"), item("P080")])).toBeNull();
  });
});

describe("overlaySnapshotTargets (edit screen, H4)", () => {
  it("keeps the snapshot target for products on the order and raises max to it", () => {
    const fresh = [item("P024", { target_stock_qty_base: 76.6, max_stock_qty_base: 76.6, target_source: dyn }), item("P027", { target_source: dyn })];
    const out = overlaySnapshotTargets(fresh, [line("P024", 65)]);
    expect(out[0].target_stock_qty_base).toBe(65);
    expect(out[0].max_stock_qty_base).toBe(76.6); // never below the fresh max
    expect(out[0].target_source).toBeUndefined();
    // Not on the order → untouched (backend resolves it fresh too).
    expect(out[1]).toBe(fresh[1]);
  });

  it("raises max to the snapshot when the fresh max is lower", () => {
    const out = overlaySnapshotTargets([item("P024", { max_stock_qty_base: 10, target_source: dyn })], [line("P024", 65)]);
    expect(out[0].max_stock_qty_base).toBe(65);
  });

  it("is a no-op when the backend served no target_source (flag off)", () => {
    const fresh = [item("P024", { target_stock_qty_base: 10 })];
    expect(overlaySnapshotTargets(fresh, [line("P024", 65)])).toBe(fresh);
  });
});
