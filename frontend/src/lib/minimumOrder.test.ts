import { describe, it, expect } from "vitest";
import { checkMinimumOrder, DEFAULT_MINIMUM_ORDER_VALUE_PLN } from "./minimumOrder";

describe("checkMinimumOrder", () => {
  it("is 'met' when the total is above the configured minimum", () => {
    expect(checkMinimumOrder(500, 400)).toEqual({ status: "met", threshold: 400 });
  });

  it("is 'met' when the total exactly equals the configured minimum", () => {
    expect(checkMinimumOrder(400, 400)).toEqual({ status: "met", threshold: 400 });
  });

  it("is 'below' when the total is under the configured minimum", () => {
    expect(checkMinimumOrder(399.99, 400)).toEqual({ status: "below", threshold: 400 });
  });

  it("is 'unknown' when the total is missing (null)", () => {
    expect(checkMinimumOrder(null, 400)).toEqual({ status: "unknown", threshold: 400 });
  });

  it("is 'unknown' when the total is missing (undefined)", () => {
    expect(checkMinimumOrder(undefined, 400)).toEqual({ status: "unknown", threshold: 400 });
  });

  it("falls back to the 400 PLN default when the minimum is null", () => {
    expect(checkMinimumOrder(500, null)).toEqual({
      status: "met",
      threshold: DEFAULT_MINIMUM_ORDER_VALUE_PLN,
    });
    expect(checkMinimumOrder(300, null)).toEqual({
      status: "below",
      threshold: DEFAULT_MINIMUM_ORDER_VALUE_PLN,
    });
  });

  it("falls back to the 400 PLN default when the minimum is undefined", () => {
    expect(checkMinimumOrder(500, undefined)).toEqual({
      status: "met",
      threshold: DEFAULT_MINIMUM_ORDER_VALUE_PLN,
    });
  });

  it("treats an explicit 0 minimum as real, not missing (nullish, not falsy, coalescing)", () => {
    expect(checkMinimumOrder(0, 0)).toEqual({ status: "met", threshold: 0 });
    expect(checkMinimumOrder(50, 0)).toEqual({ status: "met", threshold: 0 });
  });

  it("is 'unknown' when both total and minimum are missing", () => {
    expect(checkMinimumOrder(null, null)).toEqual({
      status: "unknown",
      threshold: DEFAULT_MINIMUM_ORDER_VALUE_PLN,
    });
  });
});
