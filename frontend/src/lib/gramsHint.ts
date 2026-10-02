// Soft "did you mean pieces?" helper for products counted in pieces whose NAME
// carries the per-piece weight (e.g. "Prymat Pieprz czarny mielony 820g"). When a
// Captain types a gram amount (400) instead of a piece count (0,5), we propose
// the conversion. Pure functions — the UI decides when to show it.

/** Units that count whole pieces; only these ever trigger the hint. */
const PIECE_UNITS: readonly string[] = ["szt", "słoik", "opak"];

/** A gram-looking amount must be at least this big (normal counts stay below). */
const MIN_GRAMS_VALUE = 50;
/** More than this many pieces' worth of grams is not a plausible typo. */
const MAX_PIECES = 20;

const WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|gr|g)(?![a-ząćęłńóśźż0-9])/i;

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
  if (!PIECE_UNITS.includes((unit || "").trim().toLowerCase())) return null;
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
