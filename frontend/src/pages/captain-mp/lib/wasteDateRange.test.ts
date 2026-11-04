import { describe, expect, it } from "vitest";
import { wasteDateRange } from "./wasteDateRange";

describe("waste history date presets", () => {
  it("uses inclusive Warsaw calendar dates across year and leap-month boundaries", () => {
    expect(wasteDateRange("today", "2026-01-02")).toEqual({from:"2026-01-02",to:"2026-01-02"});
    expect(wasteDateRange("week", "2026-01-02")).toEqual({from:"2025-12-27",to:"2026-01-02"});
    expect(wasteDateRange("week", "2024-03-03")).toEqual({from:"2024-02-26",to:"2024-03-03"});
    expect(wasteDateRange("month", "2026-11-04")).toEqual({from:"2026-11-01",to:"2026-11-04"});
  });
});
