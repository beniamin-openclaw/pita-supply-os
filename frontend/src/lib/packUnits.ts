// Pack-unit conversions + formatting — pack-units-display-mobile-wrap Track A.
//
// A purchase unit whose `units_per_purchase_unit` > 1 (e.g. a "zgrzewka" of 24
// szt) packs multiple inventory (base) units. State and the API contract stay
// in base units everywhere (`current_stock_qty_base`, `target_stock_qty_base`,
// …); these are display/input-toggle helpers that convert a base quantity to
// its pack-unit equivalent and back, and format it with the right Polish
// declension (see `../i18n/packUnits`). Pure, no React.

import type { Lang } from "../i18n";
import { packUnitLabel } from "../i18n/packUnits";
import { roundQty } from "../components/ui/number";

/** Base-unit quantity -> pack (purchase-unit) quantity, rounded to 1 decimal
 *  place — e.g. 40 szt / 24 (szt per zgrzewka) -> 1.7 zgrzewki. */
export function baseToPacks(base: number, unitsPerPurchase: number): number {
  return Math.round((base / unitsPerPurchase) * 10) / 10;
}

/** Pack (purchase-unit) quantity -> base-unit quantity — the inverse of
 *  `baseToPacks`. Used by the Captain's "wpisz w …" toggle so the underlying
 *  state/API value stays in base (inventory) units regardless of which unit
 *  the operator is currently typing in. */
export function packsToBase(packs: number, unitsPerPurchase: number): number {
  return roundQty(packs * unitsPerPurchase);
}

/** Locale-formatted pack quantity — comma decimal in Polish, dot in English,
 *  at most one decimal place: 1.7 -> "1,7" (pl) / "1.7" (en); 5 -> "5". */
export function formatPackQty(n: number, lang: Lang): string {
  const locale = lang === "en" ? "en-GB" : "pl-PL";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
}

/** "<formatted qty> <declined pack-unit label>" — e.g. "5 zgrzewek",
 *  "1,7 zgrzewki", "5 cases". */
export function formatPacks(n: number, unit: string, lang: Lang): string {
  return `${formatPackQty(n, lang)} ${packUnitLabel(n, unit, lang)}`;
}

/**
 * Pack-unit hint string for a base-unit quantity, or `null` when the
 * purchase unit carries no real pack conversion (`unitsPerPurchase <= 1`, or
 * not a finite ratio) — callers render nothing in that case.
 */
export function packHint(
  base: number,
  unitsPerPurchase: number,
  unit: string,
  lang: Lang,
): string | null {
  if (!Number.isFinite(unitsPerPurchase) || unitsPerPurchase <= 1) return null;
  return formatPacks(baseToPacks(base, unitsPerPurchase), unit, lang);
}

/** True when `unitsPerPurchase` represents a real multi-unit pack (> 1 and
 *  finite) — gates whether the Captain/Manager UI shows any pack-unit hint. */
export function isPackBased(unitsPerPurchase: number): boolean {
  return Number.isFinite(unitsPerPurchase) && unitsPerPurchase > 1;
}
