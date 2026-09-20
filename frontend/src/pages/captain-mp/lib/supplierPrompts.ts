// Supplier-specific note prompts (week2-feedback-quantities Phase 7).
//
// Some suppliers need a structured piece of information on every order that
// today lives in the free-text `captain_note`. Coca-Cola is the first: the
// driver collects the empty crates and the crates with returned bottles, so
// the Captain must state both counts. Rather than a new schema column this
// pilot serialises the counts into the FIRST LINE of `captain_note`, in a
// fixed, machine-parseable format, so the structural variant (own columns)
// can migrate the text later without guessing at hand-typed wording.
//
// This module is the pure serialise/parse pair (mirrors extraItems.ts): the
// UI (OrderCommentField) calls it; no backend code parses the note.

/** Known prompt variants. Only "crates" exists today. */
export type SupplierNotePrompt = "crates";

/** supplier_id → prompt variant. Absent = plain comment field. */
export const SUPPLIER_NOTE_PROMPTS: Record<string, SupplierNotePrompt> = {
  SUP_COCACOLA: "crates",
};

export function supplierNotePrompt(
  supplierId: string | null | undefined,
): SupplierNotePrompt | null {
  if (!supplierId) return null;
  return SUPPLIER_NOTE_PROMPTS[supplierId] ?? null;
}

// The serialised crates line. This Polish text is a STABLE DATA-FORMAT
// CONSTANT — the parser contract for what is stored in `captain_note` — and
// is therefore deliberately exempt from the "all copy via src/i18n/" rule:
// translating it per UI language would make notes written under one language
// unparseable under the other, and the Manager reads the stored line verbatim.
// The i18n'd labels for the inputs live in strings.ts; this is not UI copy.
export const CRATES_LINE_PREFIX = "Skrzynki do odbioru: ";
const CRATES_LINE_RE = /^Skrzynki do odbioru: puste (\d+), z butelkami (\d+)\s*$/;

/** Crate counts as the UI holds them: "" = the Captain left the box blank. */
export interface CratesCounts {
  empty: number | "";
  withBottles: number | "";
}

export function blankCrates(): CratesCounts {
  return { empty: "", withBottles: "" };
}

/**
 * Serialise the counts into the crates line, or "" when BOTH are blank or 0
 * (no line is written — the note stays a plain comment). A single blank box is
 * written as 0 so the line is always complete and parseable.
 */
export function serializeCratesLine(crates: CratesCounts): string {
  const empty = crates.empty === "" ? 0 : Math.max(0, Math.trunc(crates.empty));
  const withBottles =
    crates.withBottles === "" ? 0 : Math.max(0, Math.trunc(crates.withBottles));
  // Both effectively 0 (blank OR zero) → no line: this is what lets a Captain
  // retract the crates line by clearing the boxes (impl-review Phase 7 F2);
  // the boxes are re-derived from the string on every render, so a written
  // "0, 0" could otherwise never be removed again.
  if (empty === 0 && withBottles === 0) return "";
  return `${CRATES_LINE_PREFIX}puste ${empty}, z butelkami ${withBottles}`;
}

/** Result of splitting a stored `captain_note` into its crates line + the rest. */
export interface ParsedCaptainNote {
  /** null when the note carries no (well-formed) crates line. */
  crates: CratesCounts | null;
  /** The free-text remainder (never includes the crates line). */
  rest: string;
}

/**
 * Parse a stored `captain_note`. A well-formed first line yields `crates` and
 * the remaining lines as `rest`. A missing or malformed first line yields
 * `crates: null` and the WHOLE note as `rest`, so nothing the Captain typed is
 * ever dropped — a hand-edited line simply stays part of the free text.
 */
export function parseCaptainNote(note: string | null | undefined): ParsedCaptainNote {
  const text = note ?? "";
  if (text === "") return { crates: null, rest: "" };
  const nl = text.indexOf("\n");
  const first = nl === -1 ? text : text.slice(0, nl);
  const m = CRATES_LINE_RE.exec(first);
  if (!m) return { crates: null, rest: text };
  const rest = nl === -1 ? "" : text.slice(nl + 1);
  return {
    crates: { empty: Number(m[1]), withBottles: Number(m[2]) },
    rest,
  };
}

/**
 * Compose the stored `captain_note` from counts + free text: the crates line
 * first (when any count is given), then the rest. Inverse of parseCaptainNote.
 */
export function composeCaptainNote(crates: CratesCounts | null, rest: string): string {
  const line = crates ? serializeCratesLine(crates) : "";
  if (line === "") return rest;
  if (rest === "") return line;
  return `${line}\n${rest}`;
}
