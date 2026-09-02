import { describe, it, expect } from "vitest";
import { categoryLabel } from "./categoryLabels";

describe("categoryLabel", () => {
  it("returns the English label for a known category", () => {
    expect(categoryLabel("Chłodnia", "en")).toBe("Refrigerated");
  });

  it("returns every one of the 10 live categories in English", () => {
    expect(categoryLabel("Biurowe", "en")).toBe("Office supplies");
    expect(categoryLabel("Chemia", "en")).toBe("Chemicals");
    expect(categoryLabel("Gaz", "en")).toBe("Gas");
    expect(categoryLabel("Mrożonki", "en")).toBe("Frozen");
    expect(categoryLabel("Napoje", "en")).toBe("Beverages");
    expect(categoryLabel("Opakowania", "en")).toBe("Packaging");
    expect(categoryLabel("Produkcja", "en")).toBe("Production");
    expect(categoryLabel("Spożywcze", "en")).toBe("Groceries");
    expect(categoryLabel("Wino", "en")).toBe("Wine");
  });

  it("returns the raw Polish value unchanged for lang=pl", () => {
    expect(categoryLabel("Chłodnia", "pl")).toBe("Chłodnia");
    expect(categoryLabel("Wino", "pl")).toBe("Wino");
  });

  it("falls back to the raw value for an unknown category in English", () => {
    expect(categoryLabel("Nowa Kategoria", "en")).toBe("Nowa Kategoria");
  });

  it("falls back to the raw value for an empty category", () => {
    expect(categoryLabel("", "en")).toBe("");
    expect(categoryLabel("", "pl")).toBe("");
  });
});
