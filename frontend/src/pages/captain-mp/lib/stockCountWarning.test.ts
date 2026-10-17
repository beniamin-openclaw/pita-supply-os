import { describe, expect, it } from "vitest";

import type { OrderableItem, OrderLine } from "../types";
import { requiresStockCount, stockCountWarning } from "./stockCountWarning";

function item(id: string, overrides: Partial<OrderableItem> = {}): OrderableItem {
  return {
    product_id: id,
    product_name_pl: `Produkt ${id}`,
    inventory_unit: "szt",
    is_critical: false,
    purchase_unit: "szt",
    units_per_purchase_unit: 1,
    rounding_rule: "full_only",
    min_stock_qty_base: 0,
    max_stock_qty_base: 100,
    target_stock_qty_base: 50,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: `SP-${id}`,
    supplier_product_name: `SP ${id}`,
    require_stock_count: true,
    ...overrides,
  };
}

function line(id: string, stock: number | "", qty: number | "" = ""): OrderLine {
  return {
    product_id: id,
    supplier_product_id: `SP-${id}`,
    current_stock_qty_base: stock,
    captain_final_qty_purchase: qty,
  };
}

function linesOf(...rows: OrderLine[]): Record<string, OrderLine> {
  return Object.fromEntries(rows.map((row) => [row.product_id, row]));
}

describe("requiresStockCount", () => {
  it("is on when the flag is true or absent (older backend)", () => {
    expect(requiresStockCount([item("P1")])).toBe(true);
    expect(requiresStockCount([item("P1", { require_stock_count: undefined })])).toBe(true);
    expect(requiresStockCount([])).toBe(true);
  });

  it("is off when the location flag is false", () => {
    expect(requiresStockCount([item("P1", { require_stock_count: false })])).toBe(false);
  });
});

describe("stockCountWarning", () => {
  const items: OrderableItem[] = [item("P1"), item("P2"), item("P3")];

  it("missing: no stock on any card, even with order quantities typed", () => {
    expect(stockCountWarning(items, linesOf(line("P1", "", 5), line("P2", ""), line("P3", ""))))
      .toBe("missing");
  });

  it("missing: lines not created yet count as blank", () => {
    expect(stockCountWarning(items, {})).toBe("missing");
  });

  it("allZero: every entered stock is 0, blanks ignored", () => {
    expect(stockCountWarning(items, linesOf(line("P1", 0, 5), line("P2", 0), line("P3", ""))))
      .toBe("allZero");
  });

  it("none: one real count above zero is enough", () => {
    expect(stockCountWarning(items, linesOf(line("P1", 0, 5), line("P2", 3), line("P3", ""))))
      .toBe("none");
  });

  it("none: ordering only products that ran out is a correct order", () => {
    // P1 is ordered at stock 0; the other cards carry real counts.
    expect(stockCountWarning(items, linesOf(line("P1", 0, 5), line("P2", 12), line("P3", 7))))
      .toBe("none");
  });

  it("none: a fractional count is a count (0.5 kg)", () => {
    expect(stockCountWarning(items, linesOf(line("P1", 0.5), line("P2", 0), line("P3", 0))))
      .toBe("none");
  });

  it("none whatever the stocks when the location flag is off (Norblin, Elektrownia)", () => {
    const off: OrderableItem[] = items.map((it) => ({ ...it, require_stock_count: false }));
    expect(stockCountWarning(off, {})).toBe("none");
    expect(stockCountWarning(off, linesOf(line("P1", 0), line("P2", 0), line("P3", 0))))
      .toBe("none");
  });

  it("ignores backup cards: their stock belongs to the primary supplier's tab", () => {
    const mixed: OrderableItem[] = [item("P1"), item("B1", { is_backup: true })];
    // Only the backup card has a count -> the real card is still uncounted.
    expect(stockCountWarning(mixed, linesOf(line("P1", "", 2), line("B1", 4)))).toBe("missing");
    // A zero on a backup card does not make the screen "all zero".
    expect(stockCountWarning(mixed, linesOf(line("P1", 6), line("B1", 0)))).toBe("none");
  });

  it("none on a tab with only backup cards or no cards", () => {
    expect(stockCountWarning([item("B1", { is_backup: true })], {})).toBe("none");
    expect(stockCountWarning([], {})).toBe("none");
  });
});
