// Ad-hoc "+ dodaj produkt" rows (training-feedback-0901 Phase 1b) — products
// the Captain needs that are NOT in the supplier catalogue (e.g. "we have an
// event, we need something we don't normally stock"). This module is the pure
// serialise/parse pair between the row-based UI state (ExtraItemsControl) and
// the flat `extra_items` free-text field the backend stores verbatim and both
// email builders (frontend emailBody.ts + backend gmail_url.py) render under
// the "Pozycje spoza katalogu:" heading. The backend never parses this string
// — it is opaque free text end to end — so the exact per-line format is a
// frontend-only decision, kept here so it's unit-tested independent of the UI.

/** One "+ dodaj produkt" row. All three fields are plain strings — this is a
 *  free-text add for something outside master data, not a validated quantity
 *  input like the catalogue ProductCard. */
export interface ExtraItemRow {
  name: string;
  qty: string;
  unit: string;
}

export function blankExtraItemRow(): ExtraItemRow {
  return { name: "", qty: "", unit: "" };
}

// Separator between the name and the "qty unit" tail. Chosen to be readable
// in a plaintext email and unlikely to collide with a product name.
const NAME_SEP = " - ";

/**
 * Serialise rows into the `extra_items` free-text field: one item per line,
 * "{name} - {qty} {unit}" (qty/unit joined by a space; either may be blank).
 * A row with no name is dropped entirely — a qty/unit typed alone with no
 * name has nothing to attach to and would be meaningless to the supplier.
 * An all-blank or empty `rows` list yields "".
 */
export function serializeExtraItems(rows: ExtraItemRow[]): string {
  return rows
    .map((r) => ({ name: r.name.trim(), qty: r.qty.trim(), unit: r.unit.trim() }))
    .filter((r) => r.name.length > 0)
    .map((r) => {
      const qtyUnit = [r.qty, r.unit].filter((s) => s.length > 0).join(" ");
      return qtyUnit ? `${r.name}${NAME_SEP}${qtyUnit}` : r.name;
    })
    .join("\n");
}

/**
 * Parse a previously-serialised `extra_items` string back into rows, so the
 * edit screen can pre-fill the control from an existing order instead of
 * blanking it. Best-effort: this is the inverse of `serializeExtraItems` for
 * the common case (name, or name + qty, or name + qty + unit), but a row
 * saved with a unit and no quantity does not round-trip byte-for-byte (a
 * lone trailing word after the separator is read back as `qty`, not `unit` —
 * an inherent ambiguity of the "name - qty unit" shape). This is a
 * deliberate, documented trade-off: nothing is dropped or thrown away, the
 * text is simply re-bucketed into the qty field on edit.
 *
 * Blank input yields `[]`; a line with no " - " separator becomes a
 * name-only row (qty/unit both "").
 */
export function parseExtraItems(text: string): ExtraItemRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed.split("\n").map((rawLine) => {
    const line = rawLine.trim();
    const sepIdx = line.indexOf(NAME_SEP);
    if (sepIdx === -1) return { name: line, qty: "", unit: "" };
    const name = line.slice(0, sepIdx).trim();
    const rest = line.slice(sepIdx + NAME_SEP.length).trim();
    if (!rest) return { name, qty: "", unit: "" };
    const spaceIdx = rest.indexOf(" ");
    if (spaceIdx === -1) return { name, qty: rest, unit: "" };
    return {
      name,
      qty: rest.slice(0, spaceIdx).trim(),
      unit: rest.slice(spaceIdx + 1).trim(),
    };
  });
}
