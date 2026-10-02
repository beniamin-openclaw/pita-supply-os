import { describe, it, expect } from "vitest";

import { parseGramsPerPiece, suggestPiecesFromGrams } from "./gramsHint";

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
