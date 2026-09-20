import { describe, expect, it } from "vitest";

import {
  CRATES_LINE_PREFIX,
  composeCaptainNote,
  parseCaptainNote,
  serializeCratesLine,
  supplierNotePrompt,
} from "./supplierPrompts";

describe("supplierNotePrompt", () => {
  it("maps Coca-Cola to the crates prompt and everything else to null", () => {
    expect(supplierNotePrompt("SUP_COCACOLA")).toBe("crates");
    expect(supplierNotePrompt("SUP_PAGO")).toBeNull();
    expect(supplierNotePrompt(null)).toBeNull();
    expect(supplierNotePrompt(undefined)).toBeNull();
  });
});

describe("serializeCratesLine", () => {
  it("writes the fixed first-line format", () => {
    expect(serializeCratesLine({ empty: 3, withBottles: 5 })).toBe(
      `${CRATES_LINE_PREFIX}puste 3, z butelkami 5`,
    );
  });

  it("returns '' when both counts are blank, and 0 for a single blank", () => {
    expect(serializeCratesLine({ empty: "", withBottles: "" })).toBe("");
    expect(serializeCratesLine({ empty: 2, withBottles: "" })).toBe(
      "Skrzynki do odbioru: puste 2, z butelkami 0",
    );
    expect(serializeCratesLine({ empty: "", withBottles: 4 })).toBe(
      "Skrzynki do odbioru: puste 0, z butelkami 4",
    );
  });

  it("truncates fractions and clamps negatives to 0", () => {
    expect(serializeCratesLine({ empty: 2.7, withBottles: -1 })).toBe(
      "Skrzynki do odbioru: puste 2, z butelkami 0",
    );
  });

  it("writes no line when both counts are 0 — typing then clearing retracts it", () => {
    expect(serializeCratesLine({ empty: 0, withBottles: 0 })).toBe("");
    expect(serializeCratesLine({ empty: 0, withBottles: "" })).toBe("");
    // Round-trip through the note: 3 typed, then cleared → plain comment again.
    const withLine = composeCaptainNote({ empty: 3, withBottles: "" }, "bez lodu");
    expect(withLine.startsWith(CRATES_LINE_PREFIX)).toBe(true);
    const parsed = parseCaptainNote(withLine);
    const cleared = composeCaptainNote({ ...parsed.crates, empty: "" }, parsed.rest);
    expect(cleared).toBe("bez lodu");
  });
});

describe("parseCaptainNote / composeCaptainNote round-trip", () => {
  it("round-trips counts plus free text", () => {
    const note = composeCaptainNote({ empty: 3, withBottles: 5 }, "proszę o dostawę rano");
    expect(note).toBe("Skrzynki do odbioru: puste 3, z butelkami 5\nproszę o dostawę rano");
    const parsed = parseCaptainNote(note);
    expect(parsed.crates).toEqual({ empty: 3, withBottles: 5 });
    expect(parsed.rest).toBe("proszę o dostawę rano");
    expect(composeCaptainNote(parsed.crates, parsed.rest)).toBe(note);
  });

  it("round-trips counts with no free text", () => {
    const note = composeCaptainNote({ empty: 0, withBottles: 12 }, "");
    expect(note).toBe("Skrzynki do odbioru: puste 0, z butelkami 12");
    const parsed = parseCaptainNote(note);
    expect(parsed.crates).toEqual({ empty: 0, withBottles: 12 });
    expect(parsed.rest).toBe("");
  });

  it("keeps multi-line free text intact after the crates line", () => {
    const parsed = parseCaptainNote(
      "Skrzynki do odbioru: puste 1, z butelkami 2\nlinia A\nlinia B",
    );
    expect(parsed.crates).toEqual({ empty: 1, withBottles: 2 });
    expect(parsed.rest).toBe("linia A\nlinia B");
  });

  it("missing line: crates null, whole note is the rest", () => {
    expect(parseCaptainNote("tylko komentarz\ndruga linia")).toEqual({
      crates: null,
      rest: "tylko komentarz\ndruga linia",
    });
    expect(parseCaptainNote("")).toEqual({ crates: null, rest: "" });
    expect(parseCaptainNote(null)).toEqual({ crates: null, rest: "" });
    expect(parseCaptainNote(undefined)).toEqual({ crates: null, rest: "" });
  });

  it("malformed line: not parsed, nothing dropped", () => {
    const malformed = "Skrzynki do odbioru: puste dużo, z butelkami 3\nreszta";
    expect(parseCaptainNote(malformed)).toEqual({ crates: null, rest: malformed });
    const wrongOrder = "Skrzynki do odbioru: z butelkami 3, puste 2";
    expect(parseCaptainNote(wrongOrder)).toEqual({ crates: null, rest: wrongOrder });
    const notFirst = "komentarz\nSkrzynki do odbioru: puste 2, z butelkami 3";
    expect(parseCaptainNote(notFirst)).toEqual({ crates: null, rest: notFirst });
  });

  it("compose with null or all-blank crates is just the free text", () => {
    expect(composeCaptainNote(null, "abc")).toBe("abc");
    expect(composeCaptainNote({ empty: "", withBottles: "" }, "abc")).toBe("abc");
    expect(composeCaptainNote(null, "")).toBe("");
  });
});
