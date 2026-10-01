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

/** Same as `formatPacks` but split so a caller can style the unit (bold) — the
 *  pieces joined with a space equal `formatPacks(n, unit, lang)`. */
export function formatPacksParts(
  n: number,
  unit: string,
  lang: Lang,
): { qty: string; unit: string } {
  return { qty: formatPackQty(n, lang), unit: packUnitLabel(n, unit, lang) };
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

/**
 * Purchase units per bulk pack ("opakowanie zbiorcze", migration 0028), or null
 * when the entity has no valid case (absent, null, or ≤ 1). Twin of
 * `has_case` in supply-os-v1/app/suggestion.py. Works on any API row that
 * carries `units_per_case` (OrderableItem, ManagerOrderLineDetail,
 * InventoryProduct).
 */
export function caseSizeOf(entity: { units_per_case?: number | null }): number | null {
  const upc = entity.units_per_case;
  return typeof upc === "number" && Number.isFinite(upc) && upc > 1 ? upc : null;
}

/** The case (unit + size) when both are set, else null — what the screens and
 *  documents print. */
export function caseOf(entity: {
  case_unit?: string | null;
  units_per_case?: number | null;
}): { unit: string; size: number } | null {
  const size = caseSizeOf(entity);
  const unit = (entity.case_unit ?? "").trim();
  return size !== null && unit !== "" ? { unit, size } : null;
}

/**
 * Python `f"{qty:g}"` (six significant digits, no trailing zeros) with a
 * decimal comma: 1.5 -> "1,5", 0.30000000000000004 -> "0,3". The supplier
 * e-mail's number format — twin of gmail_url._format_qty.
 */
export function formatQtyG(qty: number): string {
  return String(Number(qty.toPrecision(6))).replace(".", ",");
}
