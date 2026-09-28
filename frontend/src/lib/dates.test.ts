import { describe, expect, it } from "vitest";

import { addDaysIso, daysSince, isoWeekday, warsawTodayIso } from "./dates";

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

describe("warsawTodayIso (delivery-calendar)", () => {
  it("returns the Warsaw date in summer time (CEST) across UTC midnight", () => {
    // 2026-09-30 22:30Z = 2026-10-01 00:30 CEST.
    expect(warsawTodayIso(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10-01");
    expect(warsawTodayIso(new Date("2026-09-30T21:30:00Z"))).toBe("2026-09-30");
  });

  it("returns the Warsaw date in winter time (CET)", () => {
    // 2026-11-10 23:30Z = 2026-11-11 00:30 CET; 22:30Z is still the 10th.
    expect(warsawTodayIso(new Date("2026-11-10T23:30:00Z"))).toBe("2026-11-11");
    expect(warsawTodayIso(new Date("2026-11-10T22:30:00Z"))).toBe("2026-11-10");
  });

  it("adds days and reads weekdays on plain ISO dates", () => {
    expect(addDaysIso("2026-09-30", 2)).toBe("2026-10-02");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(isoWeekday("2026-09-28")).toBe(1); // Monday
    expect(isoWeekday("2026-10-04")).toBe(0); // Sunday
  });
});
