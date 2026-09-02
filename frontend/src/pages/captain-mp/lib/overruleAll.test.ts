import { describe, it, expect } from "vitest";
import { overruleAll } from "./overruleAll";
import type { OrderableItem, OrderLine } from "../types";

// Minimal fixtures — mirrors compute.test.ts's makeItem/makeLine so the two
// suites stay easy to cross-reference.
function makeItem(overrides: Partial<OrderableItem> = {}): OrderableItem {
  return {
    product_id: "P001",
    product_name_pl: "Test",
    inventory_unit: "szt",
    is_critical: false,
    purchase_unit: "karton",
    units_per_purchase_unit: 10,
    rounding_rule: "full_only",
    min_stock_qty_base: 0,
    max_stock_qty_base: 1000,
    target_stock_qty_base: 50,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: "SP001",
    supplier_product_name: "Test SP",
    ...overrides,
  };
}

function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    product_id: "P001",
    supplier_product_id: "SP001",
    current_stock_qty_base: "",
    captain_final_qty_purchase: "",
    reason_code: "",
    captain_comment: "",
    ...overrides,
  };
}

// A deviating line: current=0, target=50 -> suggested purchase = 5 (base 50 /
// units 10). Ordering 9 (base 90) is +80% deviation -> requiresReason=true.
function deviatingLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return makeLine({
    product_id: "P001",
    current_stock_qty_base: 0,
    captain_final_qty_purchase: 9,
    ...overrides,
  });
}

// A line that matches the suggestion exactly (suggested purchase = 5) ->
// requiresReason=false.
function matchingLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return makeLine({
    product_id: "P002",
    current_stock_qty_base: 0,
    captain_final_qty_purchase: 5,
    ...overrides,
  });
}

describe("overruleAll — applies to deviating lines", () => {
  it("sets the reason on a line that requires one and has none yet", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine() };

    const result = overruleAll(items, lines, "LOW_STORAGE", "");

    expect(result.P001.reason_code).toBe("LOW_STORAGE");
    expect(result).not.toBe(lines); // patched -> new object
  });

  it("patches every deviating line across multiple items in one call", () => {
    const items = [
      makeItem({ product_id: "P001" }),
      makeItem({ product_id: "P003" }),
    ];
    const lines = {
      P001: deviatingLine({ product_id: "P001" }),
      P003: deviatingLine({ product_id: "P003", supplier_product_id: "SP001" }),
    };

    const result = overruleAll(items, lines, "WEEKEND_HIGH_TRAFFIC", "");

    expect(result.P001.reason_code).toBe("WEEKEND_HIGH_TRAFFIC");
    expect(result.P003.reason_code).toBe("WEEKEND_HIGH_TRAFFIC");
  });

  it("stores the comment on the patched line when the reason is OTHER", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine() };

    const result = overruleAll(items, lines, "OTHER", "Explained once for all lines");

    expect(result.P001.reason_code).toBe("OTHER");
    expect(result.P001.captain_comment).toBe("Explained once for all lines");
  });
});

describe("overruleAll — never replaces an existing reason", () => {
  it("skips a line that already has a reason set, even a different one", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine({ reason_code: "SUPPLIER_UNDERDELIVERS" }) };

    const result = overruleAll(items, lines, "LOW_STORAGE", "");

    expect(result.P001.reason_code).toBe("SUPPLIER_UNDERDELIVERS");
    expect(result).toBe(lines); // nothing changed -> same reference
  });

  it("skips a line already set to OTHER even without a comment yet (the Captain still picked it)", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = {
      P001: deviatingLine({ reason_code: "OTHER", captain_comment: "" }),
    };

    const result = overruleAll(items, lines, "LOW_STORAGE", "");

    expect(result.P001.reason_code).toBe("OTHER");
    expect(result.P001.captain_comment).toBe("");
  });

  it("only patches the untouched line in a mixed batch", () => {
    const items = [
      makeItem({ product_id: "P001" }),
      makeItem({ product_id: "P003" }),
    ];
    const lines = {
      P001: deviatingLine({ product_id: "P001", reason_code: "OTHER", captain_comment: "already explained" }),
      P003: deviatingLine({ product_id: "P003" }),
    };

    const result = overruleAll(items, lines, "LOW_STORAGE", "");

    expect(result.P001.reason_code).toBe("OTHER");
    expect(result.P001.captain_comment).toBe("already explained");
    expect(result.P003.reason_code).toBe("LOW_STORAGE");
  });
});

describe("overruleAll — skips lines that don't require a reason", () => {
  it("leaves a line matching its suggestion untouched", () => {
    const items = [makeItem({ product_id: "P002" })];
    const lines = { P002: matchingLine() };

    const result = overruleAll(items, lines, "LOW_STORAGE", "");

    expect(result.P002.reason_code).toBe("");
    expect(result).toBe(lines);
  });

  it("leaves a blank (not-yet-ordered) line untouched", () => {
    const items = [makeItem({ product_id: "P004" })];
    const lines = { P004: makeLine({ product_id: "P004" }) };

    const result = overruleAll(items, lines, "LOW_STORAGE", "");

    expect(result.P004.reason_code).toBe("");
    expect(result).toBe(lines);
  });
});

describe("overruleAll — OTHER without a comment is a no-op", () => {
  it("patches nothing when OTHER is chosen with a blank comment", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine() };

    const result = overruleAll(items, lines, "OTHER", "");

    expect(result).toBe(lines);
    expect(result.P001.reason_code).toBe("");
  });

  it("patches nothing when OTHER's comment is whitespace-only", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine() };

    const result = overruleAll(items, lines, "OTHER", "   ");

    expect(result).toBe(lines);
  });

  it("is a no-op across a whole batch, not just the OTHER-affected line", () => {
    const items = [
      makeItem({ product_id: "P001" }),
      makeItem({ product_id: "P003" }),
    ];
    const lines = {
      P001: deviatingLine({ product_id: "P001" }),
      P003: deviatingLine({ product_id: "P003" }),
    };

    const result = overruleAll(items, lines, "OTHER", "");

    expect(result).toBe(lines);
    expect(result.P001.reason_code).toBe("");
    expect(result.P003.reason_code).toBe("");
  });
});

describe("overruleAll — defensive edge cases", () => {
  it("ignores an item with no corresponding line entry", () => {
    const items = [makeItem({ product_id: "P999" })];
    const lines: Record<string, OrderLine> = {};

    const result = overruleAll(items, lines, "LOW_STORAGE", "");

    expect(result).toBe(lines);
  });

  it("returns the same reference when items is empty", () => {
    const lines = { P001: deviatingLine() };

    const result = overruleAll([], lines, "LOW_STORAGE", "");

    expect(result).toBe(lines);
  });
});
