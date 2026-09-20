import { describe, expect, it } from "vitest";

import { daysSince } from "./dates";

describe("daysSince (Europe/Warsaw calendar days)", () => {
  it("is 0 on the same Warsaw day", () => {
    // 2026-09-20 08:00 CEST = 06:00Z; now 20:00 CEST = 18:00Z the same day.
    expect(daysSince("2026-09-20T06:00:00Z", new Date("2026-09-20T18:00:00Z"))).toBe(0);
  });

  it("counts 1 across Warsaw midnight even when under 24h apart", () => {
    // 23:30 CEST (21:30Z) → 00:30 CEST next day (22:30Z): one hour, one day.
    expect(daysSince("2026-09-20T21:30:00Z", new Date("2026-09-20T22:30:00Z"))).toBe(1);
  });

  it("stays 0 just before Warsaw midnight when the UTC date already changed", () => {
    // 2026-09-20 00:30 CEST = 2026-09-19 22:30Z; now 23:30 CEST = 21:30Z on the 20th.
    expect(daysSince("2026-09-19T22:30:00Z", new Date("2026-09-20T21:30:00Z"))).toBe(0);
  });

  it("counts whole days for older timestamps", () => {
    expect(daysSince("2026-09-17T10:00:00Z", new Date("2026-09-20T09:00:00Z"))).toBe(3);
  });

  it("handles the CET/CEST transition without drifting", () => {
    // 2026-10-25 is the CEST→CET switch (25h day). Two Warsaw days apart.
    expect(daysSince("2026-10-24T10:00:00Z", new Date("2026-10-26T10:00:00Z"))).toBe(2);
  });

  it("returns null for missing or unparseable input", () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince(undefined)).toBeNull();
    expect(daysSince("not-a-date")).toBeNull();
  });
});
