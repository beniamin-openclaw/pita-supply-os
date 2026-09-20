import { describe, it, expect } from "vitest";

import {
  DEFAULT_PRODUCT_LIST_VIEW,
  applyProductListView,
  attentionReason,
  filterProductRows,
  groupProductRows,
  sortProductRows,
  stockDelta,
  type ProductListRow,
  type ProductListView,
} from "./productListFilter";

function row(overrides: Partial<ProductListRow> & { product_id: string }): ProductListRow {
  return {
    product_name_pl: overrides.product_id,
    product_category: "Spożywcze",
    is_critical: false,
    supplier_id: "SUP_BUKAT",
    supplier_name: "Bukat",
    min_stock_qty_base: 2,
    target_stock_qty_base: 10,
    max_stock_qty_base: 12,
    current_stock_qty_base: 5,
    ...overrides,
  };
}

function view(overrides: Partial<ProductListView> = {}): ProductListView {
  return { ...DEFAULT_PRODUCT_LIST_VIEW, ...overrides };
}

const POMIDOR = row({ product_id: "P1", product_name_pl: "Pomidor", product_category: "Warzywa" });
const LOSOS = row({ product_id: "P2", product_name_pl: "Łosoś", product_category: "Chłodnia" });
const LIMONKA = row({ product_id: "P3", product_name_pl: "Limonka", product_category: "Warzywa" });
const LODY = row({ product_id: "P4", product_name_pl: "Lody", product_category: "Mrożonki" });

describe("attentionReason", () => {
  it("flags stock below min", () => {
    expect(attentionReason(row({ product_id: "x", current_stock_qty_base: 1 }))).toBe("belowMin");
  });

  it("flags stock above 3 x max only when max > 0", () => {
    expect(attentionReason(row({ product_id: "x", current_stock_qty_base: 37 }))).toBe("overMax");
    expect(attentionReason(row({ product_id: "x", current_stock_qty_base: 36 }))).toBeNull();
    expect(
      attentionReason(row({ product_id: "x", current_stock_qty_base: 999, max_stock_qty_base: 0 })),
    ).toBeNull();
  });

  it("flags zero stock with a positive target, before the below-min rule", () => {
    expect(attentionReason(row({ product_id: "x", current_stock_qty_base: 0 }))).toBe(
      "zeroWithTarget",
    );
    expect(
      attentionReason(
        row({ product_id: "x", current_stock_qty_base: 0, target_stock_qty_base: 0, min_stock_qty_base: 0 }),
      ),
    ).toBeNull();
  });

  it("never flags an uncounted row or a row without thresholds", () => {
    expect(attentionReason(row({ product_id: "x", current_stock_qty_base: null }))).toBeNull();
    expect(
      attentionReason(
        row({
          product_id: "x",
          current_stock_qty_base: 5,
          min_stock_qty_base: null,
          max_stock_qty_base: null,
          target_stock_qty_base: null,
        }),
      ),
    ).toBeNull();
  });
});

describe("stockDelta", () => {
  it("is stock minus target, null when either is unknown", () => {
    expect(stockDelta(row({ product_id: "x", current_stock_qty_base: 4 }))).toBe(-6);
    expect(stockDelta(row({ product_id: "x", current_stock_qty_base: null }))).toBeNull();
    expect(
      stockDelta(row({ product_id: "x", current_stock_qty_base: 4, target_stock_qty_base: null })),
    ).toBeNull();
  });
});

describe("filterProductRows", () => {
  const rows = [POMIDOR, LOSOS, LIMONKA, LODY];

  it("keeps the input order and returns everything for the default view", () => {
    expect(filterProductRows(rows, view()).map((r) => r.product_id)).toEqual(["P1", "P2", "P3", "P4"]);
  });

  it("searches case- and diacritic-insensitively on name", () => {
    expect(filterProductRows(rows, view({ query: "LOS" })).map((r) => r.product_id)).toEqual(["P2"]);
    expect(filterProductRows(rows, view({ query: "łoso" })).map((r) => r.product_id)).toEqual(["P2"]);
    expect(filterProductRows(rows, view({ query: "  lim " })).map((r) => r.product_id)).toEqual(["P3"]);
  });

  it("also matches product_id and supplier name", () => {
    expect(filterProductRows(rows, view({ query: "p4" })).map((r) => r.product_id)).toEqual(["P4"]);
    expect(filterProductRows(rows, view({ query: "bukat" }))).toHaveLength(4);
  });

  it("onlyCritical keeps critical rows only", () => {
    const withCritical = [POMIDOR, row({ product_id: "C", is_critical: true })];
    expect(filterProductRows(withCritical, view({ onlyCritical: true })).map((r) => r.product_id)).toEqual([
      "C",
    ]);
  });

  it("onlyUncounted keeps rows with null/undefined stock (a typed 0 is counted)", () => {
    const mixed = [
      row({ product_id: "U1", current_stock_qty_base: null }),
      row({ product_id: "Z", current_stock_qty_base: 0 }),
      row({ product_id: "U2", current_stock_qty_base: undefined }),
      POMIDOR,
    ];
    expect(filterProductRows(mixed, view({ onlyUncounted: true })).map((r) => r.product_id)).toEqual([
      "U1",
      "U2",
    ]);
  });

  it("onlyAttention keeps rows matching any attention rule", () => {
    const mixed = [
      POMIDOR,
      row({ product_id: "LOW", current_stock_qty_base: 1 }),
      row({ product_id: "HIGH", current_stock_qty_base: 100 }),
      row({ product_id: "ZERO", current_stock_qty_base: 0 }),
      row({ product_id: "NONE", current_stock_qty_base: null }),
    ];
    expect(filterProductRows(mixed, view({ onlyAttention: true })).map((r) => r.product_id)).toEqual([
      "LOW",
      "HIGH",
      "ZERO",
    ]);
  });

  it("combines query and toggles with AND", () => {
    const mixed = [
      row({ product_id: "A", product_name_pl: "Feta", is_critical: true, current_stock_qty_base: 0 }),
      row({ product_id: "B", product_name_pl: "Feta light", is_critical: false, current_stock_qty_base: 0 }),
      row({ product_id: "C", product_name_pl: "Halloumi", is_critical: true, current_stock_qty_base: 0 }),
    ];
    expect(
      filterProductRows(mixed, view({ query: "feta", onlyCritical: true, onlyAttention: true })).map(
        (r) => r.product_id,
      ),
    ).toEqual(["A"]);
  });
});

describe("sortProductRows", () => {
  it("name: Polish collation puts Ł after L (Limonka, Lody, Łosoś, Pomidor)", () => {
    expect(sortProductRows([POMIDOR, LOSOS, LIMONKA, LODY], "name").map((r) => r.product_name_pl)).toEqual([
      "Limonka",
      "Lody",
      "Łosoś",
      "Pomidor",
    ]);
  });

  it("stock: ascending, uncounted rows last, ties by name", () => {
    const rows = [
      row({ product_id: "A", product_name_pl: "A", current_stock_qty_base: 5 }),
      row({ product_id: "N", product_name_pl: "N", current_stock_qty_base: null }),
      row({ product_id: "B", product_name_pl: "B", current_stock_qty_base: 1 }),
      row({ product_id: "C", product_name_pl: "C", current_stock_qty_base: 5 }),
    ];
    expect(sortProductRows(rows, "stock").map((r) => r.product_id)).toEqual(["B", "A", "C", "N"]);
  });

  it("delta: largest deficit first, rows without a delta last", () => {
    const rows = [
      row({ product_id: "OK", current_stock_qty_base: 10 }),
      row({ product_id: "LOW", current_stock_qty_base: 2 }),
      row({ product_id: "OVER", current_stock_qty_base: 14 }),
      row({ product_id: "NA", current_stock_qty_base: 5, target_stock_qty_base: null }),
    ];
    expect(sortProductRows(rows, "delta").map((r) => r.product_id)).toEqual(["LOW", "OK", "OVER", "NA"]);
  });

  it("category: by category (pl collation), then name", () => {
    expect(sortProductRows([POMIDOR, LOSOS, LIMONKA, LODY], "category").map((r) => r.product_id)).toEqual([
      "P2", // Chłodnia
      "P4", // Mrożonki
      "P3", // Warzywa / Limonka
      "P1", // Warzywa / Pomidor
    ]);
  });

  it("does not mutate the input", () => {
    const rows = [POMIDOR, LIMONKA];
    sortProductRows(rows, "name");
    expect(rows.map((r) => r.product_id)).toEqual(["P1", "P3"]);
  });
});

describe("groupProductRows", () => {
  it("groups by raw category, groups alphabetical, uncategorized last", () => {
    const rows = [POMIDOR, LOSOS, LIMONKA, row({ product_id: "X", product_category: "" })];
    const groups = groupProductRows(rows, "category");
    expect(groups.map((g) => g.key)).toEqual(["Chłodnia", "Warzywa", ""]);
    expect(groups[1].items.map((r) => r.product_id)).toEqual(["P1", "P3"]);
    expect(groups[1].label).toBe("Warzywa");
  });

  it("groups by supplier_id with supplier_name as label, no-supplier bucket last", () => {
    const rows = [
      row({ product_id: "A", supplier_id: "SUP_PAGO", supplier_name: "Pago" }),
      row({ product_id: "B", supplier_id: null, supplier_name: null }),
      row({ product_id: "C", supplier_id: "SUP_BLUE", supplier_name: "Blue Service" }),
      row({ product_id: "D", supplier_id: "SUP_BLUE", supplier_name: "Blue Service" }),
    ];
    const groups = groupProductRows(rows, "supplier");
    expect(groups.map((g) => [g.key, g.label])).toEqual([
      ["SUP_BLUE", "Blue Service"],
      ["SUP_PAGO", "Pago"],
      ["", ""],
    ]);
    expect(groups[0].items.map((r) => r.product_id)).toEqual(["C", "D"]);
  });
});

describe("applyProductListView", () => {
  it("filters, sorts, then groups", () => {
    const rows = [POMIDOR, LOSOS, LIMONKA, LODY];
    const { rows: flat, groups } = applyProductListView(rows, view({ query: "l", sort: "name" }));
    expect(flat.map((r) => r.product_name_pl)).toEqual(["Limonka", "Lody", "Łosoś"]);
    expect(groups.map((g) => g.key)).toEqual(["Chłodnia", "Mrożonki", "Warzywa"]);
  });

  it("returns empty rows and groups when nothing matches", () => {
    expect(applyProductListView([POMIDOR], view({ query: "zzz" }))).toEqual({ rows: [], groups: [] });
  });
});
