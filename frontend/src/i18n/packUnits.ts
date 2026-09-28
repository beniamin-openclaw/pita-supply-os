// Declension table for purchase units that pack multiple inventory units
// (e.g. a "zgrzewka" of 24 szt) — pack-units-display-mobile-wrap Track A.
//
// Polish purchase-unit names are master data (`supplier_products.purchase_unit`),
// not a fixed noun-family literal, so they cannot go through `tPlural` (its
// `pluralKeys.test.ts` guard requires a literal noun at every call site). This
// mirrors the `categoryLabels.ts` precedent for a data-driven label living
// inside `i18n/` instead: a lookup table keyed by the raw master-data value,
// with an "unknown unit -> raw value unchanged" fallback so a not-yet-mapped
// purchase unit still renders instead of disappearing.

import { pluralForm, type Lang } from "./index";

export interface PackUnitForms {
  pl: { one: string; few: string; many: string; frac: string };
  en: { one: string; many: string };
}

/** Keyed by the LOWER-CASED master-data `purchase_unit` value — lookups are
 *  case-insensitive (see `packUnitLabel`). */
export const PACK_UNIT_FORMS: Record<string, PackUnitForms> = {
  zgrzewka: {
    pl: { one: "zgrzewka", few: "zgrzewki", many: "zgrzewek", frac: "zgrzewki" },
    en: { one: "case", many: "cases" },
  },
  karton: {
    pl: { one: "karton", few: "kartony", many: "kartonów", frac: "kartonu" },
    en: { one: "carton", many: "cartons" },
  },
  blok: {
    pl: { one: "blok", few: "bloki", many: "bloków", frac: "bloku" },
    en: { one: "block", many: "blocks" },
  },
  wiadro: {
    pl: { one: "wiadro", few: "wiadra", many: "wiader", frac: "wiadra" },
    en: { one: "bucket", many: "buckets" },
  },
  opak: {
    pl: { one: "opak", few: "opak", many: "opak", frac: "opak" },
    en: { one: "pack", many: "packs" },
  },
  worek: {
    pl: { one: "worek", few: "worki", many: "worków", frac: "worka" },
    en: { one: "bag", many: "bags" },
  },
  skrzynka: {
    pl: { one: "skrzynka", few: "skrzynki", many: "skrzynek", frac: "skrzynki" },
    en: { one: "crate", many: "crates" },
  },
  butla: {
    pl: { one: "butla", few: "butle", many: "butli", frac: "butli" },
    en: { one: "cylinder", many: "cylinders" },
  },
  paleta: {
    pl: { one: "paleta", few: "palety", many: "palet", frac: "palety" },
    en: { one: "pallet", many: "pallets" },
  },
  szt: {
    pl: { one: "szt", few: "szt", many: "szt", frac: "szt" },
    en: { one: "pc", many: "pcs" },
  },
  kg: {
    pl: { one: "kg", few: "kg", many: "kg", frac: "kg" },
    en: { one: "kg", many: "kg" },
  },
  box: {
    pl: { one: "box", few: "box", many: "box", frac: "box" },
    en: { one: "box", many: "boxes" },
  },
  pojemnik: {
    pl: { one: "pojemnik", few: "pojemniki", many: "pojemników", frac: "pojemnika" },
    en: { one: "container", many: "containers" },
  },
  paczka: {
    pl: { one: "paczka", few: "paczki", many: "paczek", frac: "paczki" },
    en: { one: "packet", many: "packets" },
  },
};

/**
 * Declined pack-unit label for a count `n` of purchase unit `unit`.
 *
 * A non-integer `n` (e.g. 1.7 zgrzewki) always uses the genitive-singular
 * `frac` form in Polish — Polish has no "1.7 of a kind" declension rule, and
 * `frac` is the natural-sounding choice ("1,7 zgrzewki", "2,5 bloku"). An
 * integer `n` uses the normal one/few/many split via `pluralForm`. English
 * only ever has one/many (`n === 1` → `one`, else `many`).
 *
 * An unknown/unmapped `unit` (case-insensitive lookup) returns the raw `unit`
 * string unchanged, in both languages and for every `n` — never disappears.
 */
export function packUnitLabel(n: number, unit: string, lang: Lang): string {
  const forms = PACK_UNIT_FORMS[unit.toLowerCase()];
  if (!forms) return unit;
  if (lang === "en") {
    return n === 1 ? forms.en.one : forms.en.many;
  }
  if (!Number.isInteger(n)) return forms.pl.frac;
  return forms.pl[pluralForm(n, lang)];
}

