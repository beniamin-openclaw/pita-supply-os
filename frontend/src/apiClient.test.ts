import { describe, it, expect } from "vitest";

import { formatErrorDetail } from "./apiClient";

describe("formatErrorDetail", () => {
  it("maps a single 422 validation entry to 'field: msg'", () => {
    const payload = {
      detail: [{ loc: ["body", "lines"], msg: "field required", type: "missing" }],
    };
    expect(formatErrorDetail(payload, "fallback")).toBe("lines: field required");
  });

  it("joins multiple 422 entries with '; '", () => {
    const payload = {
      detail: [
        { loc: ["body", "a"], msg: "err a", type: "missing" },
        { loc: ["body", "b"], msg: "err b", type: "value_error" },
      ],
    };
    expect(formatErrorDetail(payload, "fb")).toBe("a: err a; b: err b");
  });

  it("uses a nested loc path minus the leading body segment", () => {
    const payload = {
      detail: [{ loc: ["body", "lines", 0, "qty"], msg: "must be >= 0" }],
    };
    expect(formatErrorDetail(payload, "fb")).toBe("lines.0.qty: must be >= 0");
  });

  it("passes a string detail through unchanged", () => {
    expect(formatErrorDetail({ detail: "Order not found" }, "fb")).toBe(
      "Order not found",
    );
  });

  it("falls back when detail is missing or empty", () => {
    expect(formatErrorDetail({}, "Bad Request")).toBe("Bad Request");
    expect(formatErrorDetail(null, "Bad Request")).toBe("Bad Request");
    expect(formatErrorDetail({ detail: "" }, "Bad Request")).toBe("Bad Request");
  });

  it("never returns '[object Object]' for an object detail", () => {
    const out = formatErrorDetail({ detail: { weird: 1 } }, "fb");
    expect(out).not.toContain("[object Object]");
  });

  it("never returns '[object Object]' for an array of opaque objects", () => {
    const out = formatErrorDetail({ detail: [{ foo: "bar" }] }, "fb");
    expect(out).not.toContain("[object Object]");
  });
});
