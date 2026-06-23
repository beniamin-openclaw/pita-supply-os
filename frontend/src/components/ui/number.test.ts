import { describe, it, expect } from "vitest";

import { parseDecimal, formatDecimal, roundQty } from "./number";

describe("parseDecimal", () => {
  it("parses a comma decimal (the core demo bug)", () => {
    expect(parseDecimal("0,6")).toBe(0.6);
    expect(parseDecimal("1,4")).toBe(1.4);
  });

  it("parses a dot decimal too", () => {
    expect(parseDecimal("1.4")).toBe(1.4);
    expect(parseDecimal("12")).toBe(12);
  });

  it("treats blank/whitespace as null (not entered)", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("   ")).toBeNull();
  });

  it('"0," → 0 (finite mid-type value; field keeps showing "0,")', () => {
    expect(parseDecimal("0,")).toBe(0);
    expect(parseDecimal("5.")).toBe(5);
  });

  it("rejects non-numeric / partial-garbage strictly via Number()", () => {
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal(",")).toBeNull();
    expect(parseDecimal("1.5abc")).toBeNull();
    expect(parseDecimal("1 234")).toBeNull(); // thousands spacing rejected
    expect(parseDecimal("1e5")).toBeNull(); // scientific notation rejected
    expect(parseDecimal("2E3")).toBeNull();
  });

  it("keeps negatives (UI min=0 enforces bounds)", () => {
    expect(parseDecimal("-1")).toBe(-1);
  });
});

describe("formatDecimal", () => {
  it("renders a number in dot form", () => {
    expect(formatDecimal(0.6)).toBe("0.6");
    expect(formatDecimal(2)).toBe("2");
  });

  it("keeps the blank sentinel blank", () => {
    expect(formatDecimal("")).toBe("");
  });
});

describe("roundQty", () => {
  it("kills the binary-float tail (the demo variance bug)", () => {
    expect(roundQty(2.2 - 1.8)).toBe(0.4); // was 0.40000000000000013
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
  });

  it("leaves clean values untouched", () => {
    expect(roundQty(1.8)).toBe(1.8);
    expect(roundQty(12)).toBe(12);
    expect(roundQty(0)).toBe(0);
  });

  it("rounds to 2 dp", () => {
    expect(roundQty(1.005)).toBe(1); // float: 1.005*100 = 100.499… → 100 → 1
    expect(roundQty(1.234)).toBe(1.23);
    expect(roundQty(1.235)).toBe(1.24);
  });

  it("handles negative variances", () => {
    expect(roundQty(1.8 - 2.2)).toBe(-0.4);
  });
});
