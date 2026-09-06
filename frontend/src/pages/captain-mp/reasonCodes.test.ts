// Key-integrity guard for the reason picker (week1-feedback-targets).
//
// REASON_CODES is a hand-maintained list that feeds ReasonPicker and
// OverruleAllControl; each entry is rendered through t(`reason.codes.${code}`).
// Nothing type-checks that composed key, so a code added to the list without
// its PL/EN strings would render as a raw key at runtime. This pins all three
// places (list, i18n PL, i18n EN) together.

import { describe, expect, it } from "vitest";
import { STRINGS } from "../../i18n/strings";
import { REASON_CODES } from "./types";

describe("REASON_CODES", () => {
  it("has a PL and EN label for every code", () => {
    for (const code of REASON_CODES) {
      const entry = STRINGS[`reason.codes.${code}` as keyof typeof STRINGS];
      expect(entry, `missing i18n entry for ${code}`).toBeDefined();
      expect(entry.pl.length, `empty PL label for ${code}`).toBeGreaterThan(0);
      expect(entry.en.length, `empty EN label for ${code}`).toBeGreaterThan(0);
    }
  });

  it("includes STOCK_UNTIL_NEXT_DELIVERY right after the traffic reasons", () => {
    const idx = REASON_CODES.indexOf("STOCK_UNTIL_NEXT_DELIVERY");
    expect(idx).toBe(REASON_CODES.indexOf("WEEKEND_HIGH_TRAFFIC") + 1);
    expect(REASON_CODES[idx + 1]).toBe("LOW_STORAGE");
  });

  it("keeps OTHER last (the comment-required sentinel)", () => {
    expect(REASON_CODES[REASON_CODES.length - 1]).toBe("OTHER");
  });
});
