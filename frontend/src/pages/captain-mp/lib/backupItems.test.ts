import { describe, expect, it } from "vitest";

import { hasOrderQty, splitBackupItems } from "./backupItems";
import type { OrderableItem, OrderLine } from "../types";

function item(id: string, isBackup: boolean): OrderableItem {
  return {
    product_id: id,
    product_name_pl: id,
    inventory_unit: "kg",
    is_critical: false,
    purchase_unit: "kg",
    units_per_purchase_unit: 1,
    rounding_rule: "full_only",
    min_stock_qty_base: 0,
    max_stock_qty_base: 10,
    target_stock_qty_base: 10,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: `SP-${id}`,
    supplier_product_name: id,
    is_backup: isBackup,
  };
}

function line(final: number | ""): OrderLine {
  return {
    product_id: "P1",
    supplier_product_id: "SP1",
    current_stock_qty_base: "",
    captain_final_qty_purchase: final,
  };
}

describe("splitBackupItems", () => {
  it("splits by is_backup and keeps the original order in both groups", () => {
    const { primary, backup } = splitBackupItems([
      item("A", false),
      item("B1", true),
      item("C", false),
      item("B2", true),
    ]);
    expect(primary.map((i: OrderableItem) => i.product_id)).toEqual(["A", "C"]);
    expect(backup.map((i: OrderableItem) => i.product_id)).toEqual(["B1", "B2"]);
  });

  it("treats a missing flag as a regular item", () => {
    const { primary, backup } = splitBackupItems([{ ...item("A", false), is_backup: undefined }]);
    expect(primary).toHaveLength(1);
    expect(backup).toHaveLength(0);
  });
});

describe("hasOrderQty", () => {
  it("is true for any typed order quantity, including 0", () => {
    expect(hasOrderQty(line(2))).toBe(true);
    expect(hasOrderQty(line(0))).toBe(true);
  });

  it("is false for a blank or missing line", () => {
    expect(hasOrderQty(line(""))).toBe(false);
    expect(hasOrderQty(undefined)).toBe(false);
  });
});
