import { describe, it, expect } from "vitest";

import { localizeValidationDetail } from "./apiErrors";

describe("localizeValidationDetail", () => {
  it("maps the empty-order (lines too_short) case to a full PL sentence", () => {
    const detail = [
      { type: "too_short", loc: ["body", "lines"], msg: "List should have at least 1 item", ctx: { min_length: 1 } },
    ];
    expect(localizeValidationDetail(detail, "pl")).toBe(
      "Dodaj przynajmniej jedną pozycję do zamówienia.",
    );
    expect(localizeValidationDetail(detail, "en")).toBe("Add at least one item to the order.");
  });

  it("maps `missing` to the required message (no raw field for unknown field)", () => {
    const detail = [{ type: "missing", loc: ["body", "count_user"], msg: "Field required" }];
    // count_user IS a known field → prefixed with its PL label.
    expect(localizeValidationDetail(detail, "pl")).toBe("Kto liczył: pole wymagane");
  });

  it("maps greater_than_equal with a known field to a prefixed PL message", () => {
    const detail = [
      {
        type: "greater_than_equal",
        loc: ["body", "lines", 0, "captain_final_qty_purchase"],
        ctx: { ge: 0 },
      },
    ];
    expect(localizeValidationDetail(detail, "pl")).toBe("Zamawiasz: wartość musi być ≥ 0");
  });

  it("omits the field prefix for an UNKNOWN field (never leaks raw English name)", () => {
    const detail = [{ type: "greater_than_equal", loc: ["body", "weird_field_x"], ctx: { ge: 5 } }];
    const out = localizeValidationDetail(detail, "pl");
    expect(out).toBe("wartość musi być ≥ 5");
    expect(out).not.toContain("weird_field_x");
  });

  it("falls back to a generic localized message for an unrecognized type", () => {
    const detail = [{ type: "int_parsing", loc: ["body", "x"], msg: "Input should be a valid integer" }];
    expect(localizeValidationDetail(detail, "pl")).toBe("nieprawidłowa wartość");
    // and never the raw English msg
    expect(localizeValidationDetail(detail, "pl")).not.toContain("Input should");
  });

  it("joins + de-dups multiple entries", () => {
    const detail = [
      { type: "missing", loc: ["body", "received_by"] },
      { type: "greater_than_equal", loc: ["body", "lines", 0, "captain_final_qty_purchase"], ctx: { ge: 0 } },
      { type: "greater_than_equal", loc: ["body", "lines", 1, "captain_final_qty_purchase"], ctx: { ge: 0 } },
    ];
    // two identical "Zamawiasz: …" collapse to one.
    expect(localizeValidationDetail(detail, "pl")).toBe(
      "Kto przyjął: pole wymagane; Zamawiasz: wartość musi być ≥ 0",
    );
  });

  it("returns null for a string detail (business-rule 400 → English fallback)", () => {
    expect(localizeValidationDetail("Order not found", "pl")).toBeNull();
  });

  it("returns null for an empty array, non-array, or garbage", () => {
    expect(localizeValidationDetail([], "pl")).toBeNull();
    expect(localizeValidationDetail(undefined, "pl")).toBeNull();
    expect(localizeValidationDetail({ detail: "x" }, "pl")).toBeNull();
    expect(localizeValidationDetail([{ no_type: true }], "pl")).toBeNull();
  });
});
