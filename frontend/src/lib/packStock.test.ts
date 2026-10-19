import { describe, it, expect } from "vitest";

import {
  splitPackStock,
  combinePackStock,
  formatPackStock,
  formatBaseQty,
  suggestPackCount,
  formatCaseQty,
  detectDoubleEntry,
} from "./packStock";

describe("splitPackStock", () => {
  it.each([
    [20, 15, 1, 5],
    [8.4, 4.2, 2, 0],
    [12.6, 4.2, 3, 0],
    [52.5, 12, 4, 4.5],
    [47.368, 5, 9, 2.368],
    [7.5, 15, 0, 7.5],
    [0, 15, 0, 0],
    [14.9996, 15, 1, 0],
  ])("(%s, %s) -> %s / %s", (base, upp, packs, loose) => {
    expect(splitPackStock(base, upp)).toEqual({ packs, loose });
  });
});

describe("combinePackStock", () => {
  it("both blank -> blank", () => expect(combinePackStock("", "", 15)).toBe(""));
  it("1 + 5 x 15 -> 20", () => expect(combinePackStock(1, 5, 15)).toBe(20));
  it("blank + 20 -> 20", () => expect(combinePackStock("", 20, 15)).toBe(20));
  it("3 + 0 x 4.2 -> 12.6", () => expect(combinePackStock(3, 0, 4.2)).toBe(12.6));
  it("0.5 + blank x 15 -> 7.5", () => expect(combinePackStock(0.5, "", 15)).toBe(7.5));
  it("blank + 0 -> 0", () => expect(combinePackStock("", 0, 15)).toBe(0));
});

describe("formatBaseQty", () => {
  it("comma in PL", () => expect(formatBaseQty(4.5, "pl")).toBe("4,5"));
});

describe("formatPackStock", () => {
  it("1 blok + 5 kg", () => expect(formatPackStock(20, 15, "blok", "kg", "pl")).toBe("1 blok + 5 kg"));
  it("2 bloki", () => expect(formatPackStock(30, 15, "blok", "kg", "pl")).toBe("2 bloki"));
  it("5 bloków", () => expect(formatPackStock(75, 15, "blok", "kg", "pl")).toBe("5 bloków"));
  it("6 kg", () => expect(formatPackStock(6, 15, "blok", "kg", "pl")).toBe("6 kg"));
  it("4 kartony + 4,5 opak", () =>
    expect(formatPackStock(52.5, 12, "karton", "opak", "pl")).toBe("4 kartony + 4,5 opak"));
  it("1 karton + 0,2 kg", () =>
    expect(formatPackStock(4.4, 4.2, "karton", "kg", "pl")).toBe("1 karton + 0,2 kg"));
  it("EN 1 block + 5 kg", () => expect(formatPackStock(20, 15, "blok", "kg", "en")).toBe("1 block + 5 kg"));
});

describe("suggestPackCount", () => {
  const s = (
    loose: number | "",
    upp: number,
    references: Array<number | null | undefined>,
    packs: number | "" = "",
  ): number | null => suggestPackCount({ packs, loose, upp, references });

  it("fires for 6 / 15 / [90]", () => expect(s(6, 15, [90])).toBe(6));
  it("fires for 6 / 15 / [null, 150]", () => expect(s(6, 15, [null, 150])).toBe(6));
  it("fires for 6 / 15 / [30] (inclusive)", () => expect(s(6, 15, [30])).toBe(6));
  it("fires for 4.5 / 12 / [52.5]", () => expect(s(4.5, 12, [52.5])).toBe(4.5));
  it("fires for 5 / 24 / [72] (szt)", () => expect(s(5, 24, [72])).toBe(5));
  it("fires with packs 0", () => expect(s(6, 15, [90], 0)).toBe(6));

  it("silent for refs [8, 6]", () => expect(s(6, 15, [8, 6])).toBeNull());
  it("silent for refs [29.9]", () => expect(s(6, 15, [29.9])).toBeNull());
  it("silent for refs []", () => expect(s(6, 15, [])).toBeNull());
  it("silent for loose 6.3", () => expect(s(6.3, 15, [90])).toBeNull());
  it("silent for loose 15", () => expect(s(15, 15, [90])).toBeNull());
  it("silent for loose 0", () => expect(s(0, 15, [90])).toBeNull());
  it("silent for packs 1", () => expect(s(6, 15, [90], 1)).toBeNull());
  it("silent for upp 1", () => expect(s(0.5, 1, [90])).toBeNull());
});

describe("formatCaseQty (D35, twin of gmail_url._format_case_qty)", () => {
  it.each([
    [24, 4, "karton", "paczka", "6 kartonów (24 paczki)"],
    [26, 4, "karton", "paczka", "6 kartonów + 2 paczki (26 paczek)"],
    [2, 4, "karton", "paczka", "2 paczki"],
    [4, 4, "karton", "paczka", "1 karton (4 paczki)"],
    [30, 6, "skrzynka", "kg", "5 skrzynek (30 kg)"],
    [14.5, 6, "skrzynka", "kg", "2 skrzynki + 2,5 kg (14,5 kg)"],
    [2.5, 6, "skrzynka", "kg", "2,5 kg"],
    [36, 12, "karton", "szt", "3 kartony (36 szt)"],
    [7, 6, "opak", "szt", "1 opak + 1 szt (7 szt)"],
  ])("%s with a case of %s %s -> %s", (qty, upc, caseUnit, unit, expected) => {
    expect(formatCaseQty(qty, upc, caseUnit, unit)).toBe(expected);
  });

  it("splits a float artefact like 18.000000000000004 as whole cases", () => {
    expect(formatCaseQty(0.1 * 3 * 60, 6, "skrzynka", "kg")).toBe("3 skrzynki (18 kg)");
  });
});

describe("detectDoubleEntry (N1, Browary/Intermlecz 02.10)", () => {
  const order = (packs: number | "", loose: number | "", upp: number): ReturnType<
    typeof detectDoubleEntry
  > => detectDoubleEntry({ packs, loose, upp, mode: "order" });

  it.each([
    // The 02.10 order lines: the same quantity typed into both fields.
    [2, 24, 12, 24], // halloumi order: 2 kartony + 24 szt -> meant 24
    [5, 20, 4, 20], // frytki order: 5 kartonów + 20 paczek -> meant 20
    [6, 36, 6, 36], // pomidor order: 6 skrzynek + 36 kg -> meant 36
    [1, 12, 12, 12], // one carton: the most common case
    [1, 4.2, 4.2, 4.2], // fractional pack size
    [3, 12.6, 4.2, 12.6], // 3 × 4.2 = 12.600000000000001
    [3, 18, 0.1 * 60, 18], // upp itself off by a float bit
  ])("order: packs %s + loose %s (upp %s) is a duplicate of %s", (packs, loose, upp, fixed) => {
    expect(order(packs, loose, upp)).toEqual({ kind: "duplicate", fixed });
  });

  it("order: loose of a whole pack or more next to packs is looseOverPack", () => {
    expect(order(2, 30, 12)).toEqual({ kind: "looseOverPack" }); // tile 2 + own total 30
    expect(order(2, 12, 12)).toEqual({ kind: "looseOverPack" }); // loose == upp, packs >= 2
    expect(order(1, 12, 6)).toEqual({ kind: "looseOverPack" });
  });

  it.each([
    [2, 4, 12], // a real remainder
    ["", 24, 12], // loose only: 24 szt is fine
    [0, 24, 12],
    [2, "", 12],
    [2, 0, 12],
    [-1, 12, 12],
    [2, 2, 1], // ×1 unit: no pack at all
  ] as Array<[number | "", number | "", number]>)(
    "order: packs %s + loose %s (upp %s) is fine",
    (packs, loose, upp) => {
      expect(order(packs, loose, upp)).toBeNull();
    },
  );

  it("stock: a duplicate only counts when the sum is above every reference", () => {
    // 02.10 halloumi stock: 4 kartony + 48 szt = 96 against a target of 72.
    expect(
      detectDoubleEntry({ packs: 4, loose: 48, upp: 12, mode: "stock", references: [72] }),
    ).toEqual({ kind: "duplicate", fixed: 48 });
    // 2 zgrzewki + 12 szt = 24 under a target of 48: a plausible real count.
    expect(
      detectDoubleEntry({ packs: 2, loose: 12, upp: 6, mode: "stock", references: [30, 48] }),
    ).toBeNull();
    // No references: never guess on a count.
    expect(detectDoubleEntry({ packs: 4, loose: 48, upp: 12, mode: "stock" })).toBeNull();
  });

  it("stock: loose of a pack or more is a normal count, never flagged", () => {
    expect(
      detectDoubleEntry({ packs: 2, loose: 30, upp: 12, mode: "stock", references: [10] }),
    ).toBeNull();
  });
});
