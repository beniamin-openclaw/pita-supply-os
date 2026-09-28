import { describe, expect, it } from "vitest";

import { getDeadlineUrgency, getRequestedDeliveryDate } from "./dates";

describe("getRequestedDeliveryDate (legacy fallback, Warsaw calendar)", () => {
  it("counts tomorrow from the Warsaw date between 00:00 and 02:00 Warsaw", () => {
    // 2026-09-30 22:30Z = Thu 2026-10-01 00:30 CEST → tomorrow = 2026-10-02.
    const now = new Date("2026-09-30T22:30:00Z");
    expect(getRequestedDeliveryDate(null, now)).toBe("2026-10-02");
    expect(getRequestedDeliveryDate("TBD", now)).toBe("2026-10-02");
  });

  it("adds a numeric lead time", () => {
    expect(getRequestedDeliveryDate("2", new Date("2026-09-28T10:00:00Z"))).toBe("2026-09-30");
  });

  it("picks the next listed weekday, never today", () => {
    // Mon 2026-09-28 → next "Mon" is 2026-10-05; "Tue, Fri" → Tue 2026-09-29.
    expect(getRequestedDeliveryDate("Mon", new Date("2026-09-28T10:00:00Z"))).toBe("2026-10-05");
    expect(getRequestedDeliveryDate("Tue, Fri", new Date("2026-09-28T10:00:00Z"))).toBe(
      "2026-09-29",
    );
  });
});

describe("getDeadlineUrgency", () => {
  const now = new Date("2026-09-28T10:00:00Z");
  it("is danger under 1 h and when passed", () => {
    expect(getDeadlineUrgency("2026-09-28T10:30:00Z", now)).toBe("danger");
    expect(getDeadlineUrgency("2026-09-28T09:00:00Z", now)).toBe("danger");
  });
  it("is warn under 6 h", () => {
    expect(getDeadlineUrgency("2026-09-28T15:00:00Z", now)).toBe("warn");
  });
  it("is ok further out or without a deadline", () => {
    expect(getDeadlineUrgency("2026-09-28T17:00:00Z", now)).toBe("ok");
    expect(getDeadlineUrgency(null, now)).toBe("ok");
    expect(getDeadlineUrgency("garbage", now)).toBe("ok");
  });
});
