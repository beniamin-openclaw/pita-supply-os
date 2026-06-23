import { describe, it, expect } from "vitest";

import { parseDecimal, formatDecimal } from "./number";

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
