// Soft "did you mean pieces?" helper for products counted in pieces whose NAME
// carries the per-piece weight (e.g. "Prymat Pieprz czarny mielony 820g"). When a
// Captain types a gram amount (400) instead of a piece count (0,5), we propose
// the conversion. Also the read-only kg reading next to a piece count
// ("12 szt (2,4 kg)", captain-kg-reading). Pure functions — the UI decides when
// to show them.

import type { Lang } from "../i18n";
import { formatBaseQty } from "./packStock";

/** Units that count whole pieces; only these ever trigger the hint. */
const PIECE_UNITS: readonly string[] = ["szt", "słoik", "opak"];

/** A gram-looking amount must be at least this big (normal counts stay below). */
const MIN_GRAMS_VALUE = 50;
/** More than this many pieces' worth of grams is not a plausible typo. */
const MAX_PIECES = 20;

const WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|gr|g)(?![a-ząćęłńóśźż0-9])/i;
/** Spellings where the first weight is not one piece, so no kg reading:
 *  weight then / x × * and a digit ("25g/30", "4,2kg/2,5kg", "200 g. x 6"),
 *  a digit and x × * right before a weight ("12x200g", "4 * 2,5kg"), a piece
 *  count in the name ("12 szt. x 200g", "25g (30 szt)") and a fraction before a
 *  weight ("1/2 kg"). */
const MULTIPACK_RES: readonly RegExp[] = [
  /\d\s*(?:kg|gr|g)\.?\s*[/x×*]\s*\d/i,
  /\d\s*[x×*]\s*\d+(?:[.,]\d+)?\s*(?:kg|gr|g)(?![a-ząćęłńóśźż0-9])/i,
  /\d\s*szt(?![a-ząćęłńóśźż])/i,
  /\d\s*\/\s*\d+(?:[.,]\d+)?\s*(?:kg|gr|g)(?![a-ząćęłńóśźż0-9])/i,
];

/** True for units that count whole pieces (szt, słoik, opak). */
export function isPieceUnit(unit: string | null | undefined): boolean {
  return PIECE_UNITS.includes((unit || "").trim().toLowerCase());
}

/**
 * Per-piece grams from a product name: "820g" -> 820, "4,2kg" -> 4200,
 * "200gr" -> 200. With several weights ("4,2kg/2,5kg") the FIRST wins.
 * Null when the name carries no weight.
 */
export function parseGramsPerPiece(name: string | null | undefined): number | null {
  if (!name) return null;
  const m = WEIGHT_RE.exec(name);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const grams: number = m[2].toLowerCase() === "kg" ? n * 1000 : n;
  return Math.round(grams * 1000) / 1000;
}

/**
 * Pieces (rounded to the nearest 0,5, min 0,5) when `value` clearly looks like
 * grams of a piece-counted product; null otherwise. Conservative: needs a piece
 * unit, value >= 50 (so 1, 2, 5, 12, 24 never trigger) and at most 20 pieces'
 * worth of grams. With `maxStock` (> 0) the value must also exceed 3 x max.
 */
export function suggestPiecesFromGrams(
  value: number,
  gramsPerPiece: number,
  unit: string,
  maxStock?: number | null,
): number | null {
  if (!isPieceUnit(unit)) return null;
  if (!Number.isFinite(value) || !Number.isFinite(gramsPerPiece) || gramsPerPiece <= 0) {
    return null;
  }
  if (value < MIN_GRAMS_VALUE) return null;
  if (value / gramsPerPiece > MAX_PIECES) return null;
  // A count within 3x the location's max is a plausible piece count (frytki
  // 2,5kg counted in dozens), not grams — the same 3x rule as the inventory
  // "check the unit" warning.
  if (maxStock != null && maxStock > 0 && value <= 3 * maxStock) return null;
  const pieces: number = Math.max(0.5, Math.round((value / gramsPerPiece) * 2) / 2);
  return pieces === value ? null : pieces;
}

/**
 * Weight of ONE piece for the kg reading: the first name that carries a weight
 * decides — its grams, or null when that name spells a multipack ("25g/30",
 * "12x200g", "4,2kg/2,5kg"), since its first weight is then not one piece.
 * A name without any weight falls through to the next one.
 */
export function pieceGramsFromNames(names: Array<string | null | undefined>): number | null {
  for (const name of names) {
    const grams: number | null = parseGramsPerPiece(name);
    if (grams === null) continue;
    return MULTIPACK_RES.some((re) => re.test(name as string)) ? null : grams;
  }
  return null;
}

/**
 * Read-only kg number for a piece count: 12 x 200 g -> "2,4" (pl) / "2.4" (en),
 * at most 3 decimals. Null for an empty, zero or negative count, no weight, or
 * a unit that is not a piece unit (a kg product never gets a reading). The
 * brackets and " kg" come from i18n (`stock.kgReading` and friends).
 */
export function formatPiecesAsKg(
  qty: number | "" | null | undefined,
  gramsPerPiece: number | null | undefined,
  unit: string | null | undefined,
  lang: Lang,
): string | null {
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) return null;
  if (gramsPerPiece == null || !Number.isFinite(gramsPerPiece) || gramsPerPiece <= 0) return null;
  if (!isPieceUnit(unit)) return null;
  return formatBaseQty((qty * gramsPerPiece) / 1000, lang);
}
