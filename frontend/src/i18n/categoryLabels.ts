// Category labels for the 10 live `product_category` values (product master
// data) — training-feedback-0901 Phase 2. Categories translate; product names
// never do: `product_name_pl` is the operator's own catalogue naming and
// stays byte-identical in both languages (explicit operator instruction).
//
// Polish is the source of truth (the raw `product_category` value itself);
// this map only supplies the English side. An unmapped or newly-added
// category (master data changes independently of this file) falls back to
// the raw value instead of disappearing.

import type { Lang } from "./index";

const CATEGORY_LABELS_EN: Record<string, string> = {
  Biurowe: "Office supplies",
  Chemia: "Chemicals",
  Chłodnia: "Refrigerated",
  Gaz: "Gas",
  Mrożonki: "Frozen",
  Napoje: "Beverages",
  Opakowania: "Packaging",
  Produkcja: "Production",
  Spożywcze: "Groceries",
  Wino: "Wine",
};

/**
 * Translate a raw `product_category` value for display.
 *
 * `lang === "pl"` always returns `key` unchanged (Polish is the source of
 * truth). `lang === "en"` looks `key` up in `CATEGORY_LABELS_EN`, falling
 * back to the raw `key` when it isn't one of the 10 mapped categories — an
 * unmapped or newly-added category still renders, rather than vanishing.
 */
export function categoryLabel(key: string, lang: Lang): string {
  if (lang !== "en") return key;
  return CATEGORY_LABELS_EN[key] ?? key;
}
