import { describe, it, expect } from "vitest";
import { serializeExtraItems, parseExtraItems, blankExtraItemRow } from "./extraItems";
import type { ExtraItemRow } from "./extraItems";

describe("serializeExtraItems", () => {
  it("joins a full row as 'name - qty unit'", () => {
    const rows: ExtraItemRow[] = [{ name: "Serwetki", qty: "5", unit: "opak" }];
    expect(serializeExtraItems(rows)).toBe("Serwetki - 5 opak");
  });

  it("joins multiple rows one per line", () => {
    const rows: ExtraItemRow[] = [
      { name: "Serwetki", qty: "5", unit: "opak" },
      { name: "Lód", qty: "2", unit: "worki" },
    ];
    expect(serializeExtraItems(rows)).toBe("Serwetki - 5 opak\nLód - 2 worki");
  });

  it("returns '' for an empty row list", () => {
    expect(serializeExtraItems([])).toBe("");
  });

  it("drops a blank row (no name) entirely", () => {
    const rows: ExtraItemRow[] = [blankExtraItemRow()];
    expect(serializeExtraItems(rows)).toBe("");
  });

  it("drops a row with only qty/unit typed and no name", () => {
    const rows: ExtraItemRow[] = [{ name: "   ", qty: "5", unit: "opak" }];
    expect(serializeExtraItems(rows)).toBe("");
  });

  it("drops blank rows while keeping filled ones, preserving order", () => {
    const rows: ExtraItemRow[] = [
      { name: "Serwetki", qty: "5", unit: "opak" },
      blankExtraItemRow(),
      { name: "Lód", qty: "2", unit: "worki" },
    ];
    expect(serializeExtraItems(rows)).toBe("Serwetki - 5 opak\nLód - 2 worki");
  });

  it("handles a row missing qty (name + unit only)", () => {
    const rows: ExtraItemRow[] = [{ name: "Lód", qty: "", unit: "worki" }];
    expect(serializeExtraItems(rows)).toBe("Lód - worki");
  });

  it("handles a row missing unit (name + qty only)", () => {
    const rows: ExtraItemRow[] = [{ name: "Lód", qty: "2", unit: "" }];
    expect(serializeExtraItems(rows)).toBe("Lód - 2");
  });

  it("handles a name-only row (no qty, no unit) with no trailing separator", () => {
    const rows: ExtraItemRow[] = [{ name: "Coś dziwnego", qty: "", unit: "" }];
    expect(serializeExtraItems(rows)).toBe("Coś dziwnego");
  });

  it("trims surrounding whitespace on every field", () => {
    const rows: ExtraItemRow[] = [{ name: "  Serwetki  ", qty: " 5 ", unit: " opak " }];
    expect(serializeExtraItems(rows)).toBe("Serwetki - 5 opak");
  });
});

describe("parseExtraItems", () => {
  it("returns [] for an empty string", () => {
    expect(parseExtraItems("")).toEqual([]);
  });

  it("returns [] for a whitespace-only string", () => {
    expect(parseExtraItems("   \n  ")).toEqual([]);
  });

  it("parses a single full 'name - qty unit' line", () => {
    expect(parseExtraItems("Serwetki - 5 opak")).toEqual([
      { name: "Serwetki", qty: "5", unit: "opak" },
    ]);
  });

  it("parses multiple lines", () => {
    expect(parseExtraItems("Serwetki - 5 opak\nLód - 2 worki")).toEqual([
      { name: "Serwetki", qty: "5", unit: "opak" },
      { name: "Lód", qty: "2", unit: "worki" },
    ]);
  });

  it("parses a name-only line (no separator) as a name-only row", () => {
    expect(parseExtraItems("Coś dziwnego")).toEqual([
      { name: "Coś dziwnego", qty: "", unit: "" },
    ]);
  });

  it("parses a 'name - qty' line (no unit) predictably", () => {
    expect(parseExtraItems("Lód - 2")).toEqual([{ name: "Lód", qty: "2", unit: "" }]);
  });

  it("re-buckets a unit-only tail into qty (documented parse ambiguity, never crashes)", () => {
    // Serialised from a row with qty="" unit="worki" -> "Lód - worki". Parsing
    // back cannot tell a lone word was a unit rather than a quantity, so it
    // predictably lands in `qty`. This is the one documented non-round-trip
    // case; nothing is thrown away and the value is never lost, just moved.
    expect(parseExtraItems("Lód - worki")).toEqual([{ name: "Lód", qty: "worki", unit: "" }]);
  });
});

describe("serializeExtraItems / parseExtraItems — round-trip", () => {
  it("round-trips a full row", () => {
    const rows: ExtraItemRow[] = [{ name: "Serwetki", qty: "5", unit: "opak" }];
    expect(parseExtraItems(serializeExtraItems(rows))).toEqual(rows);
  });

  it("round-trips several full rows", () => {
    const rows: ExtraItemRow[] = [
      { name: "Serwetki", qty: "5", unit: "opak" },
      { name: "Lód", qty: "2", unit: "worki" },
      { name: "Cytryny", qty: "1", unit: "siatka" },
    ];
    expect(parseExtraItems(serializeExtraItems(rows))).toEqual(rows);
  });

  it("round-trips a name-only row", () => {
    const rows: ExtraItemRow[] = [{ name: "Coś dziwnego", qty: "", unit: "" }];
    expect(parseExtraItems(serializeExtraItems(rows))).toEqual(rows);
  });

  it("round-trips a row missing only its unit", () => {
    const rows: ExtraItemRow[] = [{ name: "Lód", qty: "2", unit: "" }];
    expect(parseExtraItems(serializeExtraItems(rows))).toEqual(rows);
  });

  it("blank rows vanish on the round-trip (never re-appear as empty entries)", () => {
    const rows: ExtraItemRow[] = [
      { name: "Serwetki", qty: "5", unit: "opak" },
      blankExtraItemRow(),
    ];
    expect(parseExtraItems(serializeExtraItems(rows))).toEqual([
      { name: "Serwetki", qty: "5", unit: "opak" },
    ]);
  });

  it("empty list round-trips to empty list", () => {
    expect(parseExtraItems(serializeExtraItems([]))).toEqual([]);
  });
});
