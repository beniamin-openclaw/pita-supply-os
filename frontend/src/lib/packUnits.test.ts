import { describe, it, expect } from "vitest";

import {
  baseToPacks,
  packsToBase,
  formatPackQty,
  formatPacks,
  packHint,
  isPackBased,
} from "./packUnits";
import { PACK_UNIT_FORMS } from "../i18n/packUnits";

describe("baseToPacks", () => {
  it("120 szt / 24 -> 5", () => {
    expect(baseToPacks(120, 24)).toBe(5);
  });

  it("40 szt / 24 -> 1.7", () => {
    expect(baseToPacks(40, 24)).toBe(1.7);
  });

  it("36 szt / 24 -> 1.5", () => {
    expect(baseToPacks(36, 24)).toBe(1.5);
  });
});

describe("packsToBase", () => {
  it("2 zgrzewki x 24 -> 48", () => {
    expect(packsToBase(2, 24)).toBe(48);
  });

  it("1.7 zgrzewki x 24 -> 40.8", () => {
    expect(packsToBase(1.7, 24)).toBe(40.8);
  });
});

describe("formatPackQty", () => {
  it("formats an integer without a decimal point (pl)", () => {
    expect(formatPackQty(5, "pl")).toBe("5");
  });

  it("formats a decimal with a comma (pl)", () => {
    expect(formatPackQty(1.7, "pl")).toBe("1,7");
  });

  it("formats a decimal with a dot (en)", () => {
    expect(formatPackQty(1.7, "en")).toBe("1.7");
  });
});

describe("formatPacks", () => {
  it.each([
    [1, "zgrzewka"],
    [2, "zgrzewki"],
    [5, "zgrzewek"],
    [12, "zgrzewek"],
    [22, "zgrzewki"],
    [25, "zgrzewek"],
  ])("%i zgrzewka -> %s (pl)", (n, label) => {
    expect(formatPacks(n, "zgrzewka", "pl")).toBe(`${n} ${label}`);
  });

  it("1.7 zgrzewki uses the genitive-singular (frac) form (pl)", () => {
    expect(formatPacks(1.7, "zgrzewka", "pl")).toBe("1,7 zgrzewki");
  });

  it("2.5 blok uses its frac form 'bloku' (pl)", () => {
    expect(formatPacks(2.5, "blok", "pl")).toBe("2,5 bloku");
  });

  it("en: 5 -> '5 cases'", () => {
    expect(formatPacks(5, "zgrzewka", "en")).toBe("5 cases");
  });

  it("en: 1 -> '1 case'", () => {
    expect(formatPacks(1, "zgrzewka", "en")).toBe("1 case");
  });

  it("unknown unit falls back to the raw unit, unpluralized", () => {
    expect(formatPacks(3, "paczka", "pl")).toBe("3 paczka");
  });
});

describe("packHint", () => {
  it("returns null when unitsPerPurchase <= 1 (no real pack conversion)", () => {
    expect(packHint(120, 1, "szt", "pl")).toBeNull();
  });

  it("returns null for a non-finite ratio", () => {
    expect(packHint(120, NaN, "szt", "pl")).toBeNull();
    expect(packHint(120, Infinity, "szt", "pl")).toBeNull();
  });

  it("returns the formatted pack equivalent otherwise", () => {
    expect(packHint(40, 24, "zgrzewka", "pl")).toBe("1,7 zgrzewki");
  });
});

describe("isPackBased", () => {
  it("true for a finite ratio > 1", () => {
    expect(isPackBased(24)).toBe(true);
  });

  it("false for 1, 0, negative, or non-finite", () => {
    expect(isPackBased(1)).toBe(false);
    expect(isPackBased(0)).toBe(false);
    expect(isPackBased(-1)).toBe(false);
    expect(isPackBased(NaN)).toBe(false);
    expect(isPackBased(Infinity)).toBe(false);
  });
});

describe("PACK_UNIT_FORMS integrity", () => {
  it("every entry has all five Polish forms and both English forms non-empty", () => {
    for (const [unit, forms] of Object.entries(PACK_UNIT_FORMS)) {
      for (const key of ["one", "few", "many", "frac", "loc"] as const) {
        expect(forms.pl[key], `${unit}.pl.${key}`).toBeTruthy();
      }
      for (const key of ["one", "many"] as const) {
        expect(forms.en[key], `${unit}.en.${key}`).toBeTruthy();
      }
    }
  });
});
