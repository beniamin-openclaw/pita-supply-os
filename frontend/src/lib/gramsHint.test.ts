import { describe, it, expect } from "vitest";

import {
  formatPiecesAsKg,
  isPieceUnit,
  parseGramsPerPiece,
  pieceGramsFromNames,
  suggestPiecesFromGrams,
} from "./gramsHint";

describe("parseGramsPerPiece", () => {
  it.each([
    ["Prymat Pieprz czarny mielony 820g", 820],
    ["Prymat Oregano 110 g", 110],
    ["Prymat Papryka słodka mielona 720g", 720],
    ["Prymat Ziele angielskie 600g", 600],
    ["Papryka grillowana Helcom 4,2kg/2,5kg", 4200],
    ["Papryka grillowana Helcom 2,5 kg", 2500],
    ["Przyprawa 200gr", 200],
    ["Cukier 0,5kg", 500],
    ["Mąka 1.5 kg", 1500],
  ])("%s -> %s", (name, grams) => {
    expect(parseGramsPerPiece(name)).toBe(grams);
  });

  it.each(["Pita biała", "Cola 0,33l", "Gram flour", "", null, undefined])(
    "no weight: %s",
    (name) => {
      expect(parseGramsPerPiece(name as string | null | undefined)).toBeNull();
    },
  );
});

describe("suggestPiecesFromGrams", () => {
  it.each([
    [400, 820, 0.5],
    [820, 820, 1],
    [1640, 820, 2],
    [110, 110, 1],
    [1200, 820, 1.5],
    [100, 4200, 0.5],
  ])("%s g of %s g -> %s szt", (value, grams, expected) => {
    expect(suggestPiecesFromGrams(value, grams, "szt")).toBe(expected);
  });

  it.each([1, 2, 5, 12, 24, 30, 49])("normal count %s never triggers", (v) => {
    expect(suggestPiecesFromGrams(v, 820, "szt")).toBeNull();
    expect(suggestPiecesFromGrams(v, 110, "szt")).toBeNull();
  });

  it("not for non-piece units", () => {
    expect(suggestPiecesFromGrams(400, 820, "kg")).toBeNull();
    expect(suggestPiecesFromGrams(400, 820, "box")).toBeNull();
  });

  it("not when far beyond 20 pieces' worth", () => {
    expect(suggestPiecesFromGrams(5000, 110, "szt")).toBeNull();
  });

  it("piece-unit variants", () => {
    expect(suggestPiecesFromGrams(400, 820, "opak")).toBe(0.5);
    expect(suggestPiecesFromGrams(400, 820, "słoik")).toBe(0.5);
  });
});

describe("suggestPiecesFromGrams with the location max", () => {
  it("does not prompt for a plausible count within 3 x max (frytki 2,5kg, max 30)", () => {
    expect(suggestPiecesFromGrams(60, 2500, "szt", 30)).toBeNull();
  });
  it("still prompts when the value is far above max (pieprz 820g, max 2)", () => {
    expect(suggestPiecesFromGrams(400, 820, "szt", 2)).toBe(0.5);
  });
  it("ignores a missing or zero max", () => {
    expect(suggestPiecesFromGrams(400, 820, "szt", 0)).toBe(0.5);
    expect(suggestPiecesFromGrams(400, 820, "szt", null)).toBe(0.5);
  });
});

describe("isPieceUnit", () => {
  it.each(["szt", "słoik", "opak", " SZT ", "Opak"])("piece unit: %s", (u) => {
    expect(isPieceUnit(u)).toBe(true);
  });
  it.each(["kg", "l", "box", "", null, undefined])("not a piece unit: %s", (u) => {
    expect(isPieceUnit(u as string | null | undefined)).toBe(false);
  });
});

describe("pieceGramsFromNames", () => {
  it.each([
    ["Halloumi Reha 200gr", 200],
    ["Ketchup Fanex VII 1,1 kg", 1100],
    ["Frytki Aviko 9,5mm 2,5kg", 2500],
    ["Masło MR 500g", 500],
  ])("%s -> %s", (name, grams) => {
    expect(pieceGramsFromNames([name])).toBe(grams);
  });

  it.each([
    "AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30",
    "Papryka grillowana Helcom 4,2kg/2,5kg",
    "Cieciorka w zalewie 400g/240g",
    "Ser feta 12x200g",
    "Frytki 4 x 2,5kg",
    "Kawa 200g x 6",
    "Kawa 200 g. x 6",
    "Ser 12*200g",
    "Ser 12 szt. x 200g",
    "Miód 25g (30 szt)",
    "30 szt. po 25g",
    "Ser 1/2 kg",
  ])("multipack spelling -> null: %s", (name) => {
    expect(pieceGramsFromNames([name])).toBeNull();
  });

  it("a name without a weight falls through to the next name", () => {
    expect(pieceGramsFromNames(["Halloumi", "Halloumi Reha 200gr"])).toBe(200);
    expect(pieceGramsFromNames([null, undefined, "Masło 500g"])).toBe(500);
  });

  it("the first name with a weight decides, even when it is a multipack", () => {
    expect(pieceGramsFromNames(["Halloumi 200g/12", "Halloumi 200g"])).toBeNull();
  });

  it("no weight anywhere -> null", () => {
    expect(pieceGramsFromNames(["Pita biała", "Cola 0,33l"])).toBeNull();
    expect(pieceGramsFromNames([])).toBeNull();
  });
});

describe("formatPiecesAsKg", () => {
  it("12 pieces of 200 g -> 2,4 (pl) / 2.4 (en)", () => {
    expect(formatPiecesAsKg(12, 200, "szt", "pl")).toBe("2,4");
    expect(formatPiecesAsKg(12, 200, "szt", "en")).toBe("2.4");
  });

  it("fractions and larger counts", () => {
    expect(formatPiecesAsKg(0.5, 820, "szt", "pl")).toBe("0,41");
    expect(formatPiecesAsKg(3, 110, "opak", "pl")).toBe("0,33");
    expect(formatPiecesAsKg(48, 200, "szt", "pl")).toBe("9,6");
    expect(formatPiecesAsKg(1, 125, "opak", "pl")).toBe("0,125");
  });

  it.each([0, -1, Number.NaN, "", null, undefined])("no reading for count %s", (qty) => {
    expect(formatPiecesAsKg(qty as number | "" | null | undefined, 200, "szt", "pl")).toBeNull();
  });

  it("no reading without a weight or for a non-piece unit", () => {
    expect(formatPiecesAsKg(12, null, "szt", "pl")).toBeNull();
    expect(formatPiecesAsKg(12, 0, "szt", "pl")).toBeNull();
    expect(formatPiecesAsKg(12, 15000, "kg", "pl")).toBeNull();
    expect(formatPiecesAsKg(12, 200, "box", "pl")).toBeNull();
  });
});
