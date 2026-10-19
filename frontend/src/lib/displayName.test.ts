import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripBulkSuffix } from "./displayName";

// Cases shared with the backend twin gmail_url.strip_bulk_suffix (supplier
// e-mail, supplier-email-1019) — both suites read the same file.
const SHARED = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../supply-os-v1/tests/fixtures/strip_bulk_suffix.json",
    ),
    "utf-8",
  ),
) as { strip: Array<[string, string]>; keep: string[] };

describe("stripBulkSuffix", () => {
  it.each([
    ["EURIAL REHA HALLOUMI SER DO GRILLOWANIA 200g/12", "EURIAL REHA HALLOUMI SER DO GRILLOWANIA 200g"],
    ["AVIKO FRYTKI SUPER CRUNCH 9,5mm 2,5kg/4", "AVIKO FRYTKI SUPER CRUNCH 9,5mm 2,5kg"],
    ["MELVIT KASZA PĘCZAK 900g/10", "MELVIT KASZA PĘCZAK 900g"],
    ["KRUSZWICA MASŁO ROŚLINNE 500g/12 kubek", "KRUSZWICA MASŁO ROŚLINNE 500g kubek"],
    ["OLEJ UNIWERSALNY RZEPAKOWY 5L (4)", "OLEJ UNIWERSALNY RZEPAKOWY 5L"],
    ["ROLNIK CIECIORKA W ZALEWIE 400g/240g (12) puszka", "ROLNIK CIECIORKA W ZALEWIE 400g/240g puszka"],
    ["AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30", "AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g"],
    ["KAWA JACOBS CRONAT GOLD ROZPUSZCZALNA 200g/6", "KAWA JACOBS CRONAT GOLD ROZPUSZCZALNA 200g"],
    ["LIPTON HERBATA YELLOW LABEL 100szt./12 koperta", "LIPTON HERBATA YELLOW LABEL 100szt. koperta"],
    ["Sok 1 l/6", "Sok 1 l"],
  ])("strips %s", (input: string, expected: string) => {
    expect(stripBulkSuffix(input)).toBe(expected);
  });

  it.each([
    "ROLNIK CIECIORKA 400g/240g",
    "Ser 1/2 kg",
    "Mąka 1/2",
    "Cukier 2,5kg/1,5",
    "Masło MR 500g",
    "Cytryna",
    "Kapusta 1/4 główki",
    "Napój 330ml/24.5",
    "Produkt (12)",
    "Olej 5L (1)",
    "Olej 5L/1",
    "Zupa 400g/12g",
    "Cukier w saszetkach 5g/200 szt",
    "Cieciorka w zalewie 400g/240g",
    "",
  ])("leaves %j unchanged", (input: string) => {
    expect(stripBulkSuffix(input)).toBe(input);
  });

  it("collapses leftover double spaces", () => {
    expect(stripBulkSuffix("Ser  200g/12  szt")).toBe("Ser 200g szt");
  });

  it("is idempotent", () => {
    const once = stripBulkSuffix("MELVIT KASZA 900g/10");
    expect(stripBulkSuffix(once)).toBe(once);
  });
});

describe("stripBulkSuffix — cases shared with the backend", () => {
  it.each(SHARED.strip)("strips %s", (input: string, expected: string) => {
    expect(stripBulkSuffix(input)).toBe(expected);
  });

  it.each(SHARED.keep)("leaves %j unchanged", (input: string) => {
    expect(stripBulkSuffix(input)).toBe(input);
  });
});
