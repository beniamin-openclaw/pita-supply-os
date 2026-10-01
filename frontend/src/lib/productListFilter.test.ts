import { describe, it, expect } from "vitest";

import {
  DEFAULT_PRODUCT_LIST_VIEW,
  applyProductListView,
  attentionReason,
  defaultInventoryListView,
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

  it("card: card position ascending, unpositioned last, ties keep input order", () => {
    const rows = [
      row({ product_id: "N1", inventory_order: null }),
      row({ product_id: "C30", inventory_order: 30 }),
      row({ product_id: "T20b", inventory_order: 20 }),
      row({ product_id: "C10", inventory_order: 10 }),
      row({ product_id: "T20a", inventory_order: 20 }),
      row({ product_id: "N0" }),
    ];
    // Equal positions and the unpositioned rows keep their input order
    // (stable sort): the backend already tie-broke them by product_id.
    expect(sortProductRows(rows, "card").map((r) => r.product_id)).toEqual([
      "C10",
      "T20b",
      "T20a",
      "C30",
      "N1",
      "N0",
    ]);
  });

  it("card: identity on rows already in card order", () => {
    const rows = [
      row({ product_id: "P9", inventory_order: 10 }),
      row({ product_id: "P1", inventory_order: 20 }),
      row({ product_id: "P5", inventory_order: 20 }),
      row({ product_id: "P2", inventory_order: null }),
    ];
    expect(sortProductRows(rows, "card")).toEqual(rows);
  });

  it("supplier: supplier name, then the supplier's product order, no supplier last", () => {
    const rows = [
      row({ product_id: "NS", supplier_id: null, supplier_name: null }),
      row({ product_id: "P_POS30", supplier_name: "Pago", display_order: 30, supplier_product_id: "SP_PAGO_P9" }),
      row({ product_id: "B_NOPOS", supplier_name: "Bukat", display_order: null, supplier_product_id: "SP_BUKAT_P1" }),
      row({ product_id: "P_POS10", supplier_name: "Pago", display_order: 10, supplier_product_id: "SP_PAGO_P5" }),
      row({ product_id: "B_POS", supplier_name: "Bukat", display_order: 50, supplier_product_id: "SP_BUKAT_P7" }),
      row({ product_id: "P_NOPOS", supplier_name: "Pago", display_order: null, supplier_product_id: "SP_PAGO_P1" }),
    ];
    expect(sortProductRows(rows, "supplier").map((r) => r.product_id)).toEqual([
      "B_POS",
      "B_NOPOS",
      "P_POS10",
      "P_POS30",
      "P_NOPOS",
      "NS",
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

describe("groupProductRows with a sort", () => {
  const CARD_ROWS = [
    row({ product_id: "A", product_category: "Mrożonki", supplier_id: "SUP_PAGO", supplier_name: "Pago", inventory_order: 10 }),
    row({ product_id: "B", product_category: "Chłodnia", supplier_id: "SUP_BUKAT", supplier_name: "Bukat", inventory_order: 20 }),
    row({ product_id: "X", product_category: "", supplier_id: null, supplier_name: null, inventory_order: 5 }),
    row({ product_id: "C", product_category: "Chemia", supplier_id: "SUP_BLUE", supplier_name: "Blue Service", inventory_order: 30 }),
  ];

  it("category + card: groups in first-seen (card section) order, label-less last", () => {
    expect(groupProductRows(CARD_ROWS, "category", "card").map((g) => g.key)).toEqual([
      "Mrożonki",
      "Chłodnia",
      "Chemia",
      "",
    ]);
  });

  it("supplier + card: supplier groups stay alphabetical, no-supplier last", () => {
    expect(groupProductRows(CARD_ROWS, "supplier", "card").map((g) => g.label)).toEqual([
      "Blue Service",
      "Bukat",
      "Pago",
      "",
    ]);
  });

  it("category + supplier: category groups stay alphabetical", () => {
    expect(groupProductRows(CARD_ROWS, "category", "supplier").map((g) => g.key)).toEqual([
      "Chemia",
      "Chłodnia",
      "Mrożonki",
      "",
    ]);
  });
});

describe("defaultInventoryListView", () => {
  it("opens in card order when any row carries a card position", () => {
    const v = defaultInventoryListView([row({ product_id: "A" }), row({ product_id: "B", inventory_order: 10 })]);
    expect(v).toEqual({ ...DEFAULT_PRODUCT_LIST_VIEW, sort: "card" });
  });

  it("keeps the name sort when nothing is positioned", () => {
    expect(defaultInventoryListView([row({ product_id: "A", inventory_order: null }), row({ product_id: "B" })])).toEqual(
      DEFAULT_PRODUCT_LIST_VIEW,
    );
    expect(defaultInventoryListView([])).toEqual(DEFAULT_PRODUCT_LIST_VIEW);
  });

  it("does not change the shared default the Captain grid uses", () => {
    expect(DEFAULT_PRODUCT_LIST_VIEW.sort).toBe("name");
  });
});

describe("applyProductListView", () => {
  it("card view: flat rows in card order and category groups in card section order", () => {
    const rows = [
      row({ product_id: "W1", product_category: "Warzywa", inventory_order: 30 }),
      row({ product_id: "M1", product_category: "Mrożonki", inventory_order: 10 }),
      row({ product_id: "M2", product_category: "Mrożonki", inventory_order: 20 }),
    ];
    const { rows: flat, groups } = applyProductListView(rows, view({ sort: "card" }));
    expect(flat.map((r) => r.product_id)).toEqual(["M1", "M2", "W1"]);
    expect(groups.map((g) => g.key)).toEqual(["Mrożonki", "Warzywa"]);
  });

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
