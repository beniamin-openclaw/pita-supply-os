// Captain-view display name: hides the supplier invoice's "how many per
// carton" suffix (captain-backup-card-names, WP4 / D3).
//
// Supplier names carry the bulk pack, e.g. "MELVIT KASZA PĘCZAK 900g/10" or
// "OLEJ UNIWERSALNY RZEPAKOWY 5L (4)". The Captain does not need the carton
// count. DISPLAY ONLY: the stored name, the supplier e-mail and the PDFs keep
// the full text. When unsure, the name is returned unchanged.

// Size token units. Longer alternatives first so "kg" wins over "g".
const UNIT = "(?:kg|dag|mg|ml|cl|cm|mm|szt\\.?|g|l|m)";
// A size token: a number (optionally decimal) glued to a unit.
const SIZE = `\\d+(?:[.,]\\d+)?\\s?${UNIT}`;

// "<size>/<N>": N is an integer pack count, not a decimal, not followed by
// another digit, and not a ratio (no unit word right after it: "400g/240g").
const SLASH_PACK = new RegExp(
  `(${SIZE})\\/(\\d{1,3})(?![\\d/]|[.,]\\d|\\s?${UNIT}(?![A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]))`,
  "gi",
);

// "<size> (N)": a parenthesised integer pack count right after a size token
// (the size token may be the end of a ratio, "400g/240g (12)").
const PAREN_PACK = new RegExp(`(${SIZE})\\s*\\((\\d{1,3})\\)`, "gi");

export function stripBulkSuffix(name: string): string {
  if (!name) return name;
  let out: string = name;
  // A pack count of 1 is not a bulk pack: leave it.
  out = out.replace(SLASH_PACK, (whole: string, size: string, n: string) =>
    Number(n) >= 2 ? size : whole,
  );
  out = out.replace(PAREN_PACK, (whole: string, size: string, n: string) =>
    Number(n) >= 2 ? size : whole,
  );
  if (out === name) return name;
  out = out.replace(/\s{2,}/g, " ").trim();
  return out === "" ? name : out;
}
