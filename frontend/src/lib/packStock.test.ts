import { describe, it, expect } from "vitest";

import {
  splitPackStock,
  combinePackStock,
  formatPackStock,
  formatBaseQty,
  suggestPackCount,
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
