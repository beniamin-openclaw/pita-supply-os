// Locale-tolerant decimal input. Drop-in replacement for `<input type="number">`
// on the Captain/Manager quantity + stock fields.
//
// Why this exists: a `type="number"` input in a pl-PL locale does NOT hand a
// typed comma ("0,6") to JS — the field reads back "", so weight-goods values
// silently blank out (no suggestion, "bez stanu", row dropped). This renders a
// `type="text"` input instead, keeps a local raw-string buffer so a mid-type
// "0," survives (a number-typed state would coerce it to 0 and erase the comma),
// and emits `number | ""` upward via parseDecimal — so callers keep their exact
// `number | ""` state shape and the logic layer (compute/payload) is untouched.

import { useState, type ChangeEvent } from "react";

import { parseDecimal, formatDecimal } from "./number";

interface DecimalInputProps {
  value: number | "";
  onChange: (value: number | "") => void;
  id?: string;
  /** Mobile keyboard hint. "decimal" shows a comma/dot key; "numeric" is digits-only. */
  inputMode?: "decimal" | "numeric";
  className?: string;
  placeholder?: string;
  min?: number;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export function DecimalInput({
  value,
  onChange,
  inputMode = "decimal",
  className,
  ...rest
}: DecimalInputProps) {
  // Local raw-string buffer: what the user actually typed (may be mid-decimal,
  // e.g. "0,"). The parent only ever sees `number | ""` via onChange.
  const [raw, setRaw] = useState<string>(() => formatDecimal(value));

  // Re-seed the buffer when `value` changes EXTERNALLY (tap-to-autofill the
  // suggestion, draft restore, reset). This is React's "adjust state during
  // render" pattern (https://react.dev/learn/you-might-not-need-an-effect) —
  // NOT an effect. `syncedValue` tracks the last value we reconciled against, so
  // our own echo (the parent re-sending the value we just emitted) does not
  // clobber a mid-typed "0,": the guard below only reseeds when the incoming
  // value no longer matches what the buffer already represents.
  const [syncedValue, setSyncedValue] = useState<number | "">(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    const parsedRaw = parseDecimal(raw);
    const valueAsNum = value === "" ? null : value;
    if (parsedRaw !== valueAsNum) {
      setRaw(formatDecimal(value));
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setRaw(next);
    if (next.trim() === "") {
      onChange("");
      return;
    }
    const parsed = parseDecimal(next);
    // Invalid partial (e.g. "abc") → keep the raw text on screen but don't emit;
    // the parent retains its last good value.
    if (parsed !== null) onChange(parsed);
  };

  // Visual cue for unparseable text (e.g. stray letters): a red ring composed with
  // the caller's className. Uses `ring` (not border-color) so it never fights the
  // parent's border classes; aria-invalid stays the parent's concern (impl-review F3).
  const invalid = raw.trim() !== "" && parseDecimal(raw) === null;
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={raw}
      onChange={handleChange}
      {...rest}
      className={`${className ?? ""}${invalid ? " ring-2 ring-red-400" : ""}`}
    />
  );
}
