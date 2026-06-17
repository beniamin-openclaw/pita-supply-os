import { describe, it, expect } from "vitest";

import { buildPayloadLines } from "./buildPayloadLines";
import type { OrderLine } from "../types";

function row(over: Partial<OrderLine>): OrderLine {
  return {
    product_id: "P1",
    supplier_product_id: "SP1",
    current_stock_qty_base: "",
    captain_final_qty_purchase: "",
    ...over,
  };
}

describe("buildPayloadLines", () => {
  it("includes a row with order qty > 0 and blank stock, coercing stock to 0", () => {
    const out = buildPayloadLines({
      P1: row({ product_id: "P1", captain_final_qty_purchase: 5 }),
    });
    expect(out).toHaveLength(1);
    expect(out[0].current_stock_qty_base).toBe(0);
    expect(out[0].captain_final_qty_purchase).toBe(5);
  });

  it("excludes a row with order qty 0", () => {
    const out = buildPayloadLines({
      P1: row({ captain_final_qty_purchase: 0, current_stock_qty_base: 3 }),
    });
    expect(out).toHaveLength(0);
  });

  it("excludes a row with a blank order qty (even when stock is entered)", () => {
    const out = buildPayloadLines({
      P1: row({ captain_final_qty_purchase: "", current_stock_qty_base: 3 }),
    });
    expect(out).toHaveLength(0);
  });

  it("keeps an entered stock value when order qty > 0", () => {
    const out = buildPayloadLines({
      P1: row({ captain_final_qty_purchase: 2, current_stock_qty_base: 4 }),
    });
    expect(out).toHaveLength(1);
    expect(out[0].current_stock_qty_base).toBe(4);
    expect(out[0].captain_final_qty_purchase).toBe(2);
  });

  it("includes only order-qty>0 rows from a mixed set", () => {
    const out = buildPayloadLines({
      A: row({ product_id: "A", supplier_product_id: "SPA", captain_final_qty_purchase: 1 }),
      B: row({ product_id: "B", supplier_product_id: "SPB", captain_final_qty_purchase: 0 }),
      C: row({ product_id: "C", supplier_product_id: "SPC", captain_final_qty_purchase: "" }),
      D: row({ product_id: "D", supplier_product_id: "SPD", captain_final_qty_purchase: 3, current_stock_qty_base: 1 }),
    });
    expect(out.map((l) => l.product_id).sort()).toEqual(["A", "D"]);
  });

  it("maps reason_code/comment, normalizing empties to null/undefined", () => {
    const out = buildPayloadLines({
      P1: row({
        captain_final_qty_purchase: 9,
        reason_code: "EVENT_HIGH_TRAFFIC",
        captain_comment: "event",
      }),
      P2: row({ product_id: "P2", captain_final_qty_purchase: 1, reason_code: "", captain_comment: "" }),
    });
    const byId = Object.fromEntries(out.map((l) => [l.product_id, l]));
    expect(byId.P1.reason_code).toBe("EVENT_HIGH_TRAFFIC");
    expect(byId.P1.captain_comment).toBe("event");
    expect(byId.P2.reason_code).toBeNull();
    expect(byId.P2.captain_comment).toBeUndefined();
  });
});
