import { describe, it, expect } from "vitest";
import { computeRowState } from "./compute";
import type { OrderableItem, OrderLine } from "../types";

// Minimal fixture — only fields used by compute.ts
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
    max_stock_qty_base: 100,
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

describe("computeRowState — empty inputs", () => {
  it("returns grey when either input is empty", () => {
    const { state, requiresReason } = computeRowState(makeItem(), makeLine());
    expect(state).toBe("grey");
    expect(requiresReason).toBe(false);
  });

  it("returns grey only when ORDER qty is empty (a blank stock alone no longer suppresses)", () => {
    // Stock filled, order qty empty → still grey (nothing to evaluate).
    const { state } = computeRowState(makeItem(), makeLine({ current_stock_qty_base: 10 }));
    expect(state).toBe("grey");
  });
});

describe("computeRowState — blank stock = uncounted, over-MAX is the only gate", () => {
  // makeItem default: units=10, max=100, allow_over_max=false → over MAX when
  // order * 10 > 100, i.e. order > 10.
  it("blank stock + order over MAX, no reason → red + requiresReason, no %", () => {
    const { state, requiresReason, messageKey, messageVars, deviationPct } = computeRowState(
      makeItem(),
      makeLine({ current_stock_qty_base: "", captain_final_qty_purchase: 11 }), // base 110 > 100
    );
    expect(state).toBe("red");
    expect(requiresReason).toBe(true);
    expect(messageKey).toBe("state.overMaxNoStock");
    expect(messageVars).toBeUndefined();
    expect(deviationPct).toBeNull();
  });

  it("blank stock + over MAX with a reason → orange + requiresReason, no %", () => {
    const { state, requiresReason, messageKey } = computeRowState(
      makeItem(),
      makeLine({
        current_stock_qty_base: "",
        captain_final_qty_purchase: 11,
        reason_code: "PACKAGING_LIMITATION",
      }),
    );
    expect(state).toBe("orange");
    expect(requiresReason).toBe(true);
    expect(messageKey).toBe("state.overMaxNoStockReason");
  });

  it("blank stock + normal order within MAX → yellow, NO reason (the key win)", () => {
    // order 9 → base 90 <= 100. Counted as 0 this would trip the >20% gate vs
    // suggested 5; uncounted it needs no reason.
    const { state, requiresReason, messageKey, deviationPct } = computeRowState(
      makeItem(),
      makeLine({ current_stock_qty_base: "", captain_final_qty_purchase: 9 }),
    );
    expect(state).toBe("yellow");
    expect(requiresReason).toBe(false);
    expect(messageKey).toBe("state.smallAdjNoStock");
    expect(deviationPct).toBeNull();
  });

  it("blank stock + allow_over_max → never over MAX → yellow, no reason", () => {
    const { state, requiresReason } = computeRowState(
      makeItem({ allow_over_max_due_to_packaging: true }),
      makeLine({ current_stock_qty_base: "", captain_final_qty_purchase: 50 }), // base 500
    );
    expect(state).toBe("yellow");
    expect(requiresReason).toBe(false);
  });

  it("blank stock + max unset (0) → no ceiling → yellow, no reason", () => {
    const { state, requiresReason } = computeRowState(
      makeItem({ max_stock_qty_base: 0 }),
      makeLine({ current_stock_qty_base: "", captain_final_qty_purchase: 99 }),
    );
    expect(state).toBe("yellow");
    expect(requiresReason).toBe(false);
  });
});

describe("computeRowState — matches suggestion", () => {
  it("returns green when order exactly matches suggestion", () => {
    // target=50, stock=45 → need 5 base → 5/10 = 0.5 → ceil = 1 purchase unit
    const { state, requiresReason, deviationPct } = computeRowState(
      makeItem({ target_stock_qty_base: 50, units_per_purchase_unit: 10 }),
      makeLine({ current_stock_qty_base: 45, captain_final_qty_purchase: 1 }),
    );
    expect(state).toBe("green");
    expect(requiresReason).toBe(false);
    expect(deviationPct).toBe(0);
  });
});

describe("computeRowState — critical product, suggestion = 0", () => {
  it("ordering 0 on a critical when suggestion is also 0 → green, no reason required", () => {
    // Operator decision 2026-06-09: this was previously forced to red.
    // stock >= target → suggestion = 0 → ordering 0 = match.
    const item = makeItem({ is_critical: true, target_stock_qty_base: 20 });
    const line = makeLine({ current_stock_qty_base: 20, captain_final_qty_purchase: 0 });
    const { state, requiresReason } = computeRowState(item, line);
    expect(state).toBe("green");
    expect(requiresReason).toBe(false);
  });

  it("same for stock > target", () => {
    const item = makeItem({ is_critical: true, target_stock_qty_base: 10 });
    const line = makeLine({ current_stock_qty_base: 30, captain_final_qty_purchase: 0 });
    const { state, requiresReason } = computeRowState(item, line);
    expect(state).toBe("green");
    expect(requiresReason).toBe(false);
  });
});

describe("computeRowState — critical product, real under-order", () => {
  it("ordering 0 on a critical when suggestion > 0, no reason → red + requiresReason", () => {
    // target=50, stock=0 → need 50 base → 5 purchase units (ceil(50/10)=5)
    // ordering 0 vs suggestion 5 = -100% deviation → >20% → no reason → red
    const item = makeItem({ is_critical: true, target_stock_qty_base: 50, units_per_purchase_unit: 10 });
    const line = makeLine({ current_stock_qty_base: 0, captain_final_qty_purchase: 0 });
    const { state, requiresReason } = computeRowState(item, line);
    expect(state).toBe("red");
    expect(requiresReason).toBe(true);
  });

  it("ordering 0 on a critical when suggestion > 0, with reason → orange + requiresReason", () => {
    const item = makeItem({ is_critical: true, target_stock_qty_base: 50, units_per_purchase_unit: 10 });
    const line = makeLine({
      current_stock_qty_base: 0,
      captain_final_qty_purchase: 0,
      reason_code: "LOW_STORAGE",
    });
    const { state, requiresReason } = computeRowState(item, line);
    expect(state).toBe("orange");
    expect(requiresReason).toBe(true);
  });
});

describe("computeRowState — critical product, small under-order (≤20%)", () => {
  it("critical + 2% under-order, no reason → red + requiresReason (P006 Pomidor case)", () => {
    // target=42, stock=3, suggestion=ceil(39/1)=39, order=38 → -2.6% deviation
    // Backend rejects this without a reason_code — frontend must match.
    const item = makeItem({ is_critical: true, target_stock_qty_base: 42, units_per_purchase_unit: 1 });
    const line = makeLine({ current_stock_qty_base: 3, captain_final_qty_purchase: 38 });
    const { state, requiresReason } = computeRowState(item, line);
    expect(state).toBe("red");
    expect(requiresReason).toBe(true);
  });

  it("critical + 2% under-order, with reason → orange + requiresReason", () => {
    const item = makeItem({ is_critical: true, target_stock_qty_base: 42, units_per_purchase_unit: 1 });
    const line = makeLine({
      current_stock_qty_base: 3,
      captain_final_qty_purchase: 38,
      reason_code: "LOW_STORAGE",
    });
    const { state, requiresReason } = computeRowState(item, line);
    expect(state).toBe("orange");
    expect(requiresReason).toBe(true);
  });

  it("non-critical + 2% under-order, no reason → yellow (unchanged)", () => {
    const item = makeItem({ is_critical: false, target_stock_qty_base: 42, units_per_purchase_unit: 1 });
    const line = makeLine({ current_stock_qty_base: 3, captain_final_qty_purchase: 38 });
    const { state, requiresReason } = computeRowState(item, line);
    expect(state).toBe("yellow");
    expect(requiresReason).toBe(false);
  });
});

describe("computeRowState — small deviation", () => {
  it("≤20% deviation without reason → yellow, no requiresReason", () => {
    // target=50, stock=40 → need 10 → 10/10 = 1 purchase unit (suggestion)
    // order 1.1 pu would be >1 but for full_only we stay with whole numbers
    // suggestion=1, order=1 → exact match. Let's set suggestion to be 5 and order 4.
    // target=50, units=10 → need 50, suggestion = ceil(50/10)=5. stock=0.
    // order=4 → deviation = (4-5)/5 = -20% → exactly at boundary → yellow
    const item = makeItem({ target_stock_qty_base: 50, units_per_purchase_unit: 10 });
    const line = makeLine({ current_stock_qty_base: 0, captain_final_qty_purchase: 4 });
    const { state, requiresReason } = computeRowState(item, line);
    expect(state).toBe("yellow");
    expect(requiresReason).toBe(false);
  });
});
