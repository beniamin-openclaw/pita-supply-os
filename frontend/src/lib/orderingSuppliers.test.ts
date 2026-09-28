import { describe, it, expect } from "vitest";

import { INTERNAL_SUPPLIER_ID, isOrderingSupplier } from "./orderingSuppliers";

describe("isOrderingSupplier", () => {
  it("drops on-site production", () => {
    expect(isOrderingSupplier({ supplier_id: INTERNAL_SUPPLIER_ID, active: true })).toBe(false);
    expect(INTERNAL_SUPPLIER_ID).toBe("SUP_INTERNAL");
  });

  it("drops inactive suppliers", () => {
    expect(isOrderingSupplier({ supplier_id: "SUP_SELGROS", active: false })).toBe(false);
  });

  it("keeps active external suppliers", () => {
    expect(isOrderingSupplier({ supplier_id: "SUP_BUKAT", active: true })).toBe(true);
    expect(isOrderingSupplier({ supplier_id: "SUP_PAGO", active: true })).toBe(true);
  });

  it("filters a supplier list, keeping order", () => {
    const list = [
      { supplier_id: "SUP_BLUESERV", active: true },
      { supplier_id: "SUP_INTERNAL", active: true },
      { supplier_id: "SUP_BUKAT", active: true },
      { supplier_id: "SUP_OLD", active: false },
    ];
    expect(list.filter(isOrderingSupplier).map((s) => s.supplier_id)).toEqual([
      "SUP_BLUESERV",
      "SUP_BUKAT",
    ]);
  });
});
