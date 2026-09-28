import { describe, expect, it } from "vitest";
import { compareProductOrder, type ProductOrderKey } from "./productOrder";

// Same fixture as supply-os-v1/tests/test_product_order.py — keep both in sync.
const FIXTURE: ProductOrderKey[] = [
  { display_order: null, supplier_product_id: "SP_BUKAT_P002" },
  { display_order: 30, supplier_product_id: "SP_BUKAT_P004" },
  { display_order: null, supplier_product_id: "SP_BUKAT_P135" },
  { display_order: 10, supplier_product_id: "SP_BUKAT_P006" },
  { display_order: 30, supplier_product_id: "SP_BUKAT_P003" }, // equal position -> tie by id
  { display_order: 20, supplier_product_id: "SP_BUKAT_P016" },
  { display_order: undefined, supplier_product_id: "SP_BUKAT_P001" },
];
const EXPECTED = [
  "SP_BUKAT_P006",
  "SP_BUKAT_P016",
  "SP_BUKAT_P003",
  "SP_BUKAT_P004",
  "SP_BUKAT_P001",
  "SP_BUKAT_P002",
  "SP_BUKAT_P135",
];

describe("compareProductOrder", () => {
  it("puts positions first, ties and unpositioned rows by supplier_product_id", () => {
    const ordered = [...FIXTURE].sort(compareProductOrder);
    expect(ordered.map((r) => r.supplier_product_id)).toEqual(EXPECTED);
  });

  it("treats 0 and negative positions as real positions", () => {
    const rows: ProductOrderKey[] = [
      { display_order: null, supplier_product_id: "A" },
      { display_order: 0, supplier_product_id: "C" },
      { display_order: -5, supplier_product_id: "B" },
    ];
    expect([...rows].sort(compareProductOrder).map((r) => r.supplier_product_id)).toEqual([
      "B",
      "C",
      "A",
    ]);
  });

  it("compares ids by code point, like Python (not locale collation)", () => {
    // ICU would put "SP_A" (underscore) and "SPA" differently than code points.
    const rows: ProductOrderKey[] = [
      { supplier_product_id: "SP_a" },
      { supplier_product_id: "SPA" },
      { supplier_product_id: "SP_B" },
    ];
    // Code points: "A" (65) < "_" (95) < "a" (97) -> "SPA", "SP_B", "SP_a".
    expect([...rows].sort(compareProductOrder).map((r) => r.supplier_product_id)).toEqual([
      "SPA",
      "SP_B",
      "SP_a",
    ]);
    expect(["SP_a", "SPA", "SP_B"].sort()).toEqual(["SPA", "SP_B", "SP_a"]);
  });
});
