import { describe, expect, it } from "vitest";
import { addWasteQuantity, parseWasteQuantity } from "./wasteQuantity";

describe("waste quantities", () => {
  it("adds repeated and mixed tiles exactly, including decimal commas", () => {
    expect(addWasteQuantity(addWasteQuantity("", "100", "g")!, "100", "g")).toBe("200");
    expect(addWasteQuantity("200", "50", "g")).toBe("250");
    expect(addWasteQuantity("0,1", "0.2", "szt")).toBe("0.3");
  });
  it("rejects invalid visible text and excess precision rather than reusing a previous value", () => {
    for (const value of ["1x", "1e2", "0x10", "1,2.3", "-1", "1.0001", "9".repeat(1000)]) {
      expect(parseWasteQuantity(value, "szt")).toBeNull();
      expect(addWasteQuantity(value, "1", "szt")).toBeNull();
    }
    expect(parseWasteQuantity("1.1", "g")).toBeNull();
    expect(parseWasteQuantity("", "g")).toBeNull();
    expect(parseWasteQuantity("0", "g")).toBe(0);
  });
  it("rejects values and additions beyond canonical maximum", () => {
    expect(parseWasteQuantity("999999.999", "kg")).toBe(999999999);
    expect(parseWasteQuantity("999999999", "g")).toBe(999999999);
    expect(parseWasteQuantity("1000000", "kg")).toBeNull();
    expect(parseWasteQuantity("1000000000", "g")).toBeNull();
    expect(addWasteQuantity("999999999", "1", "g")).toBeNull();
    expect(addWasteQuantity("999999.999", "0.001", "szt")).toBeNull();
  });
});
