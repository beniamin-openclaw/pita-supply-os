// Locale-tolerant decimal parsing for the Captain/Manager number inputs.
//
// Polish-locale phones type decimals with a COMMA ("0,6"). A `<input type="number">`
// in a pl-PL locale won't hand that comma to JS at all (the field reads back ""),
// so the value silently blanks out. The fix is a `type="text"` input (see
// DecimalInput) whose raw string we normalize here: comma → dot, then strict
// `Number()` parse. `Number()` (not `parseFloat`) is intentional — it rejects
// trailing garbage like "1.5abc" or thousands spacing "1 234" as invalid instead
// of silently truncating.

/** Parse a user-typed decimal string (comma or dot) → number, or null when blank
 *  or not a complete finite number.
 *
 *  Notes:
 *   - ""/whitespace → null (blank; the caller treats this as "not entered").
 *   - "0," → "0." → Number("0.") === 0 (finite) → returns 0. This is the wanted
 *     mid-type behavior: the field still shows "0," while the user types toward
 *     "0,6", and the live suggestion uses 0 in the meantime.
 *   - "abc", ",", "1 234" → null (strict reject).
 *   - "-1" → -1 (bounds are a UI concern via min=0). */
export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Render a numeric value back to a dot-form display string, for seeding the
 *  DecimalInput buffer. "" (the blank sentinel) stays "". */
export function formatDecimal(value: number | ""): string {
  return value === "" ? "" : String(value);
}
