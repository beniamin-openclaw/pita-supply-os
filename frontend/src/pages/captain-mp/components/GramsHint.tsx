// Soft, dismissible "Czy chodziło o 0,5 szt? (1 szt = 820 g)" prompt for
// piece-counted products whose name carries the per-piece weight. Wraps the
// plain stock input (same placement/behaviour as the R-25 pack prompt: only
// after the Captain left the field, never on mount, never blocks).

import { useState, type FocusEvent, type ReactNode } from "react";

import { useT } from "../../../i18n";
import { formatBaseQty } from "../../../lib/packStock";
import { parseGramsPerPiece, suggestPiecesFromGrams } from "../../../lib/gramsHint";

interface GramsHintProps {
  value: number | "";
  onChange: (v: number | "") => void;
  /** Product names to read the per-piece weight from (first with a weight wins). */
  names: Array<string | null | undefined>;
  unit: string;
  /** Location max in the same unit; a value within 3 x max never prompts. */
  maxStock?: number | null;
  /** DOM id of the stock input; only its focus/blur drives the prompt. */
  inputId: string;
  children: ReactNode;
}

export function GramsHint({
  value,
  onChange,
  names,
  unit,
  maxStock,
  inputId,
  children,
}: GramsHintProps) {
  const { t, lang } = useT();
  const [focused, setFocused] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [dismissed, setDismissed] = useState<number | "" | null>(null);

  let grams: number | null = null;
  for (const n of names) {
    grams = parseGramsPerPiece(n);
    if (grams !== null) break;
  }
  const suggested: number | null =
    grams !== null && typeof value === "number" ? suggestPiecesFromGrams(value, grams, unit, maxStock) : null;
  const show: boolean = suggested !== null && interacted && !focused && dismissed !== value;

  const handleFocus = (e: FocusEvent<HTMLDivElement>): void => {
    if (e.target instanceof HTMLInputElement && e.target.id === inputId) setFocused(true);
  };
  const handleBlur = (e: FocusEvent<HTMLDivElement>): void => {
    if (!(e.target instanceof HTMLInputElement) || e.target.id !== inputId) return;
    setFocused(false);
    setInteracted(true);
  };

  return (
    <div onFocus={handleFocus} onBlur={handleBlur}>
      {children}
      {show && suggested !== null && grams !== null && (
        <div
          role="status"
          data-testid="grams-hint"
          className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <span>
            {t("gramsHint.didYouMean", {
              n: formatBaseQty(suggested, lang),
              unit,
              g: formatBaseQty(grams, lang),
            })}
          </span>
          <button
            type="button"
            onClick={() => onChange(suggested)}
            className="rounded-full bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {t("gramsHint.yes", { n: formatBaseQty(suggested, lang), unit })}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(value)}
            className="rounded-full border border-amber-400 bg-white px-3 py-1.5 text-sm text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {t("stock.didYouMeanNo")}
          </button>
        </div>
      )}
    </div>
  );
}
