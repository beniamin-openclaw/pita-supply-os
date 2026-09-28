// Two-field stock input for pack-based products (pago-stock-packs-plus-kg):
// "full packs + loose base units". Emits the combined quantity in BASE units —
// state and the API contract never leave inventory units. Shows a live reading
// and a soft "did you mean N packs?" prompt when a small loose value looks
// like a pack count; the prompt never blocks anything.

import { useState, type FocusEvent } from "react";

import { DecimalInput } from "../../../components/ui/DecimalInput";
import { useT } from "../../../i18n";
import { packUnitLabel } from "../../../i18n/packUnits";
import { formatPacks } from "../../../lib/packUnits";
import {
  combinePackStock,
  formatBaseQty,
  formatPackStock,
  splitPackStock,
  suggestPackCount,
} from "../../../lib/packStock";

interface PackStockInputProps {
  idPrefix: string;
  value: number | "";
  onChange: (v: number | "") => void;
  unitsPerPack: number;
  packUnit: string;
  baseUnit: string;
  /** Visible field label text (used in the per-field aria-label). */
  label: string;
  references?: Array<number | null | undefined>;
}

interface Pair {
  packs: number | "";
  loose: number | "";
}

function seed(value: number | "", upp: number): Pair {
  if (typeof value !== "number") return { packs: "", loose: "" };
  return splitPackStock(value, upp);
}

const FIELD_CLASS =
  "w-20 bg-white border border-gray-300 rounded-lg py-3 px-2 min-h-[44px] text-right text-[16px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500";

export function PackStockInput({
  idPrefix,
  value,
  onChange,
  unitsPerPack: upp,
  packUnit,
  baseUnit,
  label,
  references = [],
}: PackStockInputProps) {
  const { t, lang } = useT();
  const [pair, setPair] = useState<Pair>(() => seed(value, upp));
  const [syncedValue, setSyncedValue] = useState<number | "">(value);
  const [focused, setFocused] = useState(false);
  // The prompt only follows the Captain's own typing — never old data on mount.
  const [touched, setTouched] = useState(false);
  const [dismissedLoose, setDismissedLoose] = useState<number | "" | null>(null);

  // Re-seed on an EXTERNAL value change only (draft restore, supplier switch,
  // snapshot pre-fill). The parent echoing back what we just emitted equals
  // combine(pair), so a half-typed field is never clobbered.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value !== combinePackStock(pair.packs, pair.loose, upp)) {
      setPair(seed(value, upp));
    }
  }

  const emit = (next: Pair): void => {
    setPair(next);
    const combined = combinePackStock(next.packs, next.loose, upp);
    setSyncedValue(combined);
    onChange(combined);
  };

  const combined = combinePackStock(pair.packs, pair.loose, upp);
  const packsId = `${idPrefix}-packs`;
  const looseId = `${idPrefix}-loose`;
  const readingId = `${idPrefix}-reading`;

  let reading: string | null = null;
  if (combined !== "") {
    const total = `${formatBaseQty(combined, lang)} ${baseUnit}`;
    reading =
      splitPackStock(combined, upp).packs >= 1
        ? t("stock.reading", {
            split: formatPackStock(combined, upp, packUnit, baseUnit, lang),
            total,
          })
        : t("stock.readingBase", { total });
  }

  const suggested = suggestPackCount({
    packs: pair.packs,
    loose: pair.loose,
    upp,
    references,
  });
  const showPrompt = suggested !== null && touched && !focused && dismissedLoose !== pair.loose;

  // Only focus inside the two FIELDS suppresses the prompt — focusing the
  // prompt's own buttons must not unmount it before the click lands.
  const handleFocus = (e: FocusEvent<HTMLDivElement>): void => {
    if (e.target instanceof HTMLInputElement) setFocused(true);
  };
  const handleBlur = (e: FocusEvent<HTMLDivElement>): void => {
    const next = e.relatedTarget;
    if (next instanceof HTMLInputElement && e.currentTarget.contains(next)) return;
    setFocused(false);
  };

  return (
    <div onFocus={handleFocus} onBlur={handleBlur}>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <div>
          <DecimalInput
            id={packsId}
            inputMode="decimal"
            value={pair.packs}
            onChange={(v) => {
              setTouched(true);
              emit({ ...pair, packs: v });
            }}
            aria-label={t("stock.fieldAria", { label, unit: packUnitLabel(1, packUnit, lang) })}
            aria-describedby={readingId}
            className={FIELD_CLASS}
            placeholder="0"
          />
          <div className="mt-0.5 text-[10px] leading-tight text-right text-slate-500">
            {packUnitLabel(pair.packs || 0, packUnit, lang)}
          </div>
        </div>
        <span className="py-3 text-slate-500" aria-hidden="true">
          +
        </span>
        <div>
          <DecimalInput
            id={looseId}
            inputMode="decimal"
            value={pair.loose}
            onChange={(v) => {
              setTouched(true);
              emit({ ...pair, loose: v });
            }}
            aria-label={t("stock.fieldAria", { label, unit: packUnitLabel(1, baseUnit, lang) })}
            aria-describedby={readingId}
            className={FIELD_CLASS}
            placeholder="0"
          />
          <div className="mt-0.5 text-[10px] leading-tight text-right text-slate-500">
            {packUnitLabel(pair.loose || 0, baseUnit, lang)}
          </div>
        </div>
        <div
          id={readingId}
          aria-live="polite"
          className="py-3 text-[13px] leading-tight text-slate-700 tabular-nums"
        >
          {reading}
        </div>
      </div>
      {showPrompt && suggested !== null && (
        <div
          role="status"
          className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <span>
            {t("stock.didYouMean", {
              packs: formatPacks(suggested, packUnit, lang),
              total: `${formatBaseQty(suggested * upp, lang)} ${baseUnit}`,
            })}
          </span>
          <button
            type="button"
            onClick={() => emit({ packs: suggested, loose: 0 })}
            className="rounded-full bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {t("stock.didYouMeanYes")}
          </button>
          <button
            type="button"
            onClick={() => setDismissedLoose(pair.loose)}
            className="rounded-full border border-amber-400 bg-white px-3 py-1.5 text-sm text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {t("stock.didYouMeanNo")}
          </button>
        </div>
      )}
    </div>
  );
}
